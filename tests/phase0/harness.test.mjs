import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import {
  PROJECT_ROOT,
  assertBaselineCheckpointIntact,
  assertPackageOnlyAddsApprovedTestScripts,
  currentProjectManifest,
  loadBaselineManifest,
  withTemporaryProject,
} from './helpers/workspace.mjs';
import {
  loadMainForTest,
  loadRendererForTest,
  loadSettingsForTest,
} from './helpers/loaders.mjs';

const require = createRequire(import.meta.url);

test('Phase 0: the immutable v2.3.4 checkpoint remains verifiable', () => {
  const manifest = loadBaselineManifest();
  assert.equal(manifest.length, 36);
  const result = assertBaselineCheckpointIntact();
  assert.equal(result.gitVerified, fs.existsSync(path.join(PROJECT_ROOT, '.git')));
  assertPackageOnlyAddsApprovedTestScripts();
});

test('Phase 0: temporary tests cannot modify the current source tree', async () => {
  const before = currentProjectManifest();
  await withTemporaryProject(async ({ projectRoot, userCharacters }) => {
    fs.rmSync(path.join(projectRoot, 'characters', 'default'), { recursive: true, force: true });
    fs.writeFileSync(path.join(userCharacters, 'temporary-only.txt'), 'safe temporary mutation');
  });
  assert.deepEqual(currentProjectManifest(), before);
  assertBaselineCheckpointIntact();
});

test('Phase 0: main, renderer, and settings VM loaders execute production source', async () => {
  await withTemporaryProject(async ({ projectRoot, userDataRoot }) => {
    const main = loadMainForTest({ projectRoot, userDataRoot });
    assert.equal(typeof main.api.validateAndNormalizeConfig, 'function');
    assert.ok(main.handlers.has('mascot:save-config'));

    const renderer = loadRendererForTest({ projectRoot });
    assert.equal(typeof renderer.api.updateMotion, 'function');
    assert.equal(typeof renderer.api.chooseWeightedAction, 'function');

    const settings = loadSettingsForTest({ projectRoot });
    assert.equal(typeof settings.api.loadConfiguration, 'function');
    assert.equal(typeof settings.api.measureVisibleContent, 'function');
  });
});

test('Phase 0: shared rule modules are pure and importable', () => {
  const rules = require(path.join(PROJECT_ROOT, 'shared', 'config-rules.js'));
  const assets = require(path.join(PROJECT_ROOT, 'shared', 'asset-validation.js'));
  assert.equal(rules.CONFIG_RULES.weight.maximum, 10);
  assert.ok(rules.ALLOWED_MOVEMENTS.includes('orthogonal'));
  assert.equal(assets.hasAllowedImageExtension('actions/rest.svg'), true);
  assert.equal(assets.hasAllowedImageExtension('actions/readme.txt'), false);
  assert.equal(assets.isLexicallyInsideRoot('/safe/root', '/safe/root/actions/a.png'), true);
  assert.equal(assets.isLexicallyInsideRoot('/safe/root', '/safe/outside.png'), false);
});
