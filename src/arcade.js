(() => {
  'use strict';
  const cards = [...document.querySelectorAll('.game-card')];
  const search = document.querySelector('#game-search');
  const filters = [...document.querySelectorAll('.filter')];
  let category = 'all';

  function filterGames() {
    const query = search.value.trim().toLowerCase();
    let count = 0;
    cards.forEach(card => {
      const matches = (category === 'all' || card.dataset.category.split(' ').includes(category)) &&
        card.dataset.search.includes(query);
      card.hidden = !matches;
      if (matches) count++;
    });
    document.querySelector('#game-count').textContent = `${count} ${count === 1 ? 'game' : 'games'}`;
    document.querySelector('#empty-state').hidden = count !== 0;
  }
  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.filter;
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    filterGames();
  }));
  search.addEventListener('input', filterGames);
  document.querySelector('#reset-search').addEventListener('click', () => {
    search.value = '';
    filters[0].click();
    search.focus();
  });
  document.querySelector('#surprise-me').addEventListener('click', () => {
    const card = cards[Math.floor(Math.random() * cards.length)];
    window.location.href = card.querySelector('.card-play').href;
  });

  function localRating(id) {
    try {
      const value = Number(localStorage.getItem(`rating:${id}`));
      return value >= 1 && value <= 5 && Number.isInteger(value) ? value : 0;
    } catch { return 0; }
  }
  function ratingGroups(id) {
    return [...document.querySelectorAll('.rate')].filter(group => group.dataset.id === id);
  }
  function paintRating(id, mine, stats, message) {
    ratingGroups(id).forEach(group => {
      group.querySelectorAll('button').forEach(star => {
        star.classList.toggle('selected', Number(star.dataset.star) <= mine);
        star.setAttribute('aria-pressed', String(Number(star.dataset.star) === mine));
      });
      const score = group.nextElementSibling;
      score.classList.toggle('error', Boolean(message));
      if (message) score.textContent = message;
      else if (stats && Number(stats.votes) > 0) {
        score.textContent = `${stats.average} / 5 · ${stats.votes} votes${mine ? ` · Yours: ${mine}` : ''}`;
      } else score.textContent = mine ? `You rated ${mine} / 5` : stats ? 'Be the first to rate' : 'Ratings unavailable';
    });
  }
  async function loadRating(id) {
    let stats;
    try {
      const response = await fetch(`/api/ratings/${encodeURIComponent(id)}`);
      if (response.ok) stats = await response.json();
    } catch { /* The catalog remains playable when ratings are offline. */ }
    paintRating(id, localRating(id), stats);
  }
  const pending = new Set();
  async function submitRating(id, rating) {
    if (pending.has(id)) return;
    pending.add(id);
    ratingGroups(id).forEach(group => group.querySelectorAll('button').forEach(button => { button.disabled = true; }));
    try {
      const response = await fetch('/api/rate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: id, stars: rating })
      });
      if (!response.ok) throw new Error('Unable to save');
      try { localStorage.setItem(`rating:${id}`, String(rating)); } catch { /* Storage is optional. */ }
      paintRating(id, rating, null);
      // Refresh aggregate stats without losing the vote if storage is blocked.
      try {
        const result = await fetch(`/api/ratings/${encodeURIComponent(id)}`);
        if (result.ok) paintRating(id, rating, await result.json());
      } catch { /* The successful vote is already reflected locally. */ }
    } catch {
      paintRating(id, localRating(id), null, 'Could not save. Please try again.');
    } finally {
      pending.delete(id);
      ratingGroups(id).forEach(group => group.querySelectorAll('button').forEach(button => { button.disabled = false; }));
    }
  }
  document.querySelectorAll('.rate').forEach(group => {
    group.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      submitRating(group.dataset.id, Number(button.dataset.star));
    }));
  });
  new Set([...document.querySelectorAll('.rate')].map(group => group.dataset.id)).forEach(loadRating);
})();
