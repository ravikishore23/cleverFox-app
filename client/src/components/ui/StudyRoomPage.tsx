import {
  Box,
  chakra,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Image,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiCheckSquare,
  FiChevronLeft,
  FiClock,
  FiEdit3,
  FiImage,
  FiMaximize2,
  FiMinimize2,
  FiMoreHorizontal,
  FiMusic,
  FiVideo,
  FiX,
} from "react-icons/fi";
// import { TbBrain } from "react-icons/tb";
import TimerTool from "./studyroom/tools/TimerTool";
import TaskTool from "./studyroom/tools/TaskTool";
import NotesTool from "./studyroom/tools/NotesTool";
import CalendarTool from "./studyroom/tools/CalendarTool";
import FoxAiTool from "./studyroom/tools/FoxAiTool";
import MusicTool from "./studyroom/tools/MusicTool";
import ImageTool from "./studyroom/tools/ImageTool";
import VideoTool from "./studyroom/tools/VideoTool";

type User = {
  name: string;
};

type StudyRoomPageProps = {
  user?: User | null;
  onExit?: () => void;
};

type ToolKey =
  | "timer"
  | "task"
  | "notes"
  | "foxai"
  | "media"
  | "video"
  | "image"
  | "calendar";

export default function StudyRoomPage({ user, onExit: _onExit }: StudyRoomPageProps) {
  const [activeTool, setActiveTool] = useState<ToolKey>("foxai");
  // Keep a history stack. Initial is just "timer".
  const [history, setHistory] = useState<ToolKey[]>(["timer", "foxai"]);
  // NOTE: Initial "task" is activeTool, so stack should reflect that if we want back button to work immediately?
  // Actually, if activeTool is "task", history should be ["timer", "task"] if we consider the flow.
  // But let's assume we start at "task" directly. Maybe history is just ["task"].
  // If we want Back to take us to Timer (Home), we should init as ["timer", "task"].
  // But activeTool starts at "task". Let's stick with history tracking *changes*.
  // If we just init history with the ActiveTool, back button is disabled.
  // User wants "back to previous tab".

  const [isPanelMaximized, setIsPanelMaximized] = useState(false);

  const navigateTo = (tool: ToolKey) => {
    if (activeTool === tool) return;
    setHistory((prev) => [...prev, tool]);
    setActiveTool(tool);
  };

  const navigateBack = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop(); // Remove current
    const prevTool = newHistory[newHistory.length - 1]; // Get previous
    setHistory(newHistory);
    setActiveTool(prevTool);
  };

  // Sync initial state if needed. But simple history append is safer.
  // Since we hardcoded activeTool='task', let's fix history init:
  // history=['timer', 'task'] implies we came from timer?
  // If the app starts on 'task', maybe there is no 'previous'.
  // But typically 'timer' is the dashboard. So let's assume history=['timer', 'task'].

  const [isMusicOpen, setIsMusicOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(true);

  // Manage z-indices for window layering
  // Base z-indexes: Background=0, Overlay=1, Panel=2
  // Floating windows should be >= 3 when active, or can be pushed back
  const [musicZ, setMusicZ] = useState(3);
  const [timerZ, setTimerZ] = useState(3);

  const bringToFront = (window: "music" | "timer") => {
    // If we bring one to front, it goes higher than the other (and higher than panel=2)
    // We can use 10 vs 9, etc.
    if (window === "music") {
      setMusicZ(10);
      setTimerZ((prev) => (prev >= 10 ? 9 : prev));
    } else {
      setTimerZ(10);
      setMusicZ((prev) => (prev >= 10 ? 9 : prev));
    }
  };

  // Push floating windows back when a main panel opens (zIndex 2)
  useEffect(() => {
    if (activeTool !== "timer") {
      setMusicZ(1);
      setTimerZ(1);
    } else {
      // Reset to default floating level (3) when back to wallpaper-only mode
      // unless one was already forcefully higher? Maybe just reset both to 3 is simpler for now.
      setMusicZ(3);
      setTimerZ(3);
    }
  }, [activeTool]);

  // Timer state
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [restMinutes, setRestMinutes] = useState(15);
  const [mode, setMode] = useState<"focus" | "break" | "rest">("focus");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState(
    "/wp8773098-vector-graphics-wallpapers.jpg",
  );
  const [backgroundVideo, setBackgroundVideo] = useState<string | null>(null);

  const playModeEndAlarm = useCallback(
    (endedMode: "focus" | "break" | "rest") => {
      if (typeof window === "undefined") return;

      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      try {
        const audioCtx = new AudioCtx();
        const now = audioCtx.currentTime;

        const focusPattern = [880, 1174.66, 880];
        const breakPattern = [523.25, 659.25, 783.99];
        const restPattern = [440, 523.25, 659.25];

        const tones =
          endedMode === "focus"
            ? focusPattern
            : endedMode === "break"
              ? breakPattern
              : restPattern;

        tones.forEach((frequency, index) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          const startAt = now + index * 0.2;
          const endAt = startAt + 0.16;

          osc.type = "sine";
          osc.frequency.value = frequency;

          gain.gain.setValueAtTime(0.0001, startAt);
          gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(startAt);
          osc.stop(endAt);
        });

        const closeAt = now + tones.length * 0.24;
        window.setTimeout(
          () => {
            void audioCtx.close();
          },
          Math.ceil((closeAt - now) * 1000),
        );
      } catch {
        // Ignore audio failures (e.g., browser policy restrictions)
      }
    },
    [],
  );

  // Task state
  // Notes state

  const totalSeconds = useMemo(() => {
    if (mode === "focus") return focusMinutes * 60;
    if (mode === "break") return breakMinutes * 60;
    return restMinutes * 60;
  }, [mode, focusMinutes, breakMinutes, restMinutes]);

  const progressValue = useMemo(() => {
    if (totalSeconds <= 0) return 0;
    const done = totalSeconds - secondsLeft;
    return Math.max(0, Math.min(100, (done / totalSeconds) * 100));
  }, [secondsLeft, totalSeconds]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSecondsLeft(totalSeconds);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunning(false);
  }, [totalSeconds]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    if (secondsLeft > 0) return;
    const endedMode = mode;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunning(false);
    playModeEndAlarm(endedMode);
    setMode((prev) => (prev === "focus" ? "break" : "focus"));
  }, [running, secondsLeft, mode, playModeEndAlarm]);

  const sidebarItems: Array<{
    key: ToolKey;
    label: string;
    icon?: any;
    image?: string;
  }> = [
    { key: "timer", label: "Timer", icon: FiClock },
    { key: "task", label: "Task", icon: FiCheckSquare },
    { key: "notes", label: "Notes", icon: FiEdit3 },
    { key: "foxai", label: "Fox AI", image: "/ai-logo.png" },
    { key: "media", label: "Media", icon: FiMusic },
    { key: "video", label: "Video", icon: FiVideo },
    { key: "image", label: "Backgrounds", icon: FiImage },
    { key: "calendar", label: "Calendar", icon: FiCalendar },
  ];

  const panel = (
    <Box
      position={isPanelMaximized ? "fixed" : "relative"}
      top={isPanelMaximized ? 0 : "auto"}
      left={isPanelMaximized ? 0 : "auto"}
      zIndex={isPanelMaximized ? 9999 : "auto"}
      w={
        isPanelMaximized
          ? "100vw"
          : { base: "calc(100vw - 120px)", md: "calc(100vw - 150px)" }
      }
      h={isPanelMaximized ? "100vh" : "calc(100vh - 40px)"}
      bg="#18181b"
      borderRadius={isPanelMaximized ? 0 : "18px"}
      boxShadow="0 18px 50px rgba(0,0,0,0.5)"
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      <Flex
        align="center"
        justify="space-between"
        px={5}
        py={4}
        borderBottom="1px solid"
        borderColor="whiteAlpha.100"
        flexShrink={0}
      >
        <HStack gap={3}>
          {history.length > 1 && (
            <IconButton
              aria-label="Back"
              variant="ghost"
              size="sm"
              color="white"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={navigateBack}
              mr={-1}
            >
              <Icon as={FiChevronLeft} boxSize={5} />
            </IconButton>
          )}

          {/* Icon Logic */}
          <Box
            w="34px"
            h="34px"
            borderRadius="12px"
            bg="whiteAlpha.200"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            {sidebarItems.find((i) => i.key === activeTool)?.image ? (
              <Image
                src={sidebarItems.find((i) => i.key === activeTool)?.image}
                boxSize={5}
                objectFit="contain"
              />
            ) : (
              <Icon
                as={sidebarItems.find((i) => i.key === activeTool)?.icon}
                color="white"
                boxSize={5}
              />
            )}
          </Box>
          <Stack gap={0}>
            <Heading size="sm" color="white">
              {sidebarItems.find((i) => i.key === activeTool)?.label ?? "Tool"}
            </Heading>
            <Text fontSize="xs" color="whiteAlpha.800">
              {user ? user.name : "Guest"}
            </Text>
          </Stack>
        </HStack>

        <HStack gap={1}>
          <IconButton
            aria-label={isPanelMaximized ? "Restore" : "Full Screen"}
            variant="solid"
            bg="transparent"
            size="sm"
            color="white"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={() => setIsPanelMaximized(!isPanelMaximized)}
          >
            <Icon
              as={isPanelMaximized ? FiMinimize2 : FiMaximize2}
              boxSize={4}
            />
          </IconButton>
          <IconButton
            aria-label="Close tool"
            variant="solid"
            bg="transparent"
            size="sm"
            color="white"
            _hover={{ bg: "red.500", color: "white" }}
            onClick={() => navigateTo("timer")}
          >
            <Icon as={FiX} boxSize={4} />
          </IconButton>
        </HStack>
      </Flex>

      <Box
        px={0}
        py={0}
        color="white"
        flex="1"
        overflow="hidden"
        display="flex"
        flexDirection="column"
      >
        {activeTool === "task" && <TaskTool />}

        {activeTool === "foxai" && (
          <FoxAiTool onOpenNotesTool={() => navigateTo("notes")} />
        )}

        {activeTool === "video" && (
          <VideoTool onClose={() => navigateTo("timer")} />
        )}

        {activeTool === "image" && (
          <ImageTool
            onClose={() => navigateTo("timer")}
            currentBackground={backgroundVideo || backgroundImage}
            onBackgroundSelect={(src, type) => {
              if (type === "video") {
                setBackgroundVideo(src);
              } else {
                setBackgroundImage(src);
                setBackgroundVideo(null);
              }
            }}
          />
        )}
      </Box>
    </Box>
  );

  return (
    <Box
      minH="100vh"
      position="relative"
      bgImage={!backgroundVideo ? `url(${backgroundImage})` : undefined}
      bgSize="cover"
      bgPos="center"
      bgRepeat="no-repeat"
      overflow="hidden"
    >
      {backgroundVideo && (
        <chakra.video
          src={backgroundVideo}
          autoPlay
          loop
          muted
          playsInline
          position="absolute"
          top="0"
          left="0"
          w="100%"
          h="100%"
          objectFit="cover"
          zIndex={0}
        />
      )}
      <Box position="absolute" inset={0} bg="blackAlpha.300" zIndex={1} />

      {/* Left tool sidebar */}
      <Flex
        position="absolute"
        left={{ base: 4, md: 7 }}
        top={{ base: 20, md: 24 }}
        zIndex={2}
        direction="column"
        w="90px"
        maxH="calc(100vh - 140px)"
        bg="rgba(12, 12, 14, 0.75)"
        backdropFilter="blur(20px) saturate(180%)"
        borderRadius="24px"
        p={2}
        boxShadow="0 24px 48px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.08)"
      >
        <Stack
          gap={3}
          flex="1"
          overflowY="auto"
          px={1}
          py={2}
          css={{
            "&::-webkit-scrollbar": { width: "0px" },
            "&::-webkit-scrollbar-track": { background: "transparent" },
          }}
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {sidebarItems.map((item) => {
            const isMedia = item.key === "media";
            const isTimer = item.key === "timer";
            const selected = isMedia
              ? isMusicOpen
              : isTimer
                ? isTimerOpen
                : activeTool === item.key;
            return (
              <Box
                key={item.key}
                as="button"
                onClick={() => {
                  if (isMedia) {
                    setIsMusicOpen((prev) => !prev);
                  } else if (isTimer) {
                    setIsTimerOpen((prev) => !prev);
                  } else {
                    navigateTo(item.key);
                  }
                }}
                role="group"
                borderRadius="20px"
                bg={selected ? "whiteAlpha.100" : "transparent"}
                _hover={{ bg: "whiteAlpha.100", transform: "translateY(-2px)" }}
                _active={{ transform: "scale(0.95)" }}
                transition="all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)"
                py={3}
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap={1.5}
                position="relative"
              >
                {/* Active Indicator Glow */}
                {selected && (
                  <Box
                    position="absolute"
                    inset="0"
                    borderRadius="20px"
                    bg="white"
                    opacity={0.05}
                    filter="blur(8px)"
                    zIndex={-1}
                  />
                )}

                <Box
                  w="42px"
                  h="42px"
                  borderRadius="14px"
                  bg={
                    selected
                      ? "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)"
                      : "transparent"
                  }
                  borderWidth="1px"
                  borderColor={selected ? "whiteAlpha.300" : "transparent"}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  transition="all 0.3s"
                  _groupHover={{
                    bg: selected ? undefined : "whiteAlpha.50",
                    borderColor: selected ? undefined : "whiteAlpha.100",
                  }}
                  boxShadow={
                    selected
                      ? "0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)"
                      : "none"
                  }
                >
                  {item.image ? (
                    <Image
                      src={item.image}
                      w="20px"
                      h="20px"
                      objectFit="contain"
                      opacity={selected ? 1 : 0.6}
                      transition="all 0.3s"
                      _groupHover={{ opacity: 1, transform: "scale(1.1)" }}
                      filter={
                        selected
                          ? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                          : "none"
                      }
                    />
                  ) : (
                    <Icon
                      as={item.icon}
                      boxSize={5}
                      color={selected ? "white" : "whiteAlpha.600"}
                      transition="all 0.3s"
                      _groupHover={{ color: "white", transform: "scale(1.1)" }}
                      filter={
                        selected
                          ? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                          : "none"
                      }
                    />
                  )}
                </Box>
                <Text
                  fontSize="9px"
                  fontWeight="700"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                  color={selected ? "white" : "whiteAlpha.500"}
                  transition="all 0.3s"
                  _groupHover={{ color: "whiteAlpha.900" }}
                >
                  {item.label}
                </Text>
              </Box>
            );
          })}
        </Stack>

        <Box mt={3}>
          <Box
            as="button"
            onClick={() => navigateTo("timer")}
            borderRadius="16px"
            _hover={{ bg: "whiteAlpha.200" }}
            py={3}
            px={2}
            w="full"
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
          >
            <Icon as={FiMoreHorizontal} boxSize={5} color="white" />
            <Text fontSize="xs" color="whiteAlpha.800" lineHeight="short">
              …
            </Text>
          </Box>
        </Box>
      </Flex>

      {/* Tool panel */}
      <Box
        position="absolute"
        left={{ base: "110px", md: "118px" }}
        top={{ base: 20, md: 24 }}
        zIndex={2}
      >
        {activeTool === "task" ? (
          <TaskTool onClose={() => navigateTo("timer")} />
        ) : activeTool === "notes" ? (
          <NotesTool onClose={() => navigateTo("timer")} />
        ) : activeTool === "calendar" ? (
          <CalendarTool onClose={() => navigateTo("timer")} />
        ) : activeTool === "image" ? (
          <ImageTool
            onClose={() => navigateTo("timer")}
            onBackgroundSelect={(src) => {
              setBackgroundImage(src);
              setBackgroundVideo(null); // Clear video if image selected
            }}
            currentBackground={backgroundImage}
          />
        ) : activeTool === "video" ? (
          <VideoTool
            onClose={() => navigateTo("timer")}
            onVideoSelect={(src) => {
              setBackgroundVideo(src);
              // We don't unset image, but video overlays it
            }}
            currentVideo={backgroundVideo}
          />
        ) : activeTool === "foxai" ? (
          panel
        ) : null}
      </Box>

      {isMusicOpen && (
        <MusicTool
          onClose={() => setIsMusicOpen(false)}
          zIndex={musicZ}
          onFocus={() => bringToFront("music")}
        />
      )}

      {isTimerOpen && (
        <TimerTool
          mode={mode}
          setMode={setMode}
          focusMinutes={focusMinutes}
          setFocusMinutes={setFocusMinutes}
          breakMinutes={breakMinutes}
          setBreakMinutes={setBreakMinutes}
          restMinutes={restMinutes}
          setRestMinutes={setRestMinutes}
          secondsLeft={secondsLeft}
          running={running}
          progressValue={progressValue}
          onStart={() => setRunning(true)}
          onPause={() => setRunning(false)}
          onReset={() => {
            setRunning(false);
            setSecondsLeft(totalSeconds);
          }}
          onClose={() => setIsTimerOpen(false)}
          zIndex={timerZ}
          onFocus={() => bringToFront("timer")}
        />
      )}
    </Box>
  );
}
