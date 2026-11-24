export type MusicId = "valikko" | "kartta" | "taistelu" | "pomo" | "kauppa";

export const MUSIC_FILES: Record<MusicId, string> = {
  valikko: "musa_valikko.mp3",
  kartta: "musa_kartta.mp3",
  taistelu: "musa_taistelu.mp3",
  pomo: "musa_pomo.mp3",
  kauppa: "musa_kauppa.mp3",
};

export const SFX_FILES = {
  laser: "sfx_laser.mp3",
  tykki: "sfx_tykki.mp3",
  osuma: "sfx_osuma.mp3",
  rajahdys: "sfx_rajahdys.mp3",
  kilpi: "sfx_kilpi_osuma.mp3",
  halytys: "sfx_halytys.mp3",
  hyppy: "sfx_hyppy.mp3",
  kristalli: "sfx_kristalli.mp3",
  osto: "sfx_osto.mp3",
  paivitys: "sfx_paivitys.mp3",
  korjaus: "sfx_korjaus.mp3",
  nappi: "sfx_nappi.mp3",
  pulmaOk: "sfx_pulma_onnistui.mp3",
  pulmaBad: "sfx_pulma_epaonnistui.mp3",
  askel: "sfx_askel.mp3",
  voitto: "sfx_voitto.mp3",
  havio: "sfx_havio.mp3",
} as const;

export type SfxId = keyof typeof SFX_FILES;

export function musicTrack(input: { inGame: boolean; phase: string; screen: string; boss: boolean }): MusicId {
  if (!input.inGame) return "valikko";
  if (input.screen === "shop") return "kauppa";
  if (input.phase === "defeat" || input.screen === "won" || input.screen === "over") return "valikko";
  if (input.phase === "battle" || input.phase === "victory") return input.boss ? "pomo" : "taistelu";
  return "kartta";
}
