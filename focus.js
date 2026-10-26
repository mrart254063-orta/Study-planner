// Focus tab: Pomodoro timer, calming background sounds, and break reminders.
// This file loads before script.js, which uses viewFocus() to draw the tab.

const MODES = {
  focus: { label: 'Focus', minutes: 25 },
  short: { label: 'Short break', minutes: 5 },
  long: { label: 'Long break', minutes: 15 }
};

// Sounds are generated in the browser (Web Audio), so no audio files are needed
const SOUNDS = {
  rain: { label: 'Rain', brown: false, cutoff: 4000 },
  wind: { label: 'Wind', brown: false, cutoff: 900 },
  deep: { label: 'Deep focus', brown: true, cutoff: 1200 }
};

const timer = {
  mode: 'focus',
  secondsLeft: MODES.focus.minutes * 60,
  endTime: null,      // clock time when the timer ends (only while running)
  intervalId: null,
  message: ''
};

let audioContext = null;
let soundSource = null;
let soundGain = null;
let currentSound = null;
let volume = 0.5;


/* ---------- Timer ---------- */

function formatTime(totalSeconds) {
  return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;
}

function startTimer() {
  if (timer.intervalId) return;
  getAudio();                   // unlock sound while the user's tap is fresh
  askNotificationPermission();
  timer.message = '';
  timer.endTime = Date.now() + timer.secondsLeft * 1000;
  timer.intervalId = setInterval(tick, 250);
  refreshFocusView();
}

function stopTimer() {
  clearInterval(timer.intervalId);
  timer.intervalId = null;
  timer.endTime = null;
  document.title = 'Study Planner';
}

function resetTimer() {
  stopTimer();
  timer.secondsLeft = MODES[timer.mode].minutes * 60;
  timer.message = '';
  refreshFocusView();
}

function setMode(mode) {
  stopTimer();
  timer.mode = mode;
  timer.secondsLeft = MODES[mode].minutes * 60;
  timer.message = '';
  refreshFocusView();
}

// Runs four times a second; uses the clock so it stays accurate in the background
function tick() {
  timer.secondsLeft = Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000));
  updateTimerDisplay();
  if (timer.secondsLeft === 0) finishTimer();
}

function finishTimer() {
  const wasFocus = timer.mode === 'focus';
  stopTimer();

  let next = 'focus';
  if (wasFocus) {
    state.sessions = state.sessions || {};
    state.sessions[todayKey()] = (state.sessions[todayKey()] || 0) + 1;
    saveState();
    // Every fourth focus session earns a longer break
    next = state.sessions[todayKey()] % 4 === 0 ? 'long' : 'short';
  }

  timer.message = wasFocus
    ? `Focus session done. Take a ${MODES[next].minutes} minute break.`
    : 'Break over. Ready for the next focus session?';
  timer.mode = next;
  timer.secondsLeft = MODES[next].minutes * 60;

  playBeep();
  notify(timer.message);
  refreshFocusView();
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-time');
  if (display) display.textContent = formatTime(timer.secondsLeft);
  document.title = timer.intervalId
    ? `${formatTime(timer.secondsLeft)} · ${MODES[timer.mode].label}`
    : 'Study Planner';
}

function refreshFocusView() {
  if (currentTab === 'focus') render();
  updateTimerDisplay();
}


/* ---------- Reminders ---------- */

function askNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function notify(text) {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Study Planner', { body: text });
    }
  } catch (error) {
    // Some phones block this: the beep and on-screen message still work
  }
}


/* ---------- Sound ---------- */

function getAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

// Two seconds of random noise that loops. "Brown" noise is deeper and softer.
function createNoise(context, brown) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;

  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function stopSound() {
  if (soundSource) soundSource.stop();
  soundSource = null;
  currentSound = null;
}

function chooseSound(name) {
  stopSound();
  if (name !== 'off') {
    const context = getAudio();
    const preset = SOUNDS[name];

    soundSource = context.createBufferSource();
    soundSource.buffer = createNoise(context, preset.brown);
    soundSource.loop = true;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = preset.cutoff;

    soundGain = context.createGain();
    soundGain.gain.value = volume * 0.5;

    soundSource.connect(filter);
    filter.connect(soundGain);
    soundGain.connect(context.destination);
    soundSource.start();
    currentSound = name;
  }
  if (currentTab === 'focus') render();
}

function setVolume(value) {
  volume = value;
  if (soundGain) soundGain.gain.value = volume * 0.5;
}

// Three short beeps to signal the end of a session
function playBeep() {
  const context = getAudio();
  [0, 0.35, 0.7].forEach(delay => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.15;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime + delay);
    oscillator.stop(context.currentTime + delay + 0.2);
  });
}


/* ---------- Focus tab view ---------- */

function viewFocus() {
  const running = Boolean(timer.intervalId);
  const sessionsToday = (state.sessions && state.sessions[todayKey()]) || 0;

  const modeButtons = Object.keys(MODES).map(key => `
    <button class="mode" data-focus="mode" data-value="${key}"
      aria-pressed="${timer.mode === key}">${MODES[key].label}</button>`).join('');

  const soundNames = ['off', ...Object.keys(SOUNDS)];
  const soundButtons = soundNames.map(name => `
    <button class="mode" data-focus="sound" data-value="${name}"
      aria-pressed="${(currentSound || 'off') === name}">${name === 'off' ? 'Off' : SOUNDS[name].label}</button>`).join('');

  return `
    <h2 style="margin-top:12px">Focus timer</h2>
    <div class="panel">
      <div class="modes">${modeButtons}</div>
      <div class="big timer" id="timer-time">${formatTime(timer.secondsLeft)}</div>
      <p class="mute center" id="timer-msg">${timer.message}</p>
      <div class="row">
        <button class="btn" data-focus="${running ? 'pause' : 'start'}">${running ? 'Pause' : 'Start'}</button>
        <button class="btn alt" data-focus="reset">Reset</button>
      </div>
      <p class="mute center">Focus sessions today: ${sessionsToday}</p>
    </div>

    <h2>Background sound</h2>
    <div class="panel">
      <div class="modes wrap">${soundButtons}</div>
      <label for="volume" style="margin-top:12px">Volume</label>
      <input id="volume" type="range" min="0" max="100" value="${Math.round(volume * 100)}">
    </div>`;
}


/* ---------- Focus tab actions ---------- */

document.addEventListener('click', event => {
  const button = event.target.closest('[data-focus]');
  if (!button) return;

  const action = button.dataset.focus;
  if (action === 'start') startTimer();
  if (action === 'pause') { stopTimer(); refreshFocusView(); }
  if (action === 'reset') resetTimer();
  if (action === 'mode') setMode(button.dataset.value);
  if (action === 'sound') chooseSound(button.dataset.value);
});

document.addEventListener('input', event => {
  if (event.target.id === 'volume') setVolume(event.target.value / 100);
});
