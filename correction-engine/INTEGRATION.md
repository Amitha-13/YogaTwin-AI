# Correction Engine (Real-Time Yoga Pose Correction)

This is the **Yoga Pose Correction AI** engine
([ShadyVoxx/yoga-pose-correction-ai](https://github.com/ShadyVoxx/yoga-pose-correction-ai)),
integrated as a standalone inference microservice for the YogaTwin AI app.

It runs a **real** TensorFlow.js step-classification model (74 step classes
across 13 Common Yoga Protocol poses, 89.1% validation accuracy) plus
joint-angle / posture-descriptor corrective feedback. It is **not** a mock —
the server logs `🧠 Local ML Model loaded successfully! (74 classes supported)`
on startup, and falls back to a mock only if the model artifacts are missing.

## What the app uses

The React app (`app1`) talks to this engine through the Vite dev proxy under
`/correction-api/*` (see `app1/vite.config.js`). Only these routes are used:

| Frontend path (proxied)              | Engine route                 | Purpose                              |
|--------------------------------------|------------------------------|--------------------------------------|
| `POST /correction-api/analyze-frame` | `POST /api/analyze-frame`    | Per-frame posture analysis           |
| `GET  /correction-api/poses`         | `GET  /api/poses`            | Pose + step catalogue                |
| `GET  /correction-api/ideal-landmarks/:step` | `GET /api/ideal-landmarks/:step` | Reference skeleton (optional) |
| `POST /correction-api/ollama-feedback` | `POST /api/ollama-feedback` | Optional rich LLM coaching (Ollama)  |

The engine's own bundled auth/session/practice routes are intentionally **not**
proxied, so they never conflict with the main Express backend on port 3001.

## Ports

- **3002** — this engine (configurable via `PORT` in `.env`)
- 3001 — main Express backend (unchanged)
- 5001 — FastAPI / data-collection backend (unchanged)

## Setup

```bash
cd correction-engine
./setup.sh          # installs dependencies
```

> **WSL note:** `@tensorflow/tfjs-node` ships a native `libtensorflow.so` that
> hangs when loaded from a Windows drive mount (`/mnt/c/...`). `setup.sh`
> detects this and places `node_modules` on the native Linux filesystem
> (`~/.yogatwin-correction-engine/node_modules`), symlinking it back into this
> directory. On a normal Linux/macOS checkout it just runs `npm install`.

## Where to run the engine: Windows vs WSL

The engine itself is plain Node + Express and the model is portable. The only
platform-sensitive piece is `@tensorflow/tfjs-node`'s native binding.

**Tested compatibility (this machine, 2026-10):**

| Target | Result |
|--------|--------|
| **WSL (Linux)** | ✅ Works. Prebuilt Linux N-API binary (`napi-v8`) loads; model loads with 74 classes; `/api/poses` → 200. |
| **Windows, Node v24.4.1** | ❌ `npm install` fails. tfjs-node 4.22 publishes **no prebuilt Windows addon** (`.../napi-v8/4.22.0/CPU-windows*.tar.gz` → HTTP 404), so node-pre-gyp falls back to a **source build** via node-gyp, which needs **Visual Studio Build Tools + Python**. Those are not installed, so `cl.exe`/MSBuild is missing and the build errors out. |

**Decision:** run the engine **in WSL** and let the Windows frontend reach it.
WSL2 forwards Windows `localhost` into the distro, so with the engine on
WSL `:3002`, the Windows app reaches it unchanged at `http://127.0.0.1:3002`
(the Vite proxy's default `CORRECTION_ENGINE_URL`). Verified: from Windows
PowerShell, `http://localhost:3002/api/poses` → **200**.

### Running the engine natively on Windows (optional, if you need it)

`setup.ps1` performs a Windows-native install (no Linux binaries reused) and
verifies the model loads. It will **only succeed** if the native binding can be
built, which currently requires either:

- **Node.js 20.x or 22.x LTS** (so npm can try the prebuilt path — but note the
  Windows prebuilt is 404 for 4.22, so a build is still attempted), **and**
- **Visual Studio Build Tools** (C++ workload) **+ Python 3** for node-gyp.

```powershell
cd C:\Users\<you>\Desktop\YogaTwin-AI\correction-engine
.\setup.ps1
```

If `setup.ps1` reports a node-gyp / MSBuild / `cl.exe` error, install the build
tools (or just keep the engine in WSL, which already works).

## Run (WSL — recommended)

```bash
cd correction-engine
npm run dev         # or: node server.js   (listens on port 3002)
```

Expected startup output:

```
🧘 Yoga Pose Coach (Real-Time Step Verification)
   HTTP  → http://localhost:3002
   Model config: 117-feature input (IMU zero-filled), ... val_acc 89.1%
🧠 Local ML Model loaded successfully! (74 classes supported)
```

(A `PostgreSQL not reachable` warning is harmless — the correction routes do
not use the database.)

## Optional: Ollama coaching

The core correction feature works **without** Ollama. For richer natural-language
coaching, install [Ollama](https://ollama.com), then:

```bash
ollama serve
ollama pull llama3.2
```

Configure `OLLAMA_HOST` / `OLLAMA_MODEL` in `.env`. If Ollama is unavailable,
`/api/ollama-feedback` fails gracefully and the model-based corrections continue.

## Supported poses

Standing: Tadasana, Vrksasana, Pada-hastasana, Ardha Cakrasana,
Ardha Katichakrasana, Trikonasana, Parivritta Trikonasana ·
Sitting: Ardha Ustrasana, Vakrasana · Prone: Makarasana, Bhujangasana ·
Supine: Ardha Halasana, Savasana.

The app's **Wind-Relieving Pose (Pavanamukthasana)** has no trained equivalent,
so the practice screen shows a clear "Correction Unavailable" state for it
(the rest of the practice flow still works).
