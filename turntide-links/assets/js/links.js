(() => {
  'use strict';

  const TL = window.TL = window.TL || {};
  const DT = 1 / 120;
  const BALL_RADIUS = 2.5;
  const TURF_DRAG = 540;
  const inside = (point, box) => point.x >= box.x && point.x <= box.x + box.w &&
    point.y >= box.y && point.y <= box.y + box.h;
  const near = (point, target, radius) => target &&
    Math.hypot(point.x - target.x, point.y - target.y) <= radius;

  function deckAt(hole, level) {
    const deck = hole.deck;
    return deck && { ...deck, x: deck.x + level * deck.dx, y: deck.y + level * deck.dy };
  }

  function surface(hole, point, level) {
    const deck = deckAt(hole, level);
    if (deck && inside(point, deck)) return 'deck';
    if (level === 0 && hole.sandbar && inside(point, hole.sandbar)) return 'sand';
    // Later patches of land are drawn on top of the island base.
    for (let i = hole.land.length - 1; i >= 0; i--) {
      if (inside(point, hole.land[i])) return hole.land[i].kind;
    }
    return 'water';
  }

  function start(hole, level = 0) {
    const tide = level === 1 ? 1 : 0;
    const deck = hole.teeOnDeck && hole.deck;
    return {
      x: hole.tee.x + (deck ? tide * deck.dx : 0),
      y: hole.tee.y + (deck ? tide * deck.dy : 0),
      level: tide, strokes: 0, marked: false, qualified: false, holed: false
    };
  }

  function points(hole, state) {
    if (!state.holed) return 0;
    return Math.max(100, 1000 + (hole.par - state.strokes) * 100) + (state.marked ? 250 : 0);
  }

  // Find the first face crossed, including diagonal approaches at a corner.
  function entryFace(last, next, box) {
    const dx = next.x - last.x;
    const dy = next.y - last.y;
    const edgeX = dx >= 0 ? box.x : box.x + box.w;
    const edgeY = dy >= 0 ? box.y : box.y + box.h;
    const tx = dx ? (edgeX - last.x) / dx : -Infinity;
    const ty = dy ? (edgeY - last.y) / dy : -Infinity;
    return tx >= ty ? { axis: 'x', edge: edgeX, sign: Math.sign(dx) } :
      { axis: 'y', edge: edgeY, sign: Math.sign(dy) };
  }

  function leftOpposite(point, box, face) {
    if (face.axis === 'x') return face.sign > 0 ? point.x > box.x + box.w : point.x < box.x;
    return face.sign > 0 ? point.y > box.y + box.h : point.y < box.y;
  }

  function shoot(hole, lie, shot) {
    const state = { ...lie };
    const frames = [];
    const events = [];
    let pendingCues = [];
    const note = cue => {
      if (!events.includes(cue)) events.push(cue);
      if (!pendingCues.includes(cue)) pendingCues.push(cue);
    };
    const frame = (x, y, z, level) => {
      const sample = { x, y, z, level };
      if (pendingCues.length) sample.cues = pendingCues;
      frames.push(sample);
      pendingCues = [];
    };
    if (!lie.holed) note('swing');
    frame(state.x, state.y, 0, state.level);
    if (lie.holed) return { state, frames, events };

    const power = Math.max(1, Math.min(100, Number(shot.power) || 1)) / 100;
    const angle = (Number(shot.angle) || 0) * Math.PI / 180;
    const chip = shot.club === 'chip';
    const speed = chip ? 450 * Math.sqrt(power) : Math.sqrt(2 * TURF_DRAG * 400 * power);
    let vx = speed * Math.cos(angle);
    let vy = speed * Math.sin(angle);
    let flying = chip;
    const airTime = 0.78 * Math.sqrt(power);
    const rails = hole.rails.map(rail => ({
      rail, face: null,
      box: { x: rail.x - BALL_RADIUS, y: rail.y - BALL_RADIUS,
        w: rail.w + BALL_RADIUS * 2, h: rail.h + BALL_RADIUS * 2 }
    }));
    let transfer = false;
    let onPaddle = near(state, hole.paddle, 13);
    let lost = false;
    state.strokes++;

    // At full power a tick travels less than the diameter of a cup. The same
    // steps feed the preview, live animation, saved result and route tests.
    for (let tick = 1; tick <= 600; tick++) {
      const last = { x: state.x, y: state.y };
      state.x += vx * DT;
      state.y += vy * DT;
      const phase = Math.min(1, tick * DT / airTime);
      const z = flying ? 4 * 54 * power * phase * (1 - phase) : 0;

      for (const obstacle of rails) {
        const { rail, box } = obstacle;
        if (!inside(state, box)) {
          if (rail.kind === 'lip' && obstacle.face && leftOpposite(state, box, obstacle.face)) {
            // Skirting an end or landing against the face is not a carry.
            const across = rail.h >= rail.w ? 'x' : 'y';
            if (obstacle.face.axis === across) {
              note('lip');
              if (hole.id === 2) state.qualified = true;
            }
          }
          obstacle.face = null;
          continue;
        }
        if (!obstacle.face) obstacle.face = entryFace(last, state, box);
        if (z > rail.height) continue;
        const face = obstacle.face;
        state[face.axis] = face.edge - face.sign * 0.05;
        if (face.axis === 'x') vx *= -0.83;
        else vy *= -0.83;
        obstacle.face = null;
        if (rail.kind === 'bank' && !chip) {
          note('bank');
          if (hole.id === 1) state.qualified = true;
        } else {
          note('rail');
        }
      }

      if (flying && phase === 1) {
        flying = false;
        vx *= 0.55;
        vy *= 0.55;
      }
      const ground = surface(hole, state, state.level);
      if (!flying && ground === 'water') {
        lost = true;
        note('splash');
        frame(state.x, state.y, 0, state.level);
        break;
      }
      if (chip && !flying && !events.includes('land')) {
        note('land');
        note(ground);
      }
      const touchingPaddle = z <= 8 && near(state, hole.paddle, 13);
      if (touchingPaddle && !onPaddle && !transfer) {
        transfer = true;
        note('paddle');
        if (hole.id === 3) state.qualified = true;
      }
      onPaddle = touchingPaddle;
      if (!state.marked && z <= 9 && near(state, hole.stamp, 14)) {
        state.marked = true;
        note('stamp');
      }
      if (!flying && last.x < hole.passageX && state.x >= hole.passageX) {
        const onSandbar = state.level === 0 && inside(state, hole.sandbar);
        if (ground === 'quay' || onSandbar) {
          state.passage = onSandbar ? 'sandbar' : 'quay';
          state.qualified = true;
          note('passage');
        }
      }
      if (!flying && near(state, hole.cup, 10) && state.qualified && Math.hypot(vx, vy) <= 200) {
        state.x = hole.cup.x;
        state.y = hole.cup.y;
        state.holed = true;
        note('cup');
        break;
      }
      if (tick % 2 === 0) frame(state.x, state.y, z, state.level);
      if (flying) continue;

      if (hole.slope && inside(state, hole.slope)) {
        const length = Math.hypot(hole.slope.dx, hole.slope.dy) || 1;
        vx += 105 * DT * hole.slope.dx / length;
        vy += 105 * DT * hole.slope.dy / length;
      }
      const rolling = Math.hypot(vx, vy);
      const drag = ground === 'sand' ? 900 : ground === 'quay' ? 500 : TURF_DRAG;
      if (rolling <= drag * DT) break;
      const fraction = 1 - drag * DT / rolling;
      vx *= fraction;
      vy *= fraction;
    }

    // The sluice finishes transferring water after the ball comes to rest.
    // Even a failed stroke can shift the pontoon under the previous lie.
    if (lost) {
      state.x = lie.x;
      state.y = lie.y;
      state.strokes++;
    }
    if (transfer) {
      const oldLevel = state.level;
      const newLevel = 1 - oldLevel;
      const deck = deckAt(hole, oldLevel);
      const aboard = !state.holed && deck && inside(state, deck);
      if (aboard) note('ride');
      const dx = aboard ? (newLevel - oldLevel) * deck.dx : 0;
      const dy = aboard ? (newLevel - oldLevel) * deck.dy : 0;
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const moving = { x: state.x + dx * t, y: state.y + dy * t };
        if (aboard && !lost && !state.marked && near(moving, hole.stamp, 14)) {
          state.marked = true;
          note('stamp');
        }
        frame(moving.x, moving.y, 0, oldLevel + (newLevel - oldLevel) * t);
      }
      state.level = newLevel;
      state.x += dx;
      state.y += dy;
      if (!state.holed && surface(hole, state, newLevel) === 'water') {
        note('splash');
        if (!lost) state.strokes++;
        const previousDeck = deck && inside(lie, deck);
        const previous = previousDeck
          ? { x: lie.x + (newLevel - oldLevel) * deck.dx, y: lie.y + (newLevel - oldLevel) * deck.dy }
          : lie;
        const drop = surface(hole, previous, newLevel) === 'water' ? start(hole, newLevel) : previous;
        state.x = drop.x;
        state.y = drop.y;
      }
    }
    frame(state.x, state.y, 0, state.level);
    return { state, frames, events };
  }

  TL.Links = { start, shoot, points };
})();
