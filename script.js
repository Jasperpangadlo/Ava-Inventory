let stockChart = null;

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw6K3N58inD_aZdmVA6yilTyxSSEE34ng_GXNviFvDTBLdXocmhBppWeCv4U9bcKr-3/exec";

async function apiRequest(action, payload = {}) {
  const response = await fetch(WEB_APP_URL, {
    method: "POST",
    body: JSON.stringify({ action, ...payload })
  });

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
    alert("Pakilagay ang barcode, product name, at quantity.");
    return;
  }

  const result = await apiRequest("saveProduct", data);
  alert(result.message || "Saved!");
  loadProducts();
}

async function loadProducts() {
  const result = await apiRequest("getProducts");
  const products = result.products || [];
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

  filterProducts();
}

async function stockOut() {
  const barcode = document.getElementById("outBarcode").value.trim();
  const qty = Number(document.getElementById("outQty").value);

  if (!barcode || !qty) {
    alert("Pakilagay ang barcode at quantity out.");
    return;
  }

  const result = await apiRequest("stockOut", { barcode, qty });
  alert(result.message || "Stock deducted!");
  loadProducts();
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

async function loginUser(){

const username=
document.getElementById("username").value;

const password=
document.getElementById("password").value;

const result=
await apiRequest(
"login",
{
username,
password
}
);

if(result.success){

document
.getElementById(
"loginScreen"
)
.style.display="none";

}
else{

alert(
"Wrong username or password"
);

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

