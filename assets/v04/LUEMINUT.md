# Kosmoskaappari – grafiikka v0.4 (3D)

v03_3d-putken jatko: Blender-mallit sivulta, ortokamera, cel-varjostus + ääriviivat, RGBA-PNG.
Goottilainen tumma tyyli, **ei tekstiä, ei Warhammer-symboleja, ei brändilogoja**. Kaikki itse mallinnettu.
Aiempiin kansioihin (v01, v02_3d, v03_3d, v03_3d_lisat) ei ole koskettu.

Esikatselu: `../v04_3d_esikatselu.png` (1960x2040, tumma ruutukuvio). Alin sininen laatikko = puhelinkoko (0.5x).

Koordinaatit ovat pikseleitä kuvan vasemmasta yläkulmasta, x oikealle ja y alas.

## Tiedostot

| Tiedosto | Koko | Kuvaus |
|---|---|---|
| `ase_laser_1..3.png` | 128x96 | Laser, tasot 1–3 |
| `ase_tykki_1..3.png` | 128x96 | Tykki, tasot 1–3 |
| `ase_ohjus_1..3.png` | 128x96 | Ohjusteline, tasot 1–3 |
| `aseet.json` | – | Kiinnitys- ja suupisteet sekä sisällön bboxit |
| `suuliekki_sheet.png` | 256x48 | 4 ruutua á 64x48, vaakanauha |
| `ohjus_ammus.png` | 64x24 | Ohjusammus, osoittaa oikealle |
| `vihollinen_jarjestelmat.png` | 900x500 | FTL-tyylinen vihollinen, jossa 4 järjestelmähuonetta |
| `vihollinen_vaurio_<jarjestelma>.png` | 900x500 | Vauriokerros (reaktori, kilpi, aseet, ohjaus) |
| `vihollinen_jarjestelmat.json` | – | Huoneiden bboxit, keskipisteet, aukkojen monikulmiot, kilpikupla |
| `kilpikupla.png` | 960x548 | Puoliläpinäkyvä sininen kilpikupla |
| `kohde_tahtain.png` | 64x64 | Kohdetähtäin, keskipiste (32, 32) |
| `solmu_taistelu/kauppa/tapahtuma/pomo/nykyinen.png` | 64x64 | Karttasolmut |
| `kauppa_tausta.png` | 1280x720 | Kaupan sisätila (läpinäkymätön RGBA) |
| `lahde/` | – | Skriptit, `.blend`-lähteet, `raw/`-välirenderöinnit |

## 1. Laivan aseet

* Kaikki 9 asetta ovat **samalla 128x96-kankaalla**, ja piippu osoittaa oikealle (+x).
* **Kiinnityspiste on (44, 84) kaikissa yhdeksässä**: jalustalevyn alareunan keskikohta. Ääriviiva ulottuu yhden pikselin alemmas (y = 85).
  Aseen saa paikalleen piirtämällä sen kohtaan `kohta_rungolla − (44, 84)`.
* Suupiste on piipun, linssin tai ohjusten kärkien keskikohta. Siihen asetetaan suuliekki, säteen alku tai ammuksen synty.
* Tasot: 1 on pelkistetty, 2:ssa on lisäksi tukipylväät, kondensaattorit tai rekyylisylinteri ja 3 on suurin ja koristeellisin (messinkipiikit, kallot, messinkikruunu).

| Tiedosto | Tyyppi | Taso | Kiinnitys | Suu | Sisällön bbox [x0, y0, x1, y1] |
|---|---|---|---|---|---|
| `ase_laser_1.png` | laser | 1 | (44, 84) | (93, 61) | [19, 53, 95, 85] |
| `ase_laser_2.png` | laser | 2 | (44, 84) | (104, 59) | [16, 42, 106, 85] |
| `ase_laser_3.png` | laser | 3 | (44, 84) | (123, 57) | [11, 39, 124, 85] |
| `ase_tykki_1.png` | tykki | 1 | (44, 84) | (91, 61) | [10, 49, 93, 85] |
| `ase_tykki_2.png` | tykki | 2 | (44, 84) | (102, 59) | [9, 47, 104, 85] |
| `ase_tykki_3.png` | tykki | 3 | (44, 84) | (113, 57) | [8, 36, 117, 85] |
| `ase_ohjus_1.png` | ohjus | 1 | (44, 84) | (82, 53) | [21, 41, 83, 85] |
| `ase_ohjus_2.png` | ohjus | 2 | (44, 84) | (87, 47) | [16, 30, 87, 85] |
| `ase_ohjus_3.png` | ohjus | 3 | (44, 84) | (91, 40) | [11, 15, 92, 85] |

### Suuliekki: `suuliekki_sheet.png`
* Koko 256x48, jossa **4 ruutua á 64x48** vaakarivissä (ruutu i alkaa kohdasta x = 64·i).
* Liekin alkupiste on **(2, 24)** jokaisessa ruudussa, ja liekki osoittaa oikealle. Ruutu piirretään kohtaan `suu − (2, 24)`.
* Ruudut: 0 = pieni leimahdus, 1 = täysi liekki ja sivusuihkut, 2 = liekki ja savu, 3 = savu ja kipinät. Ehdotettu nopeus on noin 40–60 ms ruudulle.

### Ohjus: `ohjus_ammus.png`
* Koko 64x24, kärki oikealla ja sisällön bbox (0, 1, 62, 23). Kärki on noin kohdassa (62, 12), pyrstön liekki vasemmalla.

## 2. Vihollinen järjestelmineen

`vihollinen_jarjestelmat.png` (900x500) pohjautuu v03:n `alus_vihollinen`-malliin. Kyljen tykkiaukot on poistettu,
ja tilalla on neljä kaarevaa, omalla värillään hehkuvaa huonetta. Aluksen bbox on [28, 39, 864, 463].

| Huone | bbox [x0, y0, x1, y1] | Keskipiste | Väri | Vauriokerros | Vaurion bbox |
|---|---|---|---|---|---|
| reaktori | [213, 293, 316, 393] | (264, 343) | `#5cff6a` | `vihollinen_vaurio_reaktori.png` | [205, 213, 310, 396] |
| kilpi | [319, 298, 422, 398] | (370, 348) | `#4aa8ff` | `vihollinen_vaurio_kilpi.png` | [311, 216, 421, 401] |
| aseet | [425, 303, 528, 403] | (476, 353) | `#ff5a2a` | `vihollinen_vaurio_aseet.png` | [417, 223, 521, 405] |
| ohjaus | [530, 307, 634, 407] | (582, 357) | `#ffb648` | `vihollinen_vaurio_ohjaus.png` | [523, 227, 631, 410] |

* Huoneiden sisältö: reaktori on vihreä ydin häkissä, kilpi sininen pallo renkaineen, aseet ammusteline ja tykin perä, ohjaus ruori ja meripihkanvärinen näyttö.
* `aukko_px` (JSONissa) on huoneen sisäaukon monikulmio. Sitä voi käyttää osumatestiin tai valintakorostukseen.
* **Vauriokerrokset** ovat samankokoisia kuin pohja, ja ne piirretään kohtaan (0, 0) pohjan päälle. Kerroksessa on tummennettu aukko, halkeamat, liekit, savu ja kipinät.
  Savu nousee huoneen yläpuolelle (vaurion bbox on korkeampi kuin huone). Kerroksia voi pinota.

### Kilpikupla: `kilpikupla.png`
* Koko 960x548, ja keskipiste kuvassa on (480, 274).
* Kupla on vihollisen kangasta suurempi. Se piirretään vihollisen kankaalla kohtaan **(-34, -24)**,
  jolloin keskipiste osuu kohtaan (446, 250). Puoliakselit ovat 467.7 x 261.9 px.
* Rakenne: fresnel-reuna, heikko kuusikulmiokuvio ja heijastus. Sisäosa on hyvin läpikuultava, joten alus näkyy kuplan läpi. Osuman välähdyksen voi tehdä alfaa tai additiivista sävyä moduloimalla.

### Tähtäin: `kohde_tahtain.png`
* Koko 64x64 ja keskipiste (32, 32). Tähtäin on punainen, ja siinä on goottilaiset kulmasulkeet, katkonainen rengas ja kultainen keskitimantti. Se piirretään kohtaan `huoneen keskipiste − (32, 32)`.

## 3. Kartta ja kauppa

| Kuvake | Muoto | Väri | Tunnus |
|---|---|---|---|
| `solmu_taistelu.png` | Pyöreä kilpi | Punainen | Ristikkäiset sapelit |
| `solmu_kauppa.png` | Kahdeksankulmio | Vihreä ja kulta | Kolikkopinot, kolikko ja jalokivi |
| `solmu_tapahtuma.png` | Suippokaari | Violetti | Hehkuva silmä |
| `solmu_pomo.png` | Piikkitähti | Rauta ja punainen | Sarvipäinen kallo, punaiset silmät |
| `solmu_nykyinen.png` | Ontto hehkurengas ja messinkisakarat | Syaani | Pieni aluksen siluetti; keskusta on läpinäkyvä, joten kuvakkeen voi asettaa toisen solmun päälle |

Kuvakkeet erottuvat muodon ja värin perusteella myös 32x32-koossa (tarkistettu esikatselussa).

`kauppa_tausta.png` (1280x720, läpinäkymätön):
* Keskellä on goottilainen ikkuna avaruuteen, vasemmalla laatikoita, tynnyreitä ja sapeliteline, oikealla kauppiaan tiski vaakoineen ja hyllyt kiteineen ja pulloineen. Ylhäällä roikkuu ketjulyhtyjä.
* Vasen holvi ja keskiosan alaosa (noin x 60–700, y 180–620) ovat tummia ja rauhallisia, joten ne sopivat UI-paneeleille.
  Oikea kolmannes on kauppiaan "näyttämö". Lattiaa on alimmat noin 50 px.

## Kompromissit
* Aseet ovat 128x96-koossa pieniä suhteessa v03:n omaan alukseen (1600x700). Esikatselussa ne on asetettu natiivikoossa rungon alavyölle.
  Pelissä alus todennäköisesti skaalataan pienemmäksi, jolloin aseiden suhteellinen koko kasvaa. Tarvittaessa aseet voi skaalata 1,5x (nearest/lanczos).
* Tason 3 kalloja on aseissa vain yksi kappale, ja ne ovat pieniä (noin 8–10 px), jotta siluetti pysyy luettavana. Kiinnitysjalustan kallo poistettiin, koska se jäi kääntönivelen taakse.
* Ohjustelineen suupiste on kaikkien ohjuskärkien keskikohta. Yksittäiset ohjukset (L+1 riviä) ovat sen ylä- ja alapuolella, joten salvan voi hajauttaa pystysuunnassa noin ±(taso·5) px.
* Kilpikupla on vihollisen kangasta suurempi (offset (−34, −24)). Se ei ole samassa 900x500-kehyksessä kuin vauriokerrokset.
* Vauriokerrosten savu ulottuu huoneen bboxin yläpuolelle. Tarkka alue on kentässä `vaurio_bbox`.
* Kauppataustan keskellä oleva ikkuna on kirkkain alue. Jos UI-paneeli tulee keskelle, panelin alle kannattaa laittaa tumma läpikuultava tausta.
* Suuliekki on 2D-efekti (Pillow), samoin tähtäin ja vaurioiden tummennus ja halkeamat. Kaikki muu on Blender-renderöintiä.

## Uudelleenrakennus
```
cd lahde && ./renderoi_v04.sh     # tai yksittäin:
/workspace/.bpyvenv/bin/python rakenna_aseet.py               # aseet, ammus, aseet.json
/workspace/.bpyvenv/bin/python rakenna_vihollinen_jarjestelmat.py
/workspace/.bpyvenv/bin/python rakenna_kuvakkeet.py
/workspace/.bpyvenv/bin/python rakenna_kauppa.py
python3 efektit_v04.py                                        # suuliekki, tähtäin
python3 kokoa_v04.py                                          # kokotarkistus + esikatselu
```
Käytössä on Blender 5.3 (pip `bpy`, Python 3.13) ja Cycles CPU:lla. Yhteiset apufunktiot ovat tiedostossa `lahde/yhteiset.py`.
`rakenna_vihollinen.py` on v03:n alkuperäinen skripti, joka on mukana vain viitteeksi.
