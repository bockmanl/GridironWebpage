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

   The expected health response is `{"status":"ok","database":"connected"}`. PostgreSQL runs the migration scripts on a new data volume, and Express tracks/applies any unrecorded migrations in sorted order before it starts accepting traffic. This also handles an existing volume and Cloud SQL.

5. Stop the services with `Ctrl+C`, or run:

   ```sh
   docker compose down
   ```

PostgreSQL data remains in the `postgres_data` named volume. To remove the database and all its data, use `docker compose down -v` only when you intend to reset the local database.

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

## Google Cloud deployment (Cloud Run + Cloud SQL)

The cloud image serves the React build and Express API from one Cloud Run service. PostgreSQL runs in Cloud SQL, with the password supplied from Secret Manager. The Cloud Run service is private by default: this MVP has no sign-in and assumes one demo athlete, so do not make it public with real athlete data.

### One-time Google Cloud setup

1. Install and authenticate the Google Cloud CLI, select a billable project, and choose a region:

   ```sh
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   gcloud config set run/region us-central1
   ```

2. Enable the required services and create an Artifact Registry repository:

   ```sh
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com
   gcloud artifacts repositories create gridironpulse --repository-format=docker --location=us-central1
   ```

3. In Cloud SQL, create a PostgreSQL instance, a database named `gridiron`, and a database user named `gridiron`. Ensure this user can create tables in the `public` schema; the app applies migrations during startup. Keep the instance connection name (`PROJECT_ID:REGION:INSTANCE`) and the database user's password. Store that password as a Secret Manager secret named `gridiron-db-password`; do not put it in this repository or in build substitutions.

4. Create a runtime service account and grant it access to Cloud SQL and the database password secret:

   ```sh
   gcloud iam service-accounts create gridironpulse-runtime
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:gridironpulse-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com" --role=roles/cloudsql.client
   gcloud secrets add-iam-policy-binding gridiron-db-password --member="serviceAccount:gridironpulse-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
   ```

   The identity running Cloud Build also needs permission to push to the Artifact Registry repository, deploy Cloud Run services, and act as this runtime service account.

5. The server image includes `server/migrations`. On startup, it applies each unrecorded SQL file in sorted order and records it in `schema_migrations`; no manual migration command is required.

### Build and deploy

Run this from the repository root, replacing the project, instance, and account values:

```sh
gcloud builds submit --config cloudbuild.yaml --substitutions="_REGION=us-central1,_REPOSITORY=gridironpulse,_SERVICE=gridironpulse,_INSTANCE_CONNECTION_NAME=YOUR_PROJECT_ID:us-central1:YOUR_INSTANCE,_DATABASE=gridiron,_DB_USER=gridiron,_DB_PASSWORD_SECRET=gridiron-db-password,_RUNTIME_SERVICE_ACCOUNT=gridironpulse-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com" .
```

The build produces a single container from `Dockerfile.cloud`, deploys it to Cloud Run, attaches the Cloud SQL socket, and injects `PGPASSWORD` from Secret Manager. Open the service privately through an authenticated local proxy:

```sh
gcloud run services add-iam-policy-binding gridironpulse --region us-central1 --member="user:YOUR_GOOGLE_ACCOUNT_EMAIL" --role=roles/run.invoker
gcloud run services proxy gridironpulse --region us-central1 --port 8080
```

Then visit [http://localhost:8080](http://localhost:8080). Keep the service private until authentication and per-athlete data isolation are implemented.
