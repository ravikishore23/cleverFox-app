import {
  Box,
  Button,
  chakra,
  Flex,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiMinus,
  FiMoreHorizontal,
  FiPause,
  FiPlay,
  FiPlus,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";
import { FaSpotify } from "react-icons/fa";
import {
  getDefaultRedirectUri,
  startSpotifyLogin,
} from "../../../../lib/spotify/auth";
import {
  spotifyMe,
  spotifyPause,
  spotifyPlayUri,
  type SpotifyMe,
} from "../../../../lib/spotify/api";
import {
  clearToken,
  isTokenExpired,
  readToken,
  type SpotifyToken,
} from "../../../../lib/spotify/storage";
import {
  parseSpotifyUrlToUri,
  toSpotifyEmbedUrl,
} from "../../../../lib/spotify/parse";
import {
  parseYouTubeUrl,
  toYouTubeEmbedUrl,
} from "../../../../lib/youtube/parse";

type StatusMessage = { kind: "error" | "info"; text: string };

type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
  getPlayerState: () => number;
};

declare global {
  interface Window {
    YT?: {
      Player?: new (
        elementId: string,
        options?: {
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
          };
        },
      ) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youTubeIFrameApiPromise: Promise<void> | null = null;

function loadYouTubeIFrameApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (youTubeIFrameApiPromise) return youTubeIFrameApiPromise;

  youTubeIFrameApiPromise = new Promise<void>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        previousReady?.();
      } finally {
        resolve();
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existing) return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.onerror = () => reject(new Error("Failed to load YouTube IFrame API"));
    document.head.appendChild(tag);
  });

  return youTubeIFrameApiPromise;
}

type Track = {
  id: string;
  title: string;
  url: string;
  kind: "ambient" | "lofi" | "focus";
};

const BUILTIN_TRACKS: Track[] = [
  {
    id: "pixabay-rain",
    title: "Rain (ambient)",
    url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_9a43f65f2f.mp3?filename=rain-ambient-113985.mp3",
    kind: "ambient",
  },
  {
    id: "pixabay-brown-noise",
    title: "Brown noise (focus)",
    url: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_7b2a7b4c9f.mp3?filename=brown-noise-110324.mp3",
    kind: "focus",
  },
  {
    id: "pixabay-soft-piano",
    title: "Soft piano (lofi)",
    url: "https://cdn.pixabay.com/download/audio/2022/10/25/audio_bfa3bf6c5e.mp3?filename=soft-piano-ambient-121928.mp3",
    kind: "lofi",
  },
  {
    id: "pixabay-wind",
    title: "Wind (ambient)",
    url: "https://cdn.pixabay.com/download/audio/2022/03/09/audio_912f90a8b1.mp3?filename=wind-110089.mp3",
    kind: "ambient",
  },
];

export default function MusicTool() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youTubePlayerRef = useRef<YouTubePlayer | null>(null);
  const youTubeIframeId = "cleverfox-youtube-embed";
  const [selectedId, setSelectedId] = useState<string>(BUILTIN_TRACKS[0]?.id);
  const [playing, setPlaying] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState<SpotifyToken | null>(null);
  const [spotifyUser, setSpotifyUser] = useState<SpotifyMe | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null,
  );

  const selected = useMemo(() => {
    return BUILTIN_TRACKS.find((t) => t.id === selectedId) ?? BUILTIN_TRACKS[0];
  }, [selectedId]);

  const playlist = useMemo(() => BUILTIN_TRACKS.slice(0, 4), []);

  const spotifyClientId =
    (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) ?? null;
  const redirectUri = useMemo(() => getDefaultRedirectUri(), []);

  const savedSpotify = useMemo(() => {
    if (!savedUrl) return null;
    return parseSpotifyUrlToUri(savedUrl);
  }, [savedUrl]);

  const spotifyEmbedUrl = useMemo(() => {
    if (!savedUrl) return null;
    return toSpotifyEmbedUrl(savedUrl);
  }, [savedUrl]);

  const savedYouTube = useMemo(() => {
    if (!savedUrl) return null;
    return parseYouTubeUrl(savedUrl);
  }, [savedUrl]);

  const youTubeEmbedUrl = useMemo(() => {
    if (!savedUrl) return null;
    return toYouTubeEmbedUrl(savedUrl);
  }, [savedUrl]);

  const youTubeEmbedUrlWithApi = useMemo(() => {
    if (!youTubeEmbedUrl) return null;
    try {
      const url = new URL(youTubeEmbedUrl);
      url.searchParams.set("enablejsapi", "1");
      // Only set origin when we actually have an http(s) origin (Electron file:// becomes "null").
      if (
        typeof window !== "undefined" &&
        window.location.origin.startsWith("http")
      ) {
        url.searchParams.set("origin", window.location.origin);
      }
      return url.toString();
    } catch {
      return youTubeEmbedUrl;
    }
  }, [youTubeEmbedUrl]);

  useEffect(() => {
    // Load token from localStorage after OAuth redirect (handled in App.tsx).
    const token = readToken();
    if (!token) return;
    setSpotifyToken(token);
  }, []);

  useEffect(() => {
    if (!spotifyToken) return;
    if (isTokenExpired(spotifyToken)) {
      setStatusMessage({
        kind: "error",
        text: "Spotify session expired. Please connect again.",
      });
      return;
    }
    spotifyMe(spotifyToken)
      .then((me) => setSpotifyUser(me))
      .catch(() => setSpotifyUser(null));
  }, [spotifyToken]);

  useEffect(() => {
    if (!youTubeEmbedUrlWithApi) return;

    let cancelled = false;
    void loadYouTubeIFrameApi()
      .then(() => {
        if (cancelled) return;
        if (!window.YT?.Player) return;

        // Create controller for the existing iframe.
        const player = new window.YT.Player(youTubeIframeId, {
          events: {
            onReady: () => {
              setStatusMessage(null);
            },
            onStateChange: (event) => {
              // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
              if (event.data === 1) setPlaying(true);
              if (event.data === 2 || event.data === 0) setPlaying(false);
            },
          },
        });

        youTubePlayerRef.current = player;
      })
      .catch(() => {
        setStatusMessage({
          kind: "error",
          text: "YouTube player failed to load.",
        });
      });

    return () => {
      cancelled = true;
      const player = youTubePlayerRef.current;
      youTubePlayerRef.current = null;
      try {
        player?.destroy();
      } catch {
        // ignore
      }
    };
  }, [youTubeEmbedUrlWithApi]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // Keep UI in sync when the browser pauses audio.
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    return () => {
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };
  }, []);

  async function start(url: string) {
    const audio = audioRef.current;
    if (!audio) return;
    if (!url) return;
    audio.src = url;
    audio.loop = true;
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      // Autoplay blocked until user gesture; user can press Play again.
      setPlaying(false);
    }
  }

  function stop() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPlaying(false);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    start(selected?.url ?? "");
  }

  const selectedIndex = Math.max(
    0,
    playlist.findIndex((t) => t.id === selectedId),
  );

  function prev() {
    const nextIndex = (selectedIndex - 1 + playlist.length) % playlist.length;
    setSelectedId(playlist[nextIndex]!.id);
    if (playing) start(playlist[nextIndex]!.url);
  }

  function next() {
    const nextIndex = (selectedIndex + 1) % playlist.length;
    setSelectedId(playlist[nextIndex]!.id);
    if (playing) start(playlist[nextIndex]!.url);
  }

  async function spotifyConnect() {
    setStatusMessage(null);
    if (!spotifyClientId) {
      setStatusMessage({
        kind: "error",
        text: "Missing VITE_SPOTIFY_CLIENT_ID env var.",
      });
      return;
    }
    await startSpotifyLogin({ clientId: spotifyClientId, redirectUri });
  }

  async function spotifyPlay() {
    setStatusMessage(null);
    if (!spotifyToken) {
      setStatusMessage({ kind: "error", text: "Connect Spotify first." });
      return;
    }
    if (isTokenExpired(spotifyToken)) {
      setStatusMessage({
        kind: "error",
        text: "Spotify session expired. Please connect again.",
      });
      return;
    }
    if (!savedSpotify) {
      setStatusMessage({
        kind: "error",
        text: "Paste a Spotify track/playlist link first.",
      });
      return;
    }

    // Important: Web API can't stream audio itself; it controls Spotify on an active device.
    const result = await spotifyPlayUri(spotifyToken, savedSpotify.uri);
    if (!result.ok) {
      if (result.status === 404) {
        setStatusMessage({
          kind: "error",
          text: "No active Spotify device found. Open Spotify on your phone/desktop and start playing something once, then try again.",
        });
      } else if (result.status === 403) {
        setStatusMessage({
          kind: "error",
          text: "Spotify blocked playback. If you want playback inside the app, you’ll need Spotify Premium + Web Playback SDK.",
        });
      } else {
        setStatusMessage({
          kind: "error",
          text: `Spotify play failed (${result.status}).`,
        });
      }
      return;
    }
    setPlaying(true);
  }

  async function spotifyDoPause() {
    setStatusMessage(null);
    if (!spotifyToken) return;
    await spotifyPause(spotifyToken);
    setPlaying(false);
  }

  function youTubeTogglePlay() {
    const player = youTubePlayerRef.current;
    if (!player) {
      setStatusMessage({ kind: "info", text: "YouTube player is loading…" });
      return;
    }

    // Stop local audio to avoid double playback.
    stop();

    // Player states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
    const state = player.getPlayerState();
    if (state === 1 || state === 3) {
      player.pauseVideo();
      return;
    }
    player.playVideo();
  }

  function spotifyDisconnect() {
    clearToken();
    setSpotifyToken(null);
    setSpotifyUser(null);
    setStatusMessage(null);
  }

  return (
    <Box
      w={{ base: "calc(100vw - 120px)", sm: "420px" }}
      maxW="520px"
      borderRadius="14px"
      overflow="hidden"
      boxShadow="0 18px 50px rgba(0,0,0,0.35)"
      borderWidth="1px"
      borderColor="blackAlpha.300"
      bg="#0B0B0C"
    >
      {/* Title bar */}
      <Flex
        align="center"
        justify="space-between"
        px={4}
        py={2}
        bg="#121214"
        borderBottomWidth="1px"
        borderBottomColor="whiteAlpha.200"
      >
        <Text fontSize="sm" color="white" fontWeight="700">
          Music
        </Text>
        <HStack gap={1}>
          <IconButton
            aria-label="Minimize"
            size="xs"
            variant="ghost"
            color="white"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={() => setMinimized((v) => !v)}
          >
            <Icon as={FiMinus} />
          </IconButton>
          <IconButton
            aria-label="Close"
            size="xs"
            variant="ghost"
            color="white"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={stop}
          >
            <Icon as={FiX} />
          </IconButton>
        </HStack>
      </Flex>

      {minimized ? (
        <Box px={4} py={4}>
          <Text fontSize="sm" color="whiteAlpha.800">
            Minimized
          </Text>
        </Box>
      ) : (
        <Box px={4} py={4}>
          {/* Purple Spotify-like preview */}
          <Box
            borderRadius="14px"
            bg="#5C57C8"
            p={3}
            color="white"
            position="relative"
          >
            <Flex gap={3} align="flex-start">
              <Box
                w="86px"
                h="86px"
                borderRadius="12px"
                bg="whiteAlpha.200"
                overflow="hidden"
              >
                <Image
                  src="/fox-logo.png"
                  alt="Clever Fox"
                  w="full"
                  h="full"
                  objectFit="cover"
                />
              </Box>

              <Box flex="1" minW={0}>
                <Flex align="center" justify="space-between" mb={2}>
                  <Text fontSize="sm" fontWeight="800">
                    clever Fox
                  </Text>
                  <HStack gap={2}>
                    <Icon as={FaSpotify} boxSize={5} />
                    {spotifyToken ? (
                      <Text fontSize="xs" color="whiteAlpha.900">
                        {spotifyUser?.display_name
                          ? spotifyUser.display_name
                          : "Connected"}
                      </Text>
                    ) : (
                      <Text fontSize="xs" color="whiteAlpha.900">
                        Not connected
                      </Text>
                    )}
                  </HStack>
                </Flex>

                <Stack gap={1} fontSize="xs" color="whiteAlpha.900">
                  {playlist.map((t, idx) => (
                    <Box
                      key={t.id}
                      as="button"
                      onClick={() => setSelectedId(t.id)}
                      textAlign="left"
                      opacity={t.id === selectedId ? 1 : 0.85}
                      _hover={{ opacity: 1 }}
                      display="flex"
                      gap={2}
                    >
                      <Text as="span" w="14px" opacity={0.9}>
                        {idx + 1}
                      </Text>
                      <Text
                        as="span"
                        lineClamp={1}
                        title={t.title}
                        fontWeight={t.id === selectedId ? "800" : "600"}
                      >
                        {t.title}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Flex>

            <Button
              size="xs"
              mt={3}
              borderRadius="10px"
              bg="blackAlpha.400"
              color="white"
              _hover={{ bg: "blackAlpha.500" }}
              onClick={() => {
                if (savedSpotify) {
                  void spotifyPlay();
                  return;
                }
                if (youTubeEmbedUrlWithApi) return youTubeTogglePlay();
                void start(selected?.url ?? "");
              }}
            >
              Preview
            </Button>

            <HStack gap={2} mt={3} justify="space-between">
              <HStack gap={1}>
                <IconButton
                  aria-label="Previous"
                  size="xs"
                  variant="ghost"
                  color="white"
                  _hover={{ bg: "whiteAlpha.200" }}
                  onClick={prev}
                >
                  <Icon as={FiChevronLeft} />
                </IconButton>
                <IconButton
                  aria-label="Next"
                  size="xs"
                  variant="ghost"
                  color="white"
                  _hover={{ bg: "whiteAlpha.200" }}
                  onClick={next}
                >
                  <Icon as={FiChevronRight} />
                </IconButton>
                <IconButton
                  aria-label="Add"
                  size="xs"
                  variant="ghost"
                  color="white"
                  _hover={{ bg: "whiteAlpha.200" }}
                >
                  <Icon as={FiPlus} />
                </IconButton>
                <IconButton
                  aria-label="More"
                  size="xs"
                  variant="ghost"
                  color="white"
                  _hover={{ bg: "whiteAlpha.200" }}
                >
                  <Icon as={FiMoreHorizontal} />
                </IconButton>
              </HStack>

              <IconButton
                aria-label={playing ? "Pause" : "Play"}
                size="sm"
                borderRadius="999px"
                bg="blackAlpha.500"
                color="white"
                _hover={{ bg: "blackAlpha.600" }}
                onClick={() => {
                  if (savedSpotify) {
                    void (playing ? spotifyDoPause() : spotifyPlay());
                    return;
                  }
                  if (youTubeEmbedUrlWithApi) return youTubeTogglePlay();
                  togglePlay();
                }}
              >
                <Icon as={playing ? FiPause : FiPlay} />
              </IconButton>
            </HStack>
          </Box>

          {/* URL input + Save */}
          <HStack gap={3} mt={4}>
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter YouTube, Spotify, or Apple Music URL here"
              h="40px"
              borderRadius="10px"
              bg="#1A1A1D"
              borderWidth="1px"
              borderColor="whiteAlpha.200"
              color="white"
              _placeholder={{ color: "whiteAlpha.600" }}
            />
            <Button
              h="40px"
              borderRadius="10px"
              bg="transparent"
              borderWidth="1px"
              borderColor="whiteAlpha.400"
              color="white"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={() => {
                const url = urlInput.trim();
                if (!url) return;
                setSavedUrl(url);
              }}
            >
              Save
            </Button>
            <IconButton
              aria-label="Refresh"
              h="40px"
              w="40px"
              borderRadius="10px"
              variant="ghost"
              color="white"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={() => {
                setUrlInput(savedUrl ?? "");
              }}
            >
              <Icon as={FiRefreshCw} />
            </IconButton>
          </HStack>

          {savedUrl ? (
            <Stack mt={2} gap={1}>
              <Text fontSize="xs" color="whiteAlpha.700" lineClamp={1}>
                Saved: {savedUrl}
              </Text>
              {savedSpotify ? (
                <Text fontSize="xs" color="whiteAlpha.800">
                  Detected Spotify {savedSpotify.type}: {savedSpotify.id}
                </Text>
              ) : null}
              {savedYouTube ? (
                <Text fontSize="xs" color="whiteAlpha.800">
                  Detected YouTube {savedYouTube.kind}: {savedYouTube.id}
                </Text>
              ) : null}
            </Stack>
          ) : null}

          <HStack mt={4} justify="space-between" flexWrap="wrap" gap={2}>
            <HStack gap={2}>
              <Button
                size="sm"
                borderRadius="10px"
                bg={spotifyToken ? "whiteAlpha.200" : "#1DB954"}
                color={spotifyToken ? "white" : "black"}
                _hover={{ bg: spotifyToken ? "whiteAlpha.200" : "#19a14a" }}
                onClick={() => void spotifyConnect()}
                disabled={!!spotifyToken}
              >
                {spotifyToken ? "Spotify connected" : "Connect Spotify"}
              </Button>
              {spotifyToken ? (
                <Button
                  size="sm"
                  borderRadius="10px"
                  bg="transparent"
                  borderWidth="1px"
                  borderColor="whiteAlpha.400"
                  color="white"
                  _hover={{ bg: "whiteAlpha.200" }}
                  onClick={spotifyDisconnect}
                >
                  Disconnect
                </Button>
              ) : null}
            </HStack>

            {savedUrl ? (
              <Button
                size="sm"
                borderRadius="10px"
                bg="transparent"
                borderWidth="1px"
                borderColor="whiteAlpha.400"
                color="white"
                _hover={{ bg: "whiteAlpha.200" }}
                onClick={() => window.open(savedUrl!, "_blank")}
              >
                Open
              </Button>
            ) : null}
          </HStack>

          {statusMessage ? (
            <Text
              mt={2}
              fontSize="xs"
              color={
                statusMessage.kind === "error" ? "red.200" : "whiteAlpha.800"
              }
            >
              {statusMessage.text}
            </Text>
          ) : null}

          {spotifyEmbedUrl ? (
            <Box
              mt={4}
              borderRadius="12px"
              overflow="hidden"
              borderWidth="1px"
              borderColor="whiteAlpha.200"
            >
              <chakra.iframe
                title="Spotify embed"
                src={spotifyEmbedUrl}
                width="100%"
                height="152"
                style={{ border: 0, display: "block" }}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            </Box>
          ) : null}

          {youTubeEmbedUrlWithApi ? (
            <Box
              mt={4}
              borderRadius="12px"
              overflow="hidden"
              borderWidth="1px"
              borderColor="whiteAlpha.200"
            >
              <chakra.iframe
                title="YouTube embed"
                id={youTubeIframeId}
                src={youTubeEmbedUrlWithApi}
                width="100%"
                height="152"
                style={{ border: 0, display: "block" }}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                loading="lazy"
              />
            </Box>
          ) : null}
        </Box>
      )}

      <audio ref={audioRef} />
    </Box>
  );
}
