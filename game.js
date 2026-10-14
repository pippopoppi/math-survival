/* Math Survival — fast mental arithmetic survival game.
 * Vanilla JS, no build step. Pure game core + thin DOM layer.
 * The core (CONFIG, DIFFICULTY, generateProblem, createGame) is exported on
 * window.MathSurvival and also works under Node (no document) for simulations.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Configuration — every gameplay number lives here.
  // ---------------------------------------------------------------------------
  const CONFIG = {
    initialTime: 30,          // seconds on the clock at start
    correctAnswerBonus: 2,    // seconds added per correct answer
    streakLength: 5,          // correct answers in a row for a bonus
    streakBonus: 10,          // extra seconds for a full streak (on top of correctAnswerBonus)
    skipPenalty: 5,           // seconds removed by SKIP; skipping with less than this = game over
    feedbackDuration: 200,    // ms for ✓ / ✗ flashes
    maxDigits: 5,             // input length limit
    easyMixChance: 0.2,       // chance that an advanced-stage problem comes from the previous tier
    holdToClearMs: 450,       // hold ⌫ this long to clear the whole entry
    warnAt: 10,               // timer turns amber at or below this
    dangerAt: 5,              // timer turns red at or below this
    overInputDelay: 400       // ms the game-over buttons ignore taps (avoid accidental restart)
  };

  // Difficulty tiers by score. Each tier gives operand ranges for addition
  // (a + b) and subtraction (result + b − b, so results are always positive).
  // Tweak freely: ranges are inclusive.
  const DIFFICULTY = [
    { minScore: 0,  add: { a: [2, 12],     b: [2, 12] },     sub: { r: [2, 12],     b: [2, 12] } },
    { minScore: 11, add: { a: [11, 49],    b: [11, 49] },    sub: { r: [11, 49],    b: [11, 49] } },
    { minScore: 26, add: { a: [40, 99],    b: [40, 99] },    sub: { r: [30, 99],    b: [40, 99] } },
    { minScore: 51, add: { a: [100, 299],  b: [100, 299] },  sub: { r: [100, 299],  b: [100, 299] } },
    { minScore: 81, add: { a: [300, 799],  b: [300, 799] },  sub: { r: [300, 799],  b: [200, 599] } }
  ];

  const STORAGE_BEST = 'mathsurvival.best';
  const STORAGE_SOUND = 'mathsurvival.sound';

  // ---------------------------------------------------------------------------
  // Arithmetic generation
  // ---------------------------------------------------------------------------
  function randInt(lo, hi, rng) { return lo + Math.floor(rng() * (hi - lo + 1)); }

  function tierIndexForScore(score) {
    let idx = 0;
    for (let i = 0; i < DIFFICULTY.length; i++) if (score >= DIFFICULTY[i].minScore) idx = i;
    return idx;
  }

  // A problem is "trivial" for its tier when both operands are round numbers
  // (e.g. 300 + 400) or one operand is tiny compared to the other.
  function isTrivial(a, b, tierIdx) {
    if (tierIdx === 0) return false;
    if (a % 10 === 0 && b % 10 === 0) return true;
    if (tierIdx >= 2 && (a % 100 === 0 || b % 100 === 0)) return true;
    if (tierIdx >= 2 && (a < 10 || b < 10)) return true;
    return false;
  }

  /** Generate a problem {a, op, b, answer, key} for the given score. `prev` is the previous key, to avoid repeats. */
  function generateProblem(score, prev, rng) {
    rng = rng || Math.random;
    let tierIdx = tierIndexForScore(score);
    if (tierIdx > 0 && rng() < CONFIG.easyMixChance) tierIdx -= 1; // sprinkle easier ones in
    const tier = DIFFICULTY[tierIdx];
    for (let attempt = 0; attempt < 50; attempt++) {
      const isAdd = rng() < 0.5;
      let a, b, answer, op;
      if (isAdd) {
        a = randInt(tier.add.a[0], tier.add.a[1], rng);
        b = randInt(tier.add.b[0], tier.add.b[1], rng);
        answer = a + b; op = '+';
      } else {
        const r = randInt(tier.sub.r[0], tier.sub.r[1], rng);
        b = randInt(tier.sub.b[0], tier.sub.b[1], rng);
        a = r + b; answer = r; op = '−';
      }
      const key = a + op + b;
      if (key === prev) continue;
      if (isTrivial(a, b, tierIdx)) continue;
      if (answer <= 0) continue;
      return { a, op, b, answer, key, tier: tierIdx };
    }
    // Fallback (practically unreachable): simplest valid problem of the tier.
    const a = tier.add.a[1], b = tier.add.b[0] + 1;
    return { a, op: '+', b, answer: a + b, key: a + '+' + b, tier: tierIdx };
  }

  // ---------------------------------------------------------------------------
  // Game core — pure state machine driven by timestamps (ms, performance.now()).
  // Emits events through `emit(type, payload)` for the UI layer.
  // ---------------------------------------------------------------------------
  function createGame(emit, rng) {
    emit = emit || function () {};
    const g = {
      state: 'idle',        // idle | playing | paused | over
      score: 0,
      streak: 0,            // progress towards the next bonus (0..streakLength-1)
      problem: null,
      input: '',
      deadline: 0,          // timestamp (ms) at which time runs out
      pausedRemaining: 0,   // seconds left while paused (tab hidden)
      finalTime: 0
    };

    g.remaining = function (now) {
      if (g.state === 'playing') return Math.max(0, (g.deadline - now) / 1000);
      if (g.state === 'paused') return g.pausedRemaining;
      if (g.state === 'over') return 0;
      return CONFIG.initialTime;
    };

    g.start = function (now) {
      g.state = 'playing';
      g.score = 0; g.streak = 0; g.input = '';
      g.deadline = now + CONFIG.initialTime * 1000;
      g.problem = generateProblem(0, null, rng);
      emit('start');
      emit('problem', g.problem);
    };

    function nextProblem() {
      g.problem = generateProblem(g.score, g.problem && g.problem.key, rng);
      g.input = '';
      emit('problem', g.problem);
    }

    function gameOver() {
      g.state = 'over';
      g.finalTime = 0;
      emit('over', { score: g.score });
    }

    /** Advance the clock; call every frame. Returns remaining seconds. */
    g.tick = function (now) {
      if (g.state !== 'playing') return g.remaining(now);
      const rem = (g.deadline - now) / 1000;
      if (rem <= 0) { gameOver(); return 0; }
      return rem;
    };

    g.addDigit = function (d) {
      if (g.state !== 'playing') return;
      if (g.input.length >= CONFIG.maxDigits) return;
      if (g.input === '' && d === '0') { g.input = '0'; } // keep a lone zero; leading zeros are collapsed below
      else if (g.input === '0') { g.input = d; }
      else g.input += d;
      emit('input', g.input);
    };
    g.backspace = function () {
      if (g.state !== 'playing' || !g.input) return;
      g.input = g.input.slice(0, -1);
      emit('input', g.input);
    };
    g.clearInput = function () {
      if (g.state !== 'playing' || !g.input) return;
      g.input = '';
      emit('input', g.input);
    };

    g.submit = function (now) {
      if (g.state !== 'playing' || g.input === '') return null;
      if (g.tick(now) <= 0) return null; // ran out exactly now
      const value = parseInt(g.input, 10); // tolerates leading zeros
      if (value === g.problem.answer) {
        g.score += 1;
        g.streak += 1;
        let bonus = CONFIG.correctAnswerBonus;
        let streakHit = false;
        if (g.streak >= CONFIG.streakLength) {
          bonus += CONFIG.streakBonus;
          g.streak = 0;
          streakHit = true;
        }
        g.deadline += bonus * 1000;
        emit('correct', { score: g.score, streak: g.streak, bonus: CONFIG.correctAnswerBonus, streakHit });
        nextProblem();
        return 'correct';
      }
      g.streak = 0;
      g.input = '';
      emit('wrong', { streak: 0 });
      emit('input', g.input);
      return 'wrong';
    };

    g.skip = function (now) {
      if (g.state !== 'playing') return null;
      if (g.tick(now) <= 0) return null;
      g.streak = 0;
      g.input = '';
      const rem = (g.deadline - now) / 1000;
      if (rem < CONFIG.skipPenalty) {
        g.deadline = now;
        emit('skip', { penalty: CONFIG.skipPenalty, fatal: true });
        gameOver();
        return 'over';
      }
      g.deadline -= CONFIG.skipPenalty * 1000;
      emit('skip', { penalty: CONFIG.skipPenalty, fatal: false });
      emit('input', g.input);
      nextProblem();
      return 'skipped';
    };

    // Pause/resume are used when the tab is hidden so a backgrounded game
    // neither dies silently nor gains time.
    g.pause = function (now) {
      if (g.state !== 'playing') return;
      g.pausedRemaining = Math.max(0, (g.deadline - now) / 1000);
      g.state = 'paused';
      emit('pause');
    };
    g.resume = function (now) {
      if (g.state !== 'paused') return;
      g.deadline = now + g.pausedRemaining * 1000;
      g.state = 'playing';
      emit('resume');
    };

    return g;
  }

  const api = { CONFIG, DIFFICULTY, generateProblem, createGame, tierIndexForScore };
  if (typeof window !== 'undefined') window.MathSurvival = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document === 'undefined') return; // Node: core only

  // ---------------------------------------------------------------------------
  // Audio — tiny Web Audio synth, unlocked on the first user gesture.
  // ---------------------------------------------------------------------------
  const Sound = (function () {
    let ctx = null;
    let enabled = true;
    try { enabled = localStorage.getItem(STORAGE_SOUND) !== '0'; } catch (e) { /* storage blocked */ }

    function ensure() {
      if (!enabled) return null;
      try {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { return null; }
      return ctx;
    }
    function tone(freq, start, dur, type, gain, slideTo) {
      const c = ensure(); if (!c) return;
      const o = c.createOscillator(); const g = c.createGain();
      o.type = type || 'sine';
      const t0 = c.currentTime + start;
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }
    return {
      unlock() { ensure(); },
      get enabled() { return enabled; },
      toggle() {
        enabled = !enabled;
        try { localStorage.setItem(STORAGE_SOUND, enabled ? '1' : '0'); } catch (e) { /* ignore */ }
        if (enabled) { ensure(); this.tap(); }
        return enabled;
      },
      tap()   { tone(660, 0, 0.05, 'sine', 0.08); },
      ding()  { tone(880, 0, 0.09, 'sine', 0.18); tone(1320, 0.06, 0.14, 'sine', 0.16); },
      bop()   { tone(180, 0, 0.16, 'square', 0.12, 90); },
      skip()  { tone(300, 0, 0.12, 'sawtooth', 0.08, 200); },
      bonus() {
        [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.16, 'triangle', 0.18));
        tone(1568, 0.3, 0.3, 'sine', 0.12);
      },
      over()  { tone(440, 0, 0.25, 'triangle', 0.14, 330); tone(330, 0.22, 0.45, 'triangle', 0.14, 165); },
      start() { tone(523, 0, 0.08, 'triangle', 0.12); tone(784, 0.08, 0.14, 'triangle', 0.12); }
    };
  })();

  // ---------------------------------------------------------------------------
  // DOM layer
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const el = {
    start: $('screen-start'), game: $('screen-game'), over: $('screen-over'),
    startBest: $('start-best'), startBestValue: $('start-best-value'),
    play: $('btn-play'), again: $('btn-again'), share: $('btn-share'),
    soundStart: $('btn-sound-start'), soundGame: $('btn-sound-game'),
    score: $('hud-score'), timer: $('hud-timer'), best: $('hud-best'), float: $('hud-float'),
    streak: $('streak'), dots: Array.from(document.querySelectorAll('#streak .dot')),
    problem: $('problem'), answer: $('answer'), feedback: $('feedback'), bonus: $('bonus'),
    keys: $('screen-game').querySelector('.keys'), back: $('key-back'), skip: $('key-skip'), submit: $('btn-submit'),
    overScore: $('over-score'), overRecord: $('over-record'), overBest: $('over-best'),
    toast: $('toast')
  };

  const now = () => performance.now();
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let best = 0;
  try { best = parseInt(localStorage.getItem(STORAGE_BEST), 10) || 0; } catch (e) { /* storage blocked */ }
  function saveBest(v) { best = v; try { localStorage.setItem(STORAGE_BEST, String(v)); } catch (e) { /* ignore */ } }

  let rafId = 0;
  let lastTimerText = '';
  let feedbackTimer = 0, floatTimer = 0, bonusTimer = 0, toastTimer = 0, flashTimer = 0;
  let overAt = 0;

  // Re-trigger a CSS animation class reliably.
  function flash(node, cls, ms, handle) {
    node.classList.remove(cls);
    void node.offsetWidth; // reflow so the animation restarts
    node.classList.add(cls);
    clearTimeout(handle.id);
    handle.id = setTimeout(() => node.classList.remove(cls), ms);
  }
  const hFeedback = { id: 0 }, hFloat = { id: 0 }, hBonus = { id: 0 }, hFlash = { id: 0 }, hBump = { id: 0 }, hSwap = { id: 0 }, hWrong = { id: 0 };

  function showScreen(which) {
    el.start.hidden = which !== 'start';
    el.game.hidden = which !== 'game';
    el.over.hidden = which !== 'over';
  }

  function renderStart() {
    el.startBest.hidden = best <= 0;
    el.startBestValue.textContent = best;
  }

  function renderInput(v) {
    el.answer.textContent = v;
    if (!v) el.answer.appendChild(Object.assign(document.createElement('span'), { className: 'caret' }));
    el.answer.classList.toggle('has', !!v);
    el.submit.disabled = !v;
  }

  function renderStreak(n) {
    el.dots.forEach((d, i) => d.classList.toggle('on', i < n));
  }

  function renderTimer(rem) {
    const t = Math.max(0, rem).toFixed(1);
    if (t !== lastTimerText) { el.timer.textContent = t; lastTimerText = t; }
    el.timer.classList.toggle('danger', rem <= CONFIG.dangerAt);
    el.timer.classList.toggle('warn', rem > CONFIG.dangerAt && rem <= CONFIG.warnAt);
  }

  function floatText(text, bad) {
    el.float.textContent = text;
    el.float.classList.toggle('bad', !!bad);
    flash(el.float, 'show', 750, hFloat);
  }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1800);
  }

  // ----- Game events → UI -----
  const game = createGame(function (type, p) {
    switch (type) {
      case 'start':
        el.score.textContent = '0';
        el.best.textContent = best;
        renderStreak(0);
        renderInput('');
        lastTimerText = '';
        renderTimer(CONFIG.initialTime);
        break;
      case 'problem':
        el.problem.textContent = p.a + ' ' + p.op + ' ' + p.b;
        if (!reduceMotion) flash(el.problem, 'swap', 200, hSwap);
        renderInput('');
        break;
      case 'input':
        renderInput(p);
        break;
      case 'correct':
        el.score.textContent = p.score;
        if (p.score > best) el.best.textContent = p.score; // live best preview
        el.feedback.textContent = '✓';
        el.feedback.classList.remove('ko');
        flash(el.feedback, 'ok', 320, hFeedback);
        flash(el.timer, 'bump', 230, hBump);
        if (p.streakHit) {
          floatText('+' + (CONFIG.correctAnswerBonus + CONFIG.streakBonus) + 's');
          el.bonus.textContent = '+' + CONFIG.streakBonus + 's BONUS!';
          flash(el.bonus, 'show', 950, hBonus);
          renderStreak(CONFIG.streakLength);
          flash(el.streak, 'flash', 520, hFlash);
          setTimeout(() => renderStreak(game.streak), 520);
          Sound.bonus();
        } else {
          floatText('+' + CONFIG.correctAnswerBonus + 's');
          renderStreak(p.streak);
          Sound.ding();
        }
        break;
      case 'wrong':
        el.feedback.textContent = '✗';
        el.feedback.classList.remove('ok');
        flash(el.feedback, 'ko', 320, hFeedback);
        flash(el.problem, 'wrong', 260, hWrong);
        flash(el.streak, 'shake', 260, hFlash);
        renderStreak(0);
        Sound.bop();
        break;
      case 'skip':
        renderStreak(0);
        floatText('−' + p.penalty + 's', true);
        Sound.skip();
        break;
      case 'over':
        finishGame(p.score);
        break;
      default: break;
    }
  });

  function finishGame(score) {
    cancelAnimationFrame(rafId); rafId = 0;
    renderTimer(0);
    const isRecord = score > best;
    if (isRecord) saveBest(score);
    el.overScore.textContent = score;
    el.overBest.textContent = best;
    el.overRecord.hidden = !isRecord;
    overAt = now();
    el.again.disabled = true; el.share.disabled = true;
    setTimeout(() => { el.again.disabled = false; el.share.disabled = false; }, CONFIG.overInputDelay);
    Sound.over();
    setTimeout(() => showScreen('over'), reduceMotion ? 0 : 350);
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    const rem = game.tick(now());
    if (game.state === 'playing') renderTimer(rem);
  }

  function startGame() {
    cancelAnimationFrame(rafId); // never two loops
    Sound.unlock(); Sound.start();
    showScreen('game');
    game.start(now());
    rafId = requestAnimationFrame(loop);
  }

  // ----- Input wiring -----
  function press(btn) { // pressed look for keyboard-driven hits
    if (!btn) return;
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 90);
  }

  // Digits and backspace fire on pointerdown for the lowest possible latency.
  let holdTimer = 0, holdCleared = false;
  el.keys.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn === el.skip) return;
    e.preventDefault();
    Sound.unlock();
    if (btn.dataset.digit !== undefined) { game.addDigit(btn.dataset.digit); Sound.tap(); return; }
    if (btn === el.back) {
      holdCleared = false;
      game.backspace();
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => { holdCleared = true; game.clearInput(); }, CONFIG.holdToClearMs);
    }
  });
  const endHold = () => { clearTimeout(holdTimer); };
  el.back.addEventListener('pointerup', endHold);
  el.back.addEventListener('pointercancel', endHold);
  el.back.addEventListener('pointerleave', endHold);
  el.keys.addEventListener('contextmenu', (e) => e.preventDefault()); // long-press menu on mobile
  el.keys.addEventListener('click', (e) => {
    // Only SKIP acts on click (deliberate action); digit clicks already handled on pointerdown.
    const btn = e.target.closest('button');
    if (btn === el.skip) { Sound.unlock(); game.skip(now()); }
  });
  el.submit.addEventListener('click', () => { Sound.unlock(); game.submit(now()); });
  el.play.addEventListener('click', startGame);
  el.again.addEventListener('click', () => { if (now() - overAt >= CONFIG.overInputDelay) startGame(); });
  el.share.addEventListener('click', share);

  function syncSoundButtons() {
    const on = Sound.enabled;
    [el.soundStart, el.soundGame].forEach((b) => { b.textContent = on ? '🔊' : '🔇'; b.setAttribute('aria-pressed', String(on)); });
  }
  [el.soundStart, el.soundGame].forEach((b) => b.addEventListener('click', () => { Sound.toggle(); syncSoundButtons(); }));
  syncSoundButtons();

  // Keyboard (desktop). No key is bound to SKIP on purpose.
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (game.state === 'playing') {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); game.addDigit(e.key); press(el.keys.querySelector('[data-digit="' + e.key + '"]')); Sound.tap(); return; }
      if (e.key === 'Enter') { e.preventDefault(); game.submit(now()); return; }
      if (e.key === 'Backspace') { e.preventDefault(); game.backspace(); press(el.back); return; }
      if (e.key === 'Escape') { e.preventDefault(); game.clearInput(); return; }
    } else if (!el.start.hidden && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault(); startGame();
    } else if (!el.over.hidden && e.key === 'Enter' && !el.again.disabled) {
      e.preventDefault(); startGame();
    }
  });

  // Pause while the tab/app is in the background; resume where it left off.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.pause(now());
    } else if (game.state === 'paused') {
      game.resume(now());
    }
  });

  // Prevent pinch-zoom / double-tap zoom gestures on iOS inside the game.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // ----- Share -----
  function gameUrl() { return location.origin + location.pathname; }
  async function share() {
    const score = el.overScore.textContent;
    const text = 'I scored ' + score + ' in Math Survival! Can you beat me?';
    const url = gameUrl();
    if (navigator.share) {
      try { await navigator.share({ title: 'Math Survival', text, url }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; /* fall through to clipboard */ }
    }
    const full = text + ' ' + url;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(full);
      else {
        const ta = document.createElement('textarea');
        ta.value = full; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      }
      toast('Copied to clipboard ✓');
    } catch (e) {
      toast(full);
    }
  }

  api.game = game; // debug / test access

  // ----- Visit counter (GoatCounter public counter endpoint; silently hidden if unavailable) -----
  function loadVisits() {
    const node = $('start-visits');
    if (!node || !window.fetch) return;
    const site = (document.querySelector('script[data-goatcounter]') || {}).dataset;
    if (!site || !site.goatcounter) return;
    const base = site.goatcounter.replace(/\/count$/, '');
    const url = base + '/counter/' + location.pathname + '.json';
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 5000);
    fetch(url, { signal: ctrl ? ctrl.signal : undefined })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        const n = String(d.count || '').trim();
        if (!n || n === '0') return;
        node.innerHTML = '';
        node.appendChild(document.createTextNode('Played '));
        node.appendChild(Object.assign(document.createElement('strong'), { textContent: n }));
        node.appendChild(document.createTextNode(' times'));
        node.hidden = false;
      })
      .catch(() => { /* counter not public or offline: keep hidden */ })
      .then(() => clearTimeout(timer));
  }

  // ----- Boot -----
  renderStart();
  showScreen('start');
  loadVisits();
})();
