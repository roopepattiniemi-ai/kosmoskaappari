# Kosmoskaappari v0.4

Enintään viiden pelaajan avaruusmerirosvojen yhteispeli selaimessa. Kierros on FTL-tyylinen sektorikartta: noin kolme sektoria, kussakin 6–8 solmua (taistelu, kauppa, tapahtuma, pomo). Miehistö äänestää hypyn. Polttoaine kuluu, runko ja päivitykset säilyvät, ja runko nollassa kierros päättyy.

Kun vihollisen kilpi on alhaalla, miehistö voi abordata. Ketjupulma ratkaisee, valtaavatko hyökkääjät kannen vai torjutaanko heidät. Vihollinen voi myös nousta meidän alukseen. Aulasta alkaa PvP-ottelu kahden miehistön välillä huonekoodilla tai jonolla. Tyhjät paikat täyttyvät botilla.

Voitoista saa kiteitä. Kaupassa korjataan runkoa, ostetaan polttoainetta ja aseita sekä päivitetään järjestelmiä tasoille 1–3. Aseet näkyvät aluksen kyljen asepaikoissa, ja taistelussa oma alus ja vihollinen ovat rinnakkain. Laukaus lähtee asepaikasta valittuun vihollisen järjestelmään. Vihollisen kilpikupla kuluu osumista.

Jokainen kuudesta asemasta on oma pulma:

- Reaktori: match-3, tuottaa energiaa.
- Aseet: Tetris, lataa ja ampuu.
- Kilpi: nappaa kipinä, vähentää osuman vahinkoa.
- Ohjaus: lukitse ruori, väistää iskuja.
- Korjaamo: sammuta kipinä, korjaa osastoa ja runkoa.
- Sensorit: lukitse pyyhkäisy, paljastaa seuraavan iskun ja heikon kohdan.

Energia jaetaan järjestelmille. Tyhjä asema käy noin 40 % teholla. Vihollisen osumat rikkovat osastoja. Taistelulla on voitto ja häviö.

## Paikallisesti

Tarvitset Node.js 20:n tai uudemman.

```bash
npm install
npm test
npm run dev
```

- Peli: http://localhost:5173
- Pelipalvelin (WebSocket): http://localhost:2567

Avaa sama kutsulinkki toisessa välilehdessä tai puhelimessa. Toinen välilehti liittyy samaan huoneeseen ilman tunnuksia.

Tuotantokäännös, yksi prosessi (näin Renderkin käynnistää):

```bash
npm run build
npm start
```

Sitten http://localhost:2567 — selain ja WebSocket samassa portissa. Render asettaa `PORT`-ympäristömuuttujan; palvelin kuuntelee `0.0.0.0:$PORT`.

| | |
|---|---|
| Build | `npm install && npm run build` |
| Start | `npm start` |

`render.yaml` on valmis web-palvelu. Ilmainen instanssi nukahtaa käyttämättömänä.

## Ohjaus

- Kosketa tai klikkaa aluksen huonetta. Hahmo kävelee lattiaa pitkin ja vaihtaa kantta tikkailla (reaktorin ja ohjauksen välissä).
- Näppäimet 1–6: reaktori, aseet, sensorit, ohjaus, korjaamo, kilpi.
- Reaktori: vaihda vierekkäisiä kiteitä. Neljän suora tyhjentää rivin tai sarakkeen, viiden suora on kristallipommi. Ketjut kasvattavat energiaa.
- Aseet: nuolet, Z kääntää, alas pudottaa pehmeästi, välilyönti pudottaa pohjaan. Puhelimessa napit ovat ruudukon sivuilla.
- Energiapalkit alareunassa. Laukaisun vahinko on rivien, ase-energian ja sensorien tulo. Ilman ase-energiaa ammukset odottavat.

Puhelimessa (pysty ja vaaka) pulma on iso, alus on minikartta ja hälytykset ylhäällä. Työpöydällä alus ja vihollinen ovat rinnakkain. Aseet-asemalla kohde valitaan napeista tai napauttamalla vihollisen osastoa. Musiikki ja efektit ovat `assets/audio/`. Äänet käynnistyvät ensimmäisestä napautuksesta, ja musiikille sekä efekteille on omat liukusäätimet.

## Grafiikka

Tiedostot ovat `assets/v01/`. Nykyinen suunta on goottilainen 2.5D-renderöinti (samat tiedostonimet ja ruutujärjestys). `LUEMINUT.md` kertoo ruudut, kaarten jalat ja sen, että merirosvon jalat ovat rivillä y=124. `alus_oma.json` antaa lattian Y:n ja huoneiden rajat. Pelin latauslista on yhdessä paikassa: `src/shared/assets.ts`.

## Testit

```bash
npm test
```

Match-3, Tetris, taistelukaavat, kävelypolku ja palvelimen tila. Lisäksi kahden Colyseus-asiakkaan ajo samaan huoneeseen: kävely, energian jako, reaktorin siirto ja laukaus synkronoituvat.
