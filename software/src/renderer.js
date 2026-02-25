// =====================================================
// DAILY MART POS - RENDERER PROCESS
// Main business logic with IPC communication
// =====================================================

// Import CSS for webpack bundling
require('./index.css');

// Global state
let cart = [];
let currentBillNumber = null;
let allProducts = [];
let lowStockItems = [];
let dashboardStats = {};

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize all features
  await initializeDashboard();
  setupNavigationListeners();
  setupBillingListeners();
  setupProductsListeners();
  setupStockInListeners();
  setupReportsListeners();
  updateTime();
  await generateBillNumber();
  
  // Fetch data on startup
  await loadProducts();
  await loadDashboardStats();
  await loadLowStockItems();
  
  setInterval(updateTime, 100);
  updateBillingClock();
  setInterval(updateBillingClock, 1000);
});

// =====================================================
// DEMO DATA
// =====================================================

async function addDemoProducts() {
  const demoProducts = [
    { barcode: '8901030123456', name: 'Parle-G Biscuits', category: 'Biscuits', buy_price: 5, sell_price: 10, quantity: 50 },
    { barcode: '8901030234567', name: 'Britannia Good Day', category: 'Biscuits', buy_price: 10, sell_price: 15, quantity: 40 },
    { barcode: '8901234567890', name: 'Amul Milk 500ml', category: 'Dairy', buy_price: 25, sell_price: 30, quantity: 30 },
    { barcode: '8901234567891', name: 'Amul Butter 100g', category: 'Dairy', buy_price: 45, sell_price: 50, quantity: 20 },
    { barcode: '8901234567908', name: 'Amul Ice Cream 1L', category: 'Ice Creams', buy_price: 150, sell_price: 180, quantity: 15 },
    { barcode: '8901234567909', name: 'Kwality Walls Cornetto', category: 'Ice Creams', buy_price: 30, sell_price: 40, quantity: 25 },
    { barcode: '8901234567892', name: 'Tata Salt 1kg', category: 'Spices & Masala', buy_price: 18, sell_price: 22, quantity: 60 },
    { barcode: '8901234567893', name: 'Fortune Oil 1L', category: 'Cooking Oil', buy_price: 120, sell_price: 140, quantity: 25 },
    { barcode: '8901234567894', name: 'Maggi Noodles', category: 'Instant Food', buy_price: 10, sell_price: 14, quantity: 100 },
    { barcode: '8901234567895', name: 'Horlicks 500g', category: 'Health Drinks', buy_price: 180, sell_price: 220, quantity: 15 },
    { barcode: '8901234567896', name: 'Coca Cola 2L', category: 'Beverages', buy_price: 80, sell_price: 90, quantity: 35 },
    { barcode: '8901234567897', name: 'Lays Chips 50g', category: 'Snacks', buy_price: 15, sell_price: 20, quantity: 80 },
    { barcode: '8901234567910', name: 'Dairy Milk Chocolate', category: 'Confectionery', buy_price: 40, sell_price: 50, quantity: 60 },
    { barcode: '8901234567911', name: 'White Bread Loaf', category: 'Bakery', buy_price: 25, sell_price: 35, quantity: 20 },
    { barcode: '8901234567898', name: 'Surf Excel 1kg', category: 'Detergents', buy_price: 140, sell_price: 160, quantity: 18 },
    { barcode: '8901234567899', name: 'Colgate 100g', category: 'Personal Care', buy_price: 35, sell_price: 45, quantity: 45 },
    { barcode: '8901234567900', name: 'Nivea Cream 50ml', category: 'Personal Care', buy_price: 60, sell_price: 75, quantity: 22 },
    { barcode: '8901234567901', name: 'Dove Soap', category: 'Personal Care', buy_price: 25, sell_price: 35, quantity: 3 },
    { barcode: '8901234567902', name: 'Vim Bar 200g', category: 'Cleaning Supplies', buy_price: 10, sell_price: 15, quantity: 55 },
    { barcode: '8901234567903', name: 'Dettol 200ml', category: 'Health & Wellness', buy_price: 80, sell_price: 95, quantity: 12 },
    { barcode: '8901234567904', name: 'Red Bull 250ml', category: 'Beverages', buy_price: 90, sell_price: 120, quantity: 2 },
    { barcode: '8901234567905', name: 'Nescafe Coffee 50g', category: 'Beverages', buy_price: 85, sell_price: 100, quantity: 28 },
    { barcode: '8901234567906', name: 'Kurkure 40g', category: 'Snacks', buy_price: 8, sell_price: 10, quantity: 90 },
    { barcode: '8901234567907', name: 'Sunfeast Biscuits', category: 'Biscuits', buy_price: 12, sell_price: 18, quantity: 1 },
    { barcode: '8901234567912', name: 'Basmati Rice 5kg', category: 'Rice & Grains', buy_price: 350, sell_price: 400, quantity: 12 },
    { barcode: '8901234567913', name: 'Toor Dal 1kg', category: 'Pulses & Dals', buy_price: 80, sell_price: 100, quantity: 30 }
  ];

  let added = 0;
  let failed = 0;

  for (const product of demoProducts) {
    try {
      await window.electronAPI.addProduct(product);
      added++;
    } catch (error) {
      // Product might already exist (unique barcode constraint)
      failed++;
      console.log(`Skipped: ${product.name} (may already exist)`);
    }
  }

  alert(`Demo products loaded!\nAdded: ${added}\nSkipped: ${failed}`);
  await loadProducts();
  await loadDashboardStats();
  await loadLowStockItems();
}

async function showDatabaseLocation() {
  try {
    const dbPath = await window.electronAPI.getDatabasePath();
    const infoDiv = document.getElementById('db-location-info');
    const pathEl = document.getElementById('db-path');
    
    if (infoDiv && pathEl) {
      pathEl.textContent = dbPath;
      infoDiv.style.display = 'block';
    }
    
    alert('Database location displayed below. You can find your database file at:\n\n' + dbPath);
  } catch (error) {
    console.error('Error getting database path:', error);
    alert('Error: Could not get database location');
  }
}

// =====================================================
// TIME & DATE UPDATES
// =====================================================

function updateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: true });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' });
  
  const timeEl = document.getElementById('current-time');
  const dateEl = document.getElementById('current-date');
  
  if (timeEl) timeEl.textContent = timeStr;
  if (dateEl) dateEl.textContent = dateStr;
}

// =====================================================
// NAVIGATION
// =====================================================

function setupNavigationListeners() {
  document.querySelectorAll('.navbar-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const pageName = item.getAttribute('data-page');
      navigateTo(pageName);
    });
  });
}

function navigateTo(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  // Show selected page
  const page = document.getElementById(`${pageName}-page`);
  if (page) {
    page.classList.add('active');
  }
  
  // Update navbar
  document.querySelectorAll('.navbar-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-page') === pageName) {
      item.classList.add('active');
    }
  });
  
  // Reload page data if needed
  if (pageName === 'dashboard') {
    loadDashboardStats();
    loadLowStockItems();
  } else if (pageName === 'reports') {
    loadReports();
  } else if (pageName === 'stock-in') {
    loadStockHistory();
  }
}

// =====================================================
// DASHBOARD
// =====================================================

async function initializeDashboard() {
  // Quick action buttons
  document.querySelectorAll('.action-buttons button').forEach(btn => {
    btn.addEventListener('click', function () {
      const label = this.textContent.trim();
      if (label.includes('Bill')) navigateTo('billing');
      else if (label.includes('Product')) navigateTo('products');
      else if (label.includes('Stock')) navigateTo('stock-in');
      else if (label.includes('Report')) navigateTo('reports');
    });
  });
}

async function loadDashboardStats() {
  try {
    dashboardStats = await window.electronAPI.getDashboardStats();
    
    document.getElementById('total-products').textContent = dashboardStats.total_products || 0;
    document.getElementById('today-sales').textContent = '₹' + (dashboardStats.today_sales || 0).toFixed(2);
    document.getElementById('low-stock-count').textContent = dashboardStats.low_stock_count || 0;
    document.getElementById('month-profit').textContent = '₹' + (dashboardStats.inventory_value || 0).toFixed(2);
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
  }
}

async function loadLowStockItems() {
  try {
    lowStockItems = await window.electronAPI.getLowStockItems();
    const tbody = document.getElementById('low-stock-table');
    
    if (!tbody) return;
    
    if (lowStockItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No low stock items</td></tr>';
      return;
    }
    
    tbody.innerHTML = lowStockItems.map(item => `
      <tr>
        <td><strong style="color:#e67e22; font-size:15px;">#${item.id}</strong></td>
        <td>${item.barcode}</td>
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td><span style="color:red; font-weight:700;">${item.quantity}</span></td>
        <td>
          <button class="btn btn-secondary" onclick="restockProduct(${item.id}, '${item.name.replace(/'/g, "&#39;")}')">Restock</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading low stock items:', error);
  }
}

function restockProduct(productId, productName) {
  navigateTo('stock-in');
  // Auto-fill product ID after navigation renders the page
  setTimeout(() => {
    const idInput = document.getElementById('stock-product-id');
    if (idInput) {
      idInput.value = productId;
      idInput.focus();
      // Highlight the field so user notices it's pre-filled
      idInput.style.border = '2px solid #e67e22';
      idInput.style.background = '#fff8ee';
      setTimeout(() => {
        idInput.style.border = '';
        idInput.style.background = '';
      }, 2000);
    }
  }, 50);
}

// =====================================================
// BILLING
// =====================================================

function setupBillingListeners() {
  const barcodeInput = document.getElementById('barcode-input');
  if (barcodeInput) {
    barcodeInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        const barcode = barcodeInput.value.trim();
        barcodeInput.value = '';
        
        if (barcode) {
          await addProductToCart(barcode);
        }
      }
    });
  }
  
  // Product name search with live suggestions
  const productSearch = document.getElementById('product-search');
  const suggestionsDiv = document.getElementById('product-suggestions');
  
  if (productSearch && suggestionsDiv) {
    // Show suggestions on input
    productSearch.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      
      if (!searchTerm) {
        suggestionsDiv.style.display = 'none';
        return;
      }
      
      // Find all matching products
      const matches = allProducts.filter(product => 
        product.name.toLowerCase().includes(searchTerm) ||
        product.category.toLowerCase().includes(searchTerm) ||
        product.barcode.includes(searchTerm)
      );
      
      if (matches.length > 0) {
        suggestionsDiv.innerHTML = matches.map(product => `
          <div class="suggestion-item" 
               data-barcode="${product.barcode}"
               style="
                 padding: 15px 20px;
                 cursor: pointer;
                 border-bottom: 1px solid #eee;
                 transition: all 0.2s ease;
               "
               onmouseover="this.style.background='#FFC107'; this.style.color='#000';"
               onmouseout="this.style.background='white'; this.style.color='#000';">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="font-size: 16px;">${product.name}</strong>
                <div style="font-size: 13px; color: #666; margin-top: 3px;">
                  ${product.category} • Barcode: ${product.barcode}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 18px; font-weight: bold; color: #000;">₹${product.sell_price}</div>
                <div style="font-size: 13px; color: ${product.quantity < 10 ? '#ff4444' : '#4CAF50'};">
                  Stock: ${product.quantity}
                </div>
              </div>
            </div>
          </div>
        `).join('');
        suggestionsDiv.style.display = 'block';
        
        // Add click handlers to suggestions
        suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
          item.addEventListener('click', async () => {
            const barcode = item.getAttribute('data-barcode');
            await addProductToCart(barcode);
            productSearch.value = '';
            suggestionsDiv.style.display = 'none';
            productSearch.focus();
          });
        });
      } else {
        suggestionsDiv.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #999; font-size: 15px;">
            No products found matching "${searchTerm}"
          </div>
        `;
        suggestionsDiv.style.display = 'block';
      }
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (!productSearch.contains(e.target) && !suggestionsDiv.contains(e.target)) {
        suggestionsDiv.style.display = 'none';
      }
    });
    
    // Focus search when clicked
    productSearch.addEventListener('focus', () => {
      if (productSearch.value.trim()) {
        productSearch.dispatchEvent(new Event('input'));
      }
    });
    
    // Add product on Enter key
    productSearch.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        const firstSuggestion = suggestionsDiv.querySelector('.suggestion-item');
        if (firstSuggestion) {
          const barcode = firstSuggestion.getAttribute('data-barcode');
          await addProductToCart(barcode);
          productSearch.value = '';
          suggestionsDiv.style.display = 'none';
        }
      }
    });
  }
}

async function addProductToCart(barcode) {
  try {
    const product = await window.electronAPI.getProductByBarcode(barcode);
    
    if (!product) {
      alert('Product not found!');
      return;
    }
    
    if (product.quantity < 1) {
      alert('Product out of stock!');
      return;
    }
    
    // Check if product already in cart
    const cartItem = cart.find(item => item.product_id === product.id);
    
    if (cartItem) {
      if (cartItem.quantity < product.quantity) {
        cartItem.quantity++;
        cartItem.total_price = cartItem.quantity * cartItem.unit_price;
      } else {
        alert('Not enough stock');
        return;
      }
    } else {
      cart.push({
        product_id: product.id,
        barcode: product.barcode,
        name: product.name,
        quantity: 1,
        unit_price: product.sell_price,
        total_price: product.sell_price
      });
    }
    
    updateCartUI();
  } catch (error) {
    console.error('Error adding product to cart:', error);
  }
}

function updateCartUI() {
  const cartBody = document.getElementById('cart-items');
  const subtotalEl = document.getElementById('cart-subtotal');
  const totalEl = document.getElementById('cart-total');
  
  if (!cartBody) return;
  
  if (cart.length === 0) {
    cartBody.innerHTML = '<tr><td colspan="5" class="text-center">Cart is empty. Scan or select a product to begin.</td></tr>';
    if (subtotalEl) subtotalEl.textContent = '₹0.00';
    if (totalEl) totalEl.textContent = '₹0.00';
    return;
  }
  
  // Update cart table
  cartBody.innerHTML = cart.map((item, index) => `
    <tr>
      <td>${item.name}</td>
      <td>
        <button class="btn btn-secondary" style="padding: 5px 10px; margin-right: 5px;" onclick="decrementCartItem(${index})">-</button>
        ${item.quantity}
        <button class="btn btn-secondary" style="padding: 5px 10px; margin-left: 5px;" onclick="incrementCartItem(${index})">+</button>
      </td>
      <td>
        ₹${item.unit_price.toFixed(2)}
        <button class="btn btn-secondary" style="padding: 3px 8px; margin-left: 8px; font-size: 12px;" onclick="editCartItemPrice(${index})" title="Edit Price">Edit</button>
      </td>
      <td>₹${item.total_price.toFixed(2)}</td>
      <td>
        <button class="btn btn-secondary" onclick="removeFromCart(${index})">Remove</button>
      </td>
    </tr>
  `).join('');
  
  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const total = subtotal;
  
  if (subtotalEl) subtotalEl.textContent = '₹' + subtotal.toFixed(2);
  if (totalEl) totalEl.textContent = '₹' + total.toFixed(2);
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartUI();
}

function incrementCartItem(index) {
  const item = cart[index];
  const product = allProducts.find(p => p.id === item.product_id);
  
  if (product && item.quantity < product.quantity) {
    item.quantity++;
    item.total_price = item.quantity * item.unit_price;
    updateCartUI();
  } else {
    alert('Not enough stock available!');
  }
}

function decrementCartItem(index) {
  const item = cart[index];
  
  if (item.quantity > 1) {
    item.quantity--;
    item.total_price = item.quantity * item.unit_price;
    updateCartUI();
  } else {
    removeFromCart(index);
  }
}

function clearCart() {
  cart = [];
  updateCartUI();
  generateBillNumber(); // async, no need to await here
}

function editCartItemPrice(index) {
  const item = cart[index];
  const currentPrice = item.unit_price;
  
  // Create a custom dialog
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;
  
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    min-width: 400px;
  `;
  
  dialog.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: #333;">Edit Price</h3>
    <p style="margin: 0 0 15px 0; color: #666;">
      <strong>${item.name}</strong><br>
      Current Price: ₹${currentPrice.toFixed(2)}
    </p>
    <input 
      type="number" 
      id="price-input-temp" 
      value="${currentPrice}" 
      step="0.01" 
      min="0.01"
      style="width: 100%; padding: 12px; font-size: 16px; border: 2px solid #FFC107; border-radius: 5px; margin-bottom: 20px;"
    />
    <div style="display: flex; gap: 10px; justify-content: flex-end;">
      <button id="cancel-price-btn" class="btn btn-secondary">Cancel</button>
      <button id="save-price-btn" class="btn btn-primary">Save</button>
    </div>
  `;
  
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  const input = document.getElementById('price-input-temp');
  const saveBtn = document.getElementById('save-price-btn');
  const cancelBtn = document.getElementById('cancel-price-btn');
  
  // Focus and select the input
  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);
  
  // Handle save
  const savePrice = () => {
    const parsedPrice = parseFloat(input.value);
    
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      alert('Invalid price! Please enter a valid positive number.');
      input.focus();
      return;
    }
    
    // Update the item's unit price and recalculate total
    item.unit_price = parsedPrice;
    item.total_price = item.quantity * parsedPrice;
    
    document.body.removeChild(overlay);
    updateCartUI();
  };
  
  // Handle cancel
  const cancelPrice = () => {
    document.body.removeChild(overlay);
  };
  
  saveBtn.addEventListener('click', savePrice);
  cancelBtn.addEventListener('click', cancelPrice);
  
  // Handle Enter key
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      savePrice();
    }
  });
  
  // Handle Escape key
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cancelPrice();
    }
  });
}

async function processSale() {
  if (cart.length === 0) {
    alert('Cart is empty!');
    return;
  }

  // Phone is optional now
  const customerPhoneRaw = document.getElementById('customer-phone')?.value.trim() || '';
  const paymentMethod = document.getElementById('payment-method')?.value || 'cash';

  const saleData = {
    bill_number: currentBillNumber,
    total_amount: cart.reduce((sum, item) => sum + item.total_price, 0),
    payment_method: paymentMethod,
    customer_phone: customerPhoneRaw,
    items: cart
  };

  try {
    const result = await window.electronAPI.createSale(saleData);

    // Print bill
    generateAndPrintBill(saleData);

    // Send bill on WhatsApp only if phone number is provided
    if (customerPhoneRaw) {
      sendBillOnWhatsApp(saleData);
      alert(`✅ Sale completed!\nBill #${result.bill_number}\n📲 Bill sent to WhatsApp: ${customerPhoneRaw}`);
    } else {
      alert(`✅ Sale completed!\nBill #${result.bill_number}`);
    }
    
    clearCart();
    loadDashboardStats();
  } catch (error) {
    console.error('Error processing sale:', error);
    alert('Error processing sale: ' + error.message);
  }
}

function sendBillOnWhatsApp(saleData) {
  // Normalize phone: strip spaces/dashes, ensure country code
  let phone = saleData.customer_phone.replace(/[\s\-()]/g, '');
  if (phone.startsWith('0')) phone = '91' + phone.slice(1);
  else if (!phone.startsWith('+') && !phone.startsWith('91') && phone.length === 10) phone = '91' + phone;
  phone = phone.replace(/^\+/, '');

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const itemLines = saleData.items
    .map(i => `  • ${i.name} x${i.quantity}  =  ₹${i.total_price.toFixed(2)}`)
    .join('\n');

  const message =
`🛒 *DAILY MART*
_From Nature to Your Kitchen_
📞 +91 9164490335
${'─'.repeat(30)}
📋 *Bill No:* ${saleData.bill_number}
📅 *Date:* ${dateStr}  ⏰ ${timeStr}
💳 *Payment:* ${saleData.payment_method.toUpperCase()}
${'─'.repeat(30)}
*Items Purchased:*
${itemLines}
${'─'.repeat(30)}
💰 *TOTAL: ₹${saleData.total_amount.toFixed(2)}*
${'─'.repeat(30)}
🙏 *Thank you for shopping with us!*
_Visit us again_ 😊`;

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.electronAPI.openWhatsApp(url);
}

// Checkout function (called from button)
async function checkout() {
  await processSale();
}

// Generate and print bill
function generateAndPrintBill(saleData) {
  const billHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bill - ${saleData.bill_number}</title>
      <style>
        @media print {
          @page { margin: 0; }
          body { margin: 1cm; }
        }
        body {
          font-family: 'Courier New', monospace;
          max-width: 300px;
          margin: 0 auto;
          padding: 10px;
        }
        .header {
          text-align: center;
          border-bottom: 2px dashed #000;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .header h2 {
          margin: 5px 0;
          font-size: 20px;
        }
        .header p {
          margin: 3px 0;
          font-size: 12px;
        }
        .bill-info {
          margin: 10px 0;
          font-size: 12px;
        }
        .bill-info div {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          font-size: 12px;
        }
        th, td {
          text-align: left;
          padding: 5px 2px;
        }
        th {
          border-bottom: 1px solid #000;
          border-top: 1px solid #000;
        }
        .item-row td {
          border-bottom: 1px dashed #ccc;
        }
        .totals {
          margin-top: 10px;
          border-top: 2px solid #000;
          padding-top: 10px;
        }
        .totals div {
          display: flex;
          justify-content: space-between;
          margin: 5px 0;
          font-size: 14px;
        }
        .grand-total {
          font-weight: bold;
          font-size: 16px;
          border-top: 1px solid #000;
          padding-top: 5px;
          margin-top: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 15px;
          padding-top: 10px;
          border-top: 2px dashed #000;
          font-size: 11px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>DAILY MART</h2>
        <p>FROM NATURE TO YOUR KITCHEN</p>
        <p>Phone: +91 9164490335</p>
      </div>

      <div class="bill-info">
        <div>
          <span>Bill No:</span>
          <span><strong>${saleData.bill_number}</strong></span>
        </div>
        <div>
          <span>Date:</span>
          <span>${new Date().toLocaleDateString()}</span>
        </div>
        <div>
          <span>Time:</span>
          <span>${new Date().toLocaleTimeString()}</span>
        </div>
        ${saleData.customer_phone ? `
        <div>
          <span>Customer:</span>
          <span>${saleData.customer_phone}</span>
        </div>
        ` : ''}
        <div>
          <span>Payment:</span>
          <span>${saleData.payment_method.toUpperCase()}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${saleData.items.map(item => `
            <tr class="item-row">
              <td>${item.name}</td>
              <td>${item.quantity}</td>
              <td>₹${item.unit_price.toFixed(2)}</td>
              <td>₹${item.total_price.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div>
          <span>Subtotal:</span>
          <span>₹${saleData.total_amount.toFixed(2)}</span>
        </div>
        <div class="grand-total">
          <span>TOTAL:</span>
          <span>₹${saleData.total_amount.toFixed(2)}</span>
        </div>
      </div>

      <div class="footer">
        <p><strong>Thank You! Visit Again!</strong></p>
        <p>Powered by Daily Mart POS</p>
      </div>

      <script>
        // Auto print when loaded
        window.onload = function() {
          window.print();
          setTimeout(function() {
            window.close();
          }, 100);
        };
      </script>
    </body>
    </html>
  `;

  // Open print window
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  printWindow.document.write(billHTML);
  printWindow.document.close();
}

async function generateBillNumber() {
  try {
    currentBillNumber = await window.electronAPI.getNextBillNumber();
  } catch {
    // Fallback to simple counter if IPC fails
    const n = parseInt(localStorage.getItem('billSeq') || '0') + 1;
    localStorage.setItem('billSeq', n);
    currentBillNumber = `BILL-${String(n).padStart(4, '0')}`;
  }
  // Update bill number display in panel
  const billNoEl = document.getElementById('billing-bill-no');
  if (billNoEl) billNoEl.textContent = currentBillNumber;
}

function updateBillingClock() {
  const now = new Date();
  const timeEl = document.getElementById('billing-time');
  const dateEl = document.getElementById('billing-date');
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
}

// =====================================================
// PRODUCTS
// =====================================================

function setupProductsListeners() {
  const form = document.getElementById('product-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Product form submitted');
      await saveProduct(form);
    });

    // When user hits Reset, also exit edit mode
    form.addEventListener('reset', () => {
      delete form.dataset.editId;
      document.getElementById('product-barcode').readOnly = false;
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Save Product';
      const cancelBtn = document.getElementById('cancel-edit-btn');
      if (cancelBtn) cancelBtn.style.display = 'none';
    });
  } else {
    console.error('Product form not found!');
  }

  const searchInput = document.getElementById('product-search-filter');
  if (searchInput) {
    searchInput.addEventListener('input', filterProducts);
  }
}

async function loadProducts() {
  try {
    allProducts = await window.electronAPI.getAllProducts();
    displayProducts(allProducts);
  } catch (error) {
    console.error('Error loading products:', error);
  }
}

function displayProducts(products) {
  const tbody = document.getElementById('products-table');
  if (!tbody) return;
  
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">No products found</td></tr>';
    return;
  }
  
  tbody.innerHTML = products.map(product => `
    <tr>
      <td><strong>${product.id}</strong></td>
      <td>${product.barcode}</td>
      <td>${product.name}</td>
      <td>${product.category}</td>
      <td>₹${product.buy_price.toFixed(2)}</td>
      <td>₹${product.sell_price.toFixed(2)}</td>
      <td>${product.quantity}</td>
      <td>
        <button class="btn btn-secondary" onclick="editProduct(${product.id})">Edit</button>
        <button class="btn btn-secondary" onclick="deleteProduct(${product.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function filterProducts() {
  const searchInput = document.getElementById('product-search-filter');
  if (!searchInput) return;
  
  const searchTerm = searchInput.value.toLowerCase().trim();
  
  if (!searchTerm) {
    displayProducts(allProducts);
    return;
  }
  
  const filtered = allProducts.filter(p =>
    p.barcode.toLowerCase().includes(searchTerm) ||
    p.name.toLowerCase().includes(searchTerm) ||
    p.category.toLowerCase().includes(searchTerm)
  );
  displayProducts(filtered);
}

async function saveProduct(form) {
  try {
    const barcode = form.querySelector('[name="barcode"]').value.trim();
    const name = form.querySelector('[name="name"]').value.trim();
    const category = form.querySelector('[name="category"]').value;
    const buy_price = parseFloat(form.querySelector('[name="buy-price"]').value);
    const sell_price = parseFloat(form.querySelector('[name="sell-price"]').value);
    const quantity = parseInt(form.querySelector('[name="quantity"]').value) || 0;

    if (!barcode || !name || !category) {
      alert('Please fill all required fields!');
      return;
    }

    if (isNaN(buy_price) || isNaN(sell_price)) {
      alert('Please enter valid prices!');
      return;
    }

    if (sell_price < buy_price) {
      alert('Sell price cannot be less than buy price!');
      return;
    }

    const editId = form.dataset.editId ? parseInt(form.dataset.editId) : null;

    if (editId) {
      // UPDATE existing product
      const product = { name, category, buy_price, sell_price, quantity };
      console.log('Updating product id:', editId, product);
      await window.electronAPI.updateProduct(editId, product);
      alert('Product updated successfully!');
    } else {
      // ADD new product
      const product = { barcode, name, category, buy_price, sell_price, quantity };
      console.log('Adding product:', product);
      await window.electronAPI.addProduct(product);
      alert('Product added successfully!');
    }

    // Reset form and edit state
    form.reset();
    delete form.dataset.editId;
    document.getElementById('product-barcode').readOnly = false;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Save Product';
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';

    await loadProducts();
    await loadDashboardStats();
  } catch (error) {
    console.error('Error saving product:', error);
    alert('Error: ' + (error.message || 'Unknown error'));
  }
}

async function deleteProduct(id) {
  if (confirm('Are you sure?')) {
    try {
      await window.electronAPI.deleteProduct(id);
      await loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  }
}

// =====================================================
// STOCK IN
// =====================================================

function setupStockInListeners() {
  const form = document.querySelector('form[id*="stock"]');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await addStockIn(form);
    });
  }
}

async function addStockIn(form) {
  const product_id = parseInt(form.querySelector('[name="product-id"]').value);
  const quantity = parseInt(form.querySelector('[name="quantity"]').value);
  const purchase_price = parseFloat(form.querySelector('[name="purchase-price"]').value);
  
  try {
    await window.electronAPI.addStockIn({ product_id, quantity, purchase_price });
    alert('Stock added successfully!');
    form.reset();
    await loadProducts();
    loadStockHistory();
  } catch (error) {
    console.error('Error adding stock:', error);
    alert('Error: ' + error.message);
  }
}

async function loadStockHistory() {
  try {
    const history = await window.electronAPI.getStockHistory();
    const tbody = document.getElementById('stock-history-table');
    
    if (!tbody) return;
    
    tbody.innerHTML = history.map(item => `
      <tr>
        <td>${new Date(item.date).toLocaleDateString()}</td>
        <td>${item.barcode}</td>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>₹${item.purchase_price.toFixed(2)}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading stock history:', error);
  }
}

// =====================================================
// REPORTS
// =====================================================

function setupReportsListeners() {
  document.querySelectorAll('.report-tab').forEach(tab => {
    tab.addEventListener('click', async (e) => {
      const report = e.target.getAttribute('data-report');
      switchReport(report);
    });
  });

  // Auto-load daily report when date changes
  const dailyDateInput = document.getElementById('daily-date');
  if (dailyDateInput) {
    dailyDateInput.addEventListener('change', () => loadDailyReport());
  }

  // Auto-load monthly report when month changes
  const monthlyInput = document.getElementById('monthly-month');
  if (monthlyInput) {
    monthlyInput.addEventListener('change', () => loadMonthlyReport());
  }
}

async function switchReport(report) {
  document.querySelectorAll('.report-section').forEach(section => {
    section.classList.remove('active');
  });
  const section = document.getElementById(`${report}-report`);
  if (section) section.classList.add('active');
  document.querySelectorAll('.report-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.getAttribute('data-report') === report) tab.classList.add('active');
  });
}

async function loadReports() {
  // Set today's date as default and load immediately
  const today = new Date().toISOString().split('T')[0];
  const dailyInput = document.getElementById('daily-date');
  if (dailyInput && !dailyInput.value) dailyInput.value = today;
  await loadDailyReport();
}

async function loadDailyReport() {
  const dateInput = document.getElementById('daily-date');
  const date = dateInput?.value || new Date().toISOString().split('T')[0];

  const tbody = document.getElementById('daily-sales-table');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

  try {
    const sales = await window.electronAPI.getSales({ startDate: date, endDate: date });

    // Update summary cards
    const totalAmount = sales.reduce((s, r) => s + r.total_amount, 0);
    const el = id => document.getElementById(id);
    if (el('daily-bills'))  el('daily-bills').textContent  = sales.length;
    if (el('daily-gross'))  el('daily-gross').textContent  = '₹' + totalAmount.toFixed(2);
    if (el('daily-net'))    el('daily-net').textContent    = '₹' + totalAmount.toFixed(2);

    if (!tbody) return;

    if (sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:20px; color:#888;">No sales on this date</td></tr>';
      return;
    }

    tbody.innerHTML = sales.map(sale => `
      <tr style="cursor:pointer;" onclick="toggleSaleItems(this, ${sale.id})">
        <td><strong>${sale.bill_number}</strong></td>
        <td>${new Date(sale.sale_date).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit', hour12:true})}</td>
        <td>${sale.items_count || 0} items</td>
        <td><strong>₹${sale.total_amount.toFixed(2)}</strong></td>
        <td><span style="background:#FFC107; padding:2px 8px; border-radius:4px; font-size:12px;">${sale.payment_method.toUpperCase()}</span></td>
        <td style="color:#FFC107;">▼ Details</td>
      </tr>
      <tr id="sale-items-${sale.id}" style="display:none; background:#fffbf0;">
        <td colspan="6" style="padding:0;">
          <div style="padding:10px 20px;">
            <em>Loading items...</em>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading daily report:', error);
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:red;">Error loading data</td></tr>';
  }
}

async function toggleSaleItems(row, saleId) {
  const itemsRow = document.getElementById(`sale-items-${saleId}`);
  if (!itemsRow) return;

  if (itemsRow.style.display !== 'none') {
    itemsRow.style.display = 'none';
    row.querySelector('td:last-child').textContent = '▼ Details';
    return;
  }

  itemsRow.style.display = 'table-row';
  row.querySelector('td:last-child').textContent = '▲ Hide';

  try {
    const items = await window.electronAPI.getSaleItems(saleId);
    itemsRow.querySelector('div').innerHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="background:#FFC107;">
            <th style="padding:6px 10px; text-align:left;">Product</th>
            <th style="padding:6px 10px; text-align:center;">Qty</th>
            <th style="padding:6px 10px; text-align:right;">Unit Price</th>
            <th style="padding:6px 10px; text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => `
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:5px 10px;">${i.product_name}</td>
              <td style="padding:5px 10px; text-align:center;">${i.quantity}</td>
              <td style="padding:5px 10px; text-align:right;">₹${i.unit_price.toFixed(2)}</td>
              <td style="padding:5px 10px; text-align:right;"><strong>₹${i.total_price.toFixed(2)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    itemsRow.querySelector('div').innerHTML = '<span style="color:red;">Error loading items</span>';
  }
}

async function loadMonthlyReport() {
  const monthInput = document.getElementById('monthly-month');
  const month = monthInput?.value;
  if (!month) return;

  const [year, mon] = month.split('-');
  const startDate = `${year}-${mon}-01`;
  const endDate = new Date(year, parseInt(mon), 0).toISOString().split('T')[0];

  try {
    const sales = await window.electronAPI.getSales({ startDate, endDate });
    const total = sales.reduce((s, r) => s + r.total_amount, 0);
    const avg = sales.length ? total / sales.length : 0;
    const el = id => document.getElementById(id);
    if (el('monthly-bills')) el('monthly-bills').textContent = sales.length;
    if (el('monthly-net'))   el('monthly-net').textContent   = '₹' + total.toFixed(2);
    if (el('monthly-avg'))   el('monthly-avg').textContent   = '₹' + avg.toFixed(2);
  } catch (error) {
    console.error('Error loading monthly report:', error);
  }
}

async function loadProfitReport() {
  // Stub — profit report can be implemented later
  console.log('Profit report not yet implemented');
}

// =====================================================
// EXPORT FUNCTIONS FOR GLOBAL USE
// =====================================================

window.navigateTo = navigateTo;
window.restockProduct = restockProduct;
window.removeFromCart = removeFromCart;
window.incrementCartItem = incrementCartItem;
window.decrementCartItem = decrementCartItem;
window.clearCart = clearCart;
window.editCartItemPrice = editCartItemPrice;
window.editProduct = editProduct;
window.cancelEdit = cancelEdit;
window.deleteProduct = deleteProduct;
window.checkout = checkout;
window.addDemoProducts = addDemoProducts;
window.showDatabaseLocation = showDatabaseLocation;
window.toggleSaleItems = toggleSaleItems;
window.loadDailyReport = loadDailyReport;
window.loadMonthlyReport = loadMonthlyReport;
window.loadProfitReport = loadProfitReport;

function editProduct(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  // Populate form fields
  document.getElementById('product-barcode').value = product.barcode;
  document.getElementById('product-barcode').readOnly = true; // barcode is unique key — don't change it
  document.getElementById('product-name').value = product.name;
  document.getElementById('product-category').value = product.category;
  document.getElementById('product-quantity').value = product.quantity;
  document.getElementById('product-buy-price').value = product.buy_price;
  document.getElementById('product-sell-price').value = product.sell_price;

  // Store editing state
  const form = document.getElementById('product-form');
  form.dataset.editId = id;

  // Update UI
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Update Product';

  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) cancelBtn.style.display = 'inline-block';

  // Scroll to form
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('product-name').focus();
}

function cancelEdit() {
  const form = document.getElementById('product-form');
  form.reset();
  delete form.dataset.editId;
  document.getElementById('product-barcode').readOnly = false;

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Save Product';

  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}
