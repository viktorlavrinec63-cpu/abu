
// === TYPING LOCK PINGS ===
(function(){
  let __typingTimer = null;
  function __ping(){ try { chrome.runtime.sendMessage({ cmd: 'user:typing' }); } catch(_){} }
  function __mark(){ __ping(); clearTimeout(__typingTimer); __typingTimer = setTimeout(()=>{}, 4000); }
  const events = ['keydown','input','keyup','change'];
  events.forEach(ev => document.addEventListener(ev, (e) => {
    try {
      if (!e.isTrusted) return;
      const el = e.target;
      const editable = el && ((el.tagName==='INPUT' && /text|search|email|tel|url|password/.test(el.type||'text')) || el.tagName==='TEXTAREA' || el.isContentEditable);
      if (editable) __mark();
    } catch(_) {}
  }, true));
})();
// === END TYPING LOCK PINGS ===
// === Strict ad context (scoped to the main ad only) ===
function getAdContext() {
  try {
    const main = document.querySelector('#inzerat, #content, .inzeratdetail, .detail, main') || document.body;
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content?.trim() || '';
    const ogDesc  = document.querySelector('meta[property="og:description"]')?.content?.trim() || '';
    const __ad = getAdContext();
const title = __ad.title;
    let description = (ogDesc || '');
    if (!description) {
      const descEl = main.querySelector('.popis, .inzeratpopis, #popis, .popisdetail, article');
      if (descEl) description = (descEl.innerText || descEl.textContent || '').trim();
    }
    if (!description) description = (main.innerText || '').replace(/\s+/g, ' ').slice(0, 600);
    // Try to read price from the main only
    let price = '';
    const priceEl = main.querySelector('.inzeratycena b, .inzeratycena strong, .price b, .price strong');
    if (priceEl) price = (priceEl.innerText || priceEl.textContent || '').trim();
    return { title, description, price, url: location.href };
  } catch (_e) {
    return { title: (document.title||'').trim(), description: '', price: '', url: location.href };
  }
}

// === AI inline helper (no auto-run) ===
async function __bazos_getAITextForAd(defaultPhrase) {
  return new Promise(async (resolve) => {
    try {
      // read cfg to see if enabled
      let aiEnabled = false;
      await new Promise(r => chrome.storage.local.get('cfg', ({cfg})=>{ aiEnabled = !!(cfg && cfg.aiEnabled); r(); }));
      if (!aiEnabled) return resolve({ ok:false, text: defaultPhrase });

      const lang = /bazos\.sk$/.test(location.host) ? 'sk' : 'cs';
      const __ad = getAdContext();
      const title = __ad.title;
      let about = __ad.description;
const categoryHint = (function(){
  const t=(title+' '+about).toLowerCase();
  const m = (sel)=>{ const x=document.querySelector(sel); return x? (x.textContent||'').toLowerCase():''; };
  const bread = m('.cesta, .breadcrumb, .inzeratnadpis + div, nav') + ' ' + location.pathname.toLowerCase();
  const text = (t + ' ' + bread);
  const has=(w)=>text.indexOf(w)>=0;
  if (['šaty','tričko','kalhoty','legíny','bund','bot','kabát','sukn','mikina','svetr','oblečení','obleceni'].some(has)) return 'clothes';
  if (['notebook','laptop','počítač','monitor','grafick','procesor','ram','ssd','pc','klávesnic','myš'].some(has)) return 'computers';
  if (['telefon','iphone','android','xiaomi','samsung','telefonní'].some(has)) return 'phones';
  if (['kolo','jízdní','mtb','silniční','treking','dětské kolo'].some(has)) return 'bikes';
  if (['kočárek','hračka','lego','dětské','autosedačka'].some(has)) return 'kids';
  if (['stůl','židle','postel','skříň','gauč','sofa','komoda','nábytek'].some(has)) return 'furniture';
  if (['zimní','letní','pneumatik','alu','disky','kola','auto','motorka'].some(has)) return 'auto';
  return 'generic';
})();
const qcount = 1; // 1 or 2-3
const resp = await chrome.runtime.sendMessage({ cmd:'ai:genText', lang, title, about, categoryHint, qcount, styleSeed: Math.random() });
      if (resp && resp.ok && resp.text) return resolve({ ok:true, text: resp.text });
      return resolve({ ok:false, text: defaultPhrase });
    } catch(e) { resolve({ ok:false, text: defaultPhrase }); }
  });
}
// === END AI helper ===






async function getEmailForLastSent(country, currentEmail){
  try{
    const { cfg } = await chrome.storage.local.get('cfg');
    if (cfg && cfg.cookieRotationEnabled && cfg.lastApplied && cfg.lastApplied[country]){
      return cfg.lastApplied[country];
    }
  }catch(e){}
  if (currentEmail && /@/.test(currentEmail)) return currentEmail;
  if (typeof getCurrentEmailFromDOM === 'function'){
    const v = getCurrentEmailFromDOM();
    if (v) return v;
  }
  return currentEmail || '';
}

function getCurrentEmailFromDOM(){
  try {
    const sel = [
      'input[type="email"]',
      'input[name*="mail" i]',
      'input[id*="mail" i]',
      'input[name="email"]',
      'input[name="mail"]',
      '#mail', '#email'
    ];
    for (const s of sel) {
      const el = document.querySelector(s);
      if (el && el.value && /@/.test(el.value)) return el.value.trim();
    }
  } catch(e){}
  return '';
}

(async function(){
  function isAdPage() {
    return /^\/inzerat\/\d+\/.+\.php$/i.test(location.pathname);
  }
  if (!isAdPage()) return;

  function getAntispamOptions() {
    return new Promise(resolve => {
      chrome.storage.local.get('antispam_options', function(res) {
        resolve(res.antispam_options || {});
      });
    });
  }

  function waitRand(min, max) {
    return new Promise(r=>setTimeout(r, Math.floor(Math.random()*(max-min+1))+min));
  }

  function doRandomMouseMove() {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    const ev = new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true });
    document.body.dispatchEvent(ev);
  }
  function doRandomScroll() {
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.random() * maxScroll);
  }
  function doRandomClicks() {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    const ev = new MouseEvent('click', { clientX: x, clientY: y, bubbles: true });
    document.body.dispatchEvent(ev);
  }
  async function maybeSelectInput(input, enable, percent) {
    if (!enable || !input) return;
    if (Math.random() * 100 < percent) {
        input.focus();
        // Проверка: не выполняем выделение, если поле email или метод недоступен
        if (input.type !== 'email' && typeof input.setSelectionRange === 'function') {
            input.setSelectionRange(0, input.value.length);
        }
        let ev = new MouseEvent('mousedown', { bubbles: true });
        input.dispatchEvent(ev);
        await waitRand(120, 250);
      let ev2 = new MouseEvent('mouseup', { bubbles: true });
      input.dispatchEvent(ev2);
    }
  }
  async function runAntispam(asp) {
    let actions = [];
    if(asp.antispam_mouse) actions.push(()=>doRandomMouseMove());
    if(asp.antispam_scroll) actions.push(()=>doRandomScroll());
    if(asp.antispam_clicks) actions.push(()=>doRandomClicks());
    for (let action of shuffle(actions)) {
      action();
      await waitRand(200, 400);
    }
  }
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  async function simulateTypingWithMistakes(input, text, minD, maxD, errCount, fullDel = false, del1 = false, del1Percent = 20, fullDelPercent = 10) {
    // Иногда полностью стираем и печатаем заново (только один раз)
    if (fullDel && Math.random() * 100 < fullDelPercent) {
      input.value = text;
      input.dispatchEvent(new Event('input', {bubbles:true}));
      await waitRand(220, 440);
      input.value = '';
      input.dispatchEvent(new Event('input', {bubbles:true}));
      await waitRand(180, 340);
    }
    input.value = '';
    input.dispatchEvent(new Event('input', {bubbles:true}));

    let errorPositions = [];
    if (text.length > 3 && errCount > 0) {
      while (errorPositions.length < errCount) {
        let pos = Math.floor(Math.random() * (text.length - 2)) + 1;
        if (!errorPositions.includes(pos)) errorPositions.push(pos);
      }
      errorPositions.sort((a, b) => a - b);
    }
    for(let i = 0, errIdx = 0; i < text.length; i++) {
      let delay = Math.floor(Math.random() * (maxD - minD + 1)) + minD;
      await new Promise(r => setTimeout(r, delay));
      // Иногда делаем ошибку с 1 буквой
      if (del1 && Math.random() * 100 < del1Percent) {
        input.value += String.fromCharCode(97 + Math.floor(Math.random()*26));
        input.dispatchEvent(new Event('input', {bubbles:true}));
        await new Promise(r => setTimeout(r, 90 + Math.random()*120));
        input.value = input.value.slice(0, -1);
        input.dispatchEvent(new Event('input', {bubbles:true}));
      }
      // Ошибка из списка errorPositions
      if (errorPositions[errIdx] === i) {
        input.value += String.fromCharCode(97 + Math.floor(Math.random()*26));
        input.dispatchEvent(new Event('input', {bubbles:true}));
        await new Promise(r => setTimeout(r, 90 + Math.random()*120));
        input.value = input.value.slice(0, -1);
        input.dispatchEvent(new Event('input', {bubbles:true}));
        errIdx++;
      }
      input.value += text[i];
      input.dispatchEvent(new Event('input', {bubbles:true}));
    }
  }

  function $x(xpath) {
    return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  }
  function getCountry() {
    return window.location.hostname.endsWith('.sk') ? 'sk' : 'cz';
  }
  function getCategory() {
    const subdomain = window.location.hostname.split('.')[0];
    return subdomain === 'www' ? '' : subdomain;
  }
  function getProductName() {
    const country = getCountry();
    if (country === 'cz') {
      const node = $x('/html/body/div[1]/div[3]/div[2]/div[1]/div[1]/h1');
      return node ? node.textContent.trim() : '';
    } else {
      const node = $x('/html/body/div/div[3]/div[2]/div[1]/div[1]/h1');
      return node ? node.textContent.trim() : '';
    }
  }
  
async function loadPhrases(country, category) {
  try {
    if (!chrome || !chrome.runtime || !chrome.runtime.id) return [];
  } catch(_) { return []; }
  const MAX_TRY = 3;
  for (let i = 0; i < MAX_TRY; i++) {
    try {
      const resp = await new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({ cmd: 'phrases:load', country, category }, (ans) => resolve(ans || { ok:false }));
        } catch(e) { resolve({ ok:false, error:String(e) }); }
      });
      if (resp && resp.ok && resp.text != null) {
        const text = String(resp.text || '');
        return Array.from(new Set(text.split('\n').map(x => x.trim()).filter(Boolean)));
      }
      if (resp && String(resp.error||'').includes('Extension context invalidated')) {
        await new Promise(r => setTimeout(r, 250));
        continue;
      }
    } catch (e) {
      if (String(e).includes('Extension context invalidated')) {
        await new Promise(r => setTimeout(r, 250));
        continue;
      }
    }
  }
  return [];
}

  function getEmail(country) {
    return new Promise(res => {
      chrome.storage.local.get('cfg', d => {
        let cfg = d.cfg || { emails: { cz:[], sk:[] }, currentIdx:{cz:0,sk:0} };
        res(cfg.emails[country][cfg.currentIdx[country]] || '');
      });
    });
  }
  function saveSendStat(country, email) {
    const now = Date.now();
    chrome.storage.local.get(['sendStats'], res => {
      let stats = res.sendStats || [];
      stats.push({ time: now, country: country, email: (email||'') });
      if (stats.length > 200) stats = stats.slice(stats.length - 200);
      chrome.storage.local.set({ sendStats: stats });
  try { chrome.runtime.sendMessage({ cmd:'email:lastSent', country, email }); } catch(e) {}
      });
  }

  async function waitForFields(maxWaitMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const emailInput = document.querySelector('input[name="mailo"]#mailo');
      const msgInput = document.querySelector('#texto');
      const sendBtn = document.querySelector('#mailbutton');
      if (emailInput && msgInput && sendBtn) return { emailInput, msgInput, sendBtn };
      await new Promise(r=>setTimeout(r, 300));
    }
    return {};
  }

  function isCountryOnCooldownLocal(cfg, country) {
    const key = country === 'sk' ? 'sk' : 'cz';
    if (!cfg || !cfg.tokenCooldownUntil) return false;
    const until = cfg.tokenCooldownUntil[key] || 0;
    return until > Date.now();
  }

  async function mainAutoFill() {
    const asp = await getAntispamOptions();
    if (!asp.antispam_enable) return; // Если антиспам выключен — не автозаполняем!

    const { emailInput, msgInput, sendBtn } = await waitForFields();
    /* COOKIE ROTATION ADDED */
    const cfg = await new Promise(r=>chrome.storage.local.get('cfg', ({cfg})=>r(cfg||{}))).catch(()=>({}));
    const country = getCountry();
    if (!cfg || !cfg.cookieRotationEnabled) {
      // Режим подготовки: ротация и автозаполнение отключены
      return;
    }

    if (isCountryOnCooldownLocal(cfg, country)) {
      console.log('[autoFill] cooldown for', country, '- behave like rotation OFF');
      return;
    }
    let rotatedEmail = '';
    const emails = (cfg.emails?.[country]||[]);
    const startIdx = (cfg.cookieRotationIdx?.[country]||0) % (emails.length||1);
    const blacklist = (cfg.blacklist?.[country]||[]);

      // cookieProfiles mohou být jako objekt i jako pole — sjednocený přístup
      const cpRaw = cfg.cookieProfiles && cfg.cookieProfiles[country];
      const getProfileByEmail = (em) => {
        if (!cpRaw) return null;
        // nová logika background.js: pole profilů { email, cookies, ... }
        if (Array.isArray(cpRaw)) {
          return cpRaw.find(p => p && p.email === em) || null;
        }
        // stará logika: objekt email -> profil
        return cpRaw[em] || null;
      };

      // 1) СНАЧАЛА пробуем именно lastApplied — тот токен, для которого реально применили cookies
      const lastApplied = cfg.lastApplied && cfg.lastApplied[country];
      if (lastApplied) {
        const lpProfile = getProfileByEmail(lastApplied);
        const lpDisabled = blacklist.includes(lastApplied);
        if (lpProfile && Array.isArray(lpProfile.cookies) && lpProfile.cookies.length && !lpDisabled) {
          rotatedEmail = lastApplied;
        }
      }

      // 2) Если по lastApplied ничего живого не нашли — ищем по очереди, как раньше
      if (!rotatedEmail) {
        for (let i = 0; i < emails.length; i++) {
          const idx = (startIdx + i) % emails.length;
          const em = emails[idx];
          const profile = getProfileByEmail(em);
          const enabled = !blacklist.includes(em);
          if (enabled && profile && Array.isArray(profile.cookies) && profile.cookies.length) {
            rotatedEmail = em;
            break;
          }
        }
      }

      if (!rotatedEmail) return;

      // --- РАННЯЯ ПРОВЕРКА: уже при открытии объявления просят ввести телефон ---
      const overlayInitialEarly = document.querySelector('#overlaymail');
      if (overlayInitialEarly) {
        // Конкретно поле ввода телефона
        const telInputInitial = overlayInitialEarly.querySelector('#teloverit2');
        // Если поля телефона НЕТ → НЕ удаляем токен
        if (telInputInitial) {
          let urlKey = '';
          try {
            const u = new URL(window.location.href);
            urlKey = u.origin + u.pathname;
          } catch (e) {}

          chrome.runtime.sendMessage({
            cmd:'cookieProfile:tokenWindow',
            country,
            email: rotatedEmail || '',
            urlKey
          }, () => {});

          // токен/почта для этой страницы уже мёртвые — дальше ничего не делаем
          return;
        }
      }
      // --- КОНЕЦ РАННЕЙ ПРОВЕРКИ ---

    // Сообщаем в background, какой профиль сейчас активен,
    // чтобы применить его UA + Accept-Language
    if (rotatedEmail) {
      try {
        chrome.runtime.sendMessage({
          cmd: 'cookieProfiles:setActiveProfile',
          country,
          email: rotatedEmail
        }, () => {});
      } catch (e) {}
    }
    if (!emailInput || !msgInput || !sendBtn) return;

    // Задержка перед стартом — "осмотр объявления"
    await waitRand(asp.asp_start_min * 1000, asp.asp_start_max * 1000);

    // Мышь/скролл/клик (если включено)
    await runAntispam(asp);

    // Имитация выделения email (если включено и шанс)
    await maybeSelectInput(emailInput, asp.antispam_select, asp.asp_select_percent);

    // Ввод email: иногда вставить целиком, иногда печатать.
    // Стараемся использовать тот же email, что и в rotatedEmail / lastApplied,
    // чтобы всё (куки, ввод, статистика и удаление) было привязано к одному профилю.
    let email = rotatedEmail;
    try {
      if (!email) {
        const { cfg } = await chrome.storage.local.get('cfg');
        if (cfg && cfg.cookieRotationEnabled && cfg.lastApplied && cfg.lastApplied[country]) {
          email = cfg.lastApplied[country];
        }
      }
    } catch (e) {}
    if (!email) { email = await getEmail(country); }
    let doPaste = asp.asp_email_paste && (Math.random()*100 < asp.asp_email_paste_percent);
    let doFullDel = asp.asp_email_full_del && (Math.random()*100 < asp.asp_email_full_del_percent);

    if (doPaste) {
      emailInput.focus();
      await waitRand(60,120);
      emailInput.value = '';
      emailInput.dispatchEvent(new Event('input', {bubbles:true}));
      await waitRand(50,110);
      emailInput.value = email;
      emailInput.dispatchEvent(new Event('input', {bubbles:true}));
      await waitRand(80,200);
    } else {
      await simulateTypingWithMistakes(
        emailInput,
        email,
        asp.asp_email_min, asp.asp_email_max, asp.asp_email_errors,
        doFullDel, false, 0, asp.asp_email_full_del_percent
      );
    }

    // Пауза + мышь + выделение для текста
    await waitRand(asp.asp_between_min, asp.asp_between_max);
    await runAntispam(asp);
    await maybeSelectInput(msgInput, asp.antispam_select, asp.asp_select_percent);

    // Ввод текста (человеческий, с ошибками, шансами)
    const category = getCategory();
    const product = getProductName();
    const phrases = await loadPhrases(country, category);
    let phrase = 'Фраз для этой категории не найдено!';
    if (phrases.length > 0) {
      let usedIdxs = JSON.parse(localStorage.getItem(`usedPhrases_${country}_${category}`)||'[]');
      let idxs = Array.from(phrases.keys()).filter(i=>!usedIdxs.includes(i));
      if (!idxs.length) { usedIdxs=[]; idxs = Array.from(phrases.keys()); }
      const idx = idxs[Math.floor(Math.random()*idxs.length)];
      usedIdxs.push(idx);
      localStorage.setItem(`usedPhrases_${country}_${category}`, JSON.stringify(usedIdxs));
      phrase = phrases[idx] || '';
      phrase = phrase.replace(/\{product\}/gi, product);
    }
    let doTextFullDel = asp.asp_text_full_del && (Math.random()*100 < asp.asp_text_full_del_percent);
    let doTextDel1 = asp.asp_text_del1 && (Math.random()*100 < asp.asp_text_del1_percent);

    
    // === AI override of phrase (same scenario order: after email + pauses) ===
    try {
      const ai = await __bazos_getAITextForAd(phrase);
      if (ai && ai.ok && ai.text) { phrase = ai.text; }
    } catch(_){}
    // === END AI override ===

      // === AI override (single-shot; after email & pauses) ===
      try {
        const ai = await __bazos_getAITextForAd(phrase);
        if (ai && ai.ok && ai.text) { phrase = ai.text; }
      } catch(_){}
      // === END AI override ===
    await simulateTypingWithMistakes(
      msgInput,
      phrase,
      asp.asp_text_min, asp.asp_text_max, asp.asp_text_errors,
      doTextFullDel, doTextDel1, asp.asp_text_del1_percent, asp.asp_text_full_del_percent
    );
    msgInput.dispatchEvent(new Event('input', {bubbles:true}));

    // === Добавляем 20–50 скрытых переносов строки с U+200B после основного текста ===
    try {
      const minHidden = 20;
      const maxHidden = 50;
      const count = minHidden + Math.floor(Math.random() * (maxHidden - minHidden + 1));
      const ZWS = '\u200B'; // Zero Width Space
      let extra = '';
      for (let i = 0; i < count; i++) {
        // Enter + невидимый символ в каждой строке
        extra += '\n' + ZWS;
      }

      msgInput.value = (msgInput.value || '') + extra;
      msgInput.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {
      console.warn('[autoFill] failed to append hidden ZWS lines', e);
    }
    // === Конец вставки скрытых переносов ===

    // Пауза и антиспам перед отправкой
    await waitRand(asp.asp_presend_min, asp.asp_presend_max);
    await runAntispam(asp);

    const sendOverlay = document.querySelector('#overlaymail');
    const btn = sendOverlay && sendOverlay.querySelector('#mailbutton');

    if (btn) {
      btn.click();

      // После клика ждём 10 секунд и просим background почистить ВСЕ bazos-куки
      // для текущей страны (cz/sk). Так куки точно улетят даже если сайт долго
      // отвечает или не показывает текст "odpověď byla odeslána".
      try {
        const countryForClear = getCountry();
        setTimeout(() => {
          try {
            chrome.runtime.sendMessage({
              cmd: 'bazosCookies:clearAfterSend',
              country: countryForClear
            }, () => {});
          } catch (e) {}
        }, 10000); // 10 секунд после нажатия кнопки
      } catch (e) {
        // ничего страшного, просто не почистим в этом редком кейсе
      }

      const country = typeof currentCountry !== 'undefined'
        ? currentCountry
        : ((typeof state !== 'undefined' && state && state.country) || getCountry());
      const emailToUse = typeof currentEmail !== 'undefined'
        ? currentEmail
        : ((typeof state !== 'undefined' && state && state.email) || email);

      if (country && emailToUse) {
        let tries = 0;
        const maxTries = 10; // ~5 секунд наблюдения

        const intervalId = setInterval(() => {
          tries++;

      const overlayNow = document.querySelector('#overlaymail');
          if (!overlayNow) {
            if (tries >= maxTries) {
              clearInterval(intervalId);
            }
            return;
          }

          const telInputNow = overlayNow.querySelector('#teloverit2');
      // Ключ страницы (та же логика, что и выше) – домен + путь.
      let urlKey = '';
      try {
        const u2 = new URL(window.location.href);
        urlKey = u2.origin + u2.pathname;
      } catch (_) {}

      if (telInputNow) {
        clearInterval(intervalId);
        chrome.runtime.sendMessage({
          cmd: 'cookieProfile:tokenWindow',
          country,
          email: emailToUse,
          urlKey
        }, () => {});
        return;
      }

          const text = (overlayNow.innerText || '').toLowerCase();
          if (
            text.includes('odpověď byla odeslána') ||
            text.includes('odpoved bola odoslana')
          ) {
            clearInterval(intervalId);
            // старая логика статистики: считаем только успешные отправки
            saveSendStat(country, emailToUse);

            // После успешной отправки очищаем bazos-куки для этой страны,
            // чтобы при следующем объявлении ротация начиналась "с чистого листа"
            try {
              chrome.runtime.sendMessage({ cmd: 'bazosCookies:clearAfterSend', country }, () => {});
            } catch (e) {}

            return;
          }

          if (text.includes('limit') || text.includes('omezen')) {
            clearInterval(intervalId);
            return;
          }

          if (tries >= maxTries) {
            clearInterval(intervalId);
          }
        }, 500);
      }

      return;
    }
  }

  mainAutoFill();
})();
// === AI autofill ===

