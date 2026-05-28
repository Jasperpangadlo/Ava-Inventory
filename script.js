let stockChart = null;
let weeklyStockChart = null;
let allProducts = [];
let storeProducts = [];

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw6K3N58inD_aZdmVA6yilTyxSSEE34ng_GXNviFvDTBLdXocmhBppWeCv4U9bcKr-3/exec";

async function apiRequest(action, payload = {}) {

const params = new URLSearchParams({
action,
data: JSON.stringify(payload)
});

const response =
await fetch(
`${WEB_APP_URL}?${params}`
);

return await response.json();

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

  resetPreview();
  
  loadProducts();
  document.getElementById("barcode").value = "";
  
  document.getElementById("barcode").focus();
  
}

async function loadProducts() {
  const result = await apiRequest("getProducts");
  const products = result.products || [];
  allProducts = products;
  const table = document.getElementById("productTable");

  table.innerHTML = "";

  let totalStock = 0;
  let lowStock = 0;
  let outStock = 0;

  if (products.length === 0) {
    table.innerHTML = "<tr><td colspan='8'>Wala pang products sa database.</td></tr>";
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

    table.innerHTML += `
      <tr>
        <td>${item.barcode}</td>
        <td>${item.product}</td>
        <td>${item.category}</td>
        <td>${item.color}</td>
        <td>${item.size}</td>
        <td>${item.stock}</td>
        <td>₱${item.price}</td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
      </tr>
    `;
  });

  document.getElementById("totalProducts").textContent = products.length;
  document.getElementById("totalStock").textContent = totalStock;
  document.getElementById("lowStock").textContent = lowStock;
  document.getElementById("outStock").textContent = outStock;

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

async function stockOut() {
  const barcode = document.getElementById("outBarcode").value.trim();
  const qty = Number(document.getElementById("outQty").value);

  const deductFrom =
  document.getElementById("deductFrom").value;

  const salesType =
  document.getElementById("salesType").value;

  if (!barcode || !qty) {
    showMessage(
      "Please input barcode and quantity out.",
      "warning"
    );
    return;
}

if(!deductFrom || !salesType){
    showMessage(
      "Please select sales destination",
      "warning"
    );
    return;
}

  let remarks="";

  if(deductFrom==="Warehouse"){
      remarks =
      "Warehouse - " + salesType;
  } else {
      remarks =
      "Store - Walk-in";
  }

  const result = await apiRequest("stockOut", {
    barcode,
    qty,
    remarks,
    deductFrom

  });

  if(result.message.includes("Not enough")){
  showMessage(result.message, "error");
}else{
  showMessage(result.message, "success");

  loadProducts();
  loadHistory();
  loadDailyReports();
  loadBestSellers();

document.getElementById("outBarcode").value = "";
document.getElementById("outQty").value = "";
document.getElementById("deductFrom").selectedIndex = 0;
document.getElementById("salesType").selectedIndex = 0;
document.getElementById("outBarcode").focus();
}
}

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
  const result = await apiRequest("getHistory");
  const records = result.records || [];
  const table = document.getElementById("historyTable");

  table.innerHTML = "";

  if (records.length === 0) {
    table.innerHTML = "<tr><td colspan='9'>No stock out history yet.</td></tr>";
    return;
  }

  records.forEach(item => {
    table.innerHTML += `
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
}

function showTab(tabId){
  const tabs = document.querySelectorAll(".tab-content");

  tabs.forEach(tab=>{
    tab.style.display="none";
  });

  document.getElementById(tabId).style.display="block";

  const links = document.querySelectorAll("aside a");

  links.forEach(link=>{
    link.classList.remove("active");
  });

  const activeLink = document.querySelector(
    `aside a[onclick="showTab('${tabId}')"]`
  );

  if(activeLink){
    activeLink.classList.add("active");
  }

  if(tabId === "add-stock"){
  setTimeout(() => {
    document.getElementById("barcode").focus();
  }, 100);
}
}


async function loadStoreProducts() {
  const result = await apiRequest("getStoreInventory");
  const products = result.products || [];

  storeProducts = products;

  const table = document.getElementById("storeTable");
  table.innerHTML = "";

  if (products.length === 0) {
    table.innerHTML =
    "<tr><td colspan='6'>No store products yet.</td></tr>";
    return;
  }

  products.forEach(item => {
    const stock = Number(item.stock) || 0;

    let stockBadge = "";

    if (stock <= 0) {
      stockBadge = `<span class="stock-out">❌ Out</span>`;
    } else if (stock <= 5) {
      stockBadge = `<span class="stock-low">⚠️ Low</span>`;
    } else {
      stockBadge = `<span class="stock-ok">✔ In Stock</span>`;
    }

    table.innerHTML += `
      <tr data-stock="${stock}">
        <td>${item.barcode}</td>
        <td>${item.product}</td>
        <td>${item.color}</td>
        <td>${item.size}</td>
        <td><span class="stock-number">${stock}</span>${stockBadge}</td>
        <td>
          <span class="location-tag">
            🏪 ${item.location}
          </span>
        </td>
      </tr>
    `;
  });

  populateStoreFilters(products);
  filterStoreProducts();
}


async function sendToStore(){

const barcode=
document.getElementById(
"transferBarcode"
).value.trim();

const store=
document.getElementById(
"toStore"
).value;

const qty=
Number(
document.getElementById(
"transferQty"
).value
);

if(!barcode || !qty){

showMessage(
"Please input barcode and quantity."
);

return;

}

const result=
await apiRequest(
"sendToStore",
{
barcode,
store,
qty
}
);

showSuccess(result.message);

loadProducts();
loadStoreProducts();
loadHistory();

document.getElementById(
"transferBarcode"
).value = "";

document.getElementById(
"transferQty"
).value = "";

document.getElementById(
"toStore"
).selectedIndex = 0;

document.getElementById(
"transferBarcode"
).focus();

}




function filterStoreProducts(){

  populateStoreFilters(storeProducts);

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

const barcode=
document.getElementById(
"returnBarcode"
).value.trim();

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

showMessage(
"Please input barcode and quantity."
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

showSuccess(result.message);

document.getElementById(
"returnBarcode"
).value="";

document.getElementById(
"returnQty"
).value="";

loadProducts();
loadStoreProducts();
loadHistory();
  
}

async function refreshAllData() {
  await loadProducts();
  await loadHistory();
  await loadStoreProducts();
  await loadWeeklyStockChart();
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
  const result = await apiRequest("getHistory");
  const records = result.records || [];

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
      
        document.getElementById("previewPrice").innerText =
          "Price: ₱" + (document.getElementById("price").value || "-");
      
        document.getElementById("previewStock").innerText =
          "Stock: " + (document.getElementById("stock").value || "-");

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
  const item = {
    barcode: cleanDuplicateBarcode(document.getElementById("barcode").value),
    product: document.getElementById("product").value.trim(),
    category: document.getElementById("category").value,
    color: document.getElementById("color").value.trim(),
    size: document.getElementById("size").value.trim(),
    stock: Number(document.getElementById("stock").value),
    price: Number(document.getElementById("price").value)
  };

  if (!item.barcode || !item.product || !item.stock) {
    showMessage("Please input barcode, product name, and quantity.");
    return;
  }

  const existingItem = stockCart.find(cartItem =>
    cartItem.barcode === item.barcode
  );

  if (existingItem) {
    existingItem.stock += item.stock;
  } else {
    stockCart.push(item);
  }

  renderStockCart();

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
  const tbody = document.getElementById("stockCartTable");
  tbody.innerHTML = "";

  stockCart.forEach((item, index) => {
    tbody.innerHTML += `
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
}

async function autoAddScan(e){

if(e.key !== "Enter") return;

e.preventDefault();

await loadProducts();

autoFillProduct();

document.getElementById("stock").value = 1;

setTimeout(() => {
  updatePreview();
  addStockToCart();
}, 300);

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

async function saveStockCart(){

  if(stockCart.length === 0){
    showMessage("Cart is empty.");
    return;
  }

  for(const item of stockCart){
    await apiRequest("saveProduct", item);
  }

  showSuccess("All stock saved!");

  stockCart = [];
  renderStockCart();

  loadProducts();
  loadHistory();
  loadDailyReports();
  loadBestSellers();

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
  const deductFrom = document.getElementById("deductFrom").value;
  const salesType = document.getElementById("salesType");

  if(deductFrom === "Store"){
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

const colorFilter =
document.getElementById("storeColorFilter");

if(!locationFilter || !colorFilter) return;

const keyword =
document
.getElementById("storeSearchInput")
.value
.toLowerCase();

const filtered =
products.filter(p=>

String(p.product)
.toLowerCase()
.includes(keyword)

);

locationFilter.innerHTML =
`<option value="">All Store</option>`;

colorFilter.innerHTML =
`<option value="">All Color</option>`;

const stores=[
...new Set(
filtered.map(
p=>p.location
).filter(Boolean)
)
];

const colors=[
...new Set(
filtered.map(
p=>p.color
).filter(Boolean)
)
];

stores.forEach(store=>{

locationFilter.innerHTML +=
`<option value="${store}">
${store}
</option>`;

});

colors.forEach(color=>{

colorFilter.innerHTML +=
`<option value="${color}">
${color}
</option>`;

});

}





async function loadDailyReports(){

const date =
document.getElementById("reportDate").value;

const result = await apiRequest(
"getDailyReports",
{
  date:
  document.getElementById("reportDate").value,

  remarks: ""
});

const history = result.records || [];

const addStock =
document.getElementById("addStockReport");

const warehouseToStore =
document.getElementById("warehouseToStoreReport");

const storeToWarehouse =
document.getElementById("storeToWarehouseReport");

const warehouseOnline =
document.getElementById("warehouseOnlineReport");

const storeWalkin =
document.getElementById("storeWalkinReport");

addStock.innerHTML = "";
warehouseToStore.innerHTML = "";
storeToWarehouse.innerHTML = "";
warehouseOnline.innerHTML = "";
storeWalkin.innerHTML = "";

const filtered = history.filter(item => {

if(!date) return true;

const itemDate =
new Date(item.date)
.toISOString()
.split("T")[0];

return itemDate === date;

});

filtered.forEach(item => {

const row = `

<div class="report-item">

<b>${item.product}</b><br>

${item.barcode}<br>

Qty: ${item.qty}

</div>

`;

const remarks =
(item.remarks || "").toLowerCase();

if(remarks.includes("add stock")){
addStock.innerHTML += row;
}

else if(
remarks.includes("warehouse") &&
remarks.includes("store")
){
warehouseToStore.innerHTML += row;
}

else if(
remarks.includes("store") &&
remarks.includes("warehouse")
){
storeToWarehouse.innerHTML += row;
}

else if(
remarks.includes("online")
){
warehouseOnline.innerHTML += row;
}

else if(
remarks.includes("walk")
){
storeWalkin.innerHTML += row;
}

});

if(!addStock.innerHTML){
addStock.innerHTML =
`<div class="report-empty">
No records
</div>`;
}

if(!warehouseToStore.innerHTML){
warehouseToStore.innerHTML =
`<div class="report-empty">
No records
</div>`;
}

if(!storeToWarehouse.innerHTML){
storeToWarehouse.innerHTML =
`<div class="report-empty">
No records
</div>`;
}

if(!warehouseOnline.innerHTML){
warehouseOnline.innerHTML =
`<div class="report-empty">
No records
</div>`;
}

if(!storeWalkin.innerHTML){
storeWalkin.innerHTML =
`<div class="report-empty">
No records
</div>`;
}

}

async function loadBestSellers(){

const result =
await apiRequest("getHistory");

const records =
result.records || [];

const selectedMonth =
document.getElementById("bestSellerMonth").value;

const selectedWeek =
document.getElementById("bestSellerWeek").value;

const weeklyBox =
document.getElementById("weeklyBestSeller");

const monthlyBox =
document.getElementById("monthlyBestSeller");

weeklyBox.innerHTML = "";
monthlyBox.innerHTML = "";

const sales = {};

records.forEach(item=>{

const remarks =
String(item.remarks || "").toLowerCase();

if(!remarks.includes("walk")) return;

const date =
new Date(item.datetime);

const month =
date.toISOString().slice(0,7);

const week =
String(Math.ceil(date.getDate() / 7));

if(selectedMonth && month !== selectedMonth) return;

if(selectedWeek && week !== selectedWeek) return;

const product =
item.product;

const qty =
Number(item.qty) || 0;

sales[product] =
(sales[product] || 0) + qty;

});

let rank = 1;

Object.entries(sales)
.sort((a,b)=>b[1]-a[1])
.slice(0,5)
.forEach(item=>{

const row = `

<div class="best-seller-item">

<div class="best-seller-left">

<div class="rank-badge">
${rank}
</div>

<div class="best-seller-name">
${item[0]}
</div>

</div>

<div class="best-seller-qty">
${item[1]} sold
</div>

</div>

`;

weeklyBox.innerHTML += row;
monthlyBox.innerHTML += row;

rank++;

});

if(!weeklyBox.innerHTML){
weeklyBox.innerHTML =
`<div class="report-empty">No records</div>`;
}

if(!monthlyBox.innerHTML){
monthlyBox.innerHTML =
`<div class="report-empty">No records</div>`;
}

}


window.onload = () => {
  document.getElementById("barcode").focus();
  loadProducts();
  loadHistory();
  loadDailyReports();
  loadBestSellers();
  loadStoreProducts();
  loadWeeklyStockChart();

  updateClock();
  setInterval(updateClock, 1000);
  
  showTab("dashboard");
};


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
    document.getElementById("loginScreen").style.display = "none";
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
    return;
  }

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

