'use strict';

const assert = require('node:assert/strict');
const { app, nativeImage } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const {
  resolveImageFileWithinRoot,
} = require('../shared/asset-validation');
const { createImageDecodeValidator } = require('../shared/image-decode');
const { validateAndNormalizeConfig } = require('../shared/config-rules');

const characterRoot = path.join(__dirname, '..', 'characters', 'default');
const validateImageDecodes = createImageDecodeValidator({ nativeImage });
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function createPng(width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 0;
  const pixels = Buffer.alloc(height * (width + 1));
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function runSmokeTest() {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-mascot-smoke-'));
  try {
    const configPath = path.join(characterRoot, 'config.json');
    const input = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    validateAndNormalizeConfig(input, {
      validateAsset(relativePath) {
        const assetPath = resolveImageFileWithinRoot(characterRoot, relativePath, { fsModule: fs });
        validateImageDecodes(assetPath, relativePath);
      },
    });

    validateImageDecodes(
      path.join(characterRoot, 'actions', 'rest.svg'),
      'actions/rest.svg',
    );

    const brokenPngPath = path.join(temporaryDirectory, 'broken.png');
    fs.writeFileSync(brokenPngPath, Buffer.concat([PNG_SIGNATURE, Buffer.from('invalid image data')]));
    assert.throws(
      () => validateImageDecodes(brokenPngPath, 'broken.png'),
      /画像を読み込めません/,
    );

    const oversizedPngPath = path.join(temporaryDirectory, 'over-16mp.png');
    fs.writeFileSync(oversizedPngPath, createPng(4001, 4000));
    assert.throws(
      () => validateImageDecodes(oversizedPngPath, 'over-16mp.png'),
      /16MP以下/,
    );
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

app.whenReady().then(() => {
  try {
    runSmokeTest();
    console.log('SMOKE OK');
    app.exit(0);
  } catch (error) {
    console.error(`SMOKE NG ${String(error?.message || error)}`);
    app.exit(1);
  }
}).catch((error) => {
  console.error(`SMOKE NG ${String(error?.message || error)}`);
  app.exit(1);
});
