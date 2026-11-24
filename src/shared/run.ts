import type { Rng } from "./rng.js";

export type NodeType = "battle" | "shop" | "event" | "boss";

export interface RunNode {
  id: number;
  sector: number;
  type: NodeType;
  col: number;
  row: number;
  next: number[];
}

export interface RunEvent {
  title: string;
  text: string;
  a: string;
  b: string;
}

export const RUN_EVENTS: RunEvent[] = [
  {
    title: "Ajelehtiva hylky",
    text: "Ruumassa kimaltaa kiteitä. Polttoaineputki sihisee.",
    a: "Kerää kiteet",
    b: "Irrota polttoaine",
  },
  {
    title: "Hätäviesti",
    text: "Tuntematon alus pyytää apua. Signaali on heikko.",
    a: "Auta (kuluttaa polttoainetta)",
    b: "Ohita",
  },
  {
    title: "Meripihkasumu",
    text: "Sumu peittää tutkan. Läpi voi puskea tai kuunnella.",
    a: "Kuuntele (heikko kohta)",
    b: "Kovaa läpi",
  },
];

const COLUMN_PLAN: Record<number, number[]> = {
  6: [1, 2, 2, 1],
  7: [1, 2, 2, 1, 1],
  8: [1, 2, 2, 2, 1],
};

export function generateMap(rng: Rng): RunNode[] {
  const nodes: RunNode[] = [];
  let id = 0;
  for (let sector = 0; sector < 3; sector++) {
    const count = 6 + Math.floor(rng() * 3);
    const plan = COLUMN_PLAN[count] ?? COLUMN_PLAN[7];
    const cols: RunNode[][] = [];
    for (let col = 0; col < plan.length; col++) {
      const column: RunNode[] = [];
      for (let row = 0; row < plan[col]; row++) {
        const last = col === plan.length - 1;
        let type: NodeType = "battle";
        if (last) type = "boss";
        else if (col > 0) {
          const roll = rng();
          type = roll < 0.55 ? "battle" : roll < 0.78 ? "shop" : "event";
        }
        const node: RunNode = { id: id++, sector, type, col, row, next: [] };
        column.push(node);
        nodes.push(node);
      }
      cols.push(column);
    }
    for (let col = 0; col < cols.length - 1; col++) {
      const targets = cols[col + 1];
      for (const node of cols[col]) {
        const primary = Math.min(targets.length - 1, node.row);
        node.next.push(targets[primary].id);
        if (targets.length > 1 && rng() < 0.7) {
          const extra = targets[(primary + 1) % targets.length].id;
          if (!node.next.includes(extra)) node.next.push(extra);
        }
      }
      for (const target of targets) {
        if (!cols[col].some((node) => node.next.includes(target.id))) cols[col][0].next.push(target.id);
      }
    }
  }
  const bosses = nodes.filter((node) => node.type === "boss");
  for (let i = 0; i < bosses.length - 1; i++) {
    const start = nodes.find((node) => node.sector === i + 1 && node.col === 0);
    if (start) bosses[i].next = [start.id];
  }
  return nodes;
}

export function encodeMap(nodes: RunNode[]): string {
  return nodes
    .map((node) => `${node.id},${node.sector},${node.type},${node.col},${node.row},${node.next.join(".")}`)
    .join(";");
}

export function parseMap(raw: string): RunNode[] {
  if (!raw) return [];
  return raw.split(";").map((part) => {
    const [id, sector, type, col, row, next] = part.split(",");
    return {
      id: Number(id),
      sector: Number(sector),
      type: type as NodeType,
      col: Number(col),
      row: Number(row),
      next: next ? next.split(".").map(Number) : [],
    };
  });
}

export function threat(sector: number, boss: boolean): { hull: number; damage: number } {
  const hull = 140 + sector * 30;
  const damage = 18 + sector * 4;
  const scale = boss ? 1.45 : 1;
  return { hull: Math.round(hull * scale), damage: Math.round(damage * scale) };
}

export interface VoteResult {
  ready: boolean;
  choice: number | null;
}

/** Majority of the present crew. A tie uses the captain's vote, then the smallest node id. */
export function resolveVote(
  playerIds: string[],
  votes: Record<string, number>,
  captainId: string,
): VoteResult {
  if (playerIds.length === 0) return { ready: false, choice: null };
  const cast = playerIds.filter((id) => votes[id] !== undefined);
  const tally = new Map<number, number>();
  for (const id of cast) tally.set(votes[id], (tally.get(votes[id]) ?? 0) + 1);
  let top = 0;
  for (const count of tally.values()) top = Math.max(top, count);
  const leaders = [...tally.entries()].filter(([, count]) => count === top).map(([node]) => node);
  const majority = top > playerIds.length / 2;
  if (!majority && cast.length < playerIds.length) return { ready: false, choice: null };
  if (leaders.length === 1) return { ready: true, choice: leaders[0] };
  const captainVote = playerIds.includes(captainId) ? votes[captainId] : undefined;
  if (captainVote !== undefined && leaders.includes(captainVote)) return { ready: true, choice: captainVote };
  return { ready: true, choice: Math.min(...leaders) };
}

export function upgradeCost(nextLevel: number): number {
  return nextLevel === 2 ? 8 : 14;
}

export function upgradeFactor(level: number, step = 0.25): number {
  return 1 + step * (Math.max(1, Math.min(3, level)) - 1);
}

export interface EventResult {
  crystals: number;
  fuel: number;
  hull: number;
  weak: number;
  log: string;
}

export function eventOutcome(id: number, choice: number, roll: number): EventResult {
  if (id === 0) {
    if (choice === 0) return { crystals: 8, fuel: 0, hull: 0, weak: 0, log: "Kiteet talteen hylkyyn." };
    const hurt = roll < 0.3;
    return {
      crystals: 0,
      fuel: 2,
      hull: hurt ? -8 : 0,
      weak: 0,
      log: hurt ? "Putki räjähti. Runko kärsi." : "Polttoaine irtosi siististi.",
    };
  }
  if (id === 1) {
    if (choice === 0) return { crystals: 7, fuel: -1, hull: 0, weak: 0, log: "Apu perillä. Kiteitä vastineeksi." };
    return { crystals: 0, fuel: 0, hull: 0, weak: 0, log: "Viesti hiljeni." };
  }
  if (choice === 0) return { crystals: 0, fuel: 0, hull: 0, weak: 1, log: "Sumu kuiskii heikon kohdan." };
  return { crystals: 0, fuel: 0, hull: -6, weak: 0, log: "Runko kolisi sumussa." };
}
