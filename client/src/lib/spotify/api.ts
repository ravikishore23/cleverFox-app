import { type SpotifyToken } from "./storage";

export type SpotifyMe = {
  display_name?: string;
  id?: string;
};

export async function spotifyMe(
  token: SpotifyToken,
): Promise<SpotifyMe | null> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as SpotifyMe;
}

export async function spotifyPlayUri(token: SpotifyToken, uri: string) {
  // Plays on the user's *active* Spotify device (desktop app / phone / web player).
  // If there's no active device, Spotify returns 404.
  const res = await fetch("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: [uri] }),
  });

  return {
    ok: res.ok,
    status: res.status,
    body: await (async () => {
      try {
        return await res.json();
      } catch {
        return null;
      }
    })(),
  };
}

export async function spotifyPause(token: SpotifyToken) {
  const res = await fetch("https://api.spotify.com/v1/me/player/pause", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  });
  return res.ok;
}
