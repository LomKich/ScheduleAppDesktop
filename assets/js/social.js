// ┄┄ Логирование ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function sLog(level, msg) {
  try {
    const tag = '[SOCIAL]';
    const full = tag + ' ' + msg;
    if (window.Android && typeof Android.log === 'function') Android.log(full);
    if (typeof appLog === 'function') appLog(level, msg);
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════════════════
// 👤 СИСТЕМА АККАУНТОВ И ПРОФИЛЯ
// Хранение: localStorage. P2P онлайн: PeerJS (id = "sapp-" + username)
// ══════════════════════════════════════════════════════════════════════

const PROFILE_KEY   = 'sapp_profile_v1';
const ACCOUNTS_KEY  = 'sapp_accounts_v1'; // все локальные аккаунты
const FRIENDS_KEY   = 'sapp_friends_v1';

const PROFILE_STATUSES = [
  { id:'online',  emoji:'🟢', label:'В сети',       color:'#4caf7d' },
  { id:'study',   emoji:'📚', label:'Учусь',         color:'#60cdff' },
  { id:'busy',    emoji:'🔴', label:'Занят',          color:'#c94f4f' },
  { id:'sleep',   emoji:'😴', label:'Сплю',           color:'#a78bfa' },
  { id:'game',    emoji:'🎮', label:'Играю',          color:'#f5c518' },
  { id:'away',    emoji:'🌙', label:'Отошёл',         color:'#e87722' },
];

const PROFILE_COLORS = [
  '#e87722','#60cdff','#a78bfa','#4caf7d','#f5c518','#c94f4f',
  '#ff66aa','#00e5ff','#ffb347','#b2ff59','#ff6e40','#40c4ff',
];

const AVATAR_EMOJIS = [
  '😊','😎','🤓','🥳','😏','🤩','🦊','🐺','🦋','🐸','🐱','🐶',
  '🦁','🐼','🐨','🦄','🐉','🦅','🎭','🤖','👻','💀','🎃','⚡',
  '🔥','💎','🌙','⭐','🌈','🎵','🎮','🏆',
];

// ┄┄ Helpers ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function profileLoad()    { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null; } catch(e){ return null; } }
function profileSave(p) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  // Keep accounts store in sync — including banner/avatar/vip for correct restore on switch
  if (p && p.username) {
    const accounts = accountsLoad();
    if (!accounts[p.username]) accounts[p.username] = {};
    accounts[p.username].name       = p.name;
    accounts[p.username].avatar     = p.avatar;
    accounts[p.username].avatarType = p.avatarType || 'emoji';
    accounts[p.username].avatarData = p.avatarData || null;
    accounts[p.username].avatarVideo= p.avatarVideo|| null;
    accounts[p.username].banner     = p.banner     || null;
    accounts[p.username].bio        = p.bio        || '';
    accounts[p.username].color      = p.color      || 'var(--accent)';
    accounts[p.username].frame      = p.frame      || 'none';
    accounts[p.username].badge      = p.badge      || null;
    accounts[p.username].vip        = p.vip        || false;
    accounts[p.username].createdAt  = p.createdAt;
    if (p.pwdHash) accounts[p.username].pwdHash = p.pwdHash;
    accountsSave(accounts);
    // Persist large avatar/banner data to IndexedDB so it survives localStorage limits
    if (typeof idbSet === 'function') {
      if (p.avatarData)  idbSet('profile_avatar:'  + p.username, p.avatarData).catch(()=>{});
      if (p.avatarVideo) idbSet('profile_video:'   + p.username, p.avatarVideo).catch(()=>{});
      if (p.banner)      idbSet('profile_banner:'  + p.username, p.banner).catch(()=>{});
    }
  }
}
function accountsLoad()   { try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || {}; } catch(e){ return {}; } }
function accountsSave(a)  { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a)); }
function friendsLoad()    { try { return JSON.parse(localStorage.getItem(FRIENDS_KEY)) || []; } catch(e){ return []; } }
function friendsSave(f)   { localStorage.setItem(FRIENDS_KEY, JSON.stringify(f)); }

// ┄┄ Локальные никнеймы (переименование пользователей, как в Telegram) ┄┄
const LOCAL_NICKS_KEY = 'sapp_local_nicks_v1';
function localNickLoad()         { try { return JSON.parse(localStorage.getItem(LOCAL_NICKS_KEY)) || {}; } catch(e) { return {}; } }
function localNickGet(username)  { return localNickLoad()[username] || ''; }
function localNickSet(username, nick) {
  const nicks = localNickLoad();
  if (nick && nick.trim()) nicks[username] = nick.trim();
  else delete nicks[username];
  localStorage.setItem(LOCAL_NICKS_KEY, JSON.stringify(nicks));
}

/** Диалог переименования пользователя (локально, как в Telegram) */
function localNickEdit(username, currentName) {
  const current = localNickGet(username) || '';
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;animation:mcFadeIn .15s ease';
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px;padding:24px 20px;width:100%;max-width:340px;box-shadow:0 8px 40px rgba(0,0,0,.7)" onclick="event.stopPropagation()">
      <div style="font-size:17px;font-weight:700;margin-bottom:4px">Изменить имя</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px">Только у тебя   @${escHtml(username)}</div>
      <input id="_nick-inp" value="${escHtml(current)}" placeholder="${escHtml(currentName)}"
        style="width:100%;padding:12px 14px;background:var(--surface2);border:1.5px solid rgba(255,255,255,.1);border-radius:12px;color:var(--text);font-family:inherit;font-size:15px;outline:none;box-sizing:border-box;margin-bottom:6px"
        maxlength="32" autofocus>
      <div style="font-size:11px;color:var(--muted);margin-bottom:16px">Оставь пустым, чтобы сбросить</div>
      <div style="display:flex;gap:10px">
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="flex:1;padding:12px;background:var(--surface2);border:none;border-radius:12px;color:var(--text);font-family:inherit;font-size:15px;cursor:pointer">Отмена</button>
        <button onclick="_localNickSave('${escHtml(username)}')"
          style="flex:1;padding:12px;background:var(--accent);border:none;border-radius:12px;color:#000;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer">Сохранить</button>
      </div>
    </div>`;
  sheet.addEventListener('click', () => sheet.remove());
  document.body.appendChild(sheet);
  setTimeout(() => document.getElementById('_nick-inp')?.focus(), 100);
}

function _localNickSave(username) {
  const inp = document.getElementById('_nick-inp');
  if (!inp) return;
  localNickSet(username, inp.value);
  document.querySelector('[style*="position:fixed"][style*="z-index:9999"]')?.remove();
  // Обновить шапку чата если сейчас открыт
  if (_msgCurrentChat === username) {
    const nameEl = document.getElementById('mc-hdr-name');
    if (nameEl) nameEl.textContent = localNickGet(username) || inp.placeholder;
  }
  messengerRenderList();
  toast('✏️ Имя изменено');
}

function profileHashPwd(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return h.toString(16);
}

function profileGetPeerId(username) {
  return 'sapp-' + username.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

// ┄┄ Инициализация при старте ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function profileBootstrap() {
  const p = profileLoad();
  updateNavProfileIcon(p);
  if (!p) {
    setTimeout(() => {
      if (!profileLoad()) {
        profileInitLoginScreen();
        showScreen('s-login');
        // Если есть сохранённые аккаунты   открываем вкладку входа
        const accounts = accountsLoad();
        const usernames = Object.keys(accounts);
        if (usernames.length > 0) {
          loginShowAuth(usernames[usernames.length - 1]);
        }
        // Иначе остаётся вкладка регистрации (дефолт)
      }
    }, 1200);
  } else {
    profileConnect(p);
    // Сообщаем Java username для фоновых уведомлений
    try { window.Android?.setCurrentUser?.(p.username); } catch(_) {}
    // Синхронизируем список групп с Java для фонового поллинга
    try {
      if (window.Android?.saveUserGroups) {
        const _grps = groupsLoad().filter(g => g.id && g.id.startsWith('grp_'));
        window.Android.saveUserGroups(p.username, JSON.stringify(_grps));
      }
    } catch(_) {}
  }
}

// ┄┄ Обновить иконку в нав-баре ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function updateNavProfileIcon(p) {
  const btn = document.getElementById('nav-profile');
  const wrap = btn?.querySelector('.nav-icon-wrap');
  if (!wrap) return;
  if (p && p.avatarType === 'video' && p.avatarVideo) {
    wrap.innerHTML = `<video src="${p.avatarVideo}" autoplay loop muted playsinline style="width:28px;height:28px;border-radius:50%;object-fit:cover;display:block"></video>`;
  } else if (p && p.avatarType === 'emoji' && p.avatar) {
    wrap.innerHTML = `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center">${_emojiImg(p.avatar,24)}</div>`;
  } else if (p && p.avatarType === 'photo' && p.avatarData) {
    wrap.innerHTML = `<img src="${p.avatarData}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;display:block">`;
  } else {
    wrap.innerHTML = `<svg class="nav-icon" id="nav-profile-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
  }
}

// ══ ЭКРАН ЛОГИНА ═════════════════════════════════════════════════
let _loginSelectedEmoji = '😊';

function profileInitLoginScreen() {
  _loginSelectedEmoji = '😊';
  const customInput = document.getElementById('login-custom-emoji-input');
  const customPreview = document.getElementById('login-custom-emoji-preview');
  const customErr = document.getElementById('login-custom-emoji-error');
  if (customInput) { customInput.value = ''; customInput.style.borderColor = ''; }
  if (customPreview) customPreview.textContent = '';
  if (customErr) customErr.textContent = '';
  // Сбрасываем wizard на шаг 0
  wizardGoTo(0);
  wizardSwitchTab('reg');
}

// ┄┄ Валидация эмодзи ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function isEmoji(str) {
  if (!str || str.trim() === '') return false;
  // Extract all emoji-like segments using the Unicode emoji regex
  const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Component}*\u200D)*[\p{Emoji_Presentation}\p{Emoji}\uFE0F\p{Emoji_Modifier_Base}]$/u;
  // Simple check: strip ZWJ, VS16, modifiers and see if we have emoji codepoints
  const cleaned = str.replace(/\u200D/g,'').replace(/\uFE0F/g,'').replace(/[\u{1F3FB}-\u{1F3FF}]/gu,'').trim();
  if (!cleaned) return false;
  // Check each codepoint: must be emoji range
  const cp = cleaned.codePointAt(0);
  if (!cp) return false;
  return (
    (cp >= 0x1F600 && cp <= 0x1F64F) || // Emoticons
    (cp >= 0x1F300 && cp <= 0x1F5FF) || // Misc Symbols and Pictographs
    (cp >= 0x1F680 && cp <= 0x1F6FF) || // Transport and Map
    (cp >= 0x1F700 && cp <= 0x1F77F) || // Alchemical Symbols
    (cp >= 0x1F780 && cp <= 0x1F7FF) || // Geometric Shapes Extended
    (cp >= 0x1F800 && cp <= 0x1F8FF) || // Supplemental Arrows-C
    (cp >= 0x1F900 && cp <= 0x1F9FF) || // Supplemental Symbols and Pictographs
    (cp >= 0x1FA00 && cp <= 0x1FA6F) || // Chess Symbols
    (cp >= 0x1FA70 && cp <= 0x1FAFF) || // Symbols and Pictographs Extended-A
    (cp >= 0x2600  && cp <= 0x27BF)  || // Misc symbols, Dingbats
    (cp >= 0x2300  && cp <= 0x23FF)  || // Misc Technical
    (cp >= 0x2B00  && cp <= 0x2BFF)  || // Misc Symbols and Arrows
    (cp >= 0xFE00  && cp <= 0xFE0F)  || // Variation Selectors
    (cp >= 0x1F000 && cp <= 0x1F02F) || // Mahjong tiles
    (cp >= 0x1F0A0 && cp <= 0x1F0FF) || // Playing cards
    (cp >= 0x1F100 && cp <= 0x1F1FF) || // Enclosed Alphanumeric Supplement
    (cp >= 0x1F200 && cp <= 0x1F2FF) || // Enclosed Ideographic Supplement
    (cp === 0x00A9 || cp === 0x00AE)  || // © ®
    (cp >= 0x203C  && cp <= 0x2049)  || //   /
    (cp >= 0x20D0  && cp <= 0x20FF)     // Combining Enclosing Keycap etc.
  );
}

// ┄┄ Рандомный эмодзи ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
const _ALL_EMOJI = [
  // Смайлики и люди
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
  '😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐',
  '🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒',
  '🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕',
  '😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱',
  '😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩',
  '🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
  // Жесты и тело
  '👋','🤚','🖐','✅','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆',
  '🖕','👇','☝️','👍','👎','✅','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️',
  '💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','🧠','🦷','🦴','👀','👁','👅','👄',
  // Люди
  '👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','🙍','🙎','🙅','🙆',
  '💁','🙋','🧏','🙇','🤦','🤷','👮','🕵','💂','🥷','👷','🤴','👸','👳','👲','🧕',
  '🤵','👰','🤰','🤱','👼','🎅','🤶','🦸','🦹','🧙','🧚','🧛','🧜','🧝','🧞','🧟',
  '💆','💇','🚶','🧍','🧎','🏃','💃','🕺','🕴','👯','🧖','🧗','🏌','🏇','🧘','🏄',
  // Животные
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈',
  '🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱',
  '🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑',
  '🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧',
  '🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑',
  '🦙','🐐','🦌','🐕','🐩','🦮','🐈','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊','🐇',
  '🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿','🦔',
  // Еда
  '🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝',
  '🍅','🥑','🍆','🥔','🥕','🌽','🌶','🫑','🥒','🥬','🥦','🧄','🧅','🍄','🥜','🌰',
  '🍞','🥐','🥖','🥨','🧀','🍳','🥚','🍔','🍟','🌭','🍕','🌮','🌯','🫔','🥙','🧆',
  '🍜','🍝','🍛','🍣','🍱','🍤','🍙','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭',
  '🍬','🍫','🍿','🧂','🍩','🍪','🌰','🍯','🧃','🥤','🧋','☕','🍵','🧉','🍺','🍻',
  // Природа
  '🌸','🌺','🌻','🌹','🪷','🌷','🌼','🌱','🌿','☘️','🍀','🎍','🪴','🍁','🍂','🍃',
  '🍄','🌾','💐','🌵','🎋','🌲','🌳','🌴','🪵','🪨','🌊','💧','🔥','🌈','⭐','🌟',
  '✅','💫','⚡','🌙','☕','🌤','❄️','🌦','🌧','⛈️','🌩','❄️','💨','🌀','🌈',
  // Предметы
  '⚡','🏀','🏈','⚡','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🥊','🥋','🎯',
  '⛸️','🎿','🛷','🎮','🎲','🧩','🧸','🪁','🎭','🎨','🖼','🎪','🎤','🎧','🎵','🎶',
  '🎸','🎹','🎷','🎺','🎻','🪘','🥁','📱','💻','⌨️','🖥','🖨','📷','📸','📹','🎥',
  '📺','📻','🎙','⏳','⌄','⏳','📡','🔋','💡','🔦','🕯','💎','🔮','🪄','🧲','🔑',
  '🗝','🔒','🔓','🔨','🪛','🔧','⚙️','🪤','🧰','🗡','🛡','🪝','🧲','🎁','🎀',
  '🎈','🎉','🎊','🎏','🎐','🎑','🎃','🎄','🎆','🎇','✉️','📦','🏆','🥇','🥈','🥉',
  // Места и символы
  '🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏬','🏭','🏯','🏰','🗼','🗽',
  '❄️','🕌','🛕','⛩️','🕍','🗾','🏔','⛰️','🌋','🗻','🏕','🏖','🏜','🏝','🌅',
  '🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍',
  '🛵','🚲','🛴','🛺','🚁','🛸','✈️','🚀','🛩','❄️','🚢','🚂','🚃','🚄','🚅',
  // Флаги/символы
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
  '💘','💝','💟','☮️','✝️','☯️','🆒','🆓','🆕','🆙','🆚','🈵','🔴','🟠','🟡','🟢',
  '🔵','🟣','⚡','⚡','🟤','🔺','🔻','💠','🔷','🔶','🔹','🔸','▪️','▫️','🔲','🔳',
];

function randomEmojiPick(ctx) {
  const emoji = _ALL_EMOJI[Math.floor(Math.random() * _ALL_EMOJI.length)];
  if (ctx === 'edit') {
    _editSelectedEmoji = emoji;
    _profileAvatarMode = 'emoji';
    const preview = document.getElementById('edit-custom-emoji-preview');
    const inner   = document.getElementById('edit-avatar-inner');
    const inp     = document.getElementById('edit-custom-emoji-input');
    if (preview) preview.textContent = emoji;
    if (inner)   inner.textContent   = emoji;
    if (inp)     inp.value           = emoji;
    // Сброс фото-режима
    const editScreen = document.getElementById('s-profile-edit');
    if (editScreen) {
      const imgEl = editScreen.querySelector('#edit-avatar-preview img');
      if (imgEl) imgEl.remove();
    }
  } else {
    _loginSelectedEmoji = emoji;
    const preview = document.getElementById('login-custom-emoji-preview');
    const inp     = document.getElementById('login-custom-emoji-input');
    if (preview) preview.textContent = emoji;
    if (inp)     inp.value           = emoji;
    // Обновляем большой аватар в wizard
    const bigAvatar = document.getElementById('wizard-avatar-big');
    if (bigAvatar) {
      bigAvatar.textContent = emoji;
      bigAvatar.style.transform = 'scale(1.3) rotate(-8deg)';
      setTimeout(() => { bigAvatar.style.transform = ''; }, 250);
    }
  }
  // Маленькая анимация
  const previewEl = document.getElementById(ctx + '-custom-emoji-preview');
  if (previewEl) {
    previewEl.style.transform = 'scale(1.35) rotate(10deg)';
    setTimeout(() => { previewEl.style.transform = ''; }, 200);
  }
}

// Извлечь первый эмодзи из строки
function extractFirstEmoji(str) {
  if (!str) return null;
  // Match any emoji sequence (including ZWJ sequences, modifier sequences, etc.)
  const match = str.match(/\p{Emoji_Presentation}(?:\uFE0F?\u20E3?|\u200D[\p{Emoji_Presentation}\p{Emoji}])*|\p{Emoji}\uFE0F(?:\u20E3?|\u200D[\p{Emoji_Presentation}\p{Emoji}])*/u);
  if (!match) return null;
  const cp = match[0].codePointAt(0);
  if (!cp || cp < 0x00A9) return null; // reject plain ASCII/latin
  if (isEmoji(match[0])) return match[0];
  return null;
}

// Обработчик поля ввода эмодзи на экране регистрации
function loginCustomEmojiInput(el) {
  const errEl = document.getElementById('login-custom-emoji-error');
  const preview = document.getElementById('login-custom-emoji-preview');
  const val = el.value;
  if (!val.trim()) {
    if (errEl) errEl.textContent = '';
    if (preview) preview.textContent = '';
    el.style.borderColor = 'var(--surface3)';
    return;
  }
  const emoji = extractFirstEmoji(val);
  if (emoji) {
    _loginSelectedEmoji = emoji;
    if (preview) preview.textContent = emoji;
    if (errEl) errEl.textContent = '';
    el.style.borderColor = 'var(--accent)';
    // Обновляем большой аватар wizard
    const bigAvatar = document.getElementById('wizard-avatar-big');
    if (bigAvatar) bigAvatar.textContent = emoji;
    document.querySelectorAll('#login-emoji-grid button').forEach(b => b.style.borderColor = 'var(--surface3)');
  } else {
    if (errEl) errEl.textContent = 'Это не эмодзи   вставь символ с клавиатуры';
    if (preview) preview.textContent = '';
    el.style.borderColor = 'var(--danger,#c94f4f)';
  }
}

// Обработчик поля ввода эмодзи на экране редактирования профиля
function editCustomEmojiInput(el) {
  const errEl = document.getElementById('edit-custom-emoji-error');
  const preview = document.getElementById('edit-custom-emoji-preview');
  const inner = document.getElementById('edit-avatar-inner');
  const val = el.value;
  if (!val.trim()) {
    if (errEl) errEl.textContent = '';
    if (preview) preview.textContent = '';
    el.style.borderColor = 'var(--surface3)';
    return;
  }
  const emoji = extractFirstEmoji(val);
  if (emoji) {
    _editSelectedEmoji = emoji;
    _profileAvatarMode = 'emoji';
    if (preview) preview.textContent = emoji;
    if (inner) inner.textContent = emoji;
    if (errEl) errEl.textContent = '';
    el.style.borderColor = 'var(--accent)';
    // Deselect preset grid
    document.querySelectorAll('#edit-emoji-grid button').forEach(b => b.style.borderColor = 'var(--surface3)');
  } else {
    if (errEl) errEl.textContent = 'Это не эмодзи   вставь символ с клавиатуры';
    if (preview) preview.textContent = '';
    el.style.borderColor = 'var(--danger,#c94f4f)';
  }
}

let _loginCheckTimer = null;
function loginCheckUsername(val) {
  const status = document.getElementById('login-username-status');
  const btn = document.getElementById('wbtn-1');
  if (!val) { if(status)status.textContent=''; if(btn)btn.disabled=true; return; }
  const clean = val.replace(/[^a-zA-Z0-9_]/g, '');
  if (document.getElementById('login-username')) document.getElementById('login-username').value = clean;
  if (clean.length < 3) {
    if(status){status.textContent='Минимум 3 символа'; status.style.color='var(--danger,#c94f4f)';}
    if(btn)btn.disabled=true; return;
  }
  // Check if taken locally
  const accounts = accountsLoad();
  if (accounts[clean.toLowerCase()]) {
    if(status){status.textContent='⚠️ Этот ник уже занят на устройстве'; status.style.color='var(--danger,#c94f4f)';}
    if(btn)btn.disabled=true; return;
  }
  if(status){status.textContent='⏳ Проверяем...'; status.style.color='var(--muted)';}
  if(btn)btn.disabled=true;
  clearTimeout(_loginCheckTimer);
  _loginCheckTimer = setTimeout(async () => {
    if (!sbReady()) {
      if(status){status.textContent='✅ Отлично!'; status.style.color='#4caf7d';}
      if(btn)btn.disabled=false; return;
    }
    try {
      // Сначала проверяем кэш _allKnownUsers чтобы не делать лишний запрос
      if (_allKnownUsers.some(u => u.username === clean.toLowerCase())) {
        if(status){status.textContent='❌ Ник уже занят'; status.style.color='var(--danger,#c94f4f)';}
        if(btn)btn.disabled=true; return;
      }
      const data = await sbGet('presence', `select=username&username=eq.${encodeURIComponent(clean.toLowerCase())}&limit=1`);
      if (Array.isArray(data) && data.length > 0) {
        if(status){status.textContent='❌ Ник уже занят'; status.style.color='var(--danger,#c94f4f)';}
        if(btn)btn.disabled=true;
      } else {
        if(status){status.textContent='✅ Ник свободен!'; status.style.color='#4caf7d';}
        if(btn)btn.disabled=false;
      }
    } catch(e) {
      if(status){status.textContent='✅ Отлично!'; status.style.color='#4caf7d';}
      if(btn)btn.disabled=false;
    }
  }, 900); // увеличен дебаунс с 600 до 900ms
}

function profileCreate() {
  const nameEl = document.getElementById('login-name');
  const unEl = document.getElementById('login-username');
  const pwdEl = document.getElementById('login-password');
  const errEl = document.getElementById('login-error');
  sLog('info', 'profileCreate: попытка регистрации');
  const name = (nameEl?.value || '').trim();
  const username = (unEl?.value || '').trim().toLowerCase();
  const pwd = (pwdEl?.value || '');
  if (!name) { if(errEl)errEl.textContent='Введи имя'; return; }
  if (username.length < 3) { if(errEl)errEl.textContent='Юзернейм слишком короткий'; return; }
  if (!pwd) { if(errEl)errEl.textContent='Придумай пароль'; return; }
  const existingAccounts = accountsLoad();
  if (existingAccounts[username]) { if(errEl)errEl.textContent='Этот ник уже занят'; return; }

  // Случайный цвет если пользователь не выбрал
  const randomColor = PROFILE_COLORS[Math.floor(Math.random() * PROFILE_COLORS.length)];
  // Случайный emoji если пользователь не поменял дефолт
  const defaultEmoji = '😊';
  const finalEmoji = (_loginSelectedEmoji && _loginSelectedEmoji !== defaultEmoji)
    ? _loginSelectedEmoji
    : _ALL_EMOJI[Math.floor(Math.random() * _ALL_EMOJI.length)];

  const profile = {
    name, username,
    avatarType: 'emoji',
    avatar: finalEmoji,
    bio: '',
    status: 'online',
    color: randomColor,
    createdAt: Date.now(),
    uid: Date.now().toString(36),
    pwdHash: profileHashPwd(pwd),
  };
  profileSave(profile);
  const accounts = accountsLoad();
  accounts[username] = { name, avatar: finalEmoji, createdAt: profile.createdAt, pwdHash: profile.pwdHash };
  accountsSave(accounts);
  sbSaveUser(profile);
  updateNavProfileIcon(profile);
  profileConnect(profile);
  profileRenderScreen();
  showScreen('s-profile');
  toast('🎉 Добро пожаловать, ' + name + '!');
  // Сообщаем Java какой username отслеживать для фоновых уведомлений
  try { window.Android?.setCurrentUser?.(username); } catch(_) {}
}

function loginShowRegister() { wizardSwitchTab('reg'); }

function loginShowAuth(username) {
  wizardSwitchTab('auth');
  const unEl = document.getElementById('login-auth-username');
  if (unEl && username) unEl.value = username;
  setTimeout(() => {
    const focus = username
      ? document.getElementById('login-auth-password')
      : document.getElementById('login-auth-username');
    focus?.focus();
  }, 300);
}

function loginAuthUsernameInput(val) {
  const errEl = document.getElementById('login-auth-error');
  if (errEl) errEl.textContent = '';
  const clean = val.replace(/[^a-zA-Z0-9_]/g, '');
  const el = document.getElementById('login-auth-username');
  if (el && el.value !== clean) el.value = clean;
}

function loginDoAuth() {
  const unEl  = document.getElementById('login-auth-username');
  const pwdEl = document.getElementById('login-auth-password');
  const errEl = document.getElementById('login-auth-error');
  const btnEl = document.querySelector('#login-auth-form button');
  sLog('info', 'loginDoAuth: попытка входа');
  const username = (unEl?.value || '').trim().toLowerCase();
  const pwd = pwdEl?.value || '';
  if (!username) { if(errEl) errEl.textContent = 'Введи юзернейм'; return; }
  if (!pwd)      { if(errEl) errEl.textContent = 'Введи пароль'; return; }

  // 1) Проверяем локальный список
  const accounts = accountsLoad();
  const acc = accounts[username];
  if (acc) {
    if (!acc.pwdHash) { loginRestoreAccount(username, acc); return; }
    if (profileHashPwd(pwd) !== acc.pwdHash) {
      if(errEl) errEl.textContent = 'Неверный пароль';
      if(pwdEl) { pwdEl.value = ''; pwdEl.style.borderColor = 'var(--danger,#c94f4f)'; }
      setTimeout(() => { if(pwdEl) pwdEl.style.borderColor = ''; }, 1500);
      return;
    }
    loginRestoreAccount(username, acc);
    return;
  }

  // 2) Аккаунта нет локально   ищем в Supabase
  if (!sbReady()) {
    if(errEl) errEl.textContent = 'Аккаунт не найден на устройстве и Supabase недоступен';
    return;
  }
  if(errEl) errEl.textContent = '⏳ Ищем аккаунт в облаке...';
  if(btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳ Вход...'; }

  // Сначала ищем в таблице users (полный профиль с паролем)
  // Если нет   fallback в presence (для старых аккаунтов)
  sbLoadUser(username)
    .then(async row => {
      if (!row) {
        // Fallback: presence (старые аккаунты без таблицы users)
        const presRows = await sbGet('presence', `select=*&username=eq.${encodeURIComponent(username)}&limit=1`);
        row = Array.isArray(presRows) && presRows.length > 0 ? presRows[0] : null;
      }
      if(btnEl) { btnEl.disabled = false; btnEl.textContent = 'Войти'; }
      if (!row) {
        if(errEl) errEl.textContent = 'Аккаунт @' + username + ' не найден';
        return;
      }
      if (!row.pwd_hash) {
        loginRestoreFromCloud(row);
        return;
      }
      if (profileHashPwd(pwd) !== row.pwd_hash) {
        if(errEl) errEl.textContent = 'Неверный пароль';
        if(pwdEl) { pwdEl.value = ''; pwdEl.style.borderColor = 'var(--danger,#c94f4f)'; }
        setTimeout(() => { if(pwdEl) pwdEl.style.borderColor = ''; }, 1500);
        return;
      }
      if(errEl) errEl.textContent = '';
      loginRestoreFromCloud(row);
    })
    .catch(() => {
      if(btnEl) { btnEl.disabled = false; btnEl.textContent = 'Войти'; }
      if(errEl) errEl.textContent = 'Ошибка подключения к облаку';
    });
}

// Восстановление профиля из строки Supabase presence
function loginRestoreFromCloud(row) {
  const profile = {
    name:       row.name        || row.username,
    username:   row.username,
    avatarType: row.avatar_type || 'emoji',
    avatar:     row.avatar      || '😊',
    avatarData: row.avatar_data || null,
    bio:        row.bio         || '',
    status:     row.status      || 'online',
    color:      row.color       || PROFILE_COLORS[0],
    vip:        row.vip         || false,
    badge:      row.badge       || null,
    frame:      row.frame       || null,
    banner:     row.banner      || null,
    createdAt:  row.created_at  || Date.now(),
    uid:        row.uid         || Date.now().toString(36),
    pwdHash:    row.pwd_hash    || null,
  };
  profileSave(profile);
  // Сохраняем в локальный список аккаунтов
  const accounts = accountsLoad();
  accounts[row.username] = {
    name: profile.name, avatar: profile.avatar,
    createdAt: profile.createdAt, pwdHash: profile.pwdHash
  };
  accountsSave(accounts);
  updateNavProfileIcon(profile);
  profileConnect(profile);
  profileRenderScreen();
  showScreen('s-profile');
  toast('☁️ Добро пожаловать, ' + profile.name + '!');
  try { window.Android?.setCurrentUser?.(row.username); } catch(_) {}
}

function loginRestoreAccount(username, acc) {
  // Restore from accounts store into profile
  const existing = profileLoad();
  if (existing && existing.username === username) {
    // Already saved, just connect
    updateNavProfileIcon(existing);
    profileConnect(existing);
    profileRenderScreen();
    showScreen('s-profile');
    toast('👋 Добро пожаловать, ' + existing.name + '!');
    try { window.Android?.setCurrentUser?.(username); } catch(_) {}
    return;
  }
  // Re-create minimal profile from accounts store
  const profile = {
    name: acc.name, username,
    avatarType: 'emoji',
    avatar: acc.avatar || '😊',
    bio: '', status: 'online',
    color: PROFILE_COLORS[0],
    createdAt: acc.createdAt || Date.now(),
    uid: acc.uid || Date.now().toString(36),
    pwdHash: acc.pwdHash,
  };
  profileSave(profile);
  updateNavProfileIcon(profile);
  profileConnect(profile);
  profileRenderScreen();
  showScreen('s-profile');
  toast('👋 Добро пожаловать, ' + profile.name + '!');
  try { window.Android?.setCurrentUser?.(username); } catch(_) {}
}

// ══ ЭКРАН ПРОФИЛЯ ════════════════════════════════════════════════
function profileRenderScreen() {
  const p = profileLoad();
  const body = document.getElementById('profile-body');
  if (!body) return;
  if (!p) {
    body.innerHTML = '<div style="text-align:center;padding:40px"><button class="btn btn-accent" onclick="profileInitLoginScreen();showScreen(\'s-login\')">Войти / Создать аккаунт</button></div>';
    return;
  }

  const statusObj = PROFILE_STATUSES.find(s => s.id === p.status) || PROFILE_STATUSES[0];
  const onlinePeers = _profileOnlinePeers || [];
  const vip = p.vip;
  const frameStyle = PROFILE_FRAMES[p.frame] || PROFILE_FRAMES['none'];
  const badgeObj = PROFILE_BADGES ? PROFILE_BADGES.find(b => b.id === p.badge) : null;

  const bannerStyle = p.banner
    ? (p.banner.startsWith('background:') ? p.banner : `background:${p.banner}`)
    : `background:linear-gradient(135deg,${p.color||'var(--accent)'}66,${p.color||'var(--accent)'}22)`;

  const avatarHtml = p.avatarType === 'video' && p.avatarVideo
    ? `<video src="${p.avatarVideo}" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"></video>`
    : p.avatarType === 'photo' && p.avatarData
    ? `<img src="${p.avatarData}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center">${_emojiImg(p.avatar||'😊',46)}</div>`;

  const friendCount = friendsLoad().length;
  const friendWord = friendCount === 1 ? '\u0447\u0435\u043B\u043E\u0432\u0435\u043A' : friendCount < 5 ? '\u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430' : '\u0447\u0435\u043B\u043E\u0432\u0435\u043A';

  body.innerHTML = `
    <!-- Баннер + аватар -->
    <div style="position:relative;margin:-16px -18px 0">
      <div style="${bannerStyle};height:140px;width:100%;background-size:cover;background-position:center"></div>
      <div style="position:absolute;bottom:-50px;left:50%;transform:translateX(-50%)">
        <div style="position:relative;display:inline-block">
          <div class="profile-avatar ${frameStyle.cls}" style="width:96px;height:96px;font-size:46px;border:3px solid ${p.color||'var(--accent)'};border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;overflow:hidden;${frameStyle.style}">
            ${avatarHtml}
          </div>
          ${vip ? `<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);font-size:22px;line-height:1;filter:drop-shadow(0 1px 4px rgba(0,0,0,.8))">${_emojiImg("👑",22)}</div>` : ''}
        </div>
      </div>
    </div>
    <div style="height:60px"></div>

    <!-- Имя, VIP, username, статус -->
    <div style="text-align:center;padding:0 16px 12px">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:24px;font-weight:800;color:var(--text)">${escHtml(p.name)}</span>
        ${vip ? `<span class="vip-badge-pill">${_emojiImg('👑',14)} VIP</span>` : ''}
      </div>
      <div style="font-size:14px;color:var(--muted);margin-top:3px">@${escHtml(p.username)}</div>
      <div style="display:inline-flex;align-items:center;gap:5px;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;margin-top:8px;background:${statusObj.color}22;color:${statusObj.color}">
        ${_emojiImg(statusObj.emoji,14)} ${statusObj.label}
      </div>
      ${p.bio ? `<div style="font-size:13px;color:var(--muted);margin-top:8px;line-height:1.5">${escHtml(p.bio)}</div>` : ''}
      ${badgeObj ? `<div style="display:inline-block;margin-top:8px;font-size:12px;padding:4px 10px;border-radius:12px;font-weight:700;background:${badgeObj.color}22;color:${badgeObj.color};border:1px solid ${badgeObj.color}44">${_emojiImg(badgeObj.emoji,14)} ${badgeObj.label}</div>` : ''}
    </div>

    <!-- Кнопки действий: Telegram-style   три кнопки в ряд -->
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <button onclick="profilePickPhoto()"
        style="flex:1;padding:12px 6px 10px;background:var(--surface2);border:1.5px solid var(--surface3);border-radius:14px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;-webkit-tap-highlight-color:transparent;transition:background .15s"
        ontouchstart="this.style.background='var(--surface3)'" ontouchend="this.style.background='var(--surface2)'">
        <span style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.08)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--text)"><path d="M9 3L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-3.17L15 3H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3z"/></svg>
        </span>
        <span style="font-size:12px;font-weight:500;color:var(--text);text-align:center;line-height:1.2">Выбрать<br>фото</span>
      </button>
      <button onclick="profileToggleEdit()"
        style="flex:1;padding:12px 6px 10px;background:var(--surface2);border:1.5px solid var(--surface3);border-radius:14px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;-webkit-tap-highlight-color:transparent;transition:background .15s"
        ontouchstart="this.style.background='var(--surface3)'" ontouchend="this.style.background='var(--surface2)'">
        <span style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.08)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--text)"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </span>
        <span style="font-size:12px;font-weight:500;color:var(--text);text-align:center;line-height:1.2">Изменить</span>
      </button>
      <button onclick="navTo('s-settings','nav-settings')"
        style="flex:1;padding:12px 6px 10px;background:var(--surface2);border:1.5px solid var(--surface3);border-radius:14px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;-webkit-tap-highlight-color:transparent;transition:background .15s"
        ontouchstart="this.style.background='var(--surface3)'" ontouchend="this.style.background='var(--surface2)'">
        <span style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.08)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--text)"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
        </span>
        <span style="font-size:12px;font-weight:500;color:var(--text);text-align:center;line-height:1.2">Настройки</span>
      </button>
    </div>

    <!-- Карточка: Таблица лидеров + Друзья + Группы -->
    <div style="background:var(--surface2);border-radius:16px;margin-bottom:10px;overflow:hidden;border:1.5px solid var(--surface3)">

      <div onclick="profileRenderOnline();showScreen('s-online')" style="padding:14px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--surface3);cursor:pointer;-webkit-tap-highlight-color:transparent">
        <span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="var(--accent)"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></span>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700">Друзья</div>
          <div style="font-size:12px;color:var(--muted)">${friendCount} ${friendWord}</div>
        </div>
      </div>
      <div onclick="showGroupsList()" style="padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;-webkit-tap-highlight-color:transparent">
        <span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="var(--accent)"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg></span>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700">Группы</div>
          <div style="font-size:12px;color:var(--muted)">${groupsLoad().length} ${groupsLoad().length === 1 ? 'группа' : groupsLoad().length < 5 ? 'группы' : 'групп'}</div>
        </div>
        <span style="color:var(--muted);font-size:18px"> </span>
      </div>
    </div>

    <!-- Карточка: Подключение -->
    <div id="profile-connect-card" style="background:var(--surface2);border-radius:16px;margin-bottom:10px;border:1.5px solid var(--surface3)">
      <div style="padding:14px 16px;display:flex;align-items:center;gap:12px">
        <span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="var(--accent)"><path d="M1 9l2 2c2.88-2.88 6.79-4.08 10.53-3.62l1.19-1.19C9.89 5.6 4.91 7.12 1 9zm8 8l3 3 3-3c-1.65-1.64-3.96-2.4-6-2.4S10.65 15.36 9 17zm-4-4l2 2c1.88-1.87 4.45-2.83 7-2.83s5.12.96 7 2.83l2-2C21 10.46 16.81 9 12 9c-4.81 0-9 1.46-11 4z"/></svg></span>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700">\u041F\u043E\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435</div>
          <div style="font-size:12px;color:var(--muted)" id="profile-p2p-status">${_profilePeerReady ? '\u{1F7E2} \u041F\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u043e' : '\u{1F534} \u041e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u043e'}</div>
        </div>
        <button onclick="profileConnect(profileLoad())" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;padding:4px;line-height:1">\u21BB</button>
      </div>
    </div>

    <div style="height:8px"></div>
  `;
  _renderAccountSwitcher();
}

// ══════════════════════════════════════════════════════════════════
// 👥 МУЛЬТИАККАУНТ — Telegram-style переключение аккаунтов
// ══════════════════════════════════════════════════════════════════

function _renderAccountSwitcher() {
  const body = document.getElementById('profile-body');
  if (!body) return;
  const accounts = accountsLoad();
  const current  = profileLoad();
  const allNames = Object.keys(accounts);
  if (allNames.length === 0) return;

  document.getElementById('account-switcher-bar')?.remove();

  const bar = document.createElement('div');
  bar.id = 'account-switcher-bar';
  bar.style.cssText = 'background:var(--surface2);border-radius:16px;margin-bottom:10px;border:1.5px solid var(--surface3);overflow:hidden';

  const hdr = document.createElement('div');
  hdr.style.cssText = 'padding:12px 16px 8px;display:flex;align-items:center;justify-content:space-between';
  hdr.innerHTML = `<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Аккаунты</div>
    <button onclick="accountSwitcherAddNew()" style="background:none;border:none;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;padding:4px 8px;border-radius:8px;-webkit-tap-highlight-color:transparent">+ Добавить</button>`;
  bar.appendChild(hdr);

  const list = document.createElement('div');
  allNames.forEach(username => {
    const acc = accounts[username];
    const isCurrent = username === current?.username;
    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:${isCurrent ? 'default' : 'pointer'};border-top:1px solid var(--surface3);-webkit-tap-highlight-color:transparent;${isCurrent ? 'background:rgba(255,255,255,.03)' : ''}`;
    if (!isCurrent) {
      row.ontouchstart = function() { this.style.background = 'var(--surface3)'; };
      row.ontouchend   = function() { this.style.background = ''; };
      row.onclick = () => accountSwitcherSwitch(username);
    }
    const avatarData = isCurrent ? current?.avatarData : null;
    const avatarType = isCurrent ? current?.avatarType : null;
    const avatarEmoji = acc.avatar || '\u{1F60A}';
    const avatarHtml = (avatarType === 'photo' && avatarData)
      ? `<img src="${avatarData}" style="width:40px;height:40px;border-radius:50%;object-fit:cover">`
      : `<span style="font-size:22px">${avatarEmoji}</span>`;
    row.innerHTML = `<div style="width:40px;height:40px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;${isCurrent ? 'border:2px solid var(--accent)' : ''}">${avatarHtml}</div>
      <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:${isCurrent ? '700' : '500'};color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(acc.name || username)}</div>
      <div style="font-size:12px;color:var(--muted)">@${escHtml(username)}</div></div>
      ${isCurrent ? '<span style="font-size:11px;font-weight:700;color:var(--accent);flex-shrink:0">\u2713 \u0410\u043A\u0442\u0438\u0432\u0435\u043D</span>' : '<span style="font-size:18px;color:var(--muted);flex-shrink:0">\u203a</span>'}`;
    list.appendChild(row);
  });
  bar.appendChild(list);
  // Insert AFTER the connection card (profile-connect-card), not at top
  const connectCard = body.querySelector('#profile-connect-card');
  if (connectCard && connectCard.nextSibling) {
    body.insertBefore(bar, connectCard.nextSibling);
  } else if (connectCard) {
    body.appendChild(bar);
  } else {
    body.insertBefore(bar, body.firstChild);
  }
}

async function accountSwitcherSwitch(username) {
  const accounts = accountsLoad();
  const acc = accounts[username];
  if (!acc) return;
  const cur = profileLoad();
  if (cur) {
    // Save FULL profile snapshot into accounts cache before switching
    accounts[cur.username] = {
      name:        cur.name,
      avatar:      cur.avatar,
      avatarType:  cur.avatarType  || 'emoji',
      avatarData:  cur.avatarData  || null,
      avatarVideo: cur.avatarVideo || null,
      banner:      cur.banner      || null,
      bio:         cur.bio         || '',
      color:       cur.color       || 'var(--accent)',
      frame:       cur.frame       || 'none',
      badge:       cur.badge       || null,
      vip:         cur.vip         || false,
      createdAt:   cur.createdAt,
      pwdHash:     cur.pwdHash,
    };
    accountsSave(accounts);
    profileDisconnect();
  }
  if (acc.pwdHash) {
    toast('\u23F3 \u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0430\u0435\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442...');
    localStorage.removeItem(PROFILE_KEY);
    if (sbReady()) {
      try {
        const rows = await sbGet('users', `select=*&username=eq.${encodeURIComponent(username)}&limit=1`);
        if (Array.isArray(rows) && rows.length > 0) _mapProfileRow(rows[0]);
      } catch(e) {}
    }
    let p = profileLoad();
    if (!p || p.username !== username) {
      // Restore full profile from accounts cache (includes banner, video, vip etc.)
      p = {
        username,
        name:        acc.name        || username,
        avatar:      acc.avatar      || '\u{1F60A}',
        avatarType:  acc.avatarType  || 'emoji',
        avatarData:  acc.avatarData  || null,
        avatarVideo: acc.avatarVideo || null,
        banner:      acc.banner      || null,
        bio:         acc.bio         || '',
        status:      'online',
        color:       acc.color       || 'var(--accent)',
        frame:       acc.frame       || 'none',
        badge:       acc.badge       || null,
        vip:         acc.vip         || false,
        pwdHash:     acc.pwdHash,
        createdAt:   acc.createdAt   || Date.now(),
        uid:         username,
      };
      profileSave(p);
    }
    // Try to restore large data from IndexedDB (avatarData/banner may be too big for accounts obj)
    if (typeof idbGet === 'function') {
      const restoreFromIdb = async () => {
        const fresh = profileLoad();
        if (!fresh || fresh.username !== username) return;
        let changed = false;
        if (!fresh.avatarData && fresh.avatarType === 'photo') {
          const d = await idbGet('profile_avatar:' + username).catch(()=>null);
          if (d) { fresh.avatarData = d; changed = true; }
        }
        if (!fresh.avatarVideo && fresh.avatarType === 'video') {
          const d = await idbGet('profile_video:' + username).catch(()=>null);
          if (d) { fresh.avatarVideo = d; changed = true; }
        }
        if (!fresh.banner) {
          const d = await idbGet('profile_banner:' + username).catch(()=>null);
          if (d) { fresh.banner = d; changed = true; }
        }
        if (changed) { profileSave(fresh); updateNavProfileIcon(fresh); profileRenderScreen(); }
      };
      restoreFromIdb();
    }
    updateNavProfileIcon(p);
    profileConnect(p);
    profileRenderScreen();
    showScreen('s-profile');
    toast('\u{1F44B} \u041F\u0440\u0438\u0432\u0435\u0442, ' + (p.name || username) + '!');
    try { window.Android?.setCurrentUser?.(username); } catch(_) {}
  } else {
    profileInitLoginScreen();
    showScreen('s-login');
    loginShowAuth(username);
    toast('\u{1F511} \u0412\u0432\u0435\u0434\u0438 \u043F\u0430\u0440\u043E\u043B\u044C \u0434\u043B\u044F @' + username);
  }
}

function accountSwitcherAddNew() {
  const cur = profileLoad();
  if (cur) { profileDisconnect(); localStorage.removeItem(PROFILE_KEY); updateNavProfileIcon(null); }
  profileInitLoginScreen();
  showScreen('s-login');
  toast('\u{1F464} \u0412\u043E\u0439\u0434\u0438 \u0438\u043B\u0438 \u0441\u043E\u0437\u0434\u0430\u0439 \u043D\u043E\u0432\u044B\u0439 \u0430\u043A\u043A\u0430\u0443\u043D\u0442');
}

// ┄┄ Фоновый сервис: управление и UI ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄

function _bgServiceUpdateUI() {
  const toggle = document.getElementById('bg-service-toggle');
  const knob   = document.getElementById('bg-service-knob');
  const status = document.getElementById('bg-service-status');
  if (!toggle) return;

  const enabled = window.Android && typeof Android.isBackgroundServiceEnabled === 'function'
    ? Android.isBackgroundServiceEnabled()
    : false;

  toggle.style.background = enabled ? 'var(--accent)' : '#ccc';
  if (knob) knob.style.left = enabled ? '22px' : '2px';
  if (status) status.textContent = enabled
    ? '🟢 Работает   сообщения приходят в фоне'
    : '🔴 Выключено';
}

function toggleBackgroundService() {
  if (!window.Android) { toast('⚠️ Доступно только в приложении'); return; }
  const enabled = typeof Android.isBackgroundServiceEnabled === 'function'
    ? Android.isBackgroundServiceEnabled() : false;

  if (enabled) {
    if (typeof Android.stopBackgroundService === 'function') Android.stopBackgroundService();
    toast('🔴 Фоновое соединение отключено');
  } else {
    if (typeof Android.startBackgroundService === 'function') Android.startBackgroundService();
    toast('🟢 Фоновое соединение включено');
  }
  setTimeout(_bgServiceUpdateUI, 300);
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ┄┄ profileInitEditScreen полностью переписан   без monkey-patch ┄┄
// Вызывается из кнопки "Изменить" вверху профиля через profileToggleEdit()
function profileInitEditScreen() {
  const p = profileLoad();
  if (!p) return;
  const isVip = typeof vipCheck === 'function' ? vipCheck() : false;

  // ┄┄ Основные поля ┄┄
  const nameEl = document.getElementById('edit-name');
  const unEl   = document.getElementById('edit-username');
  const bioEl  = document.getElementById('edit-bio');
  if (nameEl) nameEl.value = p.name || '';
  if (unEl)   unEl.value   = p.username || '';
  if (bioEl) {
    bioEl.value = p.bio || '';
    bioEl.oninput = () => {
      const cnt = document.getElementById('edit-bio-count');
      if (cnt) cnt.textContent = bioEl.value.length;
    };
    const cnt = document.getElementById('edit-bio-count');
    if (cnt) cnt.textContent = (p.bio||'').length;
  }

  // ┄┄ Аватар превью ┄┄
  _editSelectedEmoji  = p.avatar || '😊';
  _editSelectedColor  = p.color  || PROFILE_COLORS[0];
  _editSelectedStatus = p.status || 'online';
  _profileAvatarMode  = p.avatarType === 'photo' ? 'photo' : 'emoji';

  const inner   = document.getElementById('edit-avatar-inner');
  const preview = document.getElementById('edit-avatar-preview');
  if (preview) preview.style.borderColor = p.color || 'var(--accent)';
  if (inner) {
    if (p.avatarType === 'photo' && p.avatarData) {
      inner.innerHTML = `<img src="${p.avatarData}" style="width:96px;height:96px;object-fit:cover;border-radius:50%">`;
    } else {
      inner.textContent = p.avatar || '😊';
    }
  }

  // ┄┄ Эмодзи-пикер (только ввод с клавиатуры) ┄┄
  // Grid removed - emoji selected via keyboard input only
  const custIn = document.getElementById('edit-custom-emoji-input');
  const custPrev = document.getElementById('edit-custom-emoji-preview');
  const custErr = document.getElementById('edit-custom-emoji-error');
  // If current emoji is not in preset list, show it in custom input
  const isPreset = AVATAR_EMOJIS.includes(_editSelectedEmoji);
  if (custIn) {
    custIn.value = isPreset ? '' : _editSelectedEmoji;
    custIn.style.borderColor = (!isPreset && _editSelectedEmoji) ? 'var(--accent)' : 'var(--surface3)';
  }
  if (custPrev) custPrev.textContent = isPreset ? _editSelectedEmoji : _editSelectedEmoji;
  if (custErr) custErr.textContent = '';

  // ┄┄ Статусы ┄┄
  const statusPicker = document.getElementById('edit-status-picker');
  if (statusPicker) {
    statusPicker.innerHTML = '';
    PROFILE_STATUSES.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'status-chip' + (s.id === _editSelectedStatus ? ' selected' : '');
      btn.style.background = s.id === _editSelectedStatus ? s.color + '22' : 'var(--surface2)';
      btn.style.color = s.color;
      btn.innerHTML = `${typeof _emojiImg==='function' ? _emojiImg(s.emoji,14) : s.emoji} ${s.label}`;
      btn.onclick = () => {
        _editSelectedStatus = s.id;
        statusPicker.querySelectorAll('.status-chip').forEach(c => {
          c.classList.remove('selected'); c.style.background = 'var(--surface2)';
        });
        btn.classList.add('selected');
        btn.style.background = s.color + '22';
      };
      statusPicker.appendChild(btn);
    });
  }

  // ┄┄ Цвета ┄┄
  const colorPicker = document.getElementById('edit-color-picker');
  if (colorPicker) {
    colorPicker.innerHTML = '';
    PROFILE_COLORS.forEach(c => {
      const dot = document.createElement('div');
      dot.className = 'color-dot' + (c === _editSelectedColor ? ' selected' : '');
      dot.style.background = c;
      dot.onclick = () => {
        _editSelectedColor = c;
        colorPicker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
        dot.classList.add('selected');
        if (preview) preview.style.borderColor = c;
      };
      colorPicker.appendChild(dot);
    });
  }

  // ┄┄ VIP-секции (значки, фото-аватар, фото-баннер) ┄┄
  document.getElementById('vip-edit-section')?.remove();

  const body = document.querySelector('#s-profile-edit .body');
  if (!body) return;

  const vipSec = document.createElement('div');
  vipSec.id = 'vip-edit-section';

  // Фото аватара (VIP)
  const photoRow = document.createElement('div');
  photoRow.innerHTML = `<div class="sep"></div>
    <div class="section-label" style="display:flex;align-items:center;gap:8px">
      📷 Фото аватара
      ${isVip
        ? '<span style="font-size:10px;color:#4caf7d;font-weight:700">✅ VIP</span>'
        : '<span style="font-size:10px;font-weight:800;background:linear-gradient(90deg,#f5c518,#e87722);color:#000;padding:2px 7px;border-radius:6px">VIP</span>'}
    </div>`;
  if (isVip) {
    const photoBtn = document.createElement('button');
    photoBtn.className = 'btn btn-surface';
    photoBtn.style.marginBottom = '12px';
    photoBtn.textContent = '📷 Выбрать фото из галереи';
    photoBtn.onclick = profilePickPhoto;
    photoRow.appendChild(photoBtn);
  } else {
    const lockNote = document.createElement('div');
    lockNote.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:12px;padding:10px;background:var(--surface2);border-radius:10px';
    lockNote.textContent = '🔒 Введи /vip КОД в CMD для активации';
    photoRow.appendChild(lockNote);
  }
  vipSec.appendChild(photoRow);

  // Значки
  const badgesDiv = document.createElement('div');
  badgesDiv.innerHTML = '<div class="section-label">🏷 Значок профиля</div>';
  const badgesWrap = document.createElement('div');
  badgesWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px';
  const noneBtn = document.createElement('button');
  noneBtn.className = 'btn btn-surface';
  noneBtn.style.cssText = `width:auto;padding:8px 14px;font-size:12px;${!p.badge ? 'color:var(--accent);' : ''}`;
  noneBtn.textContent = 'Нет';
  noneBtn.onclick = () => profileSetBadge(null);
  badgesWrap.appendChild(noneBtn);
  PROFILE_BADGES.forEach(b => {
    const locked = b.vip && !isVip;
    const sel = p.badge === b.id;
    const btn = document.createElement('button');
    btn.className = 'btn btn-surface';
    btn.style.cssText = `width:auto;padding:8px 14px;font-size:12px;color:${b.color};${sel ? `box-shadow:0 0 0 2px ${b.color};` : ''}${locked ? 'opacity:.45;' : ''}`;
    btn.innerHTML = (typeof _emojiImg==="function"?_emojiImg(b.emoji,14):b.emoji) + ' ' + b.label + (locked ? ' '+(typeof _emojiImg==="function"?_emojiImg("👑",12):"👑") : '');
    btn.onclick = locked ? () => toast('🔒 Только VIP') : () => profileSetBadge(b.id);
    badgesWrap.appendChild(btn);
  });
  badgesDiv.appendChild(badgesWrap);
  vipSec.appendChild(badgesDiv);

  // Баннер (только фото, только VIP)
  const bannersDiv = document.createElement('div');
  const bannerLabel = isVip
    ? '🎨 Баннер профиля'
    : '🎨 Баннер профиля <span style="font-size:10px;font-weight:800;background:linear-gradient(90deg,#f5c518,#e87722);color:#000;padding:2px 7px;border-radius:6px">VIP</span>';
  bannersDiv.innerHTML = `<div class="section-label">${bannerLabel}</div>`;
  if (isVip) {
    const uploadRow = document.createElement('div');
    uploadRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:16px';
    const hasPhotoBanner = p.banner && p.banner.startsWith('background:url(');
    uploadRow.innerHTML = `
      <label style="flex:1;display:flex;align-items:center;gap:10px;background:var(--surface2);border-radius:12px;padding:10px 14px;cursor:pointer;border:2px solid ${hasPhotoBanner ? 'var(--accent)' : 'var(--surface3)'}">
        <span style="font-size:18px">🖼</span>
        <span style="font-size:13px;color:${hasPhotoBanner ? 'var(--accent)' : 'var(--muted)'};">${hasPhotoBanner ? 'Фото-баннер установлен' : 'Загрузить фото как баннер'}</span>
        <input type="file" accept="image/*" style="display:none" onchange="profileUploadPhotoBanner(this)">
      </label>
      ${hasPhotoBanner ? '<button class="btn btn-surface" style="width:auto;padding:8px 14px;font-size:12px;flex-shrink:0" onclick="profileClearBanner()">✕ Убрать</button>' : ''}
    `;
    bannersDiv.appendChild(uploadRow);
  } else {
    const lockBanner = document.createElement('div');
    lockBanner.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:16px;padding:10px;background:var(--surface2);border-radius:10px';
    lockBanner.textContent = '🔒 Фото-баннер доступен только для VIP';
    bannersDiv.appendChild(lockBanner);
  }
  vipSec.appendChild(bannersDiv);

  // VIP промо-блок если не VIP
  if (!isVip) {
    const promo = document.createElement('div');
    promo.innerHTML = `
      <div class="sep"></div>
      <div style="background:linear-gradient(135deg,#f5c51822,#e8772222);border:1px solid #f5c51844;border-radius:14px;padding:16px;text-align:center;margin-bottom:12px">
        <div style="font-size:24px;margin-bottom:6px">${typeof _emojiImg==="function"?_emojiImg("👑",24):"👑"}</div>
        <div style="font-weight:800;margin-bottom:4px">VIP Аккаунт</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Фото-аватар · значки · фото-баннер</div>
        <div style="font-size:11px;color:var(--muted)">Перейди в <b>Настройки</b> → Получить VIP</div>
      </div>
    `;
    vipSec.appendChild(promo);
  }

  // Вставить перед кнопкой "Выйти"
  const logoutBtn = body.querySelector('button[onclick*="profileLogout"]') || body.lastElementChild;
  body.insertBefore(vipSec, logoutBtn);
}

function profileToggleEdit() {
  profileInitEditScreen();
  showScreen('s-profile-edit');
}

function profileCheckUsername(val) {
  const status = document.getElementById('edit-username-status');
  if (!status) return;
  const clean = val.replace(/[^a-zA-Z0-9_]/g, '');
  const el = document.getElementById('edit-username');
  if (el) el.value = clean;
  if (clean.length < 3) {
    status.textContent = 'Минимум 3 символа'; status.style.color = 'var(--danger,#c94f4f)';
  } else {
    status.textContent = '✅ Ок'; status.style.color = '#4caf7d';
  }
}

let _editSelectedEmoji = '😊', _editSelectedColor = PROFILE_COLORS[0], _editSelectedStatus = 'online';
let _profileAvatarMode = 'emoji';
let _profileWaitingForPhoto = false;

function profilePickAvatarType() {
  const pickerEl = document.getElementById('edit-avatar-emoji-picker');
  if (!pickerEl) return;
  if (pickerEl.style.display === 'none') {
    pickerEl.style.display = '';
  } else {
    pickerEl.style.display = 'none';
  }
}

// ══ IMAGE CROP ENGINE ════════════════════════════════════════════
// openImageCrop(dataUrl, options)
//   options.mode  : 'avatar' | 'banner'
//   options.onDone: function(croppedDataUrl)
const _cropState = {};

function openImageCrop(dataUrl, options) {
  const mode    = options.mode  || 'avatar';
  const onDone  = options.onDone || (() => {});
  const isAvatar = mode === 'avatar';

  // Viewport size
  const vw = Math.min(window.innerWidth, 420);
  const cropW = isAvatar ? Math.min(vw - 48, 280) : Math.min(vw - 32, 360);
  const cropH = isAvatar ? cropW : Math.round(cropW * 300 / 800);

  // Remove any existing crop overlay
  document.getElementById('img-crop-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'img-crop-overlay';
  overlay.className = 'img-crop-overlay';

  overlay.innerHTML = `
    <div style="color:#fff;font-size:15px;font-weight:700;margin-bottom:12px">
      ${isAvatar ? '✂️ Кадрировать аватар' : '🖼 Кадрировать баннер'}
    </div>
    <div class="img-crop-container${isAvatar ? ' round' : ''}" id="crop-box"
         style="width:${cropW}px;height:${cropH}px">
      <img id="crop-img" class="img-crop-img" draggable="false">
      <div class="img-crop-guide"></div>
    </div>
    <div class="img-crop-hint">Перетащи пальцем · Масштаб ниже</div>
    <div class="img-crop-controls">
      <label>⏱</label>
      <input type="range" id="crop-zoom" min="100" max="400" value="100" step="1">
      <label>+</label>
    </div>
    <div class="img-crop-actions">
      <button class="btn btn-surface" onclick="closeCrop()">Отмена</button>
      <button class="btn" style="background:var(--accent);color:var(--btn-text,#fff)" onclick="applyCrop()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:5px"><polyline points="20 6 9 17 4 12"/></svg> Применить</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const imgEl   = document.getElementById('crop-img');
  const zoomEl  = document.getElementById('crop-zoom');
  const cropBox = document.getElementById('crop-box');

  const st = _cropState;
  st.x = 0; st.y = 0; st.scale = 1;
  st.dragging = false; st.lastX = 0; st.lastY = 0;
  st.cropW = cropW; st.cropH = cropH;
  st.isAvatar = isAvatar;
  st.onDone = onDone;
  st.rawSrc = dataUrl;

  // Load image and centre it
  const tmpImg = new Image();
  tmpImg.onload = () => {
    st.natW = tmpImg.naturalWidth;
    st.natH = tmpImg.naturalHeight;
    // Initial scale: fit so shorter side fills the crop box
    const fitScale = Math.max(cropW / st.natW, cropH / st.natH);
    st.minScale = fitScale;
    st.scale = fitScale;
    zoomEl.min  = Math.round(fitScale * 100);
    zoomEl.max  = Math.round(fitScale * 400);
    zoomEl.value = Math.round(fitScale * 100);
    _cropApplyTransform();
    imgEl.src = dataUrl;
  };
  tmpImg.src = dataUrl;

  // ┄┄ Drag через Pointer Events (надёжно на Android WebView) ┄┄┄┄┄┄┄
  // setPointerCapture гарантирует, что все события идут сюда,
  // даже если палец вышел за пределы cropBox. Надёжнее touchmove на window.
  function onPointerDown(e) {
    e.preventDefault();
    if (e.pointerType === 'touch' || e.pointerType === 'mouse' || e.pointerType === 'pen') {
      // Захватываем этот pointer — все последующие move/up придут на cropBox
      try { cropBox.setPointerCapture(e.pointerId); } catch(_) {}
    }
    st.dragging = true;
    st.lastX = e.clientX; st.lastY = e.clientY;
    // Pinch: отслеживаем второй pointer отдельно
    if (!st._activePointers) st._activePointers = {};
    st._activePointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    const ptrs = Object.values(st._activePointers);
    if (ptrs.length === 2) {
      const dx = ptrs[0].x - ptrs[1].x, dy = ptrs[0].y - ptrs[1].y;
      st.pinching = true;
      st.pinchDist = Math.sqrt(dx*dx + dy*dy);
      st.pinchScale = st.scale;
    }
  }
  function onPointerMove(e) {
    e.preventDefault();
    if (!st.dragging) return;
    if (!st._activePointers) st._activePointers = {};
    st._activePointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    const ptrs = Object.values(st._activePointers);
    if (ptrs.length === 2 && st.pinching) {
      const dx = ptrs[0].x - ptrs[1].x, dy = ptrs[0].y - ptrs[1].y;
      const d = Math.sqrt(dx*dx + dy*dy);
      const newScale = Math.max(st.minScale, Math.min(st.minScale * 4, st.pinchScale * d / st.pinchDist));
      st.scale = newScale;
      zoomEl.value = Math.round(newScale * 100);
      _cropClamp();
      _cropApplyTransform();
      return;
    }
    st.pinching = false;
    st.x += e.clientX - st.lastX;
    st.y += e.clientY - st.lastY;
    st.lastX = e.clientX; st.lastY = e.clientY;
    _cropClamp();
    _cropApplyTransform();
  }
  function onPointerUp(e) {
    if (st._activePointers) delete st._activePointers[e.pointerId];
    if (!st._activePointers || Object.keys(st._activePointers).length === 0) {
      st.dragging = false; st.pinching = false;
    }
  }

  cropBox.style.touchAction = 'none'; // дублируем CSS на случай если WebView игнорирует стиль
  cropBox.addEventListener('pointerdown', onPointerDown);
  cropBox.addEventListener('pointermove', onPointerMove);
  cropBox.addEventListener('pointerup',   onPointerUp);
  cropBox.addEventListener('pointercancel', onPointerUp);
  st._cleanupListeners = () => {
    cropBox.removeEventListener('pointerdown',   onPointerDown);
    cropBox.removeEventListener('pointermove',   onPointerMove);
    cropBox.removeEventListener('pointerup',     onPointerUp);
    cropBox.removeEventListener('pointercancel', onPointerUp);
  };

  // ┄┄ Zoom slider ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  zoomEl.addEventListener('input', () => {
    st.scale = parseFloat(zoomEl.value) / 100;
    _cropClamp();
    _cropApplyTransform();
  });
}

function _pinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx*dx + dy*dy);
}

function _cropApplyTransform() {
  const imgEl = document.getElementById('crop-img');
  if (!imgEl) return;
  const st = _cropState;
  const w = st.natW * st.scale;
  const h = st.natH * st.scale;
  imgEl.style.width  = w + 'px';
  imgEl.style.height = h + 'px';
  imgEl.style.left   = st.x + 'px';
  imgEl.style.top    = st.y + 'px';
}

function _cropClamp() {
  const st = _cropState;
  const w = st.natW * st.scale;
  const h = st.natH * st.scale;
  // Don't let image leave the crop area
  st.x = Math.min(0, Math.max(st.cropW - w, st.x));
  st.y = Math.min(0, Math.max(st.cropH - h, st.y));
}

function closeCrop() {
  _cropState._cleanupListeners?.();
  document.getElementById('img-crop-overlay')?.remove();
}

function applyCrop() {
  const st = _cropState;
  const canvas = document.createElement('canvas');
  canvas.width  = st.cropW;
  canvas.height = st.cropH;
  const ctx = canvas.getContext('2d');
  if (st.isAvatar) {
    ctx.beginPath();
    ctx.arc(st.cropW/2, st.cropH/2, st.cropW/2, 0, Math.PI*2);
    ctx.clip();
  }
  const tmpImg = new Image();
  tmpImg.onload = () => {
    ctx.drawImage(tmpImg, st.x, st.y, st.natW * st.scale, st.natH * st.scale);
    const out = canvas.toDataURL('image/jpeg', 0.88);
    closeCrop();
    st.onDone(out);
  };
  tmpImg.src = st.rawSrc;
}
// ═════════════════════════════════════════════════════════════════

function profilePickPhoto() {
  // Кнопка «Выбрать фото» на главном экране профиля — только VIP
  const onEditScreen = document.getElementById('s-profile-edit')?.classList.contains('active');
  if (!onEditScreen && !vipCheck()) {
    toast('👑 Фото профиля — только для VIP');
    return;
  }

  // Показываем меню: фото или видео (видео — только VIP)
  const isVip = typeof vipCheck === 'function' ? vipCheck() : false;
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;padding:16px;animation:mcFadeIn .15s ease';
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px;width:100%;max-width:400px;overflow:hidden;animation:mcSlideUp .25s cubic-bezier(.34,1.26,.64,1)" onclick="event.stopPropagation()">
      <div style="padding:16px 20px 8px;font-size:13px;font-weight:700;color:var(--muted);text-align:center;text-transform:uppercase;letter-spacing:.5px">Аватарка профиля</div>
      <button onclick="this.closest('[style*=fixed]').remove();_profilePickPhotoOnly()" style="width:100%;padding:16px 20px;background:none;border:none;border-top:1px solid var(--surface3);color:var(--text);font-family:inherit;font-size:16px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:14px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--accent)"><path d="M9 3L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-3.17L15 3H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3z"/></svg>
        Выбрать фото
      </button>
      <button onclick="${isVip ? "this.closest('[style*=fixed]').remove();_profilePickVideoAvatar()" : "toast('👑 Видео-аватар — только для VIP')"}" style="width:100%;padding:16px 20px;background:none;border:none;border-top:1px solid var(--surface3);color:${isVip ? 'var(--text)' : 'var(--muted)'};font-family:inherit;font-size:16px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:14px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="${isVip ? 'var(--accent)' : 'var(--muted)'}"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
        Видео-аватар ${isVip ? '' : '<span style="margin-left:6px;font-size:10px;font-weight:800;background:linear-gradient(90deg,#f5c518,#e87722);color:#000;padding:2px 7px;border-radius:6px">VIP</span>'}
      </button>
      <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%;padding:14px 20px;background:none;border:none;border-top:1px solid var(--surface3);color:var(--muted);font-family:inherit;font-size:15px;cursor:pointer">Отмена</button>
    </div>`;
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
  document.body.appendChild(sheet);
}

// Выбрать только фото (без выбора типа)
function _profilePickPhotoOnly() {
  _profileWaitingForPhoto = true;
  if (window.Android && typeof Android.pickImageForBackground === 'function') {
    Android.pickImageForBackground();
  } else {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const file = inp.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = e => _profileHandleAvatarDataUrl(e.target.result);
      reader.readAsDataURL(file);
    };
    inp.click();
  }
}

// Выбрать видео для аватарки (только VIP)
function _profilePickVideoAvatar() {
  if (!vipCheck()) { toast('👑 Видео-аватар — только для VIP'); return; }
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'video/mp4,video/webm,video/mov,video/*';
  inp.onchange = () => {
    const file = inp.files?.[0]; if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('❌ Видео слишком большое (макс 20 МБ)'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      const p = profileLoad(); if (!p) return;
      p.avatarType  = 'video';
      p.avatarVideo = dataUrl;
      p.avatarData  = null; // фото убираем
      profileSave(p);
      updateNavProfileIcon(p);
      profileRenderScreen();
      sbPresencePut(p);
      toast('✅ Видео-аватар установлен');
    };
    reader.readAsDataURL(file);
  };
  inp.click();
}

function _profileHandleAvatarDataUrl(dataUrl) {
  _profileWaitingForPhoto = false;
  const onEditScreen = document.getElementById('s-profile-edit')?.classList.contains('active');
  openImageCrop(dataUrl, {
    mode: 'avatar',
    onDone: cropped => {
      _profileAvatarMode = 'photo';
      window._profileTempAvatarData = cropped;
      if (onEditScreen) {
        // Обновляем превью на экране редактирования
        const inner = document.getElementById('edit-avatar-inner');
        if (inner) inner.innerHTML = `<img src="${cropped}" style="width:96px;height:96px;object-fit:cover;border-radius:50%">`;
      } else {
        // Сохраняем сразу   пользователь нажал "Выбрать фото" с экрана профиля
        const p = profileLoad();
        if (!p) return;
        p.avatarType = 'photo';
        p.avatarData = cropped;
        profileSave(p);
        window._profileTempAvatarData = null;
        updateNavProfileIcon(p);
        profileRenderScreen();
        sbPresencePut(p);
        toast('✅ Фото обновлено');
      }
    }
  });
}

// Перехватываем onNativeBgImagePicked для профиля если ждём фото
const _origOnNativeBgImagePicked = window.onNativeBgImagePicked;
window.onNativeBgImagePicked = function(dataUrl) {
  if (_profileWaitingForPhoto) {
    _profileHandleAvatarDataUrl(dataUrl);
  } else {
    if (_origOnNativeBgImagePicked) _origOnNativeBgImagePicked(dataUrl);
  }
};

async function profileSaveEdit() {
  const p = profileLoad();
  if (!p) return;
  const name     = (document.getElementById('edit-name')?.value     || '').trim();
  const username = (document.getElementById('edit-username')?.value || '').trim().toLowerCase();
  const bio      = (document.getElementById('edit-bio')?.value      || '').trim();
  if (!name || username.length < 3) { toast('❌ Заполни имя и юзернейм'); return; }

  const oldUsername = p.username;
  const oldName     = p.name;
  const usernameChanged = (oldUsername !== username);
  const nameChanged     = (oldName     !== name);

  p.name     = name;
  p.username = username;
  p.bio      = bio;
  p.status   = _editSelectedStatus;
  p.color    = _editSelectedColor;
  if (_profileAvatarMode === 'photo') {
    p.avatarType = 'photo';
    if (window._profileTempAvatarData) {
      // Новое фото загружено — сохраняем его
      p.avatarData = window._profileTempAvatarData;
      window._profileTempAvatarData = null;
    }
    // Если нет нового фото — avatarData уже в p (из profileLoad), оставляем как есть
  } else {
    p.avatarType = 'emoji';
    p.avatar     = _editSelectedEmoji;
    delete p.avatarData;
  }

  // ┄┄ Миграция данных при смене username ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  if (usernameChanged) {
    toast('⏳ Переименовываем аккаунт...');

    // 1. accounts: переносим ключ
    const accounts = accountsLoad();
    if (accounts[oldUsername]) {
      accounts[username] = { ...accounts[oldUsername], name, avatar: p.avatar };
      delete accounts[oldUsername];
      accountsSave(accounts);
    }

    // 2. Локальные сообщения: обновляем поля from/to
    const msgs  = msgLoad();
    const newMsgs = {};
    Object.entries(msgs).forEach(([chatKey, arr]) => {
      newMsgs[chatKey] = arr.map(m => ({
        ...m,
        from: m.from === oldUsername ? username : m.from,
        to:   m.to   === oldUsername ? username : m.to,
      }));
    });
    msgSave(newMsgs);

    // 3. friends   не меняются (это список ДРУГИХ пользователей)

    // 4. Supabase: обновляем messages
    //    Для каждого чата: fetch ↩ delete old ↩ insert new с новыми ключами
    if (sbReady()) {
      const chats = chatsLoad();
      for (const otherUser of chats) {
        const oldKey = sbChatKey(oldUsername, otherUser);
        const newKey = sbChatKey(username,    otherUser);
        try {
          // Получаем все сообщения по старому ключу
          const rows = await sbGet('messages',
            `select=*&chat_key=eq.${encodeURIComponent(oldKey)}&order=ts.asc&limit=1000`);
          if (!Array.isArray(rows) || rows.length === 0) continue;

          // Удаляем старые
          await sbDelete('messages', `chat_key=eq.${encodeURIComponent(oldKey)}`);

          // Вставляем заново с новыми полями
          const updated = rows.map(r => ({
            chat_key:  newKey,
            from_user: r.from_user === oldUsername ? username : r.from_user,
            to_user:   r.to_user   === oldUsername ? username : r.to_user,
            text:      r.text,
            ts:        r.ts,
          }));
          // Вставляем батчем
          await fetch(`${sbUrl()}/rest/v1/messages`, {
            method: 'POST',
            headers: {
              apikey: sbKey(), Authorization: `Bearer ${sbKey()}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify(updated),
          });
        } catch(e) {}

        // Обновляем _fbLastMsgTs ключи
        if (_fbLastMsgTs[oldKey]) {
          _fbLastMsgTs[newKey] = _fbLastMsgTs[oldKey];
          delete _fbLastMsgTs[oldKey];
        }
      }

      // Суpabase presence: старая запись удалится через DELETE+INSERT в profileConnect
      await sbDelete('presence', `username=eq.${encodeURIComponent(oldUsername)}`);

      // leaderboard
      await fetch(`${sbUrl()}/rest/v1/leaderboard?username=eq.${encodeURIComponent(oldUsername)}`, {
        method: 'PATCH',
        headers: {
          apikey: sbKey(), Authorization: `Bearer ${sbKey()}`,
          'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ username }),
      }).catch(() => {});
    }

    // 5. Перезапускаем потоки с новыми chat_key
    Object.values(_fbMsgStreams).forEach(t => clearInterval(t));
    _fbMsgStreams = {};
  }

  // Если изменилось только имя   обновляем в presence через profileConnect
  profileSave(p);
  sbSaveUser(p); // синхронизируем полный профиль в облако
  profileConnect(p);
  updateNavProfileIcon(p);
  profileBroadcast({ type: 'profile_update', profile: profilePublicData(p) });

  showScreen('s-profile', 'back');
  setTimeout(profileRenderScreen, 100);
  toast(usernameChanged ? '✅ Юзернейм изменён   чаты сохранены' : '✅ Профиль сохранён');
}

async function profileDeleteAccount() {
  const p = profileLoad();
  if (!p) return;
  // Двойное подтверждение
  if (!confirm('Удалить аккаунт @' + p.username + '?\n\nЭто действие необратимо: профиль, все сообщения и данные будут удалены.')) return;
  if (!confirm('Точно удалить аккаунт @' + p.username + '? Отмены нет.')) return;

  toast('⏳ Удаляем аккаунт...');
  profileDisconnect();

  // 1. Supabase: удаляем presence
  if (sbReady()) {
    await sbDelete('presence', 'username=eq.' + encodeURIComponent(p.username));
    // 2. Supabase: удаляем все сообщения где участвует этот юзер
    await sbDelete('messages', 'from_user=eq.' + encodeURIComponent(p.username));
    await sbDelete('messages', 'to_user=eq.'   + encodeURIComponent(p.username));
    // 3. Supabase: удаляем из leaderboard
    await sbDelete('leaderboard', 'username=eq.' + encodeURIComponent(p.username));
  }

  // 4. Локальное хранилище: удаляем профиль из accounts
  const accounts = accountsLoad();
  delete accounts[p.username];
  accountsSave(accounts);

  // 5. Очищаем все личные данные
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(FRIENDS_KEY);
  localStorage.removeItem(_msgStoreKey());
  localStorage.removeItem(_msgChatsKey());
  // Also remove legacy shared keys in case they exist
  localStorage.removeItem(MSG_STORE_KEY_BASE);
  localStorage.removeItem(MSG_CHATS_KEY_BASE);

  updateNavProfileIcon(null);
  profileInitLoginScreen();
  showScreen('s-login');
  loginShowRegister();
  toast('✅ Аккаунт удалён');
}

function profileLogout() {
  if (!confirm('Выйти из аккаунта? Данные профиля останутся на устройстве')) return;
  const p = profileLoad();
  // Make sure pwdHash is saved in accounts before clearing profile
  if (p) {
    const accounts = accountsLoad();
    if (accounts[p.username]) {
      accounts[p.username].pwdHash = p.pwdHash;
      accounts[p.username].name = p.name;
      accounts[p.username].avatar = p.avatar;
      accountsSave(accounts);
    }
  }
  profileDisconnect();
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(GROUPS_KEY); // очищаем кэш групп — при следующем входе загрузим с сервера
  updateNavProfileIcon(null);
  profileInitLoginScreen();
  showScreen('s-login');
  // Открываем вкладку входа с предзаполненным юзернеймом
  if (p) loginShowAuth(p.username);
  toast('👋 До встречи!');
}

function profilePublicData(p) {
  return { name: p.name, username: p.username, avatar: p.avatar, avatarType: p.avatarType, status: p.status, color: p.color, bio: p.bio, vip: p.vip || false, badge: p.badge || null };
}

// ══════════════════════════════════════════════════════════════════
// ⚡ MULTI-STRATEGY P2P CONNECTION ENGINE
// ══════════════════════════════════════════════════════════════════
const SB_CONFIG_KEY  = 'sapp_supabase_config';
const SB_DEFAULT_URL = 'https://mjonazsosajvgevqllzs.supabase.co';
const SB_DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qb25henNvc2FqdmdldnFsbHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NjAwNDMsImV4cCI6MjA4OTIzNjA0M30.yUB_HRQSeh3TeOseZ4_ARNiBuklr5AoEbBgvJJl5p3Y';

function sbConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(SB_CONFIG_KEY) || 'null');
    return stored || { url: SB_DEFAULT_URL, key: SB_DEFAULT_KEY };
  } catch(e) { return { url: SB_DEFAULT_URL, key: SB_DEFAULT_KEY }; }
}
function sbUrl()  { return (sbConfig()?.url || SB_DEFAULT_URL).replace(/\/$/, ''); }
function sbKey()  { return sbConfig()?.key || SB_DEFAULT_KEY; }
function sbReady(){ return true; }

// ┄┄ Прямое подключение к Supabase (P2P удалён) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
async function _sbFetch(method, path, body, extraHeaders) {
  const url = `${sbUrl()}${path}`;
  const r = await fetch(url, {
    method,
    headers: { apikey: sbKey(), Authorization: `Bearer ${sbKey()}`, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  return { ok: r.ok, status: r.status, json: () => r.json(), text: () => r.text() };
}

// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
// 🔐 E2E ШИФРОВАНИЕ   ECDH + AES-GCM (WebCrypto API)
//
// Схема:
//     Каждый пользователь имеет пару ECDH ключей (P-256)
//     Публичный ключ хранится в Supabase users.pubkey (base64)
//     Приватный ключ   только в localStorage (никогда не уходит с устройства)
//     При отправке: ECDH shared secret ↩ HKDF ↩ AES-256-GCM
//     В Supabase хранится: зашифрованный текст + IV (оба base64, разделитель '.')
//     Формат в поле text: 'ENC:BASE64_IV.BASE64_CIPHERTEXT'
//     Если расшифровка не удалась   показывается '🔒 [зашифровано]'
// ══════════════════════════════════════════════════════════════════════════

const E2E_PRIVKEY_KEY = 'sapp_e2e_priv_v1'; // localStorage ключ
const E2E_PUBKEY_KEY  = 'sapp_e2e_pub_v1';
const E2E_PREFIX      = 'ENC:';

// Кэш: username ↩ CryptoKey (публичный ECDH)
const _e2ePeerPubKeys = {};
// Кэш: chatKey ↩ CryptoKey (AES-GCM, производный от ECDH shared secret)
const _e2eAesCache = {};

let _e2ePrivKey = null;  // CryptoKey   наш приватный ECDH
let _e2ePubKey  = null;  // CryptoKey   наш публичный ECDH
let _e2eEnabled = false;

// ┄┄ Инициализация: генерация или загрузка ключей ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
async function e2eInit() {
  try {
    // Пробуем localStorage, затем IndexedDB как резерв (переживает полную очистку)
    let storedPriv = localStorage.getItem(E2E_PRIVKEY_KEY);
    let storedPub  = localStorage.getItem(E2E_PUBKEY_KEY);

    if (!storedPriv || !storedPub) {
      // localStorage пуст — пробуем IndexedDB
      try {
        const idbPriv = await idbGet('e2e_priv_v1');
        const idbPub  = await idbGet('e2e_pub_v1');
        if (idbPriv && idbPub) {
          storedPriv = idbPriv;
          storedPub  = idbPub;
          // Восстанавливаем обратно в localStorage для быстрого доступа
          localStorage.setItem(E2E_PRIVKEY_KEY, storedPriv);
          localStorage.setItem(E2E_PUBKEY_KEY,  storedPub);
          console.log('[E2E] ключи восстановлены из IndexedDB');
        }
      } catch(_) {}
    }

    if (storedPriv && storedPub) {
      // Загружаем существующие ключи
      _e2ePrivKey = await crypto.subtle.importKey(
        'jwk', JSON.parse(storedPriv),
        { name: 'ECDH', namedCurve: 'P-256' },
        false, ['deriveKey', 'deriveBits']
      );
      _e2ePubKey = await crypto.subtle.importKey(
        'jwk', JSON.parse(storedPub),
        { name: 'ECDH', namedCurve: 'P-256' },
        true, []
      );
    } else {
      // Генерируем новую пару
      const pair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true, ['deriveKey', 'deriveBits']
      );
      _e2ePrivKey = pair.privateKey;
      _e2ePubKey  = pair.publicKey;
      // Сохраняем в оба хранилища
      const privJwk = await crypto.subtle.exportKey('jwk', _e2ePrivKey);
      const pubJwk  = await crypto.subtle.exportKey('jwk', _e2ePubKey);
      const privStr = JSON.stringify(privJwk);
      const pubStr  = JSON.stringify(pubJwk);
      localStorage.setItem(E2E_PRIVKEY_KEY, privStr);
      localStorage.setItem(E2E_PUBKEY_KEY,  pubStr);
      // IndexedDB — резервная копия, переживает localStorage.clear()
      idbSet('e2e_priv_v1', privStr).catch(()=>{});
      idbSet('e2e_pub_v1',  pubStr).catch(()=>{});
    }
    _e2eEnabled = true;
  } catch(e) {
    console.warn('[E2E] init failed:', e.message);
    _e2eEnabled = false;
  }
}

// ┄┄ Получить публичный ключ в виде base64 для отправки на сервер ┄┄┄┄┄┄┄┄┄┄
async function e2eGetMyPubKeyB64() {
  if (!_e2ePubKey) return null;
  try {
    const raw = await crypto.subtle.exportKey('raw', _e2ePubKey);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
  } catch(e) { return null; }
}

// ┄┄ Загрузить публичный ключ собеседника из Supabase ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
async function e2eLoadPeerKey(username) {
  if (_e2ePeerPubKeys[username]) return _e2ePeerPubKeys[username];
  try {
    const rows = await sbGet('users', `select=pubkey&username=eq.${encodeURIComponent(username)}&limit=1`);
    if (!Array.isArray(rows) || !rows[0]?.pubkey) return null;
    const raw = Uint8Array.from(atob(rows[0].pubkey), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw', raw,
      { name: 'ECDH', namedCurve: 'P-256' },
      false, []
    );
    _e2ePeerPubKeys[username] = key;
    return key;
  } catch(e) { return null; }
}

// ┄┄ Вывести AES ключ из ECDH shared secret (HKDF-SHA-256) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
async function e2eDeriveAES(peerPubKey) {
  const shared = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPubKey },
    _e2ePrivKey, 256
  );
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('ScheduleAppE2E') },
    await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']),
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

// ┄┄ Получить или кэшировать AES ключ для чата ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
async function e2eGetAES(otherUsername) {
  if (_e2eAesCache[otherUsername]) return _e2eAesCache[otherUsername];
  const peerKey = await e2eLoadPeerKey(otherUsername);
  if (!peerKey) return null;
  const aes = await e2eDeriveAES(peerKey);
  _e2eAesCache[otherUsername] = aes;
  return aes;
}

// ┄┄ Зашифровать текст ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
async function e2eEncrypt(text, otherUsername) {
  if (!_e2eEnabled || !text) return text;
  try {
    const aes = await e2eGetAES(otherUsername);
    if (!aes) return text; // нет ключа   шлём открыто
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aes, new TextEncoder().encode(text)
    );
    const ivB64  = btoa(String.fromCharCode(...iv));
    const encB64 = btoa(String.fromCharCode(...new Uint8Array(enc)));
    return E2E_PREFIX + ivB64 + '.' + encB64;
  } catch(e) {
    console.warn('[E2E] encrypt failed:', e.message);
    return text;
  }
}

// ┄┄ Расшифровать текст ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
async function e2eDecrypt(ciphertext, otherUsername) {
  if (!ciphertext || !ciphertext.startsWith(E2E_PREFIX)) return ciphertext;
  if (!_e2eEnabled) return '🔒 [зашифровано]';
  try {
    const payload = ciphertext.slice(E2E_PREFIX.length);
    const dotIdx  = payload.indexOf('.');
    if (dotIdx < 0) return '🔒 [зашифровано]';
    const iv  = Uint8Array.from(atob(payload.slice(0, dotIdx)), c => c.charCodeAt(0));
    const enc = Uint8Array.from(atob(payload.slice(dotIdx + 1)),  c => c.charCodeAt(0));
    const aes = await e2eGetAES(otherUsername);
    if (!aes) return '🔒 [зашифровано]';
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aes, enc);
    return new TextDecoder().decode(dec);
  } catch(e) {
    return '🔒 [зашифровано]';
  }
}

// ┄┄ Синхронизировать публичный ключ на сервер при входе ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
async function e2eSyncPubKey(username) {
  if (!_e2eEnabled || !username) return;
  try {
    const pubB64 = await e2eGetMyPubKeyB64();
    if (!pubB64) return;
    // Проверяем: нужно ли обновить
    const rows = await sbGet('users', `select=pubkey&username=eq.${encodeURIComponent(username)}&limit=1`);
    if (Array.isArray(rows) && rows[0]?.pubkey === pubB64) return; // уже актуальный
    await _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(username)}`,
      { pubkey: pubB64 },
      { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
    );
    console.log('[E2E] pubkey synced to server');
  } catch(e) {}
}

// ┄┄ Инициализация при старте ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
e2eInit().then(() => {
  console.log('[E2E] ready, enabled=' + _e2eEnabled);
});

// 📭 OFFLINE QUEUE   Telegram-style отложенная отправка
// Сообщение сохраняется локально с pending:true, отправляется при появлении сети
// ══════════════════════════════════════════════════════════════════════════

const OUTBOX_KEY = 'sapp_outbox_v2';

function outboxLoad()    { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY)||'[]'); } catch(e) { return []; } }
function outboxSave(q)   { localStorage.setItem(OUTBOX_KEY, JSON.stringify(q)); }

// Добавляет запись в очередь. item = { id, chatKey, fromUser, toUser, data, ts, type }
function outboxPush(item) {
  const q = outboxLoad();
  // Дедупликация по ts (на случай двойного вызова)
  if (!q.find(x => x.id === item.id)) { q.push(item); outboxSave(q); }
}

// Удаляет из очереди по id
function outboxRemove(id) {
  outboxSave(outboxLoad().filter(x => x.id !== id));
}

// ┄┄ Проверка сети ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
let _netOnline = navigator.onLine !== false; // оптимистично true если API нет

async function _checkOnline() {
  if (!navigator.onLine) return false;
  try {
    // Лёгкий HEAD-запрос к Supabase
    const r = await fetch(`${sbUrl()}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: sbKey() },
      signal: AbortSignal.timeout(3500)
    });
    return r.ok || r.status < 500;
  } catch(e) { return false; }
}

// ┄┄ Сброс очереди (вызывается при восстановлении сети) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
let _outboxFlushing = false;

async function outboxFlush() {
  if (_outboxFlushing) return;
  const q = outboxLoad();
  if (!q.length) return;

  const online = await _checkOnline();
  if (!online) return;

  _outboxFlushing = true;
  try {
    for (const item of [...q]) {
      try {
        let ok = false;
        if (item.type === 'message') {
          const res = await sbInsert('messages', item.data);
          ok = !!res;
        } else if (item.type === 'media') {
          // Медиа уже загружено на catbox (URL есть), просто шлём запись
          const res = await sbInsert('messages', item.data);
          ok = !!res;
        }
        if (ok) {
          outboxRemove(item.id);
          // Помечаем локальное сообщение как доставленное
          const msgs = msgLoad();
          const chat = msgs[item.localChat];
          if (chat) {
            const m = chat.find(x => x.ts === item.ts);
            if (m) { m.delivered = true; m.pending = false; msgSave(msgs); }
          }
        }
      } catch(e) { /* оставляем в очереди, попробуем позже */ }
    }
    // Если очередь опустела   обновляем UI
    if (!outboxLoad().length) {
      messengerRenderMessages && messengerRenderMessages();
    }
  } finally {
    _outboxFlushing = false;
  }
}

// ┄┄ Слушатели сети ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
window.addEventListener('online', () => {
  _netOnline = true;
  setTimeout(outboxFlush, 600);
  // Переподключаемся к Supabase при появлении сети (как Telegram)
  setTimeout(() => {
    const p = profileLoad();
    if (p && sbReady() && !_profilePeerReady) {
      console.log('[NET] Сеть появилась — переподключаюсь');
      profileConnect(p);
    } else if (p && sbReady() && _profilePeerReady) {
      // Уже подключены — просто форс-тик для быстрой доставки
      if (typeof window._javaTick === 'function') window._javaTick();
    }
  }, 1000);
});
window.addEventListener('offline', () => { _netOnline = false; });

// Также пытаемся сбрасывать очередь каждые 12 секунд пока есть pending
setInterval(() => {
  if (outboxLoad().length > 0) outboxFlush();
}, 12000);

// ┄┄ Кнопка показа статуса очереди (появляется когда есть pending) ┄┄┄┄┄┄┄┄
function _outboxUpdateStatusBar() {
  const q = outboxLoad();
  let bar = document.getElementById('mc-offline-bar');
  if (!q.length) { bar?.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'mc-offline-bar';
    bar.style.cssText = [
      'position:fixed;top:calc(var(--safe-top,0px) + 56px);left:0;right:0;',
      'z-index:9100;background:rgba(239,172,52,.92);',
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
      'padding:7px 16px;display:flex;align-items:center;gap:8px;',
      'font-size:12px;font-weight:600;color:#000;',
      'animation:tg-upload-in .22s ease both;',
      'cursor:pointer;'
    ].join('');
    bar.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0">
        <path d="M1 9l2 2c2.88-2.88 6.79-4.08 10.53-3.62l1.19-1.19C9.89 5.6 4.91 7.12 1 9zm18.28-.29C17.38 6.27 14.79 5 12 5c-1.28 0-2.5.26-3.62.69L10.1 7.4C10.72 7.15 11.34 7 12 7c2.17 0 4.17.86 5.65 2.35l1.63-1.64zM12 11c-.96 0-1.84.38-2.5.99l2.5 2.5 2.5-2.5C13.84 11.38 12.96 11 12 11zm0 11l-6-6h4V4h4v12h4l-6 6z"/>
      </svg>
      <span id="mc-offline-text">Нет сети · ${q.length} ${q.length===1?'сообщение':q.length<5?'сообщения':'сообщений'} в очереди</span>
      <span style="margin-left:auto;opacity:.7;font-size:11px">Нажми для повтора</span>
    `;
    bar.addEventListener('click', () => outboxFlush().then(_outboxUpdateStatusBar));
    // Вставляем под шапкой чата
    const chatScreen = document.getElementById('s-messenger-chat');
    if (chatScreen) chatScreen.appendChild(bar);
    else document.body.appendChild(bar);
  } else {
    const txt = document.getElementById('mc-offline-text');
    if (txt) txt.textContent = `Нет сети · ${q.length} ${q.length===1?'сообщение':q.length<5?'сообщения':'сообщений'} в очереди`;
  }
}

// Заглушки для совместимости с кодом который вызывает эти функции
function p2pActiveStrategy() { return { id:'direct', label:'Прямое', emoji:'🔗' }; }
function p2pIsDisabled()     { return false; }
function p2pStartHealthCheck() {}
function p2pStopHealthCheck()  {}

// ┄┄ Supabase REST helpers ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
async function sbGet(table, query = '') {
  if (!sbReady()) return null;
  try {
    const r = await _sbFetch('GET', `/rest/v1/${table}?${query}`, null, {});
    if (!r.ok && r.status !== 200) return null;
    _lastSuccessfulPoll = Date.now(); // watchdog: соединение живо
    return await r.json();
  } catch(e) { return null; }
}

async function sbUpsert(table, data) {
  if (!sbReady()) return false;
  try {
    const r = await _sbFetch('POST', `/rest/v1/${table}`, data, {
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    });
    return r.ok;
  } catch(e) { return false; }
}

async function sbInsert(table, data) {
  if (!sbReady()) return null;
  try {
    const r = await _sbFetch('POST', `/rest/v1/${table}`, data, {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    });
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { return null; }
}

async function sbDelete(table, query) {
  if (!sbReady()) return;
  try {
    await _sbFetch('DELETE', `/rest/v1/${table}?${query}`, null, {});
  } catch(e) {}
}

// ┄┄ Инициализация при старте ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// Запускается в фоне   НЕ блокирует старт приложения

function supabaseSaveConfig() {
  const url = document.getElementById('sb-url-input')?.value?.trim();
  const key = document.getElementById('sb-key-input')?.value?.trim();
  const st  = document.getElementById('sb-status');
  if (!url || !key) { if(st) st.textContent = '❌ Заполни оба поля'; return; }
  localStorage.setItem(SB_CONFIG_KEY, JSON.stringify({ url, key }));
  if(st) st.textContent = '⏳ Проверяем подключение...';
  sbTestConnection().then(ok => {
    if(st) st.textContent = ok ? '🟢 Подключено!' : '🔴 Ошибка   проверь URL и ключ';
    if(ok) { toast('✅ Supabase подключён!'); profileConnect(profileLoad()); }
  });
}

async function sbTestConnection() {
  try {
    const r = await _sbFetch('GET', `/rest/v1/presence?select=username&limit=1`, null, {});
    return r.ok || r.status === 404;
  } catch(e) { return false; }
}

function sbFillSettings() {
  const c = sbConfig();
  const urlEl = document.getElementById('sb-url-input');
  const keyEl = document.getElementById('sb-key-input');
  if (urlEl && c?.url) urlEl.value = c.url;
  if (keyEl && c?.key) keyEl.value = c.key;
  if (c && document.getElementById('sb-status'))
    document.getElementById('sb-status').textContent = sbReady() ? '🟢 Настроено' : '';
}

// Устаревший sbStream (заглушка)
function sbStream(table, query, onData) { return null; }

// ┄┄ Переменные состояния ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
let _profileOnlinePeers  = [];
let _allKnownUsers       = [];
let _profilePeerReady    = false;
let _sbPresenceTimer     = null;
let _fbPollTimer         = null;
let _fbMsgStreams         = {};
let _fbLastMsgTs         = {};
let _connectSessionId    = 0;
let _fbInboxTimer        = null;
// _fbInboxLastTs сохраняется в localStorage чтобы не сбрасываться при перезапуске
const INBOX_TS_KEY = 'sapp_inbox_last_ts';
function _inboxTsLoad() {
  try { return parseInt(localStorage.getItem(INBOX_TS_KEY) || '0') || 0; } catch(e) { return 0; }
}
function _inboxTsSave(ts) {
  try { localStorage.setItem(INBOX_TS_KEY, String(ts)); } catch(e) {}
  // Дублируем в IndexedDB — переживает полную очистку localStorage
  if (typeof idbSet === 'function') idbSet('inbox_last_ts', String(ts)).catch(()=>{});
}
// Восстанавливает lastTs из IndexedDB если localStorage был очищен
// Вызывается при входе/connect, предотвращает повторное получение старых сообщений
async function _inboxTsRecover() {
  if (_fbInboxLastTs > 0) return; // уже есть — не нужно
  try {
    if (typeof idbGet !== 'function') return;
    const cached = await idbGet('inbox_last_ts');
    if (cached) {
      const ts = parseInt(cached) || 0;
      if (ts > 0) {
        _fbInboxLastTs = ts;
        localStorage.setItem(INBOX_TS_KEY, String(ts));
        console.log('[INBOX] lastTs восстановлен из IndexedDB:', ts);
      }
    }
  } catch(e) {}
}
let _fbInboxLastTs = _inboxTsLoad();
let _superPoller         = null; // единый таймер вместо всех отдельных
// ┄┄ Watchdog: следит что соединение реально живо ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
let _watchdogTimer      = null;
let _lastSuccessfulPoll = 0;     // ts последнего успешного запроса к Supabase
const WATCHDOG_INTERVAL = 30000; // проверяем каждые 30 сек
const WATCHDOG_TIMEOUT  = 75000; // если > 75 сек без ответа   переподключаемся

// ┄┄ Watchdog: детектирует смерть соединения и переподключается ┄┄┄┄┄┄
function _startWatchdog(p) {
  clearInterval(_watchdogTimer);
  _lastSuccessfulPoll = Date.now();
  _watchdogTimer = setInterval(() => {
    if (!_profilePeerReady) return; // уже переподключаемся
    const silent = Date.now() - _lastSuccessfulPoll;
    if (silent > WATCHDOG_TIMEOUT) {
      console.warn('[Watchdog] Нет ответа ' + Math.round(silent/1000) + 'с   переподключаюсь');
      profileConnect(p);
    }
  }, WATCHDOG_INTERVAL);
}

// ┄┄ Инициализируем таблицы Supabase при первом подключении ┄┄┄┄┄┄┄┄
async function sbInitTables() {
  if (!sbReady()) return;
}

// ┄┄ Подключение ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// ┄┄ Сохранение/загрузка полного профиля в таблице users ┄┄┄┄┄┄┄┄┄
async function sbSaveUser(p) {
  if (!sbReady() || !p) return;
  const payload = {
    username:    p.username,
    name:        p.name,
    pwd_hash:    p.pwdHash    || null,
    avatar:      p.avatar     || '😊',
    avatar_type: p.avatarType || 'emoji',
    avatar_data: p.avatarData || null,
    bio:         p.bio        || '',
    status:      p.status     || 'online',
    color:       p.color      || '#e87722',
    vip:         p.vip        || false,
    badge:       p.badge      || null,
    frame:       p.frame      || null,
    banner:      p.banner     || null,
    created_at:  p.createdAt  || Date.now(),
  };
  try {
    await _sbFetch('POST', '/rest/v1/users', payload, {
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    });
  } catch(e) {}
}

async function sbLoadUser(username) {
  if (!sbReady()) return null;
  try {
    const rows = await sbGet('users', `select=*&username=eq.${encodeURIComponent(username)}&limit=1`);
    if (Array.isArray(rows) && rows.length > 0) return rows[0];
  } catch(e) {}
  return null;
}

// Хелпер: ждать N миллисекунд с проверкой sessionId   прерывается если пришёл новый connect
function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function _delayOrCancel(ms, sessionId) {
  await _delay(ms);
  return sessionId === _connectSessionId; // false = сессия устарела, нужно выйти
}

// Хелпер: лог и в файл и в UI статус
function _connectLog(msg) {
  profileUpdateP2PStatus(msg);
  if (window.Android && typeof Android.log === 'function') {
    Android.log('[CONNECT] ' + msg);
  }
}

async function profileConnect(p) {
  if (!p) return;

  _presenceFirstPut = true;
  const sessionId = ++_connectSessionId;

  clearInterval(_sbPresenceTimer); _sbPresenceTimer = null;
  clearInterval(_fbPollTimer);     _fbPollTimer = null;
  clearInterval(_fbInboxTimer);    _fbInboxTimer = null;
  clearInterval(_watchdogTimer);   _watchdogTimer = null;
  clearInterval(_superPoller);     _superPoller = null;
  p2pStopHealthCheck();
  Object.values(_fbMsgStreams).forEach(t => clearInterval(t));
  _fbMsgStreams = {};
  _profilePeerReady = false;

  if (!sbReady()) {
    profileUpdateP2PStatus('⚙️ Supabase не настроен');
    return;
  }

  profileUpdateP2PStatus('⏳ Подключаюсь...');
  try {
    await sbPresencePut(p);
    if (sessionId !== _connectSessionId) return;

    _profilePeerReady = true;
    profileUpdateP2PStatus('🟢 @' + p.username + ' · 🔗 Прямое');

    if (!_fbInboxLastTs) {
      await _inboxTsRecover(); // восстанавливаем из IndexedDB если localStorage пуст
      _fbInboxLastTs = _fbInboxLastTs || _inboxTsLoad() || (Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    await sbPollPresence();
    if (sessionId !== _connectSessionId) return;

    // Проверяем пропущенные сообщения
    try {
      const data = await sbGet('messages',
        `select=*&to_user=eq.${encodeURIComponent(p.username)}&ts=gt.${_fbInboxLastTs}&order=ts.asc&limit=100`
      );
      if (Array.isArray(data) && data.length > 0) {
        if (window.Android && typeof Android.log === 'function')
          Android.log('[CONNECT] нашёл ' + data.length + ' пропущенных сообщений');
        const bySender = {};
        data.forEach(msg => {
          if (!bySender[msg.from_user]) bySender[msg.from_user] = [];
          bySender[msg.from_user].push(msg);
          _fbInboxLastTs = Math.max(_fbInboxLastTs, msg.ts); _inboxTsSave(_fbInboxLastTs);
        });
        Object.entries(bySender).forEach(([sender, msgs]) => {
          sbHandleIncomingMessages(p.username, sender, msgs);
        });
      }
    } catch(e) {}
    if (sessionId !== _connectSessionId) return;

    _startWatchdog(p);
    if (window.Android && typeof window.Android.savePushConfig === 'function') {
      try { window.Android.savePushConfig(p.username, sbUrl(), sbKey()); } catch(_){}
    }
    // Синхронизируем VIP/badge/frame с сервера (server source of truth)
    vipSyncFromServer(p.username).catch(()=>{});
    // Синхронизируем публичный E2E ключ на сервер
    e2eSyncPubKey(p.username).catch(()=>{});
    // Сбрасываем очередь отложенных сообщений (появился интернет)
    if (outboxLoad().length > 0) {
      outboxFlush().then(_outboxUpdateStatusBar).catch(()=>{});
    }
    // Синхронизируем друзей и группы с сервера
    syncFriendsFromServer(p.username).catch(()=>{});
    syncGroupsFromServer(p.username).catch(()=>{});
    sbStartGroupPolling(p.username);
    // Подтягиваем список чатов и последние сообщения
    syncDeletedChatsFromServer(p.username).catch(()=>{});
    syncChatsFromServer(p.username).catch(()=>{});
  } catch(e) {
    if (sessionId === _connectSessionId) {
      profileUpdateP2PStatus('🔴 Ошибка подключения   повтор через 5с');
      setTimeout(() => { if (sessionId === _connectSessionId) profileConnect(p); }, 5000);
    }
  }
}

let _visibilityDebounce = null;
let _lastVisibleTs = Date.now();
let _lastHiddenTs  = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    _lastHiddenTs = Date.now();
    if (window.Android && typeof Android.log === 'function') {
      Android.log('[VIS] Приложение ушло в фон ts=' + _lastHiddenTs);
    }
    return;
  }
  clearTimeout(_visibilityDebounce);
  _visibilityDebounce = setTimeout(() => {
    const p = profileLoad();
    if (!p || !sbReady()) return;
    const hiddenMs = Date.now() - (_lastHiddenTs || 0);
    _lastSuccessfulPoll = Date.now();
    if (window.Android && typeof Android.log === 'function') {
      Android.log('[VIS] Вернулся на экран, был в фоне ' + Math.round(hiddenMs/1000) + 'с superPoller=' + (!!_superPoller) + ' peerReady=' + _profilePeerReady);
    }
    if (hiddenMs > 30000 || !_profilePeerReady) {
      if (window.Android && typeof Android.log === 'function') {
        Android.log('[CONNECT] Запускаю полный profileConnect (был в фоне ' + Math.round(hiddenMs/1000) + 'с)');
      }
      profileConnect(p);
    } else {
      // Были в фоне мало   Java Handler уже опрашивает, просто форс-тик
      if (window.Android && typeof Android.log === 'function') {
        Android.log('[CONNECT] Быстрый форс-тик (был в фоне ' + Math.round(hiddenMs/1000) + 'с)');
      }
      if (typeof window._javaTick === 'function') window._javaTick();
    }
  }, 200);
});

// Принудительно опрашивает все известные чаты + inbox прямо сейчас
async function _sbForcePollAllChats(p) {
  if (!p || !sbReady()) return;

  // Синхронизируем Java-side lastTs ↩ JS (Java мог обновить его пока мы были в фоне)
  try {
    if (window.Android && typeof Android.getJavaSbLastTs === 'function') {
      const javaTs = parseInt(Android.getJavaSbLastTs()) || 0;
      if (javaTs > _fbInboxLastTs) {
        // Java видел сообщения которые JS ещё не обработал ↩ откатываемся назад
        // чтобы гарантированно получить их (небольшой overlap не страшен)
        _fbInboxLastTs = Math.max(0, javaTs - 60000);
        _inboxTsSave(_fbInboxLastTs);
      }
    }
  } catch(e) {}

  // sinceTs: берём последний известный ts или смотрим за 30 дней назад
  // НЕ используем _lastVisibleTs - 60000, т.к. это только 1 минута
  const sinceTs = _fbInboxLastTs > 0
    ? _fbInboxLastTs
    : (Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. Inbox   все сообщения адресованные МНЕ после sinceTs
  try {
    const data = await sbGet('messages',
      `select=*&to_user=eq.${encodeURIComponent(p.username)}&ts=gt.${sinceTs}&order=ts.asc&limit=200`
    );
    if (Array.isArray(data) && data.length > 0) {
      const bySender = {};
      data.forEach(msg => {
        if (!bySender[msg.from_user]) bySender[msg.from_user] = [];
        bySender[msg.from_user].push(msg);
        _fbInboxLastTs = Math.max(_fbInboxLastTs, msg.ts); _inboxTsSave(_fbInboxLastTs);
      });
      Object.entries(bySender).forEach(([sender, msgs]) => {
        sbPollChat(p.username, sender);
        sbHandleIncomingMessages(p.username, sender, msgs);
      });
    }
  } catch(e) {}
  // 2. Убиваем и перезапускаем все per-chat таймеры (Android мог их throttle-нуть)
  const deadKeys = Object.keys(_fbMsgStreams);
  deadKeys.forEach(key => {
    clearInterval(_fbMsgStreams[key]);
    delete _fbMsgStreams[key];
  });
  // Перезапуск polling для всех известных чатов
  const chats = chatsLoad();
  chats.forEach(username => sbPollChat(p.username, username));
  // Перезапуск inbox polling
  sbStartInboxPolling(p);
}

// ┄┄ Java-tick: вызывается из MainActivity каждые 2-4 сек ┄┄┄┄┄┄┄┄┄┄
// Это главный механизм доставки сообщений   работает даже когда
// Android заморозил JS setInterval в WebView
let _javaTickCount = 0;
window._javaTick = async function() {
  _javaTickCount++;
  const pr = profileLoad();
  if (!pr || !sbReady() || !_profilePeerReady) return;

  // При первом тике синхронизируем Java-side lastTs с JS.
  // Java могла записывать новые ts пока JS был заморожен (оффлайн / фон).
  if (_javaTickCount === 1 && window.Android && typeof Android.getJavaSbLastTs === 'function') {
    try {
      const javaTs = parseInt(Android.getJavaSbLastTs()) || 0;
      // Если Java видела сообщения позже нашего lastTs ↩ откатываемся назад чтобы
      // гарантированно получить их при следующем inbox-запросе
      if (javaTs > _fbInboxLastTs) {
        _fbInboxLastTs = Math.max(0, javaTs - 120000); // 2 минуты overlap
        _inboxTsSave(_fbInboxLastTs);
      }
    } catch(e) {}
  }

  // Каждый тик: inbox
  try {
    const data = await sbGet('messages',
      `select=*&to_user=eq.${encodeURIComponent(pr.username)}&ts=gt.${_fbInboxLastTs}&order=ts.asc&limit=100`
    );
    if (Array.isArray(data) && data.length > 0) {
      if (window.Android && typeof Android.log === 'function') {
        Android.log('[POLL] inbox нашёл ' + data.length + ' новых сообщений (tick #' + _javaTickCount + ')');
      }
      const bySender = {};
      data.forEach(msg => {
        if (!bySender[msg.from_user]) bySender[msg.from_user] = [];
        bySender[msg.from_user].push(msg);
        _fbInboxLastTs = Math.max(_fbInboxLastTs, msg.ts); _inboxTsSave(_fbInboxLastTs);
      });
      Object.entries(bySender).forEach(([sender, msgs]) => {
        sbHandleIncomingMessages(pr.username, sender, msgs);
      });
    }
  } catch(e) {}

  // Каждый тик: открытый чат
  if (_msgCurrentChat) {
    try {
      const _isGroupTick = _msgCurrentChat === PUBLIC_GROUP_ID || _msgCurrentChat.startsWith('grp_');
      if (_isGroupTick) {
        // Группа   поллим по groupChatKey без фильтра to_user
        const gChatKey = groupChatKey(_msgCurrentChat);
        const gStreamKey = 'GRP:' + _msgCurrentChat;
        const gLastTs = _fbLastMsgTs[gStreamKey] || 0;
        const gData = await sbGet('messages',
          `select=*&chat_key=eq.${encodeURIComponent(gChatKey)}&ts=gt.${gLastTs}&order=ts.asc&limit=100`
        );
        if (Array.isArray(gData) && gData.length > 0) {
          const group = groupGet(_msgCurrentChat);
          if (group) {
            const msgs2 = msgLoad();
            if (!msgs2[_msgCurrentChat]) msgs2[_msgCurrentChat] = [];
            let hasNew2 = false;
            gData.forEach(row => {
              _fbLastMsgTs[gStreamKey] = Math.max(_fbLastMsgTs[gStreamKey]||0, row.ts);
              const exists = msgs2[_msgCurrentChat].some(m => m.ts===row.ts && m.from===row.from_user);
              if (!exists) {
                let ep2 = null; try { if(row.extra) ep2=JSON.parse(row.extra); } catch(_){}
                msgs2[_msgCurrentChat].push({
                  from: row.from_user, to: _msgCurrentChat, text: row.text||'', ts: row.ts,
                  delivered: true, read: true,
                  ...(ep2?.fileLink?{fileLink:ep2.fileLink}:{}),
                  ...(ep2?.fileType?{fileType:ep2.fileType}:{}),
                  ...(ep2?.fileName?{fileName:ep2.fileName}:{}),
                });
                hasNew2 = true;
              }
            });
            if (hasNew2) { msgs2[_msgCurrentChat].sort((a,b)=>a.ts-b.ts); msgSave(msgs2); messengerRenderMessages(); }
          }
        }
      } else {
        const key = sbChatKey(pr.username, _msgCurrentChat);
        const data = await sbGet('messages',
          `select=*&chat_key=eq.${encodeURIComponent(key)}&ts=gt.${_fbLastMsgTs[key]||0}&order=ts.asc&limit=50`
        );
        if (Array.isArray(data) && data.length > 0) {
          sbHandleIncomingMessages(pr.username, _msgCurrentChat, data);
        }
      }
    } catch(e) {}
  }

  // Каждые 5 тиков: пробуем сбросить очередь если есть pending
  if (_javaTickCount % 5 === 0 && outboxLoad().length > 0) {
    outboxFlush().then(_outboxUpdateStatusBar).catch(()=>{});
  }

  // Каждые 10 тиков: presence
  if (_javaTickCount % 10 === 0) {
    sbPresencePut(pr).catch(() => {});
    sbPollPresence().catch(() => {});
  }
  // Каждые ~10 мин (300 тиков по 2с) удаляем старые медиа-сообщения (> 3 дней)
  if (_javaTickCount % 300 === 5) {
    _mcCleanupOldMedia().catch(() => {});
  }
};
// Каждые 2 сек: inbox + открытый чат
// Каждые 10 сек: presence heartbeat + список онлайн
// Основной механизм — Java Handler через window._javaTick()
// JS setInterval — запасной fallback когда нет Android моста
let _superPollerTick = 0;
function _startSuperPoller(p, sessionId) {
  clearInterval(_superPoller);
  // Если есть Android Java Handler — он делает всё сам, JS таймер не нужен
  if (window.Android && typeof Android.startBackgroundService === 'function') {
    _superPoller = null;
    return;
  }
  // Fallback: JS setInterval для браузера / устройств без Java Handler
  _superPollerTick = 0;
  _superPoller = setInterval(async () => {
    if (sessionId !== _connectSessionId) { clearInterval(_superPoller); return; }
    if (typeof window._javaTick === 'function') await window._javaTick();
  }, 2500);
}

// ┄┄ Удаление медиа-сообщений старше 3 дней из Supabase ┄┄┄┄┄┄┄┄┄┄┄
// Фото хранятся как base64 в extra   тяжёлые, удаляем через 3 дня.
// Видео/файлы/ГС   ссылки лёгкие, но тоже чистим для порядка.
async function _mcCleanupOldMedia() {
  if (!sbReady()) return;
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const cutoffTs = Date.now() - THREE_DAYS_MS;
  // Supabase хранит ts как bigint, фильтруем lt (less than)
  // Удаляем только сообщения с медиа-контентом (extra содержит image/fileLink)
  // Используем два запроса: один для фото (есть extra с "image":), один для файлов
  try {
    // Фото: extra содержит "image":   это base64, самое тяжёлое
    await sbDelete('messages',
      `ts=lt.${cutoffTs}&extra=like.*"image":*`
    );
    // Файлы/видео/голосовые: extra содержит "fileLink":
    await sbDelete('messages',
      `ts=lt.${cutoffTs}&extra=like.*"fileLink":*`
    );
    // Также чистим локальный кэш сообщений от старых медиа (освобождаем localStorage)
    try {
      const msgs = msgLoad();
      let changed = false;
      for (const chatKey of Object.keys(msgs)) {
        const before = msgs[chatKey].length;
        msgs[chatKey] = msgs[chatKey].filter(m => {
          if (m.ts < cutoffTs && (m.image || m.fileLink)) return false;
          return true;
        });
        if (msgs[chatKey].length !== before) changed = true;
      }
      if (changed) msgSave(msgs);
    } catch(_) {}
  } catch(e) {
    // Молча   не критично
  }
}

function profileDisconnect() {
  _profilePeerReady = false;
  clearInterval(_sbPresenceTimer);
  clearInterval(_fbPollTimer);
  clearInterval(_fbInboxTimer);  _fbInboxTimer = null;
  clearInterval(_watchdogTimer); _watchdogTimer = null;
  clearInterval(_superPoller);   _superPoller = null;
  p2pStopHealthCheck();
  Object.values(_fbMsgStreams).forEach(t => clearInterval(t));
  _fbMsgStreams = {};
  _sbPresenceTimer = null;
  _fbPollTimer = null;
  _profileOnlinePeers = [];
}

// ┄┄ Присутствие ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// Первый раз делаем DELETE+INSERT чтобы аккаунт гарантированно появился в поиске
let _presenceFirstPut = true;
async function sbPresencePut(p) {
  if (!p || !sbReady()) return;
  // Compress photo avatar to 80x80px base64 for presence storage
  let avatarDataToStore = null;
  if (p.avatarType === 'photo' && p.avatarData) {
    try {
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas');
          cv.width = cv.height = 80;
          cv.getContext('2d').drawImage(img, 0, 0, 80, 80);
          avatarDataToStore = cv.toDataURL('image/jpeg', 0.75);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = p.avatarData;
      });
    } catch(_) {}
  }
  const payload = {
    username: p.username, name: p.name,
    avatar: p.avatar || '\u{1F60A}', avatar_type: p.avatarType || 'emoji',
    avatar_data: avatarDataToStore,
    color: p.color || '#e87722', status: p.status || 'online',
    vip: p.vip || false, badge: p.badge || null,
    pwd_hash: p.pwdHash || null,
    ts: Date.now()
  };
  try {
    if (_presenceFirstPut) {
      _presenceFirstPut = false;
      // DELETE старой записи чтобы снять любые конфликты
      await fetch(`${sbUrl()}/rest/v1/presence?username=eq.${encodeURIComponent(p.username)}`, {
        method: 'DELETE',
        headers: { apikey: sbKey(), Authorization: `Bearer ${sbKey()}` }
      });
      // INSERT чистой новой записи
      await fetch(`${sbUrl()}/rest/v1/presence`, {
        method: 'POST',
        headers: {
          apikey: sbKey(), Authorization: `Bearer ${sbKey()}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      });
    } else {
      // Последующие heartbeat: обычный upsert
      await fetch(`${sbUrl()}/rest/v1/presence?on_conflict=username`, {
        method: 'POST',
        headers: {
          apikey: sbKey(), Authorization: `Bearer ${sbKey()}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(payload)
      });
    }
  } catch(e) {}
}

async function sbPollPresence() {
  if (!sbReady()) return;
  const data = await sbGet('presence', 'select=*&order=ts.desc&limit=500');
  if (!Array.isArray(data)) return;
  const p = profileLoad();
  const now = Date.now();
  const myUsername = p?.username;

  // Дедуплицируем по username   берём самую свежую строку на пользователя
  const seen = new Set();
  const unique = [];
  for (const u of data) {
    if (!u.username || seen.has(u.username)) continue;
    seen.add(u.username);
    unique.push(u);
  }

  // Online = seen within 5 min (300 sec)
  const _mapU = u => ({
    username: u.username, name: u.name,
    avatar: u.avatar, avatarType: u.avatar_type, avatarData: u.avatar_data,
    color: u.color, status: u.status,
    vip: u.vip, badge: u.badge,
    banner: u.banner || null, frame: u.frame || null, bio: u.bio || ''
  });
  _profileOnlinePeers = unique
    .filter(u => u.username !== myUsername && (now - (u.ts||0)) < 300000)
    .map(_mapU);
  // All known users (including offline) for search
  _allKnownUsers = unique
    .filter(u => u.username !== myUsername)
    .map(u => ({ ..._mapU(u), _online: (now - (u.ts||0)) < 300000 }));
  profileUpdateOnlineCount();

  // Подгружаем баннеры из таблицы users (там хранится banner, frame, bio)
  sbEnrichUsersFromUsersTable().catch(() => {});
}

// Обогащаем _allKnownUsers данными из таблицы users (banner, frame, bio, avatar_data)
async function sbEnrichUsersFromUsersTable() {
  if (!sbReady() || !_allKnownUsers.length) return;
  try {
    const usernames = _allKnownUsers.map(u => u.username).slice(0, 50);
    const q = usernames.map(u => encodeURIComponent(u)).join(',');
    const rows = await sbGet('users', `select=username,banner,frame,bio,avatar_data,avatar_type,vip,badge,color&username=in.(${usernames.map(u => '"' + u + '"').join(',')})&limit=50`);
    if (!Array.isArray(rows)) return;
    rows.forEach(row => {
      const user = _allKnownUsers.find(u => u.username === row.username);
      if (user) {
        if (row.banner    !== undefined) user.banner    = row.banner;
        if (row.frame     !== undefined) user.frame     = row.frame;
        if (row.bio       !== undefined) user.bio       = row.bio;
        if (row.vip       !== undefined) user.vip       = row.vip;
        if (row.badge     !== undefined) user.badge     = row.badge;
        if (row.color     !== undefined) user.color     = row.color;
        if (row.avatar_data && !user.avatarData) user.avatarData = row.avatar_data;
      }
      const peer = _profileOnlinePeers.find(u => u.username === row.username);
      if (peer) {
        if (row.banner    !== undefined) peer.banner    = row.banner;
        if (row.frame     !== undefined) peer.frame     = row.frame;
        if (row.bio       !== undefined) peer.bio       = row.bio;
        if (row.vip       !== undefined) peer.vip       = row.vip;
        if (row.badge     !== undefined) peer.badge     = row.badge;
        if (row.color     !== undefined) peer.color     = row.color;
        if (row.avatar_data && !peer.avatarData) peer.avatarData = row.avatar_data;
      }
    });
  } catch(e) {}
}

function profileUpdateOnlineCount() {
  const count = _profileOnlinePeers.length + 1;
  profileUpdateP2PStatus(
    '🟢 Онлайн   ' + count + ' ' +
    (count === 1 ? 'пользователь' : count < 5 ? 'пользователя' : 'пользователей')
  );
}

// ┄┄ Сообщения ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function sbChatKey(a, b) { return [a, b].sort().join('__'); }

function sbStartMsgPolling(p) {
  const chats = chatsLoad();
  chats.forEach(username => sbPollChat(p.username, username));
}

function sbPollChat(myUsername, otherUsername) {
  const key = sbChatKey(myUsername, otherUsername);
  if (_fbMsgStreams[key]) return;
  const doCheck = async () => {
    if (!sbReady()) return;
    const lastTs = _fbLastMsgTs[key] || 0;
    // Если ts=0 (кэш очищен)   подтягиваем историю за последние 30 дней
    const sinceTs = lastTs > 0 ? lastTs : (Date.now() - 30 * 24 * 60 * 60 * 1000);
    const data = await sbGet('messages',
      `select=*&chat_key=eq.${key}&ts=gt.${sinceTs}&order=ts.asc&limit=200`
    );
    if (!Array.isArray(data) || data.length === 0) return;
    sbHandleIncomingMessages(myUsername, otherUsername, data);
  };
  doCheck();
  _fbMsgStreams[key] = setInterval(doCheck, 2000);
}

// Принудительно сбросить и перезапустить polling конкретного чата.
// Используется при открытии чата   немедленно запрашивает свежие сообщения из Supabase.
function sbForceRecheckChat(myUsername, otherUsername) {
  const key = sbChatKey(myUsername, otherUsername);
  if (_fbMsgStreams[key]) {
    clearInterval(_fbMsgStreams[key]);
    delete _fbMsgStreams[key];
  }
  sbPollChat(myUsername, otherUsername);
}

function sbStartInboxPolling(p) {
  clearInterval(_fbInboxTimer);
  // Используем сохранённый ts из localStorage (не сбрасывается при перезапуске).
  // Fallback: 30 дней назад   чтобы не пропустить оффлайн-сообщения.
  // При первом запуске _fbInboxLastTs=0, берём 30 дней чтобы подтянуть историю.
  if (!_fbInboxLastTs) {
    _fbInboxLastTs = _inboxTsLoad() || (Date.now() - 30 * 24 * 60 * 60 * 1000);
    _inboxTsSave(_fbInboxLastTs);
  }
  const doInboxCheck = async () => {
    if (!sbReady() || !p) return;
    // Ищем все сообщения адресованные МНЕ, которые я ещё не видел
    const data = await sbGet('messages',
      `select=*&to_user=eq.${encodeURIComponent(p.username)}&ts=gt.${_fbInboxLastTs}&order=ts.asc&limit=100`
    );
    if (!Array.isArray(data) || data.length === 0) return;
    // Группируем по отправителю
    const bySender = {};
    data.forEach(msg => {
      if (!bySender[msg.from_user]) bySender[msg.from_user] = [];
      bySender[msg.from_user].push(msg);
      _fbInboxLastTs = Math.max(_fbInboxLastTs, msg.ts); _inboxTsSave(_fbInboxLastTs);
    });
    // Для каждого нового отправителя   запускаем полноценный poll и обрабатываем
    Object.entries(bySender).forEach(([sender, msgs]) => {
      sbPollChat(p.username, sender); // запускает постоянный poll
      sbHandleIncomingMessages(p.username, sender, msgs);
    });
  };
  doInboxCheck();
  _fbInboxTimer = setInterval(doInboxCheck, 2000); // 2 сек   быстрее получаем сообщения
}

function sbHandleIncomingMessages(myUsername, otherUsername, rows) {
  if (!rows || rows.length === 0) return;
  const msgs = msgLoad();
  const key = sbChatKey(myUsername, otherUsername);
  let hasNew = false;

  rows.forEach(msg => {
    if (msg.from_user === myUsername) {
      // Своё сообщение   обновляем delivered или восстанавливаем если кэш был очищен
      // Пропускаем служебные reaction_update и read_receipt сообщения
      if (msg.extra) {
        try {
          const ep = JSON.parse(msg.extra);
          if (ep?.type === 'reaction' || ep?.type === 'read_receipt') {
            _fbLastMsgTs[key] = Math.max(_fbLastMsgTs[key]||0, msg.ts);
            return; // служебное   не восстанавливаем
          }
        } catch(_) {}
      }
      if (!msgs[otherUsername]) msgs[otherUsername] = [];
      const local = msgs[otherUsername].find(m => m.ts === msg.ts && m.from === myUsername);
      if (local) {
        if (!local.delivered) { local.delivered = true; hasNew = true; }
      } else {
        // Кэш был очищен   восстанавливаем своё сообщение из Supabase
        // Пропускаем пустые (могут быть артефакты)
        if (!msg.text && !msg.sticker) {
          _fbLastMsgTs[key] = Math.max(_fbLastMsgTs[key]||0, msg.ts);
          return;
        }
        let inText = msg.text || '';
        let inSticker = msg.sticker || null;
        if (!inSticker) {
          const emojiOnly = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}){1,2}$/u;
          if (emojiOnly.test(inText.trim())) { inSticker = inText.trim(); inText = ''; }
        }
        msgs[otherUsername].push({
          from: myUsername, to: otherUsername,
          text: inText, sticker: inSticker, ts: msg.ts,
          delivered: true, read: true
        });
        hasNew = true;
      }
      _fbLastMsgTs[key] = Math.max(_fbLastMsgTs[key]||0, msg.ts);
      return;
    }
    if (!msgs[otherUsername]) msgs[otherUsername] = [];
    const exists = msgs[otherUsername].some(m => m.ts === msg.ts && m.from === msg.from_user);
    // ВСЕГДА обновляем ts   даже если сообщение уже есть локально,
    // иначе _fbLastMsgTs застревает на 0 и мы вечно тянем одно и то же
    _fbLastMsgTs[key] = Math.max(_fbLastMsgTs[key]||0, msg.ts);
    if (!exists) {
      const alreadyRead = _msgCurrentChat === otherUsername;
      // Расшифровываем E2E если текст зашифрован
      let rawText = msg.text || '';
      if (rawText.startsWith(E2E_PREFIX)) {
        // Асинхронная расшифровка   обновим сообщение после
        e2eDecrypt(rawText, msg.from_user).then(decrypted => {
          if (!msgs[otherUsername]) return;
          const stored = msgs[otherUsername].find(m => m.ts === msg.ts && m.from === msg.from_user);
          if (stored && stored.text === '🔒 [расшифровываю...]') {
            stored.text = decrypted;
            msgSave(msgs);
            if (_msgCurrentChat === otherUsername) messengerRenderMessages();
          }
        }).catch(() => {});
        rawText = '🔒 [расшифровываю...]';
      }
      // Parse sticker: single emoji-only messages stored as sticker field
      let inText = rawText;
      let inSticker = msg.sticker || null;
      if (!inSticker) {
        const emojiOnly = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}){1,2}$/u;
        if (emojiOnly.test(inText.trim())) { inSticker = inText.trim(); inText = ''; }
      }
      // Parse replyTo, image and media from extra field
      let inReplyTo = null;
      let inImage   = null;
      let extraParsed = null;
      try { if (msg.extra) extraParsed = JSON.parse(msg.extra); } catch(_){}
      if (extraParsed?.replyTo)  inReplyTo = extraParsed.replyTo;
      if (extraParsed?.image)    inImage   = extraParsed.image;

      // Обрабатываем group_deleted   удаляем группу локально
      if (extraParsed?.type === 'group_deleted' && extraParsed?.groupId) {
        const gid = extraParsed.groupId;
        const groups = groupsLoad().filter(g => g.id !== gid);
        groupsSave(groups);
        const msgs2 = msgLoad();
        delete msgs2[gid];
        msgSave(msgs2);
        chatsSave(chatsLoad().filter(u => u !== gid));
        _markChatDeleted(gid);
        if (_msgCurrentChat === gid) showScreen('s-messenger', 'back');
        renderGroupsList && renderGroupsList();
        messengerUpdateBadge();
        _fbLastMsgTs[key] = Math.max(_fbLastMsgTs[key]||0, msg.ts);
        return;
      }

      // Обрабатываем group_invite   добавляем группу локально
      if (extraParsed?.type === 'group_invite' && extraParsed?.group) {
        const inviteGroup = extraParsed.group;
        const groups = groupsLoad();
        if (!groups.find(g => g.id === inviteGroup.id)) {
          groups.push(inviteGroup);
          groupsSave(groups);
          // Запускаем polling этой группы
          sbPollGroupChat(myUsername, inviteGroup);
          if (window.Android && typeof Android.log === 'function') {
            Android.log('[GROUP] Получен инвайт в группу «' + inviteGroup.name + '»');
          }
        }
        _fbLastMsgTs[key] = Math.max(_fbLastMsgTs[key]||0, msg.ts);
        return; // не показываем как обычное сообщение
      }

      // Обрабатываем read_receipt   получатель прочитал наши сообщения
      if (extraParsed?.type === 'read_receipt' && extraParsed?.upToTs) {
        const upTo = extraParsed.upToTs;
        const allMsgs = msgs[otherUsername] || [];
        let rChanged = false;
        allMsgs.forEach(m => {
          if (m.from === myUsername && !m.read && m.ts <= upTo) {
            m.read = true; rChanged = true;
          }
        });
        if (rChanged) {
          msgSave(msgs);
          if (_msgCurrentChat === otherUsername) messengerRenderMessages();
        }
        _fbLastMsgTs[key] = Math.max(_fbLastMsgTs[key]||0, msg.ts);
        return;
      }

      // Обрабатываем reaction_update   служебное сообщение синхронизации реакций
      if (extraParsed?.type === 'reaction' && extraParsed?.msgTs && extraParsed?.reactions !== undefined) {
        const targetTs = extraParsed.msgTs;
        const allMsgs = msgs[otherUsername] || [];
        const target = allMsgs.find(m => m.ts === targetTs);
        if (target) {
          target.reactions = extraParsed.reactions;
          msgSave(msgs);
          if (_msgCurrentChat === otherUsername) messengerRenderMessages();
        }
        return; // не добавляем как обычное сообщение
      }

      // Обрабатываем delete_msg   собеседник удалил сообщение у всех
      if (extraParsed?.type === 'delete_msg' && extraParsed?.msgTs) {
        const targetTs = extraParsed.msgTs;
        if (msgs[otherUsername]) {
          const before = msgs[otherUsername].length;
          msgs[otherUsername] = msgs[otherUsername].filter(m => m.ts !== targetTs);
          if (msgs[otherUsername].length !== before) {
            msgSave(msgs);
            if (_msgCurrentChat === otherUsername) messengerRenderMessages();
          }
        }
        return;
      }
      msgs[otherUsername].push({
        from: msg.from_user, to: myUsername,
        text: inImage ? '' : inText, sticker: inSticker, image: inImage || undefined, ts: msg.ts,
        replyTo: inReplyTo, delivered: true, read: alreadyRead,
        // медиа из extra
        ...(extraParsed?.fileLink  ? { fileLink:  extraParsed.fileLink  } : {}),
        ...(extraParsed?.fileType  ? { fileType:  extraParsed.fileType  } : {}),
        ...(extraParsed?.fileName  ? { fileName:  extraParsed.fileName  } : {}),
        ...(extraParsed?.fileSize  ? { fileSize:  extraParsed.fileSize  } : {}),
        ...(extraParsed?.duration  ? { duration:  extraParsed.duration  } : {}),
        ...(extraParsed?.thumbData ? { thumbData: extraParsed.thumbData } : {}),
      });
      hasNew = true;
      // Логируем получение нового сообщения
      if (window.Android && typeof Android.log === 'function') {
        Android.log('[MSG] Новое сообщение от @' + msg.from_user + ': "' + (inText||inSticker||'').slice(0,40) + '" ts=' + msg.ts);
      }
    }
  });

  if (hasNew) {
    // Сортируем по времени   важно после восстановления из Supabase
    if (msgs[otherUsername]) {
      msgs[otherUsername].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    }
    msgSave(msgs);
    const chats = chatsLoad();
    if (!chats.includes(otherUsername)) { chats.unshift(otherUsername); chatsSave(chats); }
    if (_msgCurrentChat === otherUsername) messengerRenderMessages();
    else {
      const peer = _profileOnlinePeers.find(u => u.username === otherUsername) || {};
      const lastMsg = msgs[otherUsername]?.[msgs[otherUsername].length-1];
      messengerUpdateBadge();
      if (lastMsg && lastMsg.from !== myUsername) {
        const senderName = peer.name || ('@' + otherUsername);
        const msgText    = lastMsg.text.slice(0, 60);
        // Проверяем mute
        if (!isMuted(otherUsername)) {
          showIosNotif({
            sender: senderName,
            text: msgText,
            avatar: peer.avatar,
            avatarType: peer.avatarType,
            color: peer.color,
            onTap: function() { messengerOpenChat(otherUsername); },
          });
          // Push на телефон (только если приложение свёрнуто)
          pushSend(senderName, msgText);
        }
      }
    }
  }
}

// Отправка сообщений

// ══ PUSH УВЕДОМЛЕНИЯ (нативный мост Android) ══════════════
// Если Android-мост доступен   используем его; иначе   веб-Notification API
const _isAndroidApp = typeof window.Android === 'object' && typeof window.Android.showNotification === 'function';

function pushGetPermission() {
  if (_isAndroidApp) {
    try { return window.Android.getNotificationPermission(); } catch(e) {}
    return 'default';
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function pushGetStatusText() {
  const p = pushGetPermission();
  if (p === 'unsupported') return '⚠️ Не поддерживается браузером';
  if (p === 'granted')     return '🟢 Включены';
  if (p === 'denied')      return '🔴 Заблокированы (разреши в настройках ↩ Приложения)';
  return '⚪️ Не настроены';
}

function pushGetBtnText() {
  const p = pushGetPermission();
  if (p === 'granted')     return 'Включены ✅';
  if (p === 'denied')      return 'Заблокированы';
  if (p === 'unsupported') return 'Недоступно';
  return 'Включить';
}

// Колбэк от Java после решения runtime-разрешения
function onNativeNotifPermissionResult(result) {
  const statusEl = document.getElementById('push-notif-status');
  const btnEl    = document.getElementById('push-notif-btn');
  if (statusEl) statusEl.textContent = pushGetStatusText();
  if (btnEl)    btnEl.textContent    = pushGetBtnText();
  if (result === 'granted') {
    toast('🔔 Уведомления включены!');
    setTimeout(() => pushSend('Расписание', 'Уведомления настроены ✅'), 800);
  } else {
    toast('❌ Уведомления не разрешены');
  }
}

function pushRequestPermission() {
  const p = pushGetPermission();
  if (p === 'granted') { toast('✅ Уведомления уже включены'); return; }
  if (p === 'denied')  { toast('🔴 Заблокированы   открой Настройки ↩ Приложения ↩ Уведомления'); return; }
  if (_isAndroidApp) {
    // Нативный запрос разрешения Android 13+
    try { window.Android.requestNotificationPermission(); } catch(e) {}
    return;
  }
  // Фоллбэк для браузера
  if (!('Notification' in window)) { toast('❌ Браузер не поддерживает уведомления'); return; }
  Notification.requestPermission().then(result => onNativeNotifPermissionResult(result));
}

function pushSend(title, body) {
  if (pushGetPermission() !== 'granted') return;
  if (document.visibilityState === 'visible') return; // приложение видно   не дублируем
  if (_isAndroidApp) {
    try { window.Android.showNotification(title, body); } catch(e) {}
    return;
  }
  // Фоллбэк веб
  try {
    const n = new Notification(title, { body, tag: 'sapp-msg', renotify: true });
    n.onclick = () => { window.focus(); n.close(); };
  } catch(e) {}
}

// iOS-style notification banners
let _iosNotifQueue = [];
let _iosNotifBusy  = false;
const _iosNotifDur = 4200;

function showIosNotif(opts) {
  _iosNotifQueue.push(opts);
  if (!_iosNotifBusy) _iosNotifNext();
}

function _iosNotifNext() {
  if (_iosNotifQueue.length === 0) { _iosNotifBusy = false; return; }
  _iosNotifBusy = true;
  var item = _iosNotifQueue.shift();
  var el = document.createElement('div');
  el.className = 'ios-notif';
  var avatarHtml = '';
  if (item.avatarType === 'img' && item.avatar) {
    avatarHtml = '<img src="' + item.avatar + '" alt="">';
  } else {
    avatarHtml = '<span>' + (item.avatar || '💬') + '</span>';
  }
  var accentColor = item.color || 'var(--accent)';
  var now = new Date();
  var timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  el.innerHTML =
    '<div class="ios-notif-avatar" style="background:color-mix(in srgb,' + accentColor + ' 22%,var(--surface3));">' +
      avatarHtml +
      '<div class="ios-notif-app-icon">💬</div>' +
    '</div>' +
    '<div class="ios-notif-body">' +
      '<div class="ios-notif-header">' +
        '<span class="ios-notif-app">Сообщение</span>' +
        '<span class="ios-notif-time">' + timeStr + '</span>' +
      '</div>' +
      '<div class="ios-notif-sender">' + (item.sender||'') + '</div>' +
      '<div class="ios-notif-text">' + (item.text||'') + '</div>' +
    '</div>';
  el.addEventListener('click', function() {
    _iosNotifDismiss(el);
    if (item.onTap) item.onTap();
  });
  var container = document.getElementById('ios-notif-container');
  if (container) container.appendChild(el);
  requestAnimationFrame(function() { requestAnimationFrame(function() { el.classList.add('ios-show'); }); });
  try { SFX.play('toastShow'); } catch(e) {}
  el._notifTimer = setTimeout(function() { _iosNotifDismiss(el); }, _iosNotifDur);
}

function _iosNotifDismiss(el) {
  if (!el || el._notifDismissed) return;
  el._notifDismissed = true;
  clearTimeout(el._notifTimer);
  el.classList.remove('ios-show');
  el.classList.add('ios-hide');
  setTimeout(function() { el.remove(); setTimeout(_iosNotifNext, 250); }, 350);
}
// ┄┄ Splash публичной группы ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function _showPublicGroupSplash(onAgree) {
  if (document.getElementById('pub-group-splash')) { onAgree(); return; }
  const ov = document.createElement('div');
  ov.id = 'pub-group-splash';
  ov.style.cssText = [
    'position:fixed;inset:0;z-index:9800;background:var(--bg);',
    'display:flex;flex-direction:column;align-items:center;',
    'justify-content:center;padding:32px 24px;overflow:hidden;',
    'animation:pgsIn .32s cubic-bezier(.34,1.1,.64,1) both'
  ].join('');

  const particles = Array.from({length:10},(_,i)=>{
    const sz=4+Math.random()*6, l=5+Math.random()*90,
          d=2.8+Math.random()*2.4, dl=Math.random()*1.8;
    return `<div style="position:absolute;border-radius:50%;width:${sz}px;height:${sz}px;left:${l}%;bottom:-12px;background:var(--accent);opacity:0;animation:pgsParticle ${d}s ${dl}s ease-in-out infinite"></div>`;
  }).join('');

  ov.innerHTML = `
    <style>
      @keyframes pgsIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
      @keyframes pgsParticle{0%{opacity:0;transform:translateY(0) scale(1)}20%{opacity:.22}80%{opacity:.07}100%{opacity:0;transform:translateY(-130px) scale(.35)}}
      @keyframes pgsIconIn{0%{opacity:0;transform:scale(.4) rotate(-15deg)}60%{transform:scale(1.1) rotate(4deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
      @keyframes pgsIconFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
      @keyframes pgsLineIn{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}
      @keyframes pgsTextIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      @keyframes pgsBtnIn{from{opacity:0;transform:translateY(22px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}
      #pub-group-splash .pgs-icon{animation:pgsIconIn .55s cubic-bezier(.34,1.4,.64,1) both,pgsIconFloat 3s 1s ease-in-out infinite}
    </style>
    <div style="position:absolute;inset:0;pointer-events:none">${particles}</div>
    <div class="pgs-icon" style="width:88px;height:88px;border-radius:28px;background:linear-gradient(135deg,var(--accent),var(--accent2,#c45f0a));display:flex;align-items:center;justify-content:center;font-size:42px;flex-shrink:0;margin-bottom:28px;box-shadow:0 8px 28px color-mix(in srgb,var(--accent) 40%,transparent)">💡</div>
    <div style="font-size:24px;font-weight:800;letter-spacing:-.02em;text-align:center;color:var(--text);margin-bottom:6px;opacity:0;animation:pgsTextIn .4s .3s cubic-bezier(.34,1.2,.64,1) forwards">Баги и идеи</div>
    <div style="width:44px;height:2.5px;border-radius:2px;background:color-mix(in srgb,var(--accent) 55%,transparent);margin:10px 0 16px;transform-origin:center;opacity:0;animation:pgsLineIn .4s .45s ease forwards"></div>
    <div style="font-size:14px;line-height:1.65;color:var(--muted);text-align:center;max-width:300px;margin-bottom:10px;opacity:0;animation:pgsTextIn .4s .58s ease forwards">Общий чат для сообщений об ошибках и предложений по улучшению приложения.</div>
    <div style="font-size:13px;line-height:1.55;text-align:center;max-width:300px;margin-bottom:32px;opacity:0;animation:pgsTextIn .4s .7s ease forwards"><span style="color:var(--accent);font-weight:700">⚠️ Лимит:</span> <span style="color:var(--muted)">одно сообщение в час с одного аккаунта.</span></div>
    <button id="pgs-agree-btn" style="padding:14px 48px;border-radius:24px;background:var(--accent);border:none;color:var(--btn-text,#fff);font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:.02em;box-shadow:0 4px 18px color-mix(in srgb,var(--accent) 38%,transparent);opacity:0;animation:pgsBtnIn .45s .88s cubic-bezier(.34,1.3,.64,1) forwards;-webkit-tap-highlight-color:transparent;transition:transform .12s,opacity .12s">Согласен</button>
  `;
  document.body.appendChild(ov);
  const btn = ov.querySelector('#pgs-agree-btn');
  btn.addEventListener('click', () => {
    ov.style.transition='opacity .26s ease,transform .26s cubic-bezier(.4,0,.8,.6)';
    ov.style.opacity='0'; ov.style.transform='scale(.94)';
    setTimeout(()=>{ ov.remove(); onAgree(); }, 280);
  });
  btn.addEventListener('touchstart',()=>{btn.style.transform='scale(.94)';btn.style.opacity='.82';},{passive:true});
  btn.addEventListener('touchend',  ()=>{btn.style.transform='';btn.style.opacity='';},{passive:true});
}

// messengerSend и остальные функции мессенджера   в блоке ниже

// ┄┄ Broadcast (профиль, лидерборд) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function profileBroadcast(data) {
  if (data.type === 'profile_update') {
    const p = profileLoad();
    if (p && sbReady()) sbPresencePut(p);
  }
  if (data.type === 'lb_update' && data.lb) {
    const p = profileLoad();
    if (!p || !sbReady()) return;
    Object.entries(data.lb).forEach(([game, entries]) => {
      const myEntry = entries.find(e => e.username === p.username);
      if (myEntry) sbUpsert('leaderboard', {
        game, username: p.username, name: p.name,
        avatar: p.avatar, color: p.color,
        score: myEntry.score, ts: Date.now()
      });
    });
  }
}

// lbSubmitMyScores уже встроен с поддержкой Supabase выше

// leaderboardRender уже встроен с поддержкой Supabase выше

function profileUpdateP2PStatus(msg) {
  const el = document.getElementById('profile-p2p-status');
  if (el) el.textContent = msg;
  const sEl = document.getElementById('profile-p2p-strategy');
  if (sEl) {
    if (p2pIsDisabled()) {
      sEl.textContent = '🔒 P2P выключен   только прямое подключение';
    } else {
      const s = p2pActiveStrategy();
      sEl.innerHTML = (typeof _emojiImg==='function' ? _emojiImg(s.emoji,13) : s.emoji) + ' Канал: ' + s.label;
    }
  }
}




// Заполнить поля настроек при открытии
const _origShowScreenForSb = window.showScreen;
window.showScreen = (function(orig) {
  return function(id, dir) {
    if (id === 's-settings') {
      sbFillSettings();
      _renderEmojiStyleToggle(_emojiStyleEnabled());
    }
    if (orig) orig(id, dir);
    // Пересканируем активный экран на emoji после показа
    if (_emojiStyleEnabled() && _emojiPackReady) {
      const screen = document.getElementById(id);
      if (screen) setTimeout(() => _localEmojiParse(screen), 50);
    }
  };
})(window.showScreen);

// ══ ЭКРАН ОНЛАЙН ═════════════════════════════════════════════════
async function onlineRefresh() {
  const btn = document.getElementById('online-refresh-btn');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  try {
    // Обновляем своё присутствие и сразу получаем всех
    const p = profileLoad();
    if (p && sbReady()) await sbPresencePut(p);
    await sbPollPresence();
  } catch(e) {}
  profileRenderOnline();
  if (btn) { btn.textContent = '↩ Обновить'; btn.disabled = false; }
}

let _onlineSearchTimer = null;
function profileRenderOnline() {
  const list = document.getElementById('online-list');
  const hdr  = document.getElementById('online-count-hdr');
  if (!list) return;
  const p    = profileLoad();
  const raw  = (document.getElementById('online-search')?.value || '').trim();
  const friends   = friendsLoad();
  const isAtSearch = raw.startsWith('@');
  const searchVal  = isAtSearch ? raw.slice(1).toLowerCase() : raw.toLowerCase();

  // Обновляем счётчик в заголовке
  if (hdr) {
    if (!raw) {
      const onlineFriends = friends.filter(u => _profileOnlinePeers.some(x => x.username === u));
      const total = friends.length;
      hdr.textContent = total
        ? total + ' ' + (total===1?'друг':total<5?'друга':'друзей') + (onlineFriends.length ? ' · ' + onlineFriends.length + ' онлайн' : '')
        : 'Нет друзей';
    } else {
      hdr.textContent = isAtSearch ? 'Поиск пользователей' : 'Поиск по друзьям';
    }
  }

  let peers = [];

  if (!raw) {
    // Без поиска: показываем ВСЕХ друзей (онлайн выше оффлайн)
    const friendUsers = friends.map(username => {
      const known = _allKnownUsers.find(x => x.username === username)
                  || _profileOnlinePeers.find(x => x.username === username);
      if (known) return known;
      // Друг есть в списке, но данных о нём нет   возвращаем заглушку
      return { username, name: username, avatar: '😊', color: 'var(--surface3)', _online: false };
    });
    // Сортируем: онлайн сначала
    friendUsers.sort((a, b) => {
      const ao = _profileOnlinePeers.some(x => x.username === a.username) ? 1 : 0;
      const bo = _profileOnlinePeers.some(x => x.username === b.username) ? 1 : 0;
      return bo - ao;
    });
    peers = friendUsers;
  } else if (isAtSearch) {
    // @поиск — только точное совпадение по полному нику
    peers = _allKnownUsers.filter(u =>
      u.username !== p?.username &&
      u.username?.toLowerCase() === searchVal
    );
  } else {
    // Обычный поиск — по имени только среди друзей
    peers = _allKnownUsers.filter(u =>
      friends.includes(u.username) &&
      (u.name?.toLowerCase().includes(searchVal) || u.username?.toLowerCase().includes(searchVal))
    );
  }

  const hintEl = document.getElementById('online-search-hint');
  if (hintEl) {
    if (!raw)            hintEl.textContent = '';
    else if (isAtSearch) hintEl.textContent = '🔍 Введи точный @юзернейм для поиска';
    else                 hintEl.textContent = '👥 Поиск по имени/нику среди друзей';
  }

  if (peers.length === 0) {
    let emptyText = !raw
      ? '👥 Нет друзей. Найди людей через @поиск и добавь в друзья!'
      : isAtSearch ? '🔍 Введи полный ник: @' + searchVal
                   : 'Друзей с именем «' + raw + '» не найдено';
    list.innerHTML = `<div style="color:var(--muted);text-align:center;padding:30px;font-size:13px;line-height:1.6" id="online-empty-msg">${emptyText}</div>`;
  }

  // Supabase-поиск при @поиске — только точное совпадение
  if (isAtSearch && searchVal && sbReady()) {
    clearTimeout(_onlineSearchTimer);
    _onlineSearchTimer = setTimeout(async () => {
      try {
        const q = encodeURIComponent(searchVal);
        // ilike.val — точное совпадение (без звёздочек), нечувствительно к регистру
        const rows = await sbGet('presence', `select=*&username=ilike.${q}&limit=5`);
        if (!Array.isArray(rows)) return;
        let added = false;
        rows.forEach(u => {
          if (u.username === p?.username) return;
          if (!_allKnownUsers.some(x => x.username === u.username)) {
            _allKnownUsers.push({
              username: u.username, name: u.name,
              avatar: u.avatar, avatarType: u.avatar_type,
              avatarData: u.avatar_data, color: u.color,
              status: u.status, vip: u.vip, badge: u.badge, _online: false
            });
            added = true;
          }
        });
        if (added) profileRenderOnline();
        else if (peers.length === 0) {
          const el = document.getElementById('online-empty-msg');
          if (el) el.textContent = 'Пользователь @' + searchVal + ' не найден';
        }
      } catch(e) {
        if (peers.length === 0) {
          const el = document.getElementById('online-empty-msg');
          if (el) el.textContent = 'Ошибка поиска';
        }
      }
    }, 400);
  }

  // При пустом списке, но есть друзья без данных   подгружаем с сервера
  if (!raw && friends.length && sbReady()) {
    const unknownFriends = friends.filter(u => !_allKnownUsers.some(x => x.username === u));
    if (unknownFriends.length) {
      const unames = unknownFriends.slice(0,20).map(u => '"'+u+'"').join(',');
      sbGet('users', `select=username,name,avatar,avatar_type,avatar_data,color,status,vip,badge&username=in.(${unames})&limit=20`)
        .then(rows => {
          if (!Array.isArray(rows)) return;
          let added = false;
          rows.forEach(u => {
            if (!_allKnownUsers.some(x => x.username === u.username)) {
              _allKnownUsers.push({ username: u.username, name: u.name, avatar: u.avatar,
                avatarType: u.avatar_type, avatarData: u.avatar_data, color: u.color,
                status: u.status, vip: u.vip, badge: u.badge, _online: false });
              added = true;
            }
          });
          if (added) profileRenderOnline();
        }).catch(()=>{});
    }
  }

  if (peers.length === 0) return;
  list.innerHTML = peers.map(u => {
    const statusObj = PROFILE_STATUSES.find(s => s.id === u.status) || PROFILE_STATUSES[0];
    const isFriend = friendsLoad().includes(u.username);
    const isMe = u._isMe;
    const isOnline = u._isMe || u._online || _profileOnlinePeers.some(x => x.username === u.username);
    const badgeObj = typeof PROFILE_BADGES !== 'undefined' && u.badge
      ? PROFILE_BADGES.find(b => b.id === u.badge) : null;
    return `
      <div class="online-user-row" onclick="${isMe ? '' : `peerProfileOpen('${escHtml(u.username)}')`}"
        style="cursor:${isMe ? 'default' : 'pointer'};-webkit-tap-highlight-color:transparent">
        <div style="width:48px;height:48px;border-radius:50%;background:${u.color||'var(--surface3)'};display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;position:relative">
          ${u.avatarType === 'photo' && u.avatarData
            ? `<img src="${u.avatarData}" style="width:48px;height:48px;border-radius:50%;object-fit:cover">`
            : (u.avatar || '😊')}
          <div style="position:absolute;bottom:1px;right:1px;width:12px;height:12px;border-radius:50%;background:${isOnline?'#4caf7d':'#666'};border:2px solid var(--surface)"></div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${escHtml(u.name)}
            ${isMe ? '<span style="color:var(--accent);font-size:11px">(ты)</span>' : ''}
            ${u.vip ? `<span style="font-size:10px;font-weight:800;background:linear-gradient(90deg,#f5c518,#e87722);color:#000;padding:2px 6px;border-radius:6px">${_emojiImg('👑',10)} VIP</span>` : ''}
            ${badgeObj ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:${badgeObj.color}22;color:${badgeObj.color}">${_emojiImg(badgeObj.emoji,12)} ${badgeObj.label}</span>` : ''}
          </div>
          <div style="font-size:12px;color:var(--muted)">@${escHtml(u.username)}</div>
          <div style="font-size:11px;color:${isOnline?statusObj.color:'var(--muted)'};margin-top:2px">${isOnline ? _emojiImg(statusObj.emoji,12)+' '+statusObj.label : _emojiImg('⚡',12)+' Не в сети'}</div>
        </div>
        ${!isMe && !isFriend ? `<button class="btn btn-surface" style="width:auto;padding:6px 12px;font-size:11px;flex-shrink:0" onclick="event.stopPropagation();profileAddFriend('${escHtml(u.username)}')">+ Друг</button>` : ''}
        ${isFriend && !isMe ? '<span style="font-size:18px;flex-shrink:0">👥</span>' : ''}
      </div>
    `;
  }).join('');
}

async function profileRemoveFriend(username) {
  const friends = friendsLoad();
  friendsSave(friends.filter(u => u !== username));
  toast('❌ @' + username + ' удалён из друзей');
  profileRenderOnline();
  // Синхронизируем на сервер
  const p = profileLoad();
  if (p && sbReady()) {
    const updated = friendsLoad();
    _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(p.username)}`,
      { friends: JSON.stringify(updated) },
      { 'Content-Type':'application/json','Prefer':'return=minimal' }).catch(()=>{});
  }
}

async function profileAddFriend(username) {
  const friends = friendsLoad();
  if (!friends.includes(username)) {
    friends.push(username);
    friendsSave(friends);
    toast('👥 @' + username + ' добавлен в друзья!');
    // Запустить стрим сообщений для этого чата
    const p = profileLoad();
    if (p) {
      sbPollChat(p.username, username);
      // Синхронизируем на сервер
      if (sbReady()) {
        _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(p.username)}`,
          { friends: JSON.stringify(friends) },
          { 'Content-Type':'application/json','Prefer':'return=minimal' }).catch(()=>{});
      }
    }
  }
  profileRenderOnline();
}

// Синхронизация друзей с сервера при входе
async function syncFriendsFromServer(username) {
  if (!sbReady() || !username) return;
  try {
    const rows = await sbGet('users', `select=friends&username=eq.${encodeURIComponent(username)}&limit=1`);
    if (!Array.isArray(rows) || !rows.length) return;
    const raw = rows[0].friends;
    if (!raw) return;
    const serverFriends = JSON.parse(raw);
    if (!Array.isArray(serverFriends)) return;
    // Объединяем: локальные + серверные (union без дублей)
    const local   = friendsLoad();
    const merged  = [...new Set([...local, ...serverFriends])];
    friendsSave(merged);
    // Если изменилось   запускаем polling для новых чатов
    serverFriends.forEach(u => { if (!local.includes(u)) sbPollChat(username, u); });
  } catch(e) {}
}

// ══ ХУКИ: показ экрана профиля ═══════════════════════════════════
const _origShowScreen = window.showScreen;
window.showScreen = function(id, dir) {
  // Набор всех экранов чата   если уходим с любого из них, чистим меню
  const CHAT_SCREENS = new Set(['s-messenger-chat', 's-groups-chat']);
  const prevActive = document.querySelector('.screen.active');
  const prevId = prevActive ? prevActive.id : null;

  // При уходе из чата (не в другой чат)   закрываем ВСЕ меню и оверлеи
  if (!CHAT_SCREENS.has(id)) {
    // Меню действий с сообщением
    const menu = document.getElementById('mc-msg-menu');
    if (menu) menu.remove();
    // Меню пересылки
    const fwdSheet = document.getElementById('mc-forward-sheet');
    if (fwdSheet) fwdSheet.remove();
    // Видеоплеер
    const videoOv = document.getElementById('mc-video-overlay');
    if (videoOv) videoOv.remove();
    // Стикер-панель
    const stickerPanel = document.getElementById('mc-sticker-panel');
    if (stickerPanel) stickerPanel.style.display = 'none';
    _mcStickerPanelOpen = false;
    // Бар ответа
    mcCancelReply && mcCancelReply();
    // Скрываем клавиатуру   blur + фокус на body чтобы гарантированно закрыть
    const inp = document.getElementById('mc-input');
    if (inp) {
      inp.blur();
      // На Android WebView blur() иногда не закрывает клавиатуру без явного переноса фокуса
      try { document.activeElement?.blur(); } catch(_) {}
    }
    // Сбрасываем клавиатурный сдвиг хедера
    const chatHdr = document.querySelector('#s-messenger-chat .hdr');
    if (chatHdr) chatHdr.style.transform = '';
  }
  if (id === 's-profile')     profileRenderScreen();
  if (id === 's-online')      profileRenderOnline();
  if (id === 's-leaderboard') leaderboardRender();
  if (id === 's-messenger')   messengerRenderList();
  // При заходе в чат   сразу скроллим вниз, клавиатуру НЕ открываем
  if (id === 's-messenger-chat') {
    // Убеждаемся что фокус НЕ на поле ввода при входе
    const inp = document.getElementById('mc-input');
    if (inp && document.activeElement === inp) inp.blur();
    // Скролл вниз   сразу после рендера
    requestAnimationFrame(() => {
      const body = document.getElementById('mc-messages');
      if (body) body.scrollTop = body.scrollHeight;
    });
    // И ещё раз через 100мс после полной отрисовки
    setTimeout(() => {
      const body = document.getElementById('mc-messages');
      if (body) body.scrollTop = body.scrollHeight;
    }, 100);
  }
  if (_origShowScreen) _origShowScreen(id, dir);
};

// Обновить nav items (4 кнопки: home, bells, messenger, profile)
const _origUpdateNavActive = window.updateNavActive;
window.updateNavActive = function(aid) {
  ['nav-home','nav-bells','nav-messenger','nav-profile'].forEach(id =>
    document.getElementById(id)?.classList.toggle('active', id === aid)
  );
  if (typeof _navMovePill === 'function') _navMovePill(aid);
};

// ══════════════════════════════════════════════════════════════════════
// 👥 ГРУППЫ
// ══════════════════════════════════════════════════════════════════════
const GROUPS_KEY      = 'sapp_groups_v1';
const PUBLIC_GROUP_ID          = 'public_bugs_ideas_v1';
const PUBLIC_GROUP_COOLDOWN_KEY = 'sapp_pg_cd_v1';
const PUBLIC_GROUP_COOLDOWN_MS  = 60 * 60 * 1000;
function groupsLoad() {
  try {
    const arr = JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]');
    if (!arr.find(g => g.id === PUBLIC_GROUP_ID)) arr.unshift(_publicGroupDef());
    return arr;
  } catch(e) { return [_publicGroupDef()]; }
}
function groupsSave(g) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(g));
  // Синхронизируем список групп с Java-слоем — фоновый сервис поллит групповые сообщения
  if (window.Android && typeof window.Android.saveUserGroups === 'function') {
    try {
      const p = profileLoad();
      if (p) window.Android.saveUserGroups(p.username, JSON.stringify(g));
    } catch(_) {}
  }
}

function _publicGroupDef() {
  return {
    id: PUBLIC_GROUP_ID, name: '💡 Баги и идеи', avatar: '💡',
    members: ['__all__'], createdBy: '__system__', ts: 0, isPublic: true,
    description: 'Чат для сообщений об ошибках и идей. Лимит   1 сообщение в час.'
  };
}
function _publicGroupCooldown(username) {
  if (!username) return { ok: false, remainMs: PUBLIC_GROUP_COOLDOWN_MS };
  try {
    const map  = JSON.parse(localStorage.getItem(PUBLIC_GROUP_COOLDOWN_KEY) || '{}');
    const elapsed = Date.now() - (map[username] || 0);
    if (elapsed >= PUBLIC_GROUP_COOLDOWN_MS) return { ok: true, remainMs: 0 };
    return { ok: false, remainMs: PUBLIC_GROUP_COOLDOWN_MS - elapsed };
  } catch(e) { return { ok: true, remainMs: 0 }; }
}
function _publicGroupCooldownSet(username) {
  try {
    const map = JSON.parse(localStorage.getItem(PUBLIC_GROUP_COOLDOWN_KEY) || '{}');
    map[username] = Date.now();
    localStorage.setItem(PUBLIC_GROUP_COOLDOWN_KEY, JSON.stringify(map));
  } catch(e) {}
}
function _fmtRemain(ms) {
  const m = Math.floor(ms / 60000), s = String(Math.round((ms % 60000) / 1000)).padStart(2,'0');
  return m > 0 ? m + ' мин ' + s + ' сек' : Math.round(ms/1000) + ' сек';
}

async function groupCreate(name, members) {
  const groups = groupsLoad();
  const id  = 'grp_' + Date.now();
  const p   = profileLoad();
  const allMembers = [p.username, ...members.filter(u => u !== p.username)];
  const group = {
    id, name, avatar: '👥',
    members: allMembers,
    createdBy: p.username,
    ts: Date.now()
  };
  groups.push(group);
  groupsSave(groups);
  toast('👥 Группа «' + name + '» создана!');

  // Запускаем polling входящих сообщений группы
  sbPollGroupChat(p.username, group);

  if (!sbReady()) return group;

  const groupJson = JSON.stringify(group);

  // Сохраняем себе
  _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(p.username)}`,
    { groups: JSON.stringify(groups) },
    { 'Content-Type':'application/json','Prefer':'return=minimal' }).catch(()=>{});

  // Уведомляем каждого участника двумя способами:
  // 1) Патчим users.groups   они получат при следующем syncGroupsFromServer
  // 2) Шлём им системное сообщение в inbox   они получат НЕМЕДЛЕННО через inbox-поллинг
  for (const member of allMembers.filter(u => u !== p.username)) {
    try {
      // Способ 1: патчим users.groups
      const rows = await sbGet('users', `select=groups&username=eq.${encodeURIComponent(member)}&limit=1`);
      const existingRaw = rows?.[0]?.groups;
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      if (!existing.find(g => g.id === group.id)) {
        existing.push(group);
        _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(member)}`,
          { groups: JSON.stringify(existing) },
          { 'Content-Type':'application/json','Prefer':'return=minimal' }).catch(()=>{});
      }
      // Способ 2: системное inbox-сообщение с данными группы
      await sbInsert('messages', {
        chat_key: sbChatKey(p.username, member),
        from_user: p.username,
        to_user: member,
        text: '👥 Добавил(а) тебя в группу «' + name + '»',
        ts: Date.now(),
        extra: JSON.stringify({ type: 'group_invite', group: group })
      });
    } catch(e) {}
  }
  return group;
}

// Синхронизация групп с сервера при входе
async function syncGroupsFromServer(username) {
  if (!sbReady() || !username) return;
  try {
    const rows = await sbGet('users', `select=groups&username=eq.${encodeURIComponent(username)}&limit=1`);
    if (!Array.isArray(rows) || !rows.length) return;
    const raw = rows[0].groups;
    const serverGroups = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(serverGroups)) return;
    const local = groupsLoad();
    // Сервер — источник истины для групп.
    // Старая логика (additive merge) оставляла удалённые группы в локальном кэше.
    // Теперь: берём серверный список, добавляем только те локальные группы,
    // которые были созданы офлайн (есть локально, нет на сервере) — edge case.
    const localOnlyGroups = local.filter(lg =>
      lg.id !== PUBLIC_GROUP_ID && !serverGroups.find(sg => sg.id === lg.id)
    );
    // localOnlyGroups почти всегда пуст (groupCreate всегда пишет на сервер).
    // Это подстраховка на случай потери связи при создании группы.
    const merged = [...serverGroups, ...localOnlyGroups];
    groupsSave(merged);

    // ┄┄ Авто-вступление в публичную группу ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
    // Проверяем: есть ли пользователь в members публичной группы на сервере
    const pgInServer = serverGroups.find(g => g.id === PUBLIC_GROUP_ID);
    const pgLocal    = merged.find(g => g.id === PUBLIC_GROUP_ID);
    const alreadyMember = pgInServer?.members?.includes(username) || pgLocal?.members?.includes('__all__');
    if (!alreadyMember) {
      // Добавляем пользователя в публичную группу на сервере
      const pubGroup = _publicGroupDef();
      pubGroup.members = [username]; // сервер хранит реальный список
      const newServerGroups = [...serverGroups.filter(g => g.id !== PUBLIC_GROUP_ID), pubGroup];
      // PATCH users.groups
      await _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(username)}`,
        { groups: JSON.stringify(newServerGroups) },
        { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
      ).catch(() => {});
    }
  } catch(e) {}
}

function groupGet(id) {
  return groupsLoad().find(g => g.id === id) || null;
}

// ══════════════════════════════════════════════════════════════════════
// ⚙️ НАСТРОЙКИ ГРУППЫ   Telegram-style
// ══════════════════════════════════════════════════════════════════════

/** Открывает экран настроек группы (как в Telegram) */
function showGroupSettings(groupId) {
  const group = groupGet(groupId);
  if (!group) return;
  const p = profileLoad();
  const isCreator = group.createdBy === p?.username;
  const isPublic  = group.id === PUBLIC_GROUP_ID;

  const existing = document.getElementById('group-settings-screen');
  if (existing) existing.remove();

  const screen = document.createElement('div');
  screen.id = 'group-settings-screen';
  screen.style.cssText = 'position:fixed;inset:0;z-index:9600;background:var(--bg);display:flex;flex-direction:column;animation:mcSlideRight .22s cubic-bezier(.34,1.1,.64,1)';

  const avatarBg = isPublic
    ? 'linear-gradient(135deg,var(--accent),var(--accent2,#c45f0a))'
    : 'linear-gradient(135deg,#2b5797,#1e3f6f)';
  const memberCount = group.members.length;
  const memberWord  = memberCount===1?'участник':memberCount<5?'участника':'участников';

  // Аватар группы — кликабельный для смены (только создатель)
  const avatarClick = (!isPublic && isCreator) ? `onclick="groupPickAvatar('${groupId}')"` : '';
  const avatarCursor = (!isPublic && isCreator) ? 'cursor:pointer' : '';
  const _gsAvatarInner = (group.avatarType === 'photo' && group.avatarData)
    ? `<img class="gs-av-photo" src="${group.avatarData}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;position:absolute;inset:0"><span id="gs-avatar-emoji" style="display:none">${group.avatar||'👥'}</span>`
    : `<span id="gs-avatar-emoji">${group.avatar||'👥'}</span>`;

  screen.innerHTML = `
    <style>
      @keyframes mcSlideRight { from{transform:translateX(100%)} to{transform:none} }
      .gs-btn { width:100%;padding:16px 20px;background:none;border:none;color:var(--text);font-family:inherit;font-size:15px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:14px;-webkit-tap-highlight-color:transparent }
      .gs-btn:active { background:rgba(255,255,255,.06) }
      .gs-btn.danger { color:var(--danger,#c94f4f) }
      .gs-sep { height:1px;background:rgba(255,255,255,.06);margin:0 20px }
    </style>

    <!-- Шапка с кнопкой назад -->
    <div style="display:flex;align-items:center;gap:0;padding:calc(var(--safe-top,44px) + 4px) 8px 0;flex-shrink:0;min-height:56px">
      <button onclick="document.getElementById('group-settings-screen').remove()"
        class="hdr-back" style="padding:8px 12px">Назад</button>
      <div style="flex:1;text-align:center;font-size:17px;font-weight:700;margin-right:60px">Настройки группы</div>
    </div>

    <div style="flex:1;overflow-y:auto;padding-bottom:calc(24px + var(--safe-bot))">

      <!-- Аватар и название -->
      <div style="display:flex;flex-direction:column;align-items:center;padding:24px 20px 20px">
        <div ${avatarClick} style="width:80px;height:80px;border-radius:50%;background:${avatarBg};display:flex;align-items:center;justify-content:center;font-size:40px;position:relative;${avatarCursor}" id="gs-avatar-wrap">
          ${_gsAvatarInner}
          ${(!isPublic && isCreator) ? '<div style="position:absolute;bottom:0;right:0;width:26px;height:26px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></div>' : ''}
        </div>
        <div style="margin-top:12px;font-size:20px;font-weight:700;color:var(--text);text-align:center" id="gs-name-display">${escHtml(group.name)}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:4px">${memberCount} ${memberWord}</div>
        ${isPublic ? '<div style="font-size:11px;color:var(--accent);margin-top:4px;font-weight:600">Публичная группа</div>' : ''}
        ${isCreator && !isPublic ? '<div style="font-size:11px;color:var(--muted);margin-top:4px">Вы   создатель</div>' : ''}
      </div>

      <!-- Описание группы (если есть) -->
      ${group.description ? `<div style="background:var(--surface2);border-radius:14px;margin:0 16px 12px;padding:12px 16px;font-size:14px;color:var(--muted);line-height:1.5">${escHtml(group.description)}</div>` : ''}

      <!-- Секция: Изменить группу (только создатель) -->
      ${!isPublic && isCreator ? `
      <div style="background:var(--surface);border-radius:16px;margin:0 16px 12px;overflow:hidden">
        <button class="gs-btn" onclick="groupRenameDialog('${groupId}')">
          <span style="width:34px;height:34px;border-radius:10px;background:#2b5797;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </span>
          <div style="flex:1">
            <div>Изменить название</div>
            <div style="font-size:12px;color:var(--muted)">${escHtml(group.name)}</div>
          </div>
          <span style="color:var(--muted)"> </span>
        </button>
        <div class="gs-sep"></div>
        <button class="gs-btn" onclick="groupEditDescription('${groupId}')">
          <span style="width:34px;height:34px;border-radius:10px;background:#1a7a3a;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8zm0-4h8v2H8zm0-4h5v2H8z"/></svg>
          </span>
          <div style="flex:1">
            <div>Описание</div>
            <div style="font-size:12px;color:var(--muted)">${group.description ? escHtml(group.description.slice(0,40)) + (group.description.length>40?' ':'') : 'Добавить описание'}</div>
          </div>
          <span style="color:var(--muted)"> </span>
        </button>
      </div>` : ''}

      <!-- Секция: Участники -->
      <div style="padding:8px 20px 4px;font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.06em;text-transform:uppercase">Участники</div>
      <div style="background:var(--surface);border-radius:16px;margin:0 16px 12px;overflow:hidden" id="gs-members-list">
        ${_gsRenderMembers(group, p, isCreator)}
        ${isCreator && !isPublic ? `
        <div class="gs-sep"></div>
        <button class="gs-btn" onclick="groupAddMemberDialog('${groupId}')">
          <span style="width:34px;height:34px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </span>
          Добавить участника
        </button>` : ''}
      </div>

      <!-- Секция: Уведомления -->
      <div style="background:var(--surface);border-radius:16px;margin:0 16px 12px;overflow:hidden">
        <button class="gs-btn" onclick="peerMuteShow('${groupId}');document.getElementById('group-settings-screen').remove()">
          <span style="width:34px;height:34px;border-radius:10px;background:#6d4c9e;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="${isMuted(groupId)?'M11 7.17V4.06c-.38.05-.75.14-1.1.27L7.81 2.24A9.9 9.9 0 0 1 12 1.5c4.97 0 9 4.03 9 9 0 1.46-.35 2.83-.97 4.04l-1.68-1.68A6.97 6.97 0 0 0 19 10.5c0-3.97-3.18-7.2-8-7.33zm7.26 14.09L17 19.85V20H7l-2-2v-1l-2-2v-1l16 16-1.74-1.74zM11 7.17L13 9.17V10.5c0 .55-.45 1-1 1H9.83l1.17 1.17V10.5c0 1.38-.56 2.63-1.46 3.54L7 15.83V17l2 2h8.17l2 2H5.17l-.88-.88-2.84-2.84L0 14.56l1.41-1.41L2 13.97V10.5C2 7.15 4.85 4.47 8.6 4.06L11 6.46v.71z':'M11 3.07V2.05A10.003 10.003 0 0 0 2 12c0 5.52 4.48 10 10 10s10-4.48 10-10c0-4.93-3.55-9.02-8.25-9.84v2.04C16.74 5.05 20 8.31 20 12c0 4.42-3.58 8-8 8s-8-3.58-8-8c0-3.69 3.26-6.95 7-7.93zM12 8v5l4.28 2.54.72-1.21-3.5-2.08V8H12zm-1-5.07V5h2V2.93c-.33-.05-.66-.08-1-.08-.34 0-.67.03-1 .08z'}"/></svg>
          </span>
          <div style="flex:1">${isMuted(groupId) ? 'Включить уведомления' : 'Отключить уведомления'}</div>
          <span style="color:var(--muted)"> </span>
        </button>
      </div>

      <!-- Секция: Опасные действия -->
      <div style="background:var(--surface);border-radius:16px;margin:0 16px 12px;overflow:hidden">
        ${!isPublic ? `
        <button class="gs-btn danger" onclick="groupLeaveConfirm('${groupId}')">
          <span style="width:34px;height:34px;border-radius:10px;background:rgba(201,79,79,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#c94f4f"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>
          </span>
          Покинуть группу
        </button>
        ${isCreator ? `<div class="gs-sep"></div>` : ''}` : ''}
        ${isCreator && !isPublic ? `
        <button class="gs-btn danger" onclick="groupDeleteForAll('${groupId}')">
          <span style="width:34px;height:34px;border-radius:10px;background:rgba(201,79,79,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#c94f4f"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </span>
          Удалить группу для всех
        </button>` : ''}
      </div>

    </div>`;

  document.body.appendChild(screen);
}

/** Рендерит список участников группы */
function _gsRenderMembers(group, p, isCreator) {
  return group.members.map((username, idx) => {
    const peer = _allKnownUsers.find(u => u.username === username)
              || _profileOnlinePeers.find(u => u.username === username);
    const name = peer?.name || username;
    const isMe = username === p?.username;
    const isOwner = username === group.createdBy;
    const isOnline = _profileOnlinePeers.some(u => u.username === username);
    const hasPhoto = (peer?.avatarType==='photo'||peer?.avatar_type==='photo') && (peer?.avatarData||peer?.avatar_data);
    const avatarInner = hasPhoto
      ? `<img src="${peer.avatarData||peer.avatar_data}" style="width:40px;height:40px;border-radius:50%;object-fit:cover">`
      : `${_emojiImg(peer?.avatar||'😊',22)}`;

    const canRemove = isCreator && !isMe && !group.isPublic;
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;${idx>0?'border-top:1px solid rgba(255,255,255,.05)':''}">
      <div style="width:40px;height:40px;border-radius:50%;background:${peer?.color||'var(--surface3)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;position:relative">
        ${avatarInner}
        ${isOnline?'<div style="position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;background:#4caf7d;border:2px solid var(--surface)"></div>':''}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(name)}${isMe?' <span style="font-size:11px;color:var(--muted)">(вы)</span>':''}</div>
        <div style="font-size:12px;color:${isOwner?'var(--accent)':'var(--muted)'}">@${escHtml(username)}${isOwner?' · создатель':''}</div>
      </div>
      ${canRemove?`<button onclick="groupKickMember('${group.id}','${escHtml(username)}')" style="background:none;border:none;color:var(--muted);font-size:20px;padding:4px 8px;cursor:pointer;line-height:1">×</button>`:''}
    </div>`;
  }).join('');
}

// ┄┄ Переименование группы ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function groupRenameDialog(groupId) {
  const group = groupGet(groupId);
  if (!group) return;
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;animation:mcFadeIn .15s ease';
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px;padding:24px 20px;width:100%;max-width:340px" onclick="event.stopPropagation()">
      <div style="font-size:17px;font-weight:700;margin-bottom:16px">Изменить название</div>
      <input id="group-rename-inp" class="inp" value="${escHtml(group.name)}" placeholder="Название группы" style="margin-bottom:16px">
      <div style="display:flex;gap:10px">
        <button class="btn btn-surface" style="flex:1" onclick="this.closest('[style*=fixed]').remove()">Отмена</button>
        <button class="btn btn-accent" style="flex:1" onclick="groupRenameSubmit('${groupId}')">Сохранить</button>
      </div>
    </div>`;
  sheet.addEventListener('click', () => sheet.remove());
  document.body.appendChild(sheet);
  setTimeout(() => document.getElementById('group-rename-inp')?.focus(), 100);
}

async function groupRenameSubmit(groupId) {
  const inp = document.getElementById('group-rename-inp');
  const newName = inp?.value.trim();
  if (!newName) { toast('Введи название'); return; }
  document.querySelector('[style*="fixed"][style*="align-items:center"]')?.remove();

  const groups = groupsLoad();
  const g = groups.find(x => x.id === groupId);
  if (!g) return;
  g.name = newName;
  groupsSave(groups);

  // Обновляем на сервере для всех участников
  const p = profileLoad();
  if (sbReady() && p) {
    for (const member of g.members) {
      try {
        const rows = await sbGet('users', `select=groups&username=eq.${encodeURIComponent(member)}&limit=1`);
        const existing = rows?.[0]?.groups ? JSON.parse(rows[0].groups) : [];
        const idx = existing.findIndex(x => x.id === groupId);
        if (idx !== -1) { existing[idx].name = newName; }
        else existing.push(g);
        _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(member)}`,
          { groups: JSON.stringify(existing) },
          { 'Content-Type':'application/json','Prefer':'return=minimal' }).catch(()=>{});
      } catch(e) {}
    }
    // Системное сообщение в группу
    await sbInsert('messages', {
      chat_key: groupChatKey(groupId),
      from_user: p.username, to_user: '__broadcast__',
      text: '✏️ ' + p.username + ' переименовал группу в «' + newName + '»',
      ts: Date.now(), extra: JSON.stringify({ type: 'group_rename', newName, groupId })
    }).catch(()=>{});
  }

  // Обновляем UI
  const nameEl = document.getElementById('gs-name-display');
  if (nameEl) nameEl.textContent = newName;
  if (_msgCurrentChat === groupId) {
    const hdr = document.getElementById('mc-hdr-name');
    if (hdr) hdr.textContent = newName;
  }
  renderGroupsList();
  toast('✅ Название изменено');
}

// ┄┄ Описание группы ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function groupEditDescription(groupId) {
  const group = groupGet(groupId);
  if (!group) return;
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;animation:mcFadeIn .15s ease';
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px;padding:24px 20px;width:100%;max-width:340px" onclick="event.stopPropagation()">
      <div style="font-size:17px;font-weight:700;margin-bottom:16px">Описание группы</div>
      <textarea id="group-desc-inp" class="inp" placeholder="Опиши группу..." style="margin-bottom:16px;min-height:80px;resize:none">${escHtml(group.description||'')}</textarea>
      <div style="display:flex;gap:10px">
        <button class="btn btn-surface" style="flex:1" onclick="this.closest('[style*=fixed]').remove()">Отмена</button>
        <button class="btn btn-accent" style="flex:1" onclick="groupSaveDescription('${groupId}')">Сохранить</button>
      </div>
    </div>`;
  sheet.addEventListener('click', () => sheet.remove());
  document.body.appendChild(sheet);
}

function groupSaveDescription(groupId) {
  const desc = document.getElementById('group-desc-inp')?.value.trim() || '';
  document.querySelector('[style*="fixed"][style*="align-items:center"]')?.remove();
  const groups = groupsLoad();
  const g = groups.find(x => x.id === groupId);
  if (!g) return;
  g.description = desc;
  groupsSave(groups);
  toast('✅ Описание сохранено');
  // Обновляем на сервере
  const p = profileLoad();
  if (sbReady() && p) {
    _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(p.username)}`,
      { groups: JSON.stringify(groups) },
      { 'Content-Type':'application/json','Prefer':'return=minimal' }).catch(()=>{});
  }
  showGroupSettings(groupId); // перерендерим
}

// ┄┄ Смена аватара (эмодзи) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function groupPickAvatar(groupId) {
  const EMOJIS = ['👥','🎮','📚','🎵','🏆','🔥','💡','🚀','🌟','🎯','💪','🎉','🌈','🐉','⚡','🎭','🏠','🌍','🎨','🤝','💼','🎓','🏋','🎤','🌺'];
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(0,0,0,.55);display:flex;flex-direction:column;justify-content:flex-end;animation:mcFadeIn .15s ease';
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:16px;animation:mcSlideUp .22s cubic-bezier(.34,1.1,.64,1)" onclick="event.stopPropagation()">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:0 auto 16px"></div>
      <div style="font-size:15px;font-weight:700;margin-bottom:14px">Аватар группы</div>
      <button id="grp-av-photo-btn" style="width:100%;padding:13px 16px;background:var(--surface2);border:1.5px dashed var(--surface3);border-radius:14px;color:var(--accent);font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:14px;-webkit-tap-highlight-color:transparent">
        📷 Загрузить фото
      </button>
      <input type="file" id="grp-av-file-inp" accept="image/*" style="display:none">
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Или выбери эмодзи:</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px">
        ${EMOJIS.map(e => `<button onclick="groupSetAvatar('${groupId}','${e}');this.closest('[style*=fixed]').remove()" style="background:var(--surface2);border:none;border-radius:12px;padding:10px;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center">${typeof _emojiImg==="function"?_emojiImg(e,28):e}</button>`).join('')}
      </div>
    </div>`;
  sheet.addEventListener('click', () => sheet.remove());
  document.body.appendChild(sheet);

  // Фото: кнопка → input → crop
  sheet.querySelector('#grp-av-photo-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    sheet.querySelector('#grp-av-file-inp').click();
  });
  sheet.querySelector('#grp-av-file-inp').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      sheet.remove();
      openImageCrop(ev.target.result, {
        mode: 'avatar',
        onDone: (cropped) => groupSetAvatarPhoto(groupId, cropped)
      });
    };
    reader.readAsDataURL(file);
  });
}

function groupSetAvatar(groupId, emoji) {
  const groups = groupsLoad();
  const g = groups.find(x => x.id === groupId);
  if (!g) return;
  g.avatar = emoji;
  g.avatarType = 'emoji';
  g.avatarData = null;
  groupsSave(groups);
  // Обновляем UI в экране настроек
  const wrap = document.getElementById('gs-avatar-wrap');
  if (wrap) {
    wrap.querySelector('img.gs-av-photo')?.remove();
    const span = document.getElementById('gs-avatar-emoji');
    if (span) { span.style.display = ''; span.textContent = emoji; }
  }
  renderGroupsList();
  toast('✅ Аватар изменён');
  const p = profileLoad();
  if (sbReady() && p) {
    _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(p.username)}`,
      { groups: JSON.stringify(groups) },
      { 'Content-Type':'application/json','Prefer':'return=minimal' }).catch(()=>{});
  }
}

// Сохраняет фото-аватарку для группы
function groupSetAvatarPhoto(groupId, dataUrl) {
  const groups = groupsLoad();
  const g = groups.find(x => x.id === groupId);
  if (!g) return;
  g.avatarType = 'photo';
  g.avatarData = dataUrl;
  g.avatar = '👥'; // fallback если фото не загрузится
  groupsSave(groups);
  // Обновляем аватар в экране настроек группы
  const wrap = document.getElementById('gs-avatar-wrap');
  if (wrap) {
    const span = document.getElementById('gs-avatar-emoji');
    if (span) span.style.display = 'none';
    // Убираем старое превью если есть
    wrap.querySelector('img.gs-av-photo')?.remove();
    const img = document.createElement('img');
    img.className = 'gs-av-photo';
    img.src = dataUrl;
    img.style.cssText = 'width:80px;height:80px;border-radius:50%;object-fit:cover;position:absolute;inset:0';
    wrap.style.position = 'relative';
    wrap.insertBefore(img, wrap.firstChild);
  }
  renderGroupsList();
  toast('✅ Фото установлено');
  const p = profileLoad();
  if (sbReady() && p) {
    _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(p.username)}`,
      { groups: JSON.stringify(groups) },
      { 'Content-Type':'application/json','Prefer':'return=minimal' }).catch(()=>{});
  }
}

// ┄┄ Добавление участника ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function groupAddMemberDialog(groupId) {
  const group = groupGet(groupId);
  if (!group) return;
  const friends = friendsLoad();
  const candidates = [
    ..._allKnownUsers.filter(u => friends.includes(u.username) && !group.members.includes(u.username)),
    ..._profileOnlinePeers.filter(u => !group.members.includes(u.username) && !friends.includes(u.username))
  ];
  const seen = new Set();
  const users = candidates.filter(u => { if(seen.has(u.username)) return false; seen.add(u.username); return true; });

  if (!users.length) { toast('Нет доступных пользователей для добавления'); return; }

  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9700;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.55);animation:mcFadeIn .15s ease';
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:16px;max-height:70vh;overflow-y:auto;animation:mcSlideUp .22s cubic-bezier(.34,1.1,.64,1)" onclick="event.stopPropagation()">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:0 auto 14px"></div>
      <div style="font-size:15px;font-weight:700;margin-bottom:12px">Добавить участника</div>
      ${users.map(u => {
        const isOnline = _profileOnlinePeers.some(x => x.username === u.username);
        return `<button onclick="groupAddMember('${groupId}','${escHtml(u.username)}');this.closest('[style*=fixed]').remove()"
          style="width:100%;background:none;border:none;color:var(--text);font-family:inherit;padding:10px 0;display:flex;align-items:center;gap:12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.05)">
          <div style="width:38px;height:38px;border-radius:50%;background:${u.color||'var(--surface3)'};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${_emojiImg(u.avatar||'😊',22)}</div>
          <div style="text-align:left">
            <div style="font-size:14px;font-weight:600">${escHtml(u.name||u.username)}</div>
            <div style="font-size:12px;color:${isOnline?'#4caf7d':'var(--muted)'}">@${escHtml(u.username)}${isOnline?' · онлайн':''}</div>
          </div>
        </button>`;
      }).join('')}
    </div>`;
  sheet.addEventListener('click', () => sheet.remove());
  document.body.appendChild(sheet);
}

async function groupAddMember(groupId, username) {
  const groups = groupsLoad();
  const g = groups.find(x => x.id === groupId);
  if (!g || g.members.includes(username)) return;
  g.members.push(username);
  groupsSave(groups);
  toast('✅ @' + username + ' добавлен(а) в группу');
  const p = profileLoad();
  if (!sbReady() || !p) return;
  // Уведомляем нового участника
  try {
    const rows = await sbGet('users', `select=groups&username=eq.${encodeURIComponent(username)}&limit=1`);
    const existing = rows?.[0]?.groups ? JSON.parse(rows[0].groups) : [];
    if (!existing.find(x => x.id === groupId)) {
      existing.push(g);
      _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(username)}`,
        { groups: JSON.stringify(existing) },
        { 'Content-Type':'application/json','Prefer':'return=minimal' }).catch(()=>{});
    }
    await sbInsert('messages', {
      chat_key: sbChatKey(p.username, username),
      from_user: p.username, to_user: username,
      text: '👥 Добавил(а) тебя в группу «' + g.name + '»',
      ts: Date.now(), extra: JSON.stringify({ type: 'group_invite', group: g })
    });
    // Системное сообщение в чат
    await sbInsert('messages', {
      chat_key: groupChatKey(groupId),
      from_user: p.username, to_user: '__broadcast__',
      text: '👤 ' + p.username + ' добавил(а) @' + username,
      ts: Date.now()
    });
  } catch(e) {}
  // Перерендерим настройки если открыты
  const screen = document.getElementById('group-settings-screen');
  if (screen) showGroupSettings(groupId);
}

// ┄┄ Исключить участника (только создатель) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
async function groupKickMember(groupId, username) {
  const group = groupGet(groupId);
  const p = profileLoad();
  if (!group || !p || group.createdBy !== p.username) return;
  if (!confirm('Исключить @' + username + ' из группы?')) return;

  const groups = groupsLoad();
  const g = groups.find(x => x.id === groupId);
  if (!g) return;
  g.members = g.members.filter(m => m !== username);
  groupsSave(groups);
  toast('🚫 @' + username + ' исключён из группы');

  if (!sbReady()) return;
  // Удаляем группу у исключённого
  try {
    const rows = await sbGet('users', `select=groups&username=eq.${encodeURIComponent(username)}&limit=1`);
    const existing = rows?.[0]?.groups ? JSON.parse(rows[0].groups) : [];
    _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(username)}`,
      { groups: JSON.stringify(existing.filter(x => x.id !== groupId)) },
      { 'Content-Type':'application/json','Prefer':'return=minimal' }).catch(()=>{});
    // Системное сообщение
    await sbInsert('messages', {
      chat_key: groupChatKey(groupId),
      from_user: p.username, to_user: '__broadcast__',
      text: '🚫 ' + p.username + ' исключил(а) @' + username,
      ts: Date.now()
    });
  } catch(e) {}
  showGroupSettings(groupId);
}

// ┄┄ Покинуть группу ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function groupLeaveConfirm(groupId) {
  const group = groupGet(groupId);
  const p = profileLoad();
  if (!group || !p) return;
  const isCreator = group.createdBy === p.username;

  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;animation:mcFadeIn .15s ease';
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px;padding:24px 20px;width:100%;max-width:320px" onclick="event.stopPropagation()">
      <div style="font-size:17px;font-weight:700;margin-bottom:8px">Покинуть группу?</div>
      <div style="font-size:14px;color:var(--muted);margin-bottom:20px;line-height:1.5">
        ${isCreator ? 'Вы создатель. При выходе группа останется для других участников, но вы потеряете управление.' : 'Вы покинете группу «' + escHtml(group.name) + '».'}
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-surface" style="flex:1" onclick="this.closest('[style*=fixed]').remove()">Отмена</button>
        <button class="btn" style="flex:1;background:var(--danger,#c94f4f);color:#fff" onclick="groupLeave('${groupId}');this.closest('[style*=fixed]').remove()">Покинуть</button>
      </div>
    </div>`;
  sheet.addEventListener('click', () => sheet.remove());
  document.body.appendChild(sheet);
}

async function groupLeave(groupId) {
  const p = profileLoad();
  const group = groupGet(groupId);
  if (!p || !group) return;

  // Удаляем локально
  const groups = groupsLoad().filter(g => g.id !== groupId);
  groupsSave(groups);
  const msgs = msgLoad();
  delete msgs[groupId];
  msgSave(msgs);
  const chats = chatsLoad().filter(u => u !== groupId);
  chatsSave(chats);
  _markChatDeleted(groupId);

  // Закрываем чат и настройки
  document.getElementById('group-settings-screen')?.remove();
  if (_msgCurrentChat === groupId) showScreen('s-groups-chat', 'back');
  renderGroupsList();
  messengerUpdateBadge();
  toast('Вы покинули группу');

  if (!sbReady()) return;
  // Обновляем свой список групп на сервере
  _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(p.username)}`,
    { groups: JSON.stringify(groups) },
    { 'Content-Type':'application/json','Prefer':'return=minimal' }).catch(()=>{});
  // Системное сообщение
  try {
    await sbInsert('messages', {
      chat_key: groupChatKey(groupId),
      from_user: p.username, to_user: '__broadcast__',
      text: '👋 @' + p.username + ' покинул(а) группу',
      ts: Date.now()
    });
  } catch(e) {}
}

// ┄┄ Удалить группу для всех (только создатель) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function groupDeleteForAll(groupId) {
  const group = groupGet(groupId);
  if (!group) return;
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;animation:mcFadeIn .15s ease';
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px;padding:24px 20px;width:100%;max-width:320px" onclick="event.stopPropagation()">
      <div style="font-size:17px;font-weight:700;margin-bottom:8px;color:var(--danger,#c94f4f)">Удалить группу для всех?</div>
      <div style="font-size:14px;color:var(--muted);margin-bottom:20px;line-height:1.5">
        Группа «${escHtml(group.name)}» и все сообщения в ней будут удалены у всех ${group.members.length} участников. Это действие необратимо.
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-surface" style="flex:1" onclick="this.closest('[style*=fixed]').remove()">Отмена</button>
        <button class="btn" style="flex:1;background:var(--danger,#c94f4f);color:#fff" onclick="groupDeleteForAllConfirmed('${groupId}');this.closest('[style*=fixed]').remove()">Удалить для всех</button>
      </div>
    </div>`;
  sheet.addEventListener('click', () => sheet.remove());
  document.body.appendChild(sheet);
}

async function groupDeleteForAllConfirmed(groupId) {
  const p = profileLoad();
  const group = groupGet(groupId);
  if (!p || !group || group.createdBy !== p.username) return;

  toast('🗑 Удаляю группу...');

  // Для каждого участника удаляем группу из их users.groups
  if (sbReady()) {
    for (const member of group.members) {
      try {
        const rows = await sbGet('users', `select=groups&username=eq.${encodeURIComponent(member)}&limit=1`);
        const existing = rows?.[0]?.groups ? JSON.parse(rows[0].groups) : [];
        _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(member)}`,
          { groups: JSON.stringify(existing.filter(g => g.id !== groupId)) },
          { 'Content-Type':'application/json','Prefer':'return=minimal' }).catch(()=>{});
        // Отправляем системное сообщение об удалении
        if (member !== p.username) {
          await sbInsert('messages', {
            chat_key: sbChatKey(p.username, member),
            from_user: p.username, to_user: member,
            text: '🗑 Создатель удалил группу «' + group.name + '»',
            ts: Date.now(),
            extra: JSON.stringify({ type: 'group_deleted', groupId })
          });
        }
      } catch(e) {}
    }
  }

  // Удаляем локально
  const groups = groupsLoad().filter(g => g.id !== groupId);
  groupsSave(groups);
  const msgs = msgLoad();
  delete msgs[groupId];
  msgSave(msgs);
  chatsSave(chatsLoad().filter(u => u !== groupId));
  _markChatDeleted(groupId);

  document.getElementById('group-settings-screen')?.remove();
  if (_msgCurrentChat === groupId) showScreen('s-groups-chat', 'back');
  renderGroupsList();
  messengerUpdateBadge();
  toast('✅ Группа удалена для всех');
}



// ┄┄ Поллинг входящих сообщений группы ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// Поллинг группы   один общий канал без фильтра to_user
// Каждый участник читает все сообщения с chat_key = 'group_<id>'
function sbPollGroupChat(myUsername, group) {
  if (!group || !group.id) return;
  const chatKey = groupChatKey(group.id);
  // Единый ключ для группы (не per-user)   экономим интервалы
  const streamKey = 'GRP:' + group.id;
  if (_fbMsgStreams[streamKey]) return;

  const doCheck = async () => {
    if (!sbReady()) return;
    const lastTs = _fbLastMsgTs[streamKey] || 0;
    const sinceTs = lastTs > 0 ? lastTs : (Date.now() - 30 * 24 * 60 * 60 * 1000);
    // Тянем ВСЕ сообщения группы   без фильтра to_user
    const data = await sbGet('messages',
      `select=*&chat_key=eq.${encodeURIComponent(chatKey)}&ts=gt.${sinceTs}&order=ts.asc&limit=200`
    ).catch(() => null);
    if (!Array.isArray(data) || !data.length) return;

    const msgs = msgLoad();
    if (!msgs[group.id]) msgs[group.id] = [];
    let hasNew = false;
    data.forEach(row => {
      _fbLastMsgTs[streamKey] = Math.max(_fbLastMsgTs[streamKey]||0, row.ts);
      const exists = msgs[group.id].some(m => m.ts === row.ts && m.from === row.from_user);
      if (!exists) {
        // Парсим extra для медиа-сообщений
        let extraParsed = null;
        try { if (row.extra) extraParsed = JSON.parse(row.extra); } catch(_) {}
        msgs[group.id].push({
          from: row.from_user, to: group.id,
          text: row.text || '', ts: row.ts,
          delivered: true, read: _msgCurrentChat === group.id,
          ...(extraParsed?.fileLink  ? { fileLink:  extraParsed.fileLink  } : {}),
          ...(extraParsed?.fileType  ? { fileType:  extraParsed.fileType  } : {}),
          ...(extraParsed?.fileName  ? { fileName:  extraParsed.fileName  } : {}),
          ...(extraParsed?.fileSize  ? { fileSize:  extraParsed.fileSize  } : {}),
          ...(extraParsed?.duration  ? { duration:  extraParsed.duration  } : {}),
          ...(extraParsed?.thumbData ? { thumbData: extraParsed.thumbData } : {}),
          ...(extraParsed?.replyTo   ? { replyTo:   extraParsed.replyTo   } : {}),
        });
        hasNew = true;
      } else {
        // Обновляем delivered для своих сообщений
        const local = msgs[group.id].find(m => m.ts === row.ts && m.from === row.from_user);
        if (local && !local.delivered) { local.delivered = true; hasNew = true; }
      }
    });
    if (hasNew) {
      msgs[group.id].sort((a,b) => a.ts - b.ts);
      msgSave(msgs);
      const chats = chatsLoad();
      if (!chats.includes(group.id)) { chats.unshift(group.id); chatsSave(chats); }
      if (_msgCurrentChat === group.id) messengerRenderMessages();
      else messengerUpdateBadge();
    }
  };

  doCheck();
  _fbMsgStreams[streamKey] = setInterval(doCheck, 2000);
}

// Запускаем polling для всех групп пользователя при подключении
function sbStartGroupPolling(myUsername) {
  const groups = groupsLoad();
  groups.forEach(g => {
    // Обе функции теперь работают одинаково (без фильтра to_user)
    sbPollGroupChat(myUsername, g);
  });
}

// ┄┄ Поллинг публичной группы (баги/идеи)   показываем всем ┄┄┄┄┄┄┄
function sbPollPublicGroup(myUsername, group) {
  const chatKey = groupChatKey(group.id);
  const streamKey = 'PUBGRP:' + group.id;
  if (_fbMsgStreams[streamKey]) return;

  const doCheck = async () => {
    if (!sbReady()) return;
    const lastTs = _fbLastMsgTs[streamKey] || 0;
    const sinceTs = lastTs > 0 ? lastTs : (Date.now() - 7 * 24 * 60 * 60 * 1000);
    // Публичная   тянем все сообщения с этим chat_key (без фильтра to_user)
    const data = await sbGet('messages',
      `select=*&chat_key=eq.${encodeURIComponent(chatKey)}&ts=gt.${sinceTs}&order=ts.asc&limit=200`
    ).catch(() => null);
    if (!Array.isArray(data) || !data.length) return;

    const msgs = msgLoad();
    if (!msgs[group.id]) msgs[group.id] = [];
    let hasNew = false;
    data.forEach(row => {
      _fbLastMsgTs[streamKey] = Math.max(_fbLastMsgTs[streamKey]||0, row.ts);
      const exists = msgs[group.id].some(m => m.ts === row.ts && m.from === row.from_user);
      if (!exists) {
        msgs[group.id].push({
          from: row.from_user, to: group.id,
          text: row.text || '', ts: row.ts,
          delivered: true, read: _msgCurrentChat === group.id
        });
        hasNew = true;
      }
    });
    if (hasNew) {
      msgs[group.id].sort((a,b) => a.ts - b.ts);
      msgSave(msgs);
      const chats = chatsLoad();
      if (!chats.includes(group.id)) { chats.unshift(group.id); chatsSave(chats); }
      if (_msgCurrentChat === group.id) messengerRenderMessages();
      else messengerUpdateBadge();
    }
  };

  doCheck();
  _fbMsgStreams[streamKey] = setInterval(doCheck, 3000);
}

// Подтягивает список чатов (собеседников) из Supabase при входе
// Чтобы чаты были видны сразу после очистки кэша
async function syncChatsFromServer(username) {
  if (!sbReady() || !username) return;
  try {
    // Ищем всех с кем были сообщения (исходящие И входящие)
    const [sent, recv] = await Promise.all([
      sbGet('messages', `select=to_user&from_user=eq.${encodeURIComponent(username)}&order=ts.desc&limit=200`),
      sbGet('messages', `select=from_user&to_user=eq.${encodeURIComponent(username)}&order=ts.desc&limit=200`),
    ]);
    const partners = new Set();
    if (Array.isArray(sent)) sent.forEach(r => { if (r.to_user !== username) partners.add(r.to_user); });
    if (Array.isArray(recv)) recv.forEach(r => { if (r.from_user !== username) partners.add(r.from_user); });
    if (!partners.size) return;
    // Объединяем с локальными
    const local   = chatsLoad();
    const deleted = deletedChatsLoad(); // не восстанавливаем удалённые
    const merged  = [...new Set([...local, ...partners])].filter(u => !deleted.includes(u));
    chatsSave(merged);
    // Запускаем polling для каждого нового собеседника
    partners.forEach(u => { if (!local.includes(u) && !deleted.includes(u)) sbPollChat(username, u); });
  } catch(e) {}
}

function groupChatKey(groupId) { return 'group_' + groupId; }
function groupIsKey(chatKey)   { return chatKey && chatKey.startsWith('group_'); }
function groupIdFromKey(chatKey){ return chatKey ? chatKey.replace('group_', '') : null; }

async function groupSendMessage(groupId, text, extra, localTs) {
  const p = profileLoad();
  const group = groupGet(groupId);
  if (!p || !group) return;
  // Используем переданный ts чтобы сервер и локальная запись имели одинаковый timestamp
  const ts = localTs || Date.now();
  // ВСЕГДА используем groupChatKey   не sbChatKey
  const chatKey = groupChatKey(groupId);

  // Одна запись на всю группу с to_user='__broadcast__'
  // Все участники поллят chat_key без фильтра to_user ↩ получают её
  const row = {
    chat_key: chatKey,
    from_user: p.username,
    to_user: '__broadcast__',
    text: text || '',
    ts
  };
  if (extra) row.extra = typeof extra === 'string' ? extra : JSON.stringify(extra);

  await sbInsert('messages', row);
}

function showCreateGroupDialog() {
  const p = profileLoad();
  // Показываем всех друзей + онлайн пользователей (не только онлайн)
  const friends = friendsLoad();
  const candidates = [
    ..._allKnownUsers.filter(u => friends.includes(u.username) && u.username !== p?.username),
    ..._profileOnlinePeers.filter(u => !friends.includes(u.username) && u.username !== p?.username)
  ];
  // Дедупликация
  const seen = new Set();
  const users = candidates.filter(u => { if (seen.has(u.username)) return false; seen.add(u.username); return true; });

  const sheet = document.createElement('div');
  sheet.id = 'create-group-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9900;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.6)';
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:20px 16px calc(20px + var(--safe-bot));max-height:80vh;overflow-y:auto;animation:mcSlideUp .26s cubic-bezier(.34,1.1,.64,1)">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:0 auto 16px"></div>
      <div style="font-size:17px;font-weight:700;margin-bottom:12px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Создать группу</div>
      <input id="grp-name-inp" class="inp" placeholder="Название группы" style="margin-bottom:12px">
      <div style="font-size:13px;color:var(--muted);margin-bottom:8px">Участники (друзья и онлайн):</div>
      <div id="grp-members-list">
        ${users.length === 0
          ? '<div style="color:var(--muted);padding:16px;text-align:center">Нет доступных пользователей</div>'
          : users.map(u => {
            const isOnline = _profileOnlinePeers.some(x => x.username === u.username);
            return `
          <label style="display:flex;align-items:center;gap:12px;padding:10px 0;cursor:pointer;-webkit-tap-highlight-color:transparent;border-bottom:1px solid rgba(255,255,255,.05)">
            <div style="width:28px;height:28px;border-radius:8px;border:2px solid var(--surface3);background:var(--surface2);display:flex;align-items:center;justify-content:center;flex-shrink:0" class="grp-chk-box" data-val="${u.username}">
            </div>
            <div style="position:relative;width:36px;height:36px;flex-shrink:0">
              <div style="width:36px;height:36px;border-radius:50%;background:${u.color||'var(--surface3)'};display:flex;align-items:center;justify-content:center;font-size:20px">${_emojiImg(u.avatar||'😊',22)}</div>
              ${isOnline ? '<div style="position:absolute;bottom:0;right:0;width:11px;height:11px;border-radius:50%;background:#4caf7d;border:2px solid var(--surface)"></div>' : ''}
            </div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:600">${escHtml(u.name||u.username)}</div>
              <div style="font-size:12px;color:var(--muted)">@${escHtml(u.username)}${isOnline ? ' · <span style="color:#4caf7d">онлайн</span>' : ''}</div>
            </div>
          </label>`;}).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-surface" style="flex:1" onclick="document.getElementById('create-group-sheet').remove()">Отмена</button>
        <button class="btn btn-accent" style="flex:1" id="grp-create-btn">Создать</button>
      </div>
    </div>`;
  // Custom checkbox toggle
  sheet.addEventListener('click', e => {
    if (e.target === sheet) { sheet.remove(); return; }
    const box = e.target.closest('.grp-chk-box');
    if (box) {
      const selected = box.classList.toggle('selected');
      box.style.background = selected ? 'var(--accent)' : 'var(--surface2)';
      box.style.borderColor = selected ? 'var(--accent)' : 'var(--surface3)';
      box.innerHTML = selected ? '✅' : '';
      box.style.color = '#fff';
      box.style.fontSize = '14px';
      box.style.fontWeight = '700';
    }
  });
  sheet.querySelector('#grp-create-btn').addEventListener('click', () => {
    const name = document.getElementById('grp-name-inp')?.value.trim();
    if (!name) { toast('Введи название'); return; }
    const checked = [...sheet.querySelectorAll('.grp-chk-box.selected')].map(b => b.dataset.val);
    if (!checked.length) { toast('Выбери хотя бы одного участника'); return; }
    if (!name) { toast('Введи название группы'); return; }
    groupCreate(name, checked);
    sheet.remove();
  });
  document.body.appendChild(sheet);
}

function showCreateGroupDialogFromMessenger() {
  showCreateGroupDialog();
}

// ══════════════════════════════════════════════════════════════════════
// 🚫 БЛОКИРОВКА И ЗАЩИТА КОПИРОВАНИЯ
// ══════════════════════════════════════════════════════════════════════
const BLOCKED_KEY  = 'sapp_blocked_v1';
const NO_COPY_KEY  = 'sapp_nocopy_v1';

function blockedLoad()       { try { return JSON.parse(localStorage.getItem(BLOCKED_KEY)  || '[]'); } catch(e) { return []; } }
function blockedSave(b)      { localStorage.setItem(BLOCKED_KEY, JSON.stringify(b)); }
function noCopyLoad()        { try { return JSON.parse(localStorage.getItem(NO_COPY_KEY)  || '[]'); } catch(e) { return []; } }
function noCopySave(b)       { localStorage.setItem(NO_COPY_KEY, JSON.stringify(b)); }
function isBlocked(username) { return blockedLoad().includes(username); }
function isCopyBlocked(username) { return noCopyLoad().includes(username); }

// ══════════════════════════════════════════════════════════════════════
// 🔕 ОТКЛЮЧЕНИЕ УВЕДОМЛЕНИЙ (mute)
// ══════════════════════════════════════════════════════════════════════
const MUTE_KEY = 'sapp_muted_v1';

function muteLoad() { try { return JSON.parse(localStorage.getItem(MUTE_KEY) || '{}'); } catch(e) { return {}; } }
function muteSave(d) { localStorage.setItem(MUTE_KEY, JSON.stringify(d)); }

function isMuted(username) {
  const data = muteLoad();
  if (!data[username]) return false;
  if (data[username] === 'forever') return true;
  // untilTs
  if (Date.now() < data[username]) return true;
  // истёк   чистим
  delete data[username];
  muteSave(data);
  return false;
}

function muteGetLabel(username) {
  const data = muteLoad();
  if (!data[username]) return null;
  if (data[username] === 'forever') return '⏱';
  const remain = data[username] - Date.now();
  if (remain <= 0) return null;
  const h = Math.ceil(remain / 3600000);
  if (h < 24) return h + 'ч';
  return Math.ceil(h / 24) + 'д';
}

function peerMuteShow(username) {
  const existing = document.getElementById('mute-sheet');
  if (existing) { existing.remove(); return; }

  const currently = isMuted(username);
  const sheet = document.createElement('div');
  sheet.id = 'mute-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9900;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.6)';

  const options = currently ? [
    { label: '🔔 Включить уведомления', action: () => { const d=muteLoad(); delete d[username]; muteSave(d); toast('🔔 Уведомления включены'); } },
  ] : [
    { label: '🔕 На 1 час',     action: () => { const d=muteLoad(); d[username]=Date.now()+3600000;   muteSave(d); toast('🔕 Уведомления выключены на 1 ч'); } },
    { label: '🔕 На 8 часов',   action: () => { const d=muteLoad(); d[username]=Date.now()+28800000;  muteSave(d); toast('🔕 Уведомления выключены на 8 ч'); } },
    { label: '🔕 На 2 дня',     action: () => { const d=muteLoad(); d[username]=Date.now()+172800000; muteSave(d); toast('🔕 Уведомления выключены на 2 дня'); } },
    { label: '🔕 Навсегда',     action: () => { const d=muteLoad(); d[username]='forever';            muteSave(d); toast('🔕 Уведомления отключены'); } },
  ];

  sheet.innerHTML = `
    <div id="mute-sheet-inner" style="background:var(--surface);border-radius:20px 20px 0 0;overflow:hidden;padding-bottom:calc(8px + var(--safe-bot));animation:mcSlideUp .26s cubic-bezier(.34,1.1,.64,1)">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:10px auto 12px"></div>
      <div style="font-size:13px;font-weight:700;color:var(--muted);padding:0 20px 10px;text-transform:uppercase;letter-spacing:.06em">Уведомления</div>
      ${options.map((o,i) => `<button id="mute-opt-${i}"
        style="width:100%;padding:15px 20px;background:none;border:none;border-top:1px solid rgba(255,255,255,.05);
          color:var(--text);font-family:inherit;font-size:15px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:14px;
          animation:mcEmojiIn .18s cubic-bezier(.34,1.3,.64,1) ${i*40}ms both">
        ${o.label}
      </button>`).join('')}
      <button onclick="document.getElementById('mute-sheet').remove()"
        style="width:100%;padding:15px 20px;background:none;border:none;color:var(--muted);font-family:inherit;font-size:15px;cursor:pointer;border-top:1px solid rgba(255,255,255,.05)">
        Отмена
      </button>
    </div>`;

  sheet.addEventListener('click', e => {
    if (e.target === sheet) {
      const inner = document.getElementById('mute-sheet-inner');
      if (inner) { inner.style.animation = 'mcSlideDown .2s cubic-bezier(.4,0,.8,.6) forwards'; }
      setTimeout(() => sheet.remove(), 180);
    }
  });
  document.body.appendChild(sheet);
  options.forEach((o,i) => {
    document.getElementById('mute-opt-'+i)?.addEventListener('click', () => {
      o.action();
      sheet.remove();
      // обновляем иконку в хедере чата
      _mcUpdateMuteIcon();
    });
  });
}

function _mcUpdateMuteIcon() {
  const btn = document.getElementById('mc-mute-btn');
  if (!btn || !_msgCurrentChat) return;
  const muted = isMuted(_msgCurrentChat);
  btn.textContent = muted ? '🔕' : '🔔';
  btn.title = muted ? 'Уведомления выключены' : 'Уведомления включены';
}

// ══════════════════════════════════════════════════════════════════════
// 🔐 ПЕРЕКЛЮЧАТЕЛЬ ШИФРОВАНИЯ ЧАТА (Secret Chat, как в Telegram)
// ══════════════════════════════════════════════════════════════════════
// Хранит Set username'ов для которых включено шифрование
const _SECRET_CHATS_KEY = 'sapp_secret_chats_v1';
function _secretChatsLoad() {
  try { return new Set(JSON.parse(localStorage.getItem(_SECRET_CHATS_KEY) || '[]')); }
  catch(e) { return new Set(); }
}
function _secretChatsSave(set) {
  localStorage.setItem(_SECRET_CHATS_KEY, JSON.stringify([...set]));
}

// Включено ли шифрование для данного чата
function isChatEncrypted(username) {
  return _secretChatsLoad().has(username);
}

// Обновить иконку кнопки шифрования
function mcUpdateEncryptBtn() {
  const btn = document.getElementById('mc-encrypt-btn');
  if (!btn || !_msgCurrentChat) return;
  // Скрываем для групп
  const isGroup = _msgCurrentChat === PUBLIC_GROUP_ID || _msgCurrentChat.startsWith('grp_');
  if (isGroup) { btn.style.display = 'none'; return; }
  btn.style.display = '';
  const enc = isChatEncrypted(_msgCurrentChat);
  btn.textContent     = enc ? '🔐' : '🔓';
  btn.style.opacity   = enc ? '1' : '0.45';
  btn.style.transform = enc ? 'scale(1.15)' : 'scale(1)';
  btn.title           = enc ? 'Секретный чат (выкл)' : 'Включить шифрование';
}

// Переключить шифрование для текущего чата
function mcToggleEncrypt() {
  if (!_msgCurrentChat) return;
  const isGroup = _msgCurrentChat === PUBLIC_GROUP_ID || _msgCurrentChat.startsWith('grp_');
  if (isGroup) { toast('🔒 Шифрование недоступно в групповых чатах'); return; }

  const set = _secretChatsLoad();
  if (set.has(_msgCurrentChat)) {
    set.delete(_msgCurrentChat);
    toast('🔓 Обычный режим — шифрование выключено');
  } else {
    set.add(_msgCurrentChat);
    toast('🔐 Секретный чат включён — сообщения шифруются');
    // Убеждаемся что E2E ключи инициализированы
    if (!_e2eEnabled) e2eInit().then(() => e2ePushMyKey && e2ePushMyKey());
  }
  _secretChatsSave(set);
  mcUpdateEncryptBtn();
  // Перерендерить шапку чтобы показать/убрать индикатор
  const hdrSub = document.getElementById('mc-hdr-sub');
  if (hdrSub && !isGroup) {
    if (set.has(_msgCurrentChat)) {
      hdrSub.textContent = '🔐 Секретный чат';
    } else {
      const peer = _profileOnlinePeers.find(u => u.username === _msgCurrentChat)
                 || _allKnownUsers.find(u => u.username === _msgCurrentChat);
      hdrSub.textContent = peer
        ? (_profileOnlinePeers.find(u => u.username === _msgCurrentChat) ? '🟢 В сети' : '⚡ Не в сети')
        : ('@' + _msgCurrentChat);
    }
  }
}


// ══════════════════════════════════════════════════════════════════════
const PIN_KEY = 'sapp_pinned_v1';

function pinnedLoad() { try { return JSON.parse(localStorage.getItem(PIN_KEY) || '{}'); } catch(e) { return {}; } }
function pinnedSave(d) { localStorage.setItem(PIN_KEY, JSON.stringify(d)); }

function mcPinMsg(idx) {
  if (!_msgCurrentChat) return;
  const msgs = msgLoad();
  const chatMsgs = msgs[_msgCurrentChat] || [];
  const msg = chatMsgs[idx];
  if (!msg) return;
  const pinned = pinnedLoad();
  pinned[_msgCurrentChat] = { text: msg.text || msg.sticker || '📷 Фото', from: msg.from, ts: msg.ts, idx };
  pinnedSave(pinned);
  mcRenderPinBar();
  toast('📌 Сообщение закреплено');
}

function mcUnpinMsg() {
  if (!_msgCurrentChat) return;
  const pinned = pinnedLoad();
  delete pinned[_msgCurrentChat];
  pinnedSave(pinned);
  mcRenderPinBar();
  toast('📌 Сообщение откреплено');
}

function mcRenderPinBar() {
  const bar = document.getElementById('mc-pin-bar');
  if (!bar || !_msgCurrentChat) return;
  const pinned = pinnedLoad();
  const p = pinned[_msgCurrentChat];
  if (!p) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = '';
  bar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;cursor:pointer"
      onclick="mcScrollToPinned()">
      <div style="width:3px;height:32px;background:var(--accent);border-radius:2px;flex-shrink:0"></div>
      <div style="min-width:0;flex:1">
        <div style="font-size:11px;font-weight:700;color:var(--accent)">📌 Закреплённое сообщение</div>
        <div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml((p.text||'').slice(0,60))}</div>
      </div>
    </div>
    <button onclick="mcUnpinMsg()" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:4px;flex-shrink:0;line-height:1">×</button>`;
}

function mcScrollToPinned() {
  const pinned = pinnedLoad();
  const p = pinned[_msgCurrentChat];
  if (!p) return;
  const body = document.getElementById('mc-messages');
  if (!body) return;
  const bubbles = body.querySelectorAll('[data-msg-bubble]');
  // Ищем сообщение по ts
  for (const b of bubbles) {
    const idx = parseInt(b.dataset.msgIdx);
    const msgs = msgLoad()[_msgCurrentChat] || [];
    if (msgs[idx] && msgs[idx].ts === p.ts) {
      b.scrollIntoView({ behavior: 'smooth', block: 'center' });
      b.style.transition = 'background .2s';
      b.style.background = 'rgba(var(--accent-rgb,224,135,34),.18)';
      setTimeout(() => { b.style.background = ''; }, 1200);
      return;
    }
  }
  toast('Сообщение не найдено в истории');
}

function peerBlockToggle(username) {
  const list = blockedLoad();
  if (list.includes(username)) {
    blockedSave(list.filter(u => u !== username));
    toast('🔓 @' + username + ' разблокирован');
  } else {
    blockedSave([...list, username]);
    toast('🚫 @' + username + ' заблокирован');
  }
  peerProfileOpen(username);
}

function peerNoCopyToggle(username) {
  const list = noCopyLoad();
  if (list.includes(username)) {
    noCopySave(list.filter(u => u !== username));
    toast('📋 Копирование разрешено');
  } else {
    noCopySave([...list, username]);
    toast('🔒 Копирование запрещено');
  }
  peerProfileOpen(username);
}

function peerSendGift(username) {
  const gifts = ['🎁','🌹','💎','🍫','🎂','🎀','🌟','💐','🎊','✅'];
  const gift = gifts[Math.floor(Math.random() * gifts.length)];
  const p = profileLoad();
  if (!p) return;
  const ts = Date.now();
  const msg = { from: p.username, to: username, sticker: gift, text: '', ts, delivered: false, read: false };
  const msgs = msgLoad();
  if (!msgs[username]) msgs[username] = [];
  msgs[username].push(msg);
  msgSave(msgs);
  const chats = chatsLoad();
  if (!chats.includes(username)) { chats.unshift(username); chatsSave(chats); }
  sbInsert('messages', { chat_key: sbChatKey(p.username, username), from_user: p.username, to_user: username, text: gift, ts });
  toast('🎁 Подарок ' + gift + ' отправлен!');
  _msgCurrentChat = username;
  showScreen('s-messenger-chat');
  messengerRenderMessages();
}

function peerSaveAvatar(username) {
  const peer = _profileOnlinePeers.find(u => u.username === username)
             || _allKnownUsers.find(u => u.username === username);
  if (!peer) { toast('Нет данных для сохранения'); return; }
  if (peer.avatarType === 'photo' && peer.avatarData) {
    const a = document.createElement('a');
    a.href = peer.avatarData;
    a.download = username + '_avatar.jpg';
    a.click();
    toast('✅ Фото сохранено');
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = peer.color || '#e87722';
    ctx.beginPath(); ctx.arc(128,128,128,0,Math.PI*2); ctx.fill();
    ctx.font = '120px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(peer.avatar || '😊', 128, 135);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = username + '_avatar.png';
    a.click();
    toast('✅ Аватар сохранён');
  }
}

// ┄┄ Меню «три точки» профиля пользователя ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function peerShowMenu(username) {
  const existing = document.getElementById('peer-menu-sheet');
  if (existing) { existing.remove(); return; }

  const blocked  = isBlocked(username);
  const noCopy   = isCopyBlocked(username);
  const isFriend = friendsLoad().includes(username);
  const muted    = isMuted(username);
  const muteLabel = muteGetLabel(username);

  const sheet = document.createElement('div');
  sheet.id = 'peer-menu-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9800;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.55)';

  const items = [
    { icon: muted ? '🔔' : '🔕',
      label: muted ? `Включить уведомления` : `Отключить уведомления`,
      action: `peerMuteShow('${username}')` },
    { icon:'🚫', label: blocked ? 'Разблокировать' : 'Заблокировать',  action: `peerBlockToggle('${username}')` },
    { icon:'🗑',  label: isFriend ? 'Удалить из друзей' : 'Добавить в друзья',
                 action: isFriend ? `profileRemoveFriend('${username}')` : `profileAddFriend('${username}')` },
    { icon:'🎁', label: 'Отправить подарок',      action: `peerSendGift('${username}')` },
    { icon:'📋', label: noCopy ? 'Разрешить копирование' : 'Запретить копирование', action: `peerNoCopyToggle('${username}')` },
    { icon:'🖼',  label: 'Сохранить фото/аватар',  action: `peerSaveAvatar('${username}')` },
  ];

  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;overflow:hidden;padding-bottom:calc(8px + var(--safe-bot));animation:mcSlideUp .26s cubic-bezier(.34,1.1,.64,1)">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:10px auto 6px"></div>
      ${items.map(it => `
        <button onclick="${it.action};document.getElementById('peer-menu-sheet')?.remove()"
          style="width:100%;padding:16px 20px;background:none;border:none;border-bottom:1px solid rgba(255,255,255,.05);
            color:var(--text);font-family:inherit;font-size:15px;text-align:left;cursor:pointer;
            display:flex;align-items:center;gap:16px">
          <span style="font-size:20px;width:26px;text-align:center">${it.icon}</span>
          <span>${it.label}</span>
        </button>`).join('')}
      <button onclick="document.getElementById('peer-menu-sheet').remove()"
        style="width:100%;padding:16px 20px;background:none;border:none;color:var(--muted);
          font-family:inherit;font-size:15px;cursor:pointer">
        Отмена
      </button>
    </div>`;

  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
  document.body.appendChild(sheet);
}

// ┄┄ messengerMarkRead ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function messengerMarkRead() {
  if (!_msgCurrentChat) return;
  const p = profileLoad();
  const msgs = msgLoad();
  if (!msgs[_msgCurrentChat]) return;
  let changed = false;
  let maxReadTs = 0;
  msgs[_msgCurrentChat].forEach(m => {
    if (m.from !== p?.username && !m.read) {
      m.read = true; changed = true;
      if (m.ts > maxReadTs) maxReadTs = m.ts;
    }
  });
  if (changed) {
    msgSave(msgs);
    messengerUpdateBadge();
    // Уведомляем отправителя о прочтении через Supabase
    if (maxReadTs > 0 && !_msgCurrentChat.startsWith('grp_') && _msgCurrentChat !== PUBLIC_GROUP_ID) {
      _sbSendReadReceipt(_msgCurrentChat, maxReadTs);
    }
  }
}

// Отправляет служебное сообщение-уведомление о прочтении
async function _sbSendReadReceipt(toUser, upToTs) {
  try {
    const p = profileLoad();
    if (!p?.username) return;
    const ts = Date.now();
    await sbInsert('messages', {
      chat_key: sbChatKey(p.username, toUser),
      from_user: p.username,
      to_user: toUser,
      text: '',
      ts,
      extra: JSON.stringify({ type: 'read_receipt', upToTs })
    });
  } catch(_) {}
}

// ══════════════════════════════════════════════════════════════════════
// 👑 VIP   выдача другим пользователям
// ══════════════════════════════════════════════════════════════════════
const VIP_GRANTED_KEY = 'sapp_vip_granted_v1';
function vipGrantedLoad() { try { return JSON.parse(localStorage.getItem(VIP_GRANTED_KEY)||'{}'); } catch(e) { return {}; } }
function vipGrantedSave(d) { localStorage.setItem(VIP_GRANTED_KEY, JSON.stringify(d)); }

function vipCheckUser(username) {
  if (!username) return vipCheck();
  const granted = vipGrantedLoad();
  return !!granted[username];
}

async function vipGrantTo(username) {
  const granted = vipGrantedLoad();
  granted[username] = Date.now();
  vipGrantedSave(granted);
  if (sbReady()) {
    try {
      await _sbFetch('PATCH', `/rest/v1/presence?username=eq.${encodeURIComponent(username)}`, { vip: true }, {
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      });
      await _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(username)}`, { vip: true }, {
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      });
    } catch(e) {}
  }
}

async function vipRevokeFrom(username) {
  const granted = vipGrantedLoad();
  delete granted[username];
  vipGrantedSave(granted);
  if (sbReady()) {
    try {
      await _sbFetch('PATCH', `/rest/v1/presence?username=eq.${encodeURIComponent(username)}`, { vip: false }, {
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      });
      await _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(username)}`, { vip: false }, {
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      });
    } catch(e) {}
  }
}

// ══ ЗАПУСК ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(profileBootstrap, 50);
  // Twemoji: parse initial DOM then watch mutations
  _initTwemoji();
});

// ── Локальный рендерер emoji из файлов assets/emoji/ ──────────────────────────
// Использует IOS_EMOJI_MAP (ios_emoji_map.js) и локальные PNG-файлы.
// Путь: filesDir/emoji/ (скачанный пак) → android_asset/emoji/ (fallback из APK если есть)
// На веб: CDN twemoji как раньше.

// Базовый путь к emoji — https://emoji.local/ перехватывается Java гарантированно
// (file:///android_asset/ не вызывает shouldInterceptRequest надёжно в modern WebView)
let _EMOJI_BASE = 'https://emoji.local/'; // всегда — Java сервит из filesDir/emoji/
let _emojiPackReady = false;

// EMOJI_PACK_ZIP_URL — архив репозитория LomKich/emoji (main branch).
// Работает без создания релиза — GitHub автоматически генерирует zip любой ветки.
// Структура внутри: emoji-main/emoji/act/Fire.png, emoji-main/emoji/food/...
// Java-экстрактор срезает префикс "emoji-main/" при распаковке.
const EMOJI_PACK_ZIP_URL = 'https://github.com/LomKich/emoji/archive/refs/heads/main.zip';

/**
 * Инициализация emoji-пака при старте приложения.
 * Проверяет маркер-файл через Java — если готов, сразу включает рендерер.
 * Если нет — запускает загрузку через 3 секунды (не мешает старту).
 *
 * Пак персистентен: хранится в filesDir Android, переживает перезапуски.
 * Удаляется только при "Очистить данные" приложения или его удалении.
 */
function _initEmojiPack() {
  if (!window.Android) {
    _emojiPackReady = false; // веб — используем twemoji
    return;
  }
  try {
    if (window.Android.isEmojiPackReady()) {
      _emojiPackReady = true;
      console.log('[emoji] pack ready ✅');
    } else {
      console.log('[emoji] pack not ready, will download in 3s');
      setTimeout(_startEmojiPackDownload, 3000);
    }
  } catch(e) {
    console.warn('[emoji] initEmojiPack error:', e);
  }
}

/**
 * Запускает тихую фоновую загрузку ZIP-пака эмодзи.
 * Никакого UI — скачивание происходит незаметно.
 */
function _startEmojiPackDownload() {
  if (!window.Android?.downloadEmojiPackZip) return;
  try { if (window.Android.isEmojiPackReady()) { _emojiPackReady = true; return; } } catch(_) {}
  console.log('[emoji] starting silent background download');
  window.Android.downloadEmojiPackZip(EMOJI_PACK_ZIP_URL);
}

/**
 * Колбэк из Java — вызывается после завершения загрузки.
 * Прогресс не отображается — только активируем рендерер когда всё готово.
 */
function onEmojiPackProgress(pct, label, isDone) {
  if (isDone) {
    _emojiPackReady = true;
    _twemojiParse(document.body);
    console.log('[emoji] pack ready:', label);
  } else if (pct === -1) {
    console.warn('[emoji] download error:', label);
  }
}

let _emojiObserver = null;

/**
 * Возвращает <img> для одного emoji символа с явным px-размером.
 * Используется для аватарок где font-size контейнера не совпадает с нужным размером.
 * @param {string} emoji  — символ emoji, напр. '😊'
 * @param {number} size   — размер в px (по умолчанию 20)
 * @param {string} [style] — доп. CSS
 */
function _emojiImg(emoji, size, style) {
  if (!emoji || typeof IOS_EMOJI_MAP === 'undefined') return emoji || '';
  const path = IOS_EMOJI_MAP[emoji];
  const sz = size || 20;
  if (!path || !_emojiPackReady) {
    return `<span style="font-size:${sz}px;line-height:1;display:inline-block">${emoji}</span>`;
  }
  const extra = style ? ';' + style : '';
  return `<img src="${_EMOJI_BASE}${path}" alt="${emoji}" ` +
    `style="display:inline-block;width:${sz}px;height:${sz}px;vertical-align:-.2em;` +
    `object-fit:contain;flex-shrink:0${extra}" class="emoji" draggable="false" ` +
    `onerror="this.outerHTML='${emoji}'">`;
}

// Заменяет emoji в строке text на <img> теги с локальными ассетами.
// Возвращает HTML-строку, или null если emoji не найдено.
// Заменяет emoji в строке text на <img> теги с локальными ассетами.
// Возвращает HTML-строку, или null если emoji не найдено.
const _emojiMissLog = new Set(); // дедупликация — не спамим одними символами
function _localEmojiHtml(text) {
  if (!text || typeof IOS_EMOJI_MAP === 'undefined') return null;
  let result = '';
  let changed = false;
  let i = 0;
  while (i < text.length) {
    let found = false;
    const maxLen = Math.min(12, text.length - i);
    for (let len = maxLen; len >= 1; len--) {
      const sub = text.substring(i, i + len);
      const path = IOS_EMOJI_MAP[sub];
      if (path) {
        result += `<img src="${_EMOJI_BASE}${path}" alt="${sub}" ` +
          `class="emoji" draggable="false" onerror="this.replaceWith(document.createTextNode('${sub}'))">`;
        i += len;
        changed = true;
        found = true;
        break;
      }
    }
    if (!found) {
      const c = text[i];
      // Логируем emoji-символы которых нет в карте
      const cp = c.codePointAt(0);
      if (cp > 0x1F300 || (cp >= 0x2600 && cp <= 0x27BF)) {
        const key = cp.toString(16);
        if (!_emojiMissLog.has(key)) {
          _emojiMissLog.add(key);
          console.warn(`[emoji] не в карте: U+${key} "${c}" контекст: "${text.slice(Math.max(0,i-3), i+4).replace(/\n/g,' ')}"`);
        }
      }
      if      (c === '&') result += '&amp;';
      else if (c === '<') result += '&lt;';
      else if (c === '>') result += '&gt;';
      else                result += c;
      i++;
    }
  }
  return changed ? result : null;
}


// Обходит все текстовые узлы в node и заменяет emoji на <img>.
function _localEmojiParse(root) {
  if (typeof IOS_EMOJI_MAP === 'undefined') {
    console.warn('[emoji] IOS_EMOJI_MAP не определён — ios_emoji_map.js не загружен?');
    return;
  }
  if (!_emojiPackReady) {
    console.warn('[emoji] _emojiPackReady=false — пак не готов, парсинг пропущен');
    return;
  }
  const SKIP_TAGS = new Set(['SCRIPT','STYLE','INPUT','TEXTAREA','CODE','PRE']);
  const walker = document.createTreeWalker(
    root || document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(n) {
        const p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName;
        if (tag && SKIP_TAGS.has(tag)) return NodeFilter.FILTER_REJECT;
        // Не переобрабатываем уже разобранные узлы
        if (p.dataset && p.dataset.emojiDone) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  let replaced = 0, skipped = 0, errors = 0;
  for (const textNode of nodes) {
    const html = _localEmojiHtml(textNode.data);
    if (!html) { skipped++; continue; }
    const span = document.createElement('span');
    span.dataset.emojiDone = '1';
    span.style.display = 'contents';
    span.innerHTML = html;
    try {
      textNode.parentNode.replaceChild(span, textNode);
      replaced++;
    } catch(e) {
      errors++;
      console.warn('[emoji] replaceChild error:', e.message, '| text:', textNode.data?.slice(0,30));
    }
  }
  if (replaced > 0 || errors > 0) {
    console.log(`[emoji] parse(${(root||document.body).id||root?.tagName||'body'}): заменено=${replaced} пропущено=${skipped} ошибок=${errors}`);
  }
}

function _twemojiParse(node) {
  // Если тогл выключен — не трогаем DOM, оставляем системные emoji
  if (!_emojiStyleEnabled()) return;
  // На Android — используем локальные ассеты
  if (window.Android && typeof IOS_EMOJI_MAP !== 'undefined') {
    _localEmojiParse(node || document.body);
    return;
  }
  // Веб-фолбэк: CDN twemoji
  if (typeof twemoji === 'undefined') return;
  twemoji.parse(node || document.body, {
    folder: 'svg',
    ext: '.svg',
    base: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/',
    callback: (icon) => {
      const cleaned = icon.split('-').filter(p => p.toLowerCase() !== 'fe0f').join('-') || icon;
      return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/${cleaned}.png`;
    }
  });
}

function _initTwemoji() {
  // Если тогл emoji выключен — используем системные (не трогаем DOM)
  if (!_emojiStyleEnabled()) return;

  // На Android — сразу запускаем локальный рендерер, не ждём twemoji
  if (window.Android && typeof IOS_EMOJI_MAP !== 'undefined') {
    _initEmojiPack(); // проверяем пак и при необходимости качаем
    _localEmojiParse(document.body);
    if (_emojiObserver) return;
    // Дебаунс — не запускаем парсер чаще чем раз в 80мс
    let _emojiTimer = null;
    const _emojiQueue = new Set();
    function _emojiFlush() {
      _emojiTimer = null;
      _emojiQueue.forEach(n => _localEmojiParse(n));
      _emojiQueue.clear();
    }
    function _emojiSchedule(node) {
      _emojiQueue.add(node);
      if (!_emojiTimer) _emojiTimer = setTimeout(_emojiFlush, 80);
    }
    _emojiObserver = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            // Элемент — парсим его содержимое
            const tag = node.tagName;
            if (tag && !['CANVAS','SCRIPT','STYLE','INPUT','TEXTAREA'].includes(tag)) {
              _emojiSchedule(node);
            }
          } else if (node.nodeType === 3) {
            // Текстовый узел — парсим родителя
            const p = node.parentNode;
            if (p && p.nodeType === 1) {
              const tag = p.tagName;
              if (tag && !['CANVAS','SCRIPT','STYLE','INPUT','TEXTAREA'].includes(tag)
                  && !p.dataset?.emojiDone) {
                _emojiSchedule(p);
              }
            }
          }
        }
      }
    });
    _emojiObserver.observe(document.body, { childList: true, subtree: true });
    return;
  }
  // Веб: ждём twemoji
  if (typeof twemoji === 'undefined') {
    setTimeout(_initTwemoji, 200);
    return;
  }
  _twemojiParse(document.body);
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) {
          const tag = node.tagName;
          if (tag && !['CANVAS','SCRIPT','STYLE','INPUT','TEXTAREA'].includes(tag)) {
            _twemojiParse(node);
          }
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ══════════════════════════════════════════════════════════════════
// 👑 VIP СИСТЕМА
// Активация: /vip LOMKICH2025  (секретный код в CMD)
// ══════════════════════════════════════════════════════════════════
const VIP_CODES = ['LOMKICH2025','SAPP_VIP','SCHEDULEAPP_PRO'];
const VIP_KEY = 'sapp_vip_v1';

function vipCheck() {
  // Сначала проверяем серверный статус из профиля (server source of truth)
  const p = profileLoad();
  if (p && p.vip) return true;
  // Фоллбэк на локальный ключ (для оффлайн-режима)
  return !!localStorage.getItem(VIP_KEY);
}
async function vipSyncFromServer(username) {
  // Подтягиваем VIP из Supabase users таблицы при каждом входе
  if (!sbReady() || !username) return;
  try {
    const rows = await sbGet('users', `select=vip,badge,frame&username=eq.${encodeURIComponent(username)}&limit=1`);
    if (!Array.isArray(rows) || !rows.length) return;
    const row = rows[0];
    const p   = profileLoad();
    if (!p) return;
    let changed = false;
    if (row.vip !== undefined && p.vip !== row.vip)     { p.vip   = row.vip;   changed = true; }
    if (row.badge !== undefined && p.badge !== row.badge){ p.badge = row.badge; changed = true; }
    if (row.frame !== undefined && p.frame !== row.frame){ p.frame = row.frame; changed = true; }
    if (changed) {
      profileSave(p);
      // Обновляем localStorage VIP ключ
      if (row.vip) localStorage.setItem(VIP_KEY, '1');
      else         localStorage.removeItem(VIP_KEY);
      // Перерендериваем UI профиля если нужно
      if (typeof profileRenderScreen === 'function') profileRenderScreen();
    }
  } catch(e) {}
}
function vipActivate(code) {
  if (!VIP_CODES.includes(code.toUpperCase())) return false;
  localStorage.setItem(VIP_KEY, '1');
  const p = profileLoad();
  if (p) {
    p.vip = true; profileSave(p);
    if (sbReady()) {
      _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(p.username)}`,
        { vip: true }, { 'Content-Type':'application/json', 'Prefer':'return=minimal' }).catch(()=>{});
    }
  }
  return true;
}

// ══════════════════════════════════════════════════════════════════════
// 💳 ДОНАТ / СБП   поддержи проект и получи VIP
// Схема:
//   1. Пользователь выбирает сумму ↩ открывается QR/ссылка СБП
//   2. После оплаты жмёт «Я оплатил» ↩ вводит номер транзакции
//   3. Запись сохраняется в таблицу donations (Supabase)
//   4. Владелец вручную подтверждает ↩ vipGrantTo(username)
//      ИЛИ   авто-верификация через webhook если настроен
// ══════════════════════════════════════════════════════════════════════

// СБП реквизиты
const SBP_PHONE      = '+79966219426';
const SBP_DIRECT_URL = 'https://t.tb.ru/c2c-qr-choose-bank?requisiteNumber=+79966219426&bankCode=100000000004';

const DONATE_TIERS = [
  { amount: 20,  label: '⭐ VIP месяц',    desc: '+ VIP на 30 дней' },
  { amount: 30,  label: '👑 VIP 3 месяца', desc: '+ VIP на 90 дней' },
  { amount: 100, label: '🚀 VIP навсегда', desc: '+ VIP навсегда'   },
];

let _selectedDoneTierIdx = 0;

function showDonateSheet() {
  const existing = document.getElementById('donate-sheet');
  if (existing) existing.remove();

  const sheet = document.createElement('div');
  sheet.id = 'donate-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,.55);display:flex;flex-direction:column;justify-content:flex-end;animation:mcFadeIn .15s ease';

  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:24px 24px 0 0;padding:14px 0 calc(24px + var(--safe-bot,0px));max-height:92vh;overflow-y:auto;animation:mcSlideUp .26s cubic-bezier(.34,1.1,.64,1)"
         onclick="event.stopPropagation()">
      <div style="width:44px;height:4px;background:var(--surface3);border-radius:2px;margin:0 auto 18px"></div>

      <div style="text-align:center;padding:0 20px 18px">
        <div style="font-size:32px;margin-bottom:6px">💝</div>
        <div style="font-size:19px;font-weight:800;color:var(--text)">Поддержи проект</div>
        <div style="font-size:13px;color:var(--muted);margin-top:4px;line-height:1.5">
          Перевод по СБП — мгновенно, без комиссии.<br>VIP активируется после подтверждения.
        </div>
      </div>

      <!-- Тарифы -->
      <div style="padding:0 16px;display:grid;gap:10px">
        ${DONATE_TIERS.map((t, i) => `
          <div onclick="donateSelectTier(${i})" id="donate-tier-${i}"
            style="display:flex;align-items:center;gap:14px;padding:14px 16px;
                   border-radius:16px;border:2px solid ${i===0?'var(--accent)':'transparent'};
                   background:${i===0?'color-mix(in srgb,var(--accent) 8%,var(--surface))':'var(--surface2)'};
                   cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent;
                   opacity:${i===0?'1':'0.6'}">
            <div style="font-size:26px;flex-shrink:0">${t.label.split(' ')[0]}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:700;color:var(--text)">${t.label.slice(t.label.indexOf(' ')+1)}</div>
              <div style="font-size:12px;color:var(--muted)">${t.desc}</div>
            </div>
            <div style="font-size:20px;font-weight:800;color:var(--accent);flex-shrink:0">${t.amount}₽</div>
          </div>`).join('')}
      </div>

      <!-- Кнопка -->
      <div style="padding:18px 16px 0">
        <button id="donate-pay-btn" onclick="donateOpenLink()"
          style="width:100%;padding:16px;background:var(--accent);border:none;border-radius:16px;
                 color:#fff;font-family:inherit;font-size:16px;font-weight:800;
                 cursor:pointer;-webkit-tap-highlight-color:transparent">
          Оплатить 20₽ через СБП
        </button>
        <div style="text-align:center;margin-top:8px;font-size:11px;color:var(--muted)">
          Номер: <b style="color:var(--text)">${SBP_PHONE}</b> — выбор банка в браузере
        </div>
      </div>

      <!-- Подтверждение -->
      <div id="donate-confirm-section" style="display:none;padding:14px 16px 0">
        <div style="background:var(--surface2);border-radius:14px;padding:14px 16px">
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">✅ Я оплатил</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
            Введи последние 4 цифры суммы или номер операции из уведомления банка:
          </div>
          <input id="donate-txn-input" placeholder="Номер операции / последние 4 цифры"
            maxlength="20" inputmode="numeric"
            style="width:100%;padding:10px 14px;background:var(--surface);
                   border:1.5px solid rgba(255,255,255,.12);border-radius:10px;
                   color:var(--text);font-size:15px;font-family:inherit;
                   outline:none;box-sizing:border-box;caret-color:var(--accent)">
          <button onclick="donateConfirm()"
            style="width:100%;margin-top:10px;padding:13px;background:var(--accent);
                   border:none;border-radius:10px;color:#fff;font-family:inherit;
                   font-size:14px;font-weight:700;cursor:pointer">
            Отправить на проверку
          </button>
        </div>
      </div>
    </div>`;

  sheet.addEventListener('click', () => sheet.remove());
  document.body.appendChild(sheet);
}

function donateSelectTier(i) {
  _selectedDoneTierIdx = i;
  DONATE_TIERS.forEach((t, idx) => {
    const el = document.getElementById(`donate-tier-${idx}`);
    if (!el) return;
    el.style.opacity     = idx === i ? '1' : '0.6';
    el.style.borderColor = idx === i ? 'var(--accent)' : 'transparent';
    el.style.background  = idx === i
      ? 'color-mix(in srgb,var(--accent) 8%,var(--surface))'
      : 'var(--surface2)';
  });
  const btn = document.getElementById('donate-pay-btn');
  if (btn) btn.textContent = `Оплатить ${DONATE_TIERS[i].amount}₽ через СБП`;
}

function donateOpenLink() {
  const tier = DONATE_TIERS[_selectedDoneTierIdx];
  // Строим СБП-ссылку с нужной суммой (сумма в копейках)
  const url = `https://t.tb.ru/c2c-qr-choose-bank?requisiteNumber=+79966219426&bankCode=100000000004&sum=${tier.amount * 100}`;
  if (window.Android?.openUrl) {
    window.Android.openUrl(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
  toast(`💳 Переведи ${tier.amount}₽ через СБП на ${SBP_PHONE}`);
  // Показываем подтверждение через 2с
  setTimeout(() => {
    const sec = document.getElementById('donate-confirm-section');
    if (sec) { sec.style.display = 'block'; sec.scrollIntoView({ behavior: 'smooth' }); }
  }, 2000);
}

async function donateConfirm() {
  const txn = document.getElementById('donate-txn-input')?.value?.trim();
  if (!txn || txn.length < 4) { toast('❌ Введи номер транзакции'); return; }
  const p = profileLoad();
  if (!p) { toast('❌ Войди в аккаунт'); return; }
  const btn = document.querySelector('#donate-confirm-section button');
  if (btn) { btn.disabled = true; btn.textContent = 'Отправляю...'; }
  try {
    const res = await _sbFetch('POST', '/rest/v1/donations',
      { username: p.username, amount: DONATE_TIERS[_selectedDoneTierIdx].amount,
        txn_id: txn, ts: Date.now(), status: 'pending',
        tier: DONATE_TIERS[_selectedDoneTierIdx].label, vip_tier: true },
      { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
    );
    if (res.ok || res.status === 201) {
      document.getElementById('donate-sheet')?.remove();
      const tier = DONATE_TIERS[_selectedDoneTierIdx];
      _vipBotNotify(p, tier.amount, tier.label, txn);
      toast('🎉 Заявка отправлена! VIP активируется после проверки.');
    } else {
      throw new Error(res.status);
    }
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Отправить на проверку'; }
    toast('❌ Ошибка отправки, попробуй позже');
  }
}




// ── Проверка отображения всех emoji из карты ───────────────────────────────
// Команда: /emoji_check в девконсоли
// Выводит все emoji группами по категориям — можно визуально проверить каждый
function emojiCheck() {
  if (typeof IOS_EMOJI_MAP === 'undefined') {
    cmdPrint('err', '❌ IOS_EMOJI_MAP не загружен');
    return;
  }

  // Группируем emoji по категории (по пути файла)
  const groups = {};
  for (const [emoji, path] of Object.entries(IOS_EMOJI_MAP)) {
    const cat = path.split('/')[0]; // act, food, nat, obj, ppl, sym, travel, flags
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ emoji, path });
  }

  const catOrder = ['ppl','nat','food','act','travel','obj','sym','flags'];
  const catLabels = {
    ppl: '👤 Люди и жесты',
    nat: '🌿 Природа и животные',
    food: '🍎 Еда и напитки',
    act: '⚽ Активность и спорт',
    travel: '✈️ Путешествия',
    obj: '💡 Объекты',
    sym: '🔣 Символы',
    flags: '🏳️ Флаги',
  };

  cmdPrint('info', '══════════════════════════════════════════════');
  cmdPrint('info', `  📦 Проверка emoji-пака  (всего: ${Object.keys(IOS_EMOJI_MAP).length})`);
  cmdPrint('info', '  Скопируй вывод консоли и скинь если что-то');
  cmdPrint('info', '  не отображается или отображается как □');
  cmdPrint('info', '══════════════════════════════════════════════');

  // Выводим каждую категорию построчно по 20 emoji в строке
  const ROW = 20;
  for (const cat of catOrder) {
    const items = groups[cat];
    if (!items || items.length === 0) continue;

    cmdPrint('info', '');
    cmdPrint('ok', `── ${catLabels[cat] || cat}  (${items.length}) ──`);

    // Базовые emoji без вариантов кожи (оставляем только уникальные базовые)
    // Для флагов и ppl это может быть много — показываем все
    for (let i = 0; i < items.length; i += ROW) {
      const chunk = items.slice(i, i + ROW);
      const line = chunk.map(x => x.emoji).join(' ');
      // Выводим emoji строку + номера для ориентира
      cmdPrint('out', `${String(i+1).padStart(4,'0')}: ${line}`);
    }

    // Дополнительно: список имён файлов для тех кто не отображается
    // Выводим по 5 в строку для читаемости
    const names = items.map(x => x.path.split('/')[1].replace('.png',''));
    for (let i = 0; i < names.length; i += 5) {
      const chunk = names.slice(i, i + 5).join(' | ');
      cmdPrint('muted', `      ${chunk}`);
    }
  }

  cmdPrint('info', '');
  cmdPrint('info', '══════════════════════════════════════════════');
  cmdPrint('info', '  ✅ Готово. Если видишь □ вместо emoji —');
  cmdPrint('info', '  запусти /emoji_diag для диагностики.');
  cmdPrint('info', '══════════════════════════════════════════════');
}

// ── Диагностика emoji-пака ──────────────────────────────────────────────────
// Команда: /emoji_diag в девконсоли
// Сравнивает файлы на диске с IOS_EMOJI_MAP и выводит отчёт в консоль
async function emojiDiag() {
  if (!window.Android?.getEmojiFileList) {
    console.warn('[emoji_diag] Android.getEmojiFileList недоступен');
    toast('❌ Метод getEmojiFileList не найден');
    return;
  }
  if (typeof IOS_EMOJI_MAP === 'undefined') {
    console.warn('[emoji_diag] IOS_EMOJI_MAP не определён');
    toast('❌ IOS_EMOJI_MAP не загружен');
    return;
  }

  toast('🔍 Диагностика emoji запущена...');

  let diskFiles;
  try {
    diskFiles = JSON.parse(window.Android.getEmojiFileList());
  } catch(e) {
    console.error('[emoji_diag] Ошибка чтения списка файлов:', e);
    toast('❌ Ошибка чтения файлов');
    return;
  }

  const diskSet = new Set(diskFiles); // "food/Hot Beverage.png"
  // Нормализованный сет для нечёткого сравнения
  const diskLower = new Map(); // "food/hot beverage.png" -> "food/Hot Beverage.png"
  diskFiles.forEach(f => diskLower.set(f.toLowerCase(), f));

  const mapPaths = Object.values(IOS_EMOJI_MAP); // пути из карты
  const mapSet   = new Set(mapPaths);

  const missingExact   = []; // в карте есть, на диске нет (точное совпадение)
  const missingButClose = []; // на диске есть похожий файл (регистр отличается)
  const extraOnDisk    = []; // на диске есть, в карте нет

  for (const path of mapSet) {
    if (diskSet.has(path)) continue; // ✅ точное совпадение
    const lower = path.toLowerCase();
    if (diskLower.has(lower)) {
      missingButClose.push({ mapPath: path, diskPath: diskLower.get(lower) });
    } else {
      missingExact.push(path);
    }
  }
  for (const f of diskFiles) {
    if (!mapSet.has(f)) extraOnDisk.push(f);
  }

  console.group('[emoji_diag] Результат');
  console.log(`Файлов на диске: ${diskFiles.length}`);
  console.log(`Записей в IOS_EMOJI_MAP: ${mapPaths.length} (уникальных путей: ${mapSet.size})`);
  console.log(`✅ Точных совпадений: ${mapSet.size - missingExact.length - missingButClose.length}`);

  if (missingButClose.length > 0) {
    console.group(`⚠️ Разница в регистре (${missingButClose.length}) — карта ожидает один регистр, диск другой:`);
    missingButClose.slice(0, 30).forEach(({mapPath, diskPath}) =>
      console.log(`  карта: "${mapPath}" | диск: "${diskPath}"`)
    );
    if (missingButClose.length > 30) console.log(`  ... и ещё ${missingButClose.length - 30}`);
    console.groupEnd();
  }

  if (missingExact.length > 0) {
    console.group(`❌ Отсутствуют на диске (${missingExact.length}):`);
    missingExact.slice(0, 30).forEach(p => console.log('  ' + p));
    if (missingExact.length > 30) console.log(`  ... и ещё ${missingExact.length - 30}`);
    console.groupEnd();
  }

  if (extraOnDisk.length > 0) {
    console.group(`📂 На диске есть, но нет в карте (${extraOnDisk.length}) — примеры:`);
    extraOnDisk.slice(0, 10).forEach(p => console.log('  ' + p));
    if (extraOnDisk.length > 10) console.log(`  ... и ещё ${extraOnDisk.length - 10}`);
    console.groupEnd();
  }
  console.groupEnd();

  const msg = missingButClose.length > 0
    ? `⚠️ Регистр: ${missingButClose.length} файлов. Диск: ${diskFiles.length}, Карта: ${mapSet.size}`
    : missingExact.length > 0
    ? `❌ Нет ${missingExact.length} файлов из ${mapSet.size}. Смотри консоль.`
    : `✅ Все ${diskFiles.length} файлов совпадают!`;
  toast(msg);

  // Если есть проблема с регистром — исправляем карту в памяти
  if (missingButClose.length > 0) {
    console.log('[emoji_diag] Применяю авто-фикс регистра в IOS_EMOJI_MAP...');
    let fixed = 0;
    for (const [emoji, path] of Object.entries(IOS_EMOJI_MAP)) {
      const lower = path.toLowerCase();
      if (!diskSet.has(path) && diskLower.has(lower)) {
        IOS_EMOJI_MAP[emoji] = diskLower.get(lower);
        fixed++;
      }
    }
    console.log(`[emoji_diag] Исправлено в памяти: ${fixed} записей. Перезапускаю парсер...`);
    _localEmojiParse(document.body);
    toast(`🔧 Авто-фикс: исправлено ${fixed} записей регистра`);
  }
}

// CMD команда /vip
// Добавляем в cmdExec   патч через хук
const _origCmdExecForVip = window.cmdExec;
if (typeof cmdExec === 'function') {
  // Вставим /vip перед default кейсом через monkey-patch
  window._vipCmdHandler = function(cmd, arg) {
    if (cmd === '/vip') {
      if (!arg) { cmdPrint('info','👑 Использование: /vip <КОД>  (секретный код VIP)'); return true; }
      if (vipActivate(arg)) {
        cmdPrint('ok','👑 VIP активирован! Теперь доступны: фото-аватар, рамки профиля, значки, кастомный баннер');
        toast('👑 Добро пожаловать в VIP!');
        profileRenderScreen();
      } else {
        cmdPrint('err','❌ Неверный код VIP');
      }
      return true;
    }
    return false;
  };
}

// ══════════════════════════════════════════════════════════════════
// 🖼 ЗНАЧКИ, РАМКИ, БАННЕРЫ
// Рамки и баннеры скрыты из UI редактирования, но работают для тех кто их поставил
// и могут быть выставлены через /frame и /banner в CMD
// ══════════════════════════════════════════════════════════════════
const PROFILE_FRAMES = {
  'none':     { cls: '',               style: '',                                                label: 'Нет',         vip: false },
  'accent':   { cls: '',               style: 'box-shadow:0 0 0 3px var(--accent)',              label: '🔶 Акцент',   vip: false },
  'glow':     { cls: '',               style: 'box-shadow:0 0 16px 4px var(--accent)',           label: '✅ Свечение', vip: true  },
  'rainbow':  { cls: 'frame-rainbow',  style: '',                                                label: '🌈 Радуга',   vip: true  },
  'gold':     { cls: '',               style: 'box-shadow:0 0 0 3px #f5c518,0 0 12px #f5c51866', label: '🥇 Золото',  vip: true  },
  'neon':     { cls: '',               style: 'box-shadow:0 0 0 3px #00e5ff,0 0 20px #00e5ff88', label: '💠 Неон',    vip: true  },
  'fire':     { cls: 'frame-fire',     style: '',                                                label: '🔥 Огонь',   vip: true  },
};

const PROFILE_BANNERS = [
  { id: 'none',    label: 'Нет',         style: 'background:var(--surface2)',                                    vip: false },
  { id: 'accent',  label: 'Акцент',      style: 'background:linear-gradient(135deg,var(--accent)66,var(--surface2))', vip: false },
  { id: 'sunset',  label: '🌅 Закат',    style: 'background:linear-gradient(135deg,#e87722,#c94f4f,#a78bfa)',    vip: true  },
  { id: 'ocean',   label: '🌊 Океан',    style: 'background:linear-gradient(135deg,#00e5ff,#60cdff,#4caf7d)',    vip: true  },
  { id: 'night',   label: '🌌 Ночь',     style: 'background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',    vip: true  },
  { id: 'candy',   label: '🍭 Конфета',  style: 'background:linear-gradient(135deg,#ff66aa,#a78bfa,#60cdff)',    vip: true  },
  { id: 'gold',    label: '🥇 Золото',   style: 'background:linear-gradient(135deg,#f5c518,#e87722,#c94f4f)',    vip: true  },
  { id: 'matrix',  label: '💚 Матрица',  style: 'background:linear-gradient(135deg,#0d0d0d,#0a3d0a,#00ff41)',   vip: true  },
];

const PROFILE_BADGES = [
  { id: 'early',  emoji: '🌟', label: 'Первый',  color: '#f5c518', vip: false },
  { id: 'gamer',  emoji: '🎮', label: 'Геймер',  color: '#a78bfa', vip: false },
  { id: 'vip',    emoji: '👑', label: 'VIP',     color: '#f5c518', vip: true  },
  { id: 'dev',    emoji: '⚙️', label: 'Dev',     color: '#60cdff', vip: true  },
  { id: 'fire',   emoji: '🔥', label: 'Огонь',   color: '#e87722', vip: true  },
  { id: 'ghost',  emoji: '👻', label: 'Призрак', color: '#a78bfa', vip: true  },
];

// ┄┄ CSS для рамок и мессенджера ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
(function injectFrameCSS() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes rainbow-border {
      0%{border-color:#ff0000} 14%{border-color:#ff9900} 28%{border-color:#ffff00}
      42%{border-color:#00ff00} 57%{border-color:#0099ff} 71%{border-color:#6600ff} 85%{border-color:#ff00ff} 100%{border-color:#ff0000}
    }
    @keyframes fire-border {
      0%{border-color:#e87722;box-shadow:0 0 8px #e87722} 50%{border-color:#f5c518;box-shadow:0 0 18px #f5c518} 100%{border-color:#c94f4f;box-shadow:0 0 8px #c94f4f}
    }
    .frame-rainbow{animation:rainbow-border 2s linear infinite;border-width:3px!important;border-style:solid!important}
    .frame-fire{animation:fire-border 1s ease-in-out infinite;border-width:3px!important;border-style:solid!important}
    .profile-avatar{position:relative}
    #s-messenger-chat{display:flex!important;flex-direction:column!important;padding-bottom:0!important}
    #s-messenger{padding-bottom:0!important}
    #s-peer-profile{padding-bottom:0!important}
    #mc-messages{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
  `;
  document.head.appendChild(style);
})();

// ══════════════════════════════════════════════════════════════════
// 👑 VIP БОТ — чат с поддержкой/заявками на VIP
// ══════════════════════════════════════════════════════════════════
const VIP_BOT_ID       = 'vip_bot';

// ── Динамический список проверкеров (управляется через CMD: checker add/remove) ──
const VIP_CHECKERS_KEY = 'sapp_vip_checkers_v1';
function vipCheckersLoad() {
  try { return JSON.parse(localStorage.getItem(VIP_CHECKERS_KEY) || '["lomkich"]'); }
  catch(e) { return ['lomkich']; }
}
function vipCheckersSave(arr) {
  localStorage.setItem(VIP_CHECKERS_KEY, JSON.stringify(arr));
}
function isVipChecker(username) {
  if (!username) return false;
  return vipCheckersLoad().map(u => u.toLowerCase()).includes(username.toLowerCase());
}
// Первый в списке — главный получатель уведомлений (обратная совместимость)
function getVipAdminUser() { return vipCheckersLoad()[0] || 'lomkich'; }

const VIP_ADMIN_USER = getVipAdminUser(); // для совместимости с местами, где используется напрямую
const VIP_BOT_NAME     = 'VIP Поддержка';
const VIP_BOT_AVATAR   = '👑';
const VIP_BOT_COLOR    = '#f5c518';

// Добавляет VIP-бот в список чатов и сохраняет сообщение о заявке
function _vipBotNotify(p, amount, tier, txn) {
  try {
    // Добавляем бот-чат в список чатов пользователя
    const chats = chatsLoad();
    if (!chats.includes(VIP_BOT_ID)) {
      chats.unshift(VIP_BOT_ID);
      chatsSave(chats);
    }
    // Локальное сообщение-подтверждение для пользователя
    const msgs = msgLoad();
    if (!msgs[VIP_BOT_ID]) msgs[VIP_BOT_ID] = [];
    const ts = Date.now();
    msgs[VIP_BOT_ID].push({
      from: VIP_BOT_ID,
      to: p.username,
      text: `🎉 Заявка на VIP отправлена!\n\nТариф: ${tier}\nСумма: ${amount}₽\nНомер транзакции: ${txn}\n\nВаша заявка будет проверена администратором. VIP активируется после подтверждения.`,
      ts,
      delivered: true, read: false,
      _bot: true
    });
    msgSave(msgs);
    messengerUpdateBadge?.();

    // Уведомляем администратора (@lomkich) через Supabase messages
    if (sbReady()) {
      const adminKey = sbChatKey(p.username, getVipAdminUser());
      const adminMsg = {
        from_user: p.username,
        to_user:   getVipAdminUser(),
        chat_key:  adminKey,
        text:      `[VIP ЗАЯВКА]\nПользователь: @${p.username} (${p.name})\nТариф: ${tier}\nСумма: ${amount}₽\nТранзакция: ${txn}\nВремя: ${new Date(ts).toLocaleString('ru')}`,
        ts,
        delivered: false, read: false
      };
      _sbFetch('POST', '/rest/v1/messages', adminMsg, {
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      }).catch(() => {});
    }
  } catch(e) { console.warn('[VipBot] notify error', e); }
}

// Рендер чата VIP-бота: для @lomkich — таблица заявок из Supabase donations;
// для остальных — локальные сообщения бота
async function _vipBotOpenChat() {
  const p = profileLoad();
  if (!p) return;

  // Обновляем шапку чата
  const hdrName   = document.getElementById('mc-hdr-name');
  const hdrSub    = document.getElementById('mc-hdr-sub');
  const hdrAvatar = document.getElementById('mc-hdr-avatar');
  if (hdrName)   hdrName.textContent   = VIP_BOT_NAME;
  if (hdrSub)    hdrSub.textContent    = isVipChecker(p.username) ? 'Все заявки на VIP' : 'Поддержка';
  if (hdrAvatar) {
    hdrAvatar.style.background = VIP_BOT_COLOR + '44';
    hdrAvatar.innerHTML = `<span style="font-size:20px">${VIP_BOT_AVATAR}</span>`;
  }

  const msgBody = document.getElementById('mc-messages');
  if (!msgBody) return;

  if (isVipChecker(p.username)) {
    // Администратор: грузим все заявки из таблицы donations
    msgBody.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);font-size:13px">⏳ Загрузка заявок...</div>';
    try {
      const rows = sbReady()
        ? await sbGet('donations', 'order=ts.desc&limit=100')
        : [];
      if (!Array.isArray(rows) || rows.length === 0) {
        msgBody.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px">📭 Заявок пока нет</div>';
        return;
      }
      msgBody.innerHTML = rows.map(r => {
        const dt = new Date(r.ts || 0).toLocaleString('ru');
        const statusColor = r.status === 'approved' ? '#4caf7d' : r.status === 'rejected' ? '#e05555' : '#f5c518';
        const statusLabel = r.status === 'approved' ? '✅ Подтверждено' : r.status === 'rejected' ? '❌ Отклонено' : '⏳ На проверке';
        return `<div style="margin:8px 12px;padding:12px 14px;background:var(--surface2);border-radius:14px;border-left:3px solid ${statusColor}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
            <div style="font-size:14px;font-weight:700">@${escHtml(r.username||'?')}</div>
            <span style="font-size:11px;font-weight:700;color:${statusColor};flex-shrink:0">${statusLabel}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:4px">${escHtml(r.tier||'?')} · ${r.amount||0}₽</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px">Транзакция: ${escHtml(r.txn_id||'—')}</div>
          <div style="font-size:11px;color:var(--muted)">${dt}</div>
          ${r.status === 'pending' ? `<div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-accent" style="flex:1;padding:8px;font-size:12px;margin:0" onclick="_vipAdminApprove('${escHtml(r.username||'')}',${r.id||0})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:5px"><polyline points="20 6 9 17 4 12"/></svg> Подтвердить</button>
            <button class="btn btn-surface" style="flex:1;padding:8px;font-size:12px;margin:0;color:#e05555" onclick="_vipAdminReject(${r.id||0})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:5px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Отклонить</button>
          </div>` : ''}
        </div>`;
      }).join('');
    } catch(e) {
      msgBody.innerHTML = `<div style="text-align:center;padding:30px;color:#e05555;font-size:13px">❌ Ошибка загрузки: ${e.message}</div>`;
    }
  } else {
    // Обычный пользователь: показываем локальные сообщения бота
    const msgs = msgLoad();
    const botMsgs = msgs[VIP_BOT_ID] || [];
    if (botMsgs.length === 0) {
      msgBody.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px">📭 Нет сообщений</div>';
      return;
    }
    msgBody.innerHTML = botMsgs.map(m => {
      const dt = msgFormatTime(m.ts);
      const text = (m.text || '').replace(/\n/g, '<br>');
      return `<div style="display:flex;justify-content:flex-start;padding:4px 12px">
        <div style="max-width:82%;background:var(--surface2);border-radius:16px 16px 16px 4px;padding:10px 14px;position:relative">
          <div style="font-size:13px;line-height:1.5;color:var(--text)">${text}</div>
          <div style="font-size:10px;color:var(--muted);text-align:right;margin-top:4px">${dt}</div>
        </div>
      </div>`;
    }).join('');
    setTimeout(() => { msgBody.scrollTop = msgBody.scrollHeight; }, 50);
    // Помечаем как прочитанные
    botMsgs.forEach(m => { m.read = true; });
    msgSave(msgs);
    messengerUpdateBadge?.();
  }
}

// Администратор: подтвердить VIP-заявку
async function _vipAdminApprove(username, id) {
  if (!sbReady() || !username) return;
  try {
    await _sbFetch('PATCH', `/rest/v1/donations?id=eq.${id}`,
      { status: 'approved' },
      { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
    );
    // Активируем VIP пользователю в таблице users
    await _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(username)}`,
      { vip: true },
      { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
    );
    toast(`✅ VIP активирован для @${username}`);
    _vipBotOpenChat(); // перерендер
  } catch(e) { toast('❌ Ошибка: ' + e.message); }
}

// Администратор: отклонить заявку
async function _vipAdminReject(id) {
  if (!sbReady()) return;
  try {
    await _sbFetch('PATCH', `/rest/v1/donations?id=eq.${id}`,
      { status: 'rejected' },
      { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
    );
    toast('❌ Заявка отклонена');
    _vipBotOpenChat();
  } catch(e) { toast('❌ Ошибка: ' + e.message); }
}

// Очистить фото-баннер профиля
function profileClearBanner() {
  const p = profileLoad(); if (!p) return;
  _profileApplyPendingEdits(p);
  p.banner = null; profileSave(p);
  toast('✅ Баннер убран');
  profileInitEditScreen();
}

// Применяет незасохранённые изменения из формы редактирования к объекту профиля.
// Нужно вызывать перед profileSave() при промежуточных действиях (смена рамки/значка/баннера),
// иначе аватарка, имя и цвет сбрасываются к последнему сохранённому значению.
function _profileApplyPendingEdits(p) {
  // Имя и биография из полей формы
  const nameVal = (document.getElementById('edit-name')?.value || '').trim();
  const bioVal  = (document.getElementById('edit-bio')?.value  || '').trim();
  if (nameVal) p.name = nameVal;
  if (bioVal  !== undefined) p.bio = bioVal;
  // Цвет и статус из in-memory переменных
  if (typeof _editSelectedColor  !== 'undefined') p.color  = _editSelectedColor;
  if (typeof _editSelectedStatus !== 'undefined') p.status = _editSelectedStatus;
  // Аватарка: фото или эмодзи
  if (_profileAvatarMode === 'photo') {
    p.avatarType = 'photo';
    // Если пользователь выбрал новое фото — применяем, но не стираем _profileTempAvatarData
    // (оно понадобится ещё раз при итоговом profileSaveEdit)
    if (window._profileTempAvatarData) {
      p.avatarData = window._profileTempAvatarData;
    }
  } else {
    p.avatarType = 'emoji';
    p.avatar = _editSelectedEmoji || p.avatar;
    delete p.avatarData;
  }
}

// profileSetFrame/profileSetBanner — используются только через CMD (/frame id, /banner id)
function profileSetFrame(id) {
  const p = profileLoad(); if (!p) return;
  _profileApplyPendingEdits(p);
  p.frame = PROFILE_FRAMES[id] ? id : 'none';
  profileSave(p);
  toast('✅ Рамка: ' + (PROFILE_FRAMES[p.frame]?.label || id));
  profileRenderScreen();
}
function profileSetBadge(id) {
  const p = profileLoad(); if (!p) return;
  _profileApplyPendingEdits(p);
  p.badge = id; profileSave(p);
  toast(id ? '✅ Значок выбран' : '✅ Значок убран');
  profileInitEditScreen();
}
// profileSetBanner — используется через CMD (/banner id) и для сброса
function profileSetBanner(id) {
  const p = profileLoad(); if (!p) return;
  _profileApplyPendingEdits(p);
  if (id === 'none' || !id) {
    p.banner = null;
  } else {
    const b = PROFILE_BANNERS.find(x => x.id === id);
    p.banner = b ? b.style : null;
  }
  profileSave(p);
  toast('✅ Баннер обновлён');
  profileRenderScreen();
}

function profileUploadPhotoBanner(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('❌ Фото слишком большое (макс. 5МБ)'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    openImageCrop(e.target.result, {
      mode: 'banner',
      onDone: cropped => {
        const p = profileLoad(); if (!p) return;
        p.banner = `background:url(${cropped}) center/cover no-repeat`;
        profileSave(p);
        toast('✅ Фото-баннер установлен');
        profileInitEditScreen();
      }
    });
  };
  reader.readAsDataURL(file);
}

// ══════════════════════════════════════════════════════════════════
// 🏆 ТАБЛИЦА ЛИДЕРОВ  (экран s-leaderboard добавлен ниже в HTML)
// ══════════════════════════════════════════════════════════════════
const LEADERBOARD_GAMES = [
  { id: 'snake',      emoji: '🐍', label: 'Змейка'        },
  { id: 'tetris',     emoji: '🧱', label: 'Тетрис'        },
  { id: 'pong',       emoji: '🏓', label: 'Пинг-понг'     },
  { id: 'dino',       emoji: '🦕', label: 'Динозавр'      },
  { id: 'blockblast', emoji: '💥', label: 'Block Blast'   },
  { id: 'breakout',   emoji: '🏏', label: 'Арканоид'      },
  { id: 'flappy',     emoji: '🐦', label: 'Флаппи'        },
  { id: 'bubbles',    emoji: '🎵', label: 'OSU!'          },
];
const LB_STORE_KEY = 'sapp_leaderboard_v1';
let _lbSelectedGame = 'snake';
let _lbFetching = false;

function lbLoad() { try { return JSON.parse(localStorage.getItem(LB_STORE_KEY)||'{}'); } catch(e){ return {}; } }
function lbSave(d) { localStorage.setItem(LB_STORE_KEY, JSON.stringify(d)); }

// Записать свой рекорд в глобальную таблицу лидеров при сохранении
function lbSubmitMyScores() {
  const p = profileLoad();
  if (!p) return;
  const hi = loadHiScores();
  const lb = lbLoad();
  LEADERBOARD_GAMES.forEach(g => {
    const score = hi[g.id] || 0;
    if (!score) return;
    if (!lb[g.id]) lb[g.id] = [];
    const existing = lb[g.id].find(e => e.username === p.username);
    if (existing) {
      if (score > existing.score) { existing.score = score; existing.name = p.name; existing.avatar = p.avatar; }
    } else {
      lb[g.id].push({ username: p.username, name: p.name, avatar: p.avatar, color: p.color, score });
    }
    lb[g.id].sort((a,b) => b.score - a.score);
    lb[g.id] = lb[g.id].slice(0, 50);
  });
  lbSave(lb);
  // Отправить свои рекорды в Supabase
  if (sbReady()) {
    const p2 = profileLoad();
    if (p2) LEADERBOARD_GAMES.forEach(g => {
      const score = hi[g.id] || 0;
      if (!score) return;
      sbUpsert('leaderboard', {
        game: g.id, username: p2.username, name: p2.name,
        avatar: p2.avatar || '😊', color: p2.color || '#e87722',
        score, ts: Date.now()
      });
    });
  }
}

async function leaderboardRender(skipFetch) {
  // Сначала отрисовываем локальные данные мгновенно
  _leaderboardDrawLocal();

  if (skipFetch || _lbFetching) return;
  _lbFetching = true;

  // Загружаем из Supabase
  const container = document.getElementById('lb-content');
  const refreshBtn = container?.querySelector('.lb-refresh-btn');
  if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = '⏳ Загрузка...'; }

  try {
    const data = await sbGet('leaderboard', `game=eq.${_lbSelectedGame}&order=score.desc&limit=50`);
    if (Array.isArray(data) && data.length > 0) {
      const lb = lbLoad();
      if (!lb[_lbSelectedGame]) lb[_lbSelectedGame] = [];
      data.forEach(e => {
        const idx = lb[_lbSelectedGame].findIndex(x => x.username === e.username);
        if (idx >= 0) { if (e.score > lb[_lbSelectedGame][idx].score) lb[_lbSelectedGame][idx] = {...e}; }
        else lb[_lbSelectedGame].push({...e});
      });
      lb[_lbSelectedGame].sort((a,b) => b.score - a.score);
      lb[_lbSelectedGame] = lb[_lbSelectedGame].slice(0, 50);
      lbSave(lb);
    }
  } catch(e) { /* ignore */ }
  _lbFetching = false;
  // Перерисовываем с актуальными данными
  _leaderboardDrawLocal();
}

function _leaderboardDrawLocal() {
  lbSubmitMyScores();
  const container = document.getElementById('lb-content');
  if (!container) return;
  const lb = lbLoad();
  const p = profileLoad();

  const tabsHtml = LEADERBOARD_GAMES.map(g =>
    `<button class="diff-btn${_lbSelectedGame===g.id?' active':''}" onclick="_lbSelectedGame='${g.id}';_lbFetching=false;leaderboardRender()" style="font-size:12px;padding:7px 12px">${g.emoji} ${g.label}</button>`
  ).join('');

  const entries = lb[_lbSelectedGame] || [];
  const myHi = loadHiScores()[_lbSelectedGame] || 0;
  const myRank = entries.findIndex(e => e.username === p?.username) + 1;

  const rowsHtml = entries.length === 0
    ? `<div style="text-align:center;padding:30px;color:var(--muted)">Рекордов пока нет.<br>Сыграй и стань первым! 🏆</div>`
    : entries.slice(0, 30).map((e, i) => {
        const isMe = e.username === p?.username;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:${isMe?'color-mix(in srgb,var(--accent) 10%,var(--surface2))':'var(--surface2)'};border-radius:14px;border:1.5px solid ${isMe?'var(--accent)':'var(--surface3)'};margin-bottom:8px">
            <div style="font-size:18px;width:28px;text-align:center;flex-shrink:0">${medal}</div>
            <div style="width:38px;height:38px;border-radius:50%;background:${e.color||'var(--surface3)'};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${_emojiImg(e.avatar||'😊',22)}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:700;${isMe?'color:var(--accent)':''}">${escHtml(e.name||e.username)}${isMe?' (ты)':''}</div>
              <div style="font-size:11px;color:var(--muted)">@${escHtml(e.username)}</div>
            </div>
            <div style="font-size:18px;font-weight:800;color:var(--accent);font-family:'JetBrains Mono',monospace">${e.score}</div>
          </div>`;
      }).join('');

  const myInfoHtml = p && myHi > 0 ? `
    <div style="background:var(--surface2);border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;margin-bottom:12px;font-size:13px">
      <span style="color:var(--muted)">Твой рекорд:</span>
      <span style="font-weight:700;color:var(--accent)">${myHi}${myRank > 0 ? `   #${myRank}` : '   не в топе'}</span>
    </div>` : '';

  container.innerHTML = `
    <div class="diff-picker" style="flex-wrap:wrap;gap:6px;margin-bottom:12px">${tabsHtml}</div>
    ${myInfoHtml}
    ${rowsHtml}
    <button class="btn btn-surface lb-refresh-btn" style="margin-top:8px" onclick="leaderboardRender()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Обновить из сети</button>
  `;
}

// ══════════════════════════════════════════════════════════════════
// 💬 МЕССЕНДЖЕР v2   Telegram стиль
// ══════════════════════════════════════════════════════════════════
const MSG_STORE_KEY_BASE = 'sapp_messages_v2';
const MSG_CHATS_KEY_BASE = 'sapp_chats_v1';
let _msgCurrentChat = null;
let _mcPollTimer = null;

// Per-user storage keys — prevents cross-account data leakage and duplicate chats
function _msgStoreKey() {
  try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY)); return p?.username ? MSG_STORE_KEY_BASE + '_' + p.username : MSG_STORE_KEY_BASE; } catch(e) { return MSG_STORE_KEY_BASE; }
}
function _msgChatsKey() {
  try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY)); return p?.username ? MSG_CHATS_KEY_BASE + '_' + p.username : MSG_CHATS_KEY_BASE; } catch(e) { return MSG_CHATS_KEY_BASE; }
}

function msgLoad()    { try { return JSON.parse(localStorage.getItem(_msgStoreKey())||'{}'); } catch(e){ return {}; } }
function msgSave(d)   { localStorage.setItem(_msgStoreKey(), JSON.stringify(d)); }
function chatsLoad()  {
  const perUser = localStorage.getItem(_msgChatsKey());
  if (perUser !== null) { try { return JSON.parse(perUser)||[]; } catch(e){ return []; } }
  // Migrate from old shared key on first use
  try {
    const legacy = JSON.parse(localStorage.getItem(MSG_CHATS_KEY_BASE)||'[]');
    if (legacy.length > 0) { localStorage.setItem(_msgChatsKey(), JSON.stringify(legacy)); }
    return legacy;
  } catch(e) { return []; }
}
function chatsSave(d) { localStorage.setItem(_msgChatsKey(), JSON.stringify(d)); }

function messengerOpen() { showScreen('s-messenger'); }

// ┄┄ Список чатов ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// ┄┄ Мультиселект чатов ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
const PINNED_CHATS_KEY = 'sapp_pinned_chats_v1';
function pinnedChatsLoad() { try { return JSON.parse(localStorage.getItem(PINNED_CHATS_KEY)||'[]'); } catch(e) { return []; } }
function pinnedChatsSave(d) { localStorage.setItem(PINNED_CHATS_KEY, JSON.stringify(d)); }

// ┄┄ Удалённые чаты   синхронизируются с Supabase (колонка hidden_chats) ┄┄┄┄┄┄
const DELETED_CHATS_KEY = 'sapp_deleted_chats_v1';

// ══════════════════════════════════════════════════════════════════
// 🎨 CHAT WALLPAPER   VIP-only per-chat background
// ══════════════════════════════════════════════════════════════════
const CHAT_WALLS_KEY = 'sapp_chat_walls_v2';
function chatWallsLoad() { try { return JSON.parse(localStorage.getItem(CHAT_WALLS_KEY)||'{}'); } catch(e) { return {}; } }
function chatWallsSave(d) { localStorage.setItem(CHAT_WALLS_KEY, JSON.stringify(d)); }

function chatWallGet(chatId) {
  if (!chatId) return null;
  return chatWallsLoad()[chatId] || null;
}

/** Применяет фон к mc-messages */
function chatWallApply(chatId) {
  const body = document.getElementById('mc-messages');
  if (!body) return;
  const wall = chatWallGet(chatId);
  if (wall) {
    body.style.backgroundImage  = wall.startsWith('data:') || wall.startsWith('http') ? `url('${wall}')` : 'none';
    body.style.backgroundSize   = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundColor  = wall.startsWith('#') ? wall : '';
    body.style.backgroundRepeat = 'no-repeat';
    // Делаем пузыри немного прозрачными поверх фото-фона
    if (wall.startsWith('data:') || wall.startsWith('http')) {
      body.style.setProperty('--bubble-me-bg', 'rgba(var(--accent-rgb,54,132,255),.85)');
      body.style.setProperty('--bubble-them-bg', 'rgba(30,30,30,.82)');
    }
  } else {
    body.style.backgroundImage  = '';
    body.style.backgroundColor  = '';
    body.removeProperty && body.style.removeProperty('--bubble-me-bg');
    body.removeProperty && body.style.removeProperty('--bubble-them-bg');
  }
}

function chatWallSet(chatId, value) {
  const walls = chatWallsLoad();
  if (value) walls[chatId] = value;
  else delete walls[chatId];
  chatWallsSave(walls);
  chatWallApply(chatId);
}

/** Открывает диалог выбора фона чата   только VIP */
function showChatWallpaperPicker(chatId) {
  if (!vipCheck()) {
    toast('🔒 Фон чата   только для VIP');
    return;
  }
  const current = chatWallGet(chatId);
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.55);animation:mcFadeIn .15s ease';

  const PRESETS = [
    { label:'Убрать', value:null, bg:'var(--surface3)', ico:'🚫' },
    { label:'Тёмный', value:'#0d0d0d', bg:'#0d0d0d', ico:'' },
    { label:'Морской', value:'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', bg:'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', ico:'' },
    { label:'Закат',  value:'linear-gradient(135deg,#f7971e,#ffd200,#ff5f6d)', bg:'linear-gradient(135deg,#f7971e,#ffd200,#ff5f6d)', ico:'' },
    { label:'Лес',   value:'linear-gradient(135deg,#134e5e,#71b280)', bg:'linear-gradient(135deg,#134e5e,#71b280)', ico:'' },
    { label:'Ночь',  value:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', bg:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', ico:'' },
    { label:'Роза',  value:'linear-gradient(135deg,#ff9a9e,#fad0c4)', bg:'linear-gradient(135deg,#ff9a9e,#fad0c4)', ico:'' },
    { label:'Фото',  value:'__pick__', bg:'var(--surface2)', ico:'🖼' },
  ];

  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:16px 16px calc(20px + var(--safe-bot));animation:mcSlideUp .24s cubic-bezier(.34,1.1,.64,1)" onclick="event.stopPropagation()">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:0 auto 16px"></div>
      <div style="font-size:15px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px">
        🎨 Фон чата <span style="font-size:10px;background:linear-gradient(90deg,#f5c518,#e87722);color:#000;padding:2px 7px;border-radius:6px;font-weight:800">VIP</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
        ${PRESETS.map(p => `
          <div onclick="chatWallPickPreset('${chatId}','${p.value||''}');this.closest('[style*=fixed]').remove()"
            style="border-radius:14px;height:72px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:8px;cursor:pointer;border:${current===p.value?'2.5px solid var(--accent)':'2px solid transparent'};background:${p.bg};box-shadow:0 2px 8px rgba(0,0,0,.3);position:relative;overflow:hidden">
            ${p.ico ? `<span style="font-size:22px">${p.ico}</span>` : ''}
            <span style="font-size:10px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);font-weight:600">${p.label}</span>
          </div>`).join('')}
      </div>
    </div>`;

  sheet.addEventListener('click', () => sheet.remove());
  document.body.appendChild(sheet);
}

function chatWallPickPreset(chatId, value) {
  if (value === '__pick__') {
    // Открываем пикер изображений
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = async (e) => {
      const file = e.target.files[0]; inp.remove();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => chatWallSet(chatId, ev.target.result);
      reader.readAsDataURL(file);
    };
    inp.click();
    return;
  }
  chatWallSet(chatId, value || null);
  toast(value ? '🎨 Фон установлен' : '🎨 Фон убран');
}


function deletedChatsLoad() { try { return JSON.parse(localStorage.getItem(DELETED_CHATS_KEY)||'[]'); } catch(e) { return []; } }
function deletedChatsSave(d) { localStorage.setItem(DELETED_CHATS_KEY, JSON.stringify(d)); }

/** Помечает чат как удалённый локально + синхронизирует в Supabase */
function _markChatDeleted(username) {
  const deleted = deletedChatsLoad();
  if (!deleted.includes(username)) {
    deleted.push(username);
    deletedChatsSave(deleted);
  }
  const p = profileLoad();
  if (p && sbReady()) {
    _sbFetch('PATCH', `/rest/v1/users?username=eq.${encodeURIComponent(p.username)}`,
      { hidden_chats: JSON.stringify(deleted) },
      { 'Content-Type':'application/json','Prefer':'return=minimal' }).catch(()=>{});
  }
}

/** Синхронизирует список удалённых чатов с сервера при входе */
async function syncDeletedChatsFromServer(username) {
  if (!sbReady() || !username) return;
  try {
    const rows = await sbGet('users', `select=hidden_chats&username=eq.${encodeURIComponent(username)}&limit=1`);
    if (!Array.isArray(rows) || !rows.length) return;
    const raw = rows[0].hidden_chats;
    if (!raw) return;
    const serverDeleted = JSON.parse(raw);
    if (!Array.isArray(serverDeleted)) return;
    const local = deletedChatsLoad();
    const merged = [...new Set([...local, ...serverDeleted])];
    deletedChatsSave(merged);
    // Убираем удалённые из списка чатов и сообщений
    const msgs = msgLoad();
    let chats = chatsLoad();
    let changed = false;
    merged.forEach(u => {
      if (chats.includes(u)) { chats = chats.filter(x => x !== u); changed = true; }
      if (msgs[u]) { delete msgs[u]; changed = true; }
    });
    if (changed) { chatsSave(chats); msgSave(msgs); }
  } catch(e) {}
}

function togglePinChat(username) {
  console.log('[Pin] togglePinChat:', username);
  const pins = pinnedChatsLoad();
  const idx  = pins.indexOf(username);
  if (idx === -1) { pins.unshift(username); toast('📌 Чат закреплён'); }
  else            { pins.splice(idx,1);     toast('Чат откреплён'); }
  pinnedChatsSave(pins);
  messengerRenderList();
}

function showChatContextMenu(username) {
  console.log('[Chat] context menu for:', username);
  try { window.Android?.vibrate?.(35); } catch(_) {}
  SFX.play && SFX.play('btnClick');
  const pins = pinnedChatsLoad();
  const isPinned = pins.includes(username);
  const existing = document.getElementById('chat-ctx-menu');
  if (existing) existing.remove();

  const sheet = document.createElement('div');
  sheet.id = 'chat-ctx-menu';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9150;background:rgba(0,0,0,.45);animation:mcFadeIn .15s ease;display:flex;flex-direction:column;justify-content:flex-end';

  const peer = peersLoad()[username] || {};
  const name = peer.displayName || peer.display_name || username;

  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:12px 0 calc(16px + var(--safe-bot));animation:mcSlideUp .24s cubic-bezier(.34,1.1,.64,1)" onclick="event.stopPropagation()">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:0 auto 14px"></div>
      <div style="font-size:14px;font-weight:700;color:var(--muted);padding:0 20px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(name)}</div>
      <button onclick="document.getElementById('chat-ctx-menu')?.remove();togglePinChat('${escHtml(username)}')"
        style="width:100%;padding:14px 20px;background:none;border:none;color:var(--text);font-family:inherit;font-size:15px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:16px;-webkit-tap-highlight-color:transparent">
        <span style="font-size:20px">${isPinned ? '📌' : '📌'}</span>
        ${isPinned ? 'Открепить чат' : 'Закрепить чат'}
      </button>
      <div style="height:1px;background:rgba(255,255,255,.06);margin:0 16px"></div>
      <button onclick="document.getElementById('chat-ctx-menu')?.remove();msgSelectEnter('${escHtml(username)}')"
        style="width:100%;padding:14px 20px;background:none;border:none;color:var(--text);font-family:inherit;font-size:15px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:16px;-webkit-tap-highlight-color:transparent">
        <span style="font-size:20px">☑️</span> Выбрать
      </button>
    </div>`;

  sheet.addEventListener('click', () => sheet.remove());
  document.body.appendChild(sheet);
}

let _msgSelectMode = false;
const _msgSelected = new Set();

function msgSelectEnter(username) {
  _msgSelectMode = true;
  _msgSelected.clear();
  if (username) _msgSelected.add(username); // сразу выделяем тот чат, что зажали
  document.getElementById('msg-hdr-normal').style.display = 'none';
  document.getElementById('msg-hdr-select').style.display = '';
  // Скрываем поиск и FAB в режиме выделения
  const searchBar = document.querySelector('#s-messenger > [style*="padding:8px"]');
  if (searchBar) searchBar.style.display = 'none';
  const fab = document.getElementById('msg-fab-container');
  if (fab) { fab.style.opacity = '0'; fab.style.pointerEvents = 'none'; }
  messengerRenderList();
  _msgUpdateSelectCount();
  try { window.Android?.vibrate?.(35); } catch(_) {}
  SFX.play('btnClick');
}

function msgSelectCancel() {
  _msgSelectMode = false;
  _msgSelected.clear();
  document.getElementById('msg-hdr-normal').style.display = '';
  document.getElementById('msg-hdr-select').style.display = 'none';
  // Восстанавливаем поиск и FAB
  const searchBar = document.querySelector('#s-messenger > [style*="padding:8px"]');
  if (searchBar) searchBar.style.display = '';
  const fab = document.getElementById('msg-fab-container');
  if (fab) { fab.style.opacity = ''; fab.style.pointerEvents = ''; }
  messengerRenderList();
}

function msgToggleSelect(username, e) {
  e.stopPropagation();
  if (_msgSelected.has(username)) _msgSelected.delete(username);
  else _msgSelected.add(username);
  // Авто-выход если ничего не выделено
  if (_msgSelected.size === 0) { msgSelectCancel(); return; }
  _msgUpdateSelectCount();
  // Обновить визуал конкретной строки с анимацией
  const row = document.querySelector(`[data-chat-user="${CSS.escape(username)}"]`);
  if (row) {
    row.classList.toggle('chat-selected', _msgSelected.has(username));
    // Обновляем оверлей аватара
    _msgUpdateAvatarOverlay(row, _msgSelected.has(username));
    row.classList.remove('chat-row-selecting');
    void row.offsetWidth;
    row.classList.add('chat-row-selecting');
    row.addEventListener('animationend', () => row.classList.remove('chat-row-selecting'), { once: true });
  }
}

function _msgUpdateSelectCount() {
  const el = document.getElementById('msg-select-count');
  if (el) el.textContent = String(_msgSelected.size);
}

function _msgUpdateAvatarOverlay(row, selected) {
  const ov = row.querySelector('.chat-av-sel-ov');
  if (ov) ov.classList.toggle('sel', selected);
}

function msgDeleteSelected() {
  if (_msgSelected.size === 0) return;
  const n  = _msgSelected.size;
  const sh = document.createElement('div');
  sh.style.cssText = 'position:fixed;inset:0;z-index:9900;background:rgba(0,0,0,.55);display:flex;flex-direction:column;justify-content:flex-end;animation:mcFadeIn .15s ease';
  sh.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:20px 16px calc(20px + var(--safe-bot,0px));animation:mcSlideUp .24s cubic-bezier(.34,1.1,.64,1)" onclick="event.stopPropagation()">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:0 auto 16px"></div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px">Удалить ${n} ${n===1?'чат':n<5?'чата':'чатов'}?</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:20px">История переписки будет удалена только у тебя.</div>
      <button onclick="_doDeleteSelectedChats();this.closest('[style*=fixed]').remove()"
        style="width:100%;padding:14px;background:var(--danger,#c94f4f);border:none;border-radius:14px;color:#fff;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px">🗑 Удалить</button>
      <button onclick="this.closest('[style*=fixed]').remove()"
        style="width:100%;padding:14px;background:var(--surface2);border:none;border-radius:14px;color:var(--text);font-family:inherit;font-size:15px;font-weight:600;cursor:pointer">Отмена</button>
    </div>`;
  sh.addEventListener('click', () => sh.remove());
  document.body.appendChild(sh);
}

function _doDeleteSelectedChats() {
  const msgs = msgLoad(), chats = chatsLoad();
  const toDelete = [..._msgSelected];

  // Анимируем каждую строку перед удалением
  const rows = toDelete.map(u => document.querySelector(`[data-chat-user="${CSS.escape(u)}"]`)).filter(Boolean);

  const doDelete = () => {
    toDelete.forEach(u => {
      delete msgs[u];
      const i = chats.indexOf(u);
      if (i !== -1) chats.splice(i, 1);
      const p = profileLoad();
      if (p) { const k = sbChatKey(p.username, u); clearInterval(_fbMsgStreams[k]); delete _fbMsgStreams[k]; }
      _markChatDeleted(u);
    });
    msgSave(msgs); chatsSave(chats); msgSelectCancel(); messengerUpdateBadge();
    messengerRenderList();
  };

  if (rows.length > 0) {
    rows.forEach(r => r.classList.add('chat-row-deleting'));
    setTimeout(doDelete, 320); // ждём конца анимации
  } else {
    doDelete();
  }
}

function msgPinSelected() {
  if (_msgSelected.size === 0) return;
  _msgSelected.forEach(u => {
    const pins = pinnedChatsLoad();
    if (!pins.includes(u)) { pins.unshift(u); pinnedChatsSave(pins); }
  });
  toast('📌 Закреплено ' + _msgSelected.size + ' чат(ов)');
  msgSelectCancel();
}

function msgMuteSelected() {
  if (_msgSelected.size === 0) return;
  _msgSelected.forEach(u => {
    const muted = JSON.parse(localStorage.getItem('muted_chats') || '[]');
    const idx = muted.indexOf(u);
    if (idx === -1) muted.push(u); else muted.splice(idx, 1);
    localStorage.setItem('muted_chats', JSON.stringify(muted));
    _mcUpdateMuteIcon && _mcUpdateMuteIcon();
  });
  toast('🔇 Изменено для ' + _msgSelected.size + ' чат(ов)');
  msgSelectCancel();
}

function msgSelectMoreMenu() {
  const sh = document.createElement('div');
  sh.style.cssText = 'position:fixed;inset:0;z-index:9900;background:rgba(0,0,0,.45);display:flex;flex-direction:column;justify-content:flex-end;animation:mcFadeIn .15s ease';
  sh.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:10px 0 calc(16px + var(--safe-bot,0px));animation:mcSlideUp .24s cubic-bezier(.34,1.1,.64,1)" onclick="event.stopPropagation()">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:0 auto 12px"></div>
      <button onclick="this.closest('[style*=fixed]').remove();msgReadSelected()"
        style="width:100%;padding:14px 20px;background:none;border:none;color:var(--text);font-family:inherit;font-size:15px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:16px;-webkit-tap-highlight-color:transparent">
        <span style="font-size:20px">✅</span> Отметить как прочитанное
      </button>
    </div>`;
  sh.addEventListener('click', () => sh.remove());
  document.body.appendChild(sh);
}

function msgReadSelected() {
  if (_msgSelected.size === 0) return;
  const msgs = msgLoad();
  const p = profileLoad();
  _msgSelected.forEach(u => {
    if (msgs[u]) msgs[u].forEach(m => { if (m.from !== p?.username) m.read = true; });
  });
  msgSave(msgs);
  messengerUpdateBadge();
  toast('✅ Прочитано');
  msgSelectCancel();
}

// ┄┄ Удаление одного чата изнутри ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function messengerDeleteCurrentChat() {
  const username = _msgCurrentChat;
  if (!username) return;
  if (!confirm('Удалить чат с @' + username + '?')) return;
  const msgs  = msgLoad();
  const chats = chatsLoad();
  delete msgs[username];
  const idx = chats.indexOf(username);
  if (idx !== -1) chats.splice(idx, 1);
  msgSave(msgs);
  chatsSave(chats);
  const p = profileLoad();
  if (p) {
    const key = sbChatKey(p.username, username);
    clearInterval(_fbMsgStreams[key]);
    delete _fbMsgStreams[key];
  }
  _markChatDeleted(username); // синхронизируем с Supabase
  showScreen('s-messenger', 'back');
  messengerRenderList();
  messengerUpdateBadge();
  toast('🗑 Чат удалён');
}

// ┄┄ Telegram-style превью последнего сообщения в списке чатов ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function _mcPreviewText(msg) {
  if (!msg) return '';

  // Стикер
  if (msg.sticker) return msg.sticker + ' Стикер';

  // Фото (base64 или URL в msg.image)
  if (msg.image) return '📷 Фото';

  // Медиа-файлы по fileType
  if (msg.fileType === 'voice') {
    const dur = msg.duration;
    if (dur) {
      const m = Math.floor(dur / 60), s = String(dur % 60).padStart(2, '0');
      return '🎤 ' + m + ':' + s;
    }
    return '🎤 Голосовое';
  }
  if (msg.fileType === 'video') return '🎬 Видео';
  if (msg.fileType === 'file') {
    const name = msg.fileName || '';
    const ext  = (name.split('.').pop() || '').toLowerCase();
    const audioExts = ['mp3','ogg','wav','flac','aac','m4a','opus','wma'];
    if (audioExts.includes(ext)) {
      // Музыкальный файл   показываем имя без расширения
      const cleanName = name.replace(/\.[^.]+$/, '');
      return '🎵 ' + (cleanName || 'Аудио');
    }
    return '📎 ' + (name || 'Файл');
  }

  // Если text похож на имя файла голосового (legacy: text = fileName)
  const txt = msg.text || '';
  if (/^voice_\d+\.m4a$/i.test(txt.trim()))  return '🎤 Голосовое';
  if (/^voice_\d+\.(ogg|webm|mp4)$/i.test(txt.trim())) return '🎤 Голосовое';

  // Обычный текст
  return txt.slice(0, 55) || '';
}

function messengerRenderList(filter) {
  const list = document.getElementById('messenger-list');
  if (!list) return;
  const p = profileLoad();
  let chats = chatsLoad();
  if (filter) chats = chats.filter(u => u.toLowerCase().includes(filter.toLowerCase()));
  const msgs = msgLoad();

  if (chats.length === 0 && !_msgSelectMode) {
    list.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;padding:60px 20px;color:var(--muted);gap:12px">
        <div style="font-size:52px">💬</div>
        <div style="font-size:17px;font-weight:700;color:var(--text)">Нет сообщений</div>
        <div style="font-size:13px;text-align:center">Открой список онлайн и начни общаться</div>
        <button class="btn btn-accent" style="margin-top:8px;width:auto;padding:12px 24px" onclick="profileRenderOnline();showScreen('s-online')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Найти собеседника</button>
      </div>`;
    return;
  }

  const _pins  = pinnedChatsLoad();
  const sorted = [...chats].sort((a, b) => {
    const pa = _pins.includes(a) ? 1 : 0;
    const pb = _pins.includes(b) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    const la  = msgs[a]?.slice(-1)[0]?.ts || 0;
    const lb2 = msgs[b]?.slice(-1)[0]?.ts || 0;
    return lb2 - la;
  });

  list.innerHTML = sorted.map(username => {
    const chatMsgs = msgs[username] || [];
    const last     = chatMsgs[chatMsgs.length - 1];
    const unread   = chatMsgs.filter(m => m.from !== p?.username && !m.read).length;
    const peer     = _profileOnlinePeers.find(u => u.username === username)
                   || _allKnownUsers.find(u => u.username === username);
    const isOnline = !!_profileOnlinePeers.find(u => u.username === username);
    // ── VIP-бот: спец-отрисовка ───────────────────────────────────────────────
    if (username === VIP_BOT_ID) {
      const botMsgs  = msgs[VIP_BOT_ID] || [];
      const botUnread = botMsgs.filter(m => !m.read).length;
      const botLast  = botMsgs[botMsgs.length - 1];
      const botPrev  = botLast ? escHtml((botLast.text||'').split('\n')[0].slice(0,45)) : '<span style="color:var(--muted)">Нажми для открытия</span>';
      const botTime  = botLast ? msgFormatTime(botLast.ts) : '';
      const _pinned  = _pins.includes(VIP_BOT_ID);
      return `<div
          data-chat-user="${VIP_BOT_ID}"
          onclick="messengerOpenChat('${VIP_BOT_ID}')"
          class="chat-row"
          style="display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04);${_pinned?'background:rgba(255,255,255,.025)':''}">
        <div style="position:relative;flex-shrink:0">
          <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#f5c518,#e87722);display:flex;align-items:center;justify-content:center;font-size:26px">👑</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
            <div style="font-size:15px;font-weight:600;color:var(--text)">${VIP_BOT_NAME}</div>
            <span style="font-size:11px;color:${botUnread>0?'var(--accent)':'var(--muted)'}">${botTime}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80%">${botPrev}</div>
            ${botUnread > 0 ? `<div style="min-width:20px;height:20px;border-radius:10px;background:var(--accent);color:#000;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px;flex-shrink:0">${botUnread}</div>` : ''}
          </div>
        </div>
      </div>`;
    }
    // ── Группы: берём имя/аватар из groupGet, а не из users ──────────────────
    const _isGroupChat = username === PUBLIC_GROUP_ID || username.startsWith('grp_');
    const _groupData   = _isGroupChat ? groupGet(username) : null;
    const name     = _groupData?.name  || peer?.name  || username;
    const avatar   = _groupData?.avatar || peer?.avatar || '😊';
    const color    = _groupData?.color  || peer?.color  || 'var(--surface3)';
    // ┄┄ Telegram-style preview ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
    const _prevText = _mcPreviewText(last);
    const _isMe     = last?.from === p?.username;
    const _prevIcon = (() => {
      if (!last) return '';
      if (last.sticker)               return '';   // стикер   сам эмодзи
      if (last.image)                 return '📷 ';
      if (last.fileType === 'voice')  return '';   // уже содержит 🎤
      if (last.fileType === 'video')  return '';   // уже содержит 🎬
      if (last.fileType === 'file')   return '';   // уже содержит 📎/🎵
      return '';
    })();
    const _mePrefix = _isMe ? `<span style="color:var(--accent);font-weight:600">Ты: </span>` : '';
    const preview = last
      ? _mePrefix + escHtml(_prevText)
      : '<span style="color:var(--muted)">Нет сообщений</span>';
    const timeStr  = last ? msgFormatTime(last.ts) : '';
    const isSel    = _msgSelected.has(username);

    const rowClick  = _msgSelectMode
      ? `msgToggleSelect('${username}', event)`
      : `messengerOpenChat('${username}')`;

    // avatar: photo support (группы и личные чаты)
    const avatarData = peer?.avatarData || peer?.avatar_data;
    const avatarHtml = (_isGroupChat && _groupData?.avatarType === 'photo' && _groupData?.avatarData)
      ? `<img src="${_groupData.avatarData}" style="width:52px;height:52px;border-radius:50%;object-fit:cover">`
      : (peer?.avatarType === 'photo' || peer?.avatar_type === 'photo') && avatarData
        ? `<img src="${avatarData}" style="width:52px;height:52px;border-radius:50%;object-fit:cover">`
        : `${_emojiImg(avatar,30)}`;

    const _pinned = _pins.includes(username);
    // Локальный никнейм (если задан)
    const _localNick = localNickGet(username);
    const displayName = _localNick || name;
    return `<div
        data-chat-user="${escHtml(username)}"
        onclick="${rowClick}"
        oncontextmenu="event.preventDefault();msgSelectEnter('${username}')"
        ontouchstart="${_msgSelectMode ? '' : `msgRowTouchStart(this,'${escHtml(username)}')`}"
        ontouchmove="${_msgSelectMode ? '' : 'msgRowTouchMove()'}"
        ontouchend="${_msgSelectMode ? '' : 'msgRowTouchEnd()'}"
        class="chat-row${isSel ? ' chat-selected' : ''}"
        style="display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04);${_pinned&&!_msgSelectMode?'background:rgba(255,255,255,.025)':''}">
      ${_pinned && !_msgSelectMode ? '<span style="font-size:13px;opacity:.5;flex-shrink:0;transform:rotate(45deg);display:inline-block">📌</span>' : ''}
      <div style="position:relative;flex-shrink:0">
        <div style="width:52px;height:52px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;overflow:hidden">${avatarHtml}</div>
        ${isOnline && !_msgSelectMode ? '<div style="position:absolute;bottom:2px;right:2px;width:13px;height:13px;border-radius:50%;background:#4caf7d;border:2.5px solid var(--bg)"></div>' : ''}
        ${_msgSelectMode ? `<div class="chat-av-sel-ov${isSel?' sel':''}"></div>` : ''}
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
          <div style="font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:65%">${escHtml(displayName)}${_localNick ? `<span style="font-size:10px;color:var(--muted);margin-left:4px">@${escHtml(username)}</span>` : ''}${isChatEncrypted(username) ? '<span style="font-size:11px;margin-left:4px" title="Секретный чат">🔐</span>' : ''}</div>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
            ${_pinned && !_msgSelectMode ? `<button onclick="event.stopPropagation();togglePinChat('${username}')" style="background:none;border:none;padding:0 2px;cursor:pointer;font-size:12px;opacity:.55;line-height:1" title="Открепить">📌</button>` : ''}
            <span style="font-size:11px;color:${unread>0?'var(--accent)':'var(--muted)'}">${timeStr}</span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:75%;display:flex;align-items:center;gap:3px">
            ${(() => {
              if (!last) return preview;
              // Медиа   иконка крупнее + label
              if (last.fileType === 'voice') {
                const dur = last.duration;
                const durStr = dur ? ` ${Math.floor(dur/60)}:${String(dur%60).padStart(2,'0')}` : '';
                return (_isMe ? `<span style="color:var(--accent);font-weight:600">Ты: </span>` : '')
                  + `<span style="color:var(--text);font-weight:500">🎤</span>`
                  + `<span style="color:var(--muted)"> Голосовое${durStr}</span>`;
              }
              if (last.image) {
                return (_isMe ? `<span style="color:var(--accent);font-weight:600">Ты: </span>` : '')
                  + `<span style="color:var(--text);font-weight:500">📷</span>`
                  + `<span style="color:var(--muted)"> Фото</span>`;
              }
              if (last.fileType === 'video') {
                return (_isMe ? `<span style="color:var(--accent);font-weight:600">Ты: </span>` : '')
                  + `<span style="color:var(--text);font-weight:500">🎬</span>`
                  + `<span style="color:var(--muted)"> Видео</span>`;
              }
              if (last.fileType === 'file') {
                const ext = (last.fileName||'').split('.').pop().toLowerCase();
                const isAud = ['mp3','ogg','wav','flac','aac','m4a','opus','wma'].includes(ext);
                const ico = isAud ? '🎵' : '📎';
                const nm  = isAud ? (last.fileName||'').replace(/\.[^.]+$/,'') : (last.fileName||'Файл');
                return (_isMe ? `<span style="color:var(--accent);font-weight:600">Ты: </span>` : '')
                  + `<span style="color:var(--text);font-weight:500">${ico}</span>`
                  + `<span style="color:var(--muted)"> ${escHtml(nm.slice(0,40))}</span>`;
              }
              if (last.sticker) {
                return (_isMe ? `<span style="color:var(--accent);font-weight:600">Ты: </span>` : '')
                  + `<span>${typeof _emojiImg==='function' ? _emojiImg(last.sticker,16) : escHtml(last.sticker)}</span>`
                  + `<span style="color:var(--muted)"> Стикер</span>`;
              }
              // Обычный текст
              return preview;
            })()}
          </div>
          ${unread > 0 ? '<div style="background:var(--accent);color:var(--btn-text,#000);border-radius:10px;font-size:11px;font-weight:800;padding:2px 7px;flex-shrink:0;min-width:20px;text-align:center">'+unread+'</div>' : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  messengerUpdateBadge();
}


// Long-press для мобильного   с защитой от свайпа
let _msgLongPressTimer = null;
let _msgTouchStartX = 0, _msgTouchStartY = 0;
let _msgTouchMoved = false;

function msgRowTouchStart(el, username) {
  const ev = window.event;
  const t  = ev?.touches?.[0];
  _msgTouchStartX = t?.clientX || 0;
  _msgTouchStartY = t?.clientY || 0;
  _msgTouchMoved  = false;
  if (_msgSelectMode) return;
  el.style.background = 'rgba(255,255,255,.04)';
  _msgLongPressTimer = setTimeout(() => {
    el.style.background = '';
    if (!_msgTouchMoved) {
      // Telegram-style: сразу входим в режим выделения с этим чатом
      msgSelectEnter(username);
    }
  }, 480);
}

function msgRowTouchMove() {
  const ev = window.event;
  const t  = ev?.touches?.[0];
  if (!t) return;
  const dx = Math.abs(t.clientX - _msgTouchStartX);
  const dy = Math.abs(t.clientY - _msgTouchStartY);
  if (dx > 9 || dy > 9) {
    _msgTouchMoved = true;
    clearTimeout(_msgLongPressTimer);
    document.querySelectorAll('.chat-row').forEach(r => { r.style.background = ''; });
  }
}

function msgRowTouchEnd() {
  clearTimeout(_msgLongPressTimer);
  document.querySelectorAll('.chat-row').forEach(r => { r.style.background = ''; });
}
function messengerFilterChats(q) { messengerRenderList(q); }

// ┄┄ Открытие чата ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function messengerOpenChat(username) {
  if (username === VIP_BOT_ID) {
    _msgCurrentChat = VIP_BOT_ID;
    showScreen('s-messenger-chat');
    _vipBotOpenChat();
    _mcUpdateMuteIcon?.();
    // скрываем инпут-бар для бота
    const inputBar = document.getElementById('mc-input-bar');
    if (inputBar) inputBar.style.display = 'none';
    return;
  }
  if (username === PUBLIC_GROUP_ID) {
    _showPublicGroupSplash(() => _doOpenChat(username));
    return;
  }
  _doOpenChat(username);
}

function _doOpenChat(username) {
  _msgCurrentChat = username;
  // Восстанавливаем инпут-бар (мог быть скрыт при открытии vip_bot)
  const inputBar = document.getElementById('mc-input-bar');
  if (inputBar) inputBar.style.display = '';
  // Сбрасываем уведомления от этого пользователя
  try { window.Android?.dismissNotifications?.(); } catch(_) {}
  // Сообщения помечаются прочитанными только при скролле до конца (см. messengerMarkRead)
  const msgs = msgLoad();
  const p = profileLoad();
  messengerUpdateBadge();

  // Слушатель скролла   помечаем прочитанными только когда прокрутили до конца
  const msgBody = document.getElementById('mc-messages');
  if (msgBody && !msgBody._readListener) {
    msgBody._readListener = true;
    msgBody.addEventListener('scroll', () => {
      const atBottom = msgBody.scrollHeight - msgBody.scrollTop - msgBody.clientHeight < 60;
      if (atBottom) messengerMarkRead();
    }, { passive: true });
  }

  // Обновляем шапку   ищем и онлайн и оффлайн пользователей
  const peer = _profileOnlinePeers.find(u => u.username === username)
             || _allKnownUsers.find(u => u.username === username);
  const hdrName = document.getElementById('mc-hdr-name');
  const hdrSub  = document.getElementById('mc-hdr-sub');
  const hdrAvatar = document.getElementById('mc-hdr-avatar');
  const _openedGroup = (username === PUBLIC_GROUP_ID || username.startsWith('grp_')) ? groupGet(username) : null;
  if (hdrName) hdrName.textContent = _openedGroup ? _openedGroup.name : (localNickGet(username) || peer?.name || username);
  if (hdrSub) {
    if (_openedGroup) {
      hdrSub.textContent = _openedGroup.members.length + ' участников';
    } else if (isChatEncrypted(username)) {
      hdrSub.textContent = '🔐 Секретный чат';
    } else {
      hdrSub.textContent = peer
        ? (_profileOnlinePeers.find(u => u.username === username) ? '🟢 В сети' : '⚡ Не в сети')
        : ('@' + username);
    }
  }
  if (hdrAvatar) {
    const _hdrGrp = _openedGroup;
    const hasGrpPhoto = _hdrGrp?.avatarType === 'photo' && _hdrGrp?.avatarData;
    const hasPhoto = !hasGrpPhoto && (peer?.avatarType === 'photo') && peer?.avatarData;
    if (hasGrpPhoto) {
      hdrAvatar.style.background = 'transparent';
      hdrAvatar.innerHTML = `<img src="${_hdrGrp.avatarData}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`;
    } else if (hasPhoto) {
      hdrAvatar.style.background = 'transparent';
      hdrAvatar.innerHTML = `<img src="${peer.avatarData}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`;
    } else {
      hdrAvatar.style.background = _hdrGrp ? 'linear-gradient(135deg,#2b5797,#1e3f6f)' : (peer?.color || 'var(--surface3)');
      hdrAvatar.innerHTML = _hdrGrp
        ? (_hdrGrp.avatar || '👥')
        : (peer?.avatar || peer?.name?.charAt(0) || username.charAt(0).toUpperCase() || '?');
    }
  }

  showScreen('s-messenger-chat');
  messengerRenderMessages();
  chatWallApply(username); // применяем фон чата
  // Рендерим закреплённое сообщение и иконку mute
  mcRenderPinBar();
  _mcUpdateMuteIcon();
  mcUpdateEncryptBtn(); // обновляем иконку шифрования

  // Fix: принудительно перезапускаем polling при открытии чата  
  // это гарантирует немедленный запрос к Supabase, не ждём следующего тика.
  // Решает проблему "нужно перезаходить чтобы увидеть новые сообщения".
  if (p) {
    sbForceRecheckChat(p.username, username);
    // Сообщаем нативному Worker'у   сдвигаем окно чтобы не дублировать уведомления
    if (window.Android && typeof window.Android.updateLastMsgTs === 'function') {
      try { window.Android.updateLastMsgTs(Date.now()); } catch(_){}
    }
  }

  // Предзагружаем профили всех участников группы — чтобы аватарки отображались в пузырях
  const _openedGroupForMembers = (username === PUBLIC_GROUP_ID || username.startsWith('grp_')) ? groupGet(username) : null;
  if (_openedGroupForMembers && sbReady()) {
    const unknownMembers = (_openedGroupForMembers.members || []).filter(u =>
      u !== '__all__' && u !== p?.username && !_allKnownUsers.some(x => x.username === u)
    );
    if (unknownMembers.length) {
      const unames = unknownMembers.slice(0, 30).map(u => `"${u}"`).join(',');
      sbGet('users', `select=username,name,avatar,avatar_type,avatar_data,color,status,vip,badge&username=in.(${unames})&limit=30`)
        .then(rows => {
          if (!Array.isArray(rows)) return;
          rows.forEach(u => {
            if (_allKnownUsers.some(x => x.username === u.username)) return;
            _allKnownUsers.push({
              username: u.username, name: u.name,
              avatar: u.avatar, avatarType: u.avatar_type,
              avatarData: u.avatar_data, color: u.color,
              status: u.status, vip: u.vip, badge: u.badge, _online: false
            });
          });
          if (_msgCurrentChat === username) messengerRenderMessages();
        }).catch(() => {});
    }
    // Также подгружаем профили тех кто писал в чат, но не в списке участников
    const chatMsgsForProfiles = (msgLoad()[username] || []);
    const msgAuthors = [...new Set(chatMsgsForProfiles.map(m => m.from).filter(u =>
      u && u !== p?.username && !_allKnownUsers.some(x => x.username === u)
    ))];
    if (msgAuthors.length) {
      const unames2 = msgAuthors.slice(0, 30).map(u => `"${u}"`).join(',');
      sbGet('users', `select=username,name,avatar,avatar_type,avatar_data,color,status,vip,badge&username=in.(${unames2})&limit=30`)
        .then(rows => {
          if (!Array.isArray(rows)) return;
          rows.forEach(u => {
            if (_allKnownUsers.some(x => x.username === u.username)) return;
            _allKnownUsers.push({
              username: u.username, name: u.name,
              avatar: u.avatar, avatarType: u.avatar_type,
              avatarData: u.avatar_data, color: u.color,
              status: u.status, vip: u.vip, badge: u.badge, _online: false
            });
          });
          if (_msgCurrentChat === username) messengerRenderMessages();
        }).catch(() => {});
    }
  }

  // Запустить polling для этого чата (таймер-сторож, 2 сек)
  // Если стрим по какой-то причине умер   перезапускаем его немедленно
  clearInterval(_mcPollTimer);
  _mcPollTimer = setInterval(() => {
    const p2 = profileLoad();
    if (!p2 || !_msgCurrentChat) return;
    const key = sbChatKey(p2.username, _msgCurrentChat);
    if (!_fbMsgStreams[key]) sbForceRecheckChat(p2.username, _msgCurrentChat);
  }, 2000);
} // end _doOpenChat

// ┄┄ Рендер сообщений ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function messengerRenderMessages(animateLast) {
  const body = document.getElementById('mc-messages');
  if (!body || !_msgCurrentChat) return;
  const msgs = msgLoad();
  const p = profileLoad();
  const chatMsgs = msgs[_msgCurrentChat] || [];

  if (chatMsgs.length === 0) {
    body.innerHTML = `<div style="text-align:center;margin:auto;padding:30px;color:var(--muted)">
      <div style="font-size:36px;margin-bottom:8px">👋</div>
      <div style="font-size:13px">Начни разговор!</div>
    </div>`;
    return;
  }

  let lastDate = null;
  let lastFrom = null;
  const html = chatMsgs.map((msg, idx) => {
    const isMe = msg.from === p?.username;
    const dt = new Date(msg.ts);
    const dateStr = dt.toLocaleDateString('ru', {day:'numeric', month:'long'});
    const showDate = dateStr !== lastDate;
    lastDate = dateStr;
    const showAvatar = !isMe && (lastFrom !== msg.from || showDate);
    const showName  = !isMe && (lastFrom !== msg.from || showDate); // имя автора в группах
    lastFrom = msg.from;
    const isLast = idx === chatMsgs.length - 1;
    const nextIsOther = idx < chatMsgs.length - 1 && chatMsgs[idx+1].from !== msg.from;
    const showTail = isLast || nextIsOther;

    // Ищем данные отправителя: сначала онлайн, потом все известные, потом кэш групп
    const peer = _profileOnlinePeers.find(u => u.username === msg.from)
              || _allKnownUsers.find(u => u.username === msg.from);

    // Определяем   это групповой чат?
    const _isGroupChat = _msgCurrentChat && (
      _msgCurrentChat === PUBLIC_GROUP_ID ||
      _msgCurrentChat.startsWith('grp_')
    );

    // Аватар: фото > emoji > первая буква
    const _peerColor = peer?.color || 'var(--surface3)';
    const _hasPhoto = (peer?.avatarType === 'photo' || peer?.avatar_type === 'photo') && (peer?.avatarData || peer?.avatar_data);
    const _peerAvatar = _hasPhoto
      ? `<img src="${peer.avatarData||peer.avatar_data}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;display:block">`
      : `${_emojiImg(peer?.avatar || msg.from.charAt(0).toUpperCase(), 18)}`;

    const avatarEl = (_isGroupChat && showAvatar && !isMe)
      ? `<div style="width:28px;height:28px;border-radius:50%;background:${_peerColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;align-self:flex-end;overflow:hidden;cursor:pointer" onclick="peerProfileOpen('${msg.from}')">${_peerAvatar}</div>`
      : `<div style="width:${_isGroupChat ? '28' : '0'}px;flex-shrink:0"></div>`;

    // Telegram-style статус: ⏳ pending ↩ ✅ sent ↩ ✓✓ delivered (gray) ↩ ✓✓ read (blue)
    const status = isMe ? (() => {
      if (msg.pending) {
        // Часы   сообщение в очереди (нет сети)
        return `<span style="display:inline-flex;align-items:center;margin-left:3px;opacity:.6">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
          </svg>
        </span>`;
      }
      if (msg.read) {
        // Двойная синяя галочка   прочитано (точно как Telegram)
        return `<span style="display:inline-flex;align-items:center;margin-left:3px">
          <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke="#4fc3f7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1,5.5 4.5,9 10,2"/>
            <polyline points="6,5.5 9.5,9 15,2"/>
          </svg>
        </span>`;
      }
      if (msg.delivered) {
        // Двойная серая галочка   доставлено, не прочитано
        return `<span style="display:inline-flex;align-items:center;margin-left:3px;opacity:.65">
          <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1,5.5 4.5,9 10,2"/>
            <polyline points="6,5.5 9.5,9 15,2"/>
          </svg>
        </span>`;
      }
      // Одинарная серая галочка   отправлено на сервер
      return `<span style="display:inline-flex;align-items:center;margin-left:3px;opacity:.6">
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="1,4.5 4,7.5 10,1"/>
        </svg>
      </span>`;
    })() : '';

    const bubbleRadius = isMe
      ? (showTail ? '18px 18px 4px 18px' : '18px 18px 18px 18px')
      : (showTail ? '18px 18px 18px 4px' : '18px 18px 18px 18px');

    const dateSep = showDate ? `<div style="text-align:center;margin:12px 0 8px;display:flex;align-items:center;gap:10px">
      <div style="flex:1;height:1px;background:rgba(255,255,255,.08)"></div>
      <div style="font-size:11px;font-weight:600;color:var(--muted);padding:3px 10px;background:var(--surface2);border-radius:10px;white-space:nowrap">${dateStr}</div>
      <div style="flex:1;height:1px;background:rgba(255,255,255,.08)"></div>
    </div>` : '';

    // Reply quote if msg has replyTo
    const replyQuote = msg.replyTo ? `
      <div style="border-left:3px solid ${isMe?'rgba(255,255,255,.5)':'var(--accent)'};padding:3px 8px;margin-bottom:4px;border-radius:4px;background:rgba(0,0,0,.12)">
        <div style="font-size:10px;font-weight:700;opacity:.85">${escHtml(msg.replyTo.from)}</div>
        <div style="font-size:11px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${escHtml(msg.replyTo.text?.slice(0,60)||'')}</div>
      </div>` : '';

    // Sticker rendering
    const isSticker = msg.sticker;
    const isImage   = msg.image;
    const isVoice   = msg.fileType === 'voice';
    const isVideo   = msg.fileLink && msg.fileType === 'video';
    const isCircle  = msg.fileLink && msg.fileType === 'circle';
    const isFile    = msg.fileLink && msg.fileType === 'file' && !_isAudioFile(msg.fileName);
    const isAudio   = msg.fileLink && msg.fileType === 'file' && _isAudioFile(msg.fileName);
    // Парсим extra для доп. флагов (front-камера у кружка и т.д.)
    let _msgExtra = null;
    try { if (msg.extra) _msgExtra = typeof msg.extra === 'string' ? JSON.parse(msg.extra) : msg.extra; } catch(_) {}
    const isFrontCircle = isCircle && (_msgExtra?.front === true);
    const bubbleBg  = (isSticker || isImage || isVideo || isCircle) ? 'transparent' : (isMe ? 'var(--accent)' : 'var(--surface2)');
    const bubblePad = (isSticker || isImage || isVideo || isCircle) ? '0' : '8px 12px 6px';    const _fmtSize  = s => !s ? '' : s > 1048576 ? (s/1048576).toFixed(1)+' МБ' : s > 1024 ? (s/1024).toFixed(0)+' КБ' : s+' Б';
    const _fmtDur   = s => { const m=Math.floor((s||0)/60), sec=String((s||0)%60).padStart(2,'0'); return m+':'+sec; };
    const safeUrl   = escHtml(msg.fileLink || '');
    const safeName  = escHtml(msg.fileName || '');
    const voiceId   = 'voice_' + idx;
    // ┄┄ Telegram-style waveform generator ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
    // Генерирует псевдослучайные бары на основе seed   детерминировано
    function _tgWave(seed, bars) {
      let s = seed | 0;
      const rnd = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 16) / 65535; };
      return Array.from({length:bars}, (_, i) => {
        const envelope = Math.sin(Math.PI * i / bars) * 0.72 + 0.28;
        return Math.max(0.06, rnd() * envelope);
      });
    }

    // ┄┄ SVG waveform (голосовые) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
    function _tgWaveSVG(id, seed, isMe) {
      const bars   = 40, W = 160, H = 30, bw = 2, gap = 2;
      const levels = _tgWave(seed, bars);
      const clrOn  = isMe ? 'rgba(255,255,255,.95)' : 'var(--accent)';
      const clrOff = isMe ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.22)';
      const rects  = levels.map((lvl, i) => {
        const h = Math.max(3, Math.round(lvl * H));
        const x = i * (bw + gap);
        const y = Math.round((H - h) / 2);
        return '<rect class="wvb" data-i="'+i+'" x="'+x+'" y="'+y+'" width="'+bw+'" height="'+h+'" rx="1" fill="'+clrOff+'" data-on="'+clrOn+'" data-off="'+clrOff+'"/>';
      }).join('');
      return '<svg id="wv_'+id+'" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="flex:1;cursor:pointer;overflow:visible" onclick="mcVoiceSeek(event,\'\',\''+id+'\',this)" preserveAspectRatio="none">'+rects+'</svg>';
    }

    const tgPlayBg  = isMe ? 'rgba(255,255,255,.22)' : 'var(--accent)';
    const tgPlayClr = isMe ? '#fff' : 'var(--btn-text,#fff)';
    const tgMuted   = isMe ? 'rgba(255,255,255,.6)'  : 'var(--muted)';
    const tgText    = isMe ? '#fff' : 'var(--text)';

    const msgContent = isSticker
      ? `<div class="mc-sticker-wrap" style="font-size:56px;line-height:1.1;text-align:center">${typeof _emojiImg==='function' ? _emojiImg(msg.sticker,56) : escHtml(msg.sticker)}</div>`

      // ┄┄ ФОТО   скруглённые углы, gradient overlay, время поверх ┄┄┄┄┄┄┄┄┄┄
      : isImage
        ? `<div style="position:relative;border-radius:14px;overflow:hidden;max-width:240px;min-width:100px;cursor:pointer"
               onclick="photoZoomOpen('${msg.image.replace(/'/g,"\\'")}','Фото')">
             <img src="${msg.image}" style="display:block;width:100%;max-width:240px;min-height:60px;border-radius:14px;object-fit:cover" loading="lazy">
             <div style="position:absolute;bottom:0;left:0;right:0;height:32px;background:linear-gradient(transparent,rgba(0,0,0,.38));border-radius:0 0 14px 14px;pointer-events:none"></div>
             <div style="position:absolute;bottom:5px;right:7px;display:flex;align-items:center;gap:3px;pointer-events:none">
               <span style="font-size:10px;color:rgba(255,255,255,.9);text-shadow:0 1px 2px rgba(0,0,0,.55)">${msgFormatTime(msg.ts)}</span>
               <span style="font-size:11px;color:rgba(255,255,255,.9)">${status}</span>
             </div>
           </div>`

      // ┄┄ ГОЛОСОВОЕ   Telegram: 46px кнопка + waveform bars + countdown ┄┄┄┄┄
      : isVoice
        ? (() => {
            const wv = _tgWaveSVG(voiceId, (msg.ts|0) ^ (idx*7919), isMe);
            // Белая точка у непрочитанного входящего голосового (как в Telegram)
            const unreadDot = (!isMe && !msg.read)
              ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#fff;margin-left:5px;flex-shrink:0;align-self:center"></span>`
              : '';
            return `<div data-no-menu style="display:flex;align-items:center;gap:10px;padding:2px 0;min-width:220px;max-width:270px">
             <button id="vbtn_${voiceId}" onclick="mcVoicePlay('${safeUrl}','${voiceId}')"
               style="width:46px;height:46px;min-width:46px;border-radius:50%;background:${tgPlayBg};border:none;color:${tgPlayClr};cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent"
               ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity=''">
               <svg id="vico_${voiceId}" width="18" height="18" viewBox="0 0 18 18" fill="${tgPlayClr}"><polygon points="5,2 16,9 5,16"/></svg>
             </button>
             <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
               <div style="display:flex;align-items:center">${wv}</div>
               <div style="display:flex;align-items:center;justify-content:space-between">
                 <div style="display:flex;align-items:center">
                   <span style="font-size:11px;color:${tgMuted};font-weight:500">Голосовое</span>
                   ${unreadDot}
                 </div>
                 <span id="vtime_${voiceId}" style="font-size:11px;font-family:'JetBrains Mono',monospace;color:${tgMuted};font-weight:600">${_fmtDur(msg.duration)}</span>
               </div>
             </div>
           </div>`;
          })()

      // ┄┄ КРУЖОК (видеосообщение)   inline плеер в чате (как Telegram) ┄┄┄┄
      : isCircle
        ? (() => {
            const cid = 'circ_' + idx + '_' + msg.ts;
            const circumference = 2 * Math.PI * 97;
            const mirrorStyle = isFrontCircle ? 'transform:scaleX(-1);' : '';
            // 160px в покое (density-independent), 280px при полном воспроизведении
            const SZ = Math.round(160 * (window.devicePixelRatio > 2 ? 1.2 : 1));
            return `<div data-no-menu id="cw_${cid}" data-circle-url="${safeUrl}"
               style="position:relative;width:${SZ}px;height:${SZ}px;border-radius:50%;overflow:hidden;cursor:pointer;background:#1a1a1a;flex-shrink:0;transition:width .3s cubic-bezier(.34,1.1,.64,1),height .3s cubic-bezier(.34,1.1,.64,1)"
               onclick="mcCircleToggle('${cid}','${safeUrl}',false)">
             <div id="cposter_${cid}" style="position:absolute;inset:0">
               <div style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center">
                 <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7z" fill="rgba(255,255,255,.65)"/></svg>
               </div>
             </div>
             <div id="cvid_${cid}" style="position:absolute;inset:0;display:none;border-radius:50%;overflow:hidden;${mirrorStyle}"></div>
             <svg id="cring_${cid}" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none" viewBox="0 0 200 200">
               <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="4"/>
               <circle id="cringp_${cid}" cx="100" cy="100" r="96" fill="none" stroke="#fff" stroke-width="4"
                 stroke-dasharray="${(2*Math.PI*96).toFixed(1)}" stroke-dashoffset="${(2*Math.PI*96).toFixed(1)}"
                 stroke-linecap="round" transform="rotate(-90 100 100)"
                 style="transition:stroke-dashoffset .12s linear"/>
             </svg>
             <div style="position:absolute;bottom:6px;right:6px;display:flex;align-items:center;gap:2px;pointer-events:none">
               <span id="ctime_${cid}" style="font-size:10px;color:rgba(255,255,255,.9);text-shadow:0 1px 3px rgba(0,0,0,.8)">${msgFormatTime(msg.ts)}</span>
               <span style="font-size:10px;color:rgba(255,255,255,.85)">${status}</span>
             </div>
           </div>`;
          })()
      // ┄┄ ВИДЕО   превью + круглая play + автоплей без звука при появлении ┄┄┄┄
      : isVideo
        ? `<div data-no-menu data-video-url="${safeUrl}" style="position:relative;border-radius:14px;overflow:hidden;max-width:260px;min-width:140px;cursor:pointer;background:#111"
               onclick="mcVideoOpen('${safeUrl}','${safeName}')">
             ${msg.thumbData
               ? `<img src="${escHtml(msg.thumbData)}" style="display:block;width:100%;max-width:260px;min-height:80px;border-radius:14px;object-fit:cover" loading="lazy">`
               : `<div style="width:260px;height:146px;border-radius:14px;background:#000"></div>`
             }
             <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
               <div style="width:54px;height:54px;border-radius:50%;background:rgba(0,0,0,.52);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center">
                 <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
               </div>
             </div>
             ${msg.duration ? `<div style="position:absolute;bottom:7px;left:8px;background:rgba(0,0,0,.62);border-radius:5px;padding:2px 6px;font-size:11px;color:#fff;font-weight:600;font-family:'JetBrains Mono',monospace;pointer-events:none">${_fmtDur(msg.duration)}</div>` : ''}
             <div style="position:absolute;bottom:0;left:0;right:0;height:32px;background:linear-gradient(transparent,rgba(0,0,0,.42));border-radius:0 0 14px 14px;pointer-events:none"></div>
             <div style="position:absolute;bottom:5px;right:7px;display:flex;align-items:center;gap:3px;pointer-events:none">
               <span style="font-size:10px;color:rgba(255,255,255,.9);text-shadow:0 1px 2px rgba(0,0,0,.5)">${msgFormatTime(msg.ts)}</span>
               <span style="font-size:11px;color:rgba(255,255,255,.9)">${status}</span>
             </div>
           </div>`

      // ┄┄ АУДИО ФАЙЛ   иконка + название + прогресс-бар ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
      : isAudio
        ? `<div data-no-menu style="display:flex;align-items:center;gap:11px;padding:2px 0;min-width:220px;max-width:270px">
             <button id="vbtn_aud_${idx}" onclick="mcVoicePlay('${safeUrl}','aud_${idx}')"
               style="width:46px;height:46px;min-width:46px;border-radius:50%;background:${tgPlayBg};border:none;color:${tgPlayClr};cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent"
               ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity=''">
               <svg id="vico_aud_${idx}" width="18" height="18" viewBox="0 0 18 18" fill="${tgPlayClr}"><polygon points="5,2 16,9 5,16"/></svg>
             </button>
             <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
               <div style="font-size:13px;font-weight:600;color:${tgText};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safeName||'Аудио'}</div>
               <div style="position:relative;height:3px;background:${isMe?'rgba(255,255,255,.22)':'rgba(255,255,255,.16)'};border-radius:3px;cursor:pointer" onclick="mcVoiceSeek(event,'${safeUrl}','aud_${idx}')">
                 <div id="vprog_aud_${idx}" style="height:100%;width:0%;background:${isMe?'rgba(255,255,255,.9)':'var(--accent)'};border-radius:3px;transition:width .1s linear;pointer-events:none"></div>
               </div>
               <div style="display:flex;align-items:center;justify-content:space-between">
                 <span style="font-size:11px;color:${tgMuted}">${_fmtSize(msg.fileSize)||'аудио'}</span>
                 <span id="vtime_aud_${idx}" style="font-size:11px;font-family:'JetBrains Mono',monospace;color:${tgMuted};font-weight:600"> :—</span>
               </div>
             </div>
           </div>`

      // ┄┄ ФАЙЛ   иконка типа + имя + размер + SVG кнопка скачать ┄┄┄┄┄┄┄┄┄┄┄
      : isFile
        ? `<div style="display:flex;align-items:center;gap:12px;padding:4px 0;min-width:200px;max-width:270px">
             <div style="width:46px;height:46px;min-width:46px;border-radius:13px;background:${isMe?'rgba(255,255,255,.18)':'rgba(255,255,255,.08)'};display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">${_gdFileEmoji(msg.fileName)}</div>
             <div style="flex:1;min-width:0">
               <div style="font-size:13px;font-weight:600;color:${tgText};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safeName||'Файл'}</div>
               <div style="font-size:11px;color:${tgMuted};margin-top:2px">${_fmtSize(msg.fileSize)||'файл'}</div>
             </div>
             <a href="${safeUrl}" target="_blank" download="${safeName}"
               style="width:38px;height:38px;min-width:38px;border-radius:50%;background:${tgPlayBg};display:flex;align-items:center;justify-content:center;text-decoration:none;flex-shrink:0;-webkit-tap-highlight-color:transparent"
               ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity=''">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="${tgPlayClr}"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-14 9v2h14v-2H5z"/></svg>
             </a>
           </div>`

     : (replyQuote + escHtml(msg.text));

    // Reactions display
    const reactionsHtml = msg.reactions && Object.keys(msg.reactions).length
      ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">
          ${Object.entries(msg.reactions).map(([em,users])=>
            `<span onclick="mcToggleReaction(${idx},'${em}')" style="background:rgba(255,255,255,.12);border-radius:10px;padding:2px 7px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:3px">${typeof _emojiImg==='function'?_emojiImg(em,16):em} ${users.length}</span>`
          ).join('')}
         </div>` : '';

    // В группах показываем имя отправителя над первым пузырём серии
    const senderNameHtml = (_isGroupChat && showName && !isMe)
      ? `<div style="font-size:11px;font-weight:700;color:${_peerColor};margin-bottom:2px;padding-left:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">${escHtml(peer?.name||peer?.displayName||msg.from)}</div>`
      : '';

    return `${dateSep}
    <div data-msg-bubble data-msg-me="${isMe?'1':'0'}" data-msg-idx="${idx}"
      style="display:flex;gap:6px;justify-content:${isMe?'flex-end':'flex-start'};align-items:flex-end;margin-bottom:${showTail?'4px':'1px'};position:relative;touch-action:pan-y;user-select:none;-webkit-user-select:none"
      ontouchstart="mcBubbleTouchStart(event,this,${idx})"
      ontouchmove="mcBubbleTouchMove(event,this,${idx})"
      ontouchend="mcBubbleTouchEnd(event,this,${idx})"
      onmousedown="mcBubbleMouseDown(event,this,${idx})"
      ondblclick="mcBubbleDblClick(event,${idx})"
      onclick="mcBubbleClick(event,${idx})">
      ${isMe ? '' : avatarEl}
      <!-- Swipe reply-arrow hint (свайп вправо→влев, стрелка всегда слева от пузыря) -->
      <div class="mc-reply-hint" style="position:absolute;left:-24px;top:50%;transform:translateY(-50%);opacity:0;transition:opacity .12s;font-size:18px;pointer-events:none;z-index:1">↩</div>
      <div style="display:flex;flex-direction:column;max-width:78%">
        ${senderNameHtml}
      <div class="mc-bubble-inner" style="padding:${bubblePad};border-radius:${bubbleRadius};background:${bubbleBg};color:${isMe?'var(--btn-text,#fff)':'var(--text)'};font-size:14px;line-height:1.5;word-break:break-word;position:relative;transition:transform .18s cubic-bezier(.4,0,.2,1)">
        ${msgContent}
        ${(isSticker || isImage) ? '' : `<div style="font-size:10px;opacity:.65;text-align:right;margin-top:2px;display:flex;align-items:center;justify-content:flex-end;gap:2px">${msgFormatTime(msg.ts)}${status}</div>`}
        ${reactionsHtml}
      </div>
      </div>
    </div>`;
  }).join('');

  body.innerHTML = html;
  requestAnimationFrame(() => {
    body.scrollTop = body.scrollHeight;
    const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 60;
    if (atBottom) messengerMarkRead();
    // Анимируем только самый последний пузырь (только что отправленное сообщение)
    if (animateLast) {
      const bubbles = body.querySelectorAll('[data-msg-bubble]');
      const last = bubbles[bubbles.length - 1];
      if (last) {
        const isMe = last.dataset.msgMe === '1';
        last.classList.add(isMe ? 'msg-anim-out' : 'msg-anim-in');
      }
    }
  });
  // Запускаем автоплей кружков и видео которые в поле зрения
  requestAnimationFrame(_mcAttachAutoplayObserver);
}

// ── Автоплей кружков и видео при появлении в viewport ──────────────────────
let _mcAutoplayObserver = null;

function _mcAttachAutoplayObserver() {
  const body = document.getElementById('mc-messages');
  if (!body) return;

  // Отключаем старый наблюдатель
  if (_mcAutoplayObserver) { _mcAutoplayObserver.disconnect(); _mcAutoplayObserver = null; }

  _mcAutoplayObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const el = entry.target;

      // ── Кружки ──────────────────────────────────────────────────────
      if (el.dataset.circleUrl) {
        const cid = el.id.replace('cw_', '');
        const url = el.dataset.circleUrl;
        if (entry.isIntersecting) {
          // Виден — запускаем беззвучно если не играет
          const state = _circleState[cid];
          if (!state) {
            mcCircleToggle(cid, url, true); // muted=true
          } else if (!state.playing) {
            state.video.play().then(() => { state.playing = true; }).catch(() => {});
          }
        } else {
          // Ушёл из поля зрения — паузируем беззвучный
          const state = _circleState[cid];
          if (state && state.muted && state.playing) {
            state.video.pause();
            state.playing = false;
          }
        }
      }

      // ── Видео ────────────────────────────────────────────────────────
      if (el.dataset.videoUrl) {
        const videoId = el.dataset.videoId;
        let vid = el._autoVid;
        if (entry.isIntersecting) {
          if (!vid) {
            vid = document.createElement('video');
            vid.src = el.dataset.videoUrl;
            vid.muted = true;
            vid.playsInline = true;
            vid.loop = true;
            vid.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:14px;z-index:0';
            el.appendChild(vid);
            el._autoVid = vid;
          }
          vid.play().catch(() => {});
        } else {
          if (vid) { vid.pause(); }
        }
      }
    });
  }, {
    root: body,
    rootMargin: '60px',
    threshold: 0.4
  });

  // Наблюдаем за всеми кружками
  body.querySelectorAll('[data-circle-url]').forEach(el => _mcAutoplayObserver.observe(el));
  // Наблюдаем за всеми видео
  body.querySelectorAll('[data-video-url]').forEach(el => _mcAutoplayObserver.observe(el));
}
function messengerSend() {
  const inp = document.getElementById('mc-input');
  if (!inp || !_msgCurrentChat) return;
  const text = inp.value.trim();
  if (!text) return;
  // Cooldown для публичной группы
  if (_msgCurrentChat === PUBLIC_GROUP_ID) {
    const p0 = profileLoad();
    if (p0) {
      const { ok, remainMs } = _publicGroupCooldown(p0.username);
      if (!ok) {
        toast('⏳ Следующее сообщение через ' + _fmtRemain(remainMs));
        const wrap = inp.closest('div[style]') || inp.parentElement;
        if (wrap) {
          wrap.style.transition = 'box-shadow .15s';
          wrap.style.boxShadow  = '0 0 0 2px var(--danger,#e05555)';
          setTimeout(() => { wrap.style.boxShadow = ''; }, 1300);
        }
        return;
      }
    }
  }
  inp.value = '';
  inp.style.height = '';
  setTimeout(() => inp.focus(), 10);
  const p = profileLoad();
  if (!p) return;

  const ts = Date.now();
  const replyTo = _mcReplyTo ? { from: _mcReplyTo.from, text: _mcReplyTo.text } : null;
  const msg = { from: p.username, to: _msgCurrentChat, text, ts, delivered: false, read: false, replyTo };
  mcCancelReply();
  const msgs = msgLoad();
  if (!msgs[_msgCurrentChat]) msgs[_msgCurrentChat] = [];
  msgs[_msgCurrentChat].push(msg);
  msgSave(msgs);
  const chats = chatsLoad();
  if (!chats.includes(_msgCurrentChat)) { chats.unshift(_msgCurrentChat); chatsSave(chats); }
  messengerRenderMessages(true); // true = animate last msg

  // Звук отправки
  SFX.play('msgSend');
  // Telegram-style bounce на кнопке отправки
  const _sendBtn = document.getElementById('mc-action-btn');
  if (_sendBtn) {
    _sendBtn.classList.remove('mc-send-bounce');
    void _sendBtn.offsetWidth; // reflow
    _sendBtn.classList.add('mc-send-bounce');
    setTimeout(() => _sendBtn.classList.remove('mc-send-bounce'), 300);
  }

  // Лимит 200 сообщений   удаляем старые и с сервера
  mcEnforceMessageLimit(_msgCurrentChat);

  // ┄┄ Групповой чат: используем groupSendMessage (broadcast) ┄┄┄┄┄┄┄┄
  const _isGroupSend = _msgCurrentChat === PUBLIC_GROUP_ID || _msgCurrentChat.startsWith('grp_');
  if (_isGroupSend) {
    groupSendMessage(_msgCurrentChat, text, null, ts).then(() => {
      msg.delivered = true; msg.pending = false;
      msgSave(msgs); messengerRenderMessages(); _outboxUpdateStatusBar();
    }).catch(() => {
      msg.pending = true; msgSave(msgs);
      messengerRenderMessages(); _outboxUpdateStatusBar();
    });
    if (_msgCurrentChat === PUBLIC_GROUP_ID) _publicGroupCooldownSet(p.username);
    return;
  }

  // ┄┄ Личный чат ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  sbPollChat(p.username, _msgCurrentChat);

  const chatKey = sbChatKey(p.username, _msgCurrentChat);

  // Шифруем текст перед отправкой ТОЛЬКО для секретных чатов
  const _sendEncrypted = async () => {
    let encText = text; // по умолчанию — открытый текст
    if (isChatEncrypted(_msgCurrentChat)) {
      // Секретный чат — форсируем E2E шифрование
      if (!_e2eEnabled) await e2eInit();
      encText = await e2eEncrypt(text, _msgCurrentChat);
    }
    const outboxItem = {
      id:        'txt_' + ts,
      type:      'message',
      localChat: _msgCurrentChat,
      ts,
      data: { chat_key: chatKey, from_user: p.username, to_user: _msgCurrentChat,
              text: encText, ts,
              extra: replyTo ? JSON.stringify({ replyTo }) : null }
    };
    sbInsert('messages', outboxItem.data).then(res => {
      if (res) {
        msg.delivered = true; msg.pending = false;
        msgSave(msgs); messengerRenderMessages(); _outboxUpdateStatusBar();
      } else {
        msg.pending = true; msgSave(msgs);
        outboxPush(outboxItem); messengerRenderMessages(); _outboxUpdateStatusBar();
      }
    }).catch(() => {
      msg.pending = true; msgSave(msgs);
      outboxPush(outboxItem); messengerRenderMessages(); _outboxUpdateStatusBar();
    });
  };
  _sendEncrypted();
}


// ┄┄ Reply ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
let _mcReplyTo = null;

function mcSetReply(idx) {
  const msgs = msgLoad();
  const chatMsgs = msgs[_msgCurrentChat] || [];
  const msg = chatMsgs[idx];
  if (!msg) return;
  _mcReplyTo = msg;
  const bar  = document.getElementById('mc-reply-bar');
  const name = document.getElementById('mc-reply-name');
  const text = document.getElementById('mc-reply-text');
  if (bar)  bar.style.display = '';
  if (name) name.textContent  = msg.from;
  if (text) text.textContent  = msg.text?.slice(0, 80) || '';
  document.getElementById('mc-input')?.focus();
}

function mcCancelReply() {
  _mcReplyTo = null;
  const bar = document.getElementById('mc-reply-bar');
  if (bar) bar.style.display = 'none';
}

// ┄┄ Reactions ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// ┄┄ Реакции ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// Бесплатные (первые 7) + VIP-эксклюзивные (остальные, как в Telegram Premium)
const MC_REACTIONS_FREE = ['❤️','😂','👍','👎','🔥','😮','😢'];
const MC_REACTIONS_VIP  = [
  '🤩','🎉','💯','😈','🤯','🤮','😴','🥰','😤','🫡',
  '👀','💀','🫠','🤡','🦄','💎','⚡','🌊','🍀','🎭',
  '🔮','🌈','☄️','🏆','🫧','🧨','🌸','🐉','🎪','✅'
];
const MC_REACTIONS_ALL  = [...MC_REACTIONS_FREE, ...MC_REACTIONS_VIP];
const MC_FREE_REACTION_LIMIT = 2; // без VIP   макс 2 реакции на одно сообщение

function mcToggleReaction(idx, emoji) {
  console.log('[Reaction] toggle:', emoji, 'on msg idx:', idx);
  const msgs = msgLoad();
  const p = profileLoad();
  const isVip = vipCheck();
  const chatMsgs = msgs[_msgCurrentChat] || [];
  const msg = chatMsgs[idx];
  if (!msg) return;

  // VIP-check: платные эмодзи
  if (MC_REACTIONS_VIP.includes(emoji) && !isVip) {
    toast('🔒 Эта реакция только для VIP');
    return;
  }

  if (!msg.reactions) msg.reactions = {};

  // Проверка лимита реакций (без VIP   не более 2 разных на сообщение)
  const myReactionsOnMsg = Object.entries(msg.reactions)
    .filter(([, users]) => users.includes(p.username))
    .map(([em]) => em);
  const alreadyReacted = myReactionsOnMsg.includes(emoji);

  if (!alreadyReacted && !isVip && myReactionsOnMsg.length >= MC_FREE_REACTION_LIMIT) {
    toast('🔒 Более ' + MC_FREE_REACTION_LIMIT + ' реакций   только VIP');
    return;
  }

  if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
  const users = msg.reactions[emoji];
  const me = users.indexOf(p.username);
  if (me === -1) users.push(p.username);
  else           users.splice(me, 1);
  if (users.length === 0) delete msg.reactions[emoji];
  msgSave(msgs);
  messengerRenderMessages();

  // Синхронизируем реакцию через служебное сообщение в Supabase
  // Получатель увидит обновление при следующем polling
  if (sbReady() && p && _msgCurrentChat && msg.ts) {
    const reactData = JSON.stringify({
      type: 'reaction',
      msgTs: msg.ts,
      emoji,
      user: p.username,
      reactions: msg.reactions
    });
    sbInsert('messages', {
      chat_key: sbChatKey(p.username, _msgCurrentChat),
      from_user: p.username,
      to_user: _msgCurrentChat,
      text: '',
      ts: Date.now(),
      extra: reactData
    }).catch(() => {});
  }
}

// ┄┄ Bubble interaction ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// Свайп (touch + mouse) ↩ меню
// Одиночный клик        ↩ меню  (если не свайп)
// Двойной клик/тап      ↩ ответить
// Долгое нажатие        ↩ меню

const MC_SWIPE_THRESHOLD = 52;  // px для открытия меню
const MC_SWIPE_MAX       = 75;  // px максимальный ход пузыря
const MC_SELECT_MAX      = 50;  // максимум выделяемых сообщений

let _mcLongPressTimer = null;
let _mcDragStartX     = 0;
let _mcDragStartY     = 0;
let _mcDragging       = false;
let _mcDragTriggered  = false; // свайп уже открыл меню   блокируем click

// ┄┄ Режим выделения сообщений (Telegram-style) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
let _mcMultiSelect    = false;           // активен ли режим выделения
const _mcSelectedIdxs = new Set();       // индексы выделенных сообщений

// ┄┄ Touch (мобайл + Android WebView) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function mcBubbleTouchStart(e, row, idx) {
  // Не открываем меню если касание на интерактивном элементе плеера
  if (e.target.closest('[data-no-menu]')) return;
  const t = e.touches[0];
  _mcDragStartX = t.clientX;
  _mcDragStartY = t.clientY;
  _mcDragging = false;
  _mcDragTriggered = false;

  // В режиме выделения   toggle будет в touchEnd (там проверим что не был свайп)
  if (_mcMultiSelect) return;

  _mcLongPressTimer = setTimeout(() => {
    _mcLongPressTimer = null;
    _mcDragTriggered = true;
    try { window.Android?.vibrate?.(35); } catch(_){}
    // Входим в режим выделения при long-press (Telegram-style)
    _mcEnterSelectMode(row, idx);
  }, 430);
}

function mcBubbleTouchMove(e, row, idx) {
  if (_mcMultiSelect) { clearTimeout(_mcLongPressTimer); return; }
  const t  = e.touches[0];
  const dx = t.clientX - _mcDragStartX;
  const dy = Math.abs(t.clientY - _mcDragStartY);
  if (dy > 14) { clearTimeout(_mcLongPressTimer); return; } // вертикальный скролл
  if (Math.abs(dx) < 5 && !_mcDragging) return;

  // Свайп справа налево (dx < 0) для всех сообщений
  const validDir = dx < 0;
  if (!validDir && !_mcDragging) return;

  clearTimeout(_mcLongPressTimer);
  _mcDragging = true;
  e.preventDefault(); // подавляем скролл

  const travel = Math.min(Math.abs(dx), MC_SWIPE_MAX);
  _mcApplySwipeVisual(row, travel);

  if (!_mcDragTriggered && travel >= MC_SWIPE_THRESHOLD) {
    _mcDragTriggered = true;
    try { window.Android?.vibrate?.(22); } catch(_){}
    SFX.play && SFX.play('btnClick');
    mcSetReply(idx); // свайп = ответить (не открывать меню)
  }
}

function mcBubbleTouchEnd(e, row, idx) {
  clearTimeout(_mcLongPressTimer);
  const wasDragging = _mcDragging;
  _mcDragging = false;
  _mcReturnBubble(row);
  if (e.target.closest('[data-no-menu]') || e.target.closest('button,a,svg,video')) {
    _mcDragTriggered = true;
    return;
  }
  // В режиме выделения: toggle только если не было свайпа
  if (_mcMultiSelect && !wasDragging) {
    const t = e.changedTouches?.[0];
    const dx = t ? Math.abs(t.clientX - _mcDragStartX) : 0;
    const dy = t ? Math.abs(t.clientY - _mcDragStartY) : 0;
    if (dx < 10 && dy < 10) {
      _mcDragTriggered = true;
      _mcToggleSelectBubble(row, idx);
    }
  }
}

// ┄┄ Mouse (веб-браузер на ПК) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function mcBubbleMouseDown(e, row, idx) {
  if (e.button !== 0) return;
  _mcDragStartX = e.clientX;
  _mcDragStartY = e.clientY;
  _mcDragging = false;
  _mcDragTriggered = false;

  const onMove = (ev) => {
    const dx = ev.clientX - _mcDragStartX;
    const dy = Math.abs(ev.clientY - _mcDragStartY);
    if (dy > 14) return;
    if (Math.abs(dx) < 5 && !_mcDragging) return;
    // Свайп справа налево для всех
    const validDir = dx < 0;
    if (!validDir && !_mcDragging) return;
    _mcDragging = true;
    const travel = Math.min(Math.abs(dx), MC_SWIPE_MAX);
    _mcApplySwipeVisual(row, travel);
    if (!_mcDragTriggered && travel >= MC_SWIPE_THRESHOLD) {
      _mcDragTriggered = true;
      SFX.play && SFX.play('btnClick');
      mcSetReply(idx);
    }
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    _mcDragging = false;
    _mcReturnBubble(row);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ┄┄ Визуал свайпа (справа налево для всех) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function _mcApplySwipeVisual(row, travel) {
  const bubble = row.querySelector('.mc-bubble-inner');
  const hint   = row.querySelector('.mc-reply-hint');
  if (bubble) {
    bubble.style.transition = 'none';
    bubble.style.transform  = `translateX(${-travel}px)`;
  }
  if (hint) hint.style.opacity = String(Math.min(travel / MC_SWIPE_THRESHOLD * 0.9, 0.85));
}

function _mcReturnBubble(row) {
  const bubble = row.querySelector('.mc-bubble-inner');
  const hint   = row.querySelector('.mc-reply-hint');
  if (bubble) { bubble.style.transition = 'transform .2s cubic-bezier(.4,0,.2,1)'; bubble.style.transform = ''; }
  if (hint)   hint.style.opacity = '0';
}

// ┄┄ Click / dblclick ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function mcBubbleClick(e, idx) {
  if (_mcDragTriggered) { _mcDragTriggered = false; return; }
  if (_mcDragging) return;
  if (e.target.closest('[data-no-menu]')) return;
  if (e.target.closest('button,a,video,canvas,svg')) return;
  if (_mcMultiSelect) return; // уже обработано в touchEnd
  mcShowMsgMenu(idx);
}

function mcBubbleDblClick(e, idx) {
  e.preventDefault(); e.stopPropagation();
  if (_mcMultiSelect) return;
  _mcDragTriggered = true; // блокируем click после dblclick
  mcCloseMenu();
  const bubble = e.currentTarget.querySelector('.mc-bubble-inner');
  if (bubble) {
    bubble.style.transition = 'transform .1s';
    bubble.style.transform  = 'scale(.94)';
    setTimeout(() => { bubble.style.transform = ''; }, 130);
  }
  try { window.Android?.vibrate?.(22); } catch(_){}
  SFX.play && SFX.play('btnClick');
  mcSetReply(idx);
}

// ══════════════════════════════════════════════════════════════════════
// ✅ ВЫДЕЛЕНИЕ СООБЩЕНИЙ   Telegram-style (1 50 штук)
// ══════════════════════════════════════════════════════════════════════

function _mcEnterSelectMode(row, idx) {
  if (_mcMultiSelect) return;
  _mcMultiSelect = true;
  _mcSelectedIdxs.clear();
  if (idx !== null && idx !== undefined) _mcSelectedIdxs.add(idx);
  mcCloseMenu();
  // Добавляем отступ слева под кружки
  document.getElementById('mc-messages')?.classList.add('select-mode');
  _mcRenderSelectBar();
  _mcRefreshBubbleStates();
  try { window.Android?.vibrate?.(28); } catch(_) {}
  SFX.play && SFX.play('btnClick');
}

function _mcExitSelectMode() {
  _mcMultiSelect = false;
  _mcSelectedIdxs.clear();
  document.getElementById('mc-select-bar')?.remove();
  // Убираем отступ
  document.getElementById('mc-messages')?.classList.remove('select-mode');
  // Восстанавливаем обычную шапку
  const normalHdr = document.querySelector('#s-messenger-chat .hdr');
  if (normalHdr) normalHdr.style.display = '';
  // Восстанавливаем input-bar и reply-bar
  const inputBar = document.getElementById('mc-input-bar');
  if (inputBar) inputBar.style.display = '';
  const replyBar = document.getElementById('mc-reply-bar');
  // reply-bar восстанавливаем только если есть активный reply
  if (replyBar && window._mcReplyTo) replyBar.style.display = '';
  _mcRefreshBubbleStates();
}

function _mcToggleSelectBubble(row, idx) {
  if (_mcSelectedIdxs.has(idx)) {
    _mcSelectedIdxs.delete(idx);
    if (_mcSelectedIdxs.size === 0) { _mcExitSelectMode(); return; }
  } else {
    if (_mcSelectedIdxs.size >= MC_SELECT_MAX) {
      toast('Максимум ' + MC_SELECT_MAX + ' сообщений'); return;
    }
    _mcSelectedIdxs.add(idx);
  }
  SFX.play && SFX.play('btnClick');
  _mcUpdateSelectBar();
  _mcRefreshBubbleStates();
}

// Обновляет визуальное состояние всех пузырей (отмечены / не отмечены)
function _mcRefreshBubbleStates() {
  const body = document.getElementById('mc-messages');
  if (!body) return;
  body.querySelectorAll('[data-msg-bubble]').forEach(row => {
    const idx = parseInt(row.getAttribute('data-msg-idx'), 10);
    const sel = _mcMultiSelect && _mcSelectedIdxs.has(idx);
    const isMe = row.dataset.msgMe === '1';

    // ┄┄ 1. Кружок слева от пузыря ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
    let circle = row.querySelector('.mc-sel-circle');
    if (_mcMultiSelect) {
      if (!circle) {
        circle = document.createElement('div');
        circle.className = 'mc-sel-circle';
        circle.style.cssText = [
          'flex-shrink:0;width:22px;height:22px;border-radius:50%;',
          'border:2px solid rgba(255,255,255,.38);background:transparent;',
          'display:flex;align-items:center;justify-content:center;',
          'align-self:center;',
          'transition:background .13s,border-color .13s,transform .14s cubic-bezier(.34,1.3,.64,1);',
          'pointer-events:none;'
        ].join('');
        // Вставляем В НАЧАЛО строки (перед аватаром / пузырём)
        row.insertBefore(circle, row.firstChild);
      }
      if (sel) {
        circle.style.background  = 'var(--accent)';
        circle.style.borderColor = 'var(--accent)';
        circle.style.transform   = 'scale(1.08)';
        circle.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>';
        // pop-анимация
        circle.style.animation = 'mc-sel-pop .18s cubic-bezier(.34,1.3,.64,1)';
        setTimeout(() => { circle.style.animation = ''; }, 200);
      } else {
        circle.style.background  = 'transparent';
        circle.style.borderColor = 'rgba(255,255,255,.38)';
        circle.style.transform   = 'scale(1)';
        circle.innerHTML = '';
      }
    } else {
      circle?.remove();
    }

    // ┄┄ 2. Подсветка всей строки при выделении ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
    row.style.background = (_mcMultiSelect && sel)
      ? 'rgba(var(--accent-rgb,32,138,240), .15)'
      : '';
    row.style.transition = 'background .13s';

    // ┄┄ 3. Сдвиг пузыря при входе/выходе из режима выделения ┄┄┄
    const inner = row.querySelector('.mc-bubble-inner');
    if (inner) {
      inner.style.transition = 'transform .18s cubic-bezier(.34,1.1,.64,1), outline .12s';
      inner.style.outline = '';
    }
  });
}

// Рисует Telegram-style шапку выделения (меняет обычную шапку)
function _mcRenderSelectBar() {
  // Скрываем обычную шапку
  const normalHdr = document.querySelector('#s-messenger-chat .hdr');
  if (normalHdr) { normalHdr.style.display = 'none'; normalHdr._wasVisible = true; }
  // Скрываем reply-bar и input-bar
  const replyBar = document.getElementById('mc-reply-bar');
  const inputBar = document.getElementById('mc-input-bar');
  if (replyBar) replyBar.style.display = 'none';
  if (inputBar) inputBar.style.display = 'none';

  let bar = document.getElementById('mc-select-bar');
  if (bar) bar.remove();
  bar = document.createElement('div');
  bar.id = 'mc-select-bar';
  bar.style.cssText = [
    'position:sticky;top:0;left:0;right:0;z-index:9050;',
    'background:var(--surface);',
    'display:flex;align-items:center;',
    'padding:0 4px;min-height:56px;flex-shrink:0;',
    'border-bottom:1px solid rgba(255,255,255,.06);',
    'animation:mc-sel-hdr-in .18s cubic-bezier(.34,1.1,.64,1);'
  ].join('');

  // Telegram-style: ✅ | N | copy | forward | delete
  bar.innerHTML = `
    <button id="mc-sel-cancel"
      style="width:44px;height:44px;border-radius:50%;background:none;border:none;color:var(--text);
             cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;
             -webkit-tap-highlight-color:transparent">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
    <div id="mc-sel-count"
      style="flex:1;font-size:17px;font-weight:700;color:var(--text);padding-left:2px">1</div>
    <button id="mc-sel-copy"
      title="Копировать"
      style="width:44px;height:44px;border-radius:50%;background:none;border:none;color:var(--text);
             cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;
             -webkit-tap-highlight-color:transparent">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    </button>
    <button id="mc-sel-forward"
      title="Переслать"
      style="width:44px;height:44px;border-radius:50%;background:none;border:none;color:var(--text);
             cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;
             -webkit-tap-highlight-color:transparent">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 10 20 15 15 20"/>
        <path d="M4 4v7a4 4 0 0 0 4 4h12"/>
      </svg>
    </button>
    <button id="mc-sel-delete"
      title="Удалить"
      style="width:44px;height:44px;border-radius:50%;background:none;border:none;color:var(--danger,#e05555);
             cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;
             -webkit-tap-highlight-color:transparent">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14H6L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4h6v2"/>
      </svg>
    </button>
  `;

  // Вставляем В НАЧАЛО экрана чата (сверху)
  const chatScreen = document.getElementById('s-messenger-chat');
  chatScreen.insertBefore(bar, chatScreen.firstChild);

  bar.querySelector('#mc-sel-cancel').addEventListener('click', _mcExitSelectMode);
  bar.querySelector('#mc-sel-copy').addEventListener('click', _mcSelectionCopy);
  bar.querySelector('#mc-sel-forward').addEventListener('click', _mcSelectionForward);
  bar.querySelector('#mc-sel-delete').addEventListener('click', _mcSelectionDelete);
}

function _mcUpdateSelectBar() {
  const count = document.getElementById('mc-sel-count');
  if (count) count.textContent = String(_mcSelectedIdxs.size);
}

// Пересылка выделенных сообщений
function _mcSelectionCopy() {
  if (!_mcSelectedIdxs.size) return;
  const msgs   = msgLoad()[_msgCurrentChat] || [];
  const sorted = [..._mcSelectedIdxs].sort((a, b) => a - b);
  const text   = sorted.map(i => msgs[i])
    .filter(Boolean)
    .map(m => m.text || m.sticker || (m.image ? '[Фото]' : '[Медиа]'))
    .join('\n');
  navigator.clipboard?.writeText(text).catch(() => {});
  toast('📋 Скопировано');
  _mcExitSelectMode();
}

function _mcSelectionForward() {
  if (!_mcSelectedIdxs.size) return;
  const msgs   = msgLoad()[_msgCurrentChat] || [];
  const sorted = [..._mcSelectedIdxs].sort((a,b) => a-b);
  const toFwd  = sorted.map(i => msgs[i]).filter(Boolean);
  if (!toFwd.length) return;

  const chats = chatsLoad().filter(u => u !== _msgCurrentChat);
  if (!chats.length) { toast('Нет других чатов'); return; }

  const sheet = document.createElement('div');
  sheet.id = 'mc-forward-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9200;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.5);animation:mcFadeIn .12s ease';
  const chatItems = chats.map(u => {
    const peer = _profileOnlinePeers.find(x=>x.username===u) || _allKnownUsers.find(x=>x.username===u);
    return `<button onclick="mcDoForwardMulti('${escHtml(u)}');document.getElementById('mc-forward-sheet').remove()"
      style="width:100%;padding:12px 20px;background:none;border:none;color:var(--text);font-family:inherit;font-size:15px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,.04)">
      <div style="width:38px;height:38px;border-radius:50%;background:${peer?.color||'var(--surface3)'};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${_emojiImg(peer?.avatar||'😊',22)}</div>
      <span style="font-weight:600">${escHtml(peer?.name||u)}</span>
    </button>`;
  }).join('');
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:8px 0 calc(14px + var(--safe-bot));max-height:70vh;overflow-y:auto" onclick="event.stopPropagation()">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:8px auto 4px"></div>
      <div style="font-size:14px;font-weight:700;color:var(--muted);padding:8px 20px 10px">Переслать ${toFwd.length} ${toFwd.length===1?'сообщение':toFwd.length<5?'сообщения':'сообщений'}...</div>
      ${chatItems}
    </div>`;
  sheet.addEventListener('click', () => sheet.remove());
  // Сохраняем сообщения для пересылки в глобальной переменной
  window._mcPendingFwdMsgs = toFwd;
  document.body.appendChild(sheet);
  _mcExitSelectMode();
}

function mcDoForwardMulti(toUsername) {
  const msgs = window._mcPendingFwdMsgs;
  if (!msgs || !msgs.length) return;
  const p = profileLoad();
  if (!p) return;
  const allMsgs = msgLoad();
  if (!allMsgs[toUsername]) allMsgs[toUsername] = [];
  const chats = chatsLoad();
  msgs.forEach(orig => {
    const ts  = Date.now() + Math.random(); // уникальный ts
    const fwd = {
      from: p.username, to: toUsername,
      text: orig.text ? '↩ ' + orig.text : '',
      image: orig.image || null,
      fileLink: orig.fileLink || null, fileName: orig.fileName || null,
      fileType: orig.fileType || null, fileSize: orig.fileSize || null,
      duration: orig.duration || null,
      ts, delivered: false, read: false
    };
    allMsgs[toUsername].push(fwd);
    sbInsert('messages', {
      chat_key: sbChatKey(p.username, toUsername),
      from_user: p.username, to_user: toUsername,
      text: fwd.text || '↩ Медиа', ts,
      ...(orig.image ? { extra: JSON.stringify({ image: orig.image }) } : {}),
    });
  });
  msgSave(allMsgs);
  if (!chats.includes(toUsername)) { chats.unshift(toUsername); chatsSave(chats); }
  window._mcPendingFwdMsgs = null;
  toast('↪️ Переслано ' + msgs.length + ' сообщ.');
}

// Удаление выделенных сообщений
function _mcSelectionDelete() {
  if (!_mcSelectedIdxs.size) return;
  const n = _mcSelectedIdxs.size;
  const p = profileLoad();
  const msgs = msgLoad();
  const chat = msgs[_msgCurrentChat] || [];
  // Проверяем есть ли чужие сообщения
  const sorted = [..._mcSelectedIdxs].sort((a,b) => a-b);
  const hasOthers = sorted.some(i => chat[i] && chat[i].from !== p?.username);

  const sheet = document.createElement('div');
  sheet.id = 'mc-delete-confirm';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.55);animation:mcFadeIn .15s ease';
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:20px 16px calc(20px + var(--safe-bot,0px));animation:mcSlideUp .24s cubic-bezier(.34,1.1,.64,1)">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:0 auto 16px"></div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px">Удалить ${n} ${n===1?'сообщение':n<5?'сообщения':'сообщений'}?</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:20px">${hasOthers ? 'Некоторые сообщения будут удалены только у тебя.' : 'Сообщения будут удалены у всех участников.'}</div>
      <button onclick="_mcDoDeleteSelected(${!hasOthers});document.getElementById('mc-delete-confirm')?.remove()"
        style="width:100%;padding:14px;background:var(--danger,#c94f4f);border:none;border-radius:14px;color:#fff;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px">
        🗑 Удалить${!hasOthers ? ' для всех' : ''}
      </button>
      <button onclick="document.getElementById('mc-delete-confirm')?.remove()"
        style="width:100%;padding:14px;background:var(--surface2);border:none;border-radius:14px;color:var(--text);font-family:inherit;font-size:15px;font-weight:600;cursor:pointer">
        Отмена
      </button>
    </div>`;
  sheet.addEventListener('click', e => { if(e.target===sheet) sheet.remove(); });
  document.body.appendChild(sheet);
}

async function _mcDoDeleteSelected(forAll) {
  const idxs   = [..._mcSelectedIdxs].sort((a,b) => b-a); // удаляем с конца
  const msgs   = msgLoad();
  const chat   = msgs[_msgCurrentChat] || [];
  const p      = profileLoad();
  const tsList = [];

  // Анимация всех пузырей
  const body    = document.getElementById('mc-messages');
  const bubbles = body?.querySelectorAll('[data-msg-bubble]');
  idxs.forEach(idx => {
    const b = bubbles?.[idx];
    if (b) {
      b.style.transition = 'transform .18s ease, opacity .16s ease';
      b.style.transform  = 'scale(0.5)';
      b.style.opacity    = '0';
    }
    if (chat[idx]?.ts) tsList.push(chat[idx].ts);
  });

  await new Promise(r => setTimeout(r, 200));
  // Удаляем с конца чтобы индексы не съезжали
  idxs.forEach(idx => { if (chat[idx]) chat.splice(idx, 1); });
  msgs[_msgCurrentChat] = chat;
  msgSave(msgs);
  messengerRenderMessages();
  _mcExitSelectMode();

  // Удаляем с сервера
  if (forAll && p && sbReady() && tsList.length) {
    const chatKey = sbChatKey(p.username, _msgCurrentChat);
    sbDelete('messages', `chat_key=eq.${encodeURIComponent(chatKey)}&ts=in.(${tsList.join(',')})`).catch(()=>{});
  }
  toast('🗑 Удалено ' + tsList.length + ' сообщ.');
}

// Также добавляем пункт «Выбрать» в обычное меню
function mcShowBubbleMenu(el, idx) { mcShowMsgMenu(idx); }
function mcShowReactionPicker(idx) { mcShowMsgMenu(idx); }

// ┄┄ Telegram-style: единое меню (реакции + действия) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// Тап на стрелку ↩ полная сетка эмодзи выезжает снизу вверх
function mcShowMsgMenu(idx) {
  console.log('[Menu] mcShowMsgMenu idx:', idx);
  SFX.play && SFX.play('btnClick');
  const existing = document.getElementById('mc-msg-menu');
  if (existing) { existing.remove(); return; }

  const isVip  = vipCheck();
  const msgs   = msgLoad();
  const p      = profileLoad();
  const msg    = (msgs[_msgCurrentChat] || [])[idx];
  if (!msg) return;
  const isMe   = msg.from === p?.username;

  // ┄┄ CSS animation keyframes (добавляем один раз) ┄┄
  if (!document.getElementById('mc-menu-style')) {
    const st = document.createElement('style');
    st.id = 'mc-menu-style';
    st.textContent = `
      @keyframes mcSlideUp   { from { transform:translateY(100%); opacity:0 } to { transform:translateY(0); opacity:1 } }
      @keyframes mcSlideDown { from { transform:translateY(0) scale(1); opacity:1 } to { transform:translateY(110%) scale(.97); opacity:0 } }
      @keyframes mcFadeIn    { from { opacity:0 } to { opacity:1 } }
      @keyframes mcFadeOut   { from { opacity:1 } to { opacity:0 } }
      @keyframes mcEmojiIn   { from { transform:translateY(40px) scale(.7); opacity:0 } to { transform:translateY(0) scale(1); opacity:1 } }
      .mc-reaction-btn {
        font-size:30px;background:none;border:none;cursor:pointer;
        padding:5px 3px;line-height:1;transition:transform .12s;
        display:flex;align-items:center;justify-content:center;
      }
      .mc-reaction-btn:active { transform:scale(1.4) !important; }
      .mc-action-btn {
        width:100%;padding:14px 20px;background:none;border:none;
        color:var(--text);font-family:inherit;font-size:15px;
        text-align:left;cursor:pointer;display:flex;align-items:center;gap:16px;
        transition:background .1s;
      }
      .mc-action-btn:active { background:rgba(255,255,255,.07); }
      .mc-action-sep { height:1px;background:rgba(255,255,255,.06);margin:0 16px; }
      #mc-emoji-grid {
        display:grid;
        grid-template-columns:repeat(8,1fr);
        gap:2px;
        max-height:0;overflow:hidden;
        transition:max-height .35s cubic-bezier(.4,0,.2,1), opacity .25s ease;
        opacity:0;
      }
      #mc-emoji-grid.open {
        max-height:400px;opacity:1;
      }
      #mc-emoji-grid .mc-reaction-btn {
        font-size:28px;padding:5px 2px;
        width:100%;aspect-ratio:1;
        display:flex;align-items:center;justify-content:center;
      }
    `;
    document.head.appendChild(st);
  }

  const overlay = document.createElement('div');
  overlay.id = 'mc-msg-menu';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.45);animation:mcFadeIn .15s ease';

  // Reaction row   7 бесплатных + кнопка «развернуть»
  const freeButtons = MC_REACTIONS_FREE.map((em, i) =>
    `<button class="mc-reaction-btn"
      style="animation:mcEmojiIn .22s cubic-bezier(.34,1.3,.64,1) ${i*25}ms both"
      onclick="mcToggleReaction(${idx},'${em}');mcCloseMenu()">${typeof _emojiImg==="function"?_emojiImg(em,26):em}</button>`
  ).join('');

  // VIP grid (все 30)
  const vipButtons = [...MC_REACTIONS_FREE, ...MC_REACTIONS_VIP].map((em, i) => {
    const locked = MC_REACTIONS_VIP.includes(em) && !isVip;
    return `<button class="mc-reaction-btn"
      style="opacity:${locked?'.35':'1'}"
      onclick="${locked ? "toast('🔒 VIP')" : `mcToggleReaction(${idx},'${em}');mcCloseMenu()`}">${typeof _emojiImg==="function"?_emojiImg(em,24):em}</button>`;
  }).join('');

  overlay.innerHTML = `
    <div data-menu-inner style="position:absolute;bottom:0;left:0;right:0;
      animation:mcSlideUp .28s cubic-bezier(.34,1.26,.64,1)"
      onclick="event.stopPropagation()">

      <!-- Reaction strip (pill shape, floating) -->
      <div style="margin:0 12px 8px;background:var(--surface);border-radius:50px;
        padding:6px 8px;display:flex;align-items:center;justify-content:space-between;
        box-shadow:0 4px 24px rgba(0,0,0,.55)">
        <div style="display:flex;flex:1;justify-content:space-around">
          ${freeButtons}
        </div>
        <!-- Expand button -->
        <button id="mc-expand-btn"
          style="width:38px;height:38px;border-radius:50%;background:var(--surface2);
            border:none;color:var(--muted);font-size:16px;cursor:pointer;flex-shrink:0;
            display:flex;align-items:center;justify-content:center;
            transition:transform .25s cubic-bezier(.34,1.3,.64,1)"
          onclick="mcExpandReactions(this)">⌄</button>
      </div>

      <!-- Expanded emoji grid (hidden initially) -->
      <div id="mc-emoji-grid" style="margin:0 12px 6px;background:var(--surface);border-radius:16px;
        padding:6px 6px 4px;box-shadow:0 4px 24px rgba(0,0,0,.45);overflow:hidden">
        ${vipButtons}
        ${!isVip ? '<div style="grid-column:1/-1;font-size:10px;color:var(--muted);text-align:center;padding:4px 0 6px">🔒 Тёмные   <b style=\"color:var(--accent)\">VIP</b></div>' : ''}
      </div>

      <!-- Action sheet -->
      <div style="margin:0 12px calc(14px + var(--safe-bot));background:var(--surface);
        border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.45)">
        <button class="mc-action-btn"
          onclick="mcSetReply(${idx});mcCloseMenu()">
          <span style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg></span> Ответить
        </button>
        <div class="mc-action-sep"></div>
        <button class="mc-action-btn"
          onclick="mcPinMsg(${idx});mcCloseMenu()">
          <span style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg></span> Закрепить
        </button>
        <div class="mc-action-sep"></div>
        <button class="mc-action-btn"
          onclick="mcForwardMsg(${idx});mcCloseMenu()">
          <span style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg></span> Переслать
        </button>
        <div class="mc-action-sep"></div>
        <button class="mc-action-btn"
          onclick="mcCopyMsg(${idx});mcCloseMenu()">
          <span style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span> Копировать
        </button>
        ${msg.image ? `<div class="mc-action-sep"></div>
        <button class="mc-action-btn"
          onclick="mcSaveImage(${idx});mcCloseMenu()">
          <span style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> Сохранить фото
        </button>` : ''}
        <div class="mc-action-sep"></div>
        <button class="mc-action-btn"
          onclick="mcCloseMenu();_mcEnterSelectMode(null,${idx})">
          <span style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span> Выбрать
        </button>
        <div class="mc-action-sep"></div>
        <button class="mc-action-btn" style="color:var(--danger,#e05555)"
          onclick="mcConfirmDelete(${idx});mcCloseMenu()">
          <span style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></span> Удалить${isMe ? '' : ' у себя'}
        </button>
      </div>
    </div>`;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) mcCloseMenu();
  });
  document.body.appendChild(overlay);
}

// ┄┄ Закрытие меню с анимацией slide-down ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function mcCloseMenu() {
  const overlay = document.getElementById('mc-msg-menu');
  if (!overlay) return;
  const inner = overlay.querySelector('[data-menu-inner]');
  if (inner) {
    inner.style.animation = 'mcSlideDown .22s cubic-bezier(.4,0,.8,.6) forwards';
    overlay.style.animation = 'mcFadeOut .22s ease forwards';
  }
  setTimeout(() => overlay.remove(), 200);
}

// ┄┄ Fallback: закрываем меню при свайп-навигации (экран теряет .active без showScreen) ┄┄
(function _watchChatScreens() {
  const CHAT_IDS = ['s-messenger-chat', 's-groups-chat'];
  function _closeAllMenus() {
    const menu = document.getElementById('mc-msg-menu');
    if (menu) menu.remove();
    const fwd = document.getElementById('mc-forward-sheet');
    if (fwd) fwd.remove();
  }
  function _attach() {
    CHAT_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el || el._menuWatcher) return;
      el._menuWatcher = true;
      new MutationObserver(mutations => {
        for (const m of mutations) {
          if (m.attributeName === 'class' && !el.classList.contains('active')) {
            _closeAllMenus();
          }
        }
      }).observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _attach);
  else _attach();
})();

// Разворачивает/сворачивает сетку эмодзи с анимацией
function mcExpandReactions(btn) {
  const grid = document.getElementById('mc-emoji-grid');
  if (!grid) return;
  const open = grid.classList.toggle('open');
  // Крутим стрелку
  btn.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
  // Staggered появление кнопок при открытии
  if (open) {
    grid.querySelectorAll('.mc-reaction-btn').forEach((b, i) => {
      b.style.animation = `mcEmojiIn .2s cubic-bezier(.34,1.3,.64,1) ${i*12}ms both`;
    });
  }
}

function mcCopyMsg(idx) {
  const msgs = msgLoad();
  const msg  = (msgs[_msgCurrentChat] || [])[idx];
  if (!msg) return;
  navigator.clipboard?.writeText(msg.text || msg.sticker || '').catch(()=>{});
  toast('📋 Скопировано');
}

// ┄┄ Удаление сообщения: анимация + сервер + синхронизация для всех ┄┄
async function mcDeleteMsg(idx) {
  const msgs = msgLoad();
  if (!msgs[_msgCurrentChat]) return;
  const msg = msgs[_msgCurrentChat][idx];
  if (!msg) return;

  // 1. Анимация исчезновения пузыря
  const body = document.getElementById('mc-messages');
  const bubbles = body?.querySelectorAll('[data-msg-bubble]');
  const bubble  = bubbles?.[idx];
  if (bubble) {
    bubble.style.transition = 'transform .2s cubic-bezier(.4,0,.8,.6), opacity .18s ease';
    bubble.style.transform  = 'scale(0.6)';
    bubble.style.opacity    = '0';
    await new Promise(r => setTimeout(r, 210));
  }

  // 2. Удаляем локально
  msgs[_msgCurrentChat].splice(idx, 1);
  msgSave(msgs);
  messengerRenderMessages();

  // 3. Удаляем с сервера (chat_key одинаковый для обоих)
  const p = profileLoad();
  if (p && sbReady() && msg.ts) {
    const chatKey = sbChatKey(p.username, _msgCurrentChat);
    sbDelete('messages',
      `chat_key=eq.${encodeURIComponent(chatKey)}&ts=eq.${msg.ts}`
    ).catch(() => {});
  }
}

// ┄┄ Подтверждение удаления (Telegram-style) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function mcConfirmDelete(idx) {
  const existing = document.getElementById('mc-delete-confirm');
  if (existing) existing.remove();
  const msgs = msgLoad();
  const msg  = (msgs[_msgCurrentChat] || [])[idx];
  const p    = profileLoad();
  const isMe = msg?.from === p?.username;

  const overlay = document.createElement('div');
  overlay.id = 'mc-delete-confirm';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.55);animation:mcFadeIn .15s ease';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:20px 16px calc(20px + var(--safe-bot,0px));animation:mcSlideUp .24s cubic-bezier(.34,1.1,.64,1)">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:0 auto 16px"></div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px">Удалить сообщение?</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:20px">${isMe
        ? 'Сообщение будет удалено у всех участников.'
        : 'Сообщение будет удалено только у тебя.'}</div>
      <button onclick="mcDeleteMsg(${idx});document.getElementById('mc-delete-confirm')?.remove()"
        style="width:100%;padding:14px;background:var(--danger,#c94f4f);border:none;border-radius:14px;color:#fff;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px">
        🗑 Удалить${isMe ? ' для всех' : ''}
      </button>
      <button onclick="document.getElementById('mc-delete-confirm')?.remove()"
        style="width:100%;padding:14px;background:var(--surface2);border:none;border-radius:14px;color:var(--text);font-family:inherit;font-size:15px;font-weight:600;cursor:pointer">
        Отмена
      </button>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ┄┄ Сохранить изображение из сообщения ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function mcSaveImage(idx) {
  const msgs = msgLoad();
  const msg  = (msgs[_msgCurrentChat] || [])[idx];
  if (!msg?.image) { toast('❌ Изображение не найдено'); return; }
  try {
    if (window.Android?.saveImageToGallery) {
      window.Android.saveImageToGallery(msg.image);
      toast('✅ Фото сохранено в галерею');
      return;
    }
  } catch(_) {}
  // Fallback: скачать через <a download>
  const a = document.createElement('a');
  a.href = msg.image;
  a.download = `photo_${msg.ts}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('✅ Фото сохранено');
}

const MC_MSG_LIMIT = 200;

async function mcEnforceMessageLimit(username) {
  if (!username) return;
  const msgs = msgLoad();
  const chat = msgs[username];
  if (!chat || chat.length <= MC_MSG_LIMIT) return;

  // Определяем сообщения для удаления (самые старые)
  const toDelete = chat.splice(0, chat.length - MC_MSG_LIMIT);
  msgSave(msgs);

  // Удаляем с сервера пакетно по ts
  const p = profileLoad();
  if (!p || !sbReady()) return;
  const chatKey = sbChatKey(p.username, username);
  // Supabase поддерживает IN через ts=in.(ts1,ts2,...)
  const tsList = toDelete.map(m => m.ts).join(',');
  if (tsList) {
    sbDelete('messages',
      `chat_key=eq.${encodeURIComponent(chatKey)}&ts=in.(${tsList})`
    ).catch(() => {});
  }
}

// ┄┄ Forward ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
let _mcForwardText = null;

function mcForwardMsg(idx) {
  const msgs = msgLoad();
  const msg  = (msgs[_msgCurrentChat] || [])[idx];
  if (!msg) return;
  _mcForwardText = msg.text || msg.sticker || '';
  // Show chat picker
  const chats = chatsLoad().filter(u => u !== _msgCurrentChat);
  if (chats.length === 0) { toast('Нет других чатов'); return; }

  const sheet = document.createElement('div');
  sheet.id = 'mc-forward-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9200;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.5);animation:fadeIn .12s ease';
  const p = profileLoad();
  const chatItems = chats.map(u => {
    const peer = _profileOnlinePeers.find(x=>x.username===u) || _allKnownUsers.find(x=>x.username===u);
    return `<button onclick="mcDoForward('${escHtml(u)}');document.getElementById('mc-forward-sheet').remove()"
      style="width:100%;padding:12px 20px;background:none;border:none;color:var(--text);font-family:inherit;font-size:15px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,.04)">
      <div style="width:38px;height:38px;border-radius:50%;background:${peer?.color||'var(--surface3)'};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${_emojiImg(peer?.avatar||'😊',22)}</div>
      <span style="font-weight:600">${escHtml(peer?.name||u)}</span>
    </button>`;
  }).join('');
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:8px 0 calc(14px + var(--safe-bot));max-height:70vh;overflow-y:auto" onclick="event.stopPropagation()">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:8px auto 4px"></div>
      <div style="font-size:14px;font-weight:700;color:var(--muted);padding:8px 20px 10px">Переслать в...</div>
      ${chatItems}
    </div>`;
  sheet.addEventListener('click', () => sheet.remove());
  document.body.appendChild(sheet);
}

function mcDoForward(toUsername) {
  if (!_mcForwardText) return;
  const p = profileLoad();
  if (!p) return;
  const ts = Date.now();
  const msg = { from: p.username, to: toUsername, text: '↩ ' + _mcForwardText, ts, delivered: false, read: false };
  const msgs = msgLoad();
  if (!msgs[toUsername]) msgs[toUsername] = [];
  msgs[toUsername].push(msg);
  msgSave(msgs);
  const chats = chatsLoad();
  if (!chats.includes(toUsername)) { chats.unshift(toUsername); chatsSave(chats); }
  sbInsert('messages', { chat_key: sbChatKey(p.username, toUsername), from_user: p.username, to_user: toUsername, text: msg.text, ts });
  _mcForwardText = null;
  toast('↪️ Переслано');
}

// ┄┄ Stickers ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
const MC_STICKER_PACKS = [
  { id: 'basic', name: '😊 Базовые', vip: false, stickers: [
    '😂','😭','😍','🥹','😎','🤩','😡','😴','🥳','😱',
    '🤡','💀','👻','🎉','🔥','💔','❤️','🤝','🫡','🫠'
  ]},
  { id: 'vip1', name: '✅ Премиум', vip: true, stickers: [
    '🦋','🌊','⚡','🍀','🎭','🧨','💎','🫧','🌈','🎪',
    '🦄','🐉','🌸','🎯','🏆','💫','🌙','☄️','🎆','🎇'
  ]},
  { id: 'vip2', name: '🎨 Арт', vip: true, stickers: [
    '🖼','🎨','🖌','✏️','📝','🗿','🏛','🎭','🎪','🎠',
    '🎡','🎢','🎪','🌅','🌄','🌃','🏙','🌆','🌇','🌉'
  ]},
];

let _mcStickerPanelOpen = false;

function mcToggleStickerPanel() {
  const panel = document.getElementById('mc-sticker-panel');
  const btn   = document.getElementById('mc-sticker-btn');
  if (!panel) return;
  _mcStickerPanelOpen = !_mcStickerPanelOpen;

  if (_mcStickerPanelOpen) {
    // Скрываем клавиатуру
    const inp = document.getElementById('mc-input');
    if (inp) inp.blur();
    panel.style.display = '';
    panel.style.maxHeight = '0';
    panel.style.overflowY = 'auto';
    panel.style.overflowX = 'hidden';
    panel.style.touchAction = 'pan-y';
    panel.style.webkitOverflowScrolling = 'touch';
    panel.style.transition = 'max-height .28s cubic-bezier(.34,1.1,.64,1)';
    panel.style.padding = '0 12px 8px';
    requestAnimationFrame(() => { panel.style.maxHeight = '300px'; });
    mcRenderStickerPanel();
    // Меняем иконку на клавиатуру
    if (btn) btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M8 11h.01M12 11h.01M16 11h.01M8 15h8"/>
    </svg>`;
  } else {
    panel.style.maxHeight = '0';
    setTimeout(() => { panel.style.display = 'none'; panel.style.maxHeight = ''; panel.style.overflow = ''; }, 280);
    // Восстанавливаем иконку смайлика
    if (btn) btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <path d="M9 9h.01M15 9h.01"/><path d="M14 15c0 0 .5 1 2 .5"/>
    </svg>`;
    // Фокусируем инпут чтобы показать клавиатуру
    setTimeout(() => {
      const inp = document.getElementById('mc-input');
      if (inp) inp.focus();
    }, 50);
  }
}

// Закрывать emoji-панель при тапе на инпут
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('mc-input');
  if (inp) inp.addEventListener('focus', () => {
    if (_mcStickerPanelOpen) mcToggleStickerPanel();
  // Загружаем информацию о бэкапах при открытии настроек
  setTimeout(_loadBackupInfo, 100);
  });
});


// ══════════════════════════════════════════════════════════════════════════════
// 💾 BACKUP SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

function _loadBackupInfo() {
  const el = document.getElementById('backup-info-text');
  if (!el) return;
  if (!window.Android?.getBackupInfo) {
    el.textContent = 'Недоступно в этой версии';
    return;
  }
  try {
    const info = JSON.parse(window.Android.getBackupInfo());
    if (!info.hasBackup) {
      el.innerHTML = '<span style="color:var(--muted)">Бэкапов нет — они создаются автоматически перед каждым обновлением</span>';
    } else {
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:700;font-size:14px">v${info.lastVersion}</div>
            <div style="font-size:11px;color:var(--muted)">${info.lastDate} · ${info.totalSize}</div>
          </div>
          <div style="font-size:11px;color:var(--muted);text-align:right">${info.count} файл${info.count === 1 ? '' : info.count < 5 ? 'а' : 'ов'}</div>
        </div>`;
    }
  } catch(e) {
    el.textContent = 'Ошибка загрузки';
  }
}

function showBackupList() {
  if (!window.Android?.getBackupInfo) { toast('ℹ️ Функция недоступна'); return; }
  let info;
  try { info = JSON.parse(window.Android.getBackupInfo()); } catch(e) { toast('❌ Ошибка'); return; }
  if (!info.hasBackup || !info.backups?.length) {
    toast('ℹ️ Бэкапов нет. Они создаются автоматически перед каждым обновлением');
    return;
  }
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center';
  let rows = info.backups.map((b, i) => `
    <div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div>
        <div style="font-size:14px;font-weight:700">${b.name.replace('backup_','').replace('.apk','')}</div>
        <div style="font-size:11px;color:var(--muted)">${b.date} · ${b.size}</div>
      </div>
      <button onclick="this.disabled=true;this.textContent='⏳';window.Android?.restoreBackupByPath('${b.path.replace(/'/g,"\'")}');document.getElementById('backup-list-sheet')?.remove()"
        style="background:var(--accent);color:#fff;border:none;border-radius:10px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0">↩ Откат</button>
    </div>`).join('');
  d.innerHTML = `<div id="backup-list-sheet" style="background:var(--surface);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding-bottom:calc(16px + var(--safe-bot));animation:mcSlideUp .26s cubic-bezier(.34,1.1,.64,1)">
    <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:14px auto 16px"></div>
    <div style="font-size:17px;font-weight:700;padding:0 16px 12px;border-bottom:1px solid rgba(255,255,255,.06)">💾 Резервные копии (${info.count})</div>
    ${rows}
    <button onclick="this.closest('[style*=fixed]').remove()" style="width:calc(100% - 32px);margin:12px 16px 0;padding:13px;background:var(--surface2);border:none;border-radius:14px;color:var(--text);font-size:14px;font-weight:600;cursor:pointer">Закрыть</button>
  </div>`;
  document.body.appendChild(d);
  d.addEventListener('click', e => { if (e.target === d) d.remove(); });
}

function confirmRestoreBackup() {
  if (!window.Android?.getBackupInfo) { toast('ℹ️ Функция недоступна'); return; }
  let info;
  try { info = JSON.parse(window.Android.getBackupInfo()); } catch(e) { toast('❌ Ошибка'); return; }
  if (!info.hasBackup) { toast('ℹ️ Бэкапов нет'); return; }
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:24px';
  d.innerHTML = `<div style="background:var(--surface);border-radius:20px;padding:24px;max-width:340px;width:100%;animation:mcSlideUp .22s ease">
    <div style="font-size:22px;text-align:center;margin-bottom:8px">↩</div>
    <div style="font-size:17px;font-weight:700;text-align:center;margin-bottom:8px">Восстановить v${info.lastVersion}?</div>
    <div style="font-size:13px;color:var(--muted);text-align:center;margin-bottom:20px">Будет запущен установщик APK. Текущая версия будет заменена.</div>
    <div style="display:flex;gap:10px">
      <button onclick="this.closest('[style*=fixed]').remove()" style="flex:1;padding:12px;background:var(--surface2);border:none;border-radius:14px;color:var(--text);font-size:14px;font-weight:600;cursor:pointer">Отмена</button>
      <button onclick="this.closest('[style*=fixed]').remove();window.Android?.restoreBackup()" style="flex:1;padding:12px;background:#ff6b6b;border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:700;cursor:pointer">Восстановить</button>
    </div>
  </div>`;
  document.body.appendChild(d);
}

// ══════════════════════════════════════════════════════════════════════════════
// 🚨 CRITICAL ERROR → BACKUP DIALOG
// Показывается автоматически при критических сбоях (падение экрана, JS-краш,
// ошибки загрузки), чтобы пользователь мог быстро откатиться на прошлую версию.
// ══════════════════════════════════════════════════════════════════════════════

let _critErrShown = false; // показываем только один раз за сессию

window.showCriticalErrorBackupDialog = function(errorMsg) {
  if (_critErrShown) return;
  _critErrShown = true;

  // Если нет Android-бриджа или бэкапов — показываем облегчённый вариант без кнопки отката
  const hasBackup = (function() {
    try {
      if (!window.Android?.getBackupInfo) return false;
      const info = JSON.parse(window.Android.getBackupInfo());
      return !!(info.hasBackup && info.backups?.length);
    } catch(e) { return false; }
  })();

  const d = document.createElement('div');
  d.id = 'critical-error-overlay';
  d.style.cssText = [
    'position:fixed;inset:0;z-index:99999',
    'background:rgba(0,0,0,.72)',
    'display:flex;align-items:center;justify-content:center',
    'padding:24px',
    'animation:mcFadeIn .25s ease',
  ].join(';');

  const shortErr = (errorMsg || 'Неизвестная ошибка')
    .replace(/https?:\/\/[^\s]*/g, '')
    .slice(0, 120);

  const backupBlock = hasBackup ? (() => {
    let info = {};
    try { info = JSON.parse(window.Android.getBackupInfo()); } catch(e) {}
    return `
      <div style="background:rgba(255,100,100,.12);border:1px solid rgba(255,100,100,.28);border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:rgba(255,180,180,.95)">
        💾 Доступна резервная копия: <strong>v${info.lastVersion || '?'}</strong>
        <span style="color:rgba(255,255,255,.45);font-size:11px;margin-left:6px">${info.lastDate || ''}</span>
      </div>
      <button id="cerr-restore-btn" style="width:100%;padding:13px;background:#ff6b6b;border:none;border-radius:14px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:8px">
        ↩ Восстановить предыдущую версию
      </button>`;
  })() : `
      <div style="background:rgba(255,255,255,.06);border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:rgba(255,255,255,.5)">
        Резервных копий нет. Попробуй переустановить приложение вручную.
      </div>`;

  d.innerHTML = `
    <div style="background:var(--surface,#1c1c1e);border-radius:22px;padding:24px;max-width:360px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,.7)">
      <div style="font-size:36px;text-align:center;margin-bottom:10px">⚠️</div>
      <div style="font-size:18px;font-weight:700;text-align:center;margin-bottom:6px;color:var(--text,#fff)">Критическая ошибка</div>
      <div style="font-size:13px;color:rgba(255,255,255,.45);text-align:center;margin-bottom:20px;line-height:1.45">
        Приложение обнаружило сбой и не может нормально работать.
      </div>
      <div style="background:rgba(255,255,255,.05);border-radius:10px;padding:10px 12px;margin-bottom:18px;font-size:11px;color:rgba(255,255,255,.35);font-family:monospace;word-break:break-all;max-height:60px;overflow:hidden">
        ${shortErr}
      </div>
      ${backupBlock}
      <button id="cerr-ignore-btn" style="width:100%;padding:12px;background:rgba(255,255,255,.07);border:none;border-radius:14px;color:rgba(255,255,255,.6);font-size:14px;font-weight:600;cursor:pointer">
        Продолжить (нестабильно)
      </button>
    </div>`;

  document.body.appendChild(d);

  const restoreBtn = document.getElementById('cerr-restore-btn');
  const ignoreBtn  = document.getElementById('cerr-ignore-btn');

  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      restoreBtn.disabled = true;
      restoreBtn.textContent = '⏳ Запуск установщика...';
      try { window.Android.restoreBackup(); } catch(e) { toast('❌ Ошибка запуска'); }
    });
  }

  if (ignoreBtn) {
    ignoreBtn.addEventListener('click', () => {
      d.remove();
      // Сбрасываем флаг чтобы при следующей новой серьёзной ошибке диалог мог появиться снова
      _critErrShown = false;
    });
  }
};

// Хранит данные категорий после первого build — не пересобираем каждый раз
let _mcEmojiCats = null;

// Порядок категорий как в Google Keyboard Android:
// Смайлики → Люди → Природа → Еда → Активность → Путешествия → Объекты → Символы
// (ppl разделён на "faces" и "people" — объединяем в одну вкладку как в Gboard)
const _MC_EMOJI_CAT_ORDER = ['ppl', 'nat', 'food', 'act', 'travel', 'obj', 'sym'];
const _MC_EMOJI_CAT_LABELS = {
  ppl:    '😀 Смайлы',
  nat:    '🐶 Природа',
  food:   '🍕 Еда',
  act:    '⚽ Активность',
  travel: '🚗 Места',
  obj:    '💡 Объекты',
  sym:    '🔣 Символы',
};

function _mcBuildEmojiCats() {
  if (_mcEmojiCats) return _mcEmojiCats;
  const cats = {};
  _MC_EMOJI_CAT_ORDER.forEach(k => { cats[k] = { label: _MC_EMOJI_CAT_LABELS[k], items: [] }; });
  if (typeof IOS_EMOJI_MAP !== 'undefined') {
    for (const [emoji, path] of Object.entries(IOS_EMOJI_MAP)) {
      const cat = path.split('/')[0];
      if (cat === 'flags') continue;
      if (path.includes('Skin Tone') || path.includes('No Skin Tone')) continue;
      if (cats[cat]) cats[cat].items.push(emoji);
    }
  } else {
    MC_STICKER_PACKS.forEach(pack => {
      pack.stickers.forEach(s => { if (cats.ppl) cats.ppl.items.push(s); });
    });
  }
  _mcEmojiCats = cats;
  return cats;
}

function mcRenderStickerPanel() {
  const panel = document.getElementById('mc-sticker-panel');
  if (!panel) return;
  const cats = _mcBuildEmojiCats();

  // ── Шапка с категориями ───────────────────────────────────────────
  let html = `<div style="display:flex;gap:4px;padding:8px 0 8px;border-bottom:1px solid rgba(255,255,255,.07);overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;touch-action:pan-x">`;
  for (const [key, cat] of Object.entries(cats)) {
    if (!cat.items.length) continue;
    html += `<button ontouchend="mcScrollEmojiCat('${key}')" style="flex-shrink:0;background:none;border:none;color:var(--muted);font-size:18px;padding:4px 8px;border-radius:8px;cursor:pointer;-webkit-tap-highlight-color:transparent" id="mc-ecat-btn-${key}">${cat.label.split(' ')[0]}</button>`;
  }
  html += `</div>`;

  // ── Для каждой категории рисуем placeholder-блок ──────────────────
  // Сами emoji НЕ рендерятся сразу — только пустые <span data-emoji="...">
  for (const [key, cat] of Object.entries(cats)) {
    if (!cat.items.length) continue;
    const ITEM_SIZE = 44; // px
    const cols = Math.floor((window.innerWidth - 24) / ITEM_SIZE) || 8;
    const rows = Math.ceil(cat.items.length / cols);
    const totalH = rows * ITEM_SIZE;
    // Сохраняем список emoji в data-атрибуте как JSON (одна строка для IntersectionObserver)
    const chunked = [];
    for (let i = 0; i < cat.items.length; i += cols * 4) {
      chunked.push(cat.items.slice(i, i + cols * 4));
    }
    html += `<div id="mc-ecat-${key}" style="margin-top:8px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px;padding:0 4px">${cat.label}</div>
      <div id="mc-ecat-grid-${key}" data-cat="${key}" style="display:flex;flex-wrap:wrap;gap:0;min-height:${Math.min(totalH, ITEM_SIZE * 3)}px">
        <div class="mc-emoji-lazy-sentinel" data-cat="${key}" data-offset="0" style="width:100%;height:1px;flex-shrink:0"></div>
      </div>
    </div>`;
  }
  panel.innerHTML = html;

  // ── Настраиваем IntersectionObserver для ленивой загрузки ─────────
  const CHUNK = 40; // сколько emoji рендерим за раз
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const sentinel = entry.target;
      observer.unobserve(sentinel);
      const cat = sentinel.dataset.cat;
      const offset = parseInt(sentinel.dataset.offset, 10) || 0;
      const items = _mcEmojiCats?.[cat]?.items;
      if (!items) return;
      const grid = document.getElementById('mc-ecat-grid-' + cat);
      if (!grid) return;
      const chunk = items.slice(offset, offset + CHUNK);
      const frag = document.createDocumentFragment();
      chunk.forEach(s => {
        const sp = document.createElement('span');
        sp.style.cssText = 'width:44px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:10px;flex-shrink:0;-webkit-tap-highlight-color:transparent;touch-action:auto';
        // Отслеживаем свайп — если пользователь скролит, не отправляем
        let _tx = 0, _ty = 0, _moved = false;
        sp.addEventListener('touchstart', e => {
          const t = e.touches[0];
          _tx = t.clientX; _ty = t.clientY; _moved = false;
          sp.style.background = 'rgba(255,255,255,.12)';
        }, { passive: true });
        sp.addEventListener('touchmove', e => {
          const t = e.touches[0];
          if (Math.abs(t.clientX - _tx) > 8 || Math.abs(t.clientY - _ty) > 8) _moved = true;
        }, { passive: true });
        sp.addEventListener('touchend', e => {
          sp.style.background = '';
          if (!_moved) { e.preventDefault(); mcSendStickerOrEmoji(s); }
        });
        const img = typeof _emojiImg === 'function' ? _emojiImg(s, 34) : s;
        sp.innerHTML = img;
        frag.appendChild(sp);
      });
      // Если есть ещё — добавляем следующий sentinel
      if (offset + CHUNK < items.length) {
        const nextSentinel = document.createElement('div');
        nextSentinel.className = 'mc-emoji-lazy-sentinel';
        nextSentinel.dataset.cat = cat;
        nextSentinel.dataset.offset = String(offset + CHUNK);
        nextSentinel.style.cssText = 'width:100%;height:1px;flex-shrink:0';
        frag.appendChild(nextSentinel);
        observer.observe(nextSentinel);
      }
      grid.appendChild(frag);
    });
  }, { root: panel, rootMargin: '200px', threshold: 0 });

  // Запускаем наблюдение за первыми sentinel'ами каждой категории
  panel.querySelectorAll('.mc-emoji-lazy-sentinel').forEach(s => observer.observe(s));
}

function mcScrollEmojiCat(key) {
  const el = document.getElementById('mc-ecat-' + key);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mcSendStickerOrEmoji(emoji) {
  // Вставляем в инпут если он активен, иначе отправляем как стикер
  const inp = document.getElementById('mc-input');
  if (inp && document.activeElement !== inp) {
    // Отправляем как стикер
    mcSendSticker(emoji);
  } else if (inp) {
    // Вставляем в текст
    const start = inp.selectionStart || inp.value.length;
    inp.value = inp.value.slice(0, start) + emoji + inp.value.slice(inp.selectionEnd || start);
    inp.dispatchEvent(new Event('input'));
    inp.selectionStart = inp.selectionEnd = start + emoji.length;
  } else {
    mcSendSticker(emoji);
  }
}

function mcSendSticker(emoji) {
  const p = profileLoad();
  if (!p || !_msgCurrentChat) return;
  const ts = Date.now();
  const msg = { from: p.username, to: _msgCurrentChat, sticker: emoji, text: '', ts, delivered: false, read: false };
  const msgs = msgLoad();
  if (!msgs[_msgCurrentChat]) msgs[_msgCurrentChat] = [];
  msgs[_msgCurrentChat].push(msg);
  msgSave(msgs);
  messengerRenderMessages(true);
  SFX.play && SFX.play('msgSend');
  sbInsert('messages', { chat_key: sbChatKey(p.username, _msgCurrentChat), from_user: p.username, to_user: _msgCurrentChat, text: emoji, ts });
  // Панель остаётся открытой для удобства   пользователь закрывает сам
}

function mcAutoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ┄┄ Telegram-style медиа-меню ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function mcPickMedia() {
  console.log('[AttachMenu] opening');
  const existing = document.getElementById('mc-media-sheet');
  if (existing) { existing.remove(); return; }

  const sheet = document.createElement('div');
  sheet.id = 'mc-media-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9100;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.5);animation:mcFadeIn .15s ease';

  // Telegram-style: цветные круглые иконки + подписи снизу
  const items = [
    { bg:'#2196f3', svg:'<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>', label:'Фото',   action:"document.getElementById('mc-media-sheet')?.remove();mcPickImage()" },
    { bg:'#e91e63', svg:'<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>', label:'Видео',  action:"document.getElementById('mc-media-sheet')?.remove();mcPickVideo()" },
    { bg:'#9c27b0', svg:'<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>', label:'Файл',   action:"document.getElementById('mc-media-sheet')?.remove();mcPickFile()" },
    { bg:'#ff9800', svg:'<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>', label:'Аудио',  action:"document.getElementById('mc-media-sheet')?.remove();mcPickAudio()" },
    { bg:'#4caf50', svg:'<circle cx="12" cy="12" r="9" stroke="white" stroke-width="2" fill="none"/><circle cx="12" cy="9" r="3" fill="white"/><path d="M6 20c0-3.31 2.69-6 6-6s6 2.69 6 6" fill="white"/>', label:'Кружок', action:"document.getElementById('mc-media-sheet')?.remove();mcStartCircleRecord()" },
    { bg:'#607d8b', svg:'<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 2.75c1.24 0 2.25 1.01 2.25 2.25S13.24 11.25 12 11.25 9.75 10.24 9.75 9 10.76 6.75 12 6.75zM20 18H4v-.75c0-2.66 5.33-4 8-4s8 1.34 8 4V18z"/>', label:'Контакт', action:"toast('🚧 Скоро')" },
  ];

  const icons = items.map((it, i) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:7px;cursor:pointer;-webkit-tap-highlight-color:transparent"
      ontouchstart="this.querySelector('.attach-ico').style.transform='scale(.88)'"
      ontouchend="this.querySelector('.attach-ico').style.transform=''"
      onclick="${it.action}">
      <div class="attach-ico" style="width:56px;height:56px;border-radius:50%;background:${it.bg};
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 12px ${it.bg}55;
        transition:transform .12s cubic-bezier(.34,1.3,.64,1)">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white">${it.svg}</svg>
      </div>
      <span style="font-size:11px;color:var(--text);font-weight:500;letter-spacing:.01em">${it.label}</span>
    </div>`).join('');

  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;
      padding:16px 20px calc(20px + var(--safe-bot));
      animation:mcSlideUp .26s cubic-bezier(.34,1.1,.64,1)"
      onclick="event.stopPropagation()">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:0 auto 18px"></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px 10px">
        ${icons}
      </div>
      <div style="height:4px"></div>
    </div>`;

  sheet.addEventListener('click', () => sheet.remove());
  document.body.appendChild(sheet);
  console.log('[AttachMenu] opened');
}

// ┄┄ Отправка аудиофайла ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function mcPickAudio() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'audio/*';
  inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.onchange = async (e) => {
    const file = e.target.files[0]; inp.remove();
    if (!file) return;
    _pendingUploadBlob = file; _pendingUploadMime = file.type;
    if (file.size > 200 * 1024 * 1024) { toast('❌ Файл слишком большой (макс. 200 МБ)'); return; }
    _mcInChatSendingShow('voice', file.name || 'Аудио');
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const url = await _catboxUpload(b64, file.name || ('audio_' + Date.now()), file.type || 'audio/mpeg');
      _mcSendMediaMsg({ url, fileName: file.name || 'Аудио', fileType: 'voice', fileSize: file.size,
        _blob: file, _mime: file.type });
      _mcHideUploadToast(true);
    } catch(err) { _mcInChatSendingHide(); toast('❌ ' + (err.message || 'Ошибка загрузки')); }
  };
  inp.click();
}

// ┄┄ Отправка изображения ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function mcPickImage() {
  console.log('[Attach] picking image');
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.onchange = (e) => {
    const file = e.target.files[0];
    if (file) { _pendingUploadBlob = file; _pendingUploadMime = file.type; }
    inp.remove();
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('❌ Фото слишком большое (макс. 20 МБ)'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        const data = cv.toDataURL('image/jpeg', 0.82);
        mcSendImage(data);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  inp.click();
}

// Вызывается Java когда PermissionRequest протух за время диалога разрешений.
window.mcVoiceRetryAfterPermission = function() {
  toast('🎤 Разрешение получено, начинаю запись...');
  setTimeout(() => mcVoiceTouchStart({ preventDefault: () => {} }), 300);
};

// ┄┄ Колбэки нативного рекордера (вызываются из Java) ┄┄┄┄┄┄┄┄┄┄┄┄┄
window.onNativeVoiceTick = function(sec) {
  // Обновляем таймер в UI
  _mcVoiceSeconds = sec;
  _mcVoiceUpdateTimer();
  if (sec >= MC_VOICE_MAX) _mcVoiceSend();
};
window.onNativeVoiceDone = function(url, duration, mimeType) {
  // Toast уже показан в _mcVoiceSend через _mcShowUploadToast
  _mcInChatSendingHide();
  _mcSendMediaMsg({ url, fileName: 'voice_' + Date.now() + '.m4a',
    fileType: 'voice', duration: duration });
};
window.onNativeVoiceError = function(msg) {
  _mcVoiceNative = false;
  _mcVoiceHideUI();
  _mcHideUploadToast(false);
  toast('❌ ' + (msg || 'Ошибка записи'));
};
window.onNativeVoiceCancelled = function() {
  _mcVoiceNative = false;
  _mcVoiceHideUI();
  toast('🗑 Запись отменена');
};


// ══════════════════════════════════════════════════════════════════════
// 💾 ЛОКАЛЬНЫЙ МЕДИА-КЭШ (IndexedDB)
// Сохраняем blob-данные отправленных/полученных файлов локально.
// При открытии используем локальный blob-URL вместо сетевого.
// DB: mediaCache, store: files, key: удалённый URL, value: {blob, ts, mimeType, size}
// Автоочистка записей > 7 дней (или > 200MB суммарно).
// ══════════════════════════════════════════════════════════════════════
const _MC_DB_NAME    = 'sapp_media_v1';
const _MC_DB_STORE   = 'files';
const _MC_MAX_AGE_MS = 7 * 24 * 3600 * 1000;   // 7 дней
const _MC_MAX_BYTES  = 200 * 1024 * 1024;       // 200 МБ

let _mcDb = null;

function _mcDbOpen() {
  if (_mcDb) return Promise.resolve(_mcDb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_MC_DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_MC_DB_STORE)) {
        const store = db.createObjectStore(_MC_DB_STORE, { keyPath: 'url' });
        store.createIndex('ts', 'ts', { unique: false });
      }
    };
    req.onsuccess = (e) => { _mcDb = e.target.result; resolve(_mcDb); };
    req.onerror   = () => { console.warn('[MediaCache] IDB open failed'); resolve(null); };
  });
}

/** Сохранить blob/base64 в кэш по URL */
async function mcCacheSave(url, blobOrB64, mimeType) {
  try {
    const db = await _mcDbOpen();
    if (!db) return;
    let blob;
    if (blobOrB64 instanceof Blob) {
      blob = blobOrB64;
    } else {
      // base64 без data: префикса
      const bin = atob(blobOrB64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      blob = new Blob([arr], { type: mimeType || 'application/octet-stream' });
    }
    const tx = db.transaction(_MC_DB_STORE, 'readwrite');
    tx.objectStore(_MC_DB_STORE).put({ url, blob, mimeType: mimeType || blob.type, ts: Date.now(), size: blob.size });
    console.log('[MediaCache] saved:', url.slice(-30), 'size:', blob.size);
    // Async cleanup (не блокируем)
    setTimeout(_mcCacheCleanup, 500);
  } catch(e) { console.warn('[MediaCache] save error:', e); }
}

/** Получить blob URL из кэша (или null) */
async function mcCacheGet(url) {
  try {
    const db = await _mcDbOpen();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx  = db.transaction(_MC_DB_STORE, 'readonly');
      const req = tx.objectStore(_MC_DB_STORE).get(url);
      req.onsuccess = (e) => {
        const rec = e.target.result;
        if (!rec) { resolve(null); return; }
        // Если запись протухла   возвращаем null и удаляем
        if (Date.now() - rec.ts > _MC_MAX_AGE_MS) {
          _mcCacheDelete(url);
          resolve(null);
          return;
        }
        const blobUrl = URL.createObjectURL(rec.blob);
        console.log('[MediaCache] hit:', url.slice(-30));
        resolve(blobUrl);
      };
      req.onerror = () => resolve(null);
    });
  } catch(e) { console.warn('[MediaCache] get error:', e); return null; }
}

function _mcCacheDelete(url) {
  _mcDbOpen().then(db => {
    if (!db) return;
    const tx = db.transaction(_MC_DB_STORE, 'readwrite');
    tx.objectStore(_MC_DB_STORE).delete(url);
  });
}

async function _mcCacheCleanup() {
  try {
    const db = await _mcDbOpen();
    if (!db) return;
    const tx    = db.transaction(_MC_DB_STORE, 'readwrite');
    const store = tx.objectStore(_MC_DB_STORE);
    const all   = await new Promise(res => { const r = store.getAll(); r.onsuccess = () => res(r.result); r.onerror = () => res([]); });
    const now   = Date.now();
    let totalSize = 0;
    // Сортируем по дате (новые последние)
    all.sort((a,b) => a.ts - b.ts);
    const toDelete = [];
    // 1. Удаляем протухшие
    for (const rec of all) {
      if (now - rec.ts > _MC_MAX_AGE_MS) toDelete.push(rec.url);
      else totalSize += rec.size || 0;
    }
    // 2. Если превышен лимит   удаляем самые старые
    const fresh = all.filter(r => now - r.ts <= _MC_MAX_AGE_MS);
    let sz = fresh.reduce((s,r) => s + (r.size||0), 0);
    for (const rec of fresh) {
      if (sz <= _MC_MAX_BYTES) break;
      toDelete.push(rec.url);
      sz -= rec.size || 0;
    }
    if (toDelete.length > 0) {
      const tx2 = db.transaction(_MC_DB_STORE, 'readwrite');
      const s2  = tx2.objectStore(_MC_DB_STORE);
      toDelete.forEach(u => s2.delete(u));
      console.log('[MediaCache] cleanup: deleted', toDelete.length, 'entries');
    }
  } catch(e) { console.warn('[MediaCache] cleanup error:', e); }
}

// ══════════════════════════════════════════════════════════════════════
// ┄┄ Загрузка файла на catbox.moe через Java-бридж ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// base64   без data:  префикса. Возвращает Promise<string> с URL или бросает ошибку.
// ┄┄ Telegram-style upload progress toast ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
const _uploadIcons = {
  voice: '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>',
  video: '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>',
  file:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
  image: '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
};

// ══════════════════════════════════════════════════════════════════
// 📤 IN-CHAT SENDING BUBBLE   Telegram-стиль
// Пузырь отправки показывается ВНУТРИ чата, а не в глобальном тосте.
// Выглядит как реальное сообщение с иконкой типа + спиннер + прогресс.
// ══════════════════════════════════════════════════════════════════

const _IC_SEND_ID = 'mc-in-chat-sending';

/**
 * Показывает в нижней части чата пузырь «отправляется…
 * точно такого же вида как настоящий пузырь, но с анимацией загрузки.
 * fileType: 'voice' | 'circle' | 'video' | 'file' | 'image'
 * label: имя файла (необязательно)
 */
function _mcInChatSendingShow(fileType, label) {
  _mcInChatSendingHide();
  const body = document.getElementById('mc-messages');
  if (!body) return;

  const isCircle = fileType === 'circle';
  const isVoice  = fileType === 'voice';
  const el = document.createElement('div');
  el.id = _IC_SEND_ID;
  el.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:4px;padding:0 12px';
  const circumference = 2 * Math.PI * (isCircle ? 48 : 22);

  if (isCircle) {
    // Кружок: круглый превью с кольцом прогресса + кнопка отмены
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <div id="mc-ics-cancel-btn" onclick="mcCancelSending()" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </div>
        <div style="position:relative;width:96px;height:96px;border-radius:50%;background:#1a1a1a;overflow:hidden;flex-shrink:0">
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,255,255,.35)">
              <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none"/>
              <circle cx="12" cy="9" r="3" fill="rgba(255,255,255,.35)"/>
              <path d="M6 20c0-3.31 2.69-6 6-6s6 2.69 6 6" fill="rgba(255,255,255,.35)"/>
            </svg>
          </div>
          <svg style="position:absolute;inset:0;width:100%;height:100%" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="4"/>
            <circle id="mc-ics-ring" cx="48" cy="48" r="44" fill="none" stroke="white" stroke-width="4"
              stroke-dasharray="${(2*Math.PI*44).toFixed(1)}" stroke-dashoffset="${(2*Math.PI*44).toFixed(1)}"
              stroke-linecap="round" transform="rotate(-90 48 48)"
              style="transition:stroke-dashoffset .2s linear"/>
          </svg>
        </div>
      </div>`;
  } else {
    // Голосовое / файл: пузырь + кнопка отмены (X) слева
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <div id="mc-ics-cancel-btn" onclick="mcCancelSending()" style="width:36px;height:36px;border-radius:50%;background:var(--surface2);border:1.5px solid var(--surface3);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="color:var(--muted)"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </div>
        <div style="display:flex;align-items:center;gap:10px;background:var(--accent);padding:8px 14px 8px 8px;border-radius:18px 18px 4px 18px;min-width:180px;max-width:66%">
          <div style="position:relative;width:44px;height:44px;flex-shrink:0">
            <svg width="44" height="44" viewBox="0 0 44 44" style="position:absolute;inset:0">
              <circle cx="22" cy="22" r="18" fill="rgba(255,255,255,.15)" stroke="none"/>
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2.5"/>
              <circle id="mc-ics-ring" cx="22" cy="22" r="18" fill="none" stroke="white" stroke-width="2.5"
                stroke-dasharray="${(2*Math.PI*18).toFixed(1)}" stroke-dashoffset="${(2*Math.PI*18).toFixed(1)}"
                stroke-linecap="round" transform="rotate(-90 22 22)"
                style="transition:stroke-dashoffset .2s linear"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
              ${isVoice
                ? `<svg width="14" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>`
                : `<svg width="14" height="16" viewBox="0 0 24 24" fill="white"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>`}
            </div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml((label||'').slice(0,30))}</div>
            <div id="mc-ics-sub" style="font-size:11px;color:rgba(255,255,255,.7);margin-top:2px">Отправляю </div>
          </div>
        </div>
      </div>`;
  }

  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}


/** Обновляет подпись под именем файла (например «⬆ 42%») */
function _mcInChatSendingUpdate(fileType, subText) {
  const sub = document.getElementById('mc-ics-sub');
  if (sub) sub.textContent = subText || 'Отправляю ';
  // Обновляем кольцо прогресса если есть % в тексте
  const pctMatch = (subText || '').match(/(\d+)%/);
  if (pctMatch) {
    const pct = parseInt(pctMatch[1], 10);
    const ring = document.getElementById('mc-ics-ring');
    if (ring) {
      const total = parseFloat(ring.getAttribute('stroke-dasharray')) || 113.1;
      ring.style.strokeDashoffset = (total * (1 - pct / 100)).toFixed(1);
    }
  }
}

/** Убирает in-chat bubble */
function _mcInChatSendingHide() {
  const el = document.getElementById(_IC_SEND_ID);
  if (!el) return;
  el.style.animation = 'mc-ics-out .18s ease forwards';
  setTimeout(() => el.remove(), 200);
}

// ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄

let _uploadToastTimer = null;

function _mcShowUploadToast(fileType, label) {
  // Убираем предыдущий
  const prev = document.getElementById('mc-upload-toast');
  if (prev) prev.remove();
  clearTimeout(_uploadToastTimer);

  const ico = _uploadIcons[fileType] || _uploadIcons.file;
  const el = document.createElement('div');
  el.id = 'mc-upload-toast';
  el.className = 'uploading';
  el.innerHTML = `
    <div class="tg-ut-icon">
      <div class="tg-ut-ring"></div>
      ${ico}
    </div>
    <div style="flex:1;min-width:0">
      <div class="tg-ut-label">${escHtml(label || 'Загрузка...')}</div>
      <div class="tg-ut-sub" id="tg-ut-sub">Загружаю...</div>
    </div>
    <div class="mc-upload-spinner"></div>
  `;
  document.body.appendChild(el);
  return el;
}

function _mcUpdateUploadToastProgress(pct) {
  const ring = document.querySelector('#mc-upload-toast .tg-ut-ring');
  if (ring) ring.style.background = `conic-gradient(rgba(255,255,255,.85) ${pct}%, transparent ${pct}%)`;
  const sub = document.getElementById('tg-ut-sub');
  if (sub) sub.textContent = pct > 0 && pct < 100 ? Math.round(pct) + '%' : 'Загружаю...';
}

function _mcHideUploadToast(success) {
  const el = document.getElementById('mc-upload-toast');
  if (!el) return;
  // Показываем результат на секунду, потом исчезаем
  el.classList.remove('uploading');
  const sub = document.getElementById('tg-ut-sub');
  if (sub) sub.textContent = success ? '✅ Отправлено' : '✅ Ошибка';
  const ring = document.querySelector('#mc-upload-toast .tg-ut-ring');
  if (ring) ring.style.background = success
    ? 'conic-gradient(rgba(255,255,255,.9) 100%, transparent 100%)'
    : 'conic-gradient(rgba(255,100,100,.9) 100%, transparent 100%)';
  const spinner = el.querySelector('.mc-upload-spinner');
  if (spinner) spinner.style.display = 'none';
  clearTimeout(_uploadToastTimer);
  _uploadToastTimer = setTimeout(() => {
    if (!el.parentNode) return;
    el.classList.add('hiding');
    setTimeout(() => el.remove(), 200);
  }, 900);
}

// Временное хранилище blob для кэширования после загрузки
let _pendingUploadBlob = null;
let _pendingUploadMime = null;

async function _catboxUpload(base64, fileName, mimeType, onProgress) {
  if (!window.Android?.nativeUploadFile) throw new Error('nativeUploadFile недоступен');

  // Если есть асинхронная версия   используем её (не блокирует UI)
  if (typeof window.Android.nativeUploadFileAsync === 'function') {
    return new Promise((resolve, reject) => {
      const callbackId = 'up_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

      // Регистрируем глобальные колбэки
      window.onUploadProgress = (id, pct) => {
        if (id !== callbackId) return;
        // Обновляем inline ring прогресса
        const ring = document.getElementById('mc-ics-ring');
        if (ring) {
          const total = parseFloat(ring.getAttribute('stroke-dasharray')) || 113.1;
          ring.style.strokeDashoffset = (total * (1 - pct / 100)).toFixed(1);
        }
        const sub = document.getElementById('mc-ics-sub');
        if (sub) sub.textContent = Math.round(pct) + '%';
        onProgress && onProgress(pct);
      };
      window.onUploadDone = (id, url) => {
        if (id !== callbackId) return;
        _mcUpdateUploadToastProgress(100);
        onProgress && onProgress(100);
        // Кэшируем blob локально для быстрого доступа
        if (_pendingUploadBlob) {
          mcCacheSave(url, _pendingUploadBlob, _pendingUploadMime).catch(()=>{});
          _pendingUploadBlob = null; _pendingUploadMime = null;
        }
        resolve(url);
      };
      window.onUploadError = (id, err) => {
        if (id !== callbackId) return;
        reject(new Error(err || 'Upload failed'));
      };

      _mcUpdateUploadToastProgress(0);
      try {
        window.Android.nativeUploadFileAsync(base64, fileName, mimeType, callbackId);
      } catch (e) {
        reject(e);
      }

      // Таймаут 3 минуты
      setTimeout(() => reject(new Error('Таймаут загрузки (3 мин)')), 180000);
    });
  }

  // Фоллбэк: синхронная версия с имитацией прогресса
  onProgress && onProgress(0);
  _mcUpdateUploadToastProgress(0);
  let _fakeP = 0;
  const _fakeTimer = setInterval(() => {
    _fakeP = Math.min(88, _fakeP + (Math.random() * 10 + 3));
    _mcUpdateUploadToastProgress(_fakeP);
    onProgress && onProgress(_fakeP);
  }, 250);
  try {
    const result = await new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const r = JSON.parse(window.Android.nativeUploadFile(base64, fileName, mimeType));
          if (r.ok) resolve(r.url);
          else reject(new Error(r.error || 'Upload failed'));
        } catch(e) { reject(e); }
      }, 0);
    });
    clearInterval(_fakeTimer);
    _mcUpdateUploadToastProgress(100);
    onProgress && onProgress(100);
    return result;
  } catch(e) {
    clearInterval(_fakeTimer);
    throw e;
  }
}

// ┄┄ Отправка файла/видео/голоса как сообщения ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function _mcSendMediaMsg({ url, fileName, fileType, fileSize, duration, thumbData, _blob, _mime, extra }) {
  // Немедленно кэшируем blob локально   файл доступен без сети
  if (_blob && url) {
    mcCacheSave(url, _blob, _mime || 'application/octet-stream').catch(() => {});
    console.log('[MediaCache] immediate save for', fileType, fileName);
  }
  const p = profileLoad();
  if (!p || !_msgCurrentChat) return;
  const ts = Date.now();
  const replyTo = _mcReplyTo ? { from: _mcReplyTo.from, text: _mcReplyTo.text } : null;
  mcCancelReply();
  // Человекочитаемый label для превью в списке чатов
  const _mediaLabelMap = { voice: '🎤 Голосовое', video: '🎬 Видео', file: '📎 Файл' };
  const _mediaLabel = fileType === 'file' && fileName
    ? (() => {
        const ext = (fileName.split('.').pop() || '').toLowerCase();
        const audioExts = ['mp3','ogg','wav','flac','aac','m4a','opus','wma'];
        if (audioExts.includes(ext)) return '🎵 ' + fileName.replace(/\.[^.]+$/, '');
        return '📎 ' + fileName;
      })()
    : (_mediaLabelMap[fileType] || '📎 ' + (fileName || fileType));
  const msg = {
    from: p.username, to: _msgCurrentChat,
    text: _mediaLabel,
    ts, delivered: false, read: false,
    fileLink: url, fileName, fileType,
    ...(fileSize  ? { fileSize  } : {}),
    ...(duration  ? { duration  } : {}),
    ...(thumbData ? { thumbData } : {}),
    ...(replyTo   ? { replyTo   } : {}),
    ...(extra     ? { extra: JSON.stringify(extra) } : {}),
  };
  const msgs = msgLoad();
  if (!msgs[_msgCurrentChat]) msgs[_msgCurrentChat] = [];
  msgs[_msgCurrentChat].push(msg);
  msgSave(msgs);
  const chats = chatsLoad();
  if (!chats.includes(_msgCurrentChat)) { chats.unshift(_msgCurrentChat); chatsSave(chats); }
  messengerRenderMessages(true);
  SFX.play && SFX.play('msgSend');
  // Send button bounce
  const _sb3 = document.getElementById('mc-action-btn');
  if (_sb3) { _sb3.classList.remove('mc-send-bounce'); void _sb3.offsetWidth; _sb3.classList.add('mc-send-bounce'); setTimeout(()=>_sb3.classList.remove('mc-send-bounce'),300); }
  setTimeout(() => { const b = document.getElementById('mc-messages'); if(b) b.scrollTop = b.scrollHeight; }, 80);
  // В Supabase   только текст + URL (не base64!)
  const labelMap = { video: '🎬', file: '📎', voice: '🎤' };
  const _mediaOutboxData2 = {
    chat_key: sbChatKey(p.username, _msgCurrentChat),
    from_user: p.username, to_user: _msgCurrentChat,
    text: (labelMap[fileType] || '📎') + ' ' + (fileName || fileType), ts,
    extra: JSON.stringify({ fileLink: url, fileName, fileType,
      ...(fileSize  ? { fileSize  } : {}),
      ...(duration  ? { duration  } : {}),
      ...(thumbData ? { thumbData } : {}),
      ...(extra     ? extra        : {}) })
  };
  const _mediaOutboxItem2 = {
    id: 'media_' + ts, type: 'media', localChat: _msgCurrentChat, ts,
    data: _mediaOutboxData2
  };
  // Для групп переопределяем outbox data с правильным chat_key
  const _isGroupMedia = _msgCurrentChat === PUBLIC_GROUP_ID || _msgCurrentChat.startsWith('grp_');
  if (_isGroupMedia) {
    _mediaOutboxData2.chat_key = groupChatKey(_msgCurrentChat);
    _mediaOutboxData2.to_user  = '__broadcast__';
  }
  sbInsert('messages', _mediaOutboxData2).then(res => {
    if (res) {
      msg.delivered = true; msg.pending = false;
      msgSave(msgs); messengerRenderMessages(); _outboxUpdateStatusBar();
    } else {
      msg.pending = true; msgSave(msgs);
      outboxPush(_mediaOutboxItem2);
      messengerRenderMessages(); _outboxUpdateStatusBar();
    }
  }).catch(() => {
    msg.pending = true; msgSave(msgs);
    outboxPush(_mediaOutboxItem2);
    messengerRenderMessages(); _outboxUpdateStatusBar();
  });
}

// ┄┄ Генерация превью видео (первый кадр) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function _mcVideoThumb(file) {
  return new Promise(resolve => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted   = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.currentTime = 0.5;
    video.onloadeddata = () => {
      try {
        const cv = document.createElement('canvas');
        const MAX = 320;
        let w = video.videoWidth  || 320;
        let h = video.videoHeight || 180;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(video, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', 0.7));
      } catch(_) { resolve(null); }
      URL.revokeObjectURL(url);
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    setTimeout(() => { URL.revokeObjectURL(url); resolve(null); }, 5000);
  });
}

// ┄┄ Отправка видео ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function mcPickVideo() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'video/*'; inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.onchange = async (e) => {
    const file = e.target.files[0]; inp.remove();
    if (!file) return;
    _pendingUploadBlob = file; _pendingUploadMime = file.type;
    if (file.size > 200 * 1024 * 1024) { toast('❌ Видео слишком большое (макс. 200 МБ)'); return; }
    _mcInChatSendingShow('video', file.name || 'Видео');
    try {
      const [b64, thumbData] = await Promise.all([
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result.split(',')[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        }),
        _mcVideoThumb(file)
      ]);
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
      const url = await _catboxUpload(b64, file.name || ('video_' + Date.now() + '.' + ext), file.type || 'video/mp4');
      _mcSendMediaMsg({ url, fileName: file.name || 'Видео', fileType: 'video',
        fileSize: file.size, thumbData, _blob: file, _mime: file.type });
      _mcInChatSendingHide();
    } catch(err) { _mcInChatSendingHide(); toast('❌ ' + (err.message || 'Ошибка загрузки видео')); }
  };
  inp.click();
}

// ┄┄ Отправка файла ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function mcPickFile() {
  console.log('[Attach] picking file');
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '*/*'; inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.onchange = async (e) => {
    const file = e.target.files[0]; inp.remove();
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) { toast('❌ Файл слишком большой (макс. 200 МБ)'); return; }
    const _isAud2 = ['mp3','ogg','wav','flac','aac','m4a','opus','wma'].includes((file.name.split('.').pop()||'').toLowerCase());
    _mcInChatSendingShow(_isAud2 ? 'voice' : 'file', file.name || 'Файл');
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const url = await _catboxUpload(b64, file.name || ('file_' + Date.now()), file.type || 'application/octet-stream');
      _mcSendMediaMsg({ url, fileName: file.name || 'Файл', fileType: 'file',
        fileSize: file.size, _blob: file, _mime: file.type });
      _mcInChatSendingHide();
    } catch(err) { _mcInChatSendingHide(); toast('❌ ' + (err.message || 'Ошибка загрузки файла')); }
  };
  inp.click();
}


// ══════════════════════════════════════════════════════════════════
// ⭐ ЗАПИСЬ КРУЖКА   нативный Camera2 Activity (Telegram-стиль)
// Вызывает Android.startCircleRecord() ↩ CircleRecordActivity
// ══════════════════════════════════════════════════════════════════
// ⭐ КРУЖОК   нативный Camera2 + зажатие как у голосового
// ══════════════════════════════════════════════════════════════════

// Активна ли сейчас запись кружка
let _mcCircleActive = false;

/** Запускает CircleRecordActivity при ЗАЖАТИИ кнопки в режиме кружка */
function mcStartCircleRecord() {
  if (_mcCircleActive) return;
  if (window.Android && typeof Android.startCircleRecord === 'function') {
    _mcCircleActive = true;
    Android.startCircleRecord();
    return;
  }
  // Fallback   галерея/камера
  _mcCircleFallbackSheet();
}

/**
 * Java ↩ JS: Java загрузила видео на CDN, передаёт готовый URL.
 * Не передаёт base64   он слишком большой для evaluateJavascript.
 */
window.onNativeCircleUploading = function() {
  console.log('[Circle] uploading...');
  _mcInChatSendingShow('circle', 'Видеосообщение');
  _mcInChatSendingUpdate('circle', '⬆ Загружаю...');
};

window.onNativeCircleUploaded = function(url, fileSize, frontCamera) {
  console.log('[Circle] uploaded url=' + url + ' front=' + frontCamera);
  _mcCircleActive = false;
  _mcVoiceNative  = false;
  _mcInChatSendingHide();
  _mcSendMediaMsg({ url, fileName: 'Видеосообщение', fileType: 'circle',
    fileSize: fileSize || 0, thumbData: null,
    extra: frontCamera !== false ? { front: true } : undefined });
};

window.onNativeCircleCancelled = function() {
  console.log('[Circle] cancelled');
  _mcCircleActive = false;
  _mcVoiceNative  = false;
  _mcInChatSendingHide();
};

window.onNativeCircleError = function(msg) {
  console.error('[Circle] error:', msg);
  _mcCircleActive = false;
  _mcVoiceNative  = false;
  _mcInChatSendingHide();
  toast('❌ Ошибка камеры: ' + (msg || ''));
};

// onNativeCircleDone   legacy, на случай старых версий Java (не используется)
window.onNativeCircleDone = function() {};

/** Генерирует превью кружка из base64-видео. */
async function _mcVideoThumbFromB64(b64, mime) {
  return new Promise((resolve) => {
    try {
      const bin  = atob(b64.slice(0, Math.min(b64.length, 500000))); // первые ~375KB достаточно
      const arr  = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: mime || 'video/mp4' });
      const url  = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.src = url; video.muted = true; video.playsInline = true;
      video.currentTime = 0.5;
      video.onloadeddata = () => {
        try {
          const cv = document.createElement('canvas');
          cv.width  = 320; cv.height = 320;
          const ctx = cv.getContext('2d');
          // Центрированная квадратная обрезка (как Telegram)
          const vw = video.videoWidth || 320, vh = video.videoHeight || 320;
          const side = Math.min(vw, vh);
          const sx   = (vw - side) / 2, sy = (vh - side) / 2;
          ctx.drawImage(video, sx, sy, side, side, 0, 0, 320, 320);
          URL.revokeObjectURL(url);
          resolve(cv.toDataURL('image/jpeg', 0.7));
        } catch(_) { URL.revokeObjectURL(url); resolve(null); }
      };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      setTimeout(() => { URL.revokeObjectURL(url); resolve(null); }, 5000);
    } catch(_) { resolve(null); }
  });
}

// ┄┄ Fallback: выбор из галереи ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄

function _mcCircleFallbackSheet() {
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9200;background:rgba(0,0,0,.55);display:flex;flex-direction:column;justify-content:flex-end;animation:mcFadeIn .15s ease';
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:12px 16px calc(20px + var(--safe-bot));animation:mcSlideUp .24s cubic-bezier(.34,1.1,.64,1)" onclick="event.stopPropagation()">
      <div style="width:40px;height:4px;background:var(--surface3);border-radius:2px;margin:0 auto 16px"></div>
      <div style="font-size:15px;font-weight:700;margin-bottom:14px;text-align:center">⭐ Видеосообщение</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <button onclick="this.closest('[style*=fixed]').remove();_mcPickCircleFile()"
          style="padding:16px 10px;background:var(--surface2);border:none;border-radius:14px;color:var(--text);font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
          <span style="font-size:28px">🎞</span>
          <span>Из галереи</span>
        </button>
        <button onclick="this.closest('[style*=fixed]').remove();_mcPickCircleCamera()"
          style="padding:16px 10px;background:var(--accent);border:none;border-radius:14px;color:#000;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
          <span style="font-size:28px">📷</span>
          <span>Камера</span>
        </button>
      </div>
    </div>`;
  sheet.addEventListener('click', () => sheet.remove());
  document.body.appendChild(sheet);
}

function _mcPickCircleFile() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'video/*'; inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.onchange = async (e) => {
    const file = e.target.files[0]; inp.remove();
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { toast('❌ Видео слишком большое (макс. 100 МБ)'); return; }
    _mcInChatSendingShow('circle', '⭐ Видеосообщение');
    try {
      const [b64, thumbData] = await Promise.all([
        new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); }),
        _mcVideoThumb(file)
      ]);
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
      const url = await _catboxUpload(b64, 'circle_' + Date.now() + '.' + ext, file.type || 'video/mp4');
      _mcSendMediaMsg({ url, fileName: file.name, fileType: 'circle', fileSize: file.size, thumbData });
      _mcInChatSendingHide();
    } catch(err) { _mcInChatSendingHide(); toast('❌ ' + (err.message || 'Ошибка')); }
  };
  inp.click();
}

function _mcPickCircleCamera() {
  if (window.Android && typeof window.Android.requestCameraPermission === 'function') {
    window.onCameraPermissionResult = function(result) {
      window.onCameraPermissionResult = null;
      if (result === 'granted') { _mcPickCircleCameraActual(); }
      else { toast('📷 Нет доступа к камере'); }
    };
    window.Android.requestCameraPermission();
    return;
  }
  _mcPickCircleCameraActual();
}

function _mcPickCircleCameraActual() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'video/*'; inp.capture = 'user';
  inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.onchange = async (e) => {
    const file = e.target.files[0]; inp.remove();
    if (!file) return;
    _mcInChatSendingShow('circle', '⭐ Видеосообщение');
    try {
      const [b64, thumbData] = await Promise.all([
        new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); }),
        _mcVideoThumb(file)
      ]);
      const url = await _catboxUpload(b64, 'circle_' + Date.now() + '.mp4', file.type || 'video/mp4');
      _mcSendMediaMsg({ url, fileName: 'Видеосообщение', fileType: 'circle', fileSize: file.size, thumbData });
      _mcInChatSendingHide();
    } catch(err) { _mcInChatSendingHide(); toast('❌ ' + (err.message || 'Ошибка')); }
  };
  inp.click();
}
// 🎤 ГОЛОСОВЫЕ СООБЩЕНИЯ   Telegram-стиль
// Зажать 🎤 ↩ запись. Вверх ↩ заблокировать (не надо держать).
// Влево ↩ отмена. Отпустить ↩ отправить.
// ══════════════════════════════════════════════════════════════════
let _mcVoiceRecorder  = null;
let _mcVoiceChunks    = [];
let _mcVoiceTimer     = null;
let _mcVoiceSeconds   = 0;
let _mcVoiceCancelled = false;
let _mcVoiceStream    = null;
let _mcVoiceAnalyser  = null;
let _mcVoiceAnimFrame = null;
const MC_VOICE_MAX    = 60;

// ┄┄ Старт: вызывается при touchstart/mousedown на кнопке ┄┄┄┄┄┄┄┄┄┄
let _mcVoiceNative    = false; // true = идёт нативная запись через Java
let _mcVoiceStartX    = 0;     // начальная X-координата касания для swipe-cancel
let _mcVoiceStartY    = 0;

// Время нажатия   для различия короткого тапа от зажатия
let _mcVoiceTouchTs = 0;

let _mcVoiceHoldTimer = null; // таймер задержки перед началом записи

function mcVoiceTouchStart(e) {
  _mcVoiceTouchTs = Date.now();
  e.preventDefault();
  if (_mcVoiceRecorder || _mcVoiceNative) return;
  _mcVoiceCancelled = false;
  // Запоминаем начальную точку для определения свайпа
  const _vt = e.touches?.[0] || e;
  _mcVoiceStartX = _vt.clientX || _vt.pageX || 0;
  _mcVoiceStartY = _vt.clientY || _vt.pageY || 0;

  // Режим кружка   ЗАЖАТИЕ запускает CircleRecordActivity напрямую
  if (_mcVoiceMode === 'circle') {
    console.log('[Voice] circle hold   starting native recorder');
    clearTimeout(_mcVoiceHoldTimer);
    _mcVoiceHoldTimer = setTimeout(() => {
      if (_mcVoiceCancelled) return;
      // Ставим флаг ДО запуска — touchEnd увидит активную запись
      _mcVoiceNative = true;
      mcStartCircleRecord();
      // НЕ показываем VoiceUI — кружок управляется через Activity
    }, 280);
    return;
  }

  // Telegram-стиль: ждём 280мс   если отпустили раньше, это тап (переключение режима)
  clearTimeout(_mcVoiceHoldTimer);
  _mcVoiceHoldTimer = setTimeout(() => {
    if (_mcVoiceCancelled) return;
    console.log('[Voice] hold detected, starting recording');
    _mcVoiceStartRecording();
  }, 280);
}

function _mcVoiceStartRecording() {
  if (_mcVoiceRecorder || _mcVoiceNative) return;
  // Используем нативный рекордер (Java MediaRecorder) как основной  
  // getUserMedia в file:// WebView часто недоступен из-за ограничений контекста
  if (window.Android && typeof window.Android.startVoiceRecording === 'function') {
    console.log('[Voice] starting native recorder');
    _mcVoiceNative  = true;
    _mcVoiceSeconds = 0;
    _mcWaveBuf.fill(0.06); _mcWaveSmooth.fill(0.06); _mcWaveHead = 0; _mcWaveTick = 0;
    window.Android.startVoiceRecording();
    _mcVoiceShowUI();
    _mcVoiceAnimFrame = requestAnimationFrame(_mcVoiceDrawWave);
    return;
  }

  // Фоллбэк: браузерный getUserMedia
  console.log('[Voice] starting browser getUserMedia recorder');
  _mcVoiceNative = false;
  if (!navigator.mediaDevices?.getUserMedia) { toast('🎤 Микрофон недоступен'); return; }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    _mcVoiceStream = stream;
    _mcVoiceChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
    _mcVoiceRecorder = new MediaRecorder(stream, { mimeType });
    _mcVoiceRecorder.ondataavailable = ev => { if (ev.data?.size) _mcVoiceChunks.push(ev.data); };
    _mcVoiceRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      _mcVoiceStream = null;
      if (!_mcVoiceCancelled) _mcVoiceFinalize();
    };
    _mcWaveBuf.fill(0.06); _mcWaveSmooth.fill(0.06); _mcWaveHead = 0; _mcWaveTick = 0;
    _mcVoiceRecorder.start(100);
    _mcVoiceSeconds = 0;
    _mcVoiceTimer = setInterval(() => {
      _mcVoiceSeconds++;
      _mcVoiceUpdateTimer();
      if (_mcVoiceSeconds >= MC_VOICE_MAX) _mcVoiceSend();
    }, 1000);
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      _mcVoiceAnalyser = ctx.createAnalyser();
      _mcVoiceAnalyser.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(_mcVoiceAnalyser);
    } catch(_) {}
    _mcVoiceShowUI();
    _mcVoiceDrawWave();
  }).catch(() => toast('🎤 Нет доступа к микрофону'));
}

// ┄┄ Движение: swipe left = отмена (Telegram hold-to-record стиль) ┄┄┄┄┄┄┄┄┄
function mcVoiceTouchMove(e) {
  // Если двинули палец до начала записи   отменяем hold-таймер
  if (_mcVoiceHoldTimer) {
    const _vt = e.touches?.[0] || e;
    const dx = Math.abs((_vt.clientX || 0) - _mcVoiceStartX);
    if (dx > 10) { clearTimeout(_mcVoiceHoldTimer); _mcVoiceHoldTimer = null; return; }
  }
  // Работает и для нативного (Java) и для браузерного рекордера
  if (!_mcVoiceRecorder && !_mcVoiceNative) return;
  const touch = e.touches?.[0] || e;
  const dx = (touch.clientX || touch.pageX) - _mcVoiceStartX;
  // Отмена: свайп влево > 80px
  if (dx < -80) { _mcVoiceCancel(); return; }
  // Визуальная подсказка   сдвигаем UI вслед за пальцем
  const hint = document.getElementById('mc-voice-hint');
  if (hint) {
    const progress = Math.min(1, Math.abs(Math.min(0, dx)) / 80);
    hint.style.opacity = String(0.4 + progress * 0.6);
    hint.textContent   = dx < -20 ? '✅ Отпустить ↩ отмена' : 'Свайп для отмены';
  }
  const ui = document.getElementById('mc-voice-ui');
  if (ui && dx < 0) {
    const shift = Math.max(dx * 0.38, -65);
    ui.style.transform = 'translateX(' + shift + 'px)';
    ui.style.opacity   = String(Math.max(0.4, 1 + shift / 120));
  }
}

// ┄┄ Отпустить: отправить (Telegram hold-to-record) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function mcVoiceTouchEnd(e) {
  // Отменяем таймер задержки   если отпустили до начала записи
  clearTimeout(_mcVoiceHoldTimer);
  _mcVoiceHoldTimer = null;

  // Возвращаем UI на место если был сдвинут
  const ui = document.getElementById('mc-voice-ui');
  if (ui) { ui.style.transform = ''; ui.style.opacity = ''; }
  const hint = document.getElementById('mc-voice-hint');
  if (hint) { hint.style.opacity = '1'; hint.textContent = 'Свайп для отмены'; }

  // Короткий тап (< 280мс) без активной записи ↩ переключаем mic↔circle
  const tapDur = Date.now() - _mcVoiceTouchTs;
  if (!_mcVoiceRecorder && !_mcVoiceNative) {
    if (tapDur < 280) {
      console.log('[Voice] tap, toggling mode');
      mcToggleVoiceMode();
    }
    return;
  }
  // Запись активна   отправляем
  console.log('[Voice] touchEnd, sending');
  _mcVoiceSend();
}

function _mcVoiceSend() {
  if (_mcVoiceNative) {
    _mcVoiceNative = false;
    _mcVoiceHideUI();
    if (_mcCircleActive) {
      // Кружок — останавливаем через флаг в CircleRecordActivity
      if (window.Android) window.Android.stopCircleRecord();
    } else {
      if (window.Android) window.Android.stopVoiceRecording();
    }
    return;
  }
  if (!_mcVoiceRecorder) return;
  clearInterval(_mcVoiceTimer); _mcVoiceTimer = null;
  _mcVoiceRecorder.stop();
  _mcVoiceRecorder = null;
  _mcVoiceHideUI();
}

function _mcVoiceCancel() {
  if (_mcVoiceNative) {
    _mcVoiceNative = false;
    _mcVoiceHideUI();
    if (_mcCircleActive) {
      _mcCircleActive = false;
      if (window.Android) window.Android.cancelCircleRecord();
    } else {
      if (window.Android) window.Android.cancelVoiceRecording();
    }
    toast('🗑 Запись отменена');
    return;
  }
  if (!_mcVoiceRecorder) return;
  _mcVoiceCancelled = true;
  clearInterval(_mcVoiceTimer); _mcVoiceTimer = null;
  cancelAnimationFrame(_mcVoiceAnimFrame);
  _mcVoiceRecorder.stop();
  _mcVoiceRecorder = null;
  _mcVoiceHideUI();
  toast('🗑 Запись отменена');
}

// ┄┄ UI ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function _mcVoiceShowUI() {
  // Прячем поле ввода   как в Telegram
  const wrap = document.getElementById('mc-input-wrap');
  if (wrap) { wrap.style.transition = 'opacity .15s'; wrap.style.opacity = '0'; wrap.style.pointerEvents = 'none'; setTimeout(() => { if (wrap.style.opacity === '0') wrap.style.display = 'none'; }, 150); }

  let ui = document.getElementById('mc-voice-ui');
  if (ui) ui.remove();
  ui = document.createElement('div');
  ui.id = 'mc-voice-ui';
  ui.style.cssText = 'flex:1;display:flex;align-items:center;gap:8px;padding:0 6px 0 14px;min-width:0;overflow:hidden;animation:mc-voice-in .22s cubic-bezier(.34,1.1,.64,1) both';
  ui.innerHTML = `
    <div class="mc-rec-dot"></div>
    <div id="mc-voice-timer"
      style="font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:var(--text);min-width:40px;flex-shrink:0;transition:color .3s">0:00</div>
    <div style="flex:1;position:relative;overflow:hidden;height:34px;min-width:0">
      <canvas id="mc-voice-wave" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
    </div>
    <div style="display:flex;align-items:center;gap:3px;flex-shrink:0;overflow:hidden;max-width:110px;transition:transform .2s ease,opacity .15s">
      <span class="mc-swipe-hint-arrow" style="font-size:14px;color:var(--muted)">↩</span>
      <span id="mc-voice-hint" style="font-size:11px;font-weight:500;color:var(--muted);white-space:nowrap;transition:color .15s,opacity .15s">Свайп для отмены</span>
    </div>
  `;

  // Вставляем ПЕРЕД кнопкой действия   внутри mc-input-bar
  const bar = document.getElementById('mc-input-bar');
  const actionBtn = document.getElementById('mc-action-btn');
  if (bar && actionBtn) bar.insertBefore(ui, actionBtn);
  else document.body.appendChild(ui);

  const btn = document.getElementById('mc-action-btn');
  if (btn) {
    btn.classList.add('recording');
    btn.style.transform = 'scale(1.12)';
    setTimeout(() => { btn.style.transform = ''; }, 180);
  }
  requestAnimationFrame(() => {
    const canvas = document.getElementById('mc-voice-wave');
    if (canvas) { canvas.width = canvas.offsetWidth || 160; canvas.height = canvas.offsetHeight || 34; }
  });
}

function _mcVoiceHideUI() {
  cancelAnimationFrame(_mcVoiceAnimFrame);
  const ui = document.getElementById('mc-voice-ui');
  if (ui) {
    ui.style.animation = 'mc-voice-out .18s cubic-bezier(.4,0,.8,.6) forwards';
    setTimeout(() => ui.remove(), 200);
  }
  // Восстанавливаем поле ввода
  const wrap = document.getElementById('mc-input-wrap');
  if (wrap) {
    wrap.style.display = '';
    wrap.style.pointerEvents = '';
    requestAnimationFrame(() => { wrap.style.opacity = '1'; });
    setTimeout(() => { wrap.style.transition = ''; }, 200);
  }
  const btn = document.getElementById('mc-action-btn');
  if (btn) {
    btn.classList.remove('recording');
    btn.style.transform = 'scale(.88)';
    setTimeout(() => { btn.style.transform = ''; }, 150);
  }
  setTimeout(_mcInitActionBtn, 60);
}

/** Отменяет отправку голосового/кружка во время загрузки */
function mcCancelSending() {
  // Отменяем кружок если идёт
  if (_mcCircleActive) {
    _mcCircleActive = false;
    if (window.Android?.cancelCircleRecord) window.Android.cancelCircleRecord();
  }
  // Отменяем голосовое если идёт
  if (_mcVoiceRecorder || _mcVoiceNative) {
    _mcVoiceCancel();
  }
  _mcInChatSendingHide();
  toast('❌ Отправка отменена');
}


function _mcVoiceUpdateTimer() {
  const el = document.getElementById('mc-voice-timer');
  if (!el) return;
  const m = Math.floor(_mcVoiceSeconds / 60);
  const s = String(_mcVoiceSeconds % 60).padStart(2, '0');
  el.textContent = m + ':' + s;
  if (_mcVoiceSeconds >= 50) el.style.color = '#ff4444';
}

const _mcWaveBuf    = new Float32Array(50).fill(0.06);
let   _mcWaveHead   = 0;
let   _mcWaveTick   = 0;
const _mcWaveSmooth = new Float32Array(50).fill(0.06);

function _mcWavePush(val) {
  _mcWaveBuf[_mcWaveHead % 50] = val;
  _mcWaveHead++;
}

function _mcVoiceDrawWave() {
  const canvas = document.getElementById('mc-voice-wave');
  if (!canvas) return;
  const cw = canvas.offsetWidth || 200;
  const ch = canvas.offsetHeight || 36;
  if (canvas.width !== cw)  canvas.width  = cw;
  if (canvas.height !== ch) canvas.height = ch;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  _mcWaveTick++;

  if (_mcWaveTick % 2 === 0) {
    if (_mcVoiceAnalyser) {
      const buf = new Uint8Array(_mcVoiceAnalyser.frequencyBinCount);
      _mcVoiceAnalyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i]-128)/128; sum += v*v; }
      _mcWavePush(Math.min(1, Math.sqrt(sum/buf.length) * 3.5));
    } else {
      const base  = 0.10 + 0.07 * Math.sin(_mcWaveTick * 0.09);
      const spike = Math.random() < 0.18 ? Math.random() * 0.55 : 0;
      _mcWavePush(Math.min(1, base + spike));
    }
  }

  const bars  = 44;
  const bw    = 2.5;
  const gap   = 1.5;
  const total = bars * (bw + gap);
  const sx    = (W - total) / 2;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e87722';

  ctx.clearRect(0, 0, W, H);
  for (let i = 0; i < bars; i++) {
    const bufIdx = ((_mcWaveHead - bars + i) % 50 + 50) % 50;
    _mcWaveSmooth[bufIdx] = _mcWaveSmooth[bufIdx] * 0.62 + _mcWaveBuf[bufIdx] * 0.38;
    const lvl  = _mcWaveSmooth[bufIdx];
    const h    = Math.max(3, lvl * (H - 4));
    const x    = sx + i * (bw + gap);
    const y    = (H - h) / 2;
    const age  = (bars - 1 - i) / (bars - 1);
    ctx.globalAlpha = 1 - age * 0.62;
    ctx.fillStyle   = accent;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, bw, h, bw/2);
    else               ctx.rect(x, y, bw, h);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  _mcVoiceAnimFrame = requestAnimationFrame(_mcVoiceDrawWave);
}

async function _mcVoiceFinalize() {
  if (!_mcVoiceChunks.length) return;
  const mimeType = _mcVoiceChunks[0]?.type || 'audio/webm';
  const ext  = mimeType.includes('ogg') ? 'ogg' : 'webm';
  const blob = new Blob(_mcVoiceChunks, { type: mimeType });
  const dur  = _mcVoiceSeconds;
  _mcVoiceChunks = [];
  if (blob.size < 500) { toast('🎤 Слишком короткое'); return; }
  try {
    const b64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
    const fileName = 'voice_' + Date.now() + '.' + ext;
    _pendingUploadBlob = blob; _pendingUploadMime = mimeType;
    const url = await _catboxUpload(b64, fileName, mimeType);
    // Кэшируем blob   _catboxUpload мог сбросить _pendingUploadBlob через onUploadDone
    _mcSendMediaMsg({ url, fileName, fileType: 'voice', fileSize: blob.size, duration: dur,
      _blob: blob, _mime: mimeType });
    _mcHideUploadToast(true);
  } catch(err) { _mcHideUploadToast(false); toast('❌ ' + (err.message || 'Ошибка отправки')); }
}

// ┄┄ Воспроизведение голосового прямо в пузыре ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
const _mcAudios = {};

// SVG иконки play/pause   Telegram-style
function _tgSetPlayState(id, playing) {
  const ico = document.getElementById('vico_' + id);
  if (!ico) return;
  const fill = ico.getAttribute('fill') || '#fff';
  if (playing) {
    ico.innerHTML = '<rect x="4" y="2" width="3.5" height="14" rx="1"/><rect x="10.5" y="2" width="3.5" height="14" rx="1"/>';
  } else {
    ico.innerHTML = '<polygon points="5,2 16,9 5,16"/>';
  }
}

// Обновляет waveform bars по прогрессу (0..1)
function _tgWaveUpdate(id, pct) {
  const svg = document.getElementById('wv_' + id);
  if (!svg) return;
  const bars  = svg.querySelectorAll('.wvb');
  const total = bars.length;
  bars.forEach((b, i) => {
    b.setAttribute('fill', i / total < pct ? b.dataset.on : b.dataset.off);
  });
}

async function mcVoicePlay(url, id) {
  // Проверяем локальный кэш
  const _cachedVoice = await mcCacheGet(url).catch(() => null);
  if (_cachedVoice) { console.log('[VoicePlay] cache hit:', id); url = _cachedVoice; }

  // Если URL внешний   пробуем загрузить через Java (обходит SSL-блокировки без VPN)
  // catbox.moe и pixeldrain дают ERR_SSL_PROTOCOL_ERROR в WebView без VPN/прокси
  const isExternal = url.startsWith('https://files.catbox.moe') ||
                     url.startsWith('https://pixeldrain.com') ||
                     url.startsWith('http://');
  if (isExternal && !url.startsWith('blob:') && window.Android &&
      typeof Android.nativeDownloadBase64 === 'function') {
    try {
      const btn = document.getElementById('vbtn_' + id);
      if (btn) btn.style.opacity = '0.5';
      const raw = await new Promise((res) => {
        // nativeDownloadBase64 блокирующий   запускаем в setTimeout чтобы не фризить UI
        setTimeout(() => res(Android.nativeDownloadBase64(url)), 0);
      });
      if (btn) btn.style.opacity = '';
      const parsed = JSON.parse(raw);
      if (parsed.ok && parsed.base64) {
        // Определяем mime по расширению
        const ext = url.split('.').pop().toLowerCase().split('?')[0];
        const mimeMap = { m4a:'audio/mp4', mp3:'audio/mpeg', ogg:'audio/ogg',
                          aac:'audio/aac', opus:'audio/ogg', wav:'audio/wav' };
        const mime = mimeMap[ext] || 'audio/mp4';
        const bin = atob(parsed.base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: mime });
        url = URL.createObjectURL(blob);
        // Кэшируем для будущих воспроизведений
        mcCacheSave(url.replace('blob:','__blob:'), blob, mime).catch(() => {});
        console.log('[VoicePlay] Java download OK, blobUrl created, size=', blob.size);
      } else {
        console.warn('[VoicePlay] Java download failed:', parsed.error, '  пробуем WebView напрямую');
      }
    } catch(e) {
      console.warn('[VoicePlay] Java download exception:', e, '  пробуем WebView напрямую');
      const btn = document.getElementById('vbtn_' + id);
      if (btn) btn.style.opacity = '';
    }
  }

  const time = document.getElementById('vtime_' + id);
  if (_mcAudios[id]) {
    const a = _mcAudios[id];
    if (!a.paused) { a.pause(); _tgSetPlayState(id, false); return; }
    a.play(); _tgSetPlayState(id, true); return;
  }
  // Останавливаем всё прочее
  Object.entries(_mcAudios).forEach(([oid, a]) => {
    a.pause(); _tgSetPlayState(oid, false); _tgWaveUpdate(oid, 0);
  });
  const audio = new Audio(url);
  _mcAudios[id] = audio;
  audio.ontimeupdate = () => {
    if (!audio.duration) return;
    const pct = audio.currentTime / audio.duration;
    _tgWaveUpdate(id, pct);
    const prog = document.getElementById('vprog_' + id);
    if (prog) prog.style.width = (pct * 100) + '%';
    const left = Math.ceil(audio.duration - audio.currentTime);
    const m = Math.floor(left / 60), s = String(left % 60).padStart(2, '0');
    if (time) time.textContent = m + ':' + s;
  };
  audio.onended = () => {
    _tgSetPlayState(id, false);
    _tgWaveUpdate(id, 0);
    const prog = document.getElementById('vprog_' + id);
    if (prog) prog.style.width = '0%';
    if (time && audio.duration) {
      const tot = Math.round(audio.duration);
      time.textContent = Math.floor(tot/60) + ':' + String(tot%60).padStart(2,'0');
    }
    delete _mcAudios[id];
  };
  audio.play()
    .then(() => _tgSetPlayState(id, true))
    .catch(() => { toast('❌ Не удалось воспроизвести'); delete _mcAudios[id]; });
}

function mcVoiceSeek(e, url, id, svgEl) {
  const a = _mcAudios[id];
  if (!a || !a.duration) return;
  const el   = svgEl || e.currentTarget;
  const rect = el.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  a.currentTime = pct * a.duration;
}


function _isAudioFile(name) {
  if (!name) return false;
  const ext = (name.split('.').pop() || '').toLowerCase();
  return ['mp3','ogg','wav','flac','aac','m4a','opus','wma','ape'].includes(ext);
}

function _gdFileEmoji(name) {
  if (!name) return '📄';
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map = { pdf:'📕', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', ppt:'📊', pptx:'📊',
    zip:'🗜', rar:'🗜', '7z':'🗜', txt:'📃', mp3:'🎵', ogg:'🎵', wav:'🎵',
    mp4:'🎬', mov:'🎬', avi:'🎬', mkv:'🎬', png:'🖼', jpg:'🖼', jpeg:'🖼', gif:'🖼',
    apk:'📦', exe:'⚙️', js:'💻', py:'💻', html:'💻', json:'💻' };
  return map[ext] || '📄';
}

function mcSendImage(dataUrl) {
  const p = profileLoad();
  if (!p || !_msgCurrentChat) return;
  const ts = Date.now();
  const replyTo = _mcReplyTo ? { from: _mcReplyTo.from, text: _mcReplyTo.text } : null;
  const msg = { from: p.username, to: _msgCurrentChat, text: '', image: dataUrl, ts, delivered: false, read: false, replyTo };
  mcCancelReply();
  const msgs = msgLoad();
  if (!msgs[_msgCurrentChat]) msgs[_msgCurrentChat] = [];
  msgs[_msgCurrentChat].push(msg);
  msgSave(msgs);
  const chats = chatsLoad();
  if (!chats.includes(_msgCurrentChat)) { chats.unshift(_msgCurrentChat); chatsSave(chats); }
  messengerRenderMessages(true);
  SFX.play('msgSend');
  // Send button bounce
  const _sb2 = document.getElementById('mc-action-btn');
  if (_sb2) { _sb2.classList.remove('mc-send-bounce'); void _sb2.offsetWidth; _sb2.classList.add('mc-send-bounce'); setTimeout(()=>_sb2.classList.remove('mc-send-bounce'),300); }
  setTimeout(() => { const body = document.getElementById('mc-messages'); if (body) body.scrollTop = body.scrollHeight; }, 80);
  sbPollChat(p.username, _msgCurrentChat);
  _mcShowUploadToast('image', 'Фото');
  const chatKey = sbChatKey(p.username, _msgCurrentChat);
  const _imgData = {
    chat_key: chatKey, from_user: p.username,
    to_user: _msgCurrentChat, text: '📷 Фото', ts,
    extra: JSON.stringify({ image: dataUrl, ...(replyTo ? { replyTo } : {}) })
  };
  const _imgItem = { id: 'img_' + ts, type: 'message', localChat: _msgCurrentChat, ts, data: _imgData };
  sbInsert('messages', _imgData).then(res => {
    if (res) {
      msg.delivered = true; msg.pending = false;
      msgSave(msgs); messengerRenderMessages();
      _mcHideUploadToast(true); _outboxUpdateStatusBar();
    } else {
      msg.pending = true; msgSave(msgs);
      outboxPush(_imgItem);
      messengerRenderMessages(); _mcHideUploadToast(false); _outboxUpdateStatusBar();
    }
  }).catch(() => {
    msg.pending = true; msgSave(msgs);
    outboxPush(_imgItem);
    messengerRenderMessages(); _mcHideUploadToast(false); _outboxUpdateStatusBar();
  });
}

// ┄┄ Хедер чата: компенсируем системный сдвиг окна при клавиатуре ┄┄
// Android сам поднимает WebView вверх   offsetTop показывает на сколько.
// Мы двигаем хедер вниз на то же значение чтобы он остался на экране.
(function() {
  function _syncHdr() {
    const hdr = document.querySelector('#s-messenger-chat .hdr');
    if (!hdr) return;
    const offset = window.visualViewport ? Math.round(window.visualViewport.offsetTop) : 0;
    hdr.style.transform = offset > 0 ? `translateY(${offset}px)` : '';
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('scroll', _syncHdr, { passive: true });
    window.visualViewport.addEventListener('resize', _syncHdr, { passive: true });
  }
  // Сброс при уходе из чата
  document.addEventListener('focusout', (e) => {
    if (e.target?.id === 'mc-input') {
      setTimeout(_syncHdr, 50);
    }
  }, { passive: true });
})();

// ┄┄ Доп функции ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function messengerShowMore() {
  const username = _msgCurrentChat;
  if (!username) return;

  // Если это групповой чат   открываем настройки группы
  if (username === PUBLIC_GROUP_ID || username.startsWith('grp_')) {
    showGroupSettings(username);
    return;
  }

  const existing = document.getElementById('msg-action-sheet');
  if (existing) { _closeSheet(existing); return; }

  const peer = _profileOnlinePeers.find(u => u.username === username)
             || _allKnownUsers.find(u => u.username === username);
  const peerName = localNickGet(username) || peer?.name || username;

  const sheet = document.createElement('div');
  sheet.id = 'msg-action-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:8888;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.5);animation:mcFadeIn .15s ease';
  sheet.innerHTML = `
    <div id="msg-action-inner" style="background:var(--surface);border-radius:20px 20px 0 0;padding:8px 0 calc(16px + var(--safe-bot));overflow:hidden;animation:mcSlideUp .26s cubic-bezier(.34,1.1,.64,1)">
      <div style="width:40px;height:4px;border-radius:2px;background:var(--surface3);margin:8px auto 16px"></div>
      <button onclick="peerProfileOpen('${username}');_closeSheet(document.getElementById('msg-action-sheet'))"
        style="width:100%;padding:16px 20px;background:none;border:none;color:var(--text);font-family:inherit;font-size:15px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:14px">
        <span style="font-size:22px">👤</span> Профиль пользователя
      </button>
      <div style="height:1px;background:rgba(255,255,255,.06);margin:0 20px"></div>
      <button onclick="_closeSheet(document.getElementById('msg-action-sheet'));localNickEdit('${username}','${escHtml(peer?.name||username)}')"
        style="width:100%;padding:16px 20px;background:none;border:none;color:var(--text);font-family:inherit;font-size:15px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:14px">
        <span style="font-size:22px">✏️</span> Изменить имя${localNickGet(username) ? ' <span style="font-size:11px;color:var(--accent);margin-left:4px">изменено</span>' : ''}
      </button>
      <div style="height:1px;background:rgba(255,255,255,.06);margin:0 20px"></div>
      <button onclick="peerMuteShow('${username}');_closeSheet(document.getElementById('msg-action-sheet'))"
        style="width:100%;padding:16px 20px;background:none;border:none;color:var(--text);font-family:inherit;font-size:15px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:14px">
        <span style="font-size:22px">${isMuted(username)?'🔔':'🔕'}</span> ${isMuted(username)?'Включить уведомления':'Отключить уведомления'}
      </button>
      <div style="height:1px;background:rgba(255,255,255,.06);margin:0 20px"></div>
      <button onclick="messengerClearChat('${username}');_closeSheet(document.getElementById('msg-action-sheet'))"
        style="width:100%;padding:16px 20px;background:none;border:none;color:var(--danger,#c94f4f);font-family:inherit;font-size:15px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:14px">
        <span style="font-size:22px">🗑</span> Удалить чат
      </button>
    </div>`;
  sheet.addEventListener('click', (e) => { if (e.target === sheet) _closeSheet(sheet); });
  document.body.appendChild(sheet);
}

function messengerClearChat(username) {
  if (!confirm('Удалить чат с @' + username + '?')) return;
  const msgs = msgLoad();
  delete msgs[username];
  msgSave(msgs);
  const chats = chatsLoad().filter(u => u !== username);
  chatsSave(chats);
  showScreen('s-messenger', 'back');
  messengerRenderList();
  toast('🗑 Чат удалён');
}

function messengerShowInfo() {
  const username = _msgCurrentChat;
  if (!username) return;
  if (username === PUBLIC_GROUP_ID || username.startsWith('grp_')) {
    showGroupSettings(username);
    return;
  }
  peerProfileOpen(username);
}

// ┄┄ Открытие профиля другого пользователя ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function peerProfileOpen(username) {
  const peer = _profileOnlinePeers.find(u => u.username === username)
             || _allKnownUsers.find(u => u.username === username);
  const body = document.getElementById('peer-profile-body');

  // Настраиваем шапку: прозрачная,   слева и ◆ справа
  const hdr = document.querySelector('#s-peer-profile .hdr');
  if (hdr) {
    hdr.style.cssText = 'position:absolute;top:0;left:0;right:0;z-index:10;background:transparent;border:none;box-shadow:none';
    hdr.innerHTML = `
      <button class="hdr-back" style="background:rgba(0,0,0,.35);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-size:22px;padding:0;color:#fff"
        onclick="SFX.play('screenBack');showScreen('s-messenger-chat','back')">‹</button>
      <div style="flex:1"></div>
      <button onclick="peerShowMenu('${username}')"
        style="background:rgba(0,0,0,.35);border:none;border-radius:50%;width:36px;height:36px;
          display:flex;align-items:center;justify-content:center;cursor:pointer;
          font-size:18px;color:#fff;backdrop-filter:blur(4px)">◆</button>`;
  }

  if (!peer) {
    if (body) body.innerHTML = `
      <div style="padding-top:80px;text-align:center">
        <div style="font-size:72px;margin-bottom:16px">😶</div>
        <div style="font-size:17px;font-weight:700;margin-bottom:6px">@${escHtml(username)}</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:24px">Пользователь не найден</div>
        <button class="btn btn-accent" style="max-width:240px"
          onclick="messengerOpenChatFrom('${username}');showScreen('s-messenger-chat')">💬 Написать</button>
      </div>`;
    showScreen('s-peer-profile');
    return;
  }

  const statusObj = PROFILE_STATUSES?.find(s => s.id === peer.status) || { emoji:'🟢', label:'В сети', color:'#4caf7d' };
  const isOnline  = !!_profileOnlinePeers.find(u => u.username === username);
  const isFriend  = friendsLoad().includes(username);
  const blocked   = isBlocked(username);
  const noCopy    = isCopyBlocked(username);

  // Баннер/фон   тот же подход что и у своего профиля
  const hasPhoto  = peer.avatarType === 'photo' && peer.avatarData;
  const peerBannerStyle = peer.banner
    ? (peer.banner.startsWith('background:') ? peer.banner : `background:${peer.banner}`)
    : `background:linear-gradient(135deg,${peer.color||'var(--accent)'}66,${peer.color||'var(--accent)'}22)`;
  const peerAvatarHtml = hasPhoto
    ? `<img src="${peer.avatarData}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span style="font-size:46px;line-height:1">${peer.avatar||'😊'}</span>`;

  if (body) body.innerHTML = `
    <!-- Баннер + аватар (тот же стиль что и собственный профиль) -->
    <div style="position:relative;margin:0 0 0">
      <div style="${peerBannerStyle};height:140px;width:100%;background-size:cover;background-position:center"></div>
      <div style="position:absolute;bottom:-50px;left:50%;transform:translateX(-50%)">
        <div style="position:relative;display:inline-block">
          <div style="width:96px;height:96px;border-radius:50%;border:3px solid ${peer.color||'var(--accent)'};background:var(--surface2);display:flex;align-items:center;justify-content:center;overflow:hidden">
            ${peerAvatarHtml}
          </div>
          ${peer.vip ? `<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);font-size:22px;line-height:1;filter:drop-shadow(0 1px 4px rgba(0,0,0,.8))">${_emojiImg("👑",22)}</div>` : ''}
        </div>
      </div>
    </div>
    <div style="height:60px"></div>

    <!-- Имя, статус, bio   центрировано как в своём профиле -->
    <div style="text-align:center;padding:0 16px 16px">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:24px;font-weight:800;color:var(--text)">${escHtml(peer.name||username)}</span>
        ${peer.vip ? `<span class="vip-badge-pill">${_emojiImg('👑',10)} VIP</span>` : ''}
      </div>
      <div style="font-size:14px;color:var(--muted);margin-top:3px">@${escHtml(username)}</div>
      <div style="display:inline-flex;align-items:center;gap:5px;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;margin-top:8px;background:${isOnline?'#4caf7d22':'rgba(255,255,255,.08)'};color:${isOnline?'#4caf7d':'var(--muted)'}">
        ${isOnline ? '🟢 В сети' : '⚡ Не в сети'}
      </div>
      ${peer.bio ? `<div style="font-size:13px;color:var(--muted);margin-top:8px;line-height:1.5">${escHtml(peer.bio)}</div>` : ''}
    </div>

    <!-- Кнопки действий   такие же как в своём профиле -->
    <div style="background:var(--surface2);border-radius:16px;margin-bottom:10px;overflow:hidden;border:1.5px solid var(--surface3)">
      <button onclick="messengerOpenChatFrom('${username}');showScreen('s-messenger-chat')"
        style="width:100%;padding:14px 16px;background:none;border:none;border-bottom:1px solid var(--surface3);cursor:pointer;display:flex;align-items:center;gap:12px;color:var(--text);font-family:inherit;-webkit-tap-highlight-color:transparent">
        <span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg></span>
        <div style="font-size:14px;font-weight:700">Написать</div>
      </button>
      <button onclick="peerMuteShow('${username}')"
        style="width:100%;padding:14px 16px;background:none;border:none;border-bottom:1px solid var(--surface3);cursor:pointer;display:flex;align-items:center;gap:12px;color:var(--text);font-family:inherit;-webkit-tap-highlight-color:transparent">
        ${isMuted(username)?'<span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 18.69L7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42v5l-2 2v1h13.73l2 2L21 19.72l-1-1.03zM12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-7.32V11c0-3.08-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.15.03-.29.08-.42.12l5.92 5.92V14.68z"/></svg></span>':'<span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg></span>'}
        <div style="font-size:14px;font-weight:700">${isMuted(username)?'Включить уведомления':'Отключить уведомления'}</div>
      </button>
      <button onclick="${isFriend ? `profileRemoveFriend('${username}')` : `profileAddFriend('${username}')`}"
        style="width:100%;padding:14px 16px;background:none;border:none;border-bottom:1px solid var(--surface3);cursor:pointer;display:flex;align-items:center;gap:12px;color:${isFriend?'var(--danger,#e05555)':'var(--text)'};font-family:inherit;-webkit-tap-highlight-color:transparent">
        ${isFriend?'<span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14 8c0-2.21-1.79-4-4-4S6 5.79 6 8s1.79 4 4 4 4-1.79 4-4zm3 2v2h6v-2h-6zM2 18v2h16v-2c0-2.66-5.33-4-8-4s-8 1.34-8 4z"/></svg></span>':'<span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></span>'}
        <div style="font-size:14px;font-weight:700">${isFriend?'Удалить из друзей':'Добавить в друзья'}</div>
      </button>
      <button onclick="peerSendGift('${username}')"
        style="width:100%;padding:14px 16px;background:none;border:none;${blocked?'border-bottom:1px solid var(--surface3);':''}cursor:pointer;display:flex;align-items:center;gap:12px;color:var(--text);font-family:inherit;-webkit-tap-highlight-color:transparent">
        <span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.07-.23.18-.47.18-.73C18 3.91 16.9 3 15.67 3c-.87 0-1.52.4-1.98 1.05L12 6.6l-1.69-2.55C9.85 3.4 9.2 3 8.33 3 7.1 3 6 3.91 6 5.27c0 .26.11.5.18.73H4c-1.1 0-2 .9-2 2v2c0 .55.45 1 1 1h18c.55 0 1-.45 1-1V8c0-1.1-.9-2-2-2zm-12.83 0c-.37 0-.67-.3-.67-.67 0-.37.3-.67.67-.67h.13l1.28 1.34H7.17zm5.35 0l1.28-1.34h.13c.37 0 .67.3.67.67 0 .37-.3.67-.67.67h-1.41zM4 11v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8H4zm6 7H7v-5h3v5zm7 0h-3v-5h3v5z"/></svg></span>
        <div style="font-size:14px;font-weight:700">Отправить подарок</div>
      </button>
      ${blocked ? `<button onclick="peerBlockToggle('${username}')"
        style="width:100%;padding:14px 16px;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:12px;color:var(--danger,#e05555);font-family:inherit;-webkit-tap-highlight-color:transparent">
        <span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1C9.24 1 7 3.24 7 6v2H3c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2h-1V6c0-2.76-2.24-5-5-5zm0 2c1.65 0 3 1.35 3 3v2H9V6c0-1.65 1.35-3 3-3zm0 9c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/></svg></span>
        <div style="font-size:14px;font-weight:700">Разблокировать</div>
      </button>` : ''}
    </div>

    <!-- Информация -->
    <div style="background:var(--surface2);border-radius:16px;margin-bottom:10px;overflow:hidden;border:1.5px solid var(--surface3)">
      <div style="padding:14px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--surface3)">
        <span style="font-size:20px;color:var(--accent);width:28px;text-align:center">@</span>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700">@${escHtml(username)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">Имя пользователя</div>
        </div>
      </div>
      <div style="padding:14px 16px;display:flex;align-items:flex-start;gap:12px">
        <span style="font-size:20px;color:var(--muted);width:28px;text-align:center">📝</span>
        <div style="flex:1">
          <div style="font-size:14px;color:${peer.bio?'var(--text)':'var(--muted)'};white-space:pre-wrap;line-height:1.5">${peer.bio?escHtml(peer.bio):'Не указано'}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">О себе</div>
        </div>
      </div>
    </div>

    ${noCopy ? `<div style="margin-bottom:8px;padding:10px 14px;background:rgba(224,85,85,.12);border-radius:12px;border:1px solid rgba(224,85,85,.3);font-size:12px;color:#e05555">🔒 Копирование сообщений запрещено</div>` : ''}
    <div style="height:24px"></div>
  `;

  showScreen('s-peer-profile');
}


// ══════════════════════════════════════════════════════════════════
// 📷 МЕДИАПРОСМОТРЩИК   Telegram-стиль
// Фото: pinch-zoom, двойной тап, свайп вниз = закрыть
// Видео: нативный плеер, свайп вниз = закрыть
// ══════════════════════════════════════════════════════════════════
(function() {

  // ┄┄ Состояние ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  const _pz = {
    scale:1, px:0, py:0,
    startDist:0, startScale:1,
    startX:0, startY:0,
    panStartX:0, panStartY:0,
    lastTap:0, tapX:0, tapY:0,
    swipeStartY:0, swipeDy:0, swipeActive:false,
    reset() { this.scale=1; this.px=0; this.py=0; this.swipeDy=0; this.swipeActive=false; this._apply(); },
    _apply() {
      const img = document.getElementById('photo-zoom-img');
      const ov  = document.getElementById('photo-zoom-overlay');
      if (!img) return;
      img.style.transform = `translate(${this.px}px,${this.py}px) scale(${this.scale})`;
      if (ov) ov.style.opacity = this.swipeActive ? Math.max(0.3, 1 - Math.abs(this.swipeDy)/300) : '';
    }
  };

  function _dist(t) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  }

  function photoZoomOpen(src, title) {
    const ov  = document.getElementById('photo-zoom-overlay');
    const img = document.getElementById('photo-zoom-img');
    if (!ov || !img) return;
    img.src = src;
    // Хедер
    const t = document.getElementById('pz-title');
    if (t) t.textContent = title || 'Фото';
    const dl = document.getElementById('pz-download');
    if (dl) { dl.href = src; dl.download = title || 'photo.jpg'; }
    ov.style.opacity = '';
    ov.classList.add('show');
    _pz.reset();
  }
  window.photoZoomOpen = photoZoomOpen;

  function photoZoomClose() {
    const ov = document.getElementById('photo-zoom-overlay');
    if (!ov) return;
    ov.style.transition = 'opacity .2s';
    ov.style.opacity = '0';
    setTimeout(() => { ov.classList.remove('show'); ov.style.transition = ''; ov.style.opacity = ''; _pz.reset(); }, 200);
  }
  window.photoZoomClose = photoZoomClose;

  // ┄┄ Touch события ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  document.addEventListener('DOMContentLoaded', () => {
    const ov = document.getElementById('photo-zoom-overlay');
    if (!ov) return;

    ov.addEventListener('touchstart', e => {
      if (!ov.classList.contains('show')) return;
      if (e.touches.length === 2) {
        e.preventDefault();
        _pz.startDist  = _dist(e.touches);
        _pz.startScale = _pz.scale;
        _pz.swipeActive = false;
      } else if (e.touches.length === 1) {
        const t   = e.touches[0];
        const now = Date.now();
        _pz.swipeStartY = t.clientY;
        _pz.swipeDy     = 0;
        _pz.panStartX   = t.clientX - _pz.px;
        _pz.panStartY   = t.clientY - _pz.py;
        // Двойной тап   zoom in/out
        if (now - _pz.lastTap < 280) {
          e.preventDefault();
          if (_pz.scale > 1.2) {
            _pz.scale = 1; _pz.px = 0; _pz.py = 0;
          } else {
            _pz.scale = 2.5;
            // Зум к точке касания
            const area = document.getElementById('pz-area');
            if (area) {
              const r = area.getBoundingClientRect();
              _pz.px = (r.width/2  - t.clientX) * (_pz.scale - 1);
              _pz.py = (r.height/2 - t.clientY) * (_pz.scale - 1);
            }
          }
          _pz._apply();
        }
        _pz.lastTap = now;
      }
    }, { passive: false });

    ov.addEventListener('touchmove', e => {
      if (!ov.classList.contains('show')) return;
      e.preventDefault();
      if (e.touches.length === 2) {
        // Pinch zoom
        const d = _dist(e.touches);
        _pz.scale = Math.min(6, Math.max(0.8, _pz.startScale * d / _pz.startDist));
        _pz._apply();
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        if (_pz.scale > 1.05) {
          // Pan
          _pz.px = t.clientX - _pz.panStartX;
          _pz.py = t.clientY - _pz.panStartY;
          _pz._apply();
        } else {
          // Свайп вниз = закрыть
          _pz.swipeDy = t.clientY - _pz.swipeStartY;
          _pz.swipeActive = _pz.swipeDy > 10;
          if (_pz.swipeActive) {
            _pz.py = _pz.swipeDy;
            _pz._apply();
          }
        }
      }
    }, { passive: false });

    ov.addEventListener('touchend', e => {
      if (!ov.classList.contains('show')) return;
      if (_pz.swipeActive && _pz.swipeDy > 100) {
        photoZoomClose(); return;
      }
      _pz.swipeActive = false; _pz.swipeDy = 0;
      if (_pz.scale < 1.05) { _pz.scale=1; _pz.px=0; _pz.py=0; }
      _pz._apply();
    }, { passive: true });
  });

})();

// ┄┄ Inline-плеер кружков (как в Telegram   воспроизводится прямо в чате) ┄┄
const _circleState = {}; // cid ↩ { video, playing, circumference }

// Размер кружка в покое (px, density-aware)
function _circleIdleSize() {
  return Math.round(160 * (window.devicePixelRatio > 2 ? 1.2 : 1));
}

/**
 * mcCircleToggle — запуск/пауза кружка
 * @param {string}  cid     id кружка
 * @param {string}  url     URL видео
 * @param {boolean} muted   true = беззвучный автоплей (IntersectionObserver),
 *                          false = полное воспроизведение со звуком (тап)
 */
function mcCircleToggle(cid, url, muted) {
  const wrap = document.getElementById('cw_' + cid);
  if (!wrap) return;

  const fullPlay = (muted === false); // явный тап = полное воспроизведение

  let state = _circleState[cid];

  // Если уже играет в muted-режиме, тап переключает в полный режим
  if (state && state.muted && fullPlay) {
    state.video.muted = false;
    state.muted = false;
    // Расширяем до 280px
    wrap.style.width = '280px';
    wrap.style.height = '280px';
    if (!state.playing) {
      state.video.play().then(() => { state.playing = true; }).catch(() => {});
    }
    return;
  }

  // Если уже играет в полном режиме — pause/resume
  if (state && !state.muted) {
    if (state.playing) {
      state.video.pause();
      state.playing = false;
    } else {
      state.video.play().then(() => { state.playing = true; }).catch(() => {});
    }
    return;
  }

  if (!state) {
    const vid = document.createElement('video');
    vid.src = url;
    vid.playsInline = true;
    vid.setAttribute('playsinline', '');
    vid.preload = 'auto';
    vid.loop = false;
    vid.muted = !!muted; // muted только при автоплее

    vid.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';

    const circumference = 2 * Math.PI * 96;
    state = { video: vid, playing: false, circumference, muted: !!muted };
    _circleState[cid] = state;

    const vidWrap = document.getElementById('cvid_' + cid);
    if (vidWrap) { vidWrap.style.display = 'block'; vidWrap.appendChild(vid); }

    const poster = document.getElementById('cposter_' + cid);
    if (poster) poster.style.display = 'none';

    const ring = document.getElementById('cring_' + cid);

    if (fullPlay) {
      // Тап — расширяем и показываем кольцо
      if (ring) ring.style.display = 'block';
      wrap.style.width = '280px';
      wrap.style.height = '280px';
    }
    // При muted-автоплее размер не меняем, кольцо не показываем

    vid.addEventListener('timeupdate', () => {
      if (!vid.duration || state.muted) return;
      const pct = vid.currentTime / vid.duration;
      const ringProg = document.getElementById('cringp_' + cid);
      if (ringProg) {
        ringProg.style.strokeDashoffset = (circumference * (1 - pct)).toFixed(1);
      }
      const timeEl = document.getElementById('ctime_' + cid);
      if (timeEl) {
        const rem = Math.max(0, Math.floor(vid.duration - vid.currentTime));
        const m = Math.floor(rem/60), s = String(rem%60).padStart(2,'0');
        timeEl.textContent = m + ':' + s;
      }
    });

    vid.addEventListener('ended', () => {
      state.playing = false;
      const sz = _circleIdleSize();
      wrap.style.width = sz + 'px';
      wrap.style.height = sz + 'px';
      if (poster) poster.style.display = '';
      if (ring) ring.style.display = 'none';
      vidWrap.style.display = 'none';
      delete _circleState[cid];
    });

    vid.play().then(() => {
      state.playing = true;
    }).catch(() => {});
  }
}

function _circleSetIcon(cid, playing) {
  // Кнопка play/pause убрана визуально — функция оставлена для совместимости
}

// ┄┄ Фуллскрин видеоплеер с Telegram-стилем ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
async function mcVideoOpen(url, name) {
  console.log('[VideoPlayer] opening:', name, url?.substring(0,60));
  // Останавливаем предыдущий плеер
  const prev = document.getElementById('mc-video-overlay');
  if (prev) {
    prev.querySelector('video')?.pause();
    prev.remove();
  }
  // Пробуем взять из локального кэша (быстрее + работает оффлайн)
  const cachedUrl = await mcCacheGet(url).catch(() => null);
  if (cachedUrl) {
    console.log('[VideoPlayer] using cached blob URL');
    url = cachedUrl;
  }

  const ov  = document.createElement('div');
  ov.id     = 'mc-video-overlay';
  ov.style.cssText = [
    'position:fixed;inset:0;z-index:9999;background:#000;',
    'display:flex;flex-direction:column;',
    'touch-action:none;user-select:none;-webkit-user-select:none;',
    'animation:mcFadeIn .18s ease;'
  ].join('');

  const safeUrl  = escHtml(url);
  const safeName = escHtml(name || 'Видео');

  ov.innerHTML = `
    <!-- HEADER -->
    <div id="mvp-header" style="
      position:absolute;top:0;left:0;right:0;z-index:3;
      padding:calc(var(--safe-top,0px) + 10px) 14px 18px;
      background:linear-gradient(to bottom,rgba(0,0,0,.82) 0%,transparent 100%);
      display:flex;align-items:center;gap:10px;
      transition:opacity .3s;
      pointer-events:all;">
      <button id="mvp-close"
        style="background:rgba(255,255,255,.12);backdrop-filter:blur(8px);border:none;color:#fff;
          width:36px;height:36px;border-radius:50%;cursor:pointer;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
          -webkit-tap-highlight-color:transparent">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
      <div style="flex:1;font-size:14px;font-weight:600;color:#fff;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${safeName}</div>
      <a href="${safeUrl}" download="${safeName}" target="_blank"
        style="background:rgba(255,255,255,.12);backdrop-filter:blur(8px);color:#fff;
          width:36px;height:36px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;text-decoration:none;flex-shrink:0;
          -webkit-tap-highlight-color:transparent">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zm-14 9v2h14v-2H5z"/>
        </svg>
      </a>
    </div>

    <!-- VIDEO -->
    <div id="mvp-area" style="flex:1;display:flex;align-items:center;justify-content:center;position:relative">
      <video id="mvp-video" src="${safeUrl}" playsinline preload="metadata"
        style="max-width:100%;max-height:100%;outline:none;background:#000;display:block;"></video>

      <!-- Center play/pause overlay (shows briefly on tap) -->
      <div id="mvp-center-btn" style="
        position:absolute;width:64px;height:64px;border-radius:50%;
        background:rgba(0,0,0,.55);backdrop-filter:blur(4px);
        display:flex;align-items:center;justify-content:center;
        pointer-events:none;opacity:0;transition:opacity .18s;z-index:2">
        <svg id="mvp-center-ico" width="28" height="28" viewBox="0 0 24 24" fill="#fff">
          <polygon points="6,3 20,12 6,21"/>
        </svg>
      </div>

      <!-- Loading spinner -->
      <div id="mvp-spinner" style="
        position:absolute;width:44px;height:44px;
        border:3px solid rgba(255,255,255,.2);
        border-top-color:#fff;border-radius:50%;
        animation:mvpSpin .8s linear infinite;pointer-events:none;opacity:0;transition:opacity .2s">
      </div>
    </div>

    <!-- CONTROLS -->
    <div id="mvp-controls" style="
      position:absolute;bottom:0;left:0;right:0;z-index:3;
      padding:14px 14px calc(var(--safe-bot,0px) + 14px);
      background:linear-gradient(to top,rgba(0,0,0,.85) 0%,transparent 100%);
      transition:opacity .3s;
      display:flex;flex-direction:column;gap:10px;">

      <!-- Progress bar -->
      <div id="mvp-prog-wrap" style="
        position:relative;height:20px;cursor:pointer;
        display:flex;align-items:center;">
        <div style="position:absolute;left:0;right:0;height:3px;background:rgba(255,255,255,.28);border-radius:3px;overflow:hidden">
          <div id="mvp-buf"   style="height:100%;width:0%;background:rgba(255,255,255,.35);border-radius:3px;pointer-events:none"></div>
          <div id="mvp-prog"  style="height:100%;width:0%;background:#fff;border-radius:3px;pointer-events:none;margin-top:-100%;transition:width .1s linear"></div>
        </div>
        <!-- Thumb -->
        <div id="mvp-thumb" style="
          position:absolute;left:0;width:14px;height:14px;border-radius:50%;
          background:#fff;margin-left:-7px;box-shadow:0 1px 4px rgba(0,0,0,.5);
          transition:left .1s linear;pointer-events:none"></div>
      </div>

      <!-- Bottom row: play | time | spacer | fullscreen -->
      <div style="display:flex;align-items:center;gap:14px">
        <button id="mvp-play-btn"
          style="background:none;border:none;color:#fff;cursor:pointer;
            width:36px;height:36px;display:flex;align-items:center;justify-content:center;
            -webkit-tap-highlight-color:transparent;flex-shrink:0">
          <svg id="mvp-play-ico" width="22" height="22" viewBox="0 0 24 24" fill="#fff">
            <polygon points="6,3 20,12 6,21"/>
          </svg>
        </button>

        <div style="display:flex;gap:4px;align-items:center;font-size:12px;font-family:'JetBrains Mono',monospace;color:rgba(255,255,255,.85);flex-shrink:0">
          <span id="mvp-cur">0:00</span>
          <span style="opacity:.5">/</span>
          <span id="mvp-dur">0:00</span>
        </div>

        <div style="flex:1"></div>

        <!-- Speed button -->
        <button id="mvp-speed-btn"
          style="background:rgba(255,255,255,.12);border:none;color:#fff;cursor:pointer;
            height:28px;padding:0 8px;border-radius:6px;font-size:12px;font-weight:700;
            font-family:inherit;-webkit-tap-highlight-color:transparent">1×</button>

        <!-- Fullscreen -->
        <button id="mvp-fs-btn"
          style="background:none;border:none;color:#fff;cursor:pointer;
            width:34px;height:34px;display:flex;align-items:center;justify-content:center;
            -webkit-tap-highlight-color:transparent;flex-shrink:0">
          <svg id="mvp-fs-ico" width="20" height="20" viewBox="0 0 24 24" fill="#fff">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          </svg>
        </button>
      </div>
    </div>

    <style id="mvp-style">
      @keyframes mvpSpin { to { transform:rotate(360deg); } }
    </style>
  `;

  document.body.appendChild(ov);

  // ┄┄ Refs ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  const video      = ov.querySelector('#mvp-video');
  const header     = ov.querySelector('#mvp-header');
  const controls   = ov.querySelector('#mvp-controls');
  const playBtn    = ov.querySelector('#mvp-play-btn');
  const playIco    = ov.querySelector('#mvp-play-ico');
  const progWrap   = ov.querySelector('#mvp-prog-wrap');
  const progBar    = ov.querySelector('#mvp-prog');
  const bufBar     = ov.querySelector('#mvp-buf');
  const thumb      = ov.querySelector('#mvp-thumb');
  const curEl      = ov.querySelector('#mvp-cur');
  const durEl      = ov.querySelector('#mvp-dur');
  const centerBtn  = ov.querySelector('#mvp-center-btn');
  const centerIco  = ov.querySelector('#mvp-center-ico');
  const spinner    = ov.querySelector('#mvp-spinner');
  const speedBtn   = ov.querySelector('#mvp-speed-btn');
  const fsBtn      = ov.querySelector('#mvp-fs-btn');
  const fsIco      = ov.querySelector('#mvp-fs-ico');
  const closeBtn   = ov.querySelector('#mvp-close');

  // ┄┄ State ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  let _controlsVisible = true;
  let _controlsTimer   = null;
  let _fullscreen      = false;
  const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
  let _speedIdx = 1;
  let _seeking  = false;
  let _seekStartX = 0;

  const _fmtT = s => {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s/60), sec = String(Math.floor(s%60)).padStart(2,'0');
    return m + ':' + sec;
  };

  // SVG icons
  const ICO_PLAY  = '<polygon points="6,3 20,12 6,21"/>';
  const ICO_PAUSE = '<rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/>';
  const ICO_FS_ON  = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
  const ICO_FS_OFF = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';

  function _updatePlayIco(paused) {
    playIco.innerHTML = paused ? ICO_PLAY : ICO_PAUSE;
    centerIco.innerHTML = paused ? ICO_PLAY : ICO_PAUSE;
  }

  function _showControls(autoHide) {
    _controlsVisible = true;
    header.style.opacity   = '1';
    controls.style.opacity = '1';
    clearTimeout(_controlsTimer);
    if (autoHide) {
      _controlsTimer = setTimeout(_hideControls, 3000);
    }
  }

  function _hideControls() {
    if (video.paused) return;
    _controlsVisible = false;
    header.style.opacity   = '0';
    controls.style.opacity = '0';
  }

  function _flashCenter() {
    centerBtn.style.opacity = '1';
    clearTimeout(centerBtn._t);
    centerBtn._t = setTimeout(() => { centerBtn.style.opacity = '0'; }, 400);
  }

  function _updateProgress() {
    if (!video.duration || _seeking) return;
    const pct = video.currentTime / video.duration * 100;
    progBar.style.width  = pct + '%';
    thumb.style.left     = pct + '%';
    curEl.textContent    = _fmtT(video.currentTime);
    // Buffer
    if (video.buffered.length) {
      const b = video.buffered.end(video.buffered.length - 1) / video.duration * 100;
      bufBar.style.width = b + '%';
    }
  }

  function _setProgress(clientX) {
    const rect = progWrap.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = pct * (video.duration || 0);
    progBar.style.width = (pct*100) + '%';
    thumb.style.left    = (pct*100) + '%';
    curEl.textContent   = _fmtT(video.currentTime);
  }

  // ┄┄ Video events ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  video.addEventListener('loadedmetadata', () => {
    durEl.textContent = _fmtT(video.duration);
  });
  video.addEventListener('timeupdate', _updateProgress);
  video.addEventListener('waiting',  () => { spinner.style.opacity = '1'; });
  video.addEventListener('playing',  () => {
    spinner.style.opacity = '0';
    _updatePlayIco(false);
    _showControls(true);
  });
  video.addEventListener('pause',    () => { _updatePlayIco(true); _showControls(false); });
  video.addEventListener('ended',    () => {
    _updatePlayIco(true);
    video.currentTime = 0;
    _showControls(false);
  });
  video.addEventListener('error',    () => { spinner.style.opacity = '0'; toast('❌ Ошибка видео'); });

  // ┄┄ Play/pause button ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  playBtn.addEventListener('click', () => {
    if (video.paused) { video.play(); } else { video.pause(); }
    _flashCenter();
    _showControls(!video.paused);
  });

  // ┄┄ Tap on video area = toggle controls + play/pause ┄┄┄┄┄┄┄┄┄┄┄┄┄
  const area = ov.querySelector('#mvp-area');
  let _tapTimer = null;
  area.addEventListener('click', (e) => {
    if (e.target === video || e.target === area) {
      if (_controlsVisible) {
        if (video.paused) {
          video.play(); _flashCenter(); _showControls(true);
        } else {
          _hideControls();
        }
      } else {
        _showControls(true);
      }
    }
  });

  // ┄┄ Progress bar touch/click ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  progWrap.addEventListener('click', e => { _setProgress(e.clientX); _showControls(true); });
  progWrap.addEventListener('touchstart', e => {
    _seeking = true;
    _setProgress(e.touches[0].clientX);
    _showControls(false);
  }, { passive: true });
  progWrap.addEventListener('touchmove', e => {
    _setProgress(e.touches[0].clientX);
  }, { passive: true });
  progWrap.addEventListener('touchend', () => {
    _seeking = false;
    _showControls(true);
  }, { passive: true });

  // ┄┄ Speed button ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  speedBtn.addEventListener('click', () => {
    _speedIdx = (_speedIdx + 1) % SPEEDS.length;
    const sp = SPEEDS[_speedIdx];
    video.playbackRate = sp;
    speedBtn.textContent = sp === 1 ? '1×' : sp + '×';
    _showControls(true);
  });

  // ┄┄ Fullscreen ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  fsBtn.addEventListener('click', () => {
    _fullscreen = !_fullscreen;
    if (_fullscreen) {
      // Принудительный landscape через ориентацию (если доступно)
      try { screen.orientation?.lock('landscape'); } catch(_) {}
      fsIco.innerHTML = ICO_FS_OFF;
      ov.style.zIndex = '10000';
    } else {
      try { screen.orientation?.unlock(); } catch(_) {}
      fsIco.innerHTML = ICO_FS_ON;
      ov.style.zIndex = '9999';
    }
    _showControls(true);
  });

  // ┄┄ Close ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  function _close() {
    video.pause();
    try { screen.orientation?.unlock(); } catch(_) {}
    ov.style.transition = 'opacity .18s';
    ov.style.opacity = '0';
    setTimeout(() => ov.remove(), 180);
  }
  closeBtn.addEventListener('click', _close);

  // ┄┄ Swipe down = close ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  let _swY = 0, _swDy = 0, _swActive = false;
  area.addEventListener('touchstart', e => {
    if (e.touches.length > 1) return;
    _swY = e.touches[0].clientY; _swDy = 0; _swActive = true;
  }, { passive: true });
  area.addEventListener('touchmove', e => {
    if (!_swActive || e.touches.length > 1) return;
    _swDy = e.touches[0].clientY - _swY;
    if (_swDy > 0) {
      ov.style.transform = 'translateY(' + _swDy + 'px)';
      ov.style.opacity   = String(Math.max(0.2, 1 - _swDy / 280));
    }
  }, { passive: true });
  area.addEventListener('touchend', () => {
    _swActive = false;
    if (_swDy > 110) { _close(); }
    else { ov.style.transform = ''; ov.style.opacity = ''; }
  }, { passive: true });

  // ┄┄ Keyboard (ПК) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  const _onKey = (e) => {
    if (e.key === 'Escape')      { _close(); }
    if (e.key === ' ')           { video.paused ? video.play() : video.pause(); e.preventDefault(); }
    if (e.key === 'ArrowRight')  { video.currentTime = Math.min(video.duration, video.currentTime + 10); }
    if (e.key === 'ArrowLeft')   { video.currentTime = Math.max(0, video.currentTime - 10); }
    if (e.key === 'f')           { fsBtn.click(); }
  };
  document.addEventListener('keydown', _onKey);
  ov.addEventListener('remove', () => document.removeEventListener('keydown', _onKey));

  // ┄┄ Autoplay ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  video.play().then(() => {
    _showControls(true);
  }).catch(() => {
    // autoplay заблокирован   показываем контролы
    _showControls(false);
  });
}

window.mcVideoOpen = mcVideoOpen;

// ┄┄ Переключение кнопки действия: 🎤 ↩ ➤ / кружок ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// ┄┄ Состояние кнопки: 'voice' | 'send' | 'circle' ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// Тап по mic ↩ circle, тап по circle ↩ mic (как в Telegram)
let _mcActionState = 'voice';
let _mcVoiceMode   = 'voice'; // 'voice' | 'circle'   текущий суб-режим когда нет текста

function mcUpdateActionBtn() {
  const inp = document.getElementById('mc-input');
  const btn = document.getElementById('mc-action-btn');
  if (!btn) return;
  const hasText = inp && inp.value.trim().length > 0;
  const newState = hasText ? 'send' : _mcVoiceMode;
  if (newState === _mcActionState) return;
  _mcActionState = newState;
  btn.classList.remove('state-voice','state-send','state-circle');
  btn.style.transform = 'scale(.85)';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    btn.style.transform = '';
    btn.classList.add('state-' + newState);
    _mcRenderActionIcon(newState);
  }));
}

/** Рендерит иконку внутри mc-action-voice в зависимости от режима */
function _mcRenderActionIcon(state) {
  const voiceEl = document.getElementById('mc-action-voice');
  if (!voiceEl) return;
  if (state === 'circle') {
    voiceEl.querySelector('svg')?.remove();
    if (!voiceEl.querySelector('#mc-circle-ico')) {
      voiceEl.innerHTML = `<svg id="mc-circle-ico" width="22" height="22" viewBox="0 0 24 24" fill="white">
        <circle cx="12" cy="12" r="9" stroke="white" stroke-width="2" fill="none"/>
        <circle cx="12" cy="9" r="3" fill="white"/>
        <path d="M6 20c0-3.31 2.69-6 6-6s6 2.69 6 6" fill="white"/>
      </svg>`;
    }
  } else {
    voiceEl.innerHTML = `<svg id="mc-mic-svg" width="22" height="22" viewBox="0 0 24 24" fill="white">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
    </svg>`;
  }
}

/** Тап по кнопке без текста   переключаем mic ↩ circle */
function mcToggleVoiceMode() {
  const inp = document.getElementById('mc-input');
  const hasText = inp && inp.value.trim().length > 0;
  if (hasText) { messengerSend(); return; }
  _mcVoiceMode = _mcVoiceMode === 'voice' ? 'circle' : 'voice';
  _mcActionState = ''; // сбрасываем чтобы mcUpdateActionBtn применил новое состояние
  mcUpdateActionBtn();
  toast(_mcVoiceMode === 'circle' ? '⭐ Режим кружка' : '🎤 Режим голосового', 1200);
}

function _mcInitActionBtn() {
  const btn = document.getElementById('mc-action-btn');
  if (!btn) return;
  btn.classList.remove('state-voice','state-send','state-circle');
  btn.classList.add('state-voice');
  _mcActionState = 'voice';
  _mcRenderActionIcon('voice');
}
// Инициализируем при открытии чата
const _origMesOpenChat = window.messengerOpenChat;
window.messengerOpenChat = function(...args) {
  if (_origMesOpenChat) _origMesOpenChat(...args);
  setTimeout(_mcInitActionBtn, 30);
};
// Сбрасываем после отправки
const _origMessengerSend = window.messengerSend;
if (typeof _origMessengerSend === 'function') {
  window.messengerSend = function() {
    _origMessengerSend();
    setTimeout(mcUpdateActionBtn, 10);
  };
}

function messengerUpdateBadge() {
  const p = profileLoad();
  const msgs = msgLoad();
  let total = 0;
  Object.values(msgs).forEach(chatMsgs => {
    total += (chatMsgs||[]).filter(m => m.from !== p?.username && !m.read).length;
  });
  // Бейдж внутри кнопки «Сообщения» в профиле
  const badge = document.getElementById('msg-unread-badge');
  if (badge) { badge.style.display = total > 0 ? '' : 'none'; badge.textContent = total; }

  // Красная точка на кнопке мессенджера в нав-баре
  const navMsgDot = document.getElementById('nav-msg-dot');
  if (navMsgDot) navMsgDot.style.display = total > 0 ? '' : 'none';

  // Также точка на кнопке профиля (если вдруг оба используются)
  let navDot = document.getElementById('nav-profile-msg-dot');
  const navProfile = document.getElementById('nav-profile');
  if (navProfile && !navDot) {
    navDot = document.createElement('span');
    navDot.id = 'nav-profile-msg-dot';
    navDot.className = 'nav-badge';
    navDot.style.cssText = 'position:absolute;top:4px;right:4px;width:8px;height:8px;border-radius:50%;background:#e05555;border:2px solid var(--bg,#0d0d0d);display:none';
    const wrap = navProfile.querySelector('.nav-icon-wrap');
    if (wrap) { wrap.style.position = 'relative'; wrap.appendChild(navDot); }
  }
  if (navDot) navDot.style.display = total > 0 ? '' : 'none';
}

function messengerOpenChatFrom(username) {
  // Добавить в список чатов если нет
  const chats = chatsLoad();
  if (!chats.includes(username)) { chats.unshift(username); chatsSave(chats); }
  // Запустить polling
  const p = profileLoad();
  if (p) sbPollChat(p.username, username);
  messengerOpenChat(username);
  showScreen('s-messenger-chat');
}

function msgFormatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'});
}

// Патч CMD для /vip
const _origCmdExecForVip2 = window.cmdExec;
if (typeof cmdExec !== 'undefined') {
  const origFn = cmdExec;
  window.cmdExec = function(raw) {
    const parts = raw.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').trim();
    if (cmd === '/emoji_diag') {
      cmdPrint('info', '🔍 Запускаю диагностику emoji-пака...');
      emojiDiag();
      return;
    }
    if (cmd === '/emoji_check') {
      emojiCheck();
      return;
    }
    if (cmd === '/vip') {
      if (!arg) {
        cmdPrint('info', '👑 Использование:');
        cmdPrint('info', '  /vip <КОД>            активировать себе VIP');
        cmdPrint('info', '  /vip give @ник        выдать VIP пользователю');
        cmdPrint('info', '  /vip revoke @ник      забрать VIP у пользователя');
        cmdPrint('info', '  /vip list             список VIP пользователей');
        return;
      }
      // /vip give @username
      if (arg.toLowerCase().startsWith('give ')) {
        const target = arg.slice(5).replace('@','').trim().toLowerCase();
        if (!target) { cmdPrint('err','❌ Укажи юзернейм: /vip give @ник'); return; }
        vipGrantTo(target).then(() => {
          cmdPrint('ok', `👑 VIP выдан пользователю @${target}`);
          toast(`👑 @${target} получил VIP!`);
        });
        return;
      }
      // /vip revoke @username
      if (arg.toLowerCase().startsWith('revoke ')) {
        const target = arg.slice(7).replace('@','').trim().toLowerCase();
        if (!target) { cmdPrint('err','❌ Укажи юзернейм: /vip revoke @ник'); return; }
        vipRevokeFrom(target).then(() => {
          cmdPrint('ok', `✅ VIP забран у @${target}`);
        });
        return;
      }
      // /vip list
      if (arg.toLowerCase() === 'list') {
        const granted = vipGrantedLoad();
        const list = Object.keys(granted);
        if (list.length === 0) { cmdPrint('info', 'Нет VIP пользователей'); return; }
        cmdPrint('info', `👑 VIP пользователи (${list.length}):`);
        list.forEach(u => cmdPrint('out', `  @${u}`));
        return;
      }
      // /vip КОД   активировать себе
      if (vipActivate(arg)) {
        cmdPrint('ok','👑 VIP активирован! Доступны: фото-аватар, рамки, значки, баннеры');
        toast('👑 Добро пожаловать в VIP клуб!');
        setTimeout(profileRenderScreen, 200);
      } else {
        cmdPrint('err','❌ Неверный VIP-код. Попробуй /vip give @ник для выдачи другому.');
      }
      return;
    }
    origFn(raw);
  };
}

// ══════════════════════════════════════════════════════════════════════
// ✏️ FAB кнопка в мессенджере — переписан чтобы не терять иконку
// ══════════════════════════════════════════════════════════════════════
let _fabOpen = false;
let _fabLastTs = 0; // защита от двойного срабатывания (ghost click / touch emulator)

function msgFabToggle(e) {
  // Предотвращаем всплытие чтобы document-обработчик не закрыл только что открытое меню
  if (e) { e.stopPropagation(); e.stopImmediatePropagation(); }

  // Дебаунс: игнорируем вызовы чаще 200мс (ghost click от mouse→touch эмулятора)
  const now = Date.now();
  if (now - _fabLastTs < 200) return;
  _fabLastTs = now;

  const menu = document.getElementById('msg-fab-menu');
  const btn  = document.getElementById('msg-fab-btn');
  if (!menu || !btn) return;

  _fabOpen = !_fabOpen;

  if (_fabOpen) {
    menu.style.display = 'flex';
    // Не трогаем innerHTML! Управляем иконкой только через CSS-класс и data-атрибут
    btn.setAttribute('data-fab-open', '1');
    btn.style.transform = 'rotate(45deg) scale(1.08)';
    btn.style.background = 'var(--surface3)';
  } else {
    msgFabClose();
  }
}

function msgFabClose() {
  const menu = document.getElementById('msg-fab-menu');
  const btn  = document.getElementById('msg-fab-btn');
  _fabOpen = false;
  if (menu) menu.style.display = 'none';
  if (btn) {
    btn.removeAttribute('data-fab-open');
    btn.style.transform = '';
    btn.style.background = ''; // вернёт var(--accent) из inline style
  }
}

// Закрываем при клике ВНЕ контейнера
// Используем capture=false, passive — так mousedown из эмулятора не помешает
document.addEventListener('pointerdown', (e) => {
  if (!_fabOpen) return;
  const c = document.getElementById('msg-fab-container');
  if (c && !c.contains(e.target)) msgFabClose();
}, { passive: true });

// ══════════════════════════════════════════════════════════════════════
// 📷 РЕЖИМ ВЫРЕЗА КАМЕРЫ
// on  = фон уходит под камеру, контент безопасно отступает внутри шапки
// off = без учёта выреза, всё от самого верха
// ══════════════════════════════════════════════════════════════════════
const NOTCH_KEY = 'sapp_notch_mode_v2';
function notchModeLoad() { try { return localStorage.getItem(NOTCH_KEY) || 'on'; } catch(e) { return 'on'; } }
function toggleNotchMode() {
  const cur = notchModeLoad();
  const next = cur === 'on' ? 'off' : 'on';
  try { localStorage.setItem(NOTCH_KEY, next); } catch(e) {}
  _applyNotchMode(next);
  _renderNotchToggle(next);
  toast(next === 'on' ? '📷 Вырез камеры: включён' : '📷 Вырез камеры: отключён');
}
function _applyNotchMode(mode) {
  const cl = document.documentElement.classList;
  if (mode === 'on') {
    cl.add('notch-on');
    cl.remove('notch-off');
  } else {
    cl.add('notch-off');
    cl.remove('notch-on');
  }
}
function _renderNotchToggle(mode) {
  const t = document.getElementById('notch-mode-toggle');
  const l = document.getElementById('notch-mode-label');
  if (t) t.classList.toggle('on', mode === 'on');
  if (l) l.textContent = mode === 'on' ? 'включён' : 'отключён';
}
// Применяем немедленно и повторно на случай позднего инжекта Android
(function initNotchMode() {
  const mode = notchModeLoad();
  _applyNotchMode(mode);
  _renderNotchToggle(mode);
  // Повторные вызовы: Android-инжектор может выставить safe-area позже
  [200, 600, 1200, 2500].forEach(ms =>
    setTimeout(() => {
      _applyNotchMode(notchModeLoad());
      _renderNotchToggle(notchModeLoad());
    }, ms)
  );
})();

// ── Тогл стиля эмодзи ─────────────────────────────────────────────────────
const _EMOJI_STYLE_KEY = 'sapp_emoji_style_v1';
function _emojiStyleEnabled() {
  try { return localStorage.getItem(_EMOJI_STYLE_KEY) === 'on'; } catch(e) { return false; }
}
function toggleEmojiStyle() {
  const cur = _emojiStyleEnabled();
  const next = cur ? 'off' : 'on';
  try { localStorage.setItem(_EMOJI_STYLE_KEY, next); } catch(e) {}
  _renderEmojiStyleToggle(next === 'on');
  if (next === 'on') {
    toast('😊 Эмодзи iOS включены · перезапусти приложение');
  } else {
    toast('😊 Системные эмодзи · перезапусти приложение');
  }
}
function _renderEmojiStyleToggle(on) {
  const t = document.getElementById('emoji-style-toggle');
  const s = document.getElementById('emoji-style-sub');
  if (t) t.classList.toggle('on', on);
  if (s) s.textContent = on ? 'Стиль iOS (требует скачанного пака)' : 'Системные эмодзи (по умолчанию)';
}
// Инициализация при загрузке
(function() {
  const on = _emojiStyleEnabled();
  _renderEmojiStyleToggle(on);
})();

// ┄┄ Анимация кнопки ◆ в чате ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
(function patchShowMore() {
  const orig = window.messengerShowMore;
  if (typeof orig !== 'function') return;
  window.messengerShowMore = function() {
    const btn = document.querySelector('#s-messenger-chat .hdr button:last-child');
    if (btn) {
      btn.style.transition = 'transform .15s cubic-bezier(.34,1.56,.64,1)';
      btn.style.transform  = 'scale(1.4) rotate(90deg)';
      setTimeout(() => { btn.style.transform = 'rotate(90deg)'; }, 160);
      setTimeout(() => { btn.style.transform = ''; }, 400);
    }
    orig.call(this);
  };
})();

// ══════════════════════════════════════════════════════════════════
// 🎬 УТИЛИТА ЗАКРЫТИЯ ШТОРКИ С АНИМАЦИЕЙ
// ══════════════════════════════════════════════════════════════════
function _closeSheet(sheetEl) {
  if (!sheetEl) return;
  const inner = sheetEl.querySelector('[style*="border-radius:20px 20px 0 0"]');
  if (inner) {
    inner.style.animation = 'mcSlideDown .22s cubic-bezier(.4,0,.8,.6) forwards';
  }
  sheetEl.style.animation = 'mcFadeOut .22s ease forwards';
  setTimeout(() => sheetEl?.remove(), 200);
}

// ┄┄ Патч peerShowMenu: добавляем анимацию закрытия через _closeSheet ┄┄
(function() {
  const orig = window.peerShowMenu;
  if (typeof orig !== 'function') return;
  window.peerShowMenu = function(username) {
    const existing = document.getElementById('peer-menu-sheet');
    if (existing) { _closeSheet(existing); return; }
    orig(username);
  };
})();

// ┄┄ Патч forward sheet: добавляем анимацию и slide-up ┄┄
(function() {
  const orig = window.mcForwardMsg;
  if (typeof orig !== 'function') return;
  window.mcForwardMsg = function(idx) {
    orig(idx);
    // Добавляем анимацию к inner div
    setTimeout(() => {
      const sheet = document.getElementById('mc-forward-sheet');
      if (!sheet) return;
      const inner = sheet.querySelector('[style*="border-radius:20px 20px 0 0"]');
      if (inner && !inner.style.animation) {
        inner.style.animation = 'mcSlideUp .26s cubic-bezier(.34,1.1,.64,1)';
      }
      // Закрытие с анимацией
      const oldListener = sheet._clickHandler;
      sheet.removeEventListener('click', oldListener);
      sheet._clickHandler = (e) => {
        if (e.target === sheet) _closeSheet(sheet);
      };
      sheet.addEventListener('click', sheet._clickHandler);
    }, 0);
  };
})();

// ┄┄ Мотивация ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// mcEmojiIn используется в mute sheet   убедимся что анимация определена
(function ensureMcAnimations() {
  if (document.getElementById('mc-menu-style')) return; // уже добавлены
  const st = document.createElement('style');
  st.id = 'mc-anim-global';
  st.textContent = `
    @keyframes mcSlideUp   { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
    @keyframes mcSlideDown { from{transform:translateY(0);opacity:1}    to{transform:translateY(110%);opacity:0} }
    @keyframes mcFadeIn    { from{opacity:0} to{opacity:1} }
    @keyframes mcFadeOut   { from{opacity:1} to{opacity:0} }
    @keyframes mcEmojiIn   { from{transform:translateY(16px) scale(.85);opacity:0} to{transform:none;opacity:1} }
  `;
  document.head.appendChild(st);
})();

// ══════════════════════════════════════════════════════════════════
// 💬 ЭКРАН ГРУПП
// ══════════════════════════════════════════════════════════════════
function showGroupsList() {
  showScreen('s-groups-chat');
  renderGroupsList();
}

function renderGroupsList() {
  const list = document.getElementById('groups-chat-list');
  if (!list) return;
  const groups = groupsLoad();
  const p = profileLoad();
  if (!groups.length) {
    list.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--muted)">
      <div style="font-size:40px;margin-bottom:12px">💬</div>
      <div style="font-size:14px;margin-bottom:20px">Нет групп. Создай первую!</div>
      <button class="btn btn-accent" style="max-width:260px" onclick="showCreateGroupDialog()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Создать группу</button>
    </div>`;
    return;
  }
  const _pgp = profileLoad();
  list.innerHTML = groups.map(g => {
    const gMsgs  = msgLoad()[g.id] || [];
    const last   = gMsgs[gMsgs.length - 1];
    const lastText = last ? _mcPreviewText(last) || last.text || last.sticker || '📷' : (g.description || 'Нет сообщений');
    const lastTime = last ? msgFormatTime(last.ts) : '';
    const isPublic = g.id === PUBLIC_GROUP_ID;
    let cdBadge = '';
    if (isPublic && _pgp) {
      const { ok, remainMs } = _publicGroupCooldown(_pgp.username);
      if (!ok) {
        const rm = Math.floor(remainMs/60000);
        const rs = String(Math.round((remainMs%60000)/1000)).padStart(2,'0');
        cdBadge = `<div style="background:rgba(239,68,68,.18);color:#ef4444;border-radius:7px;font-size:10px;font-weight:700;padding:2px 7px;flex-shrink:0;white-space:nowrap">⏳ ${rm}:${rs}</div>`;
      }
    }
    const avatarBg = isPublic ? 'linear-gradient(135deg,var(--accent),var(--accent2,#c45f0a))' : 'var(--surface2)';
    const avatarR  = isPublic ? '18px' : '50%';
    const rowBg    = isPublic ? 'rgba(255,255,255,.018)' : '';
    const _grpAvatarHtml = (g.avatarType === 'photo' && g.avatarData)
      ? `<img src="${g.avatarData}" style="width:52px;height:52px;border-radius:${avatarR};object-fit:cover;display:block">`
      : `${_emojiImg(g.avatar||'👥',30)}`;
    return `<div onclick="messengerOpenChat('${escHtml(g.id)}')"
      style="display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04);background:${rowBg}">
      <div style="width:52px;height:52px;border-radius:${avatarR};background:${avatarBg};display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;overflow:hidden">${_grpAvatarHtml}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <div style="font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${escHtml(g.name)}</div>
          ${cdBadge}
          <div style="font-size:11px;color:var(--muted);flex-shrink:0">${lastTime}</div>
        </div>
        <div style="font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(lastText)}</div>
      </div>
    </div>`;
  }).join('');
}


// ════════════════════════════════════════════════════════════════════════
// 📱 YOUTUBE SHORTS   встроенный плеер через YouTube Mobile Web
// Команда в CMD: shorts [поисковый запрос]
// ════════════════════════════════════════════════════════════════════════

const YT_SHORTS_URL  = 'https://m.youtube.com/shorts';
const YT_SEARCH_BASE = 'https://m.youtube.com/results?search_query=';

function ytShortsOpen(query) {
  // YouTube блокирует iframe (X-Frame-Options: sameorigin)
  // Открываем нативно   браузер или YouTube-приложение
  const url = query
    ? (YT_SEARCH_BASE + encodeURIComponent(query) + '&sp=EgIYAQ%3D%3D')
    : YT_SHORTS_URL;

  if (window.Android?.openInAppBrowser) {
    window.Android.openInAppBrowser(url);
  } else if (window.Android?.openUrl) {
    window.Android.openUrl(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

function _ytLoadUrl(url) {
  if (window.Android?.openInAppBrowser) {
    window.Android.openInAppBrowser(url);
  } else if (window.Android?.openUrl) {
    window.Android.openUrl(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

function ytNavHome()          { _ytLoadUrl('https://m.youtube.com/'); }
function ytNavShorts()        { _ytLoadUrl(YT_SHORTS_URL); }
function ytNavSubscriptions() { _ytLoadUrl('https://m.youtube.com/feed/subscriptions'); }
function ytNavLibrary()       { _ytLoadUrl('https://m.youtube.com/feed/library'); }

function ytShortsSearch() {
  document.getElementById('yt-search-overlay').style.display = 'block';
  setTimeout(() => document.getElementById('yt-search-input')?.focus(), 100);
}

function ytDoSearch(q) {
  if (!q?.trim()) return;
  document.getElementById('yt-search-overlay').style.display = 'none';
  _ytLoadUrl(YT_SEARCH_BASE + encodeURIComponent(q.trim()) + '&sp=EgIYAQ%3D%3D');
}
