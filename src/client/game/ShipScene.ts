import Phaser from "phaser";
import { assetUrl, manifest, CREW_FRAME, EXPLOSION_FRAME } from "../../shared/assets.js";
import {
  CONTENT_BBOX,
  FLOOR_Y,
  HULL_HIT,
  LADDER_X,
  MUZZLE,
  SECTION_IDS,
  SECTIONS,
  sectionAt,
  type SectionId,
} from "../../shared/sections.js";
import { bridge } from "../bridge.js";

const FEET_Y = 124 / CREW_FRAME;
const CREW_SCALE = 0.8;

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
  private hover: SectionId | null = null;
  private mine: SectionId | null = null;
  private occupied = new Set<SectionId>();
  private crew = new Map<string, { root: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Sprite; ring: Phaser.GameObjects.Ellipse; shownX: number; shownY: number }>();
  private targets = new Map<string, CrewTarget>();
  private label!: Phaser.GameObjects.Text;
  private enemyScale = 0.2;

  constructor() {
    super("ship");
  }

  preload(): void {
    this.load.image("ship", assetUrl(manifest.ship));
    this.load.image("enemy", assetUrl(manifest.enemy));
    this.load.spritesheet("crew0", assetUrl(manifest.crew[0]), { frameWidth: CREW_FRAME, frameHeight: CREW_FRAME });
    this.load.spritesheet("crew1", assetUrl(manifest.crew[1]), { frameWidth: CREW_FRAME, frameHeight: CREW_FRAME });
    this.load.image("laser", assetUrl(manifest.laser));
    this.load.spritesheet("boom", assetUrl(manifest.explosion), { frameWidth: EXPLOSION_FRAME, frameHeight: EXPLOSION_FRAME });
    this.load.image("shieldfx", assetUrl(manifest.shieldHit));
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#120826");
    this.stars = this.add.graphics();
    this.ship = this.add.container(0, 0);
    const hull = this.add.image(0, 0, "ship").setOrigin(0, 0);
    this.highlights = this.add.graphics();
    const ladder = this.add.graphics();
    drawLadder(ladder);
    this.ship.add([hull, this.highlights, ladder]);
    this.enemy = this.add.image(0, 0, "enemy").setOrigin(0, 0);
    this.label = this.add.text(0, 0, "", {
      fontFamily: "Lilita, sans-serif",
      fontSize: "22px",
      color: "#fff4d2",
      stroke: "#2a160d",
      strokeThickness: 5,
    }).setOrigin(0.5, 1).setDepth(20);

    for (const key of ["crew0", "crew1"] as const) {
      const prefix = key === "crew0" ? "0" : "1";
      this.anims.create({
        key: `idle${prefix}`,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });
      this.anims.create({
        key: `walk${prefix}`,
        frames: this.anims.generateFrameNumbers(key, { start: 4, end: 7 }),
        frameRate: 10,
        repeat: -1,
      });
    }
    this.anims.create({
      key: "explode",
      frames: this.anims.generateFrameNumbers("boom", { start: 0, end: 3 }),
      frameRate: 14,
      repeat: 0,
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.hover = this.pick(pointer);
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
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
      let actor = this.crew.get(id);
      if (!actor) {
        const sprite = this.add.sprite(0, 0, target.color === 0 ? "crew0" : "crew1", 0);
        sprite.setOrigin(0.5, FEET_Y);
        sprite.setScale(CREW_SCALE);
        const ring = this.add.ellipse(0, -2, 54, 16, 0xf0c14a, 0.0);
        const root = this.add.container(target.x, target.y, [ring, sprite]);
        this.ship.add(root);
        actor = { root, sprite, ring, shownX: target.x, shownY: target.y };
        this.crew.set(id, actor);
      }
      actor.ring.setFillStyle(0xf0c14a, id === bridge.sessionId ? 0.45 : 0);
    }
    for (const [id, actor] of this.crew) {
      if (!next.has(id)) {
        actor.root.destroy();
        this.crew.delete(id);
      }
    }
  }

  playFx(kind: string, amount: number): void {
    if (kind === "laser-me") this.bolt(this.muzzleWorld(), this.enemyMuzzle(), 0xffe08a);
    if (kind === "laser-them") this.bolt(this.enemyMuzzle(), this.muzzleWorld(), 0xff6a4a);
    if (kind === "boom") this.burst(this.hullWorld(), amount);
    if (kind === "shield") this.shield(this.hullWorld());
    if (kind === "dodge") this.floatText(this.hullWorld(), "Väistö!", "#bfe9ff");
    if (kind === "laser-me") this.floatText(this.enemyCenter(), `−${Math.max(1, Math.round(amount))}`, "#ffe08a");
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
      const anim = `${target.walking ? "walk" : "idle"}${target.color === 0 ? "0" : "1"}`;
      actor.sprite.anims.play(anim, true);
    }
    this.drawHighlights();
    this.placeLabel();
  }

  private pick(pointer: Phaser.Input.Pointer): SectionId | null {
    const local = this.ship.getLocalPoint(pointer.worldX, pointer.worldY);
    return sectionAt(local.x, local.y);
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    if (w < 8 || h < 8) return;
    this.stars.clear();
    for (let i = 0; i < 70; i++) {
      const x = (i * 97) % w;
      const y = (i * 53) % h;
      this.stars.fillStyle(i % 5 === 0 ? 0xffe7a8 : 0xffffff, i % 5 === 0 ? 0.9 : 0.55);
      this.stars.fillCircle(x, y, i % 7 === 0 ? 1.7 : 1);
    }
    const [bx, by, bx2, by2] = CONTENT_BBOX;
    const bw = bx2 - bx;
    const bh = by2 - by;
    const mobile = document.body.dataset.layout !== "desktop";
    const shipScale = mobile
      ? Math.min(w / bw, h / bh) * 0.98
      : Math.min((w * 0.66) / bw, (h * 0.94) / bh);
    this.ship.setScale(shipScale);
    const bowX = mobile ? w * 0.5 - (bw / 2) * shipScale : w - 18 - bw * shipScale;
    this.ship.setPosition(bowX - bx * shipScale, h / 2 - (by + bh / 2) * shipScale);
    const gap = mobile ? 8 : 28;
    const roomForEnemy = Math.max(40, bowX - gap);
    this.enemyScale = Math.min((mobile ? h * 0.42 : h * 0.5) / 500, roomForEnemy / 900);
    this.enemy.setScale(this.enemyScale);
    this.enemy.setPosition(Math.max(4, bowX - gap - 900 * this.enemyScale), h * (mobile ? 0.02 : 0.12));
  }

  private drawHighlights(): void {
    const g = this.highlights;
    g.clear();
    const pulse = 0.45 + Math.sin(this.time.now / 280) * 0.15;
    for (const id of SECTION_IDS) {
      const s = SECTIONS[id];
      const mine = id === this.mine;
      const hot = id === this.hover;
      if (!mine && !hot) continue;
      g.fillStyle(mine ? 0xf0c14a : 0x7ec8ff, mine ? 0.16 * pulse + 0.08 : 0.18);
      g.fillRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
      g.lineStyle(mine ? 6 : 4, mine ? 0xffe08a : 0xffffff, mine ? 0.9 : 0.75);
      g.strokeRect(s.x0 + 2, s.y0 + 2, s.x1 - s.x0 - 4, s.y1 - s.y0 - 4);
    }
  }

  private placeLabel(): void {
    const id = this.hover ?? this.mine;
    if (!id || this.ship.scaleX < 0.35) {
      this.label.setVisible(false);
      return;
    }
    const s = SECTIONS[id];
    const x = this.ship.x + ((s.x0 + s.x1) / 2) * this.ship.scaleX;
    const y = this.ship.y + (s.y0 + 8) * this.ship.scaleY;
    this.label.setText(s.name).setPosition(x, y).setVisible(true);
  }

  private muzzleWorld(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      this.ship.x + MUZZLE.x * this.ship.scaleX,
      this.ship.y + MUZZLE.y * this.ship.scaleY,
    );
  }

  private hullWorld(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      this.ship.x + HULL_HIT.x * this.ship.scaleX,
      this.ship.y + HULL_HIT.y * this.ship.scaleY,
    );
  }

  private enemyMuzzle(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      this.enemy.x + 755 * this.enemyScale,
      this.enemy.y + 242 * this.enemyScale,
    );
  }

  private enemyCenter(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.enemy.x + 420 * this.enemyScale, this.enemy.y + 250 * this.enemyScale);
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
    const scale = Math.max(0.45, Math.min(this.ship.scaleX, 1));
    boom.setScale(scale);
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
      stroke: "#2a160d",
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
  g.lineStyle(7, 0x4a2a16, 1);
  g.beginPath();
  g.moveTo(LADDER_X - 12, FLOOR_Y.yla - 6);
  g.lineTo(LADDER_X - 12, FLOOR_Y.ala + 2);
  g.moveTo(LADDER_X + 12, FLOOR_Y.yla - 6);
  g.lineTo(LADDER_X + 12, FLOOR_Y.ala + 2);
  g.strokePath();
  g.lineStyle(5, 0xc4894a, 1);
  for (let y = FLOOR_Y.yla + 4; y <= FLOOR_Y.ala; y += 16) {
    g.beginPath();
    g.moveTo(LADDER_X - 12, y);
    g.lineTo(LADDER_X + 12, y);
    g.strokePath();
  }
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