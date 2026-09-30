# dornsloops

Eine Wand aus kurzen Videoloops — die Sorte, die man im Hintergrund laufen lässt
statt Musik. Die Videos werden vom Projekt selbst gehostet; die Quelle steht an
jedem Loop.

## Loops einpflegen

```sh
npm run add -- https://pr0gramm.com/top/7077671        # einzeln
npm run add -- 7077671 6447228 6276080                 # mehrere (URL oder ID)
npm run add -- --file sources.txt                      # aus einer Liste
```

Das Script holt die Metadaten über die öffentliche pr0gramm-API, lädt die
passende Variante, normalisiert sie bei Bedarf mit `ffmpeg` auf h264 ≤ 720p,
zieht ein Poster-Standbild und schreibt den Datensatz nach
[`content/loops.json`](content/loops.json). Die Mediendateien landen unter
`public/loops/<id>.mp4` bzw. `.jpg`.

Bereits vorhandene Loops werden übersprungen. `--force` lädt sie neu und lässt
dabei die kuratierten Felder (`title`, `featured`) unangetastet.

| Option | Default | Wirkung |
| --- | --- | --- |
| `--file <pfad>` | – | IDs/URLs zeilenweise aus einer Datei (`#` = Kommentar) |
| `--force` | aus | vorhandene Einträge neu laden |
| `--metadata-only` | aus | nur Tags und Quellenangaben nachziehen, Dateien nicht anfassen |
| `--max-height <n>` | `720` | oberhalb wird herunterskaliert |
| `--max-size <mb>` | `25` | Größenbudget bei der Variantenwahl |
| `--reencode <modus>` | `auto` | `auto` \| `always` \| `never` |

Dieselbe Liste gibt `npm run add -- --help` im Terminal aus.

Tags ändern sich auf pr0gramm laufend. `--force --metadata-only` holt sie für
alle Einträge neu, ohne die Mediendateien anzurühren:

```sh
node -e "console.log(require('./content/loops.json').map(l => l.id).join('\n'))" > /tmp/ids
npm run add -- --force --metadata-only --file /tmp/ids
```

`auto` transkodiert nur, wenn die Quelle kein h264 ist, zu hoch auflöst oder das
Größenbudget reißt — sonst wird die Originaldatei unverändert übernommen.

**Voraussetzungen:** Node ≥ 20, `ffmpeg` und `ffprobe` im `PATH`.

**Grenzen:** Ohne Login liefert die pr0gramm-API nur SFW-Posts (`flags=1`).
NSFW/NSFP-Items brechen mit einer entsprechenden Meldung ab.

## Titel und Tags

pr0gramm kennt keine Titel. Das Script nimmt den Tag mit der höchsten Confidence
— meistens ist das der Track, den der Loop verwendet. Passt der nicht, einfach
`title` in `content/loops.json` von Hand ändern; ein späteres `--force`
überschreibt ihn nicht.

Gespeichert werden alle Tags, die die API zu einem Post herausgibt — also genau
die, die auch auf pr0gramm sichtbar sind — sortiert nach Confidence. Die
Detailseite zeigt sie vollständig, in der Schreibweise des jeweiligen Posts.

Welche Tags nichts über den Loop aussagen, steht an einer Stelle:
[`content/generic-tags.json`](content/generic-tags.json). Die Liste nennt drei
Sorten — den Medientyp (`video`, `sound`, `webm`, `musik`, …), die Herkunft
(`oc`, `repost`) und die Einstufung des Posts (`sfw`, `nsfb`). Gelesen wird sie
von beiden Seiten: das Ingest-Script überspringt diese Tags beim Titelraten, die
Filterleiste zeigt sie nicht als Knopf. Wer einen Eintrag hinzufügt, ändert damit
beides — und den Titel, den der *nächste* eingepflegte Loop bekommt; bereits
geschriebene Titel bleiben, auch bei `--force`.

Die Filterleiste lässt darüber hinaus weg, was nur an einem einzigen Loop hängt —
sonst stünden dort mehrere hundert Knöpfe statt dreißig. Über die Detailseite ist
ein solcher Tag trotzdem klickbar.

pr0gramm kennt keine Groß-/Kleinschreibung bei Tags: derselbe Tag kommt als
`Original Content` und `original content` zurück. Die Leiste fasst sie zu einem
Knopf zusammen und zeigt die Schreibweise, die die meisten Loops verwenden (bei
Gleichstand die des neuesten). Gefiltert wird entsprechend über alle
Schreibweisen — die Zahl auf dem Knopf ist die Zahl der Loops, die er öffnet.

## Ton aus einem anderen Post

Manche Loops sind sehenswert und klingen trotzdem nicht: ein Repost, der
zweimal durch eine Transkodierung gelaufen ist, oder — häufiger als man denkt —
ein Clip, der um 5 % verlangsamt wurde, damit ihn die Repost-Erkennung nicht
findet. Läuft derselbe Track in einem anderen Post sauber, darf ein Loop Bild und
Ton aus zwei Quellen mischen. Das steht dann im optionalen Feld `audioFix`:

```json
"audioFix": {
  "source": { "platform": "pr0gramm", "url": "…/7058305", "uploader": "…", "postedAt": "…", "original": null },
  "offset": 14.4837,
  "videoRate": 1.052632,
  "reason": "Dieser Post läuft auf 95 % Geschwindigkeit und sein Ton bricht bei 7,5 kHz ab; …"
}
```

`offset` ist die Sekunde, an der der Loop im Ton des anderen Posts einsetzt,
`videoRate` der Faktor, mit dem das Bild dafür umgetaktet wurde (`1` = unangetastet),
`reason` die Begründung — sie steht auf der Detailseite, ist also Text für Leser
und keine interne Notiz. Die Detailseite nennt in diesem Fall beide Quellen,
überschrieben mit **Bild** und **Ton** statt mit **Quelle**.

Geschrieben wird das Feld ausschließlich von Hand; das Ingest-Script kennt keinen
Mix. Es behandelt `audioFix` deshalb wie `title` und `featured` als kuratiert —
und weil ein erneuter Download die Mediendatei durch das kaputte Original
ersetzen würde, rührt selbst `--force` bei einem Loop mit `audioFix` die Dateien
nicht an, sondern zieht nur Tags und Quellenangabe nach. Was am `audioFix` selbst
steht, aktualisiert niemand: die Angaben zum zweiten Post veralten wie der
Kommentar, der sie erklärt.

Wer so einen Mix baut, hält die drei Dinge nach, die ihn unauffällig machen:
Tempo und Tonhöhe des Tracks, der Pegel des Loops, den er ersetzt (die Wand
mischt nichts nach), und ein Bild, das mit dem Ton nicht auseinanderläuft.

## Links teilen

Jede Loop-Seite bringt Open-Graph-Metadaten mit: Titel, Poster als Vorschaubild
und das Video selbst (`og:video`), sodass Discord & Co. den Loop direkt in der
Vorschau abspielen statt nur ein Standbild zu zeigen. Beschreibung ist Dauer,
Uploader und die ersten Tags.

Das setzt **absolute** URLs voraus, die zur Build-Zeit feststehen müssen:

```sh
cp .env.example .env      # NUXT_PUBLIC_SITE_URL auf die echte Domain setzen
npm run generate
```

Ohne gesetzte `NUXT_PUBLIC_SITE_URL` funktioniert die Seite normal, die
Vorschau bleibt aber ohne Bild. `deploy.sh` warnt in dem Fall.

Die Seite steht auf `noindex` — das hält Suchmaschinen fern, die Link-Vorschau
der Messenger funktioniert davon unabhängig.

## Entwicklung

```sh
npm install
npm run dev        # http://localhost:3000
npm run generate   # statischer Build nach .output/public
```

`npm run generate` erzeugt eine rein statische Seite — kein Server nötig, das
Verzeichnis kann direkt von nginx, GitHub Pages o. ä. ausgeliefert werden.

Die Node-Version steht in [`.tool-versions`](.tool-versions) und gilt lokal wie
in der CI.

`dev`, `build`, `generate` und `preview` laufen über `cross-env TZ=UTC` — dieselbe
Zone, in der [`deploy.sh`](.github/webhooks/deploy.sh) baut. Das Datum auf der
Detailseite rendert zwar ohnehin fest in `Europe/Berlin`, aber ein Build, der
lokal in einer anderen Zone läuft als auf dem Server, hält nur zufällig dasselbe
Ergebnis fest. Playwright baut aus demselben Grund über `npm run generate` statt
über `npx nuxt generate`.

## Prüfen

```sh
npm run test:lint            # eslint + typecheck, beides muss still bleiben
npm run test:lint:eslint     # eslint --max-warnings 0
npm run test:lint:typecheck  # nuxt typecheck (vue-tsc, auch in .vue)
npm run test:unit            # vitest mit Coverage
npm run test:unit:dev        # dasselbe im Watch-Modus
npm run test:e2e             # playwright gegen den statischen Build
```

Die vier `test:*`-Skripte sind der Haus-Vertrag: derselbe Satz Namen wie in
jahrweiser und werft, damit ein Projekt ohne Nachfragen abnehmbar ist.

Geprüft wird gegen [`eslint-config-it4c`](https://github.com/IT4Change/eslint-config-it4c);
Prettier läuft als Regel darin mit, es gibt also keinen zweiten Formatierungslauf.
Was dieses Projekt abweichend regelt, steht mit Begründung in
[`eslint.config.ts`](eslint.config.ts) — jede Abweichung ist dort eine benannte
Entscheidung, keine stillschweigende. `npm run test:lint:eslint -- --fix` räumt
das Formatierbare selbst auf.

### Unit

Die Specs liegen neben der Datei, die sie prüfen (`x.ts` / `x.spec.ts`).
[`vitest.config.ts`](vitest.config.ts) fährt sie in drei Projekten: `app` in der
Nuxt-Umgebung (`@nuxt/test-utils`), `scripts` als nacktes Node — die
Ingest-Skripte brauchen keine App, und die `.vue`-Dateien gehen ohne nicht — und
`content` für die Daten selbst.

Wo eine Spur gegen `content/loops.json` liefe, steht stattdessen eine kleine
Wand aus [`app/test/fixtures.ts`](app/test/fixtures.ts); sonst würde jeder neue
Loop die Erwartungen verschieben.

### Daten

Genau eine Ausnahme davon, und zwar eine gewollte:
[`content/loops.spec.mjs`](content/loops.spec.mjs) prüft die **echte**
`content/loops.json`, denn sie ist die einzige Eingabe dieses Projekts und
niemand liest sie zwischen `npm run add` und dem Deploy kritisch. Ein Eintrag,
dessen Video gelöscht wurde, ist eine Kachel, die nichts abspielt, auf einer
Seite, die mit 200 antwortet.

Geprüft wird das Schema aus [`app/types/loop.ts`](app/types/loop.ts) — Felder und
Typen, und ausdrücklich auch, dass *kein* unbekanntes Feld dasteht, damit ein neues
Feld im Interface nicht ungeprüft bleibt —, eindeutige ids, die Sortierung nach
Upload-Datum, die Schreibweise der Datei, und in beide Richtungen die
Mediendateien: jeder Eintrag hat sein Video und sein Poster, jede Datei unter
`public/loops/` gehört zu einem Eintrag. Die zweite Richtung ist die Hälfte einer
Löschung, die sonst übrig bleibt — Eintrag weg, Video weiter ausgeliefert.

```sh
npx vitest run --project content   # nur die Daten
```

Diese Prüfung läuft in `test:unit` mit, also auch bei jedem `new loop`-Push.

Die Coverage-Schwellen stehen pro Bereich, nicht als eine Zahl fürs Projekt:
`app/**` hält 97 %, `scripts/ingest.mjs` deutlich weniger, weil dessen zweite
Hälfte ffmpeg- und Netzwerk-Orchestrierung ist, die nur ein echter Download
durchläuft. Die Zahlen sind der gemessene Boden ohne Luft — sie anzuheben ist
ein eigener Commit, damit die Ratsche sichtbar bleibt.

### E2E

Playwright fährt gegen genau das Artefakt, das auch deployt wird: `nuxt generate`
und das Verzeichnis `.output/public`, ausgeliefert von
[`e2e/static-server.mjs`](e2e/static-server.mjs) — sechzig Zeilen, die die
`try_files`- und `error_page`-Regeln aus
[`nginx.conf.template`](.github/webhooks/nginx.conf.template) nachbilden, damit
ein unbekannter Loop im Test dieselbe 404 bekommt wie auf dem Server.

Der Port ist `3030` und nicht `3000`: `npm run dev` wohnt dort, und Playwright
könnte einen laufenden Dev-Server nicht von seinem eigenen unterscheiden — die
Suite liefe dann gegen einen Build, den sie nie gemacht hat. Mit `E2E_PORT` zu
überschreiben.

Alles, was klickt oder tippt, wartet vorher über `e2e/helpers.ts` auf die
Hydration — die Handler hängen an `onMounted`, und ein Tastendruck davor geht
spurlos verloren. Gewartet wird auf ein Messbares (`__vue_app__`, und beim
Player der Fortschrittsbalken, den der Build als `aria-valuemax="0"` ausliefert),
nie auf eine feste Zeitspanne. In der CI laufen Retries, aber ein Test, der erst
beim zweiten Anlauf durchgeht, macht den Lauf trotzdem rot (`failOnFlakyTests`) —
ein Flake, den niemand zu sehen bekommt, wird nie behoben.

```sh
npx playwright install chromium   # einmalig
npm run test:e2e
npm run test:e2e -- --ui          # interaktiv
```

Dieselben Skripte laufen bei jedem Push und PR:
[`app.test.lint.code.yml`](.github/workflows/app.test.lint.code.yml),
[`app.test.unit.code.yml`](.github/workflows/app.test.unit.code.yml),
[`app.test.e2e.code.yml`](.github/workflows/app.test.e2e.code.yml).

## Bedienung

Die Startseite ist eine Masonry-Wand mit stummen Vorschauen (Videos werden erst
geladen, wenn sie in die Nähe des Viewports kommen). Ein Klick führt auf die
Detailseite des Loops: `/loop/7077671` — eine echte, prerenderte URL, direkt
verlinkbar. Dort läuft der Loop mit Ton, endlos, und daneben stehen alle Tags,
die Quelle, der Uploader und das Upload-Datum. Das Datum steht fest in
`Europe/Berlin` — unabhängig davon, in welcher Zeitzone gebaut oder gelesen
wird, damit im ausgelieferten HTML derselbe Tag steht wie nach der Hydration.

| Taste | Funktion |
| --- | --- |
| `→` / `←` | nächster / vorheriger Loop |
| `Leertaste` | Pause / Weiter |
| `M` | stumm schalten / Ton an |
| `Esc` | zurück zur Wand |
| `Bild auf` / `Bild ab` | im Loop vor / zurück (je ein Zehntel) |
| `Pos1` / `Ende` | an den Anfang / ans Ende des Loops |

Die letzten beiden Zeilen wirken, solange der Fortschrittsbalken den Fokus hat —
er ist mit `Tab` erreichbar. `→` und `←` wechseln auch dort den Loop, statt zu
spulen; die Navigation behält sie überall. Alles, was mit der Maus geht, geht
auch mit der Tastatur: Play/Pause und Stumm stehen zusätzlich als Knöpfe unter
dem Video.

Mit `Strg`, `Alt` oder `⌘` greift keines der Kürzel — `Strg+M` gehört dem Browser
und dem Screenreader, `⌘M` minimiert das Fenster. `Umschalt+M` schaltet dagegen
stumm, denn das ist dieselbe Taste in Groß. Und die `Leertaste` auf einem
fokussierten Knopf löst nur diesen Knopf aus, nicht zusätzlich Pause.

Vor und zurück bleibt innerhalb eines aktiven Tag-Filters und läuft am Ende der
Liste wieder von vorn. Lautstärke und Stummschaltung überleben im
`localStorage`.

Chrome und Safari lassen Autoplay mit Ton beim ersten Besuch in der Regel nicht
zu. Dann startet der Loop stumm und sagt es auch — ein Druck auf den Knopf oder
`M` gibt Ton, und der Hinweis verschwindet, sobald er da ist. Das Knopf-Symbol
zeigt immer, was das Video tatsächlich tut, nicht was gespeichert ist: eine vom
Browser erzwungene Stummschaltung landet nicht im `localStorage`, denn sie ist
keine Entscheidung des Menschen.

Ein Klick auf ein Tag auf der Detailseite filtert die Wand danach.

## Rechtliches

Die Loops stammen von ihren jeweiligen Urhebern und werden hier gespiegelt, um
sie an einem Ort abspielbar zu halten. Jeder Eintrag verlinkt auf den
Original-Post und nennt den Uploader. Die Seite ist auf `noindex` gesetzt und
verfolgt keinen kommerziellen Zweck. Eine Quellenangabe ist allerdings keine
Lizenz: Wer die Entfernung eines Loops wünscht, bekommt sie — Eintrag aus
`content/loops.json` und die zugehörigen Dateien aus `public/loops/` löschen,
neu generieren, fertig. Dass beide Hälften wirklich passiert sind, sagt
`npm run test:unit`: eine übrig gebliebene Datei wird dort genauso zum Fehler wie
ein übrig gebliebener Eintrag.

Der Code steht unter der [Apache-2.0-Lizenz](LICENSE); für die Mediendateien
gilt sie ausdrücklich nicht.
