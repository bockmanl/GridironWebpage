# GridironPulse

GridironPulse is a unified football recovery, workout, and film study tracker. It gives student-athletes one place to record daily readiness and soreness, log workouts and mobility sessions, and organize opponent film notes with play-by-play timestamps.

## Project overview and Sprint 1 status

Student-athletes often split their preparation across paper notebooks, spreadsheets, and separate tracking tools. That fragmentation makes it harder to connect recovery habits, training sessions, and film observations. GridironPulse brings those workflows together in one searchable application.

**Sprint 1 MVP is implemented.** The current repository includes:

- **Recovery Tracker:** daily sleep, fatigue, soreness, and notes check-ins; workout and mobility logging; and editable recent history.
- **Film Notebook:** create, search/filter, edit, and delete notes with timestamped observations and coaching corrections.
- **PostgreSQL auto-migrations:** the Express server applies ordered, unrecorded SQL migrations before accepting requests.
- **Google Cloud deployment configuration:** Cloud Build can build the production image, push it to Artifact Registry, and deploy a private Cloud Run service connected to Cloud SQL, with the database password from Secret Manager.

The Cloud Build delivery workflow is defined in `cloudbuild.yaml` and can be run with `gcloud builds submit`. A Git push trigger is configured separately in Google Cloud, if desired; it is not defined in this repository. No live service URL is checked in, so verify the deployed service and its status in the target Google Cloud project.

## Architecture and technology stack

- **Frontend:** React, Vite, and TypeScript.
- **API:** Node.js and Express.
- **Database:** PostgreSQL.
- **Local environment:** Docker Compose runs the client, API, and database.
- **Cloud environment:** Cloud Run hosts the production client/API container; Cloud SQL provides PostgreSQL; Artifact Registry stores the container image; Secret Manager supplies the database password; Cloud Build builds, pushes, and deploys the image.

The local Vite development server proxies API requests to Express. In production, the Express container serves the built React application and `/api` endpoints from the same Cloud Run service.

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

   `.env.example` contains development-only PostgreSQL defaults. Change them in `.env` if needed; never use these defaults for a shared or production environment.

3. Build and start the services:

   ```sh
   docker-compose up --build
   ```

   With current Docker Compose installations, `docker compose up --build` is equivalent. Wait for the database and API health checks to pass. On server startup, the migration runner creates its tracking table, then applies each unapplied SQL migration in sorted order and records it. No manual SQL setup is required.

4. Open the app and check the API:

   - React client: [http://localhost:5173](http://localhost:5173)
   - Express health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)
   - PostgreSQL: `localhost:5432`

   A healthy API returns `{"status":"ok","database":"connected"}`.

5. Stop the services with `Ctrl+C`, or run:

   ```sh
   docker-compose down
   ```

PostgreSQL data remains in the `postgres_data` named volume. To reset the local database and remove all its data, run `docker-compose down -v` only when that is intended.

### Environment variables

| Environment | Variables | Purpose |
| --- | --- | --- |
| Local `.env` | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Configure the PostgreSQL container. Compose passes these values to the server as `PGDATABASE`, `PGUSER`, and `PGPASSWORD`; the server connects to the `db` service on port `5432`. |
| Local client | `API_PROXY_TARGET` | Compose sets this to `http://server:3000` for Vite's API proxy. |
| Cloud Run | `NODE_ENV=production`, `PORT=8080`, `PGHOST`, `PGPORT=5432`, `PGDATABASE`, `PGUSER` | Configure the production Express process and its Cloud SQL Unix socket connection. `PGHOST` is `/cloudsql/PROJECT_ID:REGION:INSTANCE`. |
| Cloud Run secret | `PGPASSWORD` | Injected from the `gridiron-db-password` Secret Manager secret; do not put database credentials in source control or build arguments. |

### Google Cloud deployment

The checked-in Cloud Build configuration performs the delivery sequence **build image → push to Artifact Registry → deploy to Cloud Run**. The Cloud Run service is private by default because this MVP has no authentication or per-athlete data isolation. Do not expose real athlete data through a public service.

One-time setup in the target Google Cloud project:

1. Install and authenticate the Google Cloud CLI, select the billable project, and choose a region:

   ```sh
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   gcloud config set run/region us-central1
   ```

2. Enable the required services and create the Artifact Registry repository:

   ```sh
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com
   gcloud artifacts repositories create gridironpulse --repository-format=docker --location=us-central1
   ```

3. Create a Cloud SQL PostgreSQL instance, a database named `gridiron`, and a database user named `gridiron`. The user must be allowed to create/alter tables in the `public` schema so startup migrations can run. Record the instance connection name (`PROJECT_ID:REGION:INSTANCE`).

4. Create the Cloud Run runtime service account, grant it Cloud SQL access, and store the database user's password in Secret Manager as `gridiron-db-password`:

   ```sh
   gcloud iam service-accounts create gridironpulse-runtime
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:gridironpulse-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com" --role=roles/cloudsql.client
   gcloud secrets add-iam-policy-binding gridiron-db-password --member="serviceAccount:gridironpulse-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
   ```

   Create the secret and add its password value in Secret Manager before deploying. The Cloud Build identity also needs permission to push images, deploy Cloud Run, and act as the runtime service account.

5. Submit the build and deploy from the repository root, replacing the project, instance, and account values:

   ```sh
   gcloud builds submit --config cloudbuild.yaml --substitutions="_REGION=us-central1,_REPOSITORY=gridironpulse,_SERVICE=gridironpulse,_INSTANCE_CONNECTION_NAME=YOUR_PROJECT_ID:us-central1:YOUR_INSTANCE,_DATABASE=gridiron,_DB_USER=gridiron,_DB_PASSWORD_SECRET=gridiron-db-password,_RUNTIME_SERVICE_ACCOUNT=gridironpulse-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com" .
   ```

   The build uses `Dockerfile.cloud`, pushes the image to Artifact Registry, attaches the Cloud SQL instance to Cloud Run, sets the PostgreSQL connection variables, and injects `PGPASSWORD` from Secret Manager. The server applies database migrations before listening for requests.

6. To allow a specific Google identity to invoke the private service and access it locally:

   ```sh
   gcloud run services add-iam-policy-binding gridironpulse --region us-central1 --member="user:YOUR_GOOGLE_ACCOUNT_EMAIL" --role=roles/run.invoker
   gcloud run services proxy gridironpulse --region us-central1 --port 8080
   ```

   Then visit [http://localhost:8080](http://localhost:8080). For automatic deployments on repository pushes, configure a Cloud Build trigger for this repository in Google Cloud and select `cloudbuild.yaml`; trigger configuration and live service details are project-side, not stored here.

## API reference

All routes are under `/api`. The MVP currently uses a seeded demo athlete; authentication and multi-user isolation are not implemented.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Checks API/database connectivity. |
| `POST` | `/api/readiness` | Creates a readiness check-in. Body: `sleep_quality` and `fatigue_level` (1–10), `sore_muscles` (array), and `notes`. |
| `POST` | `/api/workouts` | Creates a workout. Body: `type` (`Lifting` or `Mobility/Rehab`), `duration_mins`, `intensity` (1–10), and `notes`. |
| `GET` | `/api/logs` | Returns readiness and workout history, each ordered newest first. |
| `PUT` | `/api/logs/:type/:id` | Updates an existing log; `:type` is `readiness` or `workout`. |
| `POST` | `/api/film-notes` | Creates a film note with opponent, session date/type (`Game` or `Practice`), general notes, and a `timestamps` array of `{ time, observation, correction }`. |
| `GET` | `/api/film-notes` | Lists notes ordered by session date descending. Optional `opponent` filters by opponent; optional `search` searches opponent and general notes. Both can be provided together. |
| `PUT` | `/api/film-notes/:id` | Updates a film note and its timestamped plays. |
| `DELETE` | `/api/film-notes/:id` | Deletes a film note. |

Example filtered request:

```text
GET /api/film-notes?opponent=Eagles&search=coverage
```

## AI tool usage and development workflow

AI tools supported development, with people responsible for requirements, review, and acceptance:

- **Gemini** assisted with architecture exploration, Sprint planning, SQL schema/migration and CI debugging, and code-review feedback.
- **GithubCopilot** assisted with React component scaffolding, refactoring, and development verification.
- **Human verification checkpoints** included checking generated changes against the feature requirements; building and linting the client; starting the stack with Docker Compose; checking API/database health; exercising recovery, workout, and film-note workflows; and testing automatic migrations against a fresh database volume. Test records were removed after verification.
- **Deployment checkpoint:** review Cloud Build substitutions, IAM permissions, Secret Manager usage, Cloud SQL connectivity, and private-by-default access in the target project before deploying. A successful local build or checked-in Cloud Build configuration alone does not establish that a live Cloud Run deployment is healthy.

AI output is treated as a draft: review code, commands, SQL changes, and security-sensitive configuration before merging or deploying.
