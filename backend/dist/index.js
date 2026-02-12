import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { spotifyRouter } from "./routes/spotify.js";
import { aiRouter } from "./routes/ai/chat.js";
import { errorHandler } from "./middleware/error.js";
const app = express();
app.use(cors({
    origin: env.frontendOrigin,
    credentials: true,
}));
app.use(express.json());
app.use(healthRouter);
app.use(spotifyRouter);
app.use(aiRouter);
app.use(errorHandler);
app.listen(env.port, () => {
    console.log(`Backend listening on http://localhost:${env.port}`);
});
