# Webhook Deployment

Automatisches Deployment via GitHub Webhook auf einem Alpine-Linux-Server.
Der Hook lauscht auf **Pushes auf `master`** und deployt nach jedem Push
den aktuellen Stand von `origin/master`.

Die Seite ist ein statischer Build (`npm run generate`) — es läuft **kein
Node-Prozess** in Produktion, nginx liefert die Dateien direkt aus. Damit
entfällt pm2 komplett.

## Inhalt

| Datei                  | Zweck                                                          |
|------------------------|----------------------------------------------------------------|
| `hooks.json.template`  | Konfiguration für [`webhook`](https://github.com/adnanh/webhook) -- prüft HMAC-SHA256-Signatur und `ref == "refs/heads/master"`, ruft dann `deploy.sh` auf |
| `deploy.sh`            | `git reset --hard origin/master`, Build (`npm ci && npm run generate`) und atomares Umschalten auf das neue Release |
| `nginx.conf.template`  | vhost: liefert `releases/current`, Cache-Header für Medien und Build-Assets, Proxy für den Webhook |
| `webhook.template`     | OpenRC-Init-Skript für den `webhook`-Daemon                    |
| `.gitignore`           | Hält die ausgefüllte `hooks.json` (Secret!) aus dem Repo       |

## Releases und atomares Umschalten

`deploy.sh` baut nach `.output/public` und veröffentlicht das Ergebnis in
`releases/<zeitstempel>/`. Erst wenn der Build durchgelaufen ist und eine
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
Rollback ist ein Symlink-Wechsel:

```sh
ln -sfn releases/20260728T1130 releases/current
```

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
| `$WEBHOOK_GITHUB_SECRET`  | Shared Secret, identisch zur Konfiguration in GitHub     |

## Setup auf Alpine

```sh
apk add webhook git nodejs npm nginx rsync

# Repo auf den Server klonen (Beispielpfad)
git clone https://github.com/IT4Change/dornsloops.git /var/www/dornsloops
cd /var/www/dornsloops

# 1. Hook-Konfiguration erstellen und Variablen ersetzen
cp .github/webhooks/hooks.json.template .github/webhooks/hooks.json
vi .github/webhooks/hooks.json

# 2. nginx-vhost einrichten
cp .github/webhooks/nginx.conf.template /etc/nginx/http.d/dornsloops.conf
vi /etc/nginx/http.d/dornsloops.conf   # $HOST und $RELEASES_DIR ersetzen
nginx -t && service nginx reload

# 3. OpenRC-Service einrichten
cp .github/webhooks/webhook.template /etc/init.d/webhook
vi /etc/init.d/webhook            # $PROJECT_ROOT ersetzen
chmod +x /etc/init.d/webhook

service webhook start
rc-update add webhook boot
```

Manuelles erstes Deployment (gleichzeitig Test, dass alles funktioniert):

```sh
sh .github/webhooks/deploy.sh
```

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
| Events            | **Just the push event**                    |
| Active            | [x]                                        |

## Ablauf

1. Push auf `master` landet auf GitHub.
2. GitHub schickt einen signierten `push`-Payload an `/hooks/github`.
3. `webhook` validiert die HMAC-SHA256-Signatur und prüft `ref == "refs/heads/master"`. Pushes auf andere Branches werden ignoriert.
4. `deploy.sh` synchronisiert das Arbeitsverzeichnis mit `origin/master` (`git reset --hard`), baut die Seite (`npm ci && npm run generate`), veröffentlicht sie in ein neues Release und schwenkt `current` darauf um.

`deploy.sh` lässt sich jederzeit auch ohne Webhook auf dem Server ausführen
-- für ein manuelles Deployment oder zum Debuggen.

## Neue Loops

Loops werden nicht auf dem Server eingepflegt, sondern lokal: `npm run add`
lädt Video und Poster nach `public/loops/` und schreibt den Datensatz nach
`content/loops.json`. Beides wird committet — der Push löst dann das Deployment
aus. Der Server braucht dafür kein `ffmpeg`.
