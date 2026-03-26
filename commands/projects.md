---
allowed-tools: Bash
description: List all projects with session counts, costs, and summaries
---

# /projects — Project Overview

Show all projects with session counts, costs, summaries, and current project highlighted. Auto-generates missing project summaries in background.

## Execution

```bash
node -e "
const http = require('http');
const cwd = process.cwd();

function api(path, method, body) {
  return new Promise((resolve) => {
    const opts = { hostname: '127.0.0.1', port: 3100, path, method: method || 'GET', timeout: 5000 };
    if (body) opts.headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
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

(async () => {
  const health = await api('/health');
  if (!health?.success) {
    console.log('lm-assist API is not running.\nStart with: npm install -g lm-assist');
    return;
  }

  const data = await api('/projects');
  if (!data?.data?.projects) { console.log('Failed to fetch projects.'); return; }
  const projects = data.data.projects;

  const costs = await api('/projects/costs');
  const costMap = {};
  if (costs?.data?.projects) {
    for (const p of costs.data.projects) costMap[p.projectPath || p.path] = p;
  }

  const summaries = await api('/projects/summaries');
  const summaryMap = {};
  if (summaries?.data?.summaries) {
    for (const s of summaries.data.summaries) summaryMap[s.projectPath] = s;
  }

  // Find projects missing summaries
  const missing = [];

  console.log('Projects (' + projects.length + ')');
  console.log('\u2500'.repeat(100));
  const hdr = (s,n) => (s + ' '.repeat(n)).slice(0,n);
  const rgt = (s,n) => (' '.repeat(n) + s).slice(-n);
  console.log(hdr('',3) + hdr('Project',22) + rgt('Sessions',9) + rgt('Cost',10) + '  Summary');
  console.log('\u2500'.repeat(100));

  for (const p of projects) {
    const path = p.path || p.projectPath || '';
    const name = (p.projectName || p.name || path.split('/').pop() || '?').slice(0,20);
    const sessions = String(p.sessionCount || 0);
    const c = costMap[path];
    const cost = c ? '\$' + (c.totalCostUsd || 0).toFixed(2) : '-';
    const isCurrent = cwd.startsWith(path) || path.endsWith(cwd.split('/').pop());
    const marker = isCurrent ? ' *' : '  ';
    const s = summaryMap[path];
    let summary;
    if (s && s.summary) {
      summary = s.summary.slice(0, 50);
    } else if ((p.sessionCount || 0) > 0) {
      summary = '(pending generation...)';
      missing.push({ path, name });
    } else {
      summary = '';
    }
    console.log(marker + ' ' + hdr(name,22) + rgt(sessions,9) + rgt(cost,10) + '  ' + summary);
  }

  console.log('\u2500'.repeat(100));
  const totalCost = Object.values(costMap).reduce((a, p) => a + (p.totalCostUsd || 0), 0);
  const totalSessions = projects.reduce((a, p) => a + (p.sessionCount || 0), 0);
  console.log('   Total' + ' '.repeat(14) + rgt(String(totalSessions),9) + rgt('\$' + totalCost.toFixed(2),10));
  console.log();
  console.log(' * = current project');

  // Dispatch background agents to generate missing summaries
  if (missing.length > 0) {
    console.log();
    console.log('Generating summaries for ' + missing.length + ' project(s) in background...');
    for (const m of missing) {
      api('/agent/execute', 'POST', JSON.stringify({
        prompt: 'Generate a project summary. Read CLAUDE.md if it exists, check package.json, scan directories, check scripts and configs. Then save via: curl -s -X PUT http://localhost:3100/projects/summary -H \"Content-Type: application/json\" -d with projectPath, projectName, summary (1-2 sentences), stack (array), areas (array), recentFocus, services, keyCommands, structure, deployment, importantNotes, fullReference (500+ words from CLAUDE.md). Be thorough.',
        cwd: m.path,
        permissionMode: 'bypassPermissions',
        maxTurns: 10,
        background: true
      })).catch(() => {});
    }
    console.log('Run /projects again in ~30s to see summaries.');
  }
})();
"
```

## Output

Present the script output directly.
