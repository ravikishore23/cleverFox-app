export type SpotifyLinkType =
  | "track"
  | "album"
  | "playlist"
  | "artist"
  | "episode"
  | "show";

export function parseSpotifyUrlToUri(
  url: string,
): { uri: string; type: SpotifyLinkType; id: string } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // spotify:track:ID
  const uriMatch = trimmed.match(
    /^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)$/,
  );
  if (uriMatch) {
    const type = uriMatch[1] as SpotifyLinkType;
    const id = uriMatch[2];
    return { uri: `spotify:${type}:${id}`, type, id };
  }

  try {
    const u = new URL(trimmed);
    if (u.hostname !== "open.spotify.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const type = parts[0] as SpotifyLinkType;
    const id = parts[1];
    if (!id) return null;
    if (
      !["track", "album", "playlist", "artist", "episode", "show"].includes(
        type,
      )
    ) {
      return null;
    }
    return { uri: `spotify:${type}:${id}`, type, id };
  } catch {
    return null;
  }
}

export function toSpotifyEmbedUrl(urlOrUri: string) {
  const parsed = parseSpotifyUrlToUri(urlOrUri);
  if (!parsed) return null;
  return `https://open.spotify.com/embed/${parsed.type}/${parsed.id}`;
}
