const fs = require('fs');
const path = require('path');

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getSoundtracks(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().includes('soundtrack') && f.toLowerCase().endsWith('.mp3'))
    .map(f => path.join(dir, f));
}

function shuffleSoundtrack(dir = '.') {
  const tracks = getSoundtracks(dir);
  shuffle(tracks);
  return tracks;
}

if (require.main === module) {
  const tracks = shuffleSoundtrack(process.argv[2] || '.');
  if (!tracks.length) {
    console.log('No soundtrack mp3 files found.');
  } else {
    tracks.forEach(t => console.log(t));
  }
}

module.exports = { shuffleSoundtrack };
