# TeamTimer

TeamTimer ist eine lokal nutzbare Web-App zur Schichtplanung für Badeseen.

## Technischer Aufbau

- **Frontend:** React + TypeScript + Vite + Tailwind
- **Backend:** Node.js + Express
- **Speicherung:** JSON-Datei im Projektordner (`data/app-data.json`)
- **Deployment lokal:** Docker Compose

Ich habe die bestehende Lovable-Oberfläche bewusst beibehalten und nur funktional angebunden.

## Wichtige Änderung

Die Daten werden **nicht im Docker-Container versteckt gespeichert**, sondern in:

```text
data/app-data.json
```

Diese Datei liegt im Projektordner und wird per Bind-Mount in den Container eingebunden.

## Standard-Login

- Benutzername: `admin`
- Passwort: `admin`

## Start mit Docker

```bash
docker compose up --build
```

Danach läuft die App unter:

```text
http://localhost:3000
```

## Daten zurücksetzen

Wenn du komplett neu starten willst, lösche einfach:

```text
data/app-data.json
```

Beim nächsten Start wird die Datei automatisch neu erstellt.

## Hinweise

- Das Startpaket ist jetzt absichtlich **ohne Demo-Mitarbeiter und ohne Demo-Schichten** befüllt.
- Die zwei Standard-Standorte und die vier Standardschichten sind bereits vorhanden.
- `package-lock.json` wurde entfernt, damit Docker nicht wieder an einem fehlerhaften Lockfile hängen bleibt.
