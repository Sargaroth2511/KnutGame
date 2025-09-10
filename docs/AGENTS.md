# Multi-Agent Conventions (Codex CLI + File Bus)

This repo supports running multiple Codex CLI shells that coordinate via a file-based message bus.

Roles (suggested)
- `supervisor` — assigns work, aggregates status
- `tester` — runs server/client tests and reports
- `feature-dev` — implements features
- `physics` — performance/physics analysis
- `refactor` — small, safe refactors

Directories
- `agent_bus/queue` — new messages (JSON)
- `agent_bus/processed` — messages after delivery
- `agent_bus/inbox/<agent>` — delivered copies for each agent
- `agent_tasks/<role>/...` — optional task briefs
- `qa_reports/` — physics/perf notes
- `task_summaries/` — daily/iteration summaries

Bus Message Schema
{ "id": "...", "ts": "ISO", "from": "agent", "to": "agent|*|[agents]", "type": "string", "payload": { } }

Tools
- `tools/agent-bus.js`
  - `node tools/agent-bus.js watch --agent tester`
  - `node tools/agent-bus.js send --from supervisor --to tester --type ready_for_test --payload '{"notify":["supervisor","feature-dev"]}'`
- `tools/agent-dispatcher.js`
  - Reacts to messages with role-specific actions
  - `AGENT=tester node tools/agent-dispatcher.js`
  - Tester defaults: runs `dotnet test` and `npm -C src/KnutGame.Client run -s test:run` on `ready_for_test|request_test`, then sends `test_results`.
- `tools/agent-emit-on-change.js`
  - Emits bus messages when files change (no external deps):
  - `node tools/agent-emit-on-change.js --agent feature-dev --to tester --type changed --paths src/KnutGame.Client/src src/KnutGame.Server`

Quick Start (5 shells)
1. Supervisor: `AGENT=supervisor node tools/agent-bus.js watch`
2. Tester: `AGENT=tester node tools/agent-dispatcher.js`
3. Feature Dev: `AGENT=feature-dev node tools/agent-bus.js watch`
4. Physics: `AGENT=physics node tools/agent-bus.js watch`
5. Refactor: `AGENT=refactor node tools/agent-bus.js watch`

Example Flow
- Supervisor → Feature Dev: `assign` message with story details
- Feature Dev → Tester: `ready_for_test` message
- Tester runs tests automatically and replies with `test_results`
- Optional: Physics/Refactor receive `perf_review_request` / `refactor_request` and respond

Notes
- This is a minimal bus; extend message types as needed.
- Commands in `agent-dispatcher.js` are whitelisted by type to avoid executing arbitrary input.
