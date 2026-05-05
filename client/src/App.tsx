import { useEffect, useState } from "react";
import LandingPage from "./components/ui/LandingPage";
import LoginPage from "./components/ui/LoginPage";
import SignupPage from "./components/ui/SignupPage";
import StudyRoomPage from "./components/ui/StudyRoomPage";

import {
  cleanSpotifyCallbackFromUrl,
  getDefaultRedirectUri,
  handleSpotifyOAuthCallback,
} from "./lib/spotify/auth";

type Screen = "landing" | "login" | "signup" | "studyroom";

type User = {
  name: string;
};

function isElectron(): boolean {
  // Exposed via Electron preload (see electron/preload.ts)
  return typeof window !== "undefined" && Boolean((window as any).cleverfox);
}

function App() {
  const [screen, setScreen] = useState<Screen>(
    isElectron() ? "landing" : "studyroom",
  );
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as
      | string
      | undefined;
    if (!clientId) return;

    const redirectUri = getDefaultRedirectUri();
    handleSpotifyOAuthCallback({ clientId, redirectUri })
      .catch(() => null)
      .finally(() => cleanSpotifyCallbackFromUrl());
  }, []);

  if (screen === "studyroom") {
    return <StudyRoomPage user={user} onExit={() => setScreen("landing")} />;
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
