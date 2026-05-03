import dotenv from "dotenv";

dotenv.config();

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:5173",
  mongodbUri: process.env.MONGODB_URI ?? process.env.MONGODB_URL,
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  spotifyRedirectUri: process.env.SPOTIFY_REDIRECT_URI,
  // Toggle to enable the local agent feature. Default: enabled.
  localAgentEnabled: (process.env.LOCAL_AGENT_ENABLED ?? "true") === "true",
  // Path to the user's Obsidian vault (for agent file writes).
  // Defaults to ~/Documents/CleverFox_Notes if not set.
  obsidianVaultPath: process.env.OBSIDIAN_VAULT_PATH ||
    (process.env.USERPROFILE
      ? `${process.env.USERPROFILE}\\Documents\\CleverFox_Notes`
      : ""),
  // Directory for agent-generated code files.
  codeWorkspacePath: process.env.CODE_WORKSPACE_PATH ||
    (process.env.USERPROFILE
      ? `${process.env.USERPROFILE}\\Documents\\CleverFox_Code`
      : ""),
  readRequired,
};
