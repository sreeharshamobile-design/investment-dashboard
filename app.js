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
  categoryForm: document.getElementById("categoryForm"),
  categoryName: document.getElementById("categoryName"),
  subCategoryForm: document.getElementById("subCategoryForm"),
  subCategoryParent: document.getElementById("subCategoryParent"),
  subCategoryName: document.getElementById("subCategoryName"),
  subCategoryUnit: document.getElementById("subCategoryUnit"),
  subCategoryPricingModel: document.getElementById("subCategoryPricingModel"),
  marketDataForm: document.getElementById("marketDataForm"),
  marketDataCategory: document.getElementById("marketDataCategory"),
  marketDataMarket: document.getElementById("marketDataMarket"),
  marketDataSubcategory: document.getElementById("marketDataSubcategory"),
  marketBuyPrice: document.getElementById("marketBuyPrice"),
  marketSellPrice: document.getElementById("marketSellPrice"),
  marketNav: document.getElementById("marketNav"),
  fetchJapanGoldPrice: document.getElementById("fetchJapanGoldPrice"),
  marketDataTableBody: document.getElementById("marketDataTableBody"),
  entryForm: document.getElementById("entryForm"),
  entryDate: document.getElementById("entryDate"),
  entryCategory: document.getElementById("entryCategory"),
  entrySubcategory: document.getElementById("entrySubcategory"),
  entryType: document.getElementById("entryType"),
  entryQuantity: document.getElementById("entryQuantity"),
  entryTotalAmount: document.getElementById("entryTotalAmount"),
  entryBuyPrice: document.getElementById("entryBuyPrice"),
  entryMarket: document.getElementById("entryMarket"),
  entryCurrency: document.getElementById("entryCurrency"),
  entryNotes: document.getElementById("entryNotes"),
  historyTableBody: document.getElementById("historyTableBody"),
  historyDateFilter: document.getElementById("historyDateFilter"),
  editDialog: document.getElementById("editDialog"),
  editForm: document.getElementById("editForm"),
  editId: document.getElementById("editId"),
  editDate: document.getElementById("editDate"),
  editType: document.getElementById("editType"),
  editQuantity: document.getElementById("editQuantity"),
  editTotalAmount: document.getElementById("editTotalAmount"),
  editBuyPrice: document.getElementById("editBuyPrice"),
  editMarket: document.getElementById("editMarket"),
  editCurrency: document.getElementById("editCurrency"),
  editNotes: document.getElementById("editNotes"),
  cancelEdit: document.getElementById("cancelEdit"),
};

bootstrap();

function bootstrap() {
  el.entryDate.valueAsDate = new Date();
  syncAddCurrencyFromMarket();
  syncAddQuantityRulesFromType();
  wireEvents();
  render();
}

function wireEvents() {
  el.categoryForm.addEventListener("submit", onAddCategory);
  el.subCategoryForm.addEventListener("submit", onAddSubcategory);
  el.marketDataForm.addEventListener("submit", onSaveMarketData);
  el.marketDataCategory.addEventListener("change", renderMarketSubcategoryOptions);
  el.marketDataMarket.addEventListener("change", fillMarketDataFormForSelectedSubcategory);
  el.marketDataSubcategory.addEventListener("change", fillMarketDataFormForSelectedSubcategory);
  el.fetchJapanGoldPrice.addEventListener("click", onFetchJapanGoldFromIshifuku);

  el.entryForm.addEventListener("submit", onAddEntry);
  el.entryCategory.addEventListener("change", renderSubcategoryOptionsForEntry);
  el.entrySubcategory.addEventListener("change", syncAddEntryPriceFromMarket);
  el.entryQuantity.addEventListener("input", onAddQuantityInput);
  el.entryTotalAmount.addEventListener("input", onAddTotalAmountInput);
  el.entryBuyPrice.addEventListener("input", onAddPriceInput);
  el.entryMarket.addEventListener("change", () => {
    syncAddCurrencyFromMarket();
    syncAddEntryPriceFromMarket();
  });
  el.entryType.addEventListener("change", () => {
    syncAddQuantityRulesFromType();
    syncAddEntryPriceFromMarket();
  });

  el.editMarket.addEventListener("change", () => {
    syncEditCurrencyFromMarket();
    syncEditEntryPriceFromMarket();
  });
  el.editQuantity.addEventListener("input", onEditQuantityInput);
  el.editTotalAmount.addEventListener("input", onEditTotalAmountInput);
  el.editBuyPrice.addEventListener("input", onEditPriceInput);
  el.editType.addEventListener("change", () => {
    syncEditQuantityRulesFromType();
    syncEditEntryPriceFromMarket();
  });

  el.historyDateFilter.addEventListener("change", renderHistory);
  el.editForm.addEventListener("submit", onEditEntry);
  el.cancelEdit.addEventListener("click", () => el.editDialog.close());
}

function onAddCategory(e) {
  e.preventDefault();
  const name = el.categoryName.value.trim();
  if (!name) return;

  state.categories.push({ id: crypto.randomUUID(), name, subcategories: [] });
  saveState();
  el.categoryForm.reset();
  render();
}

function onAddSubcategory(e) {
  e.preventDefault();
  const parentId = el.subCategoryParent.value;
  const name = el.subCategoryName.value.trim();
  const unit = el.subCategoryUnit.value.trim();
  const pricingModel = normalizePricingModel(el.subCategoryPricingModel.value, name);

  if (!parentId || !name || !unit) return;

  const category = state.categories.find((c) => c.id === parentId);
  if (!category) return;

  category.subcategories.push({
    id: crypto.randomUUID(),
    name,
    unit,
    pricingModel,
    marketData: {
      India: { buyPrice: null, sellPrice: null, nav: null, updatedAt: null },
      Japan: { buyPrice: null, sellPrice: null, nav: null, updatedAt: null },
    },
    lastMarketUpdate: null,
  });

  saveState();
  el.subCategoryForm.reset();
  render();
}

function onSaveMarketData(e) {
  e.preventDefault();

  const category = state.categories.find((c) => c.id === el.marketDataCategory.value);
  if (!category) return;

  const sub = category.subcategories.find((s) => s.id === el.marketDataSubcategory.value);
  if (!sub) return;

  const market = normalizeMarket(el.marketDataMarket.value);
  const slot = getMarketSlot(sub, market);
  slot.buyPrice = nullableNum(el.marketBuyPrice.value);
  slot.sellPrice = nullableNum(el.marketSellPrice.value);
  slot.nav = nullableNum(el.marketNav.value);
  slot.updatedAt = Date.now();
  sub.lastMarketUpdate = Date.now();

  saveState();
  render();
}

function onAddEntry(e) {
  e.preventDefault();

  const type = normalizeTransactionType(el.entryType.value);
  const market = normalizeMarket(el.entryMarket.value);
  const sub = findSubcategoryById(el.entrySubcategory.value);
  const resolvedTxPrice = resolveTransactionPrice(type, market, sub, num(el.entryBuyPrice.value));

  const payload = {
    id: crypto.randomUUID(),
    date: el.entryDate.value,
    categoryId: el.entryCategory.value,
    subcategoryId: el.entrySubcategory.value,
    type,
    quantity: signedQuantityForType(el.entryType.value, el.entryQuantity.value),
    buyPrice: resolvedTxPrice,
    market,
    currency: currencyFromMarket(market),
    notes: el.entryNotes.value.trim(),
    createdAt: Date.now(),
  };

  if (payload.type === "SELL") {
    const availableUnits = getAvailableUnitsForSell(payload.subcategoryId, payload.market);
    const sellUnits = Math.abs(payload.quantity);
    if (availableUnits <= 0) {
      alert("No investment units are available to sell for this market and subcategory.");
      return;
    }
    if (sellUnits > availableUnits) {
      alert(`Sell quantity exceeds available units. Available: ${dec(availableUnits)}`);
      return;
    }
  }

  if (
    !payload.date ||
    !payload.categoryId ||
    !payload.subcategoryId ||
    payload.quantity === 0 ||
    payload.buyPrice <= 0 ||
    !payload.market ||
    !payload.currency
  ) {
    return;
  }

  state.entries.push(payload);
  saveState();
  el.entryForm.reset();
  el.entryDate.valueAsDate = new Date();
  syncAddCurrencyFromMarket();
  syncAddQuantityRulesFromType();
  el.entryTotalAmount.value = "";
  render();
}

function onEditEntry(e) {
  e.preventDefault();

  const entry = state.entries.find((item) => item.id === el.editId.value);
  if (!entry) return;
  const type = normalizeTransactionType(el.editType.value);
  const market = normalizeMarket(el.editMarket.value);
  const sub = findSubcategoryById(entry.subcategoryId);
  const resolvedTxPrice = resolveTransactionPrice(type, market, sub, num(el.editBuyPrice.value));
  const nextQuantity = signedQuantityForType(el.editType.value, el.editQuantity.value);

  if (type === "SELL") {
    const availableUnits = getAvailableUnitsForSell(entry.subcategoryId, market, entry.id);
    const sellUnits = Math.abs(nextQuantity);
    if (availableUnits <= 0) {
      alert("No investment units are available to sell for this market and subcategory.");
      return;
    }
    if (sellUnits > availableUnits) {
      alert(`Sell quantity exceeds available units. Available: ${dec(availableUnits)}`);
      return;
    }
  }

  entry.date = el.editDate.value;
  entry.type = type;
  entry.quantity = nextQuantity;
  entry.buyPrice = resolvedTxPrice;
  entry.market = market;
  entry.currency = currencyFromMarket(market);
  entry.notes = el.editNotes.value.trim();

  saveState();
  el.editDialog.close();
  render();
}

function render() {
  renderCategoryOptions();
  renderSubcategoryOptionsForEntry();
  renderMarketSubcategoryOptions();
  fillMarketDataFormForSelectedSubcategory();
  renderAvailableMarketDataTable();

  syncAddCurrencyFromMarket();
  syncAddQuantityRulesFromType();

  renderSummary();
  renderCategoryDashboard();
  renderHistory();
}

function renderCategoryOptions() {
  const options = state.categories
    .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
    .join("");

  el.subCategoryParent.innerHTML = options;
  el.entryCategory.innerHTML = options;
  el.marketDataCategory.innerHTML = options;
}

function renderSubcategoryOptionsForEntry() {
  const category = state.categories.find((cat) => cat.id === el.entryCategory.value) || state.categories[0];
  if (!category) {
    el.entrySubcategory.innerHTML = "";
    return;
  }

  el.entryCategory.value = category.id;

  el.entrySubcategory.innerHTML = category.subcategories
    .map((sub) => {
      const tag = pricingTag(sub.pricingModel);
      return `<option value="${sub.id}">${escapeHtml(sub.name)} (${escapeHtml(sub.unit)}) - ${tag}</option>`;
    })
    .join("");
  syncAddEntryPriceFromMarket();
}

function renderMarketSubcategoryOptions() {
  const category = state.categories.find((cat) => cat.id === el.marketDataCategory.value) || state.categories[0];
  if (!category) {
    el.marketDataSubcategory.innerHTML = "";
    return;
  }

  el.marketDataCategory.value = category.id;

  el.marketDataSubcategory.innerHTML = category.subcategories
    .map((sub) => {
      const tag = pricingTag(sub.pricingModel);
      return `<option value="${sub.id}">${escapeHtml(sub.name)} - ${tag}</option>`;
    })
    .join("");
}

function fillMarketDataFormForSelectedSubcategory() {
  const sub = findSelectedMarketSubcategory();
  const market = normalizeMarket(el.marketDataMarket.value);
  if (!sub) {
    el.marketBuyPrice.value = "";
    el.marketSellPrice.value = "";
    el.marketNav.value = "";
    return;
  }

  const slot = getMarketSlot(sub, market);
  el.marketBuyPrice.value = slot.buyPrice == null ? "" : String(slot.buyPrice);
  el.marketSellPrice.value = slot.sellPrice == null ? "" : String(slot.sellPrice);
  el.marketNav.value = slot.nav == null ? "" : String(slot.nav);
  applyMarketFieldRules(sub.pricingModel);
}

function renderAvailableMarketDataTable() {
  if (!el.marketDataTableBody) return;

  const rows = state.categories
    .flatMap((category) =>
      category.subcategories.map((sub) => {
        const india = getMarketSlot(sub, "India");
        const japan = getMarketSlot(sub, "Japan");
        return `
          <tr>
            <td>${escapeHtml(category.name)}</td>
            <td>${escapeHtml(sub.name)}</td>
            <td>${escapeHtml(pricingTag(sub.pricingModel))}</td>
            <td>${displayNumber(india.buyPrice)}</td>
            <td>${displayNumber(india.sellPrice)}</td>
            <td>${displayNumber(india.nav)}</td>
            <td>${displayNumber(japan.buyPrice)}</td>
            <td>${displayNumber(japan.sellPrice)}</td>
            <td>${displayNumber(japan.nav)}</td>
            <td><button class="icon-btn" type="button" data-action="edit-market" data-category-id="${category.id}" data-sub-id="${sub.id}">Edit</button></td>
          </tr>
        `;
      })
    )
    .join("");

  el.marketDataTableBody.innerHTML =
    rows || '<tr><td colspan="10" style="text-align:center; color:#50607b;">No market data configured</td></tr>';

  el.marketDataTableBody.querySelectorAll("button[data-action='edit-market']").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.marketDataCategory.value = btn.dataset.categoryId;
      renderMarketSubcategoryOptions();
      el.marketDataSubcategory.value = btn.dataset.subId;
      fillMarketDataFormForSelectedSubcategory();
      el.marketDataForm.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

function applyMarketFieldRules(pricingModel) {
  const model = normalizePricingModel(pricingModel);

  const isBullion = model === "BULLION";
  const isNav = model === "NAV";

  el.marketBuyPrice.disabled = isNav;
  el.marketSellPrice.disabled = isNav;
  el.marketNav.disabled = isBullion;
}

function findSelectedMarketSubcategory() {
  const category = state.categories.find((cat) => cat.id === el.marketDataCategory.value) || state.categories[0];
  if (!category) return null;
  return category.subcategories.find((sub) => sub.id === el.marketDataSubcategory.value) || category.subcategories[0] || null;
}

async function onFetchJapanGoldFromIshifuku() {
  const sub = findSelectedMarketSubcategory();
  if (!sub) return;

  const subName = String(sub.name).toLowerCase();
  const isGold = subName.includes("gold") || String(sub.name).includes("金");
  if (!isGold) return;

  el.marketDataMarket.value = "Japan";

  try {
    const response = await fetch("https://r.jina.ai/http://retail.ishifuku-kinzoku.co.jp/");
    if (!response.ok) return;
    const text = await response.text();

    // Best-effort parse of Ishifuku retail page text.
    const line = text
      .split("\n")
      .find((v) => v.includes("金(g)") || v.includes("ゴールド") || v.toLowerCase().includes("gold"));
    if (!line) return;

    const nums = line.match(/[0-9][0-9,]*/g);
    if (!nums || nums.length < 2) return;

    const retail = Number(nums[nums.length - 2].replaceAll(",", ""));
    const buyback = Number(nums[nums.length - 1].replaceAll(",", ""));

    if (Number.isFinite(retail)) el.marketBuyPrice.value = String(retail);
    if (Number.isFinite(buyback)) el.marketSellPrice.value = String(buyback);
    el.marketDataForm.requestSubmit();
  } catch {
    // No-op: user can still enter prices manually if fetch/parsing fails.
  }
}

function syncAddCurrencyFromMarket() {
  el.entryMarket.value = normalizeMarket(el.entryMarket.value);
  el.entryCurrency.value = currencyFromMarket(el.entryMarket.value);
}

function syncEditCurrencyFromMarket() {
  el.editMarket.value = normalizeMarket(el.editMarket.value);
  el.editCurrency.value = currencyFromMarket(el.editMarket.value);
}

function syncAddQuantityRulesFromType() {
  const type = normalizeTransactionType(el.entryType.value);
  if (type === "CORRECTION") {
    el.entryQuantity.min = "-999999999";
    el.entryQuantity.placeholder = "Use + or - quantity";
    el.entryBuyPrice.readOnly = false;
    el.entryTotalAmount.readOnly = false;
    return;
  }
  el.entryQuantity.min = "0";
  el.entryQuantity.placeholder = "10";
  el.entryBuyPrice.readOnly = true;
  el.entryTotalAmount.readOnly = true;
}

function syncEditQuantityRulesFromType() {
  const type = normalizeTransactionType(el.editType.value);
  if (type === "CORRECTION") {
    el.editQuantity.min = "-999999999";
    el.editBuyPrice.readOnly = false;
    el.editTotalAmount.readOnly = false;
    return;
  }
  el.editQuantity.min = "0";
  el.editBuyPrice.readOnly = true;
  el.editTotalAmount.readOnly = true;
}

function syncAddEntryPriceFromMarket() {
  const type = normalizeTransactionType(el.entryType.value);
  if (type === "CORRECTION") {
    syncAddTotalFromPrice();
    return;
  }
  const sub = findSubcategoryById(el.entrySubcategory.value);
  const market = normalizeMarket(el.entryMarket.value);
  const price = resolveTransactionPrice(type, market, sub, 0);
  el.entryBuyPrice.value = price > 0 ? String(price) : "";
  syncAddTotalFromPrice();
}

function syncEditEntryPriceFromMarket() {
  const entry = state.entries.find((item) => item.id === el.editId.value);
  if (!entry) return;
  const type = normalizeTransactionType(el.editType.value);
  if (type === "CORRECTION") {
    syncEditTotalFromPrice();
    return;
  }
  const sub = findSubcategoryById(entry.subcategoryId);
  const market = normalizeMarket(el.editMarket.value);
  const price = resolveTransactionPrice(type, market, sub, 0);
  el.editBuyPrice.value = price > 0 ? String(price) : "";
  syncEditTotalFromPrice();
}

function onAddQuantityInput() {
  if (normalizeTransactionType(el.entryType.value) === "CORRECTION" && num(el.entryTotalAmount.value) > 0) {
    syncAddPriceFromTotal();
    return;
  }
  syncAddTotalFromPrice();
}

function onAddTotalAmountInput() {
  if (normalizeTransactionType(el.entryType.value) !== "CORRECTION") return;
  syncAddPriceFromTotal();
}

function onAddPriceInput() {
  if (normalizeTransactionType(el.entryType.value) !== "CORRECTION") return;
  syncAddTotalFromPrice();
}

function onEditQuantityInput() {
  if (normalizeTransactionType(el.editType.value) === "CORRECTION" && num(el.editTotalAmount.value) > 0) {
    syncEditPriceFromTotal();
    return;
  }
  syncEditTotalFromPrice();
}

function onEditTotalAmountInput() {
  if (normalizeTransactionType(el.editType.value) !== "CORRECTION") return;
  syncEditPriceFromTotal();
}

function onEditPriceInput() {
  if (normalizeTransactionType(el.editType.value) !== "CORRECTION") return;
  syncEditTotalFromPrice();
}

function syncAddPriceFromTotal() {
  const qty = Math.abs(num(el.entryQuantity.value));
  const total = num(el.entryTotalAmount.value);
  if (qty <= 0 || total <= 0) return;
  el.entryBuyPrice.value = String(round2(total / qty));
}

function syncAddTotalFromPrice() {
  const qty = Math.abs(num(el.entryQuantity.value));
  const price = num(el.entryBuyPrice.value);
  if (qty <= 0 || price <= 0) {
    el.entryTotalAmount.value = "";
    return;
  }
  el.entryTotalAmount.value = String(round2(qty * price));
}

function syncEditPriceFromTotal() {
  const qty = Math.abs(num(el.editQuantity.value));
  const total = num(el.editTotalAmount.value);
  if (qty <= 0 || total <= 0) return;
  el.editBuyPrice.value = String(round2(total / qty));
}

function syncEditTotalFromPrice() {
  const qty = Math.abs(num(el.editQuantity.value));
  const price = num(el.editBuyPrice.value);
  if (qty <= 0 || price <= 0) {
    el.editTotalAmount.value = "";
    return;
  }
  el.editTotalAmount.value = String(round2(qty * price));
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
          const totalsByCurrency = groupTotalsByCurrency(related);
          const purchasedPnByCurrency = groupPurchasedPnByCurrency(related);

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
          <td>
            <div class="actions">
              <button class="icon-btn" type="button" data-action="edit" data-id="${entry.id}">Edit</button>
              <button class="icon-btn" type="button" data-action="delete" data-id="${entry.id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  el.historyTableBody.innerHTML =
    rows || '<tr><td colspan="12" style="text-align:center; color:#50607b;">No matching entries found</td></tr>';

  el.historyTableBody.querySelectorAll("button[data-action='edit']").forEach((btn) => {
    btn.addEventListener("click", () => openEditDialog(btn.dataset.id));
  });

  el.historyTableBody.querySelectorAll("button[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", () => deleteEntry(btn.dataset.id));
  });
}

function openEditDialog(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  el.editId.value = entry.id;
  el.editDate.value = entry.date;
  el.editType.value = normalizeTransactionType(entry.type);
  el.editQuantity.value = String(displayQuantity(entry.quantity, entry.type));
  el.editBuyPrice.value = String(entry.buyPrice);
  el.editTotalAmount.value = String(round2(Math.abs(entry.quantity) * entry.buyPrice));
  el.editMarket.value = normalizeMarket(entry.market || inferMarket(entry.currency));
  el.editCurrency.value = currencyFromMarket(el.editMarket.value);
  el.editNotes.value = entry.notes || "";

  syncEditQuantityRulesFromType();
  syncEditEntryPriceFromMarket();
  el.editDialog.showModal();
}

function deleteEntry(id) {
  state.entries = state.entries.filter((entry) => entry.id !== id);
  saveState();
  render();
}

function createLookupMap() {
  const categoryById = new Map();
  const subById = new Map();

  state.categories.forEach((category) => {
    categoryById.set(category.id, category);
    category.subcategories.forEach((sub) => subById.set(sub.id, sub));
  });

  return { categoryById, subById };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function findSubcategoryById(subcategoryId) {
  for (const category of state.categories) {
    const sub = category.subcategories.find((item) => item.id === subcategoryId);
    if (sub) return sub;
  }
  return null;
}

function getAvailableUnitsForSell(subcategoryId, market, excludeEntryId = "") {
  return state.entries
    .filter((entry) => entry.subcategoryId === subcategoryId)
    .filter((entry) => normalizeMarket(entry.market) === normalizeMarket(market))
    .filter((entry) => entry.id !== excludeEntryId)
    .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
}

function resolveTransactionPrice(type, market, sub, fallbackPrice) {
  if (normalizeTransactionType(type) === "CORRECTION") return fallbackPrice;
  if (!sub) return fallbackPrice;

  const slot = getMarketSlot(sub, normalizeMarket(market));
  if (normalizeTransactionType(type) === "BUY") {
    return num(slot.buyPrice ?? slot.nav ?? slot.sellPrice);
  }
  return num(slot.sellPrice ?? slot.nav ?? slot.buyPrice);
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

function signedQuantityForType(type, quantityInput) {
  const quantity = num(quantityInput);
  const normalizedType = normalizeTransactionType(type);
  if (normalizedType === "SELL") return -Math.abs(quantity);
  if (normalizedType === "CORRECTION") return quantity;
  return Math.abs(quantity);
}

function displayQuantity(quantity, type) {
  const normalizedType = normalizeTransactionType(type);
  if (normalizedType === "SELL") return Math.abs(quantity);
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

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
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

function displayNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  return dec(value);
}
