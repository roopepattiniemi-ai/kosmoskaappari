import {
  AMMO_CAP,
  AUTO_AMMO_EVERY,
  CLIMB_SPEED,
  ENEMY_FIRST_SHOT,
  ENEMY_HULL,
  ENEMY_INTERVAL,
  FIRE_INTERVAL,
  LOCK_DELAY,
  MAX_LOCK_RESETS,
  MAX_PIPS,
  PIP_COST,
  PLAYER_HULL,
  REACTOR_AUTO_CHARGE,
  REPAIR_AUTO,
  REPAIR_MANNED,
  START_PIPS,
  SYSTEM_CAP,
  WALK_SPEED,
  gravityInterval,
} from "../../shared/balance.js";
import { playerShotDamage, resolveEnemyShot } from "../../shared/combat.js";
import {
  compartmentFactor,
  formatIntegrity,
  helmScore,
  parseIntegrity,
  sectionIndex,
  sensorLocked,
  shieldCaught,
  SHIELD_CATCH,
} from "../../shared/stations.js";
import { decodeBoard, encodeBoard, findMove, generateBoard, trySwap } from "../../shared/match3.js";
import type { GameEvent, TetrisCmd } from "../../shared/protocol.js";
import { mulberry32, type Rng } from "../../shared/rng.js";
import {
  type SectionId,
  buildPath,
  deckFromPosition,
  isSectionId,
  SECTIONS,
  standPoint,
  type Waypoint,
} from "../../shared/sections.js";
import {
  type Active,
  type Well,
  Bag,
  WELL_H,
  WELL_W,
  clearFullRows,
  collides,
  emptyWell,
  encodeWell,
  ghostY,
  spawnActive,
  stamp,
  tryDropOne,
  tryRotate,
  tryShift,
  wellIndex,
} from "../../shared/tetris.js";
import { PlayerState, type ShipState } from "../schema.js";

const FALLBACK_NAMES = ["Kapteeni", "Kansimies", "Tykkimies", "Korjaaja", "Tähystäjä"];
const HOMES: SectionId[] = ["ohjaus", "korjaamo", "suojakilpi", "reaktori", "aseet"];

/**
 * Authoritative ship. The Colyseus room holds the schema; this class mutates it
 * and returns one-shot events (puzzle beats, shots) for the room to broadcast.
 */
export class ShipSim {
  private rng: Rng;
  private paths = new Map<string, Waypoint[]>();
  private reactorBusy = 0;
  private recentCharge = 0;
  private recentLines = 0;
  private well: Well = emptyWell();
  private bag: Bag;
  private active: Active | null = null;
  private ammo: string[] = [];
  private gravityAcc = 0;
  private lockAcc = 0;
  private lockResets = 0;
  private grounded = false;
  private clearTimer = 0;
  private pendingRows: number[] = [];
  private pendingPower = 0;
  private pendingBanner = "";
  private autoAmmoAcc = 0;
  private fireAcc = 0;
  private nagAcc = 0;

  constructor(
    readonly state: ShipState,
    seed = 0x5ea1,
  ) {
    this.rng = mulberry32(seed);
    this.bag = new Bag(this.rng);
  }

  start(): void {
    this.resetBattle(false);
  }

  join(id: string, name: string): void {
    if (this.state.players.has(id)) return;
    const color = this.firstFreeColor();
    const home = HOMES[color] ?? "ohjaus";
    const spot = standPoint(home, color);
    const player = new PlayerState({
      name: name || FALLBACK_NAMES[color] || "Merirosvo",
      color,
      section: home,
      target: home,
      x: spot.x,
      y: spot.y,
      walking: false,
      facing: 1,
    });
    this.state.players.set(id, player);
  }

  leave(id: string): void {
    this.state.players.delete(id);
    this.paths.delete(id);
  }

  go(id: string, section: string): void {
    const player = this.state.players.get(id);
    if (!player || !isSectionId(section)) return;
    if (!player.walking && player.section === section && player.target === section) return;
    player.target = section;
    const deck = deckFromPosition(player.y, player.section as SectionId, player.walking);
    this.paths.set(id, buildPath(player.x, player.y, deck, section, player.color));
    player.walking = true;
  }

  /** Snap a crew member onto a station. Tests use this; the socket does not. */
  place(id: string, section: SectionId): void {
    const player = this.state.players.get(id);
    if (!player) return;
    const spot = standPoint(section, player.color);
    player.section = section;
    player.target = section;
    player.x = spot.x;
    player.y = spot.y;
    player.walking = false;
    this.paths.delete(id);
  }

  alloc(system: "weapons" | "shield" | "engines" | "repair" | "sensors", delta: number): void {
    if ((delta !== 1 && delta !== -1) || this.state.battle.phase !== "battle") return;
    const energy = this.state.energy;
    const current = energy[system];
    const used = energy.weapons + energy.shield + energy.engines;
    if (delta > 0) {
      if (used >= energy.pool || current >= SYSTEM_CAP) return;
      energy[system] = current + 1;
    } else if (current > 0) {
      energy[system] = current - 1;
    }
  }

  swap(id: string, a: number, b: number): GameEvent[] {
    const player = this.state.players.get(id);
    const reject: GameEvent = { type: "reactor", ok: false, a, b };
    if (
      !player ||
      player.walking ||
      player.section !== "reaktori" ||
      this.state.battle.phase !== "battle" ||
      this.reactorBusy > 0 ||
      !Number.isInteger(a) ||
      !Number.isInteger(b)
    ) {
      return [reject];
    }
    const result = trySwap(decodeBoard(this.state.reactor.board), a, b, this.rng);
    if (!result) return [reject];

    let finalBoard = result.board;
    let reshuffled = false;
    if (!findMove(finalBoard)) {
      finalBoard = generateBoard(this.rng);
      reshuffled = true;
    }
    const encoded = encodeBoard(finalBoard);
    this.state.reactor.board = encoded;
    if (result.steps.length > 0) result.steps[result.steps.length - 1]!.board = encoded;
    this.addCharge(result.gain);
    this.recentCharge += result.gain;
    this.reactorBusy = 0.2 + result.steps.length * 0.26;
    this.refreshHint();
    if (reshuffled) this.pushLog("Kiteet sekoitetaan");
    return [{ type: "reactor", ok: true, a, b, steps: result.steps }];
  }

  tetris(id: string, cmd: TetrisCmd): void {
    const player = this.state.players.get(id);
    if (!player || player.walking || player.section !== "aseet") return;
    if (this.state.battle.phase !== "battle" || this.clearTimer > 0 || !this.active) return;
    if (cmd === "left" || cmd === "right") {
      const shifted = tryShift(this.well, this.active, cmd === "left" ? -1 : 1);
      if (shifted) this.acceptMove(shifted);
    } else if (cmd === "rot") {
      const rotated = tryRotate(this.well, this.active);
      if (rotated) this.acceptMove(rotated);
    } else if (cmd === "soft") {
      const dropped = tryDropOne(this.well, this.active);
      if (dropped) {
        this.active = dropped;
        this.grounded = false;
        this.lockAcc = 0;
        this.gravityAcc = 0;
      } else {
        this.grounded = true;
        this.lockAcc = Math.min(LOCK_DELAY, this.lockAcc + 0.12);
      }
    } else if (cmd === "hard") {
      this.active.y = ghostY(this.well, this.active.piece, this.active.rot, this.active.x, this.active.y);
      this.lockActive();
    }
    this.syncWeapons();
  }

  /** Fill and clear the bottom row. Wired to the socket only when KOSMOS_TEST=1. */
  debugClearBottomRow(): GameEvent[] {
    const y = WELL_H - 1;
    for (let x = 0; x < WELL_W; x++) this.well[wellIndex(x, y)] = 1;
    return this.collapseNow();
  }

  restart(): void {
    this.resetBattle(true);
  }

  tick(dt: number): GameEvent[] {
    if (dt <= 0) return [];
    if (dt > 0.05) {
      const steps = Math.ceil(dt / 0.05);
      const h = dt / steps;
      const events: GameEvent[] = [];
      for (let i = 0; i < steps && i < 400; i++) events.push(...this.step(h));
      return events;
    }
    return this.step(dt);
  }

  private step(dt: number): GameEvent[] {
    const events: GameEvent[] = [];
    this.moveCrew(dt);
    if (this.state.battle.phase !== "battle") {
      this.syncPerformance();
      return events;
    }
    this.state.battle.elapsed += dt;
    this.reactorBusy = Math.max(0, this.reactorBusy - dt);
    this.recentCharge *= Math.exp(-dt / 5);
    this.recentLines *= Math.exp(-dt / 6);
    this.nagAcc = Math.max(0, this.nagAcc - dt);

    if (!this.reactorManned()) this.addCharge(REACTOR_AUTO_CHARGE * dt);

    events.push(...this.stepWeapons(dt));
    this.stepStations(dt);
    events.push(...this.stepCombat(dt));
    this.repair(dt);
    this.syncPerformance();
    this.syncWeapons();
    return events;
  }

  private resetBattle(announce: boolean): void {
    const battle = this.state.battle;
    battle.phase = "battle";
    battle.playerHull = PLAYER_HULL;
    battle.playerMax = PLAYER_HULL;
    battle.enemyHull = ENEMY_HULL;
    battle.enemyMax = ENEMY_HULL;
    battle.enemyIn = ENEMY_FIRST_SHOT;
    battle.elapsed = 0;
    const energy = this.state.energy;
    energy.pool = START_PIPS;
    energy.charge = 0;
    energy.weapons = 2;
    energy.shield = 1;
    energy.engines = 1;
    this.recentCharge = 0;
    this.recentLines = 0;
    this.reactorBusy = 0;
    this.ammo = [];
    this.autoAmmoAcc = 0;
    this.fireAcc = 0;
    this.nagAcc = 0;
    this.clearTimer = 0;
    this.pendingRows = [];
    this.pendingPower = 0;
    this.pendingBanner = "";
    this.gravityAcc = 0;
    this.lockAcc = 0;
    this.lockResets = 0;
    this.grounded = false;
    this.active = null;
    this.well = emptyWell();
    this.bag = new Bag(this.rng);
    this.state.reactor.board = encodeBoard(generateBoard(this.rng));
    this.state.weapons.flash = "";
    const stations = this.state.stations;
    stations.hulls = formatIntegrity([]);
    stations.shieldLane = 1;
    stations.shieldT = 0;
    stations.shieldCharge = 40;
    stations.helmTarget = 2;
    stations.helmPos = 2;
    stations.helmT = 2.4;
    stations.dodgeCharge = 40;
    stations.spark = 0;
    stations.sparkT = 2.2;
    stations.blip = 3;
    stations.sweep = 0;
    stations.revealed = false;
    stations.weak = 0;
    stations.target = Math.floor(this.rng() * 6);
    this.refreshHint();
    this.syncWeapons();
    this.pushLog(
      announce
        ? "Uusi taistelu!"
        : "Taistelu alkoi. Reaktori tuottaa energiaa, aseet lataavat ammuksia.",
    );
  }

  private firstFreeColor(): number {
    const used = new Set<number>();
    this.state.players.forEach((player) => used.add(player.color));
    for (let color = 0; color < 5; color++) if (!used.has(color)) return color;
    return 0;
  }

  private moveCrew(dt: number): void {
    this.state.players.forEach((player, id) => {
      const path = this.paths.get(id);
      if (!path || path.length === 0) {
        if (player.walking) {
          player.walking = false;
          if (isSectionId(player.target)) player.section = player.target;
        }
        return;
      }
      player.walking = true;
      let left = dt;
      while (left > 0 && path.length > 0) {
        const wp = path[0]!;
        const dx = wp.x - player.x;
        const dy = wp.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.6) {
          player.x = wp.x;
          player.y = wp.y;
          path.shift();
          continue;
        }
        const climbing = Math.abs(dy) > Math.abs(dx) * 0.8;
        const speed = climbing ? CLIMB_SPEED : WALK_SPEED;
        if (Math.abs(dx) > 1) player.facing = dx > 0 ? 1 : -1;
        const step = speed * left;
        if (step >= dist) {
          player.x = wp.x;
          player.y = wp.y;
          left -= dist / speed;
          path.shift();
        } else {
          player.x += (dx / dist) * step;
          player.y += (dy / dist) * step;
          left = 0;
        }
      }
      if (path.length === 0) {
        player.walking = false;
        if (isSectionId(player.target)) player.section = player.target;
        this.paths.delete(id);
      }
    });
  }

  private manned(section: SectionId): boolean {
    let yes = false;
    this.state.players.forEach((player) => {
      if (!player.walking && player.section === section) yes = true;
    });
    return yes;
  }

  private reactorManned(): boolean {
    return this.manned("reaktori");
  }

  private addCharge(amount: number): void {
    if (amount <= 0) return;
    const energy = this.state.energy;
    energy.charge += amount;
    let gained = 0;
    while (energy.charge >= PIP_COST && energy.pool < MAX_PIPS) {
      energy.charge -= PIP_COST;
      energy.pool += 1;
      gained++;
    }
    if (energy.pool >= MAX_PIPS) energy.charge = Math.min(energy.charge, PIP_COST - 0.01);
    if (gained === 1) this.pushLog("Energiaa +1");
    else if (gained > 1) this.pushLog(`Energiaa +${gained}`);
  }

  private refreshHint(): void {
    const move = findMove(decodeBoard(this.state.reactor.board));
    this.state.reactor.hintA = move ? move[0] : -1;
    this.state.reactor.hintB = move ? move[1] : -1;
  }

  private stepWeapons(dt: number): GameEvent[] {
    if (this.clearTimer > 0) {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) return this.collapseNow();
      return [];
    }

    if (!this.manned("aseet")) {
      this.autoAmmoAcc += dt;
      if (this.autoAmmoAcc >= AUTO_AMMO_EVERY) {
        this.autoAmmoAcc = 0;
        this.enqueue("a");
      }
    } else if (!this.active) {
      this.spawnPiece();
    }

    if (this.active && this.manned("aseet")) {
      const interval = gravityInterval(this.state.battle.elapsed);
      this.gravityAcc += dt;
      let guard = 0;
      while (this.active && this.gravityAcc >= interval && guard++ < 8) {
        this.gravityAcc -= interval;
        const dropped = tryDropOne(this.well, this.active);
        if (!dropped) break;
        this.active = dropped;
        this.grounded = false;
        this.lockAcc = 0;
      }
      if (this.active && collides(this.well, this.active.piece, this.active.rot, this.active.x, this.active.y + 1)) {
        this.grounded = true;
        this.lockAcc += dt;
        if (this.lockAcc >= LOCK_DELAY) this.lockActive();
      } else if (this.active) {
        this.grounded = false;
        this.lockAcc = 0;
      }
    }
    return [];
  }

  private acceptMove(next: Active): void {
    this.active = next;
    const stillGrounded = collides(this.well, next.piece, next.rot, next.x, next.y + 1);
    if (this.grounded && stillGrounded && this.lockResets < MAX_LOCK_RESETS) {
      this.lockAcc = 0;
      this.lockResets++;
    } else if (!stillGrounded) {
      this.grounded = false;
      this.lockAcc = 0;
    } else {
      this.grounded = true;
    }
  }

  private spawnPiece(): void {
    const piece = this.bag.next();
    let spawned = spawnActive(piece);
    if (collides(this.well, spawned.piece, spawned.rot, spawned.x, spawned.y)) {
      this.well = emptyWell();
      this.pushLog("Asehuone tukossa, tyhjennetään");
      spawned = spawnActive(piece);
    }
    this.active = spawned;
    this.gravityAcc = 0;
    this.lockAcc = 0;
    this.lockResets = 0;
    this.grounded = false;
  }

  private lockActive(): void {
    if (!this.active) return;
    this.well = stamp(this.well, this.active);
    this.active = null;
    const preview = clearFullRows(this.well);
    if (preview.rows.length === 0) {
      if (this.manned("aseet")) this.spawnPiece();
      return;
    }
    this.pendingRows = preview.rows;
    this.pendingPower = preview.power;
    this.pendingBanner = preview.banner;
    this.clearTimer = 0.22;
    this.state.weapons.flash = preview.rows.join(",");
  }

  private collapseNow(): GameEvent[] {
    const cleared = clearFullRows(this.well);
    this.well = cleared.well;
    this.clearTimer = 0;
    this.state.weapons.flash = "";
    const power = cleared.power || this.pendingPower;
    const banner = cleared.banner || this.pendingBanner;
    const rows = cleared.rows.length ? cleared.rows : this.pendingRows;
    this.pendingRows = [];
    this.pendingPower = 0;
    this.pendingBanner = "";
    if (power > 0) {
      this.enqueue(String(power));
      this.recentLines += power;
    }
    if (this.manned("aseet") && !this.active) this.spawnPiece();
    this.syncWeapons();
    if (!rows.length) return [];
    this.pushLog(banner || "Linja ladattu");
    return [{ type: "clear", rows, banner: banner || "Linja!", power }];
  }

  private enqueue(token: string): void {
    if (this.ammo.length >= AMMO_CAP) {
      if (this.nagAcc <= 0) {
        this.pushLog("Ammusvarasto täynnä");
        this.nagAcc = 4;
      }
      return;
    }
    this.ammo.push(token);
  }

  shieldTap(id: string, lane: number): void {
    if (!this.at(id, "suojakilpi") || !Number.isInteger(lane)) return;
    const stations = this.state.stations;
    if (shieldCaught(stations.shieldT, lane, stations.shieldLane)) {
      stations.shieldCharge = Math.min(100, stations.shieldCharge + SHIELD_CATCH);
      stations.shieldT = 0;
      stations.shieldLane = Math.floor(this.rng() * 3);
      this.pushLog("Kilpi nappasi kipinän");
    } else if (stations.shieldT >= 0.58) {
      stations.shieldT = 0;
      stations.shieldLane = Math.floor(this.rng() * 3);
      this.pushLog("Kipinä meni ohi");
    }
  }

  helmNudge(id: string, dir: number): void {
    if (!this.at(id, "ohjaus") || (dir !== -1 && dir !== 1)) return;
    const stations = this.state.stations;
    stations.helmPos = Math.max(0, Math.min(4, stations.helmPos + dir));
  }

  helmLock(id: string): void {
    if (!this.at(id, "ohjaus")) return;
    this.resolveHelm();
  }

  repairTap(id: string, index: number): void {
    if (!this.at(id, "korjaamo") || !Number.isInteger(index) || index < 0 || index > 5) return;
    const stations = this.state.stations;
    if (index !== stations.spark) {
      this.pushLog("Väärä kipinä");
      return;
    }
    const cracks = this.cracks();
    cracks[index] = Math.min(100, (cracks[index] ?? 0) + 24);
    this.writeCracks(cracks);
    const battle = this.state.battle;
    battle.playerHull = Math.min(battle.playerMax, battle.playerHull + 4);
    stations.sparkT = 2.2;
    stations.spark = this.worstCrack();
    this.pushLog("Osuma paikattu");
  }

  sensorTap(id: string): void {
    if (!this.at(id, "sensorit")) return;
    const stations = this.state.stations;
    if (!sensorLocked(stations.sweep, stations.blip)) {
      this.pushLog("Taajuus hukassa");
      return;
    }
    stations.revealed = true;
    stations.weak = Math.min(2, stations.weak + 1);
    stations.blip = Math.floor(this.rng() * 8);
    stations.sweep = 0;
    const name = this.targetName();
    this.pushLog(`Lukitus: seuraava isku → ${name}`);
  }

  private at(id: string, section: SectionId): boolean {
    const player = this.state.players.get(id);
    return !!player && !player.walking && player.section === section && this.state.battle.phase === "battle";
  }

  private cracks(): number[] {
    return parseIntegrity(this.state.stations.hulls);
  }

  private writeCracks(values: number[]): void {
    this.state.stations.hulls = formatIntegrity(values);
  }

  private worstCrack(): number {
    const cracks = this.cracks();
    let index = 0;
    for (let i = 1; i < cracks.length; i++) if ((cracks[i] ?? 100) < (cracks[index] ?? 100)) index = i;
    return index;
  }

  private targetName(): string {
    const id = (["reaktori", "aseet", "sensorit", "ohjaus", "korjaamo", "suojakilpi"] as const)[this.state.stations.target];
    return id ? SECTIONS[id].name : "Aseet";
  }

  private approach(current: number, target: number, dt: number): number {
    return current + (target - current) * Math.min(1, dt * 0.45);
  }

  private stepStations(dt: number): void {
    const stations = this.state.stations;
    if (this.manned("suojakilpi")) {
      stations.shieldT += dt / 1.65;
      stations.shieldCharge = Math.max(0, stations.shieldCharge - dt * 1.1);
      if (stations.shieldT >= 1) {
        stations.shieldT = 0;
        stations.shieldLane = Math.floor(this.rng() * 3);
      }
    } else {
      stations.shieldCharge = this.approach(stations.shieldCharge, 40, dt);
      stations.shieldT = 0;
    }

    if (this.manned("ohjaus")) {
      stations.helmT -= dt;
      stations.dodgeCharge = Math.max(0, stations.dodgeCharge - dt * 1.1);
      if (stations.helmT <= 0) this.resolveHelm();
    } else {
      stations.dodgeCharge = this.approach(stations.dodgeCharge, 40, dt);
    }

    if (this.manned("korjaamo")) {
      stations.sparkT -= dt;
      if (stations.sparkT <= 0) {
        stations.sparkT = 2.2;
        stations.spark = this.worstCrack();
      }
    } else {
      const cracks = this.cracks();
      const index = this.worstCrack();
      cracks[index] = Math.min(100, (cracks[index] ?? 0) + 3.2 * dt);
      this.writeCracks(cracks);
      stations.spark = index;
    }

    if (this.manned("sensorit")) {
      stations.sweep = (stations.sweep + dt * 1.35) % 8;
    }
  }

  private resolveHelm(): void {
    const stations = this.state.stations;
    const score = helmScore(stations.helmPos, stations.helmTarget);
    if (score > 0) {
      stations.dodgeCharge = Math.min(100, stations.dodgeCharge + 16 * score);
      this.pushLog(score === 1 ? "Ruori lukossa" : "Lähellä merkkiä");
    } else {
      this.pushLog("Ruori harassa");
    }
    stations.helmTarget = Math.floor(this.rng() * 5);
    stations.helmT = 2.4;
  }

  private stepCombat(dt: number): GameEvent[] {
    const events: GameEvent[] = [];
    const battle = this.state.battle;
    const bars = this.state.energy.weapons;
    if (this.ammo.length > 0 && bars <= 0) {
      if (this.nagAcc <= 0) {
        this.pushLog("Aseissa ei ole energiaa");
        this.nagAcc = 5;
      }
    } else if (this.ammo.length > 0 && bars > 0) {
      const factor = Math.max(0.35, bars / 3);
      this.fireAcc += dt;
      if (this.fireAcc >= FIRE_INTERVAL / factor) {
        this.fireAcc = 0;
        const token = this.ammo.shift() ?? "1";
        const fromAuto = token === "a";
        const power = fromAuto ? 1 : Number(token) || 1;
        const cracks = this.cracks();
        let damage = playerShotDamage({
          power,
          weaponsBars: bars,
          sensorsManned: this.manned("sensorit") || this.state.stations.weak > 0,
          fromAuto,
        });
        damage *= compartmentFactor(cracks[sectionIndex("aseet")] ?? 100);
        let weakTag = "";
        if (!fromAuto && this.state.stations.weak > 0) {
          damage *= 1.4;
          this.state.stations.weak -= 1;
          weakTag = "Heikko kohta! ";
        }
        battle.enemyHull = Math.max(0, battle.enemyHull - damage);
        this.pushLog(`${weakTag}Laukaus −${Math.max(1, Math.round(damage))} viholliseen`);
        events.push({ type: "fx", kind: "laser-me", amount: damage });
        if (battle.enemyHull <= 0) {
          battle.phase = "victory";
          battle.enemyHull = 0;
          this.pushLog("Vihollisalus upposi!");
        }
      }
    } else {
      this.fireAcc = 0;
    }

    if (battle.phase !== "battle") return events;
    battle.enemyIn -= dt;
    let guard = 0;
    while (battle.enemyIn <= 0 && battle.phase === "battle" && guard++ < 6) {
      battle.enemyIn += ENEMY_INTERVAL;
      const cracks = this.cracks();
      const shieldPower = (this.state.stations.shieldCharge / 100) * compartmentFactor(cracks[sectionIndex("suojakilpi")] ?? 100);
      const dodgePower = (this.state.stations.dodgeCharge / 100) * compartmentFactor(cracks[sectionIndex("ohjaus")] ?? 100);
      const shot = resolveEnemyShot({
        shieldBars: this.state.energy.shield,
        shieldManned: shieldPower >= 0.62,
        enginesBars: this.state.energy.engines,
        helmManned: dodgePower >= 0.62,
        roll: this.rng(),
      });
      if (shot.dodged) {
        this.pushLog("Väistettiin!");
        events.push({ type: "fx", kind: "dodge", amount: 0 });
        continue;
      }
      if (shot.damage <= 0.4) {
        this.pushLog("Kilpi kesti iskun");
        events.push({ type: "fx", kind: "shield", amount: 0 });
        continue;
      }
      battle.playerHull = Math.max(0, battle.playerHull - shot.damage);
      const hitIndex = this.state.stations.target % 6;
      cracks[hitIndex] = Math.max(0, (cracks[hitIndex] ?? 100) - 16);
      this.writeCracks(cracks);
      this.state.stations.revealed = false;
      this.state.stations.target = Math.floor(this.rng() * 6);
      const roomId = (["reaktori", "aseet", "sensorit", "ohjaus", "korjaamo", "suojakilpi"] as const)[hitIndex];
      const roomName = roomId ? SECTIONS[roomId].name : "Runko";
      this.pushLog(`Osuma ${roomName} −${Math.max(1, Math.round(shot.damage))}`);
      events.push({
        type: "fx",
        kind: shot.blocked > 1 ? "shield" : "laser-them",
        amount: shot.damage,
      });
      if (shot.blocked <= 1) events.push({ type: "fx", kind: "boom", amount: shot.damage });
      if (battle.playerHull <= 0) {
        battle.phase = "defeat";
        battle.playerHull = 0;
        this.pushLog("Runko petti.");
      }
    }
    return events;
  }

  private repair(dt: number): void {
    const battle = this.state.battle;
    if (battle.phase !== "battle" || battle.playerHull <= 0) return;
    const rate = this.manned("korjaamo") ? 0.08 : REPAIR_AUTO;
    if (battle.playerHull < battle.playerMax) {
      battle.playerHull = Math.min(battle.playerMax, battle.playerHull + rate * dt);
    }
  }

  private syncPerformance(): void {
    this.state.reactor.performance = this.reactorManned()
      ? clamp(this.recentCharge / 24, 0.35, 1.7)
      : 0.4;
    this.state.weapons.performance = this.manned("aseet")
      ? clamp(0.55 + this.recentLines / 4, 0.55, 1.6)
      : 0.4;
  }

  private syncWeapons(): void {
    const weapons = this.state.weapons;
    const board = encodeWell(this.well);
    if (weapons.board !== board) weapons.board = board;
    if (this.active) {
      weapons.piece = this.active.piece;
      weapons.rot = this.active.rot;
      weapons.px = this.active.x;
      weapons.py = this.active.y;
    } else if (weapons.piece !== "") {
      weapons.piece = "";
    }
    const next = this.bag.peek(3).join(",");
    if (weapons.next !== next) weapons.next = next;
    const ammo = this.ammo.join("");
    if (weapons.ammo !== ammo) weapons.ammo = ammo;
  }

  private pushLog(text: string): void {
    const battle = this.state.battle;
    battle.log = text;
    battle.logSeq = (battle.logSeq + 1) & 0xffff;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
