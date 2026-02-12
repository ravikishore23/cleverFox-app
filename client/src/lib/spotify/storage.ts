const TOKEN_KEY = "cleverfox.spotify.token";
const PKCE_VERIFIER_KEY = "cleverfox.spotify.pkce.verifier";
const STATE_KEY = "cleverfox.spotify.oauth.state";

export type SpotifyToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  obtained_at: number; // epoch ms
};

export function savePkceVerifier(verifier: string) {
  localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
}

export function readPkceVerifier() {
  return localStorage.getItem(PKCE_VERIFIER_KEY);
}

export function clearPkceVerifier() {
  localStorage.removeItem(PKCE_VERIFIER_KEY);
}

export function saveOauthState(state: string) {
  localStorage.setItem(STATE_KEY, state);
}

export function readOauthState() {
  return localStorage.getItem(STATE_KEY);
}

export function clearOauthState() {
  localStorage.removeItem(STATE_KEY);
}

export function saveToken(token: Omit<SpotifyToken, "obtained_at">) {
  const full: SpotifyToken = { ...token, obtained_at: Date.now() };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(full));
  return full;
}

export function readToken(): SpotifyToken | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SpotifyToken;
  } catch {
    return null;
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isTokenExpired(token: SpotifyToken) {
  // refresh 60s early
  const expiresAt = token.obtained_at + token.expires_in * 1000;
  return Date.now() > expiresAt - 60_000;
}
