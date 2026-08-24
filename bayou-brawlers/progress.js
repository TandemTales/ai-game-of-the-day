const STATUS_VALUES = [
  'Not Audited',
  'Baseline Recorded',
  'In Development',
  'Awaiting Critic Review',
  'Needs Revision',
  'Retesting',
  'Vertical Slice Approved',
  'Applied to Full Game',
  'Regression Found',
  'Quality Gate Passed'
];

const commonLinks = {
  play: { label: 'Play build', href: 'index.html' },
  baseline: { label: 'Baseline', href: 'docs/BASELINE.md' },
  matrix: { label: 'Benchmark matrix', href: 'docs/BENCHMARK_MATRIX.md' },
  coreTests: { label: 'Core regression tests', href: 'tests/core.test.mjs' },
  contentTests: { label: 'Content contract tests', href: 'tests/content.test.mjs' },
  stateTests: { label: 'Lifecycle regression tests', href: 'tests/game-state.test.mjs' }
};

const roomLink = (room, label) => ({
  label,
  href: `index.html?debug=1&room=${room}`
});

const systems = [
  {
    id: 'input-movement',
    name: 'Input & Movement',
    owner: 'Player systems',
    status: 'Retesting',
    baseline: 'No inherited running build existed, so dropped-input frequency, turn response, lane precision, landing behavior, and device parity have no observed baseline.',
    target: 'Reliable keyboard and standard-gamepad control, documented buffer behavior, precise lane movement, and measured response that is competitive with the references or intentionally explained.',
    change: 'Moved action-buffer aging from wall-clock time to active simulation time so hitstop and slow frames cannot expire a queued transition; added keyboard/gamepad mapping, normalized diagonals, dead zone handling, and frame-tagged logs.',
    evidence: 'Automated regression passes 16/16. A browser session recorded directional keyboard movement, four frame-tagged light inputs, and a complete 52-damage chain through hitstop. Standard-gamepad parity remains unmeasured.',
    critic: 'Fresh-play critic reported that controls registered reliably; browser-input cadence prevented a fair branch-chain judgment and no physical gamepad was available.',
    gap: 'Capture matching controller traces and verify reversal, landing, hitstun, wakeup, and boundary transitions.',
    regression: 'Automated suite passed 16/16 on 23 August 2026; stationary-room keyboard replay and pause/resume input hygiene passed. Controller and adjacent-state replay remain pending.',
    next: 'Run controller and boundary/wakeup transition checks, then send the evidence to a fresh critic.',
    links: [commonLinks.play, roomLink('stationary', 'Stationary lab'), roomLink('boundary', 'Boundary lab'), commonLinks.coreTests, commonLinks.matrix]
  },
  {
    id: 'combat-contact',
    name: 'Combat Contact',
    owner: 'Combat systems',
    status: 'Retesting',
    baseline: 'There is no prior gameplay recording showing whether visual alignment, lane tolerance, hit confirmation, recovery, or whiffs behave consistently.',
    target: 'Hits and misses must agree with visible alignment; contact should coordinate reaction, sound, hitstop, knockback, and readable recovery without hiding enemy actions.',
    change: 'Added restrained gold motion arcs to every light-chain active window so reach remains visible on whiff while the existing impact flash distinguishes contact.',
    evidence: 'Automated regression passes 16/16. A post-fix live capture shows the light-four arc and the unchanged four-hit/52-damage result; launcher (43), throw (31), aerial (16), and special (26) routes remain intact.',
    critic: 'Fresh critic found light contact responsive and heavy impact convincing, but light hit-versus-whiff and reach were under-signaled without debug text.',
    gap: 'Have a fresh labels-off player compare edge-range light hits and whiffs and confirm the arc does not cover enemy telegraphs.',
    regression: 'Combat-helper checks and five live kit routes passed; armor, whiff, reduced-feedback, and controller-contact replays remain pending.',
    next: 'Complete fresh critic review, then revise only the single largest contact/readability gap.',
    links: [roomLink('stationary', 'Contact lab'), roomLink('armored', 'Armor lab'), roomLink('grab-throw', 'Grab lab'), commonLinks.coreTests, commonLinks.matrix]
  },
  {
    id: 'combat-flow',
    name: 'Combat Flow & Depth',
    owner: 'Combat systems',
    status: 'Retesting',
    baseline: 'No predecessor combo routes, dominant-strategy evidence, cancel behavior, resource economy, or recovery rhythm can be observed.',
    target: 'An approachable complete kit with dependable chains, alternate choices, launch and aerial follow-up, throws, defense, crowd tools, and no obvious infinite or single dominant answer.',
    change: 'Defined the vertical-slice kit around light chains, launcher, special, jump, dodge, sprint, grab, and throw; added per-encounter scoring checkpoints after an exploit audit found restart farming.',
    evidence: 'Automated regression passes 16/16, including a complete buffered route and score-safe encounter restart. Live scripted play confirmed 52-damage basic, 43-damage launcher, 31-damage throw, 16-damage aerial, and 26-damage special routes.',
    critic: 'Advanced source audit found restart score farming; the checkpoint fix is covered automatically but the exact live kill→restart loop was not completed before browser recall.',
    gap: 'Live-verify checkpoint scoring, then probe repeated normal-hit/knockdown pressure against Captain Mire and dodge/dash dominance.',
    regression: 'Basic, launcher, aerial, grab, and special routes passed live; dash, dodge-cancel, wakeup, crowd-control, and exploit searches remain under review.',
    next: 'Apply the advanced-player critic’s single highest-priority finding and replay adjacent routes.',
    links: [roomLink('aerial', 'Aerial lab'), roomLink('grab-throw', 'Grab lab'), roomLink('surrounded', 'Crowd-control lab'), commonLinks.coreTests, commonLinks.stateTests, commonLinks.matrix]
  },
  {
    id: 'enemy-behavior',
    name: 'Enemy Behavior',
    owner: 'Enemy & AI',
    status: 'Retesting',
    baseline: 'No inherited enemies are available to observe for approach, spacing, coordination, telegraph, recovery, offscreen pressure, or multiplayer response.',
    target: 'Distinct enemies should ask different positioning and priority questions while bounded attacker pressure, readable commitments, and punishable recovery keep crowds fair.',
    change: 'Added shape-first role cues: Deckhand hook, Skirmisher forward lean/twin blades, Slinger wide hat/slingshot/pouch, and Levee Breaker oversized shoulder armor.',
    evidence: 'Automated regression passes 16/16. Live role rooms showed distinct decisions; fresh mixed-room play found sensible spacing and the stress critic confirmed the attacker cap at 2/2.',
    critic: 'Fresh critic understood roles with debug labels, but without labels the three normal enemies read mainly as similarly shaped figures separated by color and small props.',
    gap: 'Run a successful labels-off role-identification retest; the new silhouettes are implemented but not independently approved.',
    regression: 'Role contracts and idle-player pressure cycles passed; active defense, offscreen prevention, opposite-side, and large-crowd replays remain pending.',
    next: 'Complete the fresh mixed-pressure review and fix its single largest role-readability gap.',
    links: [roomLink('weak-melee', 'Melee lab'), roomLink('aggressive', 'Rusher lab'), roomLink('ranged', 'Ranger lab'), roomLink('mixed', 'Mixed lab'), commonLinks.contentTests]
  },
  {
    id: 'encounter-design',
    name: 'Encounter Design',
    owner: 'Encounter design',
    status: 'In Development',
    baseline: 'No full-stage session exists to establish encounter length, dead time, filler waves, arena pressure, reinforcement timing, or recovery opportunities.',
    target: 'Each encounter should have a legible tactical purpose, escalate through intentional enemy combinations, use space or hazards meaningfully, and avoid health-padding or filler.',
    change: 'Declared sixteen focused room scenarios and a short vertical-slice structure for isolated, mixed, surrounded, elite, hazard, boss, and stress conditions.',
    evidence: 'Automated regression passes 16/16 and confirms all sixteen room IDs. A fresh critic reached the first encounter and observed its onboarding, but failed before clearing a wave; complete encounter pacing remains pending.',
    critic: 'Fresh critic confirmed clear “Move Right” and “Clear the landing” onboarding, but did not complete the encounter, so pacing cannot yet be approved.',
    gap: 'Prove that one complete mixed encounter escalates without repetitive downtime or unfair crossfire.',
    regression: 'Room registration and isolated mixed-pressure smoke checks passed; complete-encounter, camera progression, and reinforcement pacing remain pending.',
    next: 'Record the mixed encounter from intro through clear, annotate spawn purpose and downtime, then revise only the largest pacing gap.',
    links: [roomLink('opposite', 'Opposite-side lab'), roomLink('mixed', 'Mixed lab'), roomLink('elite', 'Elite lab'), commonLinks.contentTests, commonLinks.baseline]
  },
  {
    id: 'bosses',
    name: 'Bosses',
    owner: 'Boss design',
    status: 'Retesting',
    baseline: 'No inherited boss fight exists to measure telegraph clarity, vulnerability windows, repetition, health, failure recovery, or encounter duration.',
    target: 'Captain Mire should test learned movement and combat skills through readable cleave, charge, volley, and slam patterns with clear recovery and phase escalation.',
    change: 'Kept damage/timing intact; after the first retest failed, strengthened the warning to solid orange lane geometry with chevrons and made recovery a deep weapon-to-floor slump with a green opening ring and stagger sparks.',
    evidence: 'Automated regression passes 16/16. A labels-off browser capture now shows the deep slump, floor weapon, green ring, and stars; the title-return DOM also contains no stale objective.',
    critic: 'First focused retest still confused windup and recovery. The second revision’s independent retest was inconclusive because browser input timed out before labels could be hidden, so approval is not claimed.',
    gap: 'Obtain one successful independent labels-off recognition/punish pass, then complete and learn all three phases.',
    regression: 'Boss constructor and live pattern smoke checks passed; phase transitions, full completion, failure/restart, and performance comparison remain pending.',
    next: 'Capture first-seen and learned boss attempts; annotate telegraph, active, recovery, and damage-opportunity readability.',
    links: [roomLink('boss', 'Boss pattern lab'), commonLinks.play, commonLinks.contentTests, commonLinks.matrix]
  },
  {
    id: 'presentation-feedback',
    name: 'Presentation & Feedback',
    owner: 'Presentation',
    status: 'Retesting',
    baseline: 'The two supplied swamp images establish visual identity, but there is no prior animation, effect, camera, sound, or crowded-readability recording.',
    target: 'Coordinated pose, hit flash, restrained shake, sound, recoil, and camera cues should make outcomes immediate while comfort settings keep hazards readable.',
    change: 'Added readable light-chain arcs and primed decoded image/vector render paths on the real canvas before gameplay; a hidden 18-actor warmup was tested, regressed stationary tails to 73 ms, and was removed.',
    evidence: 'Post-revision direct stress loads sampled 2.00/22.00 ms and 2.10/17.63 ms current/MAX versus a 0.80/19.30 ms stationary sample, with no console errors. Earlier stress tails were 50–58 ms; these short samples are not a distribution.',
    critic: 'Fresh critic preferred the menus/accessibility but chose a modern benchmark for combat readability; stress criticism found both local visual congestion and 50–58 ms load tails.',
    gap: 'Independently pass the second boss-pose revision, retest light arcs, and prove the apparent tail improvement with seeded p50/p95/p99 and heap data.',
    regression: 'Normal-room visual and comfort-control checks passed with no console errors; audio-off, flash-off, stress-room, and longer frame-time comparisons remain pending.',
    next: 'Record representative hit classes with default and reduced settings, then verify effects never conceal attacks or hazards.',
    links: [roomLink('stationary', 'Impact lab'), roomLink('crowd', 'Crowd lab'), roomLink('stress', 'Effects stress lab'), commonLinks.baseline]
  },
  {
    id: 'character-differentiation',
    name: 'Character Differentiation',
    owner: 'Character design',
    status: 'In Development',
    baseline: 'This from-scratch vertical slice currently targets one playable character, so no same-build comparison of rhythm, range, power, routes, roles, or choice balance exists.',
    target: 'The vertical-slice fighter must first establish a coherent identity; any later character should change preferred decisions rather than merely changing statistics.',
    change: 'Scoped the first slice to one complete kit so its mechanics can be proven before character-wide propagation.',
    evidence: 'No live kit-identity interview or second-character comparison exists. Character differentiation is intentionally not claimable yet.',
    critic: 'Pending — the sole kit has not yet received an independent identity verdict.',
    gap: 'Prove that the first fighter has a recognizable play rhythm before designing a comparison character.',
    regression: 'Not testable as a comparison until the base kit passes its combat gate.',
    next: 'Have a fresh player describe the kit’s preferred positioning, risk, and signature decisions without prompting.',
    links: [commonLinks.play, roomLink('mixed', 'Mixed lab'), commonLinks.matrix]
  },
  {
    id: 'multiplayer',
    name: 'Multiplayer',
    owner: 'Lead integration',
    status: 'Not Audited',
    baseline: 'No earlier multiplayer implementation was supplied, and the new vertical slice currently has no verified local or online multiplayer path.',
    target: 'If multiplayer enters scope, controller assignment, camera, overlap, scaling, revives, conflicts, pause, join/leave, and worst-case readability need dedicated evidence.',
    change: 'Kept multiplayer outside the initial single-player proof instead of claiming unsupported parity.',
    evidence: 'No multiplayer code path or session evidence is available; multiplayer quality gates are pending, not passed or waived.',
    critic: 'Pending — no multiplayer build exists to review.',
    gap: 'Decide intended player count and local-versus-online scope before implementation.',
    regression: 'Not testable until a multiplayer contract and runnable path exist.',
    next: 'After the single-player slice passes, define multiplayer scope and acceptance cases before adding shared-state code.',
    links: [commonLinks.baseline, roomLink('stress', 'Stress-room contract'), commonLinks.matrix]
  },
  {
    id: 'complete-game',
    name: 'Complete Game Experience',
    owner: 'Lead integration',
    status: 'In Development',
    baseline: 'There is no inherited campaign to play from onboarding through credits, and no prior save, progression, checkpoint, loading, failure, or full-game pacing evidence.',
    target: 'A coherent path through onboarding, selection, difficulty, stages, progression, failure, restart, results, settings, saving/loading, accessibility, and credits after the slice is approved.',
    change: 'Created title, how-to, difficulty, settings, pause, restart, results, replay, and progress-page entry points for the first local slice.',
    evidence: 'Fresh play covered title, help, settings, difficulty, onboarding, normal-run failure/results, and title return. A post-fix accessible-DOM check verified that title return no longer exposes the stale objective; campaign victory remains unobserved.',
    critic: 'Fresh critic rated menus, hierarchy, accessibility breadth, and clean failure handling as the strongest areas, but the run ended at the first encounter after 2:31.',
    gap: 'Complete and observe one end-to-end vertical-slice victory, including Brawl Again timing and settings reload.',
    regression: 'Menu, failure/results, remap/restore, and comfort-setting smoke checks passed; restart timing, settings reload, and end-to-end campaign completion remain pending.',
    next: 'Run a fresh-player slice from title to results and record comprehension, failure recovery, restart, settings, and defects.',
    links: [commonLinks.play, commonLinks.baseline, commonLinks.stateTests, commonLinks.matrix]
  }
];

const template = document.querySelector('#system-template');
const list = document.querySelector('#systems-list');
const searchFilter = document.querySelector('#search-filter');
const statusFilter = document.querySelector('#status-filter');
const ownerFilter = document.querySelector('#owner-filter');
const attentionFilter = document.querySelector('#attention-filter');
const resetFilters = document.querySelector('#reset-filters');
const resultCount = document.querySelector('#result-count');
const emptyState = document.querySelector('#empty-state');

const statusSlug = (status) => `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

function addEvidenceLinks(container, links) {
  for (const link of links) {
    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.textContent = link.label;
    container.append(anchor);
  }
}

function renderSystems() {
  const fragment = document.createDocumentFragment();

  systems.forEach((system, index) => {
    if (!STATUS_VALUES.includes(system.status)) {
      throw new Error(`Unsupported progress status: ${system.status}`);
    }

    const card = template.content.firstElementChild.cloneNode(true);
    card.id = `system-${system.id}`;
    card.classList.add(statusSlug(system.status));
    card.dataset.status = system.status;
    card.dataset.owner = system.owner;
    card.dataset.search = Object.values(system)
      .filter((value) => typeof value === 'string')
      .join(' ')
      .toLowerCase();

    card.querySelector('.system-index').textContent = String(index + 1).padStart(2, '0');
    card.querySelector('.system-owner').textContent = system.owner;
    card.querySelector('.system-name').textContent = system.name;
    card.querySelector('.status-pill').textContent = system.status;
    card.querySelector('.system-gap').textContent = system.gap;
    card.querySelector('.system-next').textContent = system.next;
    card.querySelector('.system-regression').textContent = system.regression;

    for (const field of ['name', 'owner', 'status', 'baseline', 'target', 'change', 'evidence', 'critic', 'gap', 'regression', 'next']) {
      card.querySelector(`[data-field="${field}"]`).textContent = system[field];
    }
    addEvidenceLinks(card.querySelector('[data-field="links"]'), system.links);

    const toggle = card.querySelector('.card-toggle');
    const detail = card.querySelector('.system-detail');
    const detailId = `${system.id}-detail`;
    detail.id = detailId;
    toggle.setAttribute('aria-controls', detailId);
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      toggle.querySelector('span').textContent = expanded ? 'Inspect evidence' : 'Hide evidence';
      detail.hidden = expanded;
    });

    fragment.append(card);
  });

  list.replaceChildren(fragment);
}

function populateOwners() {
  const owners = [...new Set(systems.map((system) => system.owner))].sort();
  for (const owner of owners) {
    const option = document.createElement('option');
    option.value = owner;
    option.textContent = owner;
    ownerFilter.append(option);
  }
}

function updateMetrics() {
  const activeStatuses = new Set(['In Development', 'Needs Revision', 'Retesting', 'Regression Found']);
  const passedStatuses = new Set(['Vertical Slice Approved', 'Applied to Full Game', 'Quality Gate Passed']);
  document.querySelector('#metric-total').textContent = systems.length;
  document.querySelector('#metric-active').textContent = systems.filter((system) => activeStatuses.has(system.status)).length;
  document.querySelector('#metric-review').textContent = systems.filter((system) => system.status === 'Awaiting Critic Review').length;
  document.querySelector('#metric-passed').textContent = systems.filter((system) => passedStatuses.has(system.status)).length;
}

function applyFilters() {
  const query = searchFilter.value.trim().toLowerCase();
  const status = statusFilter.value;
  const owner = ownerFilter.value;
  const attentionOnly = attentionFilter.checked;
  const attentionStatuses = new Set(['Not Audited', 'Needs Revision', 'Regression Found']);
  let visible = 0;

  for (const card of list.children) {
    const matches = (!query || card.dataset.search.includes(query))
      && (status === 'all' || card.dataset.status === status)
      && (owner === 'all' || card.dataset.owner === owner)
      && (!attentionOnly || attentionStatuses.has(card.dataset.status));
    card.hidden = !matches;
    if (matches) visible += 1;
  }

  resultCount.textContent = `${visible} ${visible === 1 ? 'system' : 'systems'}`;
  emptyState.hidden = visible !== 0;
}

renderSystems();
populateOwners();
updateMetrics();
applyFilters();

for (const control of [searchFilter, statusFilter, ownerFilter, attentionFilter]) {
  control.addEventListener('input', applyFilters);
  control.addEventListener('change', applyFilters);
}

resetFilters.addEventListener('click', () => {
  requestAnimationFrame(applyFilters);
});

if (window.location.hash.startsWith('#system-')) {
  const target = document.querySelector(window.location.hash);
  if (target) {
    const toggle = target.querySelector('.card-toggle');
    toggle?.click();
  }
}
