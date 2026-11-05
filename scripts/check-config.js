const fs = require('fs');
const path = require('path');
const { resolveImageFileWithinRoot } = require('../shared/asset-validation');
const { validateAndNormalizeConfig } = require('../shared/config-rules');

const projectRoot = path.resolve(__dirname, '..');
const characterRoot = path.join(projectRoot, 'characters', 'default');
const configPath = path.join(characterRoot, 'config.json');
let config;
try {
  const input = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config = validateAndNormalizeConfig(input, {
    validateAsset(relativePath) {
      resolveImageFileWithinRoot(characterRoot, relativePath, { fsModule: fs });
    },
  });
} catch (error) {
  console.error('\n設定チェックで問題が見つかりました:\n');
  console.error(`- config.json を確認してください：${String(error?.message || error)}`);
  console.error('');
  process.exit(1);
}

console.log(`設定OK: ${config.actions.length}種類の動作と画像を確認しました。`);
