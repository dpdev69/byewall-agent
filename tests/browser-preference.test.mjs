import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { browserPreference } from '../scripts/browser-preference.mjs';

test('portable browser default and project preference; environment wins', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'byewall-preference-'));
  try {
    assert.deepEqual(browserPreference({ cwd, env: {} }), { preference: 'auto', source: 'default', browser_required: false });
    writeFileSync(path.join(cwd, '.byewall.json'), JSON.stringify({ browser: 'safari' }));
    assert.equal(browserPreference({ cwd, env: {} }).preference, 'safari');
    assert.deepEqual(browserPreference({ cwd, env: { BYEWALL_BROWSER: 'none' } }), { preference: 'none', source: 'environment', browser_required: false });
    assert.equal(browserPreference({ cwd, env: { BYEWALL_BROWSER: 'firefox' } }).preference, 'firefox');
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('invalid config fails clearly without echoing its contents', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'byewall-preference-'));
  try {
    for (const text of ['not JSON: private-value', 'null', '{}', '{"browser":"private-value"}', 'x'.repeat(4097)]) {
      writeFileSync(path.join(cwd, '.byewall.json'), text);
      assert.throws(() => browserPreference({ cwd, env: {} }), error => !error.message.includes('private-value'));
    }
    assert.throws(() => browserPreference({ cwd, env: { BYEWALL_BROWSER: 'private-value' } }), error => !error.message.includes('private-value'));
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
