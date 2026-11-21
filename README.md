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

4. **Apply the database migration** (using values from `.env`):
   ```bash
   docker compose exec -T db psql -U gridiron -d gridiron -v ON_ERROR_STOP=1 -f /migrations/001_create_core_tables.sql
   ```

   Replace the `-U` user and `-d` database values if you changed them in `.env`.

5. **Stop the stack:**
   ```bash
   docker compose down
   ```

   PostgreSQL data is kept in a named volume. To remove it as well, run `docker compose down -v`.
