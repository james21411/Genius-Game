// game/sound.js
// Sound Manager for the Retro Arcade game.
// Handles random playlist of the 10 loops and sound effects.

const musicFiles = [
  'musiques/boucle1.mkv',
  'musiques/boucle_2.mkv',
  'musiques/boucle_3.mkv',
  'musiques/boucle_4.mkv',
  'musiques/boucle_5.mkv',
  'musiques/boucle_6.mkv',
  'musiques/boucle_7.mkv',
  'musiques/boucle_8.mkv',
  'musiques/boucle_9.mkv',
  'musiques/boucle_10.mkv'
];

let shuffleQueue = [];
let currentMusic = null;
let musicPlaying = false;

// Volume configurations
const NORMAL_MUSIC_VOLUME = 0.3;
const COLLECT_SOUND_VOLUME = 0.85; // Louder collect sound

// Audio objects cached for reuse
let jumpSound = null;
let loseSound = null;
let collectSound = null;

function soundEnabled() {
  return window.studentSoundEnabled !== false;
}

function masterVolume() {
  return Math.max(0, Math.min(1, Number(window.studentMasterVolume ?? 1)));
}

function scaledVolume(value) {
  return soundEnabled() ? value * masterVolume() : 0;
}

function initSounds() {
  if (!jumpSound) {
    jumpSound = new Audio('musiques/jump.wav');
    jumpSound.volume = scaledVolume(0.4);
  }
  if (!loseSound) {
    loseSound = new Audio('musiques/lose.wav');
    loseSound.volume = scaledVolume(0.5);
  }
  if (!collectSound) {
    collectSound = new Audio('musiques/collect_coin.wav');
    collectSound.volume = scaledVolume(COLLECT_SOUND_VOLUME);
  }
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function playNext() {
  if (!musicPlaying) return;

  if (shuffleQueue.length === 0) {
    shuffleQueue = shuffle(musicFiles);
    console.log('[Sound] Playlist reshuffled:', shuffleQueue);
  }

  const nextSongSrc = shuffleQueue.shift();
  console.log('[Sound] Playing music track:', nextSongSrc);

  if (currentMusic) {
    try {
      currentMusic.pause();
    } catch (e) {}
    currentMusic = null;
  }

  currentMusic = new Audio(nextSongSrc);
  currentMusic.volume = scaledVolume(NORMAL_MUSIC_VOLUME);
  
  currentMusic.addEventListener('ended', () => {
    playNext();
  });

  currentMusic.play().catch(err => {
    console.warn('[Sound] Music playback deferred/interrupted:', err.message);
  });
}

export function startMusic() {
  initSounds();
  if (!soundEnabled()) {
    pauseMusic();
    return;
  }
  if (musicPlaying) return;
  musicPlaying = true;
  
  if (currentMusic) {
    currentMusic.volume = scaledVolume(NORMAL_MUSIC_VOLUME);
    currentMusic.play().catch(err => {
      console.warn('[Sound] Music play resumed/deferred:', err.message);
    });
  } else {
    playNext();
  }
}

export function pauseMusic() {
  if (!musicPlaying) return;
  if (currentMusic && !currentMusic.paused) {
    currentMusic.pause();
  }
  musicPlaying = false;
}

export function stopMusic() {
  if (!musicPlaying && !currentMusic) return;
  if (currentMusic) {
    try {
      currentMusic.pause();
    } catch (e) {}
    currentMusic = null;
  }
  musicPlaying = false;
  shuffleQueue = [];
}

export function playJump() {
  if (!soundEnabled()) return;
  initSounds();
  if (jumpSound) {
    const sound = jumpSound.cloneNode();
    sound.volume = scaledVolume(0.4);
    sound.play().catch(e => console.warn('[Sound] Jump play error:', e.message));
  }
}

export function playLose() {
  if (!soundEnabled()) return;
  initSounds();
  if (loseSound) {
    const sound = loseSound.cloneNode();
    sound.volume = scaledVolume(0.5);
    sound.play().catch(e => console.warn('[Sound] Lose play error:', e.message));
  }
}

export function playCollect() {
  if (!soundEnabled()) return;
  initSounds();
  if (collectSound) {
    const sound = collectSound.cloneNode();
    sound.volume = scaledVolume(COLLECT_SOUND_VOLUME);
    sound.play().catch(e => console.warn('[Sound] Collect play error:', e.message));
  }
}
