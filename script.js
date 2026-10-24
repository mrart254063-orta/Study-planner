// Study Planner
// All data lives in one object (`state`) and is saved in the browser
// with localStorage, so it is still there when the page is reopened.

const STORAGE_KEY = 'studyplanner1';
const COLORS = ['#2F5BEA', '#E0457B', '#14A37F', '#F08A24', '#8A55E8', '#3AA6D8'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let state = loadState();   // { subjects: [], tasks: [], goal: minutes per day }
let currentTab = 'today';


/* ---------- Saving and loading ---------- */

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (data && data.tasks) return data;
    }
  } catch (error) {
    // Storage unavailable: start fresh
  }
  return { subjects: [], tasks: [], goal: 60 };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Storage unavailable: the app still works, it just won't be remembered
  }
}


/* ---------- Small helpers ---------- */

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// Turns a Date into a "YYYY-MM-DD" text key
function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayKey() {
  return dateKey(new Date());
}

// Stops user text from being read as HTML
function escapeHTML(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, char => map[char]);
}

function getSubject(id) {
  return state.subjects.find(subject => subject.id === id)
    || { name: 'No subject', color: '#8892a6' };
}

// Days between today and a date key (negative means in the past)
function daysFromToday(key) {
  const target = new Date(key + 'T00:00:00');
  const today = new Date(todayKey() + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function describeDeadline(task) {
  if (!task.due) return { text: 'No deadline', late: false };

  const days = daysFromToday(task.due);
  if (days < 0 && !task.done) {
    return { text: `Overdue by ${-days} ${days === -1 ? 'day' : 'days'}`, late: true };
  }
  if (days === 0) return { text: 'Due today', late: false };
  if (days === 1) return { text: 'Due tomorrow', late: false };

  const date = new Date(task.due + 'T00:00:00');
  const label = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return { text: `Due ${label}`, late: false };
}

function tasksDoneOn(key) {
  return state.tasks.filter(task => task.done && task.doneAt === key);
}

function minutesOn(key) {
  return tasksDoneOn(key).reduce((sum, task) => sum + (Number(task.mins) || 0), 0);
}

// Number of days in a row with at least one finished task
function currentStreak() {
  const day = new Date();
  let count = 0;

  // If nothing is done yet today, the streak can still continue from yesterday
  if (!tasksDoneOn(dateKey(day)).length) day.setDate(day.getDate() - 1);

  while (tasksDoneOn(dateKey(day)).length) {
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}

function sortByDeadline(a, b) {
  return (a.due || '9999').localeCompare(b.due || '9999');
}


/* ---------- HTML builders ---------- */

function taskHTML(task) {
  const subject = getSubject(task.sid);
  const deadline = describeDeadline(task);
  const title = escapeHTML(task.title);

  return `
    <div class="task${task.done ? ' done' : ''}">
      <button class="chk" data-act="toggle" data-id="${task.id}"
        aria-pressed="${task.done}"
        aria-label="Mark ${title} ${task.done ? 'not done' : 'done'}">${task.done ? '✓' : ''}</button>
      <div class="tt">
        <b>${title}</b>
        <div class="chip">
          <span class="dot" style="background:${subject.color}"></span>
          ${escapeHTML(subject.name)} ·
          <span class="${deadline.late ? 'late' : ''}">${deadline.text}</span>
          ${task.mins ? ` · ${task.mins} min` : ''}
        </div>
      </div>
      <button class="x" data-act="del" data-id="${task.id}" aria-label="Delete ${title}">×</button>
    </div>`;
}

function taskListHTML(tasks, emptyMessage) {
  if (!tasks.length) return `<div class="empty">${emptyMessage}</div>`;
  return tasks.map(taskHTML).join('');
}


/* ---------- Tab 1: Today ---------- */

function viewToday() {
  const today = todayKey();
  const minutes = minutesOn(today);
  const goal = state.goal || 60;
  const percent = Math.min(100, Math.round(minutes / goal * 100));
  const streak = currentStreak();

  const dueTasks = state.tasks
    .filter(task => !task.done && task.due && task.due <= today)
    .sort(sortByDeadline);
  const doneTasks = tasksDoneOn(today);

  const message = minutes >= goal ? 'Goal reached. Nice work.' : `${goal - minutes} min to go`;
  const emptyDue = state.tasks.length
    ? 'Nothing due. Add a task with a deadline in the Tasks tab.'
    : 'No tasks yet. Add a subject and your first task in the Tasks tab.';

  return `
    <div class="panel">
      <div class="big">${minutes} <small>/ ${goal} min studied</small></div>
      <div class="hl" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
        <i style="width:${percent}%"></i>
      </div>
      <div class="row sp">
        <span class="mute">${message}</span>
        <span class="mute">${streak ? `${streak}-day streak` : 'No streak yet'}</span>
      </div>
      <div style="margin-top:12px">
        <label for="goal">Daily goal (minutes)</label>
        <input id="goal" type="number" min="5" step="5" value="${goal}" data-act="goal">
      </div>
    </div>

    <h2>Due today and overdue</h2>
    <div class="panel">${taskListHTML(dueTasks, emptyDue)}</div>

    <h2>Done today</h2>
    <div class="panel">${taskListHTML(doneTasks, 'Tick off a task and it shows up here.')}</div>`;
}


/* ---------- Tab 2: Tasks ---------- */

function viewTasks() {
  const swatches = COLORS.map((color, i) => `
    <label>
      <input type="radio" name="color" value="${color}" ${i === 0 ? 'checked' : ''} aria-label="Colour ${i + 1}">
      <span style="background:${color}"></span>
    </label>`).join('');

  const subjectTags = state.subjects.map(subject => `
    <span class="tag">
      <span class="dot" style="background:${subject.color}"></span>${escapeHTML(subject.name)}
      <button class="x" data-act="delsub" data-id="${subject.id}"
        aria-label="Remove ${escapeHTML(subject.name)}">×</button>
    </span>`).join('');

  const subjectOptions = state.subjects.map(subject =>
    `<option value="${subject.id}">${escapeHTML(subject.name)}</option>`).join('');

  const openTasks = state.tasks.filter(task => !task.done).sort(sortByDeadline);
  const finishedTasks = state.tasks
    .filter(task => task.done)
    .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));

  const taskForm = state.subjects.length
    ? `<form id="task-form" class="panel">
        <label for="task-title">Task</label>
        <input id="task-title" required maxlength="80" placeholder="e.g. Chapter 4 practice problems">
        <div class="grid2">
          <div>
            <label for="task-subject">Subject</label>
            <select id="task-subject">${subjectOptions}</select>
          </div>
          <div>
            <label for="task-mins">Minutes</label>
            <input id="task-mins" type="number" min="5" step="5" value="30">
          </div>
        </div>
        <div style="margin-top:10px">
          <label for="task-due">Deadline</label>
          <input id="task-due" type="date" value="${todayKey()}">
        </div>
        <button class="btn" type="submit">Add task</button>
      </form>`
    : '<div class="panel empty">Add a subject first, then you can add tasks to it.</div>';

  return `
    <h2 style="margin-top:12px">Subjects</h2>
    <form id="subject-form" class="panel">
      <div class="tags" style="margin-bottom:12px">
        ${subjectTags || '<span class="empty">No subjects yet.</span>'}
      </div>
      <label for="subject-name">New subject</label>
      <input id="subject-name" required maxlength="30" placeholder="e.g. Biology">
      <div class="sw" role="radiogroup" aria-label="Subject colour">${swatches}</div>
      <button class="btn" type="submit">Add subject</button>
    </form>

    <h2>New task</h2>
    ${taskForm}

    <h2>To do</h2>
    <div class="panel">${taskListHTML(openTasks, 'No open tasks.')}</div>

    ${finishedTasks.length
      ? `<h2>Completed</h2><div class="panel">${taskListHTML(finishedTasks, '')}</div>`
      : ''}`;
}


/* ---------- Tab 3: Week ---------- */

// The seven date keys of the current week, Monday to Sunday
function currentWeekKeys() {
  const now = new Date();
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const keys = [];

  for (let i = 0; i < 7; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() - daysSinceMonday + i);
    keys.push(dateKey(day));
  }
  return keys;
}

function viewWeek() {
  const days = currentWeekKeys();
  const goal = state.goal || 60;
  const minutesPerDay = days.map(minutesOn);
  const tallest = Math.max(goal, ...minutesPerDay);
  const totalMinutes = minutesPerDay.reduce((sum, m) => sum + m, 0);
  const tasksDone = days.reduce((sum, key) => sum + tasksDoneOn(key).length, 0);
  const daysActive = minutesPerDay.filter(m => m > 0).length;

  // One bar per day; days that reached the goal are highlighted
  const bars = days.map((key, i) => {
    const height = Math.round(minutesPerDay[i] / tallest * 100);
    const classes = 'bar'
      + (minutesPerDay[i] >= goal ? ' hit' : '')
      + (key === todayKey() ? ' now' : '');
    return `
      <div class="${classes}">
        <span>${minutesPerDay[i] || ''}</span>
        <i style="height:${height}%"></i>
        <b>${WEEKDAYS[i]}</b>
      </div>`;
  }).join('');

  // Minutes studied per subject this week
  const perSubject = {};
  days.forEach(key => {
    tasksDoneOn(key).forEach(task => {
      perSubject[task.sid] = (perSubject[task.sid] || 0) + (Number(task.mins) || 0);
    });
  });
  const subjectIds = Object.keys(perSubject).sort((a, b) => perSubject[b] - perSubject[a]);
  const topMinutes = subjectIds.length ? perSubject[subjectIds[0]] : 1;

  const subjectRows = subjectIds.length
    ? subjectIds.map(id => {
        const subject = getSubject(id);
        const width = Math.max(4, Math.round(perSubject[id] / topMinutes * 100));
        return `
          <div style="margin-bottom:12px">
            <div class="row sp">
              <span class="chip">
                <span class="dot" style="background:${subject.color}"></span>${escapeHTML(subject.name)}
              </span>
              <span class="mute">${perSubject[id]} min</span>
            </div>
            <div class="sbar" style="background:${subject.color};width:${width}%"></div>
          </div>`;
      }).join('')
    : '<div class="empty">Complete a task this week to see your time split by subject.</div>';

  // Open tasks with a deadline later this week
  const weekEnd = days[6];
  const upcoming = state.tasks.filter(task =>
    !task.done && task.due && task.due > todayKey() && task.due <= weekEnd).length;
  const upcomingText = upcoming
    ? `${upcoming} ${upcoming === 1 ? 'task is' : 'tasks are'} due before the week ends.`
    : 'No more deadlines this week.';

  return `
    <h2 style="margin-top:12px">This week</h2>
    <div class="panel">
      <div class="bars" aria-label="Minutes studied per day">${bars}</div>
      <div class="mute" style="margin-top:8px">Highlighted days met your ${goal} min goal.</div>
      <div class="stats">
        <div><b>${totalMinutes}</b><span class="mute">minutes</span></div>
        <div><b>${tasksDone}</b><span class="mute">tasks done</span></div>
        <div><b>${daysActive}/7</b><span class="mute">days active</span></div>
      </div>
    </div>

    <h2>By subject</h2>
    <div class="panel">${subjectRows}</div>

    <h2>Coming up</h2>
    <div class="panel"><span class="mute">${upcomingText}</span></div>`;
}


/* ---------- Drawing the page ---------- */

function render() {
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric'
  });
  document.getElementById('date').textContent = dateLabel;

  document.querySelectorAll('#tabs button').forEach(button => {
    button.setAttribute('aria-selected', button.dataset.tab === currentTab);
  });

  const views = { today: viewToday, tasks: viewTasks, week: viewWeek };
  document.getElementById('view').innerHTML = views[currentTab]();
}


/* ---------- User actions ---------- */

// Tab buttons, tick boxes, delete buttons
document.addEventListener('click', event => {
  const tabButton = event.target.closest('[data-tab]');
  if (tabButton) {
    currentTab = tabButton.dataset.tab;
    render();
    window.scrollTo(0, 0);
    return;
  }

  const button = event.target.closest('[data-act]');
  if (!button || button.tagName === 'INPUT') return;

  const id = button.dataset.id;
  const action = button.dataset.act;

  if (action === 'toggle') {
    state.tasks.forEach(task => {
      if (task.id === id) {
        task.done = !task.done;
        task.doneAt = task.done ? todayKey() : null;   // remember the day it was finished
      }
    });
  }
  if (action === 'del') {
    state.tasks = state.tasks.filter(task => task.id !== id);
  }
  if (action === 'delsub') {
    state.subjects = state.subjects.filter(subject => subject.id !== id);
  }

  saveState();
  render();
});

// Daily goal input
document.addEventListener('change', event => {
  if (event.target.dataset.act === 'goal') {
    const value = parseInt(event.target.value, 10);
    if (value > 0) {
      state.goal = value;
      saveState();
      render();
    }
  }
});

// Add subject and add task forms
document.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;

  if (form.id === 'subject-form') {
    const name = form.querySelector('#subject-name').value.trim();
    if (!name) return;
    const chosenColor = form.querySelector('input[name=color]:checked');
    state.subjects.push({ id: uid(), name, color: chosenColor ? chosenColor.value : COLORS[0] });
  }

  if (form.id === 'task-form') {
    const title = form.querySelector('#task-title').value.trim();
    if (!title) return;
    state.tasks.push({
      id: uid(),
      title,
      sid: form.querySelector('#task-subject').value,
      due: form.querySelector('#task-due').value || '',
      mins: parseInt(form.querySelector('#task-mins').value, 10) || 0,
      done: false,
      doneAt: null
    });
  }

  saveState();
  render();
});

render();
