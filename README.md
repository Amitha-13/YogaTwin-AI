# YogaTwin AI

## Digital Twin and AI-Powered Yoga Assistant System

YogaTwin AI is a web-based yoga assistance system designed to support yoga practice through real-time yoga asana pose estimation, posture analysis, and corrective feedback.

The system combines a React-based web application, computer-vision-based pose estimation, backend services, PostgreSQL database storage, and body-sensor data collection.

The project has two major user workflows:

- **Data Collection** – Used to collect and organize yoga practice data from video and body-sensor inputs.
- **Yoga Practice** – Used to perform yoga asanas while receiving pose-related information and corrective feedback.

---

# 1. Project Objective

The objective of YogaTwin AI is to develop a technology-assisted yoga practice system that can:

1. Allow users to access the yoga application through a web interface.
2. Collect structured yoga practice data.
3. Capture yoga practice video through a camera.
4. Process human body landmarks using computer vision.
5. Collect body-sensor information.
6. Store user and practice-session information.
7. Integrate machine-learning models for yoga pose analysis.
8. Provide corrective feedback to users during yoga practice.
9. Maintain organized data that can be used for further model development and evaluation.

---

# 2. High-Level System

The complete system can be understood as several layers.

```text
                         USER
                           |
                           v
                +----------------------+
                |   YogaTwin AI Web    |
                |      Application     |
                |                      |
                |  React + Vite        |
                +----------+-----------+
                           |
              +------------+------------+
              |                         |
              v                         v
      Camera / Video              Body Sensors
              |                         |
              v                         v
       MediaPipe Pose             Python Service
       Landmark Detection          Sensor Data
              |                         |
              +------------+------------+
                           |
                           v
                   Feature Processing
                           |
                           v
                     React UI
```

---

# 3. Setup & Run

The project has four parts that run as separate services:

| Service | Tech | Port | Where it runs |
|---------|------|------|---------------|
| Frontend | React + Vite | 5173 | Windows (or WSL) |
| App backend | Node.js + Express | 3001 | Windows (needs PostgreSQL) |
| Data-collection backend | Python + FastAPI | 5001 | Windows / WSL |
| Correction engine | Node.js + TensorFlow.js | 3002 | **WSL** (see note) |

PostgreSQL 18 must be installed and running, with a `yoga_app` database created
from `server/schema.sql`.

## Prerequisites

- Node.js (LTS 20.x or 22.x recommended) and npm
- PostgreSQL 18 (running on `localhost:5432`)
- Python 3.10+ (only for the data-collection backend)

## 1. Database (one-time)

Create the database and load the schema (run in a shell where `psql` is on PATH):

```bash
psql -U postgres -c "CREATE DATABASE yoga_app;"
psql -U postgres -d yoga_app -f server/schema.sql
```

## 2. App backend (Express, port 3001)

```bash
cd server
cp .env.example .env        # then edit DB_* and JWT_SECRET to match your PostgreSQL
npm install
node index.js               # → "Yoga app backend listening on port 3001"
```

Required `server/.env` variables:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=yoga_app
DB_USER=postgres
DB_PASSWORD=<your_postgres_password>
JWT_SECRET=<a_long_random_secret>
PORT=3001
```

## 3. Frontend (React + Vite, port 5173)

```bash
cd app1
npm install
npm run dev                 # → http://localhost:5173
```

Optional `app1/.env` (defaults already work for local dev):

```
VITE_CORRECTION_API_BASE=/correction-api
CORRECTION_ENGINE_URL=http://127.0.0.1:3002
```

## 4. Correction engine (TensorFlow.js, port 3002) — run in WSL

The engine's `@tensorflow/tfjs-node` native binding has **no prebuilt Windows
addon** for this version, so a Windows install would require Visual Studio
Build Tools. The engine runs cleanly in **WSL**, and WSL2 forwards Windows
`localhost` into the distro, so the Windows frontend reaches it unchanged at
`http://127.0.0.1:3002`.

```bash
cd correction-engine
./setup.sh                  # one-time: installs deps (handles the WSL native-FS binding)
node server.js              # → "Local ML Model loaded successfully! (74 classes supported)"
```

> To attempt a native Windows install instead, run `.\setup.ps1` from Windows
> PowerShell (requires VS Build Tools + Python). See
> `correction-engine/INTEGRATION.md` for details.

## 5. Data-collection backend (FastAPI, port 5001) — optional

```bash
cd backend
pip install -r requirements.txt
python server.py
```

## Quick start (all services)

Open four terminals:

```bash
# Terminal 1 — app backend
cd server && node index.js

# Terminal 2 — correction engine (WSL)
cd correction-engine && node server.js

# Terminal 3 — frontend
cd app1 && npm run dev

# Terminal 4 — data-collection backend (optional)
cd backend && python server.py
```

Then open **http://localhost:5173**, sign up at `/app/signup`, and start a
practice session at `/app/practice` to see live pose correction.
