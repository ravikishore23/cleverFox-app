import { useState } from "react";
import LandingPage from "./components/ui/LandingPage";
import LoginPage from "./components/ui/LoginPage";
import SignupPage from "./components/ui/SignupPage";
import StudyRoomPage from "./components/ui/StudyRoomPage";

type Screen = "landing" | "login" | "signup" | "studyroom";

type User = {
  name: string;
};

function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [user, setUser] = useState<User | null>(null);

  if (screen === "studyroom") {
    return (
      <StudyRoomPage
        user={user}
        onExit={() => setScreen("landing")}
      />
    );
  }

  if (screen === "login") {
    return (
      <LoginPage
        onLogin={() => {
          setUser({ name: "Ravi" });
          setScreen("landing");
        }}
        onGoogleLogin={() => {
          setUser({ name: "Ravi" });
          setScreen("landing");
        }}
        onGoToSignup={() => setScreen("signup")}
      />
    );
  }

  if (screen === "signup") {
    return (
      <SignupPage
        onRegister={() => {
          setUser({ name: "Ravi" });
          setScreen("landing");
        }}
        onGoToLogin={() => setScreen("login")}
      />
    );
  }

  return (
    <>
      <LandingPage
        onLogin={() => setScreen("login")}
        onSignup={() => setScreen("signup")}
        onStartFocus={() => setScreen(user ? "studyroom" : "login")}
        user={user}
      />
    </>
  );
}

export default App;
