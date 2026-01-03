const STORAGE_KEY = "melo-ramen:v1";

/** @typedef {{ checks: Record<string, boolean>, notes: string, dateDigits: string, updatedAt: number }} AppState */

const TOPPINGS = [
  "CHICKEN",
  "OYSTER MUSHROOM",
  "SPINACH",
  "CARROT",
  "GREEN ONION",
  "BOILED EGG",
  "SEA WEED",
  "SESAME",
  "EXTRA GARLIC ?",
];

/** @param {string} text */
function idFromText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function todayDDMMYY() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

/** @returns {AppState} */
function loadState() {
  const base = /** @type {AppState} */ ({
    checks: {},
    notes: "",
    dateDigits: todayDDMMYY(),
    updatedAt: Date.now(),
  });

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = /** @type {Partial<AppState>} */ (JSON.parse(raw));
    if (!parsed || typeof parsed !== "object") return base;

    const checks = typeof parsed.checks === "object" && parsed.checks ? parsed.checks : {};
    const dateDigits = typeof parsed.dateDigits === "string" ? parsed.dateDigits : base.dateDigits;

    return {
      checks: /** @type {Record<string, boolean>} */ (checks),
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      dateDigits: dateDigits.replace(/[^0-9]/g, "").slice(0, 6).padEnd(6, " "),
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    // Best-effort migration from the previous app shape (items array).
    try {
      const raw = localStorage.getItem("simple-checklist-notes:v1");
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      const checks = /** @type {Record<string, boolean>} */ ({});
      if (parsed && Array.isArray(parsed.items)) {
        for (const it of parsed.items) {
          const txt = String(it?.text ?? "").trim();
          if (!txt) continue;
          checks[idFromText(txt.toUpperCase())] = Boolean(it?.checked);
        }
      }
      return { ...base, checks, notes: String(parsed?.notes ?? ""), updatedAt: Date.now() };
    } catch {
      return base;
    }
  }
}

/** @param {AppState} state */
function saveState(state) {
  const next = { ...state, updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** @param {number} ts */
function formatTime(ts) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
  } catch {
    return "";
  }
}

let state = loadState();

const checklistEl = document.getElementById("checklist");
const notesInput = document.getElementById("notesInput");
const notesDoneBtn = document.getElementById("notesDoneBtn");
const notesSavedHint = document.getElementById("notesSavedHint");
const dateDigitsEl = document.getElementById("dateDigits");

if (!(checklistEl instanceof HTMLElement)) throw new Error("Missing checklist element");
if (!(notesInput instanceof HTMLTextAreaElement)) throw new Error("Missing notes input");
if (!(notesDoneBtn instanceof HTMLButtonElement)) throw new Error("Missing notes done button");
if (!(notesSavedHint instanceof HTMLElement)) throw new Error("Missing notes saved hint");
if (!(dateDigitsEl instanceof HTMLElement)) throw new Error("Missing date digits");

/** @param {string} id */
function isChecked(id) {
  return Boolean(state.checks[id]);
}

/** @param {string} id @param {boolean} checked */
function setChecked(id, checked) {
  state.checks = { ...state.checks, [id]: checked };
  state = saveState(state);
  updateSavedHint();
}

function updateSavedHint() {
  notesSavedHint.textContent = state.updatedAt ? `SAVED ${formatTime(state.updatedAt)}` : "";
}

function renderChecklist() {
  checklistEl.innerHTML = "";

  for (const topping of TOPPINGS) {
    const id = idFromText(topping);
    const li = document.createElement("li");
    li.className = "topping";

    const label = document.createElement("label");
    label.className = "topping__label";

    const cb = document.createElement("input");
    cb.className = "checkbox";
    cb.type = "checkbox";
    cb.checked = isChecked(id);
    cb.setAttribute("aria-label", topping);

    cb.addEventListener("change", () => setChecked(id, cb.checked));

    const text = document.createElement("span");
    text.className = "topping__text";
    text.textContent = topping;

    label.appendChild(cb);
    label.appendChild(text);
    li.appendChild(label);
    checklistEl.appendChild(li);
  }
}

function bindDateInputs() {
  const inputs = Array.from(dateDigitsEl.querySelectorAll("input"));
  if (inputs.length !== 6) return;

  const digits = (state.dateDigits || todayDDMMYY()).replace(/[^0-9 ]/g, "").slice(0, 6).padEnd(6, " ");
  inputs.forEach((input, idx) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.value = digits[idx] === " " ? "" : digits[idx];
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^0-9]/g, "").slice(-1);
      const nextDigits = inputs
        .map((i) => (i instanceof HTMLInputElement ? (i.value || " ") : " "))
        .join("")
        .slice(0, 6);
      state.dateDigits = nextDigits;
      state = saveState(state);
      updateSavedHint();
      if (input.value && idx < inputs.length - 1) {
        const next = inputs[idx + 1];
        if (next instanceof HTMLInputElement) next.focus();
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && idx > 0) {
        const prev = inputs[idx - 1];
        if (prev instanceof HTMLInputElement) prev.focus();
      }
    });
  });
}

let notesSaveTimer = /** @type {number | undefined} */ (undefined);
function scheduleNotesSave() {
  if (notesSaveTimer) window.clearTimeout(notesSaveTimer);
  notesSaveTimer = window.setTimeout(() => {
    state.notes = notesInput.value;
    state = saveState(state);
    updateSavedHint();
  }, 250);
}

notesInput.addEventListener("input", scheduleNotesSave);

// On mobile, tapping "DONE" should dismiss the keyboard.
notesDoneBtn.addEventListener("click", () => notesInput.blur());

notesInput.value = state.notes;
renderChecklist();
bindDateInputs();
updateSavedHint();

