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
dabei handgepflegte Felder (`title`, `tags`, `featured`) unangetastet.

| Option | Default | Wirkung |
| --- | --- | --- |
| `--file <pfad>` | – | IDs/URLs zeilenweise aus einer Datei (`#` = Kommentar) |
| `--force` | aus | vorhandene Einträge neu laden |
| `--max-height <n>` | `720` | oberhalb wird herunterskaliert |
| `--max-size <mb>` | `25` | Größenbudget bei der Variantenwahl |
| `--reencode <modus>` | `auto` | `auto` \| `always` \| `never` |

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

## Entwicklung

```sh
npm install
npm run dev        # http://localhost:3000
npm run generate   # statischer Build nach .output/public
```

`npm run generate` erzeugt eine rein statische Seite — kein Server nötig, das
Verzeichnis kann direkt von nginx, GitHub Pages o. ä. ausgeliefert werden.

## Bedienung

Die Startseite ist eine Masonry-Wand mit stummen Vorschauen (Videos werden erst
geladen, wenn sie in die Nähe des Viewports kommen). Ein Klick öffnet den Player
mit Ton und spielt ab dort als Playlist weiter.

| Taste | Funktion |
| --- | --- |
| `→` / `←` | nächster / vorheriger Loop |
| `Leertaste` | Pause / Weiter |
| `M` | stumm schalten |
| `Esc` | Player schließen |

Über `⟳` stellt man ein, nach wie vielen Wiederholungen automatisch weiter-
geschaltet wird (`Endlos` schaltet die Automatik ab). Lautstärke, Shuffle und
diese Einstellung überleben im `localStorage`.

Der offene Loop steht als Query-Parameter in der URL (`/?loop=7077671`) und ist
damit direkt verlinkbar; der Zurück-Button schließt den Player. Ein URL-Hash
wäre naheliegender, taugt hier aber nicht: Nuxts Router verwirft ihn beim
initialen Laden, der Deep-Link käme also nie an.

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
