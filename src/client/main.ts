import Phaser from "phaser";
import { Client, type Room } from "@colyseus/sdk";
import { copy } from "../shared/copy.js";
import { PIP_COST } from "../shared/balance.js";
import type { GameEvent } from "../shared/protocol.js";
import { parseMounts, parseSystems } from "../shared/hardpoints.js";
import { musicTrack } from "../shared/music.js";
import { parseMap } from "../shared/run.js";
import { parseIntegrity } from "../shared/stations.js";
import { SECTION_IDS, SECTIONS, isSectionId, type SectionId } from "../shared/sections.js";
import { assetUrl, manifest } from "../shared/assets.js";
import { DuelState, ShipState } from "../server/schema.js";
import { sfx } from "./audio.js";
import { bridge } from "./bridge.js";
import { ShipScene } from "./game/ShipScene.js";
import { mountBoarding, renderBoarding } from "./ui/boardingView.js";
import { mountDuel, renderDuel } from "./ui/duelView.js";
import { PuzzleController } from "./ui/puzzle.js";
import { mountRun, renderRun } from "./ui/runview.js";

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
let prevState: { fuel: number; crystals: number; node: number; hull: number; levels: string; alarmed: boolean } | null = null;
let lastStep = 0;
let lastBoard = false;
let duelLog = -1;

const SYSTEMS = [
  ["weapons", copy.weapons],
  ["shield", copy.shield],
  ["engines", copy.engines],
  ["repair", copy.repairSys],
  ["sensors", copy.sensorsSys],
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
  setBar("bubble-bar", battle.enemyShieldMax > 0 ? battle.enemyShield / battle.enemyShieldMax : 0);
  $("stash").textContent = `Polttoaine ${state.run.fuel} · Kiteet ${state.run.crystals}`;
  const timer = $("enemy-timer");
  const strike = state.stations.revealed
    ? SECTIONS[SECTION_IDS[state.stations.target] ?? "aseet"].name
    : "";
  timer.textContent = strike
    ? `Isku: ${strike} ${battle.enemyIn.toFixed(1)}`
    : copy.enemyGun(battle.enemyIn.toFixed(1));
  timer.classList.toggle("soon", battle.phase === "battle" && battle.enemyIn < 1.6);

  const energy = state.energy;
  const used = energy.weapons + energy.shield + energy.engines + energy.repair + energy.sensors;
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
    if (/Osuma|petti|hajosi|tukossa|eivät riitä|loppu/.test(battle.log)) alertEl.classList.add("bad");
    else if (/Laukaus|Energiaa|Väist|Kilpi|Voitto|upposi|Linja|TETRIS|Ketju|Pommi|Saalis|päivitetty|paikattu|Hyppy|Kauppa/.test(battle.log)) alertEl.classList.add("good");
    if (/nappasi|lukossa|Lähellä|Lukitus/.test(battle.log)) sfx.match();
    if (/ohi|hukassa|harassa|Väärä/.test(battle.log)) sfx.bad();
    if (/paikattu/.test(battle.log)) sfx.repair();
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

  scene?.setCracks(parseIntegrity(state.stations.hulls));
  scene?.setCombat(
    parseMounts(state.run.mounts),
    state.weapons.charges.split(",").map((value) => Number(value) || 0),
    parseSystems(state.battle.enemySys),
    state.battle.enemyShield,
    state.battle.enemyShieldMax,
    state.battle.aim,
  );
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

  const screen = state.run.screen;
  const over = battle.phase === "victory" || battle.phase === "defeat";
  endEl.classList.toggle("hidden", !over);
  const restart = $<HTMLButtonElement>("restart");
  if (over) {
    const wonRun = screen === "won" || battle.phase === "defeat";
    $("end-title").textContent = battle.phase === "victory" ? (screen === "won" ? "Kierros voitettu" : copy.victoryTitle) : copy.defeatTitle;
    $("end-body").textContent = battle.phase === "victory"
      ? (screen === "won" ? "Viimeinen pomo kaatui. Saalis on teidän." : "Saalis on ruumassa. Kartta odottaa.")
      : "Runko petti. Kierros päättyi.";
    restart.textContent = wonRun ? "Uusi kierros" : "Kartalle";
    restart.dataset.mode = wonRun ? "restart" : "continue";
  }
  if (battle.phase !== lastPhase) {
    const prev = lastPhase;
    lastPhase = battle.phase;
    if (over && prev && prev !== battle.phase) (battle.phase === "victory" ? sfx.win : sfx.lose)();
  }
  renderRun($("run"), state);
  const node = parseMap(state.run.map).find((item) => item.id === state.run.node);
  sfx.musicTrack(musicTrack({ inGame: true, phase: battle.phase, screen, boss: node?.type === "boss" }));
  const levels = [state.run.reactor, state.run.weapons, state.run.shield, state.run.helm, state.run.repair, state.run.sensors].join(",");
  if (prevState) {
    if (state.run.node !== prevState.node && state.run.fuel < prevState.fuel) sfx.jump();
    if (state.run.crystals > prevState.crystals) sfx.crystal();
    else if (state.run.crystals < prevState.crystals) {
      if (levels !== prevState.levels) sfx.upgrade();
      else if (battle.playerHull > prevState.hull + 0.5) sfx.repair();
      else sfx.buy();
    }
  }
  const low = battle.phase === "battle" && battle.playerHull / battle.playerMax < 0.3;
  if (low && !prevState?.alarmed) sfx.alarm();
  prevState = { fuel: state.run.fuel, crystals: state.run.crystals, node: state.run.node, hull: battle.playerHull, levels, alarmed: low && battle.phase === "battle" };
  const meNow = state.players.get(room?.sessionId ?? "");
  if (meNow?.walking && performance.now() - lastStep > 520) {
    lastStep = performance.now();
    sfx.step();
  }
  const boarding = state.boarding;
  $<HTMLButtonElement>("board-now").classList.toggle("hidden", battle.phase !== "battle" || battle.enemyShield > 1);
  renderBoarding($("boarding"), state);
  const march = $("march");
  march.classList.toggle("hidden", !boarding.on);
  march.classList.toggle("in", boarding.role === "defend");
  if (boarding.on && march.childElementCount === 0) {
    march.innerHTML = [0, 1, 2]
      .map((index) => `<i class="marcher" style="background-image:url(${assetUrl(manifest.crew[index] ?? manifest.crew[0])});animation-delay:${index * 0.2}s"></i>`)
      .join("");
  }
  if (!boarding.on) march.innerHTML = "";
  if (boarding.on && !lastBoard) sfx.jump();
  lastBoard = boarding.on;
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
    scene?.playFx(message.kind, message.amount, message.slot ?? 0, message.system ?? 0);
    if (message.kind === "laser-me") {
      const level = parseMounts((joined.state as ShipState).run.mounts)[message.slot ?? 0] ?? 1;
      if (level >= 2) sfx.cannon();
      else sfx.laser();
      if ((message.blocked ?? 0) > 0.4) sfx.shield();
      if (message.amount > 0.4) sfx.hit();
    }
    if (message.kind === "laser-them") {
      sfx.cannon();
      sfx.hit();
    }
    if (message.kind === "boom") sfx.boom();
    if (message.kind === "shield") sfx.shield();
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
    prevState = null;
    sfx.musicTrack("valikko");
  });
  render(joined.state as ShipState);
}

async function connectDuel(mode: "create" | "join" | "queue"): Promise<void> {
  const name = nameInput.value.trim() || "Merirosvo";
  sessionStorage.setItem("kosmos-name", name);
  lobbyStatus.textContent = copy.connecting;
  const client = new Client(endpoint());
  try {
    if (mode === "queue") {
      const response = await fetch(`${endpoint()}/match/duel`);
      const data = (await response.json()) as { roomId?: string | null };
      if (data.roomId) room = await client.joinById(data.roomId, { name }, DuelState);
      else room = await client.create("duel", { name, queue: true }, DuelState);
    } else if (mode === "create") room = await client.create("duel", { name }, DuelState);
    else {
      const id = codeInput.value.trim();
      if (!id) {
        lobbyStatus.textContent = copy.missing;
        return;
      }
      room = await client.joinById(id, { name }, DuelState);
    }
  } catch (error) {
    const text = String((error as Error)?.message ?? error);
    lobbyStatus.textContent = /full|max|exceed/i.test(text) ? copy.full : copy.missing;
    return;
  }
  duelLog = -1;
  lobby.classList.add("hidden");
  gameEl.classList.add("hidden");
  $("duel").classList.remove("hidden");
  const joined = room;
  joined.onStateChange((state) => {
    const duel = state as DuelState;
    renderDuel($("duel"), duel, joined.sessionId);
    if (duel.logSeq !== duelLog) {
      const previous = duelLog;
      duelLog = duel.logSeq;
      if (previous >= 0 && /Isku|Laukaus|−/.test(duel.log)) sfx.hit();
      if (previous >= 0 && /nousevat|Nousevat|kyytiin/i.test(duel.log)) sfx.jump();
      if (duel.phase === "end" && previous >= 0) {
        const mine = duel.seats.get(joined.sessionId)?.team ?? 0;
        if (duel.winner === String(mine)) sfx.win();
        else sfx.lose();
      }
    }
    const track = duel.phase === "wait" ? "kartta" : duel.phase === "end" ? "valikko" : "taistelu";
    sfx.musicTrack(track);
  });
  joined.onLeave(() => {
    $("duel").classList.add("hidden");
    lobby.classList.remove("hidden");
    lobbyStatus.textContent = copy.left;
    room = null;
    sfx.musicTrack("valikko");
  });
  renderDuel($("duel"), joined.state as DuelState, joined.sessionId);
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
$("duel-create").addEventListener("click", () => void connectDuel("create"));
$("duel-queue").addEventListener("click", () => void connectDuel("queue"));
$("duel-join").addEventListener("click", () => void connectDuel("join"));
$("board-now").addEventListener("click", () => {
  sfx.tap();
  room?.send("board");
});
mountBoarding($("boarding"), (type, payload) => room?.send(type, payload));
mountDuel($("duel"), (type, payload) => room?.send(type, payload));
$("restart").addEventListener("click", () => {
  sfx.tap();
  if ($<HTMLButtonElement>("restart").dataset.mode === "continue") room?.send("continue");
  else room?.send("restart");
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
document.querySelectorAll<HTMLButtonElement>(".mute-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const off = sfx.toggle();
    document.querySelectorAll(".mute-btn").forEach((node) => {
      node.textContent = off ? "Äänet päälle" : "Mykistä";
    });
  });
});
document.querySelectorAll(".mute-btn").forEach((node) => {
  node.textContent = sfx.muted ? "Äänet päälle" : "Mykistä";
});
document.querySelectorAll<HTMLInputElement>(".vol-music").forEach((input) => {
  input.value = String(Math.round(sfx.music * 100));
  input.addEventListener("input", () => {
    const value = Number(input.value) / 100;
    sfx.setMusic(value);
    document.querySelectorAll<HTMLInputElement>(".vol-music").forEach((other) => {
      if (other !== input) other.value = input.value;
    });
  });
});
document.querySelectorAll<HTMLInputElement>(".vol-sfx").forEach((input) => {
  input.value = String(Math.round(sfx.effects * 100));
  input.addEventListener("input", () => {
    const value = Number(input.value) / 100;
    sfx.setEffects(value);
    document.querySelectorAll<HTMLInputElement>(".vol-sfx").forEach((other) => {
      if (other !== input) other.value = input.value;
    });
  });
});

document.body.addEventListener("pointerdown", () => sfx.unlock());
sfx.musicTrack("valikko");
mountRun($("run"), (type, payload) => room?.send(type, payload));
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
bridge.onAim = (system) => {
  sfx.tap();
  room?.send("aim", { system });
};
bridge.onReady = (next) => {
  scene = next as ShipScene;
  if (room) render(room.state as ShipState);
};

if (params.get("huone") && nameInput.value.trim()) {
  void connect("join");
}
