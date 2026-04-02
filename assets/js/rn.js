// ══════════════════════════════════════════════════════════════════════
// RN.JS — React Native UI Preview
// Открывается через консоль командой: rn home / rn groups / rn schedule
// Стиль: имитация React Native / нативного мобильного UI
// ══════════════════════════════════════════════════════════════════════

(function () {

  // ── Токены дизайна (читаем из CSS-переменных приложения) ───────────
  function getCSSVar(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function getTheme() {
    return {
      bg:       getCSSVar('--bg')       || '#0d0d0d',
      surface:  getCSSVar('--surface')  || '#161616',
      surface2: getCSSVar('--surface2') || '#1f1f1f',
      surface3: getCSSVar('--surface3') || '#2a2a2a',
      accent:   getCSSVar('--accent')   || '#e87722',
      text:     getCSSVar('--text')     || '#f0ede8',
      muted:    getCSSVar('--muted')    || '#6b6762',
      danger:   getCSSVar('--danger')   || '#c94f4f',
      success:  getCSSVar('--success')  || '#4a9e5c',
    };
  }

  // ── Базовые стили ──────────────────────────────────────────────────
  const BASE_CSS = `
    .rn-root {
      position: fixed; inset: 0; z-index: 9000;
      display: flex; flex-direction: column;
      font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif;
      overflow: hidden;
      animation: rnSlideUp .28s cubic-bezier(.32,1.1,.64,1);
    }
    @keyframes rnSlideUp {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    .rn-root.rn-closing {
      animation: rnSlideDown .22s cubic-bezier(.4,0,.8,.6) forwards;
    }
    @keyframes rnSlideDown {
      from { transform: translateY(0);    opacity: 1; }
      to   { transform: translateY(100%); opacity: 0; }
    }

    /* Status bar placeholder */
    .rn-statusbar {
      height: env(safe-area-inset-top, 44px);
      flex-shrink: 0;
    }

    /* Navigation bar */
    .rn-navbar {
      height: 56px;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 8px;
      border-bottom-width: 1px; border-bottom-style: solid;
      flex-shrink: 0;
    }
    .rn-navbar-title {
      font-size: 17px; font-weight: 600; letter-spacing: -.02em;
      position: absolute; left: 50%; transform: translateX(-50%);
    }
    .rn-navbar-btn {
      background: none; border: none; cursor: pointer;
      font-size: 15px; font-weight: 500;
      padding: 8px 10px; border-radius: 8px;
      -webkit-tap-highlight-color: transparent;
      transition: opacity .12s;
      min-width: 64px;
    }
    .rn-navbar-btn:active { opacity: .5; }

    /* Body scroll */
    .rn-body {
      flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
    }
    .rn-body::-webkit-scrollbar { display: none; }

    /* Section label */
    .rn-section-label {
      font-size: 13px; font-weight: 600; letter-spacing: -.01em;
      padding: 20px 16px 8px;
      text-transform: uppercase; font-size: 11px; letter-spacing: .08em;
    }

    /* Card / grouped list (iOS style) */
    .rn-group {
      margin: 0 16px 8px;
      border-radius: 12px;
      overflow: hidden;
    }
    .rn-row {
      display: flex; align-items: center;
      padding: 13px 16px;
      border-bottom-width: 1px; border-bottom-style: solid;
      cursor: pointer; position: relative;
      -webkit-tap-highlight-color: transparent;
      transition: filter .1s;
      gap: 12px;
    }
    .rn-row:last-child { border-bottom: none; }
    .rn-row:active { filter: brightness(1.25); }
    .rn-row-icon {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; flex-shrink: 0;
    }
    .rn-row-content { flex: 1; min-width: 0; }
    .rn-row-title { font-size: 16px; font-weight: 400; }
    .rn-row-sub { font-size: 12px; margin-top: 1px; }
    .rn-row-chevron { font-size: 18px; opacity: .35; flex-shrink: 0; }
    .rn-row-value { font-size: 15px; opacity: .6; flex-shrink: 0; margin-right: 4px; }

    /* Button */
    .rn-btn {
      display: flex; align-items: center; justify-content: center;
      margin: 8px 16px;
      padding: 15px;
      border: none; border-radius: 12px;
      font-size: 16px; font-weight: 600;
      cursor: pointer; letter-spacing: -.01em;
      transition: opacity .12s, transform .1s;
      -webkit-tap-highlight-color: transparent;
    }
    .rn-btn:active { opacity: .75; transform: scale(.98); }

    /* TextInput */
    .rn-input-wrap {
      margin: 0 16px 12px;
      border-radius: 12px;
      overflow: hidden;
    }
    .rn-input {
      width: 100%; border: none; outline: none;
      padding: 14px 16px;
      font-size: 16px;
      font-family: inherit;
      box-sizing: border-box;
    }

    /* Search bar (iOS style) */
    .rn-search-wrap {
      padding: 8px 16px 12px;
    }
    .rn-search-inner {
      display: flex; align-items: center; gap: 8px;
      border-radius: 10px; padding: 8px 12px;
    }
    .rn-search-icon { font-size: 16px; opacity: .5; }
    .rn-search-input {
      flex: 1; border: none; outline: none; background: none;
      font-size: 16px; font-family: inherit;
    }

    /* List item */
    .rn-list-item {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px;
      border-bottom-width: 1px; border-bottom-style: solid;
      cursor: pointer; -webkit-tap-highlight-color: transparent;
      transition: filter .1s;
    }
    .rn-list-item:last-child { border-bottom: none; }
    .rn-list-item:active { filter: brightness(1.2); }
    .rn-list-item.rn-selected { }

    /* Pair card (schedule) */
    .rn-pair-card {
      margin: 0 16px 8px;
      border-radius: 14px;
      overflow: hidden;
      border-left-width: 4px; border-left-style: solid;
    }
    .rn-pair-inner { padding: 12px 14px; }
    .rn-pair-time { font-size: 12px; font-weight: 600; letter-spacing: .03em; margin-bottom: 4px; }
    .rn-pair-subject { font-size: 16px; font-weight: 700; margin-bottom: 3px; letter-spacing: -.02em; }
    .rn-pair-meta { font-size: 13px; opacity: .65; }

    /* Progress bar */
    .rn-progress-bar {
      height: 3px; border-radius: 2px; overflow: hidden;
      margin: 0 16px 4px;
    }
    .rn-progress-fill {
      height: 100%; border-radius: 2px;
      transition: width .4s cubic-bezier(.4,0,.2,1);
    }

    /* Badge (для RN-метки) */
    .rn-badge {
      display: inline-flex; align-items: center;
      padding: 3px 8px; border-radius: 20px;
      font-size: 10px; font-weight: 700; letter-spacing: .04em;
      text-transform: uppercase;
    }

    /* Hero */
    .rn-hero {
      padding: 24px 20px 20px;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
    }
    .rn-hero-title {
      font-size: 28px; font-weight: 700; letter-spacing: -.03em; text-align: center;
    }
    .rn-hero-sub {
      font-size: 13px; text-align: center; opacity: .6;
    }

    /* Mode pill (студент / педагог) */
    .rn-segment {
      display: flex; margin: 4px 16px 16px;
      border-radius: 9px; padding: 2px; gap: 2px;
    }
    .rn-segment-btn {
      flex: 1; padding: 8px 0;
      border: none; border-radius: 7px;
      font-size: 14px; font-weight: 600;
      cursor: pointer; transition: all .18s;
      font-family: inherit;
      -webkit-tap-highlight-color: transparent;
    }

    /* Bottom tab bar */
    .rn-tabbar {
      display: flex;
      height: calc(56px + env(safe-area-inset-bottom, 0px));
      padding-bottom: env(safe-area-inset-bottom, 0px);
      border-top-width: 1px; border-top-style: solid;
      flex-shrink: 0;
    }
    .rn-tab {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 3px;
      background: none; border: none; cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: opacity .12s;
    }
    .rn-tab:active { opacity: .6; }
    .rn-tab-icon { font-size: 22px; line-height: 1; }
    .rn-tab-label { font-size: 10px; font-weight: 500; }

    /* Empty state */
    .rn-empty {
      padding: 60px 24px;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      text-align: center;
    }
    .rn-empty-icon { font-size: 48px; }
    .rn-empty-title { font-size: 18px; font-weight: 600; letter-spacing: -.02em; }
    .rn-empty-sub { font-size: 14px; opacity: .55; line-height: 1.5; }

    /* Toast */
    .rn-toast {
      position: fixed; bottom: calc(90px + env(safe-area-inset-bottom, 0px));
      left: 50%; transform: translateX(-50%) translateY(12px);
      background: rgba(30,30,30,.96); color: #fff;
      padding: 9px 18px; border-radius: 20px;
      font-size: 13px; font-weight: 500;
      white-space: nowrap; z-index: 9999;
      backdrop-filter: blur(12px);
      animation: rnToastIn .22s cubic-bezier(.34,1.3,.64,1) forwards,
                 rnToastOut .22s ease .2s forwards;
      pointer-events: none;
    }
    @keyframes rnToastIn  { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
    @keyframes rnToastOut { from { opacity:1; } to { opacity:0; } }
  `;

  // Инжектируем CSS один раз
  if (!document.getElementById('rn-styles')) {
    const st = document.createElement('style');
    st.id = 'rn-styles';
    st.textContent = BASE_CSS;
    document.head.appendChild(st);
  }

  // ── Утилиты ────────────────────────────────────────────────────────
  function rnToast(msg) {
    const t = document.createElement('div');
    t.className = 'rn-toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function rnClose(root) {
    root.classList.add('rn-closing');
    setTimeout(() => root.remove(), 240);
  }

  function applyThemeToEl(el, theme) {
    el.style.background = theme.bg;
    el.style.color = theme.text;
  }

  // ── Строим DOM-элемент ─────────────────────────────────────────────
  function makeRoot() {
    const theme = getTheme();
    const root = document.createElement('div');
    root.className = 'rn-root';
    root.style.background = theme.bg;
    root.style.color = theme.text;

    // Статус-бар
    const sb = document.createElement('div');
    sb.className = 'rn-statusbar';
    sb.style.background = theme.surface;
    root.appendChild(sb);

    return { root, theme };
  }

  function makeNavbar(theme, title, onClose, rightEl) {
    const nav = document.createElement('div');
    nav.className = 'rn-navbar';
    nav.style.cssText = `background:${theme.surface};border-color:${theme.surface3};position:relative;`;

    // Кнопка закрыть (левая)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'rn-navbar-btn';
    closeBtn.style.color = theme.accent;
    closeBtn.textContent = '✕ Закрыть';
    closeBtn.onclick = onClose;
    nav.appendChild(closeBtn);

    const titleEl = document.createElement('div');
    titleEl.className = 'rn-navbar-title';
    titleEl.style.color = theme.text;
    titleEl.textContent = title;
    nav.appendChild(titleEl);

    // Правый элемент
    const rightWrap = document.createElement('div');
    rightWrap.style.minWidth = '64px'; rightWrap.style.display = 'flex'; rightWrap.style.justifyContent = 'flex-end';
    if (rightEl) rightWrap.appendChild(rightEl);
    nav.appendChild(rightWrap);

    // RN badge
    const badge = document.createElement('span');
    badge.className = 'rn-badge';
    badge.textContent = 'RN';
    badge.style.cssText = `background:${theme.accent};color:#000;position:absolute;top:8px;left:50%;transform:translateX(-50%) translateY(-26px);font-size:8px;`;
    nav.appendChild(badge);

    return nav;
  }

  function makeTabBar(theme, active) {
    const tabs = [
      { id: 'home',     icon: '🏠', label: 'Главная' },
      { id: 'bells',    icon: '🔔', label: 'Звонки'  },
      { id: 'messages', icon: '💬', label: 'Чаты'    },
      { id: 'profile',  icon: '👤', label: 'Профиль' },
    ];
    const bar = document.createElement('div');
    bar.className = 'rn-tabbar';
    bar.style.cssText = `background:${theme.surface};border-color:${theme.surface3};`;
    tabs.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'rn-tab';
      const isActive = t.id === active;
      btn.innerHTML = `<span class="rn-tab-icon">${t.icon}</span><span class="rn-tab-label" style="color:${isActive ? theme.accent : theme.muted}">${t.label}</span>`;
      if (isActive) btn.style.opacity = '1';
      btn.onclick = () => {
        if (t.id === 'home')     rnOpenScreen('home');
        else if (t.id === 'bells') rnToast('Звонки — скоро');
        else if (t.id === 'messages') rnToast('Чаты — скоро');
        else rnToast('Профиль — скоро');
      };
      bar.appendChild(btn);
    });
    return bar;
  }

  // ══ ЭКРАН: ГЛАВНАЯ ══════════════════════════════════════════════════
  function buildHome() {
    const { root, theme } = makeRoot();
    const close = () => rnClose(root);

    // Navbar
    root.appendChild(makeNavbar(theme, 'Расписание', close));

    // Body
    const body = document.createElement('div');
    body.className = 'rn-body';

    // Hero
    const hero = document.createElement('div');
    hero.className = 'rn-hero';
    hero.innerHTML = `
      <div style="width:72px;height:72px;border-radius:20px;background:${theme.accent};display:flex;align-items:center;justify-content:center;font-size:36px;box-shadow:0 6px 24px ${theme.accent}55">📅</div>
      <div class="rn-hero-title" style="color:${theme.text}">Расписание<br>Студентам</div>
      <div class="rn-hero-sub" style="color:${theme.muted}">Колледж · React Native Preview</div>
    `;
    body.appendChild(hero);

    // Переключатель режимов
    const seg = document.createElement('div');
    seg.className = 'rn-segment';
    seg.style.background = theme.surface2;
    let mode = 'student';
    function updateSeg() {
      seg.querySelectorAll('.rn-segment-btn').forEach(b => {
        const isActive = b.dataset.mode === mode;
        b.style.background = isActive ? theme.accent : 'transparent';
        b.style.color = isActive ? '#fff' : theme.muted;
      });
    }
    ['student','teacher'].forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'rn-segment-btn'; btn.dataset.mode = m;
      btn.textContent = m === 'student' ? 'Студенты' : 'Педагоги';
      btn.onclick = () => { mode = m; updateSeg(); rnToast(m === 'student' ? 'Режим: Студенты' : 'Режим: Педагоги'); };
      seg.appendChild(btn);
    });
    updateSeg();
    body.appendChild(seg);

    // Статус + прогресс-бар
    const statusEl = document.createElement('div');
    statusEl.style.cssText = `font-size:12px;color:${theme.muted};text-align:center;margin:0 16px 4px;min-height:16px;`;
    statusEl.textContent = 'Загружаю файлы...';
    body.appendChild(statusEl);

    const progWrap = document.createElement('div');
    progWrap.className = 'rn-progress-bar';
    progWrap.style.background = theme.surface3;
    const progFill = document.createElement('div');
    progFill.className = 'rn-progress-fill';
    progFill.style.cssText = `width:0%;background:${theme.accent};`;
    progWrap.appendChild(progFill);
    body.appendChild(progWrap);

    // Секция файлов
    const section = document.createElement('div');
    const sectionLabel = document.createElement('div');
    sectionLabel.className = 'rn-section-label'; sectionLabel.style.color = theme.muted;
    sectionLabel.textContent = 'Файлы с Яндекс Диска';
    section.appendChild(sectionLabel);
    body.appendChild(section);

    const fileGroup = document.createElement('div');
    fileGroup.className = 'rn-group'; fileGroup.style.background = theme.surface;
    section.appendChild(fileGroup);

    // Анимируем загрузку и берём данные из живого состояния
    progFill.style.width = '30%';
    setTimeout(() => {
      const liveFiles = (typeof S !== 'undefined' && S.files) ? S.files : [];
      progFill.style.width = '100%';
      statusEl.textContent = liveFiles.length > 0 ? `Найдено: ${liveFiles.length} файлов` : 'Файлы не загружены';
      setTimeout(() => { progFill.style.width = '0%'; statusEl.textContent = ''; }, 1200);

      if (liveFiles.length === 0) {
        fileGroup.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'rn-empty';
        empty.innerHTML = `
          <div class="rn-empty-icon">📂</div>
          <div class="rn-empty-title" style="color:${theme.text}">Файлы не загружены</div>
          <div class="rn-empty-sub" style="color:${theme.muted}">Укажи ссылку на Яндекс Диск<br>в настройках оригинального приложения</div>
        `;
        section.appendChild(empty);
      } else {
        liveFiles.forEach((f, i) => {
          const row = document.createElement('div');
          row.className = 'rn-row';
          row.style.cssText = `background:${theme.surface};border-color:${theme.surface2};`;
          const isSelected = (typeof S !== 'undefined') && S.selectedFile?.name === f.name;
          row.innerHTML = `
            <div class="rn-row-icon" style="background:${isSelected ? theme.accent : theme.surface2}">
              <span>${isSelected ? '✅' : '📄'}</span>
            </div>
            <div class="rn-row-content">
              <div class="rn-row-title" style="color:${isSelected ? theme.accent : theme.text}">${f.name}</div>
              <div class="rn-row-sub" style="color:${theme.muted}">${f.size ? (f.size/1024).toFixed(0)+' КБ' : ''}</div>
            </div>
            <div class="rn-row-chevron" style="color:${theme.muted}">›</div>
          `;
          row.onclick = () => {
            if (typeof S !== 'undefined') { S.selectedFile = f; }
            rnClose(root);
            setTimeout(() => rnOpenScreen('groups'), 200);
          };
          fileGroup.appendChild(row);
        });
      }
    }, 600);

    // Кнопка перейти к группам
    const btn = document.createElement('button');
    btn.className = 'rn-btn';
    btn.style.cssText = `background:${theme.accent};color:#fff;`;
    btn.textContent = '→  К группам';
    btn.onclick = () => { rnClose(root); setTimeout(() => rnOpenScreen('groups'), 200); };
    body.appendChild(btn);

    // Кнопка закрыть RN
    const closeBtn2 = document.createElement('button');
    closeBtn2.className = 'rn-btn';
    closeBtn2.style.cssText = `background:${theme.surface2};color:${theme.muted};margin-top:0;`;
    closeBtn2.textContent = '← Вернуться в оригинальный UI';
    closeBtn2.onclick = close;
    body.appendChild(closeBtn2);

    root.appendChild(body);
    root.appendChild(makeTabBar(theme, 'home'));

    return root;
  }

  // ══ ЭКРАН: ГРУППЫ ═══════════════════════════════════════════════════
  function buildGroups() {
    const { root, theme } = makeRoot();
    const close = () => rnClose(root);

    // Navbar
    const rightBtn = document.createElement('button');
    rightBtn.className = 'rn-navbar-btn';
    rightBtn.style.color = theme.accent;
    rightBtn.textContent = '↺';
    rightBtn.onclick = () => { rnToast('Обновляю...'); renderList(); };
    root.appendChild(makeNavbar(theme, 'Группы', close, rightBtn));

    // Search
    const searchWrap = document.createElement('div');
    searchWrap.className = 'rn-search-wrap';
    searchWrap.style.cssText = `background:${theme.surface};border-bottom:1px solid ${theme.surface3};`;
    const searchInner = document.createElement('div');
    searchInner.className = 'rn-search-inner';
    searchInner.style.background = theme.surface2;
    const searchIcon = document.createElement('span');
    searchIcon.className = 'rn-search-icon'; searchIcon.textContent = '🔍';
    const searchInput = document.createElement('input');
    searchInput.className = 'rn-search-input';
    searchInput.placeholder = 'Найти группу...';
    searchInput.style.color = theme.text;
    searchInput.oninput = () => renderList(searchInput.value);
    searchInner.append(searchIcon, searchInput);
    searchWrap.appendChild(searchInner);
    root.appendChild(searchWrap);

    // Status
    const statusEl = document.createElement('div');
    statusEl.style.cssText = `font-size:12px;color:${theme.muted};padding:6px 16px 2px;`;
    root.appendChild(statusEl);

    const progWrap = document.createElement('div');
    progWrap.className = 'rn-progress-bar';
    progWrap.style.background = theme.surface3;
    const progFill = document.createElement('div');
    progFill.className = 'rn-progress-fill';
    progFill.style.cssText = `width:0%;background:${theme.accent};`;
    progWrap.appendChild(progFill);
    root.appendChild(progWrap);

    // Body
    const body = document.createElement('div');
    body.className = 'rn-body';
    root.appendChild(body);

    function skeletons() {
      body.innerHTML = '';
      const g = document.createElement('div');
      g.className = 'rn-group'; g.style.cssText = `margin:16px 16px 0;background:${theme.surface};`;
      for (let i = 0; i < 8; i++) {
        const sk = document.createElement('div');
        sk.style.cssText = `height:52px;border-bottom:1px solid ${theme.surface3};animation:pulse 1.1s ease-in-out infinite;background:${theme.surface2};`;
        if (i === 7) sk.style.borderBottom = 'none';
        g.appendChild(sk);
      }
      body.appendChild(g);
    }

    function renderList(filter = '') {
      const liveGroups = (typeof allGroups !== 'undefined' && allGroups.length > 0) ? allGroups : [];

      if (liveGroups.length === 0) {
        skeletons();
        statusEl.textContent = 'Загружаю группы...';
        progFill.style.width = '40%';

        // Пробуем взять из живого состояния через goToGroups
        if (typeof S !== 'undefined' && S.selectedFile) {
          statusEl.textContent = 'Читаю файл: ' + S.selectedFile.name;
          progFill.style.width = '70%';
          getFileBuf().then(buf => {
            const groups = detectGroups(buf);
            progFill.style.width = '100%';
            setTimeout(() => { progFill.style.width = '0%'; }, 800);
            statusEl.textContent = groups.length + ' групп';
            body.innerHTML = '';
            drawGroups(groups, filter);
          }).catch(e => {
            progFill.style.width = '0%';
            statusEl.textContent = '❌ ' + e.message;
            body.innerHTML = `<div class="rn-empty"><div class="rn-empty-icon">⚠️</div><div class="rn-empty-title" style="color:${theme.text}">Ошибка загрузки</div><div class="rn-empty-sub" style="color:${theme.muted}">${e.message}</div></div>`;
          });
        } else {
          statusEl.textContent = 'Файл не выбран';
          progFill.style.width = '0%';
          body.innerHTML = `
            <div class="rn-empty">
              <div class="rn-empty-icon">📂</div>
              <div class="rn-empty-title" style="color:${theme.text}">Файл не выбран</div>
              <div class="rn-empty-sub" style="color:${theme.muted}">Открой Главную и выбери файл расписания</div>
            </div>
          `;
          const goBtn = document.createElement('button');
          goBtn.className = 'rn-btn';
          goBtn.style.cssText = `background:${theme.accent};color:#fff;`;
          goBtn.textContent = '← На главную';
          goBtn.onclick = () => { rnClose(root); setTimeout(() => rnOpenScreen('home'), 200); };
          body.appendChild(goBtn);
        }
        return;
      }

      statusEl.textContent = liveGroups.length + ' групп';
      progFill.style.width = '0%';
      body.innerHTML = '';
      drawGroups(liveGroups, filter);
    }

    function drawGroups(groups, filter) {
      const filtered = filter
        ? groups.filter(g => g.toLowerCase().includes(filter.toLowerCase()))
        : groups;

      if (filtered.length === 0) {
        body.innerHTML = `<div class="rn-empty"><div class="rn-empty-icon">🔍</div><div class="rn-empty-title" style="color:${theme.text}">Ничего не найдено</div></div>`;
        return;
      }

      // Сортируем: последняя выбранная группа вверх
      const sorted = [...filtered].sort((a, b) => {
        const last = (typeof S !== 'undefined') && S.lastGroup;
        if (last && a === last) return -1;
        if (last && b === last) return 1;
        return 0;
      });

      const group = document.createElement('div');
      group.className = 'rn-group';
      group.style.cssText = `background:${theme.surface};margin-top:8px;`;

      sorted.forEach((g) => {
        const isSelected = (typeof S !== 'undefined') && S.lastGroup === g;
        const row = document.createElement('div');
        row.className = 'rn-list-item' + (isSelected ? ' rn-selected' : '');
        row.style.cssText = `background:${isSelected ? theme.accent + '18' : theme.surface};border-color:${theme.surface2};`;
        row.innerHTML = `
          <div style="flex:1">
            <div style="font-size:16px;font-weight:${isSelected?'700':'400'};color:${isSelected?theme.accent:theme.text}">${g}</div>
          </div>
          ${isSelected ? `<span style="color:${theme.accent};font-size:18px">✓</span>` : `<span style="color:${theme.muted};font-size:18px;opacity:.4">›</span>`}
        `;
        row.onclick = () => {
          // Устанавливаем выбранную группу в живое состояние
          if (typeof S !== 'undefined') { S.lastGroup = g; }
          rnClose(root);
          setTimeout(() => rnOpenScreen('schedule'), 200);
        };
        group.appendChild(row);
      });

      body.appendChild(group);
    }

    renderList();
    root.appendChild(makeTabBar(theme, 'home'));
    return root;
  }

  // ══ ЭКРАН: РАСПИСАНИЕ ════════════════════════════════════════════════
  function buildSchedule() {
    const { root, theme } = makeRoot();
    const close = () => rnClose(root);

    const group = (typeof S !== 'undefined' && S.lastGroup) ? S.lastGroup : '—';

    // Navbar
    const backBtn = document.createElement('button');
    backBtn.className = 'rn-navbar-btn';
    backBtn.style.color = theme.accent;
    backBtn.textContent = '‹ Группы';
    const rnNavbar = makeNavbar(theme, group, null, null);
    // Заменяем кнопку закрыть на "назад"
    rnNavbar.querySelector('.rn-navbar-btn').textContent = '‹ Назад';
    rnNavbar.querySelector('.rn-navbar-btn').onclick = () => {
      rnClose(root);
      setTimeout(() => rnOpenScreen('groups'), 200);
    };
    root.appendChild(rnNavbar);

    // Group header (аналог sched-header)
    const schedHdr = document.createElement('div');
    schedHdr.style.cssText = `background:${theme.surface};border-bottom:1px solid ${theme.surface3};padding:12px 16px 10px;flex-shrink:0;`;
    schedHdr.innerHTML = `
      <div style="font-size:24px;font-weight:800;color:${theme.accent};letter-spacing:-.03em">${group}</div>
      <div style="font-size:11px;color:${theme.muted};margin-top:3px" id="rn-sched-date-line">Загружаю расписание...</div>
    `;
    root.appendChild(schedHdr);

    // Body
    const body = document.createElement('div');
    body.className = 'rn-body';
    root.appendChild(body);

    function skeletons() {
      body.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const sk = document.createElement('div');
        sk.style.cssText = `height:80px;margin:0 16px ${i===0?'12px':'8px'};border-radius:14px;animation:pulse 1.1s ease-in-out ${i*0.08}s infinite;background:${theme.surface2};`;
        body.appendChild(sk);
      }
    }

    function drawDayHeader(text) {
      const d = document.createElement('div');
      d.style.cssText = `padding:16px 16px 8px;font-size:13px;font-weight:700;color:${theme.accent};letter-spacing:.04em;text-transform:uppercase;`;
      d.textContent = text;
      body.appendChild(d);
    }

    function drawPair(num, time, subject, teacher, room, isCurrent) {
      const card = document.createElement('div');
      card.className = 'rn-pair-card';
      card.style.cssText = `background:${theme.surface};border-color:${isCurrent ? theme.accent : theme.surface3};`;
      card.innerHTML = `
        <div class="rn-pair-inner">
          <div class="rn-pair-time" style="color:${isCurrent ? theme.accent : theme.muted}">
            ${num} пара · ${time}${isCurrent ? ' · ▶ Сейчас' : ''}
          </div>
          <div class="rn-pair-subject" style="color:${theme.text}">${subject}</div>
          <div class="rn-pair-meta" style="color:${theme.muted}">${teacher}${room ? ' · ' + room : ''}</div>
        </div>
      `;
      body.appendChild(card);
    }

    function drawEmpty() {
      const empty = document.createElement('div');
      empty.className = 'rn-empty';
      empty.innerHTML = `
        <div class="rn-empty-icon">🎉</div>
        <div class="rn-empty-title" style="color:${theme.text}">Выходной день!</div>
        <div class="rn-empty-sub" style="color:${theme.muted}">Занятий нет</div>
      `;
      body.appendChild(empty);
    }

    skeletons();

    // Берём данные из живого состояния приложения
    setTimeout(() => {
      body.innerHTML = '';

      const liveSchedule = (typeof S !== 'undefined') && S.schedule;

      if (liveSchedule && Array.isArray(liveSchedule) && liveSchedule.length > 0) {
        // Живые данные расписания
        let lastDay = '';
        liveSchedule.forEach(pair => {
          if (pair.day && pair.day !== lastDay) {
            drawDayHeader(pair.day);
            lastDay = pair.day;
          }
          const dateEl = root.querySelector('#rn-sched-date-line');
          if (dateEl && pair.day) dateEl.textContent = pair.day;
          drawPair(
            pair.num || '—',
            pair.time || '',
            pair.subject || pair.name || '—',
            pair.teacher || '',
            pair.room || pair.cab || '',
            !!pair.isCurrent
          );
        });
      } else {
        // Демо-данные как заглушка
        const dateEl = root.querySelector('#rn-sched-date-line');
        if (dateEl) dateEl.textContent = 'ПЯТНИЦА 21.03.2025 (2-я неделя) · демо';

        drawDayHeader('ПЯТНИЦА 21.03.2025');
        drawPair(1, '08:00–09:35', 'Математика', 'Иванова А.В.', 'каб. 204', false);
        drawPair(2, '09:45–11:20', 'Информатика', 'Петров И.С.', 'каб. 301 (пк)', true);
        drawPair(3, '11:40–13:15', 'История', 'Сидорова Е.М.', 'каб. 115', false);
        drawPair(4, '14:00–15:35', 'Физкультура', 'Козлов Д.А.', 'спортзал', false);

        const hint = document.createElement('div');
        hint.style.cssText = `text-align:center;padding:20px 16px;font-size:12px;color:${theme.muted};`;
        hint.textContent = '⚠️ Демо-данные. Выбери группу через оригинальный UI для загрузки реального расписания.';
        body.appendChild(hint);
      }
    }, 700);

    root.appendChild(makeTabBar(theme, 'home'));
    return root;
  }

  // ── Реестр экранов ─────────────────────────────────────────────────
  const SCREENS = {
    home:     buildHome,
    groups:   buildGroups,
    schedule: buildSchedule,
  };

  // ── Публичный метод открытия ───────────────────────────────────────
  window.rnOpenScreen = function (screenId) {
    // Закрываем предыдущий RN-экран если есть
    document.querySelectorAll('.rn-root').forEach(el => rnClose(el));

    const builder = SCREENS[screenId];
    if (!builder) { console.warn('RN: unknown screen', screenId); return; }

    const root = builder();
    document.body.appendChild(root);
  };

})();
