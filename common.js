const STARTS = [
  { nr: 1, dayOffset: 0, time: "10:00" },
  { nr: 2, dayOffset: 0, time: "12:00" },
  { nr: 3, dayOffset: 0, time: "14:30" },
  { nr: 4, dayOffset: 0, time: "16:30" },
  { nr: 5, dayOffset: 0, time: "18:30" },
  { nr: 6, dayOffset: 1, time: "17:00" },
  { nr: 7, dayOffset: 1, time: "19:00" },
  { nr: 8, dayOffset: 2, time: "10:00" },
  { nr: 9, dayOffset: 2, time: "12:00" },
  { nr: 10, dayOffset: 2, time: "14:30" },
  { nr: 11, dayOffset: 2, time: "16:30" },
  { nr: 12, dayOffset: 2, time: "18:30" },
  { nr: 13, dayOffset: 3, time: "10:00" },
  { nr: 14, dayOffset: 3, time: "12:00" },
  { nr: 15, dayOffset: 3, time: "14:30" },
  { nr: 16, dayOffset: 3, time: "16:30" }
];

const DAY_NAMES = ["Donnerstag", "Freitag", "Samstag", "Sonntag"];
const ANMELDUNG_EMAIL = "stephan@rsconline.de";

function configOk() {
  const c = window.PRESSSACK_CONFIG || {};
  return Boolean(
    c.SUPABASE_URL &&
    c.SUPABASE_ANON_KEY &&
    !c.SUPABASE_ANON_KEY.includes("HIER_")
  );
}

function getSupabase() {
  if (!configOk()) {
    throw new Error("Der Publishable Key fehlt noch in config.js.");
  }
  return window.supabase.createClient(
    window.PRESSSACK_CONFIG.SUPABASE_URL,
    window.PRESSSACK_CONFIG.SUPABASE_ANON_KEY
  );
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function corpusChristi(year) {
  const d = easterSunday(year);
  d.setDate(d.getDate() + 60);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadSettings(client) {
  const { data, error } = await client
    .from("turnier_einstellungen")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data;
}

function showMessage(element, text, type = "info") {
  element.textContent = text;
  element.className = `message ${type}`;
  element.hidden = false;
}

function hideMessage(element) {
  element.hidden = true;
  element.textContent = "";
}

function startLabel(startNr, year) {
  const start = STARTS.find(s => s.nr === Number(startNr));
  if (!start) return `Start ${startNr}`;
  const date = addDays(corpusChristi(year), start.dayOffset);
  return `Start ${start.nr} – ${DAY_NAMES[start.dayOffset]}, ${formatDate(date)}, ${start.time} Uhr`;
}
