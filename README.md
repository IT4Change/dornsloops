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
Detailseite zeigt sie vollständig. Die Filterleiste auf der Startseite blendet
zwei Sorten aus: Tags, die den Medientyp beschreiben (`video`, `sound`, `loop`,
…), und solche, die nur an einem einzigen Loop hängen.

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

## Prüfen

```sh
npm run test:lint            # eslint + typecheck, beides muss still bleiben
npm run test:lint:eslint     # eslint --max-warnings 0
npm run test:lint:typecheck  # nuxt typecheck (vue-tsc, auch in .vue)
```

Geprüft wird gegen [`eslint-config-it4c`](https://github.com/IT4Change/eslint-config-it4c);
Prettier läuft als Regel darin mit, es gibt also keinen zweiten Formatierungslauf.
Was dieses Projekt abweichend regelt, steht mit Begründung in
[`eslint.config.ts`](eslint.config.ts) — jede Abweichung ist dort eine benannte
Entscheidung, keine stillschweigende. `npm run test:lint:eslint -- --fix` räumt
das Formatierbare selbst auf.

Dieselben Skripte laufen bei jedem Push und PR über
[`.github/workflows/app.test.lint.code.yml`](.github/workflows/app.test.lint.code.yml).

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
neu generieren, fertig.

Der Code steht unter der [Apache-2.0-Lizenz](LICENSE); für die Mediendateien
gilt sie ausdrücklich nicht.
