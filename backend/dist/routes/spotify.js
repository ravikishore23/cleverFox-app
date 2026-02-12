import { Router } from "express";
export const spotifyRouter = Router();
spotifyRouter.get("/spotify/status", (_req, res) => {
    res.status(501).json({ ok: false, error: "Not implemented" });
});
