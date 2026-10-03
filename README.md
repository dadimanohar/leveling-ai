# leveling v0.12.0

Local-first AI workspace for chat, model routing, automations, agent/build mode, media jobs, connectors, voice, and guarded self-training.

Core guarantees:
- One global ModelRouter is used by chat, agents, skills, building tools, and automations.
- External API keys are encrypted at rest.
- Retryable provider failures advance to the next enabled route without dropping the conversation.
- Local file writes are confined to a configured workspace and shell commands are allowlisted.
- Self-training uses provenance, deduplication, quality gating, and explicit training jobs instead of blindly changing weights from scraped web text.
- Video clips are validated to a maximum of 20 seconds.
- Tauri 2 scaffolding is included for desktop packaging.

Reality constraint: changing context-window numbers or source-code parameters cannot make a laptop-scale model become GPT-4/GPT-6-class. High capability comes from model scale, data, training, alignment, inference, tools, and hardware. This project therefore separates the local model path from the external-provider path.

Run:
1. Node.js 20+
2. npm install
3. copy .env.example to .env
4. set MASTER_KEY and, for a local default route, SYSTEM_LLM_BASE_URL and SYSTEM_LLM_MODEL
5. npm run dev

Test with npm test, npm run typecheck, and npm run build.
