const { shuffle } = require('../src/shuffle');

describe('shuffle', () => {
  test('returns a permutation of the original word', () => {
    const word = 'algorithm';
    const shuffled = shuffle(word);
    expect(shuffled).toHaveLength(word.length);
    expect(shuffled.split('').sort().join('')).toBe(word.split('').sort().join(''));
  });

  test('eventually produces a different arrangement', () => {
    const word = 'function';
    let different = false;
    for (let i = 0; i < 10; i++) {
      if (shuffle(word) !== word) {
        different = true;
        break;
      }
    }
    expect(different).toBe(true);
  });
});
