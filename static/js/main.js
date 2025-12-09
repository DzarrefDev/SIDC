document.addEventListener('DOMContentLoaded', function(){
  const btnAlerts = document.getElementById('btnAlerts');
  const btnSettings = document.getElementById('btnSettings');
  const btnCapture = document.getElementById('btnCapture');
  const areaNameSpan = document.getElementById('areaName');
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toastText');
  const toastClose = document.getElementById('toastClose');

  if(btnAlerts) btnAlerts.addEventListener('click', ()=> location.href = '/alerts');
  if(btnSettings) btnSettings.addEventListener('click', ()=> location.href = '/settings');
  if(btnCapture) btnCapture.addEventListener('click', manualCapture);

  // load config for area display
  fetch('/config').then(r=>r.json()).then(cfg=>{
    if(areaNameSpan) areaNameSpan.textContent = cfg.area_name || 'LABORATORIO';
    // apply theme
    if(cfg.theme && cfg.theme==='light') document.body.classList.remove('theme-dark');
  }).catch(()=>{});

  // keep area name updated from server config
  fetch('/alerts_data').then(r=>r.json()).then(data=>{
    if(data.alerts && data.alerts.length>0){
      const a = data.alerts[0];
      if(areaNameSpan) areaNameSpan.textContent = a.area || 'LABORATORIO';
    }else{
      if(areaNameSpan) areaNameSpan.textContent = 'LABORATORIO';
    }
    populateAlertsGrid(data.alerts || []);
  });

  // Poll for new alerts every 5s and show persistent toast for new auto alerts
  let knownLatest = null;
  setInterval(()=> {
    fetch('/alerts_data').then(r=>r.json()).then(data=>{
      const alerts = data.alerts || [];
      if(alerts.length>0){
        if(!knownLatest) knownLatest = alerts[0].filename;
        if(alerts[0].filename !== knownLatest){
          // new alert
          knownLatest = alerts[0].filename;
          // show toast but persistent until user dismisses
          showToast(`Novo alerta: sem capacete em ${alerts[0].area} — ${alerts[0].time}`);
          // refresh grid
          populateAlertsGrid(alerts);
        }
      }
    });
  }, 5000);

  function showToast(msg){
    if(!toast) return;
    toastText.textContent = msg;
    toast.classList.remove('hidden');
  }
  if(toastClose) toastClose.addEventListener('click', ()=> {
    toast.classList.add('hidden');
  });

  // populate alerts grid
  window.populateAlertsGrid = function(alerts){
    const grid = document.getElementById('alertsGrid');
    const areaFilter = document.getElementById('areaFilter');
    if(!grid) return;
    grid.innerHTML = '';
    const areas = new Set();
    alerts.forEach(a=>{
      areas.add(a.area);
      const card = document.createElement('article');
      card.className = 'card alert-card';
      card.innerHTML = `
        <div class="thumb" onclick="openPreview('/static/${a.path}')">
          <img src="/static/${a.path}" alt="${a.filename}" onerror="this.src='/static/img/placeholder.png'"/>
          <div class="badge">${a.area}</div>
        </div>
        <div class="meta">
          <div class="time">${a.time}</div>
          <div class="actions">
            <button onclick="openPreview('/static/${a.path}')" class="icon">🔍</button>
            <a href="/static/${a.path}" download class="icon">⬇️</a>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
    // populate area filter
    if(areaFilter){
      areaFilter.innerHTML = '<option value="">Todas</option>';
      areas.forEach(ar=>{
        const opt = document.createElement('option');
        opt.value = ar; opt.textContent = ar;
        areaFilter.appendChild(opt);
      });
      areaFilter.addEventListener('change', ()=> {
        const val = areaFilter.value;
        const filtered = val ? alerts.filter(x=>x.area===val) : alerts;
        populateAlertsGrid(filtered);
      });
    }
  }

  window.openPreview = function(src){
    const modal = document.getElementById('previewModal');
    const img = document.getElementById('previewImg');
    const meta = document.getElementById('previewMeta');
    img.src = src;
    meta.textContent = '';
    modal.classList.add('active');
  }
  window.closePreview = function(ev){
    if(ev.target.classList.contains('modal')){
      ev.currentTarget.classList.remove('active');
    }
  }
});

function manualCapture(){
  fetch('/manual_capture',{method:'POST'}).then(r=>r.json()).then(j=>{
    if(j.saved_path){
      location.href='/alerts';
    }else if(j.error){
      alert('Erro: ' + j.error);
    }
  }).catch(e=>alert('Erro na requisição'));
}



// --- Theme toggle (instant + persisted) ---
(function(){
  const toggle = document.getElementById('themeToggle');
  const root = document.documentElement;
  const saved = localStorage.getItem('sidc_theme') || 'dark';
  function applyTheme(t){
    if(t==='light'){
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('sidc_theme', t);
  }
  applyTheme(saved);
  if(toggle){
    toggle.addEventListener('click', ()=>{
      const cur = document.body.classList.contains('light-theme') ? 'light' : 'dark';
      applyTheme(cur === 'light' ? 'dark' : 'light');
    });
  }
})();

// --- Notifications bell + sidebar ---
(function(){
  const bell = document.getElementById('notifBell');
  const countEl = document.getElementById('notifCount');
  const sidebar = document.getElementById('notifSidebar');
  const list = document.getElementById('notifList');
  const closeNotif = document.getElementById('closeNotif');
  const markAll = document.getElementById('markAllRead');

  // Load existing alerts from server file if exists (static/captures/alerts.json)
  async function loadAlerts(){
    try{
      const res = await fetch('/static/captures/alerts.json?'+Date.now());
      if(!res.ok) throw new Error('no alerts');
      const data = await res.json();
      return data.alerts || data || [];
    }catch(e){
      return [];
    }
  }

  let alerts = [];
  function updateCount(){
    const unread = alerts.filter(a=>!a.read).length;
    if(unread>0){
      countEl.textContent = unread;
      countEl.classList.remove('hidden');
    } else {
      countEl.classList.add('hidden');
    }
  }
  function renderList(){
    list.innerHTML = '';
    alerts.forEach((a, idx)=>{
      const li = document.createElement('li');
      li.className = 'notif-item' + (a.read ? ' read' : '');
      li.innerHTML = `<div class="notif-time">${a.time||''}</div><div class="notif-text">${a.text||'Alerta'}</div><div class="notif-actions"><button class="view" data-idx="${idx}">Ver</button><button class="remove" data-idx="${idx}">Remover</button></div>`;
      list.appendChild(li);
    });
  }

  function openSidebar(){
    sidebar.classList.remove('hidden');
    sidebar.setAttribute('aria-hidden','false');
    // mark visible ones? we will not auto-mark; user must click 'ver' to mark
  }
  function closeSidebar(){
    sidebar.classList.add('hidden');
    sidebar.setAttribute('aria-hidden','true');
  }

  if(bell){
    bell.addEventListener('click', async ()=>{
      if(sidebar.classList.contains('hidden')){
        // open and load alerts
        alerts = await loadAlerts();
        // ensure alerts have read flag
        alerts = alerts.map(a=>({...a, read: a.read||false}));
        renderList();
        updateCount();
        openSidebar();
      } else {
        closeSidebar();
      }
    });
  }
  if(closeNotif) closeNotif.addEventListener('click', closeSidebar);
  if(markAll) markAll.addEventListener('click', ()=>{
    alerts = alerts.map(a=>({...a, read:true}));
    renderList();
    updateCount();
  });

  // Delegate view/remove
  list.addEventListener('click', (e)=>{
    const t = e.target;
    if(!t.dataset.idx) return;
    const idx = Number(t.dataset.idx);
    if(t.classList.contains('view')){
      alerts[idx].read = true;
      // optional: show preview - here we just mark and update
      renderList(); updateCount();
    } else if(t.classList.contains('remove')){
      alerts.splice(idx,1);
      renderList(); updateCount();
    }
  });
})();

// --- Settings modal for camera names & site title ---
(function(){
  const openBtn = document.getElementById('openSettings');
  const modal = document.getElementById('settingsModal');
  const saveBtn = document.getElementById('saveSettings');
  const cancelBtn = document.getElementById('cancelSettings');
  const siteTitleInput = document.getElementById('siteTitleInput');
  const cam1Input = document.getElementById('cam1Name');
  const cam2Input = document.getElementById('cam2Name');

  function loadSettings(){
    const s = JSON.parse(localStorage.getItem('sidc_settings')||'{}');
    siteTitleInput.value = s.siteTitle || '';
    cam1Input.value = s.cam1 || 'Câmera 1';
    cam2Input.value = s.cam2 || 'Câmera 2';
    // apply
    if(s.siteTitle) document.querySelector('.brand') && (document.querySelector('.brand').textContent = s.siteTitle);
    document.querySelectorAll('.cam-title').forEach(el=>{
      const num = el.dataset.cam;
      if(num==='1') el.textContent = s.cam1 || 'Câmera 1';
      if(num==='2') el.textContent = s.cam2 || 'Câmera 2';
    });
  }
  function saveSettings(){
    const s = {siteTitle: siteTitleInput.value, cam1: cam1Input.value, cam2: cam2Input.value};
    localStorage.setItem('sidc_settings', JSON.stringify(s));
    loadSettings();
    closeModal();
  }
  function openModal(){
    modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
  }
  function closeModal(){
    modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');
  }

  if(openBtn) openBtn.addEventListener('click', ()=>{ loadSettings(); openModal(); });
  if(cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if(saveBtn) saveBtn.addEventListener('click', saveSettings);

  // On load apply saved settings
  document.addEventListener('DOMContentLoaded', loadSettings);
})();

// Hide loader when ready
window.addEventListener('load', ()=>{
  const overlay = document.getElementById('loader-overlay');
  if(overlay) overlay.classList.add('hidden');
});
