import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Icon,
  Image,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { User } from "@boxicons/react";
import {
  FiBookOpen,
  FiHelpCircle,
  FiMic,
  FiSearch,
  FiZap,
} from "react-icons/fi";
import { TbBrain } from "react-icons/tb";
import { FaPaw } from "react-icons/fa";

type LandingPageProps = {
  onLogin?: () => void;
  onSignup?: () => void;
  onStartFocus?: () => void;
  user?: {
    name: string;
  } | null;
};

export default function LandingPage({
  onLogin,
  onSignup,
  onStartFocus,
  user,
}: LandingPageProps) {
  return (
    <Box minH="100vh" bg="white">
      <Container maxW="10xl" pt={10}>
        <Flex
          align="center"
          justify="space-between"
          px={{ base: 4, md: 9 }}
          borderRadius="20px"
          bg="#F8C7AE"
        >
          <Flex align="center" flexDirection={"column"}>
            <Image
              src="/guide-fox.png"
              alt="Clever Fox"
              boxSize="65px"
              padding={1}
              position={"absolute"}
            />
            <Text
              fontFamily="'Passero One', ui-sans-serif"
              color={"black"}
              fontWeight="700"
              fontSize={28}
              mt={11}
            >
              clever Fox
            </Text>
          </Flex>

          {user ? (
            <Flex align="center" direction="column" justify="center" gap={0.5}>
              <User
                pack="filled"
                removePadding
                width="28px"
                height="28px"
                color="var(--chakra-colors-gray-900)"
              />
              <Text
                fontSize="sm"
                fontWeight="600"
                color="gray.900"
                lineHeight="short"
              >
                {user.name}
              </Text>
            </Flex>
          ) : (
            <Flex align="center" gap={3}>
              <Button
                variant="ghost"
                size="sm"
                className="text-black"
                onClick={onLogin}
              >
                Login
              </Button>
              <Button
                size="sm"
                borderRadius="10px"
                fontWeight="semibold"
                bg="white"
                color="gray.900"
                borderWidth="1px"
                borderColor="blackAlpha.200"
                boxShadow="sm"
                px={3}
                _hover={{ bg: "gray.50", boxShadow: "md" }}
                onClick={onSignup}
              >
                Sign up
              </Button>
            </Flex>
          )}
        </Flex>

        <Stack
          align="center"
          textAlign="center"
          pt={{ base: 16, md: 28 }}
          pb={{ base: 16, md: 28 }}
          gap={6}
        >
          <Flex
            align="center"
            gap={2}
            color="#FF5F08"
            fontSize="sm"
            fontWeight="medium"
          >
            <Icon as={FaPaw} className=" text-black" />
            <Text>Next-Generation Study Platform</Text>
          </Flex>

          <Flex
            align="center"
            justify="center"
            gap={{ base: 6, md: 10 }}
            direction={{ base: "column", md: "row" }}
          >
            <Box>
              <Heading
                as="h1"
                fontFamily="'Inika', serif"
                fontWeight={700}
                fontSize={{ base: "48px", md: "72px" }}
                lineHeight={{ base: "1.05", md: "1.0" }}
                letterSpacing="-0.5px"
                color="gray.900"
                mr={10}
              >
                Elevate Your
              </Heading>
              <Text
                as="div"
                mt={{ base: 1, md: 2 }}
                fontFamily="'Mochiy Pop One', ui-sans-serif"
                fontWeight={400}
                fontSize={{ base: "48px", md: "72px" }}
                lineHeight={{ base: "1.05", md: "1.0" }}
                color="#FF5F08"
              >
                Learning Experience
              </Text>
            </Box>

            <Image
              top={"145px"}
              right={60}
              position="absolute"
              src="/fox.png"
              alt="Clever Fox mascot"
              maxH={{ base: "180px", md: "350px" }}
              objectFit="contain"
            />
          </Flex>

          <Text maxW="xl" color="gray.800" fontSize={{ base: "md", md: "lg" }}>
            A comprehensive platform designed for serious learners. Organize
            knowledge, track progress, and achieve academic excellence with
            enterprise-grade tools.
          </Text>

          <Button
            size="lg"
            borderRadius="full"
            bg="#F07A3B"
            color="black"
            px={12}
            py={7}
            fontWeight="semibold"
            boxShadow="md"
            _hover={{ bg: "#E96F32" }}
            onClick={onStartFocus}
          >
            <Flex align="center" gap={3}>
              <Text>start focus</Text>
              <Text fontSize="xl">→</Text>
            </Flex>
          </Button>
        </Stack>

        <Stack
          align="center"
          textAlign="center"
          pt={{ base: 10, md: 16 }}
          gap={4}
        >
          <Badge bg="#FFE7DA" color="#E06A3B" px={6} py={1} borderRadius="full">
            Features
          </Badge>
          <Heading as="h2" size={{ base: "xl", md: "3xl" }}>
            Complete Learning Suite
          </Heading>
          <Text maxW="lg" color="gray.500">
            Professional-grade tools designed to optimize your study workflow
            and maximize retention
          </Text>
        </Stack>

        <SimpleGrid
          columns={{ base: 1, md: 3 }}
          gap={{ base: 10, md: 16 }}
          mt={{ base: 14, md: 20 }}
          pb={20}
        >
          <Stack gap={8}>
            <Feature
              icon={<Icon as={FiMic} color="#4F7DF3" boxSize={6} />}
              title="Hit Record"
              text="Record your Zoom or in-class lectures with your device."
            />
            <Feature
              icon={<Icon as={FiHelpCircle} color="#7C3AED" boxSize={6} />}
              title="Summarize Notes"
              text="Allow our AI to summarize the recordings into easy study notes."
            />
            <Feature
              icon={<Icon as={FiBookOpen} color="#3B82F6" boxSize={6} />}
              title="Access Study Material"
              text="Automatically generate Flashcards, Multiple Choice Tests, and Short Answer Questions."
            />
          </Stack>

          <Flex align={"center"} justify={"center"} mt={{ base: -100 }}>
            <Image
              src="/fox-thumps_up-removebg-preview.png"
              alt="Fox mascot"
              maxW="480px"
            />
          </Flex>

          <Stack gap={8}>
            <Feature
              icon={<Icon as={FiZap} color="#F59E0B" boxSize={6} />}
              title="Study Faster"
              text="Spend less time making study material and more time studying!"
            />
            <Feature
              icon={<Icon as={TbBrain} color="#EC4899" boxSize={6} />}
              title="Study Smarter"
              text="Use the power of AI to maximize your study time and get the A you need."
            />
            <Feature
              icon={<Icon as={FiSearch} color="#2563EB" boxSize={6} />}
              title="Spot Weaknesses"
              text="Spot the weaknesses in your knowledge faster to get you ready for that final exam."
            />
          </Stack>
        </SimpleGrid>
      </Container>
    </Box>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Flex gap={4} align="flex-start">
      <Box pt={0.5}>{icon}</Box>
      <Box>
        <Text fontWeight="semibold" color="gray.900">
          {title}
        </Text>
        <Text mt={1} fontSize="sm" color="gray.600">
          {text}
        </Text>
      </Box>
    </Flex>
  );
}
