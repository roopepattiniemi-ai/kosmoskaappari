# Kosmoskaappari — äänet v01

Itse syntetisoidut musiikit ja efektit. Vapaa käyttää tässä projektissa.

## Tekniikka

- **Musiikki ja voitto/häviö-fanfaarit:** MIDI renderöity FluidSynthillä, äänifontti **FluidR3_GM** (MIT-lisenssi, polku `/usr/share/sounds/sf2/FluidR3_GM.sf2`). Urut, kuoro (Choir Aahs), jouset, padit, rummut, cembalo, haitari ja viulu.
- **Muut efektit:** NumPy- ja SciPy-syntesi (sini, saha, kohina, suotimet, kellot, FM), ilman ulkoisia näytteitä.
- **Musiikin looppi:** kappaleen alku toistetaan lopussa; 2 tahdin lineaarinen ristihäivytys, jotta kaiku liittyy saumattomasti alkuun.
- **Normalisointi:** musiikki noin −16 LUFS, efektit noin −14…−16 LUFS (lyhyissä klikkauksissa huippu ratkaisee, jos LUFS-tavoite klippaisi). Huippu alle −1 dBFS.
- **Muoto:** 44,1 kHz MP3; musiikki stereo 192 kbit/s, efektit mono tai stereo 160 kbit/s.
- Generointi: `python3 generoi_aanet.py`. Ei ulkoisia näytteitä, ei NC/ND-materiaalia.

## Lisenssi

Itse tehty, vapaa käyttää. FluidR3_GM: MIT.

## Tiedostot

| Tiedosto | Kuvaus | Kesto | Loop |
|---|---|---:|:---:|
| `musa_valikko.mp3` | Synkkä urku- ja kuorotunnelma, d-molli. | 96.026 s | kyllä |
| `musa_kartta.mp3` | Rauhallinen, mystinen avaruus: padit, harppu, kaukainen urku ja kuoro. | 96.026 s | kyllä |
| `musa_taistelu.mp3` | Intensiivinen urku-industrial ja rummut, e-phryginen riffi. | 96.026 s | kyllä |
| `musa_pomo.mp3` | Eeppinen pomotaistelu: kuoro, urut, raskaat rummut, nopeampi d-molli. | 96.026 s | kyllä |
| `musa_kauppa.mp3` | Synkähkö kapakkavalssi, merirosvohenki: haitari, viulu, cembalo. | 96.026 s | kyllä |
| `sfx_laser.mp3` | Laserlaukaus, laskeva saha/kantoaalto. | 0.470 s | ei |
| `sfx_tykki.mp3` | Raskas laivatykki, matala jyrähdys ja räsähdys. | 1.202 s | ei |
| `sfx_osuma.mp3` | Osuma runkoon, lyhyt isku. | 0.418 s | ei |
| `sfx_rajahdys.mp3` | Räjähdys, jylinä ja roskat. | 2.247 s | ei |
| `sfx_kilpi_osuma.mp3` | Osuma energiakilpeen, metallinen klangi. | 0.758 s | ei |
| `sfx_halytys.mp3` | Teollinen kaksitaajuinen hälytysklaksoni. | 2.090 s | ei |
| `sfx_hyppy.mp3` | FTL-hyppy: nouseva whoosh, taitto ja välähdys. | 2.377 s | ei |
| `sfx_kristalli.mp3` | Saaliin keruu, kristalliset kellot. | 0.993 s | ei |
| `sfx_osto.mp3` | Ostokuitin / kolikon kilahdus. | 0.627 s | ei |
| `sfx_paivitys.mp3` | Järjestelmän päivitys, nouseva sointu ja kello. | 1.228 s | ei |
| `sfx_korjaus.mp3` | Korjaus: jakoavain, metalli ja kipinät. | 1.097 s | ei |
| `sfx_nappi.mp3` | Käyttöliittymän napin klikkaus. | 0.157 s | ei |
| `sfx_pulma_onnistui.mp3` | Pulma ratkaistu, nousevat kellot. | 1.202 s | ei |
| `sfx_pulma_epaonnistui.mp3` | Pulma epäonnistui, laskeva dissonanssi. | 1.228 s | ei |
| `sfx_askel.mp3` | Raskas saapas metalliristikolla. | 0.522 s | ei |
| `sfx_voitto.mp3` | Voittofanfaari, d-molli Picardy-duuriin, urut ja kuoro. | 3.944 s | ei |
| `sfx_havio.mp3` | Häviö, laskeva urku- ja kuorosointu. | 3.944 s | ei |

## Mittaus (ffprobe / ebur128 / volumedetect)

Lyhyissä transienttiäänissä (alle ~0,4 s) integroitu LUFS ei ole luotettava, koska BS.1770-portitus hylkää näytteen; näissä huippu on raja. Tällaiset merkitään em-viivalla.

| Tiedosto | LUFS | True peak (dBTP) | volumedetect max (dB) |
|---|---:|---:|---:|
| `musa_valikko.mp3` | -16.3 | -4.90 | -4.90 |
| `musa_kartta.mp3` | -16.2 | -4.20 | -4.20 |
| `musa_taistelu.mp3` | -17.0 | -1.60 | -1.70 |
| `musa_pomo.mp3` | -16.6 | -1.60 | -1.80 |
| `musa_kauppa.mp3` | -16.3 | -5.00 | -5.00 |
| `sfx_laser.mp3` | -15.6 | -4.60 | -5.40 |
| `sfx_tykki.mp3` | -15.5 | -1.90 | -2.00 |
| `sfx_osuma.mp3` | — | -1.50 | -1.50 |
| `sfx_rajahdys.mp3` | -18.0 | -2.60 | -3.10 |
| `sfx_kilpi_osuma.mp3` | -16.0 | -1.70 | -1.70 |
| `sfx_halytys.mp3` | -15.5 | -13.20 | -13.20 |
| `sfx_hyppy.mp3` | -16.6 | -2.00 | -2.10 |
| `sfx_kristalli.mp3` | -15.5 | -7.20 | -7.30 |
| `sfx_osto.mp3` | -15.4 | -4.70 | -4.70 |
| `sfx_paivitys.mp3` | -15.5 | -2.40 | -2.40 |
| `sfx_korjaus.mp3` | -18.6 | -1.90 | -1.90 |
| `sfx_nappi.mp3` | — | -2.00 | -1.90 |
| `sfx_pulma_onnistui.mp3` | -15.5 | -5.30 | -5.40 |
| `sfx_pulma_epaonnistui.mp3` | -15.4 | -6.90 | -6.90 |
| `sfx_askel.mp3` | -18.4 | -1.80 | -1.80 |
| `sfx_voitto.mp3` | -16.4 | -4.70 | -4.70 |
| `sfx_havio.mp3` | -16.5 | -5.10 | -5.10 |
