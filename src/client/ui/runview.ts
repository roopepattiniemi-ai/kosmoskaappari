import { assetUrl, manifest } from "../../shared/assets.js";
import { parseMap, RUN_EVENTS, upgradeCost } from "../../shared/run.js";
import { parseMounts, WEAPON_NAMES } from "../../shared/hardpoints.js";
import type { ShipState } from "../../server/schema.js";

type Send = (type: string, payload?: unknown) => void;

const UPGRADE_KEYS = ["reactor", "weapons", "shield", "helm", "repair", "sensors"] as const;
const UPGRADE_LABEL: Record<(typeof UPGRADE_KEYS)[number], string> = {
  reactor: "Reaktori",
  weapons: "Aseet",
  shield: "Kilpi",
  helm: "Ohjaus",
  repair: "Korjaamo",
  sensors: "Sensorit",
};
const UPGRADE_HINT: Record<(typeof UPGRADE_KEYS)[number], string> = {
  reactor: "Nopeampi lataus ja yksi lisäpalkki tasoa kohti.",
  weapons: "Enemmän vahinkoa. Sprite vaihtuu: laser, tykki, ohjus.",
  shield: "Kipinä lataa kilpeä enemmän.",
  helm: "Onnistunut lukitus väistää paremmin.",
  repair: "Kipinän sammutus korjaa enemmän.",
  sensors: "Lukitus on anteeksiantavampi ja heikko kohta puree.",
};

const TYPE_LABEL = { battle: "Taistelu", shop: "Kauppa", event: "Tapahtuma", boss: "Pomo" };

export function mountRun(host: HTMLElement, send: Send): void {
  host.addEventListener("pointerdown", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-act]");
    if (!button || button.disabled) return;
    const act = button.dataset.act;
    const arg = button.dataset.arg ?? "";
    if (act === "vote") send("vote", { node: Number(arg) });
    else if (act === "shop") send("shop", { action: arg });
    else if (act === "event") send("event", { choice: Number(arg) });
    else if (act === "done") send("done");
    else if (act === "reopen") send("reopen");
  });
}

export function renderRun(host: HTMLElement, state: ShipState): void {
  const run = state.run;
  const screen = run.screen;
  const show = screen === "map" || screen === "shop" || screen === "event";
  host.classList.toggle("hidden", !show);
  host.classList.toggle("shop-open", screen === "shop");
  if (!show) return;
  if (screen === "shop") host.innerHTML = shop(state);
  else if (screen === "event") host.innerHTML = event(state);
  else host.innerHTML = map(state);
}

function crewCount(state: ShipState): number {
  let n = 0;
  state.players.forEach(() => n++);
  return n;
}

function captainName(state: ShipState): string {
  return state.players.get(state.run.captain)?.name || "Kapteeni";
}

function votesFor(state: ShipState, nodeId: number): number {
  if (!state.run.votes) return 0;
  let n = 0;
  for (const part of state.run.votes.split(",")) {
    const [, node] = part.split(":");
    if (Number(node) === nodeId) n++;
  }
  return n;
}

function levels(state: ShipState): string {
  const run = state.run;
  const mounts = parseMounts(run.mounts);
  const guns = mounts
    .map((level, index) => (level > 0 ? `${index + 1} ${WEAPON_NAMES[level]}` : ""))
    .filter(Boolean)
    .join(", ");
  const rows = UPGRADE_KEYS.map((key) => {
    const level = run[key];
    return `<li><b>${UPGRADE_LABEL[key]} ${level}/3</b><span>${UPGRADE_HINT[key]}</span></li>`;
  }).join("");
  return `<ul class="upgrade-list">${rows}</ul><p class="guns">Aseet: ${guns || "ei asennettu"}</p>`;
}

function map(state: ShipState): string {
  const run = state.run;
  const nodes = parseMap(run.map);
  const here = nodes.find((node) => node.id === run.node);
  const sector = here?.sector ?? run.sector;
  const group = nodes.filter((node) => node.sector === sector);
  const cols = new Map<number, typeof group>();
  for (const node of group) {
    const list = cols.get(node.col) ?? [];
    list.push(node);
    cols.set(node.col, list);
  }
  const next = new Set(here?.next ?? []);
  const columns = [...cols.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, list]) => {
      const buttons = list
        .map((node) => {
          const votes = votesFor(state, node.id);
          const open = next.has(node.id);
          const icon = manifest.nodes[node.type];
          const here = node.id === run.node ? `<img class="here-mark" alt="" src="${assetUrl(manifest.nodes.here)}" />` : "";
          return `<button type="button" class="wood node t-${node.type}${node.id === run.node ? " here" : ""}" data-act="vote" data-arg="${node.id}" ${open ? "" : "disabled"}>
            <span class="node-icon"><img alt="" src="${assetUrl(icon)}" />${here}</span><b>${TYPE_LABEL[node.type]}</b><small>${votes ? `${votes} ääntä` : open ? "Hyppää" : ""}</small>
          </button>`;
        })
        .join("");
      return `<div class="map-col">${buttons}</div>`;
    })
    .join("");
  const cast = run.votes ? run.votes.split(",").filter(Boolean).length : 0;
  const reopen =
    here?.type === "shop"
      ? `<button type="button" class="wood" data-act="reopen">Takaisin kauppaan</button>`
      : here?.type === "event" && !run.eventDone
        ? `<button type="button" class="wood" data-act="reopen">Takaisin tapahtumaan</button>`
        : "";
  return `<section class="run-panel">
    <h2>Sektori ${sector + 1} / 3</h2>
    <p>Polttoaine ${run.fuel} · Kiteet ${run.crystals} · Kapteeni ${escapeHtml(captainName(state))}</p>
    <p>Äänet ${cast}/${crewCount(state)}. Enemmistö hyppää. Tasatilanteessa kapteeni ratkaisee. Hyppy maksaa 1 polttoainetta.</p>
    <div class="map-cols">${columns}</div>
    ${reopen}
    <h3>Päivitykset</h3>
    ${levels(state)}
  </section>`;
}

function shop(state: ShipState): string {
  const run = state.run;
  const mounts = parseMounts(run.mounts);
  const empty = mounts.some((level) => level <= 0);
  const buy = (action: string, label: string, cost: number, enabled: boolean) =>
    `<button type="button" class="wood" data-act="shop" data-arg="${action}" ${enabled && run.crystals >= cost ? "" : "disabled"}>${label} · ${cost} kidettä</button>`;
  const upgrades = UPGRADE_KEYS.map((key) => {
    const level = run[key];
    const cost = level >= 3 ? 0 : upgradeCost(level + 1);
    return buy(`up:${key}`, `${UPGRADE_LABEL[key]} taso ${Math.min(3, level + 1)}`, cost, level < 3);
  }).join("");
  return `<section class="shop-scene" style="background-image:url(${assetUrl(manifest.shop)})">
    <div class="shop-panel">
    <h2>Kauppa</h2>
    <p>Kiteet ${run.crystals} · Polttoaine ${run.fuel} · Runko ${Math.ceil(state.battle.playerHull)}</p>
    <div class="shop-grid">
      ${buy("repair", "Korjaa runkoa +12", 6, state.battle.playerHull < state.battle.playerMax)}
      ${buy("fuel", "Polttoainetta +2", 5, run.fuel < 30)}
      ${buy("mount", "Osta ase tyhjään paikkaan", 10, empty)}
      ${upgrades}
    </div>
    ${levels(state)}
    <button type="button" class="wood" data-act="done">Kartalle</button>
    </div>
  </section>`;
}

function event(state: ShipState): string {
  const run = state.run;
  const card = RUN_EVENTS[run.event] ?? RUN_EVENTS[0]!;
  return `<section class="run-panel">
    <h2>${escapeHtml(card.title)}</h2>
    <p>${escapeHtml(card.text)}</p>
    <div class="shop-grid">
      <button type="button" class="wood" data-act="event" data-arg="0" ${run.eventDone ? "disabled" : ""}>${escapeHtml(card.a)}</button>
      <button type="button" class="wood" data-act="event" data-arg="1" ${run.eventDone ? "disabled" : ""}>${escapeHtml(card.b)}</button>
    </div>
    <p>${escapeHtml(state.battle.log)}</p>
    <button type="button" class="wood" data-act="done" ${run.eventDone ? "" : "disabled"}>Jatka</button>
  </section>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
