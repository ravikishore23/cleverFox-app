import {
  Box,
  Button,
  Grid,
  HStack,
  IconButton,
  Input,
  Flex,
  Text,
  VStack,

} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiX, FiMaximize2, FiMinimize2, FiCopy } from "react-icons/fi";
import { io, type Socket } from "socket.io-client";

type SessionData = {
  sessionId: string;
  selfId: string;
  participants: PeerInfo[];
};

type AckResponse = {
  ok: boolean;
  data?: SessionData;
  error?: string;
};

type VideoToolProps = {
  onClose?: () => void;
  onVideoSelect?: (src: string) => void;
  currentVideo?: string | null;
};

type PeerInfo = {
  socketId: string;
  name: string;
};

function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured;

  if (typeof window === "undefined") {
    return "http://localhost:3001";
  }

  const { protocol, hostname } = window.location;
  
  // If running in Electron or local file system, default to localhost
  if (protocol === "file:" || !hostname) {
    return "http://localhost:3001";
  }

  // If we are on the web, use the same origin, so the proxy or tunnel can handle it
  return "";
}

const API_BASE = resolveApiBase();

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function VideoTool({
  onClose,
  onVideoSelect: _onVideoSelect,
  currentVideo: _currentVideo,
}: VideoToolProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const selfIdRef = useRef<string>("");

  const [name, setName] = useState("Ravi");
  const [sessionInput, setSessionInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState("Not connected");
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<
    Array<{ socketId: string; stream: MediaStream; name: string }>
  >([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isInSession = Boolean(sessionId);

  const peersById = useMemo(() => {
    const map = new Map<string, PeerInfo>();
    for (const p of peers) map.set(p.socketId, p);
    return map;
  }, [peers]);

  const clearRemote = useCallback((socketId: string) => {
    setRemoteStreams((prev) => prev.filter((p) => p.socketId !== socketId));
    setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
  }, []);

  const closePeer = useCallback(
    (socketId: string) => {
      const pc = peerConnectionsRef.current.get(socketId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(socketId);
      }
      clearRemote(socketId);
    },
    [clearRemote],
  );

  const createPeerConnection = useCallback(
    (remoteSocketId: string, remoteName: string) => {
      const existing = peerConnectionsRef.current.get(remoteSocketId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(RTC_CONFIG);

      const localStream = localStreamRef.current;
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        socketRef.current?.emit("video:signal-ice", {
          to: remoteSocketId,
          candidate: event.candidate.toJSON(),
        });
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (!stream) return;
        setRemoteStreams((prev) => {
          const existingItem = prev.find((p) => p.socketId === remoteSocketId);
          if (existingItem) {
            return prev.map((item) =>
              item.socketId === remoteSocketId
                ? { ...item, stream, name: remoteName }
                : item,
            );
          }
          return [
            ...prev,
            { socketId: remoteSocketId, stream, name: remoteName },
          ];
        });
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (
          state === "failed" ||
          state === "closed" ||
          state === "disconnected"
        ) {
          closePeer(remoteSocketId);
        }
      };

      peerConnectionsRef.current.set(remoteSocketId, pc);
      return pc;
    },
    [closePeer],
  );

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const mediaPromiseRef = useRef<Promise<MediaStream> | null>(null);

  const startLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    if (mediaPromiseRef.current) return mediaPromiseRef.current;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = "Camera/Mic blocked! Browsers require HTTPS to use the camera. If on phone, either use ngrok/HTTPS or enable the insecure origin flag in Chrome.";
      console.warn(msg);
      setStatus("Camera Access Blocked (Requires HTTPS or Localhost)");
      return Promise.reject(new Error(msg));
    }

    mediaPromiseRef.current = (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err: unknown) {
        console.warn("Could not get both video/audio, trying video only...", err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setMicOn(false);
        } catch (err2: unknown) {
          console.warn("Could not get video, trying audio only...", err2);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setCamOn(false);
        }
      }
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    })().catch(err => {
      mediaPromiseRef.current = null;
      console.error("Total camera/mic access error:", err);
      throw err;
    });

    return mediaPromiseRef.current;
  }, []);

  // We use a callback ref to guarantee streams attach the exact moment the <video> mounts
  const videoRefCallback = useCallback((node: HTMLVideoElement | null) => {
    localVideoRef.current = node;
    if (node && localStream) {
      node.srcObject = localStream;
    }
  }, [localStream]);

  // Start media immediately on mount so Lobby shows preview
  useEffect(() => {
    let isMounted = true;
    
    startLocalMedia().catch(() => {
      if (isMounted) setStatus("Warning: Camera/Mic not found or permission denied.");
    });

    return () => {
      isMounted = false;
    };
  }, [startLocalMedia]);

  const leaveSession = useCallback(() => {
    socketRef.current?.emit("video:leave-session");

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setPeers([]);
    setRemoteStreams([]);
    setSessionId("");
    setStatus("Left session");
  }, []);

  const disconnectAll = useCallback(() => {
    leaveSession();
    socketRef.current?.disconnect();
    socketRef.current = null;

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, [leaveSession]);

  const ensureSocket = useCallback(async () => {
    if (socketRef.current?.connected) return socketRef.current;
    
    // We try to start local media, but if it fails we still want to connect to socket
    // so we don't completely break the session creation fallback.
    try {
      const stream = await startLocalMedia();
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch {
      setStatus("Warning: Camera/Mic not found. You can still join.");
    }

    return new Promise<Socket>((resolve, reject) => {
      const socket = io(API_BASE, {
        transports: ["websocket", "polling"],
      });
      socketRef.current = socket;

      const timeout = setTimeout(() => {
        setStatus("Failed to connect to signaling server.");
        reject(new Error("Socket connection timeout"));
      }, 5000);

      socket.on("connect", () => {
        clearTimeout(timeout);
        setStatus("Connected to signaling server");
        resolve(socket);
      });

      socket.on("connect_error", (error) => {
        clearTimeout(timeout);
        setStatus(`Connection error: ${error.message}`);
        reject(error);
      });

      socket.on("video:error", ({ message }: { message: string }) => {
        setStatus(message || "Session error");
      });

      socket.on("video:participant-joined", ({ socketId, name }: PeerInfo) => {
        if (socketId === selfIdRef.current) return;
        setPeers((prev) => {
          if (prev.some((p) => p.socketId === socketId)) return prev;
          return [...prev, { socketId, name }];
        });
        setStatus(`${name} joined the session`);
      });

      socket.on(
        "video:participant-left",
        ({ socketId }: { socketId: string }) => {
          closePeer(socketId);
          setStatus("A participant left");
        },
      );

      socket.on(
        "video:signal-offer",
        async ({
          from,
          sdp,
        }: {
          from: string;
          sdp: RTCSessionDescriptionInit;
        }) => {
          const remoteName = peersById.get(from)?.name || "Friend";
          const pc = createPeerConnection(from, remoteName);
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("video:signal-answer", { to: from, sdp: answer });
        },
      );

      socket.on(
        "video:signal-answer",
        async ({
          from,
          sdp,
        }: {
          from: string;
          sdp: RTCSessionDescriptionInit;
        }) => {
          const pc = peerConnectionsRef.current.get(from);
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        },
      );

      socket.on(
        "video:signal-ice",
        async ({
          from,
          candidate,
        }: {
          from: string;
          candidate: RTCIceCandidateInit;
        }) => {
          const pc = peerConnectionsRef.current.get(from);
          if (!pc) return;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {
            // Ignore transient ICE ordering issues
          }
        },
      );
    });
  }, [closePeer, createPeerConnection, peersById, startLocalMedia]);

  const emitWithAck = (socket: Socket, event: string, payload: Record<string, unknown>): Promise<SessionData> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Network timeout: Signaling server did not respond."));
      }, 5000);

      socket.emit(event, payload, (response: AckResponse) => {
        clearTimeout(timeout);
        if (response?.ok && response.data) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || 'Unknown error'));
        }
      });
    });
  };

  const handleCreateSession = useCallback(async () => {
    setBusy(true);
    setStatus("Connecting...");
    try {
      const socket = await ensureSocket();
      const data = await emitWithAck(socket, "video:create-session", { name: name.trim() || "Guest" });
      // The old ensureSocket also listens to video:session-joined, but let's be explicitly safe and set it here too if needed.
      // Even if session-joined listener fires, it's good to ensure it here!
      if (data && data.sessionId) {
          selfIdRef.current = data.selfId;
          setSessionId(data.sessionId);
          setSessionInput(data.sessionId);
          setStatus(`Joined session ${data.sessionId}`);
          setPeers(data.participants || []);
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to create session",
      );
    } finally {
      setBusy(false);
    }
  }, [ensureSocket, name]);

  const handleJoinSession = useCallback(async () => {
    const session = sessionInput.trim().toUpperCase();
    if (!session) {
      setStatus("Enter session code");
      return;
    }

    setBusy(true);
    setStatus("Connecting...");
    try {
      const socket = await ensureSocket();
      const data = await emitWithAck(socket, "video:join-session", {
        sessionId: session,
        name: name.trim() || "Guest",
      });
      if (data && data.sessionId) {
          selfIdRef.current = data.selfId;
          setSessionId(data.sessionId);
          setSessionInput(data.sessionId);
          setStatus(`Joined session ${data.sessionId}`);
          setPeers(data.participants || []);
          
          for (const remote of data.participants || []) {
            const pc = createPeerConnection(remote.socketId, remote.name);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("video:signal-offer", {
              to: remote.socketId,
              sdp: offer,
            });
          }
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to join session",
      );
    } finally {
      setBusy(false);
    }
  }, [ensureSocket, name, sessionInput, createPeerConnection]);

  const copySessionCode = useCallback(async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      setStatus("Session code copied");
    } catch {
      setStatus("Failed to copy code");
    }
  }, [sessionId]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micOn;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicOn(next);
  }, [micOn]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camOn;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setCamOn(next);
  }, [camOn]);

  useEffect(() => {
    return () => {
      disconnectAll();
    };
  }, [disconnectAll]);

  const RemoteVideoTile = ({
    stream,
    label,
  }: {
    stream: MediaStream;
    label: string;
  }) => {
    const ref = useRef<HTMLVideoElement | null>(null);
    useEffect(() => {
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    }, [stream]);

    return (
      <Box borderRadius={isExpanded ? "24px" : "16px"} overflow="hidden" bg="#1A1B1E" position="relative" h="100%" minH={isExpanded ? "300px" : "180px"}>
        <video
          ref={ref}
          autoPlay
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <Box
          position="absolute"
          bottom={3}
          left={3}
          bg="rgba(0, 0, 0, 0.6)"
          backdropFilter="blur(8px)"
          px={3}
          py={1}
          borderRadius="8px"
        >
          <Text fontSize="xs" fontWeight="600" color="white">
            {label}
          </Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box
      data-fullscreen={isExpanded}
      w={isExpanded ? "100vw" : { base: "320px", md: "720px" }}
      h={isExpanded ? "100vh" : { base: "520px", md: "540px" }}
      position={isExpanded ? "fixed" : "static"}
      top={isExpanded ? 0 : "auto"}
      left={isExpanded ? 0 : "auto"}
      zIndex={isExpanded ? 9999 : "auto"}
      bg="#0C0C0E" // Deep dark background
      borderRadius={isExpanded ? "0px" : "24px"}
      borderWidth={isExpanded ? "0px" : "1px"}
      borderColor="whiteAlpha.100"
      boxShadow="0 24px 60px rgba(0,0,0,0.6)"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      color="white"
      transition="all 0.3s ease"
    >
      {/* Header */}
      <Flex align="center" justify="space-between" px={6} py={4} borderBottomWidth="1px" borderColor="whiteAlpha.100" bg="#121214">
        <HStack gap={3}>
          <Box p={2} bg="blue.500" borderRadius="10px">
            <FiVideo size={16} color="white" />
          </Box>
          <VStack align="start" gap={0}>
            <Text fontSize="md" fontWeight="600" lineHeight="1.2">
              Study Room Video
            </Text>
            {isInSession ? (
              <HStack gap={2}>
                <Text fontSize="xs" color="green.400" fontWeight="500">
                  Live
                </Text>
                <Text fontSize="xs" color="whiteAlpha.500">•</Text>
                <Text fontSize="xs" color="whiteAlpha.600">
                  {peers.length + 1} participant{peers.length + 1 !== 1 && 's'}
                </Text>
              </HStack>
            ) : (
              <Text fontSize="xs" color="whiteAlpha.500">
                Not connected
              </Text>
            )}
          </VStack>
        </HStack>
        <HStack gap={1}>
          <IconButton
            size="sm"
            variant="ghost"
            color="whiteAlpha.500"
            _hover={{ color: "white", bg: "whiteAlpha.200" }}
            aria-label="Full Screen"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
          </IconButton>
          {onClose && (
            <IconButton
              size="sm"
              variant="ghost"
              color="whiteAlpha.500"
              _hover={{ color: "white", bg: "whiteAlpha.200" }}
              aria-label="Close"
              onClick={onClose}
            >
              <FiX size={20} />
            </IconButton>
          )}
        </HStack>
      </Flex>

      {/* Main Content Area */}
      <Box flex="1" overflowY="auto" p={6} className="no-scrollbar">
        {!isInSession ? (
          /* LOBBY VIEW */
          <Flex direction="column" gap={6} h="100%">
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6} flex="1">
              
              {/* Left Column: Local Preview */}
              <Box position="relative" borderRadius="20px" overflow="hidden" bg="#1A1B1E" h="240px">
                <video
                  ref={videoRefCallback}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                {!camOn && (
                  <Flex position="absolute" inset={0} align="center" justify="center" bg="#1A1B1E">
                    <FiVideoOff size={40} color="gray" />
                  </Flex>
                )}
                
                {/* Media controls overlaid on preview */}
                <HStack position="absolute" bottom={4} left="50%" transform="translateX(-50%)" gap={3}>
                  <IconButton
                    aria-label="Toggle Mic"
                    rounded="full"
                    size="md"
                    bg={micOn ? "rgba(255,255,255,0.2)" : "red.500"}
                    color="white"
                    backdropFilter="blur(10px)"
                    _hover={{ bg: micOn ? "rgba(255,255,255,0.3)" : "red.600" }}
                    onClick={toggleMic}
                  >
                    {micOn ? <FiMic /> : <FiMicOff />}
                  </IconButton>
                  <IconButton
                    aria-label="Toggle Camera"
                    rounded="full"
                    size="md"
                    bg={camOn ? "rgba(255,255,255,0.2)" : "red.500"}
                    color="white"
                    backdropFilter="blur(10px)"
                    _hover={{ bg: camOn ? "rgba(255,255,255,0.3)" : "red.600" }}
                    onClick={toggleCamera}
                  >
                    {camOn ? <FiVideo /> : <FiVideoOff />}
                  </IconButton>
                </HStack>
              </Box>

              {/* Right Column: Controls */}
              <Flex direction="column" justify="center" gap={5}>
                <VStack align="stretch" gap={3}>
                  <Text fontSize="sm" fontWeight="600" color="whiteAlpha.800">Your Name</Text>
                  <Input
                    placeholder="Enter display name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    bg="#1A1B1E"
                    border="1px solid"
                    borderColor="whiteAlpha.100"
                    borderRadius="12px"
                    _focus={{ borderColor: "blue.400", bg: "#23242A" }}
                    h="44px"
                  />
                </VStack>

                <Button
                  h="48px"
                  borderRadius="12px"
                  bg="blue.500"
                  color="white"
                  fontWeight="600"
                  _hover={{ bg: "blue.400" }}
                  onClick={() => void handleCreateSession()}
                  disabled={busy}
                  w="100%"
                >
                  Start New Session
                </Button>

                <HStack gap={3} align="center">
                  <Box flex="1" h="1px" bg="whiteAlpha.100" />
                  <Text fontSize="xs" color="whiteAlpha.500" fontWeight="600">OR</Text>
                  <Box flex="1" h="1px" bg="whiteAlpha.100" />
                </HStack>

                <VStack align="stretch" gap={3}>
                  <HStack gap={2}>
                    <Input
                      placeholder="Session Code"
                      value={sessionInput}
                      onChange={(e) => setSessionInput(e.target.value.toUpperCase())}
                      bg="#1A1B1E"
                      border="1px solid"
                      borderColor="whiteAlpha.100"
                      borderRadius="12px"
                      _focus={{ borderColor: "blue.400", bg: "#23242A" }}
                      h="48px"
                      textTransform="uppercase"
                      flex="1"
                    />
                    <Button
                      h="48px"
                      px={6}
                      borderRadius="12px"
                      bg="whiteAlpha.100"
                      color="white"
                      _hover={{ bg: "whiteAlpha.200" }}
                      onClick={() => void handleJoinSession()}
                      disabled={busy || !sessionInput}
                    >
                      Join
                    </Button>
                  </HStack>
                </VStack>

                {status !== "Not connected" && status !== "Left session" && (
                  <Text fontSize="xs" color="red.400" textAlign="center">{status}</Text>
                )}
              </Flex>
            </Grid>
          </Flex>
        ) : (
          /* IN-SESSION VIEW */
          <Flex direction="column" h="100%" gap={4}>
            {/* Top Bar with Code */}
            <Flex justify="space-between" align="center" bg="#1A1B1E" p={3} borderRadius="16px" borderWidth="1px" borderColor="whiteAlpha.100">
              <HStack gap={3}>
                <Box px={3} py={1.5} bg="#23242A" borderRadius="8px" display="flex" alignItems="center" gap={2}>
                  <Text fontSize="sm" fontFamily="monospace" fontWeight="bold" letterSpacing="1px">
                    {sessionId}
                  </Text>
                  <IconButton 
                    size="xs" 
                    variant="ghost" 
                    aria-label="Copy session code" 
                    onClick={() => void copySessionCode()}
                    color="whiteAlpha.600"
                    _hover={{ color: "white", bg: "whiteAlpha.200" }}
                  >
                    <FiCopy size={12} />
                  </IconButton>
                </Box>
              </HStack>
              <Text fontSize="sm" color="whiteAlpha.600">
                Connection: <Text as="span" color="green.400">{status.includes("error") ? "Error" : "Stable"}</Text>
              </Text>
            </Flex>

            {/* Video Grid */}
            <Grid 
              templateColumns={remoteStreams.length === 0 ? "1fr" : { base: "1fr", md: "1fr 1fr" }} 
              gap={4} 
              flex="1"
            >
              {/* Local Participant */}
              <Box borderRadius={isExpanded ? "24px" : "16px"} overflow="hidden" bg="#1A1B1E" position="relative" h="100%" minH={isExpanded ? "300px" : "180px"}>
                <video
                  ref={videoRefCallback}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                {!camOn && (
                  <Flex position="absolute" inset={0} align="center" justify="center" bg="#1A1B1E">
                    <FiVideoOff size={40} color="gray" />
                  </Flex>
                )}
                <Box position="absolute" bottom={3} left={3} bg="rgba(0, 0, 0, 0.6)" backdropFilter="blur(8px)" px={3} py={1} borderRadius="8px">
                  <Text fontSize="xs" fontWeight="600" color="white">
                    You {name ? `(${name})` : ""}
                  </Text>
                </Box>
                {!micOn && (
                  <Box position="absolute" top={3} right={3} bg="red.500" p={1.5} borderRadius="full">
                    <FiMicOff size={14} color="white" />
                  </Box>
                )}
              </Box>

              {/* Remote Participants */}
              {remoteStreams.map((remote) => (
                <RemoteVideoTile
                  key={remote.socketId}
                  stream={remote.stream}
                  label={remote.name || "Friend"}
                />
              ))}
            </Grid>
            
            {/* Bottom Controls Bar */}
            <Flex justify="center" mt="auto" pt={2}>
              <HStack gap={4} bg="#1A1B1E" p={2} borderRadius="24px" borderWidth="1px" borderColor="whiteAlpha.100">
                <IconButton
                  aria-label="Toggle Mic"
                  rounded="full"
                  size="lg"
                  bg={micOn ? "whiteAlpha.100" : "red.500"}
                  color="white"
                  _hover={{ bg: micOn ? "whiteAlpha.200" : "red.600" }}
                  onClick={toggleMic}
                >
                  {micOn ? <FiMic size={20} /> : <FiMicOff size={20} />}
                </IconButton>
                
                <IconButton
                  aria-label="Toggle Camera"
                  rounded="full"
                  size="lg"
                  bg={camOn ? "whiteAlpha.100" : "red.500"}
                  color="white"
                  _hover={{ bg: camOn ? "whiteAlpha.200" : "red.600" }}
                  onClick={toggleCamera}
                >
                  {camOn ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
                </IconButton>

                <Box w="1px" h="24px" bg="whiteAlpha.200" />

                <Button
                  rounded="full"
                  h="48px"
                  px={6}
                  bg="red.500"
                  color="white"
                  fontWeight="600"
                  _hover={{ bg: "red.600" }}
                  onClick={() => leaveSession()}
                >
                  Leave Call
                </Button>
              </HStack>
            </Flex>
          </Flex>
        )}
      </Box>
    </Box>
  );
}
