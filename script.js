let stockChart = null;
let weeklyStockChart = null;
let allProducts = [];

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
    alert("Please input barcode, product name, at quantity.");
    return;
  }

  const result = await apiRequest("saveProduct", data);
  alert(result.message || "Saved!");

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
  filterProducts();
}

async function stockOut() {
  const barcode = document.getElementById("outBarcode").value.trim();
  const qty = Number(document.getElementById("outQty").value);

  if (!barcode || !qty) {
    alert("Please input barcode and quantity out.");
    return;
  }

  const result = await apiRequest("stockOut", {
    barcode,
    qty
  });

  alert(result.message || "Stock deducted!");

  loadProducts();
  loadHistory();
}

function filterProducts() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  const keyword = searchInput.value.toLowerCase();
  const rows = document.querySelectorAll("#productTable tr");

  let found = false;

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();

    if (text.includes(keyword)) {
      row.style.display = "";
      found = true;
    } else {
      row.style.display = "none";
    }
  });

  // alisin muna lumang message
  const oldMsg = document.getElementById("noResultRow");
  if (oldMsg) oldMsg.remove();

  // kapag walang nahanap
  if (!found && keyword !== "") {
    const table = document.getElementById("productTable");

    table.innerHTML += `
      <tr id="noResultRow">
        <td colspan="8"
        style="text-align:center;color:#888;padding:20px;">
          ❌ Product not found
        </td>
      </tr>
    `;
  }
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
  const table = document.getElementById("storeTable");

  table.innerHTML = "";

  if (products.length === 0) {
    table.innerHTML = "<tr><td colspan='6'>No store products yet.</td></tr>";
    return;
  }

  products.forEach(item => {
    table.innerHTML += `
      <tr>
        <td>${item.barcode}</td>
        <td>${item.product}</td>
        <td>${item.color}</td>
        <td>${item.size}</td>
        <td>${item.stock}</td>
        <td>${item.location}</td>
      </tr>
    `;
  });
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

alert(
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


function filterStoreProducts() {
  const searchInput = document.getElementById("storeSearchInput");
  if (!searchInput) return;

  const keyword = searchInput.value.toLowerCase();
  const rows = document.querySelectorAll("#storeTable tr");

  let found = false;

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();

    if (text.includes(keyword)) {
      row.style.display = "";
      found = true;
    } else {
      row.style.display = "none";
    }
  });

  const oldMsg = document.getElementById("noStoreResultRow");
  if (oldMsg) oldMsg.remove();

  if (!found && keyword !== "") {
    const table = document.getElementById("storeTable");

    table.innerHTML += `
      <tr id="noStoreResultRow">
        <td colspan="6" style="text-align:center;color:#888;padding:20px;">
          ❌ Store product not found
        </td>
      </tr>
    `;
  }
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

alert(
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
        
          previewImg.src = "images/cristine.png";

        } else if (productName.includes("ellie set")) {
        
          previewImg.src = "images/ellie set.png";

        } else if (productName.includes("erin skirt")) {
        
          previewImg.src = "images/erin skirt.png";

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
    alert("Please input barcode, product name, and quantity.");
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
    alert("Cart is empty.");
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

window.onload = () => {
  document.getElementById("barcode").focus();
  loadProducts();
  loadHistory();
  loadStoreProducts();
  loadWeeklyStockChart();

  updateClock();
  setInterval(updateClock, 1000);
  
  showTab("dashboard");
};


async function loginUser() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  const result = await apiRequest("login", {
    username,
    password
  });

  if (result.success) {
    document.getElementById("loginScreen").style.display = "none";
  } else {
    alert("Wrong username or password");
  }
}

function logoutUser() {

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

}
