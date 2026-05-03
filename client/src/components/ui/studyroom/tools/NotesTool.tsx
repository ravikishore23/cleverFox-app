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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiBookmark,
  FiEdit3,
  FiDownload,
  FiFileText,
  FiFilter,
  FiGrid,
  FiList,
  FiMaximize2,
  FiMinimize2,
  FiPlus,
  FiSearch,
  FiStar,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import type { jsPDF } from "jspdf";

function Emoji({
  children,
  active = true,
}: {
  children: string;
  active?: boolean;
}) {
  return (
    <Text
      as="span"
      fontSize="lg"
      lineHeight="1"
      color="currentColor"
      style={{
        opacity: active ? 1 : 0.45,
        filter: active ? "none" : "grayscale(1)",
      }}
    >
      {children}
    </Text>
  );
}

type NoteDto = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  pinned: boolean;
  favorite: boolean;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
};

type NotesStats = {
  total: number;
  pinned: number;
  favorites: number;
  categories: number;
  words: number;
};

type NotesToolProps = {
  onClose?: () => void;
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

function computeWordCount(text: string): number {
  const normalized = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return 0;
  return normalized.split(" ").length;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function safeFileName(name: string): string {
  const base = String(name ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return base || "note";
}

function noteToPdf(doc: jsPDF, note: NoteDto) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;

  let y = margin;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(
    String(note.title || "Untitled note"),
    maxW,
  );
  for (const line of titleLines) {
    if (y > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(String(line), margin, y);
    y += 22;
  }

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);

  const meta: string[] = [];
  if (String(note.category ?? "").trim())
    meta.push(`Category: ${note.category}`);
  if ((note.tags ?? []).length)
    meta.push(`Tags: ${(note.tags ?? []).map((t) => `#${t}`).join(" ")}`);
  meta.push(`Updated: ${fmtDate(note.updatedAt)}`);
  meta.push(
    `Words: ${Math.max(0, Number(note.wordCount ?? computeWordCount(note.content))).toLocaleString()}`,
  );

  for (const m of meta) {
    const lines = doc.splitTextToSize(m, maxW);
    for (const line of lines) {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(String(line), margin, y);
      y += 14;
    }
  }

  y += 10;
  doc.setDrawColor(230, 180, 130);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  const content = String(note.content ?? "").trim();
  const contentLines = content
    ? doc.splitTextToSize(content, maxW)
    : ["(empty note)"];

  for (const line of contentLines) {
    if (y > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(String(line), margin, y);
    y += 16;
  }
}

export default function NotesTool({ onClose }: NotesToolProps) {
  // Palette tuned to match the existing creamy tools, with the orange accent from Figma.
  const BG = "#FFF7E6";
  const HEADER_BG = "#FFF0D6";
  const ACCENT = "#FF6F0F";
  const ACCENT_HOVER = "#F0660E";
  const BORDER = "#F2B37A";
  const INPUT_BG = "#FFF3DF";

  const [toolFull, setToolFull] = useState(false);

  const [notes, setNotes] = useState<NoteDto[]>([]);
  const [stats, setStats] = useState<NotesStats>({
    total: 0,
    pinned: 0,
    favorites: 0,
    categories: 0,
    words: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showPinned, setShowPinned] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);

  const [readerNoteId, setReaderNoteId] = useState<string | null>(null);
  const [readerFull, setReaderFull] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    note: NoteDto;
    from: "reader" | "list";
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [content, setContent] = useState("");

  const [editorPinned, setEditorPinned] = useState(false);
  const [editorFavorite, setEditorFavorite] = useState(false);

  const searchDebounce = useRef<number | null>(null);
  const refreshSeq = useRef(0);

  function closeToolFull() {
    setToolFull(false);
  }

  function closeTool() {
    setEditorOpen(false);
    setEditingId(null);
    setReaderNoteId(null);
    setReaderFull(false);
    setToolFull(false);
    onClose?.();
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      const c = String(n.category ?? "").trim();
      if (c) set.add(c);
    }
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [notes]);

  const readerNote = useMemo(
    () => notes.find((n) => n.id === readerNoteId) ?? null,
    [notes, readerNoteId],
  );

  const filteredNotes = useMemo(() => {
    let cur = notes;
    if (activeCategory !== "All") {
      cur = cur.filter((n) => (n.category ?? "") === activeCategory);
    }
    if (showPinned) cur = cur.filter((n) => n.pinned);
    if (showFavorites) cur = cur.filter((n) => n.favorite);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      cur = cur.filter((n) => {
        const hay =
          `${n.title} ${n.category} ${(n.tags ?? []).join(" ")} ${n.content}`.toLowerCase();
        return hay.includes(q);
      });
    }
    // Pinned first, then recently updated.
    return [...cur].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [activeCategory, notes, search, showFavorites, showPinned]);

  async function refreshAll(params?: {
    search?: string;
    category?: string;
    pinned?: boolean;
    favorite?: boolean;
  }) {
    const seq = ++refreshSeq.current;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (params?.search) q.set("search", params.search);
      if (params?.category && params.category !== "All")
        q.set("category", params.category);
      if (params?.pinned) q.set("pinned", "true");
      if (params?.favorite) q.set("favorite", "true");
      q.set("sort", "updatedAt");

      const [notesData, statsData] = await Promise.all([
        apiJson<{ ok: true; notes: NoteDto[] }>(`/notes?${q.toString()}`),
        apiJson<{ ok: true; stats: NotesStats }>("/notes/stats"),
      ]);

      // Guard against out-of-order async responses overwriting newer state.
      if (seq !== refreshSeq.current) return;
      setNotes(notesData.notes);
      setStats(statsData.stats);
    } catch (e) {
      if (seq === refreshSeq.current) {
        setError(e instanceof Error ? e.message : "Failed to load notes");
      }
    } finally {
      if (seq === refreshSeq.current) setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  // Debounced server refresh for large note sets (keeps UI snappy).
  useEffect(() => {
    if (searchDebounce.current) window.clearTimeout(searchDebounce.current);
    searchDebounce.current = window.setTimeout(() => {
      void refreshAll({
        search: search.trim() || undefined,
        category: activeCategory,
        pinned: showPinned,
        favorite: showFavorites,
      });
    }, 250);

    return () => {
      if (searchDebounce.current) window.clearTimeout(searchDebounce.current);
    };
  }, [search, activeCategory, showPinned, showFavorites]);

  function openNew() {
    setEditorOpen(true);
    setEditingId(null);
    setTitle("");
    setCategory("");
    setTagsText("");
    setContent("");
    setEditorPinned(false);
    setEditorFavorite(false);
  }

  function openEdit(n: NoteDto) {
    setEditorOpen(true);
    setEditingId(n.id);
    setTitle(n.title ?? "");
    setCategory(n.category ?? "");
    setTagsText((n.tags ?? []).join(", "));
    setContent(n.content ?? "");
    setEditorPinned(Boolean(n.pinned));
    setEditorFavorite(Boolean(n.favorite));
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
  }

  function openReader(n: NoteDto) {
    setReaderNoteId(n.id);
    setReaderFull(false);
  }

  function closeReader() {
    setReaderNoteId(null);
    setReaderFull(false);
  }

  async function saveEditor() {
    const t = title.trim();
    const c = content.trim();
    if (!t) return setError("Title is required");
    if (!c) return setError("Content is required");

    setError(null);
    const payload = {
      title: t,
      category: category.trim(),
      tags: tagsText,
      content: c,
      pinned: editorPinned,
      favorite: editorFavorite,
    };

    try {
      if (editingId) {
        await apiJson<{ ok: true; note: NoteDto }>(`/notes/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiJson<{ ok: true; note: NoteDto }>("/notes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      closeEditor();
      await refreshAll({
        search: search.trim() || undefined,
        category: activeCategory,
        pinned: showPinned,
        favorite: showFavorites,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save note");
    }
  }

  async function togglePinned(n: NoteDto) {
    setError(null);
    try {
      await apiJson<{ ok: true; note: NoteDto }>(`/notes/${n.id}`, {
        method: "PATCH",
        body: JSON.stringify({ pinned: !n.pinned }),
      });
      await refreshAll({
        search: search.trim() || undefined,
        category: activeCategory,
        pinned: showPinned,
        favorite: showFavorites,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update note");
    }
  }

  async function toggleFavorite(n: NoteDto) {
    setError(null);
    try {
      await apiJson<{ ok: true; note: NoteDto }>(`/notes/${n.id}`, {
        method: "PATCH",
        body: JSON.stringify({ favorite: !n.favorite }),
      });
      await refreshAll({
        search: search.trim() || undefined,
        category: activeCategory,
        pinned: showPinned,
        favorite: showFavorites,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update note");
    }
  }

  function openDeleteConfirm(note: NoteDto, from: "reader" | "list") {
    setError(null);
    setDeleteConfirm({ note, from });
  }

  function closeDeleteConfirm() {
    if (deleting) return;
    setDeleteConfirm(null);
  }

  async function deleteNoteNow(n: NoteDto): Promise<boolean> {
    setError(null);
    try {
      await apiJson<{ ok: true }>(`/notes/${n.id}`, { method: "DELETE" });
      // Keep the UI snappy even if refreshAll is slow.
      setNotes((prev) => prev.filter((x) => x.id !== n.id));

      // Prevent a pending debounced refresh from re-inserting stale data.
      if (searchDebounce.current) {
        window.clearTimeout(searchDebounce.current);
        searchDebounce.current = null;
      }

      await refreshAll({
        search: search.trim() || undefined,
        category: activeCategory,
        pinned: showPinned,
        favorite: showFavorites,
      });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete note");
      return false;
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const ok = await deleteNoteNow(deleteConfirm.note);
      if (!ok) return;

      // If deleting the item we're currently reading/editing, close those views.
      if (readerNoteId === deleteConfirm.note.id) closeReader();
      if (editingId === deleteConfirm.note.id) closeEditor();

      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  }

  async function exportReaderPdf() {
    if (!readerNote) return;
    setError(null);
    setExportingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      noteToPdf(doc, readerNote);
      const day = new Date().toISOString().slice(0, 10);
      const suggestedName = `${safeFileName(readerNote.title)}-${day}.pdf`;

      if ("showSaveFilePicker" in window) {
        const picker = (window as Window & {
          showSaveFilePicker?: (options: {
            suggestedName?: string;
            types?: Array<{
              description?: string;
              accept: Record<string, string[]>;
            }>;
            excludeAcceptAllOption?: boolean;
          }) => Promise<{
            createWritable: () => Promise<{
              write: (data: Blob) => Promise<void>;
              close: () => Promise<void>;
            }>;
          }>;
        }).showSaveFilePicker;

        if (picker) {
          const handle = await picker({
            suggestedName,
            types: [
              {
                description: "PDF Document",
                accept: { "application/pdf": [".pdf"] },
              },
            ],
            excludeAcceptAllOption: false,
          });
          const writable = await handle.createWritable();
          const blob = doc.output("blob") as Blob;
          await writable.write(blob);
          await writable.close();
          return;
        }
      }

      doc.save(suggestedName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  }

  const editorWordCount = useMemo(() => computeWordCount(content), [content]);
  const editorCharCount = useMemo(
    () => String(content ?? "").length,
    [content],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (readerNoteId) {
        e.preventDefault();
        closeReader();
        return;
      }
      if (toolFull) {
        e.preventDefault();
        closeToolFull();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readerNoteId, toolFull]);

  const tool = (
    <Box
      w={toolFull ? "100vw" : { base: "calc(100vw - 140px)", md: "980px" }}
      maxW={toolFull ? "100vw" : "calc(100vw - 140px)"}
      h={toolFull ? "100vh" : "auto"}
      maxH={
        toolFull
          ? "100vh"
          : { base: "calc(100vh - 130px)", md: "calc(100vh - 170px)" }
      }
      bg={BG}
      borderRadius={toolFull ? "0px" : "24px"}
      borderWidth={toolFull ? "0px" : "1px"}
      borderColor={toolFull ? "transparent" : "blackAlpha.200"}
      boxShadow={toolFull ? "none" : "0 18px 50px rgba(0,0,0,0.25)"}
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      {/* Header */}
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
              <Icon as={FiFileText} color="black" boxSize={6} />
            </Box>
            <Box>
              <Text
                fontSize={{ base: "lg", md: "2xl" }}
                fontWeight="900"
                color="black"
              >
                Smart Notes
              </Text>
              <Text fontSize="sm" color="blackAlpha.700">
                Study Room
              </Text>
            </Box>
          </HStack>

          <HStack gap={2}>
            <IconButton
              aria-label={toolFull ? "Exit full screen" : "Full screen"}
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
              onClick={() => {
                if (toolFull) closeToolFull();
                else setToolFull(true);
              }}
            >
              <Icon as={toolFull ? FiMinimize2 : FiMaximize2} />
            </IconButton>

            {onClose ? (
              <IconButton
                aria-label="Close Notes"
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
                onClick={closeTool}
              >
                <Icon as={FiX} />
              </IconButton>
            ) : null}

            {editorOpen ? (
              <Button
                size="md"
                borderRadius="999px"
                h="44px"
                px={5}
                bg={ACCENT}
                color="white"
                fontSize="sm"
                fontWeight="800"
                _hover={{ bg: ACCENT_HOVER }}
                onClick={closeEditor}
              >
                <HStack gap={2}>
                  <Icon as={FiX} />
                  <Text fontSize="sm">Cancel</Text>
                </HStack>
              </Button>
            ) : (
              <Button
                size="md"
                borderRadius="999px"
                h="44px"
                px={5}
                bg={ACCENT}
                color="white"
                fontSize="sm"
                fontWeight="800"
                _hover={{ bg: ACCENT_HOVER }}
                onClick={openNew}
              >
                <HStack gap={2}>
                  <Icon as={FiPlus} />
                  <Text fontSize="sm">New Notes</Text>
                </HStack>
              </Button>
            )}
          </HStack>
        </Flex>

        {/* Stats row */}
        <SimpleGrid mt={4} columns={{ base: 2, md: 5 }} gap={3}>
          <Box
            bg="white"
            borderRadius="14px"
            borderWidth="1px"
            borderColor={BORDER}
            p={3}
          >
            <Text fontSize="xs" fontWeight="800" color={ACCENT}>
              Total
            </Text>
            <Text fontSize="lg" fontWeight="900" color="black">
              {stats.total}
            </Text>
          </Box>
          <Box
            bg="white"
            borderRadius="14px"
            borderWidth="1px"
            borderColor={BORDER}
            p={3}
          >
            <HStack justify="space-between">
              <Text fontSize="xs" fontWeight="800" color={ACCENT}>
                Pinned
              </Text>
              <Icon as={FiBookmark} color={ACCENT} />
            </HStack>
            <Text fontSize="lg" fontWeight="900" color="black">
              {stats.pinned}
            </Text>
          </Box>
          <Box
            bg="white"
            borderRadius="14px"
            borderWidth="1px"
            borderColor={BORDER}
            p={3}
          >
            <HStack justify="space-between">
              <Text fontSize="xs" fontWeight="800" color={ACCENT}>
                Favorites
              </Text>
              <Icon as={FiStar} color={ACCENT} />
            </HStack>
            <Text fontSize="lg" fontWeight="900" color="black">
              {stats.favorites}
            </Text>
          </Box>
          <Box
            bg="white"
            borderRadius="14px"
            borderWidth="1px"
            borderColor={BORDER}
            p={3}
          >
            <Text fontSize="xs" fontWeight="800" color={ACCENT}>
              Categories
            </Text>
            <Text fontSize="lg" fontWeight="900" color="black">
              {stats.categories}
            </Text>
          </Box>
          <Box
            bg="white"
            borderRadius="14px"
            borderWidth="1px"
            borderColor={BORDER}
            p={3}
          >
            <Text fontSize="xs" fontWeight="800" color={ACCENT}>
              Words
            </Text>
            <Text fontSize="lg" fontWeight="900" color="black">
              {stats.words.toLocaleString()}
            </Text>
          </Box>
        </SimpleGrid>
      </Box>

      <Box p={{ base: 4, md: 6 }} overflow="auto">
        <Stack gap={4}>
          {error ? (
            <Box
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

          {/* Editor panel */}
          {editorOpen ? (
            <Box
              bg="white"
              borderRadius="18px"
              borderWidth="1px"
              borderColor={ACCENT}
              p={{ base: 4, md: 5 }}
            >
              <Flex justify="space-between" align="flex-start" gap={3}>
                <Box>
                  <Text
                    fontSize={{ base: "lg", md: "xl" }}
                    fontWeight="900"
                    color="black"
                  >
                    {editingId ? "Edit Note" : "Create New Note"}
                  </Text>
                  <Text fontSize="sm" color="blackAlpha.600">
                    Fill in the details below
                  </Text>
                </Box>

                {/* Logo-only toggles (no extra buttons at footer) */}
                <HStack gap={2}>
                  <IconButton
                    aria-label={editorPinned ? "Unpin" : "Pin"}
                    size="sm"
                    variant="ghost"
                    color="black"
                    borderRadius="12px"
                    bg={INPUT_BG}
                    borderWidth="1px"
                    borderColor={editorPinned ? ACCENT : BORDER}
                    _hover={{ bg: "blackAlpha.50" }}
                    onClick={() => setEditorPinned((v) => !v)}
                  >
                    <Emoji active={editorPinned}>📌</Emoji>
                  </IconButton>
                  <IconButton
                    aria-label={editorFavorite ? "Unfavorite" : "Favorite"}
                    size="sm"
                    variant="ghost"
                    color="black"
                    borderRadius="12px"
                    bg={INPUT_BG}
                    borderWidth="1px"
                    borderColor={editorFavorite ? ACCENT : BORDER}
                    _hover={{ bg: "blackAlpha.50" }}
                    onClick={() => setEditorFavorite((v) => !v)}
                  >
                    <Emoji active={editorFavorite}>⭐</Emoji>
                  </IconButton>
                </HStack>
              </Flex>

              <SimpleGrid mt={4} columns={{ base: 1, md: 2 }} gap={4}>
                <Box>
                  <Text fontSize="sm" fontWeight="800" color="black">
                    Title{" "}
                    <Text as="span" color={ACCENT}>
                      *
                    </Text>
                  </Text>
                  <Input
                    mt={2}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Python Basics, Math Formula…"
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
                <Box>
                  <Text fontSize="sm" fontWeight="800" color="black">
                    Category
                  </Text>
                  <Input
                    mt={2}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., Programming, Math, Science…"
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
              </SimpleGrid>

              <Box mt={4}>
                <Text fontSize="sm" fontWeight="800" color="black">
                  Tags{" "}
                  <Text as="span" color="blackAlpha.600" fontWeight="700">
                    (comma separated)
                  </Text>
                </Text>
                <Input
                  mt={2}
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="e.g., important, exam, review…"
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
                <Text fontSize="sm" fontWeight="800" color="black">
                  Content{" "}
                  <Text as="span" color={ACCENT}>
                    *
                  </Text>
                </Text>
                <Textarea
                  mt={2}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your note here… You can use bullet points, code, formulas, etc."
                  bg={INPUT_BG}
                  color="black"
                  _placeholder={{ color: "blackAlpha.600" }}
                  borderRadius="14px"
                  borderWidth="1px"
                  borderColor={BORDER}
                  minH={{ base: "140px", md: "180px" }}
                  px={4}
                  textAlign="left"
                />

                <Flex mt={2} justify="space-between" align="center">
                  <Text fontSize="xs" color="blackAlpha.600">
                    {editorCharCount.toLocaleString()} characters
                  </Text>
                  <Text fontSize="xs" color="blackAlpha.600">
                    {editorWordCount.toLocaleString()} words
                  </Text>
                </Flex>
              </Box>

              <Flex mt={4} gap={3} align="center" wrap="wrap">
                <Button
                  ml={{ base: 0, md: "auto" }}
                  size="md"
                  borderRadius="14px"
                  h="42px"
                  px={6}
                  bg={ACCENT}
                  color="white"
                  fontWeight="900"
                  _hover={{ bg: ACCENT_HOVER }}
                  onClick={() => void saveEditor()}
                >
                  {editingId ? "Save note" : "Create new notes"}
                </Button>
              </Flex>
            </Box>
          ) : null}

          {/* Search + view toggle */}
          <Flex
            gap={3}
            align={{ base: "stretch", md: "center" }}
            direction={{ base: "column", md: "row" }}
          >
            <HStack
              flex={1}
              bg={INPUT_BG}
              borderRadius="16px"
              borderWidth="1px"
              borderColor={BORDER}
              transition="border-color 120ms ease, box-shadow 120ms ease"
              _focusWithin={{
                borderColor: ACCENT,
                boxShadow: `inset 0 0 0 1px ${ACCENT}`,
              }}
              px={3}
              h="44px"
              align="center"
            >
              <Icon
                as={FiSearch}
                color="blackAlpha.700"
                boxSize={4}
                flexShrink={0}
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes by title, content, or tags…"
                bg="transparent"
                border="none"
                color="black"
                _placeholder={{ color: "blackAlpha.600" }}
                _focus={{ boxShadow: "none", outline: "none" }}
                _focusVisible={{ boxShadow: "none", outline: "none" }}
                h="100%"
                lineHeight="44px"
                px={2}
                py={0}
                textAlign="left"
                flex={1}
                minW={0}
              />
              {search.trim() ? (
                <IconButton
                  aria-label="Clear search"
                  variant="ghost"
                  size="sm"
                  h="36px"
                  w="36px"
                  minW="36px"
                  borderRadius="12px"
                  color="black"
                  _hover={{ bg: "blackAlpha.100" }}
                  onClick={() => setSearch("")}
                >
                  <Icon as={FiX} />
                </IconButton>
              ) : null}
            </HStack>

            <HStack justify={{ base: "space-between", md: "flex-end" }}>
              <Button
                size="sm"
                borderRadius="999px"
                h="36px"
                px={4}
                bg={showPinned ? ACCENT : INPUT_BG}
                color={showPinned ? "white" : "black"}
                borderWidth="1px"
                borderColor={showPinned ? ACCENT : BORDER}
                _hover={{ bg: showPinned ? ACCENT_HOVER : "blackAlpha.50" }}
                onClick={() => setShowPinned((v) => !v)}
              >
                <HStack gap={2}>
                  <Emoji active={showPinned}>📌</Emoji>
                  <Text fontSize="sm" fontWeight="900">
                    Pinned
                  </Text>
                </HStack>
              </Button>
              <Button
                size="sm"
                borderRadius="999px"
                h="36px"
                px={4}
                bg={showFavorites ? ACCENT : INPUT_BG}
                color={showFavorites ? "white" : "black"}
                borderWidth="1px"
                borderColor={showFavorites ? ACCENT : BORDER}
                _hover={{ bg: showFavorites ? ACCENT_HOVER : "blackAlpha.50" }}
                onClick={() => setShowFavorites((v) => !v)}
              >
                <HStack gap={2}>
                  <Emoji active={showFavorites}>⭐</Emoji>
                  <Text fontSize="sm" fontWeight="900">
                    Favorites
                  </Text>
                </HStack>
              </Button>

              <IconButton
                aria-label="Grid view"
                variant="ghost"
                size="sm"
                color="black"
                bg={view === "grid" ? "blackAlpha.100" : "transparent"}
                _hover={{ bg: "blackAlpha.100" }}
                onClick={() => setView("grid")}
              >
                <Icon as={FiGrid} />
              </IconButton>
              <IconButton
                aria-label="List view"
                variant="ghost"
                size="sm"
                color="black"
                bg={view === "list" ? "blackAlpha.100" : "transparent"}
                _hover={{ bg: "blackAlpha.100" }}
                onClick={() => setView("list")}
              >
                <Icon as={FiList} />
              </IconButton>
            </HStack>
          </Flex>

          {/* Category chips */}
          <HStack gap={2} wrap="wrap">
            <Icon as={FiFilter} color="blackAlpha.700" />
            {categories.map((c) => (
              <Button
                key={c}
                size="xs"
                borderRadius="999px"
                h="28px"
                px={4}
                bg={activeCategory === c ? ACCENT : "white"}
                color={activeCategory === c ? "white" : "black"}
                borderWidth="1px"
                borderColor={activeCategory === c ? ACCENT : "blackAlpha.200"}
                _hover={{
                  bg: activeCategory === c ? ACCENT_HOVER : "blackAlpha.50",
                }}
                onClick={() => setActiveCategory(c)}
              >
                {c}
              </Button>
            ))}
          </HStack>

          {/* Notes list */}
          {loading ? (
            <Text color="blackAlpha.700">Loading…</Text>
          ) : filteredNotes.length === 0 ? (
            <Text color="blackAlpha.700">
              No notes found. Create one with “New Notes”.
            </Text>
          ) : view === "grid" ? (
            <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
              {filteredNotes.map((n) => (
                <Box
                  key={n.id}
                  bg="white"
                  borderRadius="18px"
                  borderWidth="1px"
                  borderColor="blackAlpha.200"
                  p={4}
                  cursor="pointer"
                  _hover={{ boxShadow: "md" }}
                  onClick={() => openReader(n)}
                >
                  <Flex align="flex-start" justify="space-between" gap={3}>
                    <Box minW={0}>
                      <Text fontWeight="900" color="black" lineClamp={2}>
                        {n.title}
                      </Text>
                      <HStack mt={1} gap={2} wrap="wrap">
                        {n.category ? (
                          <Badge
                            bg={INPUT_BG}
                            borderWidth="1px"
                            borderColor={BORDER}
                            color="black"
                            borderRadius="999px"
                            px={2}
                            py={0.5}
                            fontWeight="800"
                          >
                            {n.category}
                          </Badge>
                        ) : null}
                        <Text fontSize="xs" color="blackAlpha.600">
                          Updated: {fmtDate(n.updatedAt)}
                        </Text>
                      </HStack>
                    </Box>

                    <HStack gap={1}>
                      <IconButton
                        aria-label={n.pinned ? "Unpin" : "Pin"}
                        size="sm"
                        variant="ghost"
                        color="black"
                        borderRadius="12px"
                        bg={INPUT_BG}
                        borderWidth="1px"
                        borderColor={n.pinned ? ACCENT : BORDER}
                        _hover={{ bg: "blackAlpha.50" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          void togglePinned(n);
                        }}
                      >
                        <Emoji active={n.pinned}>📌</Emoji>
                      </IconButton>
                      <IconButton
                        aria-label={n.favorite ? "Unfavorite" : "Favorite"}
                        size="sm"
                        variant="ghost"
                        color="black"
                        borderRadius="12px"
                        bg={INPUT_BG}
                        borderWidth="1px"
                        borderColor={n.favorite ? ACCENT : BORDER}
                        _hover={{ bg: "blackAlpha.50" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleFavorite(n);
                        }}
                      >
                        <Emoji active={n.favorite}>⭐</Emoji>
                      </IconButton>
                    </HStack>
                  </Flex>

                  <Text
                    mt={3}
                    fontSize="sm"
                    color="blackAlpha.800"
                    lineClamp={5}
                  >
                    {n.content}
                  </Text>

                  <HStack mt={3} gap={2} wrap="wrap">
                    {(n.tags ?? []).slice(0, 6).map((t) => (
                      <Badge
                        key={t}
                        bg="blackAlpha.50"
                        color="black"
                        borderRadius="999px"
                        px={2}
                        py={0.5}
                        fontWeight="800"
                      >
                        #{t}
                      </Badge>
                    ))}
                  </HStack>

                  <Flex mt={4} justify="space-between" align="center">
                    <Text fontSize="xs" color="blackAlpha.600">
                      {Math.max(
                        0,
                        Number(n.wordCount ?? computeWordCount(n.content)),
                      ).toLocaleString()}{" "}
                      words
                    </Text>
                    <HStack gap={1}>
                      <IconButton
                        aria-label="Edit"
                        size="sm"
                        variant="ghost"
                        _hover={{ bg: "blackAlpha.100" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(n);
                        }}
                      >
                        <Icon as={FiEdit3} />
                      </IconButton>
                      <IconButton
                        aria-label="Delete"
                        size="sm"
                        variant="ghost"
                        _hover={{ bg: "blackAlpha.100" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteConfirm(n, "list");
                        }}
                      >
                        <Icon as={FiTrash2} />
                      </IconButton>
                    </HStack>
                  </Flex>
                </Box>
              ))}
            </SimpleGrid>
          ) : (
            <Stack gap={3}>
              {filteredNotes.map((n) => (
                <Box
                  key={n.id}
                  bg="white"
                  borderRadius="18px"
                  borderWidth="1px"
                  borderColor="blackAlpha.200"
                  p={4}
                  cursor="pointer"
                  _hover={{ boxShadow: "md" }}
                  onClick={() => openReader(n)}
                >
                  <Flex align="flex-start" justify="space-between" gap={3}>
                    <Box minW={0}>
                      <Text fontWeight="900" color="black" lineClamp={1}>
                        {n.title}
                      </Text>
                      <Text fontSize="xs" color="blackAlpha.600" mt={1}>
                        {n.category ? `${n.category} • ` : ""}Updated:{" "}
                        {fmtDate(n.updatedAt)} •{" "}
                        {Math.max(
                          0,
                          Number(n.wordCount ?? computeWordCount(n.content)),
                        ).toLocaleString()}{" "}
                        words
                      </Text>
                      <Text
                        mt={2}
                        fontSize="sm"
                        color="blackAlpha.800"
                        lineClamp={2}
                      >
                        {n.content}
                      </Text>
                      <HStack mt={2} gap={2} wrap="wrap">
                        {(n.tags ?? []).slice(0, 10).map((t) => (
                          <Badge
                            key={t}
                            bg="blackAlpha.50"
                            color="black"
                            borderRadius="999px"
                            px={2}
                            py={0.5}
                            fontWeight="800"
                          >
                            #{t}
                          </Badge>
                        ))}
                      </HStack>
                    </Box>

                    <HStack gap={1}>
                      <IconButton
                        aria-label={n.pinned ? "Unpin" : "Pin"}
                        size="sm"
                        variant="ghost"
                        color="black"
                        borderRadius="12px"
                        bg={INPUT_BG}
                        borderWidth="1px"
                        borderColor={n.pinned ? ACCENT : BORDER}
                        _hover={{ bg: "blackAlpha.50" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          void togglePinned(n);
                        }}
                      >
                        <Emoji active={n.pinned}>📌</Emoji>
                      </IconButton>
                      <IconButton
                        aria-label={n.favorite ? "Unfavorite" : "Favorite"}
                        size="sm"
                        variant="ghost"
                        color="black"
                        borderRadius="12px"
                        bg={INPUT_BG}
                        borderWidth="1px"
                        borderColor={n.favorite ? ACCENT : BORDER}
                        _hover={{ bg: "blackAlpha.50" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleFavorite(n);
                        }}
                      >
                        <Emoji active={n.favorite}>⭐</Emoji>
                      </IconButton>
                      <IconButton
                        aria-label="Edit"
                        size="sm"
                        variant="ghost"
                        _hover={{ bg: "blackAlpha.100" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(n);
                        }}
                      >
                        <Icon as={FiEdit3} />
                      </IconButton>
                      <IconButton
                        aria-label="Delete"
                        size="sm"
                        variant="ghost"
                        _hover={{ bg: "blackAlpha.100" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteConfirm(n, "list");
                        }}
                      >
                        <Icon as={FiTrash2} />
                      </IconButton>
                    </HStack>
                  </Flex>
                </Box>
              ))}
            </Stack>
          )}

          {/* Reader overlay */}
          {readerNote ? (
            <Box
              position="fixed"
              inset={0}
              zIndex={2500}
              bg="blackAlpha.600"
              display="flex"
              alignItems="center"
              justifyContent="center"
              p={{ base: 3, md: 6 }}
              onClick={closeReader}
            >
              <Box
                onClick={(e) => e.stopPropagation()}
                w={
                  readerFull
                    ? "calc(100vw - 24px)"
                    : { base: "calc(100vw - 24px)", md: "920px" }
                }
                h={readerFull ? "calc(100vh - 24px)" : "auto"}
                maxH="calc(100vh - 24px)"
                bg={BG}
                borderRadius="24px"
                borderWidth="1px"
                borderColor="blackAlpha.200"
                boxShadow="0 20px 70px rgba(0,0,0,0.45)"
                overflow="hidden"
                display="flex"
                flexDirection="column"
              >
                <Box
                  bg={HEADER_BG}
                  borderBottomWidth="1px"
                  borderBottomColor="blackAlpha.200"
                  p={{ base: 4, md: 5 }}
                >
                  <Flex justify="space-between" align="flex-start" gap={3}>
                    <Box minW={0}>
                      <Text
                        fontSize={{ base: "lg", md: "2xl" }}
                        fontWeight="900"
                        color="black"
                        lineClamp={2}
                      >
                        {readerNote.title}
                      </Text>
                      <HStack mt={2} gap={2} wrap="wrap">
                        {readerNote.category ? (
                          <Badge
                            bg={INPUT_BG}
                            borderWidth="1px"
                            borderColor={BORDER}
                            color="black"
                            borderRadius="999px"
                            px={2}
                            py={0.5}
                            fontWeight="900"
                          >
                            {readerNote.category}
                          </Badge>
                        ) : null}
                        <Text fontSize="xs" color="blackAlpha.700">
                          Updated: {fmtDate(readerNote.updatedAt)}
                        </Text>
                        <Text fontSize="xs" color="blackAlpha.700">
                          {Math.max(
                            0,
                            Number(
                              readerNote.wordCount ??
                                computeWordCount(readerNote.content),
                            ),
                          ).toLocaleString()}{" "}
                          words
                        </Text>
                      </HStack>
                    </Box>

                    <HStack gap={2}>
                      <IconButton
                        aria-label={readerNote.pinned ? "Unpin" : "Pin"}
                        size="sm"
                        variant="ghost"
                        color="black"
                        borderRadius="12px"
                        bg={INPUT_BG}
                        borderWidth="1px"
                        borderColor={readerNote.pinned ? ACCENT : BORDER}
                        _hover={{ bg: "blackAlpha.50" }}
                        onClick={() => void togglePinned(readerNote)}
                      >
                        <Emoji active={readerNote.pinned}>📌</Emoji>
                      </IconButton>
                      <IconButton
                        aria-label={
                          readerNote.favorite ? "Unfavorite" : "Favorite"
                        }
                        size="sm"
                        variant="ghost"
                        color="black"
                        borderRadius="12px"
                        bg={INPUT_BG}
                        borderWidth="1px"
                        borderColor={readerNote.favorite ? ACCENT : BORDER}
                        _hover={{ bg: "blackAlpha.50" }}
                        onClick={() => void toggleFavorite(readerNote)}
                      >
                        <Emoji active={readerNote.favorite}>⭐</Emoji>
                      </IconButton>

                      <IconButton
                        aria-label="Export PDF"
                        size="sm"
                        variant="ghost"
                        color="black"
                        bg="white"
                        borderWidth="1px"
                        borderColor="blackAlpha.200"
                        borderRadius="12px"
                        _hover={{ bg: "blackAlpha.50" }}
                        onClick={() => void exportReaderPdf()}
                        loading={exportingPdf}
                        disabled={exportingPdf}
                      >
                        <Icon as={FiDownload} />
                      </IconButton>

                      <IconButton
                        aria-label={
                          readerFull ? "Exit full screen" : "Full screen"
                        }
                        size="sm"
                        variant="ghost"
                        color="black"
                        bg="white"
                        borderWidth="1px"
                        borderColor="blackAlpha.200"
                        borderRadius="12px"
                        _hover={{ bg: "blackAlpha.50" }}
                        onClick={() => setReaderFull((v) => !v)}
                      >
                        <Icon as={readerFull ? FiMinimize2 : FiMaximize2} />
                      </IconButton>

                      <IconButton
                        aria-label="Edit"
                        size="sm"
                        variant="ghost"
                        color="black"
                        bg="white"
                        borderWidth="1px"
                        borderColor="blackAlpha.200"
                        borderRadius="12px"
                        _hover={{ bg: "blackAlpha.50" }}
                        onClick={() => {
                          closeReader();
                          openEdit(readerNote);
                        }}
                      >
                        <Icon as={FiEdit3} />
                      </IconButton>

                      <IconButton
                        aria-label="Delete"
                        size="sm"
                        variant="ghost"
                        color="black"
                        bg="white"
                        borderWidth="1px"
                        borderColor="blackAlpha.200"
                        borderRadius="12px"
                        _hover={{ bg: "blackAlpha.50" }}
                        onClick={() => openDeleteConfirm(readerNote, "reader")}
                      >
                        <Icon as={FiTrash2} />
                      </IconButton>

                      <IconButton
                        aria-label="Close"
                        size="sm"
                        variant="ghost"
                        color="black"
                        bg="white"
                        borderWidth="1px"
                        borderColor="blackAlpha.200"
                        borderRadius="12px"
                        _hover={{ bg: "blackAlpha.50" }}
                        onClick={closeReader}
                      >
                        <Icon as={FiX} />
                      </IconButton>
                    </HStack>
                  </Flex>
                </Box>

                <Box p={{ base: 4, md: 5 }} overflow="auto">
                  <Text
                    color="black"
                    fontSize={{ base: "sm", md: "md" }}
                    whiteSpace="pre-wrap"
                    lineHeight="1.65"
                  >
                    {readerNote.content}
                  </Text>

                  {(readerNote.tags ?? []).length ? (
                    <HStack mt={4} gap={2} wrap="wrap">
                      {(readerNote.tags ?? []).map((t) => (
                        <Badge
                          key={t}
                          bg="blackAlpha.50"
                          color="black"
                          borderRadius="999px"
                          px={2}
                          py={0.5}
                          fontWeight="900"
                        >
                          #{t}
                        </Badge>
                      ))}
                    </HStack>
                  ) : null}
                </Box>
              </Box>
            </Box>
          ) : null}

          {/* Delete confirm overlay */}
          {deleteConfirm ? (
            <Box
              position="fixed"
              inset={0}
              zIndex={2600}
              bg="blackAlpha.700"
              display="flex"
              alignItems="center"
              justifyContent="center"
              p={{ base: 4, md: 6 }}
              onClick={closeDeleteConfirm}
            >
              <Box
                onClick={(e) => e.stopPropagation()}
                w={{ base: "calc(100vw - 32px)", md: "520px" }}
                bg={BG}
                borderRadius="20px"
                borderWidth="1px"
                borderColor="blackAlpha.200"
                boxShadow="0 20px 70px rgba(0,0,0,0.45)"
                overflow="hidden"
              >
                <Box
                  bg={HEADER_BG}
                  borderBottomWidth="1px"
                  borderBottomColor="blackAlpha.200"
                  p={{ base: 4, md: 5 }}
                >
                  <Text
                    fontSize={{ base: "md", md: "lg" }}
                    fontWeight="900"
                    color="black"
                  >
                    Delete note?
                  </Text>
                  <Text
                    mt={1}
                    fontSize="sm"
                    color="blackAlpha.700"
                    lineClamp={2}
                  >
                    {deleteConfirm.note.title || "Untitled note"}
                  </Text>
                </Box>

                <Box p={{ base: 4, md: 5 }}>
                  <Text color="black" fontSize="sm" lineHeight="1.6">
                    Are you sure you want to delete this note? This action can’t
                    be undone.
                  </Text>

                  <HStack mt={5} justify="flex-end" gap={3}>
                    <Button
                      variant="ghost"
                      borderRadius="999px"
                      h="40px"
                      px={5}
                      fontWeight="900"
                      color="black"
                      _hover={{ bg: "blackAlpha.50" }}
                      onClick={closeDeleteConfirm}
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      borderRadius="999px"
                      h="40px"
                      px={6}
                      bg="#E53E3E"
                      color="white"
                      fontWeight="900"
                      _hover={{ bg: "#C53030" }}
                      onClick={() => void confirmDelete()}
                      loading={deleting}
                      disabled={deleting}
                    >
                      Delete
                    </Button>
                  </HStack>
                </Box>
              </Box>
            </Box>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );

  return toolFull ? (
    <Box
      position="fixed"
      inset={0}
      zIndex={2400}
      bg="transparent"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={0}
      onClick={closeToolFull}
    >
      <Box onClick={(e) => e.stopPropagation()}>{tool}</Box>
    </Box>
  ) : (
    tool
  );
}
