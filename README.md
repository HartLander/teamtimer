# TeamTimer

TeamTimer ist eine lokal nutzbare Web-App zur Schichtplanung für Badeseen.

## Technischer Aufbau

- **Frontend:** React + TypeScript + Vite + Tailwind
- **Backend:** Node.js + Express
- **Speicherung:** JSON-Datei im Datenordner (`app-data.json`)
- **Deployment lokal:** Docker Compose

Ich habe die bestehende Lovable-Oberfläche bewusst beibehalten und nur funktional angebunden.

## Was jetzt neu ist

- **Admin-Zugang per Umgebungsvariablen**
- **Session-Secret per Umgebungsvariable**
- **Datenordner per Umgebungsvariable**
- **Port per Umgebungsvariable**

Die Login-Daten werden **nicht** in `app-data.json` gespeichert, sondern kommen direkt aus der Server-Konfiguration.

## Wichtige Umgebungsvariablen

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `PORT`
- `HOST_PORT`
- `DATA_DIR_HOST`
- `DATA_DIR_CONTAINER`

## Empfohlener lokaler Start

1. `.env.example` nach `.env` kopieren
2. Werte anpassen
3. starten mit:

```bash
docker compose up --build
```

Danach läuft die App unter:

```text
http://localhost:HOST_PORT
```

Beispiel bei `HOST_PORT=3000`:

```text
http://localhost:3000
```

## Datenhaltung

Die Daten werden außerhalb des Containers gespeichert. Standardmäßig liegt die Datei hier:

```text
./data/app-data.json
```

Über `DATA_DIR_HOST` kannst du das lokal ändern. Für Unraid wird später daraus typischerweise so etwas wie:

```text
/mnt/user/appdata/teamtimer
```

## Wichtiger Hinweis für Unraid

Für Unraid solltest du unbedingt eigene Werte setzen für:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

## Daten zurücksetzen

Wenn du komplett neu starten willst, lösche einfach die Datei:

```text
app-data.json
```

im gemappten Datenordner. Beim nächsten Start wird sie automatisch neu erstellt.
