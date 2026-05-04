import React from "react";
import { Box, Flex, Text, VStack, HStack, Icon } from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSend,
  FiBook,
  FiCheckSquare,
  FiCode,
  FiMusic,
  FiPaperclip,
  FiImage,
  FiFile,
  FiX,
  FiSquare,
  FiSearch,
  FiTerminal,
} from "react-icons/fi";

const AI_LOGO = "/ai-logo.png";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionBox = motion.create(Box as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionFlex = motion.create(Flex as any);

type WelcomeScreenProps = {
  input: string;
  setInput: (value: string) => void;
  handleSend: (text?: string) => void;
  attachments: { type: string; data: string; name: string }[];
  setAttachments: React.Dispatch<
    React.SetStateAction<{ type: string; data: string; name: string }[]>
  >;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isTyping: boolean;
  handleStop: () => void;
  webSearchEnabled?: boolean;
  setWebSearchEnabled?: (val: boolean) => void;
  agentMode?: boolean;
  setAgentMode?: (val: boolean) => void;
};

const formatFileSize = (dataUrl: string) => {
  const base64 = dataUrl.split(",")[1] || "";
  const bytes = Math.round((base64.length * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const SUGGESTIONS = [
  {
    icon: FiBook,
    text: "Explain quantum physics",
    color: "rgba(168, 85, 247, 0.15)",
    borderColor: "rgba(168, 85, 247, 0.2)",
    iconColor: "purple.300",
  },
  {
    icon: FiCheckSquare,
    text: "Help me study for exams",
    color: "rgba(59, 130, 246, 0.15)",
    borderColor: "rgba(59, 130, 246, 0.2)",
    iconColor: "blue.300",
  },
  {
    icon: FiCode,
    text: "Write a React component",
    color: "rgba(34, 197, 94, 0.15)",
    borderColor: "rgba(34, 197, 94, 0.2)",
    iconColor: "green.300",
  },
  {
    icon: FiMusic,
    text: "Suggest focus music",
    color: "rgba(249, 115, 22, 0.15)",
    borderColor: "rgba(249, 115, 22, 0.2)",
    iconColor: "orange.300",
  },
];

const WelcomeScreen = ({
  input,
  setInput,
  handleSend,
  attachments,
  setAttachments,
  fileInputRef,
  imageInputRef,
  handleFileUpload,
  isTyping,
  handleStop,
  webSearchEnabled = false,
  setWebSearchEnabled = () => {},
  agentMode = false,
  setAgentMode = () => {},
}: WelcomeScreenProps) => {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      flex="1"
      h="100%"
      color="white"
      px={4}
      pb={20}
    >
      <VStack gap={8} maxW="640px" w="full">
        {/* Hero Section */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <VStack gap={4}>
            <Box
              p={3}
              bg="whiteAlpha.50"
              borderRadius="2xl"
              boxShadow="0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
              border="1px solid"
              borderColor="whiteAlpha.100"
            >
              <img
                src={AI_LOGO}
                alt="Fox AI"
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "12px",
                  objectFit: "cover",
                }}
              />
            </Box>
            <VStack gap={1}>
              <Text
                fontSize="2xl"
                fontWeight="700"
                color="white"
                letterSpacing="-0.01em"
              >
                Hi, I'm Fox AI
              </Text>
              <Text fontSize="md" color="whiteAlpha.500" textAlign="center">
                I can help you study, code, or just chat.
              </Text>
            </VStack>
          </VStack>
        </MotionBox>

        {/* Input Area — Glassmorphic */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          w="full"
        >
          <Box
            w="full"
            bg="rgba(39, 39, 42, 0.85)"
            backdropFilter="blur(20px)"
            borderRadius="2xl"
            p={3}
            border="1px solid"
            borderColor="whiteAlpha.100"
            boxShadow="0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)"
            transition="all 0.25s ease"
            _focusWithin={{
              borderColor: "rgba(168, 85, 247, 0.5)",
              boxShadow:
                "0 8px 40px rgba(168, 85, 247, 0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Attachment Chips */}
            <AnimatePresence>
              {attachments && attachments.length > 0 && (
                <MotionFlex
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  gap={2}
                  wrap="wrap"
                  mb={2}
                  overflow="hidden"
                >
                  {attachments.map((att, idx) => (
                    <MotionBox
                      key={idx}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      display="flex"
                      alignItems="center"
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
                          setAttachments((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        p={1}
                        borderRadius="full"
                        _hover={{ bg: "whiteAlpha.200" }}
                        transition="all 0.15s"
                        cursor="pointer"
                        flexShrink={0}
                      >
                        <Icon as={FiX} color="whiteAlpha.500" boxSize={3} />
                      </Box>
                    </MotionBox>
                  ))}
                </MotionFlex>
              )}
            </AnimatePresence>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything..."
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
                fontFamily: "'Inter', -apple-system, sans-serif",
                lineHeight: "1.6",
                padding: 0,
                marginBottom: "8px",
                overflow: "auto",
              }}
            />
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
                  transition="all 0.15s"
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
                  transition="all 0.15s"
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
                  bg={
                    webSearchEnabled
                      ? "rgba(59, 130, 246, 0.15)"
                      : "transparent"
                  }
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
                    bg: agentMode
                      ? "rgba(168, 85, 247, 0.25)"
                      : "whiteAlpha.100",
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
                  onClick={handleStop}
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
                  transition="all 0.15s"
                  cursor="pointer"
                  css={{
                    animation: "pulse 2s infinite",
                    "@keyframes pulse": {
                      "0%, 100%": { opacity: 1 },
                      "50%": { opacity: 0.7 },
                    },
                  }}
                >
                  <Icon as={FiSquare} color="red.400" boxSize={3} />
                  <Text fontSize="xs" color="red.400" fontWeight="600">
                    Stop
                  </Text>
                </Box>
              ) : (
                <Box
                  as="button"
                  onClick={() => handleSend()}
                  p={2}
                  bg={
                    input.trim() || (attachments && attachments.length > 0)
                      ? "white"
                      : "whiteAlpha.100"
                  }
                  color={
                    input.trim() || (attachments && attachments.length > 0)
                      ? "black"
                      : "whiteAlpha.400"
                  }
                  borderRadius="xl"
                  transition="all 0.2s"
                  _hover={
                    input.trim() || (attachments && attachments.length > 0)
                      ? { opacity: 0.9, transform: "scale(1.05)" }
                      : {}
                  }
                  cursor={
                    input.trim() || (attachments && attachments.length > 0)
                      ? "pointer"
                      : "default"
                  }
                >
                  <Icon as={FiSend} boxSize={4} />
                </Box>
              )}
            </Flex>
          </Box>
        </MotionBox>

        {/* Suggestion Grid */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          w="full"
        >
          <Text
            fontSize="11px"
            fontWeight="600"
            color="whiteAlpha.300"
            mb={4}
            textAlign="center"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Try asking
          </Text>
          <Flex gap={3} wrap="wrap" justify="center">
            {SUGGESTIONS.map((item, i) => (
              <MotionBox
                key={i}
                as="button"
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap={2}
                py={4}
                px={5}
                bg={item.color}
                border="1px solid"
                borderColor={item.borderColor}
                borderRadius="2xl"
                cursor="pointer"
                _hover={{
                  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                }}
                onClick={() => {
                  setInput(item.text);
                  setTimeout(() => handleSend(item.text), 150);
                }}
                minW="140px"
                flex="1"
                maxW="180px"
              >
                <Icon as={item.icon} boxSize={5} color={item.iconColor} />
                <Text
                  fontSize="13px"
                  fontWeight="500"
                  color="whiteAlpha.900"
                  textAlign="center"
                >
                  {item.text}
                </Text>
              </MotionBox>
            ))}
          </Flex>
        </MotionBox>
      </VStack>
    </Flex>
  );
};

export default WelcomeScreen;
