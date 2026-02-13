import {
  Box,
  Button,
  Grid,
  GridItem,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  Text,
  Flex,
} from "@chakra-ui/react";
import { useState } from "react";
import { FiHeart, FiSearch, FiShare2, FiX } from "react-icons/fi";

// Map available images in public/background-images/ to friendly names
const AVAILABLE_IMAGES = [
  {
    id: "moonlight",
    title: "Moonlight",
    src: "/background-images/anime-moon-landscape.jpg",
    category: "anime",
  },
  {
    id: "astronaut",
    title: "Astronaut",
    src: "/background-images/astronaut-spaceman-suit-digital-art-purple-background-stars-3840x2160-6424.png",
    category: "anime",
  },
  {
    id: "samurai",
    title: "Samurai",
    src: "/background-images/serene-samurai-amidst-cherry-blossoms-moonlit-lake.jpg",
    category: "anime",
  },
  {
    id: "anime-aesthetic",
    title: "Anime Aesthetic",
    src: "/background-images/wp7199370-anime-aesthetic-computers-wallpapers.jpg",
    category: "anime",
  },
  {
    id: "vector",
    title: "Vector",
    src: "/background-images/wp8773098-vector-graphics-wallpapers.jpg",
    category: "anime",
  },
  {
    id: "abstract",
    title: "Abstract",
    src: "/background-images/CIxvPOYNIysewpii6aVrS.png",
    category: "anime",
  },
  {
    id: "ultra-nature",
    title: "Ultra Nature",
    src: "/background-images/wp10094737-4k-hd-ultra-nature-wallpapers.jpg",
    category: "real",
  },
  {
    id: "anime-road",
    title: "Anime Road",
    src: "/background-images/wp10915948-4k-desktop-anime-road-wallpapers.jpg",
    category: "anime",
  },
  {
    id: "anime-nature",
    title: "Anime Nature",
    src: "/background-images/wp13664571-anime-nature-desktop-4k-wallpapers.png",
    category: "anime",
  },
  {
    id: "nature-scenery",
    title: "Nature Scenery",
    src: "/background-images/wp14320699-nature-anime-pc-wallpapers.jpg",
    category: "anime",
  },
  {
    id: "scenic-1",
    title: "Scenic 1",
    src: "/background-images/uwp4285569.jpeg",
    category: "real",
  },
  {
    id: "scenic-2",
    title: "Scenic 2",
    src: "/background-images/uwp4286591.jpeg",
    category: "real",
  },
  {
    id: "misty-forest",
    title: "Misty Forest",
    src: "/background-images/pexels-joyston-judah-331625-933054.jpg",
    category: "real",
  },
  {
    id: "mountain-view",
    title: "Mountain View",
    src: "/background-images/pexels-mavicair2tw-16822611.jpg",
    category: "real",
  },
  {
    id: "autumn-road",
    title: "Autumn Road",
    src: "/background-images/pexels-pixabay-210186.jpg",
    category: "real",
  },
  {
    id: "foggy-bridge",
    title: "Foggy Bridge",
    src: "/background-images/pexels-snapwire-34950.jpg",
    category: "real",
  },
  {
    id: "city-night",
    title: "City Night",
    src: "/background-images/pexels-therato-1933320.jpg",
    category: "real",
  },
  {
    id: "coffee-lofi",
    title: "Coffee Lofi",
    src: "/background-images/wp13196882-coffee-lofi-wallpapers.png",
    category: "anime",
  },
  {
    id: "anime-cafe",
    title: "Anime Cafe",
    src: "/background-images/wp7575195-anime-cafe-wallpapers.jpg",
    category: "anime",
  },
];

type ImageToolProps = {
  onClose?: () => void;
  onBackgroundSelect?: (src: string) => void;
  currentBackground?: string;
};

export default function ImageTool({
  onClose,
  onBackgroundSelect,
  currentBackground,
}: ImageToolProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Images");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "anime" | "real">("all");

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fav) => fav !== id) : [...prev, id],
    );
  };

  // Determine current selected image object
  const selectedImage = AVAILABLE_IMAGES.find(
    (img) => img.src === currentBackground,
  );

  const filteredImages = AVAILABLE_IMAGES.filter((img) => {
    // 1. Search Filter
    const matchesSearch = img.title
      .toLowerCase()
      .includes(search.toLowerCase());

    // 2. Tab Filter (Favorites)
    if (activeTab === "Favorites" && !favorites.includes(img.id)) {
      return false;
    }

    // 3. Category Filter
    if (filter === "anime" && img.category !== "anime") return false;
    if (filter === "real" && img.category !== "real") return false;

    return matchesSearch;
  });

  return (
    <Box
      w={{ base: "320px", md: "380px" }}
      h={{ base: "500px", md: "600px" }}
      bg="#1A1B1E" // Dark background like figma
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
            fontWeight={activeTab === "Images" ? "700" : "500"}
            color={activeTab === "Images" ? "white" : "whiteAlpha.600"}
            cursor="pointer"
            onClick={() => setActiveTab("Images")}
            borderBottom={activeTab === "Images" ? "2px solid white" : "none"}
            pb={1}
          >
            Images
          </Text>
          <Text
            fontSize="md"
            fontWeight={activeTab === "Favorites" ? "700" : "500"}
            color={activeTab === "Favorites" ? "white" : "whiteAlpha.600"}
            cursor="pointer"
            onClick={() => setActiveTab("Favorites")}
            // Visual feedback for favorites tab being inactive
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

      {/* Search Bar - Custom Implementation removing InputGroup/InputLeftElement dependency */}
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
            placeholder="Search space"
            bg="#2C2E33" // Slightly lighter dark
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
            Natural
          </Button>
        </HStack>
      </Box>

      {/* Featured Spaces Grid */}
      <Box flex="1" overflowY="auto" px={4} py={2}>
        <Text fontSize="sm" fontWeight="700" mb={3}>
          {activeTab === "Favorites" ? "Your Favorites" : "Featured Spaces"}
        </Text>
        {filteredImages.length === 0 ? (
          <Flex align="center" justify="center" h="200px" direction="column">
            <Text color="whiteAlpha.500" fontSize="sm">
              No images found
            </Text>
          </Flex>
        ) : (
          <Grid templateColumns="repeat(2, 1fr)" gap={3}>
            {filteredImages.map((img) => (
              <GridItem key={img.id}>
                <Box
                  position="relative"
                  borderRadius="12px"
                  overflow="hidden"
                  cursor="pointer"
                  onClick={() => onBackgroundSelect?.(img.src)}
                  role="group"
                  borderWidth={img.src === currentBackground ? "2px" : "0px"}
                  borderColor="orange.400"
                >
                  <Image
                    src={img.src}
                    alt={img.title}
                    objectFit="cover"
                    w="100%"
                    h="100px"
                    transition="transform 0.2s"
                    _groupHover={{ transform: "scale(1.05)" }}
                  />
                  <Box
                    as="button"
                    onClick={(e) => toggleFavorite(img.id, e)}
                    position="absolute"
                    top={2}
                    right={2}
                    bg="blackAlpha.400"
                    borderRadius="full"
                    p={1}
                    _hover={{ bg: "blackAlpha.600" }}
                    transition="all 0.2s"
                  >
                    <Icon
                      as={FiHeart}
                      color={
                        favorites.includes(img.id)
                          ? "red.400"
                          : "whiteAlpha.800"
                      }
                      fill={
                        favorites.includes(img.id) ? "currentColor" : "none"
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
                  >
                    <Text fontSize="xs" fontWeight="600" color="white">
                      {img.title}
                    </Text>
                  </Box>
                </Box>
              </GridItem>
            ))}
          </Grid>
        )}
      </Box>

      {/* Footer - Current Selection Info */}
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
                {selectedImage?.title ?? "Custom Background"}
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
