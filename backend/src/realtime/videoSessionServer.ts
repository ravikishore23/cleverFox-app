import { Server } from "socket.io";
import type { Server as HTTPServer } from "node:http";

interface PeerInfo {
  socketId: string;
  name: string;
}

interface SessionJoinedPayload {
  sessionId: string;
  selfId: string;
  participants: PeerInfo[];
}

type SessionAck = (
  res:
    | { ok: true; data: SessionJoinedPayload }
    | { ok: false; error: string }
) => void;

interface SessionData {
  id: string;
  participants: Map<string, PeerInfo>;
}

const sessions = new Map<string, SessionData>();
const socketToSession = new Map<string, string>();

function generateSessionId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function attachVideoSessionServer(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on(
      "video:create-session",
      (payload: { name: string } | undefined, ack?: SessionAck | null) => {
        const name = payload?.name || "Guest";
        let sessionId = generateSessionId();
        while (sessions.has(sessionId)) {
          sessionId = generateSessionId();
        }

        const sessionData: SessionData = {
          id: sessionId,
          participants: new Map(),
        };

        sessionData.participants.set(socket.id, { socketId: socket.id, name });
        sessions.set(sessionId, sessionData);
        socketToSession.set(socket.id, sessionId);
        socket.join(sessionId);

        const data: SessionJoinedPayload = {
          sessionId,
          selfId: socket.id,
          participants: [],
        };

        if (typeof ack === "function") {
          ack({ ok: true, data });
        }
        
        socket.emit("video:session-joined", data);
      }
    );

    socket.on(
      "video:join-session",
      (payload?: { sessionId: string; name: string }, ack?: SessionAck | null) => {
        if (!payload || !payload.sessionId) {
          if (typeof ack === "function") ack({ ok: false, error: "Session ID required" });
          return socket.emit("video:error", { message: "Session ID required" });
        }

        const sessionId = payload.sessionId.toUpperCase();
        const sessionData = sessions.get(sessionId);

        if (!sessionData) {
          if (typeof ack === "function") ack({ ok: false, error: "Session not found" });
          return socket.emit("video:error", { message: "Session not found" });
        }

        const name = payload.name || "Guest";
        const peerInfo: PeerInfo = { socketId: socket.id, name };

        const participantsList: PeerInfo[] = Array.from(sessionData.participants.values());

        sessionData.participants.set(socket.id, peerInfo);
        socketToSession.set(socket.id, sessionId);
        socket.join(sessionId);

        const data: SessionJoinedPayload = {
          sessionId,
          selfId: socket.id,
          participants: participantsList,
        };

        if (typeof ack === "function") {
          ack({ ok: true, data });
        }

        socket.emit("video:session-joined", data);
        socket.to(sessionId).emit("video:participant-joined", peerInfo);
      }
    );

    socket.on("video:leave-session", () => {
      const sessionId = socketToSession.get(socket.id);
      if (sessionId) {
        const sessionData = sessions.get(sessionId);
        if (sessionData) {
          sessionData.participants.delete(socket.id);
          if (sessionData.participants.size === 0) {
            sessions.delete(sessionId);
          } else {
            socket.to(sessionId).emit("video:participant-left", { socketId: socket.id });
          }
        }
        socket.leave(sessionId);
        socketToSession.delete(socket.id);
      }
    });

    socket.on("video:signal-offer", (payload: { to: string; sdp: Record<string, unknown> }) => {
      socket.to(payload.to).emit("video:signal-offer", {
        from: socket.id,
        sdp: payload.sdp,
      });
    });

    socket.on("video:signal-answer", (payload: { to: string; sdp: Record<string, unknown> }) => {
      socket.to(payload.to).emit("video:signal-answer", {
        from: socket.id,
        sdp: payload.sdp,
      });
    });

    socket.on("video:signal-ice", (payload: { to: string; candidate: Record<string, unknown> }) => {
      socket.to(payload.to).emit("video:signal-ice", {
        from: socket.id,
        candidate: payload.candidate,
      });
    });

    socket.on("disconnect", () => {
      const sessionId = socketToSession.get(socket.id);
      if (sessionId) {
        const sessionData = sessions.get(sessionId);
        if (sessionData) {
          sessionData.participants.delete(socket.id);
          if (sessionData.participants.size === 0) {
            sessions.delete(sessionId);
          } else {
            socket.to(sessionId).emit("video:participant-left", { socketId: socket.id });
          }
        }
        socketToSession.delete(socket.id);
      }
    });
  });
}
