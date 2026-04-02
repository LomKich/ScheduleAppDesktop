# ScheduleApp Desktop (Electron)

Полноценная ПК-версия приложения на базе Electron.
Работает на **Windows / macOS / Linux**.

---

## ▶ Быстрый запуск (разработка)

Нужен [Node.js](https://nodejs.org/) 18+.

```bash
# 1. Перейди в папку проекта
cd ScheduleApp-Desktop

# 2. Установи зависимости
npm install

# 3. Запусти
npm start
```

---

## 📦 Сборка .exe / .dmg / .AppImage

```bash
# Windows (запускать на Windows или в CI)
npm run build-win

# macOS
npm run build-mac

# Linux
npm run build-linux
```

Готовый установщик появится в папке `dist/`.

---

## 🗂 Структура

```
ScheduleApp-Desktop/
├── main.js        — главный процесс Electron (окно, IPC, ОС-интеграция)
├── preload.js     — мост Android→Desktop (window.Android.* полифил)
├── assets/
│   ├── index.html — основной UI (без изменений)
│   ├── js/        — core.js, social.js, games.js, rn.js
│   ├── sounds/    — звуки
│   └── dice/      — анимации кубиков
└── package.json
```

---

## ℹ️ Что работает

| Функция | Статус |
|---|---|
| Расписание, темы, шрифты | ✅ |
| Авторизация / профиль (Supabase) | ✅ |
| Мессенджер, групповые чаты | ✅ |
| E2E шифрование | ✅ |
| Мини-игры | ✅ |
| Уведомления ОС | ✅ |
| Выбор фото для фона | ✅ |
| Сохранение картинок | ✅ |
| Запись голоса/видео | ✅ (через браузерные API) |
| Скачивание файлов | ✅ |
| VPN / смена иконки | ❌ (Android-only) |
| Фоновый сервис | ❌ (не нужен — поллинг идёт в окне) |
