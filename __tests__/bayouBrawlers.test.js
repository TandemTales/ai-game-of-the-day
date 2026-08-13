const fs = require('fs');
const path = require('path');
const vm = require('vm');

const gameRoot = path.join(__dirname, '..', 'bayou-brawlers');
const indexPath = path.join(gameRoot, 'index.html');
const source = fs.readFileSync(indexPath, 'utf8');

describe('Bayou Brawlers release safeguards', () => {
  test('all inline and premium UI scripts parse', () => {
    const inlineScripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
      .map((match) => match[1])
      .filter((script) => script.trim());

    inlineScripts.forEach((script, index) => {
      expect(() => new vm.Script(script, { filename: `bayou-inline-${index + 1}.js` })).not.toThrow();
    });
    expect(() => new vm.Script(
      fs.readFileSync(path.join(gameRoot, 'premium-ui.js'), 'utf8'),
      { filename: 'premium-ui.js' }
    )).not.toThrow();
  });

  test('literal media references resolve to shipped assets', () => {
    const media = [...source.matchAll(/["'](assets\/[^"']+\.(?:png|jpg|jpeg|svg|mp3|wav))["']/gi)]
      .map((match) => match[1]);
    const missing = [...new Set(media)].filter((relativePath) => (
      !fs.existsSync(path.join(gameRoot, relativePath))
    ));

    expect(missing).toEqual([]);
    expect(source).toContain('BB_sfx_sweetykins_hurt.mp3');
    expect(source).not.toContain('BB_sfx_sweetykins_hit.mp3');
  });

  test('the full campaign is reachable and late stages use painterly assets', () => {
    expect(source).toContain('const CAMPAIGN_STAGE_LIMIT = levels.length;');
    expect(source).toContain("'background-world-tree': 'assets/BB_bg_hauntedBayou001.png'");
    expect(source).toContain("'background-goblin-tower': 'assets/BB_bg_mirewatch001.png'");
    expect(source).toContain("'background-final-theatre': 'assets/BB_bg_hauntedHouse001.png'");
  });

  test('level-up choices are limited to upgrades with gameplay hooks', () => {
    expect(source).toContain('const IMPLEMENTED_UPGRADE_IDS = new Set([');
    expect(source).toContain('.filter((entry) => IMPLEMENTED_UPGRADE_IDS.has(entry.id))');
  });

  test('touch and defeat recovery controls remain available', () => {
    expect(source).toContain('data-input="block" aria-label="Block"');
    expect(source).toContain('id="pauseBtn"');
    expect(source).toContain('id="retryDefeatBtn"');
    expect(source).toContain('id="defeatRosterBtn"');
  });
});
