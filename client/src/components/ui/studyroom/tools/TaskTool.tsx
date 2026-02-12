import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  IconButton,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FiMoreHorizontal } from "react-icons/fi";

export type StudyTask = { id: string; text: string; done: boolean };

export type TaskToolProps = {
  taskText: string;
  setTaskText: (text: string) => void;
  tasks: StudyTask[];
  onAddTask: () => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onClear: () => void;
};

export default function TaskTool(props: TaskToolProps) {
  const {
    taskText,
    setTaskText,
    tasks,
    onAddTask,
    onToggleTask,
    onDeleteTask,
    onClear,
  } = props;

  return (
    <Stack gap={4}>
      <Input
        value={taskText}
        onChange={(e) => setTaskText(e.target.value)}
        placeholder="Add a task…"
        h="42px"
        borderRadius="12px"
        bg="whiteAlpha.200"
        borderWidth="1px"
        borderColor="whiteAlpha.300"
        color="white"
        _placeholder={{ color: "whiteAlpha.700" }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          onAddTask();
        }}
      />

      <HStack gap={3}>
        <Button
          borderRadius="12px"
          bg="whiteAlpha.200"
          color="white"
          _hover={{ bg: "whiteAlpha.300" }}
          onClick={onAddTask}
        >
          Add
        </Button>
        <Button
          borderRadius="12px"
          bg="transparent"
          borderWidth="1px"
          borderColor="whiteAlpha.300"
          color="white"
          _hover={{ bg: "whiteAlpha.200" }}
          onClick={onClear}
        >
          Clear
        </Button>
      </HStack>

      <Stack gap={2} pt={1} maxH="260px" overflowY="auto">
        {tasks.length === 0 ? (
          <Text fontSize="sm" color="whiteAlpha.800">
            No tasks yet.
          </Text>
        ) : (
          tasks.map((t) => (
            <Flex
              key={t.id}
              align="center"
              justify="space-between"
              gap={3}
              bg="whiteAlpha.200"
              borderWidth="1px"
              borderColor="whiteAlpha.200"
              borderRadius="14px"
              px={4}
              py={3}
            >
              <HStack gap={3}>
                <Box
                  as="button"
                  aria-label={t.done ? "Mark incomplete" : "Mark done"}
                  onClick={() => onToggleTask(t.id)}
                  w="18px"
                  h="18px"
                  borderRadius="6px"
                  borderWidth="1px"
                  borderColor="whiteAlpha.600"
                  bg={t.done ? "whiteAlpha.700" : "transparent"}
                />
                <Text
                  fontSize="sm"
                  color={t.done ? "whiteAlpha.700" : "white"}
                  textDecoration={t.done ? "line-through" : "none"}
                >
                  {t.text}
                </Text>
              </HStack>

              <IconButton
                aria-label="Delete task"
                variant="ghost"
                size="sm"
                color="white"
                _hover={{ bg: "whiteAlpha.200" }}
                onClick={() => onDeleteTask(t.id)}
              >
                <Icon as={FiMoreHorizontal} />
              </IconButton>
            </Flex>
          ))
        )}
      </Stack>
    </Stack>
  );
}
