import { Server } from "socket.io";
const sessions = new Map();
function normalizeSessionId(value) {
    return String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, "")
        .slice(0, 20);
}
function createSessionId() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i += 1) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
function ensureSession(sessionId) {
    let room = sessions.get(sessionId);
    if (!room) {
        room = new Map();
        sessions.set(sessionId, room);
    }
    return room;
}
function removeParticipant(sessionId, socketId) {
    const room = sessions.get(sessionId);
    if (!room)
        return;
    room.delete(socketId);
    if (room.size === 0) {
        sessions.delete(sessionId);
    }
}
export function attachVideoSessionServer(server) {
    const io = new Server(server, {
        path: "/socket.io",
        cors: {
            origin: true,
            credentials: true,
        },
    });
    io.on("connection", (socket) => {
        let currentSessionId = "";
        socket.on("video:create-session", ({ name } = {}, ack) => {
            const sessionId = createSessionId();
            const displayName = String(name || "Guest").trim().slice(0, 40) || "Guest";
            const room = ensureSession(sessionId);
            room.set(socket.id, { socketId: socket.id, name: displayName });
            currentSessionId = sessionId;
            void socket.join(sessionId);
            const payload = {
                sessionId,
                selfId: socket.id,
                participants: [],
            };
            if (ack) {
                ack({ ok: true, data: payload });
            }
            else {
                socket.emit("video:session-joined", payload);
            }
        });
        socket.on("video:join-session", ({ sessionId, name } = {}, ack) => {
            const normalized = normalizeSessionId(sessionId || "");
            if (!normalized) {
                ack?.({ ok: false, message: "Invalid session code" });
                socket.emit("video:error", { message: "Invalid session code" });
                return;
            }
            const displayName = String(name || "Guest").trim().slice(0, 40) || "Guest";
            const room = ensureSession(normalized);
            const existingParticipants = Array.from(room.values());
            room.set(socket.id, { socketId: socket.id, name: displayName });
            currentSessionId = normalized;
            void socket.join(normalized);
            const payload = {
                sessionId: normalized,
                selfId: socket.id,
                participants: existingParticipants,
            };
            if (ack) {
                ack({ ok: true, data: payload });
            }
            else {
                socket.emit("video:session-joined", payload);
            }
            socket.to(normalized).emit("video:participant-joined", {
                socketId: socket.id,
                name: displayName,
            });
        });
        socket.on("video:leave-session", () => {
            if (!currentSessionId)
                return;
            const sessionId = currentSessionId;
            removeParticipant(sessionId, socket.id);
            void socket.leave(sessionId);
            socket.to(sessionId).emit("video:participant-left", { socketId: socket.id });
            currentSessionId = "";
        });
        socket.on("video:signal-offer", ({ to, sdp }) => {
            if (!to || !currentSessionId || !sdp)
                return;
            io.to(to).emit("video:signal-offer", {
                from: socket.id,
                sdp,
            });
        });
        socket.on("video:signal-answer", ({ to, sdp }) => {
            if (!to || !currentSessionId || !sdp)
                return;
            io.to(to).emit("video:signal-answer", {
                from: socket.id,
                sdp,
            });
        });
        socket.on("video:signal-ice", ({ to, candidate }) => {
            if (!to || !currentSessionId || !candidate)
                return;
            io.to(to).emit("video:signal-ice", {
                from: socket.id,
                candidate,
            });
        });
        socket.on("disconnect", () => {
            if (!currentSessionId)
                return;
            const sessionId = currentSessionId;
            removeParticipant(sessionId, socket.id);
            socket.to(sessionId).emit("video:participant-left", { socketId: socket.id });
            currentSessionId = "";
        });
    });
    return io;
}
