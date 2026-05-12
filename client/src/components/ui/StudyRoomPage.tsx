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
  FiClock,
  FiEdit3,
  FiImage,
  FiMaximize2,
  FiMinimize2,
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
import FloatingWidget from "./studyroom/tools/FloatingWidget";

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

export default function StudyRoomPage({
  user,
  onExit: _onExit,
}: StudyRoomPageProps) {
  const [isPanelMaximized, setIsPanelMaximized] = useState(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);

  const [openTools, setOpenTools] = useState<Record<ToolKey, boolean>>({
    timer: true,
    task: false,
    notes: false,
    foxai: true,
    media: false,
    video: false,
    image: false,
    calendar: false,
  });

  const [zIndices, setZIndices] = useState<Record<ToolKey, number>>({
    timer: 3,
    task: 3,
    notes: 3,
    foxai: 3,
    media: 3,
    video: 3,
    image: 3,
    calendar: 3,
  });

  const toggleTool = (tool: ToolKey) => {
    setOpenTools((prev) => {
      const isOpening = !prev[tool];
      if (isOpening) {
        bringToFront(tool);
      }
      return { ...prev, [tool]: isOpening };
    });
  };

  const closeTool = (tool: ToolKey) => {
    setOpenTools((prev) => ({ ...prev, [tool]: false }));
  };

  const bringToFront = (tool: ToolKey) => {
    setZIndices((prev) => {
      const maxZ = Math.max(...Object.values(prev));
      return { ...prev, [tool]: maxZ + 1 };
    });
  };

  // Timer state
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [restMinutes, setRestMinutes] = useState(15);
  const [mode, setMode] = useState<"focus" | "break" | "rest">("focus");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState(
    "./background-images/wp8773098-vector-graphics-wallpapers.jpg",
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
    { key: "foxai", label: "Fox AI", image: "./ai-logo.png" },
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
      w={
        isPanelMaximized
          ? "100vw"
          : { base: "calc(100vw - 120px)", md: "calc(100vw - 150px)" }
      }
      h={isPanelMaximized ? "100vh" : "calc(100vh - 120px)"}
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
            {sidebarItems.find((i) => i.key === "foxai")?.image ? (
              <Image
                src={sidebarItems.find((i) => i.key === "foxai")?.image}
                boxSize={5}
                objectFit="contain"
              />
            ) : (
              <Icon
                as={sidebarItems.find((i) => i.key === "foxai")?.icon}
                color="white"
                boxSize={5}
              />
            )}
          </Box>
          <Stack gap={0}>
            <Heading size="sm" color="white">
              {sidebarItems.find((i) => i.key === "foxai")?.label ?? "Tool"}
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
            onClick={() => closeTool("foxai")}
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
        <FoxAiTool
          onOpenNotesTool={() => {
            setOpenTools((prev) => ({ ...prev, notes: true }));
            bringToFront("notes");
          }}
        />
      </Box>
    </Box>
  );

  return (
    <Box
      minH="100vh"
      position="relative"
      bgImage={!backgroundVideo ? `url("${backgroundImage}")` : undefined}
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

      {/* Bottom tool bar area */}
      <Box
        position="absolute"
        bottom={4}
        left="50%"
        transform="translateX(-50%)"
        zIndex={99999}
        onMouseEnter={() => setIsToolbarExpanded(true)}
        onMouseLeave={() => setIsToolbarExpanded(false)}
        display="flex"
        justifyContent="center"
        alignItems="flex-end"
        h="100px"
        w="800px" // wide hit area
        pointerEvents="none" // let clicks pass through the invisible area
      >
        {/* The Floating Bubble (collapsed state) */}
        <Flex
          position="absolute"
          bottom="0"
          w="52px"
          h="52px"
          bg="rgba(12, 12, 14, 0.85)"
          backdropFilter="blur(20px)"
          borderRadius="full"
          boxShadow="0 8px 32px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)"
          align="center"
          justify="center"
          cursor="pointer"
          opacity={isToolbarExpanded ? 0 : 1}
          transform={isToolbarExpanded ? "scale(0.8) translateY(20px)" : "scale(1) translateY(0)"}
          pointerEvents={isToolbarExpanded ? "none" : "auto"}
          transition="all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)"
          _hover={{ transform: "scale(1.05)", bg: "rgba(20, 20, 24, 0.95)" }}
        >
          <Image src="./ai-logo.png" boxSize={6} objectFit="contain" />
        </Flex>

        {/* The Expanded Toolbar */}
        <Flex
          position="absolute"
          bottom="0"
          direction="row"
          bg="rgba(12, 12, 14, 0.85)"
          backdropFilter="blur(20px) saturate(180%)"
          borderRadius="24px"
          p={1.5}
          boxShadow="0 24px 48px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)"
          opacity={isToolbarExpanded ? 1 : 0}
          transform={isToolbarExpanded ? "translateY(0) scale(1)" : "translateY(20px) scale(0.9)"}
          pointerEvents={isToolbarExpanded ? "auto" : "none"}
          transition="all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)"
        >
          <HStack gap={2} px={1} py={0.5}>
            {sidebarItems.map((item) => {
              const selected = openTools[item.key];
              return (
                <Box
                  key={item.key}
                  as="button"
                  onClick={() => toggleTool(item.key)}
                  role="group"
                  borderRadius="16px"
                  bg={selected ? "whiteAlpha.100" : "transparent"}
                  _hover={{ bg: "whiteAlpha.100", transform: "translateY(-2px)" }}
                  _active={{ transform: "scale(0.95)" }}
                  transition="all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)"
                  px={2}
                  py={1.5}
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  gap={1}
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
                    w="34px"
                    h="34px"
                    borderRadius="10px"
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
                        w="16px"
                        h="16px"
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
                        boxSize={4}
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
                    fontSize="8px"
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
          </HStack>
        </Flex>
      </Box>

      {/* Floating Tools */}

      {openTools.task && (
        <FloatingWidget
          id="task"
          zIndex={zIndices.task}
          onFocus={() => bringToFront("task")}
          defaultPos={{ x: 120, y: 120 }}
        >
          <TaskTool onClose={() => closeTool("task")} />
        </FloatingWidget>
      )}

      {openTools.notes && (
        <FloatingWidget
          id="notes"
          zIndex={zIndices.notes}
          onFocus={() => bringToFront("notes")}
          defaultPos={{ x: 160, y: 160 }}
        >
          <NotesTool onClose={() => closeTool("notes")} />
        </FloatingWidget>
      )}

      {openTools.calendar && (
        <FloatingWidget
          id="calendar"
          zIndex={zIndices.calendar}
          onFocus={() => bringToFront("calendar")}
          defaultPos={{ x: 200, y: 200 }}
        >
          <CalendarTool onClose={() => closeTool("calendar")} />
        </FloatingWidget>
      )}

      {openTools.image && (
        <FloatingWidget
          id="image"
          zIndex={zIndices.image}
          onFocus={() => bringToFront("image")}
          defaultPos={{ x: 240, y: 100 }}
        >
          <ImageTool
            onClose={() => closeTool("image")}
            onBackgroundSelect={(src, type) => {
              if (type === "video") {
                setBackgroundVideo(src);
              } else {
                setBackgroundImage(src);
                setBackgroundVideo(null);
              }
            }}
            currentBackground={backgroundVideo || backgroundImage}
          />
        </FloatingWidget>
      )}

      {openTools.video && (
        <FloatingWidget
          id="video"
          zIndex={zIndices.video}
          onFocus={() => bringToFront("video")}
          defaultPos={{ x: 280, y: 140 }}
        >
          <VideoTool
            onClose={() => closeTool("video")}
            onVideoSelect={(src) => {
              setBackgroundVideo(src);
            }}
            currentVideo={backgroundVideo}
          />
        </FloatingWidget>
      )}

      {openTools.foxai &&
        (isPanelMaximized ? (
          <Box
            position="absolute"
            left={0}
            top={0}
            zIndex={9999}
            onPointerDown={() => bringToFront("foxai")}
            onPointerDownCapture={() => bringToFront("foxai")}
          >
            {panel}
          </Box>
        ) : (
          <FloatingWidget
            id="foxai"
            zIndex={zIndices.foxai}
            onFocus={() => bringToFront("foxai")}
            defaultPos={{ x: 100, y: 100 }}
          >
            {panel}
          </FloatingWidget>
        ))}

      {openTools.media && (
        <MusicTool
          onClose={() => closeTool("media")}
          zIndex={zIndices.media}
          onFocus={() => bringToFront("media")}
        />
      )}

      {openTools.timer && (
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
          onClose={() => closeTool("timer")}
          zIndex={zIndices.timer}
          onFocus={() => bringToFront("timer")}
        />
      )}
    </Box>
  );
}
