# Webhook Deployment

Automatisches Deployment via GitHub Webhook auf einem Alpine-Linux-Server.
Der Hook lauscht auf **veröffentlichte GitHub-Releases** und deployt genau
das Tag des Releases. Ein Push auf `master` allein deployt nichts mehr.

Releases entstehen über [release-please](https://github.com/googleapis/release-please)
([`release.yml`](../workflows/release.yml)): Jeder Push auf `master` aktualisiert
einen offenen Release-PR mit Versionssprung und `CHANGELOG.md`. **Erst das
manuelle Mergen dieses PRs** erzeugt Tag und Release, und das Release löst den
Deploy aus. Die Version leitet release-please aus den Conventional-Commit-Titeln
der gemergten PRs ab (`feat` → Minor, `fix` → Patch, `!` → Major); im Changelog
erscheinen alle Typen, auch `build(deps)` und `chore`. Konfiguration:
[`.github/release-please/`](../release-please/). Tags tragen kein `v`-Präfix,
also `1.4.0`.

Die Seite ist ein statischer Build (`npm run generate`) — es läuft **kein
Node-Prozess** in Produktion, nginx liefert die Dateien direkt aus. Damit
entfällt pm2 komplett.

## Inhalt

| Datei                  | Zweck                                                          |
|------------------------|----------------------------------------------------------------|
| `hooks.json.template`  | Konfiguration für [`webhook`](https://github.com/adnanh/webhook) -- prüft HMAC-SHA256-Signatur, Event `release` und `action == "published"`, ruft dann `deploy.sh <tag>` auf |
| `deploy.sh`            | Checkout des Release-Tags, Build (`npm ci && npm run generate`) und atomares Umschalten auf das neue Release |
| `poll.sh`              | Alternative für Hosts, die GitHub nicht erreichen kann: prüft per cron, ob es ein neueres Release-Tag gibt, und ruft dann `deploy.sh` |
| `nginx.conf.template`  | vhost: liefert `releases/current`, Cache-Header für Medien und Build-Assets, Proxy für den Webhook |
| `webhook.template`     | OpenRC-Init-Skript für den `webhook`-Daemon                    |
| `.gitignore`           | Hält die ausgefüllte `hooks.json` (Secret!) aus dem Repo       |

## Releases und atomares Umschalten

`deploy.sh` checkt das Tag aus (detached), baut nach `.output/public` und
veröffentlicht das Ergebnis in `releases/<zeitstempel>-<tag>/` — der
Zeitstempel ist UTC im Format `YYYYMMDDHHMMSS`, also etwa
`20260728113000-1.4.0`. Das Format ist nicht beliebig: `deploy.sh` findet alte
Releases über `-name '2*'` und sortiert sie lexikografisch, der Zeitstempel muss
also vorne stehen. Das Tag dahinter zeigt beim Rollback, welche Version ein
Verzeichnis ist.

Ohne Argument deployt `deploy.sh` das neueste Release-Tag, das in
`origin/master` enthalten ist — nie einen Branch-Stand. Ein Tag, das nicht auf
`master` liegt, oder ein Argument, das keine Version `X.Y.Z` ist, bricht ab,
bevor irgendetwas ausgecheckt wird. Erst wenn der Build durchgelaufen ist und eine
`index.html` existiert, wandert der Symlink `releases/current` auf das neue
Verzeichnis — nginx serviert also nie ein halbfertiges Build.

Ein neues Release startet als Hardlink-Kopie (`cp -al`) des laufenden, danach
schreibt `rsync --checksum` nur die tatsächlich geänderten Dateien darüber. Die
rund 180 MB Loop-Videos belegen den Platz damit **einmal**, nicht einmal pro
Release; geänderte Dateien bekommen einen eigenen Inode, alte Releases behalten
also ihre Version.

Zwei Details sind dabei nicht optional:

* **`cp -al` statt `rsync --link-dest`.** `--link-dest` hardlinkt nur Dateien,
  die in *allen* erhaltenen Attributen übereinstimmen — die mtime eingeschlossen.
  `nuxt generate` kopiert `public/` aber bei jedem Build mit frischem
  Zeitstempel, womit `--link-dest` ausnahmslos jede Datei neu kopieren würde.
* **`--checksum`.** Aus demselben Grund: rsync vergleicht sonst Größe und
  mtime und hielte jedes Video für geändert.

Die letzten `DORNSLOOPS_KEEP` Releases (Default: 3) bleiben liegen. Ein
Rollback ist ein Symlink-Wechsel — `ls` nennt die verfügbaren Ziele:

```sh
ls $RELEASES_DIR
ln -sfn "$RELEASES_DIR/20260728113000-1.4.0" "$RELEASES_DIR/current"
```

Der Pfad muss **absolut** sein, so wie `deploy.sh` ihn selbst schreibt: ein
relatives Ziel löst der Symlink gegen sein eigenes Verzeichnis auf, `ln -sfn
releases/… releases/current` zeigt also ins Leere. Wer lieber relativ arbeitet,
wechselt vorher hinein: `cd $RELEASES_DIR && ln -sfn 20260728113000-1.4.0 current`.

| Variable               | Default                  | Bedeutung                          |
|------------------------|--------------------------|------------------------------------|
| `DORNSLOOPS_RELEASES`  | `$PROJECT_ROOT/releases` | Zielverzeichnis der Releases       |
| `DORNSLOOPS_KEEP`      | `3`                      | Anzahl aufbewahrter alter Releases |
| `NUXT_PUBLIC_SITE_URL` | –                        | Absolute Basis-URL für Link-Vorschauen |

`NUXT_PUBLIC_SITE_URL` wird zur Build-Zeit in die Seiten gebacken (Open Graph
braucht absolute URLs für Vorschaubild und Video). Am einfachsten als `.env` im
Projekt-Checkout, die Nuxt beim Build automatisch liest:

```sh
echo 'NUXT_PUBLIC_SITE_URL=https://<host>' > /var/www/dornsloops/.env
```

Fehlt sie, deployt `deploy.sh` trotzdem, warnt aber — die Link-Vorschau bleibt
dann ohne Bild.

## Variablen

Vor dem Deployment in `hooks.json`, `nginx.conf` und im OpenRC-Skript ersetzen:

| Variable                  | Bedeutung                                                |
|---------------------------|----------------------------------------------------------|
| `$PROJECT_ROOT`           | Absoluter Pfad zum Projekt-Checkout auf dem Server       |
| `$RELEASES_DIR`           | Absoluter Pfad zum Release-Verzeichnis                   |
| `$HOST`                   | Hostname des vhosts                                      |
| `$DEPLOY_USER`            | Systemuser, unter dem Webhook und Build laufen           |
| `$WEBHOOK_GITHUB_SECRET`  | Shared Secret, identisch zur Konfiguration in GitHub     |

Der Deploy läuft bewusst **nicht als root**: `npm ci` führt Install-Skripte aus
dem Dependency-Baum aus, und ein Release löst das automatisch aus.

Der Checkout darf außerdem **nicht unterhalb von `/root`** liegen. Das
Verzeichnis ist `0700`, der `nginx`-User kommt nicht hindurch und jeder Request
endet in `stat() … (13: Permission denied)`. Alle Verzeichnisebenen bis zum
Release brauchen `x`-Recht für nginx — `/var/www/dornsloops` erfüllt das.

## Setup auf Alpine

Getestet gegen Alpine 3.23 (nodejs 24, nginx 1.28, webhook 2.8). `npm` und
`webhook` liegen im **community**-Repository — das muss in
`/etc/apk/repositories` aktiviert sein.

```sh
apk add git nodejs npm nginx rsync webhook

# Dedizierter User — der Build läuft nicht als root
adduser -D -h /var/www/dornsloops dornsloops

su -s /bin/sh dornsloops -c '
  git clone https://github.com/IT4Change/dornsloops.git /var/www/dornsloops
  cd /var/www/dornsloops
  echo "NUXT_PUBLIC_SITE_URL=https://<host>" > .env
  sh .github/webhooks/deploy.sh
'

# nginx-vhost
cp /var/www/dornsloops/.github/webhooks/nginx.conf.template \
   /etc/nginx/http.d/dornsloops.conf
vi /etc/nginx/http.d/dornsloops.conf   # $HOST und $RELEASES_DIR ersetzen
nginx -t && rc-service nginx restart && rc-update add nginx default

# webhook-Service
cp /var/www/dornsloops/.github/webhooks/webhook.template /etc/init.d/webhook
vi /etc/init.d/webhook                 # $PROJECT_ROOT und $DEPLOY_USER ersetzen
chmod +x /etc/init.d/webhook

su -s /bin/sh dornsloops -c '
  cd /var/www/dornsloops
  cp .github/webhooks/hooks.json.template .github/webhooks/hooks.json
  chmod 600 .github/webhooks/hooks.json
  vi .github/webhooks/hooks.json       # $PROJECT_ROOT und Secret ersetzen
'

rc-service webhook start && rc-update add webhook default
```

Das erste Deployment läuft oben schon mit — es ist gleichzeitig der Test, dass
Build und Publish funktionieren.

## Ohne öffentliche Erreichbarkeit

Ein GitHub-Webhook setzt voraus, dass GitHub den Host erreicht. Liegt die
Maschine im internen Netz, übernimmt `poll.sh` dieselbe Aufgabe pull-basiert —
`webhook`, der vhost-Block `/hooks/` und die `hooks.json` entfallen dann
komplett:

```sh
apk add git nodejs npm nginx rsync   # ohne webhook
su -s /bin/sh dornsloops -c 'crontab -e'
```

```cron
*/5 * * * * /var/www/dornsloops/.github/webhooks/poll.sh >> /var/log/dornsloops-poll.log 2>&1
```

`poll.sh` vergleicht das neueste Release-Tag auf `origin/master` mit dem
ausgecheckten Commit und ruft `deploy.sh` nur, wenn sie sich unterscheiden.
Solange es noch kein Release gibt, tut es nichts. Ein Verzeichnis-Lock verhindert, dass ein noch laufender
Build vom nächsten Tick überholt wird.

**Speicher:** Der Nuxt-Build braucht deutlich mehr RAM als die fertige Seite.
Auf einem knapp bemessenen LXC (< 1 GB) kann `npm run generate` vom OOM-Killer
erwischt werden — dann entweder Swap zuweisen oder den Build auf einer
kräftigeren Maschine erzeugen und nur das Release-Verzeichnis übertragen.

**Plattenplatz:** Checkout (~180 MB Medien) + `node_modules` (~400 MB) +
Releases. Mit Hardlinks bleibt letzteres bei etwa einer Kopie der Medien.

## GitHub-Konfiguration

Repository → **Settings → Webhooks → Add webhook**:

| Feld              | Wert                                       |
|-------------------|--------------------------------------------|
| Payload URL       | `https://<host>/hooks/github`              |
| Content type      | `application/json`                         |
| Secret            | identisch zu `$WEBHOOK_GITHUB_SECRET`      |
| SSL verification  | enabled                                    |
| Events            | **Send me everything**                     |
| Active            | [x]                                        |

GitHub schickt alle Events, gefiltert wird erst auf dem Server in `hooks.json`.
So bleibt die GitHub-Seite unverändert, wenn sich ändert, worauf deployt wird.
Gefiltert wird deshalb auch auf den Event-Typ (`X-GitHub-Event: release`), nicht
nur auf `action == "published"`: Andere Events kennen dieselbe Aktion
(`package`, `registry_package`), haben aber kein `release.tag_name`.
`deploy.sh` bekäme dann kein Argument und würde das neueste Release erneut
deployen.

## Ablauf

1. Ein PR wird auf `master` gemergt; `release.yml` aktualisiert den Release-PR.
2. Jemand mergt den Release-PR. release-please legt Tag und GitHub-Release an.
3. GitHub schickt einen signierten `release`-Payload an `/hooks/github`.
4. `webhook` validiert die HMAC-SHA256-Signatur und prüft Event `release` und `action == "published"`. Die übrigen Release-Aktionen (`created`, `released`, `edited` …) werden ignoriert, sonst liefe derselbe Deploy mehrfach.
5. `deploy.sh <tag>` checkt das Tag aus, baut die Seite (`npm ci && npm run generate`), veröffentlicht sie in ein neues Release und schwenkt `current` darauf um.

`deploy.sh` lässt sich jederzeit auch ohne Webhook auf dem Server ausführen
-- für ein manuelles Deployment oder zum Debuggen. `deploy.sh 1.3.0` baut eine
ältere Version neu, falls ihr Release-Verzeichnis schon weggeräumt ist.

## Umstellung von Push- auf Release-Deploy

Einmalig, auf einem Server, der noch per Push deployt:

1. Die Umstellung auf `master` mergen. Der alte Push-Hook deployt sie ein
   letztes Mal — danach liegen die neuen Skripte auf dem Server.
2. `hooks.json` neu aus dem Template erzeugen (Secret übernehmen) und
   `rc-service webhook restart`. Das ist nötig, obwohl GitHub schon alle Events
   schickt: Die alte `hooks.json` reagiert weiter auf Pushes auf `master`.
   Mit dem neuen `deploy.sh` deployt sie dann das neueste Release, und zwar
   beim Merge des Release-PRs *bevor* release-please dessen Tag angelegt hat.
   Das Ergebnis wäre jedes Mal das vorherige Release.

Bis zum ersten Release deployt dann nichts mehr. Wer `poll.sh` nutzt, muss
nur Schritt 1 abwarten.

## Neue Loops

Loops werden nicht auf dem Server eingepflegt, sondern lokal: `npm run add`
lädt Video und Poster nach `public/loops/` und schreibt den Datensatz nach
`content/loops.json`. Beides geht als PR mit dem Titel `feat(content): …` nach
`master` und mit dem nächsten Release live. Der Server braucht dafür kein `ffmpeg`.
