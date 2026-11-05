'use strict';

const path = require('path');
const { MAX_IMAGE_PIXELS } = require('./asset-validation');

function createImageDecodeValidator({ nativeImage }) {
  if (!nativeImage || typeof nativeImage.createFromPath !== 'function') {
    throw new TypeError('nativeImage.createFromPathが必要です。');
  }

  const NATIVE_DECODABLE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

  return function validateImageDecodes(filePath, relativePath) {
    if (!NATIVE_DECODABLE_EXTENSIONS.has(path.extname(String(filePath)).toLowerCase())) return;
    const image = nativeImage.createFromPath(filePath);
    if (!image || typeof image.isEmpty !== 'function' || image.isEmpty()) {
      throw new Error(`画像を読み込めません：${relativePath}`);
    }
    if (typeof image.getSize === 'function') {
      const dimensions = image.getSize();
      const width = Number(dimensions?.width);
      const height = Number(dimensions?.height);
      if (
        !Number.isFinite(width)
        || !Number.isFinite(height)
        || width <= 0
        || height <= 0
        || width * height > MAX_IMAGE_PIXELS
      ) {
        throw new Error(`画像は16MP以下にしてください：${relativePath}`);
      }
    }
  };
}

module.exports = { createImageDecodeValidator };
