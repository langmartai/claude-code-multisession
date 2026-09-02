#!/usr/bin/env node
const { api, checkHealth, fmt, PORT } = require('./api');
const cwd = process.cwd();

(async () => {
  await checkHealth();

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

  const missing = [];

  console.log(`Projects (${projects.length})`);
  console.log(fmt.line(100));
  console.log(fmt.hdr('', 3) + fmt.hdr('Project', 22) + fmt.rgt('Sessions', 9) + fmt.rgt('Cost', 10) + '  Summary');
  console.log(fmt.line(100));

  for (const p of projects) {
    const path = p.path || p.projectPath || '';
    // Projects carry no name field — derive the display name from the path.
    const name = (path.split('/').pop() || '?').slice(0, 20);
    const sessions = String(p.sessionCount || 0);
    const c = costMap[path];
    const cost = c ? fmt.cost(c.totalCostUsd) : '-';
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
    console.log(marker + ' ' + fmt.hdr(name, 22) + fmt.rgt(sessions, 9) + fmt.rgt(cost, 10) + '  ' + summary);
  }

  console.log(fmt.line(100));
  const totalCost = Object.values(costMap).reduce((a, p) => a + (p.totalCostUsd || 0), 0);
  const totalSessions = projects.reduce((a, p) => a + (p.sessionCount || 0), 0);
  console.log('   Total' + ' '.repeat(14) + fmt.rgt(String(totalSessions), 9) + fmt.rgt(fmt.cost(totalCost), 10));
  const usage = await usageLine();
  if (usage) console.log('   ' + usage);
  console.log();
  console.log(' * = current project');

  // Dispatch background agents for missing summaries
  if (missing.length > 0) {
    console.log();
    console.log(`Generating summaries for ${missing.length} project(s) in background...`);
    for (const m of missing) {
      api('/agent/execute', 'POST', {
        prompt: `Generate a project summary. Read CLAUDE.md if it exists, check package.json, scan directories, check scripts and configs. Then save via: curl -s -X PUT http://localhost:${PORT}/projects/summary -H "Content-Type: application/json" -H "x-api-key: $(cat "\${LM_ASSIST_DATA_DIR:-$HOME/.lm-assist}/api-token" 2>/dev/null)" -d with projectPath, projectName, summary, stack, areas, recentFocus, services, keyCommands, structure, deployment, importantNotes, fullReference. Be thorough.`,
        cwd: m.path,
        permissionMode: 'bypassPermissions',
        maxTurns: 10,
        background: true,
      }).catch(() => {});
    }
    console.log('Run /projects again in a minute or two to see summaries.');
  }
})();

// Claude Code usage windows (GET /claude-code/usage) — budget context for the cost total.
async function usageLine() {
  const u = await api('/claude-code/usage');
  const d = u?.data;
  if (!d) return null;
  const parts = [];
  const limits = (d.limits || []).filter(l => typeof l.percent === 'number');
  if (limits.length) {
    for (const l of limits) {
      const label = l.kind === 'session' ? '5h'
        : l.scope?.model?.display_name ? `7d ${l.scope.model.display_name}`
        : l.kind === 'weekly_all' ? '7d' : (l.kind || l.group || 'window');
      parts.push(`${label} ${l.percent}%`);
    }
  } else {
    if (d.five_hour) parts.push(`5h ${d.five_hour.utilization ?? '?'}%`);
    if (d.seven_day) parts.push(`7d ${d.seven_day.utilization ?? '?'}%`);
  }
  return parts.length ? `Usage window: ${parts.join(' | ')} used` : null;
}
