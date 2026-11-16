# Kosmoskaappari v0.1

Kahden pelaajan avaruusmerirosvojen yhteispeli selaimessa. Miehistö jakaa yhden aluksen: reaktorin match-3 tuottaa energiaa, asehuoneen Tetris lataa ammuksia, ja energia jaetaan aseiden, kilven ja moottorien kesken. Yksi taistelu tekoälyalusta vastaan.

Vain **reaktori** ja **aseet** ovat pelattavia. Ohjaus, korjaamo, kilpi ja sensorit ovat paikkoja, joissa seisominen nostaa järjestelmän tehon. Tyhjä asema käy automaattisesti noin 40 % teholla.

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

Puhelimessa (pysty ja vaaka) pulma on iso, alus on minikartta ja hälytykset ylhäällä. Työpöydällä alus ja vihollinen ovat isona vasemmalla.

## Grafiikka

Tiedostot ovat `assets/v01/`. `LUEMINUT.md` kertoo ruudut ja koot, `alus_oma.json` lattian Y:n ja huoneiden rajat. Pelin latauslista on yhdessä paikassa: `src/shared/assets.ts`. Uusi PNG samalla nimellä vaihtuu ilman muuta koodia; uusi tiedostonimi päivitetään vain manifestiin.

## Testit

```bash
npm test
```

Match-3, Tetris, taistelukaavat, kävelypolku ja palvelimen tila. Lisäksi kahden Colyseus-asiakkaan ajo samaan huoneeseen: kävely, energian jako, reaktorin siirto ja laukaus synkronoituvat.
