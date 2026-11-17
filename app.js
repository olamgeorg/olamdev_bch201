/* OlamDev BCH201 Quiz - app logic (vanilla JS, no dependencies). Needs questions.js loaded first. */
(function () {
  'use strict';

  /* ---------- storage helpers (never crash if storage is blocked) ---------- */
  var LS = { settings: 'olamdev_bch201_settings', history: 'olamdev_bch201_history', stats: 'olamdev_bch201_stats', prefs: 'olamdev_bch201_prefs' };
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  /* ---------- constants ---------- */
  var PASS = 50, EXAM_SEC_PER_Q = 45, TIMED_SEC = 60;
  var THEMES = [
    ['light', 'Light', '#f3f6fb', '#4f46e5', '#14213d'], ['dark', 'Dark', '#0f172a', '#60a5fa', '#e8edf7'],
    ['green', 'Green', '#ecfdf5', '#059669', '#0b3b2a'], ['blue', 'Blue', '#eff6ff', '#1d4ed8', '#0f2a52'],
    ['purple', 'Purple', '#f5f3ff', '#7c3aed', '#2e1065'], ['pink', 'Pink', '#fdf2f8', '#db2777', '#4a0d2b'],
    ['orange', 'Orange', '#fff7ed', '#ea580c', '#431c05'], ['amoled', 'Black / AMOLED', '#000000', '#22d3ee', '#f4f4f5']
  ];
  var BGS = [
    ['plain', 'Plain Color', 'var(--bg)'],
    ['gradient', 'Gradient', 'linear-gradient(135deg,var(--bg),var(--bg2))'],
    ['pattern', 'Pattern', 'radial-gradient(var(--pat) 2px,transparent 2.5px) 0 0/14px 14px,var(--bg)'],
    ['image', 'Image', 'radial-gradient(ellipse at 20% 10%,var(--bg2),transparent 60%),radial-gradient(ellipse at 80% 90%,var(--pat),transparent 60%),var(--card)']
  ];
  var FONTS = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];
  var COUNTS = ['10', '20', '30', '50', '100', 'All'];
  var MODES = {
    practice: ['Practice', 'Answer + explanation shown immediately. No timer.', '📘'],
    exam: ['Exam', 'No answers until the end. Timer on (' + EXAM_SEC_PER_Q + 's per question overall).', '📝'],
    timed: ['Timed / Track', TIMED_SEC + ' seconds per question, auto-next when time ends.', '⏱️']
  };

  /* ---------- topics built from the question bank ---------- */
  var TOPICS = [], GROUPS = [];
  (function () {
    var map = {};
    QUESTIONS.forEach(function (q) {
      if (!map[q.topic]) {
        var parts = q.topic.split(' - ');
        map[q.topic] = { name: q.topic, group: parts[0], short: parts.slice(1).join(' - ') || q.topic, qs: [] };
        TOPICS.push(map[q.topic]);
        if (GROUPS.indexOf(parts[0]) < 0) GROUPS.push(parts[0]);
      }
      map[q.topic].qs.push(q);
    });
  })();
  var ALL_NAMES = TOPICS.map(function (t) { return t.name; });

  /* ---------- state ---------- */
  var settings = Object.assign({ theme: 'light', bg: 'gradient', font: 'medium' }, load(LS.settings, {}));
  var prefs = Object.assign({ topics: ALL_NAMES.slice(), count: '20', mode: 'practice' }, load(LS.prefs, {}));
  prefs.topics = (prefs.topics || []).filter(function (n) { return ALL_NAMES.indexOf(n) >= 0; });
  var view = 'home';
  var quiz = null;          // active quiz
  var lastResult = null;    // result being displayed
  var sessionSeen = {};     // question ids already served this session
  var timerHandle = null;
  var deferredInstall = null;
  var resultFilter = 'all';

  var $app = document.getElementById('app');
  var $overlay = document.getElementById('overlay');
  var $nav = document.getElementById('bottomNav');
  var $install = document.getElementById('installBtn');

  /* ---------- utils ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fmt(s) { s = Math.max(0, Math.round(s)); var m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; }
  function fmtDate(ts) { try { return new Date(ts).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function grade(p) { return p >= 70 ? 'A' : p >= 60 ? 'B' : p >= 50 ? 'C' : p >= 40 ? 'D' : 'F'; }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200); }
  function topicLabel(names) {
    if (!names || !names.length) return '-';
    if (names.length === ALL_NAMES.length) return 'All topics';
    var s = names.map(function (n) { return n.split(' - ').slice(1).join(' - ') || n; });
    return s.length <= 2 ? s.join(', ') : s.slice(0, 2).join(', ') + ' +' + (s.length - 2) + ' more';
  }
  function countFor(names) { var c = 0; TOPICS.forEach(function (t) { if (names.indexOf(t.name) >= 0) c += t.qs.length; }); return c; }
  function quizCount(avail) { return prefs.count === 'All' ? avail : Math.min(parseInt(prefs.count, 10), avail); }

  /* ---------- settings / theme ---------- */
  function applySettings() {
    var h = document.documentElement;
    h.setAttribute('data-theme', settings.theme); h.setAttribute('data-bg', settings.bg); h.setAttribute('data-font', settings.font);
    try {
      var c = getComputedStyle(h).getPropertyValue('--card').trim();
      var m = document.querySelector('meta[name="theme-color"]'); if (m && c) m.setAttribute('content', c);
    } catch (e) { }
  }

  /* ---------- stats ---------- */
  function topicStats() {
    var st = (load(LS.stats, { q: {} }).q) || {}, res = {};
    TOPICS.forEach(function (t) {
      var att = 0, c = 0, tot = 0;
      t.qs.forEach(function (q) { var s = st[q.id]; if (s && (s.c + s.w) > 0) { att++; c += s.c; tot += s.c + s.w; } });
      res[t.name] = { att: att, total: t.qs.length, c: c, tot: tot, acc: tot ? Math.round(c / tot * 100) : null, comp: Math.round(att / t.qs.length * 100) };
    });
    return res;
  }
  function recordStats(q) {
    var data = load(LS.stats, { q: {} }); data.q = data.q || {};
    q.qs.forEach(function (it, i) {
      var a = q.answers[i]; if (a === null) return;
      var s = data.q[it.base.id] || { c: 0, w: 0 };
      if (a === it.correct) s.c++; else s.w++;
      data.q[it.base.id] = s;
    });
    save(LS.stats, data);
  }

  /* ---------- quiz building ---------- */
  function makeItems(bases) {
    return shuffle(bases).map(function (b) {
      var perm = shuffle([0, 1, 2, 3]);
      return { base: b, opts: perm.map(function (i) { return b.options[i]; }), correct: perm.indexOf(b.correctAnswer) };
    });
  }
  function draw(names, n) {
    var pool = QUESTIONS.filter(function (q) { return names.indexOf(q.topic) >= 0; });
    var fresh = pool.filter(function (q) { return !sessionSeen[q.id]; });
    if (fresh.length < n) { pool.forEach(function (q) { delete sessionSeen[q.id]; }); fresh = pool; } // pool exhausted -> restart
    var pick = shuffle(fresh).slice(0, n);
    pick.forEach(function (q) { sessionSeen[q.id] = 1; });
    return pick;
  }
  function startQuiz(bases, mode, names, count) {
    clearTimer();
    var items = makeItems(bases), n = items.length;
    quiz = {
      mode: mode, qs: items, idx: 0, answers: items.map(function () { return null; }), names: names, count: count,
      used: 0, last: Date.now(), paused: false, done: false,
      remaining: n * EXAM_SEC_PER_Q, qRemaining: TIMED_SEC
    };
    view = 'quiz'; resultFilter = 'all';
    render(); window.scrollTo(0, 0);
    timerHandle = setInterval(tick, 500);
  }
  function clearTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }

  function tick() {
    if (!quiz || quiz.done || quiz.paused) return;
    var now = Date.now(), dt = (now - quiz.last) / 1000; quiz.last = now; if (dt < 0) dt = 0;
    quiz.used += dt;
    if (quiz.mode === 'exam') {
      quiz.remaining -= dt;
      if (quiz.remaining <= 0) { quiz.remaining = 0; finish(true); return; }
    } else if (quiz.mode === 'timed') {
      quiz.qRemaining -= dt;
      if (quiz.qRemaining <= 0) { quiz.qRemaining = 0; advance(true); return; }
    }
    updateTimerEl();
  }
  function updateTimerEl() {
    var el = document.getElementById('tv'); if (!el || !quiz) return;
    var v = quiz.mode === 'exam' ? quiz.remaining : quiz.qRemaining;
    el.textContent = fmt(v);
    var box = el.parentNode; var low = quiz.mode === 'exam' ? v <= 60 : v <= 10;
    box.classList.toggle('low', low);
  }

  function advance(auto) {
    if (quiz.idx < quiz.qs.length - 1) {
      quiz.idx++; quiz.qRemaining = TIMED_SEC; renderQuiz(); window.scrollTo(0, 0);
    } else if (auto) finish(true);
    else confirmSubmit();
  }

  function finish(auto) {
    if (!quiz || quiz.done) return;
    quiz.done = true; clearTimer(); closeModal();
    var total = quiz.qs.length, c = 0, w = 0, s = 0;
    quiz.answers.forEach(function (a, i) { if (a === null) s++; else if (a === quiz.qs[i].correct) c++; else w++; });
    var pct = total ? Math.round(c / total * 1000) / 10 : 0;
    var res = { quiz: quiz, correct: c, wrong: w, skipped: s, total: total, pct: pct, grade: grade(pct), pass: pct >= PASS, used: Math.round(quiz.used), auto: !!auto };
    lastResult = res;
    recordStats(quiz);
    var hist = load(LS.history, []);
    hist.unshift({ id: Date.now(), date: Date.now(), topics: quiz.names, mode: quiz.mode, score: c, total: total, pct: pct, wrong: w, skipped: s, used: res.used, grade: res.grade });
    save(LS.history, hist.slice(0, 300));
    view = 'result'; render(); window.scrollTo(0, 0);
  }

  /* ---------- modal ---------- */
  function showModal(html) { $overlay.innerHTML = '<div class="modal">' + html + '</div>'; $overlay.classList.remove('hidden'); }
  function closeModal() { $overlay.classList.add('hidden'); $overlay.innerHTML = ''; }
  function confirmSubmit() {
    var un = quiz.answers.filter(function (a) { return a === null; }).length;
    showModal('<h2>Submit quiz?</h2><p class="muted">' + (un ? un + ' question(s) are unanswered and will count as skipped.' : 'You have answered every question.') +
      '</p><div class="row" style="justify-content:center;margin-top:1rem"><button class="btn" data-act="closeModal">Keep going</button><button class="btn primary" data-act="submitNow">Submit</button></div>');
  }

  /* ---------- navigation ---------- */
  function go(v) {
    if (view === 'quiz' && quiz && !quiz.done) {
      showModal('<h2>Leave this quiz?</h2><p class="muted">You can submit what you have, or discard the quiz.</p>' +
        '<div class="row" style="justify-content:center;margin-top:1rem;flex-direction:column;align-items:stretch">' +
        '<button class="btn primary" data-act="closeModal">Continue quiz</button><button class="btn" data-act="submitNow">Submit now</button>' +
        '<button class="btn danger" data-act="quit" data-go="' + v + '">Discard &amp; leave</button></div>');
      return;
    }
    view = v; render(); window.scrollTo(0, 0);
  }

  /* ---------- renderers ---------- */
  function render(noanim) {
    $app.classList.toggle('noanim', !!noanim);
    $nav.classList.toggle('hidden', view === 'quiz');
    Array.prototype.forEach.call($nav.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.getAttribute('data-go') === view); });
    if (view === 'home') renderHome();
    else if (view === 'quiz') renderQuiz();
    else if (view === 'result') renderResult();
    else if (view === 'scores') renderScores();
    else if (view === 'settings') renderSettings();
  }

  function renderHome() {
    var hist = load(LS.history, []);
    var h = '<div class="card hero"><h1>OlamDev BCH201 Quiz</h1><p>Biochemistry 201 - Amino Acids &amp; GI Digestion</p>' +
      '<p class="small">Welcome! Pick your topics, choose a mode and start practising. Every question comes from your lecturers\' notes.</p>' +
      '<div class="stats"><span class="pill">' + QUESTIONS.length + ' questions</span><span class="pill">' + TOPICS.length + ' topics</span><span class="pill">' + hist.length + ' quizzes taken</span></div></div>';

    h += '<div class="card"><div class="row"><h2 style="margin:0">1. Select topics</h2><span class="spacer"></span>' +
      '<button class="btn sm" data-act="selAll">Select All</button><button class="btn sm" data-act="clrAll">Clear All</button></div>';
    GROUPS.forEach(function (g) {
      h += '<div class="group-h"><span>' + (g.indexOf('Amino') === 0 ? '🧬 ' : '🍽️ ') + esc(g) + '</span><button class="btn sm" data-act="selGroup" data-g="' + esc(g) + '">Toggle group</button></div>';
      TOPICS.filter(function (t) { return t.group === g; }).forEach(function (t) {
        var on = prefs.topics.indexOf(t.name) >= 0;
        h += '<label class="topic' + (on ? ' on' : '') + '"><input type="checkbox" data-topic="' + esc(t.name) + '"' + (on ? ' checked' : '') + '>' +
          '<span class="t">' + esc(t.name) + '</span><span class="n">(' + t.qs.length + ' questions)</span></label>';
      });
    });
    h += '</div>';

    h += '<div class="card"><h2>2. Number of questions</h2><div class="chips">' +
      COUNTS.map(function (c) { return '<button class="chip' + (prefs.count === c ? ' on' : '') + '" data-act="count" data-v="' + c + '">' + c + '</button>'; }).join('') + '</div></div>';

    h += '<div class="card"><h2>3. Quiz mode</h2><div class="modes">' +
      Object.keys(MODES).map(function (k) { var m = MODES[k]; return '<button class="mode' + (prefs.mode === k ? ' on' : '') + '" data-act="mode" data-v="' + k + '"><b>' + m[2] + ' ' + m[0] + '</b><span>' + m[1] + '</span></button>'; }).join('') + '</div></div>';

    h += '<div class="sticky-start"><div class="sel-info" id="selInfo"></div><button class="btn primary block" id="startBtn" data-act="start">▶ Start Quiz</button></div>';

    if (hist.length) {
      var l = hist[0];
      h += '<div class="card" style="margin-top:1rem"><h2>My Scores</h2><p class="muted small">Last quiz: ' + esc(fmtDate(l.date)) + ' - ' + esc(MODES[l.mode] ? MODES[l.mode][0] : l.mode) + '</p>' +
        '<p><b style="font-size:1.4rem">' + l.score + '/' + l.total + '</b> <span class="muted">(' + l.pct + '%)</span></p>' +
        '<button class="btn sm" data-act="go" data-go="scores">Open dashboard</button></div>';
    }
    $app.innerHTML = h; refreshHome();
  }

  function refreshHome() {
    var info = document.getElementById('selInfo'), btn = document.getElementById('startBtn'); if (!info || !btn) return;
    var avail = countFor(prefs.topics), n = quizCount(avail);
    info.textContent = prefs.topics.length ? prefs.topics.length + ' topic(s) selected - ' + avail + ' questions available - quiz will have ' + n + ' question(s).' : 'Select at least one topic to begin.';
    btn.disabled = !prefs.topics.length;
    Array.prototype.forEach.call($app.querySelectorAll('input[data-topic]'), function (cb) {
      var on = prefs.topics.indexOf(cb.getAttribute('data-topic')) >= 0; cb.checked = on; cb.parentNode.classList.toggle('on', on);
    });
    save(LS.prefs, prefs);
  }

  function renderQuiz() {
    var Z = quiz, n = Z.qs.length, it = Z.qs[Z.idx], ans = Z.answers[Z.idx];
    var fb = Z.mode === 'practice' && ans !== null;
    var L = ['A', 'B', 'C', 'D'];
    var h = '<div class="card"><div class="qhead"><span class="qnum">Question ' + (Z.idx + 1) + ' / ' + n + '</span><span class="spacer"></span>';
    if (Z.mode !== 'practice') {
      var v = Z.mode === 'exam' ? Z.remaining : Z.qRemaining, low = Z.mode === 'exam' ? v <= 60 : v <= 10;
      h += '<span class="timer' + (low ? ' low' : '') + '">⏱ <span id="tv">' + fmt(v) + '</span></span><button class="iconbtn" data-act="pause" aria-label="Pause">⏸</button>';
    }
    h += '<button class="btn sm danger" data-act="endQuiz">End</button></div><div class="bar"><div style="width:' + Math.round((Z.idx + 1) / n * 100) + '%"></div></div>';
    h += '<div class="qtag"><span class="tag">' + esc(it.base.topic.split(' - ').slice(1).join(' - ')) + '</span><span class="tag ' + it.base.difficulty + '">' + it.base.difficulty + '</span><span class="tag">' + MODES[Z.mode][0] + '</span></div>';
    h += '<div class="qtext">' + esc(it.base.question) + '</div>';
    it.opts.forEach(function (o, i) {
      var cls = 'opt';
      if (fb) { if (i === it.correct) cls += ' right'; else if (i === ans) cls += ' wrong'; } else if (ans === i) cls += ' sel';
      h += '<button class="' + cls + '" data-act="opt" data-i="' + i + '"' + (fb ? ' disabled' : '') + '><span class="l">' + L[i] + '</span><span>' + esc(o) + '</span></button>';
    });
    if (fb) h += '<div class="explain"><b>' + (ans === it.correct ? '✅ Correct!' : '❌ Wrong - correct answer: ' + L[it.correct] + '. ' + esc(it.opts[it.correct])) + '</b><br>' + esc(it.base.explanation) + '<br><span class="muted small">Source: ' + esc(it.base.source) + '</span></div>';
    h += '</div>';
    var last = Z.idx === n - 1;
    h += '<div class="qnav"><button class="btn" data-act="prev"' + (Z.idx === 0 || Z.mode === 'timed' ? ' disabled' : '') + '>◀ Prev</button>' +
      '<button class="btn" data-act="skip">Skip ⏭</button>' +
      (last ? '<button class="btn primary" data-act="submit">Submit ✔</button>' : '<button class="btn primary" data-act="next">Next ▶</button>') + '</div>';
    var same = (Z.rIdx === Z.idx); Z.rIdx = Z.idx; $app.classList.toggle('noanim', same); $app.innerHTML = h;
  }

  function renderResult() {
    var R = lastResult, C = 2 * Math.PI * 80, col = R.pass ? 'var(--good)' : 'var(--bad)';
    var L = ['A', 'B', 'C', 'D'];
    var h = '<div class="card" style="text-align:center"><h2>' + (R.auto ? '⏰ Time is up - quiz submitted' : 'Quiz complete') + '</h2>' +
      '<div class="ring"><svg width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="80" fill="none" stroke="var(--soft)" stroke-width="16"/>' +
      '<circle id="ringArc" cx="100" cy="100" r="80" fill="none" stroke="' + col + '" stroke-width="16" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '" style="transition:stroke-dashoffset 1.1s ease"/></svg>' +
      '<div class="c"><b>' + R.pct + '%</b><span class="muted">' + R.correct + ' / ' + R.total + '</span></div></div>' +
      '<div class="row" style="justify-content:center"><span class="verdict ' + (R.pass ? 'pass' : 'fail') + '">' + (R.pass ? 'PASS ✔' : 'FAIL ✖') + '</span><span class="verdict" style="background:var(--soft)">Grade ' + R.grade + '</span></div>' +
      '<p class="muted small">Pass mark: ' + PASS + '% - Grades: A 70+, B 60-69, C 50-59, D 40-49, F below 40</p>' +
      '<div class="grid3" style="margin-top:.8rem"><div class="stat g"><b>' + R.correct + '</b><span>Correct</span></div><div class="stat r"><b>' + R.wrong + '</b><span>Wrong</span></div><div class="stat o"><b>' + R.skipped + '</b><span>Skipped</span></div></div>' +
      '<p class="muted small" style="margin-top:.8rem">Mode: ' + MODES[R.quiz.mode][0] + ' - Time used: ' + fmt(R.used) + ' - ' + esc(topicLabel(R.quiz.names)) + '</p>' +
      '<div class="row" style="justify-content:center;margin-top:.6rem"><button class="btn primary" data-act="retake">🔁 Retake</button><button class="btn" data-act="newquiz">🆕 New Quiz</button><button class="btn" data-act="home">🏠 Go Home</button></div></div>';
    h += '<div class="card"><h2>Review answers</h2><div class="chips" style="margin-bottom:.8rem">' +
      [['all', 'All'], ['wrong', 'Wrong'], ['skipped', 'Skipped'], ['correct', 'Correct']].map(function (f) { return '<button class="chip' + (resultFilter === f[0] ? ' on' : '') + '" data-act="filter" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>';
    var shown = 0;
    R.quiz.qs.forEach(function (it, i) {
      var a = R.quiz.answers[i], st = a === null ? 'sk' : a === it.correct ? 'ok' : 'no';
      var key = st === 'sk' ? 'skipped' : st === 'ok' ? 'correct' : 'wrong';
      if (resultFilter !== 'all' && resultFilter !== key) return;
      shown++;
      h += '<div class="review-item ' + st + '"><div class="qtag" style="margin-top:0"><span class="tag">Q' + (i + 1) + '</span><span class="tag">' + esc(it.base.topic.split(' - ').slice(1).join(' - ')) + '</span><span class="tag ' + it.base.difficulty + '">' + it.base.difficulty + '</span><span class="tag">' + (st === 'ok' ? '✅ Correct' : st === 'no' ? '❌ Wrong' : '⏭ Skipped') + '</span></div>' +
        '<p><b>' + esc(it.base.question) + '</b></p>';
      it.opts.forEach(function (o, k) {
        var c = 'ropt' + (k === it.correct ? ' right' : (k === a ? ' wrong' : ''));
        h += '<div class="' + c + '">' + L[k] + '. ' + esc(o) + (k === it.correct ? ' ✔' : '') + (k === a && k !== it.correct ? ' (your answer)' : '') + '</div>';
      });
      h += '<div class="explain">' + esc(it.base.explanation) + '<br><span class="muted small">Source: ' + esc(it.base.source) + '</span></div></div>';
    });
    if (!shown) h += '<p class="muted">Nothing to show for this filter.</p>';
    h += '</div>';
    $app.innerHTML = h;
    setTimeout(function () { var a = document.getElementById('ringArc'); if (a) a.style.strokeDashoffset = C * (1 - R.pct / 100); }, 80);
  }

  function renderScores() {
    var hist = load(LS.history, []), ts = topicStats();
    var h = '<div class="card"><h2>📊 My Scores</h2>';
    if (!hist.length) h += '<p class="muted">No quizzes yet. Take a quiz and your results will be saved here, even after you close the app.</p><button class="btn primary" data-act="go" data-go="home">Start a quiz</button></div>';
    else {
      var avg = Math.round(hist.reduce(function (s, x) { return s + x.pct; }, 0) / hist.length * 10) / 10;
      var best = Math.max.apply(null, hist.map(function (x) { return x.pct; }));
      h += '<div class="stats4"><div class="stat"><b>' + hist.length + '</b><span>Quizzes taken</span></div><div class="stat"><b>' + avg + '%</b><span>Average score</span></div><div class="stat g"><b>' + best + '%</b><span>Best score</span></div><div class="stat"><b>' + hist[0].pct + '%</b><span>Last score</span></div></div></div>';
    }
    // progress per group + topic
    h += '<div class="card"><h2>Progress by topic</h2><p class="muted small">Bar = share of the topic\'s questions you have attempted. Accuracy = answers you got right. Green = strong (70%+), red = weak (below 50%).</p>';
    GROUPS.forEach(function (g) {
      var tt = TOPICS.filter(function (t) { return t.group === g; }), att = 0, tot = 0, c = 0, n = 0;
      tt.forEach(function (t) { var s = ts[t.name]; att += s.att; tot += s.total; c += s.c; n += s.tot; });
      var comp = Math.round(att / tot * 100);
      h += '<div class="group-h" style="margin-top:1rem"><span>' + (g.indexOf('Amino') === 0 ? '🧬 ' : '🍽️ ') + esc(g) + '</span><span>' + comp + '% completed</span></div><div class="bar"><div style="width:' + comp + '%"></div></div>' +
        '<p class="muted small">' + att + ' of ' + tot + ' questions attempted' + (n ? ' - accuracy ' + Math.round(c / n * 100) + '%' : '') + '</p>';
      tt.forEach(function (t) {
        var s = ts[t.name], cls = s.acc === null ? '' : s.acc >= 70 ? 'strong' : s.acc < 50 ? 'weak' : 'mid';
        var tag = s.acc === null ? 'Not started' : s.acc >= 70 ? 'Strong' : s.acc < 50 ? 'Weak' : 'Average';
        h += '<div class="trow"><div class="top"><span>' + esc(t.short) + '</span><span class="' + cls + '">' + tag + (s.acc !== null ? ' - ' + s.acc + '%' : '') + '</span></div>' +
          '<div class="bar"><div style="width:' + s.comp + '%"></div></div><div class="muted small">' + s.comp + '% completed (' + s.att + '/' + s.total + ')</div></div>';
      });
    });
    h += '</div>';
    if (hist.length) {
      h += '<div class="card"><div class="row"><h2 style="margin:0">History</h2><span class="spacer"></span><button class="btn sm danger" data-act="clearHistory">Clear History</button></div>';
      hist.slice(0, 100).forEach(function (x) {
        h += '<div class="hist"><div><b>' + x.score + '/' + x.total + ' <span class="muted">(' + x.pct + '% - ' + esc(x.grade || grade(x.pct)) + ')</span></b><br><span class="muted">' + esc(fmtDate(x.date)) + '</span><br><span class="muted">' + esc(topicLabel(x.topics)) + '</span></div>' +
          '<div style="text-align:right"><span class="tag">' + esc(MODES[x.mode] ? MODES[x.mode][0] : x.mode) + '</span><br><span class="muted">⏱ ' + fmt(x.used) + '</span><br><span class="' + (x.pct >= PASS ? 'strong' : 'weak') + '"><b>' + (x.pct >= PASS ? 'Pass' : 'Fail') + '</b></span></div></div>';
      });
      h += '</div>';
    }
    $app.innerHTML = h;
  }

  function renderSettings() {
    var h = '<div class="card"><h2>🎨 Theme</h2><div class="swatches">' +
      THEMES.map(function (t) { return '<button class="sw' + (settings.theme === t[0] ? ' on' : '') + '" data-act="theme" data-v="' + t[0] + '" style="background:linear-gradient(135deg,' + t[2] + ' 50%,' + t[3] + ' 50%);color:' + t[4] + '"><span style="background:' + t[2] + ';padding:0 .3rem;border-radius:6px">' + t[1] + '</span></button>'; }).join('') + '</div></div>';
    h += '<div class="card"><h2>🖼️ Background</h2><div class="swatches">' +
      BGS.map(function (b) { return '<button class="sw' + (settings.bg === b[0] ? ' on' : '') + '" data-act="bg" data-v="' + b[0] + '" style="background:' + b[2] + '"><span style="background:var(--card);padding:0 .3rem;border-radius:6px">' + b[1] + '</span></button>'; }).join('') + '</div></div>';
    h += '<div class="card"><h2>🔠 Font size</h2><div class="chips">' +
      FONTS.map(function (f) { return '<button class="chip' + (settings.font === f[0] ? ' on' : '') + '" data-act="font" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div></div>';
    h += '<div class="card"><h2>📲 App</h2><p class="muted small">Install OlamDev BCH201 on your phone or computer. After the first load it works offline.</p><div class="row"><button class="btn primary" data-act="install">⬇ Install App</button><button class="btn" data-act="resetSettings">Reset appearance</button></div>' +
      '<p class="muted small" style="margin-top:.8rem">Question bank: ' + QUESTIONS.length + ' questions from the BCH201 Amino Acids notes and the GI Digestion notes.</p></div>';
    $app.innerHTML = h;
  }

  /* ---------- install ---------- */
  function isStandalone() { try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; } }
  function doInstall() {
    if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.then(function () { deferredInstall = null; }); return; }
    if (isStandalone()) { toast('App is already installed'); return; }
    showModal('<h2>Install OlamDev BCH201</h2><p class="muted" style="text-align:left"><b>Android (Chrome):</b> tap the ⋮ menu, then <b>Install app</b> or <b>Add to Home screen</b>.<br><br><b>iPhone (Safari):</b> tap the Share button, then <b>Add to Home Screen</b>.<br><br><b>Desktop (Chrome/Edge):</b> click the install icon in the address bar.<br><br>Note: installing needs the site to be opened from its https:// link (for example your Vercel link), not from a local file.</p><button class="btn primary block" data-act="closeModal">Got it</button>');
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; });
  window.addEventListener('appinstalled', function () { deferredInstall = null; $install.classList.add('hidden'); toast('Installed ✔'); });
  if (!isStandalone()) $install.classList.remove('hidden');

  /* ---------- events ---------- */
  document.addEventListener('change', function (e) {
    var cb = e.target.closest && e.target.closest('input[data-topic]'); if (!cb) return;
    var n = cb.getAttribute('data-topic'), i = prefs.topics.indexOf(n);
    if (cb.checked && i < 0) prefs.topics.push(n); else if (!cb.checked && i >= 0) prefs.topics.splice(i, 1);
    refreshHome();
  });

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) {
      if (e.target.closest && e.target.closest('#logoBtn')) go('home');
      else if (e.target.closest && e.target.closest('#settingsBtn')) go('settings');
      else if (e.target.closest && e.target.closest('#installBtn')) doInstall();
      else if (e.target.closest && e.target.closest('#bottomNav button')) go(e.target.closest('#bottomNav button').getAttribute('data-go'));
      return;
    }
    var act = el.getAttribute('data-act'), v = el.getAttribute('data-v');
    switch (act) {
      case 'selAll': prefs.topics = ALL_NAMES.slice(); refreshHome(); break;
      case 'clrAll': prefs.topics = []; refreshHome(); break;
      case 'selGroup': (function () {
        var g = el.getAttribute('data-g'), names = TOPICS.filter(function (t) { return t.group === g; }).map(function (t) { return t.name; });
        var allOn = names.every(function (n) { return prefs.topics.indexOf(n) >= 0; });
        prefs.topics = prefs.topics.filter(function (n) { return names.indexOf(n) < 0; });
        if (!allOn) prefs.topics = prefs.topics.concat(names);
        refreshHome();
      })(); break;
      case 'count': prefs.count = v; Array.prototype.forEach.call($app.querySelectorAll('[data-act="count"]'), function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); }); refreshHome(); break;
      case 'mode': prefs.mode = v; Array.prototype.forEach.call($app.querySelectorAll('[data-act="mode"]'), function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); }); refreshHome(); break;
      case 'start': (function () {
        if (!prefs.topics.length) { toast('Select at least one topic'); return; }
        var n = quizCount(countFor(prefs.topics));
        startQuiz(draw(prefs.topics, n), prefs.mode, prefs.topics.slice(), prefs.count);
      })(); break;
      case 'go': go(el.getAttribute('data-go')); break;
      case 'home': go('home'); break;
      case 'opt': (function () {
        if (!quiz || quiz.done || quiz.paused) return;
        if (quiz.mode === 'practice' && quiz.answers[quiz.idx] !== null) return;
        var i = parseInt(el.getAttribute('data-i'), 10);
        quiz.answers[quiz.idx] = (quiz.mode !== 'practice' && quiz.answers[quiz.idx] === i) ? null : i; // tap again to un-select (exam/timed)
        renderQuiz();
      })(); break;
      case 'prev': if (quiz && quiz.idx > 0 && quiz.mode !== 'timed') { quiz.idx--; renderQuiz(); window.scrollTo(0, 0); } break;
      case 'next': case 'skip': if (quiz) { if (quiz.idx < quiz.qs.length - 1) advance(false); else confirmSubmit(); } break;
      case 'submit': case 'endQuiz': if (quiz) confirmSubmit(); break;
      case 'submitNow': finish(false); break;
      case 'pause': if (quiz && !quiz.paused) {
        quiz.paused = true;
        showModal('<h2>⏸ Paused</h2><p class="muted">Your timer is stopped and the question is hidden.</p><button class="btn primary block" data-act="resume">▶ Resume</button>');
      } break;
      case 'resume': if (quiz) { quiz.paused = false; quiz.last = Date.now(); closeModal(); } break;
      case 'closeModal': closeModal(); break;
      case 'quit': (function () { var t = el.getAttribute('data-go'); clearTimer(); quiz = null; closeModal(); view = t; render(); window.scrollTo(0, 0); })(); break;
      case 'retake': if (lastResult) startQuiz(lastResult.quiz.qs.map(function (x) { return x.base; }), lastResult.quiz.mode, lastResult.quiz.names, lastResult.quiz.count); break;
      case 'newquiz': if (lastResult) {
        var Q = lastResult.quiz, avail = countFor(Q.names), n = Q.count === 'All' ? avail : Math.min(parseInt(Q.count, 10), avail);
        startQuiz(draw(Q.names, n), Q.mode, Q.names, Q.count);
      } break;
      case 'filter': resultFilter = el.getAttribute('data-f'); $app.classList.add('noanim'); renderResult(); break;
      case 'clearHistory':
        showModal('<h2>Clear history?</h2><p class="muted">This deletes all saved scores, history and topic progress on this device.</p><div class="row" style="justify-content:center;margin-top:1rem"><button class="btn" data-act="closeModal">Cancel</button><button class="btn danger" data-act="confirmClear">Clear</button></div>'); break;
      case 'confirmClear': try { localStorage.removeItem(LS.history); localStorage.removeItem(LS.stats); } catch (err) { } closeModal(); renderScores(); toast('History cleared'); break;
      case 'theme': $app.classList.add('noanim'); settings.theme = v; save(LS.settings, settings); applySettings(); renderSettings(); break;
      case 'bg': $app.classList.add('noanim'); settings.bg = v; save(LS.settings, settings); applySettings(); renderSettings(); break;
      case 'font': $app.classList.add('noanim'); settings.font = v; save(LS.settings, settings); applySettings(); renderSettings(); break;
      case 'resetSettings': $app.classList.add('noanim'); settings = { theme: 'light', bg: 'gradient', font: 'medium' }; save(LS.settings, settings); applySettings(); renderSettings(); break;
      case 'install': doInstall(); break;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (view !== 'quiz' || !quiz || quiz.done || quiz.paused || !$overlay.classList.contains('hidden')) return;
    var k = e.key.toLowerCase(), map = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 };
    if (k in map) { var b = $app.querySelectorAll('[data-act="opt"]')[map[k]]; if (b && !b.disabled) b.click(); }
    else if (k === 'arrowright') { var n = $app.querySelector('[data-act="next"]'); if (n) n.click(); }
    else if (k === 'arrowleft') { var p = $app.querySelector('[data-act="prev"]'); if (p && !p.disabled) p.click(); }
  });

  /* ---------- service worker (only on http/https) ---------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
  }

  applySettings();
  render();
})();
