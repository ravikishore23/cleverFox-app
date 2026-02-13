import {
  Box,
  Flex,
  Input,
  Text,
  Spinner,
  Textarea,
  Icon,
  Button,
  VStack,
  HStack,
  IconButton,
} from "@chakra-ui/react";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  FiSend,
  FiPlus,
  FiImage,
  FiMic,
  FiSidebar,
  FiAlertCircle,
  FiRefreshCw,
} from "react-icons/fi";

const AI_LOGO = "/ai-logo.png";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  error?: boolean;
};

type ChatHistory = {
  id: string;
  title: string;
  date: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const API_BASE =
  typeof window !== "undefined" && window.location.protocol === "file:"
    ? "http://localhost:3001" // Electron file:// origin
    : "http://localhost:3001"; // Dev browser

/**
 * Renders AI text with basic markdown formatting:
 * - **bold**
 * - `inline code`
 * - ```fenced code blocks```
 * - newlines → <br />
 */
function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <Box>
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const inner = part.slice(3, -3);
          const firstNewline = inner.indexOf("\n");
          const code =
            firstNewline > -1 ? inner.slice(firstNewline + 1) : inner;
          return (
            <Box
              key={i}
              as="pre"
              bg="#1e1e22"
              color="#e4e4e7"
              p={3}
              borderRadius="md"
              fontSize="sm"
              overflowX="auto"
              my={2}
              whiteSpace="pre-wrap"
              fontFamily="monospace"
            >
              {code}
            </Box>
          );
        }

        const inlineFormatted = part
          .split(/(\*\*.*?\*\*|`[^`]+`)/g)
          .map((seg, j) => {
            if (seg.startsWith("**") && seg.endsWith("**")) {
              return (
                <Text as="strong" key={j} fontWeight="bold">
                  {seg.slice(2, -2)}
                </Text>
              );
            }
            if (seg.startsWith("`") && seg.endsWith("`")) {
              return (
                <Text
                  as="span"
                  key={j}
                  bg="#27272a"
                  px={1}
                  py={0.5}
                  borderRadius="sm"
                  fontSize="sm"
                  fontFamily="monospace"
                  color="#a78bfa"
                >
                  {seg.slice(1, -1)}
                </Text>
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
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FoxAiTool() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Session-level chat history
  const [conversations, setConversations] = useState<ChatHistory[]>([]);

  /* ---- Scroll to bottom ---- */
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 60);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  /* ---- Send message ---- */
  const handleSend = useCallback(
    async (textOverride?: string) => {
      const textToSend = (textOverride || input).trim();
      if (!textToSend || isTyping) return;

      setError(null);

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        text: textToSend,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput("");
      setIsTyping(true);

      // Add to conversation list on first message
      if (updatedMessages.filter((m) => m.role === "user").length === 1) {
        const title =
          textToSend.length > 40 ? textToSend.slice(0, 40) + "…" : textToSend;
        setConversations((prev) => [
          { id: Date.now().toString(), title, date: "Today" },
          ...prev,
        ]);
      }

      try {
        const apiMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.text,
        }));

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120_000); // 120s for local LLMs

        const res = await fetch(`${API_BASE}/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          throw new Error(
            `Server error ${res.status}: ${errBody || res.statusText}`,
          );
        }

        const data = await res.json();

        if (!data.ok) {
          throw new Error(data.error || "Unknown API error");
        }

        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: data.output,
        };
        setMessages((prev) => [...prev, aiMsg]);
        setError(null);
      } catch (err: unknown) {
        const e = err as Error & { name?: string };
        const errorText =
          e.name === "AbortError"
            ? "Request timed out. The backend might be slow or unreachable."
            : e.message?.includes("Failed to fetch") ||
                e.message?.includes("NetworkError")
              ? "Cannot reach the AI server. Make sure the backend is running on port 3001.\n\nRun: npm run dev:api"
              : e.message || "Something went wrong.";

        setError(errorText);

        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: errorText,
          error: true,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [input, messages, isTyping],
  );

  /* ---- Retry last failed message ---- */
  const handleRetry = useCallback(() => {
    const reversed = [...messages].reverse();
    const lastUserIdx = reversed.findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const actualIdx = messages.length - 1 - lastUserIdx;
    const lastUserText = messages[actualIdx].text;
    setMessages(messages.slice(0, actualIdx));
    setTimeout(() => handleSend(lastUserText), 100);
  }, [messages, handleSend]);

  /* ---- New Chat ---- */
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setInput("");
    setError(null);
    setSidebarOpen(false);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Sub-components                                                   */
  /* ---------------------------------------------------------------- */

  const Sidebar = () => (
    <Box
      w={{ base: "280px", md: "260px" }}
      bg="#202023"
      display="flex"
      flexDirection="column"
      borderRight="1px solid"
      borderColor="whiteAlpha.100"
      p={4}
      h="100%"
      position={{ base: "absolute", md: "relative" }}
      left={0}
      top={0}
      zIndex={{ base: 20, md: "auto" }}
    >
      {/* Mobile close */}
      <Flex
        justify="space-between"
        align="center"
        mb={4}
        display={{ base: "flex", md: "none" }}
      >
        <Text color="white" fontWeight="bold" fontSize="sm">
          Chat History
        </Text>
        <IconButton
          aria-label="Close sidebar"
          variant="ghost"
          size="sm"
          color="white"
          onClick={() => setSidebarOpen(false)}
        >
          <Icon as={FiSidebar} />
        </IconButton>
      </Flex>

      <Button
        w="full"
        bg="whiteAlpha.100"
        color="white"
        _hover={{ bg: "whiteAlpha.200" }}
        justifyContent="flex-start"
        size="sm"
        mb={6}
        onClick={handleNewChat}
      >
        <Icon as={FiPlus} mr={2} /> New chat
      </Button>

      <VStack align="stretch" gap={1} flex="1" overflowY="auto">
        {conversations.length > 0 ? (
          <>
            <Text
              fontSize="xs"
              fontWeight="bold"
              color="whiteAlpha.500"
              px={2}
              mb={2}
            >
              Recents
            </Text>
            {conversations.map((item) => (
              <Box
                key={item.id}
                as="button"
                w="full"
                textAlign="left"
                px={2}
                py={2}
                borderRadius="md"
                _hover={{ bg: "whiteAlpha.100" }}
                color="whiteAlpha.900"
                fontSize="sm"
                display="block"
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
              >
                {item.title}
              </Box>
            ))}
          </>
        ) : (
          <Flex flex="1" align="center" justify="center">
            <Text fontSize="sm" color="whiteAlpha.300" textAlign="center">
              No conversations yet.
              <br />
              Start chatting!
            </Text>
          </Flex>
        )}
      </VStack>

      <Box pt={4} borderTop="1px solid" borderColor="whiteAlpha.100">
        <HStack gap={3} cursor="pointer" _hover={{ opacity: 0.8 }}>
          <Box
            w="32px"
            h="32px"
            borderRadius="full"
            bg="purple.500"
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
            <Text fontSize="sm" color="white" fontWeight="medium">
              Student
            </Text>
            <Text fontSize="xs" color="whiteAlpha.500">
              Free Plan
            </Text>
          </Box>
        </HStack>
      </Box>
    </Box>
  );

  const MessageBubble = ({ msg }: { msg: Message }) => {
    const isUser = msg.role === "user";
    const isError = msg.error;

    return (
      <Flex w="full" direction="column" py={3} px={{ base: 2, md: 0 }}>
        <Flex gap={3}>
          {/* Avatar */}
          <Box w="28px" flexShrink={0} pt={0.5}>
            {!isUser ? (
              <Box
                w="28px"
                h="28px"
                bg={isError ? "#dc2626" : "transparent"}
                borderRadius="md"
                display="flex"
                alignItems="center"
                justifyContent="center"
                overflow="hidden"
              >
                {isError ? (
                  <Icon as={FiAlertCircle} color="white" boxSize={3.5} />
                ) : (
                  <img
                    src={AI_LOGO}
                    alt="Fox AI"
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      objectFit: "cover",
                    }}
                  />
                )}
              </Box>
            ) : (
              <Box
                w="28px"
                h="28px"
                bg="#52525b"
                borderRadius="full"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize="xs" color="white" fontWeight="bold">
                  S
                </Text>
              </Box>
            )}
          </Box>

          {/* Content */}
          <Box flex="1" minW={0}>
            <Text fontWeight="bold" fontSize="sm" color="white" mb={1}>
              {isUser ? "You" : "Fox AI"}
            </Text>
            <Box
              fontSize="sm"
              lineHeight="1.7"
              color={isError ? "#fca5a5" : "whiteAlpha.900"}
              wordBreak="break-word"
            >
              {isUser ? (
                <Text whiteSpace="pre-wrap">{msg.text}</Text>
              ) : (
                <FormattedText text={msg.text} />
              )}
            </Box>
            {isError && (
              <Button
                size="xs"
                mt={2}
                variant="outline"
                color="#fca5a5"
                borderColor="#fca5a5"
                _hover={{ bg: "whiteAlpha.100" }}
                onClick={handleRetry}
              >
                <Icon as={FiRefreshCw} mr={1} boxSize={3} /> Retry
              </Button>
            )}
          </Box>
        </Flex>
      </Flex>
    );
  };

  const TypingIndicator = () => (
    <Flex w="full" py={3} gap={3} px={{ base: 2, md: 0 }}>
      <Box w="28px" flexShrink={0} pt={0.5}>
        <Box w="28px" h="28px" borderRadius="md" overflow="hidden">
          <img
            src={AI_LOGO}
            alt="Fox AI"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              objectFit: "cover",
            }}
          />
        </Box>
      </Box>
      <Flex direction="column" gap={1}>
        <Text fontWeight="bold" fontSize="sm" color="white">
          Fox AI
        </Text>
        <Flex align="center" gap={2}>
          <Spinner size="xs" color="gray.400" />
          <Text fontSize="sm" color="gray.400">
            Thinking…
          </Text>
        </Flex>
      </Flex>
    </Flex>
  );

  const WelcomeScreen = () => (
    <Flex
      direction="column"
      align="center"
      justify="center"
      flex="1"
      h="100%"
      color="white"
      px={{ base: 4, md: 6 }}
      py={6}
    >
      <Flex
        direction="column"
        align="center"
        maxW="600px"
        w="100%"
        gap={5}
        mb={4}
      >
        {/* Logo */}
        <Box
          w="56px"
          h="56px"
          borderRadius="lg"
          overflow="hidden"
          boxShadow="0 4px 20px rgba(0,0,0,0.3)"
        >
          <img
            src={AI_LOGO}
            alt="Fox AI"
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "8px",
              objectFit: "cover",
            }}
          />
        </Box>

        <Text
          fontSize={{ base: "xl", md: "2xl" }}
          fontWeight="medium"
          textAlign="center"
        >
          How can I help you today?
        </Text>

        <Text
          fontSize="sm"
          color="whiteAlpha.500"
          textAlign="center"
          maxW="400px"
        >
          Ask me anything — study help, coding questions, explanations, or just
          chat.
        </Text>

        {/* Main input */}
        <Box
          w="100%"
          bg="#27272a"
          borderRadius="xl"
          p={4}
          border="1px solid"
          borderColor="whiteAlpha.200"
          boxShadow="0 8px 32px rgba(0,0,0,0.3)"
          transition="border-color 0.2s"
          _focusWithin={{ borderColor: "whiteAlpha.400" }}
        >
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask anything…"
            variant="outline"
            bg="transparent"
            border="none"
            color="white"
            resize="none"
            minH="80px"
            fontSize="md"
            _placeholder={{ color: "#71717a" }}
            outline="none"
            css={{
              "&:focus-visible": {
                outline: "none",
                boxShadow: "none",
                borderColor: "transparent",
              },
              "&:focus": {
                outline: "none",
                boxShadow: "none",
                borderColor: "transparent",
              },
            }}
          />
          <Flex justify="space-between" align="center" mt={2}>
            <HStack gap={1}>
              <Box
                p={1.5}
                borderRadius="md"
                _hover={{ bg: "whiteAlpha.100" }}
                cursor="pointer"
              >
                <Icon as={FiPlus} color="gray.500" boxSize={4} />
              </Box>
              <Box
                p={1.5}
                borderRadius="md"
                _hover={{ bg: "whiteAlpha.100" }}
                cursor="pointer"
              >
                <Icon as={FiImage} color="gray.500" boxSize={4} />
              </Box>
              <Box
                p={1.5}
                borderRadius="md"
                _hover={{ bg: "whiteAlpha.100" }}
                cursor="pointer"
              >
                <Icon as={FiMic} color="gray.500" boxSize={4} />
              </Box>
            </HStack>
            <Box
              p={2}
              bg={input.trim() ? "white" : "whiteAlpha.100"}
              borderRadius="lg"
              cursor={input.trim() ? "pointer" : "default"}
              onClick={() => handleSend()}
              transition="all 0.2s"
              _hover={input.trim() ? { opacity: 0.9 } : {}}
            >
              <Icon
                as={FiSend}
                color={input.trim() ? "black" : "gray.600"}
                boxSize={4}
              />
            </Box>
          </Flex>
        </Box>

        {/* Suggestion chips */}
        <Flex gap={2} flexWrap="wrap" justify="center">
          {[
            "Explain quantum physics",
            "Help me study for exams",
            "Write a Python function",
          ].map((suggestion) => (
            <Button
              key={suggestion}
              size="xs"
              variant="outline"
              color="whiteAlpha.600"
              borderColor="whiteAlpha.200"
              _hover={{ bg: "whiteAlpha.100", color: "white" }}
              borderRadius="full"
              px={3}
              fontWeight="normal"
              onClick={() => {
                setInput(suggestion);
                setTimeout(() => handleSend(suggestion), 150);
              }}
            >
              {suggestion}
            </Button>
          ))}
        </Flex>
      </Flex>
    </Flex>
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <Flex h="100%" bg="#18181b" position="relative" overflow="hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <Box
          display={{ base: "block", md: "none" }}
          position="absolute"
          inset={0}
          bg="blackAlpha.600"
          zIndex={15}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Box
        display={{ base: sidebarOpen ? "flex" : "none", md: "flex" }}
        h="100%"
      >
        <Sidebar />
      </Box>

      {/* Main Content */}
      <Flex flex="1" direction="column" h="100%" position="relative" minW={0}>
        {/* Top Bar */}
        <Flex
          h="48px"
          align="center"
          px={{ base: 3, md: 4 }}
          borderBottom="1px solid"
          borderColor="whiteAlpha.100"
          justify="space-between"
          flexShrink={0}
        >
          <HStack gap={2}>
            <IconButton
              aria-label="Toggle sidebar"
              variant="ghost"
              size="sm"
              color="gray.400"
              _hover={{ color: "white", bg: "whiteAlpha.100" }}
              display={{ base: "flex", md: "none" }}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Icon as={FiSidebar} boxSize={4} />
            </IconButton>

            <Text color="gray.400" fontSize="sm">
              Model:
            </Text>
            <Text color="white" fontSize="sm" fontWeight="medium">
              Fox Gen 1
            </Text>
          </HStack>

          {/* Connection indicator */}
          {error && (
            <HStack gap={1}>
              <Box w="6px" h="6px" borderRadius="full" bg="red.400" />
              <Text
                fontSize="xs"
                color="red.400"
                display={{ base: "none", sm: "block" }}
              >
                Error
              </Text>
            </HStack>
          )}
          {!error && messages.length > 0 && (
            <HStack gap={1}>
              <Box w="6px" h="6px" borderRadius="full" bg="green.400" />
              <Text
                fontSize="xs"
                color="green.400"
                display={{ base: "none", sm: "block" }}
              >
                Connected
              </Text>
            </HStack>
          )}
        </Flex>

        {/* Scrollable Chat Area */}
        <Flex
          flex="1"
          direction="column"
          overflowY="auto"
          align="center"
          w="full"
          css={{
            "&::-webkit-scrollbar": { width: "6px" },
            "&::-webkit-scrollbar-track": { background: "transparent" },
            "&::-webkit-scrollbar-thumb": {
              background: "rgba(255,255,255,0.15)",
              borderRadius: "999px",
            },
          }}
        >
          <Box
            w="full"
            maxW="768px"
            px={{ base: 2, md: 4 }}
            pt={4}
            pb={messages.length > 0 ? "180px" : 0}
            flex="1"
          >
            {messages.length === 0 ? (
              <WelcomeScreen />
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                {isTyping && <TypingIndicator />}
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
            px={{ base: 3, md: 4 }}
            pb={3}
            pt={8}
            background="linear-gradient(to top, #18181b 70%, transparent)"
          >
            <Flex justify="center">
              <Box
                w="full"
                maxW="768px"
                bg="#27272a"
                borderRadius="xl"
                border="1px solid"
                borderColor="whiteAlpha.200"
                boxShadow="0 -4px 20px rgba(0,0,0,0.3)"
                p={3}
                transition="border-color 0.2s"
                _focusWithin={{ borderColor: "whiteAlpha.400" }}
              >
                <Input
                  ref={chatInputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Reply to Fox AI…"
                  variant="flushed"
                  bg="transparent"
                  border="none"
                  borderBottom="none"
                  color="white"
                  fontSize="md"
                  _placeholder={{ color: "#71717a" }}
                  outline="none"
                  css={{
                    "&:focus-visible": {
                      outline: "none",
                      boxShadow: "none",
                      borderColor: "transparent",
                      borderBottom: "none",
                    },
                    "&:focus": {
                      outline: "none",
                      boxShadow: "none",
                      borderColor: "transparent",
                      borderBottom: "none",
                    },
                  }}
                  disabled={isTyping}
                  mb={2}
                />
                <Flex justify="space-between" align="center">
                  <HStack gap={1}>
                    <Box
                      p={1.5}
                      borderRadius="md"
                      _hover={{ bg: "whiteAlpha.100" }}
                      cursor="pointer"
                    >
                      <Icon as={FiPlus} color="gray.500" />
                    </Box>
                    <Box
                      p={1.5}
                      borderRadius="md"
                      _hover={{ bg: "whiteAlpha.100" }}
                      cursor="pointer"
                    >
                      <Icon as={FiImage} color="gray.500" />
                    </Box>
                  </HStack>
                  <Box
                    p={1.5}
                    bg={input.trim() && !isTyping ? "white" : "whiteAlpha.100"}
                    borderRadius="lg"
                    cursor={input.trim() && !isTyping ? "pointer" : "default"}
                    onClick={() => handleSend()}
                    transition="all 0.2s"
                    _hover={input.trim() && !isTyping ? { opacity: 0.9 } : {}}
                  >
                    <Icon
                      as={FiSend}
                      color={input.trim() && !isTyping ? "black" : "gray.600"}
                    />
                  </Box>
                </Flex>
              </Box>
            </Flex>
            <Text textAlign="center" fontSize="xs" color="gray.600" mt={2}>
              Fox AI can make mistakes. Please double-check responses.
            </Text>
          </Box>
        )}
      </Flex>
    </Flex>
  );
}
