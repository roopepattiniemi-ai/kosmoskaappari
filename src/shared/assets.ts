/**
 * Single manifest for v0.1 art. Drop a replacement PNG at the same path,
 * or change the path here — loaders read only this file.
 * Frame notes and ship bounds live in assets/v01/LUEMINUT.md and alus_oma.json.
 */
export const manifest = {
  ship: "v01/alus_oma.png",
  shipMeta: "v01/alus_oma.json",
  enemy: "v04/vihollinen_jarjestelmat.png",
  crew: [
    "v01/merirosvo1_sheet.png",
    "v01/merirosvo2_sheet.png",
    "v01/merirosvo3_sheet.png",
    "v01/merirosvo4_sheet.png",
    "v01/merirosvo5_sheet.png",
  ],
  spark: "v01/kipina.png",
  blades: [
    "v01/miekka_viilto.png",
    "v01/miekka_pisto.png",
    "v01/miekka_lyonti.png",
    "v01/miekka_torjunta.png",
  ],
  boarding: "v01/abordaa_tausta.png",
  /** Amber sweep. Rotate clockwise around the centre; the bright edge points up. */
  radarSweep: "v01/tutka_pyyhkaisy.png",
  radarSweepGreen: "v01/tutka_pyyhkaisy_vihrea.png",
  /** v0.4 guns, 128×96, barrel points right, pivot (44, 84). The ship flips them toward the enemy. */
  weapons: (["laser", "tykki", "ohjus"] as const).flatMap((kind) =>
    [1, 2, 3].map((level) => `v04/ase_${kind}_${level}.png`),
  ),
  weaponMeta: "v04/aseet.json",
  muzzle: "v04/suuliekki_sheet.png",
  missile: "v04/ohjus_ammus.png",
  enemyMeta: "v04/vihollinen_jarjestelmat.json",
  enemyDamage: {
    reaktori: "v04/vihollinen_vaurio_reaktori.png",
    kilpi: "v04/vihollinen_vaurio_kilpi.png",
    aseet: "v04/vihollinen_vaurio_aseet.png",
    ohjaus: "v04/vihollinen_vaurio_ohjaus.png",
  },
  bubble: "v04/kilpikupla.png",
  reticle: "v04/kohde_tahtain.png",
  nodes: {
    battle: "v04/solmu_taistelu.png",
    shop: "v04/solmu_kauppa.png",
    event: "v04/solmu_tapahtuma.png",
    boss: "v04/solmu_pomo.png",
    here: "v04/solmu_nykyinen.png",
  },
  shop: "v04/kauppa_tausta.png",
  crystals: [1, 2, 3, 4, 5, 6].map((n) => `v01/kristalli_${n}.png`),
  /** Colour index 1–7: I O T S Z J L */
  blocks: [
    "v01/ammus_pala_syaani.png",
    "v01/ammus_pala_keltainen.png",
    "v01/ammus_pala_violetti.png",
    "v01/ammus_pala_vihrea.png",
    "v01/ammus_pala_punainen.png",
    "v01/ammus_pala_sininen.png",
    "v01/ammus_pala_oranssi.png",
  ],
  laser: "v01/laser.png",
  explosion: "v01/rajahdys_sheet.png",
  shieldHit: "v01/kilpi_osuma.png",
  barFrame: "v01/energiapalkki_kehys.png",
  barFill: "v01/energiapalkki_tayte.png",
  button: "v01/nappi.png",
  buttonPressed: "v01/nappi_painettu.png",
} as const;

export const CREW_FRAME = 128;
export const CRYSTAL_FRAME = 96;
export const BLOCK_FRAME = 64;
/** merirosvo sheets: row 0 idle x4, row 1 walk x4, facing right. */
export const CREW_IDLE_ROW = 0;
export const CREW_WALK_ROW = 1;
export const EXPLOSION_FRAMES = 4;
export const EXPLOSION_FRAME = 128;

export function assetUrl(rel: string): string {
  return `/assets/${rel}`;
}

export function manifestFiles(): string[] {
  return [
    manifest.ship,
    manifest.shipMeta,
    manifest.enemy,
    ...manifest.crew,
    manifest.spark,
    ...manifest.blades,
    manifest.boarding,
    manifest.radarSweep,
    manifest.radarSweepGreen,
    ...manifest.weapons,
    manifest.weaponMeta,
    manifest.muzzle,
    manifest.missile,
    manifest.enemyMeta,
    ...Object.values(manifest.enemyDamage),
    manifest.bubble,
    manifest.reticle,
    ...Object.values(manifest.nodes),
    manifest.shop,
    ...manifest.crystals,
    ...manifest.blocks,
    manifest.laser,
    manifest.explosion,
    manifest.shieldHit,
    manifest.barFrame,
    manifest.barFill,
    manifest.button,
    manifest.buttonPressed,
  ];
}
