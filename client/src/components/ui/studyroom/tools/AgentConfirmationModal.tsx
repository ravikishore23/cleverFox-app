import { Button, Text, VStack, Box } from "@chakra-ui/react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  proposal: any | null;
  onConfirm: (proposal: any) => void;
  confirming?: boolean;
};

export default function AgentConfirmationModal({
  isOpen,
  onClose,
  proposal,
  onConfirm,
  confirming,
}: Props) {
  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={60}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="rgba(2,6,23,0.6)"
    >
      <Box w={{ base: "92%", md: "640px" }} bg="#0f1720" color="white" borderRadius="md" p={4}>
        <Text fontSize="lg" fontWeight="semibold" mb={3}>
          Confirm Agent Actions
        </Text>

        <VStack align="stretch" gap={3}>
          <Text fontSize="sm" color="whiteAlpha.700">
            The AI has proposed a set of actions to run on your machine. Review them carefully. The agent runs inside a sandboxed workspace and cannot access files outside it.
          </Text>

          {proposal?.actions ? (
            proposal.actions.map((a: any, i: number) => (
              <Box key={i} p={3} bg="#0b1220" borderRadius="md" fontSize="13px">
                <Text fontWeight="bold" mb={1}>
                  {a.kind}
                </Text>
                <Text whiteSpace="pre-wrap">{JSON.stringify(a, null, 2)}</Text>
              </Box>
            ))
          ) : (
            <Text>No actions found.</Text>
          )}

          <Box display="flex" justifyContent="flex-end" gap={3} pt={2}>
            <Button mr={3} variant="ghost" onClick={onClose} disabled={confirming}>
              Cancel
            </Button>
            <Button colorScheme="purple" onClick={() => onConfirm(proposal)} loading={confirming}>
              Confirm and Run
            </Button>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
}
