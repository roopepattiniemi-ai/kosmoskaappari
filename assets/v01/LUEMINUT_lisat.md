# Kosmoskaappari v0.3 — lisäassetit (`v03_3d_lisat/`)

Tämä kansio tehtiin v03_3d-putkella: sama Blender 5.3 (`bpy`), Cycles, toon-varjostin, Freestyle-ääriviivat ja hehkupassi. Itse `v03_3d`-kansioon ei ole koskettu. Kuvissa ei ole tekstiä, Warhammer-symboleja eikä brändilogoja. Ainoat tunnukset ovat tavallisia kalloja.

Kaikki PNG:t ovat RGBA-muotoisia ja niissä on läpinäkyvä tausta.

## Uudet merirosvot (3–5)

Sheetit ovat samassa muodossa kuin `merirosvo1_sheet.png` ja `merirosvo2_sheet.png`:

- Koko 512×256, ruudut 128×128.
- Rivi 0 (y = 0): idle, 4 ruutua (x = 0, 128, 256, 384).
- Rivi 1 (y = 128): kävely, 4 ruutua (kontakti O → ohitus → kontakti V → ohitus).
- Hahmot katsovat oikealle samassa 3/4-kulmassa kuin hahmot 1–2.
- Jalat ovat **kaikissa ruuduissa rivillä y = 124** (mitattu jokaisesta ruudusta). Kun hahmo piirretään lattialle, ruudun yläreuna on `lattia_y − 124`.

Kävely ja idle ovat samaa tasoa kuin v03:ssa:

- Kävelyssä on oikea raajaliike ja lantion korkeuden ratkaisu, joten pomppu on luonnollinen.
- Takinhelmat, kaapu, kädet, kyynärpäät ja pää seuraavat viiveellä (overlap ja follow-through).
- Jokaisella hahmolla on omat sekundääriliikkeet.

| Tiedosto | Hahmo | Pääväri | Siluetti |
|---|---|---|---|
| `merirosvo3_sheet.png` | **Tykkimies** | petrooli/sinivihreä (#22b4d6 korostus, #2a5866 takki) | pitkä ja hoikka; kolmikolkkahattu, iso olkatykki vaakasuorassa olan yli |
| `merirosvo4_sheet.png` | **Koneenkäyttäjä** | keltainen/kulta (#f2c418 korostus, #a07a1c takki) | lyhyt ja leveä; hitsausvisiirikypärä, iso höyrykattilareppu savupiippuineen, leijuva kallodrooni pään yllä |
| `merirosvo5_sheet.png` | **Navigaattori-pappi** | violetti (#a54ce0 korostus, #4a2862 kaapu) | hintelä ja kapea; suippo huppu, maahan ulottuva kaapu, korkea kynttiläsauva, josta riippuu suitsutusastia |

### Tykkimies (merirosvo3)

- Pitkä mies (1,12× korkeus) ja kapeat hartiat.
- Pitkä petroolinen takki, olkaviitta ja turkoosit reunanauhat.
- Kolmikolkkahattu, jossa on turkoosi reunus ja kokardi.
- Tähtäinmonokkeli syaanina hehkuvalla linssillä, harmaat viikset ja leukaparta.
- **Olkatykki:**
  - kaukaisella olalla, ja putki ulottuu selän takaa kasvojen eteen
  - messinkirenkaat ja syaanina hehkuva suu
  - virtakaapeli selän virtakennoon (syaani hehku)
- Patruunavyö rinnan yli ja piilukkopistooli lähemmässä kädessä.
- Varret ovat korkeat, ja niissä on petroolinen kaulus.
- Idle: tarkistaa pistoolia, tykki seuraa pienesti ja pää katselee ympärilleen.
- Kävely: pitkä askel ja tykki keinahtaa viiveellä.

### Koneenkäyttäjä (merirosvo4)

- Lyhyt ja tanakka (0,80× korkeus, 1,30× leveys).
- Sinappinen työtakki, keltamusta "varoitusraita"-esiliina ja työkalulenkit.
- Rautainen kulhokypärä keltaisella nauhalla ja ylös käännetty hitsausvisiiri keltaisin linssein.
- Iso punaruskea parta.
- Valtavat messinkirukkaset ja moukari.
- **Höyrykattilareppu**: siinä on tulipesän hehku, painemittari, putki ja savupiippu, josta nousee savupalloja.
- **Kallodrooni**: pieni leijuva kallo, jossa on roottori, messinkinen suutin, keltainen silmälinssi ja roikkuvat johdot.
- Idle: moukari napauttaa, drooni leijuu ja kääntyilee, ja savu sykkii.
- Kävely: leveä keinunta, drooni seuraa viiveellä ja moukari heilahtaa.

### Navigaattori-pappi (merirosvo5)

- Hintelä ja kapea (1,0× korkeus, 0,80× leveys).
- Violetti maahan ulottuva kaapu, jonka kaksi puoliskoa heilahtavat askelten mukana.
- Violetit reunanauhat, olkakappa ja messinkisolki.
- Köysivyössä on kallorukousnauha.
- Suippo huppu, jonka kärki heilahtaa omalla nivelellään. Hupun alla on tumma kasvo, violettina hehkuvat silmät ja messinkinen hengityssäleikkö.
- Leveät kellohihat.
- **Kynttiläsauva**: kolme kynttilää liekkeineen ja messinkikaari. Sauvan koukusta riippuu **suitsutusastia** violetin hehkurenkaan ja savun kanssa.
- Idle: suitsutusastia heiluu ja liekit lepattavat.
- Kävely: sauva pysyy pystyssä ja heilahtaa askeleen tahdissa, ja suitsutusastia heiluu viiveellä.

Viisi pelaajaa erottuvat puhelinkoossa (esikatselussa 1× ja 0,5×) sekä värin (punainen, vihreä, petrooli, keltainen, violetti) että siluetin perusteella:

| Hahmo | Tunnistetaan |
|---|---|
| kapteeni | kaksikärkihattu |
| miehistö | kynttiläkypärä |
| tykkimies | vaakasuora putki |
| koneenkäyttäjä | iso kattila ja drooni |
| pappi | suippo huppu ja kaapu |

## Efektit

- `kipina.png`, 48×48 (myös kopio `kipinä.png`, tavuidenttinen).
  - Kipinätähti: neljä pitkää ja neljä lyhyttä sädettä.
  - Valkoinen ydin, kultainen keskiosa ja oranssi reuna, ohut tumma muste.
  - Lentävät hiilet ja hehku. Keskellä kuvaa.
- `tutka_pyyhkaisy.png`, 256×256. Puoliläpinäkyvä tutkan pyyhkäisyviuhka meripihkana, joka sopii sensorihuoneen meripihkanäyttöihin.
  - **Pyörimiskeskipiste on kuvan keskellä (128, 128)**, ja keskellä on pieni napa.
  - Säde on 124 px.
  - Johtava reuna on kirkas viiva, joka osoittaa ylös (klo 12) ja hehkuu.
  - Häntä jää vastapäivään noin 115° matkalle ja himmenee liukuvärinä. Hännässä on heikot samankeskiset juovat, jotka ovat pyörimissymmetrisiä.
  - **Pyöritä myötäpäivään**, jotta häntä seuraa reunaa.
  - Kirkkain alfa on noin 0,95 johtavalla reunalla ja hännässä enintään noin 0,7.
- `tutka_pyyhkaisy_vihrea.png`, 256×256. Sama vihreänä vaihtoehdoksi vihreisiin näyttöihin (lisätiedosto).

## Lähteet: `lahde/`

- `yhteiset.py`: kopio v03_3d:n yhteisestä koodista (toon-varjostin, ääriviivat, mesh-rakentaja ja hehkukomposiitti).
- `rakenna_merirosvot_lisat.py [3|4|5]`: rakentaa hahmot nivelhierarkialla ja renderöi sheetit. Lisäksi se tallentaa `merirosvo3.blend`, `merirosvo4.blend` ja `merirosvo5.blend`, joissa on keyframet (ruudut 1–4 idle, 5–8 kävely).
  - `CFG` sisältää värit ja mittasuhteet.
  - `HT` sisältää pään peruskäännöksen.
- `rakenna_merirosvot.py`: v03:n alkuperäinen hahmoskripti (1–2) viitteeksi. Sitä ei ole muutettu.
- `efektit_lisat.py`: kipinä ja tutkapyyhkäisy (Pillow + numpy, ylinäytteistys 8× ja 4×).
- `kokoa_lisat.py`: koko- ja jalkarivitarkistus sekä esikatselu `../../v03_3d_lisat_esikatselu.png`. Hahmot 1–2 haetaan vertailuun `../../v03_3d/`-kansiosta.
- `renderoi_lisat.sh`: ajaa kaiken (noin 1 min 8 ytimellä).

## Kompromissit

- Hahmot on kuvattu samassa 3/4-kulmassa kuin v03:n hahmot 1–2, joten kasvot jäävät osin sivuun. Papin ja koneenkäyttäjän päätä on käännetty kameraa kohti (`HT`), jotta silmät, parta ja visiiri näkyvät.
- Tykkimiehen olkatykki peittää osan suusta ja leuasta. Hattu, monokkeli ja silmä jäävät näkyviin.
- Papin kaapu peittää jalat lähes kokonaan. Kävely näkyy kaavun puoliskojen heilunnasta ja kengänkärjistä.
- Koneenkäyttäjän keltainen takki on sinappinen, jotta se erottuu messinkikattilasta. Kirkkain keltainen on korostuksissa.
- Tutkapyyhkäisy ja kipinä ovat 2D-komposiitteja samaan cel- ja hehkutyyliin kuin v03:n laser ja kilpiosuma.
