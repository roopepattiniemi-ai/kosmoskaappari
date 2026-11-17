import { assetUrl, manifest } from "../../shared/assets.js";
import { gravityInterval } from "../../shared/balance.js";
import { copy } from "../../shared/copy.js";
import {
  COLS,
  ROWS,
  adjacent,
  decodeBoard,
  encodeBoard,
  idx,
  type Board,
  type ResolveStep,
} from "../../shared/match3.js";
import type { GameEvent, TetrisCmd } from "../../shared/protocol.js";
import { SECTIONS, isSectionId, type SectionId } from "../../shared/sections.js";
import {
  PIECE_COLOR,
  WELL_H,
  WELL_W,
  cellsOf,
  collides,
  decodeWell,
  ghostY,
  isPiece,
  tryDropOne,
  tryRotate,
  tryShift,
  type Active,
  type Well,
} from "../../shared/tetris.js";
import type { ShipState } from "../../server/schema.js";
import { sfx } from "../audio.js";

type Send = (type: string, payload?: unknown) => void;

export class PuzzleController {
  private state: ShipState | null = null;
  private sessionId = "";
  private shown = "";
  private selected: number | null = null;
  private cursor = 0;
  private busy = false;
  private idleAt = performance.now();
  private serverBoard = "";
  private queue: Extract<GameEvent, { type: "reactor" }>[] = [];
  private pumping = false;
  private cells: HTMLButtonElement[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private nextCanvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private images = new Map<number, HTMLImageElement>();
  private crystalImages: HTMLImageElement[] = [];
  private pred: Active | null = null;
  private predAt = 0;
  private trackY = 0;
  private fallFrac = 0;
  private raf = 0;
  private flashUntil = 0;
  private flashRows = new Set<number>();
  private repeatTimer = 0;
  private repeatDelay = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly head: HTMLElement,
    private readonly slot: HTMLElement,
    private readonly padLeft: HTMLElement,
    private readonly padRight: HTMLElement,
    private readonly send: Send,
  ) {
    this.crystalImages = manifest.crystals.map((file) => {
      const img = new Image();
      img.src = assetUrl(file);
      return img;
    });
    manifest.blocks.forEach((file, index) => {
      const img = new Image();
      img.src = assetUrl(file);
      this.images.set(index + 1, img);
    });
    this.buildPad();
    this.ro = new ResizeObserver(() => this.layoutBoard());
    this.ro.observe(this.slot);
    this.raf = requestAnimationFrame(() => this.frame());
  }

  setSession(id: string): void {
    this.sessionId = id;
  }

  private ro: ResizeObserver;
  private view = "";

  private layoutBoard(): void {
    const slot = this.slot.getBoundingClientRect();
    if (slot.width < 8 || slot.height < 8) return;
    const grid = this.slot.querySelector<HTMLElement>(".match");
    if (grid) {
      const size = Math.floor(Math.min(slot.width, slot.height));
      grid.style.width = `${size}px`;
      grid.style.height = `${size}px`;
    }
    const canvas = this.canvas;
    if (canvas && this.slot.contains(canvas)) {
      const width = Math.floor(Math.min(slot.width, slot.height * (WELL_W / WELL_H)));
      const height = Math.floor(width * (WELL_H / WELL_W));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      this.resizeWell();
    }
  }

  update(state: ShipState): void {
    this.state = state;
    const me = state.players.get(this.sessionId);
    const section = (me && isSectionId(me.walking ? me.target : me.section) ? (me.walking ? me.target : me.section) : "ohjaus") as SectionId;
    const here = me && !me.walking ? (me.section as SectionId) : null;
    const def = SECTIONS[section];
    const mode = me?.walking ? "walk" : here === "aseet" ? "tetris" : here === "reaktori" ? "match" : `card:${section}`;
    this.root.classList.toggle("tetris", mode === "tetris");
    this.root.classList.toggle("mode-reactor", mode === "match");
    this.root.classList.toggle("card", mode.startsWith("card") || mode === "walk");
    this.padLeft.hidden = mode !== "tetris";
    this.padRight.hidden = mode !== "tetris";

    if (mode === "walk") {
      if (this.view !== "walk") {
        this.view = "walk";
        this.slot.replaceChildren();
        this.cells = [];
        this.canvas = null;
        this.shown = "";
      }
      this.head.innerHTML = `<strong>${escapeHtml(def.name)}</strong><span>${escapeHtml(copy.walking(def.name))}</span>`;
      return;
    }

    if (mode === "match") {
      this.view = "match";
      this.serverBoard = state.reactor.board;
      this.ensureMatch();
      if (!this.busy && this.queue.length === 0 && this.shown !== this.serverBoard && this.shown !== "") this.snap(this.serverBoard);
      if (this.shown === "" && this.serverBoard) this.snap(this.serverBoard);
      this.renderMatchChrome(state);
      this.renderHint();
      return;
    }

    if (mode === "tetris") {
      this.view = "tetris";
      this.ensureWell();
      this.renderWeaponsChrome(state);
      return;
    }

    if (this.view !== mode) {
      this.view = mode;
      this.canvas = null;
      this.cells = [];
      this.shown = "";
      this.head.innerHTML = `<strong>${escapeHtml(def.name)}</strong><span>${escapeHtml(copy.perf(effFor(state, section)))}</span>`;
      this.slot.innerHTML = `
        <article class="station-card">
          <h3>${escapeHtml(def.name)}</h3>
          <p>${escapeHtml(def.blurb)}</p>
          <p>${escapeHtml(def.effect)}</p>
          <p class="muted">${escapeHtml(copy.soon)}</p>
          <div class="card-actions">
            <button type="button" class="wood" data-go="reaktori">${escapeHtml(copy.goReactor)}</button>
            <button type="button" class="wood" data-go="aseet">${escapeHtml(copy.goWeapons)}</button>
          </div>
        </article>`;
      this.slot.querySelectorAll<HTMLButtonElement>("[data-go]").forEach((button) => {
        button.addEventListener("click", () => {
          sfx.tap();
          const id = button.dataset.go;
          if (id && isSectionId(id)) this.send("go", { section: id });
        });
      });
    } else {
      const span = this.head.querySelector("span");
      if (span) span.textContent = copy.perf(effFor(state, section));
    }
  }

  onReactor(event: Extract<GameEvent, { type: "reactor" }>): void {
    this.queue.push(event);
    void this.pump();
  }

  onClear(event: Extract<GameEvent, { type: "clear" }>): void {
    this.flashRows = new Set(event.rows);
    this.flashUntil = performance.now() + 240;
    this.pred = null;
    sfx.line(event.power);
    if (event.banner) this.toast(event.banner, event.power >= 4);
    if (event.power >= 4) document.getElementById("game")?.classList.add("shake");
  }

  command(cmd: TetrisCmd): void {
    const state = this.state;
    const me = state?.players.get(this.sessionId);
    if (!state || !me || me.walking || me.section !== "aseet" || state.battle.phase !== "battle") return;
    if (state.weapons.flash) return;
    const board = decodeWell(state.weapons.board);
    const current = this.pred ?? serverActive(state);
    if (!current) return;
    let next: Active | null = current;
    if (cmd === "left") next = tryShift(board, current, -1);
    else if (cmd === "right") next = tryShift(board, current, 1);
    else if (cmd === "rot") next = tryRotate(board, current);
    else if (cmd === "soft") next = tryDropOne(board, current) ?? current;
    else if (cmd === "hard") {
      next = { ...current, y: ghostY(board, current.piece, current.rot, current.x, current.y) };
      sfx.lock();
    }
    if (next && (cmd === "left" || cmd === "right" || cmd === "soft")) sfx.move();
    if (next && cmd === "rot") sfx.rotate();
    if (next) {
      this.pred = next;
      this.predAt = performance.now();
      if (cmd === "hard" || cmd === "soft") {
        this.trackY = next.y;
        this.fallFrac = 0;
      }
    }
    this.send("tetris", { cmd });
  }

  key(event: KeyboardEvent): void {
    const me = this.state?.players.get(this.sessionId);
    if (!me || me.walking) return;
    if (me.section === "aseet") {
      const map: Record<string, TetrisCmd | undefined> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowDown: "soft",
        ArrowUp: "rot",
        z: "rot",
        Z: "rot",
        x: "rot",
        X: "rot",
        " ": "hard",
      };
      const cmd = map[event.key];
      if (!cmd) return;
      if ((cmd === "rot" || cmd === "hard") && event.repeat) return;
      event.preventDefault();
      this.command(cmd);
      return;
    }
    if (me.section !== "reaktori" || this.busy) return;
    const x = this.cursor % COLS;
    const y = Math.floor(this.cursor / COLS);
    if (event.key === "ArrowLeft") this.cursor = idx(Math.max(0, x - 1), y);
    else if (event.key === "ArrowRight") this.cursor = idx(Math.min(COLS - 1, x + 1), y);
    else if (event.key === "ArrowUp") this.cursor = idx(x, Math.max(0, y - 1));
    else if (event.key === "ArrowDown") this.cursor = idx(x, Math.min(ROWS - 1, y + 1));
    else if (event.key === "Enter" || event.key === " ") this.pick(this.cursor);
    else return;
    event.preventDefault();
    this.paintMatch();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.clearInterval(this.repeatTimer);
    window.clearTimeout(this.repeatDelay);
  }

  private buildPad(): void {
    const left: Array<[TetrisCmd, string, boolean]> = [
      ["rot", copy.rotate, false],
      ["left", "◀", true],
      ["soft", "▼", true],
    ];
    const right: Array<[TetrisCmd, string, boolean]> = [
      ["hard", copy.drop, false],
      ["right", "▶", true],
    ];
    for (const [cmd, label, repeat] of left) this.padLeft.append(this.padButton(cmd, label, repeat));
    for (const [cmd, label, repeat] of right) this.padRight.append(this.padButton(cmd, label, repeat));
  }

  private padButton(cmd: TetrisCmd, label: string, repeat: boolean): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wood pad-btn";
    button.textContent = label;
    const stop = () => {
      window.clearTimeout(this.repeatDelay);
      window.clearInterval(this.repeatTimer);
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.command(cmd);
      if (!repeat) return;
      stop();
      this.repeatDelay = window.setTimeout(() => {
        this.repeatTimer = window.setInterval(() => this.command(cmd), cmd === "soft" ? 40 : 75);
      }, 160);
    });
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointerleave", stop);
    button.addEventListener("pointercancel", stop);
    return button;
  }

  private ensureMatch(): void {
    if (this.cells.length === COLS * ROWS && this.slot.querySelector(".match")) return;
    this.slot.innerHTML = `<div class="match"></div><div class="float-layer"></div>`;
    const grid = this.slot.querySelector(".match")!;
    this.cells = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.innerHTML = `<img alt="" draggable="false" />`;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.pick(i);
      });
      grid.append(button);
      this.cells.push(button);
    }
    this.shown = "";
    this.layoutBoard();
  }

  private ensureWell(): void {
    if (this.canvas && this.slot.contains(this.canvas)) return;
    this.slot.innerHTML = `<canvas class="well"></canvas><div class="float-layer"></div>`;
    this.canvas = this.slot.querySelector("canvas");
    this.ctx = this.canvas?.getContext("2d") ?? null;
    this.cells = [];
    this.layoutBoard();
    this.resizeWell();
  }

  private resizeWell(): void {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(80, rect.width);
    const height = Math.max(120, rect.height);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private frame(): void {
    this.raf = requestAnimationFrame(() => this.frame());
    const state = this.state;
    if (!state || !this.canvas || !this.ctx) return;
    const me = state.players.get(this.sessionId);
    if (!me || me.walking || me.section !== "aseet") return;
    if (this.canvas.clientWidth > 0 && Math.abs(this.canvas.width / (window.devicePixelRatio || 1) - this.canvas.clientWidth) > 4) {
      this.resizeWell();
    }
    this.drawWell(state);
  }

  private drawWell(state: ShipState): void {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const cell = Math.min(width / WELL_W, height / WELL_H);
    const ox = (width - cell * WELL_W) / 2;
    const oy = (height - cell * WELL_H) / 2;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(10, 8, 7, 0.72)";
    ctx.fillRect(ox, oy, cell * WELL_W, cell * WELL_H);
    const board = decodeWell(state.weapons.board);
    for (let i = 0; i < board.length; i++) {
      const color = board[i] ?? 0;
      if (!color) continue;
      const x = i % WELL_W;
      const y = Math.floor(i / WELL_W);
      this.blit(ctx, color, ox + x * cell, oy + y * cell, cell, 1);
    }
    if (this.flashUntil > performance.now()) {
      ctx.fillStyle = "rgba(230, 195, 106, 0.38)";
      for (const y of this.flashRows) ctx.fillRect(ox, oy + y * cell, cell * WELL_W, cell);
    }
    const active = this.visualActive(state, board);
    if (active) {
      const grounded = ghostY(board, active.piece, active.rot, active.x, Math.floor(active.y)) === Math.floor(active.y);
      let drawY = active.y;
      if (!this.pred && !grounded && !state.weapons.flash) {
        if (active.y !== this.trackY) {
          this.trackY = active.y;
          this.fallFrac = 0;
        }
        const interval = gravityInterval(state.battle.elapsed) * 1000;
        this.fallFrac = Math.min(0.98, this.fallFrac + 16 / interval);
        drawY = active.y + this.fallFrac;
      }
      const ghost = ghostY(board, active.piece, active.rot, active.x, Math.floor(drawY));
      const color = PIECE_COLOR[active.piece];
      for (const [x, y] of cellsOf(active.piece, active.rot, active.x, ghost)) {
        if (y >= 0) this.blit(ctx, color, ox + x * cell, oy + y * cell, cell, 0.18);
      }
      for (const [x, y] of cellsOf(active.piece, active.rot, active.x, drawY)) {
        if (y >= -1) this.blit(ctx, color, ox + x * cell, oy + y * cell, cell, 1);
      }
    }
  }

  private visualActive(state: ShipState, board: Well): Active | null {
    const server = serverActive(state);
    if (!server) {
      this.pred = null;
      return null;
    }
    if (!this.pred) return server;
    if (this.pred.piece !== server.piece) {
      this.pred = null;
      return server;
    }
    const same = this.pred.rot === server.rot && this.pred.x === server.x && this.pred.y === server.y;
    if (same || performance.now() - this.predAt > 240 || collides(board, this.pred.piece, this.pred.rot, this.pred.x, this.pred.y)) {
      this.pred = null;
      return server;
    }
    return this.pred;
  }

  private blit(
    ctx: CanvasRenderingContext2D,
    color: number,
    x: number,
    y: number,
    size: number,
    alpha: number,
  ): void {
    const img = this.images.get(color);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x, y, size, size);
    else {
      ctx.fillStyle = ["#888", "#5ce1e6", "#ffd15c", "#b06bff", "#7dff6a", "#ff5d5d", "#4aa3ff", "#ff9a3c"][color] ?? "#fff";
      ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    }
    ctx.restore();
  }

  private renderMatchChrome(state: ShipState): void {
    this.head.innerHTML = `<strong>Reaktori</strong><span>${escapeHtml(copy.perf(state.reactor.performance))}</span>`;
  }

  private renderWeaponsChrome(state: ShipState): void {
    const bits = state.weapons.ammo.split("").filter(Boolean);
    const ammo = bits.length
      ? bits.map((token) => `<i class="${token === "a" ? "pellet auto" : "pellet"}"></i>`).join("")
      : `<em>${escapeHtml(copy.ammo)} 0</em>`;
    this.head.innerHTML = `<strong>Aseet</strong><span>${escapeHtml(copy.perf(state.weapons.performance))}</span><span class="ammo">${ammo}</span>`;
  }

  private renderHint(): void {
    const state = this.state;
    if (!state) return;
    const show = !this.busy && this.selected === null && performance.now() - this.idleAt > 7000;
    this.cells.forEach((cell, index) => {
      cell.classList.toggle("cursor", index === this.cursor);
      cell.classList.toggle("sel", index === this.selected);
      cell.classList.toggle("hint", show && (index === state.reactor.hintA || index === state.reactor.hintB));
    });
  }

  private pick(index: number): void {
    const me = this.state?.players.get(this.sessionId);
    if (!me || me.walking || me.section !== "reaktori" || this.busy || this.state?.battle.phase !== "battle") return;
    this.cursor = index;
    this.idleAt = performance.now();
    if (this.selected === null || this.selected === index || !adjacent(this.selected, index)) {
      this.selected = this.selected === index ? null : index;
      sfx.tap();
      this.paintMatch();
      return;
    }
    const a = this.selected;
    const b = index;
    this.selected = null;
    this.busy = true;
    sfx.swap();
    void this.animateSwap(a, b).then(() => {
      const board = decodeBoard(this.shown);
      const tmp = board[a] ?? 0;
      board[a] = board[b] ?? 0;
      board[b] = tmp;
      this.shown = encodeBoard(board);
      this.paintMatch();
      this.send("swap", { a, b });
    });
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    while (this.queue.length) {
      const event = this.queue.shift()!;
      if (!event.ok) {
        if (this.busy) {
          await this.animateSwap(event.a, event.b);
          const board = decodeBoard(this.shown || this.serverBoard);
          const tmp = board[event.a] ?? 0;
          board[event.a] = board[event.b] ?? 0;
          board[event.b] = tmp;
          this.shown = encodeBoard(board);
          this.paintMatch();
        }
        this.slot.classList.add("shake");
        sfx.bad();
        window.setTimeout(() => this.slot.classList.remove("shake"), 280);
        this.busy = false;
        continue;
      }
      const finalBoard = event.steps[event.steps.length - 1]?.board ?? this.serverBoard;
      if (!this.busy && this.shown === finalBoard) continue;
      if (!this.busy) {
        await this.animateSwap(event.a, event.b);
        const board = decodeBoard(this.shown || this.serverBoard);
        const tmp = board[event.a] ?? 0;
        board[event.a] = board[event.b] ?? 0;
        board[event.b] = tmp;
        this.shown = encodeBoard(board);
        this.paintMatch();
      }
      let visual = decodeBoard(this.shown);
      for (const step of event.steps) {
        await this.pop(step);
        await this.fall(visual, step);
        visual = decodeBoard(step.board);
        this.shown = step.board;
      }
      this.busy = false;
      if (this.serverBoard) this.snap(this.serverBoard);
    }
    this.pumping = false;
  }

  private snap(board: string): void {
    this.ensureMatch();
    this.shown = board;
    this.paintMatch();
  }

  private paintMatch(): void {
    const board = decodeBoard(this.shown);
    this.cells.forEach((cell, index) => {
      const img = cell.querySelector("img")!;
      const type = board[index] ?? 0;
      const src = this.crystalImages[type]?.src ?? "";
      if (img.getAttribute("src") !== src) img.src = src;
      cell.classList.toggle("cursor", index === this.cursor);
      cell.classList.toggle("sel", index === this.selected);
    });
  }

  private async animateSwap(a: number, b: number): Promise<void> {
    const cellA = this.cells[a];
    const cellB = this.cells[b];
    if (!cellA || !cellB) return;
    const ra = cellA.getBoundingClientRect();
    const rb = cellB.getBoundingClientRect();
    cellA.style.zIndex = "4";
    cellB.style.zIndex = "4";
    cellA.style.transition = "transform 110ms ease";
    cellB.style.transition = "transform 110ms ease";
    cellA.style.transform = `translate(${rb.left - ra.left}px, ${rb.top - ra.top}px)`;
    cellB.style.transform = `translate(${ra.left - rb.left}px, ${ra.top - rb.top}px)`;
    await wait(115);
    cellA.style.transition = "none";
    cellB.style.transition = "none";
    cellA.style.transform = "";
    cellB.style.transform = "";
    cellA.style.zIndex = "";
    cellB.style.zIndex = "";
  }

  private async pop(step: ResolveStep): Promise<void> {
    for (const index of step.cleared) this.cells[index]?.classList.add("pop");
    if (step.cascade > 0 || step.banner === "Kristallipommi!" || step.banner === "Linja!") {
      sfx.big();
      document.getElementById("game")?.classList.add("shake");
    } else sfx.match(step.cascade);
    this.toast(`${step.banner}  +${step.gain}`, step.banner === "Kristallipommi!");
    await wait(170);
    for (const index of step.cleared) this.cells[index]?.classList.remove("pop");
  }

  private async fall(before: Board, step: ResolveStep): Promise<void> {
    const after = decodeBoard(step.board);
    const cleared = new Set(step.cleared);
    this.cells.forEach((cell, index) => {
      const x = index % COLS;
      const y = Math.floor(index / COLS);
      const from = originRow(before, cleared, x, y);
      const delta = y - from;
      const img = cell.querySelector("img")!;
      const type = after[index] ?? 0;
      img.src = this.crystalImages[type]?.src ?? "";
      cell.style.transition = "none";
      cell.style.transform = delta ? `translateY(${-delta * 100}%)` : "";
    });
    this.shown = step.board;
    await wait(16);
    this.cells.forEach((cell) => {
      cell.style.transition = "transform 200ms cubic-bezier(.15,.85,.2,1)";
      cell.style.transform = "";
    });
    await wait(210);
  }

  private toast(text: string, big: boolean): void {
    const layer = this.slot.querySelector(".float-layer");
    if (!layer || !text.trim()) return;
    const node = document.createElement("div");
    node.className = big ? "floater big" : "floater";
    node.textContent = text;
    layer.append(node);
    window.setTimeout(() => node.remove(), 900);
  }
}

function serverActive(state: ShipState): Active | null {
  if (!isPiece(state.weapons.piece)) return null;
  return { piece: state.weapons.piece, rot: state.weapons.rot, x: state.weapons.px, y: state.weapons.py };
}

function originRow(before: Board, cleared: Set<number>, x: number, y: number): number {
  const survivors: number[] = [];
  for (let row = ROWS - 1; row >= 0; row--) {
    if (!cleared.has(idx(x, row))) survivors.push(row);
  }
  let seen = 0;
  let spawned = 0;
  for (let row = ROWS - 1; row >= 0; row--) {
    if (seen < survivors.length) {
      const from = survivors[seen]!;
      seen++;
      if (row === y) return from;
    } else {
      spawned++;
      if (row === y) return -spawned;
    }
  }
  return y;
}

function effFor(state: ShipState, section: SectionId): number {
  const manned = (id: SectionId) => {
    let yes = false;
    state.players.forEach((player) => {
      if (!player.walking && player.section === id) yes = true;
    });
    return yes ? 1 : 0.4;
  };
  if (section === "reaktori") return state.reactor.performance;
  if (section === "aseet") return state.weapons.performance;
  if (section === "suojakilpi") return manned("suojakilpi");
  if (section === "ohjaus") return manned("ohjaus");
  if (section === "korjaamo") return manned("korjaamo");
  return manned("sensorit");
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
