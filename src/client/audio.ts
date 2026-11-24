import { MUSIC_FILES, SFX_FILES, type MusicId, type SfxId } from "../shared/music.js";

const MUSIC_KEY = "kosmos-music";
const SFX_KEY = "kosmos-sfx";
const MUTE_KEY = "kosmos-mute";

let musicVol = clampVol(Number(localStorage.getItem(MUSIC_KEY) ?? "0.55"), 0.55);
let sfxVol = clampVol(Number(localStorage.getItem(SFX_KEY) ?? "0.8"), 0.8);
let muted = localStorage.getItem(MUTE_KEY) === "1";
let armed = false;
let wanted: MusicId = "valikko";
let playing: MusicId | null = null;
let from: HTMLAudioElement | null = null;
let to: HTMLAudioElement | null = null;
let fade = 1;
let duckUntil = 0;
let lastFrame = performance.now();

function clampVol(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function musicLevel(): number {
  if (muted) return 0;
  const ducked = performance.now() < duckUntil ? 0.35 : 1;
  return musicVol * ducked;
}

function element(src: string, loop: boolean): HTMLAudioElement {
  const audio = new Audio(src);
  audio.loop = loop;
  audio.preload = "auto";
  return audio;
}

function startMusic(id: MusicId): void {
  if (playing === id && to) {
    to.volume = musicLevel() * fade;
    return;
  }
  playing = id;
  const next = element(`/assets/audio/${MUSIC_FILES[id]}`, true);
  next.volume = 0;
  from = to;
  to = next;
  fade = from ? 0 : 1;
  if (armed && !muted) void next.play().catch(() => undefined);
}

function frame(): void {
  const now = performance.now();
  const dt = Math.min(80, now - lastFrame);
  lastFrame = now;
  if (to && fade < 1) fade = Math.min(1, fade + dt / 1100);
  const level = musicLevel();
  if (to) to.volume = level * (from ? fade : 1);
  if (from) {
    from.volume = level * (1 - fade);
    if (fade >= 1) {
      from.pause();
      from = null;
    }
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

function cue(id: SfxId): void {
  if (!armed || muted || sfxVol <= 0) return;
  const audio = element(`/assets/audio/${SFX_FILES[id]}`, false);
  audio.volume = sfxVol;
  void audio.play().catch(() => undefined);
}

export const sfx = {
  get muted() {
    return muted;
  },
  get music() {
    return musicVol;
  },
  get effects() {
    return sfxVol;
  },
  unlock() {
    if (armed) return;
    armed = true;
    startMusic(wanted);
    if (to && to.paused) void to.play().catch(() => undefined);
  },
  musicTrack(id: MusicId) {
    wanted = id;
    if (!armed) return;
    startMusic(id);
  },
  setMusic(value: number) {
    musicVol = clampVol(value, musicVol);
    localStorage.setItem(MUSIC_KEY, String(musicVol));
  },
  setEffects(value: number) {
    sfxVol = clampVol(value, sfxVol);
    localStorage.setItem(SFX_KEY, String(sfxVol));
  },
  toggle(): boolean {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    if (muted) {
      from?.pause();
      to?.pause();
    } else if (armed) {
      startMusic(wanted);
      if (to) void to.play().catch(() => undefined);
    }
    return muted;
  },
  duck(ms = 4000) {
    duckUntil = performance.now() + ms;
  },
  cue,
  tap() {
    cue("nappi");
  },
  swap() {
    cue("nappi");
  },
  bad() {
    cue("pulmaBad");
  },
  match() {
    cue("pulmaOk");
  },
  big() {
    cue("pulmaOk");
  },
  move() {
    cue("nappi");
  },
  rotate() {
    cue("nappi");
  },
  lock() {
    cue("nappi");
  },
  line() {
    cue("pulmaOk");
  },
  laser() {
    cue("laser");
  },
  cannon() {
    cue("tykki");
  },
  hit() {
    cue("osuma");
  },
  boom() {
    cue("rajahdys");
  },
  shield() {
    cue("kilpi");
  },
  alarm() {
    cue("halytys");
  },
  jump() {
    cue("hyppy");
  },
  crystal() {
    cue("kristalli");
  },
  buy() {
    cue("osto");
  },
  upgrade() {
    cue("paivitys");
  },
  repair() {
    cue("korjaus");
  },
  step() {
    cue("askel");
  },
  win() {
    cue("voitto");
    this.duck();
  },
  board() {
    cue("abordaa");
  },
  blade() {
    cue("miekka");
  },
  parry() {
    cue("torjunta");
  },
  capture() {
    cue("valtaus");
    this.duck();
  },
  lose() {
    cue("havio");
    this.duck();
  },
};
