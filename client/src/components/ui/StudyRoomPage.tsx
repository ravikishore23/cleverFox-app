import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
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
import { TbBrain } from "react-icons/tb";
import TimerTool from "./studyroom/tools/TimerTool";
import TaskTool from "./studyroom/tools/TaskTool";
import NotesTool from "./studyroom/tools/NotesTool";
import CalendarTool from "./studyroom/tools/CalendarTool";
import FoxAiTool from "./studyroom/tools/FoxAiTool";
import MusicTool from "./studyroom/tools/MusicTool";

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
  const [activeTool, setActiveTool] = useState<ToolKey>("timer");

  // Timer state
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [restMinutes, setRestMinutes] = useState(15);
  const [mode, setMode] = useState<"focus" | "break" | "rest">("focus");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);

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
    icon: any;
  }> = [
    { key: "timer", label: "Timer", icon: FiClock },
    { key: "task", label: "Task", icon: FiCheckSquare },
    { key: "notes", label: "Notes", icon: FiEdit3 },
    { key: "foxai", label: "Fox AI", icon: TbBrain },
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
      bgImage="url(/wp8773098-vector-graphics-wallpapers.jpg)"
      bgSize="cover"
      bgPos="center"
      bgRepeat="no-repeat"
      overflow="hidden"
    >
      <Box position="absolute" inset={0} bg="blackAlpha.300" />

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
        w="86px"
        maxH="calc(100vh - 140px)"
        bg="blackAlpha.800"
        borderRadius="22px"
        p={3}
        boxShadow="0 18px 50px rgba(0,0,0,0.4)"
        borderWidth="1px"
        borderColor="whiteAlpha.200"
      >
        <Stack gap={3} flex="1" overflowY="auto">
          {sidebarItems.map((item) => {
            const selected = activeTool === item.key;
            return (
              <Box
                key={item.key}
                as="button"
                onClick={() => setActiveTool(item.key)}
                borderRadius="16px"
                bg={selected ? "whiteAlpha.200" : "transparent"}
                _hover={{ bg: "whiteAlpha.200" }}
                py={3}
                px={2}
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap={2}
              >
                <Box
                  w="34px"
                  h="34px"
                  borderRadius="full"
                  bg={selected ? "whiteAlpha.200" : "transparent"}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon as={item.icon} boxSize={5} color="white" />
                </Box>
                <Text
                  fontSize="xs"
                  color={selected ? "white" : "whiteAlpha.800"}
                  lineHeight="short"
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
        {activeTool === "media" ? (
          <MusicTool onClose={() => setActiveTool("timer")} />
        ) : activeTool === "timer" ? (
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
          />
        ) : activeTool === "task" ? (
          <TaskTool />
        ) : activeTool === "notes" ? (
          <NotesTool onClose={() => setActiveTool("timer")} />
        ) : activeTool === "calendar" ? (
          <CalendarTool onClose={() => setActiveTool("timer")} />
        ) : (
          panel
        )}
      </Box>
    </Box>
  );
}
