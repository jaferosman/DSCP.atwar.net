(function () {
  const R = window.REPORT;
  const PAGE = document.body.dataset.page;
  const LINKS = [
    ["index.html", "home", "الرئيسية"],
    ["asnaf.html", "asnaf", "الأصناف والإنجاز"],
    ["tirador.html", "tirador", "فروع تيرادور"],
    ["atwar.html", "atwar", "مندوبو أطوار"],
    ["ribh.html", "ribh", "صافي الربح"],
    ["haraka.html", "haraka", "حركة الأشهر"],
    ["tirador-qita.html", "tsec", "فروع وقطاعات"],
    ["atwar-manatiq.html", "areg", "مناطق أطوار"],
  ];

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function finite(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function fmtQty(value) {
    if (!finite(value)) return "—";
    const digits = Math.abs(value - Math.round(value)) < 0.05 ? 0 : 1;
    return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function fmtMoney(value) {
    if (!finite(value)) return "—";
    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtPct(value) {
    if (!finite(value)) return "—";
    return value.toLocaleString("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function num(value, kind) {
    const text = kind === "qty" || kind === "deltaQty" ? fmtQty(value) : kind === "pct" || kind === "deltaPct" ? fmtPct(value) : fmtMoney(value);
    let tone = "";
    if ((kind === "profit" || kind === "deltaQty" || kind === "deltaPct") && finite(value)) {
      tone = value < 0 ? " neg" : value > 0 ? " pos" : "";
    }
    return `<span class="num${tone}">${text}</span>`;
  }

  function rate(value) {
    if (!finite(value)) return num(null, "pct");
    const band = value < 0.05 ? "rate-low" : value < 0.15 ? "rate-mid" : "rate-high";
    return `<span class="num ${band}">${fmtPct(value)}</span>`;
  }

  function cmp(a, b, key, type, dir) {
    const va = a[key];
    const vb = b[key];
    const emptyA = va == null || va === "";
    const emptyB = vb == null || vb === "";
    if (emptyA && emptyB) return 0;
    if (emptyA) return 1;
    if (emptyB) return -1;
    if (type === "text") return String(va).localeCompare(String(vb), "ar") * dir;
    return (va - vb) * dir;
  }

  function sortRows(rows, columns, sort, dir) {
    const col = columns.find((item) => item.key === sort);
    const type = col ? col.type : "num";
    return rows.slice().sort((a, b) => cmp(a, b, sort, type, dir));
  }

  function tableHtml(columns, rows, sort, dir) {
    const cellClass = (col) => [col.type === "num" ? "numcol" : "", col.stick ? "stick" : "", col.clip ? "clip" : ""].filter(Boolean).join(" ");
    const head = columns.map((col) => {
      if (col.nosort) return `<th class="${cellClass(col)}">${esc(col.label)}</th>`;
      const mark = sort === col.key ? (dir < 0 ? " ↓" : " ↑") : "";
      return `<th class="${cellClass(col)}" data-k="${esc(col.key)}" data-t="${col.type || "num"}" role="button" tabindex="0">${esc(col.label)}${mark}</th>`;
    }).join("");
    const body = rows.map((row) => {
      const cells = columns.map((col) => `<td class="${cellClass(col)}">${col.html(row)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    }).join("");
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function mountTable(host, columns, rows, state, onChange) {
    const sorted = sortRows(rows, columns, state.sort, state.dir);
    host.innerHTML = tableHtml(columns, sorted, state.sort, state.dir);
    host.querySelectorAll("th[data-k]").forEach((th) => {
      const activate = () => {
        const key = th.dataset.k;
        const type = th.dataset.t || "num";
        if (state.sort === key) state.dir *= -1;
        else {
          state.sort = key;
          state.dir = type === "text" ? 1 : -1;
        }
        onChange();
      };
      th.addEventListener("click", activate);
      th.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });
  }

  function hbars(rows, labelFn, valueFn, formatFn, scale, fillClass) {
    if (!rows.length) return `<p class="lead">لا توجد بيانات لهذا الاختيار.</p>`;
    const max = scale || Math.max(...rows.map((row) => Math.abs(valueFn(row))), 0.0001);
    return `<div class="bars">${rows.map((row) => {
      const value = valueFn(row);
      const width = Math.min(100, (Math.abs(value) / max) * 100);
      let tone = "";
      if (fillClass === "rate") tone = value < 0.05 ? " neg" : value < 0.15 ? " gold" : " good";
      else if (value < 0) tone = " neg";
      else if (fillClass) tone = ` ${fillClass}`;
      return `<div class="bar-row">
        <div class="bar-name">${esc(labelFn(row))}</div>
        <div class="bar-track"><div class="bar-fill${tone}" style="width:${width.toFixed(2)}%"></div></div>
        <div class="bar-val">${formatFn(value)}</div>
      </div>`;
    }).join("")}</div>`;
  }

  function kpis(items) {
    return `<div class="kpis">${items.map((item) => `
      <article class="kpi ${item.tone || ""}">
        <p class="kpi-label">${esc(item.label)}</p>
        <p class="kpi-value">${item.html}</p>
        ${item.note ? `<p class="kpi-note">${item.note}</p>` : ""}
      </article>`).join("")}</div>`;
  }

  function branchLabel(row) {
    if (!row.warehouse) return "بدون مستودع في الرصيد";
    return row.warehouse.replace(/^مستودع\s+/, "");
  }

  function bootChrome() {
    const nav = document.getElementById("nav");
    nav.innerHTML = LINKS.map(([href, id, label]) => {
      const current = id === PAGE ? ' aria-current="page"' : "";
      return `<a href="${href}"${current}>${label}</a>`;
    }).join("");
    const period = document.getElementById("period");
    if (period) period.textContent = `${R.meta.period} · ${R.meta.periodNote}`;
  }

  function renderHome() {
    const t = R.totals;
    const best = R.sectors.slice().sort((a, b) => (b.qtyRate || -1) - (a.qtyRate || -1))[0];
    const worst = R.sectors.slice().sort((a, b) => a.profit - b.profit)[0];
    const idle = R.items.filter((item) => !item.netQty && !item.salesValue).length;
    const app = document.getElementById("app");
    app.innerHTML = `
      ${kpis([
        { label: "قيمة المخزون الافتتاحي", html: num(t.openValue, "money"), note: `${fmtQty(t.openQty)} وحدة` },
        { label: "صافي الكمية المباعة", html: num(t.netQty, "qty"), note: "يوليو إلى 2 أكتوبر" },
        { label: "إنجاز الكمية", html: rate(t.qtyRate), tone: "gold", note: "من رصيد الافتتاح" },
        { label: "إنجاز القيمة", html: rate(t.valueRate), tone: "gold", note: "من قيمة الافتتاح" },
        { label: "قيمة المبيعات", html: num(t.salesValue, "money"), note: "غير شاملة الضريبة" },
        { label: "صافي الربح", html: num(t.profit, "profit"), tone: t.profit >= 0 ? "good" : "bad", note: `هامش ${fmtPct(t.margin)}` },
      ])}
      <div class="cards">
        <a class="card" href="asnaf.html">
          <span class="card-n">01</span>
          <div><h2>الأصناف والقطاعات</h2><p>الأداء حسب القطاع وحسب الصنف، مع معدلي إنجاز الكمية والقيمة.</p></div>
          <div class="card-stat"><strong class="num">${fmtPct(t.qtyRate)}</strong><span>إنجاز الكمية</span></div>
        </a>
        <a class="card" href="tirador.html">
          <span class="card-n">02</span>
          <div><h2>فروع تيرادور</h2><p>مبيعات كل فرع ورصيد الرواكد الحالي في مستودعه.</p></div>
          <div class="card-stat"><strong class="num">${fmtMoney(R.tirador.totals.profit)}</strong><span>صافي ربح تيرادور</span></div>
        </a>
        <a class="card" href="atwar.html">
          <span class="card-n">03</span>
          <div><h2>مندوبو أطوار</h2><p>كمية البيع وقيمته وربحه لكل مندوب خلال الفترة.</p></div>
          <div class="card-stat"><strong class="num">${fmtMoney(R.atwar.totals.salesValue)}</strong><span>مبيعات أطوار</span></div>
        </a>
        <a class="card" href="ribh.html">
          <span class="card-n">04</span>
          <div><h2>صافي الربح</h2><p>مقارنة أطوار وتيرادور بالشهر وبالقطاع.</p></div>
          <div class="card-stat"><strong class="num">${fmtPct(R.tirador.totals.margin)}</strong><span>هامش تيرادور</span></div>
        </a>
        <a class="card" href="haraka.html">
          <span class="card-n">05</span>
          <div><h2>حركة الأشهر الثلاثة</h2><p>تصاعد كمية البيع أو تقلصها من يوليو إلى سبتمبر، قطاعاً بقطاع.</p></div>
          <div class="card-stat"><strong class="num">${fmtPct((R.totals.sep - R.totals.jul) / R.totals.jul)}</strong><span>من يوليو إلى سبتمبر</span></div>
        </a>
        <a class="card" href="tirador-qita.html">
          <span class="card-n">06</span>
          <div><h2>فروع تيرادور والقطاعات</h2><p>مبيعات كل فرع من كل قطاع، مع المخزون الحالي إجمالاً وتفصيلاً.</p></div>
          <div class="card-stat"><strong class="num">${fmtQty(R.tirador.branches.length)}</strong><span>فرع</span></div>
        </a>
        <a class="card" href="atwar-manatiq.html">
          <span class="card-n">07</span>
          <div><h2>مناطق أطوار</h2><p>توزيع المبيعات على المناطق، وعدد العملاء في كل منطقة دون تكرار.</p></div>
          <div class="card-stat"><strong class="num">${fmtQty(new Set(R.atwarLines.map((line) => line.region)).size)}</strong><span>منطقة</span></div>
        </a>
      </div>
      <section class="section" style="margin-top:1rem">
        <h2>قراءة سريعة</h2>
        <p>بيع من رصيد الافتتاح ما يعادل ${num(t.qtyRate, "pct")} من الكمية و${num(t.valueRate, "pct")} من القيمة. إنجاز القيمة أعلى لأن الأصناف المباعة أغلى من متوسط الرصيد الراكد.</p>
        <p>صافي الربح ${num(t.profit, "profit")} ريال. منه ${num(R.tirador.totals.profit, "profit")} لتيرادور بهامش ${num(R.tirador.totals.margin, "pct")}، و${num(R.atwar.totals.profit, "profit")} لأطوار بهامش ${num(R.atwar.totals.margin, "pct")}.</p>
        <p>أعلى إنجاز كمي في قطاع ${esc(best.name)} بمعدل ${rate(best.qtyRate)}. أكبر ضغط على الربح في قطاع ${esc(worst.name)}: ${num(worst.profit, "profit")} ريال، مع إنجاز كمي ${rate(worst.qtyRate)}.</p>
        <p class="lead">${fmtQty(idle)} صنفاً من ${fmtQty(R.meta.itemCount)} بلا أي حركة بيع في الفترة.</p>
      </section>
      <div class="note">
        <strong>أساس الأرقام.</strong>
        القطاع والتكلفة والرصيد الافتتاحي مأخوذة من ورقة أداء الأصناف. المبيعات والربح أُعيد احتسابهما بربط كل فاتورة برقم الصنف نفسه. معادلات المبيعات في تلك الورقة تشير إلى صف آخر، فتُظهر الحركة على صنف غير الصنف الصحيح، بينما إجمالي الكمية وإجمالي القيمة في الملف يبقيان مطابقين لمجموع الحركة.
      </div>`;
  }

  const sectorColumns = [
    { key: "name", label: "القطاع", type: "text", stick: true, clip: true, html: (row) => esc(row.name) },
    { key: "openQty", label: "كمية الافتتاح", type: "num", html: (row) => num(row.openQty, "qty") },
    { key: "openValue", label: "قيمة الافتتاح", type: "num", html: (row) => num(row.openValue, "money") },
    { key: "valueShare", label: "حصة القيمة", type: "num", html: (row) => num(row.valueShare, "pct") },
    { key: "jul", label: "يوليو", type: "num", html: (row) => num(row.jul, "qty") },
    { key: "aug", label: "أغسطس", type: "num", html: (row) => num(row.aug, "qty") },
    { key: "sep", label: "سبتمبر", type: "num", html: (row) => num(row.sep, "qty") },
    { key: "oct", label: "أكتوبر", type: "num", html: (row) => num(row.oct, "qty") },
    { key: "netQty", label: "صافي الكمية", type: "num", html: (row) => num(row.netQty, "qty") },
    { key: "salesValue", label: "قيمة المبيعات", type: "num", html: (row) => num(row.salesValue, "money") },
    { key: "cogs", label: "تكلفة المبيعات", type: "num", html: (row) => num(row.cogs, "money") },
    { key: "profit", label: "صافي الربح", type: "num", html: (row) => num(row.profit, "profit") },
    { key: "margin", label: "الهامش", type: "num", html: (row) => num(row.margin, "pct") },
    { key: "qtyRate", label: "إنجاز الكمية", type: "num", html: (row) => rate(row.qtyRate) },
    { key: "valueRate", label: "إنجاز القيمة", type: "num", html: (row) => rate(row.valueRate) },
  ];

  const itemColumns = [
    { key: "sector", label: "القطاع", type: "text", stick: true, html: (row) => esc(row.sector) },
    { key: "sku", label: "رقم الصنف", type: "text", html: (row) => `<span class="sku">${esc(row.sku)}</span>` },
    { key: "name", label: "الوصف", type: "text", clip: true, html: (row) => esc(row.name) },
    { key: "openQty", label: "كمية الافتتاح", type: "num", html: (row) => num(row.openQty, "qty") },
    { key: "openValue", label: "قيمة الافتتاح", type: "num", html: (row) => num(row.openValue, "money") },
    { key: "jul", label: "يوليو", type: "num", html: (row) => num(row.jul, "qty") },
    { key: "aug", label: "أغسطس", type: "num", html: (row) => num(row.aug, "qty") },
    { key: "sep", label: "سبتمبر", type: "num", html: (row) => num(row.sep, "qty") },
    { key: "oct", label: "أكتوبر", type: "num", html: (row) => num(row.oct, "qty") },
    { key: "netQty", label: "صافي الكمية", type: "num", html: (row) => num(row.netQty, "qty") },
    { key: "salesValue", label: "قيمة المبيعات", type: "num", html: (row) => num(row.salesValue, "money") },
    { key: "profit", label: "صافي الربح", type: "num", html: (row) => num(row.profit, "profit") },
    { key: "qtyRate", label: "إنجاز الكمية", type: "num", html: (row) => rate(row.qtyRate) },
    { key: "valueRate", label: "إنجاز القيمة", type: "num", html: (row) => rate(row.valueRate) },
  ];

  function renderAsnaf() {
    const t = R.totals;
    const app = document.getElementById("app");
    const options = R.sectors.map((row) => `<option value="${esc(row.name)}">${esc(row.name)}</option>`).join("");
    app.innerHTML = `
      ${kpis([
        { label: "القطاعات", html: num(R.meta.sectorCount, "qty") },
        { label: "الأصناف", html: num(R.meta.itemCount, "qty") },
        { label: "إنجاز الكمية", html: rate(t.qtyRate), tone: "gold" },
        { label: "إنجاز القيمة", html: rate(t.valueRate), tone: "gold" },
        { label: "قيمة المبيعات", html: num(t.salesValue, "money") },
        { label: "صافي الربح", html: num(t.profit, "profit"), tone: t.profit >= 0 ? "good" : "bad" },
      ])}
      <section class="section">
        <h2>معدل الإنجاز حسب القطاع</h2>
        <p class="lead">طول الشريط من صفر إلى 30٪. اللون الأحمر دون 5٪، والذهبي من 5٪ إلى 15٪، والأخضر فوق 15٪.</p>
        <div class="switch" id="rate-switch">
          <button type="button" data-mode="qty" aria-pressed="true">إنجاز الكمية</button>
          <button type="button" data-mode="value" aria-pressed="false">إنجاز القيمة</button>
        </div>
        <div id="rate-chart"></div>
      </section>
      <section class="section">
        <h2>أداء القطاعات</h2>
        <p class="scroll-hint">انقر عنوان العمود للترتيب. مرّر الجدول أفقياً لبقية الأعمدة.</p>
        <div id="sector-table"></div>
      </section>
      <section class="section">
        <h2>أداء الأصناف</h2>
        <div class="toolbar">
          <label class="field">بحث
            <input id="item-q" type="search" placeholder="اسم الصنف أو رقمه أو القطاع">
          </label>
          <label class="field">القطاع
            <select id="item-sector"><option value="all">كل القطاعات</option>${options}</select>
          </label>
          <div class="chips" id="item-views">
            <button type="button" data-view="all" aria-pressed="true">الكل</button>
            <button type="button" data-view="moved" aria-pressed="false">لها حركة</button>
            <button type="button" data-view="idle" aria-pressed="false">بلا حركة</button>
            <button type="button" data-view="gain" aria-pressed="false">رابحة</button>
            <button type="button" data-view="loss" aria-pressed="false">خاسرة</button>
          </div>
        </div>
        <p class="meta-line" id="item-meta"></p>
        <div id="item-table"></div>
        <div class="pager" id="item-pager"></div>
      </section>`;

    const state = { mode: "qty", sort: "name", dir: 1, itemSort: "openValue", itemDir: -1, q: "", sector: "all", view: "all", page: 0 };
    const pageSize = new URLSearchParams(location.search).has("print") ? 100000 : 40;

    function drawChart() {
      const key = state.mode === "qty" ? "qtyRate" : "valueRate";
      const rows = R.sectors.slice().sort((a, b) => (b[key] || -1) - (a[key] || -1));
      document.getElementById("rate-chart").innerHTML = hbars(rows, (row) => row.name, (row) => row[key] || 0, (value) => rate(value), 0.3, "rate");
    }

    function drawSectors() {
      mountTable(document.getElementById("sector-table"), sectorColumns, R.sectors, state, drawSectors);
    }

    function filteredItems() {
      const query = state.q.trim();
      return R.items.filter((item) => {
        if (state.sector !== "all" && item.sector !== state.sector) return false;
        if (state.view === "moved" && !(item.netQty || item.salesValue)) return false;
        if (state.view === "idle" && (item.netQty || item.salesValue)) return false;
        if (state.view === "gain" && !(item.profit > 0)) return false;
        if (state.view === "loss" && !(item.profit < 0)) return false;
        if (!query) return true;
        const hay = `${item.sector} ${item.sku} ${item.name}`;
        return hay.includes(query);
      });
    }

    function drawItems() {
      const rows = filteredItems();
      const sorted = sortRows(rows, itemColumns, state.itemSort, state.itemDir);
      const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
      if (state.page >= pages) state.page = pages - 1;
      const start = state.page * pageSize;
      const slice = sorted.slice(start, start + pageSize);
      const openValue = rows.reduce((sum, row) => sum + (row.openValue || 0), 0);
      const profit = rows.reduce((sum, row) => sum + (row.profit || 0), 0);
      document.getElementById("item-meta").innerHTML = `المعروض ${num(rows.length, "qty")} صنفاً. قيمة افتتاح ${num(openValue, "money")} ريال. صافي ربح ${num(profit, "profit")} ريال.`;
      const host = document.getElementById("item-table");
      host.innerHTML = tableHtml(itemColumns, slice, state.itemSort, state.itemDir);
      host.querySelectorAll("th[data-k]").forEach((th) => {
        const activate = () => {
          const key = th.dataset.k;
          const type = th.dataset.t || "num";
          if (state.itemSort === key) state.itemDir *= -1;
          else {
            state.itemSort = key;
            state.itemDir = type === "text" ? 1 : -1;
          }
          state.page = 0;
          drawItems();
        };
        th.addEventListener("click", activate);
        th.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
          }
        });
      });
      const pager = document.getElementById("item-pager");
      pager.innerHTML = `
        <button type="button" id="prev" ${state.page === 0 ? "disabled" : ""}>السابق</button>
        <span>صفحة ${state.page + 1} من ${pages}</span>
        <button type="button" id="next" ${state.page >= pages - 1 ? "disabled" : ""}>التالي</button>`;
      document.getElementById("prev").addEventListener("click", () => { state.page -= 1; drawItems(); });
      document.getElementById("next").addEventListener("click", () => { state.page += 1; drawItems(); });
    }

    document.getElementById("rate-switch").addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      state.mode = button.dataset.mode;
      document.querySelectorAll("#rate-switch button").forEach((item) => {
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });
      drawChart();
    });
    document.getElementById("item-q").addEventListener("input", (event) => {
      state.q = event.target.value;
      state.page = 0;
      drawItems();
    });
    document.getElementById("item-sector").addEventListener("change", (event) => {
      state.sector = event.target.value;
      state.page = 0;
      drawItems();
    });
    document.getElementById("item-views").addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      state.view = button.dataset.view;
      state.page = 0;
      document.querySelectorAll("#item-views button").forEach((item) => {
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });
      drawItems();
    });

    drawChart();
    drawSectors();
    drawItems();
  }

  const branchColumns = [
    { key: "warehouse", label: "الفرع", type: "text", stick: true, clip: true, html: (row) => esc(branchLabel(row)) },
    { key: "rep", label: "المشرف", type: "text", clip: true, html: (row) => esc(row.rep) },
    { key: "region", label: "المنطقة", type: "text", html: (row) => esc(row.region || "—") },
    { key: "qty", label: "كمية البيع", type: "num", html: (row) => num(row.qty, "qty") },
    { key: "salesValue", label: "قيمة البيع", type: "num", html: (row) => num(row.salesValue, "money") },
    { key: "cogs", label: "التكلفة", type: "num", html: (row) => num(row.cogs, "money") },
    { key: "profit", label: "صافي الربح", type: "num", html: (row) => num(row.profit, "profit") },
    { key: "margin", label: "الهامش", type: "num", html: (row) => num(row.margin, "pct") },
    { key: "salesShare", label: "حصة البيع", type: "num", html: (row) => num(row.salesShare, "pct") },
    { key: "customers", label: "العملاء", type: "num", html: (row) => num(row.customers, "qty") },
    { key: "stockQty", label: "المخزون الحالي", type: "num", html: (row) => num(row.stockQty, "qty") },
    { key: "stockValue", label: "قيمة المخزون", type: "num", html: (row) => num(row.stockValue, "money") },
    { key: "skuCount", label: "أصناف راكدة", type: "num", html: (row) => num(row.skuCount, "qty") },
    { key: "stockShare", label: "حصة المخزون", type: "num", html: (row) => num(row.stockShare, "pct") },
  ];

  function renderTirador() {
    const t = R.tirador.totals;
    const stockGap = R.tirador.stockQty - R.meta.openingTiradorQty;
    const app = document.getElementById("app");
    app.innerHTML = `
      ${kpis([
        { label: "قيمة المبيعات", html: num(t.salesValue, "money"), note: `${fmtQty(t.qty)} وحدة صافية` },
        { label: "صافي الربح", html: num(t.profit, "profit"), tone: "good", note: `هامش ${fmtPct(t.margin)}` },
        { label: "المخزون الحالي", html: num(R.tirador.stockQty, "qty"), note: `${fmtQty(R.tirador.stockSkus)} صنفاً` },
        { label: "قيمة المخزون الحالي", html: num(R.tirador.stockValue, "money"), tone: "gold" },
        { label: "الرصيد الافتتاحي", html: num(R.meta.openingTiradorQty, "qty"), note: "من قائمة الرواكد" },
        { label: "فرق الرصيد", html: num(stockGap, "qty"), note: "الحالي ناقص الافتتاحي" },
      ])}
      <div class="note">رصيد الرواكد الحالي في المستودعات قريب من الرصيد الافتتاحي لتيرادور، بينما كمية البيع المفوترة أكبر من هذا الفارق. الفاتورة على الفرع لا تعني بالضرورة أن الكمية خُصمت من مستودع الفرع نفسه. ارتفاع كمية فرع لا يعني ارتفاع قيمة مخزونه.</div>
      <section class="section">
        <div class="pair">
          <div>
            <h2>قيمة المبيعات حسب الفرع</h2>
            <div id="sales-bars"></div>
          </div>
          <div>
            <h2>قيمة المخزون الحالي حسب الفرع</h2>
            <div id="stock-bars"></div>
          </div>
        </div>
      </section>
      <section class="section">
        <h2>تفصيل الفروع</h2>
        <div class="toolbar">
          <label class="field">المنطقة
            <select id="region-filter"><option value="all">كل المناطق</option></select>
          </label>
        </div>
        <p class="scroll-hint">انقر عنوان العمود للترتيب.</p>
        <div id="branch-table"></div>
      </section>`;

    const regions = Array.from(new Set(R.tirador.branches.map((row) => row.region).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar"));
    const select = document.getElementById("region-filter");
    select.innerHTML += regions.map((region) => `<option value="${esc(region)}">${esc(region)}</option>`).join("");
    const state = { sort: "salesValue", dir: -1, region: "all" };

    function rows() {
      return R.tirador.branches.filter((row) => state.region === "all" || row.region === state.region);
    }
    function drawBars() {
      const bySales = rows().slice().sort((a, b) => b.salesValue - a.salesValue);
      const byStock = rows().slice().sort((a, b) => b.stockValue - a.stockValue);
      document.getElementById("sales-bars").innerHTML = hbars(bySales, branchLabel, (row) => row.salesValue, (value) => num(value, "money"));
      document.getElementById("stock-bars").innerHTML = hbars(byStock, branchLabel, (row) => row.stockValue, (value) => num(value, "money"), null, "gold");
    }
    function drawTable() {
      mountTable(document.getElementById("branch-table"), branchColumns, rows(), state, drawTable);
    }
    select.addEventListener("change", () => {
      state.region = select.value;
      drawBars();
      drawTable();
    });
    drawBars();
    drawTable();
  }

  const repColumns = [
    { key: "rep", label: "المندوب", type: "text", stick: true, clip: true, html: (row) => esc(row.rep) },
    { key: "region", label: "المنطقة", type: "text", html: (row) => esc(row.region || "—") },
    { key: "qty", label: "صافي الكمية", type: "num", html: (row) => num(row.qty, "qty") },
    { key: "jul", label: "يوليو", type: "num", html: (row) => num(row.jul, "qty") },
    { key: "aug", label: "أغسطس", type: "num", html: (row) => num(row.aug, "qty") },
    { key: "sep", label: "سبتمبر", type: "num", html: (row) => num(row.sep, "qty") },
    { key: "oct", label: "أكتوبر", type: "num", html: (row) => num(row.oct, "qty") },
    { key: "salesValue", label: "قيمة المبيعات", type: "num", html: (row) => num(row.salesValue, "money") },
    { key: "cogs", label: "التكلفة", type: "num", html: (row) => num(row.cogs, "money") },
    { key: "profit", label: "صافي الربح", type: "num", html: (row) => num(row.profit, "profit") },
    { key: "margin", label: "الهامش", type: "num", html: (row) => num(row.margin, "pct") },
    { key: "customers", label: "العملاء", type: "num", html: (row) => num(row.customers, "qty") },
    { key: "salesShare", label: "حصة المبيعات", type: "num", html: (row) => num(row.salesShare, "pct") },
  ];

  function renderAtwar() {
    const t = R.atwar.totals;
    const app = document.getElementById("app");
    app.innerHTML = `
      ${kpis([
        { label: "قيمة المبيعات", html: num(t.salesValue, "money") },
        { label: "صافي الكمية", html: num(t.qty, "qty"), note: `مرتجعات ${fmtQty(Math.abs(t.returnsQty))}` },
        { label: "صافي الربح", html: num(t.profit, "profit"), tone: t.profit >= 0 ? "good" : "bad", note: `هامش ${fmtPct(t.margin)}` },
        { label: "المندوبون", html: num(R.atwar.reps.length, "qty") },
        { label: "العملاء", html: num(t.customers, "qty") },
        { label: "سبتمبر", html: num(t.sepProfit, "profit"), note: "صافي ربح الشهر" },
      ])}
      <section class="section">
        <h2>قيمة المبيعات حسب المندوب</h2>
        <p class="lead">الترتيب حسب قيمة البيع. الربح يظهر في الجدول، وقد يكون سالباً رغم ارتفاع المبيعات.</p>
        <div id="rep-bars"></div>
      </section>
      <section class="section">
        <h2>تفصيل المندوبين</h2>
        <div class="toolbar">
          <label class="field">المنطقة
            <select id="region-filter"><option value="all">كل المناطق</option></select>
          </label>
        </div>
        <p class="scroll-hint">انقر عنوان العمود للترتيب.</p>
        <div id="rep-table"></div>
      </section>`;

    const regions = Array.from(new Set(R.atwar.reps.map((row) => row.region).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar"));
    const select = document.getElementById("region-filter");
    select.innerHTML += regions.map((region) => `<option value="${esc(region)}">${esc(region)}</option>`).join("");
    const state = { sort: "salesValue", dir: -1, region: "all" };
    function rows() {
      return R.atwar.reps.filter((row) => state.region === "all" || row.region === state.region);
    }
    function draw() {
      const ranked = rows().slice().sort((a, b) => b.salesValue - a.salesValue);
      document.getElementById("rep-bars").innerHTML = hbars(ranked, (row) => row.rep, (row) => row.salesValue, (value) => num(value, "money"));
      mountTable(document.getElementById("rep-table"), repColumns, rows(), state, draw);
    }
    select.addEventListener("change", () => {
      state.region = select.value;
      draw();
    });
    draw();
  }

  const profitColumns = [
    { key: "name", label: "القطاع", type: "text", stick: true, clip: true, html: (row) => esc(row.name) },
    { key: "atwarQty", label: "كمية أطوار", type: "num", html: (row) => num(row.atwarQty, "qty") },
    { key: "atwarSales", label: "مبيعات أطوار", type: "num", html: (row) => num(row.atwarSales, "money") },
    { key: "atwarProfit", label: "ربح أطوار", type: "num", html: (row) => num(row.atwarProfit, "profit") },
    { key: "atwarMargin", label: "هامش أطوار", type: "num", html: (row) => num(row.atwarMargin, "pct") },
    { key: "tiradorQty", label: "كمية تيرادور", type: "num", html: (row) => num(row.tiradorQty, "qty") },
    { key: "tiradorSales", label: "مبيعات تيرادور", type: "num", html: (row) => num(row.tiradorSales, "money") },
    { key: "tiradorProfit", label: "ربح تيرادور", type: "num", html: (row) => num(row.tiradorProfit, "profit") },
    { key: "tiradorMargin", label: "هامش تيرادور", type: "num", html: (row) => num(row.tiradorMargin, "pct") },
    { key: "profit", label: "صافي الربح", type: "num", html: (row) => num(row.profit, "profit") },
  ];

  function itemList(rows) {
    if (!rows.length) return "<p class='lead'>لا توجد أصناف في هذه القائمة.</p>";
    return `<table class="mini"><thead><tr><th>الصنف</th><th class="numcol">الكمية</th><th class="numcol">المبيعات</th><th class="numcol">الربح</th></tr></thead><tbody>${
      rows.map((row) => `<tr>
        <td class="clip"><span class="sku">${esc(row.sku)}</span> — ${esc(row.name)}</td>
        <td class="numcol">${num(row.qty, "qty")}</td>
        <td class="numcol">${num(row.salesValue, "money")}</td>
        <td class="numcol">${num(row.profit, "profit")}</td>
      </tr>`).join("")
    }</tbody></table>`;
  }

  const TIRADOR_OPEX_RATE = 0.3;

  function withTiradorOpex(profit, salesValue) {
    const provision = (salesValue || 0) * TIRADOR_OPEX_RATE;
    const net = profit - provision;
    return {
      profit: net,
      provision,
      margin: salesValue ? net / salesValue : null,
    };
  }

  function companyCard(title, legal, totals) {
    const after = totals.provision != null;
    const provision = after
      ? `<div><dt>مخصص المصاريف</dt><dd>${num(totals.provision, "money")}</dd></div>`
      : "";
    return `<article class="company">
      <h2>${esc(title)}</h2>
      <p class="sub">${esc(legal)}</p>
      <dl class="stat-list">
        <div><dt>قيمة المبيعات</dt><dd>${num(totals.salesValue, "money")}</dd></div>
        <div><dt>تكلفة المبيعات</dt><dd>${num(totals.cogs, "money")}</dd></div>
        ${provision}
        <div><dt>${after ? "صافي الربح بعد المخصص" : "صافي الربح"}</dt><dd>${num(totals.profit, "profit")}</dd></div>
        <div><dt>${after ? "الهامش بعد المخصص" : "الهامش"}</dt><dd>${num(totals.margin, "pct")}</dd></div>
        <div><dt>صافي الكمية</dt><dd>${num(totals.qty, "qty")}</dd></div>
        <div><dt>العملاء</dt><dd>${num(totals.customers, "qty")}</dd></div>
      </dl>
    </article>`;
  }

  function renderProfit() {
    const state = { opex: false, sort: "profit", dir: 1 };
    const app = document.getElementById("app");

    function tiradorTotals() {
      const base = R.tirador.totals;
      if (!state.opex) return base;
      const adjusted = withTiradorOpex(base.profit, base.salesValue);
      return { ...base, profit: adjusted.profit, margin: adjusted.margin, provision: adjusted.provision };
    }

    function months() {
      return R.profit.months.map((row) => {
        if (!state.opex) return row;
        return { ...row, tiradorProfit: withTiradorOpex(row.tiradorProfit, row.tiradorSales).profit };
      });
    }

    function sectors() {
      return R.profit.sectors.map((row) => {
        if (!state.opex) return row;
        const adjusted = withTiradorOpex(row.tiradorProfit, row.tiradorSales);
        return {
          ...row,
          tiradorProfit: adjusted.profit,
          tiradorMargin: adjusted.margin,
          profit: row.atwarProfit + adjusted.profit,
        };
      });
    }

    function tiradorItems(rows, loss) {
      if (!state.opex) return rows;
      return rows
        .map((row) => ({ ...row, profit: withTiradorOpex(row.profit, row.salesValue).profit }))
        .sort((a, b) => (loss ? a.profit - b.profit : b.profit - a.profit));
    }

    function columns() {
      if (!state.opex) return profitColumns;
      return profitColumns.map((col) => {
        if (col.key === "tiradorProfit") return { ...col, label: "ربح تيرادور بعد المخصص" };
        if (col.key === "tiradorMargin") return { ...col, label: "هامش تيرادور بعد المخصص" };
        return col;
      });
    }

    function draw() {
      const monthRows = months();
      const profitLabel = state.opex ? "ربح تيرادور بعد المخصص" : "ربح تيرادور";
      app.innerHTML = `
        <label class="check-option">
          <input type="checkbox" id="opex-toggle"${state.opex ? " checked" : ""}>
          <span>
            خصم مخصص المصاريف التشغيلية التقديرية من نتائج تيرادور
            <small>المخصص يساوي 30% من إيراد تيرادور، ويُطرح من الربح قبل حساب الهامش. نتائج أطوار تبقى كما هي، ومجموع الأشهر والقطاعات يبقى مطابقاً لإجمالي تيرادور.</small>
          </span>
        </label>
        <div class="split">
          ${companyCard("أطوار", "مؤسسة أطوار للتجارة", R.atwar.totals)}
          ${companyCard("تيرادور", "مؤسسة لوازم الأبواب للتجارة", tiradorTotals())}
        </div>
        <section class="section">
          <h2>الربح حسب الشهر</h2>
          <p class="lead">أكتوبر يغطي اليومين الأول والثاني فقط.</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الشهر</th>
                  <th class="numcol">كمية أطوار</th>
                  <th class="numcol">مبيعات أطوار</th>
                  <th class="numcol">ربح أطوار</th>
                  <th class="numcol">كمية تيرادور</th>
                  <th class="numcol">مبيعات تيرادور</th>
                  <th class="numcol">${profitLabel}</th>
                </tr>
              </thead>
              <tbody>
                ${monthRows.map((row) => `<tr>
                  <td>${esc(row.month)}${row.partial ? " (جزئي)" : ""}</td>
                  <td class="numcol">${num(row.atwarQty, "qty")}</td>
                  <td class="numcol">${num(row.atwarSales, "money")}</td>
                  <td class="numcol">${num(row.atwarProfit, "profit")}</td>
                  <td class="numcol">${num(row.tiradorQty, "qty")}</td>
                  <td class="numcol">${num(row.tiradorSales, "money")}</td>
                  <td class="numcol">${num(row.tiradorProfit, "profit")}</td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </section>
        <section class="section">
          <h2>الربح حسب القطاع</h2>
          <p class="scroll-hint">انقر عنوان العمود للترتيب.</p>
          <div id="profit-table"></div>
        </section>
        <section class="section">
          <div class="pair">
            <div>
              <h2>أعلى ربح في أطوار</h2>
              ${itemList(R.profit.atwarGainers)}
              <h2 style="margin-top:1rem">أكبر خسارة في أطوار</h2>
              ${itemList(R.profit.atwarLosers)}
            </div>
            <div>
              <h2>${state.opex ? "أعلى ربح في تيرادور بعد المخصص" : "أعلى ربح في تيرادور"}</h2>
              ${itemList(tiradorItems(R.profit.tiradorGainers))}
              <h2 style="margin-top:1rem">${state.opex ? "أكبر خسارة في تيرادور بعد المخصص" : "أكبر خسارة في تيرادور"}</h2>
              ${itemList(tiradorItems(R.profit.tiradorLosers, true))}
            </div>
          </div>
        </section>`;
      document.getElementById("opex-toggle").addEventListener("change", (event) => {
        state.opex = event.target.checked;
        draw();
      });
      mountTable(document.getElementById("profit-table"), columns(), sectors(), state, draw);
    }

    draw();
  }

  function sectorTrend(row) {
    const jul = row.jul || 0;
    const aug = row.aug || 0;
    const sep = row.sep || 0;
    const up1 = aug > jul + 0.05;
    const down1 = aug < jul - 0.05;
    const up2 = sep > aug + 0.05;
    const down2 = sep < aug - 0.05;
    const flat = Math.abs(sep - jul) < 0.5 && Math.abs(aug - jul) < 0.5;
    let kind = "flat";
    let label = "ثبات";
    if (!flat && up1 && down2) {
      kind = "turn";
      label = "تصاعد ثم تقلص";
    } else if (!flat && down1 && up2) {
      kind = "turn";
      label = "تقلص ثم تصاعد";
    } else if (!flat && sep > jul && !down1 && !down2) {
      kind = "up";
      label = "تصاعد متصل";
    } else if (!flat && sep < jul && !up1 && !up2) {
      kind = "down";
      label = "تقلص متصل";
    } else if (!flat && sep > jul) {
      kind = "up";
      label = "تصاعد في المحصلة";
    } else if (!flat && sep < jul) {
      kind = "down";
      label = "تقلص في المحصلة";
    }
    return {
      name: row.name,
      jul,
      aug,
      sep,
      d1: aug - jul,
      d2: sep - aug,
      dQ: sep - jul,
      p1: jul ? (aug - jul) / jul : null,
      p2: aug ? (sep - aug) / aug : null,
      pQ: jul ? (sep - jul) / jul : null,
      kind,
      label,
    };
  }

  function sparkline(jul, aug, sep) {
    const values = [jul, aug, sep];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const points = values.map((value, index) => {
      const x = 6 + index * 34;
      const y = 26 - ((value - min) / span) * 20;
      return `${x},${y.toFixed(1)}`;
    }).join(" ");
    const color = sep > jul ? "#0c6844" : sep < jul ? "#9b2c2c" : "#8a5814";
    return `<svg class="spark" viewBox="0 0 80 32" width="80" height="32" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" points="${points}"/></svg>`;
  }

  function trendBadge(row) {
    return `<span class="trend ${row.kind}">${esc(row.label)}</span>`;
  }

  const trendColumns = [
    { key: "name", label: "القطاع", type: "text", stick: true, clip: true, html: (row) => esc(row.name) },
    { key: "path", label: "المسار", type: "text", nosort: true, html: (row) => sparkline(row.jul, row.aug, row.sep) },
    { key: "label", label: "الاتجاه", type: "text", html: (row) => trendBadge(row) },
    { key: "jul", label: "يوليو", type: "num", html: (row) => num(row.jul, "qty") },
    { key: "aug", label: "أغسطس", type: "num", html: (row) => num(row.aug, "qty") },
    { key: "sep", label: "سبتمبر", type: "num", html: (row) => num(row.sep, "qty") },
    { key: "d1", label: "أغسطس − يوليو", type: "num", html: (row) => num(row.d1, "deltaQty") },
    { key: "p1", label: "نسبة أغسطس", type: "num", html: (row) => num(row.p1, "deltaPct") },
    { key: "d2", label: "سبتمبر − أغسطس", type: "num", html: (row) => num(row.d2, "deltaQty") },
    { key: "p2", label: "نسبة سبتمبر", type: "num", html: (row) => num(row.p2, "deltaPct") },
    { key: "dQ", label: "سبتمبر − يوليو", type: "num", html: (row) => num(row.dQ, "deltaQty") },
    { key: "pQ", label: "محصلة الربع", type: "num", html: (row) => num(row.pQ, "deltaPct") },
  ];

  function renderHaraka() {
    const rows = R.sectors.map(sectorTrend);
    const jul = R.totals.jul;
    const aug = R.totals.aug;
    const sep = R.totals.sep;
    const p1 = (aug - jul) / jul;
    const p2 = (sep - aug) / aug;
    const pQ = (sep - jul) / jul;
    const count = (kind) => rows.filter((row) => row.kind === kind).length;
    const rising = rows.filter((row) => row.dQ > 0).length;
    const falling = rows.filter((row) => row.dQ < 0).length;
    const biggestUp = rows.slice().sort((a, b) => b.dQ - a.dQ)[0];
    const biggestDown = rows.slice().sort((a, b) => a.dQ - b.dQ)[0];
    const app = document.getElementById("app");
    app.innerHTML = `
      ${kpis([
        { label: "يوليو", html: num(jul, "qty"), note: "صافي الكمية" },
        { label: "أغسطس", html: num(aug, "qty"), note: num(p1, "deltaPct") + " عن يوليو" },
        { label: "سبتمبر", html: num(sep, "qty"), note: num(p2, "deltaPct") + " عن أغسطس", tone: "good" },
        { label: "من يوليو إلى سبتمبر", html: num(pQ, "deltaPct"), tone: "gold", note: num(sep - jul, "deltaQty") + " وحدة" },
        { label: "قطاعات محصلتها تصاعد", html: num(rising, "qty"), tone: "good" },
        { label: "قطاعات محصلتها تقلص", html: num(falling, "qty"), tone: "bad" },
      ])}
      <div class="note">
        المقارنة على الأشهر الثلاثة الكاملة: يوليو وأغسطس وسبتمبر. أكتوبر مستبعد لأنه يقف عند 2 أكتوبر.
        الكمية صافية بعد المرتجعات. التصاعد المتصل يعني أن الكمية لم تنخفض في أي خطوة وسبتمبر أعلى من يوليو. التقلص المتصل عكس ذلك. إذا ارتفع شهر ثم انخفض الذي يليه، يُذكر الانعكاس ولو بقيت المحصلة موجبة.
      </div>
      <section class="section">
        <h2>قراءة الحركة</h2>
        <p>الكمية الصافية لكل القطاعات ارتفعت من ${num(jul, "qty")} في يوليو إلى ${num(aug, "qty")} في أغسطس (${num(p1, "deltaPct")})، ثم إلى ${num(sep, "qty")} في سبتمبر (${num(p2, "deltaPct")} عن أغسطس). المحصلة من يوليو إلى سبتمبر ${num(pQ, "deltaPct")}.</p>
        <p>تصاعد متصل في ${num(count("up"), "qty")} من القطاعات، وتقلص متصل في ${num(count("down"), "qty")}، وانعكاس بين الشهرين في ${num(count("turn"), "qty")}. أكبر زيادة كمية في ${esc(biggestUp.name)} (${num(biggestUp.dQ, "deltaQty")} وحدة، ${num(biggestUp.pQ, "deltaPct")}). أكبر تراجع كمي في ${esc(biggestDown.name)} (${num(biggestDown.dQ, "deltaQty")} وحدة، ${num(biggestDown.pQ, "deltaPct")}).</p>
      </section>
      <section class="section">
        <div class="pair">
          <div>
            <h2>التغير بالكمية</h2>
            <p class="lead">سبتمبر ناقص يوليو. الشريط الأخضر تصاعد، والأحمر تقلص.</p>
            <div id="qty-bars"></div>
          </div>
          <div>
            <h2>التغير بالنسبة</h2>
            <p class="lead">نسبة سبتمبر إلى يوليو. الشريط يمتد حتى 150٪، وما زاد عن ذلك يملأ الشريط وتبقى النسبة مكتوبة. النسبة تكبر في القطاعات الصغيرة حتى لو كانت الكمية المضافة قليلة.</p>
            <div id="pace-bars"></div>
          </div>
        </div>
      </section>
      <section class="section">
        <h2>تفصيل القطاعات</h2>
        <div class="chips" id="trend-views">
          <button type="button" data-view="all" aria-pressed="true">الكل</button>
          <button type="button" data-view="up" aria-pressed="false">محصلة صاعدة</button>
          <button type="button" data-view="down" aria-pressed="false">محصلة هابطة</button>
          <button type="button" data-view="turn" aria-pressed="false">انعكاس</button>
        </div>
        <p class="meta-line" id="trend-meta"></p>
        <p class="scroll-hint">انقر عنوان العمود للترتيب. المسار يرسم يوليو ثم أغسطس ثم سبتمبر.</p>
        <div id="trend-table"></div>
      </section>`;

    const state = { sort: "dQ", dir: -1, view: "all" };
    function visible() {
      if (state.view === "up") return rows.filter((row) => row.dQ > 0);
      if (state.view === "down") return rows.filter((row) => row.dQ < 0);
      if (state.view === "turn") return rows.filter((row) => row.kind === "turn");
      return rows;
    }
    function drawBars() {
      const current = visible();
      const byQty = current.slice().sort((a, b) => b.dQ - a.dQ);
      const byPace = current.filter((row) => row.pQ != null).slice().sort((a, b) => b.pQ - a.pQ);
      document.getElementById("qty-bars").innerHTML = hbars(byQty, (row) => row.name, (row) => row.dQ, (value) => num(value, "deltaQty"));
      document.getElementById("pace-bars").innerHTML = hbars(byPace, (row) => row.name, (row) => row.pQ, (value) => num(value, "deltaPct"), 1.5);
    }
    function drawTable() {
      const current = visible();
      const added = current.reduce((sum, row) => sum + Math.max(row.dQ, 0), 0);
      const cut = current.reduce((sum, row) => sum + Math.min(row.dQ, 0), 0);
      document.getElementById("trend-meta").innerHTML = `القطاعات المعروضة ${num(current.length, "qty")}. كمية مضافة ${num(added, "deltaQty")}، وكمية متراجعة ${num(cut, "deltaQty")}.`;
      mountTable(document.getElementById("trend-table"), trendColumns, current, state, drawTable);
    }
    document.getElementById("trend-views").addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      state.view = button.dataset.view;
      document.querySelectorAll("#trend-views button").forEach((item) => {
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });
      drawBars();
      drawTable();
    });
    drawBars();
    drawTable();
  }

  const MONTH_OPTIONS = [
    [0, "كل الأشهر"],
    [7, "يوليو"],
    [8, "أغسطس"],
    [9, "سبتمبر"],
    [10, "أكتوبر (جزئي)"],
  ];

  function monthOptions() {
    return MONTH_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  }

  function sectorOptions() {
    return R.sectors.map((row) => `<option value="${esc(row.name)}">${esc(row.name)}</option>`).join("");
  }

  function branchName(rep) {
    const found = R.tirador.branches.find((row) => row.rep === rep);
    if (!found || !found.warehouse) return rep;
    return found.warehouse.replace(/^مستودع\s+/, "");
  }

  function renderBranchSectors() {
    const branchSet = new Set([
      ...R.tirador.branches.map((row) => row.rep),
      ...R.tiradorGrid.sales.map((row) => row.branch),
      ...R.tiradorGrid.stock.map((row) => row.branch),
    ]);
    const branches = [...branchSet].sort((a, b) => branchName(a).localeCompare(branchName(b), "ar"));
    const app = document.getElementById("app");
    app.innerHTML = `
      <div id="branch-kpis"></div>
      <p id="filter-banner" class="note" hidden></p>
      <div class="note">المخزون رصيد حالي للأصناف الراكدة، ولا يتغير عند اختيار شهر. التصفية بالشهر تغيّر المبيعات فقط. أكتوبر يقف عند 2 أكتوبر.</div>
      <section class="section">
        <div class="toolbar">
          <label class="field">القطاع
            <select id="filter-sector"><option value="all">كل القطاعات</option>${sectorOptions()}</select>
          </label>
          <label class="field">الفرع
            <select id="filter-branch"><option value="all">كل الفروع</option>${branches.map((rep) => `<option value="${esc(rep)}">${esc(branchName(rep))}</option>`).join("")}</select>
          </label>
          <label class="field">الشهر
            <select id="filter-month">${monthOptions()}</select>
          </label>
        </div>
        <p class="meta-line" id="branch-meta"></p>
      </section>
      <section class="section">
        <h2>إجمالي الفروع</h2>
        <p class="scroll-hint">انقر عنوان العمود للترتيب.</p>
        <div id="branch-total"></div>
      </section>
      <section class="section">
        <h2>إجمالي القطاعات</h2>
        <p class="lead">عدد الأصناف هنا يجمع فروع القطاع، فالصنف الموجود في فرعين يُحسب مرتين. الكمية والقيمة لا تُكرران.</p>
        <div id="sector-total"></div>
      </section>
      <section class="section">
        <h2>تفصيل الفرع والقطاع</h2>
        <div id="branch-detail"></div>
      </section>`;

    const filters = { sector: "all", branch: "all", month: 0 };
    const branchState = { sort: "salesValue", dir: -1 };
    const sectorState = { sort: "salesValue", dir: -1 };
    const detailState = { sort: "salesValue", dir: -1 };

    function collect() {
      const salesMap = new Map();
      for (const row of R.tiradorGrid.sales) {
        if (filters.sector !== "all" && row.sector !== filters.sector) continue;
        if (filters.branch !== "all" && row.branch !== filters.branch) continue;
        if (filters.month && row.month !== filters.month) continue;
        const key = `${row.branch}\0${row.sector}`;
        let cell = salesMap.get(key);
        if (!cell) {
          cell = { qty: 0, salesValue: 0, profit: 0, jul: 0, aug: 0, sep: 0, oct: 0 };
          salesMap.set(key, cell);
        }
        cell.qty += row.qty;
        cell.salesValue += row.salesValue;
        cell.profit += row.profit;
        if (row.month === 7) cell.jul += row.qty;
        else if (row.month === 8) cell.aug += row.qty;
        else if (row.month === 9) cell.sep += row.qty;
        else if (row.month === 10) cell.oct += row.qty;
      }
      const stockMap = new Map();
      for (const row of R.tiradorGrid.stock) {
        if (filters.sector !== "all" && row.sector !== filters.sector) continue;
        if (filters.branch !== "all" && row.branch !== filters.branch) continue;
        stockMap.set(`${row.branch}\0${row.sector}`, row);
      }
      const detail = [];
      for (const key of new Set([...salesMap.keys(), ...stockMap.keys()])) {
        const sale = salesMap.get(key);
        const held = stockMap.get(key);
        const [branch, sector] = key.split("\0");
        detail.push({
          branch,
          branchName: branchName(branch),
          sector,
          qty: sale ? sale.qty : 0,
          salesValue: sale ? sale.salesValue : 0,
          profit: sale ? sale.profit : 0,
          jul: sale ? sale.jul : 0,
          aug: sale ? sale.aug : 0,
          sep: sale ? sale.sep : 0,
          oct: sale ? sale.oct : 0,
          stockQty: held ? held.qty : 0,
          stockValue: held ? held.value : 0,
          skus: held ? held.skus : 0,
        });
      }
      return detail;
    }

    function rollup(rows, key) {
      const map = new Map();
      for (const row of rows) {
        const id = row[key];
        let acc = map.get(id);
        if (!acc) {
          acc = {
            name: key === "branch" ? row.branchName : row.sector,
            rep: row.branch,
            qty: 0,
            salesValue: 0,
            profit: 0,
            stockQty: 0,
            stockValue: 0,
            skus: 0,
          };
          map.set(id, acc);
        }
        acc.qty += row.qty;
        acc.salesValue += row.salesValue;
        acc.profit += row.profit;
        acc.stockQty += row.stockQty;
        acc.stockValue += row.stockValue;
        acc.skus += row.skus;
      }
      return [...map.values()];
    }

    const branchColumns = [
      { key: "name", label: "الفرع", type: "text", stick: true, clip: true, html: (row) => esc(row.name) },
      { key: "rep", label: "المشرف", type: "text", clip: true, html: (row) => esc(row.rep) },
      { key: "qty", label: "كمية البيع", type: "num", html: (row) => num(row.qty, "qty") },
      { key: "salesValue", label: "قيمة البيع", type: "num", html: (row) => num(row.salesValue, "money") },
      { key: "profit", label: "صافي الربح", type: "num", html: (row) => num(row.profit, "profit") },
      { key: "stockQty", label: "المخزون الحالي", type: "num", html: (row) => num(row.stockQty, "qty") },
      { key: "stockValue", label: "قيمة المخزون", type: "num", html: (row) => num(row.stockValue, "money") },
      { key: "skus", label: "أصناف راكدة", type: "num", html: (row) => num(row.skus, "qty") },
    ];
    const sectorColumns = [
      { key: "name", label: "القطاع", type: "text", stick: true, clip: true, html: (row) => esc(row.name) },
      { key: "qty", label: "كمية البيع", type: "num", html: (row) => num(row.qty, "qty") },
      { key: "salesValue", label: "قيمة البيع", type: "num", html: (row) => num(row.salesValue, "money") },
      { key: "profit", label: "صافي الربح", type: "num", html: (row) => num(row.profit, "profit") },
      { key: "stockQty", label: "المخزون الحالي", type: "num", html: (row) => num(row.stockQty, "qty") },
      { key: "stockValue", label: "قيمة المخزون", type: "num", html: (row) => num(row.stockValue, "money") },
      { key: "skus", label: "أصناف الفروع", type: "num", html: (row) => num(row.skus, "qty") },
    ];

    function detailColumns() {
      const columns = [
        { key: "branchName", label: "الفرع", type: "text", stick: true, clip: true, html: (row) => esc(row.branchName) },
        { key: "sector", label: "القطاع", type: "text", clip: true, html: (row) => esc(row.sector) },
        { key: "qty", label: "كمية البيع", type: "num", html: (row) => num(row.qty, "qty") },
        { key: "salesValue", label: "قيمة البيع", type: "num", html: (row) => num(row.salesValue, "money") },
        { key: "profit", label: "صافي الربح", type: "num", html: (row) => num(row.profit, "profit") },
      ];
      if (!filters.month) {
        columns.push(
          { key: "jul", label: "يوليو", type: "num", html: (row) => num(row.jul, "qty") },
          { key: "aug", label: "أغسطس", type: "num", html: (row) => num(row.aug, "qty") },
          { key: "sep", label: "سبتمبر", type: "num", html: (row) => num(row.sep, "qty") },
          { key: "oct", label: "أكتوبر", type: "num", html: (row) => num(row.oct, "qty") },
        );
      }
      columns.push(
        { key: "stockQty", label: "المخزون الحالي", type: "num", html: (row) => num(row.stockQty, "qty") },
        { key: "stockValue", label: "قيمة المخزون", type: "num", html: (row) => num(row.stockValue, "money") },
        { key: "skus", label: "أصناف راكدة", type: "num", html: (row) => num(row.skus, "qty") },
      );
      return columns;
    }

    function draw() {
      const detail = collect();
      const byBranch = rollup(detail, "branch");
      const bySector = rollup(detail, "sector");
      const salesValue = detail.reduce((sum, row) => sum + row.salesValue, 0);
      const qty = detail.reduce((sum, row) => sum + row.qty, 0);
      const profit = detail.reduce((sum, row) => sum + row.profit, 0);
      const stockQty = detail.reduce((sum, row) => sum + row.stockQty, 0);
      const stockValue = detail.reduce((sum, row) => sum + row.stockValue, 0);
      document.getElementById("branch-kpis").innerHTML = kpis([
        { label: "قيمة البيع", html: num(salesValue, "money"), note: `${fmtQty(qty)} وحدة` },
        { label: "صافي الربح", html: num(profit, "profit"), tone: profit >= 0 ? "good" : "bad" },
        { label: "المخزون الحالي", html: num(stockQty, "qty") },
        { label: "قيمة المخزون", html: num(stockValue, "money"), tone: "gold" },
        { label: "الفروع", html: num(byBranch.length, "qty") },
        { label: "القطاعات", html: num(bySector.length, "qty") },
      ]);
      const banner = document.getElementById("filter-banner");
      if (filters.sector === "all") banner.hidden = true;
      else {
        banner.hidden = false;
        banner.textContent = `التصفية المطبقة: قطاع ${filters.sector} فقط`;
      }
      document.getElementById("branch-meta").textContent = `صفوف التفصيل: ${fmtQty(detail.length)}`;
      const columns = detailColumns();
      if (!columns.some((column) => column.key === detailState.sort)) {
        detailState.sort = "salesValue";
        detailState.dir = -1;
      }
      mountTable(document.getElementById("branch-total"), branchColumns, byBranch, branchState, draw);
      mountTable(document.getElementById("sector-total"), sectorColumns, bySector, sectorState, draw);
      mountTable(document.getElementById("branch-detail"), columns, detail, detailState, draw);
    }

    document.getElementById("filter-sector").addEventListener("change", (event) => {
      filters.sector = event.target.value;
      draw();
    });
    document.getElementById("filter-branch").addEventListener("change", (event) => {
      filters.branch = event.target.value;
      draw();
    });
    document.getElementById("filter-month").addEventListener("change", (event) => {
      filters.month = Number(event.target.value);
      draw();
    });
    const presetSector = new URLSearchParams(location.search).get("sector");
    const sectorSelect = document.getElementById("filter-sector");
    if (presetSector && [...sectorSelect.options].some((option) => option.value === presetSector)) {
      filters.sector = presetSector;
      sectorSelect.value = presetSector;
    }
    draw();
  }

  function renderAtwarRegions() {
    const app = document.getElementById("app");
    app.innerHTML = `
      <div id="region-kpis"></div>
      <p id="filter-banner" class="note" hidden></p>
      <div class="note">العميل يُحسب مرة واحدة داخل المنطقة حتى لو تكررت فواتيره أو أصنافه. إذا اشترى في منطقتين يُحسب في كل منطقة مرة، لذلك مجموع عملاء المناطق قد يزيد على عدد العملاء المختلفين في كامل المبيعات.</div>
      <section class="section">
        <div class="toolbar">
          <label class="field">القطاع
            <select id="filter-sector"><option value="all">كل القطاعات</option>${sectorOptions()}</select>
          </label>
          <label class="field">الشهر
            <select id="filter-month">${monthOptions()}</select>
          </label>
        </div>
        <div class="pair">
          <div>
            <h2>قيمة المبيعات حسب المنطقة</h2>
            <div id="region-sales-bars"></div>
          </div>
          <div>
            <h2>العملاء دون تكرار</h2>
            <div id="region-customer-bars"></div>
          </div>
        </div>
      </section>
      <section class="section">
        <h2>إجمالي المناطق</h2>
        <div id="region-total"></div>
      </section>
      <section class="section" id="region-detail-section">
        <h2>تفصيل المنطقة والقطاع</h2>
        <p class="lead">عدد العملاء في هذا الجدول بلا تكرار داخل القطاع والمنطقة معاً. جمعه قد يزيد على عدد عملاء المنطقة، لأن العميل قد يشتري من أكثر من قطاع.</p>
        <div id="region-detail"></div>
      </section>`;

    const filters = { sector: "all", month: 0 };
    const regionState = { sort: "salesValue", dir: -1 };
    const detailState = { sort: "salesValue", dir: -1 };
    const regionColumns = [
      { key: "region", label: "المنطقة", type: "text", stick: true, html: (row) => esc(row.region) },
      { key: "qty", label: "صافي الكمية", type: "num", html: (row) => num(row.qty, "qty") },
      { key: "salesValue", label: "قيمة المبيعات", type: "num", html: (row) => num(row.salesValue, "money") },
      { key: "share", label: "حصة المبيعات", type: "num", html: (row) => num(row.share, "pct") },
      { key: "customers", label: "العملاء دون تكرار", type: "num", html: (row) => num(row.customers, "qty") },
    ];
    const detailColumns = [
      { key: "region", label: "المنطقة", type: "text", stick: true, html: (row) => esc(row.region) },
      { key: "sector", label: "القطاع", type: "text", clip: true, html: (row) => esc(row.sector) },
      { key: "qty", label: "صافي الكمية", type: "num", html: (row) => num(row.qty, "qty") },
      { key: "salesValue", label: "قيمة المبيعات", type: "num", html: (row) => num(row.salesValue, "money") },
      { key: "customers", label: "العملاء دون تكرار", type: "num", html: (row) => num(row.customers, "qty") },
    ];

    function selectedLines() {
      return R.atwarLines.filter((line) => {
        if (filters.sector !== "all" && line.sector !== filters.sector) return false;
        if (filters.month && line.month !== filters.month) return false;
        return true;
      });
    }

    function groupRegions(lines) {
      const map = new Map();
      let salesValue = 0;
      for (const line of lines) {
        let acc = map.get(line.region);
        if (!acc) {
          acc = { region: line.region, qty: 0, salesValue: 0, customers: new Set() };
          map.set(line.region, acc);
        }
        acc.qty += line.qty;
        acc.salesValue += line.salesValue;
        salesValue += line.salesValue;
        if (line.customer) acc.customers.add(line.customer);
      }
      return [...map.values()].map((row) => ({
        region: row.region,
        qty: row.qty,
        salesValue: row.salesValue,
        share: salesValue ? row.salesValue / salesValue : null,
        customers: row.customers.size,
      }));
    }

    function groupDetail(lines) {
      const map = new Map();
      for (const line of lines) {
        const key = `${line.region}\0${line.sector}`;
        let acc = map.get(key);
        if (!acc) {
          acc = { region: line.region, sector: line.sector, qty: 0, salesValue: 0, customers: new Set() };
          map.set(key, acc);
        }
        acc.qty += line.qty;
        acc.salesValue += line.salesValue;
        if (line.customer) acc.customers.add(line.customer);
      }
      return [...map.values()].map((row) => ({
        region: row.region,
        sector: row.sector,
        qty: row.qty,
        salesValue: row.salesValue,
        customers: row.customers.size,
      }));
    }

    function draw() {
      const lines = selectedLines();
      const regions = groupRegions(lines);
      const detail = groupDetail(lines);
      const banner = document.getElementById("filter-banner");
      if (filters.sector === "all") banner.hidden = true;
      else {
        banner.hidden = false;
        banner.textContent = `التصفية المطبقة: قطاع ${filters.sector} فقط`;
      }
      const people = new Set();
      for (const line of lines) {
        if (line.customer) people.add(line.customer);
      }
      const regionCustomers = regions.reduce((sum, row) => sum + row.customers, 0);
      const salesValue = lines.reduce((sum, line) => sum + line.salesValue, 0);
      const qty = lines.reduce((sum, line) => sum + line.qty, 0);
      const sectorCount = new Set(lines.map((line) => line.sector)).size;
      document.getElementById("region-kpis").innerHTML = kpis([
        { label: "قيمة المبيعات", html: num(salesValue, "money") },
        { label: "صافي الكمية", html: num(qty, "qty") },
        { label: "المناطق", html: num(regions.length, "qty") },
        { label: "القطاعات", html: num(sectorCount, "qty") },
        { label: "عملاء بلا تكرار", html: num(people.size, "qty"), note: "في كل المناطق معاً", tone: "good" },
        { label: "مجموع عملاء المناطق", html: num(regionCustomers, "qty"), note: "قد يُحسب العميل في أكثر من منطقة" },
      ]);
      const bySales = regions.slice().sort((a, b) => b.salesValue - a.salesValue);
      const byCustomers = regions.slice().sort((a, b) => b.customers - a.customers);
      document.getElementById("region-sales-bars").innerHTML = hbars(bySales, (row) => row.region, (row) => row.salesValue, (value) => num(value, "money"));
      document.getElementById("region-customer-bars").innerHTML = hbars(byCustomers, (row) => row.region, (row) => row.customers, (value) => num(value, "qty"), null, "gold");
      mountTable(document.getElementById("region-total"), regionColumns, regions, regionState, draw);
      document.getElementById("region-detail-section").hidden = filters.sector !== "all";
      if (filters.sector === "all") {
        mountTable(document.getElementById("region-detail"), detailColumns, detail, detailState, draw);
      }
    }

    document.getElementById("filter-sector").addEventListener("change", (event) => {
      filters.sector = event.target.value;
      draw();
    });
    document.getElementById("filter-month").addEventListener("change", (event) => {
      filters.month = Number(event.target.value);
      draw();
    });
    const presetSector = new URLSearchParams(location.search).get("sector");
    const sectorSelect = document.getElementById("filter-sector");
    if (presetSector && [...sectorSelect.options].some((option) => option.value === presetSector)) {
      filters.sector = presetSector;
      sectorSelect.value = presetSector;
    }
    draw();
  }

  bootChrome();
  const pages = {
    home: renderHome,
    asnaf: renderAsnaf,
    tirador: renderTirador,
    atwar: renderAtwar,
    ribh: renderProfit,
    haraka: renderHaraka,
    tsec: renderBranchSectors,
    areg: renderAtwarRegions,
  };
  pages[PAGE]();
})();
