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
import { useEffect, useMemo, useState } from "react";
import {
  FiBarChart2,
  FiCheckCircle,
  FiCheckSquare,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiClipboard,
  FiPlus,
  FiSquare,
  FiTrash2,
} from "react-icons/fi";

type TaskStatus = "pending" | "inProgress" | "completed";

type SubTaskDto = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  doneAt: string | null;
};

type TaskDto = {
  id: string;
  title: string;
  status: TaskStatus;
  progress: number;
  dueAt: string | null;
  completedAt: string | null;
  subTasks: SubTaskDto[];
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
    // Non-JSON response (or empty body)
  }

  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export default function TaskTool() {
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"task" | "graph">("task");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [newSubTaskTitleByTask, setNewSubTaskTitleByTask] = useState<
    Record<string, string>
  >({});

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

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const inProgress = tasks.filter((t) => t.status === "inProgress").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    return { total, completed, inProgress, pending };
  }, [tasks]);

  const completionRate = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  }, [stats.completed, stats.total]);

  const analytics = useMemo(() => {
    const now = Date.now();
    const twoDays = 2 * 24 * 60 * 60 * 1000;

    const active = tasks.filter((t) => t.status !== "completed");
    const overdue = active.filter((t) => {
      const d = t.dueAt ? new Date(t.dueAt).getTime() : Number.NaN;
      return Number.isFinite(d) && d < now;
    }).length;
    const dueSoon = active.filter((t) => {
      const d = t.dueAt ? new Date(t.dueAt).getTime() : Number.NaN;
      return Number.isFinite(d) && d >= now && d <= now + twoDays;
    }).length;

    const completed = tasks.filter((t) => t.status === "completed");
    const durations = completed
      .map((t) => {
        const created = new Date(t.createdAt).getTime();
        const done = t.completedAt
          ? new Date(t.completedAt).getTime()
          : Number.NaN;
        if (!Number.isFinite(created) || !Number.isFinite(done)) return null;
        if (done <= created) return null;
        return done - created;
      })
      .filter((v): v is number => typeof v === "number");

    const avgCompletionMs =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

    return {
      overdue,
      dueSoon,
      avgCompletionMs,
      completedWithTime: durations.length,
    };
  }, [tasks]);

  async function createTask() {
    const title = newTitle.trim();
    if (!title) return;

    setError(null);
    const dueAt = newDueDate.trim() ? new Date(newDueDate).toISOString() : null;

    setAdding(false);
    setNewTitle("");
    setNewDueDate("");

    try {
      const data = await apiJson<{ ok: true; task: TaskDto }>("/tasks", {
        method: "POST",
        body: JSON.stringify({ title, dueAt }),
      });
      setTasks((prev) => [data.task, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
      setAdding(true);
      setNewTitle(title);
      setNewDueDate(newDueDate);
    }
  }

  async function updateTask(
    id: string,
    patch:
      | Partial<Pick<TaskDto, "title" | "status" | "progress" | "dueAt">>
      | {
          subTaskAdd?: { title: string };
          subTaskToggle?: { id: string; done: boolean };
          subTaskDelete?: { id: string };
        },
  ) {
    setError(null);
    try {
      const data = await apiJson<{ ok: true; task: TaskDto }>(`/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setTasks((cur) => cur.map((t) => (t.id === id ? data.task : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    }
  }

  function fmtDateTime(iso: string | null | undefined) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }

  function fmtDate(iso: string | null | undefined) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  }

  function fmtDuration(ms: number | null | undefined) {
    if (!ms || !Number.isFinite(ms) || ms <= 0) return "—";
    const totalMinutes = Math.round(ms / 60000);
    const minutes = totalMinutes % 60;
    const totalHours = Math.floor(totalMinutes / 60);
    const hours = totalHours % 24;
    const days = Math.floor(totalHours / 24);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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
    <Box
      w={{ base: "calc(100vw - 140px)", md: "980px" }}
      maxW="calc(100vw - 140px)"
      maxH={{ base: "calc(100vh - 130px)", md: "calc(100vh - 170px)" }}
      bg="#F6F0E6"
      borderRadius="24px"
      borderWidth="1px"
      borderColor="blackAlpha.200"
      boxShadow="0 18px 50px rgba(0,0,0,0.25)"
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      {/* Header area */}
      <Box
        bg="#DCD9E8"
        borderBottomWidth="1px"
        borderBottomColor="blackAlpha.200"
        p={{ base: 4, md: 6 }}
        position="sticky"
        top={0}
        zIndex={1}
      >
        <Flex justify="space-between" align="flex-start" gap={4}>
          <Box>
            <Text fontSize={{ base: "lg", md: "2xl" }} fontWeight="900">
              My Task Space
            </Text>
            <Text fontSize="sm" color="blackAlpha.700">
              Manage your assignments and track progress
            </Text>
          </Box>

          <Button
            size="md"
            borderRadius="999px"
            h="44px"
            px={5}
            bg="#8D57FF"
            color="white"
            fontSize="sm"
            fontWeight="700"
            _hover={{ bg: "#7C48F3" }}
            onClick={() => setAdding((v) => !v)}
          >
            <HStack gap={2}>
              <Icon as={FiPlus} />
              <Text fontSize="sm">New Task</Text>
            </HStack>
          </Button>
        </Flex>

        {adding ? (
          <HStack mt={4} gap={3} align="center">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Type a task title…"
              bg="whiteAlpha.900"
              color="black"
              _placeholder={{ color: "blackAlpha.600" }}
              borderRadius="14px"
              borderWidth="1px"
              borderColor="blackAlpha.200"
              onKeyDown={(e) => {
                if (e.key === "Enter") void createTask();
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <Input
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              type="date"
              w={{ base: "150px", md: "190px" }}
              bg="whiteAlpha.900"
              color="black"
              borderRadius="14px"
              borderWidth="1px"
              borderColor="blackAlpha.200"
            />
            <Button
              borderRadius="14px"
              bg="black"
              color="white"
              _hover={{ bg: "blackAlpha.800" }}
              onClick={() => void createTask()}
              disabled={!newTitle.trim()}
            >
              Add
            </Button>
            <Button
              borderRadius="14px"
              variant="ghost"
              _hover={{ bg: "blackAlpha.100" }}
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
          </HStack>
        ) : null}
      </Box>

      {/* Scrollable content */}
      <Box
        flex="1"
        overflowY="auto"
        css={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(0,0,0,0.25) transparent",
          "&::-webkit-scrollbar": { width: "8px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            background: "rgba(0,0,0,0.18)",
            borderRadius: "999px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "rgba(0,0,0,0.28)",
          },
        }}
      >
        <Stack p={{ base: 4, md: 6 }} gap={5}>
          {error ? (
            <Box
              borderRadius="14px"
              bg="red.50"
              borderWidth="1px"
              borderColor="red.200"
              px={4}
              py={3}
            >
              <Text color="red.700" fontSize="sm">
                {error}
              </Text>
            </Box>
          ) : null}

          {/* Stats cards */}
          <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
            <Box
              bg="white"
              borderRadius="16px"
              borderWidth="1px"
              borderColor="#9AC3FF"
              p={4}
            >
              <HStack gap={3}>
                <Box
                  w="40px"
                  h="40px"
                  borderRadius="12px"
                  bg="#EAF3FF"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon as={FiClipboard} color="#2B6CB0" boxSize={5} />
                </Box>
                <Box>
                  <Text fontSize="sm" color="blackAlpha.600">
                    Total Tasks
                  </Text>
                  <Text fontSize="2xl" fontWeight="900" color="black">
                    {stats.total}
                  </Text>
                </Box>
              </HStack>
            </Box>

            <Box
              bg="white"
              borderRadius="16px"
              borderWidth="1px"
              borderColor="#B7F0C7"
              p={4}
            >
              <HStack gap={3}>
                <Box
                  w="40px"
                  h="40px"
                  borderRadius="12px"
                  bg="#E9FFF0"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon as={FiCheckCircle} color="#2F855A" boxSize={5} />
                </Box>
                <Box>
                  <Text fontSize="sm" color="blackAlpha.600">
                    Completed
                  </Text>
                  <Text fontSize="2xl" fontWeight="900" color="black">
                    {stats.completed}
                  </Text>
                </Box>
              </HStack>
            </Box>

            <Box
              bg="white"
              borderRadius="16px"
              borderWidth="1px"
              borderColor="#FFD4A7"
              p={4}
            >
              <HStack gap={3}>
                <Box
                  w="40px"
                  h="40px"
                  borderRadius="12px"
                  bg="#FFF2E6"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon as={FiClock} color="#C05621" boxSize={5} />
                </Box>
                <Box>
                  <Text fontSize="sm" color="blackAlpha.600">
                    In Progress
                  </Text>
                  <Text fontSize="2xl" fontWeight="900" color="black">
                    {stats.inProgress}
                  </Text>
                </Box>
              </HStack>
            </Box>

            <Box
              bg="white"
              borderRadius="16px"
              borderWidth="1px"
              borderColor="#D7B7FF"
              p={4}
            >
              <HStack gap={3}>
                <Box
                  w="40px"
                  h="40px"
                  borderRadius="12px"
                  bg="#F3E9FF"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon as={FiBarChart2} color="#6B46C1" boxSize={5} />
                </Box>
                <Box>
                  <Text fontSize="sm" color="blackAlpha.600">
                    Pending
                  </Text>
                  <Text fontSize="2xl" fontWeight="900" color="black">
                    {stats.pending}
                  </Text>
                </Box>
              </HStack>
            </Box>
          </SimpleGrid>

          {/* View toggle */}
          <HStack gap={3}>
            <Button
              size="md"
              borderRadius="12px"
              h="44px"
              px={6}
              fontSize="sm"
              fontWeight="800"
              bg={view === "task" ? "black" : "white"}
              color={view === "task" ? "white" : "black"}
              borderWidth="1px"
              borderColor="blackAlpha.200"
              _hover={{ bg: view === "task" ? "black" : "blackAlpha.50" }}
              onClick={() => setView("task")}
            >
              Task View
            </Button>
            <Button
              size="md"
              borderRadius="12px"
              h="44px"
              px={6}
              fontSize="sm"
              fontWeight="800"
              bg={view === "graph" ? "black" : "white"}
              color={view === "graph" ? "white" : "black"}
              borderWidth="1px"
              borderColor="blackAlpha.200"
              _hover={{ bg: view === "graph" ? "black" : "blackAlpha.50" }}
              onClick={() => setView("graph")}
            >
              Graph View
            </Button>
            <Button
              ml="auto"
              size="md"
              variant="ghost"
              borderRadius="12px"
              h="44px"
              px={5}
              fontSize="sm"
              fontWeight="700"
              _hover={{ bg: "blackAlpha.100" }}
              onClick={() => void refresh()}
              disabled={loading}
            >
              Refresh
            </Button>
          </HStack>

          {view === "graph" ? (
            <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
              <Box
                bg="#E9FFF6"
                borderRadius="16px"
                p={4}
                borderWidth="1px"
                borderColor="blackAlpha.200"
              >
                <Text fontSize="sm" fontWeight="800" color="black">
                  Completion Rate
                </Text>
                <Text mt={2} fontSize="2xl" fontWeight="900" color="black">
                  {completionRate}%
                </Text>
                <Text fontSize="xs" color="blackAlpha.600">
                  {stats.completed} of {stats.total} tasks completed
                </Text>
                <Box
                  mt={3}
                  h="8px"
                  borderRadius="full"
                  bg="blackAlpha.100"
                  overflow="hidden"
                >
                  <Box h="full" width={`${completionRate}%`} bg="#48BB78" />
                </Box>
              </Box>

              <Box
                bg="#FFF3E6"
                borderRadius="16px"
                p={4}
                borderWidth="1px"
                borderColor="blackAlpha.200"
              >
                <Text fontSize="sm" fontWeight="800" color="black">
                  Overdue / Due Soon
                </Text>
                <Text mt={2} fontSize="2xl" fontWeight="900" color="black">
                  {analytics.overdue}
                </Text>
                <Text fontSize="xs" color="blackAlpha.600">
                  Overdue • Due soon: {analytics.dueSoon}
                </Text>
              </Box>

              <Box
                bg="#F3E9FF"
                borderRadius="16px"
                p={4}
                borderWidth="1px"
                borderColor="blackAlpha.200"
              >
                <Text fontSize="sm" fontWeight="800" color="black">
                  Avg Time to Complete
                </Text>
                <Text mt={2} fontSize="2xl" fontWeight="900" color="black">
                  {fmtDuration(analytics.avgCompletionMs)}
                </Text>
                <Text fontSize="xs" color="blackAlpha.600">
                  Based on {analytics.completedWithTime} completed tasks
                </Text>
              </Box>
            </SimpleGrid>
          ) : (
            <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
              {loading ? (
                <Text color="blackAlpha.700">Loading…</Text>
              ) : tasks.length === 0 ? (
                <Text color="blackAlpha.700">
                  No tasks yet. Add one with “New Task”.
                </Text>
              ) : (
                tasks.map((t) => (
                  <Box
                    key={t.id}
                    bg="white"
                    borderRadius="16px"
                    borderWidth="1px"
                    borderColor="blackAlpha.200"
                    p={4}
                  >
                    {(() => {
                      const subTotal = t.subTasks?.length ?? 0;
                      const subDone =
                        t.subTasks?.filter((st) => st.done).length ?? 0;
                      const derivedProgress = subTotal
                        ? Math.round((subDone / subTotal) * 100)
                        : (t.progress ?? 0);
                      const completedLabel = subTotal
                        ? `${subDone}/${subTotal} done`
                        : `${derivedProgress}%`;
                      const isDerived = subTotal > 0;

                      return (
                        <>
                          <Flex
                            align="flex-start"
                            justify="space-between"
                            gap={3}
                          >
                            <Box minW={0}>
                              <Text fontWeight="900" lineClamp={2}>
                                {t.title}
                              </Text>
                              <HStack mt={1} gap={3} wrap="wrap">
                                <Text fontSize="xs" color="blackAlpha.600">
                                  Added: {fmtDateTime(t.createdAt)}
                                </Text>
                                <Text fontSize="xs" color="blackAlpha.600">
                                  Deadline: {fmtDate(t.dueAt)}
                                </Text>
                              </HStack>
                              <Text fontSize="xs" color="blackAlpha.600" mt={1}>
                                {completedLabel} • Status: {t.status}
                              </Text>
                              {isDerived ? (
                                <Text
                                  fontSize="xs"
                                  color="blackAlpha.600"
                                  mt={1}
                                >
                                  Status/progress is auto from subtasks
                                </Text>
                              ) : null}
                            </Box>
                            <HStack gap={1}>
                              <IconButton
                                aria-label={
                                  openTaskId === t.id ? "Collapse" : "Expand"
                                }
                                variant="ghost"
                                size="sm"
                                _hover={{ bg: "blackAlpha.100" }}
                                onClick={() =>
                                  setOpenTaskId((cur) =>
                                    cur === t.id ? null : t.id,
                                  )
                                }
                              >
                                <Icon
                                  as={
                                    openTaskId === t.id
                                      ? FiChevronUp
                                      : FiChevronDown
                                  }
                                />
                              </IconButton>
                              <IconButton
                                aria-label="Delete"
                                variant="ghost"
                                size="sm"
                                _hover={{ bg: "blackAlpha.100" }}
                                onClick={() => void deleteTask(t.id)}
                              >
                                <Icon as={FiTrash2} />
                              </IconButton>
                            </HStack>
                          </Flex>

                          <HStack mt={3} gap={2}>
                            <Button
                              size="xs"
                              borderRadius="999px"
                              bg={t.status === "pending" ? "black" : "white"}
                              color={t.status === "pending" ? "white" : "black"}
                              borderWidth="1px"
                              borderColor="blackAlpha.200"
                              _hover={{
                                bg:
                                  t.status === "pending"
                                    ? "black"
                                    : "blackAlpha.50",
                              }}
                              disabled={isDerived}
                              onClick={() =>
                                void updateTask(t.id, {
                                  status: "pending",
                                  progress: Math.min(t.progress, 99),
                                })
                              }
                            >
                              Pending
                            </Button>
                            <Button
                              size="xs"
                              borderRadius="999px"
                              bg={t.status === "inProgress" ? "black" : "white"}
                              color={
                                t.status === "inProgress" ? "white" : "black"
                              }
                              borderWidth="1px"
                              borderColor="blackAlpha.200"
                              _hover={{
                                bg:
                                  t.status === "inProgress"
                                    ? "black"
                                    : "blackAlpha.50",
                              }}
                              disabled={isDerived}
                              onClick={() =>
                                void updateTask(t.id, {
                                  status: "inProgress",
                                  progress: Math.max(1, t.progress),
                                })
                              }
                            >
                              In Progress
                            </Button>
                            <Button
                              size="xs"
                              borderRadius="999px"
                              bg={t.status === "completed" ? "black" : "white"}
                              color={
                                t.status === "completed" ? "white" : "black"
                              }
                              borderWidth="1px"
                              borderColor="blackAlpha.200"
                              _hover={{
                                bg:
                                  t.status === "completed"
                                    ? "black"
                                    : "blackAlpha.50",
                              }}
                              disabled={isDerived}
                              onClick={() =>
                                void updateTask(t.id, {
                                  status: "completed",
                                  progress: 100,
                                })
                              }
                            >
                              Done
                            </Button>
                          </HStack>

                          <Box
                            mt={3}
                            h="8px"
                            borderRadius="full"
                            bg="blackAlpha.100"
                            overflow="hidden"
                          >
                            <Box
                              h="full"
                              width={`${derivedProgress}%`}
                              bg="#8D57FF"
                            />
                          </Box>

                          {openTaskId === t.id ? (
                            <Box
                              mt={4}
                              borderTopWidth="1px"
                              borderTopColor="blackAlpha.100"
                              pt={3}
                            >
                              <HStack justify="space-between">
                                <Text
                                  fontSize="sm"
                                  fontWeight="900"
                                  color="black"
                                >
                                  Subtasks
                                </Text>
                                <Text fontSize="xs" color="blackAlpha.600">
                                  Completed: {subDone} • Remaining:{" "}
                                  {Math.max(0, subTotal - subDone)}
                                </Text>
                              </HStack>

                              <HStack mt={3} gap={2}>
                                <Input
                                  value={newSubTaskTitleByTask[t.id] ?? ""}
                                  onChange={(e) =>
                                    setNewSubTaskTitleByTask((cur) => ({
                                      ...cur,
                                      [t.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Add a subtask…"
                                  bg="white"
                                  color="black"
                                  _placeholder={{ color: "blackAlpha.600" }}
                                  borderRadius="12px"
                                  h="36px"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const title = (
                                        newSubTaskTitleByTask[t.id] ?? ""
                                      ).trim();
                                      if (!title) return;
                                      void updateTask(t.id, {
                                        subTaskAdd: { title },
                                      });
                                      setNewSubTaskTitleByTask((cur) => ({
                                        ...cur,
                                        [t.id]: "",
                                      }));
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  h="36px"
                                  borderRadius="12px"
                                  bg="black"
                                  color="white"
                                  _hover={{ bg: "blackAlpha.800" }}
                                  onClick={() => {
                                    const title = (
                                      newSubTaskTitleByTask[t.id] ?? ""
                                    ).trim();
                                    if (!title) return;
                                    void updateTask(t.id, {
                                      subTaskAdd: { title },
                                    });
                                    setNewSubTaskTitleByTask((cur) => ({
                                      ...cur,
                                      [t.id]: "",
                                    }));
                                  }}
                                >
                                  <HStack gap={2}>
                                    <Icon as={FiPlus} />
                                    <Text fontSize="sm">Add</Text>
                                  </HStack>
                                </Button>
                              </HStack>

                              <Stack mt={3} gap={2}>
                                {(t.subTasks ?? []).length === 0 ? (
                                  <Text fontSize="xs" color="blackAlpha.600">
                                    No subtasks yet. Add your first one.
                                  </Text>
                                ) : (
                                  (t.subTasks ?? []).map((st) => (
                                    <Flex
                                      key={st.id}
                                      align="center"
                                      justify="space-between"
                                      gap={3}
                                      bg="blackAlpha.50"
                                      borderRadius="12px"
                                      px={3}
                                      py={2}
                                    >
                                      <HStack gap={2} minW={0}>
                                        <IconButton
                                          aria-label={
                                            st.done
                                              ? "Mark not done"
                                              : "Mark done"
                                          }
                                          size="sm"
                                          variant="ghost"
                                          _hover={{ bg: "blackAlpha.100" }}
                                          onClick={() =>
                                            void updateTask(t.id, {
                                              subTaskToggle: {
                                                id: st.id,
                                                done: !st.done,
                                              },
                                            })
                                          }
                                        >
                                          <Icon
                                            as={
                                              st.done ? FiCheckSquare : FiSquare
                                            }
                                          />
                                        </IconButton>
                                        <Box minW={0}>
                                          <Text
                                            fontSize="sm"
                                            fontWeight="700"
                                            color="black"
                                            textDecoration={
                                              st.done ? "line-through" : "none"
                                            }
                                            lineClamp={2}
                                          >
                                            {st.title}
                                          </Text>
                                          <Text
                                            fontSize="xs"
                                            color="blackAlpha.600"
                                          >
                                            {st.done
                                              ? `Done: ${fmtDateTime(st.doneAt)}`
                                              : `Added: ${fmtDateTime(st.createdAt)}`}
                                          </Text>
                                        </Box>
                                      </HStack>

                                      <IconButton
                                        aria-label="Delete subtask"
                                        size="sm"
                                        variant="ghost"
                                        _hover={{ bg: "blackAlpha.100" }}
                                        onClick={() =>
                                          void updateTask(t.id, {
                                            subTaskDelete: { id: st.id },
                                          })
                                        }
                                      >
                                        <Icon as={FiTrash2} />
                                      </IconButton>
                                    </Flex>
                                  ))
                                )}
                              </Stack>
                            </Box>
                          ) : null}
                        </>
                      );
                    })()}
                  </Box>
                ))
              )}
            </SimpleGrid>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
