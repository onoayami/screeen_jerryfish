import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { loadSettingsForTest } from '../phase0/helpers/loaders.mjs';
import { withTemporaryProject } from '../phase0/helpers/workspace.mjs';

function configureSettings(settings, durations) {
  settings.api.state.config = {
    name: '表示時間の一括設定',
    mascot: { size: 180, startPosition: 'bottom-right', margin: 40, rememberPosition: true },
  };
  settings.api.state.actions = durations.map((duration, index) => ({
    _uiId: `duration-action-${index + 1}`,
    name: `動作${index + 1}`,
    file: `actions/action-${index + 1}.svg`,
    weight: 1,
    durationMs: [...duration],
    flipMode: 'direction',
    imageTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    movement: { type: 'still', speed: 0 },
  }));
  settings.api.state.selectedId = settings.api.state.actions[0]?._uiId || null;
  settings.api.state.dirty = false;
  settings.api.state.busy = false;
  settings.api.renderActionList();
}

function openDurationBulk(settings) {
  settings.nodes.get('open-duration-bulk').dispatchEvent({ type: 'click' });
  assert.equal(settings.api.elements.durationBulkDialog.open, true);
}

function click(element) {
  const listeners = element._listeners.get('click') || [];
  assert.equal(listeners.length, 1, `${element.id} should have one click handler`);
  return listeners[0].call(element, { type: 'click' });
}

test('new actions use the 6-second and 10-second duration defaults', async () => {
  await withTemporaryProject(async ({ projectRoot }) => {
    const settings = loadSettingsForTest({ projectRoot });
    settings.api.state.actions = [];
    settings.api.renderActionList();
    assert.equal(settings.api.elements.openDurationBulk.disabled, true);
    settings.api.addAction();

    assert.deepEqual(Array.from(settings.api.state.actions[0].durationMs), [6000, 10000]);
    assert.equal(settings.api.elements.openDurationBulk.disabled, false);
    settings.api.setBusy(true);
    assert.equal(settings.api.elements.openDurationBulk.disabled, true);
    settings.api.setBusy(false);
    assert.equal(settings.api.elements.openDurationBulk.disabled, false);
  });
});

test('missing durations loaded into settings use the defaults in state, editor, and serialization', async () => {
  await withTemporaryProject(async ({ projectRoot }) => {
    const settings = loadSettingsForTest({
      projectRoot,
      mascotAPI: {
        loadConfig: async () => ({
          config: {
            name: '欠けた時間',
            mascot: { size: 180, startPosition: 'bottom-right', margin: 40, rememberPosition: true },
            actions: [{
              name: '休む',
              file: 'actions/rest.svg',
              weight: 1,
              movement: { type: 'still', speed: 0 },
            }],
          },
          warnings: [],
          recovery: { kind: 'none', canRestoreBackup: false },
        }),
      },
    });

    await settings.api.loadConfiguration();

    assert.deepEqual(Array.from(settings.api.state.actions[0].durationMs), [6000, 10000]);
    assert.equal(settings.api.elements.durationMin.value, 6);
    assert.equal(settings.api.elements.durationMax.value, 10);
    assert.deepEqual(Array.from(settings.api.serializeConfig().actions[0].durationMs), [6000, 10000]);

    settings.api.elements.durationMin.value = 'invalid';
    settings.api.elements.durationMin.dispatchEvent({ type: 'input' });
    settings.api.elements.durationMax.value = 'invalid';
    settings.api.elements.durationMax.dispatchEvent({ type: 'input' });
    assert.deepEqual(Array.from(settings.api.state.actions[0].durationMs), [6000, 10000]);
  });
});

test('shared config normalization uses the new defaults only when durationMs is missing', async () => {
  await withTemporaryProject(async ({ projectRoot }) => {
    const require = createRequire(path.join(projectRoot, 'package.json'));
    const { validateAndNormalizeConfig } = require('./shared/config-rules.js');
    const input = JSON.parse(fs.readFileSync(path.join(projectRoot, 'characters/default/config.json'), 'utf8'));
    const originalDurations = input.actions.map((action) => [...action.durationMs]);
    const normalizedExisting = validateAndNormalizeConfig(input);
    assert.deepEqual(
      normalizedExisting.actions.map((action) => Array.from(action.durationMs)),
      originalDurations,
    );
    delete input.actions[0].durationMs;

    const normalized = validateAndNormalizeConfig(input);

    assert.deepEqual(Array.from(normalized.actions[0].durationMs), [6000, 10000]);
    assert.deepEqual(input.actions[1].durationMs, [6000, 11000]);
  });
});

test('bulk apply overwrites every action, remains unsaved, and does not save', async () => {
  await withTemporaryProject(async ({ projectRoot }) => {
    let saveCalls = 0;
    const settings = loadSettingsForTest({
      projectRoot,
      mascotAPI: { saveConfig: async () => { saveCalls += 1; return { ok: true }; } },
    });
    configureSettings(settings, [[2500, 6500], [4000, 9000]]);
    openDurationBulk(settings);

    assert.equal(settings.api.elements.durationBulkMin.value, 2.5);
    assert.equal(settings.api.elements.durationBulkMax.value, 6.5);
    assert.equal(settings.api.elements.durationBulkCount.textContent, '全2件の動作の時間が、上書きされます。');
    settings.api.elements.durationBulkMin.value = '1.5';
    settings.api.elements.durationBulkMax.value = '2.5';
    await click(settings.api.elements.durationBulkApply);

    assert.deepEqual(
      settings.api.state.actions.map((action) => Array.from(action.durationMs)),
      [[1500, 2500], [1500, 2500]],
    );
    assert.equal(settings.api.state.dirty, true);
    assert.equal(settings.api.elements.durationBulkDialog.open, false);
    assert.equal(settings.api.elements.toast.textContent, '全動作の表示時間を設定しました。');
    assert.equal(saveCalls, 0);
  });
});

test('bulk save sends the new duration for every action exactly once', async () => {
  await withTemporaryProject(async ({ projectRoot }) => {
    const savedPayloads = [];
    const settings = loadSettingsForTest({
      projectRoot,
      mascotAPI: {
        saveConfig: async (config) => {
          savedPayloads.push(config);
          return { ok: true, applied: true, config };
        },
      },
    });
    configureSettings(settings, [[1000, 2000], [3000, 4000]]);
    openDurationBulk(settings);
    settings.api.elements.durationBulkMin.value = '3';
    settings.api.elements.durationBulkMax.value = '7.5';
    await click(settings.api.elements.durationBulkSave);

    assert.equal(savedPayloads.length, 1);
    assert.deepEqual(
      savedPayloads[0].actions.map((action) => Array.from(action.durationMs)),
      [[3000, 7500], [3000, 7500]],
    );
    assert.equal(settings.api.state.dirty, false);
    assert.equal(settings.api.elements.durationBulkDialog.open, false);
    assert.match(settings.api.elements.toast.textContent, /設定を保存し/);
    assert.doesNotMatch(settings.api.elements.toast.textContent, /全動作の表示時間を設定しました/);
  });
});

test('bulk save failure leaves the applied durations as unsaved changes', async () => {
  await withTemporaryProject(async ({ projectRoot }) => {
    const settings = loadSettingsForTest({
      projectRoot,
      mascotAPI: { saveConfig: async () => ({ ok: false }) },
    });
    configureSettings(settings, [[1000, 2000], [3000, 4000]]);
    openDurationBulk(settings);
    settings.api.elements.durationBulkMin.value = '4';
    settings.api.elements.durationBulkMax.value = '8';
    await click(settings.api.elements.durationBulkSave);

    assert.deepEqual(
      settings.api.state.actions.map((action) => Array.from(action.durationMs)),
      [[4000, 8000], [4000, 8000]],
    );
    assert.equal(settings.api.state.dirty, true);
    assert.match(settings.api.elements.feedback.textContent, /保存に失敗しました/);
    assert.equal(settings.api.elements.durationBulkDialog.open, false);
  });
});

test('bulk duration validation rejects reversed and out-of-range values without changing state', async () => {
  await withTemporaryProject(async ({ projectRoot }) => {
    let saveCalls = 0;
    const settings = loadSettingsForTest({
      projectRoot,
      mascotAPI: { saveConfig: async () => { saveCalls += 1; return { ok: true }; } },
    });
    configureSettings(settings, [[1000, 2000], [3000, 4000]]);
    openDurationBulk(settings);

    for (const [minimum, maximum, expectedError] of [
      ['2', '1', /最短時間は最長時間以下/],
      ['0.4', '1', /0\.5〜600秒/],
      ['1', '601', /0\.5〜600秒/],
    ]) {
      settings.api.elements.durationBulkMin.value = minimum;
      settings.api.elements.durationBulkMax.value = maximum;
      await click(settings.api.elements.durationBulkApply);

      assert.match(settings.api.elements.durationBulkError.textContent, expectedError);
      assert.equal(settings.api.elements.durationBulkError.hidden, false);
      assert.equal(settings.api.elements.durationBulkDialog.open, true);
      assert.deepEqual(
        settings.api.state.actions.map((action) => Array.from(action.durationMs)),
        [[1000, 2000], [3000, 4000]],
      );
      assert.equal(settings.api.state.dirty, false);
    }

    assert.equal(saveCalls, 0);
    click(settings.api.elements.durationBulkCancel);
  });
});
