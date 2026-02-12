function base64UrlEncode(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function randomString(length = 64) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = new Uint8Array(length);
  globalThis.crypto.getRandomValues(values);
  let result = "";
  for (const v of values) result += charset[v % charset.length];
  return result;
}

export async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}
