// Добавляем pulse анимацию для skeleton
(function(){
  const st = document.createElement('style');
  st.textContent = '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}';
  document.head.appendChild(st);
})();

// ── Telegram Style ────────────────────────────────────────────────
function toggleTelegramStyle(enabled) {
  if (enabled) {
    document.body.classList.add('tg-style');
    localStorage.setItem('sapp_tg_style', '1');
    if (typeof messengerUpdateBadge === 'function') messengerUpdateBadge();
    toast('✈️ Telegram Style включён');
  } else {
    document.body.classList.remove('tg-style');
    localStorage.removeItem('sapp_tg_style');
    const profileBtn = document.getElementById('nav-profile');
    const oldAva = document.getElementById('nav-profile-avatar-tg');
    if (oldAva) oldAva.remove();
    if (profileBtn) {
      const wrap = profileBtn.querySelector('.nav-icon-wrap');
      if (wrap && !wrap.querySelector('svg')) {
        wrap.innerHTML = '<svg class="nav-icon" id="nav-profile-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
      }
    }
    toast('Telegram Style выключен');
  }
}

// Восстанавливаем Telegram Style при старте
(function initTgStyle() {
  if (localStorage.getItem('sapp_tg_style') === '1') {
    document.body.classList.add('tg-style');
    function setTgToggle() {
      const toggle = document.getElementById('tg-style-toggle');
      if (toggle) toggle.checked = true;
      else setTimeout(setTgToggle, 300);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setTgToggle);
    } else {
      setTgToggle();
    }
  }
})();

// ══ Глобальные переменные — объявлены в начале во избежание TDZ ══
var _otaApkUrl = '', _otaVersion = '';
var _eggTaps = 0, _eggTimer = null, _eggLastTouch = 0, _eggBlockCards = false;
var _discoActive = false;
// ══ ПОЛИФИЛ AbortSignal.timeout ══
// AbortSignal.timeout появился в Chrome 103 (2022).
// На Android с устаревшим WebView его нет — без полифила приложение крашит.
if (typeof AbortSignal !== 'undefined' && !AbortSignal.timeout) {
  AbortSignal.timeout = function(ms) {
    var ctrl = new AbortController();
    setTimeout(function() {
      ctrl.abort(new DOMException('TimeoutError', 'TimeoutError'));
    }, ms);
    return ctrl.signal;
  };
}

// ══════════════════════════════════════════════════════════════════
// Карта падежных форм дней недели → именительный падеж
const DAY_NOMINATIVE={
  'ПОНЕДЕЛЬНИК':'ПОНЕДЕЛЬНИК','ПОНЕДЕЛЬНИКА':'ПОНЕДЕЛЬНИК','ПОНЕДЕЛЬНИКУ':'ПОНЕДЕЛЬНИК',
  'ВТОРНИК':'ВТОРНИК','ВТОРНИКА':'ВТОРНИК','ВТОРНИКУ':'ВТОРНИК',
  'СРЕДУ':'СРЕДА','СРЕДЫ':'СРЕДА','СРЕДЕ':'СРЕДА','СРЕДА':'СРЕДА',
  'ЧЕТВЕРГ':'ЧЕТВЕРГ','ЧЕТВЕРГА':'ЧЕТВЕРГ','ЧЕТВЕРГУ':'ЧЕТВЕРГ',
  'ПЯТНИЦУ':'ПЯТНИЦА','ПЯТНИЦЫ':'ПЯТНИЦА','ПЯТНИЦЕ':'ПЯТНИЦА','ПЯТНИЦА':'ПЯТНИЦА',
  'СУББОТУ':'СУББОТА','СУББОТЫ':'СУББОТА','СУББОТЕ':'СУББОТА','СУББОТА':'СУББОТА',
  'ВОСКРЕСЕНЬЕ':'ВОСКРЕСЕНЬЕ','ВОСКРЕСЕНЬЯ':'ВОСКРЕСЕНЬЕ','ВОСКРЕСЕНЬЮ':'ВОСКРЕСЕНЬЕ',
};
function formatScheduleDate(hdr){
  // Ищем в строке: ДеньНедели ДД.ММ.ГГГГ (неделя)
  const m=hdr.match(/([А-ЯЁа-яё]+)\s+(\d{2}\.\d{2}\.\d{4})\s*(\([^)]*\))?/);
  if(m){
    const dayRaw=m[1].toUpperCase();
    const day=DAY_NOMINATIVE[dayRaw]||dayRaw;
    const date=m[2];
    const week=m[3]||'';
    return [day,date,week].filter(Boolean).join(' ');
  }
  // Запасной вариант: убираем служебный префикс и мусор
  return hdr.replace('Расписание занятий на ','')
    .replace(/[^\u0401\u0410-\u044F\u0451\d\s.,()]/g,'')
    .replace(/\s{2,}/g,' ').trim();
}
// ── 🔊 ЗВУКОВАЯ СИСТЕМА (Web Audio API, синтетическая) ───────────
// ══════════════════════════════════════════════════════════════════
const SFX = (() => {
  let ctx = null;
  let muted = true; // по дефолту выключено

  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const V = 0.5;
  function tone(freq, type, attack, sustain, release, vol=0.18) {
    const c = ac(); if (!c || muted) return;
    const g = c.createGain(), o = c.createOscillator();
    o.type = type; o.frequency.value = freq;
    const v = vol * V;
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(v, c.currentTime + attack);
    g.gain.setValueAtTime(v, c.currentTime + attack + sustain);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + attack + sustain + release);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime); o.stop(c.currentTime + attack + sustain + release + 0.05);
  }
  function sweep(f0, f1, type, dur, vol=0.15) {
    const c = ac(); if (!c || muted) return;
    const g = c.createGain(), o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(f1, c.currentTime + dur * 0.85);
    const v = vol * V;
    g.gain.setValueAtTime(v, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime); o.stop(c.currentTime + dur + 0.05);
  }
  function noise(dur, vol=0.08, lpFreq=800) {
    const c = ac(); if (!c || muted) return;
    const bufSize = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
    const src = c.createBufferSource(); src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = lpFreq;
    const g = c.createGain();
    const v = vol * V;
    g.gain.setValueAtTime(v, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(filt); filt.connect(g); g.connect(c.destination);
    src.start(); src.stop(c.currentTime + dur + 0.05);
  }
  const after = (fn, ms) => setTimeout(fn, ms);

  const sounds = {
    // Навигация — мягкие, низкие, тёплые
    navHome()     { tone(220,'sine',.03,.06,.28,.10); after(()=>tone(330,'sine',.03,.04,.22,.06),80); },
    navBells()    { tone(440,'sine',.02,.06,.38,.09); after(()=>tone(660,'sine',.02,.03,.28,.05),70); },
    navSettings() { tone(180,'triangle',.03,.05,.22,.08); after(()=>tone(240,'triangle',.03,.03,.18,.05),90); },
    screenPush()  { sweep(200,300,'sine',.14,.08); },
    screenBack()  { sweep(300,180,'sine',.12,.08); },
    themeSelect() { [330,415,494].forEach((f,i)=>after(()=>tone(f,'sine',.02,.06,.26,.07),i*70)); },
    // Кнопки — почти неслышные тихие касания
    btnClick()    { noise(.025,.018,500); tone(280,'sine',.008,.01,.10,.03); },
    btnAccent()   { sweep(220,360,'sine',.15,.08); },
    keyTap()      { noise(.015,.012,400); },
    // Тост / статус
    toastShow()   { tone(440,'sine',.015,.04,.24,.07); after(()=>tone(550,'sine',.015,.02,.18,.04),90); },
    success()     { [330,415,494,660].forEach((f,i)=>after(()=>tone(f,'sine',.02,.06,.28,.06),i*80)); },
    error()       { tone(160,'triangle',.02,.10,.22,.08); after(()=>tone(130,'triangle',.02,.08,.22,.07),140); },
    // Пасхалка / игры
    eggOpen()     { [196,247,294,370,494].forEach((f,i)=>after(()=>tone(f,'sine',.02,.06,.30,.06),i*70)); },
    gameSelect()  { sweep(280,420,'sine',.12,.08); },
    // ── Змейка ──
    snakeEat()    { tone(440,'sine',.01,.03,.14,.07); after(()=>tone(550,'sine',.01,.02,.10,.04),60); },
    snakeDie()    { sweep(300,80,'sine',.42,.09); after(()=>noise(.20,.04,350),120); },
    snakeTurn()   { noise(.018,.014,600); },
    // ── Крестики-нолики ──
    tttPlace()    { tone(360,'sine',.01,.03,.18,.06); },
    tttWin()      { [330,415,494,660,830].forEach((f,i)=>after(()=>tone(f,'sine',.02,.06,.28,.07),i*90)); },
    tttLose()     { sweep(280,120,'sine',.52,.09); },
    tttDraw()     { tone(330,'sine',.02,.18,.28,.06); },
    // ── Пинг-понг ──
    pongHit()     { noise(.018,.04,800); tone(440,'sine',.005,.01,.08,.04); },
    pongWall()    { noise(.014,.03,600); },
    pongScore()   { sweep(240,420,'sine',.18,.08); },
    pongLose()    { sweep(360,100,'sine',.36,.09); },
    // ── Тетрис ──
    tetMove()     { noise(.014,.022,700); },
    tetRotate()   { tone(330,'sine',.01,.02,.12,.05); },
    tetLine()     { [294,370,440,587].forEach((f,i)=>after(()=>tone(f,'sine',.01,.05,.20,.07),i*55)); },
    tetDrop()     { noise(.040,.05,500); tone(120,'sine',.01,.04,.16,.07); },
    tetGameOver() { [330,277,233,196].forEach((f,i)=>after(()=>tone(f,'triangle',.02,.10,.28,.08),i*110)); },
    // ── Дино ──
    dinoJump()    { sweep(220,380,'sine',.15,.07); },
    dinoCactus()  { noise(.050,.06,450); tone(140,'triangle',.01,.06,.18,.07); },
    dinoScore()   { tone(550,'sine',.008,.01,.12,.05); },
    // ── Block Blast ──
    bbPlace()     { tone(280,'sine',.01,.03,.14,.06); },
    bbLine()      { [330,415,494].forEach((f,i)=>after(()=>tone(f,'sine',.01,.06,.22,.07),i*60)); },
    bbGameOver()  { sweep(240,80,'sine',.50,.09); },
    // ── Арканоид ──
    brBrick()     { noise(.020,.05,1000); tone(440,'sine',.004,.01,.09,.04); },
    brWall()      { noise(.016,.035,700); },
    brPaddle()    { noise(.020,.04,800); tone(360,'sine',.005,.01,.08,.04); },
    brLive()      { sweep(420,160,'sine',.32,.09); },
    brLevelUp()   { [294,370,440,587].forEach((f,i)=>after(()=>tone(f,'sine',.02,.06,.26,.07),i*65)); },
    // ── Пузыри ──
    bubPop() {
      const c = ac(); if (!c || muted) return;
      // Слоёный поп: основной «влажный» щелчок + призвук
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      const bf = 180 + Math.random() * 120;
      o.frequency.setValueAtTime(bf * 2.2, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(bf * 0.35, c.currentTime + 0.10);
      const v = 0.13 * V;
      g.gain.setValueAtTime(v, c.currentTime);
      g.gain.linearRampToValueAtTime(v * 1.1, c.currentTime + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.22);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.26);
      // Шлепок воздуха
      noise(0.035, 0.05, 320);
    },
    bubMiss()     { sweep(140, 80, 'sine', 0.28, 0.07); after(() => noise(0.04, 0.03, 250), 60); },
    bubCombo()    { [280, 350, 470].forEach((f,i) => after(() => tone(f, 'sine', 0.02, 0.05, 0.22, 0.07), i*55)); },
    // ── Мессенджер ──
    msgSend() {
      // Telegram-style: тихий мягкий "свуш" + короткий пинг
      sweep(400, 800, 'sine', 0.10, 0.055);
      after(() => tone(880, 'sine', 0.008, 0.01, 0.12, 0.035), 80);
    },
    msgReceive() { tone(660, 'sine', 0.01, 0.02, 0.18, 0.04); },
  };


  // ── Звуки из папки sounds/ — ОСНОВНОЙ источник для всех SFX ─────
  // На Android используем https://sounds.local/ (перехватывается Java из assets)
  // На вебе — относительный путь sounds/
  const _SOUNDS_BASE = window.Android ? 'https://sounds.local/' : 'sounds/';
  const _extBuffers = {};

  async function _loadExtSound(name, file) {
    try {
      const ctx = ac();
      if (!ctx) return;
      const resp = await fetch(_SOUNDS_BASE + file);
      if (!resp.ok) return;
      const ab = await resp.arrayBuffer();
      const buf = await new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej));
      _extBuffers[name] = buf;
    } catch(e) {}
  }

  function _playExt(name, vol) {
    const ctx = ac();
    if (!ctx || muted || !_extBuffers[name]) return false;
    const src = ctx.createBufferSource();
    src.buffer = _extBuffers[name];
    const g = ctx.createGain();
    g.gain.value = vol !== undefined ? vol : 0.75;
    src.connect(g); g.connect(ctx.destination);
    src.start();
    return true;
  }

  // ── Маппинг: имя звука → файл в папке sounds/ ──────────────────
  // Группы: несколько имён SFX → один файл
  const _soundFiles = {
    // Мессенджер
    msgSend:      'msg_send.ogg',
    msgReceive:   'msg_receive.ogg',
    // UI
    btnClick:     'btn_click.ogg',
    btnAccent:    'btn_click.ogg',
    keyTap:       'btn_click.ogg',
    // Навигация
    navHome:      'nav_screen.ogg',
    navBells:     'nav_screen.ogg',
    navSettings:  'nav_screen.ogg',
    screenPush:   'nav_screen.ogg',
    screenBack:   'nav_screen.ogg',
    // Статусы
    toastShow:    'toast.ogg',
    success:      'success.ogg',
    error:        'error.ogg',
    // Темы
    themeSelect:  'theme_select.ogg',
    // Игры — общее
    eggOpen:      'game_start.ogg',
    gameSelect:   'game_start.ogg',
    // Конец игры
    tetGameOver:  'game_over.ogg',
    snakeDie:     'game_over.ogg',
    pongLose:     'game_over.ogg',
    bbGameOver:   'game_over.ogg',
    brLive:       'game_over.ogg',
    dinoCactus:   'game_over.ogg',
    dinoJump:     'nav_screen.ogg',
    // Змейка
    snakeEat:     'snake_eat.ogg',
    snakeTurn:    'btn_click.ogg',
    // Тетрис
    tetLine:      'tetris_line.ogg',
    tetMove:      'btn_click.ogg',
    tetRotate:    'btn_click.ogg',
    tetDrop:      'btn_click.ogg',
    brLevelUp:    'success.ogg',
    // Пинг-понг
    pongHit:      'pong_hit.ogg',
    pongWall:     'pong_hit.ogg',
    pongScore:    'success.ogg',
    // Пузыри
    bubPop:       'bubble_pop.ogg',
    bubMiss:      'error.ogg',
    bubCombo:     'success.ogg',
    // Скример — только звук (изображение отдельно)
    screamer:     'screamer.ogg',
    // Прочее
    dinoScore:    'btn_click.ogg',
    bbPlace:      'btn_click.ogg',
    bbLine:       'tetris_line.ogg',
    brBrick:      'pong_hit.ogg',
    brWall:       'pong_hit.ogg',
    brPaddle:     'pong_hit.ogg',
    tttPlace:     'btn_click.ogg',
    tttWin:       'success.ogg',
    tttLose:      'game_over.ogg',
    tttDraw:      'toast.ogg',
  };

  let _soundsLoaded = false;
  function _loadAllSounds() {
    if (_soundsLoaded) return;
    _soundsLoaded = true;
    // Загружаем уникальные файлы
    const uniqueFiles = [...new Set(Object.values(_soundFiles))];
    // Строим обратный маппинг файл→имена
    const fileToNames = {};
    Object.entries(_soundFiles).forEach(([name, file]) => {
      if (!fileToNames[file]) fileToNames[file] = [];
      fileToNames[file].push(name);
    });
    uniqueFiles.forEach(file => {
      _loadExtSound('__file__' + file, file).then(() => {
        // Когда файл загружен — копируем буфер для всех имён которые его используют
        if (_extBuffers['__file__' + file]) {
          (fileToNames[file] || []).forEach(name => {
            _extBuffers[name] = _extBuffers['__file__' + file];
          });
        }
      }).catch(() => {});
    });
  }

  return {
    play(name, vol) {
      try {
        // Внешний звук из папки sounds/ — приоритет
        if (_extBuffers[name] && _playExt(name, vol)) return;
        // Fallback: процедурный звук
        if (sounds[name]) sounds[name]();
      } catch(e){}
    },
    toggle()   { muted = !muted; return muted; },
    isMuted()  { return muted; },
    init()     { ac(); },
    loadSounds() { _loadAllSounds(); }
  };
})();

// Разблокировать AudioContext при первом жесте
document.addEventListener('click',      () => { SFX.init(); SFX.loadSounds(); }, {once:true});
document.addEventListener('touchstart', () => { SFX.init(); SFX.loadSounds(); }, {once:true});

// ── Глобальный btnClick на все кнопки без явного SFX ────────────
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('button,a,[role=button],.btn,.nav-item,.hdr-back,.list-item,.theme-card,.egg-card,.diff-btn,.dpad-btn,.ttt-cell,.dino-ctrl-btn');
  if (!el) return;
  const hasExplicit = el.onclick && ('' + el.onclick).includes('SFX.play');
  if (!hasExplicit) SFX.play('btnClick');
  if (e.target.matches('input,textarea')) SFX.play('keyTap');
});

// ── Переключение на нативный Kotlin/Compose интерфейс ────────────────────────
function switchToNativeUI() {
  if (window.Android && typeof window.Android.switchToNativeUI === 'function') {
    // Показываем диалог подтверждения
    const sheet = document.createElement('div');
    sheet.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:20px;animation:mcFadeIn .15s ease';
    sheet.innerHTML = `
      <div style="background:var(--surface);border-radius:20px;padding:24px 20px;width:100%;max-width:340px;box-shadow:0 8px 40px rgba(0,0,0,.7)" onclick="event.stopPropagation()">
        <div style="font-size:38px;text-align:center;margin-bottom:12px">🚀</div>
        <div style="font-size:17px;font-weight:700;text-align:center;margin-bottom:6px">Нативный интерфейс</div>
        <div style="font-size:13px;color:var(--muted);text-align:center;margin-bottom:20px;line-height:1.5">
          Приложение перезапустится в режиме<br><b style="color:var(--text)">Kotlin / Jetpack Compose</b>.<br>
          Плавнее, быстрее, без провисаний.<br><br>
          <span style="font-size:11px">Вернуться можно в Настройках нового интерфейса.</span>
        </div>
        <div style="display:flex;gap:10px">
          <button onclick="this.closest('[style*=fixed]').remove()"
            style="flex:1;padding:12px;background:var(--surface2);border:1.5px solid var(--surface3);border-radius:12px;color:var(--text);font-family:inherit;font-size:15px;cursor:pointer">
            Отмена
          </button>
          <button onclick="this.closest('[style*=fixed]').remove();window.Android.switchToNativeUI()"
            style="flex:1;padding:12px;background:var(--accent);border:none;border-radius:12px;color:#000;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer">
            Включить →
          </button>
        </div>
      </div>`;
    sheet.addEventListener('click', () => sheet.remove());
    document.body.appendChild(sheet);
  } else {
    toast('⚠️ Нативный интерфейс недоступен');
  }
}

function toggleMute(){
  const m = SFX.toggle();
  const lbl = document.getElementById('mute-label');
  if (lbl) lbl.textContent = m ? '🔇 Звук выключен' : '🔊 Звук включён';
  if (!m) SFX.play('btnClick');
}
function updateMuteLabel(){
  const el = document.getElementById('mute-label');
  if (el) el.textContent = SFX.isMuted() ? '🔇 Звук выключен' : '🔊 Звук включён';
}

// ══ RIPPLE ══
document.addEventListener('click',function(e){
  const el=e.target.closest('.btn,.hdr-back,.last-group-btn,.nav-item,.theme-card,.list-item,.dns-card,.dpi-item,.theme-card');
  if(!el)return;
  const r=document.createElement('span');
  r.className='ripple';
  const rect=el.getBoundingClientRect();
  const size=Math.max(rect.width,rect.height)*2;
  r.style.cssText=`width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
  el.appendChild(r);
  setTimeout(()=>r.remove(),560);
});

// ══ ТЕМЫ ══
const THEMES={
  'orange': {name:'Колледж',  ico:'🟠', vars:{'--bg':'#0d0d0d','--surface':'#161616','--surface2':'#1f1f1f','--surface3':'#2a2a2a','--accent':'#e87722','--accent2':'#c45f0a','--text':'#f0ede8','--muted':'#6b6762','--btn-text':'#fff'},sw:['#0d0d0d','#e87722','#c45f0a']},
  'amoled': {name:'AMOLED',   ico:'⚫', vars:{'--bg':'#000','--surface':'#080808','--surface2':'#111','--surface3':'#1a1a1a','--accent':'#00e5ff','--accent2':'#00acc1','--text':'#fff','--muted':'#505050','--btn-text':'#000'},sw:['#000','#00e5ff','#00acc1']},
  'win11':  {name:'Win 11',   ico:'🔵', vars:{'--bg':'#1a1a1a','--surface':'#222','--surface2':'#2d2d2d','--surface3':'#383838','--accent':'#60cdff','--accent2':'#0067c0','--text':'#fff','--muted':'#888','--btn-text':'#000'},sw:['#1a1a1a','#60cdff','#0067c0']},
  'pixel':  {name:'Material', ico:'🟣', vars:{'--bg':'#191c1e','--surface':'#22272a','--surface2':'#2c3237','--surface3':'#373d44','--accent':'#7fcfff','--accent2':'#2f71d4','--text':'#e3e5e8','--muted':'#8e9099','--btn-text':'#000'},sw:['#191c1e','#7fcfff','#2f71d4']},
  'aero':   {name:'Aero',     ico:'💎', vars:{'--bg':'#152030','--surface':'#1a2d44','--surface2':'#1f3755','--surface3':'#274466','--accent':'#7fd7ff','--accent2':'#00a8e8','--text':'#e8f4ff','--muted':'#7a9ab8','--btn-text':'#000'},sw:['#152030','#7fd7ff','#00a8e8']},
  'forest': {name:'Лес',      ico:'🌿', vars:{'--bg':'#0b1a10','--surface':'#111f15','--surface2':'#182a1d','--surface3':'#213627','--accent':'#4caf7d','--accent2':'#2d8653','--text':'#e0f0e8','--muted':'#6a9076','--btn-text':'#fff'},sw:['#0b1a10','#4caf7d','#2d8653']},
  'rose':   {name:'Розовый',  ico:'🌸', vars:{'--bg':'#1a0d12','--surface':'#24111a','--surface2':'#2e1622','--surface3':'#3a1e2d','--accent':'#f472b6','--accent2':'#db2777','--text':'#fce7f3','--muted':'#9d6b80','--btn-text':'#fff'},sw:['#1a0d12','#f472b6','#db2777']},
  'gold':   {name:'Золото',   ico:'✨', vars:{'--bg':'#100e00','--surface':'#1a1700','--surface2':'#222000','--surface3':'#2e2a00','--accent':'#f5c518','--accent2':'#c9a000','--text':'#fff9e6','--muted':'#7a7050','--btn-text':'#000'},sw:['#100e00','#f5c518','#c9a000']},
  'purple': {name:'Фиолет',   ico:'🫐', vars:{'--bg':'#0e0b1a','--surface':'#151025','--surface2':'#1c1630','--surface3':'#251e3d','--accent':'#a78bfa','--accent2':'#7c3aed','--text':'#ede9fe','--muted':'#7060a0','--btn-text':'#fff'},sw:['#0e0b1a','#a78bfa','#7c3aed']},
  'sunset': {name:'Закат',    ico:'🌅', vars:{'--bg':'#0f0a00','--surface':'#1a1000','--surface2':'#241800','--surface3':'#302200','--accent':'#ff6b35','--accent2':'#c94a10','--text':'#fff3ee','--muted':'#7a5040','--btn-text':'#fff'},sw:['#0f0a00','#ff6b35','#c94a10']},
  'bw':     {name:'Ч/Б',      ico:'⬜', vars:{'--bg':'#000','--surface':'#111','--surface2':'#1c1c1c','--surface3':'#2a2a2a','--accent':'#ffffff','--accent2':'#cccccc','--text':'#ffffff','--muted':'#666666','--btn-text':'#000'},sw:['#000','#fff','#888']},
  'glass':  {name:'Liquid Glass', ico:'🫧', vars:{'--bg':'#0a0f1e','--surface':'rgba(255,255,255,0.07)','--surface2':'rgba(255,255,255,0.11)','--surface3':'rgba(255,255,255,0.18)','--accent':'#a0c4ff','--accent2':'#7b9fff','--text':'#f0f4ff','--muted':'rgba(180,190,220,0.7)','--btn-text':'#000'},sw:['#0a0f1e','#a0c4ff','#7b9fff']},
  'light':  {name:'Светлая',  ico:'☀️', vars:{'--bg':'#f4f4f4','--surface':'#fff','--surface2':'#ebebeb','--surface3':'#d8d8d8','--accent':'#e87722','--accent2':'#c45f0a','--text':'#111','--muted':'#888','--btn-text':'#fff'},sw:['#f4f4f4','#e87722','#c45f0a']},
  'candy':  {name:'Candy',    ico:'🍬', vars:{'--bg':'#0d0018','--surface':'#150024','--surface2':'#1e0033','--surface3':'#2a0044','--accent':'#ff88cc','--accent2':'#dd44aa','--text':'#ffe0f8','--muted':'#8855aa','--btn-text':'#000'},sw:['#0d0018','#ff88cc','#dd44aa']},
  'ocean':  {name:'Океан',    ico:'🌊', vars:{'--bg':'#000d1a','--surface':'#001628','--surface2':'#002038','--surface3':'#002d4f','--accent':'#00c8ff','--accent2':'#0099cc','--text':'#d0f4ff','--muted':'#446677','--btn-text':'#000'},sw:['#000d1a','#00c8ff','#0099cc']},
  'samek':  {name:'Самек',    ico:'🔥', vars:{'--bg':'#120008','--surface':'#1e0010','--surface2':'#2a001a','--surface3':'#380024','--accent':'#ff3366','--accent2':'#cc0044','--text':'#ffe0e8','--muted':'#882244','--btn-text':'#fff'},sw:['#120008','#ff3366','#cc0044']},
};

// ══ DNS провайдеры ══
const DNS_PROVIDERS={
  'system': {name:'Системный',  addr:'по умолчанию', ico:'🌐', doh:''},
  'cf':     {name:'Cloudflare', addr:'1.1.1.1',       ico:'🟠', doh:'https://1.1.1.1/dns-query'},
  'google': {name:'Google',     addr:'8.8.8.8',       ico:'🔵', doh:'https://8.8.8.8/dns-query'},
  'adguard':{name:'AdGuard',    addr:'94.140.14.14',  ico:'🟢', doh:'https://dns.adguard.com/dns-query'},
  'yandex': {name:'Яндекс',     addr:'77.88.8.8',     ico:'🔴', doh:'https://common.dot.dns.yandex.net/dns-query'},
  'custom': {name:'Свой...',    addr:'DoH URL',       ico:'⚙️', doh:'custom'},
};

// ══ ПРОКСИ провайдеры ══
// format:
//   'append_encoded' → proxy_url + encodeURIComponent(target)
//   'append_raw'     → proxy_url + target (URL не кодируется)
//   'query_url'      → proxy_url + encodeURIComponent(target) (то же что append_encoded, другой ключ)
const PROXY_PROVIDERS = {
  'allorigins': {
    name: 'AllOrigins',
    addr: 'api.allorigins.win',
    ico: '🔓',
    tag: 'tag-free',
    tagText: 'бесплатно',
    desc: 'Стабильный публичный прокси. Бинарные файлы через base64.',
    url: 'https://api.allorigins.win/raw?url=',
    format: 'query_url',
  },
  'corsproxy': {
    name: 'corsproxy.io',
    addr: 'corsproxy.io',
    ico: '🌐',
    tag: 'tag-free',
    tagText: 'бесплатно',
    desc: 'Быстрый. Может требовать ожидания при лимите.',
    url: 'https://corsproxy.io/?url=',
    format: 'query_url',
  },
  'codetabs': {
    name: 'CodeTabs',
    addr: 'api.codetabs.com',
    ico: '📦',
    tag: 'tag-free',
    tagText: 'бесплатно',
    desc: 'Без авторизации, поддерживает бинарные файлы.',
    url: 'https://api.codetabs.com/v1/proxy?quest=',
    format: 'append_raw',
  },
  'thingproxy': {
    name: 'ThingProxy',
    addr: 'thingproxy.freeboard.io',
    ico: '🔁',
    tag: 'tag-free',
    tagText: 'бесплатно',
    desc: 'Простой CORS-прокси без ограничений по типу.',
    url: 'https://thingproxy.freeboard.io/fetch/',
    format: 'append_raw',
  },
  'corsanywhere': {
    name: 'CORS Anywhere',
    addr: 'cors-anywhere.herokuapp.com',
    ico: '🌍',
    tag: 'tag-limit',
    tagText: 'нужен запрос',
    desc: 'Нужно открыть сайт и нажать Request Access.',
    url: 'https://cors-anywhere.herokuapp.com/',
    format: 'append_raw',
  },
  'cf_worker': {
    name: 'Cloudflare Worker',
    addr: 'your-proxy.workers.dev',
    ico: '☁️',
    tag: 'tag-own',
    tagText: 'свой',
    desc: 'Самый надёжный. Деплой за 5 мин, 100k/день бесплатно.',
    url: '',
    format: 'append_encoded',
  },
  'custom': {
    name: 'Свой URL',
    addr: 'любой адрес',
    ico: '⚙️',
    tag: 'tag-own',
    tagText: 'свой',
    desc: 'Введи адрес своего прокси вручную.',
    url: '',
    format: 'append_encoded',
  },
};

// ══ DPI стратегии (на основе ByeByeDPI) ══
// cmd — аргументы для ciadpi, передаются в DnsVpnService
// {sni} заменяется на www.iana.org
const DPI_STRATEGIES = [
  {id:'auto',       badge:'AUTO',   name:'Авто (рекомендуется)', cmd:'-Ku -a1 -An -o1 -At,r,s -d1',
    desc:'Базовые настройки ByeByeDPI. Попробуй первым.'},
  {id:'preset1',    badge:'P-1',    name:'Preset 1 — multisplit',
    cmd:'-f-200 -Qr -s3:5+sm -a1 -As -d1 -s4+sm -s8+sh -f-300 -d6+sh -a1 -At,r,s -o2 -f-30 -As -r5 -Mh -r6+sh -f-250 -s2:7+s -s3:6+sm -a1 -At,r,s -s3:5+sm -s6+s -s7:9+s -q30+sm -a1',
    desc:'Многосегментное разделение. Хорош для многих провайдеров.'},
  {id:'preset2',    badge:'P-2',    name:'Preset 2 — disorder split',
    cmd:'-d1 -d3+s -s6+s -d9+s -s12+s -d15+s -s20+s -d25+s -s30+s -d35+s -r1+s -S -a1 -As -d1 -d3+s -s6+s -d9+s -s12+s -d15+s -s20+s -d25+s -s30+s -d35+s -S -a1',
    desc:'Чередование disorder и split по позициям.'},
  {id:'preset3',    badge:'P-3',    name:'Preset 3 — OOB + mixedcase',
    cmd:'-q2 -s2 -s3+s -r3 -s4 -r4 -s5+s -r5+s -s6 -s7+s -r8 -s9+s -Qr -Mh,d,r -a1 -At,r -s2+s -r2 -d2 -s3 -r3 -r4 -s4 -d5+s -r5 -d6 -s7+s -d7 -a1',
    desc:'OOB с перемешиванием регистра и разделением.'},
  {id:'preset4',    badge:'P-4',    name:'Preset 4 — S+disorder combo',
    cmd:'-o1 -d1 -a1 -At,r,s -s1 -d1 -s5+s -s10+s -s15+s -s20+s -r1+s -S -a1 -As -s1 -d1 -s5+s -s10+s -s15+s -s20+s -S -a1',
    desc:'Комбинация OOB и disorder со множеством позиций.'},
  {id:'preset5',    badge:'P-5',    name:'Preset 5 — Fake TLS + split',
    cmd:'-n www.iana.org -Qr -f-204 -s1:5+sm -a1 -As -d1 -s3+s -s5+s -q7 -a1 -As -o2 -f-43 -a1 -As -r5 -Mh -s1:5+s -s3:7+sm -a1',
    desc:'Поддельный TLS пакет + многосегментное разделение.'},
  {id:'preset6',    badge:'P-6',    name:'Preset 6 — Fake TLS variant',
    cmd:'-n www.iana.org -Qr -f-205 -a1 -As -s1:3+sm -a1 -As -s5:8+sm -a1 -As -d3 -q7 -o2 -f-43 -f-85 -f-165 -r5 -Mh -a1',
    desc:'Другой вариант fake TLS с разными смещениями.'},
  {id:'preset7',    badge:'P-7',    name:'Preset 7 — big split+fake',
    cmd:'-d1+s -s50+s -a1 -As -f20 -r2+s -a1 -At -d2 -s1+s -s5+s -s10+s -s15+s -s25+s -s35+s -s50+s -s60+s -a1',
    desc:'Крупные сегменты разделения + fake пакеты.'},
  {id:'preset8',    badge:'P-8',    name:'Preset 8 — SNI fake + S chain',
    cmd:'-o1 -a1 -At,r,s -f-1 -a1 -At,r,s -d1:11+sm -S -a1 -At,r,s -n www.iana.org -Qr -f1 -d1:11+sm -s1:11+sm -S -a1',
    desc:'Цепочка SNI-fake и многосегментного S.'},
  {id:'preset9',    badge:'P-9',    name:'Preset 9 — SACK drop',
    cmd:'-d1 -s1 -q1 -Y -a1 -Ar -s5 -o1+s -d3+s -s6+s -d9+s -s12+s -d15+s -s20+s -d25+s -s30+s -d35+s -a1',
    desc:'Отключение SACK + disorder по всем позициям.'},
  {id:'preset10',   badge:'P-10',   name:'Preset 10 — Fake+TLSrec+Mh',
    cmd:'-f1+nme -t6 -a1 -As -n www.iana.org -Qr -s1:6+sm -a1 -As -s5:12+sm -a1 -As -d3 -q7 -r6 -Mh -a1',
    desc:'Fake с TLS-record split и смешанным регистром.'},
  {id:'preset11',   badge:'P-11',   name:'Preset 11 — OOB SACK chain A',
    cmd:'-s1 -o1 -a1 -Y -Ar -s5 -o1+s -a1 -At -f-1 -r1+s -a1 -As -s1 -o1+s -s-1 -a1',
    desc:'Цепочка OOB с SACK drop.'},
  {id:'preset12',   badge:'P-12',   name:'Preset 12 — OOB SACK chain B',
    cmd:'-s1 -d1 -a1 -Y -Ar -d5 -o1+s -a1 -At -f-1 -r1+s -a1 -As -d1 -o1+s -s-1 -a1',
    desc:'Вариант цепочки OOB+SACK с disorder.'},
  {id:'preset13',   badge:'P-13',   name:'Preset 13 — light disorder',
    cmd:'-d1 -s1+s -d3+s -s6+s -d9+s -s12+s -d15+s -s20+s -d25+s -s30+s -d35+s -a1',
    desc:'Лёгкий disorder по нарастающим позициям.'},
  {id:'preset14',   badge:'P-14',   name:'Preset 14 — minimal OOB',
    cmd:'-s1 -q1 -a1 -Y -Ar -a1 -s5 -o2 -At -f-1 -r1+s -a1 -As -s1 -o1+s -s-1 -a1',
    desc:'Минимальный OOB с SACK drop.'},
  {id:'preset19',   badge:'P-19',   name:'Preset 19 — triple OOB',
    cmd:'-o1 -a1 -At,r,s -f-1 -a1 -Ar,s -o1 -a1 -At -r1+s -f-1 -t6 -a1',
    desc:'Тройная цепочка OOB разными методами.'},
  {id:'split_basic',badge:'SPLIT',  name:'Split — базовый',
    cmd:'-s1 -a1 -An',
    desc:'Простое разделение первого байта TLS ClientHello.'},
  {id:'disorder',   badge:'DIS',    name:'Disorder — базовый',
    cmd:'-d1 -a1 -An',
    desc:'Disorder первого байта TLS.'},
  {id:'fake',       badge:'FAKE',   name:'Fake — базовый',
    cmd:'-f-1 -t5 -n www.iana.org -a1 -An',
    desc:'Поддельный TLS пакет с фиктивным SNI.'},
  {id:'oob',        badge:'OOB',    name:'OOB — базовый',
    cmd:'-o1 -a1 -An',
    desc:'Out-of-band данные в первой позиции.'},
  {id:'disoob',     badge:'DOOB',   name:'DisOOB — базовый',
    cmd:'-q1 -a1 -An',
    desc:'Комбинация disorder+OOB.'},
];
// ══ ЗВОНКИ ══
const BELL_MON={'I':['09:00','09:45','09:50','10:35'],'II':['10:45','11:30','11:35','12:20'],'III':['12:50','13:35','13:40','14:25'],'IV':['14:35','15:35',null,null],'V':['15:45','16:45',null,null],'VI':['16:55','17:55',null,null]};
const BELL_TUE={'I':['08:30','09:15','09:20','10:05'],'II':['10:15','11:00','11:05','11:50'],'III':['12:20','13:05','13:10','13:55'],'IV':['14:05','15:05',null,null],'V':['15:15','16:15',null,null],'VI':['16:25','17:25',null,null]};
const BELL_SAT={'I':['08:30','09:30',null,null],'II':['09:40','10:40',null,null],'III':['10:50','11:50',null,null],'IV':['12:00','13:00',null,null],'V':['13:10','14:10',null,null],'VI':['14:20','15:20',null,null]};

// ══ OLE2 ПАРСЕР ══
function u32(buf,off){return new DataView(buf instanceof Uint8Array?buf.buffer:buf,buf instanceof Uint8Array?buf.byteOffset:0).getUint32(off,true)}
function u16(buf,off){return new DataView(buf instanceof Uint8Array?buf.buffer:buf,buf instanceof Uint8Array?buf.byteOffset:0).getUint16(off,true)}
function ole2Text(ab){
  const sig=[0xD0,0xCF,0x11,0xE0,0xA1,0xB1,0x1A,0xE1];
  if(ab.byteLength<512)return'';
  const arr=new Uint8Array(ab);
  for(let i=0;i<8;i++)if(arr[i]!==sig[i])return'';
  const ss=Math.pow(2,u16(ab,30));
  const difat=[];
  for(let i=0;i<Math.min(109,u32(ab,44));i++){const v=u32(ab,76+i*4);if(v>=0xFFFFFFFC)break;difat.push(v);}
  const fat=[];
  for(const sn of difat){const off=512+sn*ss;for(let i=0;i<ss/4;i++){const p=off+i*4;if(p+4<=ab.byteLength)fat.push(u32(ab,p));}}
  function rd(sec,maxSz){
    const chunks=[];let total=0;const vis=new Set();
    while(sec!==0xFFFFFFFE&&sec!==0xFFFFFFFF&&!vis.has(sec)){
      vis.add(sec);const off=512+sec*ss;if(off>=ab.byteLength)break;
      const len=Math.min(ss,ab.byteLength-off);chunks.push(new Uint8Array(ab,off,len));total+=len;
      if(maxSz&&total>=maxSz)break;if(sec>=fat.length)break;sec=fat[sec];
    }
    const out=new Uint8Array(maxSz?Math.min(total,maxSz):total);let pos=0;
    for(const c of chunks){const take=Math.min(c.length,out.length-pos);out.set(c.slice(0,take),pos);pos+=take;if(pos>=out.length)break;}
    return out;
  }
  const dd=rd(u32(ab,48));
  let ws=0,wz=0;
  for(let i=0;i<Math.floor(dd.length/128);i++){
    const e=dd.slice(i*128,(i+1)*128);if(e.length<128)break;
    const nl=e[64]|e[65]<<8;
    const nm=nl>=2?new TextDecoder('utf-16le').decode(e.slice(0,nl-2)):'';
    if(nm==='WordDocument'){const dv=new DataView(dd.buffer,dd.byteOffset+i*128);ws=dv.getUint32(116,true);wz=dv.getUint32(120,true);break;}
  }
  if(!wz)return'';
  const wsd=rd(ws,wz);if(wsd.length<32)return'';
  const dv=new DataView(wsd.buffer,wsd.byteOffset);
  const fc=dv.getUint32(24,true),cc=dv.getUint32(28,true);
  if(fc>=wsd.length)return'';
  return new TextDecoder('utf-16le').decode(wsd.slice(fc,fc+cc*2));
}
function getCells(ab){
  const t=ole2Text(ab);
  if(!t)return[];
  return t.split('\x07').map(c=>{
    // Фильтруем бинарный мусор: оставляем только читаемые символы
    // Строгий белый список: ASCII-printable + только стандартный русский алфавит (А-Я а-я Ёё)
    // Это исключает мусорные расширенные кириллические символы (Ђ U+0402, Ѐ U+0400 и т.п.)
    const clean = c
      .replace(/\r/g,'\n')
      .replace(/[^\x09\x0A\x20-\x7E\u0401\u0410-\u044F\u0451«»№]/g,'')
      // Убираем строки где >60% символов — нечитаемые (бинарный мусор)
      .split('\n')
      .map(line => {
        if (!line.trim()) return line;
        const readable = (line.match(/[\u0401\u0410-\u044F\u0451A-Za-z\u0030-\u0039\s.,;:!?\-+=%()«»"'№]/g) || []).length;
        const ratio = readable / line.length;
        return ratio > 0.35 || line.length < 5 ? line : '';
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return clean;
  });
}
const GRP=/^[А-ЯЁA-Z0-9]{1,5}[\-]?\d[\-]\d{2}$/u;
const GRP_SEARCH=/\b([А-ЯЁA-Z0-9]{1,5}[\-]?\d[\-]\d{2})\b/gu;
const ROM=/^(I{1,3}V?|VI{0,3}|IV)$/;
const HDR=/Расписание занятий/i;
function norm(s){return s.trim().toUpperCase().replace(/[\s\-\.]/g,'')}
function detectGroups(ab){
  const seen={};
  for(const c of getCells(ab)){
    const t=c.trim();
    // Сначала проверяем точное совпадение
    if(GRP.test(t)){const k=norm(t);if(!seen[k])seen[k]=t;continue;}
    // Проверяем первую строку ячейки
    const singleLine=t.split('\n')[0].trim();
    if(GRP.test(singleLine)){const k=norm(singleLine);if(!seen[k])seen[k]=singleLine;continue;}
    // Поиск шаблона группы внутри текста ячейки
    GRP_SEARCH.lastIndex=0;
    let m;
    while((m=GRP_SEARCH.exec(t))!==null){const k=norm(m[1]);if(!seen[k])seen[k]=m[1];}
  }
  return Object.values(seen).sort();
}
function parseDoc(ab,group){
  const cells=getCells(ab),tn=norm(group),labels=[];
  cells.forEach((c,i)=>{if(HDR.test(c))labels.push(i);});
  if(!labels.length)return{sched:[],hdr:''};
  labels.push(cells.length);
  for(let bi=0;bi<labels.length-1;bi++){
    let li=labels[bi],nx=labels[bi+1],gs=li+1;
    while(gs<nx&&!GRP.test(cells[gs]))gs++;
    if(gs>=nx)continue;
    let ge=gs;while(ge<nx&&GRP.test(cells[ge]))ge++;
    const fi=[...Array(ge-gs).keys()].map(j=>gs+j).find(i=>norm(cells[i])===tn);
    if(fi===undefined)continue;
    const off=fi-li;
    const hdr=cells[li].split('\n').find(l=>HDR.test(l))?.trim()||'';
    const sched=[],seen=new Set();
    for(let ri=ge;ri<nx;ri++){
      const c=cells[ri];
      if(ROM.test(c)&&!seen.has(c)){seen.add(c);const li2=ri+off;sched.push([c,li2<cells.length?cells[li2].trim():''|'']);}
    }
    return{sched,hdr};
  }
  return{sched:[],hdr:''};
}

// ══ УЧИТЕЛЬСКИЕ ФУНКЦИИ ══

// Регулярка для имени учителя: "Фамилия И.О." (возможно с двойной фамилией)
const TEACHER_RE = /([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\s+[А-ЯЁ]\.[А-ЯЁ]\.)/gu;

// Извлечь все уникальные имена учителей из файла
function detectTeachers(ab){
  const seen={};
  for(const c of getCells(ab)){
    TEACHER_RE.lastIndex=0;
    let m;
    while((m=TEACHER_RE.exec(c))!==null){
      const k=m[1].trim();
      if(k&&!seen[k])seen[k]=k;
    }
  }
  return Object.values(seen).sort((a,b)=>a.localeCompare(b,'ru'));
}

// Нормализация имени учителя для сравнения
function normTeacher(t){return t.replace(/\s+/g,' ').trim().toUpperCase();}

// Парсинг расписания для конкретного учителя
// Возвращает [{roman, group, subject, cabinet, korpus}]
function parseDocForTeacher(ab, teacherName){
  const tn = normTeacher(teacherName);
  const cells = getCells(ab);
  const labels = [];
  cells.forEach((c,i)=>{if(HDR.test(c))labels.push(i);});
  if(!labels.length) return {entries:[], hdr:''};
  labels.push(cells.length);

  const hdrText = cells[labels[0]].split('\n').find(l=>HDR.test(l))?.trim()||'';
  const result = [];

  for(let bi=0;bi<labels.length-1;bi++){
    let li=labels[bi], nx=labels[bi+1], gs=li+1;
    while(gs<nx && !GRP.test(cells[gs].split('\n')[0].trim()) && !GRP.test(cells[gs].trim())) gs++;
    if(gs>=nx) continue;
    let ge=gs;
    while(ge<nx && (GRP.test(cells[ge].trim()) || GRP.test(cells[ge].split('\n')[0].trim()))) ge++;

    // Собираем имена групп в этом блоке
    const groupNames=[];
    for(let gi=gs;gi<ge;gi++){
      const raw=cells[gi];
      const line1=raw.split('\n')[0].trim();
      groupNames.push(GRP.test(line1)?line1:(GRP.test(raw.trim())?raw.trim():'?'));
    }

    // Перебираем строки пар
    const seen=new Set();
    for(let ri=ge;ri<nx;ri++){
      const c=cells[ri];
      if(!ROM.test(c)||seen.has(c)) continue;
      seen.add(c);
      const roman=c;
      // Для каждой группы смотрим ячейку в той же позиции
      for(let gi=0;gi<groupNames.length;gi++){
        const cellIdx=ri+(gi-(0));
        // Ищем ячейки той же "строки" (roman номер + offset группы)
        const off=gs+gi-li;
        const targetIdx=ri+off;
        if(targetIdx>=nx||targetIdx>=cells.length) continue;
        const lesson=cells[targetIdx]||'';
        if(!lesson.trim()) continue;
        // Проверяем есть ли наш учитель в этой ячейке
        TEACHER_RE.lastIndex=0;
        let found=false;
        let m;
        while((m=TEACHER_RE.exec(lesson))!==null){
          if(normTeacher(m[1])===tn){found=true;break;}
        }
        if(!found) continue;
        // Разбираем ячейку
        const lines=lesson.split('\n').map(l=>l.trim()).filter(Boolean);
        // Разделяем предмет и учителя
        let subject='', cabinet='', korpus='';
        for(const line of lines){
          const split=splitSubjectAndTeacher(line);
          if(split){
            subject=split.subject;
            const pt=parseTeacherLine(split.teacherStr);
            cabinet=pt.cabinetNum; korpus=pt.korpus;
          } else {
            const ki=line.search(/к\.\d/);
            if(ki>0){
              const pt=parseTeacherLine(line);
              TEACHER_RE.lastIndex=0;
              const mt=TEACHER_RE.exec(line);
              if(mt&&normTeacher(mt[1])===tn){cabinet=pt.cabinetNum;korpus=pt.korpus;}
            } else if(!subject) {
              subject=line;
            }
          }
        }
        result.push({roman, group:groupNames[gi], subject, cabinet, korpus});
      }
    }
  }
  // Сортируем по порядку пар
  const order={I:1,II:2,III:3,IV:4,V:5,VI:6};
  result.sort((a,b)=>(order[a.roman]||9)-(order[b.roman]||9));
  return {entries:result, hdr:hdrText};
}

// ══ СОСТОЯНИЕ ══
const DEFAULT_URL='https://disk.yandex.ru/d/mjhoc7kysmQEuQ';
const S={
  url:DEFAULT_URL,files:[],selectedFile:null,lastGroup:'',lastTeacher:'',mode:'student',font:'Geologica',
  theme:'orange',dns:'system',customDns:'',dpi:'general',
  customProxy:'',proxyProvider:'allorigins',
  appIcon:'orange',liquidGlass:false,liquidGlassOpt:false,customBg:'',
  customBgBlurred:'',  // кэш pre-blurred версии фона (не сохраняется в localStorage)
  customBgBlurEnabled:true // вкл/выкл blur для обычного режима (с custom bg, без glass)
};
const FILE_CACHE={};

// ══ PERSISTENT FILE CACHE (IndexedDB) ══
const IDB_NAME='ScheduleFileCache';
const IDB_STORE='files';
let _idb=null;
function idbOpen(){
  if(_idb)return Promise.resolve(_idb);
  return new Promise((res,rej)=>{
    const req=indexedDB.open(IDB_NAME,1);
    req.onupgradeneeded=e=>{e.target.result.createObjectStore(IDB_STORE);};
    req.onsuccess=e=>{_idb=e.target.result;res(_idb);};
    req.onerror=e=>rej(e.target.error);
  });
}
async function idbGet(key){
  try{const db=await idbOpen();return new Promise((res,rej)=>{const tx=db.transaction(IDB_STORE,'readonly');const req=tx.objectStore(IDB_STORE).get(key);req.onsuccess=()=>res(req.result||null);req.onerror=()=>res(null);});}catch(e){return null;}
}
async function idbSet(key,val){
  try{const db=await idbOpen();return new Promise((res,rej)=>{const tx=db.transaction(IDB_STORE,'readwrite');tx.objectStore(IDB_STORE).put(val,key);tx.oncomplete=()=>res();tx.onerror=()=>res();});}catch(e){}
}
async function idbDel(key){
  try{const db=await idbOpen();return new Promise(res=>{const tx=db.transaction(IDB_STORE,'readwrite');tx.objectStore(IDB_STORE).delete(key);tx.oncomplete=()=>res();tx.onerror=()=>res();});}catch(e){}
}
async function idbClear(){
  try{const db=await idbOpen();return new Promise(res=>{const tx=db.transaction(IDB_STORE,'readwrite');tx.objectStore(IDB_STORE).clear();tx.oncomplete=()=>res();tx.onerror=()=>res();});}catch(e){}
}
let allGroups=[];

const _mem={};
const stor={
  get(k){try{return localStorage.getItem(k);}catch(e){return _mem[k]||null;}},
  set(k,v){try{localStorage.setItem(k,v);}catch(e){_mem[k]=v;}},
  del(k){try{localStorage.removeItem(k);}catch(e){delete _mem[k];}}
};
function loadLocal(){
  try{
    const d=JSON.parse(stor.get('sched')||'{}');
    S.lastGroup=d.group||'';
    S.lastTeacher=d.teacher||'';
    S.mode=d.mode||'student';
    S.font=d.font||'Geologica';
    if(S.font&&S.font!=='Geologica'){document.documentElement.style.setProperty('--app-font',"'"+S.font+"'");}
    S.theme=d.theme||'orange';
    // Migrate: if old users had glass as theme, switch to orange + enable glass mode
    if(S.theme==='glass'){S.theme='orange';S.liquidGlass=true;}
    else S.liquidGlass=d.liquidGlass||false;
    S.liquidGlassOpt=d.liquidGlassOpt||false;
    S.customBgBlurEnabled = (d.customBgBlurEnabled !== false); // default true
    // Фон грузим из отдельного ключа
    S.customBg = stor.get('sched_bg') || '';
    S.url=d.url||DEFAULT_URL;
    S.dns=d.dns||'system';
    // Кастомная тема — хранится отдельно чтобы не потерять при обновлении
    try {
      const ct = stor.get('sched_custom_theme');
      S.customTheme = ct ? JSON.parse(ct) : null;
    } catch(e) { S.customTheme = null; }
    S.customDns=d.customDns||'';
    S.dpi=d.dpi||'general';
    S.customProxy=d.customProxy||'';
    S.proxyProvider=d.proxyProvider||'corsproxy';
    S.appIcon=d.appIcon||'orange';
    // Загружаем кэшированный список файлов для офлайн-режима
    try{
      const cf=stor.get('sched_files_cache');
      if(cf){const parsed=JSON.parse(cf);if(Array.isArray(parsed)&&parsed.length>0)S.files=parsed;}
    }catch(e){}
    const inp=document.getElementById('url-input');
    if(inp)inp.value=S.url;
    const pi=document.getElementById('proxy-input');
    if(pi)pi.value=S.customProxy;
    const ci=document.getElementById('custom-dns-input');
    if(ci)ci.value=S.customDns;
  }catch(e){}
}
function saveLocal(){
  // Основные настройки — без тяжёлого base64 фона
  stor.set('sched',JSON.stringify({
    group:S.lastGroup,teacher:S.lastTeacher||'',mode:S.mode||'student',theme:S.theme,font:S.font||'Geologica',url:S.url,
    dns:S.dns,customDns:S.customDns,dpi:S.dpi,customProxy:S.customProxy,proxyProvider:S.proxyProvider,
    appIcon:S.appIcon,liquidGlass:S.liquidGlass,liquidGlassOpt:S.liquidGlassOpt,
    customBgBlurEnabled:S.customBgBlurEnabled,
    hasBg: !!S.customBg
  }));
  // Кэш списка файлов — для офлайн-режима
  try{
    if(S.files&&S.files.length>0) stor.set('sched_files_cache',JSON.stringify(S.files.map(f=>({name:f.name,path:f.path,size:f.size,resourceId:f.resourceId}))));
  }catch(e){}
  // Фон хранится отдельно (может быть >1МБ base64)
  try {
    if(S.customBg) stor.set('sched_bg', S.customBg);
    else stor.del('sched_bg');
    // Кастомная тема — отдельный ключ, не сбрасывается при обновлении
    if(S.customTheme) stor.set('sched_custom_theme', JSON.stringify(S.customTheme));
    else stor.del('sched_custom_theme');
  } catch(e) {
    // Если квота превышена — уведомляем пользователя
    toast('⚠️ Не удалось сохранить фон: изображение слишком большое');
    S.customBg = '';
    applyCustomBg();
  }
}

// ══ ПРОКСИ ══
function buildProxyUrl(proxyBaseUrl, format, targetUrl) {
  if (format === 'append_raw') return proxyBaseUrl + targetUrl;
  // query_url and append_encoded both encode
  return proxyBaseUrl + encodeURIComponent(targetUrl);
}

function getActiveProxy() {
  const key = S.proxyProvider || 'allorigins';
  const p = PROXY_PROVIDERS[key] || PROXY_PROVIDERS['allorigins'];
  let url = p.url;
  if (key === 'cf_worker' || key === 'custom') {
    url = S.customProxy ? (S.customProxy.endsWith('/') ? S.customProxy : S.customProxy + '/') : '';
  }
  return { url, format: p.format || 'query_url', provider: key };
}

function renderProxyList() {
  const list = document.getElementById('proxy-list-screen'); if (!list) return;
  list.innerHTML = '';
  Object.entries(PROXY_PROVIDERS).forEach(([key, p]) => {
    const sel = S.proxyProvider === key;
    const card = document.createElement('div');
    card.className = 'proxy-card' + (sel ? ' selected' : '');
    card.innerHTML =
      '<div class="proxy-ico">' + p.ico + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center">' +
          '<div class="proxy-name">' + p.name + '</div>' +
          '<span class="proxy-tag ' + p.tag + '">' + p.tagText + '</span>' +
        '</div>' +
        '<div class="proxy-addr">' + p.addr + '</div>' +
        '<div class="proxy-desc">' + p.desc + '</div>' +
      '</div>' +
      '<div class="proxy-check">✓</div>';
    card.onclick = () => selectProxy(key);
    list.appendChild(card);
  });
  // Show/hide custom input
  const needInput = (S.proxyProvider === 'cf_worker' || S.proxyProvider === 'custom');
  const wrap = document.getElementById('custom-proxy-screen-wrap');
  if (wrap) wrap.classList.toggle('hidden', !needInput);
  const inp = document.getElementById('proxy-input-screen');
  if (inp) inp.value = S.customProxy || '';
}

function updateProxyCurrentRow() {
  const p = PROXY_PROVIDERS[S.proxyProvider] || PROXY_PROVIDERS['allorigins'];
  const nameEl = document.getElementById('proxy-current-name');
  const subEl  = document.getElementById('proxy-current-sub');
  if (nameEl) nameEl.textContent = p.name;
  if (subEl)  subEl.textContent  = p.addr + ' • ' + p.tagText;
  const statusEl = document.getElementById('proxy-status');
  if (statusEl) statusEl.textContent = '';
}

function selectProxy(key) {
  S.proxyProvider = key; saveLocal();
  renderProxyList();
  updateProxyCurrentRow();
  toast('Прокси: ' + (PROXY_PROVIDERS[key]?.name || key));
  // Если на главной была ошибка — перезапустить загрузку
  const err = document.getElementById('home-error-hint');
  if (err && !err.classList.contains('hidden') && key !== 'cf_worker' && key !== 'custom') {
    loadFiles();
  }
}

function saveCustomProxyFromScreen() {
  const v = (document.getElementById('proxy-input-screen')?.value || '').trim();
  S.customProxy = v; saveLocal();
  if (document.getElementById('proxy-input')) document.getElementById('proxy-input').value = v;
  toast(v ? 'Прокси сохранён' : 'Адрес прокси очищен');
  updateProxyCurrentRow();
  if (v) {
    const err = document.getElementById('home-error-hint');
    if (err && !err.classList.contains('hidden')) loadFiles();
  }
}

// legacy, keep for backward compat
function saveProxy() { saveCustomProxyFromScreen(); }
function saveCustomProxy() { saveCustomProxyFromScreen(); }
function renderProxyGrid() { renderProxyList(); }

async function testCurrentProxy() {
  const btn = document.getElementById('proxy-test-btn');
  const status = document.getElementById('proxy-test-status');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Проверяю...'; }
  if (status) status.textContent = '';
  try {
    const {url: pBase, format, provider} = getActiveProxy();
    if (!pBase) throw new Error('Прокси не настроен');
    const testUrl = 'https://cloud-api.yandex.net/v1/disk/public/resources?public_key=test&limit=1';
    const proxyUrl = buildProxyUrl(pBase, format, testUrl);
    const r = await fetch(proxyUrl, {signal: AbortSignal.timeout(10000)});
    // 404 from Yandex is fine — means proxy works
    const ok = r.status < 500;
    if (status) status.textContent = ok
      ? '✅ Прокси работает! HTTP ' + r.status
      : '❌ Ошибка: HTTP ' + r.status;
  } catch(e) {
    if (status) status.textContent = '❌ ' + e.message;
  }
  if (btn) { btn.disabled = false; btn.textContent = '🔌 Проверить подключение'; }
}
// ══ НАТИВНАЯ ЗАГРУЗКА (Android Java, без CORS) ══
// Если запущено в Android-приложении — используем нативные методы.
// Иначе (браузер/тест) — fallback на CORS-прокси.

async function nativeGet(url) {
  // Запускаем синхронный @JavascriptInterface через Promise + setTimeout
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const resStr = window.Android.nativeFetch(url);
        const res = JSON.parse(resStr);
        if (!res.ok) reject(new Error('HTTP ' + (res.status || 0) + (res.error ? ' — ' + res.error : '')));
        else resolve(JSON.parse(res.body));
      } catch(e) { reject(e); }
    }, 0);
  });
}

async function nativeDownloadBuf(url) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const resStr = window.Android.nativeDownloadBase64(url);
        const res = JSON.parse(resStr);
        if (!res.ok) reject(new Error(res.error || 'Ошибка скачивания'));
        else resolve(base64ToArrayBuffer(res.base64));
      } catch(e) { reject(e); }
    }, 0);
  });
}

async function yadGet(path, params) {
  const qs = new URLSearchParams(params).toString();
  const raw = `https://cloud-api.yandex.net${path}?${qs}`;

  // Desktop (Electron): webSecurity=false — прямой fetch без CORS, без прокси
  if (window.__desktopMode) {
    const r = await fetch(raw, {signal: AbortSignal.timeout(15000)});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const el = document.getElementById('proxy-status');
    if (el) el.textContent = '✅ Прямое подключение';
    return r.json();
  }

  if (window.Android && window.Android.nativeFetch) {
    // Нативный путь — без CORS (Android)
    const data = await nativeGet(raw);
    const el = document.getElementById('proxy-status');
    if (el) el.textContent = '✅ Прямое подключение';
    return data;
  }

  // Fallback: CORS-прокси (браузер/дебаг)
  const {url: pBase, format} = getActiveProxy();
  if (!pBase) throw new Error('Прокси не настроен. Выбери прокси в настройках.');
  const proxyUrl = buildProxyUrl(pBase, format, raw);
  const r = await fetch(proxyUrl, {signal: AbortSignal.timeout(15000)});
  if (!r.ok) throw new Error(`Прокси вернул HTTP ${r.status}`);
  const el = document.getElementById('proxy-status');
  if (el) el.textContent = '✅ ' + (PROXY_PROVIDERS[S.proxyProvider]?.name || S.proxyProvider);
  return r.json();
}

async function yadDownload(rawUrl, filename) {
  // Desktop (Electron): webSecurity=false — прямой fetch
  if (window.__desktopMode) {
    const r = await fetch(rawUrl, {signal: AbortSignal.timeout(30000)});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.arrayBuffer();
  }

  if (window.Android && window.Android.nativeDownloadBase64) {
    // Нативный путь — без CORS, надёжно
    return await nativeDownloadBuf(rawUrl);
  }

  // Fallback: CORS-прокси
  const {url: pBase, format, provider} = getActiveProxy();
  if (!pBase) throw new Error('Прокси не настроен. Открой Настройки → Прокси');
  if (provider === 'allorigins') return await yadDownloadAllOrigins(rawUrl);
  const proxyUrl = buildProxyUrl(pBase, format, rawUrl);
  try {
    const r = await fetch(proxyUrl, {signal: AbortSignal.timeout(30000)});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('text/html') && !filename?.toLowerCase().endsWith('.html'))
      throw new Error('Прокси вернул HTML вместо файла');
    return r.arrayBuffer();
  } catch(e) {
    try { return await yadDownloadAllOrigins(rawUrl); }
    catch(e2) { throw new Error('Не удалось скачать файл: ' + e.message); }
  }
}

async function yadDownloadAllOrigins(rawUrl) {
  const aoUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(rawUrl);
  const r = await fetch(aoUrl, {signal: AbortSignal.timeout(45000)});
  if (!r.ok) throw new Error('AllOrigins HTTP ' + r.status);
  const data = await r.json();
  if (!data.contents) throw new Error('AllOrigins вернул пустой ответ');
  const contents = data.contents;
  if (typeof contents === 'string' && contents.startsWith('data:'))
    return base64ToArrayBuffer(contents.split(',')[1]);
  return new TextEncoder().encode(contents).buffer;
}

function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// ══ ИКОНКА ПРИЛОЖЕНИЯ ══
const ICON_VARIANTS = {
  orange:  {label:'Оранжевая',  ico:'🟠', bg:'#0d0d0d', accent:'#e87722', accent2:'#c45f0a', style:'gradient-warm'},
  amoled:  {label:'AMOLED',     ico:'⚫', bg:'#000000', accent:'#00e5ff', accent2:'#0088aa', style:'glow-cyan'},
  samek:   {label:'СаМеК',      ico:'🔵', bg:'#10388A', accent:'#7FBBFF', accent2:'#4a7fd4', style:'gradient-blue'},
  purple:  {label:'Фиолет',     ico:'🫐', bg:'#0e0b1a', accent:'#a78bfa', accent2:'#7c3aed', style:'glow-purple'},
  forest:  {label:'Лес',        ico:'🌿', bg:'#0b1a10', accent:'#4caf7d', accent2:'#2d8653', style:'glow-green'},
  gold:    {label:'Золото',     ico:'✨', bg:'#100e00', accent:'#f5c518', accent2:'#c9a000', style:'glow-gold'},
  glass:   {label:'Стекло',     ico:'🫧', bg:'#0a0f1e', accent:'#a0c4ff', accent2:'#7b9fff', style:'glass'},
  win11:   {label:'Win 11',     ico:'🔵', bg:'#1a1a1a', accent:'#60cdff', accent2:'#0067c0', style:'flat'},
  pixel:   {label:'Material',   ico:'🟣', bg:'#191c1e', accent:'#7fcfff', accent2:'#2f71d4', style:'flat'},
  aero:    {label:'Aero',       ico:'💎', bg:'#152030', accent:'#7fd7ff', accent2:'#00a8e8', style:'flat'},
  rose:    {label:'Розовый',    ico:'🌸', bg:'#1a0d12', accent:'#f472b6', accent2:'#db2777', style:'flat'},
  sunset:  {label:'Закат',      ico:'🌅', bg:'#0f0a00', accent:'#ff6b35', accent2:'#c94a10', style:'flat'},
  bw:      {label:'Ч/Б',        ico:'⬜', bg:'#000000', accent:'#ffffff', accent2:'#888888', style:'flat'},
  light:   {label:'Светлая',    ico:'☀️', bg:'#f4f4f4', accent:'#e87722', accent2:'#c45f0a', style:'flat'},
  candy:   {label:'Конфетка',   ico:'🍭', bg:'#1A0A12', accent:'#FF4DA6', accent2:'#d91a75', style:'flat'},
  ocean:   {label:'Океан',      ico:'🌊', bg:'#0A1520', accent:'#00B4D8', accent2:'#0077B6', style:'flat'},
};

// Draw CK icon preview on a canvas element
function drawIconPreview(canvas, variant) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  const t = variant;

  // Background
  if (t.style === 'gradient-warm') {
    const g = ctx.createRadialGradient(size*0.5,size*0.35,0, size*0.5,size*0.5,size*0.7);
    g.addColorStop(0, '#2a1800'); g.addColorStop(1, '#0d0d0d');
    ctx.fillStyle = g;
  } else if (t.style === 'gradient-blue') {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#0a1e4a'); g.addColorStop(1, '#10388A');
    ctx.fillStyle = g;
  } else if (t.style === 'glow-cyan') {
    const g = ctx.createRadialGradient(size*0.5,size*0.4,0, size*0.5,size*0.5,size*0.6);
    g.addColorStop(0, '#001a22'); g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
  } else if (t.style === 'glow-purple') {
    const g = ctx.createRadialGradient(size*0.5,size*0.4,0, size*0.5,size*0.5,size*0.65);
    g.addColorStop(0, '#1a0f35'); g.addColorStop(1, '#0e0b1a');
    ctx.fillStyle = g;
  } else if (t.style === 'glow-green') {
    const g = ctx.createRadialGradient(size*0.5,size*0.4,0, size*0.5,size*0.5,size*0.65);
    g.addColorStop(0, '#0f2a18'); g.addColorStop(1, '#0b1a10');
    ctx.fillStyle = g;
  } else if (t.style === 'glow-gold') {
    const g = ctx.createRadialGradient(size*0.5,size*0.4,0, size*0.5,size*0.5,size*0.65);
    g.addColorStop(0, '#1f1a00'); g.addColorStop(1, '#100e00');
    ctx.fillStyle = g;
  } else if (t.style === 'glass') {
    const g = ctx.createLinearGradient(0,0,size,size);
    g.addColorStop(0,'#1a2040'); g.addColorStop(0.5,'#0f1535'); g.addColorStop(1,'#0a0f1e');
    ctx.fillStyle = g;
  } else if (t.style === 'flat') {
    ctx.fillStyle = t.bg;
  } else {
    ctx.fillStyle = t.bg;
  }

  // Rounded rect background
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0,0,size,size, size*0.22);
  else ctx.rect(0,0,size,size);
  ctx.fill();

  // Outer border ring
  ctx.strokeStyle = t.accent + '55';
  ctx.lineWidth = size * 0.035;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(size*0.04,size*0.04,size*0.92,size*0.92, size*0.18);
  else ctx.rect(size*0.04,size*0.04,size*0.92,size*0.92);
  ctx.stroke();

  // Glow under logo
  ctx.shadowColor = t.accent;
  ctx.shadowBlur = size * 0.22;
  ctx.fillStyle = 'transparent';
  ctx.fillRect(size*0.3, size*0.3, size*0.4, size*0.4);
  ctx.shadowBlur = 0;

  // Draw CK logo mark
  const cx = size * 0.5, cy = size * 0.5;
  const lw = size * 0.09; // stroke width

  ctx.strokeStyle = t.accent;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = t.accent;
  ctx.shadowBlur = size * 0.12;

  // C shape (open on right)
  const cr = size * 0.22;
  ctx.beginPath();
  ctx.arc(cx - size*0.04, cy, cr, Math.PI * 0.28, Math.PI * 1.72);
  ctx.stroke();

  // K shape (right side)
  const kx = cx + size * 0.06, ky = cy;
  const kh = cr * 0.95;
  // Vertical bar of K
  ctx.beginPath();
  ctx.moveTo(kx, ky - kh);
  ctx.lineTo(kx, ky + kh);
  ctx.stroke();
  // Upper diagonal
  ctx.beginPath();
  ctx.moveTo(kx, ky - kh * 0.08);
  ctx.lineTo(kx + kh * 0.7, ky - kh);
  ctx.stroke();
  // Lower diagonal
  ctx.beginPath();
  ctx.moveTo(kx, ky - kh * 0.08);
  ctx.lineTo(kx + kh * 0.75, ky + kh);
  ctx.stroke();

  ctx.shadowBlur = 0;
}

function pickIcon(key) {
  if (!window.Android || !window.Android.setAppIcon) {
    toast('Смена иконки доступна только в приложении');
    return;
  }
  // Сохраняем выбор и обновляем UI — диалог подтверждения покажет Java
  S.appIcon = key;
  saveLocal();
  renderIconGrid();
  window.Android.setAppIcon(key);
}

function renderIconGrid() {
  const g = document.getElementById('icon-grid-screen');
  if (!g) return;
  const cur = S.appIcon || 'orange';
  const sec = document.getElementById('icon-picker-section');
  if (sec) sec.style.display = window.Android ? '' : 'none';

  g.innerHTML = '';
  // Use a flex-wrap grid instead of theme-card list
  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;padding:4px 0';
  g.appendChild(grid);

  Object.entries(ICON_VARIANTS).forEach(([key, t]) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:7px;cursor:pointer;position:relative';

    const cvWrap = document.createElement('div');
    const isSel = cur === key;
    cvWrap.style.cssText = `border-radius:16px;overflow:hidden;transition:transform .15s,box-shadow .15s;` +
      (isSel ? `box-shadow:0 0 0 2.5px var(--accent),0 0 18px color-mix(in srgb,var(--accent) 50%,transparent);transform:scale(1.08)` : '');

    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    cv.style.cssText = 'display:block;border-radius:16px;';
    drawIconPreview(cv, t);
    cvWrap.appendChild(cv);

    // Selection tick badge
    const tick = document.createElement('div');
    tick.style.cssText = `position:absolute;top:-4px;right:-4px;background:var(--accent);color:#fff;
      font-size:10px;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;
      justify-content:center;font-weight:700;opacity:${isSel?1:0};transition:opacity .15s`;
    tick.textContent = '✓';
    wrap.appendChild(cvWrap);
    wrap.appendChild(tick);

    const label = document.createElement('div');
    label.style.cssText = `font-size:11px;font-weight:600;color:${isSel?'var(--accent)':'var(--muted)'};letter-spacing:.03em;text-align:center;max-width:68px;line-height:1.2`;
    label.textContent = t.label;
    wrap.appendChild(label);

    wrap.onclick = () => pickIcon(key);
    wrap.addEventListener('touchstart', () => { cvWrap.style.transform = 'scale(0.94)'; });
    wrap.addEventListener('touchend', () => { cvWrap.style.transform = isSel ? 'scale(1.08)' : ''; });
    grid.appendChild(wrap);
  });
}

function updateIconPicker() { renderIconGrid(); }
function initIconPicker() { renderIconGrid(); }

// ══ ТЕМЫ ══
function applyTheme(key){
  const t = key === 'custom'
    ? { vars: S.customTheme || THEMES['orange'].vars }
    : (THEMES[key] || THEMES['orange']);
  Object.entries(t.vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
  document.documentElement.setAttribute('data-theme', key === 'custom' ? 'orange' : key);
  S.theme=key;saveLocal();renderThemeGrid();renderIconGrid();updateThemeCurrentRow();
  applyGlassMode(false);
}

/* ── Liquid Glass Mode ── */
function applyGlassMode(save){
  const body=document.body;
  body.classList.toggle('glass-mode', !!S.liquidGlass);
  // Оптимизация работает и при glass-mode, и при кастомном фоне
  const blurActive = !!(S.liquidGlass || S.customBg);
  body.classList.toggle('glass-optimized', !!(S.liquidGlassOpt && blurActive));
  // Update toggles
  const gt=document.getElementById('glass-toggle');
  const got=document.getElementById('glass-opt-toggle');
  const optRow=document.getElementById('glass-opt-row');
  if(gt) gt.classList.toggle('on', !!S.liquidGlass);
  if(got) got.classList.toggle('on', !!S.liquidGlassOpt);
  // Показываем строку оптимизации если есть хоть какой-то блюр (glass ИЛИ кастомный фон)
  if(optRow) optRow.style.display = blurActive ? 'flex' : 'none';
  // ФИКС: live blur запускается при любом кастомном фоне (не только glass-mode),
  // чтобы кнопки/карточки блюрились по-кадрово, а не показывали статичный pre-blur.
  if(S.customBg) startLiveBlur();
  else stopLiveBlur();
  if(save) saveLocal();
}
function toggleGlassMode(){
  S.liquidGlass = !S.liquidGlass;
  if(!S.liquidGlass) S.liquidGlassOpt=false;
  applyGlassMode(true);
  toast(S.liquidGlass ? '🫧 Liquid Glass включён' : 'Liquid Glass выключен');
}
function toggleGlassOpt(){
  // Работает и без glass-mode, если стоит кастомный фон
  if(!S.liquidGlass && !S.customBg) return;
  S.liquidGlassOpt = !S.liquidGlassOpt;
  applyGlassMode(true);
  toast(S.liquidGlassOpt ? '⚡ Оптимизация блюра включена' : 'Оптимизация блюра выключена');
}

/* ── Blur toggle для обычного режима (без glass) ── */
function toggleBgBlur(){
  S.customBgBlurEnabled = !S.customBgBlurEnabled;
  applyBgBlurState();
  saveLocal();
  toast(S.customBgBlurEnabled ? '🌫 Блюр включён' : 'Блюр выключен');
}
function applyBgBlurState(){
  document.body.classList.toggle('bg-blur-off', !S.customBgBlurEnabled);
  const tog = document.getElementById('bg-blur-toggle');
  const row = document.getElementById('bg-blur-row');
  if(tog) tog.classList.toggle('on', !!S.customBgBlurEnabled);
  // Показываем только когда custom bg есть И не в glass-mode
  if(row) row.style.display = (S.customBg && !S.liquidGlass) ? 'flex' : 'none';
}


/* ── Custom Background ── */
function applyCustomBg(){
  const layer = document.getElementById('bg-layer');
  const body  = document.body;
  if(S.customBg){
    if(layer){
      layer.style.backgroundImage = 'url(' + S.customBg + ')';
      layer.classList.add('active');
    }
    body.classList.add('custom-bg-active');
    // ── Pre-blur (Telegram-стиль): вычислить один раз, кэшировать ──
    if(S.customBgBlurred){
      // Уже есть кэш — применяем сразу
      applyPreBlurredBg(S.customBgBlurred);
    } else {
      // Нет кэша — вычисляем асинхронно (не блокируем UI)
      body.classList.remove('preblur-ready');
      computePreBlurredBg(S.customBg, function(blurUrl){
        if(blurUrl){
          S.customBgBlurred = blurUrl;
          // Не сохраняем в localStorage (слишком большой) — пересчитается при след. запуске
          applyPreBlurredBg(blurUrl);
        }
      });
    }
  } else {
    if(layer){
      layer.style.backgroundImage = '';
      layer.classList.remove('active');
    }
    body.classList.remove('custom-bg-active');
    body.classList.remove('preblur-ready');
    document.documentElement.style.removeProperty('--pre-blurred-bg');
  }
  // Обновляем видимость тоггла оптимизации (он нужен и при кастомном фоне)
  applyGlassMode(false);
  applyBgBlurState();
  updateBgUI();
}
function updateBgUI(){
  const preview=document.getElementById('custom-bg-preview');
  const thumb=document.getElementById('custom-bg-img-thumb');
  const removeBtn=document.getElementById('remove-bg-btn');
  if(preview) preview.style.display = S.customBg ? 'block' : 'none';
  if(thumb && S.customBg) thumb.src = S.customBg;
  if(removeBtn) removeBtn.style.display = S.customBg ? '' : 'none';
}
function pickBgImage(){
  // На Android — используем нативный пикер (обходит проблему доступа к файлам)
  if(window.Android && window.Android.pickImageForBackground){
    window.Android.pickImageForBackground();
  } else {
    // Браузер / десктоп — обычный file input
    const inp=document.getElementById('bg-file-input');
    if(inp) inp.click();
  }
}

// Колбэк вызывается из Java после выбора изображения
function onNativeBgImagePicked(dataUrl){
  if(!dataUrl || !dataUrl.startsWith('data:image')){
    toast('❌ Неверный формат изображения');
    return;
  }
  // Проверяем размер (~10 МБ = ~13.3 МБ base64, с запасом ставим 20МБ)
  if(dataUrl.length > 20 * 1024 * 1024){
    toast('⚠️ Изображение слишком большое, выбери поменьше');
    return;
  }
  S.customBg = dataUrl;
  S.customBgBlurred = ''; // сбрасываем кэш — пересчитаем для нового фото
  saveLocal();
  resetLiveBlur(); // сброс live blur — перезагрузит новое фото
  applyCustomBg();
  toast('🖼 Фон применён');
}
function onBgFileChosen(e){
  const file=e.target.files && e.target.files[0];
  if(!file) return;
  if(!file.type.startsWith('image/')) { toast('Выбери файл изображения'); return; }
  if(file.size > 10*1024*1024) { toast('Файл слишком большой (макс. 10 МБ)'); return; }
  const reader=new FileReader();
  reader.onload=function(ev){
    S.customBg=ev.target.result;
    S.customBgBlurred=''; // сбрасываем кэш pre-blur
    saveLocal();
    resetLiveBlur();
    applyCustomBg();
    toast('🖼 Фон применён');
  };
  reader.readAsDataURL(file);
  // Reset input so same file can be picked again
  e.target.value='';
}
function removeBgImage(){
  S.customBg='';
  S.customBgBlurred='';
  document.documentElement.style.removeProperty('--pre-blurred-bg');
  document.body.classList.remove('preblur-ready');
  stopLiveBlur();
  saveLocal();
  applyCustomBg();
  toast('Фон удалён');
}

// ══════════════════════════════════════════════════════════════════
// ── 🎬 LIVE BLUR ENGINE (glass-mode + custom bg) ─────────────────
//
// Принцип: StackBlur каждый кадр на 1/4 разрешении.
//
// Почему это быстро:
//  • Canvas: screen.width/4 × screen.height/4 ≈ ~97×200 px = ~20 000 пикселей
//  • StackBlur O(n) = ~20 000 операций — менее 2мс на кадр на Android
//  • CSS масштабирует canvas до 100vw×100vh — браузерный upscale "бесплатный"
//  • Нет backdrop-filter ни на одном элементе — 0 compositor layers = 0 GPU per frame
//  • Элементы просто полупрозрачные поверх canvas — рендер без GPU
//
// Цикл: rAF → drawImage(bgImg) → stackBlurRGB → следующий кадр
// ══════════════════════════════════════════════════════════════════
let _liveBlurRaf  = null;   // rAF handle
let _liveBlurImg  = null;   // Image объект с фоном
let _liveBlurCvs  = null;   // offscreen canvas (маленький — 1/4 размера)
let _liveBlurCtx  = null;   // его ctx
let _liveBlurOut  = null;   // visible canvas в DOM
let _liveBlurOutCtx = null; // его ctx
let _liveBlurW    = 0;
let _liveBlurH    = 0;
let _liveBlurReady = false;

function _liveBlurInit(){
  const SW = window.screen.width  || 390;
  const SH = window.screen.height || 844;

  // 1/4 разрешение — рабочий canvas (маленький, не в DOM)
  const CW = Math.max(4, Math.round(SW / 4));
  const CH = Math.max(4, Math.round(SH / 4));

  if(_liveBlurW === CW && _liveBlurH === CH && _liveBlurCvs) return true; // уже инит

  _liveBlurW = CW; _liveBlurH = CH;
  _liveBlurCvs = document.createElement('canvas');
  _liveBlurCvs.width  = CW;
  _liveBlurCvs.height = CH;
  _liveBlurCtx = _liveBlurCvs.getContext('2d', { willReadFrequently: true });
  _liveBlurCtx.imageSmoothingEnabled = true;
  _liveBlurCtx.imageSmoothingQuality = 'low'; // быстро

  _liveBlurOut = document.getElementById('live-blur-canvas');
  if(!_liveBlurOut) return false;
  // Выходной canvas — тоже 1/4, CSS растягивает до 100vw×100vh
  _liveBlurOut.width  = CW;
  _liveBlurOut.height = CH;
  _liveBlurOutCtx = _liveBlurOut.getContext('2d');
  _liveBlurOutCtx.imageSmoothingEnabled = true;
  return true;
}

function _liveBlurLoadImg(callback){
  if(!S.customBg) { callback(null); return; }
  if(_liveBlurImg && _liveBlurImg.src === S.customBg) { callback(_liveBlurImg); return; }
  const img = new Image();
  img.onload  = () => { _liveBlurImg = img; callback(img); };
  img.onerror = () => callback(null);
  img.src = S.customBg;
}

// Cover-fit для прямоугольника dst
function _coverFit(iw, ih, dw, dh){
  const ar  = iw / ih;
  const sar = dw / dh;
  let fw, fh, fx, fy;
  if(ar > sar){ fh = dh; fw = fh * ar; fx = (dw - fw) / 2; fy = 0; }
  else         { fw = dw; fh = fw / ar; fx = 0; fy = (dh - fh) / 2; }
  return {fx, fy, fw, fh};
}

// Один кадр live blur — рисуем однократно (фон статичный, rAF не нужен)
function _liveBlurFrame(){
  if(!_liveBlurCvs || !_liveBlurOut || !_liveBlurImg) return;

  const CW = _liveBlurW, CH = _liveBlurH;
  const ctx = _liveBlurCtx;

  // 1) Рисуем background с cover-fit в 1/4 разрешении
  const {fx, fy, fw, fh} = _coverFit(_liveBlurImg.naturalWidth, _liveBlurImg.naturalHeight, CW, CH);
  ctx.clearRect(0, 0, CW, CH);
  ctx.drawImage(_liveBlurImg, fx, fy, fw, fh);

  // 2) StackBlur radius=7
  const px = ctx.getImageData(0, 0, CW, CH);
  stackBlurRGB(px.data, CW, CH, 7);
  ctx.putImageData(px, 0, 0);

  // 3) Копируем на видимый canvas
  _liveBlurOutCtx.drawImage(_liveBlurCvs, 0, 0);

  // Один render — останавливаем rAF. Фон статичный, повторная отрисовка не нужна.
  if(_liveBlurRaf){ cancelAnimationFrame(_liveBlurRaf); _liveBlurRaf = null; }

  if(!_liveBlurReady){
    _liveBlurReady = true;
    document.body.classList.add('liveblur-ready');
  }
}

function startLiveBlur(){
  if(_liveBlurReady) return; // уже нарисовано
  if(_liveBlurRaf) return;   // уже в процессе
  if(!_liveBlurInit()) return;

  _liveBlurReady = false;
  _liveBlurLoadImg(function(img){
    if(!img) return;
    _liveBlurRaf = requestAnimationFrame(_liveBlurFrame);
  });
}

function stopLiveBlur(){
  if(_liveBlurRaf){
    cancelAnimationFrame(_liveBlurRaf);
    _liveBlurRaf = null;
  }
  _liveBlurReady = false;
  _liveBlurImg = null; // сбрасываем кэш — при следующем старте перечитаем
  document.body.classList.remove('liveblur-ready');
  const cvs = document.getElementById('live-blur-canvas');
  if(cvs){ cvs.style.opacity='0'; }
}

// Сбросить live blur (при смене фото)
function resetLiveBlur(){
  stopLiveBlur();
  _liveBlurCvs = null; _liveBlurCtx = null;
  _liveBlurW = 0; _liveBlurH = 0;
  if(S.customBg) startLiveBlur();
}

// ══════════════════════════════════════════════════════════════════
// ── 🚀 TELEGRAM-STYLE STACKBLUR ENGINE ───────────────────────────
//
// Принцип из Telegram Android (Utilities.java → native blur.c):
//  1. Downsample изображение до 1/4 размера  (tiny canvas)
//  2. Применить StackBlur (алгоритм Марио Клингеманна, O(n) per pixel,
//     НЕ зависит от радиуса — именно этот алгоритм в blur.c Telegram)
//  3. Апскейл обратно на размер экрана → статичный Data URL
//  4. Использовать как background-image — ноль GPU-работы при скролле
//
// StackBlur vs Gaussian vs CSS backdrop-filter:
//  CSS backdrop-filter → GPU каждый кадр           → нагрузка пропорц. кол-ву элементов
//  Gaussian blur       → O(r²) per pixel           → медленно при большом радиусе
//  StackBlur           → O(1) per pixel (constant) → одинаково быстро при любом радиусе
//
// Telegram использует radius=7 на 1/4-1/8 bitmap. Мы делаем то же самое.
// ══════════════════════════════════════════════════════════════════

// Полная реализация алгоритма StackBlur (Mario Klingemann, MIT License)
// Работает на пикселях ImageData напрямую — без внешних библиотек
function stackBlurRGB(pixels, w, h, radius) {
  if (radius < 1) return;
  const wm = w - 1, hm = h - 1;
  const wh = w * h;
  const div = radius + radius + 1;
  const r = new Int32Array(wh), g = new Int32Array(wh), b = new Int32Array(wh);
  let rsum, gsum, bsum, x, y, i, p, yp, yi, yw;
  const vmin = new Int32Array(Math.max(w, h));
  let divsum = (div + 1) >> 1; divsum *= divsum;
  const dv = new Int32Array(256 * divsum);
  for (i = 0; i < 256 * divsum; i++) dv[i] = i / divsum | 0;
  yw = yi = 0;

  const stack = new Int32Array(div * 3);
  let stackpointer, stackstart, sir, rbs;
  let r1 = radius + 1;
  let routsum, goutsum, boutsum, rinsum, ginsum, binsum;

  for (y = 0; y < h; y++) {
    rinsum = ginsum = binsum = routsum = goutsum = boutsum = rsum = gsum = bsum = 0;
    for (i = -radius; i <= radius; i++) {
      p = (yi + (Math.min(wm, Math.max(i, 0)))) * 4;
      sir = (i + radius) * 3;
      stack[sir]     = pixels[p];
      stack[sir + 1] = pixels[p + 1];
      stack[sir + 2] = pixels[p + 2];
      rbs = r1 - Math.abs(i);
      rsum += stack[sir] * rbs; gsum += stack[sir+1] * rbs; bsum += stack[sir+2] * rbs;
      if (i > 0) { rinsum += stack[sir]; ginsum += stack[sir+1]; binsum += stack[sir+2]; }
      else       { routsum += stack[sir]; goutsum += stack[sir+1]; boutsum += stack[sir+2]; }
    }
    stackpointer = radius;
    for (x = 0; x < w; x++) {
      r[yi] = dv[rsum]; g[yi] = dv[gsum]; b[yi] = dv[bsum];
      rsum -= routsum; gsum -= goutsum; bsum -= boutsum;
      stackstart = stackpointer - radius + div;
      sir = (stackstart % div) * 3;
      routsum -= stack[sir]; goutsum -= stack[sir+1]; boutsum -= stack[sir+2];
      if (y === 0) vmin[x] = Math.min(x + radius + 1, wm);
      p = (yw + vmin[x]) * 4;
      stack[sir] = pixels[p]; stack[sir+1] = pixels[p+1]; stack[sir+2] = pixels[p+2];
      rinsum += stack[sir]; ginsum += stack[sir+1]; binsum += stack[sir+2];
      rsum += rinsum; gsum += ginsum; bsum += binsum;
      stackpointer = (stackpointer + 1) % div;
      sir = stackpointer * 3;
      routsum += stack[sir]; goutsum += stack[sir+1]; boutsum += stack[sir+2];
      rinsum -= stack[sir]; ginsum -= stack[sir+1]; binsum -= stack[sir+2];
      yi++;
    }
    yw += w;
  }
  for (x = 0; x < w; x++) {
    rinsum = ginsum = binsum = routsum = goutsum = boutsum = rsum = gsum = bsum = 0;
    yp = -radius * w;
    for (i = -radius; i <= radius; i++) {
      yi = Math.max(0, yp) + x;
      sir = (i + radius) * 3;
      stack[sir] = r[yi]; stack[sir+1] = g[yi]; stack[sir+2] = b[yi];
      rbs = r1 - Math.abs(i);
      rsum += r[yi] * rbs; gsum += g[yi] * rbs; bsum += b[yi] * rbs;
      if (i > 0) { rinsum += stack[sir]; ginsum += stack[sir+1]; binsum += stack[sir+2]; }
      else       { routsum += stack[sir]; goutsum += stack[sir+1]; boutsum += stack[sir+2]; }
      if (i < hm) yp += w;
    }
    yi = x;
    stackpointer = radius;
    for (y = 0; y < h; y++) {
      pixels[yi * 4]     = dv[rsum];
      pixels[yi * 4 + 1] = dv[gsum];
      pixels[yi * 4 + 2] = dv[bsum];
      rsum -= routsum; gsum -= goutsum; bsum -= boutsum;
      stackstart = stackpointer - radius + div;
      sir = (stackstart % div) * 3;
      routsum -= stack[sir]; goutsum -= stack[sir+1]; boutsum -= stack[sir+2];
      if (x === 0) vmin[y] = Math.min(y + r1, hm) * w;
      p = x + vmin[y];
      stack[sir] = r[p]; stack[sir+1] = g[p]; stack[sir+2] = b[p];
      rinsum += stack[sir]; ginsum += stack[sir+1]; binsum += stack[sir+2];
      rsum += rinsum; gsum += ginsum; bsum += binsum;
      stackpointer = (stackpointer + 1) % div;
      sir = stackpointer * 3;
      routsum += stack[sir]; goutsum += stack[sir+1]; boutsum += stack[sir+2];
      rinsum -= stack[sir]; ginsum -= stack[sir+1]; binsum -= stack[sir+2];
      yi += w;
    }
  }
}

// Главная функция pre-blur: точный алгоритм Telegram Android
//
// Telegram (ImageLoader.java):
//   1. Получить bitmap фонового изображения
//   2. Создать scaled bitmap: Bitmaps.createScaledBitmap(src, w/4, h/4, true)
//   3. Utilities.blurBitmap(scaledBitmap, 7, unpin, w, h, rowBytes)  ← radius=7
//   4. Вернуть как BitmapDrawable → использовать как background
//
// Мы делаем то же самое на Canvas API:
//   1. Нарисовать изображение на canvas размером 1/4 оригинала
//   2. getImageData → stackBlurRGB(radius=7) → putImageData
//   3. Нарисовать маленький canvas на финальный (логические пиксели экрана)
//   4. Сохранить как data URL — используется как background-image на кнопках
//
// ⚠ НЕ умножаем на DPR — работаем в логических пикселях (как Telegram в dp)
// ⚠ overlay НЕ запекаем в blur — он добавляется через CSS ::before/background-color
function computePreBlurredBg(srcDataUrl, callback) {
  const img = new Image();
  img.onload = function () {
    try {
      // Логические пиксели экрана (не физические — DPR не нужен)
      const SW = window.screen.width  || 390;
      const SH = window.screen.height || 844;

      // Шаг 1: downsample 1/4 — точно как Telegram createScaledBitmap(src, w/4, h/4)
      const bw = Math.max(4, Math.round(img.naturalWidth  / 4));
      const bh = Math.max(4, Math.round(img.naturalHeight / 4));
      const small = document.createElement('canvas');
      small.width = bw; small.height = bh;
      const sc = small.getContext('2d');
      sc.imageSmoothingEnabled = true;
      sc.imageSmoothingQuality = 'medium';

      // cover-fit (сохраняем пропорции, заполняем весь canvas)
      const ar  = img.naturalWidth / img.naturalHeight;
      const sar = bw / bh;
      let dw, dh, dx, dy;
      if (ar > sar) { dh = bh; dw = dh * ar; dx = (bw - dw) / 2; dy = 0; }
      else          { dw = bw; dh = dw / ar; dx = 0; dy = (bh - dh) / 2; }
      sc.drawImage(img, dx, dy, dw, dh);

      // Шаг 2: StackBlur radius=7 на маленьком canvas
      // Telegram: Utilities.blurBitmap(bitmap, 7, ...) — ТОЧНО тот же алгоритм
      const imgData = sc.getImageData(0, 0, bw, bh);
      stackBlurRGB(imgData.data, bw, bh, 7);
      sc.putImageData(imgData, 0, 0);

      // Шаг 3: upscale на логические пиксели экрана с cover-fit
      const out = document.createElement('canvas');
      out.width = SW; out.height = SH;
      const oc = out.getContext('2d');
      oc.imageSmoothingEnabled = true;
      oc.imageSmoothingQuality = 'high';

      const ar2  = img.naturalWidth / img.naturalHeight;
      const sar2 = SW / SH;
      let fw, fh, fx, fy;
      if (ar2 > sar2) { fh = SH; fw = fh * ar2; fx = (SW - fw) / 2; fy = 0; }
      else             { fw = SW; fh = fw / ar2; fx = 0; fy = (SH - fh) / 2; }
      oc.drawImage(small, fx, fy, fw, fh);

      // Шаг 4: НЕТ overlay в blur! Telegram рисует tint отдельно через Paint/alpha.
      // Мы добавим его через CSS (background-color + ::before pseudo).
      // Это позволяет менять прозрачность под каждый элемент независимо.

      // JPEG 82% — баланс качества и размера (Telegram тоже сжимает в JPEG)
      callback(out.toDataURL('image/jpeg', 0.82));
    } catch (e) {
      callback(null);
    }
  };
  img.onerror = function () { callback(null); };
  img.src = srcDataUrl;
}

function applyPreBlurredBg(blurredUrl) {
  if (!blurredUrl) return;
  document.documentElement.style.setProperty('--pre-blurred-bg', 'url(' + blurredUrl + ')');
  document.body.classList.add('preblur-ready');
}
function renderThemeGrid(){
  ['theme-grid-screen'].forEach(gid => {
    const g=document.getElementById(gid); if(!g) return;
    g.innerHTML='';
    Object.entries(THEMES).forEach(([key,t])=>{
      const c=document.createElement('div');c.className='theme-card'+(S.theme===key?' selected':'');
      c.innerHTML=`
        <div class="theme-swatch">${t.sw.map(cl=>`<div class="swatch" style="background:${cl}"></div>`).join('')}</div>
        <div style="flex:1;min-width:0">
          <div class="theme-name" style="font-size:13px;font-weight:700">${t.ico ? (typeof _emojiImg==='function' ? _emojiImg(t.ico,14) : t.ico) : ''} ${t.name}</div>
        </div>
        <span class="theme-check">✓</span>`;
      c.onclick=()=>{SFX.play('themeSelect');applyTheme(key);}; g.appendChild(c);
    });
    // Карточка «Своя тема» — только VIP
    const isVip = typeof vipCheck === 'function' ? vipCheck() : false;
    const custom = document.createElement('div');
    custom.className = 'theme-card' + (S.theme === 'custom' ? ' selected' : '');
    custom.style.cssText = 'position:relative;overflow:hidden';
    if (isVip) {
      const sw = S.customTheme
        ? [S.customTheme['--bg']||'#0d0d0d', S.customTheme['--accent']||'#e87722', S.customTheme['--surface2']||'#1f1f1f']
        : ['#0d0d0d','#e87722','#1f1f1f'];
      custom.innerHTML = `
        <div class="theme-swatch">${sw.map(cl=>`<div class="swatch" style="background:${cl}"></div>`).join('')}</div>
        <div style="flex:1;min-width:0">
          <div class="theme-name" style="font-size:13px;font-weight:700">🎨 Своя тема</div>
          <div style="font-size:10px;color:var(--muted)">Нажми для настройки</div>
        </div>
        <span class="theme-check">✓</span>`;
      custom.onclick = () => openCustomThemeEditor();
    } else {
      custom.innerHTML = `
        <div class="theme-swatch">
          <div class="swatch" style="background:#0d0d0d"></div>
          <div class="swatch" style="background:#888"></div>
          <div class="swatch" style="background:#1f1f1f"></div>
        </div>
        <div style="flex:1;min-width:0">
          <div class="theme-name" style="font-size:13px;font-weight:700;color:var(--muted)">🎨 Своя тема</div>
        </div>
        <span style="font-size:10px;font-weight:800;background:linear-gradient(90deg,#f5c518,#e87722);color:#000;padding:2px 7px;border-radius:6px;flex-shrink:0">VIP</span>`;
      custom.onclick = () => toast('👑 Своя тема — только для VIP');
    }
    g.appendChild(custom);
  });
}
// ── Редактор своей темы (VIP) ─────────────────────────────────────
const CUSTOM_THEME_VARS = [
  { key: '--bg',       label: 'Фон приложения',    default: '#0d0d0d' },
  { key: '--surface',  label: 'Поверхность 1',     default: '#161616' },
  { key: '--surface2', label: 'Поверхность 2',     default: '#1f1f1f' },
  { key: '--surface3', label: 'Поверхность 3',     default: '#2a2a2a' },
  { key: '--accent',   label: 'Акцент (главный)',   default: '#e87722' },
  { key: '--accent2',  label: 'Акцент (нажатие)',   default: '#c45f0a' },
  { key: '--text',     label: 'Цвет текста',        default: '#f0ede8' },
  { key: '--muted',    label: 'Вторичный текст',    default: '#6b6762' },
  { key: '--btn-text', label: 'Текст на кнопках',   default: '#ffffff' },
];

function openCustomThemeEditor() {
  if (typeof vipCheck === 'function' && !vipCheck()) { toast('👑 Только для VIP'); return; }
  const existing = document.getElementById('custom-theme-overlay');
  if (existing) { existing.remove(); return; }
  const current = S.customTheme || {};

  const ov = document.createElement('div');
  ov.id = 'custom-theme-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9400;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)';

  // Сетка кружков — 3 в ряд
  const circles = CUSTOM_THEME_VARS.map(v => {
    const val = current[v.key] || v.default;
    return `
      <label style="display:flex;flex-direction:column;align-items:center;gap:7px;cursor:pointer;-webkit-tap-highlight-color:transparent">
        <div style="position:relative;width:52px;height:52px">
          <div id="ctc_${v.key.replace(/--/g,'')}"
            style="width:52px;height:52px;border-radius:50%;background:${val};box-shadow:0 2px 10px rgba(0,0,0,.45);transition:transform .12s,box-shadow .12s"
            ontouchstart="this.style.transform='scale(.9)';this.style.boxShadow='0 1px 6px rgba(0,0,0,.3)'"
            ontouchend="this.style.transform='';this.style.boxShadow='0 2px 10px rgba(0,0,0,.45)'">
          </div>
          <input type="color" value="${val}" data-var="${v.key}"
            style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;border:none;padding:0"
            oninput="customThemePreview(this)">
        </div>
        <span style="font-size:10px;font-weight:600;color:var(--muted);text-align:center;line-height:1.2;max-width:64px">${v.label}</span>
      </label>`;
  }).join('');

  // Превью-полоска из 3 главных цветов
  const previewBg  = current['--bg']      || '#0d0d0d';
  const previewAcc = current['--accent']  || '#e87722';
  const previewSrf = current['--surface2']|| '#1f1f1f';

  ov.innerHTML = `
    <div onclick="event.stopPropagation()"
      style="background:var(--surface);border-radius:28px 28px 0 0;width:100%;max-height:86vh;display:flex;flex-direction:column;padding-bottom:calc(var(--safe-bot,0px))">

      <!-- Drag handle -->
      <div style="display:flex;justify-content:center;padding:10px 0 0">
        <div style="width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.18)"></div>
      </div>

      <!-- Header -->
      <div style="display:flex;align-items:center;padding:14px 20px 0">
        <div style="flex:1">
          <div style="font-size:16px;font-weight:800;letter-spacing:-.2px">Своя тема</div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px">Нажми на кружок чтобы изменить цвет</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;margin-right:2px">
          <div id="ct-prev-bg"  style="width:20px;height:20px;border-radius:50%;background:${previewBg};border:1.5px solid rgba(255,255,255,.08)"></div>
          <div id="ct-prev-acc" style="width:20px;height:20px;border-radius:50%;background:${previewAcc}"></div>
          <div id="ct-prev-srf" style="width:20px;height:20px;border-radius:50%;background:${previewSrf};border:1.5px solid rgba(255,255,255,.08)"></div>
        </div>
        <button onclick="document.getElementById('custom-theme-overlay').remove()"
          style="background:rgba(255,255,255,.08);border:none;color:var(--muted);width:32px;height:32px;border-radius:50%;font-size:15px;cursor:pointer;flex-shrink:0;margin-left:10px;display:flex;align-items:center;justify-content:center">✕</button>
      </div>

      <!-- Circles grid -->
      <div style="flex:1;overflow-y:auto;padding:20px 16px 4px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px 8px;justify-items:center">
          ${circles}
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:10px;padding:16px 20px 14px;flex-shrink:0">
        <button onclick="customThemeReset()"
          style="width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,.07);color:var(--muted);font-size:18px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center"
          ontouchstart="this.style.opacity='.6'" ontouchend="this.style.opacity=''">↺</button>
        <button onclick="customThemeSave()"
          style="flex:1;height:44px;border-radius:22px;border:none;background:var(--accent);color:var(--btn-text,#fff);font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;letter-spacing:.2px"
          ontouchstart="this.style.opacity='.8'" ontouchend="this.style.opacity=''">Применить</button>
      </div>
    </div>`;

  ov.addEventListener('click', () => ov.remove());
  document.body.appendChild(ov);
}
function customThemePreview(inp) {
  const k   = inp.getAttribute('data-var');
  const val = inp.value;
  // Применяем CSS переменную для live preview
  document.documentElement.style.setProperty(k, val);
  // Обновляем кружок цвета
  const circle = document.getElementById('ctc_' + k.replace(/--/g,''));
  if (circle) circle.style.background = val;
  // Обновляем мини-превью в хедере
  if (k === '--bg')       { const el = document.getElementById('ct-prev-bg');  if(el) el.style.background = val; }
  if (k === '--accent')   { const el = document.getElementById('ct-prev-acc'); if(el) el.style.background = val; }
  if (k === '--surface2') { const el = document.getElementById('ct-prev-srf'); if(el) el.style.background = val; }
}
function customThemeSave() {
  const vars = {};
  document.querySelectorAll('#custom-theme-overlay [data-var]')
    .forEach(inp => { vars[inp.getAttribute('data-var')] = inp.value; });
  S.customTheme = vars;
  S.theme = 'custom';
  saveLocal();
  applyTheme('custom');
  document.getElementById('custom-theme-overlay')?.remove();
  SFX.play && SFX.play('themeSelect');
  toast('🎨 Тема сохранена!');
}
function customThemeReset() {
  S.customTheme = null;
  S.theme = 'orange';
  saveLocal();
  applyTheme('orange');
  document.getElementById('custom-theme-overlay')?.remove();
  toast('↺ Тема сброшена');
}

function updateThemeCurrentRow(){
  const t=THEMES[S.theme];
  const nameEl=document.getElementById('theme-current-name');
  const subEl=document.getElementById('theme-current-sub');
  if(nameEl) nameEl.textContent=(t?.ico||'')+' '+(t?.name||S.theme);
  if(subEl)  subEl.textContent='Нажми для выбора';
}

// ══ DNS ══
function selectDns(key){
  S.dns=key;saveLocal();
  renderDnsGrid();
  const customWrap=document.getElementById('custom-dns-wrap');
  customWrap.classList.toggle('hidden',key!=='custom');
  // Уведомить Android нативно
  if(window.Android?.setDns){
    const doh=key==='custom'?S.customDns:(DNS_PROVIDERS[key]?.doh||'');
    window.Android.setDns(key,doh);
  }
  if(key!=='custom')toast('DNS: '+DNS_PROVIDERS[key]?.name);
}
function saveCustomDns(){
  const v=document.getElementById('custom-dns-input')?.value.trim()||'';
  S.customDns=v;saveLocal();
  if(window.Android?.setDns)window.Android.setDns('custom',v);
  toast('Свой DNS сохранён');
}
function renderDnsGrid(){
  const g=document.getElementById('dns-grid');g.innerHTML='';
  Object.entries(DNS_PROVIDERS).forEach(([key,d])=>{
    const c=document.createElement('div');c.className='dns-card'+(S.dns===key?' selected':'');
    c.innerHTML=`<div class="dns-card-ico">${d.ico}</div><div class="dns-card-name">${d.name}</div><div class="dns-card-addr">${d.addr}</div>`;
    c.onclick=()=>selectDns(key);g.appendChild(c);
  });
}

// ══ DPI стратегии ══
function selectDpi(id) {
  S.dpi = id; saveLocal();
  renderDpiList();
  updateDpiCurrentRow();
updateThemeCurrentRow();
  if (window.Android?.setDpiStrategy) window.Android.setDpiStrategy(id);
  const s = DPI_STRATEGIES.find(x => x.id === id);
  toast('Стратегия: ' + s?.name);
}

function updateDpiCurrentRow() {
  const s = DPI_STRATEGIES.find(x => x.id === S.dpi);
  const nameEl = document.getElementById('dpi-current-name');
  const badgeEl = document.getElementById('dpi-current-badge');
  if (nameEl) nameEl.textContent = s ? s.name : S.dpi;
  if (badgeEl) badgeEl.textContent = (s ? s.badge : '') + (dpiWorkingIds ? ' • ✅ проверено' : ' • Нажми для выбора');
  const row = document.getElementById('dpi-current-row');
  // не подсвечиваем строку постоянно — она просто навигационная
}

function renderDpiList() {
  // Рисуем в обе точки: экран DPI + (если есть) inline список
  ['dpi-list-screen'].forEach(listId => {
    const list = document.getElementById(listId); if (!list) return;
    list.innerHTML = '';
    const toShow = dpiWorkingIds
      ? DPI_STRATEGIES.filter(s => dpiWorkingIds.includes(s.id))
      : DPI_STRATEGIES;
    toShow.forEach(s => {
      const isWorking = dpiWorkingIds && dpiWorkingIds.includes(s.id);
      const item = document.createElement('div');
      item.className = 'dpi-item' + (S.dpi === s.id ? ' selected' : '') + (isWorking ? ' works' : '');
      item.innerHTML = `
        <span class="dpi-badge">${s.badge}</span>
        <div style="flex:1;min-width:0">
          <div class="dpi-name">${s.name}</div>
          ${s.desc ? `<div class="dpi-desc">${s.desc}</div>` : ''}
        </div>
        ${isWorking ? '<span style="font-size:12px;color:var(--success);flex-shrink:0">✅</span>' : ''}
        <span class="dpi-check">✓</span>`;
      item.onclick = () => selectDpi(s.id);
      list.appendChild(item);
    });
  });
}

// ══ VPN (Android) ══
let vpnActive=false;
function toggleVpn(){
  if(!window.Android?.toggleVpn){toast('Только в приложении');return;}
  window.Android.toggleVpn();
}
// Вызывается из Android нативно
function onVpnStateChanged(active,statusText){
  vpnActive=active;
  const dot=document.getElementById('vpn-dot');
  const title=document.getElementById('vpn-title');
  const sub=document.getElementById('vpn-sub');
  const btn=document.getElementById('vpn-btn');
  if(dot)dot.classList.toggle('on',active);
  if(title)title.textContent=active?'VPN обход активен':'VPN обход выключен';
  if(sub)sub.textContent=statusText||(active?'DNS и DPI обход работают':'DNS и DPI обход неактивны');
  if(btn){
    btn.className='btn '+(active?'btn-surface':'btn-accent');
    btn.textContent=active?'Отключить VPN обход':'Включить VPN обход';
  }
}

// ══ НАВИГАЦИЯ ══
// История экранов для кнопки "Назад"
let cur='s-home';
const SCREEN_PARENTS = {
  's-groups':        {parent:'s-home',           nav:'nav-home'},
  's-schedule':      {parent:'s-groups',         nav:'nav-home'},
  's-bells':         {parent:'s-home',           nav:'nav-bells'},
  's-settings':      {parent:'s-profile',        nav:'nav-profile'},
  's-themes':        {parent:'s-settings',       nav:null},
  's-teachers':      {parent:'s-home',           nav:'nav-home'},
  's-shorts':        {parent:'s-home',           nav:'nav-home'},
  's-profile-edit':  {parent:'s-profile',        nav:'nav-profile'},
  's-online':        {parent:'s-profile',        nav:'nav-profile'},
  's-leaderboard':   {parent:'s-profile',        nav:'nav-profile'},
  's-peer-profile':  {parent:'s-messenger-chat', nav:null},
  's-messenger':     {parent:'s-profile',        nav:'nav-profile'},
  's-messenger-chat':{parent:'s-messenger',      nav:'nav-profile'},
  's-login':         {parent:'s-home',           nav:'nav-home'},
  's-groups-chat':   {parent:'s-profile',        nav:'nav-profile'},
};

// Вызывается из Android (кнопка Back на телефоне)
function nativeBack(){
  // 0. Попапы мессенджера
  const msgMenu = document.getElementById('mc-msg-menu');
  if(msgMenu){ mcCloseMenu(); return true; }
  const fwdSheet = document.getElementById('mc-forward-sheet');
  if(fwdSheet){ fwdSheet.remove(); return true; }
  const reactPicker = document.getElementById('mc-reaction-picker');
  if(reactPicker){ reactPicker.remove(); return true; }
  const actionSheet = document.getElementById('msg-action-sheet');
  if(actionSheet){ actionSheet.remove(); return true; }
  // 1. Заметка
  if(_noteOverlay){closeNote();return true;}
  // 2. CMD консоль
  const cmdOv = document.getElementById('cmd-overlay');
  if(cmdOv && cmdOv.style.display !== 'none'){ cmdClose(); return true; }
  // 2. OTA overlay
  const otaOv = document.getElementById('ota-overlay');
  if(otaOv && otaOv.classList.contains('show')){ otaClose(); return true; }
  // 3. Egg overlay (мини-игры)
  const eggOv = document.getElementById('egg-overlay');
  if(eggOv && eggOv.classList.contains('show')){
    const eggBack = document.getElementById('egg-back');
    if(eggBack && eggBack.classList.contains('show')){
      eggShowPicker(); // из игры → обратно в пикер
    } else {
      eggClose(); // из пикера → закрыть overlay
    }
    return true;
  }
  // 4. Экран расписания — особая логика (учитель/студент)
  if(cur === 's-schedule'){
    try { schedBack(); } catch(e){ goHome(); }
    return true;
  }
  // 5. Обычная навигация
  const info = SCREEN_PARENTS[cur];
  if(info){
    if(info.parent==='s-home'){
      goHome();
    } else {
      showScreen(info.parent,'back');
      if(info.nav) updateNavActive(info.nav);
    }
    return true;
  }
  return false;
}

// ── Плавные переходы: ВСЕГДА с анимацией ──
// requestIdleCallback: если браузер занят — ждём свободный момент, потом анимируем.
// Анимация не пропускается, просто может начаться чуть позже.
// ── Telegram-style transitions (button-triggered) ─────────────────
const TRANS_DUR = 280;
const TRANS_EASE = 'cubic-bezier(0.4,0,0.2,1)';

function _doTransition(prev, next, dir) {
  const isTabLeft = dir === 'tab-left';
  const isBack    = dir === 'back';
  const w = window.innerWidth;

  const DECEL = 'cubic-bezier(0.215, 0.61, 0.355, 1.0)';
  const tFwd  = `transform ${TRANS_DUR}ms ${DECEL}, opacity ${Math.round(TRANS_DUR*0.85)}ms ${DECEL}`;

  // Единая модель для ВСЕХ переходов:
  // prev (уходящий) всегда z:2 — сверху, уезжает в нужную сторону
  // next (входящий) всегда z:1 — снизу, выезжает из-под prev

  // Куда уезжает prev и откуда появляется next
  const prevEndX   = (isBack || isTabLeft) ? w : -w;       // вправо при назад/tab-left, влево при forward
  const nextStartX = (isBack || isTabLeft) ? -w * 0.28 : w * 0.28;

  setNoTransStyle(next, `translateX(${nextStartX}px)`, '0.65');
  next.style.zIndex = '1';
  prev.style.zIndex = '2';
  void next.getBoundingClientRect();

  requestAnimationFrame(() => requestAnimationFrame(() => {
    prev.style.transition    = tFwd;
    prev.style.transform     = `translateX(${prevEndX}px) translateZ(0)`;
    prev.style.opacity       = '1';
    prev.style.pointerEvents = 'none';
    prev.classList.remove('active');

    next.style.transition    = tFwd;
    next.style.transform     = 'translateX(0) translateZ(0)';
    next.style.opacity       = '1';
    next.classList.add('active');
  }));

  setTimeout(() => {
    prev.style.cssText = '';
    next.style.cssText = '';
  }, TRANS_DUR + 60);
}

function setNoTransStyle(el, transform, opacity) {
  el.style.transition = 'none';
  el.style.transform  = transform + ' translateZ(0)';
  el.style.opacity    = opacity;
  el.style.pointerEvents = 'none';
}
let _pendingScreenId=null;
function showScreen(id, dir='forward'){
  if(id===cur)return;
  const prev=document.getElementById(cur), next=document.getElementById(id);
  // При открытии экрана тем — рендерим темы и иконки заранее
  if(id==='s-themes'){renderThemeGrid();renderIconGrid();initFontCarousel();}
  // Управляем классом главного экрана (влияет на live-blur canvas)
  if(id==='s-home') document.body.classList.add('on-home-screen');
  else document.body.classList.remove('on-home-screen');
  cur=id; _pendingScreenId=id;
  const go=()=>{
    if(_pendingScreenId!==id)return;
    _doTransition(prev, next, dir);
  };
  if(typeof requestIdleCallback!=='undefined'){
    requestIdleCallback(go, {timeout:80});
  } else {
    setTimeout(go, 0);
  }
}

function goHome(){
  showScreen('s-home','back');
  document.body.classList.add('on-home-screen');
  updateNavActive('nav-home');
  updateLastGroupBtn();
  const fs=document.getElementById('file-section');
  const err=document.getElementById('home-error-hint');
  const noUrl=document.getElementById('no-url-hint');
  // Не перезагружаем файлы если они уже загружены (устраняет лаг)
  const alreadyLoaded = S.files && S.files.length > 0;
  if(!alreadyLoaded && fs.classList.contains('hidden')&&err.classList.contains('hidden')&&noUrl.classList.contains('hidden')){
    loadFiles();
  }
}

// navTo с правильным направлением: для вкладок всегда "forward" (единая модель),
// для не-вкладок обычная логика
const _TAB_ORDER_NAV = ['s-home','s-bells','s-messenger','s-profile'];
function navTo(id, navId) {
  // Для главных вкладок — всегда единая модель (target сверху)
  // Направление передаём как 'forward' или 'back' только для _doTransition,
  // но визуально таб всегда работает по одной модели
  const fromIdx = _TAB_ORDER_NAV.indexOf(cur);
  const toIdx   = _TAB_ORDER_NAV.indexOf(id);
  // Передаём dir чтобы _doTransition знал откуда приедет target
  // forward = справа, back = слева — оба на z:2 сверху
  const dir = (fromIdx >= 0 && toIdx >= 0 && toIdx < fromIdx) ? 'tab-left' : 'forward';
  showScreen(id, dir);
  updateNavActive(navId);
}

function updateNavActive(aid) {
  ['nav-home','nav-bells','nav-settings','nav-profile'].forEach(id =>
    document.getElementById(id)?.classList.toggle('active', id === aid)
  );
  _navMovePill(aid);
}

// ── Sliding pill indicator (как тумблер ученик/учитель) ────────────
// Порядок вкладок для pill
const _NAV_PILL_IDS = ['nav-home', 'nav-bells', 'nav-messenger', 'nav-profile'];

function _navMovePill(activeId) {
  const pill    = document.getElementById('nav-pill');
  const btn     = document.getElementById(activeId);
  const nav     = document.getElementById('global-bottom-nav');
  if (!pill || !btn || !nav) return;

  // Читаем реальные координаты в момент тапа — работает на любом DPI
  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();

  const left  = btnRect.left  - navRect.left + 4;
  const width = btnRect.width - 8;

  pill.style.left  = left  + 'px';
  pill.style.width = width + 'px';
}

// ── Показывать навигацию только на нужных экранах ──────────────────────────
const NAV_VISIBLE_SCREENS = new Set(['s-home','s-settings','s-bells','s-profile','s-messenger','s-groups-chat']);
function updateNavVisibility(screenId) {
  const nav = document.getElementById('global-bottom-nav');
  if (!nav) return;
  const hasNav = NAV_VISIBLE_SCREENS.has(screenId);
  if (hasNav) {
    nav.classList.remove('nav-hidden');
  } else {
    nav.classList.add('nav-hidden');
  }
  // Убираем/добавляем лишний padding-bottom на самом экране
  const screenEl = document.getElementById(screenId);
  if (screenEl) {
    if (hasNav) {
      screenEl.classList.remove('no-nav-padding');
    } else {
      screenEl.classList.add('no-nav-padding');
    }
  }
}

// ── Patch showScreen to update nav visibility ──────────────────────────────
const _origShowScreenNav = showScreen;
showScreen = function(id, dir) {
  // Закрываем меню реакций/действий при уходе из чата
  if (id !== 's-messenger-chat') {
    try { mcCloseMenu(); } catch(e){}
    const fwdSheet = document.getElementById('mc-forward-sheet');
    if (fwdSheet) fwdSheet.remove();
  }
  _origShowScreenNav(id, dir);
  updateNavVisibility(id);
};

// ══════════════════════════════════════════════════════════════════
// ── UNIFIED GESTURE NAVIGATION (Telegram-style live swipe) ────────
// ══════════════════════════════════════════════════════════════════
(function() {
  // Порядок вкладок для горизонтального свайпа на главных экранах
  const TAB_ORDER  = ['s-home', 's-bells', 's-messenger', 's-profile'];
  const TAB_NAVIDS = ['nav-home','nav-bells','nav-messenger','nav-profile'];

  // Маршруты «Назад» для под-экранов
  const BACK_MAP = {
    's-groups':         's-home',
    's-schedule':       's-groups',
    's-themes':         's-settings',
    's-teachers':       's-home',
    's-shorts':         's-home',
    's-profile-edit':   's-profile',
    's-messenger':      's-profile',
    's-messenger-chat': 's-messenger',
    's-online':         's-profile',
    's-leaderboard':    's-profile',
    's-login':          's-home',
    's-peer-profile':   's-messenger-chat',
    's-settings':       's-profile',
    's-bells':          's-home',
    's-homework':       's-home',
    's-groups-chat':    's-profile',
  };

  // Экраны где свайп вниз = назад (sub-screens типа расписания, тем)
  const SWIPE_DOWN_BACK = new Set([
    's-schedule', 's-themes', 's-login',
    's-profile-edit',
  ]);
  // Остальные sub-screens (messenger и соц.) = горизонтальный свайп вправо

  const W = () => window.innerWidth;
  const H = () => window.innerHeight;
  const COMMIT_RATIO = 0.35; // порог для подтверждения перехода
  const EASE = `cubic-bezier(0.4,0,0.2,1)`;
  const DUR  = 280;

  let g = {
    active: false,
    mode: null,        // 'tab-h' | 'back-h' | 'back-v' | 'scroll'
    startX: 0, startY: 0, startT: 0,
    targetId: null,
    targetNavId: null,
    dir: null,         // 'left' | 'right' | 'down'
    decided: false,
  };
  let g_lastMode = null; // сохраняется для commitTransition

  function getBackTarget() { return BACK_MAP[cur] || null; }

  function setNoTransition(el) {
    el.style.transition = 'none';
    void el.getBoundingClientRect();
  }

  function applyT(el, tx, ty, opacity, zIndex) {
    el.style.transform = `translate(${tx}px,${ty}px) translateZ(0)`;
    if (opacity !== undefined) el.style.opacity = String(opacity);
    if (zIndex  !== undefined) el.style.zIndex  = String(zIndex);
  }

  function clearStyle(el) {
    el.style.cssText = '';
  }

  // easeOutQuart — резкий старт, плавное торможение (как в Telegram)
  const EASE_OUT = 'cubic-bezier(0.215, 0.61, 0.355, 1.0)';
  // easeOutBack — небольшой пружинный отскок для snap-back
  const EASE_SNAP = 'cubic-bezier(0.34, 1.2, 0.64, 1)';

  function commitTransition(toId, toNavId, transDir, dur) {
    dur = dur || DUR;
    const fromEl = document.getElementById(cur);
    const toEl   = document.getElementById(toId);
    const t = `transform ${dur}ms ${EASE_OUT}, opacity ${Math.round(dur*0.85)}ms ${EASE_OUT}`;
    const isBack = transDir === 'back';
    const w = window.innerWidth;

    if (toEl) {
      toEl.style.transition    = t;
      toEl.style.transform     = 'translateX(0) translateZ(0)';
      toEl.style.opacity       = '1';
      toEl.style.zIndex        = '1'; // next всегда снизу открывается
      toEl.style.pointerEvents = 'all';
      toEl.classList.add('active');
    }
    if (fromEl) {
      // prev всегда сверху уезжает — вправо для back/tab-right, влево для tab-left/forward
      const isLeft = g_lastMode === 'tab-h' && !isBack; // свайп влево = уходим влево
      fromEl.style.transition    = t;
      fromEl.style.transform     = isLeft
        ? `translateX(${-w}px) translateZ(0)`
        : `translateX(${w}px) translateZ(0)`;
      fromEl.style.opacity       = '1';
      fromEl.style.zIndex        = '2';
      fromEl.style.pointerEvents = 'none';
      fromEl.classList.remove('active');
    }

    const prevCur = cur;
    cur = toId;
    _pendingScreenId = toId;

    // Закрываем клавиатуру если уходим из чата свайпом
    if (prevCur === 's-messenger-chat') {
      try { document.activeElement?.blur(); } catch(_) {}
      const mcInp = document.getElementById('mc-input');
      if (mcInp) mcInp.blur();
    }

    updateNavVisibility(toId);
    if (toNavId) updateNavActive(toNavId);
    if (toId === 's-home') document.body.classList.add('on-home-screen');
    else document.body.classList.remove('on-home-screen');

    // Screen-specific hooks (только для не-таб экранов, чтобы не лагало)
    if (toId === 's-profile')   { try { profileRenderScreen(); } catch(e){} }
    if (toId === 's-messenger') { try { messengerRenderList(); } catch(e){} }
    if (toId === 's-themes')    { renderThemeGrid(); renderIconGrid(); initFontCarousel(); }

    SFX.play(isBack ? 'screenBack' : 'screenPush');

    setTimeout(() => {
      const fe = document.getElementById(prevCur);
      const te = document.getElementById(toId);
      if (fe) clearStyle(fe);
      if (te) clearStyle(te);
    }, DUR + 60);
  }

  function snapBack(dur) {
    dur = dur || 260;
    const fromEl = document.getElementById(cur);
    const toEl   = g.targetId ? document.getElementById(g.targetId) : null;
    const t = `transform ${dur}ms ${EASE_SNAP}, opacity ${Math.round(dur*0.8)}ms ${EASE_SNAP}`;

    // prev вернулся на место (z:2 остаётся сверху)
    if (fromEl) {
      fromEl.style.transition    = t;
      fromEl.style.transform     = 'translateX(0) translateZ(0)';
      fromEl.style.opacity       = '1';
      fromEl.style.zIndex        = '2';
      fromEl.style.pointerEvents = 'all';
    }
    // target уходит обратно на своё место (z:1 снизу)
    if (toEl) {
      const resetX = g.dir === 'left'  ? W() * 0.28
                   : g.dir === 'right' ? -W() * 0.28
                   : 0;
      const resetY = g.dir === 'down'  ? -H() * 0.15 : 0;
      toEl.style.transition    = t;
      toEl.style.transform     = `translate(${resetX}px,${resetY}px) translateZ(0)`;
      toEl.style.opacity       = '0.65';
      toEl.style.zIndex        = '1';
      toEl.style.pointerEvents = 'none';
    }
    setTimeout(() => {
      if (fromEl) clearStyle(fromEl);
      if (toEl)   clearStyle(toEl);
    }, dur + 60);
  }

  // ── touchstart ───────────────────────────────────────────────────
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) { g.active = false; return; }
    const t = e.touches[0];
    g = {
      active: true, decided: false,
      mode: null, targetId: null, targetNavId: null, dir: null,
      startX: t.clientX, startY: t.clientY,
      startT: Date.now(),
    };
  }, { passive: true });

  // ── touchmove ────────────────────────────────────────────────────
  document.addEventListener('touchmove', (e) => {
    if (!g.active) return;
    const t = e.touches[0];
    const dx = t.clientX - g.startX;
    const dy = t.clientY - g.startY;
    const adx = Math.abs(dx), ady = Math.abs(dy);

    // Determine mode on first movement > 8px
    if (!g.decided && (adx > 8 || ady > 8)) {
      g.decided = true;
      const isTab = TAB_ORDER.includes(cur);
      const idx   = TAB_ORDER.indexOf(cur);

      if (isTab) {
        // На вкладках: горизонтальный свайп между вкладками
        // Защита: горизонталь должна явно доминировать (adx > ady*1.8) и пройти 18px
        if (adx > ady * 1.8 && adx > 18) {
          if (dx < 0 && idx < TAB_ORDER.length - 1) {
            // Свайп ВЛЕВО → следующая вкладка
            g.mode      = 'tab-h';
            g.dir       = 'left';
            g.targetId  = TAB_ORDER[idx + 1];
            g.targetNavId = TAB_NAVIDS[idx + 1];
          } else if (dx > 0 && idx > 0) {
            // Свайп ВПРАВО → предыдущая вкладка
            g.mode      = 'tab-h';
            g.dir       = 'right';
            g.targetId  = TAB_ORDER[idx - 1];
            g.targetNavId = TAB_NAVIDS[idx - 1];
          } else {
            g.mode = 'scroll';
          }
        } else if (cur === 's-home' && ady > adx * 1.5 && dy < -80) {
          // ── Свайп ВВЕРХ на главном экране → открыть консоль ──
          g.mode   = 'scroll'; // не анимируем переход экрана
          g.active = false;
          logOpen();
        } else {
          g.mode = 'scroll';
        }
      } else {
        // Под-экраны
        const useDown = SWIPE_DOWN_BACK.has(cur);
        // back-h: только если свайп начат с левой кромки (≤45px) — как iOS edge swipe
        const fromLeftEdge = g.startX <= 45;
        if (useDown && ady > adx && dy > 0) {
          // back-v только если скролл-контейнер уже в самом верху
          const scrollEl = document.querySelector('#' + cur + ' .body');
          const atTop = !scrollEl || scrollEl.scrollTop <= 4;
          if (atTop) {
            g.mode     = 'back-v';
            g.dir      = 'down';
            g.targetId = getBackTarget();
          } else {
            g.mode = 'scroll';
          }
        } else if (!useDown && adx > ady * 1.5 && dx > 0) {
          // back-h: горизонталь доминирует — свайп с любой части экрана
          g.mode     = 'back-h';
          g.dir      = 'right';
          g.targetId = getBackTarget();
        } else {
          g.mode = 'scroll';
        }
      }

      if (g.mode !== 'scroll' && g.targetId) {
        // Pre-position target screen
        const targetEl = document.getElementById(g.targetId);
        const fromEl   = document.getElementById(cur);
        if (g.mode === 'tab-h') {
          // Единая модель: текущий (prev) z:2 сверху уезжает, цель z:1 снизу появляется
          const nextStartX = g.dir === 'left' ? W() * 0.28 : -W() * 0.28;
          if (targetEl) { setNoTransition(targetEl); applyT(targetEl, nextStartX, 0, 0.65, 1); }
          if (fromEl)   { setNoTransition(fromEl);   fromEl.style.zIndex = '2'; }
        } else if (g.mode === 'back-h') {
          // Back: current on top, target peeks from left
          if (targetEl) { setNoTransition(targetEl); applyT(targetEl, -W()*0.28, 0, 0.65, 1); }
          if (fromEl)   { setNoTransition(fromEl);   fromEl.style.zIndex = '2'; }
        } else { // back-v
          if (targetEl) { setNoTransition(targetEl); applyT(targetEl, 0, -H()*0.15, 0.65, 1); }
          if (fromEl)   { setNoTransition(fromEl);   fromEl.style.zIndex = '2'; }
        }
      } else if (g.mode === 'scroll') {
        g.active = false;
      }
    }

    if (!g.decided || g.mode === 'scroll' || !g.targetId) return;
    e.preventDefault();

    const fromEl   = document.getElementById(cur);
    const targetEl = document.getElementById(g.targetId);

    if (g.mode === 'tab-h') {
      // prev сверху (z:2) следует за пальцем, target снизу (z:1) появляется из-под
      const clampedDx = g.dir === 'left' ? Math.min(0, dx) : Math.max(0, dx);
      const progress   = Math.abs(clampedDx) / W();
      const nextStartX = g.dir === 'left' ? W() * 0.28 : -W() * 0.28;

      if (fromEl)   applyT(fromEl,   clampedDx, 0, 1, 2);
      if (targetEl) applyT(targetEl, nextStartX * (1 - progress), 0, 0.65 + 0.35 * progress, 1);

    } else if (g.mode === 'back-h') {
      const clampedDx = Math.max(0, dx);
      const progress = clampedDx / W();
      if (fromEl)   applyT(fromEl,   clampedDx, 0, 1, 2);
      if (targetEl) applyT(targetEl, -W()*0.28*(1-progress), 0, 0.65 + 0.35*progress, 1);

    } else if (g.mode === 'back-v') {
      const clampedDy = Math.max(0, dy);
      const progress = clampedDy / H();
      if (fromEl)   applyT(fromEl,   0, clampedDy, 1, 2);
      if (targetEl) applyT(targetEl, 0, -H()*0.15*(1-progress), 0.65 + 0.35*progress, 1);
    }

  }, { passive: false });

  // ── touchend ─────────────────────────────────────────────────────
  document.addEventListener('touchend', (e) => {
    if (!g.active || g.mode === 'scroll' || !g.targetId) { g.active = false; return; }
    g.active = false;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - g.startX;
    const dy = touch.clientY - g.startY;
    const dt = Math.max(1, Date.now() - g.startT);
    const vx = Math.abs(dx) / dt * 1000; // px/s
    const vy = Math.abs(dy) / dt * 1000;

    let commit = false;
    if (g.mode === 'tab-h') {
      // Для вкладок: нужно пройти 40% ширины ИЛИ скорость > 500px/s — защита от случайных свайпов
      commit = Math.abs(dx) > W() * 0.40 || vx > 500;
    } else if (g.mode === 'back-h') {
      commit = dx > W() * COMMIT_RATIO || vx > 350;
    } else if (g.mode === 'back-v') {
      commit = dy > H() * COMMIT_RATIO || vy > 350;
    }

    if (commit) {
      const transDir = (g.mode === 'back-h' || g.mode === 'back-v' ||
                        (g.mode === 'tab-h' && g.dir === 'right')) ? 'back' : 'forward';

      // Сохраняем mode до вызова commitTransition
      g_lastMode = g.mode;

      // Velocity-aware duration: faster swipe → shorter finish
      const velocity = g.mode === 'back-v' ? vy : vx;
      const traveled = g.mode === 'back-v' ? Math.abs(dy) : Math.abs(dx);
      const total    = g.mode === 'back-v' ? H() : W();
      const remaining = total - traveled;
      const velBasedDur = velocity > 50 ? Math.min(remaining / velocity * 1000 * 1.1, 320) : 320;
      const finishDur = Math.max(120, Math.round(velBasedDur));

      commitTransition(g.targetId, g.targetNavId, transDir, finishDur);
    } else {
      // Snap back — velocity-aware too
      const velocity = g.mode === 'back-v' ? vy : vx;
      const traveled = g.mode === 'back-v' ? Math.abs(dy) : Math.abs(dx);
      const snapDur = Math.max(180, Math.min(320, traveled / Math.max(velocity, 30) * 1000 * 0.9));
      snapBack(Math.round(snapDur));
    }
  }, { passive: true });

})();

// ══════════════════════════════════════════════════════════════════
// ── ⬅️  Desktop Back Navigation (Mouse4 / Alt+Left / Backspace) ────
// ══════════════════════════════════════════════════════════════════
(function() {
  function desktopBack() {
    // 1. Если открыто game-window — закрываем его
    if (typeof _gameWindowEl !== 'undefined' && _gameWindowEl) {
      if (typeof gameWindowClose === 'function') gameWindowClose();
      return;
    }
    // 2. Если egg-overlay открыт
    const egg = document.getElementById('egg-overlay');
    if (egg && egg.classList.contains('show')) {
      if (typeof eggClose === 'function') eggClose();
      return;
    }
    // 3. По карте назад текущего экрана
    const activeScrEl = document.querySelector('.screen.active');
    const cur = activeScrEl ? activeScrEl.id : '';
    const BACK = {
      's-groups':'s-home','s-schedule':'s-groups','s-leaderboard':'s-profile',
      's-settings':'s-profile','s-group-settings':'s-groups','s-chat':'s-messenger',
      's-peer-profile':'s-messenger','s-theme-editor':'s-settings',
    };
    const target = BACK[cur];
    if (target && typeof showScreen === 'function') { showScreen(target); return; }
  }

  // Mouse Button 3 = "назад" (4-я кнопка мыши)
  document.addEventListener('mousedown', (e) => {
    if (e.button === 3) { e.preventDefault(); desktopBack(); }
  });

  // Alt+Left, Backspace вне полей ввода
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.altKey && e.code === 'ArrowLeft') { e.preventDefault(); desktopBack(); return; }
    if (e.code === 'Backspace' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault(); desktopBack();
    }
  });
})();

// ══ ПОСЛЕДНЯЯ ГРУППА — кнопка удалена, функция оставлена как заглушка ══
function updateLastGroupBtn(){}
function jumpToLastGroup(){}

// ══ ЗАГРУЗКА ══
function saveUrlAndLoad(){
  const inp=document.getElementById('url-input');
  const url=inp?inp.value.trim():'';
  if(!url){toast('Введи ссылку');return;}
  S.url=url;saveLocal();
  hideHomeHints();
  document.getElementById('file-section').classList.add('hidden');
  goHome();
  loadFiles();
}
async function loadFiles(){
  appLog('info','loadFiles: start, url='+S.url?.slice(0,40));
  if(!S.url){showHomeState('no-url');return;}
  hideHomeHints();

  // Если есть кэшированный список — показываем сразу, не ждём сеть
  const hasCached=S.files&&S.files.length>0;
  if(hasCached){
    renderFileList(true);
    setStatus('home-status','📦 Из кэша, обновляю...');
  }else{
    setStatus('home-status','Загружаю файлы...');setBar('home-bar',30);
  }

  try{
    const data=await yadGet('/v1/disk/public/resources',{public_key:S.url,limit:100});
    S.files=(data._embedded?.items||[]).filter(i=>i.type==='file'&&/\.(doc|docx)$/i.test(i.name))
      .map(i=>({name:i.name,path:i.path||('/'+i.name),size:i.size||0,resourceId:i.resource_id||''}));
    setBar('home-bar',100);setStatus('home-status',`Найдено: ${S.files.length} файлов`);
    setTimeout(()=>{setBar('home-bar',0);setStatus('home-status','');},1200);
    saveLocal(); // сохраняем обновлённый список файлов в кэш
    appLog('ok','loadFiles: loaded '+S.files.length+' files');
    renderFileList(false);
  }catch(e){
    appLog('err','loadFiles error: '+e.message);
    setBar('home-bar',0);setStatus('home-status','');
    if(hasCached){
      // Есть кэш — не ломаем UI, просто показываем офлайн-бейдж
      renderFileList(true);
      toast('📡 Нет интернета — расписание из кэша');
    }else{
      showHomeState('error',e.message);
    }
  }
}
function hideHomeHints(){
  ['no-url-hint','home-error-hint'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
}
function showHomeState(type,msg){
  hideHomeHints();
  document.getElementById('file-section').classList.add('hidden');
  if(type==='no-url'){
    document.getElementById('no-url-hint').classList.remove('hidden');
  } else if(type==='error'){
    const el=document.getElementById('home-error-hint');
    if(el){const em=el.querySelector('.error-msg');if(em)em.textContent=msg||'Ошибка подключения';el.classList.remove('hidden');}
  }
}
function renderFileList(isOffline=false){
  const list=document.getElementById('file-list');list.innerHTML='';
  if(isOffline){
    const badge=document.createElement('div');
    badge.style.cssText='text-align:center;padding:6px 12px;margin-bottom:8px;background:color-mix(in srgb,var(--accent) 12%,transparent);border-radius:10px;font-size:12px;color:var(--muted)';
    badge.textContent='📦 Офлайн — файлы из кэша';
    list.appendChild(badge);
  }
  S.files.forEach(f=>{
    const item=document.createElement('div');
    item.className='list-item'+(S.selectedFile?.name===f.name?' selected':'');
    item.innerHTML=`<span class="item-name">${f.name}</span>`;
    item.onclick=()=>{
      S.selectedFile=f;
      renderFileList(isOffline);
      // Сразу переходим к группам/педагогам без подтверждения
      goToGroups();
    };
    list.appendChild(item);
  });
  document.getElementById('file-section').classList.remove('hidden');
}

async function getFileBuf(){
  if(S.selectedFile&&S.selectedFile._localBuf){return S.selectedFile._localBuf;}
  const key=S.selectedFile.path||S.selectedFile.name;
  if(FILE_CACHE[key])return FILE_CACHE[key];

  // Проверяем персистентный кэш в IndexedDB
  const cached=await idbGet('file:'+key);
  if(cached){
    appLog('info','getFileBuf: из IndexedDB: '+key);
    FILE_CACHE[key]=cached;
    // Фоновое обновление если есть интернет
    _refreshFileBufInBackground(key,S.selectedFile);
    return cached;
  }

  // Загружаем из сети
  const filePath=S.selectedFile.path||('/'+S.selectedFile.name);
  const dl=await yadGet('/v1/disk/public/resources/download',{public_key:S.url,path:filePath});
  if(!dl||!dl.href) throw new Error('Яндекс не вернул ссылку на файл. Путь: '+filePath);
  const buf=await yadDownload(dl.href, S.selectedFile.name);
  FILE_CACHE[key]=buf;
  idbSet('file:'+key,buf).catch(()=>{}); // сохраняем в фоне
  return buf;
}

async function _refreshFileBufInBackground(key,fileRef){
  try{
    if(!navigator.onLine)return;
    const filePath=fileRef.path||('/'+key);
    const dl=await yadGet('/v1/disk/public/resources/download',{public_key:S.url,path:filePath});
    if(!dl||!dl.href)return;
    const buf=await yadDownload(dl.href,fileRef.name);
    FILE_CACHE[key]=buf;
    await idbSet('file:'+key,buf);
    appLog('ok','Файл обновлён в фоне: '+key);
  }catch(e){ /* тихо */ }
}

// ══ ГРУППЫ ══
async function goToGroups(){
  // Режим учителей — перенаправляем на список учителей
  if(typeof S!=='undefined'&&S.mode==='teacher'){
    return goToTeacherList();
  }
  if(!S.selectedFile){toast('Сначала выбери файл');return;}
  showScreen('s-groups');

  const title = S.selectedFile._localBuf ? '📄 '+S.selectedFile.name : S.selectedFile.name;
  document.getElementById('groups-title').textContent = title;
  document.getElementById('group-search').value = '';

  // Если группы уже загружены для этого файла — показываем мгновенно
  const fileKey = S.selectedFile.path || S.selectedFile.name;
  if (allGroups.length > 0 && S._lastGroupsFile === fileKey) {
    appLog('info','goToGroups: группы из кэша ('+allGroups.length+')');
    renderGroupList(allGroups);
    setStatus('groups-status', allGroups.length + ' групп');
    return;
  }

  // Показываем скелетон пока грузится
  const list = document.getElementById('group-list');
  list.innerHTML = Array(6).fill(0).map(()=>
    '<div style="height:48px;background:var(--surface2);border-radius:10px;margin-bottom:6px;animation:pulse 1.2s ease-in-out infinite"></div>'
  ).join('');
  setStatus('groups-status','Загружаю...');setBar('groups-bar',20);

  try{
    appLog('info','goToGroups: загружаю файл '+S.selectedFile.name);
    const buf = await getFileBuf();
    appLog('info','goToGroups: определяю группы...');
    allGroups = detectGroups(buf);
    S._lastGroupsFile = fileKey;
    appLog('ok','goToGroups: найдено '+allGroups.length+' групп');
    setBar('groups-bar',100);
    setStatus('groups-status', allGroups.length + ' групп');
    setTimeout(()=>setBar('groups-bar',0),800);
    renderGroupList(allGroups);
  }catch(e){
    appLog('err','goToGroups error: '+e.message);
    setBar('groups-bar',0);
    setStatus('groups-status','❌ '+e.message);
    list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)">❌ '+e.message+'</div>';
  }
}
function renderGroupList(groups){
  const list=document.getElementById('group-list');list.innerHTML='';
  // Последняя выбранная группа всегда первой
  const sorted = [...groups].sort((a, b) => {
    if(S.lastGroup && a === S.lastGroup) return -1;
    if(S.lastGroup && b === S.lastGroup) return 1;
    return 0;
  });
  sorted.forEach(g=>{
    const item=document.createElement('div');
    item.className='list-item'+(S.lastGroup===g?' selected':'');
    item.innerHTML=`<span class="item-name">${g}</span>`;
    item.onclick=()=>{
      // Показываем визуальный отклик — спиннер в строке
      list.querySelectorAll('.list-item').forEach(el=>el.classList.remove('selected'));
      item.classList.add('selected');
      item.innerHTML=`<span class="item-name">${g}</span><span class="loading-spinner" style="opacity:.6"></span>`;
      loadSchedule(g);
    };
    list.appendChild(item);
  });
}
function filterGroups(q){
  const f=q.trim().toUpperCase();
  renderGroupList(f?allGroups.filter(g=>g.toUpperCase().includes(f)):allGroups);
}

// ══ РАСПИСАНИЕ ══
// Разбирает строку "Никитина Ю.В.к.17(2)" на имя преподавателя и кабинет
// Разбирает строку вида "Фамилия И.О.к.21(1)" на компоненты
function parseTeacherLine(line){
  // Ищем паттерн: к.NN(N) или к.NN
  const ki=line.search(/к\.\d/);
  if(ki<0)return{teacher:line.trim(),cabinetNum:'',korpus:''};
  const teacher=line.slice(0,ki).trim();
  const cabPart=line.slice(ki); // "к.21(1)" или "к.21"
  const numM=cabPart.match(/к\.(\d+)/);
  const korpM=cabPart.match(/\((\d)\)/);
  return{
    teacher,
    cabinetNum:numM?numM[1]:'',
    korpus:korpM?korpM[1]:''
  };
}

// Формирует HTML для строки деталей пары (преподаватель + кабинет + корпус)
function renderDetailLine(line){
  const p=parseTeacherLine(line);
  if(!p.cabinetNum)return`<span>${line}</span>`;
  let html=`<span>${p.teacher}</span>`;
  html+=`<br><span>кабинет ${p.cabinetNum}</span>`;
  if(p.korpus)html+=`<br><span>корпус ${p.korpus}</span>`;
  return html;
}

// Пытается отделить преподавателя+кабинет, если они слиты с названием предмета в одну строку
// Например: "Основы алгоритмизации и программирования Кубасова В.В.к.21(1)"
function splitSubjectAndTeacher(subjectLine){
  // Паттерн: за текстом предмета идёт Фамилия (одно/два слова) И.О. (два инициала с точками)
  // Дополнительно может идти к.NN(N)
  const m=subjectLine.match(
    /^(.+?)\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?\s+[А-ЯЁ]\.[А-ЯЁ]\.(к\.\d+(?:\(\d\))?)?)$/u
  );
  if(m&&m[1].trim().length>2){
    return{subject:m[1].trim(),teacherStr:m[2].trim()};
  }
  return null;
}
async function loadSchedule(group){
  if(!S.selectedFile){toast('Выбери файл');return;}
  showScreen('s-schedule');
  S.lastGroup=group;saveLocal();updateLastGroupBtn();
  document.getElementById('sched-group-name').textContent=group;
  document.getElementById('sched-date').textContent='';
  // Красивая анимация загрузки
  document.getElementById('sched-body').innerHTML=
    `<div class="sched-loading">
      <div class="sched-loading-circle"></div>
      <div style="color:var(--muted);font-size:13px;font-weight:500">Загружаю расписание…</div>
      <div class="sched-loading-dots">
        <div class="sched-loading-dot"></div>
        <div class="sched-loading-dot"></div>
        <div class="sched-loading-dot"></div>
      </div>
    </div>`;
  try{
    const buf=await getFileBuf();
    const{sched,hdr}=parseDoc(buf,group);
    if(!sched.length)throw new Error(`Группа "${group}" не найдена`);
    renderSchedule(group,hdr,sched,S.selectedFile.name);
  }catch(e){
    document.getElementById('sched-body').innerHTML=`<div style="text-align:center;padding:50px;color:var(--danger)">❌ ${e.message}</div>`;
  }
}
function renderSchedule(group,hdr,sched,filename){
  checkCurrentPairEnd();
  document.getElementById('sched-group-name').textContent=group;
  const cleanDate=formatScheduleDate(hdr);
  document.getElementById('sched-date').textContent=cleanDate||'';
  // Проверяем совпадение даты расписания с сегодняшней
  const dateM=hdr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  const today=new Date();
  let isToday=false;
  if(dateM){
    const sd=new Date(+dateM[3],+dateM[2]-1,+dateM[1]);
    isToday=(sd.getFullYear()===today.getFullYear()&&sd.getMonth()===today.getMonth()&&sd.getDate()===today.getDate());
  }
  const isMon=filename.toUpperCase().includes('ПОНЕДЕЛЬНИК');
  const isSat=filename.toUpperCase().includes('СУББОТ');
  const bell=isMon?BELL_MON:isSat?BELL_SAT:BELL_TUE;
  const nowMin=today.getHours()*60+today.getMinutes();
  const body=document.getElementById('sched-body');body.innerHTML='';
  for(const[roman,lesson]of sched){
    const b=bell[roman];
    let isNow=false,isNext=false;
    if(isToday&&b&&b[0]){
      const[sh,sm]=b[0].split(':').map(Number);
      const endS=b[3]||b[1];
      const[eh,em]=endS.split(':').map(Number);
      const startMin=sh*60+sm,endMin=eh*60+em;
      isNow=nowMin>=startMin&&nowMin<=endMin;
      if(!isNow){const diff=startMin-nowMin;isNext=diff>0&&diff<=30;}
    }
    let lines=lesson?lesson.split('\n').map(l=>l.trim()).filter(Boolean):[];
    // Если преподаватель и кабинет слиты с названием предмета в одну строку — разделяем
    if(lines.length>0){
      const split=splitSubjectAndTeacher(lines[0]);
      if(split)lines=[split.subject,split.teacherStr,...lines.slice(1)];
    }
    const isEmpty=!lines.length;
    const card=document.createElement('div');
    card.className='pair-card'+(isEmpty?'':' has-subject')+(isNow?' is-now':isNext?' is-next':'');
    let badge='',remain='';
    if(isNow){
      badge='<span class="now-badge">● сейчас</span>';
      if(b&&b[1]){const endS=b[3]||b[1];const[eh,em]=endS.split(':').map(Number);const diff=(eh*60+em)-nowMin;remain=`<div class="pair-remain">${diff<=0?'заканч.':diff+' мин'}</div>`;}
    }else if(isNext){badge='<span class="now-badge next-badge">◎ скоро</span>';}
    let timesHtml='';
    if(b){
      const[s1,e1,s2,e2]=b;
      timesHtml=`<div class="pair-times"><div class="pair-time-row"><span class="pair-time-val">${s1} – ${e1}</span><span class="pair-time-tag">${s2?'1 урок':'60 мин'}</span></div>${s2?`<div class="pair-time-row"><span class="pair-time-val">${s2} – ${e2}</span><span class="pair-time-tag">2 урок</span></div>`:''}</div>`;
    }
    const detailsHtml=lines.length>1
      ?`<div class="pair-details">${lines.slice(1).map(l=>renderDetailLine(l)).join('<br>')}</div>`
      :'';
    card.innerHTML=`<div class="pair-top"><div class="pair-num">${roman}</div><div class="pair-subject-wrap"><div class="pair-subject${isEmpty?' empty':''}">${isEmpty?'Окно':lines[0]}</div>${badge}</div>${remain}</div>${timesHtml}${detailsHtml}`;
    body.appendChild(card);
  }
  addNoteButtons(body, group);
}

// ══ ПРИВЕТСТВИЕ ══
const APP_VERSION = (window.Android && typeof window.Android.getAppVersion === 'function')
  ? window.Android.getAppVersion()
  : '4.4.16';
function getGreeting(){
  const now=new Date();
  const special=getSpecialDateGreeting();
  if(special)return special;
  const h=now.getHours();
  const dow=now.getDay(); // 0=вс, 6=сб
  const isWeekend=(dow===0||dow===6);
  if(isWeekend){
    if(h>=5&&h<12) return{greet:'Доброе утро',icon:'🛋',sub:'Сегодня выходной — отдыхай!'};
    if(h>=12&&h<17) return{greet:'Добрый день',icon:'😎',sub:'Хороших выходных!'};
    if(h>=17&&h<22) return{greet:'Добрый вечер',icon:'🌆',sub:'Наслаждайся вечером 🎉'};
    return{greet:'Доброй ночи',icon:'🌙',sub:'Выходные — не повод не спать 😅'};
  }
  if(h>=5&&h<12) return{greet:'Доброе утро',icon:'🌤',sub:'Хорошего учебного дня!'};
  if(h>=12&&h<17) return{greet:'Добрый день',icon:'☀️',sub:'Успехов на парах!'};
  if(h>=17&&h<22) return{greet:'Добрый вечер',icon:'🌇',sub:'Время отдохнуть.'};
  return{greet:'Доброй ночи',icon:'🌙',sub:'Не забудь поспать 😴'};
}
function showGreeting(){
  trackVisit();
  setTimeout(()=>{try{var ms=document.getElementById('greet-sub');if(ms&&Math.random()<0.3)ms.textContent=getDayMotivation();}catch(e){}},250);
  const ov=document.getElementById('greeting-overlay');
  if(!ov)return;
  const stored=loadSecret();
  if(stored.greetingOff){ov.classList.add('greet-hidden');return;}

  const now=new Date();
  const g=getGreeting();
  const hh=String(now.getHours()).padStart(2,'0');
  const mm=String(now.getMinutes()).padStart(2,'0');

  // Обновляем логотип и подзаголовок
  const logo=document.getElementById('greet-logo');
  const sub=document.getElementById('greet-sub');
  const time=document.getElementById('greet-time');
  if(logo) logo.textContent=g.icon;
  if(sub)  sub.textContent=g.sub;
  if(time) time.textContent=hh+':'+mm;

  // Typewriter — выводим буквы одна за одной
  const main=document.getElementById('greet-main');
  if(main){
    main.innerHTML='';
    const text=g.greet;
    text.split('').forEach((ch,i)=>{
      const span=document.createElement('span');
      span.className='greet-char';
      span.textContent=ch==' '?'\u00a0':ch;
      span.style.animationDelay=(i*55+80)+'ms';
      main.appendChild(span);
    });
  }

  // Частицы фона
  const pc=document.getElementById('greet-particles');
  if(pc){
    pc.innerHTML='';
    for(let i=0;i<12;i++){
      const p=document.createElement('div');
      p.className='greet-particle';
      const sz=4+Math.random()*8;
      p.style.cssText=`width:${sz}px;height:${sz}px;left:${Math.random()*100}%;bottom:${Math.random()*50}%;--dur:${2.5+Math.random()*2.5}s;--del:${Math.random()*2}s`;
      pc.appendChild(p);
    }
  }

  // Показываем overlay (он уже display:flex по умолчанию)
  ov.classList.remove('greet-hidden');

  // Скрываем через 2.2 сек
  setTimeout(skipGreeting, 1800);
}

function skipGreeting(){
  const ov=document.getElementById('greeting-overlay');
  if(!ov||ov.classList.contains('greet-hidden'))return;
  ov.classList.add('greet-hidden');
  // После окончания перехода — полностью убираем с DOM
  const done=()=>{ov.classList.add('greet-done');ov.removeEventListener('transitionend',done);};
  ov.addEventListener('transitionend',done,{once:true});
  // Fallback если transitionend не стрельнул (браузеры без transitions)
  setTimeout(()=>ov.classList.add('greet-done'),700);
}

// ══ 4 ТАПА ПО ЗАГОЛОВКУ → CMD (только МПД-2-24) ══
let _schedTapCount=0,_schedTapTimer=null;
function initSchedTapTrigger(){
  const el=document.getElementById('sched-header-tap');
  if(!el)return;
  el.addEventListener('click',e=>{
    if(S.lastGroup!=='МПД-2-24')return;
    _schedTapCount++;
    clearTimeout(_schedTapTimer);
    _schedTapTimer=setTimeout(()=>{_schedTapCount=0;},800);
    if(_schedTapCount>=4){_schedTapCount=0;clearTimeout(_schedTapTimer);SFX.play('themeSelect');cmdOpen();}
  });
}

// ══ SWIPE-COMBO НА ГЛАВНОЙ → CMD (↑ → → ↓) ══
(function(){
  const SEQ = ['up','right','right','down'];
  let _combo = [];
  let _swipeStartX = 0, _swipeStartY = 0;
  let _comboTimer = null;
  const RESET_MS = 1800;   // сброс если пауза > 1.8s
  const MIN_DIST = 40;     // мин. длина свайпа в px

  function _resetCombo(){ _combo = []; }

  function _onDir(dir){
    // работаем только когда главный экран активен
    const home = document.getElementById('s-home');
    if(!home || !home.classList.contains('active')) return;

    clearTimeout(_comboTimer);
    _comboTimer = setTimeout(_resetCombo, RESET_MS);

    _combo.push(dir);
    // проверяем совпадение с хвостом SEQ
    if(_combo.length > SEQ.length) _combo.shift();
    if(_combo.join(',') === SEQ.join(',') ){
      _combo = [];
      clearTimeout(_comboTimer);
      SFX.play('themeSelect');
      cmdOpen();
    }
  }

  function _attachHome(){
    const home = document.getElementById('s-home');
    if(!home) return;
    home.addEventListener('touchstart', e=>{
      const t = e.changedTouches[0];
      _swipeStartX = t.clientX;
      _swipeStartY = t.clientY;
    }, {passive:true});
    home.addEventListener('touchend', e=>{
      const t = e.changedTouches[0];
      const dx = t.clientX - _swipeStartX;
      const dy = t.clientY - _swipeStartY;
      if(Math.abs(dx) < MIN_DIST && Math.abs(dy) < MIN_DIST) return;
      if(Math.abs(dx) > Math.abs(dy)){
        _onDir(dx > 0 ? 'right' : 'left');
      } else {
        _onDir(dy > 0 ? 'down' : 'up');
      }
    }, {passive:true});
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _attachHome);
  } else {
    _attachHome();
  }
})();

// ══ SECRET STORAGE ══
const SECRET_KEY='sched_secret';
function loadSecret(){try{return JSON.parse(stor.get(SECRET_KEY)||'{}')}catch(e){return{};}}
function saveSecret(obj){stor.set(SECRET_KEY,JSON.stringify(obj));}

// ══ РЕКОРДЫ МНИ-ИГР ══
const HI_KEY='sched_hiscores';
function loadHiScores(){try{return JSON.parse(stor.get(HI_KEY)||'{}');}catch(e){return{};}}
function saveHi(game, score) {
  // Читы активны — рекорды не сохраняются ни локально, ни в Supabase
  if (window._cheatModeActive) {
    return Math.max(score, loadHiScores()[game] || 0);
  }
  const h = loadHiScores();
  if (!h[game] || score > h[game]) {
    h[game] = score;
    stor.set(HI_KEY, JSON.stringify(h));
    // Отправляем в Supabase лидерборд если пользователь авторизован
    try {
      if (typeof sbReady === 'function' && sbReady() &&
          typeof profileLoad === 'function' && typeof sbUpsert === 'function') {
        const p = profileLoad();
        if (p) {
          sbUpsert('leaderboard', {
            game,
            username: p.username,
            name:     p.name,
            avatar:   p.avatar,
            color:    p.color || '#e87722',
            score,
            ts: Date.now()
          });
          if (typeof Android !== 'undefined' && typeof Android.log === 'function') {
            Android.log('[LB] saveHi: ' + game + ' score=' + score + ' user=@' + p.username);
          }
        }
      }
    } catch(e) {}
  }
  return Math.max(score, h[game] || 0);
}
function getHi(game){return loadHiScores()[game]||0;}

// ── Применяем чит-режим к играм ──────────────────────────────────
function _applyCheatMode(on) {
  // Визуальный HUD — красная плашка вверху
  document.getElementById('cheat-hud')?.remove();
  if (on) {
    const hud = document.createElement('div');
    hud.id = 'cheat-hud';
    hud.style.cssText = [
      'position:fixed;top:0;left:0;right:0;z-index:88888;',
      'background:rgba(200,30,30,.88);color:#fff;',
      'font-size:11px;font-weight:700;text-align:center;',
      'padding:3px 0 3px;letter-spacing:.08em;',
      'pointer-events:none;font-family:monospace;',
      'text-shadow:0 1px 2px rgba(0,0,0,.5);'
    ].join('');
    hud.textContent = '⚡ ЧИТ-РЕЖИМ АКТИВЕН — РЕКОРДЫ НЕ СОХРАНЯЮТСЯ ⚡';
    document.body.appendChild(hud);
  }

  // Патчим игры через глобальные флаги которые проверяют сами игры
  window._cheatNoHitbox   = on;  // Дино — отключить коллизии
  window._cheatSnakeWalls = on;  // Змейка — стены проходимы
  window._cheatTetSlow    = on;  // Тетрис — медленные фигуры
  window._cheatFlappyGap  = on;  // Флаппи — большой зазор
  window._cheatBrBounce   = on;  // Арканоид — мяч не теряется
  window._cheatGeoSlow    = on;  // Геодаш — замедление
}

// ══ CMD-КОНСОЛЬ ══
let _cmdVVListener = null;
function _cmdFitVV(ov) {
  if (!ov) return;
  if (window.visualViewport) {
    ov.style.top    = window.visualViewport.offsetTop  + 'px';
    ov.style.left   = window.visualViewport.offsetLeft + 'px';
    ov.style.width  = window.visualViewport.width  + 'px';
    ov.style.height = window.visualViewport.height + 'px';
  }
}
function cmdOpen(){
  const ov=document.getElementById('cmd-overlay');
  if(!ov)return;
  ov.style.display='flex';
  _cmdFitVV(ov);
  if(window.visualViewport && !_cmdVVListener){
    _cmdVVListener=()=>_cmdFitVV(ov);
    window.visualViewport.addEventListener('resize', _cmdVVListener);
    window.visualViewport.addEventListener('scroll', _cmdVVListener);
  }
  // Trigger reflow then add class for smooth slide-up
  ov.offsetHeight;
  ov.classList.add('cmd-visible');
  const body=document.getElementById('cmd-body');
  body.innerHTML='';
  cmdPrint('out','Microsoft Windows [Version 10.0.26100.3194]');
  cmdPrint('out','(c) Microsoft Corporation. Все права защищены.');
  cmdPrint('out','');
  setTimeout(()=>document.getElementById('cmd-input')?.focus(),80);
}
function cmdClose(){
  const ov=document.getElementById('cmd-overlay');
  if(!ov)return;
  ov.classList.remove('cmd-visible');
  if(window.visualViewport && _cmdVVListener){
    window.visualViewport.removeEventListener('resize', _cmdVVListener);
    window.visualViewport.removeEventListener('scroll', _cmdVVListener);
    _cmdVVListener=null;
  }
  setTimeout(()=>{
    ov.style.display='none';
    // Сбрасываем инлайн-позицию чтобы следующий open начинал чисто
    ov.style.top=''; ov.style.left=''; ov.style.width=''; ov.style.height='';
  }, 300);
}
function cmdPrint(cls,text){
  const body=document.getElementById('cmd-body');
  const line=document.createElement('div');
  line.className='cmd-line '+cls;
  line.textContent=text;
  body.appendChild(line);
  body.scrollTop=body.scrollHeight;
}
function cmdKey(e){
  if(e.key!=='Enter')return;
  const inp=document.getElementById('cmd-input');
  const raw=(inp.value||'').trim();
  inp.value='';
  if(!raw)return;
  cmdPrint('prompt','C:\\> '+raw);
  cmdExec(raw);
}
function cmdExec(raw){
  // Support both "cmd" and "/cmd" formats
  const parts=raw.split(/\s+/);
  const cmdRaw=parts[0].toLowerCase().replace(/^\//,'');
  const cmd=cmdRaw;
  const arg=(parts[1]||'').toLowerCase();
  const sec=loadSecret();
  switch(cmd){
    case 'help': {
      cmdPrint('info','Введи команду и нажми Enter.');
      cmdPrint('out', '');
      cmdPrint('info','── Основные команды ──');
      cmdPrint('out','  version             — версия приложения');
      cmdPrint('out','  theme list/[name]   — темы оформления');
      cmdPrint('out','  font list/[name]    — шрифты');
      cmdPrint('out','  sound on/off        — звук');
      cmdPrint('out','  snow on/off         — снег');
      cmdPrint('out','  matrix on/off       — матрица');
      cmdPrint('out','  disco on/off        — дискотека');
      cmdPrint('out','  glass on/off        — liquid glass');
      cmdPrint('out','  hiscores            — рекорды мини-игр');
      cmdPrint('out','  shorts [запрос]     — YouTube Shorts');
      cmdPrint('out','  tiktok              — открыть TikTok');
      cmdPrint('out','  donate              — поддержать проект');
      cmdPrint('out','  vip <код>           — активировать VIP');
      cmdPrint('out','  checker [add|remove] <user> — проверкеры VIP');
      cmdPrint('out', '');
      cmdPrint('info','── React Native UI (preview) ──');
      cmdPrint('out','  rn home             — Главная (RN)');
      cmdPrint('out','  rn groups           — Группы (RN)');
      cmdPrint('out','  rn schedule         — Расписание (RN)');
    } break;
    case 'greeting': {
      const sec2=loadSecret();
      const greetOn = !sec2.greetingOff;
      if(arg==='off'||(arg!=='on'&&greetOn)){sec2.greetingOff=true;saveSecret(sec2);cmdPrint('ok','Приветствие выключено.');}
      else{delete sec2.greetingOff;saveSecret(sec2);cmdPrint('ok','Приветствие включено.');}
    } break;
    case 'hiscores':{
      const GAME_NAMES={snake:'Змейка',pong:'Пинг-понг',tetris:'Тетрис',dino:'Динозаврик',
        blockblast:'Block Blast',breakout:'Арканоид',bubbles:'Пузыри',flappy:'Флаппи птица','2048':'2048'};
      if(arg==='reset'){stor.set(HI_KEY,'{}');cmdPrint('ok','Все рекорды сброшены.');}
      else{
        cmdPrint('info','── Рекорды мини-игр ──');
        const h=loadHiScores();
        Object.entries(GAME_NAMES).forEach(([k,n])=>{
          cmdPrint(h[k]?'ok':'out','  '+(n+':').padEnd(18)+(h[k]||'нет'));
        });
      }
    } break;
    case 'version':
      cmdPrint('info','Версия приложения: '+APP_VERSION);
      cmdPrint('info','versionCode: 11');
      cmdPrint('info','Платформа: Android WebView');
      break;
    case 'group':
      cmdPrint('info','Группа: '+(S.lastGroup||'не выбрана'));
      cmdPrint('info','Файл: '+(S.selectedFile?.name||'—'));
      break;
    case 'cache':
      if(arg==='clear'){Object.keys(FILE_CACHE).forEach(k=>delete FILE_CACHE[k]);cmdPrint('ok','Кэш очищен.');}
      else cmdPrint('info','Файлов в кэше: '+Object.keys(FILE_CACHE).length);
      break;
    case 'theme':
      if(arg==='list'){Object.entries(THEMES).forEach(([k,t])=>cmdPrint(S.theme===k?'ok':'out','  '+(k+(S.theme===k?' ✓':'')).padEnd(15)+t.name));}
      else if(arg&&THEMES[arg]){applyTheme(arg);cmdPrint('ok','Тема: '+THEMES[arg].name);}
      else if(arg)cmdPrint('err','Тема "'+arg+'" не найдена.');
      else cmdPrint('info','Тема: '+S.theme);
      break;
    case 'sound': {
      const nowMuted = !!S.muted;
      if(arg==='on'||(arg!=='off'&&nowMuted)){S.muted=false;saveLocal();updateMuteLabel();cmdPrint('ok','🔊 Звук включён.');}
      else{S.muted=true;saveLocal();updateMuteLabel();cmdPrint('ok','🔇 Звук выключен.');}
    } break;
    case 'matrix': {
      const matrixOn = document.getElementById('matrix-canvas').classList.contains('active');
      if(arg==='on'||(arg!=='off'&&!matrixOn)){matrixStart();cmdPrint('ok','🟩 Матрица активирована.');}
      else{matrixStop();cmdPrint('ok','Матрица отключена.');}
    } break;
    case 'snow': {
      const snowOn = document.getElementById('snow-canvas').style.display!=='none';
      if(arg==='on'||(arg!=='off'&&!snowOn)){snowStart();cmdPrint('ok','❄️ Снег пошёл!');}
      else{snowStop();cmdPrint('ok','🌤 Снег остановлен.');}
    } break;
    case 'disco': {
      if(arg==='contrast'||arg==='intensity'){
        const val=parseInt(parts[2]);
        if(isNaN(val)||val<0||val>100){cmdPrint('err','Укажи значение 0..100.');break;}
        const sec2=loadSecret();sec2.discoIntensity=val;saveSecret(sec2);
        discoApplyIntensity(val);
        cmdPrint('ok','🎨 Интенсивность диско: '+val+'%');
        break;
      }
      if(arg==='on'||(arg!=='off'&&!_discoActive)){
        discoStart();
        cmdPrint('warn','🕺 DISCO MODE ACTIVATED');
      } else {
        discoStop();cmdPrint('ok','😴 Дискотека закончилась.');
      }
    } break;
    case 'glass': {
      if(arg==='on'||(arg!=='off'&&!S.liquidGlass)){
        S.liquidGlass=true;applyGlassMode(true);cmdPrint('ok','🫧 Liquid Glass включён.');
      } else {
        S.liquidGlass=false;S.liquidGlassOpt=false;applyGlassMode(true);cmdPrint('ok','Liquid Glass выключен.');
      }
    } break;
    case 'vpn': {
      if (!window.Android?.toggleVpn || !window.Android?.getVpnState) {
        cmdPrint('err', 'VPN недоступен — только в приложении.'); break;
      }
      const vpnState = JSON.parse(window.Android.getVpnState() || '{}');
      const isOn = !!vpnState.active;
      if (arg === 'on') {
        if (isOn) { cmdPrint('warn', '⚡ VPN уже включён.'); break; }
        window.Android.toggleVpn();
        cmdPrint('ok', '✅ VPN включается...');
      } else if (arg === 'off') {
        if (!isOn) { cmdPrint('warn', '⚡ VPN уже выключен.'); break; }
        window.Android.toggleVpn();
        cmdPrint('ok', '🔌 VPN отключается...');
      } else {
        cmdPrint('info', 'VPN: ' + (isOn ? '🟢 включён' : '🔴 выключен'));
        if (vpnState.text) cmdPrint('out', '  ' + vpnState.text);
        cmdPrint('out', '  vpn on  — включить');
        cmdPrint('out', '  vpn off — выключить');
      }
    } break;
    case 'shake':
      cmdPrint('warn','💥 ВАУ!');
      document.body.classList.remove('shaking');
      document.body.offsetHeight;
      document.body.classList.add('shaking');
      setTimeout(()=>document.body.classList.remove('shaking'),500);
      break;
    case 'time':{
      const upMs=performance.now();
      const upS=Math.floor(upMs/1000);
      const m=Math.floor(upS/60),s=upS%60;
      cmdPrint('info',`Приложение работает: ${m} мин ${s} сек`);
      cmdPrint('info',`Сейчас: ${new Date().toLocaleString('ru')}`);
    } break;
    case 'exit':
      cmdPrint('out','Выход...');
      setTimeout(cmdClose,500);
      break;
    case 'bg': {
      if(arg==='clear'||arg==='off'){
        removeBgImage();
        cmdPrint('ok','Фон удалён');
      } else {
        cmdPrint('out','Текущий фон: '+(S.customBg?'установлен ('+Math.round(S.customBg.length/1024)+'KB)':'нет'));
      }
    } break;
    case 'zoom': {
      const z = parseFloat(arg);
      if(isNaN(z)||z<0.7||z>1.5){
        cmdPrint('info','Текущий зум: '+(document.documentElement.style.fontSize||'100%'));
      } else {
        document.documentElement.style.setProperty('font-size', (z*100)+'%');
        document.documentElement.style.setProperty('zoom', String(z));
        cmdPrint('ok','Зум установлен: '+z);
      }
    } break;
    case 'debug': {
      cmdPrint('info','──── Дамп состояния ────');
      cmdPrint('out','url: '+S.url.substring(0,50));
      cmdPrint('out','theme: '+S.theme);
      cmdPrint('out','group: '+(S.lastGroup||'не выбрана'));
      cmdPrint('out','glass: '+(S.liquidGlass?'on':'off'));
      cmdPrint('out','customBg: '+(S.customBg?'есть':'нет'));
      cmdPrint('out','muted: '+(S.muted?'yes':'no'));
      cmdPrint('out','screen.cur: '+cur);
      cmdPrint('info','──────────────────────');
    } break;
    case 'games':
      cmdClose();
      setTimeout(()=>eggOpen(),200);
      cmdPrint('ok','Открываю игры...');
      break;
    case 'turbo': {
      const turboStyle = document.getElementById('turbo-mode-style');
      if(turboStyle){ turboStyle.remove(); cmdPrint('ok','Турбо-режим отключён'); }
      else {
        const s = document.createElement('style');
        s.id = 'turbo-mode-style';
        s.textContent = '*{transition:none!important;animation:none!important;will-change:auto!important}';
        document.head.appendChild(s);
        cmdPrint('ok','🚀 Турбо-режим включён');
      }
    } break;
    case 'uwu': {
      const uwuFaces=['(ᵔᴥᵔ)','(◕‿◕✿)','(｡◕‿◕｡)','ʕ•ᴥ•ʔ','(≧◡≦)','UwU','OwO'];
      const uwuPhrases=['UwU режим аwтивирован, сенпай замечен OwO','*виляет хвостиком* расписание уже не страшное nyaa~','все пары отменены! ...нет, это не так (｡•́︿•̀｡)'];
      const face=uwuFaces[Math.floor(Math.random()*uwuFaces.length)];
      const phrase=uwuPhrases[Math.floor(Math.random()*uwuPhrases.length)];
      cmdPrint('ok',face+' '+phrase);
      const style=document.createElement('style');
      style.id='uwu-style';
      style.textContent=`body:not(.cmd-overlay){font-style:italic!important;letter-spacing:.04em!important}`;
      document.head.appendChild(style);
      setTimeout(()=>{const s=document.getElementById('uwu-style');if(s)s.remove();cmdPrint('ok','UwU-режим деактивирован.');},10000);
    } break;
    case 'gpt': {
      const userQ=(parts.slice(1).join(' ')||'').trim();
      if(!userQ){cmdPrint('err','Использование: gpt <вопрос>');break;}
      cmdPrint('info','🤖 Обрабатываю запрос...');
      const q=userQ.toLowerCase();
      let gptReply='';
      if(/пар[аы]|расписани|урок|лекци/.test(q)){gptReply='Следующая пара начинается ровно тогда, когда ты этого не ждёшь.';}
      else if(/препод|учитель/.test(q)){gptReply='Преподаватели — загадочные создания.';}
      else if(/ответ|задач|домашн/.test(q)){gptReply='Ответ: 42. Вопрос уточни потом.';}
      else if(/помог|помощь/.test(q)){gptReply='Я слышу тебя. Но мои советы работают 50/50.';}
      else if(/привет|хай/.test(q)){gptReply='Привет! Мощь — бесконечна. Полезность — сомнительна. 🤖';}
      else{const g=['Это интересный вопрос!','Анализирую... ошибка анализа.','ERROR 402: недостаточно токенов.'];gptReply=g[Math.floor(Math.random()*g.length)];}
      setTimeout(()=>cmdPrint('ok','🤖 GPT: '+gptReply),900+Math.random()*600);
    } break;
    case 'coffee': {
      const steps=['☕ Ищу кофемашину...','💧 Наливаю воду...','🫘 Засыпаю зерна...','🔥 Нагреваю...','✨ Готово!'];
      let i=0;
      const brew=setInterval(()=>{
        cmdPrint(i<steps.length-1?'info':'ok',steps[i]);i++;
        if(i>=steps.length){clearInterval(brew);cmdPrint('warn','☕ Кофе готов! Только он виртуальный.');}
      },600);
    } break;
    case 'hack': {
      const steps2=['Инициализация...','Подключение к серверам Пентагона... 1.2.3.4:80','Обход файрволла... ████████░░ 80%','Загрузка вирусов...','> ACCESS GRANTED to... ой.'];
      let si=0;
      document.getElementById('cmd-body').style.color='#00ff41';
      const hackInterval=setInterval(()=>{
        cmdPrint('ok',steps2[si++]);
        if(si>=steps2.length){clearInterval(hackInterval);setTimeout(()=>{cmdPrint('err','❌ Пентагон отозвал приглашение.');document.getElementById('cmd-body').style.color='';},1000);}
      },550);
    } break;
    case 'optimize': {
      cmdPrint('warn','🚀 ЯДЕРНАЯ ОПТИМИЗАЦИЯ ЗАПУЩЕНА...');
      let freed=0;
      setTimeout(()=>{const cacheCount=Object.keys(FILE_CACHE).length;Object.keys(FILE_CACHE).forEach(k=>delete FILE_CACHE[k]);freed+=cacheCount;idbClear().then(()=>cmdPrint('ok',`  ✓ Файловый кэш очищен (${cacheCount} записей, IndexedDB тоже)`)).catch(()=>cmdPrint('ok',`  ✓ Файловый кэш очищен (${cacheCount} записей)`));},300);
      setTimeout(()=>{cmdPrint('ok','  ✓ Неактивные canvas-буферы очищены');},700);
      setTimeout(()=>{const uwuStyle=document.getElementById('uwu-style');if(uwuStyle){uwuStyle.remove();freed++;}cmdPrint('ok','  ✓ Временные стили сброшены');},1100);
      setTimeout(()=>{cmdPrint('ok',`🏁 Готово. Очищено ~${freed} объектов.`);},1600);
    } break;
    case 'fps': {
      cmdPrint('info','📊 Замеряю FPS...');
      let frames=0,startT=performance.now();
      const rafLoop=()=>{frames++;if(performance.now()-startT<1000)requestAnimationFrame(rafLoop);else{const fps=Math.round(frames*1000/(performance.now()-startT));const quality=fps>=55?'ok':fps>=30?'warn':'err';cmdPrint(quality,`📊 FPS: ${fps}`);}};
      requestAnimationFrame(rafLoop);
    } break;
    case 'ram': {
      cmdPrint('info','💾 Анализирую память...');
      setTimeout(()=>{const domNodes=document.querySelectorAll('*').length;const cacheItems=Object.keys(FILE_CACHE).length;const perf=performance?.memory;if(perf){const used=Math.round(perf.usedJSHeapSize/1024/1024*10)/10;const total=Math.round(perf.totalJSHeapSize/1024/1024*10)/10;cmdPrint('info',`  JS Heap: ${used} МБ / ${total} МБ`);}cmdPrint('info',`  DOM-узлов: ${domNodes}`);cmdPrint('info',`  Файлов в кэше: ${cacheItems}`);},400);
    } break;
    case 'clear': {
      const body=document.getElementById('cmd-body');
      if(body){body.innerHTML='';}
    } break;
    case 'ascii': {
      const grp=S.lastGroup||'МПД-2-24';
      cmdPrint('out','┌─────────────────────────┐');
      cmdPrint('out','│  ScheduleApp v'+APP_VERSION+'       │');
      cmdPrint('out','│  Группа: '+grp.padEnd(15)+'│');
      cmdPrint('out','└─────────────────────────┘');
    } break;
    case 'ping': {
      const startT=performance.now();
      cmdPrint('info','📡 Пингую cloud-api.yandex.net...');
      const pingUrl='https://cloud-api.yandex.net/v1/disk';
      const doPing=(attempt)=>{const t0=performance.now();fetch(pingUrl,{method:'HEAD',mode:'no-cors',cache:'no-store'}).then(()=>cmdPrint('ok',`  [${attempt}] ${Math.round(performance.now()-t0)} мс — 🟢`)).catch(()=>cmdPrint('warn',`  [${attempt}] ${Math.round(performance.now()-t0)} мс — CORS`));};
      setTimeout(()=>doPing(1),100);setTimeout(()=>doPing(2),700);setTimeout(()=>doPing(3),1300);
      setTimeout(()=>cmdPrint('info',`  Готово. ${Math.round(performance.now()-startT+1300)} мс`),1900);
    } break;
    case 'weather': {
      const weathers=[{ico:'☀️',desc:'Солнечно, +22°C.',cls:'ok'},{ico:'🌧',desc:'Дождь весь день.',cls:'info'},{ico:'❄️',desc:'Снег, -8°C.',cls:'warn'},{ico:'⛅',desc:'Переменная облачность.',cls:'out'}];
      const w=weathers[Math.floor(Math.random()*weathers.length)];
      setTimeout(()=>cmdPrint(w.cls,w.ico+' '+w.desc),700);
    } break;
    case 'selftest': {
      cmdPrint('warn','🔬 СИСТЕМНЫЙ ТЕСТ...');
      const tests=[['localStorage',()=>{try{localStorage.setItem('_t','1');localStorage.removeItem('_t');return true;}catch(e){return false;}}],['Canvas 2D',()=>{const c=document.createElement('canvas');return !!c.getContext('2d');}],['Темы',()=>Object.keys(THEMES||{}).length>0],['Группа выбрана',()=>!!(S.lastGroup)]];
      tests.forEach(([name,fn],i)=>{setTimeout(()=>{let ok=false;try{ok=fn();}catch(e){}cmdPrint(ok?'ok':'err',`  ${ok?'✓':'✗'} ${name}`);if(i===tests.length-1)setTimeout(()=>cmdPrint('info','🏁 Тест завершён'),100);},i*200);});
    } break;
    case 'horoscope': {
      const signs=['Овен','Телец','Близнецы','Рак','Лев','Дева','Весы','Скорпион','Стрелец','Козерог','Водолей','Рыбы'];
      const predictions=[`Звёзды говорят: сдашь зачёт. Но пересдашь дважды.`,`Меркурий в ретрограде — повод не делать домашнее.`,`Луна в ${signs[new Date().getDate()%12]} предвещает: преподаватель сегодня добрый. Или нет.`];
      cmdPrint('warn',`🔮 Гороскоп (${new Date().toLocaleDateString('ru')})`);
      setTimeout(()=>cmdPrint('out','  '+predictions[new Date().getDate()%predictions.length]),600);
    } break;
    case 'roast': {
      const roasts=[['🔥 Анализирую...','Твой средний балл — как температура в аудитории зимой.'],['🔥 Сканирую...','Ты бываешь в колледже реже, чем солнце в ноябре.'],['🔥 Оцениваю...','Твои записи такие подробные, что ты сам их не понимаешь.']];
      const r=roasts[Math.floor(Math.random()*roasts.length)];
      cmdPrint('warn',r[0]);setTimeout(()=>cmdPrint('err','  '+r[1]),1000);setTimeout(()=>cmdPrint('ok','  (Это шутка. Ты молодец.)'),2200);
    } break;
    case 'pair': {
      const tips=['😴 Положи голову на руки — это \"глубокое осмысление\".','📱 Открой расписание. Вдруг следующей пары нет?','✏️ Рисуй в тетради. Искусство — тоже образование.','⏰ Смотри на часы каждые 2 минуты.'];
      cmdPrint('ok','  '+tips[Math.floor(Math.random()*tips.length)]);
    } break;
    case 'yeet': {
      cmdPrint('warn','🚪 ГЕНЕРИРУЮ ЗАКОННЫЙ ВЫХОД...');
      const excuses=['Скажи что у тебя \"встреча с куратором\".','\"Мне плохо\" — классика.','Подними руку: \"Можно выйти?\" — и не возвращайся.'];
      setTimeout(()=>cmdPrint('info','  Метод: '+excuses[new Date().getMinutes()%excuses.length]),800);
      setTimeout(()=>cmdPrint('err','  ⚠️ Это шутка. Ходи на пары.'),1800);
    } break;
    case 'summon': {
      cmdPrint('warn','😱 ВЫЗОВ ДЕКАНА...');matrixStart();
      setTimeout(()=>{matrixStop();cmdPrint('ok','✨ Декан вызван... и сразу ушёл на собрание.');},4000);
    } break;
    case 'homework': {
      cmdPrint('info','📚 Запускаю алгоритм...');
      setTimeout(()=>cmdPrint('warn','⚠️ Найдено 47 решений, но все неправильные.'),1400);
      setTimeout(()=>cmdPrint('err','❌ мозг студента не найден. Придётся думать самому.'),2200);
    } break;
    case 'absent': {
      const name=(parts.slice(1).join(' ')||'Кто-то').trim();
      cmdPrint('info','🙈 Записываю '+name+' как отсутствующего...');
      setTimeout(()=>cmdPrint('ok','✅ '+name+' официально "болен".'),800);
    } break;
    case 'grade': {
      cmdPrint('info','📝 Открываю журнал...');
      setTimeout(()=>cmdPrint('err','🔒 ДОСТУП ЗАПРЕЩЁН. Только для преподавателей.'),1600);
      setTimeout(()=>cmdPrint('ok','Хотя поставил бы тебе 5. Честно.'),2400);
    } break;
    case 'coffee2': break;

    // ── Секретная команда: удаление аккаунта ──────────────────────
    case 'deleteaccount': {
      const targetUser = (parts[1]||'').trim().toLowerCase();
      if (!targetUser) {
        cmdPrint('err','Использование: deleteaccount <ник>  [--all для удаления всего]');
        cmdPrint('info','  deleteaccount vasya       — удалить аккаунт @vasya');
        cmdPrint('info','  accounts list             — показать все аккаунты');
        break;
      }
      cmdPrint('warn', '🗑 Удаляю @' + targetUser + ' со всех платформ...');

      // 1. Локальный список аккаунтов
      const accounts = accountsLoad();
      if (accounts[targetUser]) {
        delete accounts[targetUser];
        accountsSave(accounts);
        cmdPrint('ok', '  ✓ Локальное хранилище (accounts)');
      } else {
        cmdPrint('out', '  — Не найден в локальном хранилище');
      }

      // 2. Текущий профиль
      const curProfile = profileLoad();
      if (curProfile && curProfile.username === targetUser) {
        profileDisconnect();
        localStorage.removeItem(PROFILE_KEY);
        localStorage.removeItem(FRIENDS_KEY);
        localStorage.removeItem(MSG_STORE_KEY);
        localStorage.removeItem(MSG_CHATS_KEY);
        updateNavProfileIcon(null);
        cmdPrint('ok', '  ✓ Активный профиль и все данные очищены');
      }

      // 3. Supabase — удаляем везде
      if (sbReady()) {
        Promise.all([
          sbDelete('presence',    'username=eq.' + encodeURIComponent(targetUser))
            .then(() => cmdPrint('ok', '  ✓ Supabase: presence'))
            .catch(()  => cmdPrint('warn', '  ⚠ Supabase: не удалось удалить из presence')),
          sbDelete('messages',    'from_user=eq.' + encodeURIComponent(targetUser))
            .then(() => cmdPrint('ok', '  ✓ Supabase: messages (отправленные)'))
            .catch(()  => cmdPrint('warn', '  ⚠ Supabase: не удалось удалить сообщения (from)')),
          sbDelete('messages',    'to_user=eq.' + encodeURIComponent(targetUser))
            .then(() => cmdPrint('ok', '  ✓ Supabase: messages (входящие)'))
            .catch(()  => cmdPrint('warn', '  ⚠ Supabase: не удалось удалить сообщения (to)')),
          sbDelete('leaderboard', 'username=eq.' + encodeURIComponent(targetUser))
            .then(() => cmdPrint('ok', '  ✓ Supabase: leaderboard'))
            .catch(()  => cmdPrint('warn', '  ⚠ Supabase: не удалось удалить из leaderboard')),
        ]).then(() => cmdPrint('ok', '✅ @' + targetUser + ' полностью удалён.'));
      } else {
        cmdPrint('warn', '  ⚠ Supabase недоступен — удалено только локально');
        cmdPrint('ok', '✅ @' + targetUser + ' удалён локально.');
      }

      if (curProfile && curProfile.username === targetUser) {
        setTimeout(() => { profileInitLoginScreen(); showScreen('s-login'); cmdClose(); }, 1000);
      }
    } break;

    case 'accounts': {
      const sub = (parts[1]||'').toLowerCase();
      const targetUserAcc = (parts[2]||'').trim().toLowerCase();

      if (!sub || sub === 'list') {
        // Локальные
        const localAccs = accountsLoad();
        const localKeys = Object.keys(localAccs);
        const curP = profileLoad();
        cmdPrint('info', '── Локальные аккаунты (' + localKeys.length + ') ──');
        if (localKeys.length === 0) {
          cmdPrint('out', '  (пусто)');
        } else {
          localKeys.forEach(u => {
            const a = localAccs[u];
            const isCurrent = curP && curP.username === u;
            cmdPrint(isCurrent ? 'ok' : 'out',
              '  @' + u.padEnd(20) +
              (a.name ? ('  ' + a.name) : '') +
              (isCurrent ? '  ← текущий' : '')
            );
          });
        }
        // Supabase
        if (sbReady()) {
          cmdPrint('info', '── Supabase presence (все зарегистрированные) ──');
          sbGet('presence', 'select=username,name,ts&order=ts.desc&limit=100').then(rows => {
            if (!Array.isArray(rows) || rows.length === 0) {
              cmdPrint('out', '  (нет данных)');
              return;
            }
            rows.forEach(r => {
              const ago = r.ts ? Math.round((Date.now() - r.ts) / 60000) : null;
              const online = ago !== null && ago < 2;
              cmdPrint(online ? 'ok' : 'out',
                '  @' + (r.username||'?').padEnd(20) +
                '  ' + (r.name||'').substring(0,20).padEnd(20) +
                (ago !== null ? '  ' + (online ? '🟢 сейчас' : ago + ' мин назад') : '')
              );
            });
            cmdPrint('info', 'Итого в Supabase: ' + rows.length);
          }).catch(e => cmdPrint('err', '❌ Supabase ошибка: ' + e.message));
        } else {
          cmdPrint('warn', '  Supabase недоступен');
        }
      } else if (sub === 'delete') {
        if (!targetUserAcc) {
          cmdPrint('err', 'Использование: accounts delete <ник>');
          break;
        }
        // Переиспользуем логику deleteaccount
        cmdExec('deleteaccount ' + targetUserAcc);
      } else if (sub === 'search') {
        const query = (parts[2]||'').toLowerCase();
        if (!query) { cmdPrint('err', 'Использование: accounts search <запрос>'); break; }
        if (sbReady()) {
          cmdPrint('info', '🔍 Ищу "' + query + '" в Supabase...');
          sbGet('presence', 'select=username,name,ts&username=ilike.*' + encodeURIComponent(query) + '*&limit=50')
            .then(rows => {
              if (!Array.isArray(rows) || rows.length === 0) {
                cmdPrint('out', '  Не найдено');
                return;
              }
              rows.forEach(r => cmdPrint('ok', '  @' + r.username + '  ' + (r.name||'')));
            }).catch(e => cmdPrint('err', '❌ ' + e.message));
        } else cmdPrint('warn', 'Supabase недоступен');
      } else if (sub === 'clear-local') {
        accountsSave({});
        cmdPrint('ok', '🗑 Все локальные аккаунты удалены из устройства');
      } else {
        cmdPrint('info', 'Команды accounts:');
        cmdPrint('out', '  accounts list             — все аккаунты');
        cmdPrint('out', '  accounts delete <ник>     — удалить аккаунт');
        cmdPrint('out', '  accounts search <запрос>  — поиск в Supabase');
        cmdPrint('out', '  accounts clear-local      — очистить локальный список');
      }
    } break;

    case 'p2p': {
      const sub2 = (parts[1]||'').toLowerCase();
      if (!sub2 || sub2 === 'status') {
        cmdPrint('info', '── P2P стратегии ──');
        _P2P_STRATEGIES.forEach((s, i) => {
          const active = i === _p2pActiveIdx;
          cmdPrint(active ? 'ok' : 'out',
            '  [' + i + '] ' + s.emoji + ' ' + s.label.padEnd(20) + (active ? ' ← АКТИВНА' : ''));
        });
        cmdPrint('info', 'Сбоев: ' + _p2pFailCount + ' | Переключение: ' + (_p2pSwitching ? 'да' : 'нет'));
      } else if (sub2 === 'test') {
        cmdPrint('info', '🔍 Тестирую все каналы параллельно...');
        _P2P_STRATEGIES.forEach((s, i) => {
          p2pTestStrategy(i).then(ok => {
            cmdPrint(ok ? 'ok' : 'err',
              '  [' + i + '] ' + s.emoji + ' ' + s.label.padEnd(20) + (ok ? ' ✅' : ' ❌'));
          });
        });
      } else if (sub2 === 'use') {
        const idx = parseInt(parts[2]);
        if (isNaN(idx) || idx < 0 || idx >= _P2P_STRATEGIES.length) {
          cmdPrint('err', 'Неверный индекс. Доступно 0–' + (_P2P_STRATEGIES.length-1));
          break;
        }
        p2pSelectStrategy(idx);
        cmdPrint('ok', '✅ Канал переключён на [' + idx + '] ' + _P2P_STRATEGIES[idx].label);
      } else if (sub2 === 'failover') {
        cmdPrint('warn', '⚡ Запускаю failover...');
        p2pFailover();
      } else {
        cmdPrint('info', 'Команды p2p:');
        cmdPrint('out', '  p2p status         — список каналов');
        cmdPrint('out', '  p2p test           — проверить все каналы');
        cmdPrint('out', '  p2p use <индекс>   — переключить канал');
        cmdPrint('out', '  p2p failover       — принудительный поиск');
      }
    } break;

    case 'bell':     funBell(); break;
    case 'haiku':    funHaiku(); break;
    case 'bpmtap':   funBpmTap(); break;
    case 'glitch':   funGlitch(); cmdPrint('warn','👾 Glitch активирован на 3 секунды'); break;
    case 'taunt':    funTaunt(); break;
    case 'mirror':   funMirror(); break;
    case 'warp':     funWarp(); break;
    case 'confetti': funConfetti(); break;
    case 'sus':      funSus(); break;
    case 'chaos':    funChaosMode(); break;

    // ── Управление Supabase ─────────────────────────────────────────
    case 'supabase': {
      const sub = (parts[1]||'').toLowerCase();
      if (!sub || sub === 'status') {
        const cfg = sbConfig();
        const ready = sbReady();
        cmdPrint('info','⚡ Supabase статус:');
        cmdPrint(ready?'ok':'warn','  Подключение: '+(ready?'🟢 Активно':'🔴 Не настроено'));
        if (cfg?.url) cmdPrint('out','  URL: '+cfg.url.substring(0,40)+'...');
        if (cfg?.key) cmdPrint('out','  Key: '+cfg.key.substring(0,20)+'...');
        cmdPrint('info','  Команды: supabase set <url> <key> | supabase test | supabase reset');
      } else if (sub === 'set') {
        const newUrl = parts[2] || '';
        const newKey = parts[3] || '';
        if (!newUrl || !newKey) { cmdPrint('err','Использование: supabase set <url> <key>'); break; }
        try {
          const cfgObj = { url: newUrl, key: newKey };
          localStorage.setItem(SB_CONFIG_KEY, JSON.stringify(cfgObj));
          cmdPrint('ok','✅ Конфиг сохранён. Проверяю подключение...');
          fetch(`${newUrl}/rest/v1/presence?select=username&limit=1`, {
            headers: { apikey: newKey, Authorization: `Bearer ${newKey}` }
          }).then(r => {
            cmdPrint(r.ok?'ok':'warn', r.ok ? '🟢 Соединение успешно!' : '⚠ HTTP '+r.status);
          }).catch(e => cmdPrint('err','❌ Ошибка: '+e.message));
        } catch(e) { cmdPrint('err','Ошибка сохранения: '+e.message); }
      } else if (sub === 'test') {
        cmdPrint('info','🔍 Тестирую соединение...');
        const cfg2 = sbConfig();
        if (!cfg2?.url) { cmdPrint('err','Не настроено. Используй: supabase set <url> <key>'); break; }
        fetch(`${cfg2.url}/rest/v1/presence?select=username&limit=1`, {
          headers: { apikey: cfg2.key, Authorization: `Bearer ${cfg2.key}` }
        }).then(r => cmdPrint(r.ok?'ok':'err', r.ok ? '🟢 OK — HTTP '+r.status : '❌ HTTP '+r.status))
          .catch(e => cmdPrint('err','❌ '+e.message));
      } else if (sub === 'reset') {
        localStorage.removeItem(SB_CONFIG_KEY);
        cmdPrint('ok','🗑 Конфиг Supabase сброшен. Используется встроенный.');
      } else {
        cmdPrint('err','Неизвестная подкоманда. Доступно: status, set, test, reset');
      }
    } break;

    // ── Читерские способности для мини-игр ──────────────────────
    case 'cheat': {
      const sec3 = loadSecret();
      const isOn = !!window._cheatModeActive;

      if (arg === 'off' || (arg !== 'on' && isOn)) {
        // Выключаем
        window._cheatModeActive = false;
        delete sec3.cheatMode;
        saveSecret(sec3);
        // Убираем визуальный индикатор
        document.getElementById('cheat-hud')?.remove();
        cmdPrint('ok', '🚫 Чит-режим ВЫКЛЮЧЕН. Рекорды снова сохраняются.');
        _applyCheatMode(false);
      } else if (arg === 'on' || (arg !== 'off' && !isOn)) {
        // Включаем
        window._cheatModeActive = true;
        sec3.cheatMode = true;
        saveSecret(sec3);
        cmdPrint('warn', '⚠️  ЧИТ-РЕЖИМ АКТИВИРОВАН');
        cmdPrint('info', '┌─────────────────────────────────────────┐');
        cmdPrint('info', '│  Активные читы для мини-игр:            │');
        cmdPrint('info', '│  🦕 Дино       — бессмертие (нет хитбокс)│');
        cmdPrint('info', '│  🐍 Змейка     — стены проходимы        │');
        cmdPrint('info', '│  🧱 Тетрис     — замедление фигур 3×     │');
        cmdPrint('info', '│  🐦 Флаппи     — увеличенные зазоры      │');
        cmdPrint('info', '│  🎯 Арканоид   — неубиваемый мяч         │');
        cmdPrint('info', '│  ⬡  Геодаш     — замедление 0.5×         │');
        cmdPrint('info', '└─────────────────────────────────────────┘');
        cmdPrint('err',  '⛔ Рекорды НЕ сохраняются и НЕ отправляются');
        _applyCheatMode(true);
      } else {
        // Показываем статус
        cmdPrint(isOn ? 'warn' : 'info', 'Чит-режим: ' + (isOn ? '✅ ВКЛЮЧЁН (рекорды не пишутся)' : '❌ выключен'));
        cmdPrint('info', 'Использование: cheat on / cheat off');
      }
    } break;

    case 'shorts': {
      const q = parts.slice(1).join(' ').trim();
      cmdPrint('ok', '📱 Открываю YouTube Shorts...');
      setTimeout(() => {
        cmdClose();
        ytShortsOpen(q || null);
      }, 300);
    } break;

    case 'donate': {
      cmdPrint('ok', '💝 Открываю страницу доната...');
      setTimeout(() => { cmdClose(); showDonateSheet(); }, 300);
    } break;

    case 'vip': {
      if (!arg) { cmdPrint('err', 'Укажи код: vip <КОД>'); break; }
      if (typeof vipActivate === 'function' && vipActivate(arg)) {
        cmdPrint('ok', '👑 VIP активирован! Перезагрузи профиль.');
        SFX.play && SFX.play('success');
      } else {
        cmdPrint('err', '❌ Неверный код.');
      }
    } break;

    case 'checker': {
      if (typeof vipCheckersLoad !== 'function') {
        cmdPrint('err', 'Функция проверкеров не найдена. Обнови social.js.');
        break;
      }
      const _list = vipCheckersLoad();
      const _sub  = arg;           // add | remove | (пусто)
      const _user = parts[2]?.toLowerCase?.();
      if (!_sub) {
        cmdPrint('info', '── Проверкеры VIP ──');
        if (!_list.length) cmdPrint('out', '  (список пуст)');
        _list.forEach(u => cmdPrint('ok', '  👑 @' + u));
        cmdPrint('out', '');
        cmdPrint('out', '  checker add <username>    — добавить проверкера');
        cmdPrint('out', '  checker remove <username> — убрать проверкера');
        break;
      }
      if (!_user) { cmdPrint('err', 'Укажи username.'); break; }
      if (_sub === 'add') {
        if (_list.includes(_user)) { cmdPrint('warn', '@' + _user + ' уже проверкер.'); break; }
        _list.push(_user);
        vipCheckersSave(_list);
        cmdPrint('ok', '✅ @' + _user + ' теперь может проверять VIP-заявки.');
      } else if (_sub === 'remove') {
        const _idx = _list.indexOf(_user);
        if (_idx === -1) { cmdPrint('err', '@' + _user + ' не найден в списке.'); break; }
        _list.splice(_idx, 1);
        vipCheckersSave(_list);
        cmdPrint('ok', '🗑 @' + _user + ' убран из проверкеров.');
      } else {
        cmdPrint('err', 'Неизвестная подкоманда. Используй: add / remove');
      }
    } break;

    case 'tiktok': {
      cmdPrint('ok', '🎵 Открываю TikTok...');
      setTimeout(() => {
        cmdClose();
        if (window.Android?.openUrl) {
          window.Android.openUrl('https://www.tiktok.com');
        } else if (window.Android?.loadUrlInWebView) {
          window.Android.loadUrlInWebView('https://www.tiktok.com');
        } else {
          // Fallback: открываем встроенный WebView
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column';
          const bar = document.createElement('div');
          bar.style.cssText = 'background:#161823;padding:10px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0';
          bar.innerHTML = `<span style="font-size:18px">🎵</span><span style="color:#fff;font-size:16px;font-weight:700;flex:1">TikTok</span><button onclick="this.closest('[style*=z-index]').remove()" style="background:rgba(255,255,255,.15);border:none;color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;cursor:pointer">✕ Закрыть</button>`;
          const frame = document.createElement('iframe');
          frame.src = 'https://www.tiktok.com';
          frame.style.cssText = 'flex:1;border:none;width:100%';
          overlay.appendChild(bar);
          overlay.appendChild(frame);
          document.body.appendChild(overlay);
        }
      }, 300);
    } break;

    case 'rn': {
      const screens = { home: 'rnHome', groups: 'rnGroups', schedule: 'rnSchedule' };
      if (!arg || !screens[arg]) {
        cmdPrint('info','── React Native UI ──');
        cmdPrint('out','  rn home     — Главная');
        cmdPrint('out','  rn groups   — Список групп');
        cmdPrint('out','  rn schedule — Расписание');
      } else {
        cmdPrint('ok', '▶ Открываю RN экран: ' + arg + '...');
        setTimeout(() => { cmdClose(); rnOpenScreen(arg); }, 350);
      }
    } break;

    default:
      cmdPrint('err','"'+cmd+'" не найдена.');
  }
}


// ══ ШРИФТЫ ══
const FONTS = [
  // ── Оригинальные (с кириллицей) ──────────────────────────────────
  {id:'Geologica',     name:'Geologica',      sub:'Стандартный (по умолчанию)',  preview:'Расписание занятий'},
  {id:'Nunito',        name:'Nunito',         sub:'Мягкий, скруглённый',         preview:'Расписание занятий'},
  {id:'Rubik',         name:'Rubik',          sub:'Современный, геометричный',   preview:'Расписание занятий'},
  {id:'Manrope',       name:'Manrope',        sub:'Строгий, технологичный',      preview:'Расписание занятий'},
  {id:'Inter',         name:'Inter',          sub:'Читаемый, нейтральный',       preview:'Расписание занятий'},
  {id:'Montserrat',    name:'Montserrat',     sub:'Стильный, акцентный',         preview:'Расписание занятий'},
  {id:'Unbounded',     name:'Unbounded',      sub:'Широкий, брутальный',         preview:'РАСПИСАНИЕ'},
  {id:'Space Grotesk', name:'Space Grotesk',  sub:'Космический, техно',          preview:'Расписание'},
  {id:'Comfortaa',     name:'Comfortaa',      sub:'Дружелюбный, округлый',       preview:'Расписание занятий'},
  {id:'Raleway',       name:'Raleway',        sub:'Элегантный, тонкий',          preview:'Расписание занятий'},
  {id:'Oswald',        name:'Oswald',         sub:'Узкий, газетный',             preview:'РАСПИСАНИЕ'},
  {id:'Caveat',        name:'Caveat',         sub:'Рукописный, живой',           preview:'Расписание занятий'},
  {id:'Exo 2',         name:'Exo 2',          sub:'Технологичный, sci-fi',       preview:'Расписание занятий'},
  {id:'Fira Code',     name:'Fira Code',      sub:'Моно, программистский',       preview:'Расписание_01'},
  {id:'Russo One',     name:'Russo One',      sub:'Жёсткий, русский гротеск',    preview:'РАСПИСАНИЕ'},
  {id:'Ubuntu',        name:'Ubuntu',         sub:'Открытый, Linux-стиль',       preview:'Расписание занятий'},
  {id:'JetBrains Mono',name:'JetBrains Mono', sub:'Моношрифт, программистский',  preview:'Schedule_v3'},
  // ── Замены (были без кириллицы → заменены похожими) ──────────────
  {id:'Jura',          name:'Jura',           sub:'Футуристичный ▸ (замена Oxanium)',    preview:'РАСПИСАНИЕ'},
  {id:'Source Sans 3', name:'Source Sans 3',  sub:'Чистый ▸ (замена Outfit)',           preview:'Расписание занятий'},
  {id:'Advent Pro',    name:'Advent Pro',     sub:'Авангардный ▸ (замена Syne)',         preview:'Расписание'},
  {id:'IBM Plex Sans', name:'IBM Plex Sans',  sub:'Деловой ▸ (замена Plus Jakarta)',    preview:'Расписание занятий'},
  {id:'Tektur',        name:'Tektur',         sub:'Дерзкий дисплей ▸ (замена Bebas)',   preview:'РАСПИСАНИЕ'},
  {id:'Prosto One',    name:'Prosto One',     sub:'Жирный гротеск ▸ (замена Dela)',     preview:'РАСПИСАНИЕ'},
  {id:'Neucha',        name:'Neucha',         sub:'Рукописный дисплей ▸ (замена Righteous)', preview:'Расписание!'},
  {id:'Lobster',       name:'Lobster',        sub:'Декоративный ▸ (замена Bangers)',    preview:'Расписание!'},
  // ── Новые (10 штук, все с кириллицей) ────────────────────────────
  {id:'PT Sans',       name:'PT Sans',        sub:'Классический русский гротеск',       preview:'Расписание занятий'},
  {id:'PT Serif',      name:'PT Serif',       sub:'Классическая русская антиква',       preview:'Расписание занятий'},
  {id:'Lora',          name:'Lora',           sub:'Элегантная книжная антиква',         preview:'Расписание занятий'},
  {id:'Merriweather',  name:'Merriweather',   sub:'Читаемая газетная антиква',          preview:'Расписание занятий'},
  {id:'Mulish',        name:'Mulish',         sub:'Минималистичный, геометричный',      preview:'Расписание занятий'},
  {id:'Golos Text',    name:'Gólos Text',     sub:'Современный русский дизайн',         preview:'Расписание занятий'},
  {id:'Philosopher',   name:'Philosopher',    sub:'Интеллигентный, изысканный',         preview:'Расписание занятий'},
  {id:'Cormorant',     name:'Cormorant',      sub:'Высокая мода, контрастный',          preview:'Расписание занятий'},
  {id:'Podkova',       name:'Podkova',        sub:'Брусковый, крепкий',                 preview:'Расписание занятий'},
  {id:'Forum',         name:'Forum',          sub:'Декоративный, торжественный',        preview:'РАСПИСАНИЕ'},
];
function applyFont(fontId){
  document.documentElement.style.setProperty('--app-font', "'" + fontId + "'");
  S.font = fontId;
  saveLocal();
  renderFontPicker();
  // Обновляем превью-текст в карусели
}
function renderFontPicker(){
  const wrap = document.getElementById('font-picker');
  if(!wrap) return;
  wrap.innerHTML = '';
  FONTS.forEach(f => {
    const item = document.createElement('div');
    item.className = 'list-item' + (S.font===f.id?' selected':'');
    item.style.fontFamily = "'" + f.id + "',sans-serif";
    item.innerHTML = `<div><div class="item-name">${f.name}</div><div class="item-sub">${f.sub}</div></div>${S.font===f.id?'<span style="color:var(--accent);font-size:18px">✓</span>':'<span class="item-arrow">›</span>'}`;
    item.onclick = () => applyFont(f.id);
    wrap.appendChild(item);
  });
}


// ══ ЛОКАЛЬНАЯ ЗАГРУЗКА DOC ══
var _bellTapCount=0,_bellTapTimer=null;
function bellNavTap(){
  SFX.play('navBells');
  navTo('s-bells','nav-bells');
}
function openLocalFilePicker(){
  // Создаём временный input и сразу кликаем — работает на Android в WebView
  const inp = document.createElement('input');
  inp.type='file';
  inp.accept='.doc,.docx';
  inp.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(inp);
  inp.addEventListener('change', function(e){
    onLocalDocChosen(e);
    document.body.removeChild(inp);
  });
  inp.click();
}
function onLocalDocChosen(event){
  const file=event.target.files[0];
  if(!file){return;}
  const reader=new FileReader();
  reader.onload=function(e){
    const buf=e.target.result;
    // Создаём псевдо-файловый объект
    S.selectedFile={name:file.name,url:null,_localBuf:buf};
    FILE_CACHE[file.name]=buf;
    // Показываем в списке файлов
    const fl=document.getElementById('file-list');
    if(fl){
      fl.innerHTML='';
      const item=document.createElement('div');
      item.className='list-item selected';
      item.innerHTML=`<span class="item-name">📄 ${file.name}</span><span style="color:var(--accent);font-size:18px">✓</span>`;
      fl.appendChild(item);
    }
    document.getElementById('file-section').classList.remove('hidden');
    document.getElementById('home-status').textContent='';
    toast('✅ Файл загружен: '+file.name);
    const gb=document.getElementById('go-to-groups-btn');
    if(gb) gb.textContent = (typeof S!=='undefined'&&S.mode==='teacher')?'Выбрать учителя →':'Выбрать группу →';
    navTo('s-home','nav-home');
  };
  reader.readAsArrayBuffer(file);
  // reset input
  event.target.value='';
}


// ══ ЗАМЕТКИ К ПАРЕ ══
function loadNotes(){try{return JSON.parse(stor.get('pair_notes')||'{}');}catch(e){return{};}}
function saveNote(key,text){const n=loadNotes();if(text.trim())n[key]=text.trim();else delete n[key];stor.set('pair_notes',JSON.stringify(n));}
let _noteOverlay = null;
function openNote(pairRoman,groupOrTeacher){
  closeNote(); // закрыть предыдущую если есть
  const key=groupOrTeacher+'::'+pairRoman;
  const notes=loadNotes();
  const existing=notes[key]||'';
  const overlay=document.createElement('div');
  overlay.id='note-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
  // Закрытие по тапу на фон
  overlay.addEventListener('click', e => { if(e.target===overlay) closeNote(); });
  const sheet = document.createElement('div');
  sheet.style.cssText='background:var(--surface);border-radius:16px;padding:20px;width:100%;max-width:420px;border:1.5px solid var(--surface3)';
  const title = document.createElement('div');
  title.style.cssText='font-size:14px;font-weight:700;margin-bottom:12px;color:var(--accent)';
  title.textContent='📝 Заметка — пара '+pairRoman;
  const ta = document.createElement('textarea');
  ta.id='note-ta';
  ta.style.cssText='width:100%;height:120px;background:var(--surface2);border:1.5px solid var(--surface3);border-radius:10px;color:var(--text);font-family:inherit;font-size:13px;padding:10px;resize:none;outline:none;box-sizing:border-box';
  ta.placeholder='Что-то важное к этой паре...';
  ta.value=existing;
  const btns = document.createElement('div');
  btns.style.cssText='display:flex;gap:8px;margin-top:10px';
  const saveBtn = document.createElement('button');
  saveBtn.style.cssText='flex:1;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-family:inherit;font-weight:700;cursor:pointer';
  saveBtn.textContent='Сохранить';
  saveBtn.onclick = () => { saveNote(key, ta.value); closeNote(); toast('💾 Заметка сохранена'); };
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText='padding:12px 16px;background:var(--surface2);color:var(--muted);border:none;border-radius:10px;font-family:inherit;cursor:pointer;font-size:18px;font-weight:700';
  closeBtn.textContent='✕';
  closeBtn.onclick = closeNote;
  btns.appendChild(saveBtn);
  btns.appendChild(closeBtn);
  sheet.appendChild(title);
  sheet.appendChild(ta);
  sheet.appendChild(btns);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  _noteOverlay = overlay;
  setTimeout(()=>ta.focus(),50);
}
function closeNote(){
  if(_noteOverlay){ _noteOverlay.remove(); _noteOverlay=null; }
}
// Добавляем кнопку заметки к каждой паре в renderSchedule и renderTeacherSchedule
function addNoteButtons(body, groupOrTeacher){
  body.querySelectorAll('.pair-card.has-subject,.pair-card.is-now,.pair-card.is-next').forEach(card=>{
    const roman=card.querySelector('.pair-num')?.textContent?.trim();
    if(!roman)return;
    const notes=loadNotes();
    const key=groupOrTeacher+'::'+roman;
    const hasNote=!!notes[key];
    const btn=document.createElement('button');
    btn.title='Заметка';
    btn.style.cssText='position:absolute;top:10px;right:10px;background:'+(hasNote?'var(--accent)':'var(--surface3)')+';border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;z-index:2';
    btn.textContent=hasNote?'📝':'＋';
    btn.onclick=(e)=>{e.stopPropagation();openNote(roman,groupOrTeacher);};
    card.style.position='relative';
    card.appendChild(btn);
  });
  // Long-press для копирования пары
  body.querySelectorAll('.pair-card.has-subject').forEach(function(card){
    var subj=card.querySelector('.pair-subject');
    var num=card.querySelector('.pair-num');
    if(!subj||!num)return;
    var txt_=num.textContent.trim()+' пара: '+subj.textContent;
    var pt=null;
    card.addEventListener('touchstart',function(){pt=setTimeout(function(){copyPairToClipboard('',txt_);},600);},{passive:true});
    card.addEventListener('touchend',function(){clearTimeout(pt);},{passive:true});
    card.addEventListener('touchmove',function(){clearTimeout(pt);},{passive:true});
  });
}

// ══ СЧЁТЧИК ПОСЕЩЕНИЙ ══
function trackVisit(){
  try{
    const today=new Date().toDateString();
    const data=JSON.parse(stor.get('visit_streak')||'{}');
    if(data.last===today)return;
    const prev=new Date(data.last||0);
    const now=new Date();
    const diffDays=Math.round((now-prev)/(1000*60*60*24));
    data.streak=(diffDays===1?(data.streak||0)+1:1);
    data.last=today;
    data.total=(data.total||0)+1;
    stor.set('visit_streak',JSON.stringify(data));
    if(data.streak>1&&data.streak%5===0){
      setTimeout(()=>toast('🔥 '+data.streak+' дней подряд! Так держать!'),2500);
    }
  }catch(e){}
}

function renderTeacherSchedule(teacher, hdr, entries, filename){
  document.getElementById('sched-group-name').textContent=teacher;
  const cleanDate=formatScheduleDate(hdr);
  document.getElementById('sched-date').textContent=cleanDate||'';
  const dateM=hdr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  const today=new Date();
  let isToday=false;
  if(dateM){
    const sd=new Date(+dateM[3],+dateM[2]-1,+dateM[1]);
    isToday=(sd.getFullYear()===today.getFullYear()&&sd.getMonth()===today.getMonth()&&sd.getDate()===today.getDate());
  }
  const isMon=filename.toUpperCase().includes('ПОНЕДЕЛЬНИК');
  const isSat=filename.toUpperCase().includes('СУББОТ');
  const bell=isMon?BELL_MON:isSat?BELL_SAT:BELL_TUE;
  const nowMin=today.getHours()*60+today.getMinutes();
  const body=document.getElementById('sched-body');
  body.innerHTML='';

  // Если пар нет — "Нет занятий"
  const allPairs=['I','II','III','IV','V','VI'];
  for(const roman of allPairs){
    const pairEntries=entries.filter(e=>e.roman===roman);
    const b=bell[roman];
    let isNow=false,isNext=false;
    if(isToday&&b&&b[0]){
      const[sh,sm]=b[0].split(':').map(Number);
      const endS=b[3]||b[1];
      const[eh,em]=endS.split(':').map(Number);
      const startMin=sh*60+sm,endMin=eh*60+em;
      isNow=nowMin>=startMin&&nowMin<=endMin;
      if(!isNow){const diff=startMin-nowMin;isNext=diff>0&&diff<=30;}
    }
    const isEmpty=pairEntries.length===0;
    const card=document.createElement('div');
    card.className='pair-card'+(isEmpty?'':' has-subject')+(isNow?' is-now':isNext?' is-next':'');
    let badge='',remain='';
    if(isNow){
      badge='<span class="now-badge">● сейчас</span>';
      if(b&&b[1]){const endS=b[3]||b[1];const[eh,em]=endS.split(':').map(Number);const diff=(eh*60+em)-nowMin;remain=`<div class="pair-remain">${diff<=0?'заканч.':diff+' мин'}</div>`;}
    }else if(isNext){badge='<span class="now-badge next-badge">◎ скоро</span>';}
    let timesHtml='';
    if(b){
      const[s1,e1,s2,e2]=b;
      timesHtml=`<div class="pair-times"><div class="pair-time-row"><span class="pair-time-val">${s1} – ${e1}</span><span class="pair-time-tag">${s2?'1 урок':'60 мин'}</span></div>${s2?`<div class="pair-time-row"><span class="pair-time-val">${s2} – ${e2}</span><span class="pair-time-tag">2 урок</span></div>`:''}</div>`;
    }
    let detailsHtml='';
    if(!isEmpty){
      detailsHtml='<div class="pair-details">';
      for(const e of pairEntries){
        // Группа уже показана в заголовке карточки — не дублируем
        // Показываем только предмет мелким шрифтом + кабинет (без инициалов препода)
        if(e.subject) detailsHtml+=`<div style="margin-bottom:4px"><span style="font-size:12px;color:var(--muted)">${e.subject}</span>`;
        else detailsHtml+=`<div style="margin-bottom:4px">`;
        if(e.cabinet) detailsHtml+=`<span style="font-size:11px;color:var(--muted);display:block">кабинет ${e.cabinet}${e.korpus?' корп.'+e.korpus:''}</span>`;
        detailsHtml+=`</div>`;
      }
      detailsHtml+='</div>';
    }
    const mainText=isEmpty?'Окно':pairEntries.map(e=>e.group).join(', ');
    card.innerHTML=`<div class="pair-top"><div class="pair-num">${roman}</div><div class="pair-subject-wrap"><div class="pair-subject${isEmpty?' empty':''}">${mainText}</div>${badge}</div>${remain}</div>${timesHtml}${detailsHtml}`;
    body.appendChild(card);
  }
}



// Добавляем кнопку заметки к каждой паре в renderSchedule и renderTeacherSchedule

// ══ СЧЁТЧИК ПОСЕЩЕНИЙ ══
// ══ РЕЖИМ (student / teacher) ══
var allTeachers=[];

function setMode(mode){
  S.mode=mode;
  saveLocal();
  // Pill тоггл
  const pill=document.getElementById('mode-toggle-pill');
  if(pill){
    pill.classList.toggle('student', mode==='student');
    pill.classList.toggle('teacher', mode==='teacher');
    const btnS=document.getElementById('mode-btn-student');
    const btnT=document.getElementById('mode-btn-teacher');
    if(btnS&&btnT){
      pill.style.setProperty('--pill-student-w', btnS.offsetWidth+'px');
      pill.style.setProperty('--pill-teacher-w', btnT.offsetWidth+'px');
    }
  }
  // Кнопки
  document.getElementById('mode-btn-student')?.classList.toggle('active', mode==='student');
  document.getElementById('mode-btn-teacher')?.classList.toggle('active', mode==='teacher');
  // Заголовок hero
  const ht=document.getElementById('hero-title-text');
  if(ht) ht.innerHTML = mode==='teacher' ? 'Расписание<br>Педагогам' : 'Расписание<br>Студентам';
  // Метки секций
  const fsLabel=document.getElementById('file-section-label');
  if(fsLabel) fsLabel.textContent = mode==='teacher' ? 'Педагогам' : 'Студентам';
  const lgLabel=document.getElementById('last-group-label');
  if(lgLabel) lgLabel.textContent = mode==='teacher' ? 'Продолжить' : 'Продолжить';
  // Кнопка выбора
  const gb=document.getElementById('go-to-groups-btn');
  if(gb) gb.textContent = mode==='teacher' ? 'К педагогам →' : 'К группам →';
  // Быстрый запуск
  updateLastGroupBtn();
}

function initModeUI(){
  const m=S.mode||'student';
  // Ждём рендер чтобы offsetWidth был доступен
  requestAnimationFrame(()=>setMode(m));
}

// goToGroups теперь встроена в оригинальную функцию выше

// Учительский список (через кнопку на главной — в режиме учителей)
async function goToTeacherList(){
  if(!S.selectedFile){toast('Сначала выбери файл');return;}
  showScreen('s-teachers');
  document.getElementById('teachers-title').textContent='Выбор учителя';
  document.getElementById('teacher-search').value='';
  document.getElementById('teacher-list').innerHTML='';
  setStatus('teachers-status','Скачиваю...');setBar('teachers-bar',20);
  try{
    const buf=await getFileBuf();
    allTeachers=detectTeachers(buf);
    setBar('teachers-bar',100);setStatus('teachers-status',`${allTeachers.length} учителей`);
    setTimeout(()=>setBar('teachers-bar',0),800);
    renderTeacherList(allTeachers);
  }catch(e){setBar('teachers-bar',0);setStatus('teachers-status','❌ '+e.message);}
}

// Поиск учителя (через кнопку в нижней навигации — всегда доступно)
async function goToTeacherSearch(){
  if(!S.selectedFile){toast('Сначала загрузи файл расписания');return;}
  showScreen('s-teachers');
  updateNavActive('nav-home');
  document.getElementById('teachers-title').textContent='Поиск учителя';
  document.getElementById('teacher-search').value='';
  document.getElementById('teacher-list').innerHTML='';
  setStatus('teachers-status','Скачиваю...');setBar('teachers-bar',20);
  try{
    const buf=await getFileBuf();
    allTeachers=detectTeachers(buf);
    setBar('teachers-bar',100);setStatus('teachers-status',`${allTeachers.length} учителей`);
    setTimeout(()=>setBar('teachers-bar',0),800);
    renderTeacherList(allTeachers);
  }catch(e){setBar('teachers-bar',0);setStatus('teachers-status','❌ '+e.message);}
}

function renderTeacherList(teachers){
  const list=document.getElementById('teacher-list');
  if(!list) return;
  list.innerHTML='';
  teachers.forEach(t=>{
    const item=document.createElement('div');
    item.className='list-item'+(S.lastTeacher===t?' selected':'');
    item.innerHTML=`<span class="item-name">${t}</span>${S.lastTeacher===t?'<span style="color:var(--accent);font-size:18px">✓</span>':'<span class="item-arrow">›</span>'}`;
    item.onclick=()=>{
      list.querySelectorAll('.list-item').forEach(el=>el.classList.remove('selected'));
      item.classList.add('selected');
      item.innerHTML=`<span class="item-name">${t}</span><span class="loading-spinner" style="opacity:.6"></span>`;
      loadTeacherSchedule(t);
    };
    list.appendChild(item);
  });
}

function filterTeachers(q){
  const f=q.trim().toUpperCase();
  renderTeacherList(f?allTeachers.filter(t=>t.toUpperCase().includes(f)):allTeachers);
}

async function loadTeacherSchedule(teacher){
  if(!S.selectedFile){toast('Выбери файл');return;}
  showScreen('s-schedule');
  S.lastTeacher=teacher;saveLocal();updateLastGroupBtn();
  document.getElementById('sched-group-name').textContent=teacher;
  document.getElementById('sched-date').textContent='';
  document.getElementById('sched-body').innerHTML=
    `<div class="sched-loading"><div class="sched-loading-circle"></div>
     <div style="color:var(--muted);font-size:13px;font-weight:500">Загружаю расписание…</div>
     <div class="sched-loading-dots"><div class="sched-loading-dot"></div><div class="sched-loading-dot"></div><div class="sched-loading-dot"></div></div></div>`;
  try{
    const buf=await getFileBuf();
    const{entries,hdr}=parseDocForTeacher(buf,teacher);
    if(!entries.length)throw new Error(`Учитель "${teacher}" не найден`);
    renderTeacherSchedule(teacher,hdr,entries,S.selectedFile.name);
  }catch(e){
    document.getElementById('sched-body').innerHTML=`<div style="text-align:center;padding:50px;color:var(--danger)">❌ ${e.message}</div>`;
  }
}

// Обновляем updateLastGroupBtn — в режиме учителей показывает последнего учителя

// s-schedule — кнопка назад должна идти на правильный список
function schedBack(){
  SFX.play('screenBack');
  if(S.mode==='teacher'){
    showScreen('s-teachers','back');
  } else {
    showScreen('s-groups','back');
  }
}



// ══ КАРУСЕЛЬ ШРИФТОВ ══
var _fontIdx = 0;

function initFontCarousel(){
  const cur = FONTS.findIndex(f=>f.id===S.font);
  _fontIdx = cur>=0 ? cur : 0;
  renderFontCarousel();
}

function renderFontCarousel(){
  const track = document.getElementById('font-carousel-track');
  const dots = document.getElementById('font-carousel-dots');
  if(!track||!dots) return;
  track.innerHTML='';
  dots.innerHTML='';
  FONTS.forEach((f,i)=>{
    const slide = document.createElement('div');
    slide.className='font-carousel-slide'+(i===_fontIdx?' active':i<_fontIdx?' prev':' next');
    slide.style.fontFamily="'"+f.id+"',sans-serif";
    slide.innerHTML=`<div class="font-carousel-name">${f.name}</div><div class="font-carousel-sub">${f.sub}</div><div style="font-size:13px;margin-top:4px;opacity:.7">${f.preview||'Расписание занятий'}</div>`;
    track.appendChild(slide);
    const dot = document.createElement('button');
    dot.className='font-dot'+(i===_fontIdx?' active':'');
    dot.onclick=()=>{fontCarouselGoto(i);};
    dots.appendChild(dot);
  });
  // preview text
  const prev = document.getElementById('font-preview-text');
  if(prev) prev.style.fontFamily="'"+FONTS[_fontIdx].id+"',sans-serif";
  // apply button
  const btn = document.getElementById('font-apply-btn');
  if(btn){
    const applied = FONTS[_fontIdx].id===S.font;
    btn.textContent = applied ? '✓ Применён: '+FONTS[_fontIdx].name : 'Применить: '+FONTS[_fontIdx].name;
    btn.style.opacity = applied ? '.6' : '1';
  }
}

function fontCarouselGoto(idx){
  _fontIdx = (idx+FONTS.length)%FONTS.length;
  renderFontCarousel();
}
function fontCarouselStep(dir){
  SFX.play('themeSelect');
  fontCarouselGoto(_fontIdx+dir);
}
function fontCarouselApply(){
  applyFont(FONTS[_fontIdx].id);
  renderFontCarousel();
  toast('Шрифт: '+FONTS[_fontIdx].name);
}

// Свайп на карусели
(function(){
  let sx=0,sy=0;
  document.addEventListener('touchstart',e=>{
    const t=e.target.closest('.font-carousel-track,.font-carousel');
    if(!t)return;
    sx=e.touches[0].clientX;sy=e.touches[0].clientY;
  },{passive:true});
  document.addEventListener('touchend',e=>{
    const t=e.target.closest('.font-carousel-track,.font-carousel');
    if(!t)return;
    const dx=e.changedTouches[0].clientX-sx;
    const dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>30){
      fontCarouselStep(dx<0?1:-1);
    }
  },{passive:true});
})();



// ══ ПРИКОЛЮХИ ══

// 🎓 "Конец учебного года" — если дата близко к июню, особое приветствие
function getSpecialDateGreeting(){
  const now=new Date();
  const m=now.getMonth()+1,d=now.getDate();
  if(m===9&&d===1) return{greet:'С 1 сентября!',icon:'🎒',sub:'Новый учебный год начинается!'};
  if(m===6&&d<=7) return{greet:'Скоро каникулы!',icon:'🏖',sub:'Совсем чуть-чуть осталось!'};
  if(m===12&&d>=25||m===1&&d<=8) return{greet:'С Новым годом!',icon:'🎄',sub:'Зимние каникулы!'};
  if(m===3&&d===8) return{greet:'С 8 марта!',icon:'🌸',sub:'Поздравляем!'};
  if(m===2&&d===23) return{greet:'С 23 февраля!',icon:'🎖',sub:'С праздником!'};
  return null;
}

// 🎲 Кнопка "Рандомная группа" — открывает случайную группу из списка
function openRandomGroup(){
  if(!allGroups||!allGroups.length){toast('Сначала загрузи файл расписания');return;}
  const g=allGroups[Math.floor(Math.random()*allGroups.length)];
  toast('🎲 Открываю: '+g);
  setTimeout(()=>loadSchedule(g),300);
}

// 🌈 Пасхалка встряски отключена — слишком легко срабатывала случайно
// (initShake удалён)

// 🕐 "Осталось до конца пары" — тост если открыл расписание во время пары
function checkCurrentPairEnd(){
  const now=new Date();
  const nowMin=now.getHours()*60+now.getMinutes();
  const bells=[BELL_MON,BELL_TUE,BELL_SAT];
  for(const bell of bells){
    for(const[,times] of Object.entries(bell)){
      if(!times[0])continue;
      const[sh,sm]=times[0].split(':').map(Number);
      const endS=times[3]||times[1];
      const[eh,em]=endS.split(':').map(Number);
      const startMin=sh*60+sm,endMin=eh*60+em;
      if(nowMin>=startMin&&nowMin<endMin){
        const left=endMin-nowMin;
        if(left<=10&&left>0){
          setTimeout(()=>toast(`⏰ Пара заканчивается через ${left} мин!`),1500);
        }
        return;
      }
    }
    break; // только первый bell проверяем при старте
  }
}



// ══ ЛОГИРОВАНИЕ (JS) ══
const _appLogs = [];
const _logMax = 500;

function appLog(level, msg) {
  const ts = new Date().toISOString().slice(11,23);
  const entry = {ts, level, msg: String(msg)};
  _appLogs.push(entry);
  if(_appLogs.length > _logMax) _appLogs.shift();
}

function logOpen(){
  const ov = document.getElementById('log-overlay');
  if(!ov) return;
  ov.classList.add('show');
  renderLogBody();
}
function logClose(){
  document.getElementById('log-overlay')?.classList.remove('show');
}
function renderLogBody(){
  const body = document.getElementById('log-body');
  if(!body) return;
  body.innerHTML = _appLogs.map(e =>
    `<div class="log-entry ${e.level}">[${e.ts}] [${e.level.toUpperCase()}] ${e.msg.replace(/</g,'&lt;')}</div>`
  ).reverse().join('');
}
function logCopy(){
  const text = _appLogs.map(e=>`[${e.ts}][${e.level}] ${e.msg}`).join('\n');
  if(navigator.clipboard){navigator.clipboard.writeText(text).then(()=>toast('✅ Логи скопированы'));}
  else{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);toast('✅ Логи скопированы');}
}
function logDownload(){
  const text = _appLogs.map(e=>`[${e.ts}][${e.level}] ${e.msg}`).join('\n');
  const blob = new Blob([text],{type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ScheduleApp_JS_logs.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('💾 Лог сохранён');
}
function logClear(){
  _appLogs.length = 0;
  renderLogBody();
  toast('Лог очищен');
}

// ── Консоль: вывод строки ──────────────────────────────────────────────────
function logPrint(cls, text) {
  const ts = new Date().toISOString().slice(11,19);
  const entry = { ts, level: cls, msg: String(text) };
  _appLogs.push(entry);
  if (_appLogs.length > _logMax) _appLogs.shift();
  // Если консоль открыта — дописываем в реальном времени
  const body = document.getElementById('log-body');
  if (body) {
    const div = document.createElement('div');
    div.className = 'log-entry ' + cls;
    div.textContent = '[' + ts + '] ' + text;
    body.prepend(div);
  }
}

// ── Консоль: обработчик команд ─────────────────────────────────────────────
function logRunCmd(raw) {
  const parts = raw.trim().split(' ');
  const cmd   = parts[0].toLowerCase().replace(/^\//, '');
  const arg   = parts.slice(1).join(' ').trim();

  logPrint('out', '> ' + raw);

  switch (cmd) {
    case 'help':
      logPrint('info', 'Доступные команды:');
      logPrint('ok',   '  /help       — этот список');
      logPrint('ok',   '  /settings   — открыть настройки ⚙️');
      logPrint('ok',   '  /theme <id> — сменить тему');
      logPrint('ok',   '  /clear      — очистить лог');
      logPrint('ok',   '  /version    — версия');
      logPrint('ok',   '  /logs       — показать последние логи');
      break;
    case 'settings':
      logPrint('ok', '⚙️ Открываю настройки...');
      logClose();
      setTimeout(() => { try { navTo('s-settings', 'nav-settings'); } catch(e) { showScreen('s-settings'); } }, 150);
      break;
    case 'clear':
      _appLogs.length = 0;
      renderLogBody();
      logPrint('muted', '— консоль очищена —');
      break;
    case 'theme':
      if (!arg) {
        logPrint('info', 'Темы: orange amoled win11 pixel forest rose gold purple sunset bw ocean candy light');
      } else {
        try { setTheme(arg); logPrint('ok', '🎨 Тема: ' + arg); } catch(e) { logPrint('err', '❌ Ошибка: ' + e.message); }
      }
      break;
    case 'version':
      logPrint('ok', '📦 ScheduleApp WebView');
      logPrint('ok', '  UA: ' + navigator.userAgent.slice(0, 80));
      break;
    case 'logs':
      logPrint('info', 'Последние ' + Math.min(_appLogs.length, 20) + ' записей:');
      _appLogs.slice(-20).forEach(e => logPrint(e.level, '[' + e.ts + '] ' + e.msg));
      break;
    default:
      logPrint('err', '❌ Неизвестная команда: /' + cmd + '  (введи /help)');
  }
}



// ══════════════════════════════════════════════════════════════════════
// 🚨 УМНЫЙ ПЕРЕХВАТЧИК КРИТИЧЕСКИХ ОШИБОК
// Логирует все ошибки. При критических — автоматически показывает
// диалог восстановления из бэкапа (через showCriticalErrorBackupDialog).
//
// Критерии «критической» ошибки:
//  1. ReferenceError / TypeError в ядре приложения (core.js, social.js)
//  2. SyntaxError в любом файле приложения
//  3. Накопление: 3+ разных ошибок за 10 секунд
//  4. Прямой вызов через window._reportCriticalError(msg)
// ══════════════════════════════════════════════════════════════════════

const _errTracker = {
  errors: [],          // { msg, ts }
  WINDOW_MS: 10000,   // окно подсчёта — 10 сек
  THRESHOLD: 3,        // сколько ошибок считаем критичным пакетом
};

// Список файлов приложения (только наши)
const _APP_FILES = ['core.js', 'social.js', 'games.js', 'index.html'];

function _isAppFile(filename) {
  if (!filename) return false;
  return _APP_FILES.some(f => filename.includes(f));
}

function _isCriticalError(type, msg, filename) {
  // SyntaxError в любом нашем файле — всегда критично
  if (type === 'SyntaxError' && _isAppFile(filename)) return true;
  // ReferenceError/TypeError в нашем файле — критично
  if ((type === 'ReferenceError' || type === 'TypeError') && _isAppFile(filename)) return true;
  // Ошибка загрузки ресурса (скрипт не загрузился)
  if (msg && msg.includes('Script error')) return true;
  return false;
}

function _trackError(msg, filename, type) {
  const now = Date.now();
  // Очищаем устаревшие
  _errTracker.errors = _errTracker.errors.filter(e => now - e.ts < _errTracker.WINDOW_MS);
  _errTracker.errors.push({ msg, ts: now });

  // Критичная одиночная ошибка
  if (_isCriticalError(type, msg, filename)) {
    _triggerBackupDialog(msg);
    return;
  }
  // Накопилось 3+ ошибок за 10 секунд — тоже критично
  if (_errTracker.errors.length >= _errTracker.THRESHOLD) {
    _triggerBackupDialog('Слишком много ошибок: ' + msg);
  }
}

function _triggerBackupDialog(msg) {
  // Даём время логгеру отработать, потом показываем диалог
  setTimeout(() => {
    if (typeof window.showCriticalErrorBackupDialog === 'function') {
      window.showCriticalErrorBackupDialog(msg);
    }
  }, 600);
}

// Публичный метод для вызова из любого места (например, из catch в loadFiles)
window._reportCriticalError = function(msg) {
  appLog('err', '[CRITICAL] ' + msg);
  _triggerBackupDialog(msg);
};

window.addEventListener('error', e => {
  const filename = e.filename?.split('/').pop() || '';
  const type = e.error?.constructor?.name || '';
  const msg  = e.message || 'Unknown error';
  appLog('err', `${msg} [${filename}:${e.lineno}]`);
  _trackError(msg, filename, type);
});

window.addEventListener('unhandledrejection', e => {
  const reason = e.reason;
  const msg = reason?.message || String(reason) || 'Promise rejected';
  appLog('err', 'Promise rejection: ' + msg);
  // Unhandled rejection в нашем коде считаем критичной если содержит стек из app-файлов
  const stack = reason?.stack || '';
  const fromApp = _APP_FILES.some(f => stack.includes(f));
  if (fromApp) {
    _trackError(msg, stack, reason?.constructor?.name || '');
  }
});

// Логируем ключевые события приложения
const _origLoadFiles = null; // будет перехвачен после определения


// ══ ДОПОЛНИТЕЛЬНЫЕ ФИШКИ ══

// 🎯 Виджет «Следующий перерыв» на главном экране
function getNextBreakInfo(){
  const now=new Date();
  const nowMin=now.getHours()*60+now.getMinutes();
  const dow=now.getDay(); // 0=вс,6=сб
  const bell=dow===1?BELL_MON:dow===6?BELL_SAT:BELL_TUE;
  const entries=Object.entries(bell);
  for(let i=0;i<entries.length;i++){
    const[roman,times]=entries[i];
    if(!times[0])continue;
    const[eh,em]=(times[3]||times[1]).split(':').map(Number);
    const endMin=eh*60+em;
    if(nowMin<endMin){
      const[sh,sm]=times[0].split(':').map(Number);
      const startMin=sh*60+sm;
      if(nowMin>=startMin){
        // Сейчас идёт пара — вычисляем до конца пары и до конца текущего урока
        const left=endMin-nowMin;
        // Урок 1: times[0]–times[1], урок 2: times[2]–times[3] (если есть)
        let lessonLeft = left; // по умолчанию = до конца пары (суббота / однократные)
        if(times[2] && times[3]){
          const[l1h,l1m]=times[1].split(':').map(Number);
          const end1Min=l1h*60+l1m;
          const[l2h,l2m]=times[2].split(':').map(Number);
          const start2Min=l2h*60+l2m;
          if(nowMin<end1Min){
            lessonLeft=end1Min-nowMin; // идёт урок 1
          } else if(nowMin<start2Min){
            lessonLeft=0; // перемена между уроками (≈5 мин)
          } else {
            lessonLeft=endMin-nowMin; // идёт урок 2
          }
        }
        const pct=Math.min(100,Math.round((nowMin-startMin)/(endMin-startMin)*100));
        return{type:'pair',roman,left,lessonLeft,end:times[3]||times[1],pct};
      }
      if(nowMin<startMin){
        const toStart=startMin-nowMin;
        // Вычисляем прогресс перерыва (сколько перерыва прошло)
        let pct=null;
        if(i>0){
          const prev=entries[i-1][1];
          const[pe,pm]=(prev[3]||prev[1]).split(':').map(Number);
          const prevEndMin=pe*60+pm;
          const breakTotal=startMin-prevEndMin;
          if(breakTotal>0) pct=Math.min(100,Math.round((nowMin-prevEndMin)/breakTotal*100));
        }
        return{type:'break',roman,toStart,start:times[0],pct};
      }
    }
  }
  return null;
}

// 📌 Показываем инфо о текущей/следующей паре под hero-card — два прогресс-бара
function updateHeroWidget(){
  let el=document.getElementById('hero-widget');
  if(!el){
    el=document.createElement('div');
    el.id='hero-widget';
    el.style.cssText='margin-top:14px;width:100%;font-family:var(--app-font,Geologica),sans-serif';
    const hero=document.querySelector('.home-hero');
    if(hero)hero.appendChild(el);
  }
  const info=getNextBreakInfo();
  if(!info){el.innerHTML='';return;}

  if(info.type==='pair'){
    // Бар 1: прогресс текущей пары
    const pct=info.pct??0;
    el.innerHTML=`
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:11px;color:var(--muted)">⏱ Пара ${info.roman} · до ${info.end}</span>
          <span style="font-size:11px;font-weight:700;color:var(--accent)">${info.left} мин</span>
        </div>
        <div style="height:5px;background:var(--surface3);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px;transition:width .6s ease"></div>
        </div>
      </div>`;
  } else {
    // Бар 1: прогресс перерыва (сколько прошло)
    const breakPct=info.pct??0;
    el.innerHTML=`
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:11px;color:var(--muted)">☕ До пары ${info.roman} · начало в ${info.start}</span>
          <span style="font-size:11px;font-weight:700;color:var(--accent)">${info.toStart} мин</span>
        </div>
        <div style="height:5px;background:var(--surface3);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${breakPct}%;background:var(--accent);border-radius:3px;transition:width .6s ease"></div>
        </div>
      </div>`;
  }
}
// Обновляем каждую минуту
setInterval(updateHeroWidget, 60000);
// После инита
setTimeout(updateHeroWidget, 500);

// 🌙 Ночной режим — автоматически снижает яркость после 22:00
function checkNightMode(){
  const h=new Date().getHours();
  const isNight=(h>=22||h<6);
  const sec=loadSecret();
  if(isNight&&!sec.nightModeOff&&!document.getElementById('night-filter')){
    const div=document.createElement('div');
    div.id='night-filter';
    div.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.15);pointer-events:none;z-index:9998;transition:opacity .5s';
    document.body.appendChild(div);
  } else if(!isNight&&document.getElementById('night-filter')){
    document.getElementById('night-filter').remove();
  }
}
setInterval(checkNightMode,300000);
setTimeout(checkNightMode,1000);



// ══ БОНУСНЫЕ ФИШКИ (+10) ══

// ① Счётчик пар за день — сколько пар осталось сегодня
function getRemainingPairsToday(){
  const now=new Date();
  const nowMin=now.getHours()*60+now.getMinutes();
  const dow=now.getDay();
  const bell=dow===1?BELL_MON:dow===6?BELL_SAT:BELL_TUE;
  let remaining=0;
  for(const[,[s1]] of Object.entries(bell)){
    if(!s1)continue;
    const[h,m]=s1.split(':').map(Number);
    if(h*60+m>nowMin)remaining++;
  }
  return remaining;
}

// ② "Случайный факт" в тосте — по команде /fact в CMD или кнопкой
const RANDOM_FACTS=[
  'Самая длинная лекция в истории длилась 54 часа. Студент не сдался.',
  'Средний студент пьёт 3 чашки кофе в день. В сессию — 7.',
  'Слово «дедлайн» изначально означало черту в тюрьме, за которой стреляли.',
  'Исследования: 80% конспектов не перечитывается никогда.',
  'Мозг запоминает лучше, если учиться перед сном. Не в 3 ночи перед экзаменом.',
  'Первый в мире университет — Болонский, основан в 1088 году.',
  'Средняя скорость записи — 30 слов в минуту. Преподаватели говорят быстрее.',
  'Синдром самозванца испытывают 70% студентов. Ты не один.',
  'Учёные доказали: перерывы каждые 25 минут повышают продуктивность на 40%.',
  'Первая оценка в истории — поставлена в 1792 году в Кембридже.',
  'В среднем студент теряет 3 ручки в семестр. Они попадают в параллельное измерение.',
  'Если учиться 10000 часов — станешь экспертом. Это ~417 дней без сна.',
];
function showRandomFact(){
  const f=RANDOM_FACTS[Math.floor(Math.random()*RANDOM_FACTS.length)];
  // Показываем в большом тосте
  const existing=document.getElementById('fact-toast');
  if(existing)existing.remove();
  const el=document.createElement('div');
  el.id='fact-toast';
  el.style.cssText='position:fixed;bottom:calc(80px + var(--safe-bot,0px));left:16px;right:16px;background:var(--surface2);border:1.5px solid var(--surface3);border-radius:16px;padding:16px;z-index:500;font-size:13px;line-height:1.5;color:var(--text);box-shadow:0 8px 32px rgba(0,0,0,.4);cursor:pointer';
  el.innerHTML=`<div style="font-size:10px;font-weight:700;color:var(--accent);letter-spacing:.1em;margin-bottom:6px">💡 СЛУЧАЙНЫЙ ФАКТ</div>${f}`;
  el.onclick=()=>el.remove();
  document.body.appendChild(el);
  setTimeout(()=>el?.remove(),7000);
}
// Добавляем в CMD
const _factCmd=['/fact','случайный факт 💡'];

// ③ Погода в тосте по геолокации (без API — только через open-meteo)
async function showWeatherToast(){
  if(!navigator.geolocation){toast('❌ Геолокация недоступна');return;}
  toast('📍 Определяю местоположение...');
  navigator.geolocation.getCurrentPosition(async pos=>{
    try{
      const{latitude:lat,longitude:lon}=pos.coords;
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&wind_speed_unit=ms`;
      const r=await fetch(url);
      const d=await r.json();
      const t=Math.round(d.current?.temperature_2m??0);
      const code=d.current?.weather_code??0;
      const icons=[[0,'☀️'],[1,'🌤'],[2,'⛅'],[3,'☁️'],[45,'🌫'],[48,'🌫'],[51,'🌦'],[61,'🌧'],[71,'🌨'],[80,'🌦'],[95,'⛈']];
      const ico=(icons.find(([c])=>code<=c)||[,'🌡'])[1];
      toast(`${ico} На улице ${t}°C`);
    }catch(e){toast('❌ Не удалось получить погоду');}
  },()=>toast('❌ Доступ к геолокации запрещён'));
}

// ④ Анти-скука таймер — напоминает встряхнуть себя если не было активности 30 мин
let _lastActivity=Date.now();
document.addEventListener('touchstart',()=>{_lastActivity=Date.now();},{passive:true});
document.addEventListener('click',()=>{_lastActivity=Date.now();});
setInterval(()=>{
  const idle=Date.now()-_lastActivity;
  if(idle>1800000&&document.getElementById('s-home')?.classList.contains('active')){
    toast('👀 Давно не заходил в расписание. Не забудь проверить пары!');
    _lastActivity=Date.now();
  }
},300000);

// ⑤ Быстрое копирование расписания — зажать на карточке пары
function copyPairToClipboard(roman,text){
  const t=`${roman} пара: ${text}`;
  if(navigator.clipboard){navigator.clipboard.writeText(t).then(()=>toast('📋 Пара скопирована'));}
  else{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);toast('📋 Скопировано');}
}

function getAppStats(){
  try{
    const v=JSON.parse(stor.get('visit_streak')||'{}');
    return{total:v.total||0,streak:v.streak||0};
  }catch(e){return{total:0,streak:0};}
}
// Показывается в CMD через /stats
function showStats(){
  const s=getAppStats();
  const remaining=getRemainingPairsToday();
  cmdPrint('info',`📊 Статистика приложения:`);
  cmdPrint('ok', `  Открыто всего: ${s.total} раз`);
  cmdPrint('ok', `  Стрик: ${s.streak} дней подряд 🔥`);
  cmdPrint('ok', `  Пар осталось сегодня: ${remaining}`);
  const notes=loadNotes();
  cmdPrint('ok', `  Заметок к парам: ${Object.keys(notes).length}`);
}

// ⑦ "Режим фокуса" — скрывает всё кроме текущей пары
let _focusMode=false;
function toggleFocusMode(){
  _focusMode=!_focusMode;
  const cards=document.querySelectorAll('.pair-card');
  cards.forEach(c=>{
    if(_focusMode&&!c.classList.contains('is-now')&&!c.classList.contains('is-next')){
      c.style.opacity='0.25';
      c.style.transform='scale(0.97)';
    } else {
      c.style.opacity='';
      c.style.transform='';
    }
  });
  toast(_focusMode?'🎯 Режим фокуса: только текущая пара':'🎯 Режим фокуса выключен');
}

// ⑧ Генератор отмазки для пропуска пары
const EXCUSES=[
  'У меня внезапно разрядился телефон, а будильник стоял именно на нём.',
  'Автобус уехал ровно тогда, когда я к нему подбежал.',
  'Я был, но сидел так тихо, что меня не заметили.',
  'Медицинские показания. Врач сказал "отдыхайте". Я послушался.',
  'Готовился к следующей паре — она важнее.',
  'Интернет подтвердил, что пара отменена. Интернет врал.',
  'Застрял в лифте. В здании без лифта.',
  'Бабушка. Всегда бабушка.',
  'Я был там духовно.',
  'Форс-мажор международного масштаба.',
];
function getExcuse(){
  return EXCUSES[Math.floor(Math.random()*EXCUSES.length)];
}

// ⑨ Мини-тест "Знаешь ли ты своё расписание?" — угадай время пары
let _quizActive=false;
function startScheduleQuiz(){
  if(_quizActive)return;
  _quizActive=true;
  const bells=Object.entries(BELL_TUE);
  const idx=Math.floor(Math.random()*bells.length);
  const[roman,[s1,e1]]=bells[idx];
  const wrong1=`${String(parseInt(s1)+1).padStart(2,'0')}:${s1.split(':')[1]}`;
  const wrong2=`${String(parseInt(s1)-1).padStart(2,'0')}:${s1.split(':')[1]}`;
  const options=[s1,wrong1,wrong2].sort(()=>Math.random()-.5);
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px';
  const sheet=document.createElement('div');
  sheet.style.cssText='background:var(--surface);border-radius:20px;padding:24px;width:100%;max-width:360px;border:1.5px solid var(--surface3)';
  sheet.innerHTML=`<div style="font-size:16px;font-weight:800;color:var(--accent);margin-bottom:16px">🧠 Знаешь расписание?</div><div style="font-size:14px;margin-bottom:18px">Когда начинается <b style="color:var(--accent)">пара ${roman}</b>?</div><div style="display:flex;flex-direction:column;gap:8px">${options.map(o=>`<button onclick="quizAnswer('${o}','${s1}',this.closest('div').parentElement.parentElement)" style="padding:13px;background:var(--surface2);border:1.5px solid var(--surface3);border-radius:12px;color:var(--text);font-family:inherit;font-size:15px;font-weight:600;cursor:pointer">${o}</button>`).join('')}</div>`;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}
function quizAnswer(chosen,correct,overlay){
  _quizActive=false;
  const btns=overlay.querySelectorAll('button');
  btns.forEach(b=>{
    b.disabled=true;
    if(b.textContent===correct)b.style.background='var(--success,#4a9e5c)';
    else if(b.textContent===chosen&&chosen!==correct)b.style.background='var(--danger,#c94f4f)';
  });
  setTimeout(()=>{overlay.remove();toast(chosen===correct?'✅ Правильно! Ты знаешь расписание 🎓':'❌ Неверно! Загляни в расписание почаще 😅');},800);
}

// ⑩ Мотивационные сообщения — в зависимости от дня недели
const MOTIVATIONS={
  1:['Понедельник — день тяжёлый, но ты справишься 💪','Неделя только началась — всё впереди!','С понедельника начинается новая версия тебя 🚀'],
  2:['Вторник — уже не понедельник. Прогресс!','Ты пережил понедельник. Вторник — пустяки.'],
  3:['Среда — экватор недели! Половина позади 🏆','В середине пути самое важное — не останавливаться.'],
  4:['Четверг — почти пятница. Почти.','Один день до финиша. Держись!'],
  5:['ПЯТНИЦА! 🎉 Ты дожил!','Последний рывок — и выходные твои!'],
  6:['Суббота. Даже учёба в выходной — это сила.','Пока другие отдыхают, ты растёшь 📈'],
  0:['Воскресенье. Заряжайся перед новой неделей 🔋','Отдохни сегодня — завтра в бой!'],
};
function getDayMotivation(){
  const dow=new Date().getDay();
  const arr=MOTIVATIONS[dow]||MOTIVATIONS[1];
  return arr[Math.floor(Math.random()*arr.length)];
}
// Добавляем /bell, /haiku, /bpmtap, /glitch, /taunt, /mirror, /warp, /confetti, /sus, /chaos в CMD_HELP
if(typeof CMD_HELP!=='undefined'){
  [
    ['/bell','звонок с анимацией 🔔'],['/haiku','хайку про учёбу 🌸'],
    ['/bpmtap','тапай в ритм — BPM 🥁'],['/glitch','глитч 3 сек 👾'],
    ['/taunt','реплика учителя 👩‍🏫'],['/mirror','зеркальный интерфейс 🪞'],
    ['/warp','хаос шрифтов 🌀'],['/confetti','конфетти 🎊'],
    ['/sus','амогус 📮'],['/chaos','все игры сразу 🎮'],
  ].forEach(c=>{if(!CMD_HELP.find(x=>x[0]===c[0]))CMD_HELP.push(c);});
}
// ══════════════════════════════════════════════════════════════════

// ⑪ Школьный звонок с анимацией
function funBell(){
  const ctx = new (window.AudioContext||window.webkitAudioContext)();
  const ring=(freq,t)=>{const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=freq;g.gain.setValueAtTime(0,ctx.currentTime+t);g.gain.linearRampToValueAtTime(0.3,ctx.currentTime+t+0.02);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+t+0.6);o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+0.7);};
  [0,0.08,0.16,0.24,0.32,0.40].forEach((t,i)=>ring(i%2===0?880:1046,t));
  toast('🔔 Звонок на урок!');
  // bell shake animation
  document.body.style.animation='none';
  const el=document.getElementById('hero-title-text');
  if(el){el.style.transition='transform .08s';let n=0;const iv=setInterval(()=>{el.style.transform=n%2?'rotate(3deg)':'rotate(-3deg)';n++;if(n>12){clearInterval(iv);el.style.transform='';}},80);}
}

// ⑫ Хайку про учёбу (рандомное)
const HAIKU_LIST=[
  ['Звонок прозвенел','Тетрадь тихо открыта','Сон не отпускает'],
  ['Домашнее есть','«Кто выполнил?» — тишина','Все смотрят в окно'],
  ['Урок математик','x не находит себя','Я — тоже'],
  ['Доска исписана','Мел крошится и падёт','Пятница близко'],
  ['Звонок. Конец пар','Рюкзак собран за секунд','Свобода пришла'],
  ['Список предметов','Такой длинный, как страданье','Выходной — мечта'],
  ['Контрольная — враг','Случайные варианты','Я знал эти все'],
];
function funHaiku(){
  const h=HAIKU_LIST[Math.floor(Math.random()*HAIKU_LIST.length)];
  toast('🌸 '+h.join(' / '));
}

// ⑬ BPM тапалка (тапай в ритм 8 раз)
let _bpmTaps=[],_bpmTimer=null;
function funBpmTap(){
  const now=Date.now();
  _bpmTaps.push(now);
  clearTimeout(_bpmTimer);
  _bpmTimer=setTimeout(()=>{
    if(_bpmTaps.length>=4){
      const diffs=[];
      for(let i=1;i<_bpmTaps.length;i++)diffs.push(_bpmTaps[i]-_bpmTaps[i-1]);
      const avg=diffs.reduce((a,b)=>a+b,0)/diffs.length;
      const bpm=Math.round(60000/avg);
      toast('🥁 Твой ритм: '+bpm+' BPM'+(bpm<80?' — медленнее дыши 😌':bpm>160?' — ты барабанщик 🤘':''));
    }
    _bpmTaps=[];
  },2000);
  toast('🥁 '+'•'.repeat(Math.min(_bpmTaps.length,8))+(_bpmTaps.length<4?' — ещё':''));
}

// ⑭ Глитч-эффект на 3 секунды
let _glitchActive=false;
function funGlitch(){
  if(_glitchActive)return;
  _glitchActive=true;
  const style=document.createElement('style');
  style.id='glitch-style';
  style.textContent=`
    @keyframes glitch-skew{0%,100%{transform:skewX(0)}20%{transform:skewX(-4deg)}40%{transform:skewX(3deg)}60%{transform:skewX(-2deg)}80%{transform:skewX(2deg)}}
    @keyframes glitch-color{0%{filter:none}25%{filter:hue-rotate(90deg) saturate(3)}50%{filter:hue-rotate(180deg) contrast(2)}75%{filter:hue-rotate(270deg) brightness(1.5)}100%{filter:none}}
    body.glitch-on{animation:glitch-skew 0.15s infinite, glitch-color 0.3s infinite!important;}
    body.glitch-on *{animation:none!important;transition:none!important;}
  `;
  document.head.appendChild(style);
  document.body.classList.add('glitch-on');
  toast('👾 GLITCH');
  setTimeout(()=>{
    document.body.classList.remove('glitch-on');
    const s=document.getElementById('glitch-style');if(s)s.remove();
    _glitchActive=false;
  },3000);
}

// ⑮ Реплики учителя (рандомные)
const TEACHER_TAUNTS=[
  '👩‍🏫 «Ещё раз опоздаешь — в журнал!»',
  '👨‍🏫 «Кто не понял — подойдёт после урока»',
  '👩‍🏫 «Это будет на контрольной. Записывайте.»',
  '👨‍🏫 «Тишина в классе! Я слышу жвачку.»',
  '👩‍🏫 «Убери телефон, иначе до родителей»',
  '👨‍🏫 «Повторите дома. Всё. Прямо всё.»',
  '👩‍🏫 «Это проходили в прошлом году. Как вы не знаете?»',
  '👨‍🏫 «Опять двоечники вышли к доске первыми...»',
  '👩‍🏫 «Лучший ответ — тот, которого не было.»',
  '👨‍🏫 «Мы опаздываем на 20 минут, поэтому задание на дом двойное.»',
];
function funTaunt(){toast(TEACHER_TAUNTS[Math.floor(Math.random()*TEACHER_TAUNTS.length)]);}

// ⑯ Зеркальный режим интерфейса
let _mirrorOn=false;
function funMirror(){
  _mirrorOn=!_mirrorOn;
  document.body.style.transform=_mirrorOn?'scaleX(-1)':'';
  document.body.style.transition='transform .4s';
  toast(_mirrorOn?'🪞 Зеркало включено — всё наоборот!':'🪞 Зеркало выключено');
}

// ⑰ Режим искажения шрифта (warp)
let _warpOn=false,_warpRaf=null,_warpT=0;
function funWarp(){
  _warpOn=!_warpOn;
  if(!_warpOn){cancelAnimationFrame(_warpRaf);document.documentElement.style.setProperty('--app-font',S.font?("'"+S.font+"'"):"'Geologica'");toast('🌀 Warp выключен');return;}
  toast('🌀 Warp режим — шрифты сходят с ума!');
  const fonts=["'Geologica'","'Unbounded'","'Comfortaa'","'Caveat'","'Bebas Neue'","'Bangers'","'Dela Gothic One'","'JetBrains Mono'"];
  const loop=()=>{
    if(!_warpOn)return;
    _warpT++;
    if(_warpT%8===0){const f=fonts[Math.floor(Math.random()*fonts.length)];document.documentElement.style.setProperty('--app-font',f);}
    _warpRaf=requestAnimationFrame(loop);
  };
  loop();
}

// ⑱ Конфетти-взрыв
function funConfetti(){
  const canvas=document.createElement('canvas');
  canvas.style.cssText='position:fixed;inset:0;z-index:9990;pointer-events:none;width:100%;height:100%';
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  document.body.appendChild(canvas);
  const ctx=canvas.getContext('2d');
  const COLORS=['#e87722','#00e5ff','#a78bfa','#ff66aa','#f5c518','#4caf7d'];
  const particles=Array.from({length:120},()=>({
    x:Math.random()*canvas.width,y:-10,
    vx:(Math.random()-0.5)*6,vy:Math.random()*4+3,
    r:Math.random()*6+3,c:COLORS[Math.floor(Math.random()*COLORS.length)],
    rot:Math.random()*360,rv:(Math.random()-0.5)*8,
    shape:Math.random()<0.5?'rect':'circle',
  }));
  let frame=0;
  const loop=()=>{
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;p.vy+=0.12;p.rot+=p.rv;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle=p.c;ctx.globalAlpha=Math.max(0,1-frame/90);
      if(p.shape==='rect'){ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6);}else{ctx.beginPath();ctx.arc(0,0,p.r/2,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    });
    frame++;
    if(frame<100)requestAnimationFrame(loop);else canvas.remove();
  };
  loop();
  toast('🎊 Конфетти!');
}

// ⑲ Sus-режим (амогус пасхалка)
const SUS_MSGS=[
  '📮 Ты — самозванец в группе. Red всегда подозрительный.',
  '📮 EMERGENCY MEETING! Кто-то не сдал домашку... 👀',
  '📮 Vent detected. Вентиляция в кабинете закрыта.',
  '📮 Task complete: "Сдать реферат" ✅',
  '📮 Dead body reported: Твоя мотивация во вторник.',
  '📮 Impostor sus: Учитель был с нами... или нет? 🤔',
];
function funSus(){toast(SUS_MSGS[Math.floor(Math.random()*SUS_MSGS.length)]);}

// ⑳ Chaos Mode — все игры сразу (маленькие окошки)
let _chaosOn=false;
function funChaosMode(){
  if(_chaosOn){
    const old=document.getElementById('chaos-overlay');
    if(old)old.remove();_chaosOn=false;
    toast('🎮 Chaos mode выключен');return;
  }
  _chaosOn=true;
  const ov=document.createElement('div');
  ov.id='chaos-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:8500;background:rgba(0,0,0,.9);overflow:auto;padding:50px 10px 10px;display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start';
  const btn=document.createElement('button');
  btn.textContent='✕ Закрыть Chaos';
  btn.style.cssText='position:fixed;top:10px;right:10px;z-index:8501;background:var(--danger,#c94f4f);border:none;color:#fff;padding:8px 14px;border-radius:8px;font-family:inherit;font-weight:700;cursor:pointer;font-size:13px';
  btn.onclick=funChaosMode;ov.appendChild(btn);
  const titles=['🐍 Змейка','❌ Крестики','🏓 Понг','🧱 Тетрис','🦕 Динозавр'];
  const srcs=['snake','ttt','pong','tetris','dino'];
  srcs.forEach((g,i)=>{
    const wrap=document.createElement('div');
    wrap.style.cssText='width:calc(50% - 4px);background:var(--surface2);border-radius:10px;overflow:hidden;font-size:11px;color:var(--muted);padding:4px;text-align:center';
    wrap.innerHTML='<div style="padding:4px 0;font-weight:700;color:var(--accent)">'+titles[i]+'</div>';
    const mini=document.createElement('div');mini.style.cssText='transform:scale(0.45);transform-origin:top left;width:222%;pointer-events:none;height:200px;overflow:hidden';
    wrap.appendChild(mini);ov.appendChild(wrap);
  });
  document.body.appendChild(ov);
  toast('🎮 Chaos Mode! (все игры сразу)');
}

// Команды ⑪–⑳ встроены в cmdExec switch выше

// ══ КОНЕЦ ПРИКОЛЬНЫХ ФУНКЦИЙ ══



// Tanks — continuous fire/move on held touch
var _tanksHeld={};
document.addEventListener('touchstart',function(e){
  var b=e.target.closest('.dpad-btn,.tanks-shoot-btn');
  if(!b||!document.getElementById('egg-tanks')||document.getElementById('egg-tanks').style.display==='none')return;
  var dir=b.getAttribute('data-dir');
  if(!dir)return;
  e.preventDefault();
  if(_tanksHeld[dir])return;
  if(dir==='shoot'){tanksShoot();}else{tanksDir(dir);}
  _tanksHeld[dir]=setInterval(function(){if(dir==='shoot')tanksShoot();else tanksDir(dir);},120);
},{passive:false});
document.addEventListener('touchend',function(e){
  var b=e.target.closest('.dpad-btn,.tanks-shoot-btn');
  if(!b)return;
  var dir=b.getAttribute('data-dir');
  if(dir&&_tanksHeld[dir]){clearInterval(_tanksHeld[dir]);delete _tanksHeld[dir];}
},{passive:true});
function openMinecraftClassic(){
  eggClose();
  if(window.Android&&window.Android.openUrl){window.Android.openUrl('https://classic.minecraft.net/');}
  else{window.open('https://classic.minecraft.net/','_blank');}
}
// ══ ЗВОНКИ ══
function renderBells(){
  const body=document.getElementById('bells-body');
  const day=(title,bell)=>{
    let h=`<div class="bell-day">${title}</div>`;
    Object.entries(bell).forEach(([num,[s1,e1,s2,e2]])=>{
      h+=`<div class="bell-card"><div class="bell-num">${num}</div><div class="bell-slots"><div class="bell-slot"><span class="bell-slot-time">${s1} – ${e1}</span><span class="bell-slot-tag">${s2?'1 урок':'60 мин'}</span></div>${s2?`<div class="bell-slot"><span class="bell-slot-time">${s2} – ${e2}</span><span class="bell-slot-tag">2 урок</span></div>`:''}</div></div>`;
    });
    return h;
  };
  body.innerHTML=day('Понедельник',BELL_MON)+day('Вторник – Пятница',BELL_TUE)+day('Суббота',BELL_SAT);
}

// ══ УТИЛИТЫ ══
function setStatus(id,t){const el=document.getElementById(id);if(el)el.textContent=t;}
function setBar(id,v){const el=document.getElementById(id);if(el)el.style.width=v+'%';}
let _tt;
function toast(msg){SFX.play('toastShow');const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(_tt);_tt=setTimeout(()=>el.classList.remove('show'),2500);}

// ══ DPI ТЕСТИРОВАНИЕ ══
const TEST_URLS = [
  'https://1.1.1.1/cdn-cgi/trace',
  'https://www.google.com/generate_204',
  'https://connectivitycheck.gstatic.com/generate_204'
];
let dpiTestActive = false;
let dpiWorkingIds = null; // null = не тестировалось, [] = результаты теста

async function testUrl(timeout = 4000) {
  for (const url of TEST_URLS) {
    try {
      const r = await Promise.race([
        fetch(url, { method: 'HEAD', cache: 'no-store', mode: 'no-cors' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeout))
      ]);
      return true;
    } catch (e) { continue; }
  }
  return false;
}

async function testAllDpi() {
  if (dpiTestActive) return;
  dpiTestActive = true;

  // Используем элементы экрана DPI
  const btn     = document.getElementById('dpi-test-btn2');
  const block   = document.getElementById('dpi-test-block2');
  const bar     = document.getElementById('dpi-test-bar2');
  const status  = document.getElementById('dpi-test-status2');
  const badges  = document.getElementById('dpi-result-badges2');
  const showAllBtn = document.getElementById('dpi-show-all-btn2');
  const label   = document.getElementById('dpi-screen-label');

  if(btn) { btn.disabled = true; btn.innerHTML = '⏳ Тестирование...'; }
  if(block) block.style.display = 'block';
  if(badges) badges.innerHTML = '';
  if(showAllBtn) showAllBtn.style.display = 'none';
  if(bar) bar.style.width = '0%';

  const working = [];
  const total = DPI_STRATEGIES.length;

  for (let i = 0; i < total; i++) {
    const strat = DPI_STRATEGIES[i];
    const pct = Math.round(((i) / total) * 100);
    if(bar) bar.style.width = pct + '%';
    if(status) status.textContent = `Тестирую ${i + 1}/${total}: ${strat.name}...`;

    // Создать бейдж "в процессе"
    const badge = document.createElement('span');
    badge.className = 'test-badge testing';
    badge.id = 'tbadge-' + strat.id;
    badge.textContent = strat.badge;
    if(badges) badges.appendChild(badge);

    // Применить стратегию через Android
    if (window.Android?.setDpiStrategy) {
      window.Android.setDpiStrategy(strat.id);
      await new Promise(r => setTimeout(r, 600)); // дать время VPN применить
    } else {
      await new Promise(r => setTimeout(r, 150)); // без Android — просто симуляция
    }

    // Тест соединения
    let ok;
    if (window.Android?.setDpiStrategy) {
      ok = await testUrl(4000);
    } else {
      // В браузере без Android: симулируем — помечаем "основной" и несколько alt как рабочие
      const simulatedWorking = ['general', 'alt', 'simpleFake'];
      ok = simulatedWorking.includes(strat.id) || Math.random() > 0.7;
      await new Promise(r => setTimeout(r, 80));
    }

    badge.className = 'test-badge ' + (ok ? 'ok' : 'fail');
    badge.textContent = (ok ? '✓ ' : '✗ ') + strat.badge;
    if (ok) working.push(strat.id);
  }

  bar.style.width = '100%';
  dpiWorkingIds = working;

  if (working.length > 0) {
    if(status) status.textContent = `✅ Работает: ${working.length} из ${total} стратегий`;
    // Если текущая выбранная стратегия не рабочая — переключить на первую рабочую
    if (!working.includes(S.dpi)) {
      selectDpi(working[0]);
    } else {
      // Восстановить текущую
      if (window.Android?.setDpiStrategy) window.Android.setDpiStrategy(S.dpi);
    }
    if(label) label.textContent = 'Рабочие стратегии (' + working.length + ')';
    if(showAllBtn) showAllBtn.style.display = 'block';
  } else {
    if(status) status.textContent = '⚠️ Не удалось определить рабочие стратегии';
    dpiWorkingIds = null;
  }

  renderDpiList();
  updateDpiCurrentRow();
updateThemeCurrentRow();
  if(btn) { btn.disabled = false; btn.innerHTML = '🔄 Повторить тест'; }
  dpiTestActive = false;
  setTimeout(() => { if(bar) bar.style.width = '0%'; }, 1500);
}

function showAllDpi() {
  dpiWorkingIds = null;
  const label2 = document.getElementById('dpi-screen-label');
  const btn2   = document.getElementById('dpi-show-all-btn2');
  if (label2) label2.textContent = 'Все стратегии';
  if (btn2)   btn2.style.display = 'none';
  renderDpiList();
  updateDpiCurrentRow();
updateThemeCurrentRow();
  toast('Показаны все стратегии');
}

// ══ INIT ══
loadLocal();
applyTheme(S.theme);
applyGlassMode(false);
applyCustomBg();
applyBgBlurState();
updateBgUI();
updateMuteLabel();
// Стартуем на главном экране
document.body.classList.add('on-home-screen');
// Логируем инициализацию
setTimeout(function(){
  if(window.Android&&window.Android.logMsg){
    window.Android.logMsg('INFO','index.html: JS инициализация началась');
    window.Android.logMsg('INFO','index.html: тема='+S.theme+' dns='+S.dns+' dpi='+S.dpi+' url='+S.url.substring(0,40));
    window.Android.logMsg('INFO','index.html: Android bridge = '+(window.Android?'доступен':'НЕ ДОСТУПЕН'));
    window.Android.logMsg('INFO','index.html: localStorage = '+(function(){try{localStorage.setItem('t','1');localStorage.removeItem('t');return 'работает';}catch(e){return 'НЕДОСТУПЕН: '+e.message;}})());
  }
}, 300);
renderBells();
initModeUI();
updateLastGroupBtn();
updateNavActive('nav-home');
updateThemeCurrentRow();
initIconPicker();
initSchedTapTrigger();
// Инициализировать видимость навигации (только на главном экране)
setTimeout(() => {
  updateNavVisibility('s-home');
  _navMovePill('nav-home');
  updateBgUI();
  applyBgBlurState();
  updateThemeCurrentRow();
  try { if (typeof profileRenderScreen === 'function') profileRenderScreen(); } catch(e) {}
}, 100);
// Повторная инициализация pill после полной отрисовки (для медленных устройств)
setTimeout(() => { _navMovePill('nav-home'); }, 400);
document.getElementById('url-input').value=S.url;

loadFiles();
showGreeting();

// ══ Восстанавливаем состояние секретных команд ══
(function restoreSecretState(){
  const sec=loadSecret();
  if(sec.discoIntensity!=null) discoApplyIntensity(sec.discoIntensity);
  if(sec.disco){discoStart();}
  if(sec.cheatMode){ window._cheatModeActive = true; _applyCheatMode(true); }
  if(sec.snow){snowStart();}
  // /sound восстанавливается через S.muted в loadLocal()
})();

// ══ OTA обновление ══
// ⚠️ CLAUDE: при каждом изменении кода — обновляй эту версию!

// Показываем текущую версию в настройках (APP_VERSION определён выше)
(function(){
  const el = document.getElementById('app-version-str');
  if (el) el.textContent = APP_VERSION + ' — Android';
})();

// ── Автопроверка при запуске отключена — проверка вручную через кнопку в настройках ──

// ── Автопроверка обновлений при каждом запуске ──
// Показывает iOS-уведомление сверху если есть новый APK (silent=true → без тоста при отсутствии)
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => checkForUpdates(true), 3000);
  // Watchdog heartbeat — сообщаем Java что JS загрузился и работает
  setTimeout(() => {
    if (window.Android?.heartbeat) {
      window.Android.heartbeat();
      console.log('[Backup] heartbeat sent');
    }
  }, 4000);
});

// ══════════════════════════════════════════════════════════════════════
// 🔄 ПРОВЕРКА ОБНОВЛЕНИЙ
// ══════════════════════════════════════════════════════════════════════

/**
 * Проверяет GitHub на наличие нового APK релиза.
 * При silent=false — показывает iOS-уведомление если есть обновление.
 * @param {boolean} silent  true = без тоста если всё актуально
 */
async function checkForUpdates(silent) {
  try {
    // Fetch через GitHub зеркала
    async function ghApiFetch(path) {
      const errs = [];
      for (const base of GH_API_MIRRORS) {
        try {
          if (window.Android?.nativeFetch) {
            const res = JSON.parse(window.Android.nativeFetch(base + path));
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return JSON.parse(res.body);
          }
          const r = await _fetchTimeout(fetch(base + path), 7000);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        } catch(e) { errs.push(e.message); }
      }
      throw new Error('GitHub недоступен (' + errs[0] + ')');
    }

    // Последний релиз
    let release;
    try { release = await ghApiFetch('/latest'); }
    catch(e) {
      const all = await ghApiFetch('?per_page=5');
      if (!Array.isArray(all) || !all.length) {
        if (!silent) toast('❌ В репозитории нет релизов');
        return;
      }
      release = all[0];
    }

    const rawTag    = (release.tag_name || '').trim();
    const latestVer = rawTag.replace(/^v/i, '');
    if (!latestVer) { if (!silent) toast('❌ Не удалось определить версию'); return; }

    const isNewer = compareVersions(latestVer, APP_VERSION) > 0;
    if (!isNewer) {
      if (!silent) toast('✅ Версия ' + APP_VERSION + ' актуальна');
      return;
    }

    const apkAsset = (release.assets || []).find(a => a.name?.endsWith('.apk'));
    if (!apkAsset) {
      if (!silent) toast('🆕 v' + latestVer + ' — APK не прикреплён к релизу');
      return;
    }

    // Показываем iOS-уведомление сверху (как обычные сообщения)
    if (typeof showIosNotif === 'function') {
      showIosNotif({
        avatar: '🆕',
        avatarType: 'emoji',
        color: 'var(--accent)',
        sender: 'Обновление v' + latestVer,
        text: 'Доступна новая версия — нажми чтобы установить',
        onTap: () => otaOpen(latestVer, apkAsset.browser_download_url, release.body || '')
      });
    } else {
      otaOpen(latestVer, apkAsset.browser_download_url, release.body || '');
    }

  } catch(e) {
    if (!silent) toast('❌ ' + e.message.slice(0, 80));
  }
}


// ── Состояние OTA ──
// _otaApkUrl и _otaVersion объявлены в начале файла

function otaOpen(version, apkUrl, notes) {
  _otaApkUrl = apkUrl;
  _otaVersion = version;
  document.getElementById('ota-version-label').textContent =
    'v' + APP_VERSION + '  →  v' + version;
  const notesEl = document.getElementById('ota-notes-text');
  if (notes && notes.trim()) {
    notesEl.textContent = notes.trim();
    notesEl.classList.add('has-text');
  } else {
    notesEl.classList.remove('has-text');
  }
  document.getElementById('ota-progress-wrap').classList.add('hidden');
  document.getElementById('ota-progress-bar').style.width = '0%';
  document.getElementById('ota-progress-label').textContent = 'Скачивание...';
  const dlBtn = document.getElementById('ota-dl-btn');
  dlBtn.disabled = false;
  dlBtn.textContent = '⬇ Скачать и установить';
  document.getElementById('ota-cancel-btn').disabled = false;
  document.getElementById('ota-overlay').classList.add('show');
}

function otaClose() {
  document.getElementById('ota-overlay').classList.remove('show');
}

function otaOverlayClose(e) {
  if (e.target === document.getElementById('ota-overlay')) otaClose();
}

async function otaStartDownload() {
  if (!_otaApkUrl) { toast('❌ URL APK не найден'); return; }
  const dlBtn = document.getElementById('ota-dl-btn');
  const cancelBtn = document.getElementById('ota-cancel-btn');
  const wrap = document.getElementById('ota-progress-wrap');
  const bar = document.getElementById('ota-progress-bar');
  const label = document.getElementById('ota-progress-label');
  dlBtn.disabled = true;
  dlBtn.textContent = '⏳ Скачиваю...';
  cancelBtn.disabled = true;
  wrap.classList.remove('hidden');
  bar.style.width = '0%';
  label.textContent = 'Подготовка...';

  try {
    if (window.Android && window.Android.downloadAndInstallApk) {
      // Реальный прогресс приходит из Java через _jsProgress()
      window.Android.downloadAndInstallApk(_otaApkUrl);
      // Не закрываем overlay — Java сама закроет когда установщик запустится
    } else {
      // Фоллбэк — открываем браузер
      bar.style.width = '100%';
      label.textContent = 'Открываю загрузку...';
      if (window.Android && window.Android.openUrl) {
        window.Android.openUrl(_otaApkUrl);
      } else {
        window.open(_otaApkUrl, '_blank');
      }
      setTimeout(() => otaClose(), 1000);
    }
  } catch(e) {
    dlBtn.disabled = false;
    dlBtn.textContent = '⬇ Попробовать снова';
    cancelBtn.disabled = false;
    label.textContent = '❌ ' + e.message;
    bar.style.width = '0%';
  }
}

function compareVersions(a, b) {
  const pa = (a || '').split('.').map(Number);
  const pb = (b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

// Зеркала GitHub для обхода блокировок в России
const GH_API_MIRRORS = [
  'https://api.github.com/repos/LomKich/ScheduleApp/releases',
  'https://api.github.moeyy.xyz/repos/LomKich/ScheduleApp/releases',
  'https://api.kgithub.com/repos/LomKich/ScheduleApp/releases',
];
// Зеркала для скачивания APK (заменяют github.com/objects.githubusercontent.com)
const GH_DL_MIRRORS = [
  null,                              // 0 = оригинальный URL без изменений
  'https://ghproxy.com/',            // ghproxy.com/https://github.com/...
  'https://mirror.ghproxy.com/',     // mirror.ghproxy.com/https://github.com/...
  'https://ghfast.top/',             // ghfast.top/https://github.com/...
  'https://gh.con.sh/',              // gh.con.sh/https://...
  'https://gitproxy.click/',         // gitproxy.click/https://...
];

// Строим список URL для скачивания APK через все зеркала
function buildApkMirrorUrls(originalUrl) {
  const urls = [];
  for (const mirror of GH_DL_MIRRORS) {
    if (!mirror) { urls.push(originalUrl); continue; }
    // Зеркала типа ghproxy принимают URL как suffix: mirror + originalUrl
    urls.push(mirror + originalUrl);
  }
  return urls;
}

async function checkOtaUpdate(silent) {
  const btn = document.querySelector('[onclick="checkOtaUpdate()"]');
  if (!silent && btn) { btn.disabled = true; btn.textContent = '⏳'; }
  try {
    async function tryGhFetch(url) {
      if (window.Android && window.Android.nativeFetch) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            try {
              const resStr = window.Android.nativeFetch(url);
              const res = JSON.parse(resStr);
              if (!res.ok) reject(new Error('HTTP ' + res.status));
              else resolve(JSON.parse(res.body));
            } catch(e) { reject(e); }
          }, 0);
        });
      } else {
        const r = await _fetchTimeout(fetch(url), 7000);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }
    }

    // Пробуем все зеркала по очереди
    async function ghFetch(path) {
      const errs = [];
      for (const base of GH_API_MIRRORS) {
        try { return await tryGhFetch(base + path); }
        catch(e) { errs.push(e.message); }
      }
      throw new Error('GitHub недоступен (' + errs[0] + ')');
    }

    let data;
    try { data = await ghFetch('/latest'); }
    catch(e) {
      const all = await ghFetch('?per_page=5');
      if (!Array.isArray(all) || !all.length) {
        if (!silent) toast('❌ В репозитории нет релизов');
        return;
      }
      data = all[0];
    }

    const rawTag    = (data.tag_name || '').trim();
    const latestTag = rawTag.replace(/^v/i, '');
    const apkAsset  = (data.assets || []).find(a => a.name?.endsWith('.apk'));

    if (!latestTag) { if (!silent) toast('❌ Не удалось определить версию'); return; }

    const isNewer = compareVersions(latestTag, APP_VERSION) > 0;
    if (!isNewer) {
      if (!silent) toast('✅ Версия ' + APP_VERSION + ' актуальна');
      return;
    }

    if (apkAsset) {
      otaOpen(latestTag, apkAsset.browser_download_url, data.body || '');
    } else {
      if (!silent) toast('🆕 v' + latestTag + ' — APK не прикреплён к релизу');
    }
  } catch(e) {
    if (!silent) toast('❌ ' + e.message.slice(0, 80));
  }
  if (!silent && btn) { btn.disabled = false; btn.textContent = '🔄 Проверить'; }
}

function showUpdateDialog(version, apkUrl, notes) {
  otaOpen(version, apkUrl, notes || '');
}

function clearCacheAndReload() {
  try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
  if (window.Android && window.Android.clearWebViewCache) window.Android.clearWebViewCache();
  setTimeout(() => location.reload(true), 200);
}







// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                    🤖 ИНСТРУКЦИЯ ДЛЯ CLAUDE (ЧИТАЙ ВНИМАТЕЛЬНО!)           ║
// ║                                                                              ║
// ║  Привет! Если ты читаешь этот код — значит пользователь попросил тебя       ║
// ║  обновить приложение или разобраться в нём.                                  ║
// ║                                                                              ║
// ║  НАЧИНАЯ С v1.9.0 — в приложении есть МЕНЮ ВЫБОРА пасхалок.                 ║
// ║  Все игры живут в одном оверлее. Добавляй новые через eggStartGame().        ║
// ║                                                                              ║
// ║  ИСТОРИЯ ПАСХАЛОК (не повторяй!):                                            ║
// ║  • v1.6.0 — Змейка (Snake). Управление: свайп + d-pad.                      ║
// ║  • v1.7.0 — Крестики-нолики против ИИ (minimax). Touch/click.               ║
// ║  • v1.8.0 — Пинг-понг. Управление платформой свайпом/тапом.                 ║
// ║  • v1.9.0 — Тетрис. Свайп + экранные кнопки. Уровни, очки.                 ║
// ║  • v2.2.0 — Динозавр: птеродактили (2 высоты), хаотичные группы кактусов,  ║
// ║             приседание (свайп вниз), стикер управления в начале игры.       ║
// ║                                                                              ║
// ║  КАК АКТИВИРУЕТСЯ: 5 быстрых тапов по строке "Версия" в настройках.         ║
// ║  После 2 тапов — тост "🤔 Продолжай..." как подсказка.                      ║
// ║                                                                              ║
// ║  ТРЕБОВАНИЯ к новым пасхалкам:                                               ║
// ║  1. Стиль: цвета --accent, --surface, --bg — смотри getAccent()             ║
// ║  2. Работает через touch — это мобильное приложение                          ║
// ║  3. Добавь карточку в #egg-picker и секцию .egg-game в HTML                 ║
// ║  4. Добавь case в eggStartGame() и функцию остановки в eggStopAll()         ║
// ║  5. Запиши версию в ИСТОРИЮ выше                                             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ══ СИСТЕМА ПАСХАЛОК v1.9.0 ══
// _eggTaps, _eggTimer, _eggLastTouch объявлены в начале файла

function eggTap() {
  // Защита от двойного срабатывания touchstart + onclick
  const now = Date.now();
  if (now - _eggLastTouch < 350) return;
  _eggLastTouch = now;

  _eggTaps++;
  clearTimeout(_eggTimer);
  if (_eggTaps >= 2) { _eggTaps = 0; eggOpen(); return; }
  _eggTimer = setTimeout(() => { _eggTaps = 0; }, 1200);
}

// ═══════════════════════════════════════════════════════════════
// GAME WINDOW — полноэкранное окно поверх ВСЕГО
// ═══════════════════════════════════════════════════════════════
let _gameWindowEl = null;

function gameWindowOpen(titleText) {
  // Уничтожить старое если было
  if (_gameWindowEl) _gameWindowEl.remove();

  const win = document.createElement('div');
  win.id = 'game-window';
  win.innerHTML = `
    <div id="game-window-bar">
      <button id="game-window-back" onclick="gameWindowClose()">‹</button>
      <div id="game-window-title">${titleText || '🎮 Игры'}</div>
      <div style="width:36px"></div>
    </div>
    <div id="game-window-body"></div>
  `;
  document.body.appendChild(win);
  _gameWindowEl = win;
  return win.querySelector('#game-window-body');
}

function gameWindowClose() {
  eggStopAll();
  window._activeGame = null;
  if (_gameWindowEl) { _gameWindowEl.remove(); _gameWindowEl = null; }
  // Возвращаемся в пикер
  eggOpen();
}

function gameWindowDestroy() {
  eggStopAll();
  window._activeGame = null;
  if (_gameWindowEl) { _gameWindowEl.remove(); _gameWindowEl = null; }
}

function eggOpen() {
  SFX.play('eggOpen');
  _eggBlockCards = true;
  document.getElementById('egg-overlay').classList.add('show');
  eggShowPicker();
  setTimeout(() => { _eggBlockCards = false; }, 400);
}

function eggClose() {
  gameWindowDestroy();
  document.getElementById('egg-overlay').classList.remove('show');
  eggStopAll();
}

function eggShowPicker() {
  eggStopAll();
  document.getElementById('egg-picker').style.display = '';
  document.getElementById('egg-back').classList.remove('show');
}

function eggStartGame(name) {
  if (_eggBlockCards) return;
  SFX.play('gameSelect');

  // Doom и Minecraft — через iframe оверлей (полноэкранные)
  if (name === 'doom')      { document.getElementById('egg-overlay').classList.remove('show'); doomStart(); return; }
  if (name === 'minecraft') { document.getElementById('egg-overlay').classList.remove('show'); minecraftStart(); return; }

  // Все остальные — через game-window
  document.getElementById('egg-overlay').classList.remove('show');

  const TITLES = {
    snake:'🐍 Змейка', ttt:'❌ Крестики-нолики', pong:'🏓 Пинг-понг',
    tetris:'🧱 Тетрис', dino:'🦕 Динозаврик', blockblast:'💥 Block Blast',
    breakout:'🏏 Арканоид', bubbles:'🎵 osu! Режим', flappy:'🐦 Флаппи птица',
    '2048':'🔢 2048', coin:'🪙 Монетка', dice:'🎲 Кубик',
    basket:'🏀 Баскетбол', geodash:'🟥 Geometry Dash', tanks:'🪖 Танчики',
    checkers:'🔴 Шашки', chess:'♟ Шахматы',
  };

  eggStopAll();

  // Для osu — особый оверлей (он сам полноэкранный через fixed)
  if (name === 'bubbles') {
    const bubEl = document.getElementById('egg-bubbles');
    bubEl.style.display = 'flex';
    bubInit();
    return;
  }

  const body = gameWindowOpen(TITLES[name] || '🎮 ' + name);
  const idMap = {
    snake:'egg-snake', ttt:'egg-ttt', pong:'egg-pong', tetris:'egg-tetris',
    dino:'egg-dino', blockblast:'egg-blockblast', breakout:'egg-breakout',
    flappy:'egg-flappy', '2048':'egg-2048', coin:'egg-coin', dice:'egg-dice',
    basket:'egg-basket', geodash:'egg-geodash', tanks:'egg-tanks',
    checkers:'egg-checkers', chess:'egg-chess',
  };
  const gameId = idMap[name];
  if (!gameId) return;
  const el = document.getElementById(gameId);
  if (!el) return;

  // Устанавливаем активную игру для клавиатурного контроллера
  window._activeGame = name;

  // Перемещаем игровой div в game-window-body
  el.style.display = '';
  body.appendChild(el);

  // Инициализируем
  const inits = {
    snake: snakeInit, ttt: tttInit, pong: pongInit, tetris: tetInit,
    dino: dinoInit, blockblast: bbInit, breakout: brInit, flappy: flappyInit,
    '2048': g2048Init, coin: coinInit, dice: diceInit, basket: basketInit,
    geodash: geoInit, tanks: tanksInit,
    checkers: chkInit, chess: chessInit,
  };
  if (inits[name]) inits[name]();
}

// Закрыть osu-режим
function bubbleClose() {
  bubStop();
  osuStopBpmDot();
  document.getElementById('egg-bubbles').style.display = 'none';
  eggOpen();
}

function eggStopAll() {
  snakeStop();
  pongStop();
  tetStop();
  dinoStop();
  brStop();
  bubStop();
  const bub = document.getElementById('egg-bubbles');
  if (bub) bub.style.display = 'none';
  flappyStop();
  g2048Stop();
  basketStop();
  geoStop();
  tanksStop();
  chkStop();
  chessStop();
  if (document.getElementById('overlay-doom')?.classList.contains('active'))  doomStop();
  if (document.getElementById('overlay-minecraft')?.classList.contains('active')) minecraftStop();
  // Если game-window открыт — возвращаем игровые div-ы обратно в egg-overlay
  if (_gameWindowEl) {
    const ids = ['egg-snake','egg-ttt','egg-pong','egg-tetris','egg-dino',
                 'egg-blockblast','egg-breakout','egg-flappy','egg-2048',
                 'egg-coin','egg-dice','egg-basket','egg-geodash','egg-tanks',
                 'egg-checkers','egg-chess'];
    const eggOv = document.getElementById('egg-overlay');
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentNode !== eggOv) {
        el.style.display = 'none';
        eggOv.appendChild(el);
      }
    });
  }
}
function g2048Stop(){document.removeEventListener('keydown',g2048Key);}

// ── Утилита: обновить активную кнопку сложности ──
function updateDiffBtns(game) {
  const gameIdMap = {
    snake: 'egg-snake', pong: 'egg-pong', tetris: 'egg-tetris',
    dino: 'egg-dino', blockblast: 'egg-blockblast', breakout: 'egg-breakout', bubbles: 'egg-bubbles',
    geodash: 'egg-geodash', tanks: 'egg-tanks'
  };
  const container = document.getElementById(gameIdMap[game]);
  if (!container) return;
  const diffMap = {
    snake: snakeDifficulty, pong: pongDifficulty,
    tetris: tetDifficulty, dino: dinoDifficulty, blockblast: bbDifficulty, breakout: brDifficulty, bubbles: bubDifficulty,
    geodash: geoDiff, tanks: tanksDiff
  };
  const cur = diffMap[game];
  const order = ['easy', 'normal', 'hard'];
  container.querySelectorAll('.diff-btn').forEach((btn, i) => {
    btn.classList.toggle('active', order[i] === cur);
  });
}

function getAccent() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e87722';
}

// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// 🆕 НОВЫЕ ФУНКЦИИ (минимализм)
// ══════════════════════════════════════════════════════════════════

// ── Одна строка статуса под hero ────────────────────────────────
function updateHomeWidgets() {
  const el = document.getElementById('home-status-line');
  if (!el) return;
  const hwActive = typeof hwLoad === 'function' ? hwLoad().filter(h => !h.done).length : 0;
  if (hwActive > 0) {
    el.textContent = `${hwActive} задан${hwActive === 1 ? 'ие' : hwActive < 5 ? 'ия' : 'ий'} ДЗ`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}
setInterval(updateHomeWidgets, 60000);
setTimeout(updateHomeWidgets, 600);

// ════════════════════════════════════════
// ⏱ ЖИВОЙ ТАЙМЕР НА ЭКРАНЕ РАСПИСАНИЯ
// ════════════════════════════════════════
let _schedLiveTimer = null;
function startSchedLiveBar() {
  stopSchedLiveBar();
  _schedLiveTimer = setInterval(updateSchedLiveBar, 15000);
  updateSchedLiveBar();
}
function stopSchedLiveBar() {
  if (_schedLiveTimer) { clearInterval(_schedLiveTimer); _schedLiveTimer = null; }
}
function updateSchedLiveBar() {
  const bar = document.getElementById('sched-live-bar');
  if (!bar) return;
  const screen = document.getElementById('s-schedule');
  if (!screen || !screen.classList.contains('active')) { stopSchedLiveBar(); return; }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dow = now.getDay();
  const bell = dow === 1 ? BELL_MON : dow === 6 ? BELL_SAT : BELL_TUE;

  for (const [roman, times] of Object.entries(bell)) {
    if (!times[0]) continue;
    const [sh, sm] = times[0].split(':').map(Number);
    const endS = times[3] || times[1];
    const [eh, em] = endS.split(':').map(Number);
    const startMin = sh * 60 + sm, endMin = eh * 60 + em;
    if (nowMin >= startMin && nowMin < endMin) {
      bar.style.display = '';
      const label = document.getElementById('sched-live-label');
      const remain = document.getElementById('sched-live-remain');
      const progress = document.getElementById('sched-live-progress');
      if (label) label.textContent = '● Пара ' + roman + ' сейчас';
      const left = endMin - nowMin;
      if (remain) remain.textContent = 'осталось ' + left + ' мин';
      const total = endMin - startMin;
      const pct = Math.min(100, Math.round((nowMin - startMin) / total * 100));
      if (progress) progress.style.width = pct + '%';
      return;
    }
  }
  bar.style.display = 'none';
}
// Запускаем при открытии расписания
const _origRenderSchedule = renderSchedule;
window.renderSchedule = function(...args) {
  _origRenderSchedule(...args);
  startSchedLiveBar();
  addStarButtons(document.getElementById('sched-body'), args[0]);
  addExcuseButtons(document.getElementById('sched-body'));
};

// ════════════════════════════════════════
// ⭐ ИЗБРАННЫЕ (ВАЖНЫЕ) ПАРЫ
// ════════════════════════════════════════
const STARRED_KEY = 'sapp_starred_v1';
function starredLoad() { try { return JSON.parse(localStorage.getItem(STARRED_KEY) || '{}'); } catch(e) { return {}; } }
function starredSave(d) { localStorage.setItem(STARRED_KEY, JSON.stringify(d)); }
function toggleStarPair(group, roman, btn) {
  const d = starredLoad();
  const key = group + '::' + roman;
  if (d[key]) {
    delete d[key];
    btn.textContent = '☆';
    btn.style.color = 'var(--muted)';
    toast('☆ Пара убрана из важных');
  } else {
    d[key] = Date.now();
    btn.textContent = '⭐';
    btn.style.color = '#f5c518';
    toast('⭐ Пара отмечена как важная');
  }
  starredSave(d);
}
function addStarButtons(body, group) {
  if (!body || !group) return;
  const starred = starredLoad();
  body.querySelectorAll('.pair-card.has-subject').forEach(card => {
    const roman = card.querySelector('.pair-num')?.textContent?.trim();
    if (!roman) return;
    const key = group + '::' + roman;
    const isStar = !!starred[key];
    const btn = document.createElement('button');
    btn.style.cssText = 'position:absolute;top:10px;right:40px;background:none;border:none;font-size:16px;cursor:pointer;padding:2px;z-index:2;line-height:1';
    btn.textContent = isStar ? '⭐' : '☆';
    btn.style.color = isStar ? '#f5c518' : 'var(--muted)';
    btn.onclick = (e) => { e.stopPropagation(); toggleStarPair(group, roman, btn); };
    card.style.position = 'relative';
    card.appendChild(btn);
  });
}

// ════════════════════════════════════════
// 😅 ГЕНЕРАТОР ОТМАЗОК НА КАРТОЧКЕ ПАРЫ
// ════════════════════════════════════════
function showExcuseCard() {
  const excuse = EXCUSES[Math.floor(Math.random() * EXCUSES.length)];
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:calc(80px + var(--safe-bot,0px));left:16px;right:16px;background:var(--surface2);border:1.5px solid var(--surface3);border-radius:16px;padding:16px;z-index:500;font-size:13px;line-height:1.5;color:var(--text);box-shadow:0 8px 32px rgba(0,0,0,.4);cursor:pointer;animation:mcSlideUp .22s cubic-bezier(.34,1.1,.64,1)';
  el.innerHTML = `<div style="font-size:10px;font-weight:700;color:var(--accent);letter-spacing:.1em;margin-bottom:8px">😅 ОТМАЗКА ДЛЯ ПРЕПОДАВАТЕЛЯ</div>
    <div style="margin-bottom:12px">${excuse}</div>
    <button onclick="if(navigator.clipboard)navigator.clipboard.writeText('${excuse.replace(/'/g,"\\'")}').then(()=>toast('📋 Скопировано'));this.parentElement.remove()"
      style="background:var(--accent);color:var(--btn-text,#fff);border:none;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;width:100%">
      📋 Скопировать
    </button>`;
  el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 10000);
}
function addExcuseButtons(body) {
  if (!body) return;
  body.querySelectorAll('.pair-card.has-subject').forEach(card => {
    card.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      showExcuseCard();
    });
  });
}

// ════════════════════════════════════════
// 📚 ДОМАШНЕЕ ЗАДАНИЕ
// ════════════════════════════════════════
const HW_KEY = 'sapp_homework_v2';
let _hwTab = 'active';

function hwLoad() {
  try { return JSON.parse(localStorage.getItem(HW_KEY) || '[]'); } catch(e) { return []; }
}
function hwSave(items) { localStorage.setItem(HW_KEY, JSON.stringify(items)); }

function hwSetTab(tab) {
  _hwTab = tab;
  document.getElementById('hw-tab-active').style.borderColor = tab === 'active' ? 'var(--accent)' : 'var(--surface3)';
  document.getElementById('hw-tab-active').style.background = tab === 'active' ? 'color-mix(in srgb,var(--accent) 15%,transparent)' : 'none';
  document.getElementById('hw-tab-active').style.color = tab === 'active' ? 'var(--accent)' : 'var(--muted)';
  document.getElementById('hw-tab-done').style.borderColor = tab === 'done' ? 'var(--accent)' : 'var(--surface3)';
  document.getElementById('hw-tab-done').style.background = tab === 'done' ? 'color-mix(in srgb,var(--accent) 15%,transparent)' : 'none';
  document.getElementById('hw-tab-done').style.color = tab === 'done' ? 'var(--accent)' : 'var(--muted)';
  hwRender();
}

function hwRender() {
  const list = document.getElementById('hw-list');
  if (!list) return;
  const items = hwLoad().filter(h => _hwTab === 'active' ? !h.done : h.done);
  if (!items.length) {
    list.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--muted)">
      <div style="font-size:40px;margin-bottom:12px">${_hwTab === 'active' ? '✅' : '📭'}</div>
      <div style="font-size:14px">${_hwTab === 'active' ? 'Нет активных заданий' : 'Нет выполненных заданий'}</div>
    </div>`;
    return;
  }
  list.innerHTML = items.map((h, i) => `
    <div style="background:var(--surface2);border-radius:14px;padding:14px 16px;margin-bottom:8px;border:1.5px solid ${h.done?'var(--surface3)':h.urgent?'rgba(224,85,85,.4)':'var(--surface3)'};display:flex;gap:12px;align-items:flex-start">
      <button onclick="hwToggleDone(${h.id})" style="width:24px;height:24px;border-radius:50%;border:2px solid ${h.done?'var(--accent)':'var(--surface3)'};background:${h.done?'var(--accent)':'transparent'};flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;margin-top:1px">
        ${h.done?'✓':''}
      </button>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:${h.done?'var(--muted)':'var(--text)'};text-decoration:${h.done?'line-through':''};margin-bottom:3px">${escHtml(h.subject)}</div>
        ${h.task ? `<div style="font-size:12px;color:var(--muted);line-height:1.4">${escHtml(h.task)}</div>` : ''}
        ${h.deadline ? `<div style="font-size:11px;color:${h.urgent?'var(--danger,#c94f4f)':'var(--muted)'};margin-top:4px;font-weight:${h.urgent?'700':'400'}">📅 ${h.deadline}${h.urgent?' ⚠️ Срочно!':''}</div>` : ''}
      </div>
      ${!h.done ? `<button onclick="hwDelete(${h.id})" style="background:none;border:none;color:var(--muted);font-size:18px;padding:2px;cursor:pointer;flex-shrink:0">×</button>` : ''}
    </div>`).join('');
}

function hwToggleDone(id) {
  const items = hwLoad();
  const item = items.find(h => h.id === id);
  if (item) { item.done = !item.done; hwSave(items); hwRender(); updateHomeWidgets(); SFX.play('btnClick'); }
}

function hwDelete(id) {
  const items = hwLoad().filter(h => h.id !== id);
  hwSave(items);
  hwRender();
  updateHomeWidgets();
}

function hwAddNew() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9900;background:rgba(0,0,0,.6);display:flex;flex-direction:column;justify-content:flex-end';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:20px 16px calc(24px + var(--safe-bot,0px));animation:mcSlideUp .24s cubic-bezier(.34,1.1,.64,1)">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:0 auto 18px"></div>
      <div style="font-size:16px;font-weight:700;margin-bottom:16px">📚 Новое задание</div>
      <input id="hw-inp-subject" class="inp" placeholder="Предмет (напр. Математика)" style="margin-bottom:10px">
      <textarea id="hw-inp-task" class="inp" placeholder="Что задали..." rows="3" style="resize:none;margin-bottom:10px"></textarea>
      <input id="hw-inp-deadline" class="inp" type="text" placeholder="Срок сдачи (напр. 20.03.2026)" style="margin-bottom:10px">
      <label style="display:flex;align-items:center;gap:10px;margin-bottom:16px;cursor:pointer">
        <input type="checkbox" id="hw-inp-urgent" style="width:18px;height:18px;accent-color:var(--danger,#c94f4f)">
        <span style="font-size:14px;color:var(--text)">⚠️ Срочное</span>
      </label>
      <div style="display:flex;gap:8px">
        <button onclick="this.closest('[style*=fixed]').remove()" style="flex:1;padding:13px;background:var(--surface2);border:1.5px solid var(--surface3);border-radius:12px;color:var(--muted);font-size:14px;font-weight:700;cursor:pointer">Отмена</button>
        <button onclick="hwSaveNew()" style="flex:2;padding:13px;background:var(--accent);border:none;border-radius:12px;color:var(--btn-text,#fff);font-size:14px;font-weight:700;cursor:pointer">Добавить ✓</button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('hw-inp-subject')?.focus(), 200);
}

function hwSaveNew() {
  const subject = document.getElementById('hw-inp-subject')?.value.trim();
  if (!subject) { toast('Введи название предмета'); return; }
  const task = document.getElementById('hw-inp-task')?.value.trim();
  const deadline = document.getElementById('hw-inp-deadline')?.value.trim();
  const urgent = document.getElementById('hw-inp-urgent')?.checked;
  const items = hwLoad();
  items.unshift({ id: Date.now(), subject, task, deadline, urgent, done: false, created: Date.now() });
  hwSave(items);
  document.querySelector('[style*="position:fixed"][style*="z-index:9900"]')?.remove();
  hwRender();
  updateHomeWidgets();
  SFX.play('btnAccent');
  toast('✅ Задание добавлено');
}

// Добавляем кнопку "+ ДЗ" прямо на карточки пары
const _origAddNoteButtons = addNoteButtons;
window.addNoteButtons = function(body, groupOrTeacher) {
  _origAddNoteButtons(body, groupOrTeacher);
  // Кнопка быстрого добавления ДЗ
  body.querySelectorAll('.pair-card.has-subject').forEach(card => {
    const subj = card.querySelector('.pair-subject')?.textContent?.trim();
    if (!subj || subj === 'Окно') return;
    const btn = document.createElement('button');
    btn.title = 'Добавить ДЗ';
    btn.style.cssText = 'position:absolute;bottom:10px;right:10px;background:var(--surface3);border:none;border-radius:8px;padding:3px 7px;cursor:pointer;font-size:10px;font-weight:700;color:var(--muted);z-index:2;display:flex;align-items:center;gap:3px';
    btn.innerHTML = '📝 ДЗ';
    btn.onclick = (e) => {
      e.stopPropagation();
      hwAddNewForSubject(subj);
    };
    card.appendChild(btn);
  });
};

function hwAddNewForSubject(subject) {
  hwAddNew();
  setTimeout(() => {
    const inp = document.getElementById('hw-inp-subject');
    if (inp) inp.value = subject;
  }, 150);
}

// Инициализация экрана ДЗ
// Перехватываем навигацию на s-homework
(function() {
  const _hwScreenOrig = window.showScreen;
  window.showScreen = function(id, dir) {
    _hwScreenOrig(id, dir);
    if (id === 's-homework') { setTimeout(() => hwRender(), 60); }
  };
})();

// Добавляем s-homework в SCREEN_PARENTS
if (typeof SCREEN_PARENTS !== 'undefined') {
  SCREEN_PARENTS['s-homework'] = { parent: 's-home', nav: 'nav-home' };
}

// ════════════════════════════════════════
// 🎵 ЗВОНОК УВЕДОМЛЕНИЕ ЗА 5 МИН ДО ПАРЫ
// ════════════════════════════════════════
let _prebell5_lastFired = '';
setInterval(() => {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dow = now.getDay();
  const bell = dow === 1 ? BELL_MON : dow === 6 ? BELL_SAT : BELL_TUE;
  for (const [roman, times] of Object.entries(bell)) {
    if (!times[0]) continue;
    const [sh, sm] = times[0].split(':').map(Number);
    const startMin = sh * 60 + sm;
    const diff = startMin - nowMin;
    const fireKey = roman + ':' + now.toDateString();
    if (diff === 5 && _prebell5_lastFired !== fireKey) {
      _prebell5_lastFired = fireKey;
      toast(`🔔 Пара ${roman} начинается через 5 минут! (${times[0]})`);
      try { SFX.play('toastShow'); } catch(e) {}
    }
  }
}, 30000);


// ════════════════════════════════════════
// 🔍 ПОИСК ПО РАСПИСАНИЮ
// ════════════════════════════════════════
function schedSearch() {
  const bar = document.getElementById('sched-search-bar');
  if (!bar) return;
  const isOpen = bar.style.display !== 'none';
  if (isOpen) { schedSearchClose(); return; }
  bar.style.display = '';
  bar.style.animation = 'mcSlideUp .18s cubic-bezier(.34,1.1,.64,1)';
  setTimeout(() => document.getElementById('sched-search-inp')?.focus(), 80);
}

function schedSearchClose() {
  const bar = document.getElementById('sched-search-bar');
  if (bar) bar.style.display = 'none';
  const inp = document.getElementById('sched-search-inp');
  if (inp) inp.value = '';
  schedSearchFilter('');
}

function schedSearchFilter(q) {
  const cards = document.querySelectorAll('#sched-body .pair-card');
  const query = q.trim().toLowerCase();
  cards.forEach(card => {
    if (!query) { card.style.display = ''; return; }
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(query) ? '' : 'none';
  });
}

// ════════════════════════════════════════
// ⬆ ПОДЕЛИТЬСЯ РАСПИСАНИЕМ
// ════════════════════════════════════════
function shareSchedule() {
  const group = document.getElementById('sched-group-name')?.textContent?.trim();
  const date  = document.getElementById('sched-date')?.textContent?.trim();
  const cards = document.querySelectorAll('#sched-body .pair-card');
  if (!cards.length) { toast('Сначала загрузи расписание'); return; }

  const lines = [`📅 ${group}${date ? ' · ' + date : ''}`, ''];
  cards.forEach(card => {
    const num  = card.querySelector('.pair-num')?.textContent?.trim();
    const subj = card.querySelector('.pair-subject')?.textContent?.trim();
    const times = card.querySelector('.pair-time-val')?.textContent?.trim();
    if (!num || !subj || subj === 'Окно') return;
    lines.push(`${num}. ${subj}${times ? ' · ' + times : ''}`);
  });
  lines.push('', '📲 ScheduleApp');

  const text = lines.join('\n');
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast('📋 Расписание скопировано'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    toast('📋 Расписание скопировано');
  }
}

// ════════════════════════════════════════
// 📅 ПРОГРЕСС НЕДЕЛИ — в hero-widget
// ════════════════════════════════════════
function updateWeekProgress() {
  const el = document.getElementById('hero-widget');
  if (!el) return;
  const dow = new Date().getDay(); // 0=вс, 1=пн … 6=сб
  // Учебные дни: пн(1)..сб(6)
  if (dow === 0) {
    el.textContent = 'Воскресенье — завтра снова в бой 🔋';
    return;
  }
  const done = dow - 1; // пройдено учебных дней (пн=0 пройдено, вт=1...)
  const total = 6;      // пн-сб
  const left = total - dow; // до воскресенья
  const pct = Math.round(done / total * 100);
  // Одна строка + мини-бар из символов
  const filled = Math.round(pct / 10);
  const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
  el.innerHTML = `${bar} <span style="color:var(--accent);font-weight:700">${pct}%</span> недели · осталось ${left} дн.`;
}
updateWeekProgress();

// ══════════════════════════════════════════════════════════════════════
// ██╗    ██╗██╗███████╗ █████╗ ██████╗ ██████╗
// ██║    ██║██║╚══███╔╝██╔══██╗██╔══██╗██╔══██╗
// ██║ █╗ ██║██║  ███╔╝ ███████║██████╔╝██║  ██║
// ██║███╗██║██║ ███╔╝  ██╔══██║██╔══██╗██║  ██║
// ╚███╔███╔╝██║███████╗██║  ██║██║  ██║██████╔╝
//  ╚══╝╚══╝ ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝
//  Telegram-style registration wizard
// ══════════════════════════════════════════════════════════════════════

let _wizardStep = 0;     // текущий шаг регистрации
let _wizardTab  = 'reg'; // 'reg' | 'auth'

// Переключение таба (Регистрация / Войти)
function wizardSwitchTab(tab) {
  _wizardTab = tab;
  const tabbar   = document.getElementById('login-tabbar');
  const viewReg  = document.getElementById('login-view-reg');
  const viewAuth = document.getElementById('login-view-auth');
  const tabReg   = document.getElementById('login-tab-reg');
  const tabAuth  = document.getElementById('login-tab-auth');
  const backBtn  = document.getElementById('login-back-btn');

  if (tab === 'reg') {
    viewReg.style.display  = '';
    viewAuth.style.display = 'none';
    tabReg.style.background  = 'var(--accent)';
    tabReg.style.color       = 'var(--btn-text,#fff)';
    tabAuth.style.background = 'transparent';
    tabAuth.style.color      = 'var(--muted)';
    _wizardStep = 0;
    wizardGoTo(0);
  } else {
    viewReg.style.display  = 'none';
    viewAuth.style.display = '';
    tabReg.style.background  = 'transparent';
    tabReg.style.color       = 'var(--muted)';
    tabAuth.style.background = 'var(--accent)';
    tabAuth.style.color      = 'var(--btn-text,#fff)';
    if (backBtn) backBtn.style.visibility = 'hidden';
    setTimeout(() => document.getElementById('login-auth-username')?.focus(), 250);
  }
}

// Перейти на нужный шаг
function wizardGoTo(step) {
  _wizardStep = step;
  const track   = document.getElementById('wizard-track');
  const backBtn = document.getElementById('login-back-btn');
  const title   = document.getElementById('login-hdr-title');
  const tabbar  = document.getElementById('login-tabbar');

  if (!track) return;
  track.style.transform = `translateX(-${step * 100}%)`;

  // Обновляем точки прогресса
  for (let i = 0; i < 3; i++) {
    const dot = document.getElementById('wdot-' + i);
    if (!dot) continue;
    dot.className = 'wdot' + (i === step ? ' wdot-active' : '');
  }

  // Кнопка назад
  if (backBtn) backBtn.style.visibility = step > 0 ? 'visible' : 'hidden';

  // Скрыть таббар на шагах 1 и 2
  if (tabbar) tabbar.style.display = step === 0 ? '' : 'none';

  // Заголовок хедера
  const titles = ['Регистрация', 'Твой профиль', 'Придумай пароль'];
  if (title) title.textContent = titles[step] || 'Аккаунт';

  // Анимация иконки текущего шага
  const icon = document.querySelector('#wstep-' + step + ' .wstep-icon');
  if (icon) {
    icon.style.transform = 'scale(0.4) rotate(-15deg)';
    requestAnimationFrame(() => {
      icon.style.transition = 'transform .35s cubic-bezier(.34,1.56,.64,1)';
      icon.style.transform = '';
      setTimeout(() => { icon.style.transition = ''; }, 400);
    });
  }

  // Фокус на поле
  setTimeout(() => {
    if (step === 0) document.getElementById('login-name')?.focus();
    if (step === 1) document.getElementById('login-username')?.focus();
    if (step === 2) document.getElementById('login-password')?.focus();
  }, 350);
}

// Кнопка Назад в wizard
function wizardBack() {
  if (_wizardStep > 0) wizardGoTo(_wizardStep - 1);
}

// Валидация шага 0 (имя)
function wizardValidateStep0() {
  const name = (document.getElementById('login-name')?.value || '').trim();
  const btn  = document.getElementById('wbtn-0');
  const hint = document.getElementById('wstep0-hint');
  const ok   = name.length >= 2;
  if (btn) btn.disabled = !ok;
  if (hint) {
    if (!name) { hint.textContent = 'Минимум 2 символа'; hint.style.color = 'var(--muted)'; }
    else if (!ok) { hint.textContent = '⚠️ Слишком короткое имя'; hint.style.color = 'var(--danger,#c94f4f)'; }
    else { hint.textContent = '✅ Отлично!'; hint.style.color = '#4caf7d'; }
  }
}

// Следующий шаг
function wizardNext() {
  if (_wizardStep === 0) {
    const name = (document.getElementById('login-name')?.value || '').trim();
    if (name.length < 2) return;
    wizardGoTo(1);
  } else if (_wizardStep === 1) {
    const un = (document.getElementById('login-username')?.value || '').trim();
    if (un.length < 3) return;
    const btn = document.getElementById('wbtn-1');
    if (btn && btn.disabled) return;
    wizardGoTo(2);
  }
}

// Валидация шага 2 (пароль)
function wizardValidateStep2() {
  const p1   = document.getElementById('login-password')?.value  || '';
  const p2   = document.getElementById('login-password2')?.value || '';
  const btn  = document.getElementById('wbtn-2');
  const hint = document.getElementById('wstep2-hint');
  if (p1.length === 0) {
    if (hint) { hint.textContent = 'Минимум 4 символа'; hint.style.color = 'var(--muted)'; }
    if (btn) btn.disabled = true;
  } else if (p1.length < 4) {
    if (hint) { hint.textContent = '⚠️ Пароль слишком короткий'; hint.style.color = 'var(--danger,#c94f4f)'; }
    if (btn) btn.disabled = true;
  } else if (p2 && p1 !== p2) {
    if (hint) { hint.textContent = '❌ Пароли не совпадают'; hint.style.color = 'var(--danger,#c94f4f)'; }
    if (btn) btn.disabled = true;
  } else if (p2 && p1 === p2) {
    if (hint) { hint.textContent = '✅ Пароли совпадают'; hint.style.color = '#4caf7d'; }
    if (btn) btn.disabled = false;
  } else {
    // p2 ещё не заполнен
    if (hint) { hint.textContent = 'Повтори пароль ещё раз'; hint.style.color = 'var(--muted)'; }
    if (btn) btn.disabled = true;
  }
}

// Финиш: создать аккаунт (вызывает существующую profileCreate)
function wizardFinish() {
  const p1 = document.getElementById('login-password')?.value  || '';
  const p2 = document.getElementById('login-password2')?.value || '';
  if (p1.length < 4 || p1 !== p2) return;
  profileCreate(); // существующая функция в social.js
}

// При загрузке страницы: инициализируем wizard
(function initWizardOnLoad() {
  // Ждём DOM
  const check = () => {
    if (document.getElementById('wizard-track')) {
      wizardSwitchTab('reg');
      wizardGoTo(0);
    } else {
      setTimeout(check, 100);
    }
  };
  check();
})();


// ══════════════════════════════════════════════════════════════════════
// 🍅  POMODORO ТАЙМЕР
// ══════════════════════════════════════════════════════════════════════

const POMO_WORK_SEC  = 25 * 60;
const POMO_BREAK_SEC = 5  * 60;

let _pomoState = {
  running: false,
  isWork:  true,
  secsLeft: POMO_WORK_SEC,
  session:  1,
  interval: null,
};

function pomodoroToggle() {
  // Открываем оверлей при первом нажатии
  const ov = document.getElementById('pomodoro-overlay');
  if (ov) ov.style.display = 'flex';

  if (_pomoState.running) {
    // Пауза
    clearInterval(_pomoState.interval);
    _pomoState.running = false;
    _pomoRender();
  } else {
    // Запуск / продолжение
    _pomoState.running = true;
    _pomoState.interval = setInterval(_pomoTick, 1000);
    _pomoRender();
  }
}

function pomodoroReset() {
  clearInterval(_pomoState.interval);
  _pomoState = { running: false, isWork: true,
    secsLeft: POMO_WORK_SEC, session: 1, interval: null };
  _pomoRender();
}

function _pomoTick() {
  if (_pomoState.secsLeft > 0) {
    _pomoState.secsLeft--;
    _pomoRender();
  } else {
    // Смена режима
    clearInterval(_pomoState.interval);
    if (_pomoState.isWork) {
      _pomoState.isWork   = false;
      _pomoState.secsLeft = POMO_BREAK_SEC;
      toast('🎉 Перерыв 5 минут! Отдыхай');
    } else {
      _pomoState.isWork   = true;
      _pomoState.secsLeft = POMO_WORK_SEC;
      _pomoState.session++;
      toast('🍅 Фокус! Сессия ' + _pomoState.session);
    }
    _pomoState.running  = true;
    _pomoState.interval = setInterval(_pomoTick, 1000);
    _pomoRender();
  }
}

function _pomoRender() {
  const total = _pomoState.isWork ? POMO_WORK_SEC : POMO_BREAK_SEC;
  const left  = _pomoState.secsLeft;
  const pct   = left / total;
  const mins  = String(Math.floor(left / 60)).padStart(2, '0');
  const secs  = String(left % 60).padStart(2, '0');
  const timeStr = `${mins}:${secs}`;
  const emoji   = _pomoState.isWork ? '🍅' : '☕';
  const modeStr = _pomoState.isWork ? 'ФОКУС 🍅' : 'ПЕРЕРЫВ ☕';

  // Мини-виджет на главной
  const ringFill = document.getElementById('pomodoro-ring-fill');
  const ringLabel = document.getElementById('pomodoro-ring-label');
  const subEl   = document.getElementById('pomodoro-sub');
  const titleEl = document.getElementById('pomodoro-title');
  const btnIcon = document.getElementById('pomodoro-btn-icon');
  const CIRCUM  = 138.2; // 2π×22
  if (ringFill)  ringFill.style.strokeDashoffset  = String(CIRCUM * (1 - pct));
  if (ringLabel) ringLabel.textContent = timeStr;
  if (subEl)     subEl.textContent = (_pomoState.isWork ? '🍅 Фокус' : '☕ Перерыв') +
    ' · сессия ' + _pomoState.session;
  if (titleEl)   titleEl.textContent = 'Помодоро — ' + timeStr;
  if (btnIcon)   btnIcon.textContent  = _pomoState.running ? '⏸️' : '▶️';

  // Большой оверлей
  const ovTime = document.getElementById('pomo-ov-time');
  const ovEmoji = document.getElementById('pomo-ov-emoji');
  const ovRing  = document.getElementById('pomo-ov-ring');
  const ovLabel = document.getElementById('pomo-mode-label');
  const ovSess  = document.getElementById('pomo-ov-session');
  const ovBtn   = document.getElementById('pomo-ov-main-btn');
  const CIRCUM2 = 376.99; // 2π×60
  if (ovTime)  ovTime.textContent  = timeStr;
  if (ovEmoji) ovEmoji.textContent = emoji;
  if (ovRing)  ovRing.style.strokeDashoffset  = String(CIRCUM2 * (1 - pct));
  if (ovLabel) ovLabel.textContent = modeStr;
  if (ovSess)  ovSess.textContent  = 'Сессия ' + _pomoState.session +
    (_pomoState.running ? '' : ' · на паузе');
  if (ovBtn) {
    ovBtn.textContent = _pomoState.running ? '⏸ Пауза' : '▶ Продолжить';
  }
}

// Инициализация виджета
_pomoRender();


// ══════════════════════════════════════════════════════════════════════
// 📅  СЧЁТЧИК ДО ПЯТНИЦЫ + ПРОГРЕСС НЕДЕЛИ
// ══════════════════════════════════════════════════════════════════════

function homeUpdateWeekBar() {
  const fridayEl   = document.getElementById('home-friday-count');
  const weekPctEl  = document.getElementById('home-week-pct');
  const weekFillEl = document.getElementById('home-week-fill');
  const weekLblEl  = document.getElementById('home-week-label');
  if (!fridayEl) return;

  const now  = new Date();
  const dow  = now.getDay(); // 0=вс, 1=пн...6=сб
  const DAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

  // Дней до пятницы (5)
  let toFri;
  if (dow === 5)       toFri = '🎉 Сегодня!';
  else if (dow === 6)  toFri = 'Вчера была 😅';
  else if (dow === 0)  toFri = '5 дней';
  else                 toFri = (5 - dow) + ' ' + (5 - dow === 1 ? 'день' : (5 - dow < 5 ? 'дня' : 'дней'));

  fridayEl.textContent = toFri;

  // Прогресс недели: пн=0% ... сб=100%
  // Учебные дни 1(пн)…6(сб) — 6 дней
  const pct = dow === 0 ? 0 : Math.round(Math.min(dow, 6) / 6 * 100);
  if (weekPctEl)  weekPctEl.textContent  = pct + '%';
  if (weekFillEl) weekFillEl.style.width = pct + '%';
  if (weekLblEl) {
    const dayName = DAYS[dow];
    const left    = dow === 0 ? 6 : Math.max(0, 6 - dow);
    weekLblEl.textContent = dow === 0
      ? 'Воскресенье — впереди всё!'
      : dayName + ' · осталось ' + left + ' ' + (left === 1 ? 'день' : left < 5 ? 'дня' : 'дней');
  }
}

homeUpdateWeekBar();


// ══════════════════════════════════════════════════════════════════════
// 😤  ЖАЛОБНАЯ КНИГА (смешные студенческие жалобы)
// ══════════════════════════════════════════════════════════════════════

const COMPLAINTS = [
  'Почему пары начинаются в 8:30?! Это нарушение прав человека.',
  'Преподаватель снова перенёс пару. За 5 минут до начала. В 8 утра.',
  'В расписании написано «аудитория уточняется». Уточнили в 9:03 — пара уже шла.',
  'Зачёт «автоматом» за посещаемость, но в расписании 6 пар в день.',
  'ДЗ задали в пятницу. Сдавать в понедельник. Это не выходные, это рабочая смена.',
  'Столовая открыта с 12 до 13. Перемена с 12:05 до 12:20. Математика тут курит.',
  'Потерял ручку прямо перед контрольной. Попросил у соседа — у него тоже нет.',
  'Библиотека: нужная книга есть в 1 экземпляре, он на руках до 2027 года.',
  'Wi-Fi в корпусе работает только если стоять у окна на третьем этаже, ногой касаясь батареи.',
  'Экзамен в 9:00. Добираться 1:20. Первый автобус в 7:30. Математика снова курит.',
  'Пересдача назначена на 31 декабря. Удачи тебе и всем нам.',
  'Сосед на паре жуёт так громко, что я потерял нить лекции.',
  'Преподаватель: «Это проходили на первом курсе». Мы на первом курсе.',
  'Проектор не работает. Преподаватель рисует схему на доске. Маркер тоже не работает.',
  'Пара перенесена на субботу. Суббота — тоже учебный день. Открытие семестра.',
  '«Самостоятельная работа» — это когда преподаватель пьёт кофе, а ты решаешь 40 задач.',
  'В деканате сказали: «Приходи завтра». Пришёл. «Приходи послезавтра».',
  'Пара отменена, но узнал об этом когда уже приехал.',
  'Распечатка на 80 страниц. Принтер в кабинете замдекана. Замдекан «занят».',
  '«Нам поставят зачёт если все придут на субботник». Суббота, 8 утра, грабли.',
];

let _lastComplaint = '';

function funShowComplaint() {
  const ov = document.getElementById('complaint-overlay');
  const el = document.getElementById('complaint-text');
  if (!ov || !el) return;

  let c;
  do { c = COMPLAINTS[Math.floor(Math.random() * COMPLAINTS.length)]; }
  while (c === _lastComplaint && COMPLAINTS.length > 1);
  _lastComplaint = c;
  el.textContent = c;
  ov.style.display = 'flex';
}

function funCopyComplaint() {
  const text = document.getElementById('complaint-text')?.textContent || '';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast('📋 Скопировано!'));
  }
  document.getElementById('complaint-overlay').style.display = 'none';
}


// ══════════════════════════════════════════════════════════════════════
// 🎲  РАНДОМАЙЗЕР «КТО ОТВЕЧАЕТ?»
// ══════════════════════════════════════════════════════════════════════

const RAND_EMOJIS = ['🎯','🎲','⚡','🏆','🔥','💀','🎪','🤡','🫡','😬','🧨','🎭'];

function funGroupRandomizer() {
  const ov = document.getElementById('randomizer-overlay');
  if (!ov) return;
  // Сброс результата
  const res = document.getElementById('rand-result');
  if (res) res.style.display = 'none';
  ov.style.display = 'flex';
  setTimeout(() => document.getElementById('rand-names-input')?.focus(), 300);
}

function funGroupRandomizerSpin() {
  const inp = document.getElementById('rand-names-input');
  const res = document.getElementById('rand-result');
  const nameEl  = document.getElementById('rand-result-name');
  const emojiEl = document.getElementById('rand-result-emoji');
  if (!inp || !res) return;

  const names = inp.value.split('\n')
    .map(n => n.trim()).filter(n => n.length > 0);

  if (names.length === 0) {
    toast('Добавь хотя бы одного участника!'); return;
  }

  // Анимация «вращения»
  let ticks = 0;
  const maxTicks = 14;
  const chosen = names[Math.floor(Math.random() * names.length)];
  const interval = setInterval(() => {
    ticks++;
    const temp = names[Math.floor(Math.random() * names.length)];
    if (nameEl)  nameEl.textContent  = temp;
    if (emojiEl) emojiEl.textContent = RAND_EMOJIS[ticks % RAND_EMOJIS.length];
    if (ticks >= maxTicks) {
      clearInterval(interval);
      if (nameEl)  nameEl.textContent  = chosen;
      if (emojiEl) emojiEl.textContent = '🎯';
      if (res) {
        res.style.display = 'block';
        nameEl.style.transform = 'scale(1.25)';
        setTimeout(() => { nameEl.style.transform = ''; nameEl.style.transition = 'transform .2s'; }, 120);
      }
    }
  }, 80);

  if (res) res.style.display = 'block';
}


// ══════════════════════════════════════════════════════════════════════
// 📝  ОБЁРТКА: funShowExcuse — вызывает существующий getExcuse()
// ══════════════════════════════════════════════════════════════════════

function funShowExcuse() {
  // Используем существующую функцию из core.js
  if (typeof getExcuse === 'function') {
    const excuse = getExcuse();
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9100;display:flex;align-items:center;justify-content:center;padding:24px';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div style="background:var(--surface2);border-radius:20px;padding:22px;width:100%;max-width:340px;border:1.5px solid var(--surface3)">
        <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--accent);margin-bottom:10px">📝 ГЕНЕРАТОР ОТМАЗКИ</div>
        <div style="font-size:15px;line-height:1.55;color:var(--text);margin-bottom:18px">${excuse}</div>
        <div style="display:flex;gap:10px">
          <button onclick="this.closest('[style]').remove();funShowExcuse()" class="btn btn-surface" style="flex:1">🔄 Другую</button>
          <button onclick="navigator.clipboard&&navigator.clipboard.writeText('${excuse.replace(/'/g,"\\'")}').then(()=>toast('📋 Скопировано'));this.closest('[style]').remove()"
            class="btn btn-accent" style="flex:1">📋 Скопировать</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }
}

