# GridironPulse

GridironPulse is a unified football recovery and film study tracker. It gives student-athletes one place to record daily readiness and soreness, log workouts and mobility sessions, and organize opponent film notes with play-by-play timestamps.

## Why it matters

Players and coaches often split preparation across paper notebooks, spreadsheets, and separate tracking tools. That fragmentation makes it harder to keep training and film observations together. GridironPulse brings those records into one simple, searchable workflow so athletes can review their recovery and football study history side by side.

## MVP features

- Daily readiness check-ins for sleep quality, fatigue, sore muscles, and notes.
- Workout and mobility/rehab logging with duration and intensity.
- Recent recovery and workout history with inline editing.
- Film notes by opponent, date, and session type, with searchable notes and timestamped observations and coaching corrections.

## Technology stack

- **Frontend:** React and TypeScript, served by Vite.
- **API:** Node.js and Express.
- **Database:** PostgreSQL.
- **Local development:** Docker Compose.
- **Cloud hosting direction:** Google Cloud (container hosting and managed PostgreSQL are the intended deployment approach). The repository currently configures local Docker Compose; Google Cloud resources are not provisioned here.

## Run locally

### Prerequisites

- Docker Desktop with Docker Compose, or Docker Engine with the Compose plugin.
- Git.

### Setup

1. Clone the repository and enter its folder:

   ```sh
   git clone https://github.com/bockmanl/GridironWebpage.git
   cd GridironWebpage
   ```

2. Create the local environment file. On PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   On macOS/Linux:

   ```sh
   cp .env.example .env
   ```

   The example contains development-only PostgreSQL defaults. Change them in `.env` if needed; do not use these defaults for a shared or production environment.

3. Build and start the services:

   ```sh
   docker compose up --build
   ```

   The equivalent legacy command is `docker-compose up --build`. Wait for the database and API health checks to pass.

4. Open the app and check the API:

   - React client: [http://localhost:5173](http://localhost:5173)
   - Express API health: [http://localhost:3000/api/health](http://localhost:3000/api/health)
   - PostgreSQL: `localhost:5432`

   The expected health response is `{"status":"ok","database":"connected"}`. On a new PostgreSQL data volume, SQL migrations in `server/migrations` run automatically during database initialization.

5. Stop the services with `Ctrl+C`, or run:

   ```sh
   docker compose down
   ```

PostgreSQL data remains in the `postgres_data` named volume. To remove the database and all its data, use `docker compose down -v` only when you intend to reset the local database.

### Existing database volume

PostgreSQL only runs its initialization scripts when creating a new data directory. If reusing a volume created before the Unit 12 MVP migration, apply the new migration once from PowerShell:

```powershell
Get-Content .\server\migrations\002_unit12_mvp.sql | docker compose exec -T db psql -U gridiron -d gridiron
```

## Current API

All endpoints are under `/api`. The local MVP uses the seeded demo athlete (`user_id` `00000000-0000-0000-0000-000000000001`); authentication is not part of this local setup.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API and PostgreSQL health check. |
| `POST` | `/api/readiness` | Create a readiness check-in. Body: `sleep_quality` (1-10), `fatigue_level` (1-10), `sore_muscles` (array of muscle-area names), and `notes`. |
| `POST` | `/api/workouts` | Create a workout. Body: `type` (`Lifting` or `Mobility/Rehab`), `duration_mins`, `intensity` (1-10), and `notes`. |
| `GET` | `/api/logs` | Readiness and workout history, each ordered newest first. |
| `PUT` | `/api/logs/:type/:id` | Update a log; `:type` is `readiness` or `workout`. |
| `POST` | `/api/film-notes` | Create a film note with opponent, session date/type, general notes, and timestamped plays. |
| `GET` | `/api/film-notes` | List film notes; accepts optional `opponent` and `search` query parameters. |
| `PUT` | `/api/film-notes/:id` | Update a film note and its timestamped plays. |
| `DELETE` | `/api/film-notes/:id` | Delete a film note. |
