const STORAGE_KEY = "simple-checklist-notes:v1";

/** @typedef {{ id: string, text: string, checked: boolean }} ChecklistItem */
/** @typedef {{ items: ChecklistItem[], notes: string, updatedAt: number }} AppState */

function uuid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  // Good-enough fallback for local-only IDs.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

const DEFAULT_ITEMS = /** @type {ChecklistItem[]} */ ([
  { id: "1", text: "Make the bed", checked: false },
  { id: "2", text: "Drink water", checked: false },
  { id: "3", text: "10 min walk", checked: false },
  { id: "4", text: "Plan tomorrow", checked: false },
]);

/** @returns {AppState} */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: DEFAULT_ITEMS, notes: "", updatedAt: Date.now() };
    const parsed = /** @type {AppState} */ (JSON.parse(raw));
    if (!parsed || !Array.isArray(parsed.items)) throw new Error("Bad state");
    return {
      items: parsed.items.map((it) => ({
        id: String(it.id ?? uuid()),
        text: String(it.text ?? ""),
        checked: Boolean(it.checked),
      })),
      notes: String(parsed.notes ?? ""),
      updatedAt: Number(parsed.updatedAt ?? Date.now()),
    };
  } catch {
    return { items: DEFAULT_ITEMS, notes: "", updatedAt: Date.now() };
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

function formatTodaySubtitle() {
  const d = new Date();
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(d);
  } catch {
    return d.toDateString();
  }
}

/** @param {ChecklistItem} item */
function renderItem(item) {
  const li = document.createElement("li");
  li.className = "checklist__item";
  li.dataset.itemId = item.id;

  const label = document.createElement("label");
  label.className = "checklist__label";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "checkbox";
  checkbox.checked = item.checked;
  checkbox.setAttribute("aria-label", `Mark "${item.text}" as done`);

  const text = document.createElement("span");
  text.className = "checklist__text" + (item.checked ? " checklist__text--done" : "");
  text.textContent = item.text || "Untitled";

  label.appendChild(checkbox);
  label.appendChild(text);

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "icon-btn icon-btn--danger";
  delBtn.textContent = "Del";
  delBtn.setAttribute("aria-label", `Delete "${item.text}"`);

  actions.appendChild(delBtn);

  li.appendChild(label);
  li.appendChild(actions);

  return { li, checkbox, text, delBtn };
}

let state = loadState();

const checklistEl = document.getElementById("checklist");
const doneCountEl = document.getElementById("doneCount");
const totalCountEl = document.getElementById("totalCount");
const notesInput = document.getElementById("notesInput");
const notesDoneBtn = document.getElementById("notesDoneBtn");
const notesSavedHint = document.getElementById("notesSavedHint");
const addItemBtn = document.getElementById("addItemBtn");
const resetBtn = document.getElementById("resetBtn");
const addDialog = document.getElementById("addDialog");
const newItemInput = document.getElementById("newItemInput");
const todaySubtitle = document.getElementById("todaySubtitle");
const addDialogForm = addDialog instanceof HTMLDialogElement ? addDialog.querySelector("form") : null;

if (!(checklistEl instanceof HTMLElement)) throw new Error("Missing checklist element");
if (!(notesInput instanceof HTMLTextAreaElement)) throw new Error("Missing notes input");
if (!(notesDoneBtn instanceof HTMLButtonElement)) throw new Error("Missing notes done button");
if (!(notesSavedHint instanceof HTMLElement)) throw new Error("Missing notes saved hint");
if (!(addItemBtn instanceof HTMLButtonElement)) throw new Error("Missing add item button");
if (!(resetBtn instanceof HTMLButtonElement)) throw new Error("Missing reset button");
if (!(addDialog instanceof HTMLDialogElement)) throw new Error("Missing dialog");
if (!(newItemInput instanceof HTMLInputElement)) throw new Error("Missing new item input");
if (!(todaySubtitle instanceof HTMLElement)) throw new Error("Missing subtitle");
if (!(addDialogForm instanceof HTMLFormElement)) throw new Error("Missing add dialog form");

todaySubtitle.textContent = formatTodaySubtitle();

function updateCounts() {
  const total = state.items.length;
  const done = state.items.filter((i) => i.checked).length;
  if (doneCountEl) doneCountEl.textContent = String(done);
  if (totalCountEl) totalCountEl.textContent = String(total);
}

function updateNotesSavedHint() {
  notesSavedHint.textContent = state.updatedAt ? `Saved ${formatTime(state.updatedAt)}` : "";
}

function render() {
  checklistEl.innerHTML = "";
  state.items.forEach((item) => {
    const { li, checkbox, text, delBtn } = renderItem(item);

    checkbox.addEventListener("change", () => {
      const idx = state.items.findIndex((it) => it.id === item.id);
      if (idx === -1) return;
      state.items[idx] = { ...state.items[idx], checked: checkbox.checked };
      text.classList.toggle("checklist__text--done", checkbox.checked);
      state = saveState(state);
      updateCounts();
      updateNotesSavedHint();
    });

    delBtn.addEventListener("click", () => {
      state.items = state.items.filter((it) => it.id !== item.id);
      state = saveState(state);
      render();
    });

    checklistEl.appendChild(li);
  });

  notesInput.value = state.notes;
  updateCounts();
  updateNotesSavedHint();
}

let notesSaveTimer = /** @type {number | undefined} */ (undefined);

function scheduleNotesSave() {
  if (notesSaveTimer) window.clearTimeout(notesSaveTimer);
  notesSaveTimer = window.setTimeout(() => {
    state.notes = notesInput.value;
    state = saveState(state);
    updateNotesSavedHint();
  }, 250);
}

notesInput.addEventListener("input", scheduleNotesSave);

// On mobile, tapping "Done" should dismiss the keyboard.
notesDoneBtn.addEventListener("click", () => {
  notesInput.blur();
});

// Also blur on Enter (best-effort; mobile keyboards differ).
notesInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    notesInput.blur();
  }
});

addItemBtn.addEventListener("click", () => {
  newItemInput.value = "";
  addDialog.showModal();
  // Ensure the keyboard opens on mobile.
  window.setTimeout(() => newItemInput.focus(), 50);
});

addDialogForm.addEventListener("submit", (e) => {
  const submitter = /** @type {HTMLButtonElement | null} */ (e.submitter ?? null);
  const wantsAdd = submitter?.value === "default";
  if (!wantsAdd) return;
  const text = newItemInput.value.trim();
  if (!text) {
    e.preventDefault();
    newItemInput.focus();
  }
});

addDialog.addEventListener("close", () => {
  const isAdd = addDialog.returnValue === "default";
  if (!isAdd) return;
  const text = newItemInput.value.trim();
  if (!text) return;
  state.items = [{ id: uuid(), text, checked: false }, ...state.items];
  state = saveState(state);
  render();
});

resetBtn.addEventListener("click", () => {
  const ok = confirm("Reset checklist and notes?");
  if (!ok) return;
  state = { items: DEFAULT_ITEMS.map((i) => ({ ...i })), notes: "", updatedAt: Date.now() };
  state = saveState(state);
  render();
});

render();

