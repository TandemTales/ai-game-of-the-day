const fs = require('fs');
const path = require('path');
const os = require('os');
const { shuffleSoundtrack } = require('../src/shuffleSoundtrack');

describe('shuffleSoundtrack', () => {
  test('finds and shuffles soundtrack mp3 files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-test-'));
    try {
      // create dummy files
      fs.writeFileSync(path.join(tmpDir, 'intro.mp3'), '');
      fs.writeFileSync(path.join(tmpDir, 'main_soundtrack.mp3'), '');
      fs.writeFileSync(path.join(tmpDir, 'ending_soundtrack.mp3'), '');

      const shuffled = shuffleSoundtrack(tmpDir);
      expect(shuffled).toHaveLength(2);
      expect(shuffled.every(p => p.includes('soundtrack'))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
