import {
  Badge,
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
  Textarea,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiRefreshCw,
  FiTrash2,
  FiX,
  FiMaximize2,
  FiMinimize2,
} from "react-icons/fi";
import { MdOutlineCalendarMonth } from "react-icons/md";

type CalendarToolProps = {
  onClose?: () => void;
};

type ScheduleEventDto = {
  id: string;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
};

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:3001";

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Failed to fetch ${url}. Start the backend (npm run dev:api). (${message})`,
    );
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function overlapsDay(evt: ScheduleEventDto, day: Date): boolean {
  const start = new Date(evt.startAt);
  const end = new Date(evt.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return false;
  const dayStart = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    0,
    0,
    0,
    0,
  );
  const dayEnd = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    23,
    59,
    59,
    999,
  );
  return (
    start.getTime() <= dayEnd.getTime() && end.getTime() >= dayStart.getTime()
  );
}

function getEventTimeLabel(evt: ScheduleEventDto): string {
  if (evt.allDay) return "All day";
  const start = new Date(evt.startAt);
  const end = new Date(evt.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  return `${pad2(start.getHours())}:${pad2(start.getMinutes())}–${pad2(
    end.getHours(),
  )}:${pad2(end.getMinutes())}`;
}

export default function CalendarTool({ onClose }: CalendarToolProps) {
  const BG = "#FFF7E6";
  const HEADER_BG = "#FFF0D6";
  const ACCENT = "#FF6F0F";
  const ACCENT_HOVER = "#F0660E";
  const BORDER = "#F2B37A";
  const INPUT_BG = "#FFF3DF";

  const [now, setNow] = useState<Date>(() => new Date());

  const [monthCursor, setMonthCursor] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const [monthEvents, setMonthEvents] = useState<ScheduleEventDto[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newAllDay, setNewAllDay] = useState(false);
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newLocation, setNewLocation] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor]);
  const monthEnd = useMemo(() => endOfMonth(monthCursor), [monthCursor]);

  const dayKey = useMemo(() => fmtYmd(selectedDate), [selectedDate]);

  const todayStart = useMemo(() => {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
  }, [now]);

  const monthGrid = useMemo(() => {
    // Sunday-first grid
    const gridStart = addDays(monthStart, -monthStart.getDay());
    const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());
    const days: Date[] = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
      days.push(d);
    }
    return days;
  }, [monthStart, monthEnd]);

  const selectedDayEvents = useMemo(() => {
    const dayStart = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      0,
      0,
      0,
      0,
    );
    const dayEnd = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      23,
      59,
      59,
      999,
    );

    const list = monthEvents.filter((e) => {
      const start = new Date(e.startAt);
      const end = new Date(e.endAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        return false;
      // Hide schedules that are fully in the past.
      if (end.getTime() < todayStart.getTime()) return false;
      return (
        start.getTime() <= dayEnd.getTime() &&
        end.getTime() >= dayStart.getTime()
      );
    });

    list.sort((a, b) => {
      const aIso = a.startAt ?? "";
      const bIso = b.startAt ?? "";
      return aIso.localeCompare(bIso);
    });

    return list;
  }, [monthEvents, selectedDate, todayStart]);

  const eventCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of monthGrid) {
      // Once a day has passed, remove its marker.
      const dEnd = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        23,
        59,
        59,
        999,
      );
      if (dEnd.getTime() < todayStart.getTime()) continue;
      const k = fmtYmd(d);
      let count = 0;
      for (const e of monthEvents) {
        if (overlapsDay(e, d)) {
          const end = new Date(e.endAt);
          if (
            !Number.isNaN(end.getTime()) &&
            end.getTime() >= todayStart.getTime()
          ) {
            count += 1;
          }
        }
      }
      if (count) map.set(k, count);
    }
    return map;
  }, [monthEvents, monthGrid, todayStart]);

  async function loadMonthEvents() {
    setLoadingEvents(true);
    setError(null);
    try {
      const from = monthStart.toISOString();
      const to = monthEnd.toISOString();
      const q = new URLSearchParams({ from, to });
      const data = await apiJson<{ ok: true; events: ScheduleEventDto[] }>(
        `/schedule?${q.toString()}`,
      );
      const list = (data.events ?? []).filter((e) => {
        const end = new Date(e.endAt);
        if (Number.isNaN(end.getTime())) return false;
        return end.getTime() >= todayStart.getTime();
      });
      setMonthEvents(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setLoadingEvents(false);
    }
  }

  async function createEvent() {
    if (!newTitle.trim()) {
      setError("Title is required");
      return;
    }

    // Don't allow creating schedules on past dates.
    const selectedDayStart = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      0,
      0,
      0,
      0,
    );
    if (selectedDayStart.getTime() < todayStart.getTime()) {
      setError(
        "You can’t add schedules in the past. Pick today or a future date.",
      );
      return;
    }

    function parseTime(s: string): { h: number; m: number } | null {
      const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
      if (!m) return null;
      return { h: Number(m[1]), m: Number(m[2]) };
    }

    setCreating(true);
    setError(null);
    try {
      let startAt: Date;
      let endAt: Date;

      if (newAllDay) {
        startAt = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          0,
          0,
          0,
          0,
        );
        endAt = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          23,
          59,
          59,
          999,
        );
      } else {
        const st = parseTime(newStartTime);
        const et = parseTime(newEndTime);
        if (!st || !et) {
          setError("Invalid time format");
          return;
        }
        startAt = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          st.h,
          st.m,
          0,
          0,
        );
        endAt = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          et.h,
          et.m,
          0,
          0,
        );
      }

      if (endAt.getTime() < startAt.getTime()) {
        setError("End time must be after start time");
        return;
      }

      // If creating for today, prevent times that are already over.
      if (isSameDay(selectedDate, now) && endAt.getTime() < now.getTime()) {
        setError("That time has already passed. Pick a future time.");
        return;
      }

      await apiJson<{ ok: true; event: ScheduleEventDto }>("/schedule", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          location: newLocation.trim() || undefined,
          allDay: newAllDay,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        }),
      });

      setNewTitle("");
      setNewLocation("");
      setNewDescription("");
      setNewAllDay(false);
      await loadMonthEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create event");
    } finally {
      setCreating(false);
    }
  }

  async function deleteEvent(evt: ScheduleEventDto) {
    if (!evt.id) return;
    setError(null);
    try {
      await apiJson<{ ok: true }>(`/schedule/${encodeURIComponent(evt.id)}`, {
        method: "DELETE",
      });
      await loadMonthEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete event");
    }
  }

  useEffect(() => {
    void loadMonthEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart.getTime(), monthEnd.getTime(), todayStart.getTime()]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 3800);
    return () => window.clearTimeout(t);
  }, [error]);

  useEffect(() => {
    // keep selected date inside cursor month when navigating months
    if (
      selectedDate.getFullYear() !== monthCursor.getFullYear() ||
      selectedDate.getMonth() !== monthCursor.getMonth()
    ) {
      setSelectedDate(
        new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCursor.getFullYear(), monthCursor.getMonth()]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  const tool = (
    <Box
      w={
        isFullscreen
          ? "calc(100vw - 32px)"
          : { base: "calc(100vw - 140px)", md: "980px" }
      }
      maxW={isFullscreen ? "calc(100vw - 32px)" : "calc(100vw - 140px)"}
      maxH={
        isFullscreen
          ? "calc(100vh - 32px)"
          : { base: "calc(100vh - 130px)", md: "calc(100vh - 170px)" }
      }
      bg={BG}
      borderRadius="24px"
      borderWidth="1px"
      borderColor="blackAlpha.200"
      boxShadow="0 18px 50px rgba(0,0,0,0.25)"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      position={isFullscreen ? "fixed" : "relative"}
      inset={isFullscreen ? 4 : undefined}
      zIndex={isFullscreen ? 40 : undefined}
    >
      <Box
        bg={HEADER_BG}
        borderBottomWidth="1px"
        borderBottomColor="blackAlpha.200"
        p={{ base: 4, md: 6 }}
        position="sticky"
        top={0}
        zIndex={1}
      >
        <Flex justify="space-between" align="flex-start" gap={4}>
          <HStack gap={3}>
            <Box
              w="44px"
              h="44px"
              borderRadius="12px"
              bg={INPUT_BG}
              borderWidth="1px"
              borderColor={BORDER}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={MdOutlineCalendarMonth} color="black" boxSize={7} />
            </Box>
            <Box>
              <Text
                fontSize={{ base: "lg", md: "2xl" }}
                fontWeight="900"
                color="black"
              >
                Schedule
              </Text>
              <Text fontSize="sm" color="blackAlpha.700">
                Add and manage your schedules
              </Text>
            </Box>
          </HStack>

          <HStack gap={2}>
            <Button
              size="md"
              borderRadius="999px"
              h="44px"
              px={5}
              bg="white"
              borderWidth="1px"
              borderColor="blackAlpha.200"
              color="black"
              fontWeight="900"
              _hover={{ bg: "blackAlpha.50" }}
              onClick={() => {
                const now = new Date();
                setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelectedDate(now);
              }}
            >
              Today
            </Button>

            <IconButton
              aria-label="Refresh"
              size="md"
              variant="ghost"
              h="44px"
              w="44px"
              borderRadius="14px"
              bg="white"
              borderWidth="1px"
              borderColor="blackAlpha.200"
              color="black"
              _hover={{ bg: "blackAlpha.50" }}
              onClick={() => void loadMonthEvents()}
              disabled={loadingEvents}
            >
              <Icon as={FiRefreshCw} />
            </IconButton>

            <IconButton
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              size="md"
              variant="ghost"
              h="44px"
              w="44px"
              borderRadius="14px"
              bg="white"
              borderWidth="1px"
              borderColor="blackAlpha.200"
              color="black"
              _hover={{ bg: "blackAlpha.50" }}
              onClick={() => setIsFullscreen((v) => !v)}
            >
              <Icon as={isFullscreen ? FiMinimize2 : FiMaximize2} />
            </IconButton>

            {onClose ? (
              <IconButton
                aria-label="Close Calendar"
                size="md"
                variant="ghost"
                h="44px"
                w="44px"
                borderRadius="14px"
                bg="white"
                borderWidth="1px"
                borderColor="blackAlpha.200"
                color="black"
                _hover={{ bg: "blackAlpha.50" }}
                onClick={onClose}
              >
                <Icon as={FiX} />
              </IconButton>
            ) : null}
          </HStack>
        </Flex>

        {error ? (
          <Box
            mt={4}
            bg="#FFE8E8"
            borderRadius="14px"
            borderWidth="1px"
            borderColor="#F2A2A2"
            p={3}
          >
            <Text color="black" fontSize="sm" fontWeight="800">
              {error}
            </Text>
          </Box>
        ) : null}

        <Flex mt={4} gap={3} align="center" justify="space-between" wrap="wrap">
          <Badge
            bg={INPUT_BG}
            borderWidth="1px"
            borderColor={BORDER}
            color="black"
            borderRadius="999px"
            px={3}
            py={1}
            fontWeight="900"
          >
            Local schedule
          </Badge>

          <HStack justify="flex-end">
            <IconButton
              aria-label="Previous month"
              size="sm"
              variant="ghost"
              color="black"
              bg="white"
              borderWidth="1px"
              borderColor="blackAlpha.200"
              borderRadius="14px"
              _hover={{ bg: "blackAlpha.50" }}
              onClick={() =>
                setMonthCursor(
                  (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1),
                )
              }
            >
              <Icon as={FiChevronLeft} />
            </IconButton>
            <Box
              bg="white"
              borderRadius="14px"
              borderWidth="1px"
              borderColor="blackAlpha.200"
              px={4}
              h="36px"
              display="flex"
              alignItems="center"
            >
              <Text fontWeight="900" color="black" fontSize="sm">
                {monthCursor.toLocaleString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </Box>
            <IconButton
              aria-label="Next month"
              size="sm"
              variant="ghost"
              color="black"
              bg="white"
              borderWidth="1px"
              borderColor="blackAlpha.200"
              borderRadius="14px"
              _hover={{ bg: "blackAlpha.50" }}
              onClick={() =>
                setMonthCursor(
                  (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1),
                )
              }
            >
              <Icon as={FiChevronRight} />
            </IconButton>
          </HStack>
        </Flex>
      </Box>

      <Box p={{ base: 4, md: 6 }} overflow="auto">
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={5} alignItems="start">
          <Box>
            <SimpleGrid columns={7} gap={2}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <Text
                  key={d}
                  fontSize="xs"
                  fontWeight="900"
                  color="blackAlpha.700"
                  textAlign="center"
                >
                  {d}
                </Text>
              ))}

              {monthGrid.map((d) => {
                const inMonth = d.getMonth() === monthCursor.getMonth();
                const isToday = isSameDay(d, now);
                const selected = isSameDay(d, selectedDate);
                const k = fmtYmd(d);
                const count = eventCountByDay.get(k) ?? 0;
                const showEventDot = count > 0;
                const showOverflowDot = count > 3;

                return (
                  <Box
                    key={k}
                    as="button"
                    onClick={() => setSelectedDate(d)}
                    bg={selected ? ACCENT : "white"}
                    color={selected ? "white" : "black"}
                    borderRadius="14px"
                    borderWidth="1px"
                    borderColor={selected ? ACCENT : "blackAlpha.200"}
                    _hover={{ bg: selected ? ACCENT_HOVER : "blackAlpha.50" }}
                    opacity={inMonth ? 1 : 0.5}
                    p={2}
                    minH="54px"
                    display="flex"
                    flexDirection="column"
                    alignItems="flex-start"
                    justifyContent="space-between"
                  >
                    <HStack justify="space-between" w="full">
                      <Text fontSize="sm" fontWeight="900">
                        {d.getDate()}
                      </Text>
                      <HStack gap={1.5}>
                        {isToday ? (
                          <Box
                            w="9px"
                            h="9px"
                            borderRadius="999px"
                            bg="#22C55E"
                            borderWidth="2px"
                            borderColor={selected ? "whiteAlpha.900" : "white"}
                            title="Today"
                          />
                        ) : null}
                        {showEventDot ? (
                          <Box
                            w="9px"
                            h="9px"
                            borderRadius="999px"
                            bg="#EF4444"
                            borderWidth="2px"
                            borderColor={selected ? "whiteAlpha.900" : "white"}
                            title={count === 1 ? "1 event" : `${count} events`}
                          />
                        ) : null}
                        {showOverflowDot ? (
                          <Box
                            w="6px"
                            h="6px"
                            borderRadius="999px"
                            bg="#B91C1C"
                            title="Many events"
                          />
                        ) : null}
                      </HStack>
                    </HStack>

                    <Box h="12px" />
                  </Box>
                );
              })}
            </SimpleGrid>

            <Text mt={3} fontSize="xs" color="blackAlpha.700">
              {loadingEvents
                ? "Loading events…"
                : "Tap a date to see schedules."}
            </Text>
          </Box>

          <Box>
            <Box
              bg="white"
              borderRadius="18px"
              borderWidth="1px"
              borderColor="blackAlpha.200"
              p={4}
            >
              <HStack justify="space-between" align="flex-start" gap={3}>
                <Box>
                  <Text fontWeight="900" color="black">
                    {selectedDate.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </Text>
                  <Text fontSize="sm" color="blackAlpha.600">
                    {selectedDayEvents.length} event
                    {selectedDayEvents.length === 1 ? "" : "s"}
                  </Text>
                </Box>
                <Badge
                  bg={INPUT_BG}
                  borderWidth="1px"
                  borderColor={BORDER}
                  color="black"
                  borderRadius="999px"
                  px={3}
                  py={1}
                  fontWeight="900"
                >
                  {dayKey}
                </Badge>
              </HStack>

              <Stack mt={4} gap={3}>
                {selectedDayEvents.length === 0 ? (
                  <Text fontSize="sm" color="blackAlpha.700">
                    No events for this day.
                  </Text>
                ) : (
                  selectedDayEvents.map((e) => (
                    <Box
                      key={e.id}
                      bg={INPUT_BG}
                      borderRadius="16px"
                      borderWidth="1px"
                      borderColor={BORDER}
                      p={3}
                    >
                      <HStack
                        justify="space-between"
                        align="flex-start"
                        gap={3}
                      >
                        <Box minW={0}>
                          <Text fontWeight="900" color="black" lineClamp={1}>
                            {e.title || "(Untitled)"}
                          </Text>
                          <Text fontSize="xs" color="blackAlpha.700" mt={1}>
                            {getEventTimeLabel(e)}
                            {e.location ? ` • ${e.location}` : ""}
                          </Text>
                        </Box>
                        <IconButton
                          aria-label="Delete event"
                          size="sm"
                          variant="ghost"
                          color="black"
                          _hover={{ bg: "blackAlpha.100" }}
                          onClick={() => void deleteEvent(e)}
                        >
                          <Icon as={FiTrash2} />
                        </IconButton>
                      </HStack>
                      {e.description ? (
                        <Text
                          mt={2}
                          fontSize="sm"
                          color="blackAlpha.800"
                          lineClamp={3}
                        >
                          {e.description}
                        </Text>
                      ) : null}
                    </Box>
                  ))
                )}
              </Stack>
            </Box>

            <Box
              mt={5}
              bg="white"
              borderRadius="18px"
              borderWidth="1px"
              borderColor={ACCENT}
              p={4}
            >
              <Text fontWeight="900" color="black">
                Add event
              </Text>
              <Text fontSize="sm" color="blackAlpha.600">
                Create a schedule on the selected day
              </Text>

              <Box mt={4}>
                <Text fontSize="sm" fontWeight="800" color="black">
                  Title{" "}
                  <Text as="span" color={ACCENT}>
                    *
                  </Text>
                </Text>
                <Input
                  mt={2}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Study session"
                  bg={INPUT_BG}
                  color="black"
                  _placeholder={{ color: "blackAlpha.600" }}
                  borderRadius="14px"
                  borderWidth="1px"
                  borderColor={BORDER}
                  h="42px"
                  px={4}
                  textAlign="left"
                />
              </Box>

              <Box mt={4}>
                <HStack justify="space-between" align="center">
                  <Text fontSize="sm" fontWeight="800" color="black">
                    All day
                  </Text>
                  <Box
                    as="label"
                    display="flex"
                    alignItems="center"
                    gap={2}
                    bg={INPUT_BG}
                    borderRadius="999px"
                    borderWidth="1px"
                    borderColor={BORDER}
                    px={3}
                    py={1}
                    cursor="pointer"
                    userSelect="none"
                  >
                    <input
                      type="checkbox"
                      checked={newAllDay}
                      onChange={(e) => setNewAllDay(e.currentTarget.checked)}
                    />
                    <Text fontSize="xs" fontWeight="900" color="black">
                      {newAllDay ? "Yes" : "No"}
                    </Text>
                  </Box>
                </HStack>
              </Box>

              {!newAllDay ? (
                <SimpleGrid mt={4} columns={{ base: 1, md: 2 }} gap={4}>
                  <Box>
                    <Text fontSize="sm" fontWeight="800" color="black">
                      Start
                    </Text>
                    <Input
                      mt={2}
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      bg={INPUT_BG}
                      color="black"
                      borderRadius="14px"
                      borderWidth="1px"
                      borderColor={BORDER}
                      h="42px"
                      px={4}
                    />
                  </Box>
                  <Box>
                    <Text fontSize="sm" fontWeight="800" color="black">
                      End
                    </Text>
                    <Input
                      mt={2}
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      bg={INPUT_BG}
                      color="black"
                      borderRadius="14px"
                      borderWidth="1px"
                      borderColor={BORDER}
                      h="42px"
                      px={4}
                    />
                  </Box>
                </SimpleGrid>
              ) : null}

              <Box mt={4}>
                <Text fontSize="sm" fontWeight="800" color="black">
                  Location
                </Text>
                <Input
                  mt={2}
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Optional"
                  bg={INPUT_BG}
                  color="black"
                  _placeholder={{ color: "blackAlpha.600" }}
                  borderRadius="14px"
                  borderWidth="1px"
                  borderColor={BORDER}
                  h="42px"
                  px={4}
                />
              </Box>

              <Box mt={4}>
                <Text fontSize="sm" fontWeight="800" color="black">
                  Notes
                </Text>
                <Textarea
                  mt={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Optional"
                  bg={INPUT_BG}
                  color="black"
                  _placeholder={{ color: "blackAlpha.600" }}
                  borderRadius="14px"
                  borderWidth="1px"
                  borderColor={BORDER}
                  minH="110px"
                  px={4}
                />
              </Box>

              <Flex mt={4} justify="flex-end" gap={3}>
                <Button
                  size="md"
                  borderRadius="14px"
                  h="42px"
                  px={6}
                  bg={ACCENT}
                  color="white"
                  fontWeight="900"
                  _hover={{ bg: ACCENT_HOVER }}
                  onClick={() => void createEvent()}
                  loading={creating}
                >
                  Create
                </Button>
              </Flex>
            </Box>
          </Box>
        </SimpleGrid>
      </Box>
    </Box>
  );

  return tool;
}
