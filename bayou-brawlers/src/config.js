export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;
export const WORLD_LENGTH = 6900;
export const LANE_TOP = 392;
export const LANE_BOTTOM = 625;

export const COLORS = {
  ink: '#081411',
  cream: '#f4e8c9',
  gold: '#f4b942',
  ember: '#ff7043',
  moss: '#63c174',
  teal: '#52d6c7',
  blood: '#ef5350',
  focus: '#5ee7ff',
  violet: '#b79cff'
};

export const DEFAULT_SETTINGS = {
  masterVolume: 0.75,
  musicVolume: 0.45,
  sfxVolume: 0.8,
  screenShake: 0.75,
  hitFlash: true,
  reducedMotion: false,
  highContrast: false,
  holdToSprint: true,
  damageAssist: 1,
  enemyDamage: 1,
  difficulty: 'normal'
};

export const DIFFICULTY = {
  relaxed: { enemyHealth: 0.82, enemyDamage: 0.72, aggression: 0.78, label: 'Story' },
  normal: { enemyHealth: 1, enemyDamage: 1, aggression: 1, label: 'Brawler' },
  hard: { enemyHealth: 1.12, enemyDamage: 1.18, aggression: 1.2, label: 'Hard Boiled' }
};

export const TEST_ROOMS = [
  { id: 'stationary', name: 'Stationary Target' },
  { id: 'weak-melee', name: 'Weak Melee' },
  { id: 'aggressive', name: 'Aggressive Enemy' },
  { id: 'ranged', name: 'Ranged Enemy' },
  { id: 'armored', name: 'Armored Enemy' },
  { id: 'opposite', name: 'Opposite-Side Pressure' },
  { id: 'mixed', name: 'Mixed Group' },
  { id: 'surrounded', name: 'Surrounded Player' },
  { id: 'crowd', name: 'Large Crowd' },
  { id: 'hazard', name: 'Environmental Hazard' },
  { id: 'grab-throw', name: 'Grab + Throw' },
  { id: 'aerial', name: 'Aerial Combo' },
  { id: 'boundary', name: 'Wall + Boundary' },
  { id: 'elite', name: 'Elite Encounter' },
  { id: 'boss', name: 'Boss Pattern Lab' },
  { id: 'stress', name: 'Maximum Stress' }
];
