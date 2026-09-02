---
allowed-tools: Bash
description: Summarize the current session — what we're working on, what was done, current state
---

# /summary — Current Session Summary

Generate or refresh a summary of THIS session.

## Step 1: Gather session data

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/summary-gather.js" "${CLAUDE_SESSION_ID:-$CLAUDE_CODE_SESSION_ID}"
```

(Current Claude Code exports the session id as `CLAUDE_CODE_SESSION_ID`; older builds used `CLAUDE_SESSION_ID`.)

If the gathered transcript is too thin to summarize (e.g. a long, tool-heavy session), pull compact conversation detail straight from the API:

```bash
curl -s -H "x-api-key: $(cat "${LM_ASSIST_DATA_DIR:-$HOME/.lm-assist}/api-token" 2>/dev/null)" \
  "http://localhost:3100/sessions/${CLAUDE_SESSION_ID:-$CLAUDE_CODE_SESSION_ID}?includeToolResults=true&includeSystemMessages=true"
```

(`includeToolResults`/`includeSystemMessages` return compact, server-capped `toolResults[]`/`systemMessages[]` arrays — prefer them over `includeRawMessages`, whose raw stream is ~15x the payload for the same data. Prod API `3100`; dev `3200` when `devModeEnabled` is `true` in `~/.claude-code-config.json`.)

## Step 2: Generate the summary

Analyze the output from Step 1 and generate:
- **Summary text** — what this session is about, what was accomplished, current state
- **Display name** — 2-4 words, kebab-case (if no customTitle exists)

## Step 3: Save summary and record learning

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/summary-save.js" "${CLAUDE_SESSION_ID:-$CLAUDE_CODE_SESSION_ID}" "YOUR_SUMMARY" "YOUR_DISPLAY_NAME" TURN_COUNT "MAIN_KEYWORD" "PROJECT_AREA"
```

## Step 4: Rename session (if needed)

If the session doesn't have a customTitle:
```
/rename YOUR_DISPLAY_NAME
```

## Output

```
Session Summary
═══════════════
Name:    SESSION_DISPLAY_NAME
Project: PROJECT_NAME
Turns:   N | Cost: $X.XX
Status:  in progress / completed

What this session is about:
  DESCRIPTION

What was accomplished:
  - MILESTONE_1
  - MILESTONE_2

Current state:
  CURRENT_WORK

Key context:
  - DECISION_1
  - PATTERN_1
```
