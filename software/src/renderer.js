/**
 * Daily Mart POS - Renderer Process
 * Handles UI interactions and page navigation
 */

import './index.css';

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🛒 Daily Mart POS Initialized');
  
  // Initialize UI
  initializeNavigation();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Initialize event listeners
  initializeBillingScreen();
  initializeProductScreen();
  initializeStockInScreen();
  initializeReportTabs();
  
  // Set default dates in report filters
  setDefaultDates();
  
  // Load dashboard data
  loadDashboardData();
});

// =====================================================
// NAVIGATION
// =====================================================

function initializeNavigation() {
  const navItems = document.querySelectorAll('.navbar-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageName = item.getAttribute('data-page');
      navigateTo(pageName);
      
      // Update active nav item
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

function navigateTo(pageName) {
  // Hide all pages
  const pages = document.querySelectorAll('.page');
  pages.forEach(page => page.classList.remove('active'));
  
  // Show selected page
  const targetPage = document.getElementById(`${pageName}-page`);
  if (targetPage) {
    targetPage.classList.add('active');
  }
  
  // Update active nav item
  const navItems = document.querySelectorAll('.navbar-item');
  navItems.forEach(nav => {
    if (nav.getAttribute('data-page') === pageName) {
      nav.classList.add('active');
    } else {
      nav.classList.remove('active');
    }
  });
}

// Make navigateTo global for onclick handlers
window.navigateTo = navigateTo;

// =====================================================
// DATE & TIME
// =====================================================

function updateDateTime() {
  const now = new Date();
  
  // Update time
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  document.getElementById('current-time').textContent = timeString;
  
  // Update date
  const dateString = now.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  document.getElementById('current-date').textContent = dateString;
}

// =====================================================
// DASHBOARD
// =====================================================

function loadDashboardData() {
  // Placeholder - in production, load from database
  document.getElementById('total-products').textContent = '156';
  document.getElementById('today-sales').textContent = '₹12,450';
  document.getElementById('low-stock-count').textContent = '8';
  document.getElementById('month-profit').textContent = '₹45,230';
  
  // Load low stock items (placeholder)
  const lowStockTable = document.getElementById('low-stock-table');
  lowStockTable.innerHTML = `
    <tr>
      <td>8905678901234</td>
      <td>Britannia Bread</td>
      <td>Bakery</td>
      <td class="text-red text-bold">2</td>
      <td><button class="btn btn-primary" onclick="navigateTo('stock-in')">Add Stock</button></td>
    </tr>
    <tr>
      <td>8906789012345</td>
      <td>Maggi Noodles</td>
      <td>Instant Food</td>
      <td class="text-red text-bold">3</td>
      <td><button class="btn btn-primary" onclick="navigateTo('stock-in')">Add Stock</button></td>
    </tr>
  `;
}

// =====================================================
// BILLING SCREEN
// =====================================================

let cart = [];

function initializeBillingScreen() {
  const barcodeInput = document.getElementById('barcode-input');
  const discountInput = document.getElementById('discount-input');
  
  if (barcodeInput) {
    barcodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleBarcodeScanned(barcodeInput.value.trim());
        barcodeInput.value = '';
      }
    });
  }
  
  if (discountInput) {
    discountInput.addEventListener('input', updateCartTotal);
  }
}

function handleBarcodeScanned(barcode) {
  if (!barcode) return;
  
  // Placeholder - in production, fetch from database
  const mockProduct = {
    barcode: barcode,
    name: 'Sample Product ' + barcode.slice(-4),
    price: 50.00,
    available: 100
  };
  
  addToCart(mockProduct);
}

function addToCart(product) {
  // Check if product already in cart
  const existingItem = cart.find(item => item.barcode === product.barcode);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      barcode: product.barcode,
      name: product.name,
      price: product.price,
      quantity: 1
    });
  }
  
  updateCartDisplay();
}

function updateCartDisplay() {
  const cartTable = document.getElementById('cart-items');
  
  if (cart.length === 0) {
    cartTable.innerHTML = '<tr><td colspan="5" class="text-center">Cart is empty. Scan a product to begin.</td></tr>';
    updateCartTotal();
    return;
  }
  
  cartTable.innerHTML = cart.map((item, index) => `
    <tr>
      <td>${item.name}</td>
      <td>
        <button onclick="updateQuantity(${index}, -1)">-</button>
        ${item.quantity}
        <button onclick="updateQuantity(${index}, 1)">+</button>
      </td>
      <td>₹${item.price.toFixed(2)}</td>
      <td>₹${(item.price * item.quantity).toFixed(2)}</td>
      <td>
        <button class="btn btn-secondary" onclick="removeFromCart(${index})">🗑️</button>
      </td>
    </tr>
  `).join('');
  
  updateCartTotal();
}

function updateQuantity(index, delta) {
  if (cart[index]) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
    }
    updateCartDisplay();
  }
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartDisplay();
}

function clearCart() {
  if (cart.length === 0) return;
  
  if (confirm('Clear all items from cart?')) {
    cart = [];
    updateCartDisplay();
  }
}

function updateCartTotal() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = parseFloat(document.getElementById('discount-input')?.value || 0);
  const total = Math.max(0, subtotal - discount);
  
  document.getElementById('cart-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
  document.getElementById('cart-total').textContent = `₹${total.toFixed(2)}`;
}

function checkout() {
  if (cart.length === 0) {
    alert('Cart is empty!');
    return;
  }
  
  const customerPhone = document.getElementById('customer-phone').value;
  const paymentMethod = document.getElementById('payment-method').value;
  const discount = parseFloat(document.getElementById('discount-input').value || 0);
  
  // Placeholder - in production, save to database
  const billNumber = 'BILL-' + Date.now();
  
  alert(`Bill Created Successfully!\n\nBill Number: ${billNumber}\nTotal: ${document.getElementById('cart-total').textContent}\nPayment: ${paymentMethod}\n\nPrint bill? (Feature coming soon)`);
  
  // Clear cart after checkout
  cart = [];
  updateCartDisplay();
  document.getElementById('customer-phone').value = '';
  document.getElementById('discount-input').value = '';
}

// Make functions global
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.checkout = checkout;

// =====================================================
// PRODUCT MANAGEMENT
// =====================================================

function initializeProductScreen() {
  const productForm = document.getElementById('product-form');
  const searchInput = document.getElementById('product-search');
  
  if (productForm) {
    productForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleProductSubmit();
    });
  }
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchProducts(e.target.value);
    });
  }
  
  // Load products
  loadProducts();
}

function handleProductSubmit() {
  const formData = {
    barcode: document.getElementById('product-barcode').value,
    name: document.getElementById('product-name').value,
    category: document.getElementById('product-category').value,
    quantity: document.getElementById('product-quantity').value,
    buy_price: document.getElementById('product-buy-price').value,
    sell_price: document.getElementById('product-sell-price').value
  };
  
  // Placeholder - in production, save to database
  console.log('Saving product:', formData);
  alert('Product saved successfully!');
  
  document.getElementById('product-form').reset();
  loadProducts();
}

function loadProducts() {
  const productsTable = document.getElementById('products-table');
  
  // Placeholder - in production, load from database
  productsTable.innerHTML = `
    <tr>
      <td>8901030123456</td>
      <td>Parle-G Biscuit 100g</td>
      <td>Biscuits</td>
      <td>₹10.00</td>
      <td>₹15.00</td>
      <td>50</td>
      <td>
        <button class="btn btn-primary">Edit</button>
        <button class="btn btn-secondary">Delete</button>
      </td>
    </tr>
    <tr>
      <td>8901234567890</td>
      <td>Colgate Toothpaste 200g</td>
      <td>Personal Care</td>
      <td>₹85.00</td>
      <td>₹120.00</td>
      <td>25</td>
      <td>
        <button class="btn btn-primary">Edit</button>
        <button class="btn btn-secondary">Delete</button>
      </td>
    </tr>
  `;
}

function searchProducts(query) {
  // Placeholder - in production, search database
  console.log('Searching for:', query);
}

// =====================================================
// STOCK IN
// =====================================================

function initializeStockInScreen() {
  const stockBarcodeInput = document.getElementById('stock-barcode');
  
  if (stockBarcodeInput) {
    stockBarcodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        loadProductForStockIn(stockBarcodeInput.value.trim());
      }
    });
  }
}

function loadProductForStockIn(barcode) {
  if (!barcode) return;
  
  // Placeholder - in production, fetch from database
  const mockProduct = {
    barcode: barcode,
    name: 'Sample Product',
    category: 'Category',
    quantity: 25,
    sell_price: 50.00
  };
  
  document.getElementById('stock-product-name').textContent = mockProduct.name;
  document.getElementById('stock-product-category').textContent = mockProduct.category;
  document.getElementById('stock-current-qty').textContent = mockProduct.quantity;
  document.getElementById('stock-sell-price').textContent = '₹' + mockProduct.sell_price;
  
  document.getElementById('stock-product-info').style.display = 'block';
}

function addStock() {
  const quantityToAdd = parseInt(document.getElementById('quantity-to-add').value);
  const notes = document.getElementById('stock-notes').value;
  
  if (!quantityToAdd || quantityToAdd <= 0) {
    alert('Please enter a valid quantity');
    return;
  }
  
  // Placeholder - in production, update database
  alert(`Stock added successfully!\n+${quantityToAdd} items`);
  
  document.getElementById('quantity-to-add').value = '';
  document.getElementById('stock-notes').value = '';
  document.getElementById('stock-barcode').value = '';
  document.getElementById('stock-product-info').style.display = 'none';
}

window.addStock = addStock;

// =====================================================
// REPORTS
// =====================================================

function initializeReportTabs() {
  const reportTabs = document.querySelectorAll('.report-tab');
  
  reportTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const reportType = tab.getAttribute('data-report');
      
      // Update active tab
      reportTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show selected report
      const reportSections = document.querySelectorAll('.report-section');
      reportSections.forEach(section => section.classList.remove('active'));
      
      document.getElementById(`${reportType}-report`).classList.add('active');
    });
  });
}

function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().substring(0, 7);
  
  if (document.getElementById('daily-date')) {
    document.getElementById('daily-date').value = today;
  }
  
  if (document.getElementById('monthly-month')) {
    document.getElementById('monthly-month').value = thisMonth;
  }
  
  if (document.getElementById('profit-end')) {
    document.getElementById('profit-end').value = today;
  }
}

function loadDailyReport() {
  // Placeholder - in production, load from database
  document.getElementById('daily-bills').textContent = '23';
  document.getElementById('daily-gross').textContent = '₹12,450';
  document.getElementById('daily-discount').textContent = '₹450';
  document.getElementById('daily-net').textContent = '₹12,000';
}

function loadMonthlyReport() {
  // Placeholder - in production, load from database
  document.getElementById('monthly-bills').textContent = '456';
  document.getElementById('monthly-net').textContent = '₹2,45,000';
  document.getElementById('monthly-avg').textContent = '₹537';
}

function loadProfitReport() {
  // Placeholder - in production, load from database
  document.getElementById('profit-revenue').textContent = '₹2,45,000';
  document.getElementById('profit-cost').textContent = '₹1,85,000';
  document.getElementById('profit-gross').textContent = '₹60,000';
  document.getElementById('profit-margin').textContent = '24.5%';
}

window.loadDailyReport = loadDailyReport;
window.loadMonthlyReport = loadMonthlyReport;
window.loadProfitReport = loadProfitReport;

console.log('👋 Daily Mart POS UI Ready');
