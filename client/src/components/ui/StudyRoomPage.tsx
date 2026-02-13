import {
  Box,
  Button,
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
import { useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiCheckSquare,
  FiChevronDown,
  FiClock,
  FiEdit3,
  FiHome,
  FiImage,
  FiMaximize2,
  FiMoreHorizontal,
  FiMusic,
  FiUser,
  FiVideo,
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

export default function StudyRoomPage({ user, onExit }: StudyRoomPageProps) {
  const [activeTool, setActiveTool] = useState<ToolKey>("task");
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
    setSecondsLeft(totalSeconds);
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
    setRunning(false);
    setMode((prev) => (prev === "focus" ? "break" : "focus"));
  }, [running, secondsLeft]);

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
    { key: "image", label: "Image", icon: FiImage },
    { key: "calendar", label: "Calendar", icon: FiCalendar },
  ];

  const panelTitle =
    sidebarItems.find((i) => i.key === activeTool)?.label ?? "Tool";

  const panel = (
    <Box
      w={{ base: "calc(100vw - 120px)", sm: "420px" }}
      maxW="520px"
      bg="blackAlpha.700"
      borderRadius="18px"
      borderWidth="1px"
      borderColor="whiteAlpha.200"
      backdropFilter="blur(10px)"
      boxShadow="0 18px 50px rgba(0,0,0,0.35)"
      overflow="hidden"
    >
      <Flex
        align="center"
        justify="space-between"
        px={5}
        py={4}
        borderBottomWidth="1px"
        borderBottomColor="whiteAlpha.200"
      >
        <HStack gap={3}>
          <Box
            w="34px"
            h="34px"
            borderRadius="12px"
            bg="whiteAlpha.200"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Icon
              as={sidebarItems.find((i) => i.key === activeTool)?.icon}
              color="white"
              boxSize={5}
            />
          </Box>
          <Stack gap={0}>
            <Heading size="sm" color="white">
              {panelTitle}
            </Heading>
            <Text fontSize="xs" color="whiteAlpha.800">
              {user ? user.name : "Guest"}
            </Text>
          </Stack>
        </HStack>

        <IconButton
          aria-label="Close tool"
          variant="ghost"
          size="sm"
          color="white"
          _hover={{ bg: "whiteAlpha.200" }}
          onClick={() => setActiveTool("timer")}
        >
          <Icon as={FiChevronDown} />
        </IconButton>
      </Flex>

      <Box px={5} py={5} color="white">
        {activeTool === "task" && <TaskTool />}

        {activeTool === "foxai" && <FoxAiTool />}

        {(activeTool === "video" || activeTool === "image") && (
          <Stack gap={2}>
            <Text fontSize="sm" color="whiteAlpha.900">
              {panelTitle} tool coming next.
            </Text>
            <Text fontSize="sm" color="whiteAlpha.700">
              For now we’re focusing on Music first.
            </Text>
          </Stack>
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

      {/* Top-right control bar */}
      <Flex
        position="absolute"
        top={{ base: 4, md: 6 }}
        right={{ base: 4, md: 8 }}
        zIndex={2}
        align="center"
        gap={2}
        bg="whiteAlpha.900"
        borderRadius="12px"
        px={2}
        py={2}
        boxShadow="0 12px 30px rgba(0,0,0,0.25)"
      >
        <IconButton
          aria-label="Video"
          variant="ghost"
          size="sm"
          _hover={{ bg: "blackAlpha.100" }}
        >
          <Icon as={FiVideo} color="gray.800" />
        </IconButton>
        <Button
          size="sm"
          borderRadius="10px"
          bg="white"
          borderWidth="1px"
          borderColor="blackAlpha.200"
          boxShadow="sm"
          _hover={{ bg: "gray.50" }}
        >
          Invite
        </Button>

        <Box w="1px" h="22px" bg="blackAlpha.200" mx={1} />

        <IconButton
          aria-label="Home"
          variant="ghost"
          size="sm"
          _hover={{ bg: "blackAlpha.100" }}
          onClick={onExit}
        >
          <Icon as={FiHome} color="gray.800" />
        </IconButton>
        <IconButton
          aria-label="User"
          variant="ghost"
          size="sm"
          _hover={{ bg: "blackAlpha.100" }}
        >
          <Icon as={FiUser} color="gray.800" />
        </IconButton>
        <IconButton
          aria-label="Fullscreen"
          variant="ghost"
          size="sm"
          _hover={{ bg: "blackAlpha.100" }}
        >
          <Icon as={FiMaximize2} color="gray.800" />
        </IconButton>
      </Flex>

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
                    setActiveTool(item.key);
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
            onClick={() => setActiveTool("timer")}
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
          <TaskTool onClose={() => setActiveTool("timer")} />
        ) : activeTool === "notes" ? (
          <NotesTool onClose={() => setActiveTool("timer")} />
        ) : activeTool === "calendar" ? (
          <CalendarTool onClose={() => setActiveTool("timer")} />
        ) : activeTool === "image" ? (
          <ImageTool
            onClose={() => setActiveTool("timer")}
            onBackgroundSelect={(src) => {
              setBackgroundImage(src);
              setBackgroundVideo(null); // Clear video if image selected
            }}
            currentBackground={backgroundImage}
          />
        ) : activeTool === "video" ? (
          <VideoTool
            onClose={() => setActiveTool("timer")}
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
