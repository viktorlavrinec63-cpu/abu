
// === UA POOL + FINGERPRINT ===
let UA_LIST = [];
// Отдельный отпечаток для каждой страны
const currentFingerprintByCountry = { cz: null, sk: null }; // {cz:{email,ua,lang}, sk:{...}}

const UA_RULE_ID_CZ = 1001;
const UA_RULE_ID_SK = 1002;

(function initUserAgents() {
  try {
    fetch(chrome.runtime.getURL('useragents.txt'))
      .then(r => r.text())
      .then(txt => {
        UA_LIST = txt
          .split(/\r?\n/)
          .map(s => s.trim())
          .filter(Boolean);
        console.log('[BazosAF] UA LIST loaded:', UA_LIST.length);
      })
      .catch(e => console.warn('[BazosAF] UA load failed', e));
  } catch (e) {
    console.warn('[BazosAF] UA init error', e);
  }
})();

function pickUaRandom() {
  if (!UA_LIST.length) return '';
  const idx = Math.floor(Math.random() * UA_LIST.length);
  return UA_LIST[idx];
}

function getLangForCountry(countryKey) {
  return countryKey === 'sk'
    ? 'sk-SK,sk;q=0.9'
    : 'cs-CZ,cs;q=0.9';
}

function updateUaRules() {
  if (!chrome.declarativeNetRequest) return;

  const removeIds = [UA_RULE_ID_CZ, UA_RULE_ID_SK];

  const rules = [];
  const resourceTypes = [
    'main_frame',
    'sub_frame',
    'xmlhttprequest',
    'script',
    'image',
    'stylesheet',
    'font'
  ];

  function makeRule(id, requestDomain, fp) {
    if (!fp || !fp.ua || !fp.lang) return null;
    return {
      id,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'User-Agent', operation: 'set', value: fp.ua },
          { header: 'Accept-Language', operation: 'set', value: fp.lang }
        ]
      },
      condition: {
        // Важно: применяется ТОЛЬКО к этому домену (и его поддоменам)
        requestDomains: [requestDomain],
        resourceTypes
      }
    };
  }

  const czRule = makeRule(UA_RULE_ID_CZ, 'bazos.cz', currentFingerprintByCountry.cz);
  const skRule = makeRule(UA_RULE_ID_SK, 'bazos.sk', currentFingerprintByCountry.sk);

  if (czRule) rules.push(czRule);
  if (skRule) rules.push(skRule);

  chrome.declarativeNetRequest.updateDynamicRules(
    { removeRuleIds: removeIds, addRules: rules },
    () => {
      if (chrome.runtime.lastError) {
        console.warn('[BazosAF] UA rules update error', chrome.runtime.lastError);
      } else {
        console.log('[BazosAF] UA rules updated:',
          { cz: !!czRule, sk: !!skRule }
        );
      }
    }
  );
}
// === END UA POOL + FINGERPRINT ===

function __sanitizeAiText(txt) {
  if (!txt) return '';
  // Убираем типичные подписи и благодарности
  txt = txt.replace(/\bS\s*pozdravem.*$/gmi, '').replace(/\bS\s*pozd\.?\s*$/gmi, '');
  txt = txt.replace(/\bD[eě]kuji!?\s*$/gmi, '');
  // Убираем плейсхолдеры типа [Vaše jméno]
  txt = txt.replace(/\[[^\]]*jméno[^\]]*\]/gmi, '');
  // Убираем типичные приветствия и "mám zájem"
  txt = txt.replace(/^\s*(Dobr[ýá] den|Dobr[ýá] deň|Zdrav[ií]m|Ahoj)\s*[,.!]*/i, '');
  txt = txt.replace(/\bm[aá]m\s+z[aá]jem\b.*$/i, '');
  txt = txt.replace(/\bmal by som z[aá]ujem\b.*$/i, '');

  // Оставляем только первое вопросительное предложение
  const qMatch = txt.match(/[^?]*\?/);
  if (qMatch) {
    txt = qMatch[0];
  } else {
    // если вопросов нет – хотя бы первое нормальное предложение
    const parts = txt.split(/[.!]/);
    if (parts.length && parts[0].trim().length > 3) {
      txt = parts[0].trim();
    }
  }

  // Чистим лишние пробелы и переносы
  txt = txt.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').trim();
  txt = txt.replace(/\n{2,}/g, '\n').trim();
  return txt.trim();
}

function __mandFromSeed(seedLocal) {
  const pos = [];
  let j = 0;
  for (let i = 0; i < seedLocal.length; i++) {
    if (seedLocal[i] === '.') pos.push(j); else j++;
  }
  return pos;
}

function orderAliases(base, maxN) {
  const [seedLocalOrUser, dom] = base.split('@');
  if (!seedLocalOrUser || !dom) return [];
  const user = seedLocalOrUser.replace(/\./g, '');
  const mand = __mandFromSeed(seedLocalOrUser);
  const positions = [];
  for (let i = 3; i < user.length; i++) positions.push(i);
  const out = [];
  (function() {
    let arr = user.split('');
    for (let j = mand.length - 1; j >= 0; j--) arr.splice(mand[j], 0, '.');
    const a0 = arr.join('') + '@' + dom;
    if (!a0.endsWith('.') && !a0.includes('..')) out.push(a0);
  })();
  function combine(arr, k) {
    const res = [];
    function go(st, combo) {
      if (combo.length === k) { res.push(combo.slice()); return; }
      for (let i = st; i < arr.length; i++) { combo.push(arr[i]); go(i + 1, combo); combo.pop(); }
    }
    go(0, []); return res;
  }
  let k = 1;
  while ((maxN ? out.length < maxN : true) && k <= positions.length) {
    const combs = combine(positions, k);
    for (const comb of combs) {
      const full = Array.from(new Set(mand.concat(comb))).sort((a, b) => a - b);
      let arr = user.split('');
      for (let j = full.length - 1; j >= 0; j--) arr.splice(full[j], 0, '.');
      const alias = arr.join('') + '@' + dom;
      if (!alias.endsWith('.') && !alias.includes('..')) {
        if (!out.includes(alias)) out.push(alias);
        if (maxN && out.length >= maxN) break;
      }
    }
    k++;
  }
  return out;
}

function normalizeCookieProfiles(cfg) {
  if (!cfg.cookieProfiles) cfg.cookieProfiles = {};
  ['cz', 'sk'].forEach(country => {
    let arr = cfg.cookieProfiles[country];
    if (!Array.isArray(arr)) {
      if (arr && typeof arr === 'object') {
        arr = Object.keys(arr).map(email => Object.assign({ email }, arr[email]));
      } else {
        arr = [];
      }
    }
    arr.forEach(p => {
      if (!p) return;
      if (typeof p.enabled !== 'boolean') p.enabled = true;
      if (typeof p.statsOk !== 'number') p.statsOk = 0;
      if (typeof p.statsTokenDead !== 'number') p.statsTokenDead = 0;
      if (typeof p.statsError !== 'number') p.statsError = 0;

      if (!p.ua) {
        p.ua = pickUaRandom();
      }
      if (!p.lang) {
        const key = country === 'sk' ? 'sk' : 'cz';
        p.lang = getLangForCountry(key);
      }

      // НОВОЕ: счётчик попаданий на форму телефона
      if (typeof p.phoneWarn !== 'number') {
        p.phoneWarn = 0;
      }
    });
    cfg.cookieProfiles[country] = arr;
  });
  return cfg;
}

function getCookieProfiles(cfg, country) {
  cfg = normalizeCookieProfiles(cfg || {});
  return cfg.cookieProfiles[country] || [];
}

function findCookieProfile(cfg, country, email) {
  const arr = getCookieProfiles(cfg, country);
  return arr.find(p => p && p.email === email);
}

function upsertCookieProfile(cfg, country, email, data) {
  const arr = getCookieProfiles(cfg, country);
  const idx = arr.findIndex(p => p && p.email === email);
  const merged = Object.assign({ email }, idx >= 0 ? arr[idx] : {}, data || {});

  const key = country === 'sk' ? 'sk' : 'cz';
  if (!merged.ua)  merged.ua  = pickUaRandom();
  if (!merged.lang) merged.lang = getLangForCountry(key);

  if (idx >= 0) arr[idx] = merged; else arr.push(merged);
  cfg.cookieProfiles[country] = arr;
  return merged;
}

function removeCookieProfile(cfg, country, email) {
  const arr = getCookieProfiles(cfg, country);
  const idx = arr.findIndex(p => p && p.email === email);
  if (idx >= 0) arr.splice(idx, 1);
  cfg.cookieProfiles[country] = arr;
}

function applyActiveCountsToBlacklistInBg(cfg, country) {
  cfg.emails = cfg.emails || { cz: [], sk: [] };
  cfg.blacklist = cfg.blacklist || { cz: [], sk: [] };
  cfg.cookieProfilesActiveCount = cfg.cookieProfilesActiveCount || { cz: 4, sk: 4 };

  const key = country === 'sk' ? 'sk' : 'cz';
  const emails = (cfg.emails[key] || []).slice();
  const need = cfg.cookieProfilesActiveCount[key] || 0;

  const trimmedNeed = Math.max(0, Math.min(need, emails.length));

  // Текущее множество "активных" e-mail'ов (по лимиту) —
  // они не должны попадать в blacklist логики очереди.
  const activeSet = new Set(emails.slice(0, trimmedNeed));

  // Те, что по лимиту вываливаются "за борт", считаем как кандидатов в blacklist.
  const shouldBeBlacklisted = new Set(emails.slice(trimmedNeed));

  // Исторический blacklist: все e-mail'ы, которые уже были когда-то выключены/удалены.
  const prev = new Set((cfg.blacklist && cfg.blacklist[key]) || []);

  // Объединяем старый blacklist и "свежих" кандидатов.
  const merged = new Set([...prev, ...shouldBeBlacklisted]);

  // Убираем из blacklist текущие активные e-mail'ы (если вдруг туда попали).
  activeSet.forEach(e => merged.delete(e));

  cfg.blacklist[key] = Array.from(merged);
}

// На одной странице объявления (country + URL без query/hash)
// удаляем максимум ОДИН токен. Остальные "форма телефона" на той же странице –
// считаем, что проблема в странице / IP, а не в самом токене.
const tokenWindowPageGuard = {}; // key: country|urlKey -> true

function markTokenWindow(country, email, urlKey) {
  initCfg(async cfg => {
    cfg.emails    = cfg.emails    || { cz: [], sk: [] };
    cfg.blacklist = cfg.blacklist || { cz: [], sk: [] };

    // Нормализуем профили, чтобы были ua/lang/phoneWarn
    cfg.cookieProfiles = normalizeCookieProfiles(cfg || {}).cookieProfiles;

    const key  = country === 'sk' ? 'sk' : 'cz';
    const list = cfg.emails[key] || [];

    let cpArr = Array.isArray(cfg.cookieProfiles[key]) ? cfg.cookieProfiles[key] : [];
    let idx   = cpArr.findIndex(p => p && p.email === email);
    let prof  = idx >= 0 ? cpArr[idx] : null;

    // Всегда ведём статистику phoneWarn, если профиль есть
    if (prof) {
      const prev = (typeof prof.phoneWarn === 'number') ? prof.phoneWarn : 0;
      prof.phoneWarn = prev + 1;
      cpArr[idx] = prof;
      cfg.cookieProfiles[key] = cpArr;
    }

    // Если нам передали urlKey страницы – проверяем, не удаляли ли мы уже
    // токен на ЭТОЙ странице. Если да – больше никаких удалений / blacklist.
    if (urlKey) {
      const pageKey = key + '|' + String(urlKey);
      if (tokenWindowPageGuard[pageKey]) {
        // На этой странице уже один токен "поймал" телефон.
        // Считаем, что дальше проблема в самой странице / IP, а не в токене.
        chrome.storage.local.set({ cfg });
        return;
      }
      // Помечаем, что на этой странице уже был один "убитый" токен.
      tokenWindowPageGuard[pageKey] = true;
    }

    // ДОПОЛНИТЕЛЬНО: чистим все bazos-куки для страны при убийстве токена
    // (чтобы при следующем заходе на объявление уже точно не было хвостов
    // от предыдущего аккаунта)
    try {
      await clearAllBazosCookies(key);
    } catch (e) {
      // молча глотаем, чтобы не ронять основную логику
    }

    // === УДАЛЯЕМ ПРОФИЛЬ / ТОКЕН (ТОЛЬКО ПЕРВЫЙ РАЗ ДЛЯ КОНКРЕТНОЙ СТРАНЫ+СТРАНИЦЫ) ===
    if (Array.isArray(cfg.cookieProfiles[key])) {
      cfg.cookieProfiles[key] = cfg.cookieProfiles[key].filter(p => !(p && p.email === email));
    } else if (cfg.cookieProfiles[key] && cfg.cookieProfiles[key][email]) {
      delete cfg.cookieProfiles[key][email];
    }

    // Считаем, реально ли выкинули e-mail из очереди, чтобы знать deletedCount
    let deletedCount = 0;
    const idxEmail = list.indexOf(email);
    if (idxEmail !== -1) {
      list.splice(idxEmail, 1);
      cfg.emails[key] = list;
      deletedCount = 1;
    }

    if (deletedCount > 0) {
      registerTokenDeath(cfg, key);
    }

    if (email) {
      const bl = new Set(cfg.blacklist[key] || []);
      bl.add(email);
      cfg.blacklist[key] = Array.from(bl);
    }

    // Приводим cookieProfiles/rotationIdx в порядок (новых почт не добавляем)
    appendNewEmailsAfterDelete(cfg, key, deletedCount);
    applyActiveCountsToBlacklistInBg(cfg, key);

    chrome.storage.local.set({ cfg });
  });
}
// После удаления мы БОЛЬШЕ НЕ ДОБАВЛЯЕМ новые почты.
// Таблица просто сжимается; функция только приводит cookieProfiles/rotationIdx в порядок.
function appendNewEmailsAfterDelete(cfg, countryKey, deletedCount) {
  cfg.emails = cfg.emails || { cz: [], sk: [] };
  cfg.cookieProfiles = normalizeCookieProfiles(cfg || {}).cookieProfiles;
  cfg.cookieRotationIdx = cfg.cookieRotationIdx || { cz: 0, sk: 0 };

  const key = countryKey === 'sk' ? 'sk' : 'cz';

  const emails = (cfg.emails[key] || []).slice();
  let cp = Array.isArray(cfg.cookieProfiles[key]) ? cfg.cookieProfiles[key] : [];

  // Убираем профили, у которых e-mail уже не присутствует в списке
  cp = cp.filter(p => p && emails.includes(p.email));

  cfg.cookieProfiles[key] = cp;

  // Чиним rotationIdx, если он вылез за пределы массива emails
  if (cfg.cookieRotationIdx[key] >= emails.length) {
    cfg.cookieRotationIdx[key] = emails.length ? emails.length - 1 : 0;
  }
}

function pruneInvalidProfiles(country, cb) {
  initCfg(cfg => {
    cfg.emails = cfg.emails || { cz: [], sk: [] };
    cfg.blacklist = cfg.blacklist || { cz: [], sk: [] };
    cfg.currentIdx = cfg.currentIdx || { cz: 0, sk: 0 };
    cfg.cookieRotationIdx = cfg.cookieRotationIdx || { cz: 0, sk: 0 };
    cfg.cookieProfiles = normalizeCookieProfiles(cfg || {}).cookieProfiles;

    const key = country === 'sk' ? 'sk' : 'cz';
    const emails = (cfg.emails[key] || []).slice();
    let cp = Array.isArray(cfg.cookieProfiles[key]) ? cfg.cookieProfiles[key] : [];

    const toRemove = emails.filter(em => {
      const prof = cp.find(p => p && p.email === em);
      return prof && prof.valid === false;
    });

    if (!toRemove.length) {
      chrome.storage.local.set({ cfg }, () => cb && cb({ ok: true, removed: 0 }));
      return;
    }

    const bl = new Set(cfg.blacklist[key] || []);
    toRemove.forEach(em => bl.add(em));
    cfg.blacklist[key] = Array.from(bl);

    const remain = emails.filter(em => !toRemove.includes(em));
    cp = cp.filter(p => p && !toRemove.includes(p.email));

    cfg.emails[key] = remain;
    cfg.cookieProfiles[key] = cp;

    appendNewEmailsAfterDelete(cfg, key, toRemove.length);
    if (cfg.currentIdx[key] >= cfg.emails[key].length) {
      cfg.currentIdx[key] = Math.max(0, cfg.emails[key].length - 1);
    }
    if (cfg.cookieRotationIdx[key] >= cfg.emails[key].length) {
      cfg.cookieRotationIdx[key] = Math.max(0, cfg.emails[key].length - 1);
    }

    applyActiveCountsToBlacklistInBg(cfg, key);

    chrome.storage.local.set({ cfg }, () => cb && cb({ ok: true, removed: toRemove.length }));
  });
}

function clearInvalidTokensAndReorder(cb) {
  initCfg(cfg => {
    cfg = cfg || {};
    cfg.emails = cfg.emails || { cz: [], sk: [] };
    cfg.currentIdx = cfg.currentIdx || { cz: 0, sk: 0 };
    cfg.cookieRotationIdx = cfg.cookieRotationIdx || { cz: 0, sk: 0 };
    cfg.cookieProfiles = normalizeCookieProfiles(cfg || {}).cookieProfiles;

    const countries = ['cz', 'sk'];
    let cleared = 0;

    countries.forEach(key => {
      const emails = (cfg.emails[key] || []).slice();
      let cp = Array.isArray(cfg.cookieProfiles[key]) ? cfg.cookieProfiles[key] : [];

      const emailHasToken = new Set();
      const keptProfiles = [];

      cp.forEach(p => {
        if (!p || !p.email) return;

        if (p.valid === false) {
          cleared++;
          return;
        }

        keptProfiles.push(p);

        if (Array.isArray(p.cookies) && p.cookies.length > 0) {
          emailHasToken.add(p.email);
        }
      });

      cfg.cookieProfiles[key] = keptProfiles;

      const withToken = emails.filter(em => emailHasToken.has(em));
      const withoutToken = emails.filter(em => !emailHasToken.has(em));
      cfg.emails[key] = withToken.concat(withoutToken);

      if (cfg.currentIdx[key] >= cfg.emails[key].length) {
        cfg.currentIdx[key] = cfg.emails[key].length ? cfg.emails[key].length - 1 : 0;
      }
      if (cfg.cookieRotationIdx[key] >= cfg.emails[key].length) {
        cfg.cookieRotationIdx[key] = cfg.emails[key].length ? cfg.emails[key].length - 1 : 0;
      }
    });

    chrome.storage.local.set({ cfg }, () => cb && cb({ ok: true, cleared }));
  });
}

function deleteSelectedProfiles(country, emailsToRemove, cb) {
  initCfg(cfg => {
    cfg.emails = cfg.emails || { cz: [], sk: [] };
    cfg.blacklist = cfg.blacklist || { cz: [], sk: [] };
    cfg.currentIdx = cfg.currentIdx || { cz: 0, sk: 0 };
    cfg.cookieRotationIdx = cfg.cookieRotationIdx || { cz: 0, sk: 0 };
    cfg.cookieProfiles = normalizeCookieProfiles(cfg || {}).cookieProfiles;

    const key = country === 'sk' ? 'sk' : 'cz';
    const emails = (cfg.emails[key] || []).slice();
    let cp = Array.isArray(cfg.cookieProfiles[key]) ? cfg.cookieProfiles[key] : [];

    const setToRemove = new Set(Array.isArray(emailsToRemove) ? emailsToRemove : []);
    const toRemove = emails.filter(em => setToRemove.has(em));

    if (!toRemove.length) {
      chrome.storage.local.set({ cfg }, () => cb && cb({ ok: true, removed: 0 }));
      return;
    }

    const bl = new Set(cfg.blacklist[key] || []);
    toRemove.forEach(em => bl.add(em));
    cfg.blacklist[key] = Array.from(bl);

    const remain = emails.filter(em => !setToRemove.has(em));
    cp = cp.filter(p => p && !setToRemove.has(p.email));

    cfg.emails[key] = remain;
    cfg.cookieProfiles[key] = cp;

    appendNewEmailsAfterDelete(cfg, key, toRemove.length);

    if (cfg.currentIdx[key] >= cfg.emails[key].length) {
      cfg.currentIdx[key] = Math.max(0, cfg.emails[key].length - 1);
    }
    if (cfg.cookieRotationIdx[key] >= cfg.emails[key].length) {
      cfg.cookieRotationIdx[key] = Math.max(0, cfg.emails[key].length - 1);
    }

    applyActiveCountsToBlacklistInBg(cfg, key);

    chrome.storage.local.set({ cfg }, () => cb && cb({ ok: true, removed: toRemove.length }));
  });
}


// === TYPING LOCK (prevents auto-rotation/reload while user types) ===
const __typingTabs = new Map(); // tabId -> timestamp (ms)
function __markTyping(tabId){ try { __typingTabs.set(tabId, Date.now()); } catch(_) {} }
function __isTyping(tabId, idleMs = 10000){ try { const ts = __typingTabs.get(tabId) || 0; return (Date.now() - ts) < idleMs; } catch(_) { return false; } }
try {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  
// === VALIDATION HELPERS (stability) ===
function __sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function __countBazosCookies(country){
  const suf = country==='sk' ? 'bazos.sk' : 'bazos.cz';
  const all = await new Promise(resolve => chrome.cookies.getAll({}, resolve));
  const toUse = (all||[]).filter(c => {
    const d = (c.domain || '').replace(/^\./, '');
    return d === suf || d.endsWith('.'+suf);
  });
  return toUse.length;
}

async function __ensureCookiesSet(expectedCount, country, timeoutMs=6000){
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline){
    try {
      const cnt = await __countBazosCookies(country);
      if (cnt >= expectedCount) return true;
    } catch(_) {}
    await __sleep(150);
  }
  return false;
}

// === VALIDATION: check cookie tokens on add-listing page (deti.bazos.*) ===
  if (msg.cmd === 'cookieProfiles:validate') {
    const { country, url } = msg;
    initCfg(async cfg => {
      try {
        const list = getCookieProfiles(cfg, country).filter(p => p && Array.isArray(p.cookies) && p.cookies.length);
        if (!list.length) { sendResponse({ok:false, error:'NO_PROFILES'}); return; }

        const tab = await new Promise(r => chrome.tabs.create({ url: url || ('https://' + (country==='sk' ? 'www.bazos.sk' : 'www.bazos.cz') + '/') }, r));
        const tabId = tab.id;

        const waitComplete = (tabId) => new Promise(resolve => {
          const listener = (id, info) => {
            if (id === tabId && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });

        const exec = async (fn) => {
          try {
            if (chrome.scripting && chrome.scripting.executeScript) {
              const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: fn });
              return res && res.result;
            }
          } catch (e) {}
          return await new Promise(resolve => {
            try {
              chrome.tabs.executeScript(tabId, { code: '('+fn.toString()+')()' }, (res) => resolve(res && res[0]));
            } catch(e){ resolve(null); }
          });
        };

        for (const prof of list) {
          const email = prof.email;
          await clearAllBazosCookies(country);
          await new Promise(r=>setTimeout(r, 700));
          await setCookies(prof.cookies, country);
          await new Promise(r=>setTimeout(r, 1200));

                // Ensure cookies are actually written before navigating
      const __expected = filterBazosCookies(prof.cookies, country).length;
      await __ensureCookiesSet(__expected, country, 6000);
const baseUrl = url && url.trim() ? url.trim() : ('https://deti.' + (country==='sk' ? 'bazos.sk' : 'bazos.cz') + '/pridat-inzerat.php');
          try { await new Promise(r=>chrome.tabs.update(tabId, {url: baseUrl}, r)); } catch(e) { const tab = await new Promise(r=>chrome.tabs.create({ url: baseUrl }, r)); tabId = tab.id; }
          await waitComplete(tabId);

          const checkOnce = async () => {
            return await exec(async () => {
              function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
              const deadline = Date.now() + 12000;
              const czWarn = 'před přidáním inzerátu je nutné ověření mobilního telefonu';
              const skWarn = 'pred pridaním inzerátu je nutné overenie mobilného telefónu';
              while (Date.now() < deadline) {
                const smsInput = document.querySelector('input#teloverit[name="teloverit"]');
                if (smsInput) return { valid: false, reason: 'teloverit' };
                const text = (document.body && (document.body.innerText||'').toLowerCase()) || '';
                if (text.includes(czWarn) || text.includes(skWarn)) return { valid: false, reason: 'warn' };
                const hasAddImages = Array.from(document.querySelectorAll('a,button,input[type="button"],input[type="submit"]'))
                  .some(el => /přidej obrázky|pridaj obrázky/i.test(((el.textContent||'') + ' ' + (el.value||''))));
                const hasFormMarkers = text.includes('rubrika') && (text.includes('kategorie') || text.includes('kategórie')) && (text.includes('psč') || text.includes('psc'));
                if (hasAddImages || hasFormMarkers) return { valid: true, reason: 'form' };
                await sleep(500);
              }
              return { valid: false, reason: 'timeout' };
            });
          };

          let res = await checkOnce();
          if (res && res.reason === 'timeout') {
            try { await new Promise(r=>chrome.tabs.update(tabId, {url: baseUrl}, r)); } catch(e) { const tab = await new Promise(r=>chrome.tabs.create({ url: baseUrl }, r)); tabId = tab.id; }
            await waitComplete(tabId);
            res = await checkOnce();
          }
          const valid = !!(res && res.valid);
          const target = findCookieProfile(cfg, country, email);
          if (target) target.valid = valid;
          chrome.storage.local.set({ cfg });
          chrome.runtime.sendMessage({ cmd:'cookieProfiles:validateProgress', country, email, valid });
        }

        sendResponse({ ok:true, total: list.length });
      try { await clearAllBazosCookies(country); } catch(_) {}

      } catch (e) {
        console.error('validate error', e);
        sendResponse({ ok:false, error: String(e) });
      }
    });
    return true;
  }

    if (!msg || !msg.cmd) return;
    if (msg.cmd === 'user:typing' && sender && sender.tab && sender.tab.id != null) {
      __markTyping(sender.tab.id);
      try { sendResponse && sendResponse({ ok:true }); } catch(_) {}
      return true;
    }
    if (msg.cmd === 'cookieProfile:tokenWindow') {
      if (msg.country && msg.email) {
        // помечаем токен и при необходимости УДАЛЯЕМ его
        // (но максимум один токен на конкретную страницу объявления)
        markTokenWindow(msg.country, msg.email, msg.urlKey);
      }
      sendResponse && sendResponse({ ok: true });
      return true;
    }
    if (msg.cmd === 'bazosCookies:clearAfterSend') {
      const country = (msg.country || 'cz').toLowerCase();
      clearAllBazosCookies(country)
        .then(() => {
          try { sendResponse && sendResponse({ ok:true }); } catch(_) {}
        })
        .catch(e => {
          try { sendResponse && sendResponse({ ok:false, error:String(e) }); } catch(_) {}
        });
      return true;
    }
    if (msg.cmd === 'cookieProfiles:pruneInvalid') {
      if (msg.country) {
        pruneInvalidProfiles(msg.country, res => sendResponse && sendResponse(res || { ok: false }));
        return true;
      }
      sendResponse && sendResponse({ ok: false });
      return true;
    }
    if (msg.cmd === 'cookieProfiles:clearInvalidTokens') {
      clearInvalidTokensAndReorder(res => {
        try { sendResponse && sendResponse(res || { ok: false }); } catch(_) {}
      });
      return true;
    }
    if (msg.cmd === 'cookieProfiles:deleteSelected') {
      if (msg.country && Array.isArray(msg.emails) && msg.emails.length) {
        deleteSelectedProfiles(msg.country, msg.emails, res => sendResponse && sendResponse(res || { ok: false }));
        return true;
      }
      sendResponse && sendResponse({ ok: false });
      return true;
    }
  });
} catch(_) {}
// === END TYPING LOCK ===

// === helper: send-history bookkeeping (prevents ReferenceError) ===
function withinLastHour(ts){ try { return (Date.now() - Number(ts||0)) <= 3600*1000; } catch(_) { return false; } }
async function markSent(country, cfg){
  try {
    cfg = cfg || {};
    cfg.sendHistory = cfg.sendHistory || { cz:[], sk:[] };
    const arr = (cfg.sendHistory[country] || []).filter(withinLastHour);
    arr.push(Date.now());
    cfg.sendHistory[country] = arr;
    try { await chrome.storage.local.set({ cfg }); } catch(_){}
  } catch(_) {}
}
// === end helper ===

// === CFG country-level lock to avoid race between CZ/SK simultaneous updates ===
const __cfgLocks = new Map(); // country -> Promise chain
function __withCountryLock(country, fn){
  const prev = __cfgLocks.get(country) || Promise.resolve();
  const next = prev.then(fn, fn).catch(()=>{});
  __cfgLocks.set(country, next);
  // don't await here; caller can await returned promise if needed
  return next;
}
async function __updateCountryIdx(country, picked){
  return __withCountryLock(country, async ()=>{
    const { cfg } = await chrome.storage.local.get('cfg');
    const _cfg = normalizeCookieProfiles(cfg || {});
    _cfg.lastApplied = _cfg.lastApplied || { cz:'', sk:'' };
    _cfg.cookieRotationIdx = _cfg.cookieRotationIdx || { cz:0, sk:0 };
    const emails = _cfg.emails?.[country] || [];
    const profilesRaw = _cfg.cookieProfiles?.[country];
    const profilesMap = Array.isArray(profilesRaw)
      ? Object.fromEntries(profilesRaw.filter(p => p && p.email).map(p => [p.email, p]))
      : (profilesRaw || {});
    const activeProfiles = emails.filter(em => {
      const disabled = (_cfg.blacklist?.[country] || []).includes(em);
      const profile = profilesMap[em];
      return !disabled && profile && Array.isArray(profile.cookies) && profile.cookies.length;
    });
    _cfg.lastApplied[country] = picked.email;
    _cfg.cookieRotationIdx[country] = ((picked.index||0) + 1) % (activeProfiles.length||1);
    await chrome.storage.local.set({ cfg: _cfg });
  });
}
// === END CFG lock ===



// === TAB SWITCHER KILL-SWITCH ===
let __TAB_SWITCHER_ENABLED = true;
async function __readSwitchFlag(){
  try {
    const { cfg } = await chrome.storage.local.get('cfg');
    __TAB_SWITCHER_ENABLED = !!(cfg ? cfg.switchTabsEnabled !== false : true);
  } catch(_) { __TAB_SWITCHER_ENABLED = true; }
  return __TAB_SWITCHER_ENABLED;
}


function resolveProfileEmail(cookieProfiles, country, email, lastApplied) {
  const arr = Array.isArray(cookieProfiles && cookieProfiles[country]) ? cookieProfiles[country] : [];
  const target = (email||'').trim().toLowerCase();
  if (!target && lastApplied && lastApplied[country]) return lastApplied[country];
  if (target) {
    const hit = arr.find(p => p && String(p.email||'').trim().toLowerCase() === target);
    if (hit) return hit.email;
  }
  if (lastApplied && lastApplied[country]) return lastApplied[country];
  return email;
}

// Init default config on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('cfg', res => {
    if (res.cfg) return;
    const cfg = {
      emails: { cz: [], sk: [] },
      currentIdx: { cz: 0, sk: 0 },
      blacklist: { cz: [], sk: [] },
      cookieRotationEnabled: false,
      cookieRotationIdx: { cz: 0, sk: 0 },
      cookieProfiles: { cz: [], sk: [] }
    };
    chrome.storage.local.set({ cfg });
  });
});

// Legacy config passthrough
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  
  
  // === injected: handle last sent timestamp per email
  if (msg && msg.cmd === 'email:lastSent') {
    const country = (msg.country || 'cz').toLowerCase();
    const email = (msg.email || '').trim();
    try {
      chrome.storage.local.get('cfg', ({ cfg }) => {
        cfg = normalizeCookieProfiles(cfg || { cookieProfiles:{cz:[],sk:[]}, lastApplied:{cz:'',sk:''} });
        cfg.lastApplied = cfg.lastApplied || { cz:'', sk:'' };
        const resolved = resolveProfileEmail(cfg.cookieProfiles, country, email, cfg.lastApplied);
        if (resolved) {
          cfg.cookieProfiles[country] = getCookieProfiles(cfg, country);
          const prof = upsertCookieProfile(cfg, country, resolved, {});
          prof.lastSent = Date.now();
          chrome.storage.local.set({ cfg }, () => {
            try { sendResponse && sendResponse({ ok:true }); } catch(_) {}
          });
        } else {
          try { sendResponse && sendResponse({ ok:false }); } catch(_) {}
        }
      });
    } catch(e){ try { sendResponse && sendResponse({ ok:false }); } catch(_) {} }
    return true;
  }
  // === end injected

if (!msg || !msg.cmd) return;
  if (msg.cmd === 'getConfig') {
    chrome.storage.local.get('cfg', ({ cfg }) => sendResponse(cfg));
    return true;
  }
  if (msg.cmd === 'saveConfig') {
    chrome.storage.local.set({ cfg: msg.cfg }, () => sendResponse(true));
    return true;
  }
});

// ===== Cookie Profiles & Rotation =====
const COOKIE_DOMAINS = { cz: '.bazos.cz', sk: '.bazos.sk' };
const COUNTRY_BY_HOST = host => host.endsWith('.sk') ? 'sk' : 'cz';

function initCfg(cb) {
  chrome.storage.local.get('cfg', res => {
    let cfg = res.cfg || {};
    cfg.emails = cfg.emails || { cz: [], sk: [] };
    cfg.currentIdx = cfg.currentIdx || { cz: 0, sk: 0 };
    cfg.blacklist = cfg.blacklist || { cz: [], sk: [] };
    cfg.cookieRotationEnabled = cfg.cookieRotationEnabled ?? false;
    cfg.cookieRotationIdx = cfg.cookieRotationIdx || { cz: 0, sk: 0 };
    cfg.cookieProfiles = cfg.cookieProfiles || { cz: [], sk: [] };
    cfg.cookieProfilesActiveCount = cfg.cookieProfilesActiveCount || { cz: 4, sk: 4 };
    cfg.lastApplied = cfg.lastApplied || { cz: '', sk: '' };

    // НОВОЕ: история автосмертей токенов и паузы по странам
    cfg.tokenDeathHistory = cfg.tokenDeathHistory || {};
    cfg.tokenDeathHistory.cz = Array.isArray(cfg.tokenDeathHistory.cz) ? cfg.tokenDeathHistory.cz : [];
    cfg.tokenDeathHistory.sk = Array.isArray(cfg.tokenDeathHistory.sk) ? cfg.tokenDeathHistory.sk : [];

    cfg.tokenCooldownUntil = cfg.tokenCooldownUntil || {};
    cfg.tokenCooldownUntil.cz = typeof cfg.tokenCooldownUntil.cz === 'number' ? cfg.tokenCooldownUntil.cz : 0;
    cfg.tokenCooldownUntil.sk = typeof cfg.tokenCooldownUntil.sk === 'number' ? cfg.tokenCooldownUntil.sk : 0;

    cfg = normalizeCookieProfiles(cfg);
    chrome.storage.local.set({ cfg }, () => cb && cb(cfg));
  });
}

const TOKEN_DEATH_WINDOW_MS = 30 * 60 * 1000;  // 30 минут окно, в котором считаем авто-удаления токена
const TOKEN_DEATH_LIMIT     = 4;               // 4 авто-смерти → пауза
const TOKEN_COOLDOWN_MS     = 30 * 60 * 1000;  // длительность паузы 30 минут

function registerTokenDeath(cfg, country) {
  const key = country === 'sk' ? 'sk' : 'cz';
  const now = Date.now();

  cfg.tokenDeathHistory = cfg.tokenDeathHistory || {};
  if (!Array.isArray(cfg.tokenDeathHistory[key])) {
    cfg.tokenDeathHistory[key] = [];
  }

  const list = cfg.tokenDeathHistory[key];
  list.push(now);

  const cutoff = now - TOKEN_DEATH_WINDOW_MS;
  cfg.tokenDeathHistory[key] = list.filter(ts => ts >= cutoff).slice(-50);

  cfg.tokenCooldownUntil = cfg.tokenCooldownUntil || {};
  const currentCooldown = cfg.tokenCooldownUntil[key] || 0;

  if (cfg.tokenDeathHistory[key].length >= TOKEN_DEATH_LIMIT && now > currentCooldown) {
    cfg.tokenCooldownUntil[key] = now + TOKEN_COOLDOWN_MS;
    console.log('[tokenGuard] cooldown start for', key, 'until', new Date(cfg.tokenCooldownUntil[key]).toISOString());
  }
}

function isCountryOnCooldown(cfg, country) {
  const key = country === 'sk' ? 'sk' : 'cz';
  if (!cfg || !cfg.tokenCooldownUntil) return false;
  const until = cfg.tokenCooldownUntil[key] || 0;
  return until > Date.now();
}

function isRotationEnabledForCountry(cfg, country) {
  const key = country === 'sk' ? 'sk' : 'cz';

  if (!cfg.cookieRotationEnabled) return false;

  if (isCountryOnCooldown(cfg, key)) return false;

  return true;
}
initCfg(()=>{});

function getCountryFromUrl(url) {
  try { return COUNTRY_BY_HOST(new URL(url).hostname); } catch (e) { return 'cz'; }
}

function urlForCookieDomain(domain, path) {
  const host = domain && domain.startsWith('.') ? domain.slice(1) : (domain || COOKIE_DOMAINS.cz.slice(1));
  return 'https://' + host + (path || '/');
}

// Remove ALL Bazos cookies (*.bazos.cz / *.bazos.sk) including subdomains
async function clearAllBazosCookies(country){
  const suf = country==='sk' ? 'bazos.sk' : 'bazos.cz';
  const all = await new Promise(resolve => chrome.cookies.getAll({}, resolve));
  const toDel = (all||[]).filter(c => {
    const d = (c.domain || '').replace(/^\./, '');
    return d === suf || d.endsWith('.'+suf);
  });
  for (const c of toDel){
    const host = (c.domain || '').replace(/^\./, '');
    const u = urlForCookieDomain(host, c.path);
    try { await chrome.cookies.remove({ url: u, name: c.name, storeId: c.storeId }); } catch (e) {}
  }
}



function normalizeForCountry(cookie, country){
  const root = country==='sk' ? '.bazos.sk' : '.bazos.cz';
  const copy = Object.assign({}, cookie);
  // Force to root domain and path '/'
  copy.domain = root;
  copy.path = '/';
  // Some cookies may be hostOnly; when setting, we provide domain attribute anyway
  return copy;
}

function filterBazosCookies(cookies, country){
  const suf = country==='sk' ? 'bazos.sk' : 'bazos.cz';
  return (cookies||[]).filter(c=>{
    const d = (c.domain||'').replace(/^\./,'');
    return d === suf || d.endsWith('.'+suf);
  });
}

// === Take ALL cookies and then filter ===
async function getCookiesRobust(url, country) {
  let all = [];
  try { all = await new Promise(r => chrome.cookies.getAll({}, r)); }
  catch(e){ all = []; }
  const suf = country==='sk' ? 'bazos.sk' : 'bazos.cz';
  const filtered = (all||[]).filter(c => {
    const d = (c.domain||'').replace(/^\./,'');
    return d === suf || d.endsWith('.'+suf);
  });
  try { console.log('[CP:cookies] global count=', all?.length||0, '; filtered *.%s => %d', suf, filtered.length);
        console.table(filtered.map(c=>({name:c.name,domain:c.domain,path:c.path,value:c.value}))); } catch(e){}
  return filtered;
}

// === BD extractor: show exactly BKOD ===
function extractBKOD(cookies){
  const c = (cookies||[]).find(x => (x.name||'').toLowerCase() === 'bkod');
  return c && c.value ? String(c.value) : '';
}

function getAllCookiesForUrl(url) {
  return new Promise(resolve => chrome.cookies.getAll({ url }, resolve));
}

async function removeCookiesForUrl(url) {
  const country = getCountryFromUrl(url);
  let cookies = await getAllCookiesForUrl(url);
  cookies = filterBazosCookies(cookies, country);
  for (const c of cookies) {
    try { await chrome.cookies.remove({ url: urlForCookieDomain(c.domain, c.path), name: c.name }); } catch (e) {}
  }
  return cookies.length;
}

async function setCookies(cookies, country){
  cookies = filterBazosCookies(cookies, country).map(c=>normalizeForCountry(c, country));
  for (const c of cookies) {
    const details = {
      url: urlForCookieDomain(c.domain || COOKIE_DOMAINS[country] || COOKIE_DOMAINS.cz, c.path),
      name: c.name,
      value: c.value,
      path: c.path || '/',
      domain: c.domain,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      expirationDate: c.expirationDate
    };
    try { await chrome.cookies.set(details); } catch (e) {}
  }
}

function pickEmailForRotation(cfg, country) {
  const emails = cfg.emails?.[country] || [];
  if (!emails.length) return null;
  const profilesRaw = cfg.cookieProfiles?.[country];
  const profilesMap = Array.isArray(profilesRaw)
    ? Object.fromEntries(profilesRaw.filter(p => p && p.email).map(p => [p.email, p]))
    : (profilesRaw || {});
  const start = cfg.cookieRotationIdx?.[country] || 0;
  for (let i = 0; i < emails.length; i++) {
    const idx = (start + i) % emails.length;
    const em = emails[idx];
    const disabled = (cfg.blacklist?.[country] || []).includes(em);
    const profile = profilesMap[em];
    if (!disabled && profile && Array.isArray(profile.cookies) && profile.cookies.length) {
      return { email: em, index: idx, profile };
    }
  }
  return null;
}

// Messages for cookie profiles UI
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.cmd) return;

  if (msg.cmd === 'cookieProfiles:get') {
    initCfg(cfg => sendResponse({ ok: true, cfg }));
    return true;
  }

  if (msg.cmd === 'cookieProfiles:save') {
    const { email, country, tabId } = msg;
    initCfg(async cfg => {
      try {
        if (!email || !country) { sendResponse({ ok:false, error:'BAD_ARGS' }); return; }
        const tab = tabId ? await new Promise(r => chrome.tabs.get(tabId, r)) : null;
        const url = tab?.url || ('https://' + (country==='sk' ? 'www.bazos.sk' : 'www.bazos.cz') + '/');
        console.log('[CP:save] country=', country, 'email=', email, 'tabId=', tabId, 'resolvedUrl=', url);
        let cookies = await getCookiesRobust(url, country);
        cookies = (cookies||[]).map(c=>normalizeForCountry(c, country));
        const bd = extractBKOD(cookies); // строго BKOD
        cfg.cookieProfiles[country] = getCookieProfiles(cfg, country);
        upsertCookieProfile(cfg, country, email, { cookies, bd, ts: Date.now() });
        await markSent(country, cfg);
      await chrome.storage.local.set({ cfg });
        await removeCookiesForUrl(url); // чистим bazos-куки в браузере
        sendResponse({ ok: true, saved: cookies.length, bd });
      } catch (e) {
        sendResponse({ ok: false, error: 'EXCEPTION:'+String(e) });
      }
    });
    return true;
  }

  if (msg.cmd === 'cookieProfiles:clear') {
    const { email, country } = msg;
    initCfg(cfg => {
      removeCookieProfile(cfg, country, email);
      chrome.storage.local.set({ cfg }, () => sendResponse({ ok: true }));
    });
    return true;
  }

  if (msg.cmd === 'cookieProfiles:setEnabled') {
    const { enabled } = msg;
    initCfg(cfg => {
      cfg.cookieRotationEnabled = !!enabled;
      chrome.storage.local.set({ cfg }, () => sendResponse({ ok: true, enabled: cfg.cookieRotationEnabled }));
    });
    return true;
  }

  if (msg.cmd === 'cookieProfiles:setIdx') {
    const { country, index } = msg;
    initCfg(cfg => {
      cfg.cookieRotationIdx[country] = index;
      chrome.storage.local.set({ cfg }, () => sendResponse({ ok: true, index }));
    });
    return true;
  }

  if (msg.cmd === 'cookieProfiles:setActiveProfile') {
    const { country, email } = msg;
    initCfg(cfg => {
      const key = country === 'sk' ? 'sk' : 'cz';
      const profiles = getCookieProfiles(cfg, key);
      let profile = profiles.find(p => p && p.email === email);
      if (!profile) {
        profile = upsertCookieProfile(cfg, key, email, {});
      }
      if (!profile.ua) {
        profile.ua = pickUaRandom();
      }
      if (!profile.lang) {
        profile.lang = getLangForCountry(key);
      }

      cfg.cookieProfiles[key] = profiles;
      currentFingerprintByCountry[key] = {
        email,
        ua: profile.ua,
        lang: profile.lang
      };

      chrome.storage.local.set({ cfg }, () => {
        updateUaRules();
        sendResponse({ ok: true, active: currentFingerprintByCountry[key] });
      });
    });
    return true;
  }
});

// Apply cookies on bazos pages when rotation is enabled.
// Новый вариант: как только вкладка НАЧАЛА грузиться, чистим все bazos-куки,
// ставим куки токена и СРАЗУ перезагружаем. Второй заход уже идёт с нужным токеном.
const appliedUrlByTab = new Map(); // tabId -> lastUrlKey

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Интересует только начало загрузки
  if (changeInfo.status !== 'loading') return;

  const rawUrl = changeInfo.url || tab?.url || '';
  if (!rawUrl || !/^https?:\/\/[^/]*bazos\.(cz|sk)\//.test(rawUrl)) return;

  let urlKey = rawUrl;
  try {
    const u = new URL(rawUrl);
    urlKey = u.origin + u.pathname; // игнорируем query/hash
  } catch (_) {}

  const prevKey = appliedUrlByTab.get(tabId);
  if (prevKey === urlKey) return; // уже обрабатывали именно эту страницу
  appliedUrlByTab.set(tabId, urlKey);

  initCfg(async cfg => {
    cfg = cfg || {};
    const country = getCountryFromUrl(rawUrl);

    if (!isRotationEnabledForCountry(cfg, country)) {
      console.log('[cookieRotation] disabled for country:', country);
      return;
    }

    const picked = pickEmailForRotation(cfg, country);
    if (!picked) return;

    // 1) Чистим ВСЕ bazos-куки для страны ДО нормальной загрузки
    try {
      await clearAllBazosCookies(country);
    } catch (e) {}

    // 2) Ставим куки выбранного токена
    await setCookies(picked.profile.cookies, country);

    // 3) Обновляем индекс/lastApplied (там уже завязан UA/lang)
    await __updateCountryIdx(country, picked);

    // 4) Перезагружаем вкладку — первый "видимый" заход уже с новыми куками+UA+lang
    try { chrome.tabs.reload(tabId); } catch(e) {}
  });
});

// Чистим карту, когда вкладка закрывается
chrome.tabs.onRemoved.addListener((tabId) => {
  appliedUrlByTab.delete(tabId);
});


// (content-mode) pilot alarms removed



// === TAB SWITCHER (anti-throttle): rotates bazos tabs every 5–10s ===
async function __getCfg(){ return (await chrome.storage.local.get('cfg')).cfg || {}; }
async function __setCfg(cfg){ return chrome.storage.local.set({ cfg }); }
function __randMs(minS, maxS){ const a=Math.min(minS,maxS), b=Math.max(minS,maxS); return (a + Math.floor(Math.random()*(b-a+1)))*1000; }
async function __scheduleTabSwitch(){
  try {
    const cfg = await __getCfg();
    if (cfg.switchTabsEnabled === false) return;
    const ms = __randMs(cfg.switchMinSec ?? 5, cfg.switchMaxSec ?? 10);
    if (__TAB_SWITCHER_ENABLED) chrome.alarms.create('bazos-tab-switch', { when: Date.now() + ms });
  } catch(_) {}
}

chrome.runtime.onInstalled.addListener(async () => {
  const cfg = await __getCfg();
  if (cfg.switchTabsEnabled === undefined) cfg.switchTabsEnabled = true;  // enable by default
  if (cfg.switchMinSec === undefined) cfg.switchMinSec = 5;
  if (cfg.switchMaxSec === undefined) cfg.switchMaxSec = 10;
  if (cfg.tabSwitchIdx === undefined) cfg.tabSwitchIdx = 0;
  await __setCfg(cfg);
  __TAB_SWITCHER_ENABLED = !!(cfg.switchTabsEnabled !== false);
  await __scheduleTabSwitch();
});

chrome.runtime.onStartup.addListener(async () => {
  await __readSwitchFlag();
  await __scheduleTabSwitch();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'bazos-tab-switch') return;
  if (!__TAB_SWITCHER_ENABLED) { try { await chrome.alarms.clear('bazos-tab-switch'); } catch(_) {} return; }
  try {
    const cfg = await __getCfg();
    if (cfg.switchTabsEnabled === false) {
      try { await chrome.alarms.clear('bazos-tab-switch'); } catch(_) {}
      try { await chrome.alarms.clearAll(); } catch(_) {}
      return;
    }
    // Collect bazos tabs across windows
    const tabs = await chrome.tabs.query({ url: ["*://*.bazos.cz/*", "*://bazos.cz/*", "*://*.bazos.sk/*", "*://bazos.sk/*"] });
    if (tabs.length >= 2) {
      cfg.tabSwitchIdx = (cfg.tabSwitchIdx || 0) % tabs.length;
      const t = tabs[cfg.tabSwitchIdx];
      try { await chrome.windows.update(t.windowId, { focused: true }); } catch(_){}
      try { await chrome.tabs.update(t.id, { active: true }); } catch(_){}
      cfg.tabSwitchIdx = (cfg.tabSwitchIdx + 1) % tabs.length;
      await __setCfg(cfg);
    }
  } catch(_) {}
  // Reschedule next rotation only if enabled
  const cfg2 = await __getCfg();
  if (cfg2.switchTabsEnabled !== false) {
    await __scheduleTabSwitch();
  }
});
// === END TAB SWITCHER ===



// === message: tabSwitcher:reschedule ===
try {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.cmd !== 'tabSwitcher:reschedule') return;
    (async () => {
      try {
        const { enabled } = msg;
        const data = await chrome.storage.local.get('cfg');
        const cfg = data.cfg || {};
        cfg.switchTabsEnabled = !!enabled;
        __TAB_SWITCHER_ENABLED = !!enabled;
        if (cfg.switchMinSec === undefined) cfg.switchMinSec = 5;
        if (cfg.switchMaxSec === undefined) cfg.switchMaxSec = 10;
        await chrome.storage.local.set({ cfg });
        // Clear any old alarm
        try { await chrome.alarms.clear('bazos-tab-switch'); } catch(_) {}
        if (!cfg.switchTabsEnabled) { try { await chrome.alarms.clearAll(); } catch(_) {} __TAB_SWITCHER_ENABLED = false; }
        // If enabling – schedule next
        if (cfg.switchTabsEnabled) {
          const ms = (Math.min(cfg.switchMinSec, cfg.switchMaxSec) + Math.floor(Math.random()*(Math.abs(cfg.switchMaxSec - cfg.switchMinSec)+1))) * 1000;
          chrome.alarms.create('bazos-tab-switch', { when: Date.now() + ms });
        }
        sendResponse && sendResponse({ ok: true });
      } catch(e) {
        try { sendResponse && sendResponse({ ok: false, error: String(e) }); } catch(_){}
      }
    })();
    return true;
  });
} catch(_) {}
// === end message ===



// Stop tab switcher immediately when switchTabsEnabled flips to false
try {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (!changes || !changes.cfg || !changes.cfg.newValue) return;
    try {
      const cfg = changes.cfg.newValue;
      if (cfg && cfg.switchTabsEnabled === false) { __TAB_SWITCHER_ENABLED = false;
        try { await chrome.alarms.clear('bazos-tab-switch'); } catch(_) {}
        try { await chrome.alarms.clearAll(); } catch(_) {}
      }
    } catch(_) {}
  });
} catch(_) {}

// === AI background fetch ===

try {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.cmd !== 'ai:genText') return;
    (async () => {
      let { lang='cs', title='', categoryHint='generic', qcount=1, styleSeed=Math.random(), url='' } = msg;
      const about = msg.about || msg.description || '';
      // Auto-detect language by domain if not explicitly provided
      try {
        const hint = String(url || about || title || '').toLowerCase();
        if (!lang || !['cs','sk'].includes(lang)) {
          if (/(^|\W)bazos\.sk(\W|$)/.test(hint)) lang = 'sk';
          else if (/(^|\W)bazos\.cz(\W|$)/.test(hint)) lang = 'cs';
          else lang = 'cs';
        }
      } catch(_) { lang = lang || 'cs'; }

      try {
        const { cfg } = await chrome.storage.local.get('cfg');
        if (!cfg || !cfg.aiEnabled) { sendResponse({ ok:false, error:'ai-disabled' }); return; }
        const key = (cfg.aiApiKey||'').trim();
        const model = cfg.aiModel || 'gpt-4o-mini';
        const temperature = Math.max(0.8, Math.min(Number(cfg.aiTemp || 0.9), 1.1));
        const max_tokens = Math.max(40, Math.min(300, Number(cfg.aiMaxTokens||120)));
        if (!key) { sendResponse({ ok:false, error:'no-key' }); return; }
        const sys = [
          'Jsi asistent pro odpovídání na bazarové inzeráty.',
          'Tvým úkolem je napsat JEN JEDNU velmi krátkou otázку od zájemce.',
          'Bez pozdravu, bez oslovení, bez poděkování a bez podpisu.',
          'Žádné úvody typu "mám zájem", "mal by som záujem", "rád bych koupil" apod.',
          'Otázka musí být konkrétně o nabízeném zboží podle názvu a popisu inzerátu.',
          'Maximálně 12–15 slov, jedna věta zakončená otazníkem.',
          'Zaměř se na parametry, stav, stáří, výbavu nebo původ věci dle kategorie.',
          'Nezačínej otázky pořád stejnými slovy jako "Jaký je", "Jaká je", "Jaké je", "Jaký má", "Jaká má", "Jaké má", "Zajímá mě", "Můžete upřesnit".',
          'Střídej začátky vět a používej různá slovesa a formulace (např. "Je ...?", "Kdy ...?", "Kolik ...?", "Obsahuje ...?", "Funguje ...?" apod.).',
          'Používej i různé synonymní výrazy (stav/kondice/opotřebení, stáří/doba používání, vybavení/příslušenství apod.).',
          'Jazyk: ' + (lang === 'sk' ? 'slovenština' : 'čeština') + '.'
        ].join(' ');

        const user = [
          'NÁZEV INZERÁTU: ' + title,
          'POPIS: ' + about,
          'KATEGORIE: ' + (categoryHint || 'nezadaná'),
          'ÚKOL: Napiš jen jednu krátkou otázku, kterou by typický zájemce položil k této konkrétní věci.',
          'Otázka musí vycházet z konkrétních detailů v názvu nebo popisu (značka, model, parametry, rozměry, stav, stáří apod.).'
        ].join('\n');

        // Length control: jedna velmi krátká otázka
        const used_max_tokens = Math.min(50, max_tokens || 50);

        const body = {
          model,
          temperature,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user }
          ],
          n: 1,
          max_tokens: used_max_tokens
        };
let resp;
try {
  resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify(body)
  });
} catch(e) {
  console.warn('[AI] network error:', e && e.message);
  sendResponse({ ok:false, error:'network:' + (e && e.message || 'failed') });
  return;
}
const txt = await resp.text();
let data = null;
try { data = JSON.parse(txt); } catch(_) {}
if (!resp.ok) {
  const errMsg = (data && data.error && data.error.message) || txt || (resp.status + ' ' + resp.statusText);
  console.warn('[AI] api error', resp.status, errMsg);
  sendResponse({ ok:false, status: resp.status, error: String(errMsg||'api-error') });
  return;
}
const choices = (data.choices || []).map(c => (c.message?.content || '').trim()).filter(Boolean);
const text = choices.length ? choices[Math.floor(Math.random() * choices.length)] : '';
sendResponse({ ok: !!text, text: __sanitizeAiText(text) });



      } catch(e) { sendResponse({ ok:false, error: String(e) }); }
    })();
    return true;
  });
} catch(_) {}


// === phrases loader (background) ===
try {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.cmd !== 'phrases:load') return;
    (async () => {
      try {
        const { country = 'cz', category = 'generic' } = msg;
        const url = chrome.runtime.getURL(`phrases/${country}_${category}.txt`);
        const resp = await fetch(url);
        if (!resp.ok) { sendResponse({ ok:false, text:'' }); return; }
        const text = await resp.text();
        sendResponse({ ok:true, text });
      } catch(e) {
        try { sendResponse && sendResponse({ ok:false, error: String(e) }); } catch(_) {}
      }
    })();
    return true;
  });
} catch(_) {}
// === end phrases loader ===
