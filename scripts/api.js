/**
 * Shared API helper for claude-code-multisession scripts.
 * All scripts use this to call the lm-assist API.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Dev-aware port: when devModeEnabled is set in ~/.claude-code-config.json,
// talk to the dev API (3200) instead of prod (3100).
function detectPort() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude-code-config.json'), 'utf8'));
    if (cfg.devModeEnabled) return 3200;
  } catch { /* no config — use prod */ }
  return 3100;
}
const PORT = detectPort();

// API token: every Core endpoint except /health requires an x-api-key header.
// The worker writes a rotating token to <dataDir>/api-token; read it fresh on
// each call so a rotation mid-run is picked up. Empty string if missing (a
// fresh machine — /health still answers, and checkHealth() explains the rest).
function apiToken() {
  try {
    const dataDir = process.env.LM_ASSIST_DATA_DIR || path.join(os.homedir(), '.lm-assist');
    return fs.readFileSync(path.join(dataDir, 'api-token'), 'utf8').trim();
  } catch { return ''; }
}

function api(path, method, body) {
  return new Promise((resolve) => {
    const opts = { hostname: '127.0.0.1', port: PORT, path, method: method || 'GET', timeout: 5000 };
    const token = apiToken();
    if (token) opts.headers = { 'x-api-key': token };
    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      opts.headers = Object.assign(opts.headers || {}, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
      body = payload;
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    if (body) req.write(body);
    req.end();
  });
}

async function checkHealth() {
  const h = await api('/health');
  if (!h?.success) {
    console.log('lm-assist API is not running.');
    console.log('Start with: npm install -g lm-assist && lm-assist start');
    process.exit(0);
  }
  return h.data;
}

const fmt = {
  hdr: (s, n) => (s + ' '.repeat(n)).slice(0, n),
  rgt: (s, n) => (' '.repeat(n) + s).slice(-n),
  cost: (v) => v ? '$' + v.toFixed(2) : '-',
  line: (n) => '\u2500'.repeat(n || 95),
  dline: (n) => '\u2550'.repeat(n || 95),
};

module.exports = { api, checkHealth, fmt, PORT, apiToken };
