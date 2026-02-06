

// === Global helpers for alias ordering (single source of truth)
function __mandFromSeed(seedLocal){
  const pos=[]; let j=0;
  for(let i=0;i<seedLocal.length;i++){
    if(seedLocal[i]==='.') pos.push(j); else j++;
  }
  return pos;
}

function orderAliases(base, maxN){
  const baseStr = String(base ?? '').trim();
  if(!baseStr) return [];

  // (оставляем совместимость с твоим текущим tail/core разбором)
  const tail = baseStr.match(/\.+$/)?.[0] || '';
  const core = tail ? baseStr.slice(0, -tail.length) : baseStr;

  const at = core.indexOf('@');
  if(at <= 0) return [];
  const local = core.slice(0, at);
  const dom = core.slice(at + 1);
  if(!dom) return [];

  // отделяем последнюю цифру (если есть)
  let stem = local;
  let lastDigit = '';
  if(/\d$/.test(local)){
    lastDigit = local.slice(-1);
    stem = local.slice(0, -1);
  }

  const out = [];
  const limit = Math.min(100, maxN || 100);
  for(let n=0; n<100 && out.length<limit; n++){
    const mid = String(n).padStart(2, '0'); // 00..99
    out.push(`${stem}${mid}${lastDigit}@${dom}${tail}`);
  }
  return out;
}

const EMAIL_SUBDOMAINS = [
  "gmail","hotmail","outlook",
  "seznam","email","post","centrum","atlas","volny",
  "zoznam","azet","pobox"
];

const EMAIL_GENERATE_COUNT = 100;

function ensureBuilderCfg(cfg){
  cfg = cfg || {};
  cfg.emails = cfg.emails || {cz:[], sk:[]};
  cfg.currentIdx = cfg.currentIdx || {cz:0, sk:0};
  cfg.blacklist = cfg.blacklist || {cz:[], sk:[]};
  cfg.cookieProfiles = cfg.cookieProfiles || {cz:[], sk:[]};
  cfg.lastApplied = cfg.lastApplied || {cz:'', sk:''};
  cfg.cookieRotationIdx = cfg.cookieRotationIdx || {cz:0, sk:0};

  cfg.emailBuilder = cfg.emailBuilder || { cz:{first:"", last:"", domain:""}, sk:{first:"", last:"", domain:""} };
  cfg.emailBuilder.cz = cfg.emailBuilder.cz || {first:"", last:"", domain:""};
  cfg.emailBuilder.sk = cfg.emailBuilder.sk || {first:"", last:"", domain:""};

  cfg.emailSubSel = cfg.emailSubSel || { cz: EMAIL_SUBDOMAINS.slice(), sk: EMAIL_SUBDOMAINS.slice() };
  if(!Array.isArray(cfg.emailSubSel.cz) || !cfg.emailSubSel.cz.length) cfg.emailSubSel.cz = EMAIL_SUBDOMAINS.slice();
  if(!Array.isArray(cfg.emailSubSel.sk) || !cfg.emailSubSel.sk.length) cfg.emailSubSel.sk = EMAIL_SUBDOMAINS.slice();
  return cfg;
}

function normalizeDomain(s){
  let v = String(s||"").trim().toLowerCase();
  v = v.replace(/\s+/g,"");
  v = v.replace(/^\.+/,"").replace(/\.+$/,"");
  return v;
}

function slug(s){
  const map = {
    "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh","з":"z","и":"i","й":"y",
    "к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f",
    "х":"h","ц":"c","ч":"ch","ш":"sh","щ":"sch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya"
  };
  let v = String(s||"").trim().toLowerCase();
  v = v.split("").map(ch => (map[ch] != null ? map[ch] : ch)).join("");
  v = v.replace(/[^a-z0-9]+/g,"");
  return v;
}

function randomInt(min, max){
  min = Math.floor(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildLocals(first, last){
  const f = slug(first);
  const l = slug(last);
  if(!f || !l) return [];
  const fi = f[0] || "";
  const li = l[0] || "";
  const raw = [
    `${f}.${l}`,
    `${l}.${f}`,
    `${f}${l}`,
    `${l}${f}`,
    `${fi}${l}`,
    `${l}${fi}`,
    `${f}${li}`,
    `${li}${l}`
  ];
  const out = [];
  const seen = new Set();
  for(const x of raw){
    const v = x.toLowerCase();
    if(!seen.has(v)){
      seen.add(v);
      out.push(x);
    }
  }
  return out;
}

/**
 * Вставка даты/года в локальную часть:
 * - 20% случаев — без даты (чистый local)
 * - остальное:
 *   * иногда год 1984
 *   * иногда две цифры 84
 *   * иногда полная дата ddmmyyyy (между 1980-01-01 и 1990-12-31)
 *   * позиция: в начале, в конце, или через точку
 */
function buildLocalWithYear(baseLocal){
  if(!baseLocal) return "";

  // 20% — без даты/года
  if(Math.random() < 0.2){
    return baseLocal;
  }

  const year = randomInt(1980, 1990);
  let frag;
  const r = Math.random();
  if(r < 0.4){
    // полный год: 1984
    frag = String(year);
  }else if(r < 0.7){
    // две цифры: 84
    frag = String(year).slice(2);
  }else{
    // полная дата ddmmyyyy
    const start = new Date(1980, 0, 1);   // 01.01.1980
    const end   = new Date(1990, 11, 31); // 31.12.1990
    const t = start.getTime() + Math.random() * (end.getTime() - start.getTime());
    const d = new Date(t);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    frag = dd + mm + yyyy; // 05061984
  }

  const mode = randomInt(0, 2);
  if(mode === 0){
    // local + дата
    return baseLocal + frag;
  }else if(mode === 1){
    // local.дата
    return baseLocal + "." + frag;
  }else{
    // дата + local
    return frag + baseLocal;
  }
}

/**
 * Генерация e-mail:
 * - round-robin по поддоменам
 * - локал = имя+фамилия (buildLocals) + рандомная дата/год (buildLocalWithYear)
 * - дубликаты e-mail (полный адрес) исключаются через Set
 * - суффиксы 01/02/03 НЕ используются
 */
function generateEmails(country, cfg, first, last, domain, count){
  cfg = ensureBuilderCfg(cfg || {});

  const subs = (cfg.emailSubSel && cfg.emailSubSel[country]) ? cfg.emailSubSel[country].slice() : [];
  if(!subs.length) return [];

  const localsBase = buildLocals(first, last);
  if(!localsBase.length) return [];

  const dom = normalizeDomain(domain);
  if(!dom || !dom.includes(".")) return [];

  const target = count || EMAIL_GENERATE_COUNT;
  const emails = [];
  const usedEmails = new Set();

  let i = 0;
  const maxIterations = target * 200; // большой запас, чтобы набить 100 уникальных
  while(emails.length < target && i < maxIterations){
    const baseLocal = localsBase[i % localsBase.length];
    const local = buildLocalWithYear(baseLocal);
    const sub = subs[emails.length % subs.length]; // round-robin по поддоменам
    const email = `${local}@${sub}.${dom}`.toLowerCase();
    if(!usedEmails.has(email)){
      usedEmails.add(email);
      emails.push(email);
    }
    i++;
  }
  return emails;
}

/**
 * Для превью — 10 штук.
 */
function generate10Emails(country, cfg, first, last, domain){
  return generateEmails(country, cfg, first, last, domain, 10);
}

function renderSubPicker(country, cfg){
  const root = document.getElementById(country + "SubPicker");
  if(!root) return;

  cfg = ensureBuilderCfg(cfg || {});

  const btn = root.querySelector(".subpicker__btn");
  const menu = root.querySelector(".subpicker__menu");
  const search = root.querySelector(".subpicker__search");
  const list = root.querySelector(".subpicker__list");
  const allBtn = root.querySelector(".subpicker__all");
  const noneBtn = root.querySelector(".subpicker__none");
  const summary = root.querySelector(".subpicker__summary");

  const all = EMAIL_SUBDOMAINS.slice();
  const selected = new Set((cfg.emailSubSel[country] || []).slice());

  function updateSummary(){
    const arr = Array.from(selected);
    cfg.emailSubSel[country] = arr;
    const head = arr.slice(0,3).join(", ");
    summary.textContent = arr.length
      ? `Выбрано: ${arr.length}${head ? " ("+head+(arr.length>3?", …":"")+")" : ""}`
      : "Не выбрано";
  }

  function draw(q){
    const needle = String(q||"").trim().toLowerCase();
    list.innerHTML = "";
    const arr = needle ? all.filter(x => x.includes(needle)) : all;
    arr.forEach(name=>{
      const lab = document.createElement("label");
      lab.className = "subpicker__item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selected.has(name);
      cb.onchange = () => {
        if(cb.checked) selected.add(name); else selected.delete(name);
        cfg.emailSubSel[country] = Array.from(selected);
        chrome.storage.local.set({cfg}, ()=>{
          updateSummary();
          updatePreview(country, cfg);
        });
      };
      const sp = document.createElement("span");
      sp.textContent = name;
      lab.appendChild(cb);
      lab.appendChild(sp);
      list.appendChild(lab);
    });
  }

  if(btn){
    btn.onclick = (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      menu.classList.toggle("hidden");
    };
  }
  if(menu){
    menu.onclick = (ev)=>{ ev.stopPropagation(); };
  }
  if(search){
    search.oninput = ()=> draw(search.value);
  }
  if(allBtn){
    allBtn.onclick = (ev)=>{
      ev.preventDefault();
      all.forEach(x=>selected.add(x));
      cfg.emailSubSel[country] = Array.from(selected);
      chrome.storage.local.set({cfg}, ()=>{
        draw(search.value);
        updateSummary();
        updatePreview(country, cfg);
      });
    };
  }
  if(noneBtn){
    noneBtn.onclick = (ev)=>{
      ev.preventDefault();
      selected.clear();
      cfg.emailSubSel[country] = [];
      chrome.storage.local.set({cfg}, ()=>{
        draw(search.value);
        updateSummary();
        updatePreview(country, cfg);
      });
    };
  }

  updateSummary();
  draw("");
}

function updatePreview(country, cfg){
  cfg = ensureBuilderCfg(cfg || {});
  const prev = document.getElementById(country + "Preview");
  if(!prev) return;
  const firstEl = document.getElementById(country + "First");
  const lastEl  = document.getElementById(country + "Last");
  const domEl   = document.getElementById(country + "Domain");
  const first = firstEl ? firstEl.value : "";
  const last  = lastEl ? lastEl.value : "";
  const dom   = domEl ? domEl.value : "";
  const list = generate10Emails(country, cfg, first, last, dom);
  prev.textContent = list.length ? `Пример: ${list[0]}` : "";
}


// === content-mode defaults ===
try {
  chrome.storage.local.get('cfg', ({cfg}) => {
    cfg = cfg || {};
    if (cfg.bgEngineEnabled === undefined || cfg.bgEngineEnabled === true) cfg.bgEngineEnabled = false;
    if (cfg.contentEngineEnabled === undefined || cfg.contentEngineEnabled === false) cfg.contentEngineEnabled = true;
    chrome.storage.local.set({ cfg });
  });
} catch(_) {}
// === end content-mode defaults ===

document.addEventListener('DOMContentLoaded', ()=>{
 document.getElementById('resetStatsBtn').onclick = resetSendStats;
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b===btn));
      document.querySelectorAll('section.tab').forEach(sec=>sec.classList.toggle('active', sec.id===btn.dataset.tab));
      if(btn.dataset.tab === 'phrases') loadPhrasesSection();
      if(btn.dataset.tab === 'stats') updateSendStatsUi();
    });
  });

  document.getElementById('saveCz').onclick = ()=>save('cz');
  document.getElementById('saveSk').onclick = ()=>save('sk');
  document.getElementById('switchCz').onclick = ()=>switchAlias('cz');
  document.getElementById('switchSk').onclick = ()=>switchAlias('sk');
  load();

  // АНТИСПАМ: загрузка при открытии страницы
  if(document.getElementById('saveAntispam')) {
    document.getElementById('saveAntispam').onclick = saveAntispamOptions;
    loadAntispamOptions();
  }
});

// --- АНТИСПАМ: ДЕФОЛТНЫЕ НАСТРОЙКИ ---
function getDefaultAntispamOptions() {
  return {
    antispam_enable: true,
    antispam_mouse: true,
    antispam_scroll: true,
    antispam_clicks: true,
    antispam_select: true,
    asp_select_percent: 10,
    asp_start_min: 2,
    asp_start_max: 10,
    asp_email_min: 0.12 * 1000,
    asp_email_max: 0.50 * 1000,
    asp_email_errors: 2,
    asp_email_paste: true,
    asp_email_paste_percent: 30,
    asp_email_full_del: true,
    asp_email_full_del_percent: 10,
    asp_between_min: 0.50 * 1000,
    asp_between_max: 5 * 1000,
    asp_text_min: 0.06 * 1000,
    asp_text_max: 0.50 * 1000,
    asp_text_errors: 3,
    asp_text_del1: true,
    asp_text_del1_percent: 5,
    asp_text_full_del: true,
    asp_text_full_del_percent: 5,
    asp_presend_min: 5 * 1000,
    asp_presend_max: 10 * 1000
  };
}

// === АНТИСПАМ: сохранение и загрузка ===
function saveAntispamOptions() {
  const s = id => document.getElementById(id);
  const settings = {
    antispam_enable: s('antispam_enable').checked,
    antispam_mouse: s('antispam_mouse').checked,
    antispam_scroll: s('antispam_scroll').checked,
    antispam_clicks: s('antispam_clicks').checked,
    antispam_select: s('antispam_select').checked,
    asp_select_percent: +s('asp_select_percent').value || 0,
    asp_start_min: +s('asp_start_min').value || 0,
    asp_start_max: +s('asp_start_max').value || 0,
    asp_email_min: (+s('asp_email_min').value || 0.12) * 1000,
    asp_email_max: (+s('asp_email_max').value || 0.50) * 1000,
    asp_email_errors: +s('asp_email_errors').value || 1,
    asp_email_paste: s('asp_email_paste').checked,
    asp_email_paste_percent: +s('asp_email_paste_percent').value || 0,
    asp_email_full_del: s('asp_email_full_del').checked,
    asp_email_full_del_percent: +s('asp_email_full_del_percent').value || 0,
    asp_between_min: (+s('asp_between_min').value || 0.5) * 1000,
    asp_between_max: (+s('asp_between_max').value || 5) * 1000,
    asp_text_min: (+s('asp_text_min').value || 0.06) * 1000,
    asp_text_max: (+s('asp_text_max').value || 0.50) * 1000,
    asp_text_errors: +s('asp_text_errors').value || 2,
    asp_text_del1: s('asp_text_del1').checked,
    asp_text_del1_percent: +s('asp_text_del1_percent').value || 0,
    asp_text_full_del: s('asp_text_full_del').checked,
    asp_text_full_del_percent: +s('asp_text_full_del_percent').value || 0,
    asp_presend_min: (+s('asp_presend_min').value || 5) * 1000,
    asp_presend_max: (+s('asp_presend_max').value || 10) * 1000,
  };
  chrome.storage.local.set({ antispam_options: settings }, function() {
    document.getElementById('antispam_status').textContent = 'Сохранено!';
    setTimeout(() => document.getElementById('antispam_status').textContent = '', 1200);
  });
}

function loadAntispamOptions() {
  const s = id => document.getElementById(id);
  chrome.storage.local.get('antispam_options', function(res) {
    let a = res.antispam_options;
    if (!a) {
      // Первый запуск — выставить дефолтные
      a = getDefaultAntispamOptions();
      chrome.storage.local.set({ antispam_options: a });
    }
    s('antispam_enable').checked = !!a.antispam_enable;
    s('antispam_mouse').checked = !!a.antispam_mouse;
    s('antispam_scroll').checked = !!a.antispam_scroll;
    s('antispam_clicks').checked = !!a.antispam_clicks;
    s('antispam_select').checked = !!a.antispam_select;
    s('asp_select_percent').value = a.asp_select_percent ?? 10;
    s('asp_start_min').value = a.asp_start_min !== undefined ? a.asp_start_min : 2;
    s('asp_start_max').value = a.asp_start_max !== undefined ? a.asp_start_max : 10;
    s('asp_email_min').value = ((a.asp_email_min || 120) / 1000).toFixed(2);
    s('asp_email_max').value = ((a.asp_email_max || 500) / 1000).toFixed(2);
    s('asp_email_errors').value = a.asp_email_errors ?? 2;
    s('asp_email_paste').checked = !!a.asp_email_paste;
    s('asp_email_paste_percent').value = a.asp_email_paste_percent ?? 30;
    s('asp_email_full_del').checked = !!a.asp_email_full_del;
    s('asp_email_full_del_percent').value = a.asp_email_full_del_percent ?? 10;
    s('asp_between_min').value = ((a.asp_between_min || 500) / 1000).toFixed(2);
    s('asp_between_max').value = ((a.asp_between_max || 5000) / 1000).toFixed(2);
    s('asp_text_min').value = ((a.asp_text_min || 60) / 1000).toFixed(2);
    s('asp_text_max').value = ((a.asp_text_max || 500) / 1000).toFixed(2);
    s('asp_text_errors').value = a.asp_text_errors ?? 3;
    s('asp_text_del1').checked = !!a.asp_text_del1;
    s('asp_text_del1_percent').value = a.asp_text_del1_percent ?? 5;
    s('asp_text_full_del').checked = !!a.asp_text_full_del;
    s('asp_text_full_del_percent').value = a.asp_text_full_del_percent ?? 5;
    s('asp_presend_min').value = ((a.asp_presend_min || 5000) / 1000).toFixed(2);
    s('asp_presend_max').value = ((a.asp_presend_max || 10000) / 1000).toFixed(2);
  });
}

// =============== Email-алиасы ===============

function getPhraseFiles() {
  return [
    'cz_deti.txt',
    'cz_elektro.txt',
    'cz_foto.txt',
    'cz_hudba.txt',
    'cz_mobil.txt',
    'cz_nabytek.txt',
    'cz_obleceni.txt',
    'cz_ostatni.txt',
    'cz_pc.txt',
    'cz_auto.txt',
    'cz_sport.txt',
    'sk_deti.txt',
    'sk_elektro.txt',
    'sk_foto.txt',
    'sk_hudba.txt',
    'sk_mobil.txt',
    'sk_nabytok.txt',
    'sk_oblecenie.txt',
    'sk_ostatne.txt',
    'sk_pc.txt',
    'sk_auto.txt',
    'sk_sport.txt'
  ];
}

function generateAliases(base){ return orderAliases(base, 20); }

function save(country){
  chrome.storage.local.get('cfg', d=>{
    let cfg = (d && d.cfg) ? d.cfg : {};
    ensureBuilderCfg(cfg);
    if(typeof normalizeCookieProfilesLocal === "function"){
      normalizeCookieProfilesLocal(cfg);
    }

    const firstEl = document.getElementById(country + "First");
    const lastEl  = document.getElementById(country + "Last");
    const domEl   = document.getElementById(country + "Domain");

    const first = (firstEl && firstEl.value ? firstEl.value.trim() : "");
    const last  = (lastEl  && lastEl.value  ? lastEl.value.trim()  : "");
    const domRaw = (domEl && domEl.value ? domEl.value.trim() : "");
    const domNorm = normalizeDomain(domRaw);

    if(!first || !last){
      alert("Введите Имя и Фамилию");
      return;
    }
    if(!domNorm || !domNorm.includes(".")){
      alert("Введите домен (пример: mydomain.com)");
      return;
    }
    if(!cfg.emailSubSel[country] || !cfg.emailSubSel[country].length){
      alert("Выбери хотя бы 1 поддомен");
      return;
    }

    // Генерация 100 уникальных e-mail с датой/годом
    const aliases = generateEmails(country, cfg, first, last, domNorm, 100);
    if(!aliases.length){
      alert("Не удалось сгенерировать 100 email (проверь поля)");
      return;
    }

    // сохраняем введённые значения конструктора
    cfg.emailBuilder[country] = { first, last, domain: domNorm };

    // предыдущие алиасы / профили
    const oldAliases = Array.isArray(cfg.emails[country]) ? cfg.emails[country].slice() : [];
    const cp = Array.isArray(cfg.cookieProfiles[country]) ? cfg.cookieProfiles[country] : [];

    // сбрасываем чёрный список и указатели
    cfg.blacklist[country] = [];
    cfg.currentIdx[country] = 0;
    cfg.cookieRotationIdx[country] = 0;

    // ремап cookieProfiles, чтобы по возможности сохранить существующие профили
    const newCp = [];
    const max = Math.max(oldAliases.length, aliases.length);
    for(let i=0;i<max;i++){
      const oldKey = oldAliases[i];
      const newKey = aliases[i];
      if(!newKey) continue;

      let prof =
        (oldKey && cp.find(p=>p && p.email === oldKey)) ||
        cp.find(p=>p && p.email === newKey);

      if(!prof) prof = { email: newKey };
      else prof = Object.assign({}, prof, { email: newKey });

      newCp.push(prof);
    }

    cfg.cookieProfiles[country] = newCp;
    cfg.emails[country] = aliases;

    // корректируем lastApplied
    const la = cfg.lastApplied[country];
    if(la){
      const pos = oldAliases.indexOf(la);
      if(pos >= 0 && aliases[pos]){
        cfg.lastApplied[country] = aliases[pos];
      }else{
        cfg.lastApplied[country] = aliases[0] || '';
      }
    }

    chrome.storage.local.set({cfg}, ()=> load());
  });
}

function switchAlias(country) {
  chrome.storage.local.get('cfg', d => {
    let cfg = d.cfg;
    if (!cfg || !cfg.emails[country].length) return;
    const idx = cfg.currentIdx[country];
    cfg.blacklist[country].push(cfg.emails[country][idx]);
    cfg.currentIdx[country] = (idx+1) % cfg.emails[country].length;
    chrome.storage.local.set({cfg}, ()=>{ load(); });
  });
}

let __emailEdit = null; // { country:'cz'|'sk', idx:number, value:string, focus:boolean }

function startEmailInlineEdit(country, idx, currentValue){
  __emailEdit = { country, idx, value: currentValue, focus: true };
  load();
}

function cancelEmailInlineEdit(){
  __emailEdit = null;
  load();
}

function commitEmailInlineEdit(country, idx){
  const input = document.getElementById(`emailEdit_${country}_${idx}`);
  const rawValue = input ? input.value : (__emailEdit ? __emailEdit.value : '');
  const newEmail = String(rawValue || '').replace(/\r|\n/g,'');

  chrome.storage.local.get('cfg', d => {
    let cfg = d.cfg || {emails:{cz:[],sk:[]},currentIdx:{cz:0,sk:0},blacklist:{cz:[],sk:[]}};
    cfg.emails = cfg.emails || {cz:[], sk:[]};
    cfg.blacklist = cfg.blacklist || {cz:[], sk:[]};
    cfg.cookieProfiles = cfg.cookieProfiles || {cz:[], sk:[]};
    cfg.lastApplied = cfg.lastApplied || {cz:'', sk:''};

    const emails = Array.isArray(cfg.emails[country]) ? cfg.emails[country] : [];
    const oldEmail = emails[idx];

    if (!newEmail){
      alert('Пустой email нельзя');
      return;
    }
    if (emails.some((e,i)=> e===newEmail && i!==idx)){
      alert('Такой email уже есть в списке');
      return;
    }

    // 1) emails
    emails[idx] = newEmail;
    cfg.emails[country] = emails;

    // 2) cookieProfiles rename
    const arr = Array.isArray(cfg.cookieProfiles[country]) ? cfg.cookieProfiles[country] : [];
    arr.forEach(p => { if (p && p.email === oldEmail) p.email = newEmail; });
    cfg.cookieProfiles[country] = arr;

    // 3) blacklist rename
    cfg.blacklist[country] = (cfg.blacklist[country] || []).map(e => e === oldEmail ? newEmail : e);

    // 4) lastApplied rename
    if ((cfg.lastApplied[country] || '') === oldEmail) cfg.lastApplied[country] = newEmail;

    chrome.storage.local.set({ cfg }, () => {
      __emailEdit = null;
      load();
    });
  });
}

function load() {
  chrome.storage.local.get('cfg', d => {
    let cfg = d.cfg || {emails:{cz:[],sk:[]},currentIdx:{cz:0,sk:0},blacklist:{cz:[],sk:[]}};
    ensureBuilderCfg(cfg);
    renderTable('CZ', cfg);
    renderTable('SK', cfg);

    const cz = cfg.emailBuilder.cz || {};
    const sk = cfg.emailBuilder.sk || {};

    const czFirst = document.getElementById('czFirst'); if(czFirst) czFirst.value = cz.first || '';
    const czLast  = document.getElementById('czLast');  if(czLast)  czLast.value  = cz.last  || '';
    const czDom   = document.getElementById('czDomain');if(czDom)   czDom.value   = cz.domain|| '';

    const skFirst = document.getElementById('skFirst'); if(skFirst) skFirst.value = sk.first || '';
    const skLast  = document.getElementById('skLast');  if(skLast)  skLast.value  = sk.last  || '';
    const skDom   = document.getElementById('skDomain');if(skDom)   skDom.value   = sk.domain|| '';

    renderSubPicker('cz', cfg);
    renderSubPicker('sk', cfg);

    updatePreview('cz', cfg);
    updatePreview('sk', cfg);

    ['czFirst','czLast','czDomain','skFirst','skLast','skDomain'].forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      el.oninput = ()=>{
        chrome.storage.local.get('cfg', r=>{
          const cfg2 = r && r.cfg ? r.cfg : {};
          ensureBuilderCfg(cfg2);
          const country = id.startsWith('cz') ? 'cz' : 'sk';
          updatePreview(country, cfg2);
        });
      };
    });
  });
}

function renderTable(countryKey, cfg) {
  const country = countryKey.toLowerCase();
  const tbl = document.getElementById('table' + countryKey);
  if (!tbl) return;
  let tbody = tbl.querySelector('tbody');
  if (!tbody) { tbody = document.createElement('tbody'); tbl.appendChild(tbody); }
  tbody.innerHTML = '';
  cfg.emails[country].forEach((em,i) => {
    const tr = tbody.insertRow();
    tr.className = i===cfg.currentIdx[country] ? 'active-row' : cfg.blacklist[country].includes(em) ? 'black-row':'';
    tr.insertCell().textContent = i+1;
    const tdAlias = tr.insertCell();
    const tdStatus = tr.insertCell();
    const tdActions = tr.insertCell();

    const isEditing = __emailEdit && __emailEdit.country===country && __emailEdit.idx===i;

    if (isEditing) {
      const input = document.createElement('input');
      input.type = 'text';
      input.id = `emailEdit_${country}_${i}`;
      input.value = __emailEdit ? __emailEdit.value : em;
      input.style.width = '98%';
      input.oninput = () => { if(__emailEdit) __emailEdit.value = input.value; };
      input.onkeydown = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); commitEmailInlineEdit(country,i); }
        else if (ev.key === 'Escape') { ev.preventDefault(); cancelEmailInlineEdit(); }
      };
      tdAlias.appendChild(input);

      const btnOk = document.createElement('button');
      btnOk.textContent = '✔️';
      btnOk.className = 'btn-small';
      btnOk.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); commitEmailInlineEdit(country,i); };

      const btnCancel = document.createElement('button');
      btnCancel.textContent = '✖️';
      btnCancel.className = 'btn-small';
      btnCancel.style.marginLeft = '6px';
      btnCancel.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); cancelEmailInlineEdit(); };

      tdActions.appendChild(btnOk);
      tdActions.appendChild(btnCancel);

      if (__emailEdit && __emailEdit.focus) {
        __emailEdit.focus = false;
        setTimeout(()=>{ input.focus(); input.setSelectionRange(input.value.length, input.value.length); },0);
      }
    } else {
      tdAlias.textContent = em;
      const btnEdit = document.createElement('button');
      btnEdit.textContent = '✏️';
      btnEdit.className = 'btn-small';
      btnEdit.title = 'Редактировать';
      btnEdit.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); startEmailInlineEdit(country, i, em); };
      tdActions.appendChild(btnEdit);
    }

    tdStatus.textContent = tr.className === 'active-row' ? 'Active' : (tr.className === 'black-row' ? 'Blacklist' : 'Queue');
  });
}

// --- Код для вкладки "Фразы" ---
let phrasesData = { cz: {}, sk: {} };
let currentCountry = 'cz';

document.getElementById('countrySelector').addEventListener('click', e => {
  if (e.target.tagName === 'BUTTON') {
    [...e.target.parentNode.children].forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentCountry = e.target.dataset.country;
    updateCategories();
  }
});

document.getElementById('categorySelect').addEventListener('change', e => {
  updatePhrasesList(e.target.value);
});

async function loadPhrasesSection() {
  const files = getPhraseFiles();
  phrasesData = { cz: {}, sk: {} };
  for (const file of files) {
    const match = file.match(/(cz|sk)_?([a-z0-9_]+)\.txt/i);
    if (!match) continue;
    const [_, country, category] = match;
    try {
      const resp = await fetch(chrome.runtime.getURL('phrases/' + file));
      if (!resp.ok) continue;
      const txt = await resp.text();
      phrasesData[country][category] = txt.split('\n').map(s => s.trim()).filter(Boolean);
    } catch (e) {
      console.error('Ошибка загрузки', file, e);
    }
  }
  updateCategories();
}

function updateCategories() {
  const categorySelect = document.getElementById('categorySelect');
  categorySelect.innerHTML = '';
  const categories = Object.keys(phrasesData[currentCountry] || {}).sort();
  for (const cat of categories) {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    categorySelect.appendChild(option);
  }
  if (categories.length) {
    categorySelect.value = categories[0];
    updatePhrasesList(categories[0]);
  } else {
    document.getElementById('phrasesList').innerHTML = 'Фразы не найдены';
  }
}

function updatePhrasesList(category) {
  const ul = document.getElementById('phrasesList');
  ul.innerHTML = '';
  const phrases = phrasesData[currentCountry][category] || [];
  for (const phrase of phrases) {
    const li = document.createElement('li');
    li.textContent = phrase;
    li.style.padding = '4px 6px';
    li.style.borderBottom = '1px solid #eee';
    ul.appendChild(li);
  }
}

// === СТАТИСТИКА ===

function updateSendStatsUi() {
  chrome.storage.local.get(['sendStats'], res => {
    let stats = res.sendStats || [];
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const last24 = stats.filter(e => e.time >= dayAgo);

    let czCount = 0, skCount = 0, lastCz = 0, lastSk = 0;
    last24.forEach(e => {
      if (e.country === 'cz') {
        czCount++;
        if (e.time > lastCz) lastCz = e.time;
      }
      if (e.country === 'sk') {
        skCount++;
        if (e.time > lastSk) lastSk = e.time;
      }
    });

    document.getElementById('stat24Total').textContent = last24.length;
    document.getElementById('stat24Cz').textContent =
      czCount + (lastCz ? ' (' + formatDt(lastCz) + ')' : '');
    document.getElementById('stat24Sk').textContent =
      skCount + (lastSk ? ' (' + formatDt(lastSk) + ')' : '');

    const histDiv = document.getElementById('statHistory');
    histDiv.innerHTML = stats.slice(-50).reverse().map(e => {
      return `<div>${formatDt(e.time)} — <b>${e.country.toUpperCase()}</b></div>`;
    }).join('') || '<i>Нет данных</i>';
  });
}

function resetSendStats() {
  chrome.storage.local.remove(['sendStats'], updateSendStatsUi);
}

function formatDt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString().slice(0, 17);
}

// === Cookie Profiles UI (added) ===

// === Helpers for cookie import on options page ===
function extractBKODLocal(cookies){
  const c = (cookies||[]).find(x => (x.name||'').toLowerCase()==='bkod');
  return c && c.value ? String(c.value) : '';
}

function normalizeCookieProfilesLocal(cfg){
  cfg.cookieProfiles = cfg.cookieProfiles || {cz:[], sk:[]};
  ['cz','sk'].forEach(key=>{
    const val = cfg.cookieProfiles[key];
    if (Array.isArray(val)) {
      cfg.cookieProfiles[key] = val;
    } else if (val && typeof val === 'object') {
      cfg.cookieProfiles[key] = Object.keys(val).map(email => Object.assign({ email }, val[email]));
    } else {
      cfg.cookieProfiles[key] = [];
    }
  });
  return cfg;
}

function findProfileLocal(cfg, country, email, create){
  cfg.cookieProfiles = cfg.cookieProfiles || { cz: [], sk: [] };
  cfg.cookieProfiles[country] = Array.isArray(cfg.cookieProfiles[country]) ? cfg.cookieProfiles[country] : [];
  const arr = cfg.cookieProfiles[country];
  const idx = arr.findIndex(p => p && p.email === email);
  if (idx >= 0) return { profile: arr[idx], index: idx, arr };
  if (create) {
    const profile = { email };
    arr.push(profile);
    return { profile, index: arr.length - 1, arr };
  }
  return { profile: null, index: -1, arr };
}

function parseCookiesText(text, country){
  const lines = (text||'').split(/\r?\n/).filter(l=>l.trim() && !/^#/.test(l));
  let arr=[];
  try {
    const j = JSON.parse(text);
    if (Array.isArray(j)) { arr = j; } else if (j && Array.isArray(j.cookies)) { arr = j.cookies; }
  } catch(_){}
  if (!arr.length && lines.length){
    const netscape = lines.every(l => l.split(/\t/).length>=6);
    if (netscape){
      for (const l of lines){
        const p=l.split(/\t/);
        if (p.length<6) continue;
        const [domain, flag, path, secure, exp, name, value] = [p[0], p[1], p[2], p[3], p[4], p[5], p[6]||''];
        arr.push({ domain: domain.trim(), path: path || '/', secure: /true|1|TRUE/i.test(secure), httpOnly: false,
                   sameSite: undefined, expirationDate: isFinite(+exp) ? +exp : undefined, name, value });
      }
    }
  }
  if (!arr.length && lines.length){
    const suf = country==='sk' ? 'bazos.sk' : 'bazos.cz';
    for (const l of lines){
      const m = l.match(/^([^=]+)=(.*)$/);
      if (!m) continue;
      arr.push({ name:m[1].trim(), value:m[2], domain:'.'+suf, path:'/' });
    }
  }
  const suf2 = country==='sk' ? 'bazos.sk' : 'bazos.cz';
  arr = arr.filter(c => { const d=(c.domain||'').replace(/^\./,''); return d===suf2 || d.endsWith('.'+suf2); });
  arr = arr.map(c => ({ name:String(c.name||''), value:String(c.value||''), domain: c.domain || (country==='sk'?'.bazos.sk':'.bazos.cz'),
                        path: c.path || '/', secure: !!c.secure, httpOnly: !!c.httpOnly, sameSite: c.sameSite, expirationDate: c.expirationDate }))
           .filter(c=>c.name);
  return arr;
}

function applyActiveCountsToBlacklist(cfg) {
  cfg.emails = cfg.emails || { cz: [], sk: [] };
  cfg.blacklist = cfg.blacklist || { cz: [], sk: [] };
  cfg.cookieProfilesActiveCount = cfg.cookieProfilesActiveCount || { cz: 4, sk: 4 };

  ['cz', 'sk'].forEach(country => {
    const emails = (cfg.emails[country] || []).slice();
    const need = cfg.cookieProfilesActiveCount[country] || 0;

    const trimmedNeed = Math.max(0, Math.min(need, emails.length));
    const blacklist = emails.slice(trimmedNeed);

    cfg.blacklist[country] = blacklist;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get('cfg', ({ cfg }) => {
    cfg = cfg || {};
    cfg.emails = cfg.emails || { cz: [], sk: [] };
    cfg.blacklist = cfg.blacklist || { cz: [], sk: [] };
    cfg.cookieProfilesActiveCount = cfg.cookieProfilesActiveCount || { cz: 4, sk: 4 };

    document.getElementById('cookie_cz_active_count').value =
      cfg.cookieProfilesActiveCount.cz || 4;
    document.getElementById('cookie_sk_active_count').value =
      cfg.cookieProfilesActiveCount.sk || 4;
  });
});

async function refreshCookieProfiles() {
  const cfg = await new Promise(r=>chrome.runtime.sendMessage({cmd:'cookieProfiles:get'}, resp=>r(resp?.cfg||{})));
  cfg.cookieProfilesActiveCount = cfg.cookieProfilesActiveCount || { cz: 4, sk: 4 };
  normalizeCookieProfilesLocal(cfg);
  cfg.cookieProfiles.cz = cfg.cookieProfiles.cz || [];
  cfg.cookieProfiles.sk = cfg.cookieProfiles.sk || [];
  document.getElementById('cookie_cz_active_count').value = (cfg.cookieProfilesActiveCount && cfg.cookieProfilesActiveCount.cz) || 4;
  document.getElementById('cookie_sk_active_count').value = (cfg.cookieProfilesActiveCount && cfg.cookieProfilesActiveCount.sk) || 4;
  // Toggle switch
  const toggle = document.getElementById('cookieRotationEnabled');
  if (toggle) {
    toggle.checked = !!cfg.cookieRotationEnabled;
    toggle.onchange = ()=> chrome.runtime.sendMessage({cmd:'cookieProfiles:setEnabled', enabled: toggle.checked});
  }

  const activeSaveBtn = document.getElementById('cookie_active_save');
  if (activeSaveBtn) {
    activeSaveBtn.onclick = () => {
      chrome.storage.local.get('cfg', ({ cfg }) => {
        cfg = cfg || {};
        cfg.emails = cfg.emails || { cz: [], sk: [] };
        cfg.blacklist = cfg.blacklist || { cz: [], sk: [] };
        cfg.cookieProfilesActiveCount = cfg.cookieProfilesActiveCount || { cz: 4, sk: 4 };

        const czN = parseInt(document.getElementById('cookie_cz_active_count').value || '4', 10);
        const skN = parseInt(document.getElementById('cookie_sk_active_count').value || '4', 10);

        cfg.cookieProfilesActiveCount.cz = isNaN(czN) ? 4 : Math.max(0, Math.min(20, czN));
        cfg.cookieProfilesActiveCount.sk = isNaN(skN) ? 4 : Math.max(0, Math.min(20, skN));

        // пересчитываем blacklist: первые N активные, остальные выключены
        applyActiveCountsToBlacklist(cfg);

        chrome.storage.local.set({ cfg }, () => {
          // перерисовать таблицу, чтобы галочки соответствовали blacklist
          if (typeof refreshCookieProfiles === 'function') {
            refreshCookieProfiles();
          }
        });
      });
    };
  }

  const clearInvalidBtn = document.getElementById('cookie_clear_invalid_tokens');
  if (clearInvalidBtn && !clearInvalidBtn.__bound) {
    clearInvalidBtn.__bound = true;
    clearInvalidBtn.addEventListener('click', () => {
      if (!confirm('Очистить НЕВАЛИДНЫЕ токены (оставить почты) для CZ и SK?')) return;

      chrome.runtime.sendMessage({ cmd: 'cookieProfiles:clearInvalidTokens' }, res => {
        if (res && res.ok) {
          if (typeof refreshCookieProfiles === 'function') refreshCookieProfiles();
          if (typeof refreshEmailTab === 'function') refreshEmailTab();
          alert('Очищено невалидных токенов: ' + (res.cleared || 0));
        } else {
          alert('Не удалось очистить токены (возможно, нет невалидных).');
        }
      });
    });
  }

  function fillTable(country) {
    const tableId = country==='cz' ? 'cookieTableCZ' : 'cookieTableSK';
    const tbody = document.querySelector('#'+tableId+' tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const list = (cfg.emails?.[country] || []).slice();
    list.forEach((em, idx)=>{
      const tr = document.createElement('tr');
      tr.className = (cfg.blacklist?.[country]||[]).includes(em) ? 'black-row':'';

      const profile = (Array.isArray(cfg.cookieProfiles?.[country])
        ? cfg.cookieProfiles[country].find(p => p && p.email === em)
        : (cfg.cookieProfiles?.[country] && cfg.cookieProfiles[country][em])) || {};

      const bd = profile.bd || '';
      const enabled = !(cfg.blacklist?.[country] || []).includes(em);

      const uaFull = profile.ua || '';
      let uaShort = uaFull;
      if (uaShort.length > 80) uaShort = uaShort.slice(0, 77) + '...';

      tr.innerHTML = `
        <td style="text-align:center;"><input type="checkbox" ${enabled?'checked':''} data-idx="${idx}" data-email="${em}" data-country="${country}" class="cp-enable"></td>
        <td>${em}</td>
        <td style="font-size:10px;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${uaFull.replace(/"/g,'&quot;')}">${uaShort}</td>
        <td class="bd" title="${bd}">${bd ? bd : '<i>—</i>'}</td>
        <td class="lastSent">${formatDt(profile.lastSent)}</td>
        <td class="validity">${profile.valid===true?'✅':(profile.valid===false?'❌':'—')}</td>
        <td>
          <button class="btn-small cp-bind" data-email="${em}" data-country="${country}">Сохранить</button>
          <button class="btn-small cp-clear" data-email="${em}" data-country="${country}">Очистить</button>
          <button class="btn-small cp-import" data-email="${em}" data-country="${country}">Импорт из файла</button>
          <input type="file" accept=".txt,.json" class="cp-file" data-email="${em}" data-country="${country}" style="display:none;">
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Handlers
    tbody.querySelectorAll('.cp-enable').forEach(chk=>{
      chk.addEventListener('change', ()=>{
        const em = chk.dataset.email;
        const country = chk.dataset.country;
        chrome.storage.local.get('cfg', ({cfg})=>{
          cfg = cfg || {};
          cfg.blacklist = cfg.blacklist || { cz: [], sk: [] };
          const bl = cfg.blacklist[country] || [];
          const idx = bl.indexOf(em);
          if (chk.checked) {
            if (idx !== -1) bl.splice(idx, 1);
          } else {
            if (idx === -1) bl.push(em);
          }
          cfg.blacklist[country] = bl;
          chrome.storage.local.set({cfg}, refreshCookieProfiles);
        });
      });
    });

    
tbody.querySelectorAll('.cp-bind').forEach(btn=>{
  btn.addEventListener('click', async ()=>{
    const email = btn.dataset.email.trim();
    const country = btn.dataset.country;
    const urlPattern = country==='sk' ? '*://*.bazos.sk/*' : '*://*.bazos.cz/*';
    const tabs = await chrome.tabs.query({url: [urlPattern]});
    const tab = tabs.sort((a,b)=> (b.lastAccessed||0)-(a.lastAccessed||0))[0] || tabs[0];
    if (!tab) { alert('Открой вкладку объявления на '+(country==='sk'?'bazos.sk':'bazos.cz')+' и повтори.'); return; }
    btn.disabled = true; const oldText = btn.textContent; btn.textContent = 'Сохранение...';
    chrome.runtime.sendMessage({cmd:'cookieProfiles:save', email, country, tabId: tab.id}, async resp=>{
      btn.disabled = false; btn.textContent = oldText;
      if (!resp || !resp.ok) { alert('Не удалось сохранить куки: '+(resp && resp.error || 'нет ответа')); return; }
      // обновим BD прямо в строке
      const tr = btn.closest('tr');
      const bdCell = tr && tr.querySelector('td.bd');
      if (bdCell) bdCell.textContent = resp.bd || '—';
      // перерисуем таблицы на всякий случай из хранилища
      await refreshCookieProfiles(); if (typeof refreshEmailTab==='function') refreshEmailTab();
      alert('Сохранено куков: '+resp.saved + (resp.bd ? ('\nBD: '+resp.bd) : ''));
    });
  });
});
tbody.querySelectorAll('.cp-clear').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const email = btn.dataset.email;
        const country = btn.dataset.country;
        chrome.runtime.sendMessage({cmd:'cookieProfiles:clear', email, country}, ()=> refreshCookieProfiles());
      });
    });

  // per-row import handlers
  tbody.querySelectorAll('.cp-import').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const file = btn.parentElement.querySelector('.cp-file');
      if (file) file.click();
    });
  });
  tbody.querySelectorAll('.cp-file').forEach(inp=>{
    inp.addEventListener('change', async (ev)=>{
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      const text = await f.text();
      const country = inp.dataset.country;
      const email = inp.dataset.email;
      const cookies = parseCookiesText(text, country);
      const bd = extractBKODLocal(cookies);
      normalizeCookieProfilesLocal(cfg);
      const { profile } = findProfileLocal(cfg, country, email, true);
      if (profile) {
        profile.cookies = cookies;
        profile.bd = bd;
        profile.ts = Date.now();
      }
      chrome.storage.local.set({cfg}, refreshCookieProfiles);
      ev.target.value='';
      alert('Импортировано '+cookies.length+' куки для '+email);
    });
  });
  }

  fillTable('cz');
  fillTable('sk');

  // Validation controls
  ['cz','sk'].forEach(cc=>{
    const table = document.getElementById(cc==='cz'?'cookieTableCZ':'cookieTableSK');
    if (!table) return;
    if (!table.parentElement.querySelector('.validate-holder-'+cc)){
      const holder = document.createElement('div');
      holder.className = 'validate-holder-'+cc;
      holder.style.margin = '8px 6px';
      holder.innerHTML = '<input class="validate-url" placeholder="URL для проверки (по умолчанию deti.bazos)" style="width:60%;"> ' +
                         '<button class="btn-small start-validate" data-country="'+cc+'">✅ Проверить токены</button>';
      table.parentElement.appendChild(holder);
      const input = holder.querySelector('.validate-url');
      const btn = holder.querySelector('.start-validate');
      chrome.storage.local.get('cfg', ({cfg})=>{
        cfg = cfg || {}; cfg.validateUrl = cfg.validateUrl || {cz:'', sk:''};
        input.value = cfg.validateUrl[cc] || '';
      });
      input.addEventListener('change', ()=>{
        chrome.storage.local.get('cfg', ({cfg})=>{
          cfg = cfg || {}; cfg.validateUrl = cfg.validateUrl || {cz:'', sk:''};
          cfg.validateUrl[cc] = input.value.trim();
          chrome.storage.local.set({cfg});
        });
      });
      btn.addEventListener('click', ()=>{
        chrome.runtime.sendMessage({cmd:'cookieProfiles:validate', country: cc, url: input.value.trim()});
      });
    }
  });

  // Paint progress
  chrome.runtime.onMessage.addListener((msg)=>{
    if (msg && msg.cmd === 'cookieProfiles:validateProgress'){
      const tableId = msg.country==='cz' ? 'cookieTableCZ' : 'cookieTableSK';
      const tbody = document.querySelector('#'+tableId+' tbody');
      if (!tbody) return;
      const row = Array.from(tbody.querySelectorAll('tr')).find(tr => tr.children[1] && tr.children[1].textContent.trim() === msg.email);
      if (row){
        const cell = row.querySelector('.validity'); if (cell) cell.textContent = msg.valid ? '✅' : '❌';
      }
    }
  });


  // Bulk import controls under each table
  ['cz','sk'].forEach(cc=>{
    const table = document.getElementById(cc==='cz'?'cookieTableCZ':'cookieTableSK');
    if (!table) return;
    let holder = table.parentElement.querySelector('.bulk-holder-'+cc);
    if (!holder){
      holder = document.createElement('div');
      holder.className = 'bulk-holder-'+cc;
      holder.style.margin = '8px 0';
      holder.innerHTML = '<button class="btn-small bulk-import" data-country="'+cc+'">Массовый импорт (*.txt/*.json)</button>' +
                         '<input type="file" class="bulk-input" accept=".txt,.json" multiple data-country="'+cc+'" style="display:none;">';
      table.parentElement.appendChild(holder);
      const bulkBtn = holder.querySelector('.bulk-import');
      const bulkInp = holder.querySelector('.bulk-input');
      bulkBtn.addEventListener('click',()=> bulkInp.click());
      bulkInp.addEventListener('change', async (ev)=>{
        const files = Array.from(ev.target.files||[]);
        if (!files.length) return;
        const country = ev.target.dataset.country;
        chrome.storage.local.get('cfg', async ({cfg})=>{
          cfg = cfg || {}; cfg.emails = cfg.emails || {cz:[], sk:[]};
          normalizeCookieProfilesLocal(cfg);
          const emails = (cfg.emails[country]||[]).slice();
          const emptyEmails = emails.filter(em => {
            const found = findProfileLocal(cfg, country, em, false).profile;
            return !(found && (found.cookies||[]).length);
          });
          for (let i=0;i<files.length && i<emptyEmails.length;i++){
            const em = emptyEmails[i];
            const text = await files[i].text();
            const parsed = parseCookiesText(text, country);
            const bd = extractBKODLocal(parsed);
            const { profile } = findProfileLocal(cfg, country, em, true);
            if (profile) {
              profile.cookies = parsed;
              profile.bd = bd;
              profile.ts = Date.now();
            }
          }
          chrome.storage.local.set({cfg}, refreshCookieProfiles);
          ev.target.value='';
          alert('Массовый импорт: '+Math.min(files.length, emptyEmails.length)+' профилей обновлено');
        });
      });}
  
  // === PRUNE INVALID + shift queue + DELETE MARKED ===
  ['cz','sk'].forEach(cc=>{
    const table = document.getElementById(cc==='cz'?'cookieTableCZ':'cookieTableSK');
    if (!table) return;
    let holder = table.parentElement.querySelector('.prune-holder-'+cc);
    if (!holder){
      holder = document.createElement('div');
      holder.className = 'prune-holder-'+cc;
      holder.style.margin = '8px 6px';
      holder.innerHTML =
        '<button class="btn-small prune-invalid" data-country="'+cc+'">🗑️ Удалить НЕВАЛИДНЫЕ + сдвинуть очередь</button>' +
        '<button class="btn-small delete-marked" data-country="'+cc+'" style="margin-left:6px;">🗑️ Удалить ОТМЕЧЕННЫЕ почты</button>';
      table.parentElement.insertBefore(holder, table.parentElement.firstChild);
    }

    const pruneBtn = holder.querySelector('.prune-invalid');
    if (pruneBtn && !pruneBtn.__bound) {
      pruneBtn.__bound = true;
      pruneBtn.addEventListener('click', ()=> pruneInvalid(cc));
    }

    const delBtn = holder.querySelector('.delete-marked');
    if (delBtn && !delBtn.__bound) {
      delBtn.__bound = true;
      delBtn.addEventListener('click', ()=> deleteMarkedEmails(cc));
    }
  });

  async function pruneInvalid(country){
    chrome.runtime.sendMessage({ cmd: 'cookieProfiles:pruneInvalid', country }, res => {
      if (res && res.ok) {
        refreshCookieProfiles();
        if (typeof refreshEmailTab==='function') refreshEmailTab();
        alert('Удалено НЕВАЛИДНЫХ: ' + (res.removed || 0));
      } else {
        alert('Нет НЕВАЛИДНЫХ профилей для удаления');
      }
    });
  }

  // НОВОЕ: удаление ПОМЕЧЕННЫХ (галочкой) email'ов
  function deleteMarkedEmails(country){
    const tableId = country==='cz' ? 'cookieTableCZ' : 'cookieTableSK';
    const tbody = document.querySelector('#'+tableId+' tbody');
    if (!tbody) return;

    const toDelete = [];
    tbody.querySelectorAll('.cp-enable').forEach(chk=>{
      const em = chk.dataset.email;
      if (chk.checked && em) {
        toDelete.push(em);
      }
    });

    if (!toDelete.length){
      alert('Нет отмеченных email-профилей для удаления');
      return;
    }

    if (!confirm('Удалить ' + toDelete.length + ' отмеченных email-профилей?')) {
      return;
    }

    chrome.runtime.sendMessage({
      cmd: 'cookieProfiles:deleteSelected',
      country,
      emails: toDelete
    }, res => {
      if (res && res.ok) {
        refreshCookieProfiles();
        if (typeof refreshEmailTab==='function') refreshEmailTab();
        alert('Удалено: ' + (res.removed || 0));
      } else {
        alert('Не удалось удалить выбранные профили');
      }
    });
  }
});

}

// Hook tab switch to load our section
document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.querySelector('.tab-btn[data-tab="cookieProfiles"]');
  if (btn) {
    btn.addEventListener('click', refreshCookieProfiles);
  }
});


chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.cookieProfiles) {
    try { if (typeof refreshCookieProfiles === 'function') refreshCookieProfiles(); if (typeof refreshEmailTab==='function') refreshEmailTab(); } catch(e){}
  }
});



// === injected: bg/content engine toggles (non-breaking) ===
;(function(){
  try {
    // If there's a settings save routine, persist default flags if missing
    chrome.storage.local.get('cfg', ({cfg}) => {
      cfg = cfg || {};
      if (cfg.bgEngineEnabled === undefined) cfg.bgEngineEnabled = true;
      if (cfg.contentEngineEnabled === undefined) cfg.contentEngineEnabled = false;
      chrome.storage.local.set({ cfg });
    });
  } catch(_) {}
})();
// === end injected



// === injected: link cookieRotationEnabled with tab switcher ===
;(function(){
  try {
    const el = document.getElementById('cookieRotationEnabled') || document.querySelector('[name="cookieRotationEnabled"]');
    if (!el) return;
    const onChange = (enabled) => { enabled = !!enabled;
      try {
        chrome.storage.local.get('cfg', ({cfg}) => {
          cfg = cfg || {};
          cfg.cookieRotationEnabled = !!enabled;
          cfg.switchTabsEnabled = !!enabled; // link with rotation
          chrome.storage.local.set({ cfg }, () => {
            try { chrome.runtime.sendMessage({ cmd: 'tabSwitcher:reschedule', enabled: !!enabled }); } catch(_){}
          });
        });
      } catch(_) {}
    };
    // set checkbox state from cfg, don't auto-toggle
    chrome.storage.local.get('cfg', ({cfg}) => { try { if (cfg && typeof cfg.cookieRotationEnabled==='boolean') el.checked = !!cfg.cookieRotationEnabled; } catch(_) {} });
    // change handler
    el.addEventListener('change', (ev) => onChange(!!ev.target.checked), true);
  } catch(_) {}
})();
// === end injected



// === injected: robust binder for cookieRotationEnabled <-> tab switcher ===
;(function(){
  function bind() {
    try {
      const el = document.getElementById('cookieRotationEnabled') || document.querySelector('[name="cookieRotationEnabled"]');
      if (!el || el.__bazosBound) return;
      el.__bazosBound = true;

      const pushState = (enabled) => {
        try {
          enabled = !!enabled;
          chrome.storage.local.get('cfg', ({cfg}) => {
            cfg = cfg || {};
            cfg.cookieRotationEnabled = enabled;
            cfg.switchTabsEnabled = enabled;
            chrome.storage.local.set({ cfg }, () => {
              try { chrome.runtime.sendMessage({ cmd: 'tabSwitcher:reschedule', enabled }); } catch(_){}
            });
          });
        } catch(_) {}
      };

      // Wire multiple events
      ['change','click','input'].forEach(ev => el.addEventListener(ev, () => pushState(el.checked), true));

      // Observe attribute/property changes (for custom toggles)
      try {
        const mo = new MutationObserver(() => pushState(el.checked));
        mo.observe(el, { attributes: true, attributeFilter: ['checked', 'aria-checked', 'class'] });
        el.__bazosMO = mo;
      } catch(_) {}

      // Polling fallback every 1000ms
      let last = el.checked;
      setInterval(() => {
        if (el.checked !== last) { last = el.checked; pushState(el.checked); }
      }, 1000);
    } catch(_) {}
  }
  // Try once and also after DOM ready
  bind();
  try { document.addEventListener('DOMContentLoaded', bind, { once:true }); } catch(_) {}
})();
// === end injected

// === AI settings ===

(function(){
  function $$(sel){ return Array.from(document.querySelectorAll(sel)); }
  function $(sel){ return document.querySelector(sel); }
  function loadAI(){
    chrome.storage.local.get('cfg', ({cfg})=>{
      cfg = cfg || {};
      $('#aiEnabled').checked = !!cfg.aiEnabled;
      $('#aiApiKey').value = cfg.aiApiKey || '';
      $('#aiModel').value = cfg.aiModel || 'gpt-4o-mini';
      $('#aiTemp').value = String(cfg.aiTemp==null?0.9:cfg.aiTemp);
      $('#aiTempVal').textContent = $('#aiTemp').value;
      $('#aiMaxTokens').value = String(cfg.aiMaxTokens==null?120:cfg.aiMaxTokens);
      $('#aiStyleMix').checked = !!cfg.aiStyleMix;
      const styles = new Set(cfg.aiStyles || ['short','friendly','formal','detailed','concise']);
      $$('.aiStyle').forEach(cb => cb.checked = styles.has(cb.value));
    });
  }
  function saveAI(){
    const styles = $$('.aiStyle').filter(cb=>cb.checked).map(cb=>cb.value);
    const cfgUpdate = {
      aiEnabled: !!$('#aiEnabled').checked,
      aiApiKey: ($('#aiApiKey').value||'').trim(),
      aiModel: ($('#aiModel').value||'gpt-4o-mini').trim(),
      aiTemp: Number($('#aiTemp').value||0.9),
      aiMaxTokens: Math.max(40, Math.min(300, Number($('#aiMaxTokens').value||120))),
      aiStyleMix: !!$('#aiStyleMix').checked,
      aiStyles: styles.length ? styles : ['short','friendly','formal','detailed','concise'],
    };
    chrome.storage.local.get('cfg', ({cfg})=>{
      cfg = Object.assign({}, cfg||{}, cfgUpdate);
      chrome.storage.local.set({ cfg }, ()=>{
        const st = document.getElementById('aiStatus');
        if (st) { st.textContent = 'Сохранено'; setTimeout(()=>st.textContent='', 1500); }
      });
    });
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    if ($('#aiTemp')) $('#aiTemp').addEventListener('input', e=>{ $('#aiTempVal').textContent = e.target.value; });
    if ($('#aiSave')) $('#aiSave').addEventListener('click', saveAI);
    if ($('#aiTest')) $('#aiTest').addEventListener('click', async ()=>{
      saveAI();
      const st = $('#aiStatus'); if (st) st.textContent = 'Тест...';
      try {
        const resp = await chrome.runtime.sendMessage({ cmd: 'ai:genText', lang: 'cs', title: 'Test', about: 'Popis', styleSeed: Math.random() });
        st.textContent = resp && resp.text ? ('Ок: ' + resp.text.slice(0, 80) + '...') : 'Нет ответа';
      } catch(e) { st.textContent = 'Ошибка'; }
      setTimeout(()=>{ const st2=$('#aiStatus'); if (st2) st2.textContent=''; }, 4000);
    });
    loadAI();
  });
})();


// === AI provider wiring ===
(function(){
  function $(s){ return document.querySelector(s); }
  function showEndpoint(){
    const p = $('#aiProvider') ? $('#aiProvider').value : 'openai';
    const box = $('#aiEndpointBox');
    if (box) box.style.display = (p === 'ollama' || p === 'custom') ? 'block' : 'none';
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    if (!$('#aiProvider')) return;
    chrome.storage.local.get('cfg', ({cfg})=>{
      cfg = cfg || {};
      $('#aiProvider').value = cfg.aiProvider || 'openai';
      $('#aiEndpoint').value = cfg.aiEndpoint || 'http://localhost:11434';
      showEndpoint();
    });
    $('#aiProvider').addEventListener('change', ()=>{
      showEndpoint();
      // persist provider immediately
      chrome.storage.local.get('cfg', ({cfg})=>{
        cfg = cfg || {};
        cfg.aiProvider = $('#aiProvider').value;
        cfg.aiEndpoint = $('#aiEndpoint') ? ($('#aiEndpoint').value||'') : cfg.aiEndpoint;
        chrome.storage.local.set({cfg});
      });
    });
    if ($('#aiEndpoint')) $('#aiEndpoint').addEventListener('change', ()=>{
      chrome.storage.local.get('cfg', ({cfg})=>{
        cfg = cfg || {};
        cfg.aiEndpoint = $('#aiEndpoint').value||'';
        chrome.storage.local.set({cfg});
      });
    });
  });
})();

// === extend saveAI/loadAI to include provider/endpoint ===
(function(){
  const oldLoad = window.loadAI;
})(); // no-op to keep compatibility

if(!window.__subpickerGlobalCloserBound){
  window.__subpickerGlobalCloserBound = true;
  document.addEventListener('click', ()=>{
    document.querySelectorAll('.subpicker__menu').forEach(m=>m.classList.add('hidden'));
  });
}
