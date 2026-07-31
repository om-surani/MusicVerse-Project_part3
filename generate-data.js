// generate-data.js
// One-time script used to build data/tracks.json — a representative sample
// (200 records) in the shape of the Kaggle "Ultimate Spotify Tracks DB" dataset,
// trimmed down per the Phase 0 plan (subset of 1000-5000 -> 200 for a lightweight demo).
// Run with: node generate-data.js

const fs = require("fs");

const genres = [
  "Pop", "Rock", "Hip-Hop", "Jazz", "Classical", "Electronic",
  "Country", "R&B", "Movie", "Alternative", "Reggae", "Blues"
];

const artists = [
  "Henri Salvador", "Nova Ray", "The Midnight Echo", "Lena Cross", "Deja Volt",
  "Marcus King Jr.", "Silver Fable", "The Roaming Owls", "Aria Blake", "Kid Static",
  "The Velvet Hour", "Priya Sol", "Blackwood Trio", "Echo & the Bones", "Nadia Frost",
  "The Lighthouse Keepers", "Jamal Reeves", "Willow Vane", "Copper Canyon", "Mira Sinclair"
];

const titleWords1 = ["Midnight", "Golden", "Electric", "Broken", "Silent", "Neon", "Wild", "Quiet", "Fading", "Radiant", "Lost", "Endless", "Velvet", "Distant", "Burning"];
const titleWords2 = ["Skyline", "Heart", "Highway", "Dream", "Echo", "Horizon", "Rhythm", "Shadow", "Garden", "Storm", "River", "Fire", "Static", "Reverie", "Signal"];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max, decimals = 3) {
  const val = Math.random() * (max - min) + min;
  return Number(val.toFixed(decimals));
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function makeTrackId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 22; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const modes = ["Major", "Minor"];

const tracks = [];
const usedTitles = new Set();

for (let i = 1; i <= 200; i++) {
  let title;
  do {
    title = `${pick(titleWords1)} ${pick(titleWords2)}`;
  } while (usedTitles.has(title));
  usedTitles.add(title);

  const genre = pick(genres);
  const artist_name = i === 1 ? "Henri Salvador" : pick(artists);
  const track_name = i === 1 ? "C'est beau de faire un Show" : title;

  tracks.push({
    id: i,
    genre,
    artist_name,
    track_name,
    track_id: makeTrackId(),
    popularity: i === 1 ? 0 : randInt(0, 100),
    duration_ms: randInt(120000, 320000),
    audioFeatures: {
      acousticness: rand(0, 1),
      danceability: rand(0, 1),
      energy: rand(0, 1),
      instrumentalness: rand(0, 1),
      liveness: rand(0, 1),
      loudness: rand(-30, 0, 3),
      speechiness: rand(0, 0.3),
      tempo: rand(60, 200, 3),
      valence: rand(0, 1),
      key: pick(keys),
      mode: pick(modes),
      time_signature: pick([3, 4, 4, 4, 5])
    }
  });
}

// Keep the exact sample record from the Phase 0 report as record #1 for consistency
tracks[0] = {
  id: 1,
  genre: "Movie",
  artist_name: "Henri Salvador",
  track_name: "C'est beau de faire un Show",
  track_id: "0BRjO6ga9RKCKjfDqeFgWV",
  popularity: 0,
  duration_ms: 99373,
  audioFeatures: {
    acousticness: 0.611,
    danceability: 0.389,
    energy: 0.91,
    instrumentalness: 0,
    liveness: 0.346,
    loudness: -1.828,
    speechiness: 0.0525,
    tempo: 166.969,
    valence: 0.814,
    key: "C#",
    mode: "Major",
    time_signature: 4
  }
};

fs.writeFileSync("./data/tracks.json", JSON.stringify(tracks, null, 2));
console.log(`Generated ${tracks.length} tracks -> data/tracks.json`);
