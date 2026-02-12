import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  IconButton,
  Input,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { FiPause, FiPlay, FiRotateCcw, FiSettings } from "react-icons/fi";
import { clampNumber, formatMMSS } from "../utils";

export type TimerToolProps = {
  mode: "focus" | "break" | "rest";
  setMode: (mode: "focus" | "break" | "rest") => void;
  focusMinutes: number;
  setFocusMinutes: (minutes: number) => void;
  breakMinutes: number;
  setBreakMinutes: (minutes: number) => void;
  restMinutes: number;
  setRestMinutes: (minutes: number) => void;
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
    restMinutes,
    setRestMinutes,
    secondsLeft,
    running,
    progressValue,
    onStart,
    onPause,
    onReset,
  } = props;

  const [showSettings, setShowSettings] = useState(false);

  const actionLabel = running ? "Pause" : "Start";
  const actionIcon = running ? FiPause : FiPlay;

  return (
    <Box
      w={{ base: "calc(100vw - 140px)", sm: "320px" }}
      maxW="360px"
      bg="blackAlpha.700"
      borderRadius="14px"
      borderWidth="1px"
      borderColor="whiteAlpha.200"
      backdropFilter="blur(10px)"
      boxShadow="0 18px 50px rgba(0,0,0,0.35)"
      overflow="hidden"
    >
      {/* Segmented mode tabs */}
      <HStack
        gap={0}
        p={1}
        bg="blackAlpha.700"
        borderBottomWidth="1px"
        borderBottomColor="whiteAlpha.200"
      >
        {(
          [
            { key: "focus", label: "Focus" },
            { key: "break", label: "Break" },
            { key: "rest", label: "Rest" },
          ] as const
        ).map((t) => {
          const selected = mode === t.key;
          return (
            <Button
              key={t.key}
              size="sm"
              flex="1"
              borderRadius="10px"
              bg={selected ? "whiteAlpha.200" : "transparent"}
              color={selected ? "white" : "whiteAlpha.800"}
              fontWeight={selected ? "800" : "600"}
              _hover={{ bg: "whiteAlpha.200", color: "white" }}
              onClick={() => setMode(t.key)}
            >
              {t.label}
            </Button>
          );
        })}
      </HStack>

      <Stack gap={3} px={5} py={4} color="white">
        {/* Big time */}
        <Text
          fontSize={{ base: "38px", sm: "42px" }}
          fontWeight="900"
          letterSpacing="0.02em"
          lineHeight="1"
          textAlign="center"
        >
          {formatMMSS(secondsLeft)}
        </Text>

        {/* Controls row: reset | start/pause | settings */}
        <Flex align="center" justify="space-between" gap={2}>
          <IconButton
            aria-label="Reset"
            variant="ghost"
            size="sm"
            color="white"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={onReset}
          >
            <Icon as={FiRotateCcw} />
          </IconButton>

          <Button
            size="sm"
            minW="96px"
            borderRadius="10px"
            bg="#90B5FF"
            color="black"
            fontWeight="700"
            _hover={{ bg: "#7FA8FF" }}
            onClick={() => {
              if (running) onPause();
              else onStart();
            }}
            disabled={!running && secondsLeft === 0}
          >
            <HStack gap={2} justify="center">
              <Icon as={actionIcon} />
              <Text>{actionLabel}</Text>
            </HStack>
          </Button>

          <IconButton
            aria-label={showSettings ? "Hide settings" : "Settings"}
            variant="ghost"
            size="sm"
            color="white"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={() => setShowSettings((v) => !v)}
          >
            <Icon as={FiSettings} />
          </IconButton>
        </Flex>

        {/* Subtle progress (kept minimal to match design) */}
        <Box h="6px" borderRadius="full" overflow="hidden" bg="whiteAlpha.200">
          <Box
            h="full"
            width={`${progressValue}%`}
            transition="width 200ms linear"
            bg="whiteAlpha.700"
          />
        </Box>

        {/* Settings (collapsed by default) */}
        {showSettings ? (
          <SimpleGrid columns={3} gap={3} pt={1}>
            <Box>
              <Text fontSize="xs" color="whiteAlpha.800" mb={1}>
                Focus
              </Text>
              <Input
                value={focusMinutes}
                onChange={(e) =>
                  setFocusMinutes(clampNumber(Number(e.target.value), 1, 180))
                }
                type="number"
                h="36px"
                borderRadius="10px"
                bg="whiteAlpha.200"
                borderWidth="1px"
                borderColor="whiteAlpha.300"
                color="white"
                textAlign="center"
              />
            </Box>
            <Box>
              <Text fontSize="xs" color="whiteAlpha.800" mb={1}>
                Break
              </Text>
              <Input
                value={breakMinutes}
                onChange={(e) =>
                  setBreakMinutes(clampNumber(Number(e.target.value), 1, 60))
                }
                type="number"
                h="36px"
                borderRadius="10px"
                bg="whiteAlpha.200"
                borderWidth="1px"
                borderColor="whiteAlpha.300"
                color="white"
                textAlign="center"
              />
            </Box>
            <Box>
              <Text fontSize="xs" color="whiteAlpha.800" mb={1}>
                Rest
              </Text>
              <Input
                value={restMinutes}
                onChange={(e) =>
                  setRestMinutes(clampNumber(Number(e.target.value), 1, 180))
                }
                type="number"
                h="36px"
                borderRadius="10px"
                bg="whiteAlpha.200"
                borderWidth="1px"
                borderColor="whiteAlpha.300"
                color="white"
                textAlign="center"
              />
            </Box>
          </SimpleGrid>
        ) : null}
      </Stack>
    </Box>
  );
}
