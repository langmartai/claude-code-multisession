# Claude Code Multisession

**One prompt to control all your Claude Code sessions across every project.**

Stop switching terminals. Stop losing context. One session sees everything — your running agents, your costs, your work across every project — and routes new tasks to the right place automatically.

[![Discord](https://img.shields.io/discord/1475647234669543558?logo=discord&label=Discord&color=5865F2)](https://discord.gg/xb2BNnk4)

## Install

```bash
npm install -g lm-assist
```

The postinstall script automatically starts services, installs statusline, and this plugin. The current lm-assist line is v0.2.1; this plugin works against lm-assist >= 0.2.x.

**Open a new Claude Code session** and type `/sessions` to verify.

### Plugin Marketplace

Add the marketplace once — then install any combination of plugins:

```
/plugin marketplace add langmartai/lm-assist
```

| Install command | What you get |
|----------------|-------------|
| `/plugin install claude-code-multisession@langmartai` | Skills (observe, route) + commands (`/projects`, `/sessions`, `/summary`, `/run`) — cross-project session management |
| `/plugin install claude-code-webui@langmartai` | Skill (dashboard) + commands (`/web`, `/web-sessions`, `/web-tasks`) — web dashboard access |
| `/plugin install lm-assist@langmartai` | Commands (`/assist`, `/assist-setup`, `/assist-status`, `/assist-search`, `/assist-logs`, `/assist-mcp-logs`) — setup and diagnostics |

Install all three for the full experience, or pick what you need.

## What It Does

You're working on Project A. You say "fix the auth bug in Project B." Claude Code Multisession:

1. Checks your current session — is this about Project A? No.
2. Finds Project B's sessions — is there one that already worked on auth? Yes.
3. Checks if it's running:
   - **Running** → queues your prompt. When it finishes, your auth fix runs next with full context.
   - **Idle** → resumes that session with your prompt. It picks up right where it left off.
   - **No relevant session** → creates a new execution on Project B and runs your prompt there.

You never left Project A. You never opened another terminal.

## Four Commands

### `/projects` — All your projects at a glance

```
Projects (4)
───────────────────────────────────────────────────────────────────────────────────────────────
   Project                    Sessions      Cost  Summary
───────────────────────────────────────────────────────────────────────────────────────────────
 * my-backend                       42    $67.70  Node.js REST API with Express, PostgreSQL
   my-frontend                      28    $34.20  React dashboard with TypeScript
   my-infra                         15    $12.40  Terraform + CI/CD pipeline
   my-shared-lib                     8     $5.10  Shared utility packages
───────────────────────────────────────────────────────────────────────────────────────────────
   Total                            93   $119.40

 * = current project
```

### `/sessions` — See everything

```
Sessions (3 running, 127 total)
───────────────────────────────────────────────────────
Status  Name                 Project        Cost   Turns
───────────────────────────────────────────────────────
[RUN]   api-refactor         my-backend     $45.20   312
[RUN]   dashboard-redesign   my-frontend    $23.10   185
        auth-module-review   my-backend     $12.50    95
        deploy-pipeline      my-infra        $8.30    42
───────────────────────────────────────────────────────
Total cost: $89.10
```

All projects. All sessions. Running status. Costs. One view.

### `/summary` — Know what this session is doing

```
Session Summary
═══════════════
Name:    api-refactor
Project: my-backend
Turns:   312 | Cost: $45.20
Status:  in progress

What this session is about:
  Refactoring the REST API to use dependency injection.

What was accomplished:
  • Migrated 12 route files to new pattern
  • Added integration tests for auth endpoints
  • Fixed 3 circular dependency issues

Current state:
  Working on the database layer refactor.
```

The summary is the anchor. When you say something, Claude Code Multisession checks: does this belong here? If yes — just do it. If no — route it.

### `/run <prompt>` — Execute anywhere

```
> /run review the frontend components for accessibility

Checking running executions...
  dashboard-redesign is running on my-frontend (T:185, $23.10)

Recommendation: QUEUE
  This session is already working on the frontend.
  Queued as normal priority. Will process when current work completes.
```

## How Routing Works

You don't configure routing. It learns.

**First time** you mention "database migration":
```
Checking project summaries... → found in my-backend
Checking session summaries... → found auth-module-review session
4 API calls to route.
```

**Second time** you mention "database migration":
```
Learning signal: database migration → my-backend (2x)
1 API call. Instant route.
```

**After a week**, most of your vocabulary is mapped. Routing is instant for everything you regularly work on.

### The Decision Flow

| Your prompt | Current project | What happens |
|-------------|----------------|--------------|
| "fix the build error" | my-backend | **STAY** — clearly about this project |
| "update the login page" | my-backend | **ROUTE** → my-frontend, resume dashboard-redesign |
| "check if prod is healthy" | any | **LOCAL** — simple curl/ssh, no switch needed |
| "add rate limiting to the API" | my-frontend | **ROUTE** → my-backend, find relevant session |
| "deploy the latest changes" | my-backend | **RESUME** → deploy-pipeline session |
| "refactor the auth module" | my-backend | **STAY** — same project, auth-module-review session |

### What Happens When Sessions Are Busy

If the target session is running:

```
dashboard-redesign is running (T:185, $23.10, 12m elapsed)

Your prompt has been queued:
  [normal] review frontend components for accessibility
  Context: The session is currently redesigning the dashboard layout.
           After that completes, it should review all new components
           for WCAG 2.1 AA compliance.

Queue for dashboard-redesign (2 pending):
  [high]   fix the responsive breakpoint on mobile
  [normal] review frontend components for accessibility
```

Queued prompts include:
- **Original intent** — what you said
- **Formatted prompt** — expanded into actionable instructions
- **Context hint** — what the session should know before starting
- **Priority** — high/normal/low (high processes first)
- **Source** — which session/project queued it

Queued work survives hiccups, too. If the target session stalls on a server or network error, lm-assist auto-resumes it; if it hits a model usage limit, lm-assist switches it to an available model (verified via `/model`) so the queue keeps draining. `GET /monitor/stalls` shows what was rescued and how.

## Session Intelligence

Claude Code Multisession gets smarter the more you use it.

### Session Summaries

Every session gets an LLM-generated summary describing what it does, what was accomplished, and its current state. Summaries update incrementally — only new turns are read.

```
api-refactor (312 turns):
  Refactoring REST API to dependency injection pattern. 12 route files
  migrated. Integration tests added. Working on database layer.

dashboard-redesign (185 turns):
  Redesigning frontend dashboard with new component library. Header
  and sidebar complete. Working on data visualization panels.
```

### Project Summaries

Each project gets a comprehensive reference generated by an agent that explores the actual codebase — not just CLAUDE.md but scripts, configs, package.json, deployment files.

```
my-backend:
  Node.js REST API with Express, PostgreSQL, Redis.
  Services: npm start (port 3000), npm test
  Deploy: docker-compose up, CI/CD via GitHub Actions
  Areas: auth, billing, users, notifications
```

### Full-Text Prompt Search

Summaries compress; search remembers. Every user prompt on the node is indexed for full-text search (bm25 ranking, CJK-aware), so the session that already worked on a topic can be found by what was actually said — not just by what a summary kept:

```
> which session set up the webhook retries?

Full-text search over indexed prompts...
  payment-webhooks (my-backend) — "add exponential backoff to webhook retries"
  api-refactor    (my-backend) — "move webhook handler to the queue worker"

Best match: payment-webhooks (idle, 74 turns, $9.80)
```

Prompts in Chinese, Japanese, or Korean are indexed and matched the same way.

### Auto-Learning

Keywords, commands, and routing patterns accumulate with frequency counts:

```
my-backend:
  Frequently mentioned: database migration(5x), auth module(3x), rate limiting(2x)
  Commands used: npm test(8x), docker-compose up(3x)
  Routing: "auth" → api-refactor session, "deploy" → deploy-pipeline session
```

After enough interactions, routing skips the deep scan entirely — signals already know the answer.

## Walkthroughs

Three things you can ask, end to end. (All sample output is fictional.)

### "Show me the subagents this session spawned"

The **observe** skill answers with each subagent's real type — since lm-assist v0.2.1 subagents report what they actually are, not a generic label:

```
> show subagents

Subagents for api-refactor (4):
  Explore          "map the current DI wiring"            done   $0.42
  Explore          "find circular imports in services/"   done   $0.31
  code-reviewer    "review the migrated route files"      done   $1.10
  general-purpose  "update the changelog"                 running
```

The same real types show up in the web dashboard's Agents view.

### "How much runway do I have?"

Dollar costs (`/projects`, `/sessions`) tell you what you spent; the Claude Code usage windows tell you what you have left. `GET /claude-code/usage` reports both the 5-hour and 7-day windows:

```
> how close am I to my usage limit?

Claude Code usage:
  5-hour window:  62% used — resets 16:00
  7-day window:   31% used — resets Mon 09:00

Plenty of 7-day runway. If you're planning a heavy run, starting it
after 16:00 opens a fresh 5-hour window.
```

Routing can use this the same way it uses cost: heavy work goes where the runway is.

### "The session stalled — did my queued prompt die?"

No. Stalled sessions auto-resume, so queued prompts still get processed:

```
> /run migrate the audit tables        (queued behind api-refactor)

... later ...

Stall monitor (GET /monitor/stalls):
  api-refactor  14:32  stalled (API 529 overloaded)  -> auto-resumed 14:33
  api-refactor  15:01  model usage limit             -> verified fallback model

Queue for api-refactor:
  [normal] migrate the audit tables    processed 15:24
```

## Architecture

Claude Code Multisession is powered by [lm-assist](https://github.com/langmartai/lm-assist), which provides:

- **860+ REST API endpoints** for session management, monitoring, and control
- **Next.js web dashboard** with 15 insight views per session
- **Real-time execution tracking** via SSE streams
- **Web terminal** access to running Claude Code sessions from any browser

<a href="https://raw.githubusercontent.com/langmartai/lm-assist/main/docs/architecture-observability.svg"><img src="https://raw.githubusercontent.com/langmartai/lm-assist/main/docs/architecture-observability.svg" alt="Architecture" width="700"></a>

## Skills & Commands

| Type | Name | What it does |
|------|------|-------------|
| Skill | **observe** | Auto-triggers on "what's running?", "session costs", "show subagents" — full observability, with real subagent types |
| Skill | **route** | Auto-triggers when prompt mentions another project — evaluates where work belongs |
| Command | `/projects` | All projects with session counts, costs, summaries |
| Command | `/sessions` | Quick session list with costs and status |
| Command | `/summary` | Summarize current session, generate display name |
| Command | `/run` | Execute an agent with pre-flight checks |

## Web Dashboard

Open `http://localhost:3848` for the full web UI with 15 insight views per session:

Chat · Thinking · Agents · Skills · Commands · Tasks · Plans · Team · Files · Git · Console · FlowGraph · Meta · JSON · DB

(Console is hidden on Windows; FlowGraph is experiment-gated.)

Beyond per-session views, the dashboard ships fleet-wide pages — session-dashboard, terminal-dashboard, search, missions, mission-graph, scheduler, memory, backlog, cowork, and more.

Access from your phone, tablet, or any device on your network. `:3848` is the production web port; a from-source dev build serves on `:3948`.

## Requirements

- Node.js >= 20.9
- Claude Code
- [lm-assist](https://github.com/langmartai/lm-assist) >= 0.2.x (installed automatically as dependency; current line is v0.2.1)

## License

[MIT](LICENSE)

The underlying [lm-assist](https://github.com/langmartai/lm-assist) platform is separately licensed AGPL-3.0-or-later.
