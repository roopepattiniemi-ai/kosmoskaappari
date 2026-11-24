import Phaser from "phaser";
import { assetUrl, manifest, CREW_FRAME, EXPLOSION_FRAME } from "../../shared/assets.js";
import {
  DEFAULT_BUBBLE,
  DEFAULT_ENEMY_BOXES,
  DEFAULT_HARDPOINTS,
  type EnemyBox,
  type Hardpoint,
} from "../../shared/hardpoints.js";
import {
  CONTENT_BBOX,
  ENEMY_MUZZLE,
  FEET_ROW,
  FLOOR_Y,
  HULL_HIT,
  LADDER_X,
  SECTION_IDS,
  SECTIONS,
  sectionAt,
  type SectionId,
} from "../../shared/sections.js";
import { bridge } from "../bridge.js";

const FEET_Y = FEET_ROW / CREW_FRAME;
const CREW_SCALE = 1;
/** v0.4 guns are 128×96. 1.5× keeps them readable on the 1600×700 hull. */
const GUN_SCALE = 1.5;
const GUN_PIVOT = { x: 44, y: 84 };
const AIM_KEYS = ["aseet", "kilpi", "ohjaus", "reaktori"] as const;
const GUN_KIND = ["", "laser", "tykki", "ohjus"] as const;

interface CrewTarget {
  x: number;
  y: number;
  walking: boolean;
  facing: number;
  color: number;
  name: string;
}

export class ShipScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Container;
  private highlights!: Phaser.GameObjects.Graphics;
  private stars!: Phaser.GameObjects.Graphics;
  private enemy!: Phaser.GameObjects.Image;
  private enemyGfx!: Phaser.GameObjects.Graphics;
  private gunGfx!: Phaser.GameObjects.Graphics;
  private guns: Phaser.GameObjects.Image[] = [];
  private enemyLabels: Phaser.GameObjects.Text[] = [];
private damage: Phaser.GameObjects.Image[] = [];
private bubbleImage!: Phaser.GameObjects.Image;
private reticle!: Phaser.GameObjects.Image;
private mouths: Record<string, [number, number]> = {};
private polys: number[][][] = [];
  private hover: SectionId | null = null;
  private mine: SectionId | null = null;
  private occupied = new Set<SectionId>();
  private crew = new Map<string, { root: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Sprite; ring: Phaser.GameObjects.Ellipse; shownX: number; shownY: number }>();
  private targets = new Map<string, CrewTarget>();
  private label!: Phaser.GameObjects.Text;
  private enemyScale = 0.2;
  private cracks = [100, 100, 100, 100, 100, 100];
  private hardpoints: Hardpoint[] = DEFAULT_HARDPOINTS;
  private boxes: EnemyBox[] = DEFAULT_ENEMY_BOXES;
  private bubble = DEFAULT_BUBBLE;
  private mounts = [1, 0, 0, 0];
  private charges = [0, 0, 0, 0];
  private enemySystems = [100, 100, 100, 100];
  private shieldRatio = 0.6;
  private aim = 0;

  constructor() {
    super("ship");
  }

  preload(): void {
    this.load.image("ship", assetUrl(manifest.ship));
    this.load.image("enemy", assetUrl(manifest.enemy));
    this.load.json("shipMeta", assetUrl(manifest.shipMeta));
    this.load.json("enemyMeta", assetUrl(manifest.enemyMeta));
    this.load.json("weaponMeta", assetUrl(manifest.weaponMeta));
    manifest.crew.forEach((file, index) => {
      this.load.spritesheet(`crew${index}`, assetUrl(file), { frameWidth: CREW_FRAME, frameHeight: CREW_FRAME });
    });
    for (const kind of ["laser", "tykki", "ohjus"] as const) {
      for (const level of [1, 2, 3]) this.load.image(`gun-${kind}-${level}`, assetUrl(`v04/ase_${kind}_${level}.png`));
    }
    this.load.spritesheet("muzzle", assetUrl(manifest.muzzle), { frameWidth: 64, frameHeight: 48 });
    this.load.image("missile", assetUrl(manifest.missile));
    this.load.image("bubble", assetUrl(manifest.bubble));
    this.load.image("reticle", assetUrl(manifest.reticle));
    AIM_KEYS.forEach((key) => this.load.image(`dmg-${key}`, assetUrl(manifest.enemyDamage[key])));
    this.load.image("laser", assetUrl(manifest.laser));
    this.load.spritesheet("boom", assetUrl(manifest.explosion), { frameWidth: EXPLOSION_FRAME, frameHeight: EXPLOSION_FRAME });
    this.load.image("shieldfx", assetUrl(manifest.shieldHit));
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0c0b0d");
    const shipMeta = this.cache.json.get("shipMeta") as { asepaikat?: Hardpoint[] } | undefined;
    if (shipMeta?.asepaikat?.length) this.hardpoints = shipMeta.asepaikat.slice(0, 4);
    this.readWeaponMouths();
    this.readEnemyRooms();

    this.stars = this.add.graphics();
    this.ship = this.add.container(0, 0);
    const hull = this.add.image(0, 0, "ship").setOrigin(0, 0);
    this.highlights = this.add.graphics();
    this.gunGfx = this.add.graphics();
    const ladder = this.add.graphics();
    drawLadder(ladder);
    this.guns = this.hardpoints.map(() =>
      this.add.image(0, 0, "gun-laser-1")
        .setOrigin(GUN_PIVOT.x / 128, GUN_PIVOT.y / 96)
        .setFlipX(true)
        .setScale(GUN_SCALE)
        .setVisible(false),
    );
    this.ship.add([hull, this.highlights, this.gunGfx, ladder, ...this.guns]);
    this.enemy = this.add.image(0, 0, "enemy").setOrigin(0, 0);
    this.damage = AIM_KEYS.map((key) => this.add.image(0, 0, `dmg-${key}`).setOrigin(0, 0).setVisible(false).setDepth(11));
    this.bubbleImage = this.add.image(0, 0, "bubble").setOrigin(0, 0).setDepth(14);
    this.reticle = this.add.image(0, 0, "reticle").setOrigin(0, 0).setDepth(15);
    this.enemyGfx = this.add.graphics().setDepth(12);
    this.enemyLabels = this.boxes.map((box) =>
      this.add.text(0, 0, box.name, {
        fontFamily: "Lilita, sans-serif",
        fontSize: "15px",
        color: "#fff4d2",
        stroke: "#000000",
        strokeThickness: 4,
      }).setOrigin(0.5, 1).setDepth(13),
    );
    this.label = this.add.text(0, 0, "", {
      fontFamily: "Lilita, sans-serif",
      fontSize: "22px",
      color: "#fff4d2",
      stroke: "#000000",
      strokeThickness: 5,
    }).setOrigin(0.5, 1).setDepth(20);

    for (let index = 0; index < manifest.crew.length; index++) {
      this.anims.create({
        key: `idle${index}`,
        frames: this.anims.generateFrameNumbers(`crew${index}`, { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });
      this.anims.create({
        key: `walk${index}`,
        frames: this.anims.generateFrameNumbers(`crew${index}`, { start: 4, end: 7 }),
        frameRate: 10,
        repeat: -1,
      });
    }
    this.anims.create({
      key: "muzzle-flash",
      frames: this.anims.generateFrameNumbers("muzzle", { start: 0, end: 3 }),
      frameRate: 18,
      repeat: 0,
    });
    this.anims.create({
      key: "explode",
      frames: this.anims.generateFrameNumbers("boom", { start: 0, end: 3 }),
      frameRate: 14,
      repeat: 0,
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.hover = this.enemyBoxAt(pointer) === null ? this.pick(pointer) : null;
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const system = this.enemyBoxAt(pointer);
      if (system !== null) {
        bridge.onAim(system);
        return;
      }
      const section = this.pick(pointer);
      if (section) bridge.onSection(section);
    });
    this.scale.on("resize", () => this.layout());
    this.layout();
    bridge.onReady(this);
  }

  setCrew(next: Map<string, CrewTarget>): void {
    if (!this.ship) return;
    this.targets = next;
    this.occupied.clear();
    this.mine = null;
    for (const [id, target] of next) {
      const section = sectionNear(target.x, target.y);
      if (section && !target.walking) this.occupied.add(section);
      if (id === bridge.sessionId && !target.walking) this.mine = section;
      const color = Math.max(0, Math.min(manifest.crew.length - 1, target.color));
      let actor = this.crew.get(id);
      if (!actor) {
        const sprite = this.add.sprite(0, 0, `crew${color}`, 0);
        sprite.setOrigin(0.5, FEET_Y);
        sprite.setScale(CREW_SCALE);
        const ring = this.add.ellipse(0, -2, 72, 14, 0xe6c36a, 0.0);
        const root = this.add.container(target.x, target.y, [ring, sprite]);
        this.ship.add(root);
        actor = { root, sprite, ring, shownX: target.x, shownY: target.y };
        this.crew.set(id, actor);
      }
      if (actor.sprite.texture.key !== `crew${color}`) actor.sprite.setTexture(`crew${color}`, 0);
      actor.sprite.clearTint();
      actor.ring.setFillStyle(0xe6c36a, id === bridge.sessionId ? 0.4 : 0);
    }
    for (const [id, actor] of this.crew) {
      if (!next.has(id)) {
        actor.root.destroy();
        this.crew.delete(id);
      }
    }
  }

  setCracks(values: number[]): void {
    this.cracks = values;
  }

  setCombat(mounts: number[], charges: number[], systems: number[], shield: number, shieldMax: number, aim: number): void {
    this.mounts = mounts;
    this.charges = charges;
    this.enemySystems = systems;
    this.shieldRatio = shieldMax > 0 ? Math.max(0, Math.min(1, shield / shieldMax)) : 0;
    this.aim = aim;
    this.guns.forEach((gun, index) => {
      const level = mounts[index] ?? 0;
      gun.setVisible(level > 0);
      if (level > 0) {
        const kind = GUN_KIND[level] ?? "laser";
        gun.setTexture(`gun-${kind}-${level}`);
      }
      const spot = this.hardpoints[index];
      if (spot) gun.setPosition(spot.x, spot.y);
    });
  }

  playFx(kind: string, amount: number, slot = 0, system = 0): void {
    if (kind === "laser-me") this.fly(this.gunWorld(slot), this.systemWorld(system), this.mounts[slot] ?? 1, amount);
    if (kind === "laser-them") this.bolt(this.enemyMuzzle(), this.hullWorld(), 0xff6a4a);
    if (kind === "boom") this.burst(this.hullWorld(), amount);
    if (kind === "shield") this.shield(this.hullWorld());
    if (kind === "dodge") this.floatText(this.hullWorld(), "Väistö!", "#bfe9ff");
  }

  update(_time: number, delta: number): void {
    const k = 1 - Math.exp(-delta / 70);
    for (const [id, actor] of this.crew) {
      const target = this.targets.get(id);
      if (!target) continue;
      const dist = Math.hypot(target.x - actor.shownX, target.y - actor.shownY);
      if (dist > 280) {
        actor.shownX = target.x;
        actor.shownY = target.y;
      } else {
        actor.shownX += (target.x - actor.shownX) * k;
        actor.shownY += (target.y - actor.shownY) * k;
      }
      actor.root.setPosition(actor.shownX, actor.shownY);
      actor.sprite.setFlipX(target.facing < 0);
      const color = Math.max(0, Math.min(manifest.crew.length - 1, target.color));
      actor.sprite.anims.play(`${target.walking ? "walk" : "idle"}${color}`, true);
    }
    this.drawHighlights();
    this.drawGuns();
    this.drawEnemy();
    this.placeLabel();
  }

  private pick(pointer: Phaser.Input.Pointer): SectionId | null {
    const local = this.ship.getLocalPoint(pointer.worldX, pointer.worldY);
    return sectionAt(local.x, local.y);
  }

  private enemyBoxAt(pointer: Phaser.Input.Pointer): number | null {
    if (this.enemyScale < 0.05) return null;
    const x = (pointer.worldX - this.enemy.x) / this.enemyScale;
    const y = (pointer.worldY - this.enemy.y) / this.enemyScale;
    for (let index = 0; index < this.boxes.length; index++) {
      const poly = this.polys[index];
      if (poly && pointInPoly(x, y, poly)) return index;
      const box = this.boxes[index]!;
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return index;
    }
    return null;
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    if (w < 8 || h < 8) return;
    this.stars.clear();
    for (let i = 0; i < 70; i++) {
      const x = (i * 97) % w;
      const y = (i * 53) % h;
      this.stars.fillStyle(i % 5 === 0 ? 0xe6c36a : 0xfff4dd, i % 5 === 0 ? 0.85 : 0.45);
      this.stars.fillCircle(x, y, i % 7 === 0 ? 1.7 : 1);
    }
    const [bx, by, bx2, by2] = CONTENT_BBOX;
    const bw = bx2 - bx;
    const bh = by2 - by;
    const gap = 10;
    const enemyShare = w < 720 ? 0.46 : 0.4;
    const enemyW = Math.max(48, w * enemyShare - gap);
    this.enemyScale = Math.min(enemyW / 900, (h * 0.94) / 500);
    const enemyH = 500 * this.enemyScale;
    this.enemy.setScale(this.enemyScale);
    this.enemy.setPosition(6, (h - enemyH) / 2);
    const shipLeft = this.enemy.x + 900 * this.enemyScale + gap;
    const shipScale = Math.min(Math.max(40, w - shipLeft - 8) / bw, (h * 0.96) / bh);
    this.ship.setScale(shipScale);
    this.ship.setPosition(shipLeft - bx * shipScale, h / 2 - (by + bh / 2) * shipScale);
  }

  private drawHighlights(): void {
    const g = this.highlights;
    g.clear();
    const pulse = 0.45 + Math.sin(this.time.now / 280) * 0.15;
    for (const id of SECTION_IDS) {
      const s = SECTIONS[id];
      const mine = id === this.mine;
      const hot = id === this.hover;
      const top = s.hitY0;
      const crack = this.cracks[SECTION_IDS.indexOf(id)] ?? 100;
      if (crack < 80) {
        g.fillStyle(0xc45a32, crack < 30 ? 0.38 : 0.18);
        g.fillRect(s.x0, top, s.x1 - s.x0, s.y1 - top);
      }
      if (!mine && !hot) continue;
      g.fillStyle(mine ? 0xe6c36a : 0xc45a32, mine ? 0.12 * pulse + 0.05 : 0.1);
      g.fillRect(s.x0, top, s.x1 - s.x0, s.y1 - top);
      g.lineStyle(mine ? 5 : 3, mine ? 0xe6c36a : 0xd7c4a0, mine ? 0.85 : 0.45);
      g.strokeRect(s.x0 + 2, top + 2, s.x1 - s.x0 - 4, s.y1 - top - 4);
    }
  }

  private drawGuns(): void {
    const g = this.gunGfx;
    g.clear();
    this.hardpoints.forEach((spot, index) => {
      if ((this.mounts[index] ?? 0) <= 0) return;
      const charge = (this.charges[index] ?? 0) / 100;
      g.lineStyle(4, 0xe6c36a, 0.9);
      g.beginPath();
      g.arc(spot.x, spot.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge, false);
      g.strokePath();
    });
  }

  private drawEnemy(): void {
    const g = this.enemyGfx;
    g.clear();
    const s = this.enemyScale;
    const ox = this.enemy.x;
    const oy = this.enemy.y;
    this.damage.forEach((layer, index) => {
      layer.setPosition(ox, oy).setScale(s).setVisible((this.enemySystems[index] ?? 100) < 45);
    });
    const bubbleOn = this.shieldRatio > 0.02;
    this.bubbleImage.setVisible(bubbleOn).setPosition(ox - 34 * s, oy - 24 * s).setScale(s).setAlpha(0.28 + this.shieldRatio * 0.62);
    this.boxes.forEach((box, index) => {
      const hot = index === this.aim;
      if (!hot) return;
      g.lineStyle(2, 0xe6c36a, 0.85);
      g.strokeRect(ox + box.x * s, oy + box.y * s, box.w * s, box.h * s);
    });
    const aimBox = this.boxes[this.aim];
    if (aimBox) {
      this.reticle.setVisible(true).setPosition(ox + (aimBox.hitX - 32) * s, oy + (aimBox.hitY - 32) * s).setScale(Math.max(s, 0.4));
    } else this.reticle.setVisible(false);
    this.enemyLabels.forEach((label) => label.setVisible(false));
  }

  private placeLabel(): void {
    const id = this.hover ?? this.mine;
    if (!id || this.ship.scaleX < 0.22) {
      this.label.setVisible(false);
      return;
    }
    const s = SECTIONS[id];
    const x = this.ship.x + ((s.x0 + s.x1) / 2) * this.ship.scaleX;
    const y = this.ship.y + (s.hitY0 + 18) * this.ship.scaleY;
    this.label.setText(s.name).setPosition(x, y).setVisible(true);
  }

  private gunWorld(slot: number): Phaser.Math.Vector2 {
    const spot = this.hardpoints[slot] ?? this.hardpoints[0] ?? { x: 232, y: 330 };
    const level = this.mounts[slot] ?? 1;
    const kind = GUN_KIND[level] ?? "laser";
    const mouth = this.mouths[`${kind}_${level}`] ?? [93, 61];
    const dx = (GUN_PIVOT.x - mouth[0]) * GUN_SCALE;
    const dy = (mouth[1] - GUN_PIVOT.y) * GUN_SCALE;
    return new Phaser.Math.Vector2(
      this.ship.x + (spot.x + dx) * this.ship.scaleX,
      this.ship.y + (spot.y + dy) * this.ship.scaleY,
    );
  }

  private systemWorld(system: number): Phaser.Math.Vector2 {
    const box = this.boxes[system] ?? this.boxes[0];
    const x = box?.hitX ?? 460;
    const y = box?.hitY ?? 250;
    return new Phaser.Math.Vector2(this.enemy.x + x * this.enemyScale, this.enemy.y + y * this.enemyScale);
  }

  private hullWorld(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.ship.x + HULL_HIT.x * this.ship.scaleX, this.ship.y + HULL_HIT.y * this.ship.scaleY);
  }

  private enemyMuzzle(): Phaser.Math.Vector2 {
    const box = this.boxes[0];
    const x = box?.hitX ?? ENEMY_MUZZLE.x;
    const y = box?.hitY ?? ENEMY_MUZZLE.y;
    return new Phaser.Math.Vector2(this.enemy.x + x * this.enemyScale, this.enemy.y + y * this.enemyScale);
  }

  private fly(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, level: number, amount: number): void {
    const flash = this.add.sprite(from.x, from.y, "muzzle").setDepth(19).setOrigin(2 / 64, 24 / 48).setFlipX(true);
    flash.play("muzzle-flash");
    flash.once("animationcomplete", () => flash.destroy());
    const missile = level >= 3;
    const img = this.add.image(from.x, from.y, missile ? "missile" : "laser").setDepth(18);
    if (missile) img.setOrigin(62 / 64, 12 / 24).setFlipX(true);
    else {
      img.setTint(level === 2 ? 0xe6c36a : 0x9ff3ff);
      img.setDisplaySize(36, 12);
    }
    this.tweens.add({
      targets: img,
      x: to.x,
      y: to.y,
      duration: missile ? 420 : 240,
      onUpdate: () => {
        if (!missile) img.setRotation(Math.atan2(to.y - img.y, to.x - img.x));
      },
      onComplete: () => {
        img.destroy();
        this.burst(to, amount);
      },
    });
  }

  private readWeaponMouths(): void {
    const meta = this.cache.json.get("weaponMeta") as { aseet?: Record<string, { suu_px?: number[] }> } | undefined;
    for (const [key, gun] of Object.entries(meta?.aseet ?? {})) {
      const mouth = gun.suu_px;
      if (mouth && mouth.length >= 2) this.mouths[key.replace("ase_", "")] = [mouth[0] ?? 0, mouth[1] ?? 0];
    }
  }

  private readEnemyRooms(): void {
    const meta = this.cache.json.get("enemyMeta") as {
      huoneet?: Record<string, { bbox?: number[]; keskipiste?: number[]; aukko_px?: number[][] }>;
    } | undefined;
    const rooms = meta?.huoneet;
    if (!rooms) return;
    const names = ["Aseet", "Kilpi", "Ohjaus", "Reaktori"];
    this.boxes = AIM_KEYS.map((key, index) => {
      const room = rooms[key];
      const bbox = room?.bbox ?? [0, 0, 10, 10];
      const center = room?.keskipiste ?? [bbox[0] ?? 0, bbox[1] ?? 0];
      this.polys[index] = room?.aukko_px ?? [];
      return {
        id: key,
        name: names[index] ?? key,
        x: bbox[0] ?? 0,
        y: bbox[1] ?? 0,
        w: (bbox[2] ?? 0) - (bbox[0] ?? 0),
        h: (bbox[3] ?? 0) - (bbox[1] ?? 0),
        hitX: center[0] ?? 0,
        hitY: center[1] ?? 0,
      };
    });
  }

  private bolt(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, tint: number): void {
    const img = this.add.image((from.x + to.x) / 2, (from.y + to.y) / 2, "laser").setDepth(15);
    img.setTint(tint);
    const len = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    img.setRotation(Math.atan2(to.y - from.y, to.x - from.x));
    img.setDisplaySize(Math.max(24, len), 16);
    this.tweens.add({ targets: img, alpha: 0, duration: 220, onComplete: () => img.destroy() });
  }

  private burst(at: Phaser.Math.Vector2, amount: number): void {
    const boom = this.add.sprite(at.x, at.y, "boom").setDepth(16);
    boom.setScale(Math.max(0.45, Math.min(this.ship.scaleX, 1)));
    boom.play("explode");
    boom.once("animationcomplete", () => boom.destroy());
    this.cameras.main.shake(160, 0.004);
    if (amount > 0) this.floatText(at, `−${Math.max(1, Math.round(amount))}`, "#ffb4a2");
  }

  private shield(at: Phaser.Math.Vector2): void {
    const img = this.add.image(at.x, at.y, "shieldfx").setDepth(16);
    img.setScale(Math.max(0.6, this.ship.scaleX));
    this.tweens.add({
      targets: img,
      alpha: 0,
      scale: img.scale * 1.2,
      duration: 320,
      onComplete: () => img.destroy(),
    });
  }

  private floatText(at: Phaser.Math.Vector2, text: string, color: string): void {
    const label = this.add.text(at.x, at.y, text, {
      fontFamily: "Lilita, sans-serif",
      fontSize: "20px",
      color,
      stroke: "#000000",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({
      targets: label,
      y: at.y - 36,
      alpha: 0,
      duration: 700,
      onComplete: () => label.destroy(),
    });
  }
}

function drawLadder(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(6, 0x2a2624, 1);
  g.beginPath();
  g.moveTo(LADDER_X - 11, FLOOR_Y.yla - 4);
  g.lineTo(LADDER_X - 11, FLOOR_Y.ala + 2);
  g.moveTo(LADDER_X + 11, FLOOR_Y.yla - 4);
  g.lineTo(LADDER_X + 11, FLOOR_Y.ala + 2);
  g.strokePath();
  g.lineStyle(4, 0xc6a15a, 0.95);
  for (let y = FLOOR_Y.yla + 6; y <= FLOOR_Y.ala; y += 16) {
    g.beginPath();
    g.moveTo(LADDER_X - 11, y);
    g.lineTo(LADDER_X + 11, y);
    g.strokePath();
  }
}

function pointInPoly(x: number, y: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]?.[0] ?? 0;
    const yi = poly[i]?.[1] ?? 0;
    const xj = poly[j]?.[0] ?? 0;
    const yj = poly[j]?.[1] ?? 0;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1) + xi) inside = !inside;
  }
  return inside;
}

function sectionNear(x: number, y: number): SectionId | null {
  let best: SectionId | null = null;
  let score = Infinity;
  for (const id of SECTION_IDS) {
    const s = SECTIONS[id];
    if (x < s.x0 - 8 || x > s.x1 + 8) continue;
    const dy = Math.abs(y - s.floorY);
    if (dy < score) {
      score = dy;
      best = id;
    }
  }
  return score < 30 ? best : null;
}
