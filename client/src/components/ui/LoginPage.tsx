import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { FaFacebookF, FaGithub, FaLinkedinIn } from "react-icons/fa";
import { FiEye, FiEyeOff } from "react-icons/fi";

type LoginPageProps = {
  onLogin?: () => void;
  onGoogleLogin?: () => void;
  onGoToSignup?: () => void;
};

export default function LoginPage({
  onLogin,
  onGoogleLogin,
  onGoToSignup,
}: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);

  const inputStyle = {
    h: "44px",
    px: 4,
    borderRadius: "10px",
    bg: "white",
    borderWidth: "1px",
    borderColor: "gray.200",
    color: "gray.900",
    _placeholder: { color: "gray.400" },
    _hover: { borderColor: "gray.300" },
    _focusVisible: { borderColor: "#1877F2", boxShadow: "0 0 0 1px #1877F2" },
  } as const;

  return (
    <Box minH="100vh" bg="#FBE6DC" px={4} display="flex" alignItems="center">
      <Container maxW="md" py={{ base: 10, md: 14 }}>
        <Box
          bg="white"
          borderRadius="12px"
          boxShadow="0 10px 30px rgba(0,0,0,0.08)"
          borderWidth="1px"
          borderColor="blackAlpha.200"
          px={{ base: 6, md: 8 }}
          py={{ base: 7, md: 9 }}
        >
          <HStack gap={3} mb={6} justify={{ base: "center", md: "flex-start" }}>
            <Image src="/guide-fox.png" alt="Clever Fox" boxSize="34px" />
            <Text
              fontFamily="'Passero One', ui-sans-serif"
              fontSize="28px"
              color="gray.900"
            >
              clever Fox
            </Text>
          </HStack>

          <Heading
            as="h1"
            fontSize="22px"
            fontWeight="600"
            color="gray.900"
            mb={6}
            textAlign={{ base: "center", md: "left" }}
          >
            Login to your account
          </Heading>

          <Stack gap={4}>
            <Box>
              <Text fontSize="sm" color="gray.700" mb={2}>
                Email address
              </Text>
              <Input placeholder="Enter email" {...inputStyle} />
            </Box>

            <Box>
              <Text fontSize="sm" color="gray.700" mb={2}>
                Password
              </Text>
              <Box position="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  pr="44px"
                  {...inputStyle}
                />
                <IconButton
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  variant="ghost"
                  size="sm"
                  position="absolute"
                  right="8px"
                  top="50%"
                  transform="translateY(-50%)"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <Icon
                    as={showPassword ? FiEyeOff : FiEye}
                    boxSize={5}
                    color="gray.600"
                  />
                </IconButton>
              </Box>
            </Box>

            <Button
              mt={2}
              w="full"
              bg="#1877F2"
              color="white"
              h="44px"
              borderRadius="10px"
              _hover={{ bg: "#166fe5" }}
              onClick={onLogin}
            >
              Login
            </Button>

            <HStack justify="center" gap={2} pt={1}>
              <Text fontSize="sm" color="gray.500">
                Do not have an account?
              </Text>
              <Button
                variant="plain"
                color="#1877F2"
                fontSize="sm"
                fontWeight="500"
                p={0}
                h="auto"
                minH="auto"
                _hover={{ textDecoration: "underline" }}
                onClick={onGoToSignup}
              >
                Register now
              </Button>
            </HStack>

            <HStack gap={3} pt={2}>
              <Box flex="1" h="1px" bg="blackAlpha.300" />
              <Text fontSize="sm" color="gray.500" whiteSpace="nowrap">
                or
              </Text>
              <Box flex="1" h="1px" bg="blackAlpha.300" />
            </HStack>

            <Button
              w="full"
              variant="outline"
              borderWidth="1px"
              borderColor="gray.400"
              borderRadius="10px"
              _hover={{ bg: "gray.50", borderColor: "gray.500" }}
              onClick={onGoogleLogin}
            >
              <HStack w="full" justify="center" gap={2}>
                <Icon as={FcGoogle} boxSize={5} />
                <Text color="gray.900">Continue with Google</Text>
              </HStack>
            </Button>

            <HStack justify="center" gap={4} pt={1}>
              <IconButton
                aria-label="Facebook"
                variant="ghost"
                borderRadius="full"
              >
                <Icon as={FaFacebookF} boxSize={5} color="#1877F2" />
              </IconButton>
              <IconButton
                aria-label="GitHub"
                variant="ghost"
                borderRadius="full"
              >
                <Icon as={FaGithub} boxSize={5} color="gray.800" />
              </IconButton>
              <IconButton
                aria-label="LinkedIn"
                variant="ghost"
                borderRadius="full"
              >
                <Icon as={FaLinkedinIn} boxSize={5} color="#0A66C2" />
              </IconButton>
            </HStack>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
