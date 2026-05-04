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
  Textarea,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DatePickerInput } from "@mantine/dates";
import {
  FiBarChart2,
  FiBell,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiClipboard,
  FiFlag,
  FiMaximize2,
  FiMinimize2,
  FiPlus,
  FiSearch,
  FiSettings,
  FiTrash2,
  FiX,
} from "react-icons/fi";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TaskStatus = "pending" | "inProgress" | "completed";
type TaskPriority = "low" | "medium" | "high";

type TaskDto = {
  id: string;
  title: string;
  description?: string | null;
  priority?: TaskPriority | null;
  reminderMinutesBefore?: number | null;
  label?: string | null;
  deadlineAt?: string | null;
  location?: string | null;
  status: TaskStatus;
  progress: number;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const CONFIGURED_API_BASE = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
)?.trim();

const API_BASE = CONFIGURED_API_BASE || "http://localhost:3001";

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
    // ignore non-json
  }

  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

function dateValueToLocalIso(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(v);
  if (!m) return null;
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(year, monthIndex, day);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return d.getTime() < todayStart.getTime();
}

function isDueToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return t >= start.getTime() && t < end.getTime();
}

function relativeDayLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startDue.getTime() - startToday.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return "today";
  if (diffDays === -1) return "yesterday";
  if (diffDays === 1) return "tomorrow";
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  return `in ${diffDays} days`;
}

function fmtShortDayMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  const month = d.toLocaleString(undefined, { month: "short" });
  return `${day} ${month}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDaysLocal(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function fmtWeekdayShort(d: Date): string {
  return d.toLocaleString(undefined, { weekday: "short" });
}

function priorityLabel(p: TaskPriority | "" | null | undefined) {
  if (!p) return "Priority";
  if (p === "low") return "Low 🍃";
  if (p === "medium") return "Medium ⚡";
  return "High 🔥";
}

function reminderLabel(m: number | "" | null | undefined) {
  if (m === "" || m === null || m === undefined) return "Reminders";
  if (m === 0) return "At time";
  if (m === 30) return "30 min";
  if (m === 60) return "1 hour";
  if (m === 24 * 60) return "1 day";
  return `${m} min`;
}

type TaskToolProps = {
  onClose?: () => void;
};

export default function TaskTool({ onClose }: TaskToolProps) {
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"task" | "graph">("task");
  const [graphRange, setGraphRange] = useState<"week" | "month">("week");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const monthTitle = useMemo(() => {
    const now = new Date();
    return now.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, []);

  const [taskTab, setTaskTab] = useState<"tasks" | "today" | "completed">(
    "tasks",
  );

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority | "">("");
  const [newReminder, setNewReminder] = useState<number | "">("");

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

  const addTitleRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  // Date picking uses Mantine DatePickerInput (no hidden native inputs needed).
  const priorityWrapRef = useRef<HTMLDivElement | null>(null);
  const reminderWrapRef = useRef<HTMLDivElement | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ ok: true; tasks: TaskDto[] }>("/tasks");
      setTasks(data.tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    if (!adding) return;
    window.setTimeout(() => addTitleRef.current?.focus(), 0);
  }, [adding]);

  useEffect(() => {
    if (!priorityOpen && !reminderOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (priorityOpen && priorityWrapRef.current?.contains(target)) return;
      if (reminderOpen && reminderWrapRef.current?.contains(target)) return;
      setPriorityOpen(false);
      setReminderOpen(false);
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [priorityOpen, reminderOpen]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const pending = tasks.filter((t) => t.status !== "completed").length;
    return { total, completed, pending };
  }, [tasks]);

  const graph = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;

    const completionRate =
      total === 0 ? 0 : Math.round((completed / total) * 100);

    const pending = total - completed;
    const statusPieRaw = [
      { name: "Completed", value: completed, color: "#7C3AED" },
      { name: "Pending", value: pending, color: "#F97316" },
    ].filter((p) => p.value > 0);
    const statusPie =
      statusPieRaw.length === 0
        ? [{ name: "No tasks", value: 1, color: "#E2E8F0" }]
        : statusPieRaw;

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);

    const dueSoon = tasks.filter((t) => {
      if (t.status === "completed") return false;
      if (!t.dueAt) return false;
      const d = new Date(t.dueAt);
      if (Number.isNaN(d.getTime())) return false;
      return d.getTime() >= now.getTime() && d.getTime() <= end.getTime();
    }).length;

    const completedTasks = tasks
      .filter((t) => t.status === "completed")
      .map((t) => {
        const completedAtMs = t.completedAt
          ? new Date(t.completedAt).getTime()
          : NaN;
        return {
          completedAtMs,
          priority: (t.priority ?? null) as TaskPriority | null,
          label: (t.label ?? "") as string,
        };
      })
      .filter((t) => Number.isFinite(t.completedAtMs));

    const completedAtMsList = completedTasks.map((t) => t.completedAtMs);

    function countCompletedBetween(
      startMs: number,
      endExclusiveMs: number,
    ): number {
      return completedAtMsList.filter(
        (ms) => ms >= startMs && ms < endExclusiveMs,
      ).length;
    }

    function buildCompletedPerDayWeek() {
      const todayStart = startOfLocalDay(new Date());
      const points: Array<{ day: string; count: number; dateKey: string }> = [];
      for (let i = 6; i >= 0; i -= 1) {
        const dayStart = addDaysLocal(todayStart, -i);
        const dayEnd = addDaysLocal(dayStart, 1);
        points.push({
          day: fmtWeekdayShort(dayStart),
          count: countCompletedBetween(dayStart.getTime(), dayEnd.getTime()),
          dateKey: dayStart.toISOString().slice(0, 10),
        });
      }
      return points;
    }

    function buildCompletedPerDayMonth() {
      const nowLocal = new Date();
      const monthStart = new Date(
        nowLocal.getFullYear(),
        nowLocal.getMonth(),
        1,
      );
      const nextMonthStart = new Date(
        nowLocal.getFullYear(),
        nowLocal.getMonth() + 1,
        1,
      );
      const daysInMonth = Math.round(
        (startOfLocalDay(nextMonthStart).getTime() -
          startOfLocalDay(monthStart).getTime()) /
          (24 * 60 * 60 * 1000),
      );

      const points: Array<{ day: string; count: number; dateKey: string }> = [];
      for (let dayIndex = 0; dayIndex < daysInMonth; dayIndex += 1) {
        const dayStart = addDaysLocal(monthStart, dayIndex);
        const dayEnd = addDaysLocal(dayStart, 1);
        points.push({
          day: String(dayStart.getDate()),
          count: countCompletedBetween(dayStart.getTime(), dayEnd.getTime()),
          dateKey: dayStart.toISOString().slice(0, 10),
        });
      }

      return points;
    }

    const completedPerDayWeek = buildCompletedPerDayWeek();
    const completedPerDayMonth = buildCompletedPerDayMonth();
    const completedThisWeek = completedPerDayWeek.reduce(
      (s, p) => s + p.count,
      0,
    );
    const completedThisMonth = completedPerDayMonth.reduce(
      (s, p) => s + p.count,
      0,
    );

    return {
      completionRate,
      dueSoon,
      statusPie,
      completedPerDayWeek,
      completedPerDayMonth,
      completedThisWeek,
      completedThisMonth,
    };
  }, [tasks]);

  const filtered = useMemo(() => {
    if (taskTab === "completed")
      return tasks.filter((t) => t.status === "completed");
    if (taskTab === "today") {
      return tasks
        .filter((t) => t.status !== "completed")
        .filter((t) => isDueToday(t.dueAt));
    }
    return tasks.filter((t) => t.status !== "completed");
  }, [tasks, taskTab]);

  const visibleTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((t) => {
      const hay = [t.title, t.description, t.label, t.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [filtered, searchQuery]);

  function resetNew() {
    setAdding(false);
    setCreating(false);
    setError(null);
    setNewTitle("");
    setNewDescription("");
    setNewDueDate("");
    setNewPriority("");
    setNewReminder("");
    setPriorityOpen(false);
    setReminderOpen(false);
  }

  function openAdd() {
    setError(null);
    setNewTitle("");
    setNewDescription("");
    setNewDueDate("");
    setNewPriority("");
    setNewReminder("");
    setPriorityOpen(false);
    setReminderOpen(false);
    setAdding(true);
  }

  function toggleSearch() {
    setSearchOpen((v) => {
      const next = !v;
      if (next) {
        window.setTimeout(() => searchRef.current?.focus(), 0);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!adding) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") resetNew();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") {
        void createTask();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [adding, newTitle, newDescription, newDueDate]);

  async function createTask() {
    const title = newTitle.trim();
    if (!title) {
      setError("Title is required");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const body = {
        title,
        description: newDescription.trim() || null,
        dueAt: dateValueToLocalIso(newDueDate),
        priority: (newPriority || null) as TaskPriority | null,
        reminderMinutesBefore:
          newReminder === "" ? null : (newReminder as number),
      };
      const data = await apiJson<{ ok: true; task: TaskDto }>("/tasks", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setTasks((cur) => [data.task, ...cur]);
      resetNew();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setCreating(false);
    }
  }

  async function updateTask(
    id: string,
    patch: Partial<TaskDto> & { dueAt?: any },
  ) {
    setError(null);
    const prev = tasks;
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try {
      const data = await apiJson<{ ok: true; task: TaskDto }>(`/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setTasks((cur) => cur.map((t) => (t.id === id ? data.task : t)));
    } catch (e) {
      setTasks(prev);
      setError(e instanceof Error ? e.message : "Failed to update task");
    }
  }

  async function deleteTask(id: string) {
    setError(null);
    const prev = tasks;
    setTasks((cur) => cur.filter((t) => t.id !== id));
    try {
      await apiJson<{ ok: true }>(`/tasks/${id}`, { method: "DELETE" });
    } catch (e) {
      setTasks(prev);
      setError(e instanceof Error ? e.message : "Failed to delete task");
    }
  }

  return (
    <>
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
        bg="#FBF7EE"
        borderRadius="22px"
        borderWidth="2px"
        borderColor="#93C5FD"
        boxShadow="0 18px 50px rgba(0,0,0,0.18)"
        overflow="hidden"
        display="flex"
        flexDirection="column"
        position={isFullscreen ? "fixed" : "relative"}
        inset={isFullscreen ? 4 : undefined}
        zIndex={isFullscreen ? 40 : undefined}
      >
        {/* Top header + stats */}
        <Box bg="#E9E6F7" p={{ base: 4, md: 5 }}>
          <Flex justify="space-between" align="flex-start" gap={4}>
            <Box>
              <Text fontSize={{ base: "md", md: "lg" }} fontWeight="900">
                My Task Space
              </Text>
              <Text fontSize="xs" color="blackAlpha.700">
                Manage your assignments and track progress
              </Text>
            </Box>

            <HStack gap={3}>
              <Button
                bg="#8D57FF"
                color="white"
                borderRadius="999px"
                h="38px"
                px={4}
                fontSize="sm"
                fontWeight="800"
                _hover={{ bg: "#7C3AED" }}
                onClick={toggleSearch}
              >
                <HStack gap={2}>
                  <Icon as={FiSearch} />
                  <Text>Search</Text>
                </HStack>
              </Button>

              <Button
                bg="#8D57FF"
                color="white"
                borderRadius="999px"
                h="38px"
                px={4}
                fontSize="sm"
                fontWeight="800"
                _hover={{ bg: "#7C3AED" }}
                onClick={openAdd}
              >
                <HStack gap={2}>
                  <Icon as={FiPlus} />
                  <Text>New Task</Text>
                </HStack>
              </Button>

              <IconButton
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                variant="outline"
                borderRadius="999px"
                h="38px"
                w="38px"
                bg="whiteAlpha.800"
                onClick={() => setIsFullscreen((v) => !v)}
              >
                <Icon as={isFullscreen ? FiMinimize2 : FiMaximize2} />
              </IconButton>

              {/* Close Button */}
              {onClose && (
                <IconButton
                  aria-label="Close"
                  variant="outline"
                  borderRadius="999px"
                  h="38px"
                  w="38px"
                  bg="whiteAlpha.800"
                  onClick={onClose}
                >
                  <Icon as={FiX} />
                </IconButton>
              )}
            </HStack>
          </Flex>

          {searchOpen ? (
            <Box mt={3}>
              <Input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks…"
                bg="white"
                borderRadius="14px"
                fontSize="sm"
              />
            </Box>
          ) : null}

          <HStack gap={4} mt={4} flexWrap="wrap">
            <Box
              bg="white"
              borderRadius="14px"
              borderWidth="1px"
              borderColor="#BFE3FF"
              px={4}
              py={3}
              minW={{ base: "160px", md: "190px" }}
              color="black"
            >
              <HStack justify="space-between">
                <HStack gap={2}>
                  <Icon as={FiClipboard} color="#2563EB" />
                  <Text fontSize="xs" color="black" fontWeight="800">
                    Total Tasks
                  </Text>
                </HStack>
              </HStack>
              <Text fontSize="xl" fontWeight="900" mt={1} color="black">
                {stats.total}
              </Text>
            </Box>

            <Box
              bg="white"
              borderRadius="14px"
              borderWidth="1px"
              borderColor="#BBF7D0"
              px={4}
              py={3}
              minW={{ base: "160px", md: "190px" }}
              color="black"
            >
              <HStack gap={2}>
                <Icon as={FiCheckCircle} color="#16A34A" />
                <Text fontSize="xs" color="black" fontWeight="800">
                  Completed
                </Text>
              </HStack>
              <Text fontSize="xl" fontWeight="900" mt={1} color="black">
                {stats.completed}
              </Text>
            </Box>

            <Box
              bg="white"
              borderRadius="14px"
              borderWidth="1px"
              borderColor="#FED7AA"
              px={4}
              py={3}
              minW={{ base: "160px", md: "190px" }}
              color="black"
            >
              <HStack gap={2}>
                <Icon as={FiCalendar} color="#A855F7" />
                <Text fontSize="xs" color="black" fontWeight="800">
                  Pending
                </Text>
              </HStack>
              <Text fontSize="xl" fontWeight="900" mt={1} color="black">
                {stats.pending}
              </Text>
            </Box>
          </HStack>
        </Box>

        {/* Content */}
        <Box flex="1" overflowY="auto" px={{ base: 4, md: 6 }} py={5}>
          <Stack gap={4}>
            <HStack gap={3}>
              <Button
                borderRadius="10px"
                h="34px"
                px={4}
                fontSize="sm"
                fontWeight="900"
                bg={view === "task" ? "#F59E0B" : "transparent"}
                color={view === "task" ? "white" : "black"}
                borderWidth={view === "task" ? 0 : "1px"}
                borderColor="blackAlpha.300"
                _hover={{ bg: view === "task" ? "#F59E0B" : "blackAlpha.50" }}
                onClick={() => setView("task")}
              >
                <HStack gap={2}>
                  <Icon as={FiClipboard} />
                  <Text>Task Space</Text>
                </HStack>
              </Button>
              <Button
                borderRadius="10px"
                h="34px"
                px={4}
                fontSize="sm"
                fontWeight="900"
                bg={view === "graph" ? "#14B8A6" : "transparent"}
                color={view === "graph" ? "white" : "black"}
                borderWidth={view === "graph" ? 0 : "1px"}
                borderColor="blackAlpha.300"
                _hover={{ bg: view === "graph" ? "#14B8A6" : "blackAlpha.50" }}
                onClick={() => setView("graph")}
              >
                <HStack gap={2}>
                  <Icon as={FiBarChart2} />
                  <Text>Graph View</Text>
                </HStack>
              </Button>
            </HStack>

            {view === "graph" ? (
              <Stack gap={4}>
                <HStack gap={4} flexWrap="wrap">
                  <Box
                    bg="#ECFDF5"
                    borderRadius="12px"
                    borderWidth="1px"
                    borderColor="#86EFAC"
                    p={4}
                    minW={{ base: "260px", md: "280px" }}
                    flex="1"
                  >
                    <Text fontSize="xs" color="blackAlpha.700" fontWeight="800">
                      Completion Rate
                    </Text>
                    <Text fontSize="2xl" fontWeight="900" color="black" mt={1}>
                      {graph.completionRate}%
                    </Text>
                    <Box
                      mt={2}
                      h="8px"
                      bg="blackAlpha.100"
                      borderRadius="999px"
                      overflow="hidden"
                    >
                      <Box
                        h="100%"
                        w={`${graph.completionRate}%`}
                        bg="#22C55E"
                        borderRadius="999px"
                      />
                    </Box>
                    <Text fontSize="xs" color="blackAlpha.600" mt={1}>
                      of tasks completed
                    </Text>
                  </Box>

                  <Box
                    bg="#F5F3FF"
                    borderRadius="12px"
                    borderWidth="1px"
                    borderColor="#D8B4FE"
                    p={4}
                    minW={{ base: "260px", md: "280px" }}
                    flex="1"
                  >
                    <Text fontSize="xs" color="blackAlpha.700" fontWeight="800">
                      Tasks Due Soon
                    </Text>
                    <Text fontSize="2xl" fontWeight="900" color="black" mt={1}>
                      {graph.dueSoon}
                    </Text>
                    <Box
                      mt={2}
                      h="8px"
                      bg="blackAlpha.100"
                      borderRadius="999px"
                      overflow="hidden"
                    >
                      <Box
                        h="100%"
                        w={`${Math.min(100, graph.dueSoon * 10)}%`}
                        bg="#A855F7"
                        borderRadius="999px"
                      />
                    </Box>
                    <Text fontSize="xs" color="blackAlpha.600" mt={1}>
                      within the next 7 days
                    </Text>
                  </Box>
                </HStack>

                <Box
                  bg="white"
                  borderRadius="16px"
                  borderWidth="1px"
                  borderColor="blackAlpha.200"
                  p={{ base: 4, md: 5 }}
                >
                  <Flex
                    align="center"
                    justify="space-between"
                    gap={3}
                    flexWrap="wrap"
                  >
                    <Box>
                      <Text fontSize="sm" fontWeight="900" color="black">
                        Completed Tasks (per day)
                        {graphRange === "month" ? ` — ${monthTitle}` : ""}
                      </Text>
                      <Text fontSize="xs" color="blackAlpha.600">
                        {graphRange === "week"
                          ? `${graph.completedThisWeek} completed in the last 7 days`
                          : `${graph.completedThisMonth} completed this month`}
                      </Text>
                    </Box>

                    <HStack
                      gap={1}
                      bg="blackAlpha.50"
                      borderRadius="999px"
                      p="3px"
                      borderWidth="1px"
                      borderColor="blackAlpha.200"
                    >
                      <Button
                        size="sm"
                        h="32px"
                        px={4}
                        borderRadius="999px"
                        bg={graphRange === "week" ? "black" : "transparent"}
                        color={graphRange === "week" ? "white" : "black"}
                        fontWeight="800"
                        _hover={{
                          bg:
                            graphRange === "week" ? "black" : "blackAlpha.100",
                        }}
                        onClick={() => setGraphRange("week")}
                      >
                        Week
                      </Button>
                      <Button
                        size="sm"
                        h="32px"
                        px={4}
                        borderRadius="999px"
                        bg={graphRange === "month" ? "black" : "transparent"}
                        color={graphRange === "month" ? "white" : "black"}
                        fontWeight="800"
                        _hover={{
                          bg:
                            graphRange === "month" ? "black" : "blackAlpha.100",
                        }}
                        onClick={() => setGraphRange("month")}
                      >
                        Month
                      </Button>
                    </HStack>
                  </Flex>

                  <Box h={{ base: "240px", md: "280px" }} mt={4}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={
                          graphRange === "week"
                            ? graph.completedPerDayWeek
                            : graph.completedPerDayMonth
                        }
                        margin={{ left: 8, right: 12, top: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 11, fill: "#6B7280" }}
                          axisLine={{ stroke: "#E5E7EB" }}
                          tickLine={{ stroke: "#E5E7EB" }}
                          interval={graphRange === "week" ? 0 : 2}
                          height={22}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "#6B7280" }}
                          axisLine={{ stroke: "#E5E7EB" }}
                          tickLine={{ stroke: "#E5E7EB" }}
                          label={{
                            value: "Tasks",
                            angle: -90,
                            position: "insideLeft",
                            fill: "#6B7280",
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          labelFormatter={(_label: any, payload: any) =>
                            payload?.[0]?.payload?.dateKey ?? ""
                          }
                          formatter={(value: any) => [value, "Completed"]}
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid rgba(0,0,0,0.08)",
                          }}
                        />
                        <Bar
                          dataKey="count"
                          fill="#14B8A6"
                          radius={[8, 8, 0, 0]}
                          maxBarSize={graphRange === "week" ? 42 : 18}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>

                <Flex gap={4} direction={{ base: "column", md: "row" }}>
                  <Box
                    bg="white"
                    borderRadius="16px"
                    borderWidth="1px"
                    borderColor="blackAlpha.200"
                    boxShadow="0 10px 26px rgba(0,0,0,0.06)"
                    p={{ base: 4, md: 5 }}
                    flex="1"
                    minH="320px"
                  >
                    <Text fontSize="sm" fontWeight="900" color="black">
                      Task Status
                    </Text>
                    <Text fontSize="xs" color="blackAlpha.600" mb={3}>
                      Completed vs pending tasks
                    </Text>
                    <Box h="250px">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={graph.statusPie}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={2}
                            stroke="#FFFFFF"
                            strokeWidth={2}
                          >
                            {graph.statusPie.map((s) => (
                              <Cell key={s.name} fill={(s as any).color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                </Flex>
              </Stack>
            ) : (
              <>
                <HStack gap={{ base: 8, md: 14 }} align="flex-end" mt={1}>
                  {(
                    [
                      {
                        key: "tasks" as const,
                        label: "Tasks",
                        icon: FiClipboard,
                        color: "#2563EB",
                      },
                      {
                        key: "today" as const,
                        label: "Today",
                        icon: FiCalendar,
                        color: "#A855F7",
                      },
                      {
                        key: "completed" as const,
                        label: "Completed",
                        icon: FiCheckCircle,
                        color: "#16A34A",
                      },
                    ] as const
                  ).map((t) => {
                    const active = taskTab === t.key;
                    return (
                      <Box
                        key={t.key}
                        as="button"
                        onClick={() => setTaskTab(t.key)}
                        borderBottomWidth={active ? "4px" : "0px"}
                        borderBottomColor={active ? "black" : "transparent"}
                        pb={1}
                      >
                        <HStack gap={2} align="center">
                          <Text
                            fontSize={{ base: "xl", md: "2xl" }}
                            fontWeight={active ? "900" : "600"}
                            color="black"
                          >
                            {t.label}
                          </Text>
                          <Icon as={t.icon} color={t.color} boxSize="18px" />
                        </HStack>
                      </Box>
                    );
                  })}
                </HStack>

                {loading ? (
                  <Text fontSize="sm" color="blackAlpha.700">
                    Loading…
                  </Text>
                ) : visibleTasks.length === 0 ? (
                  <Box
                    bg="white"
                    borderRadius="16px"
                    borderWidth="1px"
                    borderColor="blackAlpha.200"
                    p={8}
                    textAlign="center"
                  >
                    <Text fontSize="sm" fontWeight="900">
                      No tasks here yet
                    </Text>
                    <Text fontSize="xs" color="blackAlpha.700" mt={1}>
                      Click “+ New Task” to add one.
                    </Text>
                  </Box>
                ) : (
                  <Stack gap={4} mt={2}>
                    {visibleTasks.map((t) => {
                      const dueLabel = fmtShortDayMonth(t.dueAt);
                      const overdue =
                        t.status !== "completed" && isOverdue(t.dueAt);
                      const rel = relativeDayLabel(t.dueAt);
                      const done = t.status === "completed";
                      return (
                        <Flex
                          key={t.id}
                          align="center"
                          justify="space-between"
                          bg="white"
                          borderRadius="12px"
                          borderWidth="1px"
                          borderColor="#FCA5A5"
                          px={{ base: 4, md: 6 }}
                          py={{ base: 3, md: 4 }}
                          role="group"
                        >
                          <HStack gap={4} minW={0}>
                            <Box
                              as="button"
                              aria-label={
                                done ? "Mark as active" : "Mark as completed"
                              }
                              w="28px"
                              h="28px"
                              borderRadius="full"
                              bg="#E5E7EB"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              onClick={() => {
                                void updateTask(t.id, {
                                  status: done ? "pending" : "completed",
                                  progress: done ? 0 : 100,
                                });
                              }}
                            >
                              <Icon
                                as={done ? FiCheckCircle : FiSettings}
                                color={done ? "#16A34A" : "#9CA3AF"}
                                boxSize="16px"
                              />
                            </Box>

                            <Box minW={0}>
                              <Text
                                fontSize={{ base: "md", md: "lg" }}
                                fontWeight="700"
                                color="black"
                                lineClamp={1}
                              >
                                {t.title}
                              </Text>
                              {t.description ? (
                                <Text
                                  fontSize="xs"
                                  fontWeight="600"
                                  color="blackAlpha.700"
                                  lineClamp={1}
                                  mt="2px"
                                >
                                  {t.description}
                                </Text>
                              ) : null}
                            </Box>
                          </HStack>

                          <HStack gap={3} flexShrink={0}>
                            <Box textAlign="right" minW="92px">
                              <Text
                                fontSize="sm"
                                fontWeight="700"
                                lineHeight="1.1"
                                color={overdue ? "red.500" : "black"}
                              >
                                {dueLabel || ""}
                              </Text>
                              <Text
                                fontSize="xs"
                                fontWeight="600"
                                lineHeight="1.1"
                                color={overdue ? "red.500" : "blackAlpha.700"}
                              >
                                {rel || ""}
                              </Text>
                            </Box>

                            <IconButton
                              aria-label="Delete"
                              variant="ghost"
                              size="sm"
                              opacity={1}
                              _hover={{ bg: "blackAlpha.100" }}
                              color="black"
                              onClick={() => void deleteTask(t.id)}
                            >
                              <Icon as={FiTrash2} color="black" />
                            </IconButton>
                          </HStack>
                        </Flex>
                      );
                    })}
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </Box>
      </Box>

      {/* Add New Task modal */}
      {adding ? (
        <Box
          position="fixed"
          inset={0}
          bg="blackAlpha.500"
          zIndex={100}
          display="flex"
          alignItems="center"
          justifyContent="center"
          p={4}
        >
          <Box
            w={{ base: "100%", md: "880px" }}
            maxW="95vw"
            bg="#FBF7EE"
            borderRadius="26px"
            borderWidth="2px"
            borderColor="#93C5FD"
            boxShadow="0 24px 70px rgba(0,0,0,0.35)"
            p={{ base: 5, md: 8 }}
            position="relative"
            color="black"
          >
            <IconButton
              aria-label="Close"
              variant="ghost"
              position="absolute"
              top={3}
              right={3}
              borderRadius="999px"
              _hover={{ bg: "blackAlpha.100" }}
              color="black"
              onClick={resetNew}
            >
              <Icon as={FiX} />
            </IconButton>

            <Text fontSize={{ base: "2xl", md: "3xl" }} fontWeight="900" mb={5}>
              Add New Task
            </Text>

            <Stack gap={4}>
              <Input
                ref={addTitleRef}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Go to the market Saturday morning"
                bg="white"
                borderRadius="14px"
                h="56px"
                fontSize="md"
                fontWeight="700"
                color="black"
                _placeholder={{ color: "blackAlpha.500" }}
              />

              <SimpleGrid
                columns={{ base: 1, md: 3 }}
                gap={4}
                alignItems="stretch"
              >
                <Box w="100%">
                  <DatePickerInput
                    value={newDueDate ? newDueDate : null}
                    onChange={(value) => {
                      setNewDueDate(value ?? "");
                    }}
                    placeholder="Date"
                    clearable
                    valueFormat="DD MMM YYYY"
                    style={{ width: "100%" }}
                    styles={{
                      input: {
                        height: "56px",
                        borderRadius: "14px",
                        backgroundColor: "white",
                        fontWeight: 800,
                        fontSize: "14px",
                        borderColor: "rgba(0,0,0,0.16)",
                        paddingLeft: "48px",
                        color: "#000000",
                        opacity: 1,
                      },
                    }}
                    leftSection={
                      <FiCalendar size={18} color="rgba(0,0,0,0.65)" />
                    }
                    popoverProps={{ withinPortal: false, zIndex: 2000 }}
                  />
                </Box>

                <Box ref={priorityWrapRef} position="relative" w="100%">
                  <Button
                    variant="outline"
                    borderRadius="14px"
                    h="56px"
                    px={5}
                    w="100%"
                    justifyContent="space-between"
                    bg={
                      newPriority === "high"
                        ? "#FEF2F2"
                        : newPriority === "medium"
                          ? "#FFF7ED"
                          : newPriority === "low"
                            ? "#F0FDF4"
                            : "white"
                    }
                    fontWeight="800"
                    fontSize="sm"
                    color={
                      newPriority === "high"
                        ? "#DC2626"
                        : newPriority === "medium"
                          ? "#EA580C"
                          : newPriority === "low"
                            ? "#16A34A"
                            : "blackAlpha.500"
                    }
                    borderColor={
                      newPriority === "high"
                        ? "#FECACA"
                        : newPriority === "medium"
                          ? "#FED7AA"
                          : newPriority === "low"
                            ? "#BBF7D0"
                            : "rgba(0,0,0,0.16)"
                    }
                    _hover={{
                      borderColor: "#93C5FD",
                      bg: newPriority ? undefined : "#F8FAFC",
                    }}
                    onClick={() => setPriorityOpen((v) => !v)}
                  >
                    <HStack gap={3}>
                      <Icon
                        as={FiFlag}
                        color={
                          newPriority === "high"
                            ? "#DC2626"
                            : newPriority === "medium"
                              ? "#EA580C"
                              : newPriority === "low"
                                ? "#16A34A"
                                : "blackAlpha.500"
                        }
                      />
                      <Text>{priorityLabel(newPriority)}</Text>
                    </HStack>
                    <Icon
                      as={FiPlus}
                      style={{
                        transform: priorityOpen
                          ? "rotate(45deg)"
                          : "rotate(0deg)",
                        transition: "0.2s",
                      }}
                      color="blackAlpha.400"
                    />
                  </Button>

                  {priorityOpen ? (
                    <Box
                      position="absolute"
                      top="calc(100% + 8px)"
                      left={0}
                      w="100%"
                      bg="white"
                      borderWidth="1px"
                      borderColor="#E2E8F0"
                      borderRadius="16px"
                      boxShadow="0 20px 40px -4px rgba(0,0,0,0.16)"
                      p={2}
                      zIndex={101}
                    >
                      <Stack gap={1}>
                        {(
                          [
                            {
                              key: "low" as const,
                              label: "Low 🍃",
                              bg: "#F0FDF4",
                              color: "#16A34A",
                              border: "#BBF7D0",
                            },
                            {
                              key: "medium" as const,
                              label: "Medium ⚡",
                              bg: "#FFF7ED",
                              color: "#EA580C",
                              border: "#FED7AA",
                            },
                            {
                              key: "high" as const,
                              label: "High 🔥",
                              bg: "#FEF2F2",
                              color: "#DC2626",
                              border: "#FECACA",
                            },
                          ] as const
                        ).map((opt) => (
                          <Button
                            key={opt.key}
                            variant="ghost"
                            justifyContent="space-between"
                            borderRadius="12px"
                            h="42px"
                            fontSize="sm"
                            fontWeight="800"
                            bg={
                              newPriority === opt.key ? opt.bg : "transparent"
                            }
                            color={
                              newPriority === opt.key ? opt.color : "black"
                            }
                            _hover={{ bg: opt.bg, color: opt.color }}
                            onClick={() => {
                              setNewPriority(opt.key);
                              setPriorityOpen(false);
                            }}
                          >
                            <HStack gap={3}>
                              <Box
                                w="10px"
                                h="10px"
                                borderRadius="full"
                                bg={opt.color}
                              />
                              <Text>{opt.label}</Text>
                            </HStack>
                            {newPriority === opt.key ? (
                              <Icon as={FiCheck} />
                            ) : null}
                          </Button>
                        ))}
                      </Stack>
                    </Box>
                  ) : null}
                </Box>

                <Box ref={reminderWrapRef} position="relative" w="100%">
                  <Button
                    variant="outline"
                    borderRadius="14px"
                    h="56px"
                    px={5}
                    w="100%"
                    justifyContent="space-between"
                    bg={newReminder !== "" ? "#F3E8FF" : "white"}
                    fontWeight="800"
                    fontSize="sm"
                    color={newReminder !== "" ? "#7C3AED" : "blackAlpha.500"}
                    borderColor={
                      newReminder !== "" ? "#D8B4FE" : "rgba(0,0,0,0.16)"
                    }
                    _hover={{
                      borderColor: "#93C5FD",
                      bg: newReminder !== "" ? undefined : "#F8FAFC",
                    }}
                    onClick={() => setReminderOpen((v) => !v)}
                  >
                    <HStack gap={3}>
                      <Icon
                        as={FiBell}
                        color={
                          newReminder !== "" ? "#7C3AED" : "blackAlpha.500"
                        }
                      />
                      <Text>{reminderLabel(newReminder)}</Text>
                    </HStack>
                    <Icon
                      as={FiPlus}
                      style={{
                        transform: reminderOpen
                          ? "rotate(45deg)"
                          : "rotate(0deg)",
                        transition: "0.2s",
                      }}
                      color="blackAlpha.400"
                    />
                  </Button>

                  {reminderOpen ? (
                    <Box
                      position="absolute"
                      top="calc(100% + 8px)"
                      left={0}
                      w="100%"
                      bg="white"
                      borderWidth="1px"
                      borderColor="#E2E8F0"
                      borderRadius="16px"
                      boxShadow="0 20px 40px -4px rgba(0,0,0,0.16)"
                      p={2}
                      zIndex={101}
                    >
                      <Stack gap={1}>
                        {(
                          [
                            { v: "" as const, label: "No reminder" },
                            { v: 0 as const, label: "At time" },
                            { v: 30 as const, label: "30 min before" },
                            { v: 60 as const, label: "1 hour before" },
                            { v: 1440 as const, label: "1 day before" },
                          ] as const
                        ).map((opt) => (
                          <Button
                            key={String(opt.v)}
                            variant="ghost"
                            justifyContent="space-between"
                            borderRadius="12px"
                            h="42px"
                            fontSize="sm"
                            fontWeight="800"
                            bg={
                              newReminder === opt.v && opt.v !== ""
                                ? "#F3E8FF"
                                : "transparent"
                            }
                            color={
                              newReminder === opt.v && opt.v !== ""
                                ? "#7C3AED"
                                : "black"
                            }
                            _hover={{
                              bg: opt.v === "" ? "blackAlpha.50" : "#F3E8FF",
                              color: opt.v === "" ? "black" : "#7C3AED",
                            }}
                            onClick={() => {
                              setNewReminder(opt.v);
                              setReminderOpen(false);
                            }}
                          >
                            <Text>{opt.label}</Text>
                            {newReminder === opt.v ? (
                              <Icon as={FiCheck} />
                            ) : null}
                          </Button>
                        ))}
                      </Stack>
                    </Box>
                  ) : null}
                </Box>
              </SimpleGrid>

              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description"
                bg="white"
                borderRadius="14px"
                minH="120px"
                fontSize="md"
                color="black"
                _placeholder={{ color: "blackAlpha.500" }}
              />

              <Box h="1px" bg="blackAlpha.200" my={3} />

              <Flex justify="flex-end" align="center" gap={4}>
                <Button
                  variant="ghost"
                  fontWeight="800"
                  color="black"
                  _hover={{ bg: "blackAlpha.100" }}
                  onClick={resetNew}
                >
                  Cancel
                </Button>
                <Button
                  bg="#7C3AED"
                  color="white"
                  borderRadius="12px"
                  h="52px"
                  px={8}
                  fontWeight="900"
                  _hover={{ bg: "#6D28D9" }}
                  loading={creating}
                  onClick={() => void createTask()}
                >
                  Add task
                </Button>
              </Flex>

              {error ? (
                <Text fontSize="sm" color="red.600" fontWeight="700">
                  {error}
                </Text>
              ) : null}
            </Stack>
          </Box>
        </Box>
      ) : null}
    </>
  );
}
