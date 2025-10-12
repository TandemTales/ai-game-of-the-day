const { createPaddleSizeBuffManager } = require('../src/neonBrickBreaker/paddleBuff');

describe('paddle size buff manager', () => {
  function makeManager(log = []) {
    return {
      manager: createPaddleSizeBuffManager({
        baseWidth: 200,
        growthFactor: 1.5,
        onWidthChange: (newWidth, previousWidth) => {
          log.push({ newWidth, previousWidth });
        },
      }),
      log,
    };
  }

  test('combo 3 grows for 8 seconds then reverts', () => {
    const { manager, log } = makeManager();

    expect(manager.getCurrentWidth()).toBe(200);
    manager.handleComboChange(3);
    expect(manager.isActive()).toBe(true);
    expect(manager.getCurrentWidth()).toBeCloseTo(300);
    expect(manager.getRemainingTime()).toBeCloseTo(8);
    expect(log[0]).toEqual({ newWidth: 300, previousWidth: 200 });

    manager.update(4);
    expect(manager.isActive()).toBe(true);
    expect(manager.getRemainingTime()).toBeCloseTo(4);

    manager.update(4);
    expect(manager.isActive()).toBe(false);
    expect(manager.getCurrentWidth()).toBe(200);
    expect(manager.getRemainingTime()).toBe(0);
    expect(log[log.length - 1]).toEqual({ newWidth: 200, previousWidth: 300 });
  });

  test('combo 5 grows for 12 seconds then reverts', () => {
    const { manager } = makeManager();

    manager.handleComboChange(5);
    expect(manager.isActive()).toBe(true);
    expect(manager.getCurrentWidth()).toBeCloseTo(300);
    expect(manager.getRemainingTime()).toBeCloseTo(12);

    manager.update(6);
    expect(manager.getRemainingTime()).toBeCloseTo(6);

    manager.update(6);
    expect(manager.isActive()).toBe(false);
    expect(manager.getCurrentWidth()).toBe(200);
    expect(manager.getRemainingTime()).toBe(0);
  });

  test('multiple triggers refresh duration not stack size', () => {
    const { manager, log } = makeManager();

    manager.handleComboChange(3);
    expect(manager.getCurrentWidth()).toBeCloseTo(300);

    manager.update(6);
    expect(manager.getRemainingTime()).toBeCloseTo(2);

    manager.handleComboChange(3);
    expect(manager.getRemainingTime()).toBeCloseTo(8);
    expect(manager.getCurrentWidth()).toBeCloseTo(300);

    manager.handleComboChange(5);
    expect(manager.getRemainingTime()).toBeCloseTo(12);
    expect(manager.getCurrentWidth()).toBeCloseTo(300);

    manager.update(11.5);
    expect(manager.isActive()).toBe(true);
    expect(manager.getRemainingTime()).toBeCloseTo(0.5);

    manager.update(0.5);
    expect(manager.isActive()).toBe(false);
    expect(manager.getCurrentWidth()).toBe(200);

    const maxWidth = log.reduce((max, entry) => Math.max(max, entry.newWidth), 0);
    expect(maxWidth).toBeCloseTo(300);
  });
});
