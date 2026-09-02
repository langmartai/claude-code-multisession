---
description: "Use when the user's prompt mentions a project name, service, API endpoint, feature, or codebase area that might belong to a different project than the current one. Triggers when prompt references features from other known projects, or when the prompt seems unrelated to the current project's domain. Evaluates whether to handle locally, dispatch to the right project, or queue for an existing session."
allowed-tools: Bash
---

# Session & Project Router

Evaluate whether the user's prompt belongs to the current session/project or should be routed elsewhere.

**API base:** `http://localhost:3100` (prod). When `devModeEnabled` is set in `~/.claude-code-config.json`, talk to the dev API on `:3200` instead — the same rule the plugin's scripts and hooks use. Every endpoint except `/health` requires the local API token from `~/.lm-assist/api-token`, sent as an `x-api-key` header.

Set these once and reuse them in every call below:

```bash
LM_PORT=$(python3 -c "import json,os;print(3200 if json.load(open(os.path.expanduser('~/.claude-code-config.json'))).get('devModeEnabled') else 3100)" 2>/dev/null || echo 3100)
LM_API_KEY=$(cat "${LM_ASSIST_DATA_DIR:-$HOME/.lm-assist}/api-token" 2>/dev/null)
```

## Pre-flight: Ensure lm-assist is running

Before routing, check if the API is reachable. If not, auto-install and start.

```bash
curl -s --max-time 2 "http://localhost:$LM_PORT/health" | python3 -c "
import sys,json
try:
    d = json.load(sys.stdin)
    if d.get('success'): print('API: healthy')
    else: print('API: unhealthy')
except: print('API: not running')
"
```

If not running:
```bash
npm list -g lm-assist --depth=0 2>/dev/null || npm install -g lm-assist
lm-assist start
# dev mode (devModeEnabled=true, :3200) is served from the lm-assist repo instead: ./core.sh start
```

## When This Skill Triggers

This skill activates when the user's prompt:
- Mentions a project name that isn't the current project
- References features, APIs, or code areas belonging to another project
- Seems unrelated to the current project's domain
- Mentions "deploy to staging", "restart the gateway", "update the docs site" etc.

## Decision Flow

```
User prompt arrives
       |
       v
1. Is this clearly about the CURRENT project?
   → YES: Skip routing. Let the normal flow handle it.
   → UNSURE/NO: Continue to step 2.
       |
       v
2. Could this be done IN the current session even though
   it touches another project? (simple cross-project task)
   → YES: Handle locally. e.g., "check if lm-assist is running on the
     staging box" can be done from anywhere with ssh/curl.
   → NO: Continue to step 3.
       |
       v
3. Which project does this belong to?
   → Check project summaries: GET /projects/summaries
   → Match prompt against project descriptions, areas, features
       |
       v
4. Find the right session in that project.
   → Check session summaries: GET /sessions/summaries
   → Filter by target project's path
   → Find relevant session by work content
       |
       v
5. Route decision:
   → RESUME: idle session with relevant context
   → QUEUE: running session, add to its queue
   → FORK: session relevant but should stay clean
   → NEW: no matching session, start fresh in target project
```

## Step 0: Know What THIS Session Is Doing

**Before ANY routing, understand the current session.** This is the anchor that prevents wrong routing.

```bash
# Check current session summary
curl -s --max-time 2 -H "x-api-key: $LM_API_KEY" "http://localhost:$LM_PORT/sessions/$CLAUDE_CODE_SESSION_ID/summary" | python3 -c "
import sys,json
d = json.load(sys.stdin).get('data')
if d:
    print(f'This session: {d.get(\"displayName\",\"\")} — {d.get(\"summary\",\"\")[:200]}')
else:
    print('No session summary yet. Use /summary to generate one.')
"
```

If the current session has a summary, compare the user's new prompt against it:
- **Matches current session work?** → STAY. This is a continuation.
- **Related to current session's project but different area?** → STAY. Same project, different task.
- **Clearly about a different project?** → Continue to routing steps below.

**The current session gets priority.** Only route away when the prompt is clearly unrelated to what this session is doing AND what this project is about.

## Step 1: Quick Check — Is This For the Current Project?

Before doing external API calls, reason about the prompt:

- What is the current project? (check `$PWD` or the project context)
- What is this session doing? (from the session summary above)
- Does the prompt mention specific files, features, or patterns that clearly belong here?
- If YES → stop, don't route, just do the work

**Examples of prompts that stay in current project:**
- "fix the build error" → current project
- "add a test for the auth module" → current project (unless no auth module here)
- "commit and push" → current project
- "review the last changes" → current project

## Step 2: Simple Cross-Project Tasks

Some tasks mention other projects but can be done from the current session:

- `ssh` commands to remote servers
- `curl` to check health/status of another service
- Reading a file from another project's path
- Checking git status of another repo

If the task is a simple read/check operation, do it locally. No routing needed.

**Examples:**
- "check if the staging gateway is running" → `ssh` from here, no routing
- "what version is lm-assist on prod" → `curl localhost:3100/health` from here
- "read the CLAUDE.md from another project" → `cat ~/projects/acme-api/CLAUDE.md`

## Step 3: Identify Target Project

If the prompt requires actual work in another project (editing files, running builds, deploying):

```bash
curl -s -H "x-api-key: $LM_API_KEY" "http://localhost:$LM_PORT/projects/summaries" | python3 -c "
import sys,json
summaries = json.load(sys.stdin).get('data',{}).get('summaries',[])
for s in summaries:
    print(f'{s[\"projectName\"]:20} {s.get(\"summary\",\"\")[:100]}')
    areas = s.get('areas',[])
    if areas: print(f'  areas: {areas}')
"
```

Match the prompt against project summaries, areas, and features. Look for:
- Project names mentioned explicitly
- Domain keywords (trading, analysis, gateway, marketplace, knowledge)
- Feature keywords (dashboard, hooks, pipeline, deployment)
- File paths mentioned

## Step 4: Find Right Session

```bash
curl -s -H "x-api-key: $LM_API_KEY" "http://localhost:$LM_PORT/sessions/summaries" | python3 -c "
import sys,json
target_project = 'TARGET_PROJECT_PATH'
summaries = json.load(sys.stdin).get('data',{}).get('summaries',[])
matches = [s for s in summaries if s.get('projectPath') == target_project]
for s in matches:
    name = s.get('displayName') or s.get('slug') or s['sessionId'][:12]
    summary = s.get('summary','')[:120]
    turns = s.get('totalTurns',0)
    print(f'{name} ({turns}T): {summary}')
"
```

If summaries are sparse or none mention the work, search the indexed user prompts directly — full-text (bm25, CJK-aware), ranked, with a matching snippet per session:

```bash
curl -s -H "x-api-key: $LM_API_KEY" "http://localhost:$LM_PORT/session-search?query=KEYWORDS&projectPath=TARGET_PROJECT_PATH&scope=30d&limit=5" | python3 -c "
import sys,json
d = json.load(sys.stdin).get('data',{})
for r in d.get('results',[]):
    print(f\"{r['sessionId'][:12]} ({r.get('numTurns',0)}T) {r.get('project','')}: {r.get('snippet','')[:120]}\")
"
```

To confirm a candidate before recommending it, peek at its conversation compactly with `GET /sessions/:id` — the default response already excludes tool results and system messages (opt back in with `?includeToolResults=true` / `?includeSystemMessages=true` only if you need them).

## Step 5: Present Routing Decision

Tell the user clearly:

```
This task appears to belong to PROJECT_NAME, not the current project.

Relevant session found: SESSION_DISPLAY_NAME
Summary: SESSION_SUMMARY
Status: running/idle/completed

Recommendation: RESUME/QUEUE/FORK/NEW
Command: claude --resume SESSION_ID [--fork-session]

Or I can handle it from here if it's a simple operation.
What would you like to do?
```

**Always ask the user** — never auto-switch projects without confirmation.

For QUEUE, add the prompt to the target session's queue (it is delivered when that session picks up its next queued item):

```bash
curl -s -X POST -H "x-api-key: $LM_API_KEY" -H 'Content-Type: application/json' \
  "http://localhost:$LM_PORT/sessions/TARGET_SESSION_ID/queue" \
  -d "{\"formattedPrompt\": \"THE_PROMPT\", \"routingReason\": \"WHY_THIS_SESSION\", \"queuedBy\": \"$CLAUDE_CODE_SESSION_ID\"}"
```

Before recommending QUEUE to a session that looks busy, check `GET /monitor/stalls` — a session stalled on a server/network error is auto-resumed, and a model usage limit triggers a verified `/model` fallback, so "running" may really mean "recovering on its own".

## Common Routing Patterns

| User says | Current project | Route to | Action |
|-----------|----------------|----------|--------|
| "fix the delta-analysis bug" | lm-assist | acme-analytics | Find delta-analysis session, RESUME |
| "restart the gateway on staging" | lm-assist | acme-web | Simple ssh, handle locally |
| "add a new analysis track" | lm-assist | acme-analytics | Find relevant session or NEW |
| "update the lm-assist README" | acme-analytics | lm-assist | Find relevant session or NEW |
| "deploy web to staging" | lm-assist | acme-web | Handle locally with ssh+git pull |
| "check session costs" | any | lm-assist (observability) | Handle locally via API |
| "fix the CSS on this page" | lm-assist | lm-assist | Stay here, current project |

## Auto-Learning After Every Route

After making a routing decision, emit learning signals so future routing gets smarter:

```bash
curl -s -X POST "http://localhost:$LM_PORT/learn" \
  -H "x-api-key: $LM_API_KEY" -H 'Content-Type: application/json' \
  -d '{
    "signals": [
      {"type": "keyword", "value": "KEYWORD_FROM_PROMPT", "projectPath": "MATCHED_PROJECT_PATH", "projectName": "MATCHED_PROJECT"},
      {"type": "routing", "value": "ROUTING_DECISION_SUMMARY", "projectPath": "TARGET_PROJECT_PATH"}
    ]
  }'
```

If the user corrects a routing decision ("no, that's not for that project"), record a correction:
```bash
curl -s -X POST "http://localhost:$LM_PORT/learn" \
  -H "x-api-key: $LM_API_KEY" -H 'Content-Type: application/json' \
  -d '{"type": "correction", "value": "WHAT_WAS_WRONG → WHAT_IS_RIGHT", "projectPath": "CORRECT_PROJECT_PATH"}'
```

Before routing, check if accumulated signals can shortcut the decision:
```bash
curl -s -H "x-api-key: $LM_API_KEY" "http://localhost:$LM_PORT/learn/project/$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "/home/ubuntu/PROJECT")" | python3 -c "
import sys,json
data = json.load(sys.stdin).get('data',{})
if data.get('total',0) > 0:
    print(data.get('context',''))
"
```

If learning signals already tell you which project owns a keyword (e.g., "delta analysis" → acme-analytics with 5x count), skip the deep scan — route directly.
