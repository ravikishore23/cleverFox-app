import {
  Box,
  Button,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { clampNumber, formatMMSS } from "../utils";

export type TimerToolProps = {
  mode: "focus" | "break";
  setMode: (mode: "focus" | "break") => void;
  focusMinutes: number;
  setFocusMinutes: (minutes: number) => void;
  breakMinutes: number;
  setBreakMinutes: (minutes: number) => void;
  secondsLeft: number;
  running: boolean;
  progressValue: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
};

export default function TimerTool(props: TimerToolProps) {
  const {
    mode,
    setMode,
    focusMinutes,
    setFocusMinutes,
    breakMinutes,
    setBreakMinutes,
    secondsLeft,
    running,
    progressValue,
    onStart,
    onPause,
    onReset,
  } = props;

  return (
    <Stack gap={4}>
      <HStack justify="space-between" align="flex-start">
        <Stack gap={1}>
          <Text fontSize="xs" color="whiteAlpha.800">
            Mode
          </Text>
          <HStack gap={2}>
            <Button
              size="sm"
              borderRadius="999px"
              bg={mode === "focus" ? "whiteAlpha.200" : "transparent"}
              borderWidth="1px"
              borderColor="whiteAlpha.300"
              color="white"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={() => setMode("focus")}
            >
              Focus
            </Button>
            <Button
              size="sm"
              borderRadius="999px"
              bg={mode === "break" ? "whiteAlpha.200" : "transparent"}
              borderWidth="1px"
              borderColor="whiteAlpha.300"
              color="white"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={() => setMode("break")}
            >
              Break
            </Button>
          </HStack>
        </Stack>

        <Stack gap={1} align="flex-end">
          <Text fontSize="xs" color="whiteAlpha.800">
            Time left
          </Text>
          <Text fontSize="42px" fontWeight="800" lineHeight="1">
            {formatMMSS(secondsLeft)}
          </Text>
        </Stack>
      </HStack>

      <Box h="10px" borderRadius="full" overflow="hidden" bg="whiteAlpha.200">
        <Box
          h="full"
          width={`${progressValue}%`}
          transition="width 200ms linear"
          bg="whiteAlpha.700"
        />
      </Box>

      <HStack gap={3} flexWrap="wrap">
        <Button
          borderRadius="12px"
          bg={running ? "whiteAlpha.200" : "#F07A3B"}
          color={running ? "whiteAlpha.900" : "black"}
          _hover={{ bg: running ? "whiteAlpha.200" : "#E96F32" }}
          onClick={onStart}
          disabled={running || secondsLeft === 0}
        >
          Start
        </Button>
        <Button
          borderRadius="12px"
          bg="transparent"
          borderWidth="1px"
          borderColor="whiteAlpha.300"
          color="white"
          _hover={{ bg: "whiteAlpha.200" }}
          onClick={onPause}
          disabled={!running}
        >
          Pause
        </Button>
        <Button
          borderRadius="12px"
          bg="transparent"
          borderWidth="1px"
          borderColor="whiteAlpha.300"
          color="white"
          _hover={{ bg: "whiteAlpha.200" }}
          onClick={onReset}
        >
          Reset
        </Button>
      </HStack>

      <SimpleGrid columns={{ base: 2, sm: 4 }} gap={3} pt={2}>
        <Box>
          <Text fontSize="xs" color="whiteAlpha.800" mb={2}>
            Focus
          </Text>
          <Input
            value={focusMinutes}
            onChange={(e) =>
              setFocusMinutes(clampNumber(Number(e.target.value), 1, 180))
            }
            type="number"
            h="38px"
            borderRadius="12px"
            bg="whiteAlpha.200"
            borderWidth="1px"
            borderColor="whiteAlpha.300"
            color="white"
          />
        </Box>
        <Box>
          <Text fontSize="xs" color="whiteAlpha.800" mb={2}>
            Break
          </Text>
          <Input
            value={breakMinutes}
            onChange={(e) =>
              setBreakMinutes(clampNumber(Number(e.target.value), 1, 60))
            }
            type="number"
            h="38px"
            borderRadius="12px"
            bg="whiteAlpha.200"
            borderWidth="1px"
            borderColor="whiteAlpha.300"
            color="white"
          />
        </Box>
      </SimpleGrid>
    </Stack>
  );
}
