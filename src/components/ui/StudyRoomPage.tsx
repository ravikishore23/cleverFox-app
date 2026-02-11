import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";

type User = {
  name: string;
};

type StudyRoomPageProps = {
  user?: User | null;
  onExit?: () => void;
};

function formatMMSS(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function StudyRoomPage({ user, onExit }: StudyRoomPageProps) {
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  const totalSeconds = useMemo(() => {
    return (mode === "focus" ? focusMinutes : breakMinutes) * 60;
  }, [mode, focusMinutes, breakMinutes]);

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

    // Auto-switch modes when timer completes.
    setRunning(false);
    setMode((prev) => (prev === "focus" ? "break" : "focus"));
  }, [running, secondsLeft]);

  return (
    <Box minH="100vh" bg="#FBE6DC">
      <Container maxW="6xl" py={{ base: 6, md: 10 }}>
        <Flex align="center" justify="space-between" gap={4} mb={6}>
          <Stack gap={0}>
            <Heading size={{ base: "lg", md: "xl" }} color="gray.900">
              Study Room
            </Heading>
            <Text color="gray.700" fontSize="sm">
              {user ? `Welcome, ${user.name}` : "Focus mode"}
            </Text>
          </Stack>

          <HStack gap={3}>
            <Badge
              bg={mode === "focus" ? "orange.200" : "blue.200"}
              color="gray.900"
              px={3}
              py={1}
              borderRadius="full"
              fontWeight="700"
            >
              {mode === "focus" ? "FOCUS" : "BREAK"}
            </Badge>
            <Button
              variant="outline"
              borderColor="blackAlpha.300"
              bg="white"
              _hover={{ bg: "gray.50" }}
              onClick={onExit}
            >
              Exit
            </Button>
          </HStack>
        </Flex>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
          {/* Left column: tasks + notes */}
          <Stack gap={6}>
            <Box
              bg="white"
              borderRadius="14px"
              borderWidth="1px"
              borderColor="blackAlpha.200"
              boxShadow="sm"
              p={{ base: 5, md: 6 }}
            >
              <Heading size="md" color="gray.900" mb={4}>
                Today’s Focus
              </Heading>
              <Stack gap={3}>
                <Input
                  placeholder="Add a task (e.g., Chapter 3 notes)"
                  h="44px"
                  borderRadius="10px"
                  bg="white"
                  borderWidth="1px"
                  borderColor="gray.200"
                  color="gray.900"
                  _placeholder={{ color: "gray.400" }}
                  _hover={{ borderColor: "gray.300" }}
                  _focusVisible={{
                    borderColor: "#1877F2",
                    boxShadow: "0 0 0 1px #1877F2",
                  }}
                />

                <Flex gap={3} flexWrap="wrap">
                  <Button
                    bg="#1877F2"
                    color="white"
                    borderRadius="10px"
                    h="40px"
                    px={5}
                    _hover={{ bg: "#166fe5" }}
                  >
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    borderColor="gray.300"
                    borderRadius="10px"
                    h="40px"
                    px={5}
                    bg="white"
                    _hover={{ bg: "gray.50" }}
                  >
                    Clear
                  </Button>
                </Flex>

                <Box mt={2} p={4} borderRadius="12px" bg="gray.50">
                  <Text fontSize="sm" color="gray.700">
                    Next: Wire this to a real task list (local state + persistence).
                  </Text>
                </Box>
              </Stack>
            </Box>

            <Box
              bg="white"
              borderRadius="14px"
              borderWidth="1px"
              borderColor="blackAlpha.200"
              boxShadow="sm"
              p={{ base: 5, md: 6 }}
            >
              <Heading size="md" color="gray.900" mb={4}>
                Notes
              </Heading>
              <Textarea
                placeholder="Write quick notes here…"
                minH="160px"
                borderRadius="12px"
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
                color="gray.900"
                _placeholder={{ color: "gray.400" }}
                _hover={{ borderColor: "gray.300" }}
                _focusVisible={{
                  borderColor: "#1877F2",
                  boxShadow: "0 0 0 1px #1877F2",
                }}
              />
            </Box>
          </Stack>

          {/* Right column: timer + controls */}
          <Stack gap={6}>
            <Box
              bg="white"
              borderRadius="14px"
              borderWidth="1px"
              borderColor="blackAlpha.200"
              boxShadow="sm"
              p={{ base: 5, md: 6 }}
            >
              <Heading size="md" color="gray.900" mb={4}>
                Focus Timer
              </Heading>

              <Stack gap={4}>
                <Box>
                  <Text fontSize="sm" color="gray.700" mb={2}>
                    Time left
                  </Text>
                  <Text
                    fontSize={{ base: "44px", md: "56px" }}
                    fontWeight="800"
                    color="gray.900"
                    lineHeight="1"
                    fontFamily="ui-sans-serif"
                  >
                    {formatMMSS(secondsLeft)}
                  </Text>
                </Box>

                <Box
                  h="10px"
                  borderRadius="full"
                  overflow="hidden"
                  bg={mode === "focus" ? "orange.100" : "blue.100"}
                >
                  <Box
                    h="full"
                    width={`${progressValue}%`}
                    transition="width 200ms linear"
                    bg={mode === "focus" ? "orange.400" : "blue.400"}
                  />
                </Box>

                <HStack gap={3} flexWrap="wrap">
                  <Button
                    bg={running ? "gray.200" : "#F07A3B"}
                    color="gray.900"
                    borderRadius="12px"
                    h="44px"
                    px={7}
                    _hover={{ bg: running ? "gray.200" : "#E96F32" }}
                    onClick={() => setRunning(true)}
                    disabled={running || secondsLeft === 0}
                  >
                    Start
                  </Button>
                  <Button
                    variant="outline"
                    borderColor="gray.300"
                    bg="white"
                    borderRadius="12px"
                    h="44px"
                    px={7}
                    _hover={{ bg: "gray.50" }}
                    onClick={() => setRunning(false)}
                    disabled={!running}
                  >
                    Pause
                  </Button>
                  <Button
                    variant="outline"
                    borderColor="gray.300"
                    bg="white"
                    borderRadius="12px"
                    h="44px"
                    px={7}
                    _hover={{ bg: "gray.50" }}
                    onClick={() => {
                      setRunning(false);
                      setSecondsLeft(totalSeconds);
                    }}
                  >
                    Reset
                  </Button>
                </HStack>

                <HStack gap={3} flexWrap="wrap" pt={2}>
                  <Button
                    size="sm"
                    variant={mode === "focus" ? "solid" : "outline"}
                    bg={mode === "focus" ? "orange.200" : "white"}
                    borderColor="gray.300"
                    color="gray.900"
                    borderRadius="10px"
                    _hover={{ bg: mode === "focus" ? "orange.200" : "gray.50" }}
                    onClick={() => setMode("focus")}
                  >
                    Focus
                  </Button>
                  <Button
                    size="sm"
                    variant={mode === "break" ? "solid" : "outline"}
                    bg={mode === "break" ? "blue.200" : "white"}
                    borderColor="gray.300"
                    color="gray.900"
                    borderRadius="10px"
                    _hover={{ bg: mode === "break" ? "blue.200" : "gray.50" }}
                    onClick={() => setMode("break")}
                  >
                    Break
                  </Button>

                  <HStack ml="auto" gap={2}>
                    <Text fontSize="sm" color="gray.700">
                      Focus
                    </Text>
                    <Input
                      value={focusMinutes}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!Number.isFinite(value)) return;
                        setFocusMinutes(Math.max(1, Math.min(180, value)));
                      }}
                      type="number"
                      w="86px"
                      h="36px"
                      borderRadius="10px"
                      bg="white"
                      borderWidth="1px"
                      borderColor="gray.200"
                      color="gray.900"
                    />
                    <Text fontSize="sm" color="gray.700">
                      Break
                    </Text>
                    <Input
                      value={breakMinutes}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!Number.isFinite(value)) return;
                        setBreakMinutes(Math.max(1, Math.min(60, value)));
                      }}
                      type="number"
                      w="86px"
                      h="36px"
                      borderRadius="10px"
                      bg="white"
                      borderWidth="1px"
                      borderColor="gray.200"
                      color="gray.900"
                    />
                  </HStack>
                </HStack>
              </Stack>
            </Box>

            <Box
              bg="white"
              borderRadius="14px"
              borderWidth="1px"
              borderColor="blackAlpha.200"
              boxShadow="sm"
              p={{ base: 5, md: 6 }}
            >
              <Heading size="md" color="gray.900" mb={3}>
                Tools (next)
              </Heading>
              <Text color="gray.700" fontSize="sm">
                Next we can add: ambient sounds, study stats, AI tools panel, and
                persistence.
              </Text>
            </Box>
          </Stack>
        </SimpleGrid>
      </Container>
    </Box>
  );
}
