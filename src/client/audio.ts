let ctx: AudioContext | null = null;
let muted = localStorage.getItem("kosmos-mute") === "1";

function context(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0): void {
  const audio = context();
  if (!audio) return;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), audio.currentTime + dur);
  amp.gain.setValueAtTime(gain, audio.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0008, audio.currentTime + dur);
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + dur + 0.02);
}

export const sfx = {
  get muted() {
    return muted;
  },
  unlock() {
    context();
  },
  toggle(): boolean {
    muted = !muted;
    localStorage.setItem("kosmos-mute", muted ? "1" : "0");
    if (!muted) context();
    return muted;
  },
  tap() {
    tone(520, 0.05, "square", 0.03);
  },
  swap() {
    tone(340, 0.07, "triangle", 0.04);
  },
  bad() {
    tone(140, 0.14, "sawtooth", 0.03);
  },
  match(cascade: number) {
    tone(420 + cascade * 90, 0.12, "triangle", 0.05);
    tone(640 + cascade * 110, 0.16, "sine", 0.03);
  },
  big() {
    tone(220, 0.2, "sawtooth", 0.04, 180);
    tone(480, 0.28, "triangle", 0.04, 200);
  },
  move() {
    tone(180, 0.03, "square", 0.02);
  },
  rotate() {
    tone(260, 0.06, "square", 0.03, 80);
  },
  lock() {
    tone(90, 0.08, "square", 0.04);
  },
  line(n: number) {
    for (let i = 0; i < Math.max(1, n); i++) {
      setTimeout(() => tone(360 + i * 80, 0.12, "square", 0.04), i * 55);
    }
  },
  laser() {
    tone(880, 0.12, "sawtooth", 0.03, -600);
  },
  boom() {
    tone(100, 0.22, "sawtooth", 0.05, -60);
  },
  shield() {
    tone(620, 0.16, "sine", 0.04, 140);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, "triangle", 0.05), i * 120));
  },
  lose() {
    [392, 311, 233].forEach((f, i) => setTimeout(() => tone(f, 0.22, "triangle", 0.04), i * 160));
  },
};
