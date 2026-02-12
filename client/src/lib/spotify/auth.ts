import { randomString, sha256Base64Url } from "./pkce";
import {
  clearOauthState,
  clearPkceVerifier,
  readOauthState,
  readPkceVerifier,
  saveOauthState,
  savePkceVerifier,
  saveToken,
  type SpotifyToken,
} from "./storage";

const SPOTIFY_ACCOUNTS = "https://accounts.spotify.com";

export type SpotifyAuthConfig = {
  clientId: string;
  redirectUri: string;
};

export function getDefaultRedirectUri() {
  // Easiest for your current app (no router): redirect to the same origin.
  // Spotify allows http://localhost and http://127.0.0.1 for dev.
  return window.location.origin;
}

export async function startSpotifyLogin(config: SpotifyAuthConfig) {
  const state = randomString(24);
  const verifier = randomString(64);
  const challenge = await sha256Base64Url(verifier);

  saveOauthState(state);
  savePkceVerifier(verifier);

  const scopes = [
    "user-read-private",
    "user-read-email",
    "user-read-playback-state",
    "user-modify-playback-state",
  ];

  const authUrl = new URL(`${SPOTIFY_ACCOUNTS}/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", challenge);

  window.location.assign(authUrl.toString());
}

export async function handleSpotifyOAuthCallback(
  config: SpotifyAuthConfig,
): Promise<SpotifyToken | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error) {
    clearOauthState();
    clearPkceVerifier();
    return null;
  }

  if (!code) return null;

  const expectedState = readOauthState();
  if (!expectedState || state !== expectedState) {
    clearOauthState();
    clearPkceVerifier();
    return null;
  }

  const verifier = readPkceVerifier();
  if (!verifier) {
    clearOauthState();
    return null;
  }

  const body = new URLSearchParams();
  body.set("client_id", config.clientId);
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", config.redirectUri);
  body.set("code_verifier", verifier);

  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    clearOauthState();
    clearPkceVerifier();
    return null;
  }

  const token = (await res.json()) as Omit<SpotifyToken, "obtained_at">;
  clearOauthState();
  clearPkceVerifier();
  return saveToken(token);
}

export function cleanSpotifyCallbackFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("code") && !url.searchParams.has("error")) return;
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  window.history.replaceState({}, document.title, url.toString());
}
