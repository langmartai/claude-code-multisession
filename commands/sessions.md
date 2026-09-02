---
allowed-tools: Bash
description: List recent Claude Code sessions with costs and status
---

# /sessions — Session List

Show recent sessions with costs, turns, model, and running status across all projects.

## Execution

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/sessions.js" "$ARGUMENTS"
```

`$ARGUMENTS` (optional) filters the list by project name/path substring.

> Ports/auth: prod API `3100` (web UI `3848`), or dev `3200`/`3948` when `devModeEnabled` is `true` in `~/.claude-code-config.json`. Every endpoint except `/health` requires the local token, sent as `x-api-key` from `${LM_ASSIST_DATA_DIR:-$HOME/.lm-assist}/api-token` — the script does this automatically; the curls below do it explicitly.

## Output

Present the script output directly. Do NOT reformat.

## Full-text prompt search

When the user wants sessions found by what was *said* in them (not by project name), use the server's full-text index (bm25, CJK-aware) instead of the list filter:

```bash
curl -s -G -H "x-api-key: $(cat "${LM_ASSIST_DATA_DIR:-$HOME/.lm-assist}/api-token" 2>/dev/null)" \
  --data-urlencode "query=SEARCH TERMS" --data-urlencode "limit=10" \
  http://localhost:3100/session-search
```

Results carry `sessionId`, `project`, `numTurns`, and a matching-prompt `snippet` per hit.

## Usage windows footer

To also show how much Claude Code limit window remains, append a footer from the usage endpoint:

```bash
curl -s --max-time 8 -H "x-api-key: $(cat "${LM_ASSIST_DATA_DIR:-$HOME/.lm-assist}/api-token" 2>/dev/null)" \
  http://localhost:3100/claude-code/usage | python3 -c "
import sys,json
d = json.load(sys.stdin).get('data') or {}
for k, label in (('five_hour','5h window'), ('seven_day','7d window')):
    w = d.get(k) or {}
    if w:
        print(label + ': ' + str(w.get('utilization','?')) + '% used, resets ' + str(w.get('resets_at','?')))
"
```

## Web view

The same data, live, in the web UI: `http://localhost:3848/session-dashboard`.
