# Gridiron

**GridironSync** is a centralized recovery tracking and film study platform built for high school, college, and semi-pro football players. By unifying physical readiness logs with structured opponent film notes, it helps athletes and trainers spot how daily training loads impact on-field performance.

---

## Why This Matters

Football players currently juggle scattered spiral notebooks, generic fitness trackers, and separate video platforms to manage their preparation. Separating physical recovery from mental prep makes it difficult to recognize overtraining early or keep opponent scouting organized. This application consolidates both workflows into a single, athlete-focused hub—backed by AI insights that turn raw daily logs into actionable recovery routines and concise play summaries.

---

## Key Features

* **Daily Readiness & Soreness Log:** Quick check-ins to record sleep quality, muscle soreness, fatigue levels, and overall physical readiness.
* **Structured Film Study & Play Notebook:** Organized workspace to log opponent tendencies, defensive/offensive schemes, and timestamped play notes.
* **Recovery Trend Dashboard:** Interactive visualizations tracking soreness, workload, and readiness scores over weeks and seasons.
* **Workout & Mobility Logger:** Dedicated tracking for lifting sessions, conditioning workloads, and targeted mobility work.
* **AI Recovery & Film Assistant:** Analyzes soreness and workout trends to recommend personalized mobility routines, while automatically summarizing and tagging raw film study notes.

---

## Technology Stack

* **Frontend:** React
* **Backend:** Node.js, Express (REST API)
* **Database:** PostgreSQL
* **AI Integration:** LLM API Integration (Recovery analysis & automated note summarization)
* **DevOps & Deployment:** Docker, Docker Compose, GitHub Actions (CI/CD), Google Cloud

---

## Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v18+ recommended)
* [Docker](https://www.docker.com/) and Docker Compose
* A valid API key for the AI assistant integration

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
   cd your-repo-name
   ```

2. **Configure local environment variables:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` to set the PostgreSQL database name, user, and password. This file is ignored by Git; `.env.example` contains local development defaults.

3. **Start the local development stack:**
   ```bash
   docker compose up --build
   ```

   The React app is available at [http://localhost:5173](http://localhost:5173), the Express API at [http://localhost:3000](http://localhost:3000), and PostgreSQL on port `5432`. Express checks its database connection before listening; `/api/health` also verifies the connection.

   PostgreSQL automatically applies SQL files in `server/migrations` when initializing a new data volume. Existing volumes are preserved and do not rerun initialization scripts. Express starts only after PostgreSQL passes its health check.

   Recovery endpoints are available under `/api`:
   * `POST /readiness` accepts `sleep_quality` and `fatigue_level` (1-10), `sore_muscles` (string array), and `notes` (string).
   * `POST /workouts` accepts `type`, `duration_mins`, `intensity` (1-10), and `notes`. Workout types are `lifting`, `conditioning`, `mobility`, `practice`, `recovery`, or `other`.
   * `GET /logs` returns `readiness_logs` and `workouts`, newest first.
   * `PUT /logs/readiness/:id` and `PUT /logs/workout/:id` update entries using the corresponding POST body.

   These development routes use logical user ID `1`, mapped to a seeded UUID because the database uses UUID primary keys. Invalid requests return `400`; database or server errors return `500`. For an existing database volume, apply the new recovery migration once with `docker compose exec -T db psql -U gridiron -d gridiron -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/002_add_recovery_api_fields.sql` (adjust the user and database for your `.env`).

4. **Stop the stack:**
   ```bash
   docker compose down
   ```

   PostgreSQL data is kept in a named volume. To remove it as well, run `docker compose down -v`.
