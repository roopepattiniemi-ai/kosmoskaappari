import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema(
  {
    name: t.string().default(""),
    color: t.uint8().default(0),
    section: t.string().default("ohjaus"),
    target: t.string().default("ohjaus"),
    x: t.float32().default(530),
    y: t.float32().default(544),
    walking: t.boolean().default(false),
    facing: t.int8().default(1),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const EnergyState = schema(
  {
    pool: t.uint8().default(4),
    charge: t.float32().default(0),
    weapons: t.uint8().default(2),
    shield: t.uint8().default(1),
    engines: t.uint8().default(1),
    repair: t.uint8().default(0),
    sensors: t.uint8().default(0),
  },
  "EnergyState",
);
export type EnergyState = SchemaType<typeof EnergyState>;

export const ReactorState = schema(
  {
    board: t.string().default(""),
    performance: t.float32().default(0.4),
    hintA: t.int16().default(-1),
    hintB: t.int16().default(-1),
  },
  "ReactorState",
);
export type ReactorState = SchemaType<typeof ReactorState>;

export const WeaponsState = schema(
  {
    board: t.string().default(""),
    piece: t.string().default(""),
    rot: t.uint8().default(0),
    px: t.int8().default(3),
    py: t.int8().default(0),
    next: t.string().default(""),
    ammo: t.string().default(""),
    performance: t.float32().default(0.4),
    /** Comma-separated row indexes currently flashing, empty when idle. */
    flash: t.string().default(""),
    /** Charge 0–100 of the four hardpoints. */
    charges: t.string().default("0,0,0,0"),
  },
  "WeaponsState",
);
export type WeaponsState = SchemaType<typeof WeaponsState>;

export const StationsState = schema(
  {
    /** Integrity of the six compartments, SECTION_IDS order. */
    hulls: t.string().default("100,100,100,100,100,100"),
    shieldLane: t.uint8().default(1),
    shieldT: t.float32().default(0),
    shieldCharge: t.float32().default(40),
    helmTarget: t.uint8().default(2),
    helmPos: t.uint8().default(2),
    helmT: t.float32().default(2.4),
    dodgeCharge: t.float32().default(40),
    spark: t.uint8().default(0),
    sparkT: t.float32().default(2.2),
    blip: t.uint8().default(3),
    sweep: t.float32().default(0),
    revealed: t.boolean().default(false),
    weak: t.uint8().default(0),
    /** Compartment the next enemy shot will hit. */
    target: t.uint8().default(1),
  },
  "StationsState",
);
export type StationsState = SchemaType<typeof StationsState>;

export const RunState = schema(
  {
    screen: t.string().default("battle"),
    sector: t.uint8().default(0),
    node: t.uint16().default(0),
    fuel: t.uint8().default(12),
    crystals: t.uint16().default(0),
    captain: t.string().default(""),
    votes: t.string().default(""),
    map: t.string().default(""),
    reactor: t.uint8().default(1),
    weapons: t.uint8().default(1),
    shield: t.uint8().default(1),
    helm: t.uint8().default(1),
    repair: t.uint8().default(1),
    sensors: t.uint8().default(1),
    event: t.uint8().default(0),
    eventDone: t.boolean().default(false),
    /** Four hardpoints, each 0 empty or 1–3 (laser, cannon, missile). */
    mounts: t.string().default("1,0,0,0"),
  },
  "RunState",
);
export type RunState = SchemaType<typeof RunState>;

export const BattleState = schema(
  {
    phase: t.string().default("battle"),
    playerHull: t.float32().default(100),
    playerMax: t.float32().default(100),
    enemyHull: t.float32().default(140),
    enemyMax: t.float32().default(140),
    enemyIn: t.float32().default(6.5),
    elapsed: t.float32().default(0),
    log: t.string().default("Taistelu alkoi. Reaktori tuottaa energiaa, aseet lataavat ammuksia."),
    logSeq: t.uint16().default(1),
    enemyShield: t.float32().default(36),
    enemyShieldMax: t.float32().default(60),
    /** Enemy weapons, shield, helm, reactor. */
    enemySys: t.string().default("100,100,100,100"),
    /** Aimed enemy system, 0–3. */
    aim: t.uint8().default(0),
  },
  "BattleState",
);
export type BattleState = SchemaType<typeof BattleState>;

export const ShipState = schema(
  {
    players: t.map(PlayerState),
    energy: EnergyState,
    reactor: ReactorState,
    weapons: WeaponsState,
    stations: StationsState,
    run: RunState,
    battle: BattleState,
    roomCode: t.string().default(""),
  },
  "ShipState",
);
export type ShipState = SchemaType<typeof ShipState>;
