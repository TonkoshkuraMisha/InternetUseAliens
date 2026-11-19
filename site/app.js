"use strict";
// Прогрес зберігається лише в браузері (localStorage); жодних персональних даних не збираємо.
const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Профілі й прогрес лише в localStorage цього браузера; пароль не потрібен і не збирається.
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const profiles = {
  list: () => ls.get("profiles", []),
  current: () => ls.get("currentProfile", null),
  select(name) { ls.set("currentProfile", name); },
  add(name) { const l = this.list(); if (!l.some((n) => n.toLowerCase() === name.toLowerCase())) ls.set("profiles", [...l, name]); },
  remove(name) { ls.set("profiles", this.list().filter((n) => n !== name)); ls.del("progress:" + name); if (this.current() === name) ls.del("currentProfile"); },
};
const store = {
  get() { return ls.get("progress:" + profiles.current(), {}); },
  set(v) { ls.set("progress:" + profiles.current(), v); },
};
let course, current = 0, view = "lesson";

// Мінімальний безпечний рендер markdown: заголовки, списки (- і 1.), **жирний**, `код`.
function md(src) {
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>");
  let html = "", list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const line of src.split("\n")) {
    const ul = line.match(/^- (.*)/), ol = line.match(/^\d+\. (.*)/), h = line.match(/^(#{1,3}) (.*)/);
    const kind = ul ? "ul" : ol ? "ol" : null;
    if (list && list !== kind) close();
    if (kind) { if (!list) { html += `<${kind}>`; list = kind; } html += `<li>${inline((ul || ol)[1])}</li>`; }
    else if (h) html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
    else if (line.trim()) html += `<p>${inline(line)}</p>`;
  }
  close();
  return html;
}

const titleOf = (m) => (m.lesson.match(/^# (.*)/) || [, m.id])[1];
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const modulesPassed = (p) => course.modules.filter((m) => p[m.id]?.passed).length;
const allPassed = (p) => modulesPassed(p) === course.modules.length;
const pct = (x) => Math.round(x * 100) + "%";

function renderNav() {
  const p = store.get();
  const inModule = view === "lesson" || view === "quiz";
  let html = course.modules.map((m, i) => {
    const done = p[m.id]?.passed, best = p[m.id]?.best;
    const sub = done ? `Складено · ${pct(best)}` : best != null ? `Найкращий: ${pct(best)}` : "Не розпочато";
    return `<button class="mod ${done ? "done" : ""}" data-i="${i}" ${inModule && i === current ? 'aria-current="true"' : ""}>` +
      `<span class="num">${done ? "✓" : i + 1}</span><span class="txt">${esc(titleOf(m))}<small>${sub}</small></span></button>`;
  }).join("");
  const ex = p.__exam, tr = p.__trainer;
  html += `<p class="side-title extra">Додатково</p>` +
    `<button class="mod ${tr?.best != null ? "done" : ""}" data-x="trainer" ${view === "trainer" ? 'aria-current="true"' : ""}><span class="num">🎯</span>` +
    `<span class="txt">Тренажер «Шахрай чи ні»<small>${tr?.best != null ? "Найкращий: " + pct(tr.best) : "Тренування на прикладах"}</small></span></button>` +
    `<button class="mod ${ex?.passed ? "done" : ""}" data-x="exam" ${view === "exam" ? 'aria-current="true"' : ""}><span class="num">${ex?.passed ? "✓" : "🏁"}</span>` +
    `<span class="txt">Підсумковий іспит<small>${ex?.passed ? "Складено · " + pct(ex.best) : allPassed(p) ? "Доступний" : "Після всіх модулів"}</small></span></button>` +
    `<a class="mod" href="cheatsheet.html" target="_blank" rel="noopener"><span class="num">📄</span>` +
    `<span class="txt">Пам'ятка «10 правил»<small>Для друку</small></span></a>`;
  $("#nav").innerHTML = html;
  const n = modulesPassed(p), total = course.modules.length, pc = Math.round(n / total * 100);
  $("#progressText").textContent = `Пройдено ${n} з ${total}`;
  $("#barFill").style.width = pc + "%";
  $("#bar").setAttribute("aria-valuenow", pc);
}

const stepsHtml = () =>
  `<div class="steps" role="tablist"><button role="tab" data-v="lesson" aria-selected="${view === "lesson"}">Урок</button>` +
  `<button role="tab" data-v="quiz" aria-selected="${view === "quiz"}">Тест</button></div>`;

function show(i, v) {
  current = i; view = v;
  closeMenu(); renderNav();
  ({ lesson: showLesson, quiz: showQuiz, trainer: showTrainer, exam: showExam, cert: showCert })[v]();
  $("#app").querySelectorAll(".steps button").forEach((b) => (b.onclick = () => show(current, b.dataset.v)));
  window.scrollTo({ top: 0 });
  $("#app").focus({ preventScroll: true });
}

function showLesson() {
  const m = course.modules[current];
  $("#app").innerHTML = `<article class="card">${stepsHtml()}<p class="kicker">Модуль ${current + 1} з ${course.modules.length}</p>` +
    `<div class="lesson">${md(m.lesson)}</div><div class="actions">` +
    (current > 0 ? `<button class="btn" id="prev">← Попередній</button>` : "") +
    `<button class="btn primary" id="go">Перейти до тесту →</button></div></article>`;
  $("#go").onclick = () => show(current, "quiz");
  if ($("#prev")) $("#prev").onclick = () => show(current - 1, "lesson");
}

function isCorrect(q, picked) {
  const want = q.type === "truefalse" ? [q.answer ? 0 : 1] : q.answer;
  return picked.length === want.length && want.every((x) => picked.includes(x));
}

// Універсальний рендер тесту: cfg = { steps, kicker, heading, hint, questions, passScore, onDone(right,total,passed) -> {msg, buttons:[{label,primary,fn}]} }
function renderQuiz(cfg) {
  $("#app").innerHTML = `<article class="card">${cfg.steps ? stepsHtml() : ""}${cfg.kicker ? `<p class="kicker">${cfg.kicker}</p>` : ""}` +
    `<div class="quiz-head"><h1>${cfg.heading}</h1></div><p class="hint">${cfg.hint}</p>` +
    `<form id="quiz" novalidate>` + cfg.questions.map((q, qi) => {
      const opts = q.type === "truefalse" ? ["Правда", "Неправда"] : q.options;
      const type = q.type === "multi" ? "checkbox" : "radio";
      return `<div class="q" id="q${qi}" role="group" aria-labelledby="qt${qi}"><p class="q-text" id="qt${qi}"><span class="n">${qi + 1}</span>${esc(q.text)}</p>` +
        (q.type === "multi" ? `<p class="q-note">Можна обрати кілька варіантів</p>` : "") +
        opts.map((o, oi) => `<label class="opt"><input type="${type}" name="q${qi}" value="${oi}"><span>${esc(o)}</span></label>`).join("") +
        `<div class="fb" id="fb${qi}" hidden></div></div>`;
    }).join("") + `</form><div id="result"></div>` +
    `<div class="actions" id="acts"><button class="btn primary" id="check">Перевірити відповіді</button></div></article>`;
  $("#check").onclick = () => {
    let right = 0;
    cfg.questions.forEach((q, qi) => {
      const box = $(`#q${qi}`), inputs = [...box.querySelectorAll("input")];
      const picked = inputs.filter((x) => x.checked).map((x) => +x.value);
      const want = q.type === "truefalse" ? [q.answer ? 0 : 1] : q.answer;
      const ok = isCorrect(q, picked);
      if (ok) right++;
      box.classList.add("locked", ok ? "right" : "wrong");
      inputs.forEach((inp) => {
        inp.disabled = true;
        const lab = inp.closest(".opt"), v = +inp.value;
        if (want.includes(v)) lab.classList.add("is-right"); else if (picked.includes(v)) lab.classList.add("is-wrong");
      });
      const fb = $(`#fb${qi}`);
      fb.hidden = false;
      fb.innerHTML = `<b class="${ok ? "ok" : "bad"}">${ok ? "Вірно." : "Невірно."}</b> ${esc(q.explanation)}`;
    });
    const total = cfg.questions.length, passed = right / total >= cfg.passScore;
    const out = cfg.onDone(right, total, passed);
    renderNav();
    $("#result").innerHTML = `<div class="result ${passed ? "pass" : "fail"}" role="status"><span class="score">${right}/${total}</span>` +
      `<p><strong>${passed ? "Тест складено!" : "Ще трохи не вистачило."}</strong>${out.msg}</p></div>`;
    $("#acts").innerHTML = out.buttons.map((b, i) => `<button class="btn ${b.primary ? "primary" : ""}" data-b="${i}">${b.label}</button>`).join("");
    $("#acts").querySelectorAll("button").forEach((b) => (b.onclick = out.buttons[+b.dataset.b].fn));
    $("#result").scrollIntoView({ behavior: "smooth", block: "center" });
  };
}

function save(id, extra, score, passed) {
  const p = store.get();
  p[id] = { ...p[id], ...extra, passed: passed || !!p[id]?.passed, best: Math.max(score, p[id]?.best || 0) };
  store.set(p);
  return p;
}

function showQuiz() {
  const m = course.modules[current], need = Math.ceil(m.questions.length * course.pass_score), last = current === course.modules.length - 1;
  renderQuiz({
    steps: true, heading: "Перевірте себе", questions: m.questions, passScore: course.pass_score,
    hint: `${esc(titleOf(m))}. Щоб скласти тест, потрібно ${need} із ${m.questions.length} правильних відповідей.`,
    onDone(right, total, passed) {
      const p = save(m.id, {}, right / total, passed);
      const buttons = [];
      if (passed && !last) buttons.push({ label: "Наступний модуль →", primary: true, fn: () => show(current + 1, "lesson") });
      if (passed && last) buttons.push({ label: "До підсумкового іспиту →", primary: true, fn: () => show(-1, "exam") });
      buttons.push({ label: "Пройти тест ще раз", fn: () => show(current, "quiz") });
      if (!passed) buttons.push({ label: "До уроку", fn: () => show(current, "lesson") });
      const msg = passed ? (last && allPassed(p) ? `${esc(profiles.current())}, ви пройшли всі модулі! Залишився підсумковий іспит.` : "Можна переходити далі.") : "Перечитайте урок і спробуйте ще раз.";
      return { msg, buttons };
    },
  });
}

function showExam() {
  const p = store.get(), ex = course.exam || { questions: 15, pass_score: 0.8 };
  if (!allPassed(p)) {
    const left = course.modules.length - modulesPassed(p);
    $("#app").innerHTML = `<article class="card"><p class="kicker">Підсумковий іспит</p><h1>Ще рано</h1>` +
      `<p>Іспит відкриється, коли ви складете тести всіх модулів. Залишилось модулів: <strong>${left}</strong>.</p>` +
      `<div class="actions"><button class="btn primary" id="go">До курсу</button></div></article>`;
    $("#go").onclick = () => show(0, "lesson");
    return;
  }
  const qs = shuffle(course.modules.flatMap((m) => m.questions)).slice(0, ex.questions);
  const need = Math.ceil(qs.length * ex.pass_score);
  renderQuiz({
    kicker: "Підсумковий іспит", heading: "Іспит по всьому курсу", questions: qs, passScore: ex.pass_score,
    hint: `${qs.length} випадкових питань з усіх модулів. Щоб скласти, потрібно ${need} правильних відповідей. Спроб можна скільки завгодно.`,
    onDone(right, total, passed) {
      const better = right / total >= (store.get().__exam?.best || 0);
      save("__exam", passed && better ? { date: new Date().toISOString().slice(0, 10), right, total } : {}, right / total, passed);
      const buttons = passed ? [{ label: "Отримати сертифікат", primary: true, fn: () => show(-1, "cert") }] : [];
      buttons.push({ label: "Спробувати ще раз", primary: !passed, fn: () => show(-1, "exam") });
      return { msg: passed ? "Ви склали іспит!" : "Перегляньте пояснення й спробуйте ще: питання кожного разу інші.", buttons };
    },
  });
}

function askName(ex) {
  $("#app").innerHTML = `<article class="card profile"><p class="kicker">Сертифікат</p><h1>Для кого сертифікат?</h1>` +
    `<p class="hint">Введіть прізвище та імʼя так, як вони мають стояти на сертифікаті. Дані нікуди не надсилаються.</p>` +
    `<form id="nform" class="pform"><label for="fname">Прізвище та імʼя</label><div class="prow2">` +
    `<input id="fname" maxlength="60" autocomplete="name" placeholder="Наприклад: Шевченко Оксана" required value="${esc(ex.fullName || "")}">` +
    `<button class="btn primary" type="submit">Створити сертифікат</button></div><p class="perr" id="nerr" role="alert"></p></form>` +
    `<div class="actions"><button class="btn" id="back">Назад</button></div></article>`;
  $("#back").onclick = () => show(-1, "exam");
  $("#nform").onsubmit = (e) => {
    e.preventDefault();
    const name = $("#fname").value.replace(/\s+/g, " ").trim();
    if (name.length < 3 || !name.includes(" ")) { $("#nerr").textContent = "Введіть і прізвище, і імʼя."; return; }
    const p = store.get(); p.__exam.fullName = name; store.set(p);
    showCert();
  };
  $("#fname").focus();
}

function certId(name, date) {
  let h = 2166136261;
  for (const c of name + date) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return "SI-" + date.replace(/-/g, "") + "-" + h.toString(16).toUpperCase().padStart(8, "0").slice(0, 6);
}

function showCert() {
  const p = store.get(), ex = p.__exam;
  if (!ex?.passed) return show(-1, "exam");
  if (!ex.fullName) return askName(ex);
  const iso = ex.date || new Date().toISOString().slice(0, 10);
  const d = new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
  const score = Math.round(ex.best * 100);
  const grade = score >= 95 ? "відмінно" : score >= 87 ? "дуже добре" : "добре";
  const examLine = ex.right != null ? `${ex.right} із ${ex.total} правильних відповідей` : `${score}% правильних відповідей`;
  const rows = course.modules.map((m, i) => {
    const b = Math.round((p[m.id]?.best || 0) * 100);
    return `<li><span class="mn">${i + 1}</span><span class="mt">${esc(titleOf(m))}</span><span class="mp">${b}%</span></li>`;
  }).join("");
  $("#app").innerHTML = `<article class="card cert-wrap"><div class="cert-paper" id="certPaper"><div class="cert-frame">` +
    `<div class="cert-top"><svg class="cert-logo" width="44" height="44" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#16336b"/><path d="M16 6l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V9z" fill="#e8c766"/></svg>` +
    `<span>Безпечний інтернет для новачків</span></div>` +
    `<h1 class="cert-title">Сертифікат</h1><p class="cert-sub">про успішне проходження курсу</p>` +
    `<p class="cert-lead">Цим засвідчується, що</p><p class="cert-name">${esc(ex.fullName)}</p>` +
    `<p class="cert-text">успішно пройшов(-ла) курс <strong>«${esc(course.title)}»</strong> і склав(-ла) підсумковий іспит.</p>` +
    `<div class="cert-score"><div class="big"><b>${score}</b><small>із 100 балів</small></div>` +
    `<div class="det"><p>Підсумковий іспит: <strong>${examLine}</strong></p><p>Оцінка: <strong>${grade}</strong></p><p>Складено модулів: <strong>${course.modules.length} з ${course.modules.length}</strong></p></div></div>` +
    `<ol class="cert-mods">${rows}</ol>` +
    `<div class="cert-foot"><div><span class="line"></span><small>Дата</small><b>${d}</b></div>` +
    `<svg class="seal" width="86" height="86" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="#e8c766" stroke="#b8923a" stroke-width="3"/><circle cx="50" cy="50" r="36" fill="none" stroke="#16336b" stroke-width="2" stroke-dasharray="3 3"/><path d="M50 26l16 6v12c0 10-7 17-16 20-9-3-16-10-16-20V32z" fill="#16336b"/><path d="M42 46l6 6 11-12" fill="none" stroke="#e8c766" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>` +
    `<div><span class="line"></span><small>Номер сертифіката</small><b>${certId(ex.fullName, iso)}</b></div></div>` +
    `</div></div><div class="actions cert-actions"><button class="btn primary" id="print">Надрукувати / зберегти PDF</button>` +
    `<button class="btn" id="rename">Змінити імʼя</button><button class="btn" id="back">Назад</button></div></article>`;
  $("#print").onclick = () => window.print();
  $("#rename").onclick = () => askName(ex);
  $("#back").onclick = () => show(-1, "exam");
}

function showTrainer() {
  const items = shuffle(course.trainer || []).slice(0, 10);
  let i = 0, right = 0;
  const step = () => {
    if (i >= items.length) {
      const score = right / items.length;
      const p = store.get(); p.__trainer = { best: Math.max(score, p.__trainer?.best || 0) }; store.set(p); renderNav();
      $("#app").innerHTML = `<article class="card"><p class="kicker">Тренажер</p><h1>Результат: ${right} з ${items.length}</h1>` +
        `<p>${score >= 0.8 ? "Чудово! Ви добре відчуваєте обман." : "Непогано. Перегляньте п'ять ознак обману з модуля 4 і спробуйте ще раз."}</p>` +
        `<div class="actions"><button class="btn primary" id="again">Ще раз</button></div></article>`;
      $("#again").onclick = () => show(-1, "trainer");
      return;
    }
    const t = items[i];
    $("#app").innerHTML = `<article class="card"><p class="kicker">Шахрай чи ні · ${i + 1} з ${items.length}</p>` +
      `<h1>Що ви скажете про це повідомлення?</h1><div class="msg"><div class="msg-h"><span class="tag">${esc(t.kind)}</span><span>${esc(t.from)}</span></div><p>${esc(t.text)}</p></div>` +
      `<div class="actions" id="acts"><button class="btn danger" data-a="1">🚩 Це шахрайство</button><button class="btn okb" data-a="0">✅ Це безпечно</button></div><div id="tfb"></div></article>`;
    $("#acts").querySelectorAll("button").forEach((b) => (b.onclick = () => {
      const guess = b.dataset.a === "1", ok = guess === t.scam;
      if (ok) right++;
      $("#acts").innerHTML = "";
      $("#tfb").innerHTML = `<div class="result ${ok ? "pass" : "fail"}" role="status"><p><strong>${ok ? "Вірно!" : "Не зовсім."} ${t.scam ? "Це шахрайство." : "Це безпечне повідомлення."}</strong>${esc(t.explanation)}</p></div>` +
        `<div class="actions"><button class="btn primary" id="nx">${i + 1 === items.length ? "Результат" : "Далі →"}</button></div>`;
      $("#nx").onclick = () => { i++; step(); window.scrollTo({ top: 0 }); };
    }));
  };
  step();
}

// Мобільне меню
const sidebar = () => $("#sidebar");
function openMenu() { sidebar().classList.add("open"); $("#scrim").hidden = false; $("#menuBtn").setAttribute("aria-expanded", "true"); }
function closeMenu() { sidebar().classList.remove("open"); $("#scrim").hidden = true; $("#menuBtn").setAttribute("aria-expanded", "false"); }
$("#menuBtn").onclick = () => (sidebar().classList.contains("open") ? closeMenu() : openMenu());
$("#scrim").onclick = closeMenu;
document.addEventListener("keydown", (e) => e.key === "Escape" && closeMenu());
$("#nav").onclick = (e) => {
  const b = e.target.closest(".mod[data-i],.mod[data-x]");
  if (!b) return;
  b.dataset.x ? show(-1, b.dataset.x) : show(+b.dataset.i, "lesson");
};

const progressOf = (name) => { const p = ls.get("progress:" + name, {}); return course.modules.filter((m) => p[m.id]?.passed).length; };

function updateUser() {
  const n = profiles.current();
  $("#userBtn").hidden = !n;
  $("#userName").textContent = n || "";
}

function showProfiles() {
  closeMenu();
  const list = profiles.list(), cur = profiles.current(), total = course.modules.length;
  $("#app").innerHTML = `<article class="card profile"><p class="kicker">Знайомство</p><h1>Хто проходить курс?</h1>` +
    `<p class="hint">Достатньо імені або псевдоніма. Справжнє прізвище, пошту чи пароль вводити <strong>не потрібно</strong>: ` +
    `прогрес зберігається лише на цьому пристрої й нікуди не надсилається.</p>` +
    (list.length ? `<div class="plist">` + list.map((n) =>
      `<div class="prow"><button class="pick" data-n="${esc(n)}"><span class="avatar">${esc(n[0].toUpperCase())}</span>` +
      `<span class="txt">${esc(n)}<small>Пройдено ${progressOf(n)} з ${total}${n === cur ? " · зараз" : ""}</small></span></button>` +
      `<button class="del" data-n="${esc(n)}" aria-label="Видалити профіль ${esc(n)}" title="Видалити профіль">✕</button></div>`).join("") + `</div>` : "") +
    `<form id="pform" class="pform"><label for="pname">${list.length ? "Або додайте нового учасника" : "Ваше імʼя"}</label>` +
    `<div class="prow2"><input id="pname" maxlength="30" autocomplete="off" placeholder="Наприклад: Оксана або «Зелений кіт»" required>` +
    `<button class="btn primary" type="submit">Почати</button></div><p class="perr" id="perr" role="alert"></p></form></article>`;
  document.querySelectorAll(".pick").forEach((b) => (b.onclick = () => begin(b.dataset.n)));
  document.querySelectorAll(".del").forEach((b) => (b.onclick = () => {
    if (confirm(`Видалити профіль «${b.dataset.n}» і весь його прогрес?`)) { profiles.remove(b.dataset.n); updateUser(); showProfiles(); }
  }));
  $("#pform").onsubmit = (e) => {
    e.preventDefault();
    const name = $("#pname").value.replace(/\s+/g, " ").trim();
    if (!name) { $("#perr").textContent = "Введіть імʼя."; return; }
    profiles.add(name);
    begin(profiles.list().find((n) => n.toLowerCase() === name.toLowerCase()));
  };
  $("#nav").innerHTML = ""; $("#progressText").textContent = ""; $("#barFill").style.width = "0";
  window.scrollTo({ top: 0 });
}

function begin(name) {
  profiles.select(name);
  updateUser();
  const p = store.get();
  const firstOpen = course.modules.findIndex((m) => !p[m.id]?.passed);
  show(firstOpen === -1 ? 0 : firstOpen, "lesson");
}

$("#userBtn").onclick = () => showProfiles();

fetch("course.json").then((r) => r.json()).then((c) => {
  course = c;
  $("#title").textContent = c.title;
  document.title = c.title;
  const cur = profiles.current();
  updateUser();
  cur && profiles.list().includes(cur) ? begin(cur) : showProfiles();
}).catch(() => { $("#app").innerHTML = `<p class="error">Не вдалося завантажити курс. Виконайте <code>uv run internetusealiens build</code> і оновіть сторінку.</p>`; });
