import { assetUrl, manifest } from "../../shared/assets.js";
import { B_COLS, decodeBlade } from "../../shared/boarding.js";
import type { ShipState } from "../../server/schema.js";

type Send = (type: string, payload?: unknown) => void;
let picked = -1;
let shown = "";

export function mountBoarding(host: HTMLElement, send: Send): void {
  host.addEventListener("pointerdown", (event) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-cell]");
    if (!cell || cell.dataset.side !== "ours") return;
    const index = Number(cell.dataset.cell);
    if (picked < 0) {
      picked = index;
      paint(host, picked);
      return;
    }
    const from = picked;
    picked = -1;
    send("blade", { a: from, b: index });
  });
}

export function renderBoarding(host: HTMLElement, state: ShipState): void {
  const board = state.boarding;
  host.classList.toggle("hidden", !board.on);
  if (!board.on) {
    shown = "";
    return;
  }
  const next = `${board.role}|${board.us}|${board.them}|${board.ours}|${board.theirs}|${board.note}`;
  if (next === shown) return;
  shown = next;
  const title = board.role === "defend" ? "He nousevat kyytiin" : "Abordaa";
  host.innerHTML = `<section class="board-stage">
    <p class="board-note">${escapeHtml(title)}. ${escapeHtml(board.note || "Ketju lähettää iskun.")}</p>
    <div class="board-cols">
      ${grid("ours", "Me", board.us, board.ours)}
      ${grid("theirs", "He", board.them, board.theirs)}
    </div>
  </section>`;
  paint(host, picked);
}

function grid(side: string, label: string, hp: number, raw: string): string {
  const cells = decodeBlade(raw);
  const buttons = cells
    .map((type, index) => {
      const tile = manifest.blades[type] ?? manifest.blades[0];
      return `<button type="button" class="blade" data-side="${side}" data-cell="${index}"><img alt="" src="${assetUrl(tile)}" /></button>`;
    })
    .join("");
  return `<div class="blade-side"><b>${label} ${hp}</b><div class="blade-grid" style="grid-template-columns:repeat(${B_COLS},minmax(0,1fr))">${buttons}</div></div>`;
}

function paint(host: HTMLElement, picked: number): void {
  host.querySelectorAll<HTMLElement>("[data-cell]").forEach((cell) => {
    cell.classList.toggle("picked", Number(cell.dataset.cell) === picked && cell.dataset.side === "ours");
  });
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char] ?? char);
}
