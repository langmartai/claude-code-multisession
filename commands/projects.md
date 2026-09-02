---
allowed-tools: Bash
description: List all projects with session counts, costs, and summaries
---

# /projects — Project Overview

Show all projects with session counts, costs, summaries, and current project highlighted. Auto-generates missing project summaries in background.

## Execution

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/projects.js"
```

> The script auto-detects the API port (prod `3100`, or dev `3200` when `devModeEnabled` is `true` in `~/.claude-code-config.json`) and authenticates with the local API token at `${LM_ASSIST_DATA_DIR:-$HOME/.lm-assist}/api-token` — every endpoint except `/health` requires `x-api-key`.

## Output

Present the script output directly. Do NOT reformat.
