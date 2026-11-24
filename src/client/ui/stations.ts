import { assetUrl, manifest } from "../../shared/assets.js";
import { copy } from "../../shared/copy.js";
import { parseIntegrity } from "../../shared/stations.js";
import { SECTION_IDS, SECTIONS, type SectionId } from "../../shared/sections.js";
import type { ShipState } from "../../server/schema.js";
import { sfx } from "../audio.js";

type Send = (type: string, payload?: unknown) => void;
export type StationMode = "shield" | "helm" | "repair" | "sensors";

const LANE = ["Vasen", "Keski", "Oikea"];

export class StationBoard {
  private mode: StationMode | null = null;
  private root: HTMLElement | null = null;

  constructor(private readonly send: Send) {}

  mount(host: HTMLElement, mode: StationMode): void {
    this.mode = mode;
    host.innerHTML = "";
    const root = document.createElement("div");
    root.className = `station-play ${mode}`;
    this.root = root;
    if (mode === "shield") root.append(this.shield());
    else if (mode === "helm") root.append(this.helm());
    else if (mode === "repair") root.append(this.repair());
    else root.append(this.sensors());
    host.append(root);
  }

  sync(state: ShipState): void {
    const stations = state.stations;
    const root = this.root;
    if (!root || !this.mode) return;
    if (this.mode === "shield") {
      root.querySelectorAll<HTMLElement>("[data-lane]").forEach((lane) => {
        const on = Number(lane.dataset.lane) === stations.shieldLane;
        lane.classList.toggle("hot", on);
        const spark = lane.querySelector<HTMLElement>(".spark");
        if (spark) spark.style.top = on ? `${Math.min(92, stations.shieldT * 100)}%` : "-20%";
      });
    } else if (this.mode === "helm") {
      root.querySelectorAll<HTMLElement>("[data-pos]").forEach((pip) => {
        const pos = Number(pip.dataset.pos);
        pip.classList.toggle("mark", pos === stations.helmTarget);
        pip.classList.toggle("here", pos === stations.helmPos);
      });
      const wick = root.querySelector<HTMLElement>(".wick");
      if (wick) wick.style.width = `${Math.max(0, Math.min(1, stations.helmT / 2.4)) * 100}%`;
    } else if (this.mode === "repair") {
      const cracks = parseIntegrity(stations.hulls);
      root.querySelectorAll<HTMLElement>("[data-room]").forEach((button) => {
        const index = Number(button.dataset.room);
        button.classList.toggle("sparking", index === stations.spark);
        const label = button.querySelector("b");
        if (label) label.textContent = String(Math.round(cracks[index] ?? 100));
      });
    } else {
      const sweep = root.querySelector<HTMLImageElement>("img.sweep");
      if (sweep) {
        sweep.style.transform = `rotate(${((stations.sweep % 8) / 8) * 360}deg)`;
        const green = stations.revealed;
        const next = assetUrl(green ? manifest.radarSweepGreen : manifest.radarSweep);
        if (!sweep.src.endsWith(green ? "tutka_pyyhkaisy_vihrea.png" : "tutka_pyyhkaisy.png")) sweep.src = next;
      }
      const blip = root.querySelector<HTMLElement>(".blip");
      if (blip) {
        const angle = (stations.blip / 8) * Math.PI * 2;
        blip.style.left = `${50 + Math.sin(angle) * 38}%`;
        blip.style.top = `${50 - Math.cos(angle) * 38}%`;
      }
      const note = root.querySelector(".sensor-note");
      if (note) {
        const id = SECTION_IDS[stations.target] ?? "aseet";
        note.textContent = stations.revealed
          ? `Seuraava isku: ${SECTIONS[id].name}${stations.weak > 0 ? " · heikko kohta" : ""}`
          : "Lukitse, kun pyyhkäisy osuu merkkiin";
      }
    }
  }

  key(section: SectionId, event: KeyboardEvent): boolean {
    if (section === "suojakilpi") {
      const lane = event.key === "ArrowLeft" || event.key === "1" ? 0 : event.key === "ArrowDown" || event.key === "2" ? 1 : event.key === "ArrowRight" || event.key === "3" ? 2 : -1;
      if (lane < 0) return false;
      event.preventDefault();
      this.tapShield(lane);
      return true;
    }
    if (section === "ohjaus") {
      if (event.key === "ArrowLeft") this.send("helm", { dir: -1 });
      else if (event.key === "ArrowRight") this.send("helm", { dir: 1 });
      else if (event.key === " " || event.key === "Enter") this.send("helm", { lock: true });
      else return false;
      event.preventDefault();
      sfx.tap();
      return true;
    }
    if (section === "korjaamo" && /^[1-6]$/.test(event.key)) {
      event.preventDefault();
      this.send("repair", { index: Number(event.key) - 1 });
      sfx.tap();
      return true;
    }
    if (section === "sensorit" && (event.key === " " || event.key === "Enter")) {
      event.preventDefault();
      this.send("sensors");
      sfx.tap();
      return true;
    }
    return false;
  }

  private tapShield(lane: number): void {
    sfx.tap();
    this.send("shield", { lane });
  }

  private shield(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "lane-row";
    LANE.forEach((label, lane) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wood lane";
      button.dataset.lane = String(lane);
      button.innerHTML = `<span class="spark"><img alt="" src="${assetUrl(manifest.spark)}" /></span><b>${label}</b>`;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.tapShield(lane);
      });
      wrap.append(button);
    });
    return wrap;
  }

  private helm(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "helm-play";
    const pips = document.createElement("div");
    pips.className = "helm-pips";
    for (let pos = 0; pos < 5; pos++) {
      const pip = document.createElement("i");
      pip.dataset.pos = String(pos);
      pips.append(pip);
    }
    const wick = document.createElement("div");
    wick.className = "wick-track";
    wick.innerHTML = `<i class="wick"></i>`;
    const row = document.createElement("div");
    row.className = "helm-actions";
    row.append(this.cmd("◀", () => this.send("helm", { dir: -1 })), this.cmd(copy.lock, () => this.send("helm", { lock: true })), this.cmd("▶", () => this.send("helm", { dir: 1 })));
    wrap.append(pips, wick, row);
    return wrap;
  }

  private repair(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "repair-grid";
    SECTION_IDS.forEach((id, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wood room-fix";
      button.dataset.room = String(index);
      button.innerHTML = `<span>${SECTIONS[id].name}</span><b>100</b><img alt="" src="${assetUrl(manifest.spark)}" />`;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        sfx.tap();
        this.send("repair", { index });
      });
      wrap.append(button);
    });
    return wrap;
  }

  private sensors(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "sensor-play";
    const marks = document.createElement("div");
    marks.className = "radar-stage";
    const sweep = document.createElement("img");
    sweep.className = "sweep";
    sweep.alt = "";
    sweep.src = assetUrl(manifest.radarSweep);
    const blip = document.createElement("i");
    blip.className = "blip";
    marks.append(sweep, blip);
    const note = document.createElement("p");
    note.className = "sensor-note";
    note.textContent = "Lukitse, kun pyyhkäisy osuu merkkiin";
    wrap.append(marks, note, this.cmd(copy.lock, () => this.send("sensors")));
    return wrap;
  }

  private cmd(label: string, run: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wood";
    button.textContent = label;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      sfx.tap();
      run();
    });
    return button;
  }
}
