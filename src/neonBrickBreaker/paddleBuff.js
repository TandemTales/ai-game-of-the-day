function createPaddleSizeBuffManager(options = {}) {
  const {
    baseWidth,
    growthFactor = 1.5,
    onWidthChange,
  } = options;

  if (!Number.isFinite(baseWidth) || baseWidth <= 0) {
    throw new Error('baseWidth must be a positive number');
  }

  const resolvedGrowth = Number.isFinite(growthFactor) && growthFactor > 0
    ? growthFactor
    : 1;

  const buffDurations = {
    three: 8,
    five: 12,
  };

  let currentWidth = baseWidth;
  let buffTimer = 0;
  let buffActive = false;

  function setWidth(newWidth) {
    const previousWidth = currentWidth;
    currentWidth = newWidth;
    if (typeof onWidthChange === 'function') {
      onWidthChange(newWidth, previousWidth);
    }
  }

  function deactivate() {
    const wasActive = buffActive;
    buffActive = false;
    buffTimer = 0;
    if (wasActive || currentWidth !== baseWidth) {
      setWidth(baseWidth);
    }
  }

  function activate(durationSeconds) {
    buffActive = true;
    buffTimer = durationSeconds;
    const buffWidth = baseWidth * resolvedGrowth;
    setWidth(buffWidth);
  }

  function handleComboChange(comboMultiplier) {
    const comboValue = Number.isFinite(comboMultiplier) ? comboMultiplier : 0;

    if (comboValue >= 5) {
      activate(buffDurations.five);
    } else if (comboValue >= 3) {
      activate(buffDurations.three);
    } else {
      deactivate();
    }
  }

  function update(dt) {
    if (!buffActive) return;
    buffTimer -= dt;
    if (buffTimer <= 0) {
      deactivate();
    }
  }

  function getRemainingTime() {
    return buffTimer;
  }

  function isActive() {
    return buffActive;
  }

  function getCurrentWidth() {
    return currentWidth;
  }

  function reset() {
    deactivate();
  }

  return {
    handleComboChange,
    update,
    getRemainingTime,
    isActive,
    getCurrentWidth,
    reset,
    get baseWidth() {
      return baseWidth;
    },
    get growthFactor() {
      return resolvedGrowth;
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createPaddleSizeBuffManager };
}

if (typeof window !== 'undefined') {
  window.createPaddleSizeBuffManager = createPaddleSizeBuffManager;
}
