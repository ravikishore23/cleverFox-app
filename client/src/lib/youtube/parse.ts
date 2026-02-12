export type YouTubeParsed =
  | { kind: "video"; id: string }
  | { kind: "playlist"; id: string };

function safeUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function getHost(u: URL) {
  return u.hostname.replace(/^www\./i, "").toLowerCase();
}

export function parseYouTubeUrl(url: string): YouTubeParsed | null {
  const u = safeUrl(url);
  if (!u) return null;

  const host = getHost(u);
  const isYouTube =
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com";
  const isShort = host === "youtu.be";

  if (!isYouTube && !isShort) return null;

  const v = u.searchParams.get("v");
  const list = u.searchParams.get("list");

  // Playlist link
  if (list && !v) return { kind: "playlist", id: list };

  // Watch link with video
  if (v) return { kind: "video", id: v };

  // Shorts
  const shorts = u.pathname.match(/^\/shorts\/([^/?#]+)/)?.[1];
  if (shorts) return { kind: "video", id: shorts };

  // youtu.be/<id>
  if (isShort) {
    const id = u.pathname.replace(/^\//, "").split("/")[0];
    if (id) return { kind: "video", id };
  }

  return null;
}

export function toYouTubeEmbedUrl(url: string): string | null {
  const parsed = parseYouTubeUrl(url);
  if (!parsed) return null;

  if (parsed.kind === "playlist") {
    return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(parsed.id)}&rel=0`;
  }

  return `https://www.youtube.com/embed/${encodeURIComponent(parsed.id)}?rel=0`;
}
