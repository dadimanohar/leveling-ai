# leveling v0.12.0

Local-first AI workbench for chat, model routing, agentic coding, workflow automation and media orchestration.

## Included
- Chat with text, tap-to-talk browser voice input and text-to-speech.
- Automations with persistent daily schedules, AI-news ingestion, email delivery, connector hooks and test runs.
- Build and Build Agent workspaces with explorer, editor, plan, diff, logs, test execution and ZIP export.
- Skills runner sharing the same model router.
- Media Studio for storyboards with a strict 20-second-per-clip manifest.
- 31 external model presets with priority routing and failover.
- AES-256-GCM encrypted API-key storage behind a local master key.
- Workspace path protection and a shell-command allowlist.
- Optional SFT + preference-training scaffold under training/.
- Electron packaging configuration for Windows/macOS/Linux.
- Capacitor mobile configuration scaffold under mobile/.
- CI that installs, type-checks, tests, builds, smoke-tests and packages the source ZIP.

## Run locally
1. Copy .env.example to .env.
2. Set a strong LEVELING_MASTER_KEY.
3. Install Node.js 22+.
4. Run npm install.
5. Run npm run dev.
6. Open http://localhost:5173.

## Important model-quality reality
The application source does not contain frontier-model weights. Source code alone cannot make a laptop model equivalent to GPT-4 or another frontier model. The training stack accepts a user-supplied base model and provides dataset curation, SFT, preference optimization, evaluation gates and rollback-oriented workflow.

## Self-training
Do not ingest arbitrary Internet pages directly into training. The sample curation pipeline supports source allowlists, provenance, deduplication and quality scoring. Promote a checkpoint only after evaluation. Keep previous checkpoints so a regression can be rolled back.

## Connectors
Email can be enabled through SMTP. YouTube, Instagram and X are guarded hooks; they require correct OAuth/access credentials and appropriate publishing scopes. The runtime never reports a publish as successful when the required credential/configuration is absent.

## Desktop/mobile
Electron packaging is configured for Windows, macOS and Linux. Capacitor scaffolding is included for Android/iOS clients. Native code signing, provisioning and app-store credentials are platform-specific and must be supplied by the developer.

## Security
Run the workspace server locally or behind authentication. The build agent can write files only inside LEVELING_WORKSPACE and can execute only commands from an explicit allowlist. Do not expose unrestricted local command execution to the public Internet.

## UX reference
The interface uses an agent-first workbench pattern inspired by the interaction model documented for Google Antigravity: persistent workspace, editor, terminal-adjacent actions, plan/diff/verification surfaces and agent-driven task execution. It does not copy Antigravity branding or source code.
