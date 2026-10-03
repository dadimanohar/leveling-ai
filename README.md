# leveling v0.12

Local-first AI workspace for chat, model routing, agentic coding, workflow automation and media orchestration.

## Implemented
- Chat, Automations, Build, Build Agent, Skills and Media Studio workspaces.
- 30 provider presets and one unified routing contract.
- Priority routing and automatic failover for common rate-limit, timeout/context and 5xx failures.
- AES-256-GCM encrypted API-key storage using LEVELING_MASTER_KEY.
- Workspace file read/write and a strict command allowlist.
- IDE-like file tree, editor, agent log, terminal hook, preview/export affordances.
- Automation workflow canvas with schedule, retries and delivery controls.
- 20-second maximum clip model for scene-based media orchestration.
- Vitest checks plus CI build and source ZIP packaging.

## Local run
Copy .env.example to .env, set a strong LEVELING_MASTER_KEY, then:
npm install
npm run dev

Open http://localhost:5173.

## Reality check
This repo is a working platform scaffold, not a claim that a small local model equals a frontier model. Real pretraining/SFT/RL requires large datasets, compute and evaluation infrastructure. The local fallback is deliberately deterministic; configured external models provide live inference.

## Security
Run the workspace backend against a dedicated project folder. Do not expose the server directly to the public internet without authentication, sandboxing and OS-level isolation.