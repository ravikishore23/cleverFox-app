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
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  FiSkipBack,
  FiSkipForward,
  FiMoreHorizontal,
  FiPause,
  FiPlay,
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
    id: "barradeen-bedtime-after-a-coffee",
    title: "Bedtime After a Coffee",
    url: "/musics/barradeen-bedtime-after-a-coffee(chosic.com).mp3",
    kind: "ambient",
  },
  {
    id: "butterfly",
    title: "Butterfly",
    url: "/musics/Butterfly-chosic.com_.mp3",
    kind: "lofi",
  },
  {
    id: "exploration",
    title: "Exploration",
    url: "/musics/Exploration(chosic.com).mp3",
    kind: "focus",
  },
  {
    id: "fallen",
    title: "Fallen",
    url: "/musics/Fallen-chosic.com_.mp3",
    kind: "ambient",
  },
  {
    id: "in-the-moment",
    title: "In the Moment",
    url: "/musics/In-the-Moment(chosic.com).mp3",
    kind: "focus",
  },
  {
    id: "magical-moments",
    title: "Magical Moments",
    url: "/musics/Magical-Moments-chosic.com_.mp3",
    kind: "ambient",
  },
  {
    id: "once-in-a-lifetime",
    title: "Once in a Lifetime",
    url: "/musics/Once-in-a-Lifetime-chosic.com_.mp3",
    kind: "lofi",
  },
  {
    id: "torn",
    title: "Torn",
    url: "/musics/Torn(chosic.com).mp3",
    kind: "lofi",
  },
  {
    id: "when-i-was-a-boy",
    title: "When I Was a Boy",
    url: "/musics/When-I-Was-A-Boy(chosic.com).mp3",
    kind: "focus",
  },
];

type WidgetPos = { x: number; y: number };

const POS_STORAGE_KEY = "cleverfox.musicWidget.pos.v1";

const BG_COLORS = [
  "#5C57C8", // Default Purple
  "#1DB954", // Spotify Green
  "#FF4B4B", // Red
  "#2E3A59", // Dark Blue
  "#000000", // Black
  "#D97706", // Amber
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type MusicToolProps = {
  onClose?: () => void;
  onFocus?: () => void;
  zIndex?: number;
};

export default function MusicTool({
  onClose,
  onFocus,
  zIndex = 3,
}: MusicToolProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const youTubePlayerRef = useRef<YouTubePlayer | null>(null);
  const pendingYouTubePlayRef = useRef(false);
  const youTubeIframeId = "cleverfox-youtube-embed";
  const [selectedId, setSelectedId] = useState<string>(() => {
    try { const raw = window.localStorage.getItem("cf.music.selectedId"); if (raw) return raw; } catch { /* ignore */ }
    return BUILTIN_TRACKS[0]?.id;
  });
  const [playing, setPlaying] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [savedUrl, setSavedUrl] = useState<string | null>(() => {
    try { const raw = window.localStorage.getItem("cf.music.savedUrl"); if (raw) return raw; } catch { /* ignore */ }
    return null;
  });
  const [playbackSource, setPlaybackSource] = useState<
    "builtin" | "spotify" | "youtube"
  >(() => {
    try {
      const raw = window.localStorage.getItem("cf.music.playbackSource");
      if (raw === "builtin" || raw === "spotify" || raw === "youtube") return raw;
    } catch { /* ignore */ }
    return "builtin";
  });
  const [expanded, setExpanded] = useState(false);
  const [bgColor, setBgColor] = useState(() => {
    try { const raw = window.localStorage.getItem("cf.music.bgColor"); if (raw) return raw; } catch { /* ignore */ }
    return BG_COLORS[0];
  });

  useEffect(() => {
    try { window.localStorage.setItem("cf.music.selectedId", selectedId); } catch { /* ignore */ }
  }, [selectedId]);
  useEffect(() => {
    try {
      if (savedUrl) window.localStorage.setItem("cf.music.savedUrl", savedUrl);
      else window.localStorage.removeItem("cf.music.savedUrl");
    } catch { /* ignore */ }
  }, [savedUrl]);
  useEffect(() => {
    try { window.localStorage.setItem("cf.music.playbackSource", playbackSource); } catch { /* ignore */ }
  }, [playbackSource]);
  useEffect(() => {
    try { window.localStorage.setItem("cf.music.bgColor", bgColor); } catch { /* ignore */ }
  }, [bgColor]);
  const [pos, setPos] = useState<WidgetPos>(() => {
    if (typeof window === "undefined") return { x: 24, y: 96 };
    try {
      const raw = window.localStorage.getItem(POS_STORAGE_KEY);
      if (!raw) return { x: 24, y: 96 };
      const parsed = JSON.parse(raw) as Partial<WidgetPos>;
      if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
        return { x: 24, y: 96 };
      }
      return { x: parsed.x, y: parsed.y };
    } catch {
      return { x: 24, y: 96 };
    }
  });
  const [spotifyToken, setSpotifyToken] = useState<SpotifyToken | null>(() => {
    // Read token once on mount — avoids calling setState inside a useEffect
    const t = readToken();
    return t ?? null;
  });
  const [spotifyUser, setSpotifyUser] = useState<SpotifyMe | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null,
  );

  function clampToViewport(next: WidgetPos): WidgetPos {
    if (typeof window === "undefined") return next;
    const padding = 12;
    const rect = widgetRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 380;
    const height = rect?.height ?? 220;

    const maxX = Math.max(padding, window.innerWidth - width - padding);
    const maxY = Math.max(padding, window.innerHeight - height - padding);
    return {
      x: clamp(next.x, padding, maxX),
      y: clamp(next.y, padding, maxY),
    };
  }

  function onDragStart(e: ReactPointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, select, [data-no-drag]")) {
      return;
    }

    // Only enforce mouse left-click; touch/pen can report different button values.
    if (e.pointerType === "mouse" && e.button !== 0) return;

    onFocus?.();

    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const start = { x: e.clientX, y: e.clientY };
    const base = pos;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      setPos(clampToViewport({ x: base.x + dx, y: base.y + dy }));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setPos((p) => clampToViewport(p));
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const selected = useMemo(() => {
    return BUILTIN_TRACKS.find((t) => t.id === selectedId) ?? BUILTIN_TRACKS[0];
  }, [selectedId]);

  const playlist = useMemo(() => BUILTIN_TRACKS, []);

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
    if (!spotifyToken) return;
    if (isTokenExpired(spotifyToken)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
              if (pendingYouTubePlayRef.current) {
                pendingYouTubePlayRef.current = false;
                try {
                  player.playVideo();
                } catch {
                  // ignore
                }
              }
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
      setStatusMessage(null);
    } catch {
      // Autoplay blocked until user gesture; user can press Play again.
      setPlaying(false);
      setStatusMessage({
        kind: "error",
        text: "Could not start audio. Try another track.",
      });
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
    if (playlist.length <= 0) return;
    const nextIndex = (selectedIndex - 1 + playlist.length) % playlist.length;
    setSelectedId(playlist[nextIndex]!.id);
    if (playing) start(playlist[nextIndex]!.url);
  }

  function next() {
    if (playlist.length <= 0) return;
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
    if (!expanded) {
      pendingYouTubePlayRef.current = true;
      setExpanded(true);
      setStatusMessage({
        kind: "info",
        text: "Opening YouTube player…",
      });
      return;
    }

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos));
    } catch {
      // ignore
    }
  }, [pos]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setPos((p) => clampToViewport(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.requestAnimationFrame(() => {
      setPos((p) => clampToViewport(p));
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <Box
      ref={widgetRef}
      position="fixed"
      left={`${pos.x}px`}
      top={`${pos.y}px`}
      zIndex={zIndex}
      w={{ base: "calc(100vw - 24px)", sm: "380px" }}
      maxW="420px"
      onPointerDown={() => onFocus?.()}
    >
      {/* Purple Spotify-like floating widget */}
      <Box
        borderRadius="14px"
        bg={bgColor}
        p={2.5}
        color="white"
        position="relative"
        boxShadow="0 18px 50px rgba(0,0,0,0.35)"
        borderWidth="1px"
        borderColor="blackAlpha.300"
        onPointerDown={onDragStart}
        cursor="grab"
        touchAction="none"
      >
        {/* Drag handle + actions (kept subtle) */}
        <Flex align="center" justify="space-between" mb={2}>
          <HStack gap={2} userSelect="none" opacity={0.95}>
            <Box w="36px" h="5px" borderRadius="full" bg="whiteAlpha.600" />
            <Text fontSize="xs" fontWeight="700" color="whiteAlpha.900">
              Music
            </Text>
          </HStack>

          <HStack gap={1}>
            <IconButton
              aria-label={expanded ? "Hide" : "More"}
              size="xs"
              variant="ghost"
              color="white"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={() => setExpanded((v) => !v)}
            >
              <Icon as={FiMoreHorizontal} />
            </IconButton>
            <IconButton
              aria-label="Close"
              size="xs"
              variant="ghost"
              color="white"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={() => {
                pendingYouTubePlayRef.current = false;
                setExpanded(false);
                stop();
                onClose?.();
              }}
            >
              <Icon as={FiX} />
            </IconButton>
          </HStack>
        </Flex>

        <Flex gap={3} align="flex-start">
          <Box
            w="72px"
            h="72px"
            borderRadius="12px"
            bg="whiteAlpha.200"
            overflow="hidden"
          >
            <Image
              src="/music-fox.png"
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
              </HStack>
            </Flex>

            {/* Centered song list block (scroll, transparent scrollbar) */}
            <Flex justify="center">
              <Box
                w="full"
                maxW="260px"
                maxH="72px"
                overflowY="auto"
                pr={1}
                css={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "rgba(255,255,255,0.45) transparent",
                  "&::-webkit-scrollbar": { width: "6px" },
                  "&::-webkit-scrollbar-track": { background: "transparent" },
                  "&::-webkit-scrollbar-thumb": {
                    background: "rgba(255,255,255,0.45)",
                    borderRadius: "999px",
                  },
                  "&::-webkit-scrollbar-thumb:hover": {
                    background: "rgba(255,255,255,0.60)",
                  },
                }}
              >
                <Stack gap={1} fontSize="xs" color="whiteAlpha.900">
                  {playlist.map((t, idx) => (
                    <Flex
                      key={t.id}
                      as="button"
                      onClick={() => {
                        setSelectedId(t.id);
                        setPlaybackSource("builtin");
                        setStatusMessage(null);
                      }}
                      align="center"
                      gap={3}
                      opacity={t.id === selectedId ? 1 : 0.85}
                      _hover={{ opacity: 1 }}
                      textAlign="left"
                    >
                      <Text w="14px" opacity={0.85}>
                        {idx + 1}
                      </Text>
                      <Text
                        flex="1"
                        lineClamp={1}
                        title={t.title}
                        fontWeight={t.id === selectedId ? "800" : "600"}
                      >
                        {t.title}
                      </Text>
                    </Flex>
                  ))}
                </Stack>
              </Box>
            </Flex>
          </Box>
        </Flex>

        <Flex mt={3} justify="center" align="center" gap={2}>
          <IconButton
            aria-label="Previous"
            size="xs"
            variant="ghost"
            color="white"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={prev}
          >
            <Icon as={FiSkipBack} />
          </IconButton>

          <IconButton
            aria-label={playing ? "Pause" : "Play"}
            size="sm"
            borderRadius="999px"
            color="white"
            bg="transparent"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={() => {
              if (playbackSource === "spotify" && savedSpotify) {
                if (!spotifyToken) {
                  setPlaybackSource("builtin");
                  setStatusMessage({
                    kind: "info",
                    text: "Spotify not connected. Switched to built-in music.",
                  });
                  return togglePlay();
                }
                void (playing ? spotifyDoPause() : spotifyPlay());
                return;
              }
              if (playbackSource === "youtube" && youTubeEmbedUrlWithApi) {
                return youTubeTogglePlay();
              }
              if (playbackSource !== "builtin") {
                setPlaybackSource("builtin");
              }
              togglePlay();
            }}
          >
            <Icon as={playing ? FiPause : FiPlay} />
          </IconButton>

          <IconButton
            aria-label="Next"
            size="xs"
            variant="ghost"
            color="white"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={next}
          >
            <Icon as={FiSkipForward} />
          </IconButton>
        </Flex>
      </Box>

      {/* Expanded panel (hidden by default so widget doesn't block UI) */}
      {expanded ? (
        <Box
          mt={3}
          borderRadius="14px"
          overflow="hidden"
          boxShadow="0 18px 50px rgba(0,0,0,0.35)"
          borderWidth="1px"
          borderColor="blackAlpha.300"
          bg="#0B0B0C"
          p={4}
        >
          {/* Theme Colors */}
          <HStack gap={2} mb={4} justify="center">
            {BG_COLORS.map((color) => (
              <Box
                key={color}
                as="button"
                w="24px"
                h="24px"
                borderRadius="full"
                bg={color}
                borderWidth={bgColor === color ? "2px" : "1px"}
                borderColor={bgColor === color ? "white" : "whiteAlpha.200"}
                onClick={() => setBgColor(color)}
                _hover={{ transform: "scale(1.1)" }}
                transition="all 0.2s"
              />
            ))}
          </HStack>

          {/* URL input + Save */}
          <HStack gap={2} mb={3}>
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste YouTube or Spotify link"
              h="36px"
              fontSize="sm"
              borderRadius="10px"
              bg="whiteAlpha.100"
              borderWidth="1px"
              borderColor="transparent"
              _focus={{ borderColor: "whiteAlpha.300", bg: "blackAlpha.400" }}
              color="white"
              _placeholder={{ color: "whiteAlpha.500" }}
            />
            <Button
              h="36px"
              px={4}
              borderRadius="10px"
              bg="whiteAlpha.200"
              color="white"
              fontSize="sm"
              fontWeight="500"
              _hover={{ bg: "whiteAlpha.300" }}
              onClick={() => {
                const url = urlInput.trim();
                if (!url) return;
                setSavedUrl(url);
                if (parseSpotifyUrlToUri(url)) {
                  setPlaybackSource("spotify");
                  setStatusMessage({
                    kind: "info",
                    text: "Loaded Spotify link. Play controls Spotify.",
                  });
                  return;
                }
                if (parseYouTubeUrl(url)) {
                  setPlaybackSource("youtube");
                  setStatusMessage({
                    kind: "info",
                    text: "Loaded YouTube link. Play controls YouTube.",
                  });
                  return;
                }
                setPlaybackSource("builtin");
                setStatusMessage({
                  kind: "error",
                  text: "Unsupported URL. Using built-in playlist.",
                });
              }}
            >
              Load
            </Button>
            <IconButton
              aria-label="Refresh"
              h="36px"
              w="36px"
              borderRadius="10px"
              variant="ghost"
              color="whiteAlpha.500"
              _hover={{ bg: "whiteAlpha.100", color: "white" }}
              onClick={() => {
                setUrlInput(savedUrl ?? "");
              }}
            >
              <Icon as={FiRefreshCw} boxSize={4} />
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
            <HStack gap={3} flexWrap="wrap">
              <Button
                size="sm"
                borderRadius="full"
                bg={spotifyToken ? "whiteAlpha.100" : "#1DB954"}
                color={spotifyToken ? "whiteAlpha.900" : "black"}
                fontWeight="700"
                px={5}
                h="36px"
                _hover={{
                  bg: spotifyToken ? "whiteAlpha.100" : "#1ed760",
                  transform: !spotifyToken ? "translateY(-1px)" : "none",
                  boxShadow: !spotifyToken
                    ? "0 4px 12px rgba(29, 185, 84, 0.4)"
                    : "none",
                }}
                _active={{ transform: "scale(0.98)" }}
                transition="all 0.2s"
                onClick={() => void spotifyConnect()}
                disabled={!!spotifyToken}
                _disabled={{ opacity: 1, cursor: "default" }}
              >
                <HStack gap={2}>
                  <Icon
                    as={FaSpotify}
                    boxSize={4}
                    color={spotifyToken ? "#1DB954" : "currentColor"}
                  />
                  <Text>{spotifyToken ? "Connected" : "Connect Spotify"}</Text>
                </HStack>
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

              {spotifyToken && spotifyUser?.display_name ? (
                <Text fontSize="xs" color="whiteAlpha.700">
                  Connected as {spotifyUser.display_name}
                </Text>
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
      ) : null}

      <audio ref={audioRef} />
    </Box>
  );
}
