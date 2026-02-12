import { Stack, Textarea } from "@chakra-ui/react";

export type NotesToolProps = {
  notes: string;
  setNotes: (notes: string) => void;
};

export default function NotesTool({ notes, setNotes }: NotesToolProps) {
  return (
    <Stack gap={4}>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Write notes here…"
        minH="280px"
        borderRadius="16px"
        bg="whiteAlpha.200"
        borderWidth="1px"
        borderColor="whiteAlpha.300"
        color="white"
        _placeholder={{ color: "whiteAlpha.700" }}
      />
    </Stack>
  );
}
