let stockChart = null;
let weeklyStockChart = null;
let salesTrendChart = null;
let allProducts = [];
let storeProducts = [];

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw6K3N58inD_aZdmVA6yilTyxSSEE34ng_GXNviFvDTBLdXocmhBppWeCv4U9bcKr-3/exec";

async function apiRequest(action, payload = {}) {

const params = new URLSearchParams({
action,
data: JSON.stringify(payload)
});

const url =
`${WEB_APP_URL}?${params}`;

const response =
await fetch(url);

const text =
await response.text();

try{

return JSON.parse(text);

}catch(error){

console.error("API URL:", url);
console.error("API RESPONSE:", text);

throw new Error(
"API did not return JSON. Check Apps Script deployment or action: " + action
);

}

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

const btn =
document.getElementById("deductbtn");

setButtonLoading(btn,true);

const barcode =
document.getElementById("outBarcode").value.trim();

const qty =
Number(document.getElementById("outQty").value);

const deductFrom =
document.getElementById("deductFrom").value;

const salesType =
document.getElementById("salesType").value;

if(!barcode || !qty){

setButtonLoading(btn,false);

showMessage(
"Please input barcode and quantity out.",
"warning"
);

return;

}

if(!deductFrom || !salesType){

setButtonLoading(btn,false);

showMessage(
"Please select sales destination",
"warning"
);

return;

}

let remarks = "";

if(deductFrom === "Warehouse"){

remarks =
"Warehouse - " + salesType;

}else{

remarks =
deductFrom + " - Walk-in";

}

const result =
await apiRequest(
"stockOut",
{
barcode,
qty,
remarks,
deductFrom
}
);

if(result.message.includes("Not enough")){

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
"✓ Deducted"
);

showMessage(
result.message,
"success"
);

await loadProducts();
await loadStoreProducts();
await loadHistory();
await loadDailyReports();
await loadBestSellers();
await updateStoreSalesToday();
await updateBranchRanking();
await loadTransactionTimeline();
await loadSoldItems();

document.getElementById("outBarcode").value = "";
document.getElementById("outQty").value = "";
document.getElementById("deductFrom").selectedIndex = 0;
document.getElementById("salesType").selectedIndex = 0;
document.getElementById("outBarcode").focus();

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
document.getElementById("transferBarcode").value.trim();

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

await loadProducts();
await loadStoreProducts();
await loadHistory();
await loadDailyReports();
await loadTransactionTimeline();

document.getElementById("transferBarcode").value = "";
document.getElementById("transferQty").value = "";
document.getElementById("toStore").selectedIndex = 0;
document.getElementById("transferBarcode").focus();

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

loadProducts();
loadStoreProducts();
loadHistory();
  
}

async function refreshAllData() {
  await loadProducts();
  await loadHistory();
  await loadStoreProducts();
  await loadWeeklyStockChart();
  await updateStoreSalesToday();
  await updateBranchRanking();
  await loadTransactionTimeline();
  await loadSoldItems();
  
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

for(const item of stockCart){
await apiRequest("saveProduct", item);
}

setButtonSuccess(
btn,
"✓ Saved"
);

showSuccess("All stock saved!");

stockCart = [];
renderStockCart();

await loadProducts();
await loadHistory();
await loadDailyReports();
await loadBestSellers();
await loadTransactionTimeline();

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

async function loadDailyReports(){

const date =
document.getElementById("reportDate").value;

const result = await apiRequest(
"getDailyReports",
{
date:
document.getElementById("reportDate").value,
remarks: ""
}
);

const history = result.records || [];

const addStock =
document.getElementById("addStockReport");

const warehouseToStore =
document.getElementById("warehouseToStoreReport");

const storeToWarehouse =
document.getElementById("storeToWarehouseReport");

const warehouseOnline =
document.getElementById("warehouseOnlineReport");

const store1Walkin =
document.getElementById("store1WalkinReport");

const store2Walkin =
document.getElementById("store2WalkinReport");

const store3Walkin =
document.getElementById("store3WalkinReport");

addStock.innerHTML = "";
warehouseToStore.innerHTML = "";
storeToWarehouse.innerHTML = "";
warehouseOnline.innerHTML = "";
store1Walkin.innerHTML = "";
store2Walkin.innerHTML = "";
store3Walkin.innerHTML = "";

const filtered = history.filter(item => {

if(!date) return true;

const itemDate =
new Date(item.date)
.toISOString()
.split("T")[0];

return itemDate === date;

});

let store1Sales = {};
let store2Sales = {};
let store3Sales = {};

let store1Total = 0;
let store2Total = 0;
let store3Total = 0;

let colorSales = {};
let sizeSales = {};

let summary = {
addStock:{qty:0,total:0},
warehouseToStore:{qty:0,total:0},
storeToWarehouse:{qty:0,total:0},
warehouseOnline:{qty:0,total:0},
store1Walkin:{qty:0,total:0},
store2Walkin:{qty:0,total:0},
store3Walkin:{qty:0,total:0}
};

filtered.forEach(item => {

let badgeClass = "badge-stock";
let badgeText = "STOCK";

const lowerRemarks =
(item.remarks || "").toLowerCase();

if(lowerRemarks.includes("walk")){
badgeClass = "badge-sale";
badgeText = "WALK-IN";
}

else if(lowerRemarks.includes("online")){
badgeClass = "badge-online";
badgeText = "ONLINE";
}

else if(
lowerRemarks.includes("warehouse") &&
lowerRemarks.includes("store")
){
badgeClass = "badge-transfer";
badgeText = "TRANSFER";
}

else if(lowerRemarks.includes("add stock")){
badgeClass = "badge-stock";
badgeText = "ADD STOCK";
}

const row = `

<div class="report-item">

<div class="report-top">

<b>${item.product}</b>

<span class="report-badge ${badgeClass}">
${badgeText}
</span>

</div>

<small>${item.barcode}</small>

<small>Qty: ${item.qty}</small>

${item.total ?
`<small>Total: ₱${Number(item.total).toLocaleString()}</small>`
: ""}

</div>

`;

const remarks =
(item.remarks || "").toLowerCase();

const product =
item.product;

const qty =
Number(item.qty) || 0;

const total =
Number(item.total) || 0;

const color =
item.color || "Unknown";

const size =
item.size || "Unknown";

if(remarks.includes("walk")){

colorSales[color] =
(colorSales[color] || 0) + qty;

sizeSales[size] =
(sizeSales[size] || 0) + qty;

}

if(
remarks.includes("store 1") &&
remarks.includes("walk")
){

store1Sales[product] =
(store1Sales[product] || 0) + qty;

}

if(
remarks.includes("store 2") &&
remarks.includes("walk")
){

store2Sales[product] =
(store2Sales[product] || 0) + qty;

}

if(
remarks.includes("store 3") &&
remarks.includes("walk")
){

store3Sales[product] =
(store3Sales[product] || 0) + qty;

}

if(remarks.includes("add stock")){

addStock.innerHTML += row;

summary.addStock.qty += qty;
summary.addStock.total += total;

}

else if(
remarks.startsWith("warehouse") &&
remarks.includes("store")
){

warehouseToStore.innerHTML += row;

summary.warehouseToStore.qty += qty;
summary.warehouseToStore.total += total;

}

else if(
remarks.startsWith("store") &&
remarks.includes("warehouse")
){

storeToWarehouse.innerHTML += row;

summary.storeToWarehouse.qty += qty;
summary.storeToWarehouse.total += total;

}

else if(remarks.includes("online")){

warehouseOnline.innerHTML += row;

summary.warehouseOnline.qty += qty;
summary.warehouseOnline.total += total;

}

else if(
remarks.startsWith("store 1") &&
remarks.includes("walk")
){

store1Walkin.innerHTML += row;

store1Total += total;

summary.store1Walkin.qty += qty;
summary.store1Walkin.total += total;

}

else if(
remarks.startsWith("store 2") &&
remarks.includes("walk")
){

store2Walkin.innerHTML += row;

store2Total += total;

summary.store2Walkin.qty += qty;
summary.store2Walkin.total += total;

}

else if(
remarks.startsWith("store 3") &&
remarks.includes("walk")
){

store3Walkin.innerHTML += row;

store3Total += total;

summary.store3Walkin.qty += qty;
summary.store3Walkin.total += total;

}

});

if(!addStock.innerHTML){
addStock.innerHTML =
`<div class="report-empty">No records</div>`;
}

if(!warehouseToStore.innerHTML){
warehouseToStore.innerHTML =
`<div class="report-empty">No records</div>`;
}

if(!storeToWarehouse.innerHTML){
storeToWarehouse.innerHTML =
`<div class="report-empty">No records</div>`;
}

if(!warehouseOnline.innerHTML){
warehouseOnline.innerHTML =
`<div class="report-empty">No records</div>`;
}

if(!store1Walkin.innerHTML){
store1Walkin.innerHTML =
`<div class="report-empty">No records</div>`;
}

if(!store2Walkin.innerHTML){
store2Walkin.innerHTML =
`<div class="report-empty">No records</div>`;
}

if(!store3Walkin.innerHTML){
store3Walkin.innerHTML =
`<div class="report-empty">No records</div>`;
}


updateReportSummary("addStock", summary.addStock);
updateReportSummary("warehouseToStore", summary.warehouseToStore);
updateReportSummary("storeToWarehouse", summary.storeToWarehouse);
updateReportSummary("warehouseOnline", summary.warehouseOnline);
updateReportSummary("store1Walkin", summary.store1Walkin);
updateReportSummary("store2Walkin", summary.store2Walkin);
updateReportSummary("store3Walkin", summary.store3Walkin);

updateBestSellerCard(
store1Sales,
"store1BestSeller",
"store1BestSellerQty"
);

updateBestSellerCard(
store2Sales,
"store2BestSeller",
"store2BestSellerQty"
);

updateBestSellerCard(
store3Sales,
"store3BestSeller",
"store3BestSellerQty"
);

updateReportOverview(
store1Total,
store2Total,
store3Total,
store1Sales,
store2Sales,
store3Sales
);

updateTopAnalytics(
colorSales,
"topColorsBox"
);

updateTopAnalytics(
sizeSales,
"topSizesBox"
);

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

async function updateStoreSalesToday(){

const result = await apiRequest("getHistory");
const records = result.records || [];

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
store3Sales
){

const totalRevenue =
store1Total + store2Total + store3Total;

const allSales = {};

[store1Sales, store2Sales, store3Sales].forEach(store=>{
Object.entries(store).forEach(([product, qty])=>{
allSales[product] = (allSales[product] || 0) + qty;
});
});

const bestSeller =
Object.entries(allSales).sort((a,b)=>b[1]-a[1])[0];

const storeData = [
{name:"Store 1", sales:store1Total, qty:Object.values(store1Sales).reduce((a,b)=>a+b,0)},
{name:"Store 2", sales:store2Total, qty:Object.values(store2Sales).reduce((a,b)=>a+b,0)},
{name:"Store 3", sales:store3Total, qty:Object.values(store3Sales).reduce((a,b)=>a+b,0)}
];

storeData.sort((a,b)=>b.sales-a.sales);

document.getElementById("reportRevenue").textContent =
"₱" + totalRevenue.toLocaleString();

document.getElementById("reportBestSeller").textContent =
bestSeller ? `${bestSeller[0]} (${bestSeller[1]} sold)` : "-";

document.getElementById("reportTopStore").textContent =
storeData[0].sales > 0 ? storeData[0].name : "-";

document.getElementById("reportItemsSold").textContent =
storeData.reduce((sum,s)=>sum+s.qty,0);

  const totalItemsSold =
storeData.reduce((sum,s)=>sum+s.qty,0);

document.getElementById("kpiRevenue").textContent =
"₱" + totalRevenue.toLocaleString();

document.getElementById("kpiItemsSold").textContent =
totalItemsSold;

document.getElementById("kpiBestSeller").textContent =
bestSeller ? bestSeller[0] : "-";

document.getElementById("kpiTopStore").textContent =
storeData[0].sales > 0 ? storeData[0].name : "-";

animateNumber(
"reportStore1Sales",
store1Total,
"₱"
);

animateNumber(
"reportStore2Sales",
store2Total,
"₱"
);

animateNumber(
"reportStore3Sales",
store3Total,
"₱"
);

document.getElementById("reportStore1Qty").textContent =
storeData.find(s=>s.name==="Store 1").qty + " items sold";

document.getElementById("reportStore2Qty").textContent =
storeData.find(s=>s.name==="Store 2").qty + " items sold";

document.getElementById("reportStore3Qty").textContent =
storeData.find(s=>s.name==="Store 3").qty + " items sold";

const max =
Math.max(store1Total, store2Total, store3Total, 1);

document.getElementById("reportStoreRanking").innerHTML =
storeData.map((store,index)=>`
<div class="ranking-row">
  <div class="ranking-top">
    <span>${index + 1}. ${store.name}</span>
    <span>₱${store.sales.toLocaleString()}</span>
  </div>
  <div class="ranking-bar">
    <div style="width:${(store.sales / max) * 100}%"></div>
  </div>
</div>
`).join("");

}

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

const result =
await apiRequest("getHistory");

const records =
result.records || [];

const monthInput =
document.getElementById("bestSellerMonth");

const selectedMonth =
monthInput ? monthInput.value : "";

const storeFilter =
document.getElementById("trendStoreFilter").value;

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

const result =
await apiRequest("getHistory");

const records =
result.records || [];

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

const result =
await apiRequest("getHistory");

const records =
result.records || [];

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

table.innerHTML = "";

if(data.length === 0){

table.innerHTML =
`<tr>
<td colspan="8">No sold items found.</td>
</tr>`;

return;

}

data.forEach(item=>{

const remarks =
String(item.remarks || "");

table.innerHTML += `
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

  if(localStorage.getItem("avaLoggedIn") === "true")
{
  document.getElementById("loginScreen").style.display = "none";
  }

  const trendMonth =
  document.getElementById("trendMonth");
  
  if(trendMonth){
  trendMonth.value =
  new Date().toISOString().slice(0,7);
  }

  setTodayReportDate();
  setCurrentBestSellerFilters();
  loadTransactionTimeline();
  loadSoldItems();
  
  document.getElementById("barcode").focus();
  loadProducts();
  loadHistory();
  loadDailyReports();
  loadBestSellers();
  loadStoreProducts();
  loadWeeklyStockChart();
  updateStoreSalesToday();
  loadSalesTrendChart();
  

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

    localStorage.setItem(
        "avaLoggedIn",
        "true"
    );

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

    btn.classList.remove("btn-loading");
    btn.innerHTML = originalText;
    return;
  }

  localStorage.removeItem("avaLoggedIn");
  localStorage.removeItem("avaUser");

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

