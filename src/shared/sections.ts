import shipArt from "../../assets/v01/alus_oma.json" with { type: "json" };

export const SHIP_W = shipArt.leveys;
export const SHIP_H = shipArt.korkeus;
export const CONTENT_BBOX = shipArt.sisalto_bbox as [number, number, number, number];
export const FLOOR_Y = shipArt.lattia_y;
export const CEILING_Y = shipArt.katto_y;

export const SECTION_IDS = [
  "reaktori",
  "aseet",
  "sensorit",
  "ohjaus",
  "korjaamo",
  "suojakilpi",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];
export type DeckId = "yla" | "ala";

export interface SectionDef {
  id: SectionId;
  name: string;
  deck: DeckId;
  x0: number;
  x1: number;
  /** Arch peak from alus_oma.json. Upper rooms are gothic arches, not flat ceilings. */
  y0: number;
  y1: number;
  /** Where the arch meets the wall. Highlights and taps use this so the spire stays clear. */
  hitY0: number;
  floorY: number;
  playable: "reactor" | "weapons" | "shield" | "helm" | "repair" | "sensors";
  blurb: string;
  effect: string;
}

/** Arch spring line from LUEMINUT.md. Walls come down below the peak stored in y[0]. */
const ARCH_FOOT: Partial<Record<SectionId, number>> = {
  reaktori: 220,
  aseet: 245,
  sensorit: 150,
};

/** Feet sit on this row of every 128×128 pirate frame. Frame top = floorY − FEET_ROW. */
export const FEET_ROW = 124;

function room(
  id: SectionId,
  name: string,
  playable: SectionDef["playable"],
  blurb: string,
  effect: string,
): SectionDef {
  const raw = shipArt.huoneet[id];
  return {
    id,
    name,
    deck: raw.kansi as DeckId,
    x0: raw.x[0],
    x1: raw.x[1],
    y0: raw.y[0],
    y1: raw.y[1],
    hitY0: ARCH_FOOT[id] ?? raw.y[0],
    floorY: raw.lattia_y,
    playable,
    blurb,
    effect,
  };
}

export const SECTIONS: Record<SectionId, SectionDef> = {
  reaktori: room(
    "reaktori",
    "Reaktori",
    "reactor",
    "Yhdistä vähintään kolme samanlaista kidettä. Ketjut ja pitkät rivit antavat enemmän energiaa.",
    "Miehitettynä kiteet tuottavat energiaa. Tyhjänä reaktori hyrrää 40 % teholla.",
  ),
  aseet: room(
    "aseet",
    "Aseet",
    "weapons",
    "Pudota ammuspaloja ja täytä rivejä. Neljän rivin tetris lataa raskaan laukauksen.",
    "Laukauksen voima on rivit × aseisiin jaettu energia. Tyhjä asehuone lataa hitaasti 40 % teholla.",
  ),
  sensorit: room(
    "sensorit",
    "Sensorit",
    "sensors",
    "Lukitse pyyhkäisy merkin kohdalle. Näet seuraavan iskun ja heikon kohdan.",
    "Lukitus paljastaa, mihin osastoon vihollinen ampuu, ja vahvistaa seuraavan laukauksen.",
  ),
  ohjaus: room(
    "ohjaus",
    "Ohjaus",
    "helm",
    "Siirrä ruori merkin kohdalle ja lukitse ennen kuin kynttilä sammuu.",
    "Onnistunut lukitus kasvattaa väistöä. Tyhjänä ohjaus pysyy noin 40 % teholla.",
  ),
  korjaamo: room(
    "korjaamo",
    "Korjaamo",
    "repair",
    "Sammuta kipinä vaurioituneesta osastosta. Se korjaa osaston ja runkoa.",
    "Kipinän sammutus paikataan osastoa ja runkoa. Tyhjä paja korjaa hitaasti.",
  ),
  suojakilpi: room(
    "suojakilpi",
    "Kilpi",
    "shield",
    "Nappaa putoava kipinä oikeasta kaaresta, kun se on lähellä pohjaa.",
    "Napattu kipinä lataa kilpeä. Tyhjä kilpihuone pitää varauksen noin 40 %:ssa.",
  ),
};

/**
 * Ladder column shared by the reactor (upper) and helm (lower), just inside
 * their common wall, so a deck change is a straight climb.
 */
export const LADDER_X = 668;

/** Bow cannon muzzle in ship pixels. The barrel points left. */
export const MUZZLE = { x: 216, y: 330 };
/** Mid-hull, where incoming fire lands. */
export const HULL_HIT = { x: 860, y: 480 };
/** Enemy bow cannon, in the 900×500 enemy sprite. The barrel points right. */
export const ENEMY_MUZZLE = { x: 754, y: 265 };
export const ENEMY_CENTER = { x: 460, y: 250 };

export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

export function standPoint(id: SectionId, slot: number): { x: number; y: number } {
  const s = SECTIONS[id];
  const cx = (s.x0 + s.x1) / 2;
  const x = Math.max(s.x0 + 40, Math.min(s.x1 - 40, cx + (slot - 2) * 28));
  return { x, y: s.floorY };
}

export interface Waypoint {
  x: number;
  y: number;
  deck: DeckId;
}

export function deckFromPosition(y: number, section: SectionId, walking: boolean): DeckId {
  if (!walking) return SECTIONS[section].deck;
  const mid = (FLOOR_Y.yla + FLOOR_Y.ala) / 2;
  if (Math.abs(y - FLOOR_Y.yla) <= 4) return "yla";
  if (Math.abs(y - FLOOR_Y.ala) <= 4) return "ala";
  return y < mid ? "yla" : "ala";
}

/** Walk along the current floor, climb the ladder, then walk to the station. */
export function buildPath(
  fromX: number,
  fromY: number,
  fromDeck: DeckId,
  to: SectionId,
  slot: number,
): Waypoint[] {
  const destPoint = standPoint(to, slot);
  const toDeck = SECTIONS[to].deck;
  const dest: Waypoint = { x: destPoint.x, y: destPoint.y, deck: toDeck };
  const onFloor =
    Math.abs(fromY - FLOOR_Y.yla) <= 4 || Math.abs(fromY - FLOOR_Y.ala) <= 4;

  if (!onFloor) {
    return [
      { x: fromX, y: SECTIONS[to].floorY, deck: toDeck },
      dest,
    ];
  }

  if (fromDeck === toDeck) return [dest];

  const fromFloor = fromDeck === "yla" ? FLOOR_Y.yla : FLOOR_Y.ala;
  const toFloor = toDeck === "yla" ? FLOOR_Y.yla : FLOOR_Y.ala;
  return [
    { x: LADDER_X, y: fromFloor, deck: fromDeck },
    { x: LADDER_X, y: toFloor, deck: toDeck },
    dest,
  ];
}

export function sectionAt(x: number, y: number): SectionId | null {
  for (const id of SECTION_IDS) {
    const s = SECTIONS[id];
    if (x >= s.x0 && x < s.x1 && y >= s.hitY0 && y <= s.y1) return id;
  }
  // Floors are easier to tap than the thin room rects: accept a band above the floor.
  for (const id of SECTION_IDS) {
    const s = SECTIONS[id];
    if (x >= s.x0 && x < s.x1 && y >= s.floorY - 28 && y <= s.floorY + 18) return id;
  }
  return null;
}
