(() => {
  'use strict';
  const { holes, Links, Journal, Audio } = window.TL;
  const $ = id => document.getElementById(id);
  const number = value => String(value).padStart(2, '0');
  const saveKey = 'turntide-links-tour-v1';
  let raw;
  try { raw = JSON.parse(localStorage.getItem(saveKey)); } catch { /* Use a fresh journal. */ }
  const journal = Journal.restore(raw);
  let hole = holes.find(item => item.id === journal.holeId);
  let angle, power, club, guide;
  let anim = null;
  let posting = false;
  let readout = '';
  const chart = $('chart');
  const fileMode = location.protocol === 'file:';
  Audio.setEnabled(journal.sound);

  function save() {
    try { localStorage.setItem(saveKey, JSON.stringify(journal)); }
    catch { $('save-note').textContent = 'Storage unavailable. This scorecard lasts for this visit.'; }
  }
  function stroke() { return { angle, power, club }; }
  function redraw() {
    const state = anim ? anim.start : journal.lie;
    const ball = anim?.result.frames[anim.index];
    window.TL.draw(chart, hole, state, { ...stroke(), guide, ball, moving: !!anim, level: ball?.level ?? state.level });
  }
  function updateAim() {
    angle = (angle % 360 + 360) % 360;
    $('bearing').value = Math.round(angle) + '°';
    $('strength').value = power + '%';
    $('power').value = power;
    $('putt').setAttribute('aria-pressed', String(club === 'putt'));
    $('chip').setAttribute('aria-pressed', String(club === 'chip'));
    // A short sight line helps read the initial direction without giving away the bank.
    guide = journal.lie.holed ? [] : Links.shoot(hole, journal.lie, stroke()).frames.slice(0, 13);
    redraw();
  }
  function prepare() {
    const target = hole.id === 1 && !journal.lie.qualified ? { x: 298, y: 106 }
      : hole.paddle && hole.id === 3 && !journal.lie.qualified ? hole.paddle : hole.cup;
    angle = Math.atan2(target.y - journal.lie.y, target.x - journal.lie.x) * 180 / Math.PI;
    power = 54;
    club = 'putt';
    readout = 'Tap or drag on the chart to aim.';
    updateAim();
  }
  function renderBook() {
    const count = Object.keys(journal.cards).length;
    $('book-count').textContent = count + ' / 20 holes';
    $('total').textContent = Journal.total(journal).toLocaleString();
    $('cards').replaceChildren();
    $('hole-picker').replaceChildren();
    for (const item of holes) {
      const card = journal.cards[item.id];
      const row = document.createElement('li');
      row.textContent = item.name + (card ? ' · ' + card.points.toLocaleString() + ' pts · best ' + card.leastStrokes + (card.stamp ? ' · stamped' : '') : ' · unscored');
      $('cards').append(row);
      const option = new Option(number(item.id) + ' · ' + item.name, item.id);
      option.disabled = item.id > Journal.unlocked(journal);
      $('hole-picker').add(option);
    }
    $('hole-picker').value = hole.id;
    $('passage').textContent = journal.cards[4] ? 'Gull Post landing is open. The ferry can call at its first island.' : 'Clear all four Gull Post holes to reopen the first landing.';
    const score = Journal.total(journal);
    $('post').disabled = fileMode || !score || posting || score <= journal.posted;
    if (!posting) {
      $('board-message').textContent = fileMode ? 'Local scorecard. Online posting requires the hosted arcade.' :
        !score ? 'Hole out to enter a score.' : score <= journal.posted ? 'Your current best is on the board.' : '';
    }
    $('sound').textContent = journal.sound ? 'Sound on' : 'Sound off';
    $('sound').setAttribute('aria-pressed', String(journal.sound));
  }
  function refresh() {
    const lie = anim ? anim.start : journal.lie;
    $('hole-number').textContent = 'Gull Post · Hole ' + number(hole.id) + ' / 04';
    $('hole-name').textContent = hole.name;
    $('par').textContent = 'Par ' + hole.par;
    $('brief').textContent = hole.hint;
    $('water-readout').textContent = lie.level ? 'Inner high · Outer low' : 'Inner low · Outer high';
    if (hole.paddle) $('water-readout').textContent += lie.level ? ' → Paddle lowers inner' : ' → Paddle raises inner';
    $('strokes').textContent = lie.strokes;
    $('stamp').textContent = lie.marked ? 'Inked' : 'Open';
    $('cup-state').textContent = lie.holed ? 'Filed' : lie.qualified ? 'Open' : 'Sealed';
    chart.setAttribute('aria-label', hole.name + '. ' + hole.hint + ' Tap to aim, or use arrows and Space.');
    $('notice').textContent = readout;
    for (const id of ['putt','chip','power','left','right','strike']) $(id).disabled = !!anim || lie.holed;
    $('replay').disabled = !!anim;
    $('strike').hidden = lie.holed;
    $('result-panel').hidden = !lie.holed;
    if (lie.holed) {
      $('result-title').textContent = hole.id === 4 ? 'Gull Post landing open' : 'Hole entered in the pilot book';
      $('result-copy').textContent = (lie.passage ? 'Via the ' + (lie.passage === 'quay' ? 'high quay' : 'sandbar') + '. ' : '') +
        lie.strokes + (lie.strokes === 1 ? ' stroke' : ' strokes') + ' · ' + Links.points(hole, lie).toLocaleString() + ' points' + (lie.marked ? ' · pilot stamp' : '');
      $('advance').textContent = hole.id === holes.length ? 'Open island scorecard' : 'Next · ' + holes[hole.id].name;
    }
    renderBook();
    redraw();
  }
  function enter(id) {
    if (anim || !Journal.enter(journal, id)) return;
    hole = holes.find(item => item.id === id);
    save();
    prepare();
    refresh();
    chart.focus({ preventScroll: true });
    $('hole-name').scrollIntoView({ block: 'nearest' });
  }
  function finish(animation) {
    anim = null;
    const events = animation.result.events;
    const notes = [];
    if (events.includes('bank')) notes.push('The bell rang. Cup open.');
    if (events.includes('lip')) notes.push('Dune lip cleared.');
    if (events.includes('paddle')) notes.push(journal.lie.level ? 'Inner basin raised.' : 'Inner basin drained.');
    if (events.includes('ride')) notes.push('Pontoon carried your lie.');
    if (events.includes('splash')) notes.push('Water. Recovery costs one extra stroke.');
    if (events.includes('stamp')) notes.push('Pilot stamp inked.');
    if (journal.lie.passage && !animation.start.passage) notes.push('Ferry passage charted.');
    if (events.includes('cup')) notes.push('Holed out.');
    readout = notes.join(' ') || (journal.lie.qualified ? 'Cup open. Play to the flag.' : 'Cup sealed. ' + hole.requirement + ' needed.');
    // Leave the new lie ready for a direct approach; the player still chooses the line and power.
    if (!journal.lie.holed) angle = Math.atan2(hole.cup.y - journal.lie.y, hole.cup.x - journal.lie.x) * 180 / Math.PI;
    updateAim();
    refresh();
  }
  function step(time) {
    if (!anim) return;
    const last = anim.result.frames.length - 1;
    const index = Math.min(last, Math.floor((time - anim.time) * 0.06));
    anim.index = Math.max(0, index);
    while (anim.nextCue <= anim.index) {
      const frame = anim.result.frames[anim.nextCue++];
      for (const cue of frame.cues || []) Audio.play(cue);
    }
    redraw();
    if (anim.index < last) requestAnimationFrame(step);
    else finish(anim);
  }
  function shoot() {
    if (anim || journal.lie.holed) return;
    Audio.unlock();
    const start = journal.lie;
    const result = Links.shoot(hole, start, stroke());
    Journal.settle(journal, hole, result.state);
    save();
    anim = { start, result, index: 0, time: performance.now(), nextCue: 0 };
    readout = 'Ball in play…';
    refresh();
    requestAnimationFrame(step);
  }
  function aimAt(event) {
    if (anim || journal.lie.holed) return;
    const rect = chart.getBoundingClientRect();
    const x = (event.clientX - rect.left) * 720 / rect.width;
    const y = (event.clientY - rect.top) * 450 / rect.height;
    angle = Math.atan2(y - journal.lie.y, x - journal.lie.x) * 180 / Math.PI;
    updateAim();
  }
  chart.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    chart.setPointerCapture(event.pointerId);
    aimAt(event);
  });
  chart.addEventListener('pointermove', event => { if (chart.hasPointerCapture(event.pointerId)) aimAt(event); });
  function turn(degrees) { angle += degrees; updateAim(); }
  $('left').onclick = () => turn(-2);
  $('right').onclick = () => turn(2);
  $('putt').onclick = () => { club = 'putt'; updateAim(); };
  $('chip').onclick = () => { club = 'chip'; updateAim(); };
  $('power').oninput = () => { power = Number($('power').value); updateAim(); };
  $('strike').onclick = shoot;
  document.addEventListener('keydown', event => {
    if (anim || journal.lie.holed || event.ctrlKey || event.altKey || event.metaKey ||
        event.target.closest('input,select,button,summary,a,textarea')) return;
    if (!['ArrowLeft','ArrowRight',' '].includes(event.key)) return;
    event.preventDefault();
    if (event.key === ' ') { if (!event.repeat) shoot(); }
    else turn(event.key === 'ArrowLeft' ? -2 : 2);
  });
  $('advance').onclick = () => {
    if (hole.id < holes.length) enter(hole.id + 1);
    else { $('book').open = true; $('book').scrollIntoView({ block: 'start' }); $('hole-picker').focus({ preventScroll: true }); }
  };
  $('replay').onclick = () => { $('book').open = false; enter(Number($('hole-picker').value)); };
  $('sound').onclick = () => {
    journal.sound = !journal.sound;
    Audio.setEnabled(journal.sound);
    Audio.unlock();
    Audio.play('bank');
    save();
    renderBook();
  };
  $('score-form').onsubmit = async event => {
    event.preventDefault();
    const name = $('keeper').value.trim().replace(/[^\w '.!\-]/g, '').slice(0, 20);
    const score = Journal.total(journal);
    if (posting || fileMode || !score || score <= journal.posted) return;
    if (!name) { $('board-message').textContent = 'Enter a keeper name using letters or numbers.'; return; }
    posting = true;
    $('post').disabled = true;
    $('board-message').textContent = 'Checking rank…';
    let message;
    try {
      const rankResponse = await fetch('/api/leaderboard/rank?gameId=turntide-links&score=' + score);
      if (!rankResponse.ok) throw new Error();
      const { rank } = await rankResponse.json();
      if (!Number.isInteger(rank) || rank < 1) throw new Error();
      if (rank > 20) message = 'Outside the top 20. Your local card is saved.';
      else {
        const res = await fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId: 'turntide-links', score, name }) });
        if (!res.ok) throw new Error();
        const receipt = await res.json();
        if (!receipt.ok) throw new Error();
        journal.posted = Math.max(journal.posted, score);
        save();
        message = 'Score posted · rank ' + (receipt.rank || rank) + '.';
      }
    } catch { message = 'Board unavailable. Your local card is saved.'; }
    finally { posting = false; renderBook(); $('board-message').textContent = message; }
  };
  prepare();
  refresh();
  if (window.ResizeObserver) new ResizeObserver(redraw).observe(chart);
  else window.addEventListener('resize', redraw);
})();
