import { Box, Stack, Text } from "@chakra-ui/react";

export default function FoxAiTool() {
  return (
    <Stack gap={3}>
      <Text fontSize="sm" color="whiteAlpha.900">
        Fox AI tools will live here.
      </Text>
      <Box
        borderRadius="16px"
        bg="whiteAlpha.200"
        borderWidth="1px"
        borderColor="whiteAlpha.200"
        p={4}
      >
        <Text fontSize="sm" color="whiteAlpha.800">
          Next: add AI panel that outputs JSON plans only (per your architecture
          rules).
        </Text>
      </Box>
    </Stack>
  );
}
