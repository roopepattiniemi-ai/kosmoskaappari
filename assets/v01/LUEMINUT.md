# Kosmoskaappari v0.1 — grafiikka

Sarjakuvamainen, käsin piirretyn oloinen tyyli (konsepti `konseptit/konsepti_2_sarjakuva.jpg`, Puzzle Pirates -henki): paksut ääriviivat, lämpimät värit, tasotäyttö ja kiilto. Ei oikeita brändilogoja.

Alukset ja merirosvot on generoitu kuvageneraattorilla konsepti referenssinä, tausta avainnettu ja kuvat rajattu/skaalattu tällä skriptillä (`generoi_v01.py`). Kiteet, Tetris-ammukset, efektit ja UI on piirretty proseduraalisesti Pillowlla samaan tyyliin. Merirosvojen idle- ja kävelyframet on animoitu yhdestä perusposesta (bob, squash, alaosan shear), jotta hahmo pysyy samana framejen välillä.

Lähdekuvat: `lahde/`. Tämä skripti kirjoittaa assetit tähän kansioon ja esikatselun polkuun `../v01_esikatselu.png`.

## Tiedostot

### Alukset

- `alus_oma.png` — 1600×700 px, RGBA. Oman aluksen sivuttaisleikkaus, kuusi huonetta kahdessa kannessa, tasainen lankkulattia. Keula vasemmalla (tykki ja amme). Purjeen maston huippu leikkautui hieman lähdekuvassa.
- `alus_oma.json` — lattian Y ja huoneiden bounding boxit (pikseleitä kuvan vasemmasta yläkulmasta). Sisällön bbox (itse alus kankaalla): `[238, 0, 1361, 700]`.
  - Yläkansi `lattia_y = 366`
  - Alakansi `lattia_y = 544`
  - Huoneet (x-väli, y-väli, kansi, lattia_y):
    - **reaktori**: x=[438, 697], y=[138, 366], kansi=yla, lattia_y=366
    - **aseet**: x=[697, 991], y=[198, 366], kansi=yla, lattia_y=366
    - **sensorit**: x=[991, 1237], y=[59, 366], kansi=yla, lattia_y=366
    - **ohjaus**: x=[438, 697], y=[403, 544], kansi=ala, lattia_y=544
    - **korjaamo**: x=[697, 991], y=[403, 544], kansi=ala, lattia_y=544
    - **suojakilpi**: x=[991, 1237], y=[403, 544], kansi=ala, lattia_y=544
  - `lattia_y` on kävelypinta. Hahmon jalkojen pitäisi osua tähän Y-arvoon. Y kasvaa alaspäin.
- `alus_vihollinen.png` — 900×500 px, RGBA. Pienempi vihollisalus, keula oikealle (tykki osoittaa oikealle). Ei leikkausta, kokonainen siluetti.

### Merirosvot (oikealle päin)

- `merirosvo1_sheet.png` — 512×256, RGBA. Kapteeni: punainen huivi, musta parta, ruskea takki, sapeli. 128×128 framet:
  - Rivi 0 (y=0): idle, 4 framea (x = 0, 128, 256, 384)
  - Rivi 1 (y=128): kävely, 4 framea samoin.
- `merirosvo2_sheet.png` — 512×256, RGBA. Miehistö: vihreä huivi, ruskea parta, vihreä takki. Sama rivi/frame-asettelu.

### Reaktorin match-3 -kiteet (96×96, erottuvat sekä väriltä että muodolta)

- `kristalli_1.png` — punainen, terävä ryväs (useita kuusikiteitä)
- `kristalli_2.png` — oranssi, sileä ovaali kaboshoni
- `kristalli_3.png` — keltainen, fasetoitu timantti (kärki ylös)
- `kristalli_4.png` — vihreä, pysty kuusikulmaprisma
- `kristalli_5.png` — sininen, kuusisakarainen tähti
- `kristalli_6.png` — violetti, vino pisara/siru
- `kristallit_sheet.png` — 576×96, järjestys 1–6 vasemmalta oikealle.

### Asehuoneen Tetris-ammuspalat (64×64, sama laatta, 7 väriä)

- `ammus_pala_syaani.png`
- `ammus_pala_keltainen.png`
- `ammus_pala_violetti.png`
- `ammus_pala_vihrea.png`
- `ammus_pala_punainen.png`
- `ammus_pala_sininen.png`
- `ammus_pala_oranssi.png`
- `ammus_palat_sheet.png` — 448×64, järjestys: syaani, keltainen, violetti, vihrea, punainen, sininen, oranssi.

### Efektit

- `laser.png` — 64×16, RGBA. Vaakasuora keltakultainen energiaboltti, kirkas ydin ja terävät kärjet.
- `rajahdys_sheet.png` — 512×128, RGBA. 4 framea à 128×128 vaakasuoraan (x = 0, 128, 256, 384): pieni kipinä → keskikokoinen pallo → täysi räjähdys → haihtuva savu.
- `kilpi_osuma.png` — 128×128, RGBA. Sininen kilpiväre (konsentriset kaaret + sähkösäröt), läpinäkyvä keskusta.

### UI

- `energiapalkki_kehys.png` — 256×32, RGBA. Puinen kehys niiteillä. Sisäalue (täytteen paikka):
  - offset x=10, y=6, leveys=236, korkeus=20
- `energiapalkki_tayte.png` — 256×32, RGBA. Täyte on jo oikealla kohdalla läpinäkyvän reunuksen sisällä, joten sen voi pinota kehyksen alle tai päälle ilman erillistä siirtoa. Täyte on 1 px sisään kehyksen sisäalueesta.
- `nappi.png` — 192×64, RGBA. Puinen nappi, kohotettu viiste, niitit, ei tekstiä.
- `nappi_painettu.png` — 192×64, RGBA. Sama nappi painettuna (alemmas, tummempi, käänteinen viiste).

### Muu

- `generoi_v01.py` — tämä generaattori.
- `lahde/` — alkuperäiset GenerateImage-lähdekuvat (magenta tausta).
- `../v01_esikatselu.png` — kaikkien assettien yleisesikatselu tummalla shakkiruudulla.

## Kompromissit

- Aluskuvien koko on täsmälleen 1600×700 ja 900×500 (pyydetty ~koko). Alus skaalataan tasaisesti ja keskitetään, joten kankaalla on läpinäkyvää reunaa (ks. `sisalto_bbox`). Purjetta ei leikattu.
- Oman aluksen maston huippu leikkautui jo lähdekuvassa (16:9-rajaus). Pientä häviötä.
- Oman aluksen alakannella ohjaus ja korjaamo ovat visuaalisesti avoimessa tilassa; raja on sama pystylinja kuin yläkannen väliseinä (ammeen ja työkalulaatikon välissä).
- Kävelyanimaatio on proseduraalinen yhdestä perusposesta (ei erillisiä raajoja), joten askellus on bob+shear -tyylinen eikä täysi askelsykli. Hahmo pysyy samana framejen välillä.
- Yksinkertaiset itemit (kiteet, ammukset, efektit, UI) on piirretty Pillowlla, ei kuvageneraattorilla, tyylin yhtenäisyyden ja käyttökiintiön takia.

Kaikki PNG:t ovat RGBA-muotoisia (läpinäkyvä tausta).

