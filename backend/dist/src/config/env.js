import dotenv from "dotenv";
dotenv.config();
function readRequired(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`Missing env var: ${name}`);
    return value;
}
export const env = {
    port: Number(process.env.PORT ?? 3001),
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:5173",
    mongodbUri: process.env.MONGODB_URI ?? process.env.MONGODB_URL,
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    spotifyRedirectUri: process.env.SPOTIFY_REDIRECT_URI,
    readRequired,
};
