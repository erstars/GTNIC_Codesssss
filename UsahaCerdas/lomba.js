// UsahaCerdas: kasir, produk, stok, pengeluaran, laporan, dan pengaturan.

const LOW_STOCK = 5;
const THEME_KEY = "usahacerdas_theme";
const METHOD_NAMES = { TUNAI: "Tunai", QRIS: "QRIS", TRANSFER: "Transfer" };
const EXPENSE_CATEGORIES = ["Sewa", "Listrik", "Air", "Internet", "Gaji", "Bahan baku", "Transportasi", "Lainnya"];
const OWNER_PAGES = ["dashboard", "cashier", "products", "transactions", "expenses", "reports", "settings"];
const STAFF_PAGES = ["cashier", "products", "transactions", "settings"];
const REASONS = {
  AWAL: ["Stok awal", ""],
  RESTOK: ["Restok", "good"],
  KOREKSI: ["Koreksi", "amber"],
  JUAL: ["Terjual", ""],
  BATAL: ["Batal jual", "amber"]
};

let session = { user: null, store: { name: "UsahaCerdas" } };
let data = { products: [], transactions: [], expenses: [] };
let users = [];
let cart = [];
let editingId = null;
let editingUser = null;
let restockId = null;
let pendingSaleId = null;
let cashierCategory = "";
let paymentMethod = "TUNAI";
let authMode = "login";
let pendingLogo = null;

// Foto latar halaman masuk. Tambah foto: taruh di assets/, daftarkan di PAGES (server.js), lalu tulis di sini.
const AUTH_PHOTOS = [
  "assets/usaha-1.webp",
  "assets/usaha-2.png",
  "assets/usaha-3.webp",
  "assets/usaha-4.jpg",
  "assets/usaha-5.jpg"
];
const AUTH_PHOTO_SECONDS = 10;
let authSlidesStarted = false;

function startAuthSlides() {
  if (authSlidesStarted) return;
  authSlidesStarted = true;

  const slides = AUTH_PHOTOS.map((photo, index) => {
    const slide = document.createElement("div");
    slide.className = index === 0 ? "auth-slide active" : "auth-slide";
    slide.style.backgroundImage = `url("${photo}")`;
    $("authSlides").append(slide);
    return slide;
  });

  let current = 0;
  setInterval(() => {
    if ($("authView").classList.contains("hidden")) return;
    slides[current].classList.remove("active");
    current = (current + 1) % slides.length;
    slides[current].classList.add("active");
  }, AUTH_PHOTO_SECONDS * 1000);
}
let currentPage = "";
let targetPage = "";
let dataLoaded = false;
let activeRequests = 0;
let loadSequence = 0;
let pageLoadSequence = 0;
let splashShownAt = performance.now();
let cartFlash = null;
let paletteItems = [];
let paletteIndex = 0;
const chartState = { period: "7", metric: "revenue", compare: true, animate: true };

const $ = (id) => document.getElementById(id);

// IKON

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.4a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  receipt: '<path d="M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5z"/><path d="M9 9h6M9 13h6"/>',
  wallet: '<path d="M4 7a2 2 0 0 1 2-2h12v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="16.5" cy="13.5" r="1.2"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-5M13 16V8M18 16v-3"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="18" r="2"/>',
  logout: '<path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 21h16"/>',
  printer: '<path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  send: '<path d="M4 12 20 4l-4 16-3.5-6.5z"/><path d="M12.5 13.5 20 4"/>'
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

function applyIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach(element => {
    element.outerHTML = icon(element.dataset.icon);
  });
}

// LAYAR LOADING

const SPLASH_MIN_MS = 600;
const PAGE_LOADER_MIN_MS = 300;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function showSplash(text) {
  $("splashText").textContent = text;
  showElement($("splash"));
  splashShownAt = performance.now();
}

// Tampil cukup lama supaya tidak sekadar berkedip.
async function hideSplash() {
  await wait(Math.max(0, SPLASH_MIN_MS - (performance.now() - splashShownAt)));
  hideWithExit($("splash"));
}

// Saat pindah halaman, data diambil ulang supaya selalu yang terbaru.
async function refreshPage() {
  const sequence = ++pageLoadSequence;

  showElement($("pageLoader"));

  try {
    await Promise.all([loadData(), wait(PAGE_LOADER_MIN_MS)]);
  } catch (error) {
    showToast(error.message, true);
  }

  if (sequence === pageLoadSequence) hideWithExit($("pageLoader"));
}

// GERAKAN HALUS

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Perubahan tampilan memudar halus di browser yang mendukung; jika tidak, langsung berubah.
// Transisi yang dilewati browser bukan kesalahan, perubahannya tetap diterapkan.
function startTransition(update) {
  if (!document.startViewTransition || reducedMotion() || document.visibilityState !== "visible") {
    update();
    return null;
  }

  const transition = document.startViewTransition(update);

  transition.ready.catch(() => {});
  transition.finished.catch(() => {});
  transition.updateCallbackDone.catch(() => {});

  return transition;
}

function smoothUpdate(update) {
  const transition = startTransition(update);

  return transition ? transition.finished.catch(() => {}) : Promise.resolve();
}

// Angka bergerak menuju nilai baru, tetapi nilai akhirnya selalu tepat.
function setNumber(id, value, format) {
  const element = $(id);
  const start = element.numberValue;

  element.numberValue = value;
  cancelAnimationFrame(element.numberFrame);

  if (start === value && element.textContent) return;

  const visible = element.offsetParent !== null;

  if (!visible || reducedMotion() || document.body.classList.contains("is-loading")) {
    element.textContent = format(value);
    return;
  }

  const from = start || 0;
  const begin = performance.now();
  const duration = 420;

  function step(now) {
    const progress = Math.min(1, (now - begin) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);

    element.textContent = format(Math.round(from + (value - from) * eased));

    if (progress < 1) {
      element.numberFrame = requestAnimationFrame(step);
    } else {
      element.textContent = format(value);
    }
  }

  element.numberFrame = requestAnimationFrame(step);
}

const setMoney = (id, value) => setNumber(id, value, money);
const setCount = (id, value) => setNumber(id, value, String);

// Grafik kecil di kartu statistik.
function renderSpark(id, values) {
  const width = 200;
  const height = 36;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length > 1 ? index / (values.length - 1) * width : 0;
    const y = height - 3 - (value - min) / span * (height - 8);

    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  $(id).innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <polygon points="0,${height} ${points.join(" ")} ${width},${height}" />
      <polyline points="${points.join(" ")}" vector-effect="non-scaling-stroke" />
    </svg>
  `;
}

// Latar menu aktif bergeser ke tombol yang dipilih.
function moveNavPill() {
  const pill = $("navPill");
  const active = document.querySelector(".nav-button.active");

  if (!active || active.offsetParent === null) return;

  pill.style.height = active.offsetHeight + "px";
  pill.style.transform = `translateY(${active.offsetTop}px)`;
  pill.classList.add("ready");

  // Di HP menu bisa digeser, jadi menu aktif dibawa ke tengah.
  if (window.matchMedia("(max-width: 680px)").matches) {
    active.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
  }
}

window.addEventListener("resize", moveNavPill);

// TEMA GELAP DAN TERANG

function isDark() {
  return document.documentElement.dataset.theme === "dark";
}

function renderThemeButtons() {
  document.querySelectorAll("[data-theme-toggle]").forEach(button => {
    button.innerHTML = icon(isDark() ? "sun" : "moon");
    button.title = isDark() ? "Mode terang" : "Mode gelap";
  });
}

function toggleTheme() {
  const dark = !isDark();
  const apply = () => {
    if (dark) {
      document.documentElement.dataset.theme = "dark";
    } else {
      delete document.documentElement.dataset.theme;
    }

    renderThemeButtons();
  };

  document.documentElement.classList.add("vt-theme");

  const done = smoothUpdate(apply);

  done.finally(() => document.documentElement.classList.remove("vt-theme"));

  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch (error) {
    // Tema tetap berubah walaupun pilihan tidak bisa disimpan.
  }
}

// SERVER

// Garis tipis di atas layar selama ada permintaan ke server.
function trackRequest(change) {
  activeRequests += change;
  $("topLoader").classList.toggle("active", activeRequests > 0);
}

async function api(url, method = "GET", body) {
  trackRequest(1);

  try {
    return await sendRequest(url, method, body);
  } finally {
    trackRequest(-1);
  }
}

async function sendRequest(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const message = result && result.error ? result.error : "Terjadi masalah pada server.";

    // Sesi berakhir: kembali ke halaman masuk.
    if (response.status === 401 && url !== "/api/login" && session.user) {
      leaveApp();
      showAuth("login");
      showToast("Sesi berakhir. Silakan masuk lagi.", true);
    }

    throw new Error(message);
  }

  return result;
}

async function loadData() {
  const sequence = ++loadSequence;
  const result = await api("/api/data");

  // Jawaban lama yang datang terlambat tidak boleh menimpa data yang lebih baru.
  if (sequence !== loadSequence) return;

  data = result;
  session.store = result.store;

  // Produk yang sudah tidak ada dikeluarkan dari keranjang.
  cart = cart.filter(item => data.products.some(product => product.id === item.productId));

  dataLoaded = true;
  document.body.classList.remove("is-loading");
  renderAll();
}

// Menjalankan perintah ke server lalu memuat ulang data; kesalahan tampil sebagai notifikasi.
async function runAction(action, successMessage) {
  try {
    await action();
    await loadData();

    if (successMessage) showToast(successMessage);
    return true;
  } catch (error) {
    showToast(error.message, true);
    return false;
  }
}

// BANTUAN TAMPILAN

// Mencegah teks dari database terbaca sebagai HTML.
function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function makeId(prefix) {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function showToast(message, isError = false) {
  const toast = $("toast");

  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, isError ? 4000 : 2500);
}

function emptyState(iconName, title, text, buttonLabel, action) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon(iconName)}</div>
      <strong>${esc(title)}</strong>
      ${esc(text)}
      ${buttonLabel ? `<div><button type="button" class="primary-button" data-action="${action}">${esc(buttonLabel)}</button></div>` : ""}
    </div>
  `;
}

function tableEmpty(columns, text) {
  return `<tr><td colspan="${columns}" class="muted-text">${esc(text)}</td></tr>`;
}

const AVATAR_COLORS = ["#47745e", "#5b7f95", "#8a6d3b", "#7a6a9b", "#a2605a", "#4f8a8b"];

function avatar(name) {
  let hash = 0;

  for (const letter of String(name)) {
    hash = (hash * 31 + letter.charCodeAt(0)) % 997;
  }

  const initial = String(name).trim().charAt(0).toUpperCase() || "?";

  return `<span class="product-avatar" style="background:${AVATAR_COLORS[hash % AVATAR_COLORS.length]}">${esc(initial)}</span>`;
}

// TANGGAL

function dayKey(date) {
  return new Date(date).toLocaleDateString("en-CA");
}

function fromKey(key) {
  return new Date(key + "T00:00:00");
}

function todayKey() {
  return dayKey(new Date());
}

function daysAgoKey(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return dayKey(date);
}

function shortDate(key) {
  return fromKey(key).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// "Hari ini", "Kemarin", atau tanggal singkat.
function relativeDay(key) {
  if (key === todayKey()) return "Hari ini";
  if (key === daysAgoKey(1)) return "Kemarin";

  return shortDate(key);
}

function timeText(date) {
  return new Date(date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function dateCell(date) {
  return `
    <div class="date-cell">
      <strong>${esc(relativeDay(dayKey(date)))}</strong>
      <small>Pukul ${esc(timeText(date))}</small>
    </div>
  `;
}

function dayHeading(key) {
  const long = fromKey(key).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  if (key === todayKey()) return "Hari ini · " + long;
  if (key === daysAgoKey(1)) return "Kemarin · " + long;

  return long;
}

function dateTimeText(date) {
  return `${shortDate(dayKey(date))}, ${timeText(date)}`;
}

function inRange(key, range) {
  return (!range.from || key >= range.from) && (!range.to || key <= range.to);
}

function rangeLabel(range) {
  if (!range.from && !range.to) return "Semua tanggal";
  if (range.from === range.to) return relativeDay(range.from);

  const from = fromKey(range.from);
  const to = fromKey(range.to);
  const sameYear = from.getFullYear() === to.getFullYear();
  const start = from.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" })
  });

  return `${start} – ${shortDate(range.to)}`;
}

// PEMILIH TANGGAL

const MONTH_FORMAT = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function datePresets() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  return [
    ["Hari ini", todayKey(), todayKey()],
    ["Kemarin", daysAgoKey(1), daysAgoKey(1)],
    ["7 hari terakhir", daysAgoKey(6), todayKey()],
    ["30 hari terakhir", daysAgoKey(29), todayKey()],
    ["Bulan ini", dayKey(new Date(year, month, 1)), todayKey()],
    ["Bulan lalu", dayKey(new Date(year, month - 1, 1)), dayKey(new Date(year, month, 0))],
    ["Semua tanggal", null, null]
  ];
}

let openPicker = null;

function closeDatePicker() {
  if (!openPicker) return;

  openPicker.button.classList.remove("open");
  openPicker.popover.remove();
  openPicker = null;
}

// Tombol yang membuka kalender. mode "range" memilih dua tanggal, "single" satu tanggal.
function createDatePicker(button, options) {
  const picker = {
    mode: options.mode || "range",
    value: options.value,
    get range() {
      return this.mode === "single" ? { from: this.value, to: this.value } : this.value;
    },
    set(value) {
      this.value = value;
      renderButton();
    }
  };

  function renderButton() {
    const label = picker.mode === "single" ? dayHeading(picker.value) : rangeLabel(picker.value);

    button.innerHTML = `${icon("calendar")}<span>${esc(label)}</span>`;
  }

  function open() {
    closeDatePicker();

    const start = picker.range.to || picker.range.from || todayKey();
    const state = {
      month: fromKey(start.slice(0, 8) + "01"),
      first: null
    };
    const popover = document.createElement("div");

    popover.className = "date-popover";
    document.body.appendChild(popover);
    button.classList.add("open");
    openPicker = { button, popover };

    function choose(value) {
      picker.value = value;
      renderButton();
      closeDatePicker();
      options.onChange(value);
    }

    function draw() {
      const year = state.month.getFullYear();
      const month = state.month.getMonth();
      const gridStart = new Date(year, month, 1 - (state.month.getDay() + 6) % 7);
      const range = picker.range;
      const days = [];

      for (let i = 0; i < 42; i++) {
        const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
        const key = dayKey(date);
        const classes = [];
        const low = state.first || range.from;
        const high = state.first || range.to;

        if (date.getMonth() !== month) classes.push("outside");
        if (key === todayKey()) classes.push("today");
        if (key === low || key === high) classes.push("edge");
        else if (low && high && key > low && key < high) classes.push("between");

        days.push(`<button type="button" class="${classes.join(" ")}" data-day="${key}">${date.getDate()}</button>`);
      }

      const presets = picker.mode === "range" ? `
        <div class="date-presets">
          ${datePresets().map(([label, from, to], index) => `
            <button type="button" data-preset="${index}" class="${range.from === from && range.to === to ? "active" : ""}">${label}</button>
          `).join("")}
        </div>
      ` : "";

      popover.innerHTML = `
        ${presets}
        <div class="date-calendar">
          <div class="date-month">
            <button type="button" data-month="-1" aria-label="Bulan sebelumnya">${icon("left")}</button>
            <span>${esc(MONTH_FORMAT.format(state.month))}</span>
            <button type="button" data-month="1" aria-label="Bulan berikutnya">${icon("right")}</button>
          </div>
          <div class="date-grid">
            ${WEEKDAYS.map(day => `<span>${day}</span>`).join("")}
            ${days.join("")}
          </div>
          ${picker.mode === "range" ? `<p class="date-hint">${state.first ? "Pilih tanggal akhir" : "Pilih tanggal awal dan akhir"}</p>` : ""}
        </div>
      `;

      const rect = button.getBoundingClientRect();
      const box = popover.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left, document.documentElement.clientWidth - box.width - 8));
      const fitsBelow = rect.bottom + 6 + box.height <= window.innerHeight - 8;
      const top = fitsBelow ? rect.bottom + 6 : Math.max(8, window.innerHeight - box.height - 8);

      popover.style.left = left + "px";
      popover.style.top = top + "px";
    }

    popover.addEventListener("click", event => {
      const monthButton = event.target.closest("[data-month]");
      const dayButton = event.target.closest("[data-day]");
      const presetButton = event.target.closest("[data-preset]");

      if (monthButton) {
        state.month = new Date(
          state.month.getFullYear(),
          state.month.getMonth() + Number(monthButton.dataset.month),
          1
        );
        draw();
      }

      if (presetButton) {
        const [, from, to] = datePresets()[Number(presetButton.dataset.preset)];
        choose({ from, to });
      }

      if (dayButton) {
        const key = dayButton.dataset.day;

        if (picker.mode === "single") {
          choose(key);
        } else if (!state.first) {
          state.first = key;
          draw();
        } else {
          choose(key < state.first ? { from: key, to: state.first } : { from: state.first, to: key });
        }
      }
    });

    draw();
  }

  button.addEventListener("click", event => {
    event.stopPropagation();

    if (openPicker && openPicker.button === button) {
      closeDatePicker();
    } else {
      open();
    }
  });

  renderButton();

  return picker;
}

document.addEventListener("mousedown", event => {
  if (openPicker && !openPicker.popover.contains(event.target) && !openPicker.button.contains(event.target)) {
    closeDatePicker();
  }
});

window.addEventListener("resize", closeDatePicker);

// DIALOG

let confirmResolve = null;

// Keluar sedikit lebih cepat daripada masuk.
function hideWithExit(element) {
  if (element.classList.contains("hidden")) return;

  if (reducedMotion()) {
    element.classList.add("hidden");
    return;
  }

  element.classList.add("closing");
  clearTimeout(element.closeTimer);
  element.closeTimer = setTimeout(() => {
    element.classList.add("hidden");
    element.classList.remove("closing");
  }, 130);
}

function showElement(element) {
  clearTimeout(element.closeTimer);
  element.classList.remove("closing", "hidden");
}

function openDialog(id, focusElement) {
  showElement($(id));

  if (focusElement) focusElement.focus();
}

function closeDialog(id) {
  hideWithExit($(id));
  closeDatePicker();

  if (id === "receiptDialog") document.body.classList.remove("receipt-open");
}

function askConfirm(title, message, okLabel) {
  $("confirmTitle").textContent = title;
  $("confirmMessage").textContent = message;
  $("confirmOk").textContent = okLabel;
  showElement($("confirmDialog"));
  $("confirmCancel").focus();

  return new Promise(resolve => {
    confirmResolve = resolve;
  });
}

function finishConfirm(answer) {
  hideWithExit($("confirmDialog"));

  if (confirmResolve) confirmResolve(answer);
  confirmResolve = null;
}

$("confirmOk").addEventListener("click", () => finishConfirm(true));
$("confirmCancel").addEventListener("click", () => finishConfirm(false));

document.addEventListener("click", event => {
  const closeButton = event.target.closest("[data-close]");

  if (closeButton) {
    closeDialog(closeButton.closest(".dialog-backdrop").id);
    return;
  }

  // Klik di luar kotak menutup dialog.
  if (event.target.classList && event.target.classList.contains("dialog-backdrop")) {
    if (event.target.id === "confirmDialog") {
      finishConfirm(false);
    } else {
      closeDialog(event.target.id);
    }
  }

  const themeButton = event.target.closest("[data-theme-toggle]");

  if (themeButton) toggleTheme();

  const pageButton = event.target.closest("[data-page]");

  if (pageButton) showPage(pageButton.dataset.page);

  const actionButton = event.target.closest("[data-action]");

  if (actionButton) runEmptyAction(actionButton.dataset.action);

  const restockButton = event.target.closest("[data-restock]");

  if (restockButton) openRestock(restockButton.dataset.restock);
});

function runEmptyAction(action) {
  if (action === "add-product") {
    showPage("products");
    openProductForm();
  }
  if (action === "add-expense") openExpenseForm();
  if (action === "go-cashier") showPage("cashier");
}

// MASUK DAN KELUAR

function showAuth(mode, errorMessage = "", successMessage = "") {
  authMode = mode;

  const creating = mode === "setup" || mode === "register";
  const titles = { setup: "Buat akun pemilik", register: "Buat akun", login: "Masuk" };
  const subtitles = {
    setup: "Selamat datang! Akun ini akan mengelola seluruh usahamu.",
    register: `Daftar sebagai staf ${session.store.name}. Pemilik perlu menyetujui akunmu dulu.`,
    login: `Masuk untuk membuka kasir ${session.store.name}.`
  };

  $("appView").classList.add("hidden");
  $("authView").classList.remove("hidden");
  startAuthSlides();
  $("authTitle").textContent = titles[mode];
  $("authSubtitle").textContent = subtitles[mode];
  $("authNameField").classList.toggle("hidden", !creating);
  $("authHint").classList.toggle("hidden", !creating);
  $("authSubmit").textContent = creating ? "Buat akun" : "Masuk";
  $("authPassword").autocomplete = creating ? "new-password" : "current-password";
  $("authName").required = creating;
  $("authPassword").value = "";
  $("authError").textContent = errorMessage;
  $("authError").classList.toggle("hidden", !errorMessage);
  $("authSuccess").textContent = successMessage;
  $("authSuccess").classList.toggle("hidden", !successMessage);

  // Akun pemilik pertama tidak punya pilihan lain.
  $("authSwitch").classList.toggle("hidden", mode === "setup");
  $("authSwitchText").textContent = mode === "register" ? "Sudah punya akun?" : "Belum punya akun?";
  $("authSwitchButton").textContent = mode === "register" ? "Masuk" : "Buat akun";

  (creating ? $("authName") : $("authUsername")).focus();
}

$("authSwitchButton").addEventListener("click", () => {
  showAuth(authMode === "register" ? "login" : "register");
});

function leaveApp() {
  session.user = null;
  data = { products: [], transactions: [], expenses: [] };
  users = [];
  cart = [];
  pendingSaleId = null;
  currentPage = "";
  targetPage = "";
  dataLoaded = false;
  document.body.classList.remove("role-staff");
  document.body.classList.add("is-loading");
  pageLoadSequence++;
  $("pageLoader").classList.add("hidden");
  document.querySelectorAll(".dialog-backdrop").forEach(dialog => dialog.classList.add("hidden"));
  closeDatePicker();
}

function isOwner() {
  return session.user && session.user.role === "OWNER";
}

function allowedPages() {
  return isOwner() ? OWNER_PAGES : STAFF_PAGES;
}

async function enterApp(user) {
  session.user = user;
  showSplash("Menyiapkan data...");

  document.body.classList.toggle("role-staff", !isOwner());
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("userName").textContent = user.name;
  $("userRole").textContent = isOwner() ? "Pemilik" : "Staf";
  $("homeLink").href = "#" + allowedPages()[0];

  const hash = location.hash.slice(1);

  showPage(allowedPages().includes(hash) ? hash : allowedPages()[0]);

  try {
    await loadData();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    hideSplash();
  }
}

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("authSubmit");
  const body = {
    username: $("authUsername").value.trim(),
    password: $("authPassword").value
  };

  if (authMode !== "login") body.name = $("authName").value.trim();

  button.disabled = true;

  try {
    if (authMode === "register") {
      await api("/api/register", "POST", body);
      showAuth("login", "", "Akun berhasil dibuat. Kamu bisa masuk setelah pemilik menyetujuinya.");
      return;
    }

    const result = await api(authMode === "setup" ? "/api/setup" : "/api/login", "POST", body);

    $("authPassword").value = "";
    await enterApp(result.user);
  } catch (error) {
    $("authSuccess").classList.add("hidden");
    $("authError").textContent = error.message;
    $("authError").classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
});

$("logoutButton").addEventListener("click", async () => {
  try {
    await api("/api/logout", "POST", {});
  } finally {
    leaveApp();
    showAuth("login");
  }
});

// NAVIGASI

function showPage(pageName) {
  if (!allowedPages().includes(pageName)) return Promise.resolve();

  const changed = targetPage !== pageName;
  const firstPage = !currentPage;

  targetPage = pageName;

  const apply = () => {
    // Saat menu diklik cepat, hanya pilihan terakhir yang diterapkan.
    if (targetPage !== pageName) return;

    document.querySelectorAll(".page").forEach(page => {
      page.classList.toggle("active", page.id === pageName);
    });

    document.querySelectorAll(".nav-button").forEach(button => {
      button.classList.toggle("active", button.dataset.page === pageName);
    });

    currentPage = pageName;
    toggleCartSheet(false);

    if (location.hash.slice(1) !== pageName) {
      history.replaceState(null, "", "#" + pageName);
    }

    if (changed) window.scrollTo({ top: 0, behavior: "instant" });

    moveNavPill();
    renderAll();

    if (changed && !firstPage && dataLoaded) refreshPage();

    if (pageName === "settings") {
      fillStoreForm();
      loadUsers();
    }
  };

  if (!changed || firstPage) {
    apply();
    return Promise.resolve();
  }

  const transition = startTransition(apply);

  return transition ? transition.updateCallbackDone.catch(() => {}) : Promise.resolve();
}

window.addEventListener("hashchange", () => {
  if (session.user) showPage(location.hash.slice(1));
});

// MENGHITUNG TRANSAKSI

function transactionSubtotal(transaction) {
  return transaction.items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);
}

function transactionTotal(transaction) {
  return transactionSubtotal(transaction) - transaction.discount;
}

function transactionProfit(transaction) {
  const profit = transaction.items.reduce((sum, item) => {
    return sum + (item.price - item.cost) * item.quantity;
  }, 0);

  return profit - transaction.discount;
}

// Transaksi yang dibatalkan tidak dihitung dalam angka apa pun.
function activeTransactions() {
  return data.transactions.filter(tx => !tx.cancelledAt);
}

function transactionsIn(range) {
  return activeTransactions().filter(tx => inRange(dayKey(tx.date), range));
}

function sumTotals(transactions) {
  return transactions.reduce((sum, tx) => sum + transactionTotal(tx), 0);
}

function sumProfits(transactions) {
  return transactions.reduce((sum, tx) => sum + transactionProfit(tx), 0);
}

function sumExpenses(expenses) {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

// Menjumlahkan barang terjual per nama produk, terbanyak lebih dulu.
function productSales(transactions) {
  const rows = new Map();

  transactions.forEach(tx => {
    tx.items.forEach(item => {
      const row = rows.get(item.name) || { name: item.name, quantity: 0, revenue: 0, profit: 0 };

      row.quantity += item.quantity;
      row.revenue += item.price * item.quantity;
      row.profit += (item.price - item.cost) * item.quantity;

      rows.set(item.name, row);
    });
  });

  return [...rows.values()].sort((a, b) => b.quantity - a.quantity);
}

function categories() {
  const names = data.products.map(product => product.category).filter(Boolean);

  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

function itemSummary(tx) {
  return tx.items.map(item => `${esc(item.name)} × ${item.quantity}`).join(", ");
}

// Perbandingan dengan periode sebelumnya, misalnya "▲ 12% dari 7 hari sebelumnya".
function trendHtml(current, previous, label) {
  if (previous === 0) {
    return current > 0 ? `<span class="trend up">▲ Naik</span> dari nol` : "Belum ada data";
  }

  const percent = Math.round((current - previous) / Math.abs(previous) * 100);

  if (percent === 0) return esc(`Sama dengan ${label.replace(/^dari /, "")}`);

  const up = percent > 0;

  return `<span class="trend ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(percent)}%</span> ${esc(label)}`;
}

// DASHBOARD

function greetingText() {
  const hour = new Date().getHours();

  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

function renderDashboard() {
  const week = { from: daysAgoKey(6), to: todayKey() };
  const lastWeek = { from: daysAgoKey(13), to: daysAgoKey(7) };
  const thisWeekSales = transactionsIn(week);
  const lastWeekSales = transactionsIn(lastWeek);
  const todaySales = transactionsIn({ from: todayKey(), to: todayKey() });
  const yesterdaySales = transactionsIn({ from: daysAgoKey(1), to: daysAgoKey(1) });
  const label = "dari 7 hari sebelumnya";

  $("greeting").textContent = `${greetingText()}, ${session.user.name.split(" ")[0]}`;
  setMoney("todayRevenue", sumTotals(todaySales));
  $("todayTrend").innerHTML = trendHtml(sumTotals(todaySales), sumTotals(yesterdaySales), "dari kemarin");
  setMoney("weekRevenue", sumTotals(thisWeekSales));
  $("weekTrend").innerHTML = trendHtml(sumTotals(thisWeekSales), sumTotals(lastWeekSales), label);
  setMoney("weekProfit", sumProfits(thisWeekSales));
  $("profitTrend").innerHTML = trendHtml(sumProfits(thisWeekSales), sumProfits(lastWeekSales), label);
  setCount("weekCount", thisWeekSales.length);
  $("countTrend").innerHTML = trendHtml(thisWeekSales.length, lastWeekSales.length, label);

  // Dua jam per titik untuk hari ini, satu hari per titik untuk 7 hari.
  const lastDays = [6, 5, 4, 3, 2, 1, 0].map(ago => transactionsIn({ from: daysAgoKey(ago), to: daysAgoKey(ago) }));

  renderSpark("sparkToday", Array.from({ length: 12 }, (unused, slot) => {
    return sumTotals(todaySales.filter(tx => Math.floor(new Date(tx.date).getHours() / 2) === slot));
  }));
  renderSpark("sparkRevenue", lastDays.map(sumTotals));
  renderSpark("sparkProfit", lastDays.map(sumProfits));
  renderSpark("sparkCount", lastDays.map(day => day.length));

  const latest = [...activeTransactions()].reverse().slice(0, 5);

  $("recentTransactions").innerHTML = latest.map(tx => `
    <tr>
      <td>${dateCell(tx.date)}</td>
      <td>${itemSummary(tx)}</td>
      <td class="nowrap"><strong>${money(transactionTotal(tx))}</strong></td>
    </tr>
  `).join("") || tableEmpty(3, "Belum ada transaksi.");

  const top = productSales(activeTransactions()).slice(0, 5);

  $("topProducts").innerHTML = top.map(row => `
    <tr>
      <td><div class="product-cell">${avatar(row.name)}<strong>${esc(row.name)}</strong></div></td>
      <td>${row.quantity}</td>
      <td class="nowrap">${money(row.revenue)}</td>
    </tr>
  `).join("") || tableEmpty(3, "Belum ada penjualan.");

  const lowStock = data.products
    .filter(product => product.stock <= LOW_STOCK)
    .sort((a, b) => a.stock - b.stock);

  $("lowStockRows").innerHTML = lowStock.map(product => `
    <tr>
      <td><div class="product-cell">${avatar(product.name)}<strong>${esc(product.name)}</strong></div></td>
      <td><span class="tag warning">${product.stock}</span></td>
      <td><button class="action-button" data-restock="${esc(product.id)}">Restok</button></td>
    </tr>
  `).join("") || tableEmpty(3, data.products.length ? "Semua stok aman." : "Belum ada produk.");

  drawChart();
}

// GRAFIK PENJUALAN

const CHART_METRICS = {
  revenue: { label: "Omzet", value: sumTotals, format: money },
  profit: { label: "Keuntungan kotor", value: sumProfits, format: money },
  count: { label: "Transaksi", value: rows => rows.length, format: value => value + " transaksi" }
};

function chartRange() {
  if (chartState.period === "month") return monthRange();

  return { from: daysAgoKey(Number(chartState.period) - 1), to: todayKey() };
}

// Satu nilai per hari dalam rentang tanggal.
function chartSeries(range, metric) {
  const byDay = new Map();

  activeTransactions().forEach(tx => {
    const key = dayKey(tx.date);

    if (inRange(key, range)) {
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(tx);
    }
  });

  const points = [];

  for (const date = fromKey(range.from); dayKey(date) <= range.to; date.setDate(date.getDate() + 1)) {
    const key = dayKey(date);

    points.push({ key, value: metric.value(byDay.get(key) || []) });
  }

  return points;
}

// Batas atas yang enak dibaca dan membagi rata ke empat garis.
function niceMax(value) {
  if (value <= 0) return 1;

  const size = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find(option => option * size >= value);

  return step * size;
}

// Garis melengkung halus yang tidak melewati nilai aslinya.
function smoothPath(points) {
  return points.map((point, index) => {
    if (index === 0) return `M${point.x},${point.y}`;

    const before = points[index - 1];
    const middle = (before.x + point.x) / 2;

    return `C${middle},${before.y} ${middle},${point.y} ${point.x},${point.y}`;
  }).join(" ");
}

function renderChartSummary(current, previous, metric) {
  const total = current.reduce((sum, point) => sum + point.value, 0);
  const previousTotal = previous.reduce((sum, point) => sum + point.value, 0);
  const best = current.reduce((top, point) => (point.value > top.value ? point : top), current[0]);
  const average = Math.round(total / current.length);
  const format = metric.format;

  $("chartSummary").innerHTML = `
    <div>
      <small>Total ${esc(metric.label.toLowerCase())}</small>
      <strong>${esc(format(total))}</strong>
      <small>${trendHtml(total, previousTotal, "dari periode sebelumnya")}</small>
    </div>
    <div>
      <small>Rata-rata per hari</small>
      <strong>${esc(format(average))}</strong>
      <small>Selama ${current.length} hari</small>
    </div>
    <div>
      <small>Hari terbaik</small>
      <strong>${best.value > 0 ? esc(format(best.value)) : "-"}</strong>
      <small>${best.value > 0 ? esc(relativeDay(best.key)) : "Belum ada penjualan"}</small>
    </div>
  `;
}

function drawChart() {
  const chart = $("salesChart");
  const width = chart.clientWidth;

  // Halaman sedang tersembunyi: digambar saat dibuka.
  if (!width) return;

  const metric = CHART_METRICS[chartState.metric];
  const range = chartRange();
  const before = previousRange(range);
  const current = chartSeries(range, metric);
  const previous = chartSeries(before, metric);
  const compare = chartState.compare;

  $("chartSubtitle").textContent = rangeLabel(range);
  renderChartSummary(current, previous, metric);

  const animate = chartState.animate;

  chartState.animate = false;

  if (current.every(point => point.value === 0) && previous.every(point => point.value === 0)) {
    chart.innerHTML = emptyState(
      "chart",
      "Belum ada penjualan",
      "Grafik akan muncul setelah transaksi dicatat.",
      "Buka kasir",
      "go-cashier"
    );
    return;
  }

  const phone = width < 520;
  const height = phone ? 210 : 270;
  const pad = { left: phone ? 40 : 54, right: 10, top: 12, bottom: 26 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const peak = Math.max(...current.map(point => point.value), ...(compare ? previous.map(point => point.value) : [0]));
  const top = niceMax(peak);
  const low = Math.min(0, ...current.map(point => point.value));
  const xFor = index => pad.left + (current.length > 1 ? index / (current.length - 1) * plotWidth : plotWidth / 2);
  const yFor = value => pad.top + (1 - (value - low) / (top - low)) * plotHeight;
  const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });

  const line = current.map((point, index) => ({ x: xFor(index), y: yFor(point.value) }));
  const pastLine = previous.slice(0, current.length).map((point, index) => ({ x: xFor(index), y: yFor(point.value) }));
  const baseline = yFor(Math.max(0, low));
  const area = `${smoothPath(line)} L${line[line.length - 1].x},${baseline} L${line[0].x},${baseline} Z`;

  const grid = [0, 0.25, 0.5, 0.75, 1].map(part => {
    const value = low + (top - low) * part;
    const y = yFor(value);

    return `
      <line class="chart-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${y}" y2="${y}" />
      <text class="chart-axis" x="${pad.left - 8}" y="${y + 4}" text-anchor="end">${esc(compact.format(value))}</text>
    `;
  }).join("");

  const maxLabels = Math.max(2, Math.floor(plotWidth / (phone ? 62 : 74)));
  const labelEvery = Math.max(1, Math.ceil(current.length / maxLabels));
  const labels = current.map((point, index) => {
    const fromEnd = current.length - 1 - index;

    if (fromEnd % labelEvery !== 0) return "";

    const text = fromKey(point.key).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    const anchor = index === current.length - 1 ? "end" : index === 0 ? "start" : "middle";

    return `<text class="chart-axis${point.key === todayKey() ? " today" : ""}" x="${xFor(index)}" y="${height - 6}" text-anchor="${anchor}">${esc(text)}</text>`;
  }).join("");

  chart.innerHTML = `
    <div class="line-chart ${animate ? "animate" : ""}">
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"
        aria-label="${esc(metric.label)} ${esc(rangeLabel(range))}">
        ${grid}
        ${labels}
        <path class="chart-area" d="${area}" />
        ${compare ? `<path class="chart-line-past" d="${smoothPath(pastLine)}" />` : ""}
        <path class="chart-line" d="${smoothPath(line)}" pathLength="1" />
        <line class="chart-cursor hidden" y1="${pad.top}" y2="${baseline}" />
        ${compare ? `<circle class="chart-dot-past hidden" r="3.5" />` : ""}
        <circle class="chart-dot hidden" r="4.5" />
      </svg>
      <div class="chart-tooltip hidden"></div>
    </div>
  `;

  const box = chart.querySelector(".line-chart");
  const cursor = chart.querySelector(".chart-cursor");
  const dot = chart.querySelector(".chart-dot");
  const pastDot = chart.querySelector(".chart-dot-past");
  const tooltip = chart.querySelector(".chart-tooltip");

  function showPoint(clientX) {
    const offset = clientX - box.getBoundingClientRect().left;
    const ratio = current.length > 1 ? (offset - pad.left) / plotWidth : 0;
    const index = Math.max(0, Math.min(current.length - 1, Math.round(ratio * (current.length - 1))));
    const point = current[index];
    const past = previous[index];

    cursor.setAttribute("x1", line[index].x);
    cursor.setAttribute("x2", line[index].x);
    dot.setAttribute("cx", line[index].x);
    dot.setAttribute("cy", line[index].y);

    if (pastDot && pastLine[index]) {
      pastDot.setAttribute("cx", pastLine[index].x);
      pastDot.setAttribute("cy", pastLine[index].y);
      pastDot.classList.remove("hidden");
    }

    const date = fromKey(point.key).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
    const pastDate = past ? shortDate(past.key) : "";

    tooltip.innerHTML = `
      <small>${esc(date)}</small>
      <strong>${esc(metric.format(point.value))}</strong>
      ${compare && past ? `<small>${esc(pastDate)}: ${esc(metric.format(past.value))}</small>` : ""}
    `;

    cursor.classList.remove("hidden");
    dot.classList.remove("hidden");
    tooltip.classList.remove("hidden");

    // Tooltip tetap di dalam grafik.
    const tipWidth = tooltip.offsetWidth;
    const tipLeft = Math.max(0, Math.min(width - tipWidth, line[index].x - tipWidth / 2));

    tooltip.style.transform = `translateX(${tipLeft}px)`;
  }

  function hidePoint() {
    [cursor, dot, pastDot, tooltip].forEach(element => element && element.classList.add("hidden"));
  }

  // Sentuhan di HP: ketuk atau geser ke samping. Tooltip tetap tampil setelah jari diangkat.
  box.addEventListener("pointerdown", event => showPoint(event.clientX));
  box.addEventListener("pointermove", event => showPoint(event.clientX));
  box.addEventListener("pointerleave", event => {
    if (event.pointerType === "mouse") hidePoint();
  });
}

function setChartOption(group, attribute, value) {
  group.querySelectorAll(".chip").forEach(chip => {
    chip.classList.toggle("active", chip.getAttribute(attribute) === value);
  });

  chartState.animate = true;
  drawChart();
}

$("chartMetric").addEventListener("click", event => {
  const button = event.target.closest("[data-metric]");

  if (button) {
    chartState.metric = button.dataset.metric;
    setChartOption($("chartMetric"), "data-metric", chartState.metric);
  }
});

$("chartPeriod").addEventListener("click", event => {
  const button = event.target.closest("[data-period]");

  if (button) {
    chartState.period = button.dataset.period;
    setChartOption($("chartPeriod"), "data-period", chartState.period);
  }
});

$("chartCompare").addEventListener("click", () => {
  chartState.compare = !chartState.compare;
  chartState.animate = false;
  $("chartCompare").classList.toggle("active", chartState.compare);
  $("chartCompare").setAttribute("aria-pressed", String(chartState.compare));
  drawChart();
});

let chartResizeFrame = 0;
let chartWidth = 0;

window.addEventListener("resize", () => {
  cancelAnimationFrame(chartResizeFrame);
  chartResizeFrame = requestAnimationFrame(() => {
    const width = $("salesChart").clientWidth;

    // Di HP, bilah alamat yang muncul-hilang hanya mengubah tinggi: tidak perlu menggambar ulang.
    if (width && width !== chartWidth && session.user && dataLoaded) drawChart();

    chartWidth = width;
  });
});

// PRODUK

function renderProducts() {
  const search = $("productSearch").value.trim().toLowerCase();
  const filter = $("productCategoryFilter");
  const selected = filter.value;
  const names = categories();

  filter.innerHTML = `<option value="">Semua kategori</option>` + names.map(name => `
    <option value="${esc(name)}">${esc(name)}</option>
  `).join("");
  filter.value = names.includes(selected) ? selected : "";

  $("categoryOptions").innerHTML = names.map(name => `
    <option value="${esc(name)}"></option>
  `).join("");

  const products = data.products.filter(product => {
    const matches = product.name.toLowerCase().includes(search)
      || (product.barcode || "").toLowerCase().includes(search);

    return matches && (!filter.value || product.category === filter.value);
  });

  $("productRows").innerHTML = products.map(product => `
    <tr>
      <td>
        <div class="product-cell">
          ${avatar(product.name)}
          <div>
            <strong>${esc(product.name)}</strong>
            ${product.barcode ? `<small>${esc(product.barcode)}</small>` : ""}
          </div>
        </div>
      </td>
      <td data-label="Kategori">${product.category ? `<span class="tag">${esc(product.category)}</span>` : `<span class="muted-text">-</span>`}</td>
      <td class="nowrap" data-label="Harga jual">${money(product.price)}</td>
      <td class="nowrap owner-only" data-label="Modal">${money(product.cost)}</td>
      <td data-label="Stok">
        ${product.stock <= LOW_STOCK ? `<span class="tag warning">${product.stock}</span>` : product.stock}
      </td>
      <td class="nowrap owner-only row-actions">
        <button class="action-button" data-restock="${esc(product.id)}">Restok</button>
        <button class="action-button" data-history="${esc(product.id)}">Riwayat</button>
        <button class="action-button" data-edit="${esc(product.id)}">Edit</button>
        <button class="action-button delete" data-delete="${esc(product.id)}">Hapus</button>
      </td>
    </tr>
  `).join("");

  if (products.length) {
    $("productEmpty").innerHTML = "";
  } else if (data.products.length === 0 && isOwner()) {
    $("productEmpty").innerHTML = emptyState(
      "box",
      "Belum ada produk",
      "Tambahkan produk pertamamu untuk mulai berjualan.",
      "Tambah produk",
      "add-product"
    );
  } else {
    $("productEmpty").innerHTML = `<p class="empty-message">Produk tidak ditemukan.</p>`;
  }
}

function openProductForm(product = null) {
  editingId = product ? product.id : null;

  $("productForm").reset();

  $("dialogTitle").textContent = product ? "Edit produk" : "Tambah produk";
  $("productId").value = product ? product.id : "";
  $("productName").value = product ? product.name : "";
  $("productCategory").value = product && product.category ? product.category : "";
  $("productBarcode").value = product && product.barcode ? product.barcode : "";
  $("productPrice").value = product ? product.price : "";
  $("productCost").value = product ? product.cost : "";
  $("productStock").value = product ? product.stock : 0;

  openDialog("productDialog", $("productName"));
}

$("productForm").addEventListener("submit", async function(event) {
  event.preventDefault();

  const name = $("productName").value.trim();
  const price = Number($("productPrice").value);
  const cost = Number($("productCost").value);
  const stock = Number($("productStock").value);

  if (
    !name ||
    !Number.isFinite(price) || price < 0 ||
    !Number.isFinite(cost) || cost < 0 ||
    !Number.isInteger(stock) || stock < 0
  ) {
    showToast("Periksa kembali data produk.", true);
    return;
  }

  const duplicate = data.products.some(product => {
    return product.name.toLowerCase() === name.toLowerCase()
      && product.id !== editingId;
  });

  if (duplicate) {
    showToast("Nama produk sudah digunakan.", true);
    return;
  }

  const product = {
    name,
    category: $("productCategory").value.trim(),
    barcode: $("productBarcode").value.trim(),
    price,
    cost,
    stock
  };

  const saved = await runAction(() => {
    return editingId
      ? api(`/api/products/${encodeURIComponent(editingId)}`, "PUT", product)
      : api("/api/products", "POST", product);
  }, editingId ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan.");

  if (saved) closeDialog("productDialog");
});

// EDIT, HAPUS, DAN RIWAYAT PRODUK

$("productRows").addEventListener("click", async function(event) {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  const historyButton = event.target.closest("[data-history]");

  if (editButton) {
    openProductForm(data.products.find(item => item.id === editButton.dataset.edit));
  }

  if (historyButton) {
    openStockHistory(historyButton.dataset.history);
  }

  if (deleteButton) {
    const id = deleteButton.dataset.delete;
    const product = data.products.find(item => item.id === id);
    const sure = await askConfirm(
      "Hapus produk?",
      `"${product.name}" akan dihapus dari katalog. Riwayat transaksinya tetap tersimpan.`,
      "Hapus produk"
    );

    if (sure) {
      pendingSaleId = null;
      await runAction(() => api(`/api/products/${encodeURIComponent(id)}`, "DELETE"), "Produk berhasil dihapus.");
    }
  }
});

// RESTOK

function openRestock(id) {
  const product = data.products.find(item => item.id === id);

  if (!product) return;

  restockId = id;

  $("restockForm").reset();
  $("restockTitle").textContent = `Restok ${product.name}`;
  $("restockCurrent").textContent = `Stok sekarang: ${product.stock}`;

  openDialog("restockDialog", $("restockQuantity"));
}

$("restockForm").addEventListener("submit", async event => {
  event.preventDefault();

  const quantity = Number($("restockQuantity").value);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    showToast("Jumlah restok harus lebih dari 0.", true);
    return;
  }

  const saved = await runAction(() => {
    return api(`/api/products/${encodeURIComponent(restockId)}/restock`, "POST", {
      quantity,
      note: $("restockNote").value.trim()
    });
  }, "Stok berhasil ditambahkan.");

  if (saved) closeDialog("restockDialog");
});

// RIWAYAT STOK

async function openStockHistory(productId = null) {
  const product = data.products.find(item => item.id === productId);

  $("stockTitle").textContent = product ? `Riwayat stok ${product.name}` : "Riwayat stok";
  $("stockRows").innerHTML = tableEmpty(6, "Memuat...");
  openDialog("stockDialog");

  try {
    const query = productId ? `?productId=${encodeURIComponent(productId)}` : "";
    const { movements } = await api("/api/stock-movements" + query);

    $("stockRows").innerHTML = movements.map(row => {
      const [label, tone] = REASONS[row.reason] || [row.reason, ""];

      return `
        <tr>
          <td>${dateCell(row.createdAt)}</td>
          <td>
            <strong>${esc(row.productName)}</strong>
            ${row.note ? `<div class="id-text">${esc(row.note)}</div>` : ""}
          </td>
          <td><span class="tag ${tone}">${esc(label)}</span></td>
          <td class="${row.change > 0 ? "positive" : "negative"}">${row.change > 0 ? "+" : ""}${row.change}</td>
          <td>${row.stockAfter}</td>
          <td class="muted-text nowrap">${esc(row.userName || "-")}</td>
        </tr>
      `;
    }).join("") || tableEmpty(6, "Belum ada perubahan stok.");
  } catch (error) {
    $("stockRows").innerHTML = tableEmpty(6, error.message);
  }
}

$("stockHistoryButton").addEventListener("click", () => openStockHistory());

// KASIR

function cashierMatches() {
  const search = $("cashierSearch").value.trim().toLowerCase();

  return data.products.filter(product => {
    const matches = product.name.toLowerCase().includes(search)
      || (product.barcode || "").toLowerCase().includes(search);

    return matches && (!cashierCategory || product.category === cashierCategory);
  });
}

function renderCashierProducts() {
  const names = categories();

  if (!names.includes(cashierCategory)) {
    cashierCategory = "";
  }

  $("cashierCategories").innerHTML = names.length === 0 ? "" : [
    `<button type="button" class="chip ${cashierCategory === "" ? "active" : ""}" data-category="">Semua</button>`,
    ...names.map(name => `
      <button type="button" class="chip ${cashierCategory === name ? "active" : ""}" data-category="${esc(name)}">${esc(name)}</button>
    `)
  ].join("");

  const products = cashierMatches();

  $("cashierProducts").innerHTML = products.map(product => {
    const low = product.stock > 0 && product.stock <= LOW_STOCK;

    return `
      <button class="product-choice" data-add="${esc(product.id)}" ${product.stock <= 0 ? "disabled" : ""}>
        ${avatar(product.name)}
        <span class="product-info">
          <strong>${esc(product.name)}</strong>
          <span class="price">${money(product.price)}</span>
          <small class="${low ? "low" : ""}">${product.stock <= 0 ? "Stok habis" : "Stok: " + product.stock}</small>
        </span>
      </button>
    `;
  }).join("");

  if (products.length) {
    $("cashierEmpty").innerHTML = "";
  } else if (data.products.length === 0) {
    $("cashierEmpty").innerHTML = isOwner()
      ? emptyState("box", "Belum ada produk", "Tambahkan produk dulu sebelum mulai menjual.", "Tambah produk", "add-product")
      : emptyState("box", "Belum ada produk", "Minta pemilik menambahkan produk.");
  } else {
    $("cashierEmpty").innerHTML = `<p class="empty-message">Produk tidak ditemukan.</p>`;
  }
}

function addToCart(id) {
  const product = data.products.find(item => item.id === id);

  if (!product || product.stock <= 0) return;

  pendingSaleId = null;

  const item = cart.find(row => row.productId === id);

  if (item) {
    if (item.quantity >= product.stock) {
      showToast("Jumlah melebihi stok.", true);
      return;
    }

    item.quantity++;
    cartFlash = { id, isNew: false };
  } else {
    cart.push({
      productId: id,
      quantity: 1
    });
    cartFlash = { id, isNew: true };
  }

  renderCart();
}

function changeQuantity(id, amount) {
  const item = cart.find(row => row.productId === id);
  const product = data.products.find(row => row.id === id);

  if (!item || !product) return;

  pendingSaleId = null;

  item.quantity += amount;

  if (item.quantity <= 0) {
    cart = cart.filter(row => row.productId !== id);
  } else if (item.quantity > product.stock) {
    item.quantity = product.stock;
    showToast("Jumlah sudah mencapai stok yang tersedia.", true);
  } else {
    cartFlash = { id, isNew: false };
  }

  renderCart();
}

function cartSubtotal() {
  return cart.reduce((sum, item) => {
    const product = data.products.find(row => row.id === item.productId);

    return sum + (product ? product.price * item.quantity : 0);
  }, 0);
}

function cartDiscount() {
  return Number($("discountInput").value) || 0;
}

function cartTotal() {
  return Math.max(0, cartSubtotal() - cartDiscount());
}

function renderCart() {
  let count = 0;

  $("cartItems").innerHTML = cart.map(item => {
    const product = data.products.find(row => row.id === item.productId);

    if (!product) return "";

    count += item.quantity;

    const flash = cartFlash && cartFlash.id === product.id ? cartFlash : null;

    return `
      <div class="cart-row ${flash && flash.isNew ? "just-added" : ""}">
        <div>
          <strong>${esc(product.name)}</strong>
          <small>${money(product.price)} × ${item.quantity}</small>
        </div>

        <div class="quantity">
          <button data-minus="${esc(product.id)}" aria-label="Kurangi">−</button>
          <span class="${flash && !flash.isNew ? "qty-pop" : ""}">${item.quantity}</span>
          <button data-plus="${esc(product.id)}" aria-label="Tambah">+</button>
        </div>
      </div>
    `;
  }).join("");

  if (cart.length === 0) {
    $("cartItems").innerHTML = `
      <p class="empty-message">Keranjang masih kosong.</p>
    `;
  }

  cartFlash = null;

  $("cartCount").textContent = `${count} item`;
  $("cartBarCount").textContent = `${count} item`;
  $("cartBarTotal").textContent = money(cartTotal());
  document.body.classList.toggle("has-cart-items", cart.length > 0 && currentPage === "cashier");

  $("completeSaleButton").disabled = cart.length === 0;

  updateChange();
}

function updateChange() {
  const payment = Number($("paymentInput").value) || 0;

  setMoney("cartSubtotal", cartSubtotal());
  setMoney("cartTotal", cartTotal());
  $("cartBarTotal").textContent = money(cartTotal());
  setMoney("changeTotal", Math.max(0, payment - cartTotal()));
}

function setPaymentMethod(method) {
  paymentMethod = method;
  pendingSaleId = null;

  document.querySelectorAll("#paymentMethods .chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.method === method);
  });

  // QRIS dan transfer selalu pas, jadi tidak perlu uang diterima.
  $("cashFields").style.display = method === "TUNAI" ? "block" : "none";
}

function resetSaleForm() {
  cart = [];
  pendingSaleId = null;
  $("paymentInput").value = "";
  $("discountInput").value = "";
  setPaymentMethod("TUNAI");
}

// Di HP, keranjang terbuka dari bawah layar.
function toggleCartSheet(open) {
  document.body.classList.toggle("cart-open", open);
}

$("cartBar").addEventListener("click", () => toggleCartSheet(true));
$("cartClose").addEventListener("click", () => toggleCartSheet(false));
$("cartBackdrop").addEventListener("click", () => toggleCartSheet(false));

// Pemindai barcode mengetik lalu menekan Enter.
$("cashierSearch").addEventListener("keydown", event => {
  if (event.key !== "Enter") return;

  event.preventDefault();

  const value = $("cashierSearch").value.trim();

  if (!value) return;

  const exact = data.products.find(product => {
    return product.barcode === value || product.name.toLowerCase() === value.toLowerCase();
  });
  const matches = cashierMatches();
  const product = exact || (matches.length === 1 ? matches[0] : null);

  if (!product) {
    showToast("Produk tidak ditemukan.", true);
    return;
  }

  if (product.stock <= 0) {
    showToast(`Stok ${product.name} habis.`, true);
    return;
  }

  addToCart(product.id);
  $("cashierSearch").value = "";
  renderCashierProducts();
});

// TOMBOL KATEGORI DI KASIR

$("cashierCategories").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");

  if (button) {
    cashierCategory = button.dataset.category;
    renderCashierProducts();
  }
});

// TOMBOL PILIH PRODUK DI KASIR

$("cashierProducts").addEventListener("click", event => {
  const button = event.target.closest("[data-add]");

  if (button) {
    addToCart(button.dataset.add);
  }
});

// TOMBOL JUMLAH PRODUK DI KERANJANG

$("cartItems").addEventListener("click", event => {
  const minus = event.target.closest("[data-minus]");
  const plus = event.target.closest("[data-plus]");

  if (minus) {
    changeQuantity(minus.dataset.minus, -1);
  }

  if (plus) {
    changeQuantity(plus.dataset.plus, 1);
  }
});

// METODE PEMBAYARAN, DISKON, DAN UANG CEPAT

$("paymentMethods").addEventListener("click", event => {
  const button = event.target.closest("[data-method]");

  if (button) {
    setPaymentMethod(button.dataset.method);
  }
});

$("discountInput").addEventListener("input", () => {
  pendingSaleId = null;
  updateChange();
});

$("quickCash").addEventListener("click", event => {
  const button = event.target.closest("[data-cash]");

  if (button) {
    $("paymentInput").value = button.dataset.cash === "exact" ? cartTotal() : button.dataset.cash;
    updateChange();
  }
});

// MENGHITUNG KEMBALIAN

$("paymentInput").addEventListener("input", updateChange);

// MENGOSONGKAN KERANJANG

$("emptyCartButton").addEventListener("click", async () => {
  if (cart.length === 0) return;

  const sure = await askConfirm("Kosongkan keranjang?", "Semua barang di keranjang akan dikeluarkan.", "Kosongkan");

  if (sure) {
    resetSaleForm();
    renderCart();
  }
});

// MENYELESAIKAN TRANSAKSI

$("completeSaleButton").addEventListener("click", async () => {
  if (cart.length === 0) return;

  const discount = cartDiscount();

  if (!Number.isFinite(discount) || discount < 0 || discount > cartSubtotal()) {
    showToast("Diskon melebihi total belanja.", true);
    return;
  }

  const payment = Number($("paymentInput").value);

  if (paymentMethod === "TUNAI" && (!Number.isFinite(payment) || payment < cartTotal())) {
    showToast("Uang yang diterima belum mencukupi.", true);
    $("paymentInput").focus();
    return;
  }

  // ID yang sama dipakai saat mengulang, sehingga transaksi tidak tersimpan dua kali.
  pendingSaleId = pendingSaleId || makeId("TRX");

  const saleId = pendingSaleId;

  $("completeSaleButton").disabled = true;

  try {
    // Server memeriksa harga dan stok, lalu menyimpan transaksi dan mengurangi stok.
    await api("/api/sales", "POST", {
      id: saleId,
      paymentMethod,
      discount,
      payment,
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }))
    });

    resetSaleForm();
    toggleCartSheet(false);

    await loadData();

    showToast("Transaksi berhasil disimpan.");
    openReceipt(saleId);
  } catch (error) {
    $("completeSaleButton").disabled = false;
    showToast(error.message, true);
  }
});

// STRUK

function openReceipt(id) {
  const tx = data.transactions.find(row => row.id === id);

  if (!tx) return;

  const store = session.store;
  const line = (label, value) => `
    <div class="receipt-line"><span>${label}</span><span>${value}</span></div>
  `;

  $("receiptContent").innerHTML = `
    <div class="receipt-head">
      ${store.logo ? `<img src="${esc(store.logo)}" alt="" />` : ""}
      <strong>${esc(store.name)}</strong>
      ${store.address ? `<small>${esc(store.address)}</small>` : ""}
      ${store.phone ? `<small>${esc(store.phone)}</small>` : ""}
      <small>${esc(dateTimeText(tx.date))}</small>
      <small>${esc(tx.id)}</small>
      ${tx.cashierName ? `<small>Kasir: ${esc(tx.cashierName)}</small>` : ""}
    </div>

    <div class="receipt-items">
      ${tx.items.map(item => `
        <div class="receipt-item">
          <div>${esc(item.name)}</div>
          <div class="receipt-line">
            <small>${item.quantity} × ${money(item.price)}</small>
            <span>${money(item.price * item.quantity)}</span>
          </div>
        </div>
      `).join("")}
    </div>

    <div class="receipt-totals">
      ${tx.discount > 0 ? line("Subtotal", money(transactionSubtotal(tx))) : ""}
      ${tx.discount > 0 ? line("Diskon", "-" + money(tx.discount)) : ""}
      <div class="receipt-line receipt-grand">
        <span>Total</span><span>${money(transactionTotal(tx))}</span>
      </div>
      ${line(esc(METHOD_NAMES[tx.paymentMethod]), money(tx.payment))}
      ${tx.paymentMethod === "TUNAI" ? line("Kembalian", money(tx.change)) : ""}
    </div>

    ${tx.cancelledAt ? `<p class="receipt-stamp">TRANSAKSI DIBATALKAN</p>` : ""}
    <p class="receipt-thanks">${esc(store.footer || "Terima kasih sudah berbelanja!")}</p>
  `;

  openDialog("receiptDialog", $("printReceipt"));
  document.body.classList.add("receipt-open");
}

$("printReceipt").addEventListener("click", () => window.print());

// RIWAYAT TRANSAKSI

const historyPicker = createDatePicker($("historyDate"), {
  value: { from: null, to: null },
  onChange: () => renderTransactions()
});

function renderTransactions() {
  const search = $("transactionSearch").value.trim().toLowerCase();
  const range = historyPicker.value;

  const transactions = [...data.transactions].reverse().filter(tx => {
    const haystack = [tx.id, tx.cashierName || "", ...tx.items.map(item => item.name)]
      .join(" ")
      .toLowerCase();

    return inRange(dayKey(tx.date), range) && haystack.includes(search);
  });

  const active = transactions.filter(tx => !tx.cancelledAt);

  setCount("historyCount", active.length);
  setMoney("historyRevenue", sumTotals(active));

  // Transaksi dikelompokkan per hari.
  const rows = [];
  let lastDay = null;

  transactions.forEach(tx => {
    const key = dayKey(tx.date);

    if (key !== lastDay) {
      const sameDay = active.filter(row => dayKey(row.date) === key);

      rows.push(`
        <tr class="day-row">
          <td colspan="6">
            <div class="day-row-inner">
              <strong>${esc(dayHeading(key))}</strong>
              <span>${sameDay.length} transaksi · ${money(sumTotals(sameDay))}</span>
            </div>
          </td>
        </tr>
      `);
      lastDay = key;
    }

    rows.push(`
      <tr class="${tx.cancelledAt ? "row-cancelled" : ""}">
        <td class="nowrap">
          <strong>${esc(timeText(tx.date))}</strong>
          <div class="id-text">${esc(tx.id)}</div>
        </td>
        <td data-label="Rincian">${itemSummary(tx)}</td>
        <td data-label="Metode"><span class="tag">${esc(METHOD_NAMES[tx.paymentMethod])}</span></td>
        <td class="muted-text nowrap" data-label="Kasir">${esc(tx.cashierName || "-")}</td>
        <td class="nowrap" data-label="Total"><strong class="amount">${money(transactionTotal(tx))}</strong></td>
        <td class="nowrap row-actions">
          <button class="action-button" data-receipt="${esc(tx.id)}">Struk</button>
          ${tx.cancelledAt
            ? `<span class="tag warning">Dibatalkan</span>`
            : `<button class="action-button delete owner-only" data-cancel="${esc(tx.id)}">Batalkan</button>`}
        </td>
      </tr>
    `);
  });

  $("transactionRows").innerHTML = rows.join("");

  if (transactions.length) {
    $("transactionEmpty").innerHTML = "";
  } else if (data.transactions.length === 0) {
    $("transactionEmpty").innerHTML = emptyState(
      "receipt",
      "Belum ada transaksi",
      "Transaksi yang selesai akan muncul di sini.",
      "Buka kasir",
      "go-cashier"
    );
  } else {
    $("transactionEmpty").innerHTML = `<p class="empty-message">Transaksi tidak ditemukan.</p>`;
  }
}

// STRUK DAN PEMBATALAN DI RIWAYAT

$("transactionRows").addEventListener("click", async event => {
  const receiptButton = event.target.closest("[data-receipt]");
  const cancelButton = event.target.closest("[data-cancel]");

  if (receiptButton) {
    openReceipt(receiptButton.dataset.receipt);
  }

  if (cancelButton) {
    const sure = await askConfirm(
      "Batalkan transaksi?",
      "Stok akan dikembalikan dan transaksi ini tidak dihitung lagi. Catatannya tetap tersimpan.",
      "Batalkan transaksi"
    );

    if (sure) {
      await runAction(() => {
        return api(`/api/transactions/${encodeURIComponent(cancelButton.dataset.cancel)}/cancel`, "POST", {});
      }, "Transaksi berhasil dibatalkan.");
    }
  }
});

// MENGHAPUS SELURUH RIWAYAT TRANSAKSI

$("clearHistoryButton").addEventListener("click", async () => {
  if (data.transactions.length === 0) {
    showToast("Belum ada riwayat transaksi untuk dihapus.", true);
    return;
  }

  const sure = await askConfirm(
    "Hapus semua riwayat?",
    `Semua ${data.transactions.length} transaksi akan dihapus dan tidak dapat dikembalikan. Produk dan stok tetap ada.`,
    "Hapus semua"
  );

  if (sure) {
    await runAction(() => api("/api/transactions", "DELETE"), "Semua riwayat transaksi berhasil dihapus.");
  }
});

// PENGELUARAN

const monthRange = () => {
  const today = new Date();

  return { from: dayKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: todayKey() };
};

const expensePicker = createDatePicker($("expenseDate"), {
  value: monthRange(),
  onChange: () => renderExpenses()
});

const expenseFormPicker = createDatePicker($("expenseFormDate"), {
  mode: "single",
  value: todayKey(),
  onChange: () => {}
});

function renderExpenses() {
  const search = $("expenseSearch").value.trim().toLowerCase();
  const range = expensePicker.value;

  const expenses = data.expenses.filter(expense => {
    const haystack = `${expense.category} ${expense.description || ""}`.toLowerCase();

    return inRange(expense.date, range) && haystack.includes(search);
  }).reverse();

  setMoney("expenseTotal", sumExpenses(expenses));
  setMoney("expenseMonth", sumExpenses(
    data.expenses.filter(expense => inRange(expense.date, monthRange()))
  ));

  const known = new Set([...EXPENSE_CATEGORIES, ...data.expenses.map(expense => expense.category)]);

  $("expenseCategoryOptions").innerHTML = [...known].map(name => `
    <option value="${esc(name)}"></option>
  `).join("");

  $("expenseRows").innerHTML = expenses.map(expense => `
    <tr>
      <td class="date-cell"><strong>${esc(relativeDay(expense.date))}</strong></td>
      <td data-label="Kategori"><span class="tag">${esc(expense.category)}</span></td>
      <td data-label="Keterangan">${esc(expense.description || "-")}</td>
      <td class="nowrap" data-label="Jumlah"><strong>${money(expense.amount)}</strong></td>
      <td class="row-actions"><button class="action-button delete" data-expense-delete="${esc(expense.id)}">Hapus</button></td>
    </tr>
  `).join("");

  if (expenses.length) {
    $("expenseEmpty").innerHTML = "";
  } else if (data.expenses.length === 0) {
    $("expenseEmpty").innerHTML = emptyState(
      "wallet",
      "Belum ada pengeluaran",
      "Catat biaya usaha untuk melihat laba bersih di Laporan.",
      "Tambah pengeluaran",
      "add-expense"
    );
  } else {
    $("expenseEmpty").innerHTML = `<p class="empty-message">Pengeluaran tidak ditemukan pada periode ini.</p>`;
  }
}

function openExpenseForm() {
  $("expenseForm").reset();
  expenseFormPicker.set(todayKey());
  openDialog("expenseDialog", $("expenseCategory"));
}

$("addExpenseButton").addEventListener("click", openExpenseForm);

$("expenseForm").addEventListener("submit", async event => {
  event.preventDefault();

  const amount = Number($("expenseAmount").value);

  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Jumlah pengeluaran harus lebih dari 0.", true);
    return;
  }

  const saved = await runAction(() => {
    return api("/api/expenses", "POST", {
      date: expenseFormPicker.value,
      category: $("expenseCategory").value.trim(),
      description: $("expenseDescription").value.trim(),
      amount
    });
  }, "Pengeluaran berhasil dicatat.");

  if (saved) closeDialog("expenseDialog");
});

$("expenseRows").addEventListener("click", async event => {
  const button = event.target.closest("[data-expense-delete]");

  if (!button) return;

  const sure = await askConfirm("Hapus pengeluaran?", "Catatan pengeluaran ini akan dihapus.", "Hapus");

  if (sure) {
    await runAction(() => {
      return api(`/api/expenses/${encodeURIComponent(button.dataset.expenseDelete)}`, "DELETE");
    }, "Pengeluaran berhasil dihapus.");
  }
});

// LAPORAN

const reportPicker = createDatePicker($("reportDate"), {
  value: { from: daysAgoKey(29), to: todayKey() },
  onChange: () => renderReports()
});

// Periode dengan panjang sama tepat sebelum periode terpilih.
function previousRange(range) {
  if (!range.from || !range.to) return null;

  const days = Math.round((fromKey(range.to) - fromKey(range.from)) / 86400000) + 1;
  const end = fromKey(range.from);

  end.setDate(end.getDate() - 1);

  const start = new Date(end);

  start.setDate(start.getDate() - (days - 1));

  return { from: dayKey(start), to: dayKey(end), days };
}

function renderReports() {
  const range = reportPicker.value;
  const transactions = transactionsIn(range);
  const revenue = sumTotals(transactions);
  const profit = sumProfits(transactions);
  const expenses = data.expenses.filter(expense => inRange(expense.date, range));
  const expenseTotal = sumExpenses(expenses);
  const net = profit - expenseTotal;
  const cancelled = data.transactions.filter(tx => {
    return tx.cancelledAt && inRange(dayKey(tx.date), range);
  });

  setMoney("reportRevenue", revenue);
  setMoney("reportProfit", profit);
  setMoney("reportExpenses", expenseTotal);
  setMoney("reportNet", net);
  $("reportNet").className = net < 0 ? "negative" : "";
  setCount("reportCount", transactions.length);
  $("reportCancelled").textContent = `${cancelled.length} dibatalkan`;
  setMoney("reportAverage", transactions.length ? Math.round(revenue / transactions.length) : 0);

  const previous = previousRange(range);

  $("reportRevenueTrend").innerHTML = previous
    ? trendHtml(revenue, sumTotals(transactionsIn(previous)), `dari ${previous.days} hari sebelumnya`)
    : "Setelah diskon";

  $("reportProducts").innerHTML = productSales(transactions).map(row => `
    <tr>
      <td><div class="product-cell">${avatar(row.name)}<strong>${esc(row.name)}</strong></div></td>
      <td>${row.quantity}</td>
      <td class="nowrap">${money(row.revenue)}</td>
      <td class="nowrap">${money(row.profit)}</td>
    </tr>
  `).join("") || tableEmpty(4, "Tidak ada penjualan pada periode ini.");

  $("reportMethods").innerHTML = Object.keys(METHOD_NAMES).map(method => {
    const rows = transactions.filter(tx => tx.paymentMethod === method);

    return `
      <tr>
        <td><strong>${METHOD_NAMES[method]}</strong></td>
        <td>${rows.length}</td>
        <td class="nowrap">${money(sumTotals(rows))}</td>
      </tr>
    `;
  }).join("");

  const byCategory = new Map();

  expenses.forEach(expense => {
    byCategory.set(expense.category, (byCategory.get(expense.category) || 0) + expense.amount);
  });

  $("reportExpenseCategories").innerHTML = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => `
      <tr>
        <td><strong>${esc(name)}</strong></td>
        <td class="nowrap">${money(amount)}</td>
      </tr>
    `).join("") || tableEmpty(2, "Tidak ada pengeluaran pada periode ini.");
}

// MENGUNDUH LAPORAN

function csvCell(value) {
  let text = String(value);

  // Mencegah spreadsheet menjalankan teks sebagai rumus. Angka tetap apa adanya.
  if (typeof value !== "number" && /^[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

$("exportButton").addEventListener("click", () => {
  const range = reportPicker.value;
  const transactions = transactionsIn(range);
  const expenses = data.expenses.filter(expense => inRange(expense.date, range));

  if (transactions.length === 0 && expenses.length === 0) {
    showToast("Tidak ada data pada periode ini.", true);
    return;
  }

  const profit = sumProfits(transactions);
  const expenseTotal = sumExpenses(expenses);

  const rows = [
    ["Periode", rangeLabel(range)],
    ["Omzet", sumTotals(transactions)],
    ["Keuntungan kotor", profit],
    ["Pengeluaran", expenseTotal],
    ["Laba bersih", profit - expenseTotal],
    [],
    ["TRANSAKSI"],
    ["Tanggal", "ID transaksi", "Rincian", "Metode", "Kasir", "Diskon", "Total", "Keuntungan kotor"],
    ...transactions.map(tx => [
      dateTimeText(tx.date),
      tx.id,
      tx.items.map(item => `${item.name} x ${item.quantity}`).join(", "),
      METHOD_NAMES[tx.paymentMethod],
      tx.cashierName || "",
      tx.discount,
      transactionTotal(tx),
      transactionProfit(tx)
    ]),
    [],
    ["PENGELUARAN"],
    ["Tanggal", "Kategori", "Keterangan", "Jumlah"],
    ...expenses.map(expense => [
      shortDate(expense.date),
      expense.category,
      expense.description || "",
      expense.amount
    ])
  ];

  const csv = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  const link = document.createElement("a");
  const period = range.from ? `${range.from}-sampai-${range.to}` : "semua";

  // Tanda BOM di awal agar Excel membaca hurufnya dengan benar.
  link.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  link.download = `laporan-${period}.csv`;
  link.click();

  URL.revokeObjectURL(link.href);

  showToast("Laporan berhasil diunduh.");
});

// PENGATURAN TOKO

function renderLogoPreview() {
  $("logoPreview").innerHTML = pendingLogo ? `<img src="${esc(pendingLogo)}" alt="Logo toko" />` : icon("box");
}

function fillStoreForm() {
  if (!isOwner()) return;

  const store = session.store;

  $("storeName").value = store.name || "";
  $("storeAddress").value = store.address || "";
  $("storePhone").value = store.phone || "";
  $("storeFooter").value = store.footer || "";
  pendingLogo = store.logo || null;
  renderLogoPreview();
}

// Logo dikecilkan di browser supaya ringan disimpan.
$("logoInput").addEventListener("change", async event => {
  const file = event.target.files[0];

  event.target.value = "";

  if (!file) return;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 240 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");

    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    pendingLogo = canvas.toDataURL("image/png");
    renderLogoPreview();
  } catch (error) {
    showToast("Gambar tidak dapat dibaca.", true);
  }
});

$("removeLogo").addEventListener("click", () => {
  pendingLogo = null;
  renderLogoPreview();
});

$("storeForm").addEventListener("submit", async event => {
  event.preventDefault();

  await runAction(() => {
    return api("/api/settings", "PUT", {
      name: $("storeName").value.trim(),
      address: $("storeAddress").value.trim(),
      phone: $("storePhone").value.trim(),
      footer: $("storeFooter").value.trim(),
      logo: pendingLogo
    });
  }, "Informasi toko berhasil disimpan.");
});

// KATA SANDI

$("passwordForm").addEventListener("submit", async event => {
  event.preventDefault();

  try {
    await api("/api/password", "POST", {
      currentPassword: $("currentPassword").value,
      newPassword: $("newPassword").value
    });

    $("passwordForm").reset();
    showToast("Kata sandi berhasil diubah.");
  } catch (error) {
    showToast(error.message, true);
  }
});

// TIM

async function loadUsers() {
  if (!isOwner()) return;

  try {
    users = (await api("/api/users")).users;
    renderUsers();
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderUsers() {
  $("userRows").innerHTML = users.map(user => {
    const self = String(user.id) === String(session.user.id);
    const status = user.isPending
      ? `<span class="tag amber">Menunggu</span>`
      : `<span class="tag ${user.isActive ? "good" : "warning"}">${user.isActive ? "Aktif" : "Nonaktif"}</span>`;
    const actions = user.isPending
      ? `
        <button class="action-button" data-user-toggle="${esc(user.id)}">Setujui</button>
        <button class="action-button delete" data-user-reject="${esc(user.id)}">Tolak</button>
      `
      : `
        <button class="action-button" data-user-edit="${esc(user.id)}">Edit</button>
        <button class="action-button ${user.isActive ? "delete" : ""}" data-user-toggle="${esc(user.id)}">${user.isActive ? "Nonaktifkan" : "Aktifkan"}</button>
      `;

    return `
      <tr>
        <td>
          <strong>${esc(user.name)}</strong>${self ? " <span class=\"tag good\">Kamu</span>" : ""}
          <div class="id-text">${esc(user.username)}</div>
        </td>
        <td><span class="tag">${user.role === "OWNER" ? "Pemilik" : "Staf"}</span></td>
        <td>${status}</td>
        <td class="nowrap">${self ? "" : actions}</td>
      </tr>
    `;
  }).join("");
}

function openUserForm(user = null) {
  editingUser = user;

  $("userForm").reset();
  $("userTitle").textContent = user ? `Edit ${user.name}` : "Tambah akun";
  $("userNewFields").classList.toggle("hidden", Boolean(user));
  $("newUserRole").value = user ? user.role : "STAFF";
  $("newUserName").required = !user;
  $("newUserUsername").required = !user;
  $("newUserPassword").required = !user;
  $("newUserPasswordLabel").textContent = user ? "Kata sandi baru (opsional)" : "Kata sandi";
  $("newUserPasswordHint").textContent = user
    ? "Kosongkan jika tidak ingin mengubah."
    : "Minimal 8 karakter. Berikan kepada orangnya secara pribadi.";

  openDialog("userDialog", user ? $("newUserRole") : $("newUserName"));
}

$("addUserButton").addEventListener("click", () => openUserForm());

$("userForm").addEventListener("submit", async event => {
  event.preventDefault();

  try {
    if (editingUser) {
      await api(`/api/users/${encodeURIComponent(editingUser.id)}`, "PUT", {
        role: $("newUserRole").value,
        isActive: editingUser.isActive,
        password: $("newUserPassword").value || undefined
      });
    } else {
      await api("/api/users", "POST", {
        name: $("newUserName").value.trim(),
        username: $("newUserUsername").value.trim(),
        role: $("newUserRole").value,
        password: $("newUserPassword").value
      });
    }

    closeDialog("userDialog");
    showToast("Akun berhasil disimpan.");
    await loadUsers();
  } catch (error) {
    showToast(error.message, true);
  }
});

$("userRows").addEventListener("click", async event => {
  const editButton = event.target.closest("[data-user-edit]");
  const toggleButton = event.target.closest("[data-user-toggle]");
  const rejectButton = event.target.closest("[data-user-reject]");

  if (rejectButton) {
    const user = users.find(row => String(row.id) === rejectButton.dataset.userReject);
    const sure = await askConfirm("Tolak permintaan?", `Permintaan akun ${user.name} akan dihapus.`, "Tolak");

    if (sure) {
      await runAction(() => api(`/api/users/${encodeURIComponent(user.id)}`, "DELETE"), "Permintaan akun ditolak.");
      await loadUsers();
    }
  }

  if (editButton) {
    openUserForm(users.find(user => String(user.id) === editButton.dataset.userEdit));
  }

  if (toggleButton) {
    const user = users.find(row => String(row.id) === toggleButton.dataset.userToggle);

    if (user.isActive) {
      const sure = await askConfirm(
        "Nonaktifkan akun?",
        `${user.name} tidak akan bisa masuk sampai diaktifkan lagi.`,
        "Nonaktifkan"
      );

      if (!sure) return;
    }

    await runAction(() => {
      return api(`/api/users/${encodeURIComponent(user.id)}`, "PUT", {
        role: user.role,
        isActive: !user.isActive
      });
    }, user.isPending ? "Akun disetujui." : "");
    await loadUsers();
  }
});

// CUSTOMER SERVICE OTOMATIS

// Bukan orang sungguhan: jawaban dipilih dari daftar ini berdasarkan kata kunci.
const HELP_TOPICS = [
  {
    label: "Tambah produk",
    keywords: ["tambah produk", "produk baru", "input produk", "produk", "barang", "harga"],
    answer: "Buka menu Produk, lalu klik Tambah produk. Isi nama, harga jual, modal, dan stok, lalu simpan.\n\nHanya pemilik yang bisa menambah atau mengubah produk."
  },
  {
    label: "Cara jualan",
    keywords: ["jual", "kasir", "transaksi", "keranjang", "bayar"],
    answer: "Buka menu Kasir, pilih produk, lalu pilih metode pembayaran. Untuk tunai, isi uang diterima, lalu klik Selesaikan transaksi. Struk langsung muncul."
  },
  {
    label: "Tambah stok",
    keywords: ["stok", "restok", "persediaan", "habis"],
    answer: "Di menu Produk, klik Restok pada produknya. Riwayat stok ada di tombol Riwayat stok.\n\nProduk dengan stok 5 atau kurang muncul di Dashboard."
  },
  {
    label: "Cetak struk",
    keywords: ["struk", "cetak", "print", "nota"],
    answer: "Struk muncul setelah transaksi selesai, lalu klik Cetak struk. Struk lama bisa dibuka lagi dari Riwayat transaksi."
  },
  {
    label: "Batalkan transaksi",
    keywords: ["batal", "cancel", "refund", "salah transaksi"],
    answer: "Buka Riwayat transaksi, lalu klik Batalkan. Stok kembali otomatis dan transaksi tidak dihitung lagi.\n\nHanya pemilik yang bisa membatalkan."
  },
  {
    label: "Laporan",
    keywords: ["laporan", "untung", "laba", "rugi", "omzet", "csv", "excel", "pengeluaran"],
    answer: "Menu Laporan menampilkan omzet, keuntungan kotor, pengeluaran, dan laba bersih untuk tanggal yang kamu pilih. Klik Unduh CSV untuk membukanya di Excel.\n\nCatat biaya usaha di menu Pengeluaran."
  },
  {
    label: "Buat akun",
    keywords: ["akun", "daftar", "registrasi", "register", "staf", "karyawan"],
    answer: "Di halaman masuk, klik Buat akun. Setelah itu pemilik perlu menyetujuinya di Pengaturan, bagian Tim, baru kamu bisa masuk."
  },
  {
    label: "Lupa kata sandi",
    keywords: ["lupa", "sandi", "password", "tidak bisa masuk", "gagal masuk", "login"],
    answer: "Staf bisa meminta pemilik membuat kata sandi baru di Pengaturan, bagian Tim, tombol Edit.\n\nKata sandi pemilik tidak bisa diatur ulang dari aplikasi, jadi simpan baik-baik."
  }
];

const HELP_EXTRAS = [
  {
    keywords: ["barcode", "scan", "pindai"],
    answer: "Isi barcode saat mengedit produk. Di Kasir, pindai atau ketik barcode di kolom pencarian lalu tekan Enter."
  },
  {
    keywords: ["shortcut", "pintasan", "keyboard", "f2", "f4", "f9"],
    answer: "Di Kasir: F2 untuk mencari produk, F4 untuk uang diterima, F9 untuk menyelesaikan transaksi, dan Esc untuk menutup."
  },
  {
    keywords: ["gelap", "dark", "tema", "terang"],
    answer: "Klik tombol bulan atau matahari di bagian atas untuk mengganti tema."
  },
  {
    keywords: ["diskon", "potongan"],
    answer: "Di Kasir, isi kolom Diskon dalam rupiah. Totalnya langsung berubah."
  },
  {
    keywords: ["qris", "transfer", "tunai", "metode"],
    answer: "Pilih Tunai, QRIS, atau Transfer di keranjang. Aplikasi hanya mencatat metodenya dan tidak memproses pembayaran sungguhan."
  },
  {
    keywords: ["manusia", "admin", "orang", "operator", "cs"],
    answer: "Aku Rudi, asisten otomatis, jadi belum bisa menghubungkanmu ke orang sungguhan. Untuk masalah di tokomu, silakan hubungi pemilik toko."
  },
  {
    keywords: ["halo", "hai", "hi", "pagi", "siang", "sore", "malam"],
    answer: "Halo! Ada yang bisa Rudi bantu? Pilih topik di bawah atau tulis pertanyaanmu."
  },
  {
    keywords: ["makasih", "terima kasih", "thanks"],
    answer: "Sama-sama! Senang bisa membantu."
  }
];

function helpAnswer(question) {
  const text = question.toLowerCase();
  const entries = [...HELP_EXTRAS, ...HELP_TOPICS];
  // Kata pendek harus cocok utuh, supaya "hi" tidak cocok dengan "hilang".
  const matches = word => {
    return word.length <= 3
      ? new RegExp(`(^|[^a-z0-9])${word}($|[^a-z0-9])`).test(text)
      : text.includes(word);
  };
  const found = entries.find(entry => entry.keywords.some(matches));

  return found
    ? found.answer
    : "Maaf, Rudi belum mengerti pertanyaan itu. Coba pilih salah satu topik di bawah, ya.";
}

function addHelpBubble(text, mine = false) {
  const bubble = document.createElement("div");

  bubble.className = "help-bubble" + (mine ? " mine" : "");
  bubble.textContent = text;
  $("helpMessages").appendChild(bubble);
  $("helpMessages").scrollTop = $("helpMessages").scrollHeight;

  return bubble;
}

function askHelp(question, answer) {
  addHelpBubble(question, true);

  const typing = addHelpBubble("");

  typing.innerHTML = `<span class="help-typing"><i></i><i></i><i></i></span>`;
  $("helpMessages").scrollTop = $("helpMessages").scrollHeight;

  setTimeout(() => {
    typing.textContent = answer || helpAnswer(question);
    $("helpMessages").scrollTop = $("helpMessages").scrollHeight;
  }, 650);
}

function toggleHelp(open) {
  if (!open) {
    hideWithExit($("helpPanel"));
    return;
  }

  showElement($("helpPanel"));

  if (open) {
    if ($("helpMessages").childElementCount === 0) {
      addHelpBubble("Halo! Aku Rudi, asisten otomatis UsahaCerdas. Ada yang bisa kubantu?");
    }

    $("helpInput").focus();
  }
}

$("helpTopics").innerHTML = HELP_TOPICS.map((topic, index) => `
  <button type="button" class="chip" data-help-topic="${index}">${esc(topic.label)}</button>
`).join("");

$("helpButton").addEventListener("click", () => {
  toggleHelp($("helpPanel").classList.contains("hidden"));
});

$("helpClose").addEventListener("click", () => toggleHelp(false));

$("helpTopics").addEventListener("click", event => {
  const button = event.target.closest("[data-help-topic]");

  if (button) {
    const topic = HELP_TOPICS[Number(button.dataset.helpTopic)];

    askHelp(topic.label, topic.answer);
  }
});

$("helpForm").addEventListener("submit", event => {
  event.preventDefault();

  const question = $("helpInput").value.trim();

  if (question) {
    $("helpInput").value = "";
    askHelp(question);
  }
});

// PINTASAN KEYBOARD

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (openPicker) {
      closeDatePicker();
    } else if (document.body.classList.contains("cart-open") && !document.querySelector(".dialog-backdrop:not(.hidden)")) {
      toggleCartSheet(false);
    } else if (!$("confirmDialog").classList.contains("hidden")) {
      finishConfirm(false);
    } else if (!$("helpPanel").classList.contains("hidden") && !document.querySelector(".dialog-backdrop:not(.hidden)")) {
      toggleHelp(false);
    } else {
      document.querySelectorAll(".dialog-backdrop:not(.hidden)").forEach(dialog => closeDialog(dialog.id));
    }
    return;
  }

  if (session.user && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();

    if ($("paletteDialog").classList.contains("hidden")) {
      openPalette();
    } else {
      closeDialog("paletteDialog");
    }
    return;
  }

  if (!session.user || document.querySelector(".dialog-backdrop:not(.hidden)")) return;

  if (event.key === "F2") {
    event.preventDefault();
    showPage("cashier").then(() => $("cashierSearch").focus());
  }

  if (event.key === "F4" && currentPage === "cashier") {
    event.preventDefault();
    setPaymentMethod("TUNAI");
    $("paymentInput").focus();
  }

  if (event.key === "F9" && currentPage === "cashier") {
    event.preventDefault();
    $("completeSaleButton").click();
  }
});

// CARI CEPAT (CTRL + K)

function paletteCommands() {
  const pages = {
    dashboard: "Dashboard",
    cashier: "Kasir",
    products: "Produk",
    transactions: "Riwayat transaksi",
    expenses: "Pengeluaran",
    reports: "Laporan",
    settings: "Pengaturan"
  };
  const icons = {
    dashboard: "dashboard",
    cashier: "cart",
    products: "box",
    transactions: "receipt",
    expenses: "wallet",
    reports: "chart",
    settings: "settings"
  };
  const items = allowedPages().map(page => ({
    icon: icons[page],
    label: pages[page],
    hint: "Buka halaman",
    run: () => showPage(page)
  }));

  if (isOwner()) {
    items.push({
      icon: "plus",
      label: "Tambah produk",
      hint: "Perintah",
      run: () => showPage("products").then(() => openProductForm())
    });
    items.push({
      icon: "plus",
      label: "Tambah pengeluaran",
      hint: "Perintah",
      run: () => showPage("expenses").then(() => openExpenseForm())
    });
    items.push({
      icon: "history",
      label: "Riwayat stok",
      hint: "Perintah",
      run: () => openStockHistory()
    });
  }

  items.push({
    icon: isDark() ? "sun" : "moon",
    label: isDark() ? "Mode terang" : "Mode gelap",
    hint: "Perintah",
    run: () => toggleTheme()
  });

  data.products.forEach(product => {
    items.push({
      icon: "cart",
      label: product.name,
      keywords: product.barcode || "",
      hint: product.stock > 0 ? `Masukkan ke keranjang · ${money(product.price)}` : "Stok habis",
      run: () => showPage("cashier").then(() => addToCart(product.id))
    });
  });

  return items;
}

function renderPalette() {
  const search = $("paletteInput").value.trim().toLowerCase();

  paletteItems = paletteCommands()
    .filter(item => `${item.label} ${item.keywords || ""}`.toLowerCase().includes(search))
    .slice(0, 8);
  paletteIndex = Math.min(paletteIndex, Math.max(0, paletteItems.length - 1));

  $("paletteList").innerHTML = paletteItems.map((item, index) => `
    <button type="button" class="palette-item ${index === paletteIndex ? "active" : ""}" data-palette="${index}" role="option">
      ${icon(item.icon)}
      <strong>${esc(item.label)}</strong>
      <small>${esc(item.hint)}</small>
    </button>
  `).join("") || `<p class="empty-message">Tidak ada hasil.</p>`;
}

function openPalette() {
  $("paletteInput").value = "";
  paletteIndex = 0;
  renderPalette();
  openDialog("paletteDialog", $("paletteInput"));
}

function runPalette(index) {
  const item = paletteItems[index];

  if (!item) return;

  closeDialog("paletteDialog");
  item.run();
}

$("paletteButton").addEventListener("click", openPalette);

$("paletteInput").addEventListener("input", () => {
  paletteIndex = 0;
  renderPalette();
});

$("paletteInput").addEventListener("keydown", event => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();

    const step = event.key === "ArrowDown" ? 1 : -1;

    paletteIndex = (paletteIndex + step + paletteItems.length) % Math.max(1, paletteItems.length);
    renderPalette();
    $("paletteList").querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }

  if (event.key === "Enter") {
    event.preventDefault();
    runPalette(paletteIndex);
  }
});

$("paletteList").addEventListener("click", event => {
  const button = event.target.closest("[data-palette]");

  if (button) runPalette(Number(button.dataset.palette));
});

// PENCARIAN DAN FILTER

$("productSearch").addEventListener("input", renderProducts);
$("productCategoryFilter").addEventListener("change", renderProducts);
$("cashierSearch").addEventListener("input", renderCashierProducts);
$("transactionSearch").addEventListener("input", renderTransactions);
$("expenseSearch").addEventListener("input", renderExpenses);

$("addProductButton").addEventListener("click", () => openProductForm());

// MEMPERBARUI SELURUH TAMPILAN

function renderAll() {
  // Sebelum data pertama tiba, tidak menampilkan "belum ada" yang keliru.
  if (!session.user || !dataLoaded) return;

  renderProducts();
  renderCashierProducts();
  renderCart();
  renderTransactions();

  $("pendingBadge").textContent = data.pendingAccounts || "";
  $("pendingBadge").classList.toggle("hidden", !data.pendingAccounts);

  // Staf tidak menerima data keuntungan dan pengeluaran.
  if (isOwner()) {
    renderDashboard();
    renderExpenses();
    renderReports();
  }
}

function renderClock() {
  const now = new Date();
  const date = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  $("todayLabel").innerHTML = `${esc(date)} · <strong>${esc(timeText(now))}</strong>`;
}

// MEMULAI APLIKASI

async function start() {
  applyIcons();
  renderThemeButtons();
  renderClock();
  setInterval(renderClock, 30000);

  // Kalau server tidak menjawab, layar loading tidak boleh tertahan selamanya.
  setTimeout(hideSplash, 12000);

  try {
    const result = await api("/api/session");

    session.store = result.store;

    if (result.user) {
      await enterApp(result.user);
    } else {
      showAuth(result.setupRequired ? "setup" : "login");
      hideSplash();
    }
  } catch (error) {
    showAuth("login", "Tidak terhubung ke server. Jalankan npm.cmd start, lalu buka http://localhost:3000");
    hideSplash();
  }
}

start();
