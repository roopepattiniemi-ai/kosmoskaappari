import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineRoom, defineServer, type Server } from "colyseus";
import express, { type NextFunction, type Request, type Response } from "express";
import { DuelRoom, waitingDuelId } from "./rooms/DuelRoom.js";
import { ShipRoom } from "./rooms/ShipRoom.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
/** Repo root both for `tsx src/server` and `node dist/server`. */
const repoRoot = path.resolve(moduleDir, "../..");
const clientDir = path.join(repoRoot, "dist", "client");
const assetsDir = path.join(repoRoot, "assets");

export function createGameServer(): Server {
  return defineServer({
    greet: process.env.KOSMOS_TEST !== "1",
    rooms: {
      ship: defineRoom(ShipRoom),
      duel: defineRoom(DuelRoom),
    },
    express: (app) => {
      app.get("/match/duel", (_req: Request, res: Response) => {
        res.json({ roomId: waitingDuelId() });
      });
      app.use("/assets", express.static(assetsDir, { fallthrough: true, index: false }));
      if (existsSync(clientDir)) {
        app.use(express.static(clientDir, { index: "index.html", fallthrough: true }));
        app.use((req: Request, res: Response, next: NextFunction) => {
          if (req.method !== "GET" && req.method !== "HEAD") return next();
          if (req.path.startsWith("/matchmake") || req.path.startsWith("/assets")) return next();
          const file = path.join(clientDir, "index.html");
          if (!existsSync(file)) return next();
          res.sendFile(file);
        });
      }
    },
  });
}

export async function start(port = Number(process.env.PORT) || 2567): Promise<Server> {
  const server = createGameServer();
  await server.listen(port, "0.0.0.0");
  if (process.env.KOSMOS_TEST !== "1") {
    console.log(`Kosmoskaappari kuuntelee osoitteessa http://0.0.0.0:${port}`);
  }
  return server;
}

const entry = process.argv[1]?.replace(/\\/g, "/") ?? "";
if (/\/index\.(ts|js)$/.test(entry) && import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
