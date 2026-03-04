const STORAGE_KEY = "investment-dashboard-v1";

function buildDefaultState() {
  return {
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
}

function seedSub(name, unit, pricingModel) {
  return {
    id: crypto.randomUUID(),
    name,
    unit,
    pricingModel,
    marketData: {
      India: { buyPrice: null, sellPrice: null, nav: null, updatedAt: null },
      Japan: { buyPrice: null, sellPrice: null, nav: null, updatedAt: null },
    },
    lastMarketUpdate: null,
  };
}

let state = loadState();

const el = {
  summaryCards: document.getElementById("summaryCards"),
  categoryDashboard: document.getElementById("categoryDashboard"),
  historyTableBody: document.getElementById("historyTableBody"),
  historyDateFilter: document.getElementById("historyDateFilter"),
};

bootstrap();

function bootstrap() {
  el.historyDateFilter.addEventListener("change", renderHistory);
  render();
}

function render() {
  state = loadState();
  renderSummary();
  renderCategoryDashboard();
  renderHistory();
}

function renderSummary() {
  const totalsByCurrency = groupTotalsByCurrency(state.entries);
  const purchasedPnByCurrency = groupPurchasedPnByCurrency(state.entries);
  const cards = [["Total Entries", String(state.entries.length)]];

  Object.entries(totalsByCurrency).forEach(([currency, totals]) => {
    const purchasedPn = purchasedPnByCurrency[currency] || { invested: 0, current: 0 };
    const profit = purchasedPn.current - purchasedPn.invested;
    cards.push([`${currency} Net Invested`, money(totals.invested, currency)]);
    cards.push([`${currency} Current Sell Value`, money(purchasedPn.current, currency)]);
    cards.push([`${currency} P/L`, money(profit, currency)]);
  });

  el.summaryCards.innerHTML = cards
    .map(
      ([label, value]) => `
      <article class="summary-card">
        <p>${escapeHtml(label)}</p>
        <strong>${escapeHtml(value)}</strong>
      </article>`
    )
    .join("");
}

function renderCategoryDashboard() {
  const subById = createLookupMap().subById;

  const markup = state.categories
    .map((category) => {
      const rows = category.subcategories
        .map((sub) => {
          const related = state.entries.filter((entry) => entry.subcategoryId === sub.id);

          if (related.length === 0) {
            return `
              <div class="category-item">
                <div>
                  <strong>${escapeHtml(sub.name)}</strong>
                  <small>No entries yet</small>
                </div>
                <div>Qty: 0 ${escapeHtml(sub.unit)}</div>
                <div>Net Invested: ${money(0)}</div>
                <div>Current: ${money(0)}</div>
              </div>
            `;
          }

          const qty = related.reduce((sum, item) => sum + item.quantity, 0);
          const totalsByCurrency = groupTotalsByCurrency(related, subById);
          const purchasedPnByCurrency = groupPurchasedPnByCurrency(related, subById);

          const pnlText = Object.entries(purchasedPnByCurrency)
            .map(([currency, pn]) => {
              const diff = pn.current - pn.invested;
              const cls = diff >= 0 ? "gain" : "loss";
              return `<small class="${cls}">${currency}: ${money(diff, currency)}</small>`;
            })
            .join(" ");

          const investedText = Object.entries(totalsByCurrency)
            .map(([currency, totals]) => `${currency}: ${money(totals.invested, currency)}`)
            .join(" | ");

          const currentText = Object.entries(totalsByCurrency)
            .map(([currency, totals]) => `${currency}: ${money(totals.current, currency)}`)
            .join(" | ");

          return `
            <div class="category-item">
              <div>
                <strong>${escapeHtml(sub.name)} (${pricingTag(sub.pricingModel)})</strong>
                ${pnlText}
              </div>
              <div>Qty: ${dec(qty)} ${escapeHtml(sub.unit)}</div>
              <div>Net Invested: ${escapeHtml(investedText)}</div>
              <div>Current: ${escapeHtml(currentText)}</div>
            </div>
          `;
        })
        .join("");

      const categoryEntries = state.entries.filter((entry) => entry.categoryId === category.id);
      const categoryCurrent = groupTotalsByCurrency(categoryEntries, subById);
      const categoryCurrentText = Object.entries(categoryCurrent)
        .map(([currency, totals]) => `${currency}: ${money(totals.current, currency)}`)
        .join(" | ");

      return `
        <article class="category-card">
          <div class="category-head">
            <span>${escapeHtml(category.name)}</span>
            <small>Current Value: ${escapeHtml(categoryCurrentText || "No entries")}</small>
          </div>
          ${rows || `<div class="category-item">No subcategories</div>`}
        </article>
      `;
    })
    .join("");

  el.categoryDashboard.innerHTML = markup || "<p>No categories created yet.</p>";
}

function renderHistory() {
  const filterDate = el.historyDateFilter.value;
  const map = createLookupMap();

  const rows = state.entries
    .filter((entry) => !filterDate || entry.date === filterDate)
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
    .map((entry) => {
      const sub = map.subById.get(entry.subcategoryId);
      const marketUnit = getCurrentUnitPrice(sub, entry.market);
      const invested = entry.quantity * entry.buyPrice;
      const current = entry.quantity * marketUnit;

      return `
        <tr>
          <td>${escapeHtml(entry.date)}</td>
          <td>${escapeHtml(entry.market || "-")}</td>
          <td>${escapeHtml(normalizeCurrency(entry.currency))}</td>
          <td>${escapeHtml(readableType(entry.type))}</td>
          <td>${escapeHtml(map.categoryById.get(entry.categoryId)?.name || "Unknown")}</td>
          <td>${escapeHtml(sub?.name || "Unknown")}</td>
          <td>${dec(displayQuantity(entry.quantity, entry.type))} ${escapeHtml(sub?.unit || "")}</td>
          <td>${money(entry.buyPrice, normalizeCurrency(entry.currency))}</td>
          <td>${money(marketUnit, normalizeCurrency(entry.currency))}</td>
          <td>${money(invested, normalizeCurrency(entry.currency))}</td>
          <td>${money(current, normalizeCurrency(entry.currency))}</td>
        </tr>
      `;
    })
    .join("");

  el.historyTableBody.innerHTML =
    rows || '<tr><td colspan="11" style="text-align:center; color:#50607b;">No matching entries found</td></tr>';
}

function createLookupMap() {
  const categoryById = new Map();
  const subById = new Map();

  state.categories.forEach((category) => {
    categoryById.set(category.id, category);
    category.subcategories.forEach((sub) => subById.set(sub.id, sanitizeSubcategory(sub)));
  });

  return { categoryById, subById };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return buildDefaultState();

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.categories || !parsed.entries) return buildDefaultState();

    const categories = parsed.categories.map((category) => ({
      id: category.id || crypto.randomUUID(),
      name: category.name || "Untitled",
      subcategories: (category.subcategories || []).map((sub) => sanitizeSubcategory(sub)),
    }));

    const entries = (parsed.entries || []).map((entry) => ({
      ...entry,
      id: entry.id || crypto.randomUUID(),
      type: normalizeTransactionType(entry.type),
      market: normalizeMarket(entry.market || inferMarket(entry.currency)),
      currency: currencyFromMarket(entry.market || inferMarket(entry.currency)),
      quantity: Number(entry.quantity || 0),
      buyPrice: Number(entry.buyPrice || 0),
      createdAt: Number(entry.createdAt || Date.now()),
    }));

    return { categories, entries };
  } catch {
    return buildDefaultState();
  }
}

function sanitizeSubcategory(sub) {
  const name = sub.name || "Untitled";
  const marketData = ensureMarketDataStructure(sub);
  return {
    id: sub.id || crypto.randomUUID(),
    name,
    unit: sub.unit || "units",
    pricingModel: normalizePricingModel(sub.pricingModel, name),
    marketData,
    lastMarketUpdate: Number(sub.lastMarketUpdate || 0) || null,
  };
}

function getCurrentUnitPrice(sub, market) {
  if (!sub) return 0;
  const slot = getMarketSlot(sub, normalizeMarket(market || "India"));

  const model = normalizePricingModel(sub.pricingModel, sub.name);
  if (model === "BULLION") return num(slot.sellPrice);
  if (model === "NAV") return num(slot.nav);
  return num(slot.sellPrice ?? slot.buyPrice ?? slot.nav);
}

function groupTotalsByCurrency(entries, subById = createLookupMap().subById) {
  return entries.reduce((acc, entry) => {
    const currency = normalizeCurrency(entry.currency);
    if (!acc[currency]) acc[currency] = { invested: 0, current: 0 };

    const sub = subById.get(entry.subcategoryId);
    const currentUnit = getCurrentUnitPrice(sub, entry.market);

    acc[currency].invested += entry.quantity * entry.buyPrice;
    acc[currency].current += entry.quantity * currentUnit;
    return acc;
  }, {});
}

function groupPurchasedPnByCurrency(entries, subById = createLookupMap().subById) {
  return entries.reduce((acc, entry) => {
    const qty = Number(entry.quantity || 0);
    if (qty <= 0) return acc;

    const currency = normalizeCurrency(entry.currency);
    if (!acc[currency]) acc[currency] = { invested: 0, current: 0 };

    const sub = subById.get(entry.subcategoryId);
    const currentUnit = getCurrentUnitPrice(sub, entry.market);

    acc[currency].invested += qty * Number(entry.buyPrice || 0);
    acc[currency].current += qty * currentUnit;
    return acc;
  }, {});
}

function normalizeCurrency(value) {
  if (value === "JPY") return "JPY";
  return "INR";
}

function inferMarket(currency) {
  return normalizeCurrency(currency) === "JPY" ? "Japan" : "India";
}

function normalizeMarket(value) {
  return String(value).toLowerCase() === "japan" ? "Japan" : "India";
}

function currencyFromMarket(market) {
  return normalizeMarket(market) === "Japan" ? "JPY" : "INR";
}

function normalizeTransactionType(type) {
  if (type === "SELL") return "SELL";
  if (type === "CORRECTION") return "CORRECTION";
  return "BUY";
}

function normalizePricingModel(model, name = "") {
  if (model === "BULLION" || model === "NAV" || model === "PRICE") return model;

  const lowered = String(name).toLowerCase();
  if (lowered.includes("gold") || lowered.includes("silver") || lowered.includes("bullion")) return "BULLION";
  if (lowered.includes("etf") || lowered.includes("mutual") || lowered.includes("fund")) return "NAV";
  return "PRICE";
}

function ensureMarketDataStructure(sub) {
  const india = {
    buyPrice: nullableNum(sub.marketData?.India?.buyPrice ?? sub.marketBuyPrice),
    sellPrice: nullableNum(sub.marketData?.India?.sellPrice ?? sub.marketSellPrice),
    nav: nullableNum(sub.marketData?.India?.nav ?? sub.marketNav),
    updatedAt: Number(sub.marketData?.India?.updatedAt || 0) || null,
  };
  const japan = {
    buyPrice: nullableNum(sub.marketData?.Japan?.buyPrice),
    sellPrice: nullableNum(sub.marketData?.Japan?.sellPrice),
    nav: nullableNum(sub.marketData?.Japan?.nav),
    updatedAt: Number(sub.marketData?.Japan?.updatedAt || 0) || null,
  };
  return { India: india, Japan: japan };
}

function getMarketSlot(sub, market) {
  if (!sub.marketData) sub.marketData = ensureMarketDataStructure(sub);
  if (!sub.marketData[market]) {
    sub.marketData[market] = { buyPrice: null, sellPrice: null, nav: null, updatedAt: null };
  }
  return sub.marketData[market];
}

function pricingTag(model) {
  const normalized = normalizePricingModel(model);
  if (normalized === "BULLION") return "Buy/Sell";
  if (normalized === "NAV") return "NAV";
  return "Market";
}

function displayQuantity(quantity, type) {
  if (normalizeTransactionType(type) === "SELL") return Math.abs(quantity);
  return quantity;
}

function readableType(type) {
  const normalizedType = normalizeTransactionType(type);
  if (normalizedType === "SELL") return "Sell";
  if (normalizedType === "CORRECTION") return "Correction";
  return "Buy";
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nullableNum(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dec(value) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function money(value, currency = "INR") {
  return Number(value).toLocaleString(undefined, {
    style: "currency",
    currency: normalizeCurrency(currency),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
