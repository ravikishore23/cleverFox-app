import {
  Box,
  Flex,
  Text,
  Spinner,
  Icon,
  Button,
  VStack,
  HStack,
  IconButton,
  Link,
  Textarea,
} from "@chakra-ui/react";
import WelcomeScreen from "./WelcomeScreen";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  FiSend,
  FiPlus,
  FiImage,
  FiSidebar,
  FiAlertCircle,
  FiRefreshCw,
  FiUser,
  FiCheck,
  FiEdit2,
  FiX,
  FiFile,
  FiFolder,
  FiTerminal,
  FiExternalLink,
  FiSearch,
  FiTrash2,
  FiSquare,
  FiDownload,
  FiPaperclip,
  FiCopy,
  FiMessageSquare,
  FiShield,
} from "react-icons/fi";
import { keyframes } from "@emotion/react";

const AI_LOGO = "/ai-logo.png";
const foxSpin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PendingAction = {
  id: string;
  tool: string;
  description: string;
  path?: string;
  content?: string;
  command?: string;
  args?: string[];
  noteTitle?: string;
  status: "pending" | "approved" | "denied" | "running" | "done" | "error";
  result?: string;
  generatedFile?: {
    name: string;
    path: string;
    mimeType: string;
    size: number;
    downloadUrl: string;
  };
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  error?: boolean;
  pendingActions?: PendingAction[];
  attachments?: { type: string; data: string; name: string }[];
  analysis?: {
    path: string;
    exists: boolean;
    items: {
      name: string;
      isDirectory: boolean;
      size?: number;
      children?: any[];
    }[];
    projectType: string | null;
    totalFiles: number;
    totalDirs: number;
    summary: string;
  };
};

type ChatHistory = {
  id: string;
  title: string;
  date: string;
  rawDate: Date;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const API_BASE =
  typeof window !== "undefined" && window.location.protocol === "file:"
    ? "http://localhost:3001"
    : "http://localhost:3001";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function groupByDate(chats: ChatHistory[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: { label: string; chats: ChatHistory[] }[] = [
    { label: "Today", chats: [] },
    { label: "Yesterday", chats: [] },
    { label: "Last 7 Days", chats: [] },
    { label: "Older", chats: [] },
  ];

  for (const chat of chats) {
    const d = chat.rawDate;
    if (d >= today) groups[0].chats.push(chat);
    else if (d >= yesterday) groups[1].chats.push(chat);
    else if (d >= weekAgo) groups[2].chats.push(chat);
    else groups[3].chats.push(chat);
  }

  return groups.filter((g) => g.chats.length > 0);
}

function formatFileSize(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || "";
  const bytes = Math.round((base64.length * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/*  CodeBlock — extracted, stable                                      */
/* ------------------------------------------------------------------ */

const CodeBlock = memo(function CodeBlock({
  code,
  lang,
}: {
  code: string;
  lang: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      position="relative"
      my={3}
      borderRadius="xl"
      overflow="hidden"
      border="1px solid"
      borderColor="whiteAlpha.100"
    >
      <Flex
        justify="space-between"
        align="center"
        px={4}
        py={2}
        bg="#1a1a1e"
        borderBottom="1px solid"
        borderColor="whiteAlpha.100"
      >
        <Text
          fontSize="xs"
          color="whiteAlpha.500"
          fontFamily="monospace"
          textTransform="lowercase"
        >
          {lang || "code"}
        </Text>
        <Box
          as="button"
          onClick={handleCopy}
          display="flex"
          alignItems="center"
          gap="6px"
          px={2}
          py={1}
          borderRadius="md"
          bg="whiteAlpha.100"
          _hover={{ bg: "whiteAlpha.200" }}
          transition="all 0.15s"
          cursor="pointer"
        >
          <Icon
            as={copied ? FiCheck : FiCopy}
            boxSize={3}
            color={copied ? "green.400" : "whiteAlpha.600"}
          />
          <Text fontSize="xs" color={copied ? "green.400" : "whiteAlpha.600"}>
            {copied ? "Copied!" : "Copy"}
          </Text>
        </Box>
      </Flex>
      <Box
        as="pre"
        bg="#111114"
        color="#e4e4e7"
        p={4}
        fontSize="sm"
        overflowX="auto"
        whiteSpace="pre-wrap"
        fontFamily="'JetBrains Mono', 'Fira Code', monospace"
        lineHeight="1.7"
      >
        {code}
      </Box>
    </Box>
  );
});

/* ------------------------------------------------------------------ */
/*  FormattedText — extracted, stable                                  */
/* ------------------------------------------------------------------ */

const FormattedText = memo(function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <Box>
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const inner = part.slice(3, -3);
          const firstNewline = inner.indexOf("\n");
          const lang =
            firstNewline > -1 ? inner.slice(0, firstNewline).trim() : "";
          const code =
            firstNewline > -1 ? inner.slice(firstNewline + 1) : inner;
          return <CodeBlock key={i} code={code} lang={lang} />;
        }

        const inlineFormatted = part
          .split(/(\*\*.*?\*\*|`[^`]+`|\[.*?\]\(.*?\)|https?:\/\/[^\s\)]+)/g)
          .map((seg, j) => {
            if (seg.startsWith("**") && seg.endsWith("**")) {
              return (
                <Text as="strong" key={j} fontWeight="bold" color="white">
                  {seg.slice(2, -2)}
                </Text>
              );
            }
            if (seg.startsWith("`") && seg.endsWith("`")) {
              return (
                <Text
                  as="span"
                  key={j}
                  bg="whiteAlpha.100"
                  px="6px"
                  py="2px"
                  borderRadius="md"
                  fontSize="sm"
                  fontFamily="'JetBrains Mono', monospace"
                  color="#c084fc"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                >
                  {seg.slice(1, -1)}
                </Text>
              );
            }
            if (
              seg.startsWith("[") &&
              seg.includes("](") &&
              seg.endsWith(")")
            ) {
              const closingBracket = seg.indexOf("]");
              const text = seg.slice(1, closingBracket);
              const url = seg.slice(closingBracket + 2, -1);
              return (
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  href={url}
                  key={j}
                  color="blue.400"
                  textDecoration="underline"
                  _hover={{ color: "blue.300" }}
                >
                  {text}
                </Link>
              );
            }
            if (seg.startsWith("http://") || seg.startsWith("https://")) {
              return (
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  href={seg}
                  key={j}
                  color="blue.400"
                  textDecoration="underline"
                  _hover={{ color: "blue.300" }}
                >
                  {seg}
                </Link>
              );
            }
            return seg.split("\n").map((line, k, arr) => (
              <span key={`${j}-${k}`}>
                {line}
                {k < arr.length - 1 && <br />}
              </span>
            ));
          });

        return <span key={i}>{inlineFormatted}</span>;
      })}
    </Box>
  );
});

/* ------------------------------------------------------------------ */
/*  MessageBubble — extracted, memoized                                */
/* ------------------------------------------------------------------ */

type MessageBubbleProps = {
  msg: Message;
  onRetry: () => void;
  onApproveAction: (
    msgId: string,
    actionId: string,
    appChoice?: "default" | "vscode" | "pycharm",
  ) => void;
  onDenyAction: (msgId: string, actionId: string) => void;
  onApproveAll: (msgId: string) => void;
  onOpenNote?: (noteTitle: string) => void;
  onOpenNotesTool?: () => void;
  onEditMessage?: (msgId: string, newText: string) => void;
  isStreaming?: boolean;
};

const MessageBubble = memo(function MessageBubble({
  msg,
  onRetry,
  onApproveAction,
  onDenyAction,
  onApproveAll,
  onOpenNote,
  onOpenNotesTool,
  onEditMessage,
  isStreaming,
}: MessageBubbleProps) {
  const isUser = msg.role === "user";
  const isError = msg.error;

  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(msg.text);
  const [copiedReply, setCopiedReply] = useState(false);

  const handleSaveEdit = () => {
    if (editVal.trim() && editVal !== msg.text) {
      onEditMessage?.(msg.id, editVal);
    }
    setIsEditing(false);
  };

  const handleCopyReply = async () => {
    if (!msg.text?.trim()) return;
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedReply(true);
      setTimeout(() => setCopiedReply(false), 2000);
    } catch {
      setCopiedReply(false);
    }
  };

  return (
    <Box w="full" py={3} px={{ base: 2, md: 0 }}>
      <Flex justify={isUser ? "flex-end" : "flex-start"} maxW="768px" mx="auto">
        <Flex
          gap={3}
          maxW={{ base: "100%", md: isUser ? "75%" : "90%" }}
          flexDirection={isUser ? "row-reverse" : "row"}
        >
          {/* Avatar */}
          <Box flexShrink={0} pt={0.5}>
            {!isUser ? (
              <Box
                w="30px"
                h="30px"
                bg={isError ? "rgba(239, 68, 68, 0.2)" : "transparent"}
                borderRadius="full"
                display="flex"
                alignItems="center"
                justifyContent="center"
                overflow="hidden"
                border={isError ? "1px solid rgba(239, 68, 68, 0.3)" : "none"}
                boxShadow={!isError ? "0 2px 8px rgba(0,0,0,0.2)" : "none"}
                animation={
                  isStreaming && !isError
                    ? `${foxSpin} 1.6s linear infinite`
                    : undefined
                }
              >
                {isError ? (
                  <Icon as={FiAlertCircle} color="red.400" boxSize={4} />
                ) : (
                  <img
                    src={AI_LOGO}
                    alt="Fox AI"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
              </Box>
            ) : (
              <Box
                w="30px"
                h="30px"
                bg="linear-gradient(135deg, #3f3f46, #52525b)"
                borderRadius="full"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Icon as={FiUser} color="whiteAlpha.800" boxSize={3.5} />
              </Box>
            )}
          </Box>

          {/* Content */}
          <Box minW={0} flex="1">
            {!isUser && (
              <Text
                fontWeight="600"
                fontSize="13px"
                color="whiteAlpha.600"
                mb={1.5}
              >
                Fox AI
              </Text>
            )}

            <Box
              bg={
                isUser
                  ? "linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(99, 102, 241, 0.1))"
                  : "transparent"
              }
              color={isError ? "#fca5a5" : "whiteAlpha.900"}
              px={isUser ? 4 : 0}
              py={isUser ? 3 : 0}
              borderRadius={isUser ? "2xl" : "none"}
              borderTopRightRadius={isUser ? "sm" : "none"}
              border={isUser ? "1px solid rgba(168, 85, 247, 0.15)" : "none"}
              fontSize="15px"
              lineHeight="1.7"
            >
              {isUser && msg.attachments && msg.attachments.length > 0 && (
                <Flex gap={2} mb={2} wrap="wrap">
                  {msg.attachments.map((att, idx) => (
                    <Box
                      key={idx}
                      borderRadius="lg"
                      overflow="hidden"
                      w="72px"
                      h="72px"
                      bg="#18181b"
                      border="1px solid"
                      borderColor="whiteAlpha.100"
                    >
                      {att.type.startsWith("image/") ? (
                        <img
                          src={att.data}
                          alt="attachment"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <Flex
                          direction="column"
                          justify="center"
                          align="center"
                          h="100%"
                        >
                          <Icon
                            as={FiFile}
                            boxSize={5}
                            color="purple.300"
                            mb={1}
                          />
                          <Text
                            fontSize="9px"
                            color="whiteAlpha.600"
                            whiteSpace="nowrap"
                            overflow="hidden"
                            textOverflow="ellipsis"
                            w="90%"
                            textAlign="center"
                          >
                            {att.name}
                          </Text>
                        </Flex>
                      )}
                    </Box>
                  ))}
                </Flex>
              )}
              {isUser ? (
                isEditing ? (
                  <Box>
                    <Textarea
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      color="whiteAlpha.900"
                      bg="blackAlpha.300"
                      borderColor="purple.400"
                      size="sm"
                      mb={2}
                      p={2}
                      borderRadius="md"
                      autoFocus
                    />
                    <Flex gap={2} justify="flex-end">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setIsEditing(false);
                          setEditVal(msg.text);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="xs"
                        colorScheme="purple"
                        onClick={handleSaveEdit}
                      >
                        Save & Send
                      </Button>
                    </Flex>
                  </Box>
                ) : (
                  <Box position="relative" role="group">
                    <Text whiteSpace="pre-wrap">{msg.text}</Text>
                    <IconButton
                      aria-label="Edit Message"
                      size="xs"
                      position="absolute"
                      bottom="-20px"
                      right="0"
                      opacity={0}
                      _groupHover={{ opacity: 1 }}
                      variant="ghost"
                      color="whiteAlpha.600"
                      _hover={{ color: "purple.300" }}
                      onClick={() => setIsEditing(true)}
                    >
                      <Icon as={FiEdit2} />
                    </IconButton>
                  </Box>
                )
              ) : (
                <FormattedText text={msg.text} />
              )}
            </Box>

            {!isUser && !isError && (
              <Button
                size="xs"
                mt={2}
                variant="ghost"
                color={copiedReply ? "green.400" : "whiteAlpha.600"}
                _hover={{ bg: "whiteAlpha.100", color: "whiteAlpha.900" }}
                borderRadius="lg"
                onClick={handleCopyReply}
              >
                <Icon
                  as={copiedReply ? FiCheck : FiCopy}
                  boxSize={3}
                  mr={1.5}
                />
                {copiedReply ? "Copied" : "Copy text"}
              </Button>
            )}

            {isError && (
              <Button
                size="xs"
                mt={2}
                variant="outline"
                borderColor="red.500/30"
                color="red.400"
                _hover={{ bg: "red.500/10" }}
                borderRadius="lg"
                onClick={onRetry}
              >
                <Icon as={FiRefreshCw} mr={2} boxSize={3} /> Retry
              </Button>
            )}

            {/* Folder Analysis Card */}
            {!isUser && msg.analysis && (
              <Box
                mt={3}
                bg="rgba(26, 26, 46, 0.6)"
                border="1px solid"
                borderColor="rgba(168, 85, 247, 0.2)"
                borderRadius="xl"
                p={3}
                overflow="hidden"
              >
                <Flex align="center" gap={2} mb={2}>
                  <Icon as={FiFolder} color="purple.300" boxSize={4} />
                  <Text fontSize="sm" fontWeight="bold" color="purple.300">
                    Workspace Analysis
                  </Text>
                  {msg.analysis.projectType && (
                    <Text
                      fontSize="10px"
                      bg="rgba(168, 85, 247, 0.2)"
                      color="purple.200"
                      px={2}
                      py={0.5}
                      borderRadius="full"
                      fontWeight="600"
                    >
                      {msg.analysis.projectType}
                    </Text>
                  )}
                </Flex>
                <Text
                  fontSize="xs"
                  color="whiteAlpha.600"
                  mb={msg.analysis.items?.length > 0 ? 2 : 0}
                >
                  {msg.analysis.summary}
                </Text>
                {msg.analysis.items && msg.analysis.items.length > 0 && (
                  <Box
                    maxH="120px"
                    overflowY="auto"
                    fontSize="xs"
                    fontFamily="'JetBrains Mono', monospace"
                    color="whiteAlpha.500"
                    bg="blackAlpha.300"
                    borderRadius="lg"
                    p={2}
                  >
                    {msg.analysis.items
                      .slice(0, 15)
                      .map((item: any, i: number) => (
                        <Text key={i} py={0.5}>
                          {item.isDirectory ? "📁" : "📄"} {item.name}
                        </Text>
                      ))}
                    {msg.analysis.items.length > 15 && (
                      <Text color="whiteAlpha.300" pt={1} fontStyle="italic">
                        …and {msg.analysis.items.length - 15} more items
                      </Text>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {/* Inline Agent Action Cards */}
            {!isUser && msg.pendingActions && msg.pendingActions.length > 0 && (
              <Box
                mt={5}
                bg="whiteAlpha.50"
                border="1px solid"
                borderColor="whiteAlpha.100"
                borderRadius="2xl"
                overflow="hidden"
                boxShadow="0 4px 20px rgba(0, 0, 0, 0.15)"
              >
                <Flex
                  align="center"
                  bg="rgba(168, 85, 247, 0.05)"
                  px={4}
                  py={3}
                  borderBottom="1px solid"
                  borderColor="whiteAlpha.100"
                >
                  <Icon as={FiShield} color="purple.400" boxSize={4} mr={2} />
                  <Text
                    fontSize="xs"
                    fontWeight="700"
                    color="purple.300"
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    Agent Permissions Required
                  </Text>
                </Flex>
                <VStack align="stretch" gap={0}>
                  {msg.pendingActions.map((action, idx) => {
                    const isCodePath =
                      action.tool === "open_app" &&
                      !!action.path &&
                      /\.(py|js|ts|tsx|jsx|java|cpp|c|cs|go|rs|php|rb|swift|kt|dart|lua|r|scala|html|css|sql|sh|ps1)$/i.test(
                        action.path,
                      );
                    const toolIcon =
                      {
                        write_file: FiFile,
                        read_file: FiFile,
                        list_directory: FiFolder,
                        create_directory: FiFolder,
                        open_app: FiExternalLink,
                        run_command: FiTerminal,
                        browser_search: FiSearch,
                        generate_file: FiDownload,
                      }[action.tool] || FiFile;

                    const statusColors = {
                      pending: {
                        iconColor: "purple.300",
                        badgeBg: "purple.500/20",
                      },
                      approved: {
                        iconColor: "green.300",
                        badgeBg: "green.500/20",
                      },
                      denied: { iconColor: "red.300", badgeBg: "red.500/20" },
                      running: {
                        iconColor: "blue.300",
                        badgeBg: "blue.500/20",
                      },
                      done: { iconColor: "green.300", badgeBg: "green.500/20" },
                      error: { iconColor: "red.400", badgeBg: "red.500/20" },
                    };

                    const style = statusColors[action.status];

                    return (
                      <Box
                        key={action.id}
                        p={4}
                        bg="transparent"
                        borderBottom={
                          idx < msg.pendingActions!.length - 1
                            ? "1px solid"
                            : "none"
                        }
                        borderColor="whiteAlpha.100"
                        transition="background 0.2s"
                        _hover={{ bg: "whiteAlpha.50" }}
                      >
                        <Flex
                          align="flex-start"
                          justify="space-between"
                          gap={4}
                        >
                          <Flex align="flex-start" gap={3} flex="1" minW={0}>
                            <Box
                              mt={0.5}
                              p={2}
                              bg={style.badgeBg}
                              borderRadius="lg"
                            >
                              <Icon
                                as={toolIcon}
                                color={style.iconColor}
                                boxSize={4}
                              />
                            </Box>
                            <Box minW={0}>
                              <Text
                                fontSize="sm"
                                fontWeight="600"
                                color="whiteAlpha.900"
                                mb={1}
                              >
                                {action.tool
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (c) => c.toUpperCase())}
                              </Text>
                              <Text
                                fontSize="xs"
                                color="whiteAlpha.600"
                                lineHeight="tall"
                                overflow="hidden"
                                css={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                }}
                              >
                                {action.description}
                              </Text>

                              {action.content && (
                                <Box
                                  mt={2}
                                  p={2}
                                  bg="blackAlpha.400"
                                  border="1px solid"
                                  borderColor="whiteAlpha.100"
                                  borderRadius="md"
                                  fontSize="11px"
                                  fontFamily="monospace"
                                  whiteSpace="pre-wrap"
                                  maxH="120px"
                                  overflowY="auto"
                                  color="whiteAlpha.800"
                                >
                                  {action.content}
                                </Box>
                              )}
                            </Box>
                          </Flex>

                          {action.status === "pending" && (
                            <VStack align="end" gap={1} flexShrink={0} mt={1}>
                              {isCodePath ? (
                                <>
                                  <Text fontSize="10px" color="whiteAlpha.500">
                                    Choose app before execute
                                  </Text>
                                  <HStack gap={1}>
                                    <Button
                                      size="xs"
                                      variant="ghost"
                                      color="green.300"
                                      _hover={{ bg: "green.500/10" }}
                                      borderRadius="lg"
                                      px={2}
                                      onClick={() =>
                                        onApproveAction(
                                          msg.id,
                                          action.id,
                                          "vscode",
                                        )
                                      }
                                    >
                                      VS Code
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="ghost"
                                      color="purple.300"
                                      _hover={{ bg: "purple.500/10" }}
                                      borderRadius="lg"
                                      px={2}
                                      onClick={() =>
                                        onApproveAction(
                                          msg.id,
                                          action.id,
                                          "pycharm",
                                        )
                                      }
                                    >
                                      PyCharm
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="ghost"
                                      color="blue.300"
                                      _hover={{ bg: "blue.500/10" }}
                                      borderRadius="lg"
                                      px={2}
                                      onClick={() =>
                                        onApproveAction(
                                          msg.id,
                                          action.id,
                                          "default",
                                        )
                                      }
                                    >
                                      Default
                                    </Button>
                                  </HStack>
                                </>
                              ) : (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  color="green.400"
                                  _hover={{ bg: "green.500/10" }}
                                  borderRadius="lg"
                                  px={2}
                                  onClick={() =>
                                    onApproveAction(msg.id, action.id)
                                  }
                                >
                                  <Icon as={FiCheck} boxSize={3} mr={1} /> Allow
                                </Button>
                              )}

                              <Button
                                size="xs"
                                variant="ghost"
                                color="red.400"
                                _hover={{ bg: "red.500/10" }}
                                borderRadius="lg"
                                px={2}
                                onClick={() => onDenyAction(msg.id, action.id)}
                              >
                                <Icon as={FiX} boxSize={3} mr={1} /> Deny
                              </Button>
                            </VStack>
                          )}
                          {action.status === "running" && (
                            <Spinner size="sm" color="blue.400" mt={2} />
                          )}
                          {action.status === "done" && (
                            <Flex
                              align="center"
                              mt={2}
                              px={2}
                              py={1}
                              bg="green.500/10"
                              borderRadius="md"
                            >
                              <Text
                                fontSize="xs"
                                color="green.400"
                                fontWeight="bold"
                              >
                                ✅ Done
                              </Text>
                            </Flex>
                          )}
                          {action.status === "denied" && (
                            <Flex
                              align="center"
                              mt={2}
                              px={2}
                              py={1}
                              bg="red.500/10"
                              borderRadius="md"
                            >
                              <Text
                                fontSize="xs"
                                color="red.400"
                                fontWeight="bold"
                              >
                                🚫 Denied
                              </Text>
                            </Flex>
                          )}
                          {action.status === "error" && (
                            <Flex
                              align="center"
                              mt={2}
                              px={2}
                              py={1}
                              bg="red.500/10"
                              borderRadius="md"
                            >
                              <Text
                                fontSize="xs"
                                color="red.400"
                                fontWeight="bold"
                              >
                                ❌ Error
                              </Text>
                            </Flex>
                          )}
                        </Flex>

                        {action.result && (
                          <Box
                            mt={3}
                            p={3}
                            bg="blackAlpha.500"
                            borderRadius="xl"
                            border="1px solid"
                            borderColor="whiteAlpha.100"
                            fontSize="xs"
                            fontFamily="monospace"
                            color="whiteAlpha.800"
                            maxH="200px"
                            overflowY="auto"
                            whiteSpace="pre-wrap"
                          >
                            {action.result}
                          </Box>
                        )}

                        {action.generatedFile && (
                          <Box
                            mt={3}
                            pt={3}
                            borderTop="1px solid"
                            borderColor="whiteAlpha.100"
                          >
                            <Text
                              fontSize="xs"
                              color="whiteAlpha.700"
                              mb={2}
                              wordBreak="break-all"
                            >
                              {action.generatedFile.name}
                            </Text>
                            <Link
                              href={action.generatedFile.downloadUrl}
                              download={action.generatedFile.name}
                              _hover={{ textDecoration: "none" }}
                            >
                              <Button
                                size="sm"
                                bg="blue.600"
                                color="white"
                                _hover={{ bg: "blue.500" }}
                                borderRadius="lg"
                                px={3}
                              >
                                <HStack gap={1.5}>
                                  <Icon as={FiDownload} boxSize={3.5} />
                                  <Text>Download File</Text>
                                </HStack>
                              </Button>
                            </Link>
                          </Box>
                        )}

                        {action.tool === "create_note" &&
                          action.status === "done" &&
                          (() => {
                            const parsedTitle =
                              action.result
                                ?.match(
                                  /✅\s*Note\s*was\s*saved:\s*(.+)$/m,
                                )?.[1]
                                ?.trim() || "";
                            const noteTitleToOpen =
                              action.noteTitle?.trim() || parsedTitle;

                            return (
                              <Box mt={2}>
                                <HStack gap={2} wrap="wrap">
                                  {noteTitleToOpen ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      borderColor="blue.500/40"
                                      color="blue.300"
                                      _hover={{ bg: "blue.500/10" }}
                                      borderRadius="lg"
                                      onClick={() =>
                                        onOpenNote?.(noteTitleToOpen)
                                      }
                                    >
                                      Open Note
                                    </Button>
                                  ) : null}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    borderColor="purple.500/40"
                                    color="purple.300"
                                    _hover={{ bg: "purple.500/10" }}
                                    borderRadius="lg"
                                    onClick={() => onOpenNotesTool?.()}
                                  >
                                    Open in Notes Tool
                                  </Button>
                                </HStack>
                              </Box>
                            );
                          })()}
                      </Box>
                    );
                  })}

                  {msg.pendingActions.some((a) => a.status === "pending") && (
                    <Box
                      pt={3}
                      pb={4}
                      px={4}
                      bg="blackAlpha.200"
                      borderTop="1px solid"
                      borderColor="whiteAlpha.100"
                    >
                      <HStack gap={3}>
                        <Button
                          size="sm"
                          bg="green.500"
                          color="white"
                          _hover={{ bg: "green.400" }}
                          borderRadius="lg"
                          flex="1"
                          onClick={() => onApproveAll(msg.id)}
                        >
                          <Icon as={FiCheck} mr={1.5} /> Allow All
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          borderColor="red.500/50"
                          color="red.400"
                          _hover={{ bg: "red.500/10" }}
                          borderRadius="lg"
                          flex="1"
                          onClick={() => {
                            msg.pendingActions?.forEach((a) => {
                              if (a.status === "pending")
                                onDenyAction(msg.id, a.id);
                            });
                          }}
                        >
                          <Icon as={FiX} mr={1.5} /> Deny All
                        </Button>
                      </HStack>
                    </Box>
                  )}
                </VStack>
              </Box>
            )}
          </Box>
        </Flex>
      </Flex>
    </Box>
  );
});

/* ------------------------------------------------------------------ */
/*  TypingIndicator — extracted, stable                                */
/* ------------------------------------------------------------------ */

const TypingIndicator = memo(function TypingIndicator() {
  return (
    <Box w="full" py={3} px={{ base: 2, md: 0 }}>
      <Flex maxW="768px" mx="auto" gap={3}>
        <Box flexShrink={0} pt={0.5}>
          <Box
            w="30px"
            h="30px"
            borderRadius="full"
            overflow="hidden"
            boxShadow="0 2px 8px rgba(0,0,0,0.2)"
            animation={`${foxSpin} 1.6s linear infinite`}
          >
            <img
              src={AI_LOGO}
              alt="Fox AI"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Box>
        </Box>
        <Flex direction="column" gap={1}>
          <Text fontWeight="600" fontSize="13px" color="whiteAlpha.600" mb={1}>
            Fox AI
          </Text>
        </Flex>
      </Flex>
    </Box>
  );
});

/* ------------------------------------------------------------------ */
/*  ChatInputBar — extracted, stable                                   */
/* ------------------------------------------------------------------ */

type ChatInputBarProps = {
  input: string;
  setInput: (val: string) => void;
  attachments: { type: string; data: string; name: string }[];
  setAttachments: React.Dispatch<
    React.SetStateAction<{ type: string; data: string; name: string }[]>
  >;
  isTyping: boolean;
  onSend: (text?: string) => void;
  onStop: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  webSearchEnabled?: boolean;
  setWebSearchEnabled?: (val: boolean) => void;
  agentMode?: boolean;
  setAgentMode?: (val: boolean) => void;
};

const ChatInputBar = memo(function ChatInputBar({
  input,
  setInput,
  attachments,
  setAttachments,
  isTyping,
  onSend,
  onStop,
  fileInputRef,
  imageInputRef,
  handleFileUpload,
  placeholder = "Message Fox AI…",
  webSearchEnabled = false,
  setWebSearchEnabled = () => {},
  agentMode = false,
  setAgentMode = () => {},
}: ChatInputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  return (
    <Box
      w="full"
      maxW="768px"
      bg="rgba(39, 39, 42, 0.9)"
      backdropFilter="blur(20px)"
      borderRadius="2xl"
      border="1px solid"
      borderColor="whiteAlpha.100"
      boxShadow="0 8px 32px rgba(0,0,0,0.4)"
      p={3}
      transition="border-color 0.2s"
      _focusWithin={{ borderColor: "rgba(168, 85, 247, 0.4)" }}
    >
      {/* Attachment Chips */}
      {attachments.length > 0 && (
        <Flex gap={2} wrap="wrap" mb={2}>
          {attachments.map((att, idx) => (
            <Flex
              key={idx}
              align="center"
              gap={2}
              px={3}
              py={2}
              bg="whiteAlpha.100"
              borderRadius="xl"
              border="1px solid"
              borderColor="whiteAlpha.100"
            >
              {att.type.startsWith("image/") ? (
                <Box
                  w="32px"
                  h="32px"
                  borderRadius="md"
                  overflow="hidden"
                  flexShrink={0}
                >
                  <img
                    src={att.data}
                    alt="preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </Box>
              ) : (
                <Flex
                  w="32px"
                  h="32px"
                  bg="purple.500/20"
                  borderRadius="md"
                  align="center"
                  justify="center"
                  flexShrink={0}
                >
                  <Icon as={FiFile} color="purple.300" boxSize={4} />
                </Flex>
              )}
              <Box minW={0}>
                <Text
                  fontSize="xs"
                  color="whiteAlpha.900"
                  fontWeight="500"
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  maxW="120px"
                >
                  {att.name}
                </Text>
                <Text fontSize="10px" color="whiteAlpha.400">
                  {formatFileSize(att.data)}
                </Text>
              </Box>
              <Box
                as="button"
                onClick={() =>
                  setAttachments((prev: any[]) =>
                    prev.filter((_: any, i: number) => i !== idx),
                  )
                }
                p={1}
                borderRadius="full"
                _hover={{ bg: "whiteAlpha.200" }}
                cursor="pointer"
                flexShrink={0}
              >
                <Icon as={FiX} color="whiteAlpha.500" boxSize={3} />
              </Box>
            </Flex>
          ))}
        </Flex>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={placeholder}
        rows={1}
        disabled={isTyping}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          outline: "none",
          color: "white",
          resize: "none",
          minHeight: "40px",
          maxHeight: "200px",
          fontSize: "15px",
          fontFamily: "inherit",
          lineHeight: "1.6",
          padding: 0,
          marginBottom: "8px",
          overflow: "hidden",
        }}
      />

      {/* Bottom toolbar */}
      <Flex justify="space-between" align="center">
        <HStack gap={0.5}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.txt,.csv,.json,.md"
            multiple
            style={{ display: "none" }}
          />
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            multiple
            style={{ display: "none" }}
          />
          <Box
            as="button"
            onClick={() => fileInputRef.current?.click()}
            display="flex"
            alignItems="center"
            px={2.5}
            py={1.5}
            borderRadius="lg"
            _hover={{ bg: "whiteAlpha.100" }}
            cursor="pointer"
          >
            <Icon as={FiPaperclip} color="whiteAlpha.400" boxSize={4} />
          </Box>
          <Box
            as="button"
            onClick={() => imageInputRef.current?.click()}
            display="flex"
            alignItems="center"
            px={2.5}
            py={1.5}
            borderRadius="lg"
            _hover={{ bg: "whiteAlpha.100" }}
            cursor="pointer"
          >
            <Icon as={FiImage} color="whiteAlpha.400" boxSize={4} />
          </Box>
          <Box
            as="button"
            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
            display="flex"
            alignItems="center"
            gap={1.5}
            px={2.5}
            py={1}
            borderRadius="md"
            bg={webSearchEnabled ? "rgba(59, 130, 246, 0.15)" : "transparent"}
            color={webSearchEnabled ? "blue.300" : "gray.500"}
            _hover={{
              bg: webSearchEnabled
                ? "rgba(59, 130, 246, 0.25)"
                : "whiteAlpha.100",
              color: webSearchEnabled ? "blue.200" : "gray.400",
            }}
            transition="all 0.2s"
            fontSize="xs"
            fontWeight="500"
          >
            <Icon as={FiSearch} boxSize={3.5} />
            <Text>{webSearchEnabled ? "Web Search On" : "Search"}</Text>
          </Box>
          <Box
            as="button"
            onClick={() => setAgentMode(!agentMode)}
            display="flex"
            alignItems="center"
            gap={1.5}
            px={2.5}
            py={1}
            borderRadius="md"
            bg={
              agentMode
                ? "linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(99, 102, 241, 0.15))"
                : "transparent"
            }
            color={agentMode ? "purple.300" : "gray.500"}
            _hover={{
              bg: agentMode ? "rgba(168, 85, 247, 0.25)" : "whiteAlpha.100",
              color: agentMode ? "purple.200" : "gray.400",
            }}
            transition="all 0.2s"
            fontSize="xs"
            fontWeight="500"
          >
            <Icon as={FiTerminal} boxSize={3.5} />
            <Text>{agentMode ? "Agent Mode On" : "Agent Mode"}</Text>
          </Box>
        </HStack>

        {isTyping ? (
          <Box
            as="button"
            onClick={onStop}
            display="flex"
            alignItems="center"
            gap="6px"
            px={3}
            py={1.5}
            bg="rgba(239, 68, 68, 0.15)"
            border="1px solid"
            borderColor="rgba(239, 68, 68, 0.3)"
            borderRadius="xl"
            _hover={{ bg: "rgba(239, 68, 68, 0.25)" }}
            cursor="pointer"
          >
            <Icon as={FiSquare} color="red.400" boxSize={3} />
            <Text fontSize="xs" color="red.400" fontWeight="600">
              Stop
            </Text>
          </Box>
        ) : (
          <Box
            as="button"
            onClick={() => onSend()}
            p={2}
            bg={
              input.trim() || attachments.length > 0
                ? "white"
                : "whiteAlpha.100"
            }
            borderRadius="xl"
            cursor={
              input.trim() || attachments.length > 0 ? "pointer" : "default"
            }
            transition="all 0.15s"
            _hover={
              input.trim() || attachments.length > 0 ? { opacity: 0.9 } : {}
            }
          >
            <Icon
              as={FiSend}
              color={
                input.trim() || attachments.length > 0 ? "black" : "gray.600"
              }
              boxSize={4}
            />
          </Box>
        )}
      </Flex>
    </Box>
  );
});

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

type FoxAiToolProps = {
  onOpenNotesTool?: () => void;
};

export default function FoxAiTool({ onOpenNotesTool }: FoxAiToolProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agentMode, setAgentMode] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [attachments, setAttachments] = useState<
    { type: string; data: string; name: string }[]
  >([]);

  const endRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [conversations, setConversations] = useState<ChatHistory[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const groupedChats = useMemo(
    () => groupByDate(conversations),
    [conversations],
  );

  /* ---- Fetch chats ---- */
  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/ai/chats`);
      const data = await res.json();
      if (data.ok) {
        setConversations(
          data.chats.map((c: any) => ({
            id: c._id,
            title: c.title,
            date: new Date(c.updatedAt).toLocaleDateString(),
            rawDate: new Date(c.updatedAt),
          })),
        );
      }
    } catch (err) {
      console.error("Failed to fetch chats", err);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const loadChat = useCallback(async (chatId: string) => {
    try {
      setActiveChatId(chatId);
      const res = await fetch(`${API_BASE}/ai/chats/${chatId}`);
      const data = await res.json();
      if (data.ok && data.chat) {
        setMessages(
          data.chat.messages.map((m: any) => ({
            id: m._id || Date.now().toString() + Math.random(),
            role: m.role,
            text: m.content,
          })),
        );
      }
    } catch (err) {
      console.error("Failed to load chat", err);
    }
  }, []);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setInput("");
    setActiveChatId(null);
  }, []);

  const handleDeleteChat = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      try {
        const res = await fetch(`${API_BASE}/ai/chats/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          if (activeChatId === id) handleNewChat();
          fetchChats();
        }
      } catch (err) {
        console.error("Failed to delete chat", err);
      }
    },
    [activeChatId, fetchChats, handleNewChat],
  );

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsTyping(false);
  }, []);

  /* ---- Scroll ---- */
  const scrollToBottom = useCallback(() => {
    if (!autoScrollRef.current) return;
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    autoScrollRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  }, []);

  const handleApproveAction = useCallback(
    async (
      msgId: string,
      actionId: string,
      appChoice: "default" | "vscode" | "pycharm" = "default",
    ) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                pendingActions: m.pendingActions?.map((a) =>
                  a.id === actionId ? { ...a, status: "running" as const } : a,
                ),
              }
            : m,
        ),
      );
      try {
        const msg = messages.find((m) => m.id === msgId);
        const action = msg?.pendingActions?.find((a) => a.id === actionId);
        if (!action) return;

        let actionToExecute: any = action;
        if (action.tool === "open_app" && action.path) {
          if (appChoice === "vscode") {
            actionToExecute = {
              ...action,
              tool: "run_command",
              command: "code",
              args: [action.path],
              description: `Open in VS Code: ${action.path}`,
            };
          } else if (appChoice === "pycharm") {
            actionToExecute = {
              ...action,
              tool: "run_command",
              command: "pycharm64",
              args: [action.path],
              description: `Open in PyCharm: ${action.path}`,
            };
          }
        }

        const res = await fetch(`${API_BASE}/ai/agent-execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actions: [actionToExecute] }),
        });
        const data = await res.json();
        const result = data.results?.[0];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  pendingActions: m.pendingActions?.map((a) =>
                    a.id === actionId
                      ? {
                          ...a,
                          status: result?.success
                            ? ("done" as const)
                            : ("error" as const),
                          result: result?.result || "Unknown result",
                          generatedFile: result?.generatedFile
                            ? {
                                ...result.generatedFile,
                                downloadUrl: `${API_BASE}/ai/download-file?path=${encodeURIComponent(result.generatedFile.path)}`,
                              }
                            : undefined,
                        }
                      : a,
                  ),
                }
              : m,
          ),
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  pendingActions: m.pendingActions?.map((a) =>
                    a.id === actionId
                      ? { ...a, status: "error" as const, result: String(err) }
                      : a,
                  ),
                }
              : m,
          ),
        );
      }
    },
    [messages],
  );

  const handleDenyAction = useCallback((msgId: string, actionId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              pendingActions: m.pendingActions?.map((a) =>
                a.id === actionId ? { ...a, status: "denied" as const } : a,
              ),
            }
          : m,
      ),
    );
  }, []);

  const handleApproveAll = useCallback(
    async (msgId: string) => {
      const msg = messages.find((m) => m.id === msgId);
      const pendingOnes =
        msg?.pendingActions?.filter((a) => a.status === "pending") || [];
      if (pendingOnes.length === 0) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                pendingActions: m.pendingActions?.map((a) =>
                  a.status === "pending"
                    ? { ...a, status: "running" as const }
                    : a,
                ),
              }
            : m,
        ),
      );
      try {
        const res = await fetch(`${API_BASE}/ai/agent-execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actions: pendingOnes }),
        });
        const data = await res.json();
        const results: any[] = data.results || [];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  pendingActions: m.pendingActions?.map((a) => {
                    const r = results.find((rr: any) => rr.id === a.id);
                    if (r) {
                      return {
                        ...a,
                        status: r.success
                          ? ("done" as const)
                          : ("error" as const),
                        result: r.result,
                        generatedFile: r.generatedFile
                          ? {
                              ...r.generatedFile,
                              downloadUrl: `${API_BASE}/ai/download-file?path=${encodeURIComponent(r.generatedFile.path)}`,
                            }
                          : undefined,
                      };
                    }
                    return a;
                  }),
                }
              : m,
          ),
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  pendingActions: m.pendingActions?.map((a) =>
                    a.status === "running"
                      ? { ...a, status: "error" as const, result: String(err) }
                      : a,
                  ),
                }
              : m,
          ),
        );
      }
    },
    [messages],
  );

  const handleOpenNote = useCallback(async (noteTitle: string) => {
    try {
      setIsTyping(true);
      const res = await fetch(`${API_BASE}/ai/agent-execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actions: [
            {
              id: `open-note-${Date.now()}`,
              tool: "read_note",
              description: `Open note: ${noteTitle}`,
              noteQuery: noteTitle,
            },
          ],
        }),
      });
      const data = await res.json();
      const first = data?.results?.[0];
      const text = first?.success
        ? String(first.result || "Opened note.")
        : String(first?.result || "Failed to open note.");

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text,
          error: !first?.success,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: String(err),
          error: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, []);

  /* ---- Send message ---- */
  const handleSend = useCallback(
    async (textOverride?: string) => {
      const textToSend = (textOverride || input).trim();
      const hasAttachments = attachments.length > 0;
      if ((!textToSend && !hasAttachments) || isTyping) return;

      autoScrollRef.current = true;

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        text: textToSend,
        attachments: hasAttachments ? [...attachments] : undefined,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput("");
      setAttachments([]);
      setIsTyping(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const apiMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.text,
          attachments: m.attachments,
        }));

        const endpoint = agentMode ? "/ai/agent-chat" : "/ai/chat?stream=true";

        const res = await fetch(`${API_BASE}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            chatId: activeChatId,
            webSearchEnabled,
            model: "deepseek",
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          throw new Error(
            `Server error ${res.status}: ${errBody || res.statusText}`,
          );
        }

        if (endpoint.includes("stream=true") && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder("utf-8");
          const aiMsgId = (Date.now() + 1).toString();

          let doneReading = false;
          let newlyCreatedChatId: string | null = null;
          let buffer = "";
          let accumulatedText = "";

          while (!doneReading) {
            const { done, value } = await reader.read();
            if (done) {
              doneReading = true;
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine.startsWith("data: ")) continue;
              let data = null;
              try {
                const dataStr = trimmedLine.slice(6).trim();
                if (!dataStr) continue;
                data = JSON.parse(dataStr);
              } catch {
                continue;
              }

              if (data.chunk) {
                accumulatedText += data.chunk;
                const snapText = accumulatedText;
                setMessages((prev) => {
                  const hasMsg = prev.some((m) => m.id === aiMsgId);
                  if (!hasMsg) {
                    return [
                      ...prev,
                      {
                        id: aiMsgId,
                        role: "assistant" as const,
                        text: snapText,
                      },
                    ];
                  }
                  return prev.map((m) =>
                    m.id === aiMsgId ? { ...m, text: snapText } : m,
                  );
                });
              }
              if (data.done && data.chatId) {
                newlyCreatedChatId = data.chatId;
              }
              if (data.error) {
                throw new Error(data.error);
              }
            }
          }
          if (newlyCreatedChatId && !activeChatId) {
            setActiveChatId(newlyCreatedChatId);
            fetchChats();
          }
        } else {
          const data = await res.json();
          if (!data.ok) throw new Error(data.error || "Unknown API error");

          const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            text: data.output,
            analysis: data.analysis || undefined,
            pendingActions:
              data.actions && data.actions.length > 0
                ? data.actions.map((a: any) => ({
                    ...a,
                    status: "pending" as const,
                  }))
                : undefined,
          };
          setMessages((prev) => [...prev, aiMsg]);
          if (data.chatId && !activeChatId) {
            setActiveChatId(data.chatId);
            fetchChats();
          }
        }
      } catch (err: unknown) {
        const e = err as Error & { name?: string };
        if (e.name === "AbortError") {
          setIsTyping(false);
          return;
        }
        const errorText = e.message?.includes("Failed to fetch")
          ? "Cannot reach the AI server."
          : e.message || "Something went wrong.";
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: errorText,
          error: true,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } finally {
        setIsTyping(false);
        abortControllerRef.current = null;
      }
    },
    [input, attachments, messages, isTyping, activeChatId, fetchChats],
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        Array.from(e.target.files).forEach((file) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setAttachments((prev) => [
                ...prev,
                {
                  type: file.type || "application/octet-stream",
                  name: file.name,
                  data: event.target!.result as string,
                },
              ]);
            }
          };
          reader.readAsDataURL(file);
        });
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (imageInputRef.current) imageInputRef.current.value = "";
    },
    [],
  );

  const handleEditMessage = useCallback(
    (msgId: string, newText: string) => {
      const targetIdx = messages.findIndex((m) => m.id === msgId);
      if (targetIdx === -1) return;

      // We trim the array right before the modified user message, then resend it.
      const priorMessages = messages.slice(0, targetIdx);
      setMessages(priorMessages);

      // Let the standard handleSend logic take over with the new text.
      setTimeout(() => handleSend(newText), 100);
    },
    [messages, handleSend],
  );

  const handleRetry = useCallback(() => {
    const reversed = [...messages].reverse();
    const lastUserIdx = reversed.findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const actualIdx = messages.length - 1 - lastUserIdx;
    const lastUserText = messages[actualIdx].text;
    setMessages(messages.slice(0, actualIdx));
    setTimeout(() => handleSend(lastUserText), 100);
  }, [messages, handleSend]);

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <Flex h="100%" bg="#18181b" position="relative" overflow="hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <Box
          display={{ base: "block", md: "none" }}
          position="absolute"
          inset={0}
          bg="blackAlpha.700"
          zIndex={15}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ---- Sidebar ---- */}
      <Box
        w={{ base: "280px", md: sidebarOpen ? "260px" : "0px" }}
        bg="#141416"
        display="flex"
        flexDirection="column"
        borderRight="1px solid"
        borderColor="whiteAlpha.50"
        h="100%"
        position={{ base: "absolute", md: "relative" }}
        left={0}
        top={0}
        zIndex={{ base: 20, md: "auto" }}
        overflow="hidden"
        transform={sidebarOpen ? "translateX(0)" : "translateX(-100%)"}
        opacity={sidebarOpen ? 1 : 0}
        transition="transform 0.25s ease, opacity 0.25s ease"
        pointerEvents={sidebarOpen ? "auto" : "none"}
      >
        {/* Sidebar Header with toggle */}
        <Flex align="center" justify="space-between" px={4} pt={4} pb={2}>
          <Text color="whiteAlpha.700" fontWeight="600" fontSize="sm">
            Chats
          </Text>
          <IconButton
            aria-label="Close sidebar"
            variant="ghost"
            size="xs"
            color="whiteAlpha.400"
            _hover={{ color: "white", bg: "whiteAlpha.100" }}
            onClick={() => setSidebarOpen(false)}
          >
            <Icon as={FiSidebar} boxSize={4} />
          </IconButton>
        </Flex>

        {/* New Chat Button */}
        <Box px={3} pb={3}>
          <Button
            w="full"
            bg="whiteAlpha.100"
            color="whiteAlpha.800"
            _hover={{ bg: "whiteAlpha.200" }}
            _active={{ transform: "translateY(0)" }}
            fontWeight="500"
            size="sm"
            borderRadius="xl"
            border="1px solid"
            borderColor="whiteAlpha.100"
            onClick={handleNewChat}
          >
            <Icon as={FiPlus} mr={2} boxSize={3.5} /> New Chat
          </Button>
        </Box>

        {/* Chat List */}
        <VStack
          align="stretch"
          gap={0}
          flex="1"
          overflowY="auto"
          px={2}
          css={{
            "&::-webkit-scrollbar": { width: "4px" },
            "&::-webkit-scrollbar-thumb": {
              background: "rgba(255,255,255,0.08)",
              borderRadius: "4px",
            },
          }}
        >
          {groupedChats.length > 0 ? (
            groupedChats.map((group) => (
              <Box key={group.label} mb={2}>
                <Text
                  fontSize="11px"
                  fontWeight="600"
                  color="whiteAlpha.300"
                  px={2}
                  py={1.5}
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  {group.label}
                </Text>
                {group.chats.map((item) => (
                  <Flex
                    key={item.id}
                    align="center"
                    justify="space-between"
                    w="full"
                    px={3}
                    py={2}
                    borderRadius="lg"
                    bg={
                      activeChatId === item.id
                        ? "whiteAlpha.100"
                        : "transparent"
                    }
                    _hover={{
                      bg:
                        activeChatId === item.id
                          ? "whiteAlpha.150"
                          : "whiteAlpha.50",
                      "& .delete-btn": { opacity: 1 },
                    }}
                    transition="all 0.15s"
                    cursor="pointer"
                    onClick={() => loadChat(item.id)}
                    role="group"
                  >
                    <HStack gap={2} minW={0} flex={1}>
                      <Icon
                        as={FiMessageSquare}
                        color="whiteAlpha.300"
                        boxSize={3.5}
                        flexShrink={0}
                      />
                      <Text
                        color="whiteAlpha.800"
                        fontSize="13px"
                        whiteSpace="nowrap"
                        overflow="hidden"
                        textOverflow="ellipsis"
                      >
                        {item.title}
                      </Text>
                    </HStack>
                    <IconButton
                      className="delete-btn"
                      aria-label="Delete chat"
                      size="xs"
                      variant="ghost"
                      color="whiteAlpha.300"
                      opacity={0}
                      _hover={{ color: "red.400", bg: "whiteAlpha.100" }}
                      transition="all 0.15s"
                      onClick={(e) => handleDeleteChat(e, item.id)}
                      flexShrink={0}
                    >
                      <Icon as={FiTrash2} boxSize={3.5} />
                    </IconButton>
                  </Flex>
                ))}
              </Box>
            ))
          ) : (
            <Flex flex="1" align="center" justify="center" py={8}>
              <VStack gap={2}>
                <Icon as={FiMessageSquare} color="whiteAlpha.200" boxSize={8} />
                <Text fontSize="sm" color="whiteAlpha.300" textAlign="center">
                  No conversations yet
                </Text>
              </VStack>
            </Flex>
          )}
        </VStack>

        {/* Footer */}
        <Box px={4} py={3} borderTop="1px solid" borderColor="whiteAlpha.050">
          <HStack gap={3}>
            <Box
              w="28px"
              h="28px"
              borderRadius="full"
              bg="linear-gradient(135deg, #a855f7, #6366f1)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color="white"
              fontSize="xs"
              fontWeight="bold"
            >
              S
            </Box>
            <Box>
              <Text fontSize="sm" color="whiteAlpha.800" fontWeight="500">
                Student
              </Text>
              <Text fontSize="10px" color="whiteAlpha.400">
                Free Plan
              </Text>
            </Box>
          </HStack>
        </Box>
      </Box>

      {/* ---- Main Content ---- */}
      <Flex
        flex="1"
        direction="column"
        h="100%"
        bg="#18181b"
        position="relative"
        minW={0}
        overflow="hidden"
      >
        {/* Top Bar */}
        <Flex
          h="56px"
          align="center"
          justify="space-between"
          px={4}
          bg="#141416"
          borderBottom="1px solid"
          borderColor="whiteAlpha.100"
          flexShrink={0}
        >
          <Flex align="center">
            <Text
              fontSize="lg"
              fontWeight="600"
              color="whiteAlpha.900"
              fontFamily="'Outfit', sans-serif"
            >
              {agentMode ? "Fox Agent" : "Fox Chat"}
            </Text>
          </Flex>
        </Flex>

        {/* Scrollable Chat Area */}
        <Flex
          flex="1"
          direction="column"
          overflowY="auto"
          w="full"
          onScroll={handleScroll}
          css={{
            "&::-webkit-scrollbar": { width: "6px" },
            "&::-webkit-scrollbar-track": { background: "transparent" },
            "&::-webkit-scrollbar-thumb": {
              background: "rgba(255,255,255,0.08)",
              borderRadius: "999px",
            },
          }}
        >
          <Box
            w="full"
            px={{ base: 2, md: 6 }}
            pt={4}
            pb={messages.length > 0 ? "180px" : 0}
            flex="1"
          >
            {messages.length === 0 ? (
              <WelcomeScreen
                input={input}
                setInput={setInput}
                handleSend={handleSend}
                attachments={attachments}
                setAttachments={setAttachments}
                fileInputRef={fileInputRef}
                imageInputRef={imageInputRef}
                handleFileUpload={handleFileUpload}
                isTyping={isTyping}
                handleStop={handleStop}
                webSearchEnabled={webSearchEnabled}
                setWebSearchEnabled={setWebSearchEnabled}
                agentMode={agentMode}
                setAgentMode={setAgentMode}
              />
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    onRetry={handleRetry}
                    onApproveAction={handleApproveAction}
                    onDenyAction={handleDenyAction}
                    onApproveAll={handleApproveAll}
                    onOpenNote={handleOpenNote}
                    onOpenNotesTool={onOpenNotesTool}
                    onEditMessage={handleEditMessage}
                    isStreaming={
                      isTyping &&
                      idx === messages.length - 1 &&
                      msg.role === "assistant"
                    }
                  />
                ))}
                {isTyping &&
                  (!messages.length ||
                    messages[messages.length - 1].role === "user") && (
                    <TypingIndicator />
                  )}
                <div ref={endRef} />
              </>
            )}
          </Box>
        </Flex>

        {/* Floating Input (conversation mode) */}
        {messages.length > 0 && (
          <Box
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            px={{ base: 3, md: 6 }}
            pb={3}
            pt={10}
            background="linear-gradient(to top, #18181b 60%, transparent)"
          >
            <Flex direction="column" align="center">
              <ChatInputBar
                input={input}
                setInput={setInput}
                attachments={attachments}
                setAttachments={setAttachments}
                isTyping={isTyping}
                onSend={handleSend}
                onStop={handleStop}
                fileInputRef={fileInputRef}
                imageInputRef={imageInputRef}
                handleFileUpload={handleFileUpload}
                placeholder="Reply to Fox AI…"
                webSearchEnabled={webSearchEnabled}
                setWebSearchEnabled={setWebSearchEnabled}
                agentMode={agentMode}
                setAgentMode={setAgentMode}
              />
              <Text
                textAlign="center"
                fontSize="11px"
                color="whiteAlpha.300"
                mt={2}
              >
                Fox AI can make mistakes. Please double-check responses.
              </Text>
            </Flex>
          </Box>
        )}
      </Flex>
    </Flex>
  );
}
