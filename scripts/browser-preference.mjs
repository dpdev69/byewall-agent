#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const supported = new Set(['auto', 'safari', 'chrome', 'firefox', 'edge', 'none']);
export function browserPreference({ cwd = process.cwd(), env = process.env } = {}) {
  let preference = env.BYEWALL_BROWSER;
  let source = preference ? 'environment' : 'default';
  if (!preference) {
    const file = path.join(cwd, '.byewall.json');
    try {
      if (statSync(file).size > 4096) throw new Error('Invalid configuration');
      const config = JSON.parse(readFileSync(file, 'utf8'));
      if (!config || typeof config !== 'object' || Array.isArray(config) || typeof config.browser !== 'string') throw new Error('Invalid configuration');
      preference = config.browser;
      source = 'project';
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('Invalid .byewall.json: use a browser value of auto, safari, chrome, firefox, edge or none.');
    }
  }
  preference ||= 'auto';
  if (!supported.has(preference)) throw new Error('Unsupported browser preference: use auto, safari, chrome, firefox, edge or none.');
  return { preference, source, browser_required: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--cwd')) throw new Error('Usage: node scripts/browser-preference.mjs [--cwd PROJECT_DIRECTORY]');
    console.log(JSON.stringify(browserPreference({ cwd: args[1] || process.cwd() })));
  } catch (error) {
    console.log(JSON.stringify({ error: 'invalid_browser_configuration', message: error.message }));
    process.exitCode = 1;
  }
}
