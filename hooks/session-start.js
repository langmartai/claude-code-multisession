#!/usr/bin/env node
/**
 * claude-code-multisession — SessionStart hook
 *
 * Quick health check on session start. If lm-assist API isn't running,
 * suggests running /assist-setup. Non-blocking, silent on success.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Dev-aware port: when devModeEnabled is set in ~/.claude-code-config.json,
// talk to the dev API (3200) instead of prod (3100).
let port = 3100;
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude-code-config.json'), 'utf8'));
  if (cfg.devModeEnabled) port = 3200;
} catch { /* no config — use prod */ }

const req = http.get(`http://127.0.0.1:${port}/health`, { timeout: 2000 }, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    try {
      const d = JSON.parse(data);
      if (!d.success) {
        console.log('lm-assist API is not healthy. Run /assist-setup to fix.');
      }
      // Silent on success — don't clutter session start
    } catch {
      console.log('lm-assist API response error. Run /assist-setup.');
    }
  });
});

req.on('error', () => {
  console.log('lm-assist services not running. Run: /assist-setup');
});

req.on('timeout', () => {
  req.destroy();
  // Silent on timeout — API may be starting up
});
