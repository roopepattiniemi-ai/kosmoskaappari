import Phaser from "phaser";
import { Client, type Room } from "@colyseus/sdk";
import { copy } from "../shared/copy.js";
import { PIP_COST } from "../shared/balance.js";
import type { GameEvent } from "../shared/protocol.js";
import { SECTION_IDS, SECTIONS, isSectionId, type SectionId } from "../shared/sections.js";
import { ShipState } from "../server/schema.js";
import { sfx } from "./audio.js";
import { bridge } from "./bridge.js";
import { ShipScene } from "./game/ShipScene.js";
import { PuzzleController } from "./ui/puzzle.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const nameInput = $<HTMLInputElement>("name");
const codeInput = $<HTMLInputElement>("code");
const lobbyStatus = $("lobby-status");
const lobby = $("lobby");
const gameEl = $("game");
const alertEl = $("alert");
const endEl = $("end");

let room: Room | null = null;
let phaser: Phaser.Game | null = null;
let scene: ShipScene | null = null;
let lastLog = -1;
let lastPhase = "";
let puzzle: PuzzleController;

const SYSTEMS = [
  ["weapons", copy.weapons],
  ["shield", copy.shield],
  ["engines", copy.engines],
] as const;

function classify(): "desktop" | "portrait" | "landscape" {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w >= 1024 && h >= 680) return "desktop";
  return w > h ? "landscape" : "portrait";
}

function applyLayout(): void {
  document.body.dataset.layout = classify();
  phaser?.scale.refresh();
}

function endpoint(): string {
  if (import.meta.env.DEV) return `${location.protocol}//${location.hostname}:2567`;
  return location.origin;
}

function shareUrl(roomId: string): string {
  const url = new URL(location.href);
  url.searchParams.set("huone", roomId);
  return url.toString();
}

function setBar(id: string, ratio: number): void {
  const node = $(id);
  node.style.setProperty("--p", String(Math.max(0, Math.min(1, ratio))));
}

function buildSystems(): void {
  const root = $("systems");
  root.innerHTML = SYSTEMS.map(([key, label]) => `
    <div class="sys" data-sys="${key}">
      <span>${label}</span>
      <button type="button" class="wood" data-delta="-1">−</button>
      <div class="ebar"><img class="fill" alt="" src="/assets/v01/energiapalkki_tayte.png" /><img class="frame" alt="" src="/assets/v01/energiapalkki_kehys.png" /></div>
      <button type="button" class="wood" data-delta="1">+</button>
      <b>0</b>
    </div>`).join("");
  root.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    button.addEventListener("click", () => {
      const sys = button.closest<HTMLElement>(".sys")?.dataset.sys;
      const delta = Number(button.dataset.delta);
      if (!sys) return;
      sfx.tap();
      room?.send("alloc", { system: sys, delta });
    });
  });
}

function manned(state: ShipState, section: SectionId): boolean {
  let yes = false;
  state.players.forEach((player) => {
    if (!player.walking && player.section === section) yes = true;
  });
  return yes;
}

function render(state: ShipState): void {
  puzzle.update(state);
  const battle = state.battle;
  setBar("hull-bar", battle.playerHull / battle.playerMax);
  setBar("enemy-bar", battle.enemyHull / battle.enemyMax);
  $("hull-num").textContent = String(Math.ceil(battle.playerHull));
  $("enemy-num").textContent = String(Math.ceil(battle.enemyHull));
  const timer = $("enemy-timer");
  timer.textContent = copy.enemyGun(battle.enemyIn.toFixed(1));
  timer.classList.toggle("soon", battle.phase === "battle" && battle.enemyIn < 1.6);

  const energy = state.energy;
  const used = energy.weapons + energy.shield + energy.engines;
  for (const [key] of SYSTEMS) {
    const row = document.querySelector<HTMLElement>(`.sys[data-sys="${key}"]`);
    if (!row) continue;
    const value = energy[key];
    row.querySelector("b")!.textContent = String(value);
    const bar = row.querySelector<HTMLElement>(".ebar")!;
    bar.style.setProperty("--p", String(value / 4));
  }
  $("free-energy").textContent = `${copy.freeEnergy} ${Math.max(0, energy.pool - used)}`;
  setBar("pip-bar", energy.pool >= 8 ? 1 : energy.charge / PIP_COST);

  if (battle.logSeq !== lastLog) {
    lastLog = battle.logSeq;
    alertEl.textContent = battle.log;
    alertEl.classList.remove("pop", "bad", "good", "warn");
    void alertEl.offsetWidth;
    alertEl.classList.add("pop");
    if (/Osuma|petti|hajosi|tukossa/.test(battle.log)) alertEl.classList.add("bad");
    else if (/Laukaus|Energiaa|Väist|Kilpi|Voitto|upposi|Linja|TETRIS|Ketju|Pommi/.test(battle.log)) alertEl.classList.add("good");
  }

  const names: string[] = [];
  state.players.forEach((player, id) => {
    const where = isSectionId(player.section) ? SECTIONS[player.section].name : player.section;
    const who = id === room?.sessionId ? copy.you : player.name;
    names.push(`${who}: ${player.walking ? "…" : where}`);
  });
  $("crew-line").textContent = names.join("   ·   ");
  const eff = (label: string, on: boolean) => `${label} ${on ? "100" : "40"} %`;
  $("eff-line").textContent = [
    eff("Kilpi", manned(state, "suojakilpi")),
    eff("Moottorit", manned(state, "ohjaus")),
    eff("Korjaus", manned(state, "korjaamo")),
    eff("Sensorit", manned(state, "sensorit")),
  ].join(" · ");
  const me = state.players.get(room?.sessionId ?? "");
  $("ship-caption").textContent = me?.walking
    ? copy.walking(isSectionId(me.target) ? SECTIONS[me.target].name : me.target)
    : copy.tapShip;

  if (scene) {
    const crew = new Map<string, { x: number; y: number; walking: boolean; facing: number; color: number; name: string }>();
    state.players.forEach((player, id) => {
      crew.set(id, {
        x: player.x,
        y: player.y,
        walking: player.walking,
        facing: player.facing,
        color: player.color,
        name: player.name,
      });
    });
    scene.setCrew(crew);
  }

  if (battle.phase !== lastPhase) {
    const prev = lastPhase;
    lastPhase = battle.phase;
    const over = battle.phase === "victory" || battle.phase === "defeat";
    endEl.classList.toggle("hidden", !over);
    if (over) {
      $("end-title").textContent = battle.phase === "victory" ? copy.victoryTitle : copy.defeatTitle;
      $("end-body").textContent = battle.phase === "victory" ? copy.victoryBody : copy.defeatBody;
      if (prev && prev !== battle.phase) (battle.phase === "victory" ? sfx.win : sfx.lose)();
    }
  }
}

function bootPhaser(): void {
  if (phaser) {
    phaser.scale.refresh();
    return;
  }
  phaser = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "phaser",
    backgroundColor: "#0c0b0d",
    banner: false,
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: 960, height: 540 },
    scene: [ShipScene],
    input: { activePointers: 3 },
  });
}

async function connect(mode: "create" | "join"): Promise<void> {
  const name = nameInput.value.trim() || "Merirosvo";
  sessionStorage.setItem("kosmos-name", name);
  lobbyStatus.textContent = copy.connecting;
  const client = new Client(endpoint());
  try {
    if (mode === "create") room = await client.create("ship", { name }, ShipState);
    else {
      const id = codeInput.value.trim();
      if (!id) {
        lobbyStatus.textContent = copy.missing;
        return;
      }
      room = await client.joinById(id, { name }, ShipState);
    }
  } catch (error) {
    const text = String((error as Error)?.message ?? error);
    lobbyStatus.textContent = /full|max|exceed/i.test(text) ? copy.full : copy.missing;
    return;
  }
  bridge.sessionId = room.sessionId;
  puzzle.setSession(room.sessionId);
  const url = shareUrl(room.roomId);
  history.replaceState(null, "", url);
  codeInput.value = room.roomId;
  lobby.classList.add("hidden");
  gameEl.classList.remove("hidden");
  applyLayout();
  requestAnimationFrame(() => bootPhaser());

  const joined = room;
  joined.onStateChange((state) => render(state as ShipState));
  joined.onMessage("reactor", (message: Extract<GameEvent, { type: "reactor" }>) => puzzle.onReactor(message));
  joined.onMessage("clear", (message: Extract<GameEvent, { type: "clear" }>) => puzzle.onClear(message));
  joined.onMessage("fx", (message: Extract<GameEvent, { type: "fx" }>) => {
    scene?.playFx(message.kind, message.amount);
    if (message.kind === "laser-me" || message.kind === "laser-them") sfx.laser();
    if (message.kind === "boom") sfx.boom();
    if (message.kind === "shield") sfx.shield();
    if (message.kind === "dodge") sfx.rotate();
    if (message.amount >= 12) gameEl.classList.add("shake");
  });
  joined.onDrop(() => {
    alertEl.textContent = copy.dropped;
    alertEl.classList.add("warn");
  });
  joined.onReconnect(() => {
    alertEl.textContent = "Yhteys palasi.";
    alertEl.classList.remove("warn");
  });
  joined.onLeave(() => {
    gameEl.classList.add("hidden");
    lobby.classList.remove("hidden");
    lobbyStatus.textContent = copy.left;
    room = null;
  });
  render(joined.state as ShipState);
}

function typing(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

nameInput.value = sessionStorage.getItem("kosmos-name") ?? "";
const params = new URLSearchParams(location.search);
if (params.get("huone")) codeInput.value = params.get("huone") ?? "";
buildSystems();

puzzle = new PuzzleController(
  $("puzzle-body"),
  $("puzzle-head"),
  $("board-slot"),
  document.querySelector(".pad.left") as HTMLElement,
  document.querySelector(".pad.right") as HTMLElement,
  (type, payload) => room?.send(type, payload),
);

$("create").addEventListener("click", () => void connect("create"));
$("join").addEventListener("click", () => void connect("join"));
$("restart").addEventListener("click", () => {
  sfx.tap();
  room?.send("restart");
});
$("share").addEventListener("click", async () => {
  const url = room ? shareUrl(room.roomId) : location.href;
  try {
    await navigator.clipboard.writeText(url);
    $("share").textContent = copy.copied;
  } catch {
    codeInput.value = room?.roomId ?? codeInput.value;
    lobbyStatus.textContent = url;
  }
  window.setTimeout(() => {
    $("share").textContent = copy.share;
  }, 1600);
});
$("mute").addEventListener("click", () => {
  const off = sfx.toggle();
  $("mute").textContent = off ? copy.soundOn : copy.soundOff;
});
$("mute").textContent = sfx.muted ? copy.soundOn : copy.soundOff;

document.body.addEventListener("pointerdown", () => sfx.unlock(), { once: false });
window.addEventListener("resize", applyLayout);
window.addEventListener("orientationchange", applyLayout);
applyLayout();

window.addEventListener("keydown", (event) => {
  if (!room || typing()) return;
  if (/^[1-6]$/.test(event.key)) {
    const section = SECTION_IDS[Number(event.key) - 1];
    if (section) {
      sfx.tap();
      room.send("go", { section });
    }
    return;
  }
  puzzle.key(event);
});

bridge.onSection = (section) => {
  sfx.tap();
  room?.send("go", { section });
};
bridge.onReady = (next) => {
  scene = next as ShipScene;
  if (room) render(room.state as ShipState);
};

if (params.get("huone") && nameInput.value.trim()) {
  void connect("join");
}
