#!/usr/bin/env node
/**
 * Gathers session data for /summary command.
 * Outputs structured info for Claude to generate the summary.
 */
const { api, checkHealth } = require('./api');
const sid = process.argv[2] || process.env.CLAUDE_SESSION_ID || '';
const cwd = process.cwd();
const projectName = cwd.split('/').pop();

(async () => {
  const health = await checkHealth();

  if (!sid) {
    console.log('ERROR: Could not determine session ID');
    return;
  }

  console.log(`Session: ${sid}`);
  console.log(`Project: ${cwd}`);

  // Existing summary
  console.log('\n--- EXISTING SUMMARY ---');
  const summary = await api('/sessions/' + sid + '/summary');
  if (summary?.data?.summary) {
    const d = summary.data;
    console.log(`Display name: ${d.displayName || '(none)'}`);
    console.log(`Last turn index: ${d.lastTurnIndex || 0}`);
    console.log(`Summary: ${d.summary}`);
  } else {
    console.log('No summary exists yet.');
  }

  // Session metadata + compact extras. includeToolResults/includeSystemMessages
  // return server-capped compact arrays (toolResults[]/systemMessages[]) — the
  // recommended way to get tool outcomes, ~15x smaller than includeRawMessages.
  console.log('\n--- SESSION METADATA ---');
  const meta = await api('/sessions/' + sid + '?includeToolResults=true&includeSystemMessages=true');
  if (meta?.data) {
    const d = meta.data;
    console.log(`turns=${d.numTurns || 0}`);
    console.log(`cost=$${(d.totalCostUsd || 0).toFixed(2)}`);
    console.log(`slug=${d.slug || ''}`);
    console.log(`customTitle=${d.customTitle || ''}`);
    console.log(`model=${d.model || ''}`);
    console.log(`status=${d.status || ''}`);
  }

  // Conversation
  console.log('\n--- CONVERSATION (last 20 turns) ---');
  const conv = await api('/sessions/' + sid + '/conversation?toolDetail=summary&lastN=20');
  if (conv?.data?.messages?.length) {
    const msgs = conv.data.messages;
    console.log(`${msgs.length} messages`);
    for (const m of msgs) {
      const content = (m.content || '').slice(0, 200);
      if (m.role === 'user' && content) console.log(`  USER: ${content}`);
      else if (m.role === 'assistant' && content.length > 50) console.log(`  CLAUDE: ${content.slice(0, 150)}`);
    }
  } else {
    console.log('No conversation data available.');
  }

  // Tool outcomes (compact toolResults[] from the metadata fetch above)
  const toolResults = meta?.data?.toolResults || [];
  if (toolResults.length) {
    console.log('\n--- RECENT TOOL RESULTS ---');
    for (const t of toolResults.slice(-8)) {
      const tag = t.isError ? 'ERROR' : 'ok';
      console.log(`  [${tag}] ${(t.content || '').replace(/\s+/g, ' ').slice(0, 150)}`);
    }
  }

  // Compaction summaries carry pre-compaction context the last-20-turns window misses
  const compactions = (meta?.data?.systemMessages || []).filter(m => m.type === 'summary');
  if (compactions.length) {
    console.log('\n--- COMPACTION SUMMARIES ---');
    for (const m of compactions.slice(-2)) {
      console.log(`  ${(m.content || '').replace(/\s+/g, ' ').slice(0, 300)}`);
    }
  }
})();
