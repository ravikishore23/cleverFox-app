import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { spotifyRouter } from "./routes/spotify.js";
import { aiRouter } from "./routes/ai/chat.js";
import { agentRouter } from "./routes/ai/agent.js";
import { routeRouter } from "./routes/ai/route.js";
import { tasksRouter } from "./routes/tasks.js";
import { notesRouter } from "./routes/notes.js";
import { scheduleRouter } from "./routes/schedule.js";
import { errorHandler } from "./middleware/error.js";
import { connectMongo } from "./db/mongo.js";
import { attachVideoSessionServer } from "./realtime/videoSessionServer.js";

const app = express();

function buildAllowedOrigins(): Set<string> {
  const raw = env.frontendOrigin;
  const allowed = new Set<string>();
  allowed.add(raw);

  // Common dev variants that otherwise cause CORS “Failed to fetch”.
  // e.g. frontend runs on http://localhost:5173 while env default is 127.0.0.1
  allowed.add(raw.replace("127.0.0.1", "localhost"));
  allowed.add(raw.replace("localhost", "127.0.0.1"));

  // Electron / file-based origins often show up as "null".
  allowed.add("null");

  return allowed;
}

const allowedOrigins = buildAllowedOrigins();
const devLoopbackOrigin = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/;
// When Vite runs with `--host`, the browser origin is often a LAN IP like
// http://192.168.1.20:5173, which otherwise triggers CORS “Failed to fetch”.
const devLanOrigin =
  /^http:\/\/(10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.(?:\d{1,3}\.)\d{1,3}):\d+$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser clients (curl/postman) may not send Origin.
      if (!origin) return callback(null, true);
      // Vite may auto-pick a different port if 5173 is taken.
      if (devLoopbackOrigin.test(origin)) return callback(null, true);
      if (devLanOrigin.test(origin)) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json());

app.use(healthRouter);
app.use(spotifyRouter);
app.use(aiRouter);
// Mount agent routes only when explicitly enabled.
if (env.localAgentEnabled) {
  app.use(agentRouter);
}
// Intent routing (classify whether to route to chat or agent)
app.use(routeRouter);
app.use(tasksRouter);
app.use(notesRouter);
app.use(scheduleRouter);

app.use(errorHandler);

const server = createServer(app);
attachVideoSessionServer(server);

server.listen(env.port, "0.0.0.0", () => {
  console.log(`Backend listening on http://0.0.0.0:${env.port}`);
  void connectMongo();
});
