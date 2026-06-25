let stockChart = null;
let weeklyStockChart = null;
let salesTrendChart = null;
let allProducts = [];
let storeProducts = [];
let historyCache = [];

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw6K3N58inD_aZdmVA6yilTyxSSEE34ng_GXNviFvDTBLdXocmhBppWeCv4U9bcKr-3/exec";

async function apiRequest(action, payload = {}, _retries = 3) {

const params = new URLSearchParams({
  action,
  data: JSON.stringify(payload)
});

const url = `${WEB_APP_URL}?${params}`;

for(let attempt = 1; attempt <= _retries; attempt++){
  try {
    const response = await fetch(url);
    const text     = await response.text();

    try {
      return JSON.parse(text);
    } catch(e) {
      // Not JSON — likely a Google error page
      if(attempt < _retries){
        // Wait before retrying (500ms, 1000ms, 1500ms...)
        await new Promise(r => setTimeout(r, attempt * 500));
        continue;
      }
      console.error("API URL:", url);
      console.error("API RESPONSE:", text);
      showConnectionBanner("Server error. Retrying failed — please refresh.", "error");
      throw new Error("API did not return JSON. Check Apps Script deployment or action: " + action);
    }

  } catch(err) {
    if(err.message.includes("API did not return JSON")) throw err;

    // Network error
    if(attempt < _retries){
      showConnectionBanner(`Connection issue. Retrying (${attempt}/${_retries})...`, "warning");
      await new Promise(r => setTimeout(r, attempt * 500));
      continue;
    }

    showConnectionBanner("No internet connection. Please check your network.", "error");
    throw err;
  }
}

}

// ── Connection Banner ─────────────────────────────────────────────────────────
let _bannerTimeout = null;

function showConnectionBanner(message, type = "warning"){
  let banner = document.getElementById("connectionBanner");
  if(!banner){
    banner = document.createElement("div");
    banner.id = "connectionBanner";
    document.body.prepend(banner);
  }

  banner.className = "connection-banner " + type;
  banner.innerHTML = `
    <span>${type === "warning" ? "⚠️" : type === "error" ? "❌" : "✅"} ${message}</span>
    <button onclick="document.getElementById('connectionBanner').style.display='none'"
      style="background:none;border:none;color:inherit;cursor:pointer;font-size:16px;padding:0 4px;">✕</button>
  `;
  banner.style.display = "flex";

  // Auto-hide success messages after 3 seconds
  clearTimeout(_bannerTimeout);
  if(type === "success"){
    _bannerTimeout = setTimeout(()=>{
      banner.style.display = "none";
    }, 3000);
  }
}

// ── Offline/Online Detection ──────────────────────────────────────────────────
window.addEventListener("offline", ()=>{
  showConnectionBanner("You are offline. Please check your internet connection.", "error");
});

window.addEventListener("online", ()=>{
  showConnectionBanner("Back online! Refreshing data...", "success");
  // Auto-reload data when connection is restored
  setTimeout(()=>{
    if(typeof loadData === "function") loadData();
    else if(typeof loadHistoryCache === "function") loadHistoryCache();
  }, 500);
});
// ─────────────────────────────────────────────────────────────────────────────

async function loadHistoryCache(){

  const result =
  await apiRequest("getHistory");

  historyCache =
  result.records || [];

  return historyCache;
}

async function saveProduct() {
  const data = {
    barcode: document.getElementById("barcode").value.trim(),
    product: document.getElementById("product").value.trim(),
    category: document.getElementById("category").value,
    color: document.getElementById("color").value.trim(),
    size: document.getElementById("size").value.trim(),
    stock: Number(document.getElementById("stock").value),
    price: Number(document.getElementById("price").value)
  };

  if (!data.barcode || !data.product || !data.stock) {
    showMessage("Please input barcode, product name, at quantity.");
    return;
  }

  const result = await apiRequest("saveProduct", data);
  showMessage(result.message || "Saved!");

document.getElementById("barcode").value = "";
document.getElementById("product").value = "";
document.getElementById("category").selectedIndex = 0;
document.getElementById("color").value = "";
document.getElementById("size").value = "";
document.getElementById("stock").value = "";
document.getElementById("price").value = "";

  await Promise.all([
    loadProducts(),
    loadHistoryCache()
  ]);
  
  loadHistory();
  loadDailyReports();
  loadBestSellers();
  loadTransactionTimeline();
  updateRecentActivity();
  
  document.getElementById("barcode").focus();
  
}

async function loadProducts() {
  const result = await apiRequest("getProducts");
  const products = result.products || [];

  allProducts = products;

  const table = document.getElementById("productTable");

  let totalStock = 0;
  let lowStock = 0;
  let outStock = 0;
  let html = "";

  if (products.length === 0) {
    table.innerHTML =
    "<tr><td colspan='8'>Wala pang products sa database.</td></tr>";
    return;
  }

  products.forEach(item => {
    const stock = Number(item.stock) || 0;

    totalStock += stock;

    let statusText = "In Stock";
    let statusClass = "ok";

    if (stock === 0) {
      statusText = "Out";
      statusClass = "out";
      outStock++;
    } else if (stock <= 5) {
      statusText = "Low Stock";
      statusClass = "low";
      lowStock++;
    }

    html += `
      <tr>
        <td>${item.barcode}</td>
        <td>${item.product}</td>
        <td>${item.category}</td>
        <td>${item.color}</td>
        <td>${item.size}</td>
        <td>${item.stock}</td>
        <td>₱${item.price}</td>
        <td>
          <span class="status ${statusClass}">
            ${statusText}
          </span>
        </td>
      </tr>
    `;
  });

  table.innerHTML = html;

  document.getElementById("totalProducts").textContent = products.length;
  document.getElementById("totalStock").textContent = totalStock;
  document.getElementById("lowStock").textContent = lowStock;
  document.getElementById("outStock").textContent = outStock;

  // ── Warehouse Health Meter ──────────────────────────────────────────────
  const inStock = products.length - lowStock - outStock;
  const healthPct = products.length > 0
    ? Math.round((inStock / products.length) * 100) : 0;

  const healthFill  = document.getElementById("dbHealthFill");
  const healthScore = document.getElementById("dbHealthScore");
  const healthLabel = document.getElementById("dbHealthLabel");

  if(healthFill)  healthFill.style.width = healthPct + "%";
  if(healthScore) healthScore.textContent = healthPct + "%";

  const healthColor = healthPct >= 70 ? "#10b981" : healthPct >= 40 ? "#f59e0b" : "#ef4444";
  if(healthFill)  healthFill.style.background = `linear-gradient(90deg, ${healthColor}, ${healthColor}cc)`;
  if(healthScore) healthScore.style.color = healthColor;
  if(healthLabel){
    healthLabel.textContent = healthPct >= 70
      ? "Warehouse is well-stocked"
      : healthPct >= 40
      ? "Some items need restocking"
      : "Critical — many items out of stock";
  }

  // ── Stock Alerts ───────────────────────────────────────────────────────
  const alertList  = document.getElementById("dbAlertList");
  const alertCount = document.getElementById("dbAlertCount");

  const lowItems = products
    .filter(p => Number(p.stock) > 0 && Number(p.stock) <= 5)
    .sort((a,b) => Number(a.stock) - Number(b.stock))
    .slice(0, 8);

  const outItems = products
    .filter(p => Number(p.stock) === 0)
    .slice(0, 5);

  const allAlerts = [...outItems, ...lowItems];

  if(alertCount) alertCount.textContent = allAlerts.length;

  if(alertList){
    if(!allAlerts.length){
      alertList.innerHTML = `<p style="color:#9ca3af;text-align:center;font-size:13px;padding:16px 0;">✅ All stocks are healthy!</p>`;
    } else {
      alertList.innerHTML = allAlerts.map(p => {
        const qty   = Number(p.stock);
        const isOut = qty === 0;
        return `
          <div class="db-alert-item ${isOut ? "db-alert-out" : "db-alert-low"}">
            <div class="db-alert-info">
              <span class="db-alert-name">${p.product}</span>
              <span class="db-alert-meta">${p.color} · ${p.size}</span>
            </div>
            <span class="db-alert-qty">${isOut ? "OUT" : qty}</span>
          </div>
        `;
      }).join("");
    }
  }

  if (products.length > 0 && document.getElementById("stockChart")) {
    const labels = products.map(item =>
      item.product + " " + item.size
    );

    const stockData = products.map(item =>
      Number(item.stock) || 0
    );

    if (stockChart) {
      stockChart.destroy();
    }

    const ctx = document
      .getElementById("stockChart")
      .getContext("2d");

    stockChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Stock Quantity",
          data: stockData
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  populateFilters(products);
  filterProducts();
}

// ── Sales Cart ───────────────────────────────────────────────────────────────
let salesCart = [];

function addToSalesCart(){
  const field = document.getElementById("outBarcode");
  const barcode = cleanDuplicateBarcode(field.value).trim();

  if(!barcode){
    showMessage("Please scan a barcode first.", "warning");
    return;
  }

  const found = allProducts.find(p =>
    String(p.barcode).trim() === barcode
  );

  // If already in cart, just increment qty
  const existing = salesCart.find(i => i.barcode === barcode);
  if(existing){
    existing.qty += 1;
    renderSalesCart();
    field.value = "";
    field.focus();
    return;
  }

  salesCart.push({
    barcode,
    product: found ? found.product : barcode,
    qty: 1
  });

  renderSalesCart();
  field.value = "";
  field.focus();
}

function renderSalesCart(){
  const tbody = document.getElementById("salesCartTable");
  if(!tbody) return;

  if(salesCart.length === 0){
    tbody.innerHTML = `<tr id="cartEmptyRow"><td colspan="4" class="so-cart-empty"><div>🛒</div><p>Cart is empty — scan a barcode to add items</p></td></tr>`;
    updateSoCartUI();
    return;
  }

  tbody.innerHTML = salesCart.map((item, i) => `
    <tr>
      <td style="font-size:12px;color:#818cf8;">${item.barcode}</td>
      <td><strong>${item.product}</strong></td>
      <td>
        <input type="number" min="1" value="${item.qty}" class="pos-qty-input"
          onchange="updateCartQty(${i}, this.value)">
      </td>
      <td>
        <button onclick="removeCartItem(${i})"
          style="background:#ef4444;color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;">✕</button>
      </td>
    </tr>
  `).join("");

  updateSoCartUI();
}

function updateSoCartUI(){
  const badge   = document.getElementById("soCartBadge");
  const summary = document.getElementById("soCartSummary");
  const total   = salesCart.length;
  if(badge)   badge.textContent   = total + " item" + (total !== 1 ? "s" : "");
  if(summary) summary.textContent = total > 0
    ? total + " item" + (total !== 1 ? "s" : "") + " ready for checkout"
    : "Ready to checkout";
}

function updateCartQty(index, value){
  salesCart[index].qty = Math.max(1, Number(value));
}

function removeCartItem(index){
  salesCart.splice(index, 1);
  renderSalesCart();
}

async function submitSalesCart(){
  if(salesCart.length === 0){
    showMessage("Cart is empty.", "warning");
    return;
  }

  const deductFrom = document.getElementById("deductFrom").value;
  const salesType = document.getElementById("salesType").value;

  const btn = document.getElementById("deductbtn");
  setButtonLoading(btn, true);

  let hasError = false;

  for(const item of salesCart){
    const remarks = deductFrom === "Warehouse"
      ? "Warehouse - " + salesType
      : deductFrom + " - Walk-in";

    const result = await apiRequest("stockOut", {
      barcode: item.barcode,
      qty: item.qty,
      remarks,
      deductFrom
    });

    if(result.message && result.message.includes("Not enough")){
      showMessage("Not enough stock: " + item.barcode, "error");
      hasError = true;
    }
  }

  if(!hasError){
    setButtonSuccess(btn, "✓ Deducted");
    showMessage("All items deducted successfully!", "success");
    salesCart = [];
    renderSalesCart();
    document.getElementById("outBarcode").focus();
  } else {
    setButtonLoading(btn, false);
  }

  await loadHistoryCache();
  await Promise.all([loadProducts(), loadStoreProducts(), loadHistory()]);

  if(currentTab === "reports"){
    await Promise.all([loadDailyReports(), loadBestSellers()]);
  }
  if(currentTab === "sold-items") await loadSoldItems();
  if(currentTab === "dashboard"){
    await Promise.all([updateStoreSalesToday(), updateBranchRanking(), loadTransactionTimeline()]);
    updateRecentActivity();
  }
}

async function stockOut(){
  await submitSalesCart();
}
// ─────────────────────────────────────────────────────────────────────────────


function populateFilters(products){

const categoryFilter = document.getElementById("categoryFilter");
const colorFilter = document.getElementById("colorFilter");

if(!categoryFilter || !colorFilter) return;

const currentCategory = categoryFilter.value;
const currentColor = colorFilter.value;

const keyword = document
.getElementById("searchInput")
.value
.toLowerCase();

const matchedProducts = products.filter(p =>
  String(p.barcode).toLowerCase().includes(keyword) ||
  String(p.product).toLowerCase().includes(keyword) ||
  String(p.size).toLowerCase().includes(keyword)
);

categoryFilter.innerHTML =
`<option value="">All Category</option>`;

colorFilter.innerHTML =
`<option value="">All Color</option>`;

const categories = [
...new Set(matchedProducts.map(p => p.category).filter(Boolean))
];

const colors = [
...new Set(matchedProducts.map(p => p.color).filter(Boolean))
];

categories.forEach(cat=>{
categoryFilter.innerHTML +=
`<option value="${cat}">${cat}</option>`;
});

colors.forEach(color=>{
colorFilter.innerHTML +=
`<option value="${color}">${color}</option>`;
});

categoryFilter.value = currentCategory;
colorFilter.value = currentColor;

}

function filterProducts(){

populateFilters(allProducts);

const keyword =
document.getElementById("searchInput").value.toLowerCase();

const category =
document.getElementById("categoryFilter").value.toLowerCase();

const color =
document.getElementById("colorFilter").value.toLowerCase();

const stockStatus =
document.getElementById("stockFilter").value;

const rows =
document.querySelectorAll("#productTable tr");

rows.forEach(row=>{

const cells = row.querySelectorAll("td");

if(cells.length < 8) return;

const barcode = cells[0].textContent.toLowerCase();
const product = cells[1].textContent.toLowerCase();
const rowCategory = cells[2].textContent.toLowerCase();
const rowColor = cells[3].textContent.toLowerCase();
const size = cells[4].textContent.toLowerCase();
const stock = Number(cells[5].textContent) || 0;

const searchMatch =
barcode.includes(keyword) ||
product.includes(keyword) ||
rowColor.includes(keyword) ||
size.includes(keyword);

const categoryMatch =
!category || rowCategory === category;

const colorMatch =
!color || rowColor === color;

let statusMatch = true;

if(stockStatus === "in"){
statusMatch = stock > 5;
}

if(stockStatus === "low"){
statusMatch = stock > 0 && stock <= 5;
}

if(stockStatus === "out"){
statusMatch = stock === 0;
}

const show =
searchMatch &&
categoryMatch &&
colorMatch &&
statusMatch;

row.style.display = show ? "" : "none";

});

}

function autoFillProduct() {
  const barcode = cleanDuplicateBarcode(document.getElementById("barcode").value);
  document.getElementById("barcode").value = barcode;

  // kapag walang barcode, i-clear lahat
  if (barcode === "") {
    document.getElementById("product").value = "";
    document.getElementById("category").selectedIndex = 0;
    document.getElementById("color").value = "";
    document.getElementById("size").value = "";
    document.getElementById("stock").value = "";
    document.getElementById("price").value = "";
    return;
  }

  const found = allProducts.find(item =>
    String(item.barcode).trim() === barcode
  );

  if (!found) return;

  document.getElementById("product").value = found.product;
  document.getElementById("category").value = found.category;
  document.getElementById("color").value = found.color;
  document.getElementById("size").value = found.size;
  document.getElementById("stock").value = found.stock;
  document.getElementById("price").value = found.price;

  updatePreview();
  
}


async function loadHistory() {

  const records = historyCache;

  const table =
  document.getElementById("historyTable");

  if (!table) return;

  if (records.length === 0) {

    table.innerHTML =
    "<tr><td colspan='9'>No stock out history yet.</td></tr>";

    return;
  }

  let html = "";

  records.forEach(item => {

    html += `
      <tr>
        <td>${item.datetime}</td>
        <td>${item.barcode}</td>
        <td>${item.product}</td>
        <td>${item.color}</td>
        <td>${item.size}</td>
        <td>${item.qty}</td>
        <td>₱${item.price}</td>
        <td>₱${item.total}</td>
        <td>${item.remarks}</td>
      </tr>
    `;

  });

  table.innerHTML = html;

}

let currentTab = "dashboard";

async function showTab(tabId){

  currentTab = tabId;

  const tabs =
  document.querySelectorAll(".tab-content");

  tabs.forEach(tab=>{
    tab.style.display="none";
  });

  document.getElementById(tabId).style.display="block";

  const links =
  document.querySelectorAll("aside a");

  links.forEach(link=>{
    link.classList.remove("active");
  });

  const activeLink =
  document.querySelector(
  `aside a[onclick="showTab('${tabId}')"]`
  );

  if(activeLink){
    activeLink.classList.add("active");
  }

  // LOAD DATA ONLY WHEN OPENED

  if(tabId === "products"){
    await loadProducts();
  }

  if(tabId === "history"){
    await loadHistory();
  }

  if(tabId === "store"){
    await loadStoreProducts();
  }

  if(tabId === "sold-items"){
    await loadSoldItems();
  }

  if(tabId === "reports"){
    await Promise.all([
      loadDailyReports(),
      loadBestSellers(),
      loadSalesTrendChart()
    ]);
  }

  if(tabId === "dashboard"){
    await Promise.all([
      loadWeeklyStockChart(),
      updateStoreSalesToday(),
      loadTransactionTimeline()
    ]);
  }

  if(tabId === "add-stock"){
    setTimeout(()=>{
      document.getElementById("barcode").focus();
    },100);
  }

}

async function loadStoreProducts() {

  const result = await apiRequest("getStoreInventory");
  const products = result.products || [];

  storeProducts = products;

  const table = document.getElementById("storeTable");

  if (!table) return;

  if (products.length === 0) {

    table.innerHTML =
    "<tr><td colspan='6'>No store products yet.</td></tr>";

    return;
  }

  let html = "";

  products.forEach(item => {

    const stock = Number(item.stock) || 0;

    let stockBadge = "";

    if (stock <= 0) {

      stockBadge =
      `<span class="stock-out">❌ Out</span>`;

    } else if (stock <= 5) {

      stockBadge =
      `<span class="stock-low">⚠️ Low</span>`;

    } else {

      stockBadge =
      `<span class="stock-ok">✔ In Stock</span>`;
    }

    html += `
      <tr data-stock="${stock}">
        <td>${item.barcode}</td>
        <td>${item.product}</td>
        <td>${item.color}</td>
        <td>${item.size}</td>
        <td>
          <span class="stock-number">
            ${stock}
          </span>
          ${stockBadge}
        </td>
        <td>
          <span class="location-tag">
            🏪 ${item.location}
          </span>
        </td>
      </tr>
    `;
  });

  table.innerHTML = html;

  updateStoreCards(products);
  populateStoreFilters(products);
  updateColorFilter();
  filterStoreProducts();
}

async function sendToStore(){

const btn =
document.getElementById("sendStoreBtn");

setButtonLoading(btn,true);

const barcode =
cleanDuplicateBarcode(document.getElementById("transferBarcode").value);
document.getElementById("transferBarcode").value = barcode;

const store =
document.getElementById("toStore").value;

const qty =
Number(document.getElementById("transferQty").value);

if(!barcode || !qty){

setButtonLoading(btn,false);

showMessage(
"Please input barcode and quantity.",
"warning"
);

return;

}

const result =
await apiRequest(
"sendToStore",
{
barcode,
store,
qty
}
);

if(
String(result.message)
.toLowerCase()
.includes("not enough")
){

setButtonError(
btn,
"✕ No Stock"
);

showMessage(
result.message,
"error"
);

return;

}

setButtonSuccess(
btn,
"✓ Sent"
);

showSuccess(result.message);

document.getElementById("transferBarcode").value = "";
document.getElementById("transferQty").value = "";
document.getElementById("toStore").selectedIndex = 0;
document.getElementById("transferBarcode").focus();

await loadHistoryCache();
await Promise.all([
  loadProducts(),
  loadStoreProducts(),
  loadHistory()
]);
  
}




function filterStoreProducts(){


  const keyword =
  document.getElementById("storeSearchInput").value.toLowerCase();

  const location =
  document.getElementById("storeLocationFilter").value.toLowerCase();

  const color =
  document.getElementById("storeColorFilter").value.toLowerCase();

  const stockStatus =
  document.getElementById("storeStockFilter").value;

  const rows =
  document.querySelectorAll("#storeTable tr");

  rows.forEach(row => {
    const cells = row.querySelectorAll("td");

    if(cells.length < 6) return;

    const barcode = cells[0].textContent.toLowerCase();
    const product = cells[1].textContent.toLowerCase();
    const rowColor = cells[2].textContent.toLowerCase();
    const rowStore = cells[5].textContent.toLowerCase();
    const stock = Number(row.dataset.stock) || 0;

    const searchMatch =
    barcode.includes(keyword) ||
    product.includes(keyword) ||
    rowColor.includes(keyword);

    const colorMatch =
    !color || rowColor === color;

    const storeMatch =
    !location || rowStore.includes(location);

    let statusMatch = true;

    if(stockStatus === "in"){
      statusMatch = stock > 5;
    }

    if(stockStatus === "low"){
      statusMatch = stock > 0 && stock <= 5;
    }

    if(stockStatus === "out"){
      statusMatch = stock === 0;
    }

    row.style.display =
    searchMatch &&
    colorMatch &&
    storeMatch &&
    statusMatch
    ? "" : "none";
  });
}




async function returnToWarehouse(){

const btn =
document.getElementById("returnBtn");

setButtonLoading(btn,true);

const barcode=
cleanDuplicateBarcode(document.getElementById(
"returnBarcode"
).value);
document.getElementById("returnBarcode").value = barcode;

const store=
document.getElementById(
"fromStore"
).value;

const qty=
Number(
document.getElementById(
"returnQty"
).value
);

if(!barcode || !qty){

setButtonLoading(btn,false);

showMessage(
"Please input barcode and quantity.",
"warning"
);

return;

}

const result=
await apiRequest(
"returnToWarehouse",
{
barcode,
store,
qty
}
);

setButtonSuccess(
btn,
"✓ Returned"
);

  showSuccess(result.message);

document.getElementById(
"returnBarcode"
).value="";

document.getElementById(
"returnQty"
).value="";

document.getElementById("returnBarcode").value = "";
document.getElementById("returnQty").value = "";
document.getElementById("fromStore").selectedIndex = 0;
document.getElementById("returnBarcode").focus();

await loadHistoryCache();
await Promise.all([
  loadProducts(),
  loadStoreProducts(),
  loadHistory()
]);
  
}

async function refreshAllData() {

  const btn = document.getElementById("refreshBtn");

  setButtonLoading(btn, true);

  try {

    const products = document.getElementById("products");
    const history = document.getElementById("history");
    const soldItems = document.getElementById("sold-items");
    const reports = document.getElementById("reports");
    const store = document.getElementById("store");
    const dashboard = document.getElementById("dashboard");

    if(products && products.style.display !== "none"){

      await loadProducts();

    }

    else if(history && history.style.display !== "none"){
      await loadHistoryCache();
      await loadHistory();

    }

    else if(soldItems && soldItems.style.display !== "none"){

      await loadSoldItems();

    }

    else if(store && store.style.display !== "none"){

      await loadStoreProducts();

    }

    else if(reports && reports.style.display !== "none"){

      await Promise.all([
        loadDailyReports(),
        loadBestSellers()
      ]);

    }

    else if(dashboard && dashboard.style.display !== "none"){

      await Promise.all([
        loadWeeklyStockChart(),
        updateStoreSalesToday(),
        updateBranchRanking(),
        loadTransactionTimeline()
      ]);

    }

    setButtonSuccess(btn, "✓ Refreshed");

    showMessage(
      "Data refreshed successfully.",
      "success"
    );

  } catch(error) {

    console.error(error);

    setButtonError(
      btn,
      "✕ Failed"
    );

    showMessage(
      "Refresh failed.",
      "error"
    );

  }

}

function togglePassword(){

const password=
document.getElementById(
"password"
);

const eye=
document.getElementById(
"eyeBtn"
);

if(password.type==="password"){

password.type="text";

eye.innerHTML="👁️";

}else{

password.type="password";

eye.innerHTML="🙈";

}

}

document.getElementById(
"todayDate"
).innerText=

new Date()
.toLocaleString();

async function loadWeeklyStockChart() {
  
 const records = historyCache;

  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const totals = [0,0,0,0,0,0,0];

  records.forEach(item => {
    const date = new Date(item.datetime);
    const dayIndex = date.getDay();

    totals[dayIndex] += Number(item.qty) || 0;
  });

  const ctx = document.getElementById("weeklyStockChart");

  if (!ctx) return;

  if (weeklyStockChart) {
    weeklyStockChart.destroy();
  }

const gradient =
ctx.getContext("2d")
.createLinearGradient(
0,0,0,300
);

gradient.addColorStop(
0,
"#6366f1"
);

gradient.addColorStop(
1,
"#4338ca"
);

weeklyStockChart =
new Chart(ctx,{

type:"bar",

data:{

labels:days,

datasets:[
{
  type:"bar",
  label:"Daily Movement",
  data:totals,
  backgroundColor:"rgba(79,70,229,.35)",
  borderRadius:10,
  borderSkipped:false
},
{
  type:"line",
  label:"Trend",
  data:totals,
  borderColor:"#4f46e5",
  backgroundColor:"rgba(79,70,229,.12)",
  tension:.4,
  fill:true,
  pointRadius:5
}
]

},

options:{

responsive:true,

maintainAspectRatio:false,

plugins:{

legend:{
display:false
},

tooltip:{

backgroundColor:
"#1e1b4b",

padding:12,

titleFont:{
size:14
},

bodyFont:{
size:13
}

}

},

animation:{

duration:1500

},

scales:{

x:{

grid:{
display:false
}

},

y:{

beginAtZero:true,

ticks:{
stepSize:1
},

grid:{

color:
"rgba(0,0,0,.05)"

}

}

}

}

});
}

function updateClock() {
  const now = new Date();

  document.getElementById("todayDate").textContent =
    "Today " + now.toLocaleString();
}

      function updatePreview() {
        document.getElementById("previewName").innerText =
          document.getElementById("product").value || "No Product";
      
        document.getElementById("previewColor").innerText =
          "Color: " + (document.getElementById("color").value || "-");
      
        document.getElementById("previewSize").innerText =
          "Size: " + (document.getElementById("size").value || "-");
      
        const priceVal = document.getElementById("price").value;
        document.getElementById("previewPrice").innerText =
          priceVal ? "₱ " + Number(priceVal).toLocaleString("en-PH") : "₱ -";
      
        document.getElementById("previewStock").innerText =
          document.getElementById("stock").value || "-";

        // Update cart count
        const rows = document.querySelectorAll("#stockCartTable tr:not(#asCartEmpty)");
        const countEl = document.getElementById("asCartCount");
        if(countEl) countEl.textContent = rows.length + " item" + (rows.length !== 1 ? "s" : "");

        const productName =
        document.getElementById("product").value
        .trim()
        .toLowerCase();
        
        const previewImg =
        document.getElementById("previewImg");
        
      if (productName.includes("bella (kids)")) {

          previewImg.src = "images/bella-kids.png";
        
        } else if (productName.includes("alessandra")) {
        
          previewImg.src = "images/alessandra.png";

        } else if (productName.includes("christine")) {
        
          previewImg.src = "images/christine.png";

        } else if (productName.includes("elie")) {
        
          previewImg.src = "images/elie.png";

        } else if (productName.includes("erin")) {
        
          previewImg.src = "images/erin.png";

        } else if (productName.includes("farrah")) {
        
          previewImg.src = "images/farrah.png";

        } else if (productName.includes("georgina")) {
        
          previewImg.src = "images/georgina.png";

        } else if (productName.includes("gia")) {
        
          previewImg.src = "images/gia.png";

        } else if (productName.includes("katrice")) {
        
          previewImg.src = "images/katrice.png";

        } else if (productName.includes("leila")) {
        
          previewImg.src = "images/leila.png";

        } else if (productName.includes("linda")) {
        
          previewImg.src = "images/linda.png";

        } else if (productName.includes("natalie")) {
        
          previewImg.src = "images/natalie.png";

        } else if (productName.includes("rene")) {
        
          previewImg.src = "images/rene.png";

        } else if (productName.includes("sadie")) {
        
          previewImg.src = "images/sadie.png";

        } else if (productName.includes("simone")) {
        
          previewImg.src = "images/simone.png";

        } else if (productName.includes("tamara")) {
        
          previewImg.src = "images/tamara.png";

        } else if (productName.includes("winona")) {
        
          previewImg.src = "images/winona.png";
        
        } else if (productName.includes("bella")) {
        
          previewImg.src = "images/bella.png";

        } else {
        
          previewImg.src = "logo.png";

}
      }

function resetPreview(){

document.getElementById(
"previewName"
).innerText="No Product";

document.getElementById(
"previewColor"
).innerText="Color: -";

document.getElementById(
"previewSize"
).innerText="Size: -";

document.getElementById(
"previewPrice"
).innerText="Price: -";

document.getElementById(
"previewStock"
).innerText="Stock: -";

}

function focusBarcode(){
  document.getElementById("barcode").focus();
}

let stockCart = [];

function addStockToCart() {

const btn =
document.getElementById("addstockbtn");

setButtonLoading(btn,true);

const item = {
barcode: cleanDuplicateBarcode(
document.getElementById("barcode").value
),
product:
document.getElementById("product").value.trim(),
category:
document.getElementById("category").value,
color:
document.getElementById("color").value.trim(),
size:
document.getElementById("size").value.trim(),
stock:
Number(document.getElementById("stock").value),
price:
Number(document.getElementById("price").value)
};

if (
!item.barcode ||
!item.product ||
!item.stock
) {

setButtonLoading(btn,false);

showMessage(
"Please input barcode, product name, and quantity.",
"warning"
);

return;
}

const existingItem =
stockCart.find(cartItem =>
cartItem.barcode === item.barcode
);

if(existingItem){

existingItem.stock += item.stock;

}else{

stockCart.push(item);

}

renderStockCart();

setButtonSuccess(
btn,
"✓ Added"
);

document.getElementById("barcode").value = "";
document.getElementById("product").value = "";
document.getElementById("category").selectedIndex = 0;
document.getElementById("color").value = "";
document.getElementById("size").value = "";
document.getElementById("stock").value = "";
document.getElementById("price").value = "";

resetPreview();

document.getElementById("barcode").focus();

}

function renderStockCart() {
  const tbody =
  document.getElementById("stockCartTable");

  if(!tbody) return;

  if(stockCart.length === 0){
    tbody.innerHTML = "";
    return;
  }

  let html = "";

  stockCart.forEach((item, index) => {

    html += `
      <tr>
        <td>${item.barcode}</td>
        <td>${item.product}</td>
        <td>${item.color}</td>
        <td>${item.size}</td>
        <td>${item.stock}</td>
        <td>₱${item.price}</td>
        <td>
          <button class="remove-btn"
          onclick="removeStockCartQty(${index})">
            Remove
          </button>
        </td>
      </tr>
    `;

  });

  tbody.innerHTML = html;
}

async function autoAddScan(e){

if(e.key !== "Enter") return;

e.preventDefault();

autoFillProduct();

document.getElementById("stock").value = 1;

setTimeout(() => {

updatePreview();
addStockToCart();

},150);

}

function cleanDuplicateBarcode(value){
  value = value.trim();

  const half = value.length / 2;

  if(
    value.length % 2 === 0 &&
    value.slice(0, half) === value.slice(half)
  ){
    return value.slice(0, half);
  }

  return value;
}

// ── Barcode scanner duplicate fix ──────────────────────────────────────────
const _scanDone = {};

function handleBarcodeScan(event, fieldId, actionFn){
  const field = document.getElementById(fieldId);

  // Block all keystrokes while locked (scanner still sending characters)
  if(_scanDone[fieldId]){
    event.preventDefault();
    return;
  }

  if(event.key !== "Enter") return;
  event.preventDefault();

  // Lock the field immediately
  _scanDone[fieldId] = true;
  field.setAttribute("readonly", true);

  // Run the action (null = barcode-only field like outBarcode)
  if(actionFn) actionFn();

  // Auto-fill qty with 1 after scan if qty field is empty
  const qtyMap = {
    "outBarcode": "outQty",
    "transferBarcode": "transferQty",
    "returnBarcode": "returnQty"
  };
  const qtyFieldId = qtyMap[fieldId];
  if(qtyFieldId){
    const qtyField = document.getElementById(qtyFieldId);
    if(qtyField && !qtyField.value){
      qtyField.value = 1;
    }
  }

  // Unlock after 800ms — field value stays, no auto-clear
  setTimeout(()=>{
    _scanDone[fieldId] = false;
    field.removeAttribute("readonly");
  }, 800);
}
// ────────────────────────────────────────────────────────────────────────────

async function saveStockCart(){

const btn =
document.getElementById("savestockbtn");

setButtonLoading(btn,true);

if(stockCart.length === 0){

setButtonLoading(btn,false);

showMessage(
"Cart is empty.",
"warning"
);

return;

}

await apiRequest(
  "saveStockCart",
  {
    items: stockCart
  }
);

setButtonSuccess(
btn,
"✓ Saved"
);

showSuccess("All stock saved!");

stockCart = [];
renderStockCart();

await loadProducts();

document.getElementById("barcode").focus();

}

let removeIndex = -1;

function removeStockCartQty(index){

removeIndex=index;

const item=stockCart[index];

document.getElementById(
"removeText"
).innerText=
`Available: ${item.stock}`;

document.getElementById(
"removeQtyInput"
).value="";

document.getElementById(
"removeModal"
).style.display="flex";

}

function confirmRemoveQty(){

const qty=Number(
document.getElementById(
"removeQtyInput"
).value
);

const item=stockCart[removeIndex];

if(qty>=item.stock){

stockCart.splice(
removeIndex,
1
);

}else{

item.stock-=qty;

}

renderStockCart();

closeRemoveModal();

}

function closeRemoveModal(){

document.getElementById(
"removeModal"
).style.display="none";

}

function showSuccess(message){

document.getElementById(
"successText"
).innerText=message;

document.getElementById(
"successModal"
).style.display="flex";

}

function closeSuccessModal(){

document.getElementById(
"successModal"
).style.display="none";

}

function toggleSalesType(){

const deductFrom =
document.getElementById("deductFrom").value;

const salesType =
document.getElementById("salesType");

if(
deductFrom.includes("Store")
){

salesType.value = "Walk-in Sales";
salesType.disabled = true;

}else{

salesType.disabled = false;
salesType.value = "";

}

}

function showMessage(text,type="success"){

const icon=document.getElementById("msgIcon");
const title=document.getElementById("msgTitle");

document.getElementById("msgText").innerText=text;

if(type==="success"){
 icon.innerHTML="✅";
 title.innerText="Success";
}
else if(type==="error"){
 icon.innerHTML="❌";
 title.innerText="Error";
}
else{
 icon.innerHTML="⚠️";
 title.innerText="Warning";
}

document.getElementById(
"msgModal"
).style.display="flex";

}

function closeMessage(){
document.getElementById(
"msgModal"
).style.display="none";
}

function toggleDarkMode(){

document.body.classList.toggle(
"dark-mode"
);

}

function populateStoreFilters(products){

const locationFilter =
document.getElementById("storeLocationFilter");

const currentStore =
locationFilter.value;

locationFilter.innerHTML =
`<option value="">All Store</option>`;

const locations =
[...new Set(products.map(p=>p.location))];

locations.forEach(location=>{

locationFilter.innerHTML += `
<option value="${location}">
${location}
</option>`;

});

locationFilter.value = currentStore;
updateColorFilter();

}


function updateColorFilter(){

const selectedStore =
document.getElementById("storeLocationFilter").value;

const colorFilter =
document.getElementById("storeColorFilter");

colorFilter.innerHTML =
`<option value="">All Color</option>`;

let filteredProducts = storeProducts;

if(selectedStore){
filteredProducts =
storeProducts.filter(p =>
String(p.location).trim() === selectedStore
);
}

const colors =
[...new Set(filteredProducts.map(p=>p.color).filter(Boolean))];

colors.forEach(color=>{
colorFilter.innerHTML += `
<option value="${color}">${color}</option>`;
});

}

// ── Report Sub-Tabs ───────────────────────────────────────────────────────────
function showReportTab(tab, btn){
  document.querySelectorAll(".report-subtab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".report-tab-content").forEach(c => c.style.display = "none");
  document.getElementById("reportTab-" + tab).style.display = "block";
  if(btn) btn.classList.add("active");
}
// ─────────────────────────────────────────────────────────────────────────────

// ── KPI Store Filter ─────────────────────────────────────────────────────────
let _kpiStoreFilter = "all";

function setKpiStoreFilter(filter, btn){
  _kpiStoreFilter = filter;
  document.querySelectorAll(".kpi-store-btn").forEach(b => b.classList.remove("active"));
  if(btn) btn.classList.add("active");
  loadDailyReports();
}
// ─────────────────────────────────────────────────────────────────────────────

async function loadDailyReports(){

const reportDate = document.getElementById("reportDate");
if(!reportDate) return;

const date = reportDate.value;
  
if(!document.getElementById("addStockReport")) return;

// Use date range filter if set, otherwise fall back to single date
const history = getFilteredHistory();

const addStock = document.getElementById("addStockReport");
const warehouseToStore = document.getElementById("warehouseToStoreReport");
const storeToWarehouse = document.getElementById("storeToWarehouseReport");
const warehouseOnline  = document.getElementById("warehouseOnlineReport");
const store1Walkin = document.getElementById("store1WalkinReport");
const store2Walkin = document.getElementById("store2WalkinReport");
const store3Walkin = document.getElementById("store3WalkinReport");

if(!addStock||!warehouseToStore||!storeToWarehouse||!warehouseOnline||!store1Walkin||!store2Walkin||!store3Walkin) return;

addStock.innerHTML="";warehouseToStore.innerHTML="";storeToWarehouse.innerHTML="";
warehouseOnline.innerHTML="";store1Walkin.innerHTML="";store2Walkin.innerHTML="";store3Walkin.innerHTML="";

let store1Sales = {};
let store2Sales = {};
let store3Sales = {};
let onlineSales = {};

let store1Total = 0, store2Total = 0, store3Total = 0;
let onlineTotal = 0;
let onlineItemsSold = 0;
let walkinTotal = 0;

let colorSales = {};
let sizeSales  = {};
let returnData = {}; // for return analytics

let summary = {
  addStock:{qty:0,total:0},
  warehouseToStore:{qty:0,total:0},
  storeToWarehouse:{qty:0,total:0},
  warehouseOnline:{qty:0,total:0},
  store1Walkin:{qty:0,total:0},
  store2Walkin:{qty:0,total:0},
  store3Walkin:{qty:0,total:0}
};

let addStockHtml="",warehouseToStoreHtml="",storeToWarehouseHtml="",warehouseOnlineHtml="";
let store1WalkinHtml="",store2WalkinHtml="",store3WalkinHtml="";

history.forEach(item => {

let badgeClass = "badge-stock";
let badgeText  = "STOCK";

const lowerRemarks = (item.remarks || "").toLowerCase();

if(lowerRemarks.includes("walk")){ badgeClass="badge-sale"; badgeText="WALK-IN"; }
else if(lowerRemarks.includes("online")){ badgeClass="badge-online"; badgeText="ONLINE"; }
else if(lowerRemarks.includes("warehouse") && lowerRemarks.includes("store")){ badgeClass="badge-transfer"; badgeText="TRANSFER"; }
else if(lowerRemarks.includes("add stock")){ badgeClass="badge-stock"; badgeText="ADD STOCK"; }

const row = `
<div class="report-item">
<div class="report-top">
<b>${item.product}</b>
<span class="report-badge ${badgeClass}">${badgeText}</span>
</div>
<small>${item.barcode}</small>
<small>Qty: ${item.qty}</small>
${item.total?`<small>Total: ₱${Number(item.total).toLocaleString()}</small>`:""}
</div>`;

const remarks = (item.remarks || "").toLowerCase();
const product = item.product;
const qty     = Number(item.qty)   || 0;
const total   = Number(item.total) || 0;
const color   = item.color || "Unknown";
const size    = item.size  || "Unknown";

if(remarks.includes("walk")){
  colorSales[color] = (colorSales[color]||0)+qty;
  sizeSales[size]   = (sizeSales[size]||0)+qty;
  walkinTotal += total;
}

if(remarks.includes("store 1")&&remarks.includes("walk")) store1Sales[product]=(store1Sales[product]||0)+qty;
if(remarks.includes("store 2")&&remarks.includes("walk")) store2Sales[product]=(store2Sales[product]||0)+qty;
if(remarks.includes("store 3")&&remarks.includes("walk")) store3Sales[product]=(store3Sales[product]||0)+qty;

if(remarks.includes("add stock")){
  addStockHtml+=row; summary.addStock.qty+=qty; summary.addStock.total+=total;
}
else if(remarks.startsWith("warehouse")&&remarks.includes("store")){
  warehouseToStoreHtml+=row; summary.warehouseToStore.qty+=qty; summary.warehouseToStore.total+=total;
}
else if(remarks.startsWith("store")&&remarks.includes("warehouse")){
  storeToWarehouseHtml+=row; summary.storeToWarehouse.qty+=qty; summary.storeToWarehouse.total+=total;
  // Track returns per product
  returnData[product] = (returnData[product]||0)+qty;
}
else if(remarks.includes("online")){
  onlineTotal += total;
  onlineItemsSold += qty;
  onlineSales[product] = (onlineSales[product]||0) + qty;
  warehouseOnlineHtml+=row; summary.warehouseOnline.qty+=qty; summary.warehouseOnline.total+=total;
}
else if(remarks.startsWith("store 1")&&remarks.includes("walk")){
  store1WalkinHtml+=row; store1Total+=total; summary.store1Walkin.qty+=qty; summary.store1Walkin.total+=total;
}
else if(remarks.startsWith("store 2")&&remarks.includes("walk")){
  store2WalkinHtml+=row; store2Total+=total; summary.store2Walkin.qty+=qty; summary.store2Walkin.total+=total;
}
else if(remarks.startsWith("store 3")&&remarks.includes("walk")){
  store3WalkinHtml+=row; store3Total+=total; summary.store3Walkin.qty+=qty; summary.store3Walkin.total+=total;
}

});

addStock.innerHTML       = addStockHtml       || `<div class="report-empty">No records</div>`;
warehouseToStore.innerHTML = warehouseToStoreHtml || `<div class="report-empty">No records</div>`;
storeToWarehouse.innerHTML = storeToWarehouseHtml || `<div class="report-empty">No records</div>`;
warehouseOnline.innerHTML  = warehouseOnlineHtml  || `<div class="report-empty">No records</div>`;
store1Walkin.innerHTML     = store1WalkinHtml     || `<div class="report-empty">No records</div>`;
store2Walkin.innerHTML     = store2WalkinHtml     || `<div class="report-empty">No records</div>`;
store3Walkin.innerHTML     = store3WalkinHtml     || `<div class="report-empty">No records</div>`;

updateReportSummary("addStock",        summary.addStock);
updateReportSummary("warehouseToStore",summary.warehouseToStore);
updateReportSummary("storeToWarehouse",summary.storeToWarehouse);
updateReportSummary("warehouseOnline", summary.warehouseOnline);
updateReportSummary("store1Walkin",    summary.store1Walkin);
updateReportSummary("store2Walkin",    summary.store2Walkin);
updateReportSummary("store3Walkin",    summary.store3Walkin);

updateBestSellerCard(store1Sales,"store1BestSeller","store1BestSellerQty");
updateBestSellerCard(store2Sales,"store2BestSeller","store2BestSellerQty");
updateBestSellerCard(store3Sales,"store3BestSeller","store3BestSellerQty");

// Revenue now includes online sales too
updateReportOverview(store1Total,store2Total,store3Total,store1Sales,store2Sales,store3Sales,onlineTotal,onlineSales,onlineItemsSold);

updateTopAnalytics(colorSales,"topColorsBox");
updateTopAnalytics(sizeSales,"topSizesBox");

// New charts
loadStoreComparisonChart(store1Total,store2Total,store3Total);
loadSalesBreakdownChart(walkinTotal, onlineTotal);
updateReturnAnalytics(returnData);

}








// ── Best Sellers Period Filter ────────────────────────────────────────────────
let _bsPeriod = "month";

function setBsPeriod(period, btn){
  _bsPeriod = period;
  document.querySelectorAll(".bs-period-btn").forEach(b => b.classList.remove("active"));
  if(btn) btn.classList.add("active");
  const customBox = document.getElementById("bsCustomBox");
  if(period === "custom"){
    customBox.style.display = "flex";
  } else {
    customBox.style.display = "none";
    const monthEl = document.getElementById("bestSellerMonth");
    if(monthEl && !monthEl.value) monthEl.value = new Date().toISOString().slice(0,7);
  }
  reloadBestSellersWithLoader();
}

async function loadBestSellers(){
  const records = historyCache || [];
  const now     = new Date();
  const period  = _bsPeriod || "month";
  const currentMonth = now.toISOString().slice(0,7);
  const currentWeek  = String(Math.ceil(now.getDate() / 7));

  const store1 = {}, store2 = {}, store3 = {}, online = {}, overall = {};
  const totals  = { store1: 0, store2: 0, store3: 0, online: 0 };

  records.forEach(item => {
    const remarks  = String(item.remarks || "").toLowerCase();
    const isWalkin = remarks.includes("walk");
    const isOnline = remarks.includes("online");
    if(!isWalkin && !isOnline) return;

    const date    = new Date(item.datetime || item.date);
    const month   = date.toISOString().slice(0,7);
    const week    = String(Math.ceil(date.getDate() / 7));
    const product = item.product || "Unknown";
    const qty     = Number(item.qty)   || 0;
    const total   = Number(item.total) || 0;

    if(period === "month"){
      if(month !== currentMonth) return;
    } else if(period === "week"){
      if(month !== currentMonth || week !== currentWeek) return;
    } else if(period === "custom"){
      const selMonth = document.getElementById("bestSellerMonth")?.value || "";
      const selWeek  = document.getElementById("bestSellerWeek")?.value  || "";
      if(selMonth && month !== selMonth) return;
      if(selWeek  && week  !== selWeek)  return;
    }

    if(isOnline){
      online[product]  = (online[product]  || 0) + qty;
      overall[product] = (overall[product] || 0) + qty;
      totals.online   += total;
    } else if(remarks.includes("store 1")){
      store1[product]  = (store1[product]  || 0) + qty;
      overall[product] = (overall[product] || 0) + qty;
      totals.store1   += total;
    } else if(remarks.includes("store 2")){
      store2[product]  = (store2[product]  || 0) + qty;
      overall[product] = (overall[product] || 0) + qty;
      totals.store2   += total;
    } else if(remarks.includes("store 3")){
      store3[product]  = (store3[product]  || 0) + qty;
      overall[product] = (overall[product] || 0) + qty;
      totals.store3   += total;
    }
  });

  const periodEl = document.getElementById("bsPeriodDisplay");
  if(periodEl){
    if(period === "month") periodEl.textContent = "This Month";
    else if(period === "week") periodEl.textContent = "This Week";
    else periodEl.textContent = "Custom Period";
  }

  renderBsStore("bsStore1List", store1);
  renderBsStore("bsStore2List", store2);
  renderBsStore("bsStore3List", store3);
  renderBsStore("bsOnlineList", online);
  renderBsOverall("bsOverallList", overall);

  const fmt = n => "₱" + Number(n).toLocaleString("en-PH", {minimumFractionDigits:0});
  const s1 = document.getElementById("bsStore1Total");
  const s2 = document.getElementById("bsStore2Total");
  const s3 = document.getElementById("bsStore3Total");
  const s4 = document.getElementById("bsOnlineTotal");
  if(s1) s1.textContent = fmt(totals.store1) + " total sales";
  if(s2) s2.textContent = fmt(totals.store2) + " total sales";
  if(s3) s3.textContent = fmt(totals.store3) + " total sales";
  if(s4) s4.textContent = fmt(totals.online) + " total sales";

  // Keep old IDs working for Overview tab
  const onlineRevEl = document.getElementById("onlineRevenue");
  const onlineItmEl = document.getElementById("onlineItemsSold");
  const onlineBstEl = document.getElementById("onlineBestSeller");
  const topOnline   = Object.entries(online).sort((a,b)=>b[1]-a[1])[0];
  if(onlineRevEl) onlineRevEl.textContent = fmt(totals.online);
  if(onlineItmEl) onlineItmEl.textContent = Object.values(online).reduce((a,b)=>a+b,0);
  if(onlineBstEl) onlineBstEl.textContent = topOnline ? topOnline[0] : "-";
}

function renderBsStore(elId, sales){
  const el = document.getElementById(elId);
  if(!el) return;
  const entries = Object.entries(sales).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(!entries.length){
    el.innerHTML = `<div class="bs-empty">No sales yet</div>`;
    return;
  }
  const medals = ["🥇","🥈","🥉","4️⃣","5️⃣"];
  el.innerHTML = entries.map(([name, qty], i) => `
    <div class="bs-rank-item" style="animation-delay:${i*60}ms">
      <div class="bs-rank-medal">${medals[i]}</div>
      <div class="bs-rank-name">${name}</div>
      <div class="bs-rank-qty">${qty}<span>sold</span></div>
    </div>
  `).join("");
}

function renderBsOverall(elId, sales){
  const el = document.getElementById(elId);
  if(!el) return;
  const entries = Object.entries(sales).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(!entries.length){
    el.innerHTML = `<div style="text-align:center;color:#aaa;padding:20px;">No sales yet</div>`;
    return;
  }
  const medals = ["🥇","🥈","🥉","4️⃣","5️⃣"];
  const max = entries[0][1];
  el.innerHTML = entries.map(([name, qty], i) => `
    <div class="bs-overall-item" style="animation-delay:${i*80}ms">
      <div class="bs-overall-rank">${medals[i]}</div>
      <div class="bs-overall-info">
        <div class="bs-overall-name">${name}</div>
        <div class="bs-overall-bar">
          <div class="bs-overall-bar-fill" style="width:${(qty/max*100).toFixed(1)}%"></div>
        </div>
      </div>
      <div class="bs-overall-count">${qty}<span>sold</span></div>
    </div>
  `).join("");
}
// ─────────────────────────────────────────────────────────────────────────────


// ── Date Range Filter ─────────────────────────────────────────────────────
let _activeDateRange = { from: null, to: null };

function setDateRange(type, btn){
  document.querySelectorAll(".range-btn").forEach(b=>b.classList.remove("active"));
  if(btn) btn.classList.add("active");

  const customBox = document.getElementById("customRangeBox");
  if(type === "custom"){
    customBox.style.display = "flex";
    return;
  }
  customBox.style.display = "none";

  const today = new Date();
  let from, to;

  if(type === "today"){
    from = to = today;
  } else if(type === "week"){
    const day = today.getDay();
    from = new Date(today); from.setDate(today.getDate() - day);
    to   = new Date(today);
  } else if(type === "month"){
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to   = today;
  }

  _activeDateRange = { from: formatDate(from), to: formatDate(to) };

  const rd = document.getElementById("reportDate");
  if(rd) rd.value = _activeDateRange.from;

  const label = type === "today" ? "Today" : type === "week" ? "This Week" : "This Month";
  const span = document.getElementById("reportDateText");
  if(span) span.textContent = label;

  reloadReportsWithLoader();
}

function applyCustomRange(){
  const from = document.getElementById("dateRangeFrom")?.value;
  const to   = document.getElementById("dateRangeTo")?.value;
  if(!from || !to) return;
  _activeDateRange = { from, to };
  const rd = document.getElementById("reportDate");
  if(rd) rd.value = from;
  const span = document.getElementById("reportDateText");
  if(span) span.textContent = `${from} to ${to}`;
  reloadReportsWithLoader();
}

function formatDate(d){
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth()+1).padStart(2,"0");
  const dd   = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function getFilteredHistory(){
  const history = historyCache || [];
  const { from, to } = _activeDateRange;
  if(!from && !to) return history;
  return history.filter(item=>{
    const itemDate = new Date(item.datetime || item.date).toISOString().split("T")[0];
    if(from && itemDate < from) return false;
    if(to   && itemDate > to)   return false;
    return true;
  });
}

// ── CSV Export ────────────────────────────────────────────────────────────
function exportReportsCSV(){
  const history = getFilteredHistory();
  if(!history.length){ showMessage("Walang data para i-export.", "warning"); return; }

  const rows = [["Date/Time","Barcode","Product","Color","Size","Qty","Price","Total","Remarks"]];
  history.forEach(item=>{
    rows.push([
      item.datetime||item.date||"", item.barcode||"", item.product||"",
      item.color||"", item.size||"", item.qty||0, item.price||0,
      item.total||0, item.remarks||""
    ]);
  });

  const csvContent = rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csvContent],{type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `ava-report-${_activeDateRange.from||formatDate(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showMessage("CSV exported successfully!", "success");
}

// ── Store Comparison Bar Chart ────────────────────────────────────────────
let storeComparisonChart = null;
let salesBreakdownChart  = null;

function loadStoreComparisonChart(s1, s2, s3){
  const canvas = document.getElementById("storeComparisonChart");
  if(!canvas) return;
  if(storeComparisonChart) storeComparisonChart.destroy();
  storeComparisonChart = new Chart(canvas,{
    type:"bar",
    data:{
      labels:["Store 1","Store 2","Store 3"],
      datasets:[{
        label:"Revenue",
        data:[s1,s2,s3],
        backgroundColor:["rgba(79,70,229,.85)","rgba(16,185,129,.85)","rgba(245,158,11,.85)"],
        borderRadius:14, borderSkipped:false
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:"#1e1b4b",padding:12,callbacks:{label:ctx=>"₱"+Number(ctx.raw).toLocaleString()}}
      },
      scales:{
        x:{grid:{display:false}},
        y:{beginAtZero:true,ticks:{callback:v=>"₱"+Number(v).toLocaleString()},grid:{color:"rgba(0,0,0,.05)"}}
      },
      animation:{duration:900}
    }
  });
}

// ── Online vs Walk-in Donut Chart ─────────────────────────────────────────
function loadSalesBreakdownChart(walkinTotal, onlineTotal){
  const canvas = document.getElementById("salesBreakdownChart");
  const legend = document.getElementById("salesBreakdownLegend");
  if(!canvas) return;
  if(salesBreakdownChart) salesBreakdownChart.destroy();
  const total = walkinTotal + onlineTotal;
  if(total === 0){
    canvas.style.display="none";
    if(legend) legend.innerHTML=`<span style="color:#94a3b8;font-weight:700;">No sales data</span>`;
    return;
  }
  canvas.style.display="";
  const walkPct=Math.round((walkinTotal/total)*100);
  const onlinePct=100-walkPct;
  salesBreakdownChart = new Chart(canvas,{
    type:"doughnut",
    data:{
      labels:["Walk-in","Online"],
      datasets:[{data:[walkinTotal,onlineTotal],backgroundColor:["#4f46e5","#10b981"],borderWidth:0,hoverOffset:10}]
    },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:"68%",
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:"#1e1b4b",padding:12,callbacks:{
          label:ctx=>`₱${Number(ctx.raw).toLocaleString()} (${ctx.dataIndex===0?walkPct:onlinePct}%)`
        }}
      }
    }
  });
  if(legend) legend.innerHTML=`
    <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:#1e1b4b;">
      <span style="width:12px;height:12px;border-radius:50%;background:#4f46e5;display:inline-block;"></span>Walk-in ${walkPct}%
    </div>
    <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:#1e1b4b;">
      <span style="width:12px;height:12px;border-radius:50%;background:#10b981;display:inline-block;"></span>Online ${onlinePct}%
    </div>`;
}

// ── Return Analytics ──────────────────────────────────────────────────────
function updateReturnAnalytics(returnData){
  const box = document.getElementById("returnAnalyticsBox");
  if(!box) return;
  const entries = Object.entries(returnData).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(!entries.length){ box.innerHTML=""; return; }
  const max = Math.max(...entries.map(e=>e[1]),1);
  box.innerHTML=`
    <p style="font-weight:800;color:#64748b;font-size:13px;margin-bottom:10px;">📌 Most Returned Products</p>
    ${entries.map(([name,qty])=>`
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;color:#1e1b4b;margin-bottom:4px;">
          <span>${name}</span><span>${qty} returned</span>
        </div>
        <div style="height:8px;background:#f1f5f9;border-radius:999px;overflow:hidden;">
          <div style="height:100%;width:${(qty/max)*100}%;background:linear-gradient(90deg,#f59e0b,#ef4444);border-radius:999px;"></div>
        </div>
      </div>`).join("")}`;
}

function printReports(){

const printWindow =
window.open("", "", "width=1200,height=800");

const today =
new Date().toLocaleString();

const selectedDate =
document.getElementById("reportDate")?.value || "";

const printType =
document.getElementById("printType").value;

let content = "";

if(printType === "all"){
content =
document.querySelector(".daily-report-grid").outerHTML +
document.querySelector(".best-seller-grid").outerHTML;
}

if(printType === "daily"){
content =
document.querySelector(".daily-report-grid").outerHTML;
}

if(printType === "weekly"){
content =
document.querySelector("#weeklyBestSeller").parentElement.outerHTML;
}

if(printType === "monthly"){
content =
document.querySelector("#monthlyBestSeller").parentElement.outerHTML;
}

if(printType === "best"){
content =
document.querySelector(".best-seller-grid").outerHTML;
}

printWindow.document.write(`
<html>
<head>
<title>Ava Inventory Report</title>

<style>
*{
box-sizing:border-box;
}

body{
font-family:Arial,sans-serif;
padding:32px;
color:#111827;
background:white;
}

.print-header{
display:flex;
justify-content:space-between;
align-items:flex-start;
border-bottom:3px solid #4f46e5;
padding-bottom:18px;
margin-bottom:26px;
}

.print-title h1{
margin:0;
font-size:28px;
color:#1e1b4b;
}

.print-title p{
margin:6px 0 0;
color:#64748b;
font-weight:600;
}

.print-meta{
text-align:right;
font-size:13px;
color:#475569;
line-height:1.6;
}

.daily-report-grid,
.best-seller-grid{
display:grid;
grid-template-columns:1fr 1fr;
gap:16px;
}

.report-card,
.small-card{
border:1px solid #e5e7eb;
border-radius:14px;
padding:16px;
page-break-inside:avoid;
box-shadow:none;
background:white;
height:auto !important;
max-height:none !important;
overflow:visible !important;
}

.report-card h4,
.card-title{
font-size:17px;
margin:0 0 12px;
color:#1e1b4b;
border-bottom:1px solid #e5e7eb;
padding-bottom:10px;
}

.report-summary{
display:flex;
gap:8px;
margin-bottom:12px;
}

.report-summary span{
background:#eef2ff;
color:#4338ca;
padding:6px 10px;
border-radius:999px;
font-size:12px;
font-weight:800;
}

.report-item,
.best-seller-item{
border-bottom:1px solid #eef2f7;
padding:10px 0;
box-shadow:none;
background:white;
border-radius:0;
}

.report-item:last-child,
.best-seller-item:last-child{
border-bottom:none;
}

.report-top{
display:flex;
justify-content:space-between;
gap:10px;
}

.report-item b{
font-size:14px;
color:#111827;
}

.report-item small{
display:block;
font-size:12px;
color:#475569;
margin-top:3px;
}

.report-badge,
.timeline-badge{
border:1px solid #cbd5e1;
color:#334155 !important;
background:#f8fafc !important;
padding:4px 8px;
border-radius:999px;
font-size:10px;
font-weight:800;
}

.rank-badge{
display:inline-flex;
width:24px;
height:24px;
border-radius:50%;
background:#4f46e5;
color:white;
align-items:center;
justify-content:center;
font-weight:bold;
margin-right:8px;
}

.best-seller-item{
display:flex;
justify-content:space-between;
align-items:center;
}

.best-seller-left{
display:flex;
align-items:center;
gap:8px;
}

.best-seller-name{
font-weight:800;
}

.best-seller-qty{
font-weight:800;
color:#4338ca;
}

.report-empty{
border:1px dashed #cbd5e1;
border-radius:12px;
padding:18px;
text-align:center;
color:#94a3b8;
font-weight:700;
}

button,
select,
input,
.report-top > input,
#printType,
#printReportBtn,
.best-seller-filters,
.timeline-card,
.sales-trend-card,
.analytics-grid,
.ranking-panel,
.store-revenue-grid,
.report-kpi-grid,
.reports-hero{
display:none !important;
}

@media print{
body{
padding:18px;
}

.daily-report-grid,
.best-seller-grid{
grid-template-columns:1fr 1fr;
}

.report-card{
break-inside:avoid;
}
}
</style>

</head>

<body>

<div class="print-header">
<div class="print-title">
<h1>Ava Inventory Report</h1>
<p>Daily movement and best seller summary</p>
</div>

<div class="print-meta">
<div><b>Selected Date:</b> ${selectedDate || "All dates"}</div>
<div><b>Generated:</b> ${today}</div>
</div>
</div>

${content}

</body>
</html>
`);

printWindow.document.close();

setTimeout(()=>{
printWindow.print();
printWindow.close();
},500);

}



function updateBestSellerCard(data,nameId,qtyId){

const entries =
Object.entries(data)
.sort((a,b)=>b[1]-a[1]);

if(entries.length){

document.getElementById(nameId)
.textContent = entries[0][0];

document.getElementById(qtyId)
.textContent =
entries[0][1] + " sold";

}else{

document.getElementById(nameId)
.textContent = "-";

document.getElementById(qtyId)
.textContent = "0 sold";

}

}

// ── Recent Activity ───────────────────────────────────────────────────────────
function updateRecentActivity(){
  const el = document.getElementById("dbRecentActivity");
  if(!el) return;

  const records = (historyCache || []).slice(0, 5);

  if(!records.length){
    el.innerHTML = `<p style="color:#9ca3af;text-align:center;font-size:13px;padding:16px 0;">No recent activity</p>`;
    return;
  }

  const icons = {
    "add stock"   : "➕",
    "warehouse"   : "🚚",
    "walk"        : "💰",
    "online"      : "🌐",
    "return"      : "↩️"
  };

  el.innerHTML = records.map(r => {
    const remarks = String(r.remarks || "").toLowerCase();
    let icon = "📋";
    if(remarks.includes("add stock"))         icon = "➕";
    else if(remarks.includes("walk"))         icon = "💰";
    else if(remarks.includes("online"))       icon = "🌐";
    else if(remarks.includes("warehouse") && remarks.includes("store")) icon = "🚚";
    else if(remarks.includes("warehouse"))    icon = "↩️";

    return `
      <div class="db-activity-item">
        <div class="db-activity-icon">${icon}</div>
        <div class="db-activity-info">
          <span class="db-activity-product">${r.product || "-"}</span>
          <span class="db-activity-meta">${r.remarks || "-"}</span>
        </div>
        <div class="db-activity-right">
          <span class="db-activity-qty">×${r.qty}</span>
          <span class="db-activity-time">${String(r.datetime || "").split(",")[0] || "-"}</span>
        </div>
      </div>
    `;
  }).join("");
}
// ─────────────────────────────────────────────────────────────────────────────

async function updateStoreSalesToday(){

if(!document.getElementById("store1Sales")) return;

const records = historyCache;

let store1 = 0;
let store2 = 0;
let store3 = 0;

let store1Qty = 0;
let store2Qty = 0;
let store3Qty = 0;

const today =
new Date().toLocaleDateString();

records.forEach(item=>{

const itemDate =
new Date(item.datetime).toLocaleDateString();

const remarks =
String(item.remarks || "").toLowerCase();

const total =
Number(item.total) || 0;

if(itemDate !== today) return;

if(remarks.includes("store 1") && remarks.includes("walk")){
store1 += total;
store1Qty += Number(item.qty) || 0;
}

if(remarks.includes("store 2") && remarks.includes("walk")){
store2 += total;
store2Qty += Number(item.qty) || 0;
}

if(remarks.includes("store 3") && remarks.includes("walk")){
store3 += total;
store3Qty += Number(item.qty) || 0;
}

});

document.getElementById("store1Sales").textContent = "₱" + store1;
document.getElementById("store2Sales").textContent = "₱" + store2;
document.getElementById("store3Sales").textContent = "₱" + store3;

document.getElementById("store1ItemsSold").textContent = store1Qty;
document.getElementById("store2ItemsSold").textContent = store2Qty;
document.getElementById("store3ItemsSold").textContent = store3Qty;

  updateBranchRanking();

}

function updateStoreCards(products){

if(!document.getElementById("store1Count")) return;


let store1 = 0;
let store2 = 0;
let store3 = 0;

products.forEach(item=>{

const stock = Number(item.stock) || 0;

if(item.location === "Store 1") store1 += stock;
if(item.location === "Store 2") store2 += stock;
if(item.location === "Store 3") store3 += stock;

});

document.getElementById("store1Count").textContent = store1;
document.getElementById("store2Count").textContent = store2;
document.getElementById("store3Count").textContent = store3;

updateStoreStatus("store1Status", store1);
updateStoreStatus("store2Status", store2);
updateStoreStatus("store3Status", store3);

}

function updateStoreStatus(id, stock){

const el = document.getElementById(id);

if(stock <= 0){
el.textContent = "🔴 Out of Stock";
el.style.background = "#fee2e2";
el.style.color = "#991b1b";
}

else if(stock <= 5){
el.textContent = "🟡 Low Stock";
el.style.background = "#fef3c7";
el.style.color = "#92400e";
}

else{
el.textContent = "🟢 Healthy Stock";
el.style.background = "#dcfce7";
el.style.color = "#166534";
}

}

function updateBranchRanking(){

if(!document.getElementById("branchRanking")) return;

const s1 =
Number(
document.getElementById("store1Sales")
?.textContent.replace(/[₱,]/g,"")
) || 0;

const s2 =
Number(
document.getElementById("store2Sales")
?.textContent.replace(/[₱,]/g,"")
) || 0;

const s3 =
Number(
document.getElementById("store3Sales")
?.textContent.replace(/[₱,]/g,"")
) || 0;

const stores = [
{name:"Store 1", sales:s1},
{name:"Store 2", sales:s2},
{name:"Store 3", sales:s3}
];

stores.sort((a,b)=>b.sales-a.sales);

document.getElementById("branchRanking").innerHTML = `
<div class="rank-item">🥇 ${stores[0].name} - ₱${stores[0].sales}</div>
<div class="rank-item">🥈 ${stores[1].name} - ₱${stores[1].sales}</div>
<div class="rank-item">🥉 ${stores[2].name} - ₱${stores[2].sales}</div>
`;

const max =
Math.max(s1,s2,s3,1);

document.getElementById("barStore1").style.width =
(s1/max*100)+"%";

document.getElementById("barStore2").style.width =
(s2/max*100)+"%";

document.getElementById("barStore3").style.width =
(s3/max*100)+"%";

document.getElementById("barStore1Amount").textContent =
"₱"+s1;

document.getElementById("barStore2Amount").textContent =
"₱"+s2;

document.getElementById("barStore3Amount").textContent =
"₱"+s3;

}

function setTodayReportDate(){

const reportDate =
document.getElementById("reportDate");

if(!reportDate) return;

const today = new Date();

const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2,"0");
const dd = String(today.getDate()).padStart(2,"0");

reportDate.value =
`${yyyy}-${mm}-${dd}`;

}


function showReportLoader(){
document.getElementById("reportLoader").style.display = "flex";
}

function hideReportLoader(){
document.getElementById("reportLoader").style.display = "none";
}

async function reloadReportsWithLoader(){

showReportLoader();

try{

await loadDailyReports();
await loadBestSellers();
await loadSalesTrendChart();

}catch(error){

console.error("REPORT ERROR:", error);

showMessage(
error.message,
"error"
);

}finally{

hideReportLoader();

}

}

async function reloadBestSellersWithLoader(){

showReportLoader();

await loadBestSellers();
await loadSalesTrendChart();

setTimeout(()=>{
hideReportLoader();
},500);

}

function setButtonLoading(btn, loading=true){

if(!btn) return;

if(loading){

btn.dataset.originalText = btn.innerHTML;
btn.classList.add("is-loading");

}else{

btn.classList.remove("is-loading");

if(btn.dataset.originalText){
btn.innerHTML = btn.dataset.originalText;
}

}

}

function setButtonSuccess(btn, text="✓ Success"){

if(!btn) return;

btn.classList.remove("is-loading");
btn.classList.add("is-success");

const originalText =
btn.dataset.originalText || btn.innerHTML;

btn.innerHTML = text;

setTimeout(()=>{

btn.classList.remove("is-success");
btn.innerHTML = originalText;

},1200);

}

function setButtonError(btn, text="✕ Failed"){

if(!btn) return;

btn.classList.remove("is-loading");
btn.classList.add("is-error");

const originalText =
btn.dataset.originalText || btn.innerHTML;

btn.innerHTML = text;

setTimeout(()=>{

btn.classList.remove("is-error");
btn.innerHTML = originalText;

},1200);

}

function setCurrentBestSellerFilters(){

const monthInput =
document.getElementById("trendMonth");

const weekSelect =
document.getElementById("bestSellerWeek");

if(!monthInput || !weekSelect) return;

const today = new Date();

const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2,"0");

monthInput.value = `${yyyy}-${mm}`;

const currentWeek =
String(Math.ceil(today.getDate() / 7));

weekSelect.value = currentWeek;

}

function updateReportOverview(
store1Total,
store2Total,
store3Total,
store1Sales,
store2Sales,
store3Sales,
onlineTotal,
onlineSales,
onlineItemsSold
){

onlineTotal      = onlineTotal      || 0;
onlineSales      = onlineSales      || {};
onlineItemsSold  = onlineItemsSold  || 0;

// Revenue = walkin + online
const totalRevenue = store1Total + store2Total + store3Total + onlineTotal;

const allSales = {};
[store1Sales, store2Sales, store3Sales].forEach(store=>{
Object.entries(store).forEach(([product, qty])=>{
allSales[product] = (allSales[product] || 0) + qty;
});
});

const bestSeller = Object.entries(allSales).sort((a,b)=>b[1]-a[1])[0];

const storeData = [
{name:"Store 1", sales:store1Total, qty:Object.values(store1Sales).reduce((a,b)=>a+b,0)},
{name:"Store 2", sales:store2Total, qty:Object.values(store2Sales).reduce((a,b)=>a+b,0)},
{name:"Store 3", sales:store3Total, qty:Object.values(store3Sales).reduce((a,b)=>a+b,0)}
];

storeData.sort((a,b)=>b.sales-a.sales);

// ── Apply KPI Store Filter ──────────────────────────────────────────────────
const kf = _kpiStoreFilter || "all";

let kpiRev      = totalRevenue;
let kpiItems    = storeData.reduce((sum,s)=>sum+s.qty,0);
let kpiBest     = bestSeller ? bestSeller[0] : "-";
let kpiTop      = storeData[0].sales > 0 ? storeData[0].name : "-";
let kpiLabel    = "Walk-in + Online sales";

if(kf === "store 1"){
  kpiRev   = store1Total;
  kpiItems = storeData.find(s=>s.name==="Store 1").qty;
  const b  = Object.entries(store1Sales).sort((a,b)=>b[1]-a[1])[0];
  kpiBest  = b ? b[0] : "-";
  kpiTop   = "Store 1";
  kpiLabel = "Store 1 Walk-in sales";
} else if(kf === "store 2"){
  kpiRev   = store2Total;
  kpiItems = storeData.find(s=>s.name==="Store 2").qty;
  const b  = Object.entries(store2Sales).sort((a,b)=>b[1]-a[1])[0];
  kpiBest  = b ? b[0] : "-";
  kpiTop   = "Store 2";
  kpiLabel = "Store 2 Walk-in sales";
} else if(kf === "store 3"){
  kpiRev   = store3Total;
  kpiItems = storeData.find(s=>s.name==="Store 3").qty;
  const b  = Object.entries(store3Sales).sort((a,b)=>b[1]-a[1])[0];
  kpiBest  = b ? b[0] : "-";
  kpiTop   = "Store 3";
  kpiLabel = "Store 3 Walk-in sales";
} else if(kf === "online"){
  kpiRev   = onlineTotal;
  kpiItems = 0; // computed below
  kpiBest  = "-";
  kpiTop   = "-";
  kpiLabel = "Online sales only";
}
// ───────────────────────────────────────────────────────────────────────────

document.getElementById("reportRevenue").textContent = "₱" + totalRevenue.toLocaleString();
document.getElementById("reportBestSeller").textContent = bestSeller ? `${bestSeller[0]} (${bestSeller[1]} sold)` : "-";
document.getElementById("reportTopStore").textContent = storeData[0].sales > 0 ? storeData[0].name : "-";

const totalItemsSold = storeData.reduce((sum,s)=>sum+s.qty,0);
document.getElementById("reportItemsSold").textContent = totalItemsSold;

document.getElementById("kpiRevenue").textContent    = "₱" + Number(kpiRev).toLocaleString();
document.getElementById("kpiItemsSold").textContent  = kf === "online" ? Number(onlineItemsSold) : Number(kpiItems);
document.getElementById("kpiBestSeller").textContent = kpiBest;
document.getElementById("kpiTopStore").textContent   = kpiTop;
const kpiLabelEl = document.getElementById("kpiRevenueLabel");
if(kpiLabelEl) kpiLabelEl.textContent = kpiLabel;

animateNumber("reportStore1Sales", store1Total, "₱");
animateNumber("reportStore2Sales", store2Total, "₱");
animateNumber("reportStore3Sales", store3Total, "₱");

document.getElementById("reportStore1Qty").textContent = storeData.find(s=>s.name==="Store 1").qty + " items sold";
document.getElementById("reportStore2Qty").textContent = storeData.find(s=>s.name==="Store 2").qty + " items sold";
document.getElementById("reportStore3Qty").textContent = storeData.find(s=>s.name==="Store 3").qty + " items sold";

const max = Math.max(store1Total, store2Total, store3Total, 1);

// ── Dynamic progress bars ──
document.getElementById("store1Progress").style.width = (store1Total/max*100)+"%";
document.getElementById("store2Progress").style.width = (store2Total/max*100)+"%";
document.getElementById("store3Progress").style.width = (store3Total/max*100)+"%";

// ── Dynamic rank badges (fix hardcoded) ──
const medals = ["🥇","🥈","🥉"];
storeData.forEach((store, index)=>{
  const num = store.name.replace("Store ","");
  const el  = document.getElementById("storeRank"+num);
  if(el) el.textContent = medals[index];
});

// ── Store ranking panel ──
document.getElementById("reportStoreRanking").innerHTML =
storeData.map((store,index)=>`
<div class="ranking-row">
  <div class="ranking-top">
    <span>${medals[index]} ${store.name}</span>
    <span>₱${store.sales.toLocaleString()}</span>
  </div>
  <div class="ranking-bar">
    <div style="width:${(store.sales / max) * 100}%"></div>
  </div>
</div>
`).join("");

// ── Online Sales Section ───────────────────────────────────────────────────
updateOnlineSalesSection(onlineSales, onlineTotal);

}

// ── Online Sales Section ──────────────────────────────────────────────────────
function updateOnlineSalesSection(onlineSales, onlineTotal){
  const revenueEl  = document.getElementById("onlineRevenue");
  const itemsEl    = document.getElementById("onlineItemsSold");
  const bestEl     = document.getElementById("onlineBestSeller");
  const listEl     = document.getElementById("onlineBestSellerList");

  const totalItems = Object.values(onlineSales).reduce((a,b)=>a+b,0);
  const sorted     = Object.entries(onlineSales).sort((a,b)=>b[1]-a[1]);
  const top        = sorted[0];

  if(revenueEl) revenueEl.textContent = "₱" + onlineTotal.toLocaleString();
  if(itemsEl)   itemsEl.textContent   = totalItems;
  if(bestEl)    bestEl.textContent    = top ? top[0] : "-";

  if(listEl){
    if(!sorted.length){
      listEl.innerHTML = `<div class="report-empty">No online sales in this period</div>`;
      return;
    }
    const medals = ["🥇","🥈","🥉","4️⃣","5️⃣"];
    listEl.innerHTML = sorted.slice(0,5).map(([name, qty], i)=>`
      <div class="best-seller-item">
        <div class="best-seller-left">
          <div class="rank-badge">${medals[i] || (i+1)}</div>
          <div class="best-seller-name">${name}</div>
        </div>
        <div class="best-seller-qty">${qty} sold</div>
      </div>
    `).join("");
  }
}
// ─────────────────────────────────────────────────────────────────────────────

function animateNumber(id, target, prefix=""){

const el =
document.getElementById(id);

if(!el) return;

let start = 0;
const duration = 700;
const startTime = performance.now();

function update(now){

const progress =
Math.min((now - startTime) / duration, 1);

const value =
Math.floor(start + (target - start) * progress);

el.textContent =
prefix + value.toLocaleString();

if(progress < 1){
requestAnimationFrame(update);
}

}

requestAnimationFrame(update);

}

function updateTopAnalytics(data, boxId){

const box =
document.getElementById(boxId);

if(!box) return;

const entries =
Object.entries(data)
.sort((a,b)=>b[1]-a[1])
.slice(0,5);

if(entries.length === 0){

box.innerHTML =
`<div class="report-empty">No records</div>`;

return;

}

const max =
Math.max(...entries.map(item=>item[1]),1);

box.innerHTML =
entries.map(([name, qty], index)=>`
<div class="analytics-row">
  <div class="analytics-top">
    <span>${index + 1}. ${name}</span>
    <span>${qty} sold</span>
  </div>
  <div class="analytics-bar">
    <div style="width:${(qty / max) * 100}%"></div>
  </div>
</div>
`).join("");

}

async function loadSalesTrendChart(){

const records = historyCache;

const monthInput =
document.getElementById("bestSellerMonth");

const selectedMonth =
monthInput ? monthInput.value : "";

const trendStore =
document.getElementById("trendStoreFilter");

const storeFilter =
trendStore ? trendStore.value : "";

const trendData = {};

records.forEach(item=>{

const remarks =
String(item.remarks || "").toLowerCase();

if(!remarks.includes("walk")) return;

if(storeFilter){
if(!remarks.includes(storeFilter.toLowerCase())) return;
}

const dateObj =
new Date(item.datetime || item.date);

const month =
dateObj.toISOString().slice(0,7);

if(selectedMonth && month !== selectedMonth) return;

const day =
dateObj.toISOString().slice(5,10);

trendData[day] =
(trendData[day] || 0) + (Number(item.total) || 0);

});

const labels =
Object.keys(trendData).sort();

const values =
labels.map(day => trendData[day]);

const canvas =
document.getElementById("salesTrendChart");

if(!canvas) return;

if(salesTrendChart){
salesTrendChart.destroy();
}

const ctx =
canvas.getContext("2d");

const gradient =
ctx.createLinearGradient(0,0,0,320);

gradient.addColorStop(0,"rgba(79,70,229,.35)");
gradient.addColorStop(1,"rgba(79,70,229,0)");

salesTrendChart =
new Chart(ctx,{
type:"line",
data:{
labels,
datasets:[{
label:"Revenue",
data:values,
fill:true,
backgroundColor:gradient,
borderColor:"#4f46e5",
borderWidth:4,
tension:.45,
pointRadius:5,
pointHoverRadius:8,
pointBackgroundColor:"#4f46e5"
}]
},
options:{
responsive:true,
maintainAspectRatio:false,
plugins:{
legend:{
display:false
},
tooltip:{
backgroundColor:"#1e1b4b",
padding:14,
callbacks:{
label:function(context){
return "₱" + Number(context.raw).toLocaleString();
}
}
}
},
scales:{
x:{
grid:{
display:false
}
},
y:{
beginAtZero:true,
ticks:{
callback:function(value){
return "₱" + Number(value).toLocaleString();
}
},
grid:{
color:"rgba(15,23,42,.06)"
}
}
}
}
});

}

async function reloadSalesTrendWithLoader(){

showReportLoader();

try{

await loadSalesTrendChart();

}catch(error){

console.error("SALES TREND ERROR:", error);

showMessage(
"May error sa pag-load ng Sales Trend.",
"error"
);

}finally{

setTimeout(()=>{
hideReportLoader();
},500);

}

}

async function loadTransactionTimeline(){

const records = historyCache;

const box =
document.getElementById("transactionTimeline");

if(!box) return;

if(records.length === 0){

box.innerHTML =
`<div class="report-empty">No records</div>`;

return;

}

const latest =
records
.slice()
.sort((a,b)=>
new Date(b.datetime || b.date) -
new Date(a.datetime || a.date)
)
.slice(0,10);

box.innerHTML =
`<div class="timeline-list">` +
latest.map(item=>{

const remarks =
String(item.remarks || "");

const lower =
remarks.toLowerCase();

let icon = "📦";
let badgeClass = "badge-stock";
let badgeText = "Stock";

if(lower.includes("walk") || lower.includes("online")){
icon = "💰";
badgeClass = "badge-sale";
badgeText = "Sale";
}

if(lower.includes("warehouse") && lower.includes("store")){
icon = "🚚";
badgeClass = "badge-transfer";
badgeText = "Transfer";
}

if(lower.includes("warehouse") && lower.includes("online")){
icon = "💻";
badgeClass = "badge-sale";
badgeText = "Online";
}

const dateObj =
new Date(item.datetime || item.date);

const timeText =
dateObj.toLocaleString();

return `
<div class="timeline-item">

<div class="timeline-top">
<div class="timeline-title">
${icon} ${item.product || "Unknown Product"}
</div>
<div class="timeline-time">
${timeText}
</div>
</div>

<div class="timeline-details">
${item.barcode || "-"}<br>
Qty: ${item.qty || 0}
${item.total ? `<br>Total: ₱${Number(item.total).toLocaleString()}` : ""}
<br>${remarks}
</div>

<span class="timeline-badge ${badgeClass}">
${badgeText}
</span>

</div>
`;

}).join("") +
`</div>`;

}

function updateReportSummary(prefix, data){

const qtyEl =
document.getElementById(prefix + "Qty");

const totalEl =
document.getElementById(prefix + "Total") ||
document.getElementById(prefix + "SummaryTotal");

if(qtyEl){
qtyEl.textContent = data.qty;
}

if(totalEl){
totalEl.textContent =
"₱" + Number(data.total).toLocaleString();
}

}


let soldItemsData = [];

async function loadSoldItems(){

  const records = historyCache;

  soldItemsData =
  records.filter(item=>{

    const remarks =
    String(item.remarks || "").toLowerCase();

    return (
      remarks.includes("walk") ||
      remarks.includes("online")
    );

  });

  renderSoldItems(soldItemsData);

}

function renderSoldItems(data){

  const table =
  document.getElementById("soldItemsTable");

  if(!table) return;

  if(data.length === 0){

    table.innerHTML =
    `<tr>
      <td colspan="8">No sold items found.</td>
    </tr>`;

    return;
  }

  let html = "";

  data.forEach(item=>{

    const remarks =
    String(item.remarks || "");

    html += `
      <tr>
        <td>${item.datetime || item.date || ""}</td>
        <td>${item.barcode || ""}</td>
        <td><b>${item.product || ""}</b></td>
        <td>${item.color || ""}</td>
        <td>${item.size || ""}</td>
        <td>${item.qty || 0}</td>
        <td>₱${Number(item.total || 0).toLocaleString()}</td>
        <td>${remarks}</td>
      </tr>
    `;

  });

  table.innerHTML = html;

}

function filterSoldItems(){

const keyword =
document.getElementById("soldSearchInput")
.value
.toLowerCase();

const type =
document.getElementById("soldTypeFilter").value;

const location =
document.getElementById("soldLocationFilter")
.value
.toLowerCase();

const dateFrom =
document.getElementById("soldDateFrom").value;

const dateTo =
document.getElementById("soldDateTo").value;

let filtered =
soldItemsData.filter(item=>{

const text =
[
item.datetime,
item.barcode,
item.product,
item.color,
item.size,
item.qty,
item.total,
item.remarks
]
.join(" ")
.toLowerCase();

const remarks =
String(item.remarks || "").toLowerCase();

const searchMatch =
text.includes(keyword);

let typeMatch = true;
let locationMatch = true;
let dateMatch = true;

if(type === "walk"){
typeMatch = remarks.includes("walk");
}

if(type === "online"){
typeMatch = remarks.includes("online");
}

if(location){
locationMatch =
remarks.includes(location);
}

const itemDate =
new Date(item.datetime || item.date);

if(dateFrom){
const from =
new Date(dateFrom);
dateMatch = dateMatch && itemDate >= from;
}

if(dateTo){
const to =
new Date(dateTo);
to.setHours(23,59,59,999);
dateMatch = dateMatch && itemDate <= to;
}

      return searchMatch &&
       typeMatch &&
       locationMatch &&
       dateMatch;

});

renderSoldItems(filtered);

}


window.onload = async () => {

  if(localStorage.getItem("avaLoggedIn") === "true"){
    document.getElementById("loginScreen").style.display = "none";
    if(localStorage.getItem("avaRole") === "user"){
      showPosScreen();
      return;
    }
  }

  const trendMonth =
  document.getElementById("trendMonth");

  if(trendMonth){
    trendMonth.value =
    new Date().toISOString().slice(0,7);
  }

  setTodayReportDate();
  setCurrentBestSellerFilters();

  // Initialize date range to today
  const todayStr = formatDate(new Date());
  _activeDateRange = { from: todayStr, to: todayStr };

  updateClock();
  setInterval(updateClock,1000);

await loadHistoryCache();
await showTab("dashboard");

};





// ── POS System ───────────────────────────────────────────────────────────────
let posCart = [];
let posStoreProducts = [];

function showPosScreen(){
  const store = localStorage.getItem("avaStore") || "Store 1";
  const user  = localStorage.getItem("avaUser")  || "";

  document.getElementById("posScreen").style.display = "block";
  document.getElementById("posStoreName").textContent = store;
  document.getElementById("posWelcome").textContent = "Hi, " + user + " 👋";

  // Update history store name too
  const histName = document.getElementById("posHistoryStoreName");
  if(histName) histName.textContent = store;

  // Set today's date on history date picker
  const histDate = document.getElementById("posHistoryDate");
  if(histDate) histDate.value = new Date().toISOString().split("T")[0];

  // Hide admin layout
  document.querySelector(".layout").style.display = "none";

  loadPosStocks();
  loadPosSalesStats();

  setTimeout(()=>{
    const inp = document.getElementById("posBarcodeInput");
    if(inp) inp.focus();
  }, 200);

  updatePosClock();
  setInterval(updatePosClock, 1000);
}

// ── POS Tab Switching ────────────────────────────────────────────────────────
function showPosTab(tab){
  document.querySelectorAll(".pos-tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".pos-tab-content").forEach(c => c.style.display = "none");

  if(tab === "pos"){
    document.getElementById("posTab").style.display = "block";
    document.querySelectorAll(".pos-tab-btn")[0].classList.add("active");
    setTimeout(()=>{
      const inp = document.getElementById("posBarcodeInput");
      if(inp) inp.focus();
    }, 100);
  } else if(tab === "history"){
    document.getElementById("posHistoryTab").style.display = "block";
    document.querySelectorAll(".pos-tab-btn")[1].classList.add("active");
    loadPosHistory();
  }
}

// ── POS History ───────────────────────────────────────────────────────────────
let _posHistoryData = [];

async function loadPosHistory(){
  const store    = localStorage.getItem("avaStore") || "Store 1";
  const dateEl   = document.getElementById("posHistoryDate");
  const date     = dateEl ? dateEl.value : "";
  const tbody    = document.getElementById("posHistoryTableBody");

  if(tbody){
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#aaa;padding:24px;">Loading...</td></tr>`;
  }

  // Use cached history if available, otherwise fetch
  let history = historyCache || [];
  if(!history.length){
    const result = await apiRequest("getHistory");
    history = result.records || [];
  }

  // Filter by store and date
  _posHistoryData = history.filter(item => {
    const remarks = String(item.remarks || "").toLowerCase();
    const matchStore = remarks.includes(store.toLowerCase());

    if(!matchStore) return false;

    if(date){
      const itemDate = new Date(item.datetime || item.date)
        .toISOString().split("T")[0];
      return itemDate === date;
    }

    return true;
  });

  renderPosHistory(_posHistoryData);
}

function renderPosHistory(records){
  const tbody = document.getElementById("posHistoryTableBody");
  if(!tbody) return;

  // Update summary cards
  const total = records.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const items = records.reduce((s, r) => s + (Number(r.qty)   || 0), 0);

  const totalEl = document.getElementById("posHistoryTotal");
  const itemsEl = document.getElementById("posHistoryItems");
  const transEl = document.getElementById("posHistoryTrans");

  if(totalEl) totalEl.textContent = "₱ " + total.toLocaleString("en-PH", {minimumFractionDigits:2});
  if(itemsEl) itemsEl.textContent = items;
  if(transEl) transEl.textContent = records.length;

  if(!records.length){
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#aaa;padding:32px;">No transactions found</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => `
    <tr>
      <td style="white-space:nowrap;font-size:12px;color:#6b7280;">${r.datetime || "-"}</td>
      <td style="font-size:12px;color:#818cf8;">${r.barcode || "-"}</td>
      <td><strong>${r.product || "-"}</strong></td>
      <td>${r.color || "-"}</td>
      <td>${r.size  || "-"}</td>
      <td style="text-align:center;font-weight:700;">${r.qty || 0}</td>
      <td>₱ ${Number(r.price || 0).toLocaleString("en-PH", {minimumFractionDigits:2})}</td>
      <td style="font-weight:700;color:#059669;">₱ ${Number(r.total || 0).toLocaleString("en-PH", {minimumFractionDigits:2})}</td>
    </tr>
  `).join("");
}

function filterPosHistory(){
  const query = (document.getElementById("posHistorySearch")?.value || "").toLowerCase();
  if(!query){
    renderPosHistory(_posHistoryData);
    return;
  }
  const filtered = _posHistoryData.filter(r =>
    String(r.product || "").toLowerCase().includes(query) ||
    String(r.barcode || "").toLowerCase().includes(query) ||
    String(r.color   || "").toLowerCase().includes(query) ||
    String(r.size    || "").toLowerCase().includes(query)
  );
  renderPosHistory(filtered);
}
// ─────────────────────────────────────────────────────────────────────────────

function updatePosClock(){
  const el = document.getElementById("posClock");
  if(!el) return;
  el.textContent = new Date().toLocaleTimeString("en-PH", {
    hour:"2-digit", minute:"2-digit", second:"2-digit"
  });
}

async function loadPosStocks(){
  const store = localStorage.getItem("avaStore") || "Store 1";
  const result = await apiRequest("getStoreProducts", { store });
  posStoreProducts = result.products || [];
  filterPosStocks();
}

let _posStockFilter = "all";

function setPosFilter(filter, btn){
  _posStockFilter = filter;
  document.querySelectorAll(".pos-filter-btn").forEach(b => b.classList.remove("active"));
  if(btn) btn.classList.add("active");
  filterPosStocks();
}

function filterPosStocks(){
  const query  = (document.getElementById("posStockSearch")?.value || "").toLowerCase();
  const filter = _posStockFilter;

  let filtered = posStoreProducts.filter(p => {
    const qty = Number(p.storeQty || p.qty || 0);
    const matchSearch =
      p.product.toLowerCase().includes(query) ||
      String(p.barcode).toLowerCase().includes(query) ||
      String(p.color || "").toLowerCase().includes(query) ||
      String(p.size  || "").toLowerCase().includes(query);

    const matchFilter =
      filter === "all" ? true :
      filter === "out" ? qty === 0 :
      filter === "low" ? qty > 0 && qty <= 5 :
      filter === "in"  ? qty > 5 : true;

    return matchSearch && matchFilter;
  });

  renderPosStocks(filtered);
}

function renderPosStocks(products){
  const list = document.getElementById("posStockList");
  if(!list) return;

  if(!products || products.length === 0){
    list.innerHTML = `<p style="color:#aaa;text-align:center;padding:16px;">No products found</p>`;
    return;
  }

  list.innerHTML = products.map(p => {
    const qty        = Number(p.storeQty || p.qty || 0);
    const badgeClass = qty === 0 ? "out" : qty <= 5 ? "low" : "";
    const color      = p.color ? p.color : "";
    const size       = p.size  ? p.size  : "";
    const meta       = [color, size].filter(Boolean).join(" · ");

    return `
      <div class="pos-stock-item">
        <div class="pos-stock-row">
          <span style="color:#e0e7ff;font-weight:600;font-size:13px;">${p.product}</span>
          <span class="pos-stock-badge ${badgeClass}">${qty}</span>
        </div>
        ${meta ? `<div class="pos-stock-meta">${meta}</div>` : ""}
        <div class="pos-stock-meta" style="color:#818cf8;font-size:11px;">${p.barcode}</div>
      </div>
    `;
  }).join("");
}

async function loadPosSalesStats(){
  const store = localStorage.getItem("avaStore") || "Store 1";
  const today = new Date().toLocaleDateString("en-PH");

  const result = await apiRequest("getSalesStats", { store, date: today });

  const salesToday   = result.salesToday   || 0;
  const transToday   = result.transToday   || 0;
  const itemsSold    = result.itemsSold     || 0;

  document.getElementById("posSalesToday").textContent    = "₱ " + Number(salesToday).toLocaleString("en-PH", {minimumFractionDigits:2});
  document.getElementById("posTransToday").textContent    = transToday;
  document.getElementById("posItemsSoldToday").textContent = itemsSold;
}

function addToPosCart(){
  const field   = document.getElementById("posBarcodeInput");
  const barcode = cleanDuplicateBarcode(field.value).trim();

  if(!barcode) return;

  // Find in store products
  const found = posStoreProducts.find(p =>
    String(p.barcode).trim() === barcode
  );

  // Block if not found in store
  if(!found){
    showMessage("Barcode not found in this store.", "warning");
    field.value = "";
    field.focus();
    return;
  }

  // Block if no stock
  const availableStock = Number(found.storeQty || found.qty || 0);
  if(availableStock <= 0){
    showMessage(`${found.product} is out of stock!`, "warning");
    field.value = "";
    field.focus();
    return;
  }

  // If already in cart, check if adding more exceeds stock
  const existing = posCart.find(i => i.barcode === barcode);
  if(existing){
    if(existing.qty >= availableStock){
      showMessage(`Only ${availableStock} available for ${found.product}.`, "warning");
      field.value = "";
      field.focus();
      return;
    }
    existing.qty += 1;
    renderPosCart();
    field.value = "";
    field.focus();
    return;
  }

  posCart.push({
    barcode,
    product      : found.product,
    color        : found.color  || "",
    size         : found.size   || "",
    price        : Number(found.price || 0),
    qty          : 1,
    maxQty       : availableStock
  });

  renderPosCart();
  field.value = "";
  field.focus();
}

function renderPosCart(){
  const tbody = document.getElementById("posCartTable");
  if(!tbody) return;

  if(posCart.length === 0){
    tbody.innerHTML = `<tr id="posCartEmpty"><td colspan="6" style="text-align:center;color:#aaa;padding:32px;">Scan a barcode to start</td></tr>`;
    updatePosTotals();
    return;
  }

  tbody.innerHTML = posCart.map((item, i) => `
    <tr>
      <td style="color:#9ca3af;">${i + 1}</td>
      <td>
        <strong>${item.product}</strong>
        ${item.color || item.size ? `<br><small style="color:#9ca3af;">${[item.color, item.size].filter(Boolean).join(" · ")}</small>` : ""}
        <br><small style="color:#c4b5fd;">${item.barcode}</small>
      </td>
      <td>₱ ${item.price.toLocaleString("en-PH", {minimumFractionDigits:2})}</td>
      <td>
        <input type="number" min="1" max="${item.maxQty}" value="${item.qty}" class="pos-qty-input"
          onchange="updatePosCartQty(${i}, this.value)">
        <div style="font-size:11px;color:#9ca3af;">max: ${item.maxQty}</div>
      </td>
      <td>₱ ${(item.price * item.qty).toLocaleString("en-PH", {minimumFractionDigits:2})}</td>
      <td>
        <button onclick="removePosCartItem(${i})"
          style="background:#ef4444;color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;">✕</button>
      </td>
    </tr>
  `).join("");

  updatePosTotals();
}

function updatePosCartQty(index, value){
  const newQty = Math.max(1, Number(value));
  const maxQty = posCart[index].maxQty;
  if(newQty > maxQty){
    showMessage(`Only ${maxQty} available in store.`, "warning");
    posCart[index].qty = maxQty;
  } else {
    posCart[index].qty = newQty;
  }
  renderPosCart();
}

function removePosCartItem(index){
  posCart.splice(index, 1);
  renderPosCart();
}

function clearPosCart(){
  if(posCart.length === 0) return;
  if(!confirm("Clear all items in cart?")) return;
  posCart = [];
  renderPosCart();
}

function updatePosTotals(){
  const totalItems  = posCart.reduce((s, i) => s + i.qty, 0);
  const totalAmount = posCart.reduce((s, i) => s + (i.price * i.qty), 0);

  document.getElementById("posTotalItems").textContent  = totalItems;
  document.getElementById("posTotalAmount").textContent =
    totalAmount.toLocaleString("en-PH", {minimumFractionDigits:2});
}

async function posCheckout(){
  if(posCart.length === 0){
    showMessage("Cart is empty.", "warning");
    return;
  }

  // Final stock check before checkout
  for(const item of posCart){
    const found = posStoreProducts.find(p => String(p.barcode).trim() === item.barcode);
    const available = found ? Number(found.storeQty || found.qty || 0) : 0;
    if(available <= 0){
      showMessage(`${item.product} is out of stock! Please remove it from cart.`, "warning");
      return;
    }
    if(item.qty > available){
      showMessage(`Only ${available} available for ${item.product}. Please adjust quantity.`, "warning");
      return;
    }
  }

  const store     = localStorage.getItem("avaStore") || "Store 1";
  const btn       = document.getElementById("posCheckoutBtn");
  const origText  = btn.innerHTML;
  btn.innerHTML   = "Processing...";
  btn.disabled    = true;

  let hasError = false;

  for(const item of posCart){
    const result = await apiRequest("stockOut", {
      barcode    : item.barcode,
      qty        : item.qty,
      remarks    : store + " - Walk-in Sales",
      deductFrom : store
    });

    if(result.message && result.message.includes("Not enough")){
      showMessage("Not enough stock: " + item.product, "error");
      hasError = true;
    }
  }

  if(!hasError){
    showMessage("Checkout successful!", "success");
    posCart = [];
    renderPosCart();
    await loadPosStocks();
    await loadPosSalesStats();
  }

  btn.innerHTML = origText;
  btn.disabled  = false;

  const inp = document.getElementById("posBarcodeInput");
  if(inp) inp.focus();
}
// ─────────────────────────────────────────────────────────────────────────────

async function loginUser() {
const btn =
document.getElementById("loginbtn");

btn.classList.add("btn-loading");

const originalText =
btn.innerHTML;

btn.innerHTML = "Processing...";
  
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  const result = await apiRequest("login", {
    username,
    password
  });

  if (result.success) {

    localStorage.setItem("avaLoggedIn", "true");
    localStorage.setItem("avaUser",  result.username || username);
    localStorage.setItem("avaRole",  result.role     || "admin");
    localStorage.setItem("avaStore", result.store    || "");

    document.getElementById("loginScreen").style.display = "none";

    if(result.role === "user"){
      showPosScreen();
    }

} else {

    showMessage("Wrong username or password");

}

  btn.classList.remove("btn-loading");

  btn.innerHTML = originalText;
}

  

function logoutUser() {
const btn =
document.getElementById("logoutbtn");

btn.classList.add("btn-loading");

const originalText =
btn.innerHTML;

btn.innerHTML = "Processing...";
  
  const confirmLogout =
  confirm("Are you sure you want to log out?");

  if (!confirmLogout) {

    btn.classList.remove("btn-loading");
    btn.innerHTML = originalText;
    return;
  }

  localStorage.removeItem("avaLoggedIn");
  localStorage.removeItem("avaUser");
  localStorage.removeItem("avaRole");
  localStorage.removeItem("avaStore");

  // Hide POS if showing
  const posScreen = document.getElementById("posScreen");
  if(posScreen) posScreen.style.display = "none";

  // Show admin layout back
  const layout = document.querySelector(".layout");
  if(layout) layout.style.display = "grid";

  document.getElementById(
    "loginScreen"
  ).style.display = "flex";

  document.getElementById(
    "username"
  ).value = "";

  document.getElementById(
    "password"
  ).value = "";

  btn.classList.remove("btn-loading");

  btn.innerHTML = originalText;

}
