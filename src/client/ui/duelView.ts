import { assetUrl, manifest } from "../../shared/assets.js";
import { B_COLS, BLADE_NAMES, decodeBlade } from "../../shared/boarding.js";
import type { DuelState } from "../../server/schema.js";
import { sfx } from "../audio.js";

type Send = (type: string, payload?: unknown) => void;
const SYSTEMS = ["Aseet", "Kilpi", "Ohjaus", "Reaktori"];
let picked = -1;
let shown = "";

export function mountDuel(host: HTMLElement, send: Send): void {
  host.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>("[data-act]");
    if (!button) return;
    sfx.tap();
    const act = button.dataset.act;
    if (act === "start") send("start");
    else if (act === "aim") send("aim", { system: Number(button.dataset.arg) });
    else if (act === "pump") send("pump");
    else if (act === "board") send("board");
    else if (act === "blade" && button.dataset.side === "mine") {
      const index = Number(button.dataset.arg);
      if (picked < 0) {
        picked = index;
        paint(host);
        return;
      }
      const from = picked;
      picked = -1;
      send("blade", { a: from, b: index });
    }
  });
}

function paint(host: HTMLElement): void {
  host.querySelectorAll<HTMLElement>("[data-act='blade']").forEach((cell) => {
    cell.classList.toggle("picked", cell.dataset.side === "mine" && Number(cell.dataset.arg) === picked);
  });
}

export function renderDuel(host: HTMLElement, state: DuelState, sessionId: string): void {
  const me = state.seats.get(sessionId);
  const team = me?.team ?? 0;
  const sig = `${state.phase}|${state.attacker}|${state.winner}|${team}|${state.seats.size}|${state.logSeq}|${state.board0}|${state.board1}`;
  if (sig !== shown) {
    shown = sig;
    if (state.phase === "wait") host.innerHTML = wait(state);
    else host.innerHTML = fight(state, team);
    paint(host);
  }
  paintMeters(host, state);
}

function fight(state: DuelState, team: number): string {
  const mine = team === 0;
  return `<section class="duel-panel">
    <p class="duel-log">${escapeHtml(state.log)}</p>
    <div class="duel-ships ${state.phase === "boarding" ? (state.attacker === team ? "out" : "in") : ""}">
      ${shipColumn("Punaiset", 0, state, mine)}
      <div class="march">${marchers(state)}</div>
      ${shipColumn("Mustat", 1, state, !mine)}
    </div>
    ${state.phase === "battle" ? actions(state, team) : ""}
    ${state.phase === "boarding" ? blades(state, team) : ""}
    ${state.phase === "end" ? `<h2>${state.winner === String(team) ? "Voitto" : "Häviö"}</h2>` : ""}
  </section>`;
}

function paintMeters(host: HTMLElement, state: DuelState): void {
  const bars = host.querySelectorAll<HTMLElement>("[data-meter]");
  bars.forEach((bar) => {
    const key = bar.dataset.meter as keyof DuelState;
    const value = Number(state[key] ?? 0);
    const max = bar.dataset.max ? Number(bar.dataset.max) : 100;
    const fill = bar.querySelector("i");
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
  });
}

function wait(state: DuelState): string {
  const names = [0, 1].map((team) => {
    const list: string[] = [];
    state.seats.forEach((seat) => {
      if (seat.team === team) list.push(seat.name);
    });
    return `<div><b>${team === 0 ? "Punaiset" : "Mustat"}</b><p>${list.join(", ") || "tyhjä"}</p></div>`;
  }).join("");
  return `<section class="duel-panel">
    <h2>Miehistö vastaan miehistö</h2>
    <p>${escapeHtml(state.log)}</p>
    <p>Koodi ${escapeHtml(state.roomCode)}. Kumpaankin mahtuu viisi. Tyhjät paikat täyttyvät botilla.</p>
    <div class="duel-wait">${names}</div>
    <button type="button" class="wood" data-act="start">Aloita ottelu</button>
  </section>`;
}

function shipColumn(label: string, team: number, state: DuelState, mine: boolean): string {
  const hull = team === 0 ? state.hull0 : state.hull1;
  const shield = team === 0 ? state.shield0 : state.shield1;
  const charge = team === 0 ? state.charge0 : state.charge1;
  const sys = (team === 0 ? state.sys0 : state.sys1).split(",").map(Number);
  const aim = team === 0 ? state.aim0 : state.aim1;
  const crew: string[] = [];
  state.seats.forEach((seat) => {
    if (seat.team !== team) return;
    const file = manifest.crew[seat.color % manifest.crew.length] ?? manifest.crew[0];
    crew.push(`<i class="crew-dot" style="background-image:url(${assetUrl(file)})" title="${escapeHtml(seat.name)}"></i>`);
  });
  return `<div class="duel-ship ${mine ? "mine" : ""}">
    <b>${label}${mine ? " · sinä" : ""}</b>
    <img class="hull-pic ${team === 1 ? "face" : ""}" alt="" src="${assetUrl(manifest.ship)}" />
    <div class="crew-row">${crew.join("")}</div>
    <div class="ebar" data-meter="${team === 0 ? "hull0" : "hull1"}"><i style="width:${Math.max(0, Math.min(100, hull))}%"></i></div>
    <small>Runko ${Math.ceil(hull)} · Kilpi ${Math.ceil(shield)}</small>
    <div class="ebar shield" data-meter="${team === 0 ? "shield0" : "shield1"}" data-max="48"><i style="width:${Math.max(0, Math.min(100, (shield / 48) * 100))}%"></i></div>
    <div class="sys-pips">${SYSTEMS.map((name, index) => `<span class="${aim === index ? "hot" : ""}">${name} ${Math.round(sys[index] ?? 100)}</span>`).join("")}</div>
    <div class="ebar" data-meter="${team === 0 ? "charge0" : "charge1"}"><i style="width:${Math.max(0, Math.min(100, charge))}%"></i></div>
  </div>`;
}

function actions(state: DuelState, team: number): string {
  const foeShield = team === 0 ? state.shield1 : state.shield0;
  return `<div class="duel-actions">
    ${SYSTEMS.map((name, index) => `<button type="button" class="wood tiny" data-act="aim" data-arg="${index}">${name}</button>`).join("")}
    <button type="button" class="wood tiny" data-act="pump">Lataa</button>
    <button type="button" class="wood" data-act="board" ${foeShield <= 1 ? "" : "disabled"}>Abordaa</button>
  </div>`;
}

function blades(state: DuelState, team: number): string {
  const mine = team === 0 ? state.board0 : state.board1;
  const theirs = team === 0 ? state.board1 : state.board0;
  const myHp = team === 0 ? state.hp0 : state.hp1;
  const theirHp = team === 0 ? state.hp1 : state.hp0;
  return `<div class="board-cols">
    ${grid(mine, "Me", myHp, true)}
    ${grid(theirs, "He", theirHp, false)}
  </div>
  <p class="blade-key">${BLADE_NAMES.map((name, index) => `${index + 1} ${name}`).join(" · ")}</p>`;
}

function grid(raw: string, label: string, hp: number, mine: boolean): string {
  const cells = decodeBlade(raw);
  const buttons = cells
    .map((type, index) => {
      const crystal = manifest.crystals[type] ?? manifest.crystals[0];
      return `<button type="button" class="blade" data-act="blade" data-side="${mine ? "mine" : "foe"}" data-arg="${index}" ${mine ? "" : "disabled"}><img alt="" src="${assetUrl(crystal)}" /></button>`;
    })
    .join("");
  return `<div class="blade-side"><b>${label} ${hp}</b><div class="blade-grid" style="grid-template-columns:repeat(${B_COLS},minmax(0,1fr))">${buttons}</div></div>`;
}

function marchers(state: DuelState): string {
  if (state.phase !== "boarding") return "";
  return [0, 1, 2]
    .map((index) => {
      const file = manifest.crew[index] ?? manifest.crew[0];
      return `<i class="marcher" style="background-image:url(${assetUrl(file)}); animation-delay:${index * 0.25}s"></i>`;
    })
    .join("");
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char] ?? char);
}
