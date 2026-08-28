const API_CONFIG = {
  // 填入 Apps Script Web App URL。
  // 例如: https://script.google.com/macros/s/xxxxx/exec
  apiUrl: "https://script.google.com/macros/s/AKfycbxeF2AVlCYi9A5xnYtvWfEAGJeRg8PwJOaojl3lUNhwkFvTAfxCoLz_hm_kjahIXRukOA/exec",
};

const SAMPLE_ROWS = [
  {
    買進日: "2026-06-29",
    來源: "B 朝欽 3",
    車號: "RFA-2103",
    品牌: "FORD",
    車型: "KUGA",
    年份: "23/05",
    排氣量: "2",
    顏色: "白",
    里程數: "3.5",
    一手車: "NULL",
    車況: "A",
    車況備注: "NULL",
    車輛照片: "NULL",
    售價: "68.9",
    發票: "F",
  },
  {
    買進日: "2026-06-29",
    來源: "M 朝欽 23",
    車號: "RDS-1577",
    品牌: "FORD",
    車型: "KUGA",
    年份: "22/05",
    排氣量: "1.5",
    顏色: "白",
    里程數: "10.2",
    一手車: "NULL",
    車況: "B",
    車況備注: "NULL",
    車輛照片: "NULL",
    售價: "43.9",
    發票: "F",
  },
];

const FIELD_ORDER = [
  "買進日",
  "來源",
  "車號",
  "品牌",
  "車型",
  "年份",
  "排氣量",
  "顏色",
  "里程數",
  "一手車",
  "車況",
  "車況備注",
  "車輛照片",
  "售價",
  "發票",
];

const CARD_SUMMARY_FIELDS = ["年份", "車號", "排氣量", "里程數", "售價"];
const CARD_DETAIL_FIELDS = FIELD_ORDER.filter((field) => !CARD_SUMMARY_FIELDS.includes(field));

const dom = {
  plateInput: document.querySelector("#plateInput"),
  brandSelect: document.querySelector("#brandSelect"),
  modelSelect: document.querySelector("#modelSelect"),
  yearSelect: document.querySelector("#yearSelect"),
  searchButton: document.querySelector("#searchButton"),
  resetFilters: document.querySelector("#resetFilters"),
  statusMessage: document.querySelector("#statusMessage"),
  resultSummary: document.querySelector("#resultSummary"),
  mobileResults: document.querySelector("#mobileResults"),
  tableBody: document.querySelector("#tableBody"),
};

const state = {
  rows: [],
  filteredRows: [],
  filters: {
    plate: "",
    brand: "",
    model: "",
    year: "",
  },
  hasSearched: false,
};

bootstrap();

async function bootstrap() {
  bindEvents();
  try {
    const rows = await loadRows();
    state.rows = normalizeRows(rows);
    setStatus(`資料已載入，共 ${state.rows.length} 筆。`);
  } catch (error) {
    console.error(error);
    state.rows = normalizeRows(SAMPLE_ROWS);
    setStatus("Apps Script API 讀取失敗，已改用示範資料預覽版型。");
  }

  syncFilterOptions();
  renderResults();
}

function bindEvents() {
  dom.plateInput.addEventListener("input", (event) => {
    state.filters.plate = event.target.value.trim().toUpperCase();

    if (state.filters.plate) {
      clearDropdownFilters();
    }
  });

  dom.brandSelect.addEventListener("change", (event) => {
    state.filters.brand = event.target.value;
    state.filters.model = "";
    state.filters.year = "";
    syncFilterOptions();
  });

  dom.modelSelect.addEventListener("change", (event) => {
    state.filters.model = event.target.value;
    state.filters.year = "";
    syncFilterOptions();
  });

  dom.yearSelect.addEventListener("change", (event) => {
    state.filters.year = event.target.value;
  });

  dom.searchButton.addEventListener("click", () => {
    const hasPlateKeyword = Boolean(state.filters.plate);

    if (hasPlateKeyword) {
      clearDropdownFilters();
    }

    const hasBrandAndModel = Boolean(state.filters.brand && state.filters.model);

    if (!hasPlateKeyword && !hasBrandAndModel) {
      setStatus("請先選擇品牌與車型，或直接輸入車號關鍵字查詢。");
      state.hasSearched = false;
      renderResults();
      return;
    }

    state.hasSearched = true;
    applyFilters();
  });

  dom.resetFilters.addEventListener("click", () => {
    state.filters = { plate: "", brand: "", model: "", year: "" };
    state.hasSearched = false;
    dom.plateInput.value = "";
    syncFilterOptions();
    setStatus(`資料已載入，共 ${state.rows.length} 筆，請選擇品牌與車型或輸入車號後查詢。`);
    renderResults();
  });
}

function clearDropdownFilters() {
  if (!state.filters.brand && !state.filters.model && !state.filters.year) {
    return;
  }

  state.filters.brand = "";
  state.filters.model = "";
  state.filters.year = "";
  syncFilterOptions();
}

async function loadRows() {
  if (!API_CONFIG.apiUrl) {
    return SAMPLE_ROWS;
  }

  const response = await fetch(API_CONFIG.apiUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.rows)) {
    throw new Error("API response format is invalid.");
  }

  return payload.rows;
}

function normalizeRows(rows) {
  return rows
    .map((row) => {
      const rawBuyDate = getFirstValue(row, ["買進日", "已買進日", "購入日"]);
      const rawSource = getFirstValue(row, ["來源", "資料來源"]);
      const rawYear = getFirstValue(row, ["年份", "年式"]);

      return {
        買進日: normalizeNullDisplay(rawBuyDate) || "-",
        來源: formatSourceDisplay(rawSource),
        車號: getFirstValue(row, ["車號", "車牌", "牌照"]) || "-",
        品牌: getFirstValue(row, ["品牌"]) || "-",
        車型: getFirstValue(row, ["車型", "型號"]) || "-",
        年份: rawYear || "-",
        排氣量: normalizeDisplacement(getFirstValue(row, ["排氣量", "cc"])) || "-",
        顏色: getFirstValue(row, ["顏色"]) || "-",
        里程數: getFirstValue(row, ["里程數", "里程"]) || "-",
        一手車: normalizeOwnership(getFirstValue(row, ["一手車", "是否一手車", "首手車"])) || "未確認",
        車況: normalizeNullDisplay(getFirstValue(row, ["車況"])) || "-",
        車況備注: normalizeNullDisplay(getFirstValue(row, ["車況備注", "車況備註", "備注", "備註"])) || "-",
        車輛照片: getFirstValue(row, ["車輛照片", "照片", "圖片", "照片網址", "圖片網址"]) || "-",
        售價: normalizePrice(getFirstValue(row, ["售價", "價格"])) || "未開價",
        發票: normalizeNullDisplay(getFirstValue(row, ["發票", "F"])) || "-",
        __buyDateSort: normalizeBuyDateSortValue(rawBuyDate),
        __yearSort: normalizeYearSortValue(rawYear),
      };
    })
    .filter((row) => row.車號 !== "-" || row.品牌 !== "-" || row.車型 !== "-");
}

function getFirstValue(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return "";
}

function formatSourceDisplay(value) {
  const normalized = normalizeNullDisplay(value);
  if (!normalized) {
    return "-";
  }

  if (/^B(?:\s|$)/i.test(normalized)) {
    return "老闆";
  }
  if (/^M(?:\s|$)/i.test(normalized)) {
    return "經理";
  }

  const sourceNameMap = {
    君翰: "君翰",
    書涵: "書涵",
    黛儒: "黛儒",
    揚傑: "揚傑",
    阿池: "池哥",
    欣碩: "欣碩",
  };

  const matchedName = Object.keys(sourceNameMap).find((name) => normalized.startsWith(name));
  if (matchedName) {
    return sourceNameMap[matchedName];
  }

  return normalized;
}

function normalizeDisplacement(value) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.toUpperCase() === "NULL") {
    return "";
  }

  if (/^\d+$/.test(normalized)) {
    return `${normalized}.0`;
  }

  return normalized;
}

function normalizeOwnership(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized || normalized === "NULL") {
    return "未確認";
  }
  if (normalized === "Y" || normalized === "N") {
    return normalized;
  }
  return normalized;
}

function normalizePrice(value) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.toUpperCase() === "NULL") {
    return "未開價";
  }
  return normalized;
}

function normalizeNullDisplay(value) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.toUpperCase() === "NULL") {
    return "";
  }
  return normalized;
}

function normalizeBuyDateSortValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.toUpperCase() === "NULL") {
    return 0;
  }

  const fullDateMatch = normalized.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch;
    return Number(`${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`);
  }

  const monthMatch = normalized.match(/(\d{4})[/-](\d{1,2})/);
  if (monthMatch) {
    const [, year, month] = monthMatch;
    return Number(`${year}${month.padStart(2, "0")}00`);
  }

  return 0;
}

function normalizeYearSortValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.toUpperCase() === "NULL") {
    return 0;
  }

  const yearMonthMatches = [...normalized.matchAll(/(\d{2,4})[/-](\d{1,2})/g)];
  if (yearMonthMatches.length > 0) {
    return Math.max(
      ...yearMonthMatches.map(([, year]) => {
        if (year.length === 2) {
          return Number(`20${year}`);
        }
        return Number(year);
      })
    );
  }

  if (/^\d{4}$/.test(normalized)) {
    return Number(normalized);
  }

  return 0;
}

function syncFilterOptions() {
  const brands = uniqueValues(state.rows, "品牌");
  const models = uniqueValues(
    state.rows.filter((row) => !state.filters.brand || row.品牌 === state.filters.brand),
    "車型"
  );
  const years = uniqueYearValues(
    state.rows.filter(
      (row) =>
        (!state.filters.brand || row.品牌 === state.filters.brand) &&
        (!state.filters.model || row.車型 === state.filters.model)
    )
  );

  fillSelect(dom.brandSelect, brands, "請選擇品牌", state.filters.brand);
  fillSelect(dom.modelSelect, models, "請選擇車型", state.filters.model);
  fillYearSelect(dom.yearSelect, years, "年份選填", state.filters.year);

  dom.modelSelect.disabled = models.length === 0;
  dom.yearSelect.disabled = years.length === 0;
  dom.searchButton.disabled = false;
}

function fillSelect(select, values, defaultLabel, selectedValue) {
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultLabel;
  select.append(defaultOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === selectedValue;
    select.append(option);
  });
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter((value) => value && value !== "-"))].sort(
    (a, b) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true })
  );
}

function uniqueYearValues(rows) {
  const yearMap = new Map();

  rows.forEach((row) => {
    const rawYear = row.年份;
    const displayYear = toDisplayYear(rawYear);
    if (displayYear) {
      yearMap.set(displayYear, displayYear);
    }
  });

  return [...yearMap.values()].sort((a, b) => Number(b) - Number(a));
}

function fillYearSelect(select, values, defaultLabel, selectedValue) {
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultLabel;
  select.append(defaultOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === selectedValue;
    select.append(option);
  });
}

function toDisplayYear(rawYear) {
  const value = String(rawYear || "").trim();
  const yearMonthMatches = [...value.matchAll(/(\d{2,4})[/-](\d{1,2})/g)];

  if (yearMonthMatches.length > 0) {
    const latestYear = Math.max(
      ...yearMonthMatches.map(([, year]) => {
        if (year.length === 2) {
          return Number(`20${year}`);
        }
        return Number(year);
      })
    );
    return String(latestYear);
  }

  if (/^\d{4}$/.test(value)) {
    return value;
  }

  return "";
}

function applyFilters() {
  const hasPlateKeyword = Boolean(state.filters.plate);
  const hasBrandFilter = Boolean(state.filters.brand);
  const hasModelFilter = Boolean(state.filters.model);

  state.filteredRows = state.rows
    .filter((row) => {
      const byPlate = !hasPlateKeyword || row.車號.toUpperCase().includes(state.filters.plate);
      const byBrand = !hasBrandFilter || row.品牌 === state.filters.brand;
      const byModel = !hasModelFilter || row.車型 === state.filters.model;
      const byYear = !state.filters.year || toDisplayYear(row.年份) === state.filters.year;
      return byPlate && byBrand && byModel && byYear;
    })
    .sort(
      (a, b) =>
        (b.__buyDateSort || 0) - (a.__buyDateSort || 0) ||
        (b.__yearSort || 0) - (a.__yearSort || 0)
    );

  setStatus(`資料已載入，共 ${state.rows.length} 筆，查詢結果 ${state.filteredRows.length} 筆。`);
  renderResults();
}

function renderResults() {
  if (!state.hasSearched) {
    dom.resultSummary.textContent = "尚未查詢";
    dom.mobileResults.innerHTML = '<div class="empty-state">請先選擇品牌與車型，或直接輸入車號關鍵字後查詢。</div>';
    dom.tableBody.innerHTML = '<tr><td colspan="15">請先選擇品牌與車型，或直接輸入車號關鍵字後查詢。</td></tr>';
    return;
  }

  dom.resultSummary.textContent = `共 ${state.filteredRows.length} 筆資料`;

  if (state.filteredRows.length === 0) {
    dom.mobileResults.innerHTML = '<div class="empty-state">查無符合條件的車輛資料</div>';
    dom.tableBody.innerHTML = '<tr><td colspan="15">查無符合條件的車輛資料</td></tr>';
    return;
  }

  dom.mobileResults.innerHTML = state.filteredRows.map(renderMobileCard).join("");
  dom.tableBody.innerHTML = state.filteredRows.map(renderTableRow).join("");
}

function renderMobileCard(row) {
  return `
    <details class="result-card">
      <summary class="result-card__summary">
        <div class="result-card__summary-main">
          ${CARD_SUMMARY_FIELDS.map((field) => renderSummaryItem(field, row[field])).join("")}
        </div>
        <span class="result-card__toggle" style="${vehicleColorStyle(row.顏色)}" aria-hidden="true">展開詳細</span>
      </summary>
      <div class="result-card__details">
        <div class="result-card__grid">
          ${CARD_DETAIL_FIELDS.map((field) => renderMetaItem(field, row[field], field === "車況備注")).join("")}
        </div>
      </div>
    </details>
  `;
}

function vehicleColorStyle(color) {
  const palette = resolveVehicleColorPalette(color);
  return [
    `--car-color-a: ${palette.a}`,
    `--car-color-b: ${palette.b}`,
    `--car-button-text: ${palette.text}`,
    `--car-button-border: ${palette.border}`,
    `--car-open-a: ${palette.openA}`,
    `--car-open-b: ${palette.openB}`,
    `--car-open-text: ${palette.openText}`,
  ].join("; ");
}

function resolveVehicleColorPalette(color) {
  const value = String(color || "").trim();
  const palettes = [
    { keys: ["黑"], a: "#4a4d48", b: "#222421", text: "#ffffff", border: "rgba(0, 0, 0, 0.22)", openA: "#2f312e", openB: "#111211", openText: "#ffffff" },
    { keys: ["白"], a: "#ffffff", b: "#ffffff", text: "#263021", border: "rgba(38, 48, 33, 0.5)", openA: "#ffffff", openB: "#ffffff", openText: "#263021" },
    { keys: ["銀", "灰"], a: "#aeb8ad", b: "#717d73", text: "#ffffff", border: "rgba(67, 78, 69, 0.44)", openA: "#7f8a80", openB: "#4e5a51", openText: "#ffffff" },
    { keys: ["藍"], a: "#6f95b3", b: "#3f6f94", text: "#ffffff", border: "rgba(34, 78, 108, 0.28)", openA: "#4d7798", openB: "#2d5572", openText: "#ffffff" },
    { keys: ["紅"], a: "#c76a60", b: "#9a3d35", text: "#ffffff", border: "rgba(120, 39, 33, 0.25)", openA: "#a94f46", openB: "#772c27", openText: "#ffffff" },
    { keys: ["黃", "金"], a: "#e8c96b", b: "#c99b31", text: "#433617", border: "rgba(138, 101, 22, 0.28)", openA: "#d4aa3f", openB: "#a9781f", openText: "#ffffff" },
    { keys: ["綠"], a: "#8aa77a", b: "#647d58", text: "#ffffff", border: "rgba(69, 94, 58, 0.28)", openA: "#718c64", openB: "#4c6542", openText: "#ffffff" },
    { keys: ["棕", "咖啡"], a: "#a98467", b: "#75563f", text: "#ffffff", border: "rgba(91, 63, 43, 0.28)", openA: "#8f6c52", openB: "#5d402e", openText: "#ffffff" },
    { keys: ["紫"], a: "#9a83aa", b: "#6f577e", text: "#ffffff", border: "rgba(83, 59, 96, 0.28)", openA: "#806391", openB: "#553d65", openText: "#ffffff" },
    { keys: ["橘", "橙"], a: "#dc9a57", b: "#b96f2d", text: "#ffffff", border: "rgba(139, 78, 25, 0.28)", openA: "#c37e37", openB: "#90521f", openText: "#ffffff" },
  ];

  return (
    palettes.find((palette) => palette.keys.some((key) => value.includes(key))) ||
    { a: "#d7dccd", b: "#cbd3c0", text: "#4e5947", border: "rgba(98, 110, 93, 0.18)", openA: "#6d7668", openB: "#586153", openText: "#ffffff" }
  );
}

function renderSummaryItem(label, value) {
  return `
    <div class="summary-item">
      <span class="summary-item__label">${escapeHtml(label)}</span>
      <span class="summary-item__value ${statusClass(label, value)}">${escapeHtml(value || "-")}</span>
    </div>
  `;
}

function renderMetaItem(label, value, isFull) {
  if (label === "車輛照片") {
    return `
      <div class="meta-item ${isFull ? "meta-item--full" : ""}">
        <span class="meta-item__label">${escapeHtml(label)}</span>
        ${renderPhotoLink(value)}
      </div>
    `;
  }

  return `
    <div class="meta-item ${isFull ? "meta-item--full" : ""}">
      <span class="meta-item__label">${escapeHtml(label)}</span>
      <span class="meta-item__value ${statusClass(label, value)}">${escapeHtml(value || "-")}</span>
    </div>
  `;
}

function renderTableRow(row) {
  return `
    <tr>
      ${FIELD_ORDER.map((field) => `<td class="${statusClass(field, row[field])}">${renderTableCell(field, row[field])}</td>`).join("")}
    </tr>
  `;
}

function renderTableCell(label, value) {
  if (label === "車輛照片") {
    return renderPhotoLink(value);
  }
  return escapeHtml(value || "-");
}

function renderPhotoLink(value) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized === "-" || normalized.toUpperCase() === "NULL") {
    return '<span class="photo-link photo-link--empty">-</span>';
  }

  if (!/^https?:\/\//i.test(normalized)) {
    return '<span class="photo-link photo-link--empty">-</span>';
  }

  const safeUrl = escapeAttribute(normalized);
  return `<a class="photo-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">查看照片</a>`;
}

function statusClass(label, value) {
  if (label === "車況" && /^A$/i.test(String(value || ""))) {
    return "tag-ok";
  }
  if (label === "車況" && /^B$/i.test(String(value || ""))) {
    return "tag-warn";
  }
  if (label === "售價") {
    return "price-emphasis";
  }
  return "";
}

function setStatus(message) {
  dom.statusMessage.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
