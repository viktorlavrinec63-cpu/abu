function load() {
  chrome.storage.local.get(['cfg'], ({cfg})=>{
    cfg = cfg||{emails:{cz:[],sk:[]},currentIdx:{cz:0,sk:0},blacklist:{cz:[],sk:[]}};
    document.getElementById('popupCz').textContent = cfg.emails.cz[cfg.currentIdx.cz]||'';
    document.getElementById('popupSk').textContent = cfg.emails.sk[cfg.currentIdx.sk]||'';
  });
}

document.getElementById('popupSwitchCz').onclick = ()=>{
  chrome.storage.local.get(['cfg'],({cfg})=>{
    cfg = cfg||{emails:{cz:[],sk:[]},currentIdx:{cz:0,sk:0},blacklist:{cz:[],sk:[]}};
    if (!cfg.emails.cz.length) return;
    const idx = cfg.currentIdx.cz;
    cfg.blacklist.cz = cfg.blacklist.cz || [];
    cfg.blacklist.cz.push(cfg.emails.cz[idx]);
    cfg.currentIdx.cz = (idx + 1) % cfg.emails.cz.length;
    chrome.storage.local.set({cfg}, load);
  });
};

document.getElementById('popupSwitchSk').onclick = ()=>{
  chrome.storage.local.get(['cfg'],({cfg})=>{
    cfg = cfg||{emails:{cz:[],sk:[]},currentIdx:{cz:0,sk:0},blacklist:{cz:[],sk:[]}};
    if (!cfg.emails.sk.length) return;
    const idx = cfg.currentIdx.sk;
    cfg.blacklist.sk = cfg.blacklist.sk || [];
    cfg.blacklist.sk.push(cfg.emails.sk[idx]);
    cfg.currentIdx.sk = (idx + 1) % cfg.emails.sk.length;
    chrome.storage.local.set({cfg}, load);
  });
};

document.getElementById('popupSwitchAll').onclick = ()=>{
  chrome.storage.local.get(['cfg'],({cfg})=>{
    cfg = cfg||{emails:{cz:[],sk:[]},currentIdx:{cz:0,sk:0},blacklist:{cz:[],sk:[]}};
    // CZ
    if (cfg.emails.cz.length) {
      const idxCz = cfg.currentIdx.cz;
      cfg.blacklist.cz = cfg.blacklist.cz || [];
      cfg.blacklist.cz.push(cfg.emails.cz[idxCz]);
      cfg.currentIdx.cz = (idxCz + 1) % cfg.emails.cz.length;
    }
    // SK
    if (cfg.emails.sk.length) {
      const idxSk = cfg.currentIdx.sk;
      cfg.blacklist.sk = cfg.blacklist.sk || [];
      cfg.blacklist.sk.push(cfg.emails.sk[idxSk]);
      cfg.currentIdx.sk = (idxSk + 1) % cfg.emails.sk.length;
    }
    chrome.storage.local.set({cfg}, load);
  });
};

function getStatsForPopup() {
  chrome.storage.local.get('cfg', res => {
    const cfg = res.cfg || {};
    const stats = cfg.stats || {};
    const cz = stats.cz || { total: 0, ok: 0, error: 0 };
    const sk = stats.sk || { total: 0, ok: 0, error: 0 };

    const total = (cz.total || 0) + (sk.total || 0);
    document.getElementById('popupStatTotal').textContent = total;
    document.getElementById('popupStatCz').textContent = `${cz.total || 0} (ok: ${cz.ok || 0}, error: ${cz.error || 0})`;
    document.getElementById('popupStatSk').textContent = `${sk.total || 0} (ok: ${sk.ok || 0}, error: ${sk.error || 0})`;
  });
}

function formatDt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString().slice(0, 17);
}

load();
getStatsForPopup();

document.getElementById('openSettings').onclick = function() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
};
