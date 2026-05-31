# ArchForgeX — Software Generation Compiler Pipeline

ArchForgeX is a high-performance, deterministic software architecture compiler pipeline. It converts natural-language product specs into production-grade systems across a series of structured stages, integrated with an auto-repair engine, quality metric scoring, and a multi-provider fallback infrastructure.

---

## 🚀 The Compiler Subsystems

The compiler is divided into five main subsystems that run sequentially to design, validate, and construct code:
1. **Strict Data Type Structs**: Zod validation schemas for all stage inputs/outputs.
2. **Deterministic Multi-Stage Pipeline Engine**: Progression from Intent -> DB design -> ERD -> OpenAPI spec -> UI.
3. **Programmatic Cross-Layer Consistency Validator**: Auditing and checking system coherence across the pipeline layers.
4. **Surgical Self-Repair Engine**: Automated, iterative repair loops when validation fails.
5. **Cost, Latency & Performance Metrics Logger**: Full telemetry monitoring and cost tracking.

---

## 🔑 Automated API Key Fallback switching

To guarantee 100% compiler pipeline uptime, ArchForgeX features an **automated API key switcher**. If the primary API key hits a rate limit or quota exhaustion (HTTP `429` / `RESOURCE_EXHAUSTED`), the server intercepts the failure, switches active keys, and seamlessly retries the operation.

- **Primary Provider**: Google Gemini API via `@google/genai` (by default).
- **Secondary / Backup Provider**: Automatically detected backup token (such as NVIDIA NIM's API, starting with `AQ.Ab`).
- **Dynamic Transition**: Occurs transparently in the middle of a compilation pipeline stage without erroring out.

---

## 🛠️ Configuration

Create or modify your `.env` file in the root of the project:

```env
# Required: Your primary Google Gemini AI API key
GEMINI_API_KEY=AIzaSy...

# Optional: Server port (default: 3000)
PORT=3000

# Configurable model
MODEL_ID=gemini-2.5-flash

# Optional: Backup API Key (used dynamically on rate limit / quota exhaustion)
BACKUP_API_KEY=AQ.Ab8RN...
```

---

## 🔍 Debugging & Verification Endpoints

You can verify and test key switching in real time using these dedicated debug routes:

### 1. Check Key Status (`GET /api/debug-key-switch`)
Returns the current active, primary, and backup API keys (safely masked to prevent leakages) along with details about whether backup is currently in use.
```json
{
  "success": true,
  "primaryKey": "AIzaSyC6...4pW3q20",
  "backupKey": "AQ.Ab8RN...tFkU2sRQ",
  "activeKey": "AIzaSyC6...4pW3q20",
  "usingBackup": false,
  "nvidiaDetectedForActive": false
}
```

### 2. Simulate Rate Limit Fallback (`POST /api/simulate-rate-limit`)
Manually triggers a simulated rate limit error (`429`) to force the server's error handler to run, swap active keys, re-instantiate clients, and report the results:
```json
{
  "success": true,
  "message": "Simulated rate limit successfully triggered API key fallback!",
  "activeKey": "AQ.Ab8RN...tFkU2sRQ"
}
```

---

## 💻 Getting Started

Run the compiler locally:

```bash
# Start in production mode
npm start

# Start in development watch mode
npm run dev
```
