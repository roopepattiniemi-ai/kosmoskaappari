import {
  BOARD_HP,
  aiBladeMove,
  bladeSwap,
  decodeBlade,
  encodeBlade,
  generateBladeBoard,
} from "../../shared/boarding.js";
import { parseSystems, resolvePlayerImpact } from "../../shared/hardpoints.js";
import { mulberry32, type Rng } from "../../shared/rng.js";
import { DuelState, SeatState } from "../schema.js";

const BOTS = ["Krotti", "Salama", "Tynnyri", "Koukku", "Ruori", "Kita", "Piki", "Myrsky"];
const SYSTEMS = ["Aseet", "Kilpi", "Ohjaus", "Reaktori"];

export class DuelSim {
  private rng: Rng;
  private ai = 0;
  private aimClock = 0;

  constructor(
    readonly state: DuelState,
    seed = 1,
  ) {
    this.rng = mulberry32(seed);
  }

  join(id: string, name: string, team?: number): void {
    if (this.state.seats.has(id) || this.state.phase === "end") return;
    const size = [0, 0];
    this.state.seats.forEach((seat) => {
      size[seat.team] = (size[seat.team] ?? 0) + 1;
    });
    let chosen = team === 0 || team === 1 ? team : (size[0] ?? 0) <= (size[1] ?? 0) ? 0 : 1;
    if ((size[chosen] ?? 0) >= 5) chosen = chosen === 0 ? 1 : 0;
    if ((size[chosen] ?? 0) >= 5) return;
    const seat = new SeatState();
    seat.name = name || "Merirosvo";
    seat.team = chosen;
    seat.bot = false;
    seat.color = this.state.seats.size % 5;
    this.state.seats.set(id, seat);
    this.log(`${seat.name} liittyi ${chosen === 0 ? "punaiseen" : "mustaan"} miehistöön.`);
  }

  humans(team: number): number {
    let count = 0;
    this.state.seats.forEach((seat) => {
      if (seat.team === team && !seat.bot) count++;
    });
    return count;
  }

  bothSides(): boolean {
    return this.humans(0) > 0 && this.humans(1) > 0;
  }

  start(): void {
    if (this.state.phase !== "wait") return;
    for (const team of [0, 1]) {
      let count = 0;
      this.state.seats.forEach((seat) => {
        if (seat.team === team) count++;
      });
      let bot = 0;
      while (count < 5) {
        const seat = new SeatState();
        seat.name = BOTS[(team * 5 + count) % BOTS.length] ?? "Botti";
        seat.team = team;
        seat.bot = true;
        seat.color = count % 5;
        this.state.seats.set(`bot-${team}-${bot++}`, seat);
        count++;
      }
    }
    this.state.phase = "battle";
    this.state.hull0 = 100;
    this.state.hull1 = 100;
    this.state.shield0 = 28;
    this.state.shield1 = 28;
    this.state.charge0 = 0;
    this.state.charge1 = 0;
    this.state.sys0 = "100,100,100,100";
    this.state.sys1 = "100,100,100,100";
    this.state.attacker = -1;
    this.state.winner = "";
    this.log("Ottelu alkoi. Tähtää järjestelmään. Ase laukeaa, kun lataus on täysi.");
  }

  aim(id: string, system: number): void {
    const seat = this.state.seats.get(id);
    if (!seat || this.state.phase !== "battle" || system < 0 || system > 3) return;
    if (seat.team === 0) this.state.aim0 = system;
    else this.state.aim1 = system;
    this.log(`Kohde: ${SYSTEMS[system]}`);
  }

  pump(id: string): void {
    const seat = this.state.seats.get(id);
    if (!seat || this.state.phase !== "battle") return;
    if (seat.team === 0) this.state.charge0 = Math.min(100, this.state.charge0 + 8);
    else this.state.charge1 = Math.min(100, this.state.charge1 + 8);
  }

  board(id: string): void {
    const seat = this.state.seats.get(id);
    if (!seat || this.state.phase !== "battle") return;
    const shield = seat.team === 0 ? this.state.shield1 : this.state.shield0;
    if (shield > 1) {
      this.log("Vastustajan kilpi pitää vielä.");
      return;
    }
    this.openBoarding(seat.team);
  }

  swap(id: string, a: number, b: number): void {
    const seat = this.state.seats.get(id);
    if (!seat || this.state.phase !== "boarding") return;
    this.swapTeam(seat.team, a, b);
  }

  tick(dt: number): void {
    if (dt <= 0 || this.state.phase === "wait" || this.state.phase === "end") return;
    if (this.state.phase === "boarding") {
      this.ai += dt;
      if (this.ai < 1.2) return;
      this.ai = 0;
      for (const team of [0, 1]) {
        if (this.humans(team) > 0) continue;
        const raw = team === 0 ? this.state.board0 : this.state.board1;
        const move = aiBladeMove(decodeBlade(raw));
        if (move) this.swapTeam(team, move[0], move[1]);
        if (this.state.phase !== "boarding") return;
      }
      return;
    }
    this.state.charge0 = Math.min(100, this.state.charge0 + dt * 22);
    this.state.charge1 = Math.min(100, this.state.charge1 + dt * 22);
    this.state.shield0 = Math.min(48, this.state.shield0 + dt);
    this.state.shield1 = Math.min(48, this.state.shield1 + dt);
    this.aimClock += dt;
    if (this.aimClock > 3) {
      this.aimClock = 0;
      if (this.humans(0) === 0) this.state.aim0 = Math.floor(this.rng() * 4);
      if (this.humans(1) === 0) this.state.aim1 = Math.floor(this.rng() * 4);
    }
    if (this.state.charge0 >= 100) this.shoot(0);
    if (this.state.phase === "battle" && this.state.charge1 >= 100) this.shoot(1);
  }

  private openBoarding(team: number): void {
    this.state.phase = "boarding";
    this.state.attacker = team;
    this.state.hp0 = BOARD_HP;
    this.state.hp1 = BOARD_HP;
    this.state.board0 = encodeBlade(generateBladeBoard(this.rng));
    this.state.board1 = encodeBlade(generateBladeBoard(this.rng));
    this.ai = 0;
    this.log(team === 0 ? "Punaiset nousevat kyytiin!" : "Mustat nousevat kyytiin!");
  }

  private swapTeam(team: number, a: number, b: number): void {
    const raw = team === 0 ? this.state.board0 : this.state.board1;
    const hit = bladeSwap(decodeBlade(raw), a, b, this.rng);
    if (!hit) return;
    if (team === 0) {
      this.state.board0 = encodeBlade(hit.board);
      this.state.hp1 = Math.max(0, this.state.hp1 - hit.damage);
    } else {
      this.state.board1 = encodeBlade(hit.board);
      this.state.hp0 = Math.max(0, this.state.hp0 - hit.damage);
    }
    this.log(`Isku −${hit.damage}`);
    this.finishBoard();
  }

  private shoot(team: number): void {
    if (this.state.phase !== "battle") return;
    const foe = team === 0 ? 1 : 0;
    const aim = team === 0 ? this.state.aim0 : this.state.aim1;
    const shield = foe === 0 ? this.state.shield0 : this.state.shield1;
    const impact = resolvePlayerImpact(16, shield);
    const systems = parseSystems(foe === 0 ? this.state.sys0 : this.state.sys1);
    systems[aim % 4] = Math.max(0, (systems[aim % 4] ?? 100) - impact.systemDamage);
    const encoded = systems.map((value) => String(Math.round(value))).join(",");
    if (foe === 0) {
      this.state.shield0 = impact.shield;
      this.state.hull0 = Math.max(0, this.state.hull0 - impact.hullDamage);
      this.state.sys0 = encoded;
      this.state.charge0 = 0;
    } else {
      this.state.shield1 = impact.shield;
      this.state.hull1 = Math.max(0, this.state.hull1 - impact.hullDamage);
      this.state.sys1 = encoded;
      this.state.charge1 = 0;
    }
    this.log(`${SYSTEMS[aim % 4]} −${Math.max(1, Math.round(impact.hullDamage || 1))}`);
    const hull = foe === 0 ? this.state.hull0 : this.state.hull1;
    if (hull <= 0) this.end(String(team));
  }

  private finishBoard(): void {
    if (this.state.phase !== "boarding" || this.state.attacker < 0) return;
    const attacker = this.state.attacker;
    const defender = attacker === 0 ? 1 : 0;
    const attackerHp = attacker === 0 ? this.state.hp0 : this.state.hp1;
    const defenderHp = defender === 0 ? this.state.hp0 : this.state.hp1;
    if (defenderHp <= 0) {
      if (defender === 0) this.state.hull0 = 0;
      else this.state.hull1 = 0;
      this.end(String(attacker));
      this.log("Kansi vallattu!");
      return;
    }
    if (attackerHp > 0) return;
    if (attacker === 0) this.state.hull0 = Math.max(0, this.state.hull0 - 18);
    else this.state.hull1 = Math.max(0, this.state.hull1 - 18);
    if (defender === 0) this.state.shield0 = 28;
    else this.state.shield1 = 28;
    this.state.phase = "battle";
    this.state.attacker = -1;
    this.log("Maihinnousu torjuttiin.");
    const hull = attacker === 0 ? this.state.hull0 : this.state.hull1;
    if (hull <= 0) this.end(String(defender));
  }

  private end(winner: string): void {
    this.state.phase = "end";
    this.state.winner = winner;
    this.state.attacker = -1;
    this.log(winner === "0" ? "Punainen miehistö voitti." : "Musta miehistö voitti.");
  }

  private log(text: string): void {
    this.state.log = text;
    this.state.logSeq = (this.state.logSeq + 1) & 0xffff;
  }
}
