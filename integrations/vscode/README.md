# VS Code integration
A VS Code extension can target the local Leveling Core endpoints:
GET /api/health
POST /api/chat
GET /api/workspace/tree
GET/POST /api/workspace/file
POST /api/workspace/run
The endpoint is intentionally local-first. Do not expose unrestricted command execution publicly.
