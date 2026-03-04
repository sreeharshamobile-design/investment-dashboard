const STORAGE_KEY = "investment-dashboard-v1";
const SNAPSHOT_KEY = "investment-dashboard-snapshots-v1";

function seedSub(name, unit, pricingModel) {
  return {
    id: crypto.randomUUID(),
    name,
    unit,
    pricingModel,
    marketBuyPrice: null,
    marketSellPrice: null,
    marketNav: null,
    lastMarketUpdate: null,
  };
}

const defaultData = {
  categories: [
    {
      id: crypto.randomUUID(),
      name: "Bullion",
      subcategories: [
        seedSub("Gold", "grams", "BULLION"),
        seedSub("Silver", "grams", "BULLION"),
      ],
    },
    {
      id: crypto.randomUUID(),
      name: "Equity",
      subcategories: [
        seedSub("Mutual Fund", "units", "NAV"),
        seedSub("ETF", "units", "NAV"),
      ],
    },
  ],
  entries: [],
};

const el = {
  dataSummary: document.getElementById("dataSummary"),
  createSnapshot: document.getElementById("createSnapshot"),
  exportData: document.getElementById("exportData"),
  importFile: document.getElementById("importFile"),
  importData: document.getElementById("importData"),
  resetEntries: document.getElementById("resetEntries"),
  resetCategories: document.getElementById("resetCategories"),
  fullReset: document.getElementById("fullReset"),
  clearSnapshots: document.getElementById("clearSnapshots"),
  snapshotList: document.getElementById("snapshotList"),
  statusText: document.getElementById("statusText"),
};

bootstrap();

function bootstrap() {
  wireEvents();
  render();
}

function wireEvents() {
  el.createSnapshot.addEventListener("click", () => {
    createSnapshot("manual");
    render();
    setStatus("Snapshot created.");
  });

  el.exportData.addEventListener("click", exportCurrentData);

  el.importData.addEventListener("click", async () => {
    const file = el.importFile.files?.[0];
    if (!file) {
      setStatus("Select a JSON backup file first.");
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!isValidState(parsed)) {
        setStatus("Invalid backup format. Expected categories and entries arrays.");
        return;
      }

      createSnapshot("before-import");
      saveState(sanitizeState(parsed));
      render();
      setStatus("Backup imported and current data replaced.");
    } catch {
      setStatus("Could not import this file. Ensure it is valid JSON.");
    }
  });

  el.resetEntries.addEventListener("click", () => {
    const current = loadState();
    createSnapshot("before-reset-entries");
    saveState({ ...current, entries: [] });
    render();
    setStatus("Entries reset. Categories and subcategories are kept.");
  });

  el.resetCategories.addEventListener("click", () => {
    createSnapshot("before-reset-categories");
    saveState(structuredClone(defaultData));
    render();
    setStatus("Categories reset to defaults and entries cleared.");
  });

  el.fullReset.addEventListener("click", () => {
    createSnapshot("before-full-reset");
    saveState(structuredClone(defaultData));
    localStorage.removeItem(SNAPSHOT_KEY);
    render();
    setStatus("Full reset complete. All snapshots were cleared.");
  });

  el.clearSnapshots.addEventListener("click", () => {
    localStorage.removeItem(SNAPSHOT_KEY);
    render();
    setStatus("All snapshots deleted.");
  });
}

function render() {
  const state = loadState();
  const snapshots = loadSnapshots();

  const byCurrency = groupByCurrency(state.entries, state.categories);
  const cards = [
    ["Categories", String(state.categories.length)],
    ["Entries", String(state.entries.length)],
    ["Snapshots", String(snapshots.length)],
  ];

  Object.entries(byCurrency).forEach(([currency, total]) => {
    cards.push([`${currency} Current`, money(total, currency)]);
  });

  el.dataSummary.innerHTML = cards
    .map(
      ([label, value]) => `
      <article class="summary-card">
        <p>${escapeHtml(label)}</p>
        <strong>${escapeHtml(value)}</strong>
      </article>`
    )
    .join("");

  el.snapshotList.innerHTML = snapshots.length
    ? snapshots
        .map(
          (snapshot) => `
          <article class="snapshot-item">
            <div>
              <strong>${escapeHtml(snapshot.label)}</strong>
              <p>${escapeHtml(formatDate(snapshot.createdAt))} | ${escapeHtml(snapshot.reason)} | ${snapshot.data.entries.length} entries</p>
            </div>
            <div class="actions">
              <button class="icon-btn" type="button" data-action="restore" data-id="${snapshot.id}">Restore</button>
              <button class="icon-btn" type="button" data-action="download" data-id="${snapshot.id}">Download</button>
              <button class="icon-btn" type="button" data-action="delete" data-id="${snapshot.id}">Delete</button>
            </div>
          </article>`
        )
        .join("")
    : "<p class=\"note-text\">No snapshots saved yet.</p>";

  bindSnapshotActions();
}

function bindSnapshotActions() {
  el.snapshotList.querySelectorAll("button[data-action='restore']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const snapshot = loadSnapshots().find((item) => item.id === btn.dataset.id);
      if (!snapshot) return;
      createSnapshot("before-restore");
      saveState(snapshot.data);
      render();
      setStatus(`Restored snapshot: ${snapshot.label}`);
    });
  });

  el.snapshotList.querySelectorAll("button[data-action='download']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const snapshot = loadSnapshots().find((item) => item.id === btn.dataset.id);
      if (!snapshot) return;
      downloadJson(snapshot.data, `${snapshot.label}.json`);
      setStatus(`Downloaded snapshot: ${snapshot.label}`);
    });
  });

  el.snapshotList.querySelectorAll("button[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = loadSnapshots().filter((item) => item.id !== btn.dataset.id);
      saveSnapshots(next);
      render();
      setStatus("Snapshot deleted.");
    });
  });
}

function exportCurrentData() {
  const state = loadState();
  downloadJson(state, `investment-backup-${new Date().toISOString().slice(0, 10)}.json`);
  setStatus("Current data exported.");
}

function createSnapshot(reason) {
  const state = loadState();
  const snapshots = loadSnapshots();

  const snapshot = {
    id: crypto.randomUUID(),
    label: `snapshot-${new Date().toISOString().replaceAll(":", "-")}`,
    reason,
    createdAt: Date.now(),
    data: state,
  };

  const next = [snapshot, ...snapshots].slice(0, 30);
  saveSnapshots(next);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultData);

  try {
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) return structuredClone(defaultData);
    return sanitizeState(parsed);
  } catch {
    return structuredClone(defaultData);
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeState(state)));
}

function loadSnapshots() {
  const raw = localStorage.getItem(SNAPSHOT_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.id && isValidState(item.data));
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
}

function sanitizeState(state) {
  return {
    categories: Array.isArray(state.categories) ? state.categories : [],
    entries: Array.isArray(state.entries) ? state.entries : [],
  };
}

function isValidState(state) {
  return !!state && Array.isArray(state.categories) && Array.isArray(state.entries);
}

function groupByCurrency(entries, categories) {
  const subById = new Map();
  categories.forEach((category) => {
    (category.subcategories || []).forEach((sub) => {
      subById.set(sub.id, sub);
    });
  });

  return entries.reduce((acc, entry) => {
    const currency = normalizeCurrency(entry.currency);
    const sub = subById.get(entry.subcategoryId);
    const currentUnit = getCurrentUnitPrice(sub, entry.market);
    if (!acc[currency]) acc[currency] = 0;
    acc[currency] += Number(entry.quantity || 0) * currentUnit;
    return acc;
  }, {});
}

function getCurrentUnitPrice(sub, market) {
  if (!sub) return 0;
  const model = sub.pricingModel || inferPricingModel(sub.name || "");
  const marketKey = normalizeMarket(market || inferMarketFromCurrency(sub.currency));
  const slot = getMarketSlot(sub, marketKey);

  if (model === "BULLION") return Number(slot.sellPrice || 0);
  if (model === "NAV") return Number(slot.nav || 0);
  return Number(slot.sellPrice ?? slot.buyPrice ?? slot.nav ?? 0);
}

function inferPricingModel(name) {
  const lowered = String(name).toLowerCase();
  if (lowered.includes("gold") || lowered.includes("silver") || lowered.includes("bullion")) return "BULLION";
  if (lowered.includes("etf") || lowered.includes("mutual") || lowered.includes("fund")) return "NAV";
  return "PRICE";
}

function normalizeMarket(value) {
  return String(value).toLowerCase() === "japan" ? "Japan" : "India";
}

function inferMarketFromCurrency(currency) {
  return normalizeCurrency(currency) === "JPY" ? "Japan" : "India";
}

function getMarketSlot(sub, market) {
  const marketData = ensureMarketDataStructure(sub);
  if (!marketData[market]) {
    marketData[market] = { buyPrice: null, sellPrice: null, nav: null, updatedAt: null };
  }
  return marketData[market];
}

function ensureMarketDataStructure(sub) {
  const india = {
    buyPrice: asNullableNumber(sub.marketData?.India?.buyPrice ?? sub.marketBuyPrice),
    sellPrice: asNullableNumber(sub.marketData?.India?.sellPrice ?? sub.marketSellPrice),
    nav: asNullableNumber(sub.marketData?.India?.nav ?? sub.marketNav),
    updatedAt: Number(sub.marketData?.India?.updatedAt || 0) || null,
  };
  const japan = {
    buyPrice: asNullableNumber(sub.marketData?.Japan?.buyPrice),
    sellPrice: asNullableNumber(sub.marketData?.Japan?.sellPrice),
    nav: asNullableNumber(sub.marketData?.Japan?.nav),
    updatedAt: Number(sub.marketData?.Japan?.updatedAt || 0) || null,
  };
  return { India: india, Japan: japan };
}

function asNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeCurrency(value) {
  return value === "JPY" ? "JPY" : "INR";
}

function money(value, currency) {
  return Number(value).toLocaleString(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function setStatus(message) {
  el.statusText.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
