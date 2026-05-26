/* ============================================================
   Quizz App — script.js  (Core Logic)
   UI_T is loaded from ui_translations.js
   ============================================================ */
'use strict';

/* ── SHARED COLOR PALETTE ── */
const ANIM_COLORS = ['#00f5ff','#ff00aa','#9d00ff','#00ff88','#ffe600','#ff6600','#ff3366','#33ffcc'];

/* ── LANGUAGE LIST ── */
const LANGUAGES = [
  {code:'en',  name:'English',   native:'English',   flag:'🇬🇧'},
  {code:'hi',  name:'Hindi',     native:'हिन्दी',      flag:'🇮🇳'},
  {code:'bn',  name:'Bengali',   native:'বাংলা',       flag:'🇮🇳'},
  {code:'te',  name:'Telugu',    native:'తెలుగు',      flag:'🇮🇳'},
  {code:'mr',  name:'Marathi',   native:'मराठी',       flag:'🇮🇳'},
  {code:'ta',  name:'Tamil',     native:'தமிழ்',       flag:'🇮🇳'},
  {code:'gu',  name:'Gujarati',  native:'ગુજરાતી',     flag:'🇮🇳'},
  {code:'kn',  name:'Kannada',   native:'ಕನ್ನಡ',       flag:'🇮🇳'},
  {code:'ml',  name:'Malayalam', native:'മലയാളം',      flag:'🇮🇳'},
  {code:'pa',  name:'Punjabi',   native:'ਪੰਜਾਬੀ',      flag:'🇮🇳'},
  {code:'ur',  name:'Urdu',      native:'اردو',         flag:'🇮🇳'},
  {code:'ne',  name:'Nepali',    native:'नेपाली',      flag:'🇮🇳'}
];

/* ── UI HELPER ── */
function ui(k) {
  const d = (typeof UI_T !== 'undefined' && UI_T[state.lang]) ? UI_T[state.lang] : {};
  const en = (typeof UI_T !== 'undefined' && UI_T.en) ? UI_T.en : {};
  return d[k] || en[k] || k;
}

/* ── BUILD TOPICS FROM LOADED DATA FILES ── */
function buildTopics() {
  const raw = [
    {key:'htmlBasics',    data: typeof T_HTML         !== 'undefined' ? T_HTML         : null},
    {key:'jsLogic',       data: typeof T_JS           !== 'undefined' ? T_JS           : null},
    {key:'indianHistory', data: typeof T_HISTORY      !== 'undefined' ? T_HISTORY      : null},
    {key:'gkIndia',       data: typeof T_GK           !== 'undefined' ? T_GK           : null},
    {key:'python',        data: typeof T_PYTHON       !== 'undefined' ? T_PYTHON       : null},
    {key:'aboutIndia',    data: typeof T_INDIA        !== 'undefined' ? T_INDIA        : null},
    {key:'worldHistory',  data: typeof T_WORLDHISTORY !== 'undefined' ? T_WORLDHISTORY : null},
    {key:'science',       data: typeof T_SCIENCE      !== 'undefined' ? T_SCIENCE      : null},
    {key:'mathematics',   data: typeof T_MATH         !== 'undefined' ? T_MATH         : null},
    {key:'computer',      data: typeof T_COMPUTER     !== 'undefined' ? T_COMPUTER     : null},
    {key:'superBasics',   data: typeof T_BASICS       !== 'undefined' ? T_BASICS       : null}
  ];
  const topics = {};
  raw.forEach(({key, data}) => {
    if (!data) return;
    topics[key] = {
      name: data.name,
      icon: data.icon,
      questions: {
        easy:   data.easy.map(a => ({q:a[0], o:[a[1],a[2],a[3],a[4]], a:a[5], h:a[6]})),
        medium: data.medium.map(a => ({q:a[0], o:[a[1],a[2],a[3],a[4]], a:a[5], h:a[6]})),
        hard:   data.hard.map(a => ({q:a[0], o:[a[1],a[2],a[3],a[4]], a:a[5], h:a[6]}))
      }
    };
  });
  return topics;
}

/* ── TRANSLATION CACHE & ENGINE ── */
const translationCache = {};

async function translateText(text, targetLang) {
  if (!text || targetLang === 'en') return text;
  const cacheKey = targetLang + '||' + text;
  if (translationCache[cacheKey]) return translationCache[cacheKey];
  try {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl='
      + encodeURIComponent(targetLang) + '&dt=t&q=' + encodeURIComponent(text);
    const res = await fetch(url);
    const data = await res.json();
    // data[0] is an array of [translated_chunk, original_chunk, ...] pairs
    const translated = data[0].map(function(item){ return item[0]; }).join('');
    translationCache[cacheKey] = translated;
    return translated;
  } catch (e) {
    return text; // fallback to original English on error
  }
}

async function translateQuestionObj(q, targetLang) {
  if (targetLang === 'en') return q;
  const results = await Promise.all([
    translateText(q.q,    targetLang),
    translateText(q.o[0], targetLang),
    translateText(q.o[1], targetLang),
    translateText(q.o[2], targetLang),
    translateText(q.o[3], targetLang),
    translateText(q.h,    targetLang)
  ]);
  return { q: results[0], o: [results[1], results[2], results[3], results[4]], a: q.a, h: results[5] };
}

async function translateAllQuestions(questions, targetLang) {
  if (targetLang === 'en') return questions;
  let done = 0;
  const total = questions.length;
  return Promise.all(questions.map(function(q) {
    return translateQuestionObj(q, targetLang).then(function(tq) {
      done++;
      const el = document.getElementById('translatingProgress');
      if (el) el.textContent = done + ' / ' + total;
      return tq;
    });
  }));
}

function showTranslatingOverlay(total) {
  const overlay = document.getElementById('translatingOverlay');
  const text    = document.getElementById('translatingText');
  const prog    = document.getElementById('translatingProgress');
  if (text)    text.textContent = ui('translating');
  if (prog)    prog.textContent = '0 / ' + total;
  if (overlay) overlay.classList.remove('hidden');
}

function hideTranslatingOverlay() {
  const overlay = document.getElementById('translatingOverlay');
  if (overlay) overlay.classList.add('hidden');
}

/* ── APP STATE ── */
const state = {
  lang: 'en',
  topic: null,
  difficulty: null,
  questionCount: 15,
  useTimer: true,
  timerDuration: 15,
  questions: [],
  currentIndex: 0,
  score: 0,
  timerInterval: null,
  timeLeft: 15,
  topics: null,
  userAnswers: [],   // per question: null=skipped, number=selected shuffled idx
  shuffledData: [],  // per question: {options:[], correctIndex:number}
  isPaused: false
};

/* ── CANVAS PARTICLE EFFECT ── */
const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

class Particle {
  constructor(x, y) {
    this.x = x + (Math.random() - 0.5) * 60;
    this.y = y + (Math.random() - 0.5) * 60;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2 - 1;
    this.life = 1;
    this.decay = Math.random() * 0.02 + 0.008;
    this.size = Math.random() * 4 + 1;
    const colors = ['#00f5ff','#ff00aa','#9d00ff','#00ff88','#ffe600','#ff6600'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }
  update() { this.x += this.vx; this.y += this.vy; this.life -= this.decay; this.size *= 0.98; }
  draw() {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ── FLOATING ORBS for background ── */
const orbs = [];
function createOrb() {
  return {
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 80 + 30,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    color: ANIM_COLORS[Math.floor(Math.random() * ANIM_COLORS.length)],
    alpha: Math.random() * 0.06 + 0.02,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: Math.random() * 0.02 + 0.01
  };
}
for (let i = 0; i < 12; i++) orbs.push(createOrb());

/* ── SHOOTING STARS ── */
const stars = [];
function createStar() {
  return {
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight * 0.5,
    len: Math.random() * 120 + 40,
    speed: Math.random() * 6 + 3,
    alpha: 1,
    color: ANIM_COLORS[Math.floor(Math.random() * ANIM_COLORS.length)]
  };
}

function animateCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw floating orbs
  orbs.forEach(o => {
    o.x += o.vx; o.y += o.vy;
    o.pulse += o.pulseSpeed;
    if (o.x < -o.r) o.x = canvas.width + o.r;
    if (o.x > canvas.width + o.r) o.x = -o.r;
    if (o.y < -o.r) o.y = canvas.height + o.r;
    if (o.y > canvas.height + o.r) o.y = -o.r;
    const pulsedAlpha = o.alpha * (0.7 + 0.3 * Math.sin(o.pulse));
    ctx.save();
    ctx.globalAlpha = pulsedAlpha;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fillStyle = o.color;
    ctx.shadowBlur = 50;
    ctx.shadowColor = o.color;
    ctx.fill();
    ctx.restore();
  });

  // Spawn shooting stars occasionally
  if (Math.random() < 0.008) stars.push(createStar());
  for (let i = stars.length - 1; i >= 0; i--) {
    const s = stars[i];
    s.x += s.speed * 2; s.y += s.speed;
    s.alpha -= 0.015;
    if (s.alpha <= 0) { stars.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = s.alpha;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = s.color;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.len, s.y - s.len * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  // Mouse cursor particles
  if (Math.random() < 0.3) {
    for (let i = 0; i < 2; i++) particles.push(new Particle(mouseX, mouseY));
  }
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => { p.update(); p.draw(); });

  requestAnimationFrame(animateCanvas);
}

document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
document.addEventListener('touchmove', e => {
  mouseX = e.touches[0].clientX; mouseY = e.touches[0].clientY;
}, {passive: true});
window.addEventListener('resize', resizeCanvas);

/* ── SCREEN NAVIGATION ── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

/* ── RENDER LANGUAGE SCREEN ── */
function renderLangScreen() {
  const grid = document.getElementById('langGrid');
  grid.innerHTML = '';
  LANGUAGES.forEach(lang => {
    const btn = document.createElement('button');
    btn.className = 'lang-btn' + (state.lang === lang.code ? ' selected' : '');
    btn.innerHTML = `<span class="lang-native">${lang.flag} ${lang.native}</span><span class="lang-name">${lang.name}</span>`;
    btn.onclick = () => {
      state.lang = lang.code;
      updateUIText();
      renderTopicScreen();
      showScreen('topicScreen');
    };
    grid.appendChild(btn);
  });
  document.getElementById('langTitle').textContent = ui('langTitle');
  document.getElementById('langSub').textContent   = ui('langSub');
}

/* ── UPDATE ALL UI TEXT ── */
function updateUIText() {
  const s = (id, key) => { const el = document.getElementById(id); if (el) el.textContent = ui(key); };
  s('topicTitle','topicTitle'); s('topicSubtitle','topicSub');
  s('diffTitle','diffTitle');   s('diffSub','diffSub');
  s('easyLabel','easy');        s('easyCount','easyQ');
  s('mediumLabel','medium');    s('mediumCount','medQ');
  s('hardLabel','hard');        s('hardCount','hardQ');
  s('countTitle','countTitle'); s('countSub','countSub');
  s('timerTitle','timerTitle'); s('timerSub','timerSub');
  s('timerYesLabel','withTimer'); s('timerYesDesc','withTimerD');
  s('timerNoLabel','noTimer');    s('timerNoDesc','noTimerD');
  s('timerDurTitle','timerDurTitle'); s('timerDurSub','timerDurSub');
  document.querySelectorAll('.back-btn').forEach(b => b.textContent = ui('back'));
  s('stopBtn','stop'); s('pauseBtn','pause'); s('skipBtn','skip');
  s('nextBtn','next'); s('submitBtn','submit');
  s('restartBtn','again'); s('homeBtn','home');
  s('reviewTitle','reviewTitle');
  s('pauseText','pauseText');
  s('resumeBtn','resume');
  // Timer duration labels
  const durSecs = ['durSec','durSec2']; durSecs.forEach(id => s(id,'sec'));
  const durMins = ['durMin','durMin2','durMin3']; durMins.forEach(id => s(id,'min'));
}

/* ── RENDER TOPIC SCREEN ── */
function renderTopicScreen() {
  const grid = document.getElementById('topicGrid');
  grid.innerHTML = '';
  Object.entries(state.topics).forEach(([key, topic]) => {
    const card = document.createElement('div');
    card.className = 'topic-card';
    const name = topic.name[state.lang] || topic.name.en;
    card.innerHTML = `
      <span class="topic-icon">${topic.icon}</span>
      <span class="topic-name">${name}</span>
      <span class="topic-count">${ui('topicQ')}</span>`;
    card.onclick = () => {
      state.topic = key;
      updateUIText();
      showScreen('diffScreen');
    };
    grid.appendChild(card);
  });
}

/* ── RENDER COUNT SCREEN ── */
function renderCountScreen(diff) {
  const grid = document.getElementById('countGrid');
  grid.innerHTML = '';
  const counts = diff === 'easy' ? [15] : diff === 'medium' ? [10, 15] : [5, 10, 15, 20];
  counts.forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'count-btn';
    btn.textContent = n;
    btn.onclick = () => { state.questionCount = n; showScreen('timerScreen'); };
    grid.appendChild(btn);
  });
}

/* ── SHUFFLE ARRAY (Fisher-Yates) ── */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── START QUIZ ── */
async function startQuiz() {
  const topic = state.topics[state.topic];
  const pool = topic.questions[state.difficulty];
  const shuffled = shuffleArray(pool);
  const selected = shuffled.slice(0, state.questionCount);

  state.currentIndex = 0;
  state.score = 0;
  state.userAnswers = new Array(selected.length).fill(undefined);
  state.shuffledData = new Array(selected.length).fill(null);
  state.isPaused = false;

  if (state.lang !== 'en') {
    showTranslatingOverlay(selected.length);
    try {
      state.questions = await translateAllQuestions(selected, state.lang);
    } catch(e) {
      state.questions = selected; // fallback to English on network error
    }
    hideTranslatingOverlay();
  } else {
    state.questions = selected;
  }

  const topicName = topic.name[state.lang] || topic.name.en;
  document.getElementById('topicBadge').textContent = topicName;
  const diffLabels = {easy: ui('easy'), medium: ui('medium'), hard: ui('hard')};
  document.getElementById('diffBadge').textContent = diffLabels[state.difficulty];

  showScreen('quizScreen');
  renderQuestion(0);
}

/* ── GET / CREATE SHUFFLED DATA FOR A QUESTION ── */
function getShuffledData(index) {
  if (state.shuffledData[index]) return state.shuffledData[index];
  const q = state.questions[index];
  const indices = shuffleArray([0, 1, 2, 3]);
  const options = indices.map(i => q.o[i]);
  const correctIndex = indices.indexOf(q.a);
  state.shuffledData[index] = {options, correctIndex, originalIndices: indices};
  return state.shuffledData[index];
}

/* ── RENDER QUESTION ── */
function renderQuestion(index) {
  state.currentIndex = index;
  clearInterval(state.timerInterval);

  const q = state.questions[index];
  const total = state.questions.length;
  const current = index + 1;
  const sd = getShuffledData(index);

  // Progress
  document.getElementById('progressText').textContent = `${ui('q')} ${current} ${ui('of')} ${total}`;
  document.getElementById('liveScore').textContent = `${ui('score')}: ${state.score}`;
  const pct = (index / total) * 100;
  document.getElementById('progressBar').style.width = pct + '%';

  // Question
  document.getElementById('questionNumber').textContent = `Q${current}.`;
  document.getElementById('questionText').textContent = q.q;

  // Options — use shuffled order
  const grid = document.getElementById('optionsGrid');
  grid.innerHTML = '';
  const labels = ['A', 'B', 'C', 'D'];
  sd.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="opt-label">${labels[i]}.</span> ${opt}`;
    btn.dataset.index = i;
    // Restore previous selection if any
    const prev = state.userAnswers[index];
    if (prev !== undefined && prev !== null && prev === i) {
      btn.classList.add('selected');
    }
    btn.onclick = () => handleAnswer(i);
    grid.appendChild(btn);
  });

  // Navigation buttons
  const quizBackBtn = document.getElementById('quizBackBtn');
  const skipBtn     = document.getElementById('skipBtn');
  const nextBtn     = document.getElementById('nextBtn');
  const submitBtn   = document.getElementById('submitBtn');

  // Show/hide back button
  if (index > 0) quizBackBtn.classList.remove('hidden');
  else           quizBackBtn.classList.add('hidden');

  // Show/hide next/submit based on whether answered
  const isAnswered = state.userAnswers[index] !== undefined;
  const isLast = index === total - 1;

  if (isAnswered) {
    if (isLast) {
      nextBtn.classList.add('hidden');
      submitBtn.classList.remove('hidden');
    } else {
      nextBtn.classList.remove('hidden');
      submitBtn.classList.add('hidden');
    }
  } else {
    nextBtn.classList.add('hidden');
    submitBtn.classList.add('hidden');
  }

  // Timer
  if (state.useTimer) {
    document.getElementById('timerWrap').classList.remove('hidden');
    state.timeLeft = state.timerDuration;
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
      if (state.isPaused) return;
      state.timeLeft--;
      updateTimerDisplay();
      if (state.timeLeft <= 0) {
        clearInterval(state.timerInterval);
        autoSkip();
      }
    }, 1000);
  } else {
    document.getElementById('timerWrap').classList.add('hidden');
  }
}

/* ── UPDATE TIMER DISPLAY ── */
function updateTimerDisplay() {
  const pct = (state.timeLeft / state.timerDuration) * 100;
  const bar = document.getElementById('timerBar');
  bar.style.setProperty('--timer-pct', pct + '%');
  document.getElementById('timerCount').textContent = state.timeLeft;
  bar.classList.remove('warning', 'danger');
  if (state.timeLeft <= 5) bar.classList.add('danger');
  else if (state.timeLeft <= Math.floor(state.timerDuration * 0.4)) bar.classList.add('warning');
}

/* ── AUTO SKIP (timer ran out) ── */
function autoSkip() {
  if (state.userAnswers[state.currentIndex] !== undefined) return;
  state.userAnswers[state.currentIndex] = null; // skipped
  const index = state.currentIndex;
  const total = state.questions.length;
  const isLast = index === total - 1;
  if (isLast) {
    document.getElementById('nextBtn').classList.add('hidden');
    document.getElementById('submitBtn').classList.remove('hidden');
  } else {
    document.getElementById('nextBtn').classList.remove('hidden');
    document.getElementById('submitBtn').classList.add('hidden');
  }
}

/* ── HANDLE ANSWER (option clicked) ── */
function handleAnswer(shuffledIndex) {
  // Allow changing answer before moving to next question
  state.userAnswers[state.currentIndex] = shuffledIndex;
  clearInterval(state.timerInterval);

  // Update option button styles — show selected only
  const btns = document.querySelectorAll('.option-btn');
  btns.forEach(btn => {
    btn.classList.remove('selected');
    if (parseInt(btn.dataset.index) === shuffledIndex) {
      btn.classList.add('selected');
    }
  });

  // Show next or submit
  const isLast = state.currentIndex === state.questions.length - 1;
  if (isLast) {
    document.getElementById('nextBtn').classList.add('hidden');
    document.getElementById('submitBtn').classList.remove('hidden');
  } else {
    document.getElementById('nextBtn').classList.remove('hidden');
    document.getElementById('submitBtn').classList.add('hidden');
  }

  // Update live score display (count correct so far)
  let tempScore = 0;
  state.userAnswers.forEach((ans, i) => {
    if (ans !== null && ans !== undefined && state.shuffledData[i]) {
      if (ans === state.shuffledData[i].correctIndex) tempScore++;
    }
  });
  document.getElementById('liveScore').textContent = `${ui('score')}: ${tempScore}`;
}

/* ── SKIP QUESTION ── */
function skipQuestion() {
  state.userAnswers[state.currentIndex] = null;
  clearInterval(state.timerInterval);
  const index = state.currentIndex;
  const total = state.questions.length;
  if (index < total - 1) {
    renderQuestion(index + 1);
  } else {
    // Last question skipped — show submit
    document.getElementById('nextBtn').classList.add('hidden');
    document.getElementById('submitBtn').classList.remove('hidden');
  }
}

/* ── NEXT QUESTION ── */
function nextQuestion() {
  clearInterval(state.timerInterval);
  const index = state.currentIndex;
  if (index < state.questions.length - 1) {
    renderQuestion(index + 1);
  } else {
    submitQuiz();
  }
}

/* ── PREVIOUS QUESTION ── */
function prevQuestion() {
  clearInterval(state.timerInterval);
  if (state.currentIndex > 0) {
    renderQuestion(state.currentIndex - 1);
  }
}

/* ── PAUSE / RESUME ── */
function pauseQuiz() {
  state.isPaused = true;
  document.getElementById('pauseOverlay').classList.remove('hidden');
  document.getElementById('pauseBtn').textContent = ui('resume');
}

function resumeQuiz() {
  state.isPaused = false;
  document.getElementById('pauseOverlay').classList.add('hidden');
  document.getElementById('pauseBtn').textContent = ui('pause');
  // Restart timer if applicable
  if (state.useTimer && state.timeLeft > 0) {
    state.timerInterval = setInterval(() => {
      if (state.isPaused) return;
      state.timeLeft--;
      updateTimerDisplay();
      if (state.timeLeft <= 0) {
        clearInterval(state.timerInterval);
        autoSkip();
      }
    }, 1000);
  }
}

/* ── SUBMIT QUIZ ── */
function submitQuiz() {
  clearInterval(state.timerInterval);
  // Calculate final score
  state.score = 0;
  state.userAnswers.forEach((ans, i) => {
    if (ans !== null && ans !== undefined && state.shuffledData[i]) {
      if (ans === state.shuffledData[i].correctIndex) state.score++;
    }
  });
  showResult();
}

/* ── SHOW RESULT ── */
function showResult() {
  clearInterval(state.timerInterval);
  const total = state.questions.length;
  const score = state.score;
  const pct = Math.round((score / total) * 100);

  document.getElementById('resultScore').textContent   = `${score}/${total}`;
  document.getElementById('resultPercent').textContent = `${pct}%`;
  document.getElementById('resultTitle').textContent   = ui('done');
  document.getElementById('restartBtn').textContent    = ui('again');
  document.getElementById('homeBtn').textContent       = ui('home');
  document.getElementById('reviewTitle').textContent   = ui('reviewTitle');

  let grade = '';
  if (pct === 100) grade = ui('g100');
  else if (pct >= 80) grade = ui('g80');
  else if (pct >= 60) grade = ui('g60');
  else if (pct >= 40) grade = ui('g40');
  else grade = ui('g0');
  document.getElementById('resultGrade').textContent = grade;

  const wrong = total - score;
  const skippedCount = state.userAnswers.filter(a => a === null).length;
  document.getElementById('resultStats').innerHTML = `
    <div class="stat-box"><span class="stat-value" style="color:var(--neon-green)">${score}</span><span class="stat-label">${ui('cStat')}</span></div>
    <div class="stat-box"><span class="stat-value" style="color:var(--wrong-color)">${wrong - skippedCount}</span><span class="stat-label">${ui('wStat')}</span></div>
    <div class="stat-box"><span class="stat-value" style="color:var(--neon-yellow)">${pct}%</span><span class="stat-label">${ui('acc')}</span></div>`;

  // Build detailed review
  buildReview();
  showScreen('resultScreen');
}

/* ── BUILD REVIEW SECTION ── */
function buildReview() {
  const list = document.getElementById('reviewList');
  list.innerHTML = '';
  const labels = ['A', 'B', 'C', 'D'];

  state.questions.forEach((q, i) => {
    const sd = state.shuffledData[i];
    const userAns = state.userAnswers[i];
    const isSkipped = userAns === null || userAns === undefined;
    const isCorrect = !isSkipped && sd && userAns === sd.correctIndex;
    const isWrong   = !isSkipped && !isCorrect;

    const item = document.createElement('div');
    item.className = 'review-item ' + (isSkipped ? 'r-skipped' : isCorrect ? 'r-correct' : 'r-wrong');

    let userAnswerHTML = '';
    if (isSkipped) {
      userAnswerHTML = `<span class="review-answer-val skipped-val">${ui('skippedLabel')}</span>`;
    } else {
      const userOptText = sd ? sd.options[userAns] : '?';
      const userLabel   = sd ? labels[userAns] : '?';
      userAnswerHTML = `<span class="review-answer-val ${isCorrect ? 'correct-val' : 'wrong-val'}">${userLabel}. ${userOptText}</span>`;
    }

    const corrLabel   = sd ? labels[sd.correctIndex] : '?';
    const corrOptText = sd ? sd.options[sd.correctIndex] : q.o[q.a];

    item.innerHTML = `
      <div class="review-q-num">Q${i + 1} ${isSkipped ? '⏭' : isCorrect ? '✅' : '❌'}</div>
      <div class="review-q-text">${q.q}</div>
      <div class="review-answers">
        <div class="review-answer-row">
          <span class="review-answer-label your-lbl">${ui('yourAnswer')}</span>
          ${userAnswerHTML}
        </div>
        <div class="review-answer-row">
          <span class="review-answer-label corr-lbl">${ui('correctAnswer')}</span>
          <span class="review-answer-val correct-val">${corrLabel}. ${corrOptText}</span>
        </div>
      </div>
      <div class="review-explanation">
        <span class="review-explanation-label">${ui('explanation')}</span>
        ${q.h}
      </div>`;
    list.appendChild(item);
  });
}

/* ── EVENT LISTENERS ── */

// Topic back button (go back to language screen)
document.getElementById('topicBackBtn').addEventListener('click', () => {
  renderLangScreen();
  showScreen('langScreen');
});

// Difficulty back button
document.getElementById('diffBackBtn').addEventListener('click', () => showScreen('topicScreen'));

// Count back button
document.getElementById('countBackBtn').addEventListener('click', () => showScreen('diffScreen'));

// Timer back button
document.getElementById('timerBackBtn').addEventListener('click', () => {
  if (state.difficulty === 'easy') showScreen('diffScreen');
  else showScreen('countScreen');
});

// Timer duration back button
document.getElementById('timerDurBackBtn').addEventListener('click', () => showScreen('timerScreen'));

// Difficulty buttons
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.difficulty = btn.dataset.diff;
    if (state.difficulty === 'easy') {
      state.questionCount = 15;
      showScreen('timerScreen');
    } else {
      renderCountScreen(state.difficulty);
      showScreen('countScreen');
    }
  });
});

// Timer buttons
document.querySelectorAll('.timer-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.useTimer = btn.dataset.timer === 'yes';
    if (state.useTimer) {
      showScreen('timerDurScreen');
    } else {
      state.timerDuration = 15;
      startQuiz();
    }
  });
});

// Timer duration buttons
document.querySelectorAll('.dur-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.timerDuration = parseInt(btn.dataset.sec);
    state.timeLeft = state.timerDuration;
    startQuiz();
  });
});

// Quiz navigation
document.getElementById('nextBtn').addEventListener('click', nextQuestion);
document.getElementById('submitBtn').addEventListener('click', submitQuiz);
document.getElementById('skipBtn').addEventListener('click', skipQuestion);
document.getElementById('quizBackBtn').addEventListener('click', prevQuestion);

// Pause / Resume
document.getElementById('pauseBtn').addEventListener('click', () => {
  if (state.isPaused) resumeQuiz();
  else pauseQuiz();
});
document.getElementById('resumeBtn').addEventListener('click', resumeQuiz);

// Stop button
document.getElementById('stopBtn').addEventListener('click', () => {
  clearInterval(state.timerInterval);
  submitQuiz();
});

// Result screen buttons
document.getElementById('restartBtn').addEventListener('click', startQuiz);
document.getElementById('homeBtn').addEventListener('click', () => {
  clearInterval(state.timerInterval);
  renderLangScreen();
  showScreen('langScreen');
});

/* ── LETTER COLOR ANIMATION ── */
let _animPhase = 'multi';   // 'multi' or 'single'
let _animTick  = 0;
let _animSingleColor = '#00f5ff';
// Phase durations: multi=4s (10 ticks x 400ms), single=3s (7-8 ticks x 400ms)
const MULTI_TICKS  = 10;  // 10 x 400ms = 4000ms
const SINGLE_TICKS = 8;   // 8  x 400ms = 3200ms

function animateLetters() {
  const qLetters = document.querySelectorAll('.qletter');
  const aLetters = document.querySelectorAll('.aletter');

  if (_animPhase === 'multi') {
    // Each letter gets its own random color
    qLetters.forEach(l => {
      const c = ANIM_COLORS[Math.floor(Math.random() * ANIM_COLORS.length)];
      l.style.color = c;
      l.style.textShadow = '0 0 16px ' + c + ', 0 0 32px ' + c;
    });
    aLetters.forEach(l => {
      const c = ANIM_COLORS[Math.floor(Math.random() * ANIM_COLORS.length)];
      l.style.color = c;
      l.style.textShadow = '0 0 12px ' + c;
    });
    _animTick++;
    if (_animTick >= MULTI_TICKS) {
      _animPhase = 'single';
      _animTick  = 0;
      _animSingleColor = ANIM_COLORS[Math.floor(Math.random() * ANIM_COLORS.length)];
    }
  } else {
    // All letters same color
    qLetters.forEach(l => {
      l.style.color = _animSingleColor;
      l.style.textShadow = '0 0 20px ' + _animSingleColor + ', 0 0 40px ' + _animSingleColor;
    });
    aLetters.forEach(l => {
      l.style.color = _animSingleColor;
      l.style.textShadow = '0 0 14px ' + _animSingleColor;
    });
    _animTick++;
    if (_animTick >= SINGLE_TICKS) {
      _animPhase = 'multi';
      _animTick  = 0;
    }
  }
}

/* ── INIT ── */
function init() {
  resizeCanvas();
  animateCanvas();
  setInterval(animateLetters, 400);

  state.topics = buildTopics();
  renderLangScreen();
  showScreen('langScreen');
  updateUIText();
}

document.addEventListener('DOMContentLoaded',init);
