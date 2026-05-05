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
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { FiPause, FiPlay, FiRotateCcw, FiSettings, FiX } from "react-icons/fi";
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
  onClose?: () => void;
  onFocus?: () => void;
  zIndex?: number;
};

const POS_STORAGE_KEY = "cleverfox.timerWidget.pos.v1";

const BG_COLORS = [
  "#2E3A59", // Dark Blue
  "#5C57C8", // Purple
  "#1DB954", // Green
  "#FF4B4B", // Red
  "#000000", // Black
  "#D97706", // Amber
];

type WidgetPos = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

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
    onClose,
    onFocus,
    zIndex = 3,
  } = props;

  const widgetRef = useRef<HTMLDivElement | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);

  const [pos, setPos] = useState<WidgetPos>(() => {
    if (typeof window === "undefined") return { x: 120, y: 120 };
    try {
      const raw = window.localStorage.getItem(POS_STORAGE_KEY);
      if (!raw) return { x: 120, y: 120 };
      const parsed = JSON.parse(raw) as Partial<WidgetPos>;
      if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
        return { x: 120, y: 120 };
      }
      return { x: parsed.x, y: parsed.y };
    } catch {
      return { x: 120, y: 120 };
    }
  });

  function clampToViewport(next: WidgetPos): WidgetPos {
    if (typeof window === "undefined") return next;
    const padding = 12;
    const rect = widgetRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 320;
    const height = rect?.height ?? 200;

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
    let newPos = base;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      newPos = clampToViewport({ x: base.x + dx, y: base.y + dy });
      if (widgetRef.current) {
        widgetRef.current.style.transform = `translate3d(${newPos.x}px, ${newPos.y}px, 0)`;
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setPos(newPos);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
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

  const actionLabel = running ? "Pause" : "Start";
  const actionIcon = running ? FiPause : FiPlay;

  return (
    <Box
      ref={widgetRef}
      position="fixed"
      zIndex={zIndex}
      w={{ base: "calc(100vw - 24px)", sm: "320px" }}
      maxW="360px"
      onPointerDown={() => onFocus?.()}
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        willChange: "transform",
      }}
    >
      <Box
        bg={bgColor}
        borderRadius="14px"
        borderWidth="1px"
        borderColor="whiteAlpha.200"
        boxShadow="0 18px 50px rgba(0,0,0,0.35)"
        overflow="hidden"
        onPointerDown={onDragStart}
        cursor="grab"
        touchAction="none"
        _active={{ cursor: "grabbing" }}
      >
        {/* Header / Tabs */}
        <Flex
          bg="blackAlpha.200"
          borderBottomWidth="1px"
          borderBottomColor="whiteAlpha.100"
          p={1}
          align="center"
        >
          <HStack gap={0} flex="1">
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
                  size="xs"
                  flex="1"
                  borderRadius="6px"
                  bg={selected ? "whiteAlpha.300" : "transparent"}
                  color={selected ? "white" : "whiteAlpha.700"}
                  fontWeight={selected ? "700" : "500"}
                  _hover={{ bg: "whiteAlpha.200", color: "white" }}
                  onClick={() => setMode(t.key)}
                >
                  {t.label}
                </Button>
              );
            })}
          </HStack>

          <IconButton
            aria-label="Close"
            size="xs"
            variant="ghost"
            color="whiteAlpha.700"
            _hover={{ bg: "whiteAlpha.200", color: "white" }}
            ml={1}
            onClick={onClose}
          >
            <Icon as={FiX} />
          </IconButton>
        </Flex>

        <Stack gap={3} px={5} py={4} color="white">
          {/* Big time */}
          <Text
            fontSize={{ base: "42px", sm: "48px" }}
            fontWeight="900"
            letterSpacing="0.02em"
            lineHeight="1"
            textAlign="center"
            textShadow="0 4px 10px rgba(0,0,0,0.2)"
          >
            {formatMMSS(secondsLeft)}
          </Text>

          {/* Controls row */}
          <Flex align="center" justify="space-between" gap={2}>
            <IconButton
              aria-label="Reset"
              variant="ghost"
              size="sm"
              color="white"
              _hover={{ bg: "whiteAlpha.200" }}
              borderWidth="1px"
              borderColor="whiteAlpha.200"
              onClick={onReset}
            >
              <Icon as={FiRotateCcw} />
            </IconButton>

            <Button
              size="sm"
              flex="1"
              borderRadius="10px"
              bg="white"
              color={bgColor}
              fontWeight="800"
              _hover={{ bg: "whiteAlpha.900" }}
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
              borderWidth="1px"
              borderColor="whiteAlpha.200"
              onClick={() => setShowSettings((v) => !v)}
              bg={showSettings ? "whiteAlpha.200" : "transparent"}
            >
              <Icon as={FiSettings} />
            </IconButton>
          </Flex>

          {/* Subtle progress */}
          <Box
            h="4px"
            borderRadius="full"
            overflow="hidden"
            bg="blackAlpha.300"
          >
            <Box
              h="full"
              width={`${progressValue}%`}
              transition="width 200ms linear"
              bg="white"
            />
          </Box>

          {/* Settings area */}
          {showSettings ? (
            <Stack
              gap={3}
              pt={2}
              borderTopWidth="1px"
              borderTopColor="whiteAlpha.200"
            >
              {/* Color Bubbles */}
              <HStack gap={2} justify="center">
                {BG_COLORS.map((c) => (
                  <Box
                    key={c}
                    as="button"
                    w="20px"
                    h="20px"
                    borderRadius="full"
                    bg={c}
                    borderWidth={bgColor === c ? "2px" : "1px"}
                    borderColor="white"
                    transform={bgColor === c ? "scale(1.1)" : "none"}
                    onClick={() => setBgColor(c)}
                    _hover={{ transform: "scale(1.1)" }}
                    transition="all 0.2s"
                  />
                ))}
              </HStack>

              <SimpleGrid columns={3} gap={2}>
                <Box>
                  <Text
                    fontSize="xs"
                    color="whiteAlpha.800"
                    mb={1}
                    textAlign="center"
                  >
                    Focus
                  </Text>
                  <Input
                    value={focusMinutes}
                    onChange={(e) =>
                      setFocusMinutes(
                        clampNumber(Number(e.target.value), 1, 180),
                      )
                    }
                    type="number"
                    size="xs"
                    borderRadius="6px"
                    bg="whiteAlpha.200"
                    borderWidth="0"
                    color="white"
                    textAlign="center"
                    data-no-drag
                  />
                </Box>
                <Box>
                  <Text
                    fontSize="xs"
                    color="whiteAlpha.800"
                    mb={1}
                    textAlign="center"
                  >
                    Break
                  </Text>
                  <Input
                    value={breakMinutes}
                    onChange={(e) =>
                      setBreakMinutes(
                        clampNumber(Number(e.target.value), 1, 60),
                      )
                    }
                    type="number"
                    size="xs"
                    borderRadius="6px"
                    bg="whiteAlpha.200"
                    borderWidth="0"
                    color="white"
                    textAlign="center"
                    data-no-drag
                  />
                </Box>
                <Box>
                  <Text
                    fontSize="xs"
                    color="whiteAlpha.800"
                    mb={1}
                    textAlign="center"
                  >
                    Rest
                  </Text>
                  <Input
                    value={restMinutes}
                    onChange={(e) =>
                      setRestMinutes(
                        clampNumber(Number(e.target.value), 1, 180),
                      )
                    }
                    type="number"
                    size="xs"
                    borderRadius="6px"
                    bg="whiteAlpha.200"
                    borderWidth="0"
                    color="white"
                    textAlign="center"
                    data-no-drag
                  />
                </Box>
              </SimpleGrid>
            </Stack>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}
