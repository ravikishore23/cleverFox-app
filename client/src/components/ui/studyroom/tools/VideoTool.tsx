import {
  Box,
  Button,
  Grid,
  GridItem,
  HStack,
  Icon,
  IconButton,
  Input,
  Text,
  Flex,
} from "@chakra-ui/react";
import { useState } from "react";
import { FiHeart, FiSearch, FiShare2, FiX, FiPlay } from "react-icons/fi";

const AVAILABLE_VIDEOS = [
  {
    id: "video-1",
    title: "Nature Stream",
    src: "/background-videos/14244-255658092_medium.mp4",
    category: "real",
  },
  {
    id: "video-2",
    title: "Cozy fireplace",
    src: "/background-videos/153976-817104245_small.mp4",
    category: "real",
  },
  {
    id: "video-3",
    title: "Rainy Window",
    src: "/background-videos/159627-819346937_small.mp4",
    category: "real",
  },
  {
    id: "video-4",
    title: "Forest Walk",
    src: "/background-videos/186405-877993676_medium.mp4",
    category: "real",
  },
  {
    id: "video-5",
    title: "Ocean Waves",
    src: "/background-videos/199001-909564581_small.mp4",
    category: "real",
  },
  {
    id: "video-6",
    title: "Abstract Flow",
    src: "/background-videos/215407_small.mp4",
    category: "anime",
  },
  {
    id: "video-7",
    title: "City Lights",
    src: "/background-videos/216134_small.mp4",
    category: "real",
  },
  {
    id: "video-8",
    title: "Mountain Cloud",
    src: "/background-videos/223111_medium.mp4",
    category: "real",
  },
  {
    id: "video-9",
    title: "Coffee Shop",
    src: "/background-videos/270507_small.mp4",
    category: "real",
  },
  {
    id: "video-10",
    title: "Night Sky",
    src: "/background-videos/297736_medium.mp4",
    category: "real",
  },
  {
    id: "video-11",
    title: "Cyberpunk City",
    src: "/background-videos/310025_medium.mp4",
    category: "anime",
  },
  {
    id: "video-12",
    title: "Snowfall",
    src: "/background-videos/91562-629172467_small.mp4",
    category: "real",
  },
];

type VideoToolProps = {
  onClose?: () => void;
  onVideoSelect?: (src: string) => void;
  currentVideo?: string | null;
};

export default function VideoTool({
  onClose,
  onVideoSelect,
  currentVideo,
}: VideoToolProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Videos");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "real" | "anime">("all");

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fav) => fav !== id) : [...prev, id],
    );
  };

  const selectedVideo = AVAILABLE_VIDEOS.find(
    (vid) => vid.src === currentVideo,
  );

  const filteredVideos = AVAILABLE_VIDEOS.filter((vid) => {
    const matchesSearch = vid.title
      .toLowerCase()
      .includes(search.toLowerCase());

    if (activeTab === "Favorites" && !favorites.includes(vid.id)) {
      return false;
    }

    if (filter === "real" && vid.category !== "real") return false;
    if (filter === "anime" && vid.category !== "anime") return false;

    return matchesSearch;
  });

  return (
    <Box
      w={{ base: "320px", md: "380px" }}
      h={{ base: "500px", md: "600px" }}
      bg="#1A1B1E"
      borderRadius="24px"
      borderWidth="1px"
      borderColor="whiteAlpha.100"
      boxShadow="0 20px 50px rgba(0,0,0,0.5)"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      color="white"
    >
      {/* Header Tabs */}
      <Flex align="center" justify="space-between" px={4} pt={4} pb={2}>
        <HStack gap={4}>
          <Text
            fontSize="md"
            fontWeight={activeTab === "Videos" ? "700" : "500"}
            color={activeTab === "Videos" ? "white" : "whiteAlpha.600"}
            cursor="pointer"
            onClick={() => setActiveTab("Videos")}
            borderBottom={activeTab === "Videos" ? "2px solid white" : "none"}
            pb={1}
          >
            Videos
          </Text>
          <Text
            fontSize="md"
            fontWeight={activeTab === "Favorites" ? "700" : "500"}
            color={activeTab === "Favorites" ? "white" : "whiteAlpha.600"}
            cursor="pointer"
            onClick={() => setActiveTab("Favorites")}
            borderBottom={
              activeTab === "Favorites" ? "2px solid white" : "none"
            }
            pb={1}
          >
            Favorites
          </Text>
        </HStack>

        {onClose && (
          <IconButton
            size="sm"
            variant="ghost"
            color="whiteAlpha.600"
            _hover={{ color: "white", bg: "whiteAlpha.100" }}
            aria-label="Close"
            onClick={onClose}
          >
            <FiX size={18} />
          </IconButton>
        )}
      </Flex>

      {/* Search Bar */}
      <Box px={4} py={2}>
        <Box position="relative">
          <Box
            position="absolute"
            left={3}
            top="50%"
            transform="translateY(-50%)"
            pointerEvents="none"
            zIndex={2}
          >
            <FiSearch color="gray" />
          </Box>
          <Input
            placeholder="Search videos"
            bg="#2C2E33"
            border="none"
            borderRadius="10px"
            pl={10}
            _focus={{ ring: 1, ringColor: "whiteAlpha.400" }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Box>
      </Box>

      {/* Filter Chips */}
      <Box px={4} py={2} overflowX="auto" className="no-scrollbar">
        <HStack gap={2}>
          <Button
            size="xs"
            variant={filter === "all" ? "solid" : "ghost"}
            bg={filter === "all" ? "whiteAlpha.300" : "transparent"}
            color={filter === "all" ? "white" : "whiteAlpha.600"}
            _hover={{ bg: "whiteAlpha.200" }}
            borderRadius="8px"
            px={3}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            size="xs"
            variant={filter === "anime" ? "solid" : "ghost"}
            bg={filter === "anime" ? "pink.500" : "transparent"}
            color={filter === "anime" ? "white" : "whiteAlpha.600"}
            _hover={{ bg: filter === "anime" ? "pink.600" : "whiteAlpha.200" }}
            borderRadius="8px"
            px={3}
            onClick={() => setFilter("anime")}
          >
            Anime
          </Button>
          <Button
            size="xs"
            variant={filter === "real" ? "solid" : "ghost"}
            bg={filter === "real" ? "green.500" : "transparent"}
            color={filter === "real" ? "white" : "whiteAlpha.600"}
            _hover={{ bg: filter === "real" ? "green.600" : "whiteAlpha.200" }}
            borderRadius="8px"
            px={3}
            onClick={() => setFilter("real")}
          >
            Real
          </Button>
        </HStack>
      </Box>

      {/* Videos Grid */}
      <Box flex="1" overflowY="auto" px={4} py={2}>
        <Text fontSize="sm" fontWeight="700" mb={3}>
          {activeTab === "Favorites" ? "Your Favorites" : "Featured Videos"}
        </Text>
        {filteredVideos.length === 0 ? (
          <Flex align="center" justify="center" h="200px" direction="column">
            <Text color="whiteAlpha.500" fontSize="sm">
              No videos found
            </Text>
          </Flex>
        ) : (
          <Grid templateColumns="repeat(2, 1fr)" gap={3}>
            {filteredVideos.map((vid) => (
              <GridItem key={vid.id}>
                <Box
                  position="relative"
                  borderRadius="12px"
                  overflow="hidden"
                  cursor="pointer"
                  onClick={() => onVideoSelect?.(vid.src)}
                  role="group"
                  borderWidth={vid.src === currentVideo ? "2px" : "0px"}
                  borderColor="orange.400"
                  bg="black"
                  h="100px"
                >
                  <video
                    src={vid.src}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    muted
                    loop
                    onMouseOver={(e) => e.currentTarget.play()}
                    onMouseOut={(e) => {
                      e.currentTarget.pause();
                      e.currentTarget.currentTime = 0;
                    }}
                  />

                  {/* Play Icon Overlay */}
                  <Box
                    position="absolute"
                    top="50%"
                    left="50%"
                    transform="translate(-50%, -50%)"
                    bg="blackAlpha.600"
                    borderRadius="full"
                    p={2}
                    opacity={0.8}
                    _groupHover={{ opacity: 0 }}
                    transition="opacity 0.2s"
                  >
                    <Icon as={FiPlay} color="white" w={4} h={4} />
                  </Box>

                  <Box
                    as="button"
                    onClick={(e) => toggleFavorite(vid.id, e)}
                    position="absolute"
                    top={2}
                    right={2}
                    bg="blackAlpha.400"
                    borderRadius="full"
                    p={1}
                    _hover={{ bg: "blackAlpha.600" }}
                    transition="all 0.2s"
                    zIndex={2}
                  >
                    <Icon
                      as={FiHeart}
                      color={
                        favorites.includes(vid.id)
                          ? "red.400"
                          : "whiteAlpha.800"
                      }
                      fill={
                        favorites.includes(vid.id) ? "currentColor" : "none"
                      }
                      w={3}
                      h={3}
                    />
                  </Box>
                  <Box
                    position="absolute"
                    bottom={0}
                    left={0}
                    w="100%"
                    bg="linear-gradient(to top, rgba(0,0,0,0.8), transparent)"
                    p={2}
                    pt={4}
                    zIndex={1}
                  >
                    <Text fontSize="xs" fontWeight="600" color="white">
                      {vid.title}
                    </Text>
                  </Box>
                </Box>
              </GridItem>
            ))}
          </Grid>
        )}
      </Box>

      {/* Footer Info */}
      <Box
        borderTopWidth="1px"
        borderTopColor="whiteAlpha.100"
        bg="#25262B"
        p={4}
      >
        <Flex justify="space-between" align="center">
          <HStack gap={3}>
            <Box>
              <Text fontSize="sm" fontWeight="700">
                {selectedVideo?.title ?? "Custom Video"}
              </Text>
              <Text fontSize="xs" color="whiteAlpha.600">
                @Community
              </Text>
            </Box>
          </HStack>

          <HStack gap={2}>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="Share"
              color="whiteAlpha.700"
              _hover={{ color: "white", bg: "whiteAlpha.100" }}
            >
              <FiShare2 />
            </IconButton>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="Like"
              color="whiteAlpha.700"
              _hover={{ color: "white", bg: "whiteAlpha.100" }}
            >
              <FiHeart />
            </IconButton>
          </HStack>
        </Flex>
      </Box>
    </Box>
  );
}
