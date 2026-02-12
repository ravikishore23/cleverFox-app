import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Icon,
  Image,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { FiEye, FiEyeOff } from "react-icons/fi";

type SignupPageProps = {
  onRegister?: () => void;
  onGoToLogin?: () => void;
};

export default function SignupPage({
  onRegister,
  onGoToLogin,
}: SignupPageProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const passwordRules = useMemo(() => {
    const hasMinLength = password.length >= 8;
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    return { hasMinLength, hasLetter, hasNumber, hasSpecial };
  }, [password]);

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
            Register a new user
          </Heading>

          <Stack gap={4}>
            <Box>
              <Text fontSize="sm" color="gray.700" mb={2}>
                Name
              </Text>
              <Input placeholder="Enter name" {...inputStyle} />
            </Box>

            <Box>
              <Text fontSize="sm" color="gray.700" mb={2}>
                Mobile
              </Text>
              <Input placeholder="Enter mobile number" {...inputStyle} />
            </Box>

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
                  placeholder="Enter a strong password"
                  pr="44px"
                  {...inputStyle}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  variant="ghost"
                  size="sm"
                  position="absolute"
                  right="8px"
                  top="50%"
                  transform="translateY(-50%)"
                  minW="auto"
                  px={2}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <Icon
                    as={showPassword ? FiEyeOff : FiEye}
                    boxSize={5}
                    color="gray.600"
                  />
                </Button>
              </Box>
              {password.length > 0 && (
                <Box mt={3} borderRadius="8px" bg="gray.50" p={3}>
                  <Text fontSize="xs" color="gray.700" fontWeight="600" mb={2}>
                    Password must include:
                  </Text>
                  <Stack gap={1}>
                    <Rule
                      ok={passwordRules.hasMinLength}
                      text="At least 8 characters"
                    />
                    <Rule ok={passwordRules.hasLetter} text="A letter (A-Z)" />
                    <Rule ok={passwordRules.hasNumber} text="A number (0-9)" />
                    <Rule
                      ok={passwordRules.hasSpecial}
                      text="A special character (e.g. @, #, $)"
                    />
                  </Stack>
                </Box>
              )}
            </Box>

            <Box>
              <Text fontSize="sm" color="gray.700" mb={2}>
                Confirm password
              </Text>
              <Box position="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Enter password again"
                  pr="44px"
                  {...inputStyle}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                  variant="ghost"
                  size="sm"
                  position="absolute"
                  right="8px"
                  top="50%"
                  transform="translateY(-50%)"
                  minW="auto"
                  px={2}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                >
                  <Icon
                    as={showConfirmPassword ? FiEyeOff : FiEye}
                    boxSize={5}
                    color="gray.600"
                  />
                </Button>
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
              onClick={onRegister}
            >
              Register
            </Button>

            <HStack justify="center" gap={2} pt={1}>
              <Text fontSize="sm" color="gray.500">
                Have an account already?
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
                onClick={onGoToLogin}
              >
                Login
              </Button>
            </HStack>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <HStack gap={2} align="center">
      <Icon
        as={FaCheckCircle}
        boxSize={3.5}
        color={ok ? "green.500" : "gray.300"}
      />
      <Text fontSize="xs" color={ok ? "green.700" : "gray.600"}>
        {text}
      </Text>
    </HStack>
  );
}
