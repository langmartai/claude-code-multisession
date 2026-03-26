#!/usr/bin/env node
/**
 * claude-one — One prompt to control all your Claude Code sessions
 *
 * This is a shell wrapper around lm-assist. All actual functionality
 * is provided by the lm-assist package.
 */
const { execFileSync } = require('child_process');
const args = process.argv.slice(2);
try {
  execFileSync('lm-assist', args, { stdio: 'inherit' });
} catch (e) {
  process.exit(e.status || 1);
}
