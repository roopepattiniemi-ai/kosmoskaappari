# Kosmoskaappari v0.2 — 3D-grafiikka (2.5D)

Tyyli: konsepti `konseptit/40k/konsepti_40k_1_goottinen_synkka.jpg` (goottilainen ja synkkä rautakatedraali-avaruusmerirosvo) tehtynä oikeina 3D-malleina ja renderöitynä PNG:ksi Dead Cells / Cult of the Lamb -tyyliin. Renderöinti: Blender 5.3 (pip `bpy`, headless) + Cycles. Varjostin on oma cel/toon-ryhmä: kolme valokaistaa kiinteästä valosuunnasta, AO-tummennus, kiiltokaista metalleille, sinertävä reunavalo ja likakohina. Ääriviivat tulevat Freestylestä, ja hehkuvat osat saavat erillisen hehkupassin, joka sumennetaan päälle. Renderöinti tehdään 2× tai 4× koossa ja skaalataan alas, mikä antaa antialiasoinnin.

Kuvissa ei ole tekstejä, Warhammer-symboleja eikä brändilogoja. Ainoat tunnukset ovat tavallisia merirosvokalloja ja sääriluita.

Kaikki tiedostonimet, pikselikoot ja ruutujärjestykset ovat samat kuin v01:ssä, joten kansion voi vaihtaa suoraan. Kaikki PNG:t ovat RGBA-muotoisia ja niissä on läpinäkyvä tausta.

## Alukset

- `alus_oma.png`, 1600×700. Oman aluksen sivuleikkaus on renderöity ortokameralla suoraan sivulta (1 Blender-yksikkö = 100 px; X = px/100, Z = (700 − py)/100). Keula on vasemmalla: siinä on kallokeulakuva, keulatykki ja torni. Perässä oikealla on kolme moottoria liekkeineen ja tutka-antenni.
  - Yläkannen lattia on `lattia_y = 366` ja alakannen `lattia_y = 544`. Messinkilistan yläreuna on tasan tällä rivillä, ja ääriviiva on riviä ylempänä.
  - Alakannen katto on y = 403 (kansien välinen palkki on y = 366…403).
  - Huoneiden x-välit ovat samat kuin v01:ssä (seinälinjojen keskeltä mitattuna):
    - **reaktori**: x=[438, 697], y=[138, 366], yläkansi. Vihreä reaktori häkissä, putket ja mittarit.
    - **aseet**: x=[697, 991], y=[198, 366], yläkansi. Iso tykki lavetilla ja kuulat. Katolla masto ja kallopurje.
    - **sensorit**: x=[991, 1237], y=[59, 366], yläkansi. Ruusuikkuna, kaksi meripihkanäyttöistä konsolia, ruori ja kaukoputki.
    - **ohjaus**: x=[438, 697], y=[403, 544], alakansi. Ammeohjaamo, jossa on ohjaussauva, vihreä näyttö ja kynttelikkö.
    - **korjaamo**: x=[697, 991], y=[403, 544], alakansi. Työpöytä, punainen työkalulaatikko, alasin, ketju ja hammasratas.
    - **suojakilpi**: x=[991, 1237], y=[403, 544], alakansi. Sininen kilpipallo ja kaksi teslapylvästä salamoineen.
  - Yläkannen huoneiden `y[0]` on goottikaaren sisähuippu. Kaari laskeutuu seiniä kohti, ja kaaren jalka on reaktorissa y ≈ 220, aseissa y ≈ 245 ja sensoreissa y ≈ 150.
  - Sisällön bbox on `[169, 4, 1489, 686]`. Se on leveämpi kuin v01:ssä, koska mukana ovat keulan torni ja moottorin liekit.
- `alus_oma.json` noudattaa samaa skeemaa kuin v01, todellisin arvoin. Lisäkenttänä on `px_per_yksikko`.
- `alus_vihollinen.png`, 900×500. Goottilainen korsaari, keula oikealle. Kevyt 3/4-kulma (kamera kääntyy 16° ja kallistuu 9° alaspäin) ortokameralla, kokonainen siluetti. Mukana punaisina hehkuvat goottilaiset ikkunat, viiden tykin laita, keulatykki, piikkikärki, kallokeulakuva, punamusta kallopurje ja kaksi perämoottoria.

## Merirosvot (oikealle päin, 128×128 ruudut)

- `merirosvo1_sheet.png`, 512×256. Kapteeni, punaiset korostukset: kaksikärkinen hattu punaisella nauhalla ja kallomerkillä, punainen huivi, rautainen hengityssuojain punaisin linssein ja suodattimella, musta parta, ruskea pitkä takki, punainen liivi ja vyönauha. **Mekaaninen oikea käsi** (rautaa ja messinkiä, mäntä ja kolmisormikoura). Sapelin tuppi vasemmalla lantiolla.
- `merirosvo2_sheet.png`, 512×256. Miehistö, vihreät korostukset: rautakypärä vihreällä nauhalla ja kynttilä päälaella, vihreinä hehkuvat suojalasit, ruskea parta, vihreä kaulahuivi ja vyö, oliivinvihreä pitkä takki ja jakoavain kädessä. **Mekaaninen oikea sääri** (messinkimäntä, rautatangot ja kynsijalka).
- Ruudut:
  - Rivi 0 (y = 0): idle, 4 ruutua (x = 0, 128, 256, 384).
  - Rivi 1 (y = 128): kävely, 4 ruutua.
  - Jalat osuvat kaikissa ruuduissa riville **y = 124**. Kun hahmo piirretään lattialle, ruudun yläreuna on `lattia_y − 124`.
  - Hahmo on noin 113 px korkea ja keskitetty x = 64:ään.
- Kävely: hahmot ovat 3D-malleja, joissa on nivelhierarkia (empty-objekteja luina: lantio, selkä, pää, olka/kyynär, reisi/polvi/nilkka sekä takinhelmat). Kävelysykli on oikeaa raajaliikettä:
  - reidet heiluvat ±0.5 rad,
  - polvet koukistuvat heilahdusvaiheessa,
  - nilkat pysyvät tasaisina tukivaiheessa,
  - kädet heiluvat vastavaiheessa ja kyynärpäät koukistuvat,
  - lantio ja hartiat kiertyvät, ja takinhelmat seuraavat reisiä.
- Lantion korkeus ratkaistaan jokaiseen ruutuun niin, että alin kantapää tai varvas on tasan maassa. Tästä syntyy luonnollinen pomppu.
- Ruudut ovat kontakti O → ohitus → kontakti V → ohitus. Idle-ruuduissa on hengitys, polvijousto, pään ja käsien pieni liike, ja jalat pysyvät paikallaan.
- Animaatio on myös keyframeina .blend-tiedostossa (ruudut 1–4 idle, 5–8 kävely).

## Reaktorin match-3-kiteet (96×96)

Muodot ja värit ovat kuten v01:ssä. Kiteet ovat fasetoituja 3D-malleja.

- `kristalli_1.png`: punainen, terävä ryväs (useita kuusikulmaisia kiteitä)
- `kristalli_2.png`: oranssi, fasetoitu ovaali kaboshoni
- `kristalli_3.png`: keltainen, fasetoitu timantti kärki ylöspäin
- `kristalli_4.png`: vihreä, pysty kuusikulmaprisma
- `kristalli_5.png`: sininen, kuusisakarainen tähti
- `kristalli_6.png`: violetti, vino pisara tai siru
- `kristallit_sheet.png`: 576×96, järjestys 1–6 vasemmalta oikealle.

## Asehuoneen Tetris-ammuspalat (64×64)

Rautalaatta, jossa on messinkiniitit, värillinen emalipinta ja hehkuva keskinasta.

- `ammus_pala_syaani.png`
- `ammus_pala_keltainen.png`
- `ammus_pala_violetti.png`
- `ammus_pala_vihrea.png`
- `ammus_pala_punainen.png`
- `ammus_pala_sininen.png`
- `ammus_pala_oranssi.png`
- `ammus_palat_sheet.png`: 448×64, järjestys syaani, keltainen, violetti, vihreä, punainen, sininen, oranssi.

## Efektit

- `laser.png`, 64×16. Keltakultainen energiaboltti, jossa on valkoinen ydin ja terävät kärjet (2D-komposiitti).
- `rajahdys_sheet.png`, 512×128, 4 ruutua (x = 0, 128, 256, 384). 3D-cel-tulipalloja:
  1. kipinätähti
  2. keskikokoinen tulipallo säteineen
  3. täysi räjähdys sirpaleineen
  4. haihtuva savu ja hiillos
- `kilpi_osuma.png`, 128×128. Sininen kilpiväre: katkonaiset samankeskiset kaaret ja sähkösäröt, läpinäkyvä keskusta (2D-komposiitti).

## UI

- `energiapalkki_kehys.png`, 256×32. Rautakehys, jossa on messinkiset suippokaaripäädyt ja niitit. Sisäalue (täytteen paikka) on **offset x=10, y=6, leveys=236, korkeus=20** ja täysin läpinäkyvä.
- `energiapalkki_tayte.png`, 256×32. Vihreä hehkuputki, joka on valmiiksi oikealla kohdalla: x=11…244, y=7…24, eli 1 px sisäalueen sisäpuolella. Sen voi pinota kehyksen alle tai päälle sellaisenaan. Täyttöasteen saa rajaamalla leveyttä vasemmalta alkaen.
- `nappi.png`, 192×64. Rautanappi: messinkireunus, viistetyt kulmat, niitit, kaksi pientä goottikaarikoristetta ja varjo alla. Ei tekstiä.
- `nappi_painettu.png`, 192×64. Sama nappi painettuna: 2–3 px alempana, tummempi, ilman varjoa ja käänteisellä viisteellä.

## Lähteet ja uudelleenrenderöinti: `lahde/`

- `yhteiset.py`: toon-varjostin, Freestyle-ääriviivat, mesh-rakentaja (laatikot, lieriöt, kuoret, profiilipuristus, suippokaaret, kallo), renderöinti ja hehkukomposiitti.
- `rakenna_alus_oma.py`: tuottaa `alus_oma.blend`, `alus_oma.png` ja `alus_oma.json`.
- `rakenna_vihollinen.py`: tuottaa `alus_vihollinen.blend` ja `alus_vihollinen.png`.
- `rakenna_merirosvot.py [1|2]`: tuottaa `merirosvo1.blend`, `merirosvo2.blend` (nivelet ja keyframet) ja sheetit.
  - Uuden animaation saa lisäämällä `set_pose()`-funktioon uuden tilan, esim. `"attack"`, ja renderöimällä samalla kameralla.
- `rakenna_esineet.py [kristallit ammukset palkki napit rajahdys]`: tuottaa .blend-tiedostot ja PNG:t.
- `efektit_2d.py`: laser ja kilpiosuma (Pillow).
- `kokoa.py`: kokotarkistus ja esikatselu `../../v02_3d_esikatselu.png`.
- `renderoi_kaikki.sh`: ajaa kaiken (noin 3 min 8 ytimellä).

Ympäristö: `python3 -m venv /workspace/.bpyvenv && /workspace/.bpyvenv/bin/pip install bpy==5.3.0 numpy pillow`. Tarvitaan Python 3.13, eikä GPU:ta tarvita, koska Cycles toimii CPU:lla.

.blend-tiedostot aukeavat Blender 5.x:ssä sellaisenaan. Lopullinen ilme (hehkupassi ja alasskaalaus) syntyy kuitenkin vasta skripteillä, joten muutokset kannattaa tehdä skripteihin ja ajaa ne uudelleen. Välirenderöinnit tallentuvat `lahde/raw/`-kansioon (2× tai 4× koossa).

## Kompromissit

- Oman aluksen yläkannen kaaret ovat matalia suippokaaria, jotta huoneiden korkeudet (y-arvot) pysyvät v01:n mukaisina.
- Aluksen ulkosilhuetti on hieman leveämpi kuin v01:ssä (bbox x 169…1489), mutta huoneet ja lattiat ovat täsmälleen samoissa kohdissa.
- Merirosvojen idle-pomppu on pieni (pää ei liiku ylös ja alas, vain kädet, pää ja polvet liikkuvat). Kävelyssä pää liikkuu noin 4 px.
- Laser ja kilpiosuma ovat 2D-komposiitteja (tehty samaan cel- ja hehkutyyliin). Muut assetit on renderöity 3D:stä.
- Energiapalkin täytteen reunat on rajattu tarkasti suorakaiteeseen, joten hehku ei vuoda kehyksen alle.
