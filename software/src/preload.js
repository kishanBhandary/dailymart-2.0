// Electron IPC API exposed to renderer process
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Product Management
  getAllProducts: () => ipcRenderer.invoke('get-all-products'),
  getDatabasePath: () => ipcRenderer.invoke('get-database-path'),
  addProduct: (product) => ipcRenderer.invoke('add-product', product),
  updateProduct: (id, product) => ipcRenderer.invoke('update-product', id, product),
  deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),
  getProductByBarcode: (barcode) => ipcRenderer.invoke('get-product-by-barcode', barcode),
  
  // Sales Management
  createSale: (saleData) => ipcRenderer.invoke('create-sale', saleData),
  getSales: (filters) => ipcRenderer.invoke('get-sales', filters),
  getSaleItems: (saleId) => ipcRenderer.invoke('get-sale-items', saleId),
  
  // Dashboard
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  getLowStockItems: () => ipcRenderer.invoke('get-low-stock-items'),
  
  // Stock Management
  addStockIn: (data) => ipcRenderer.invoke('add-stock-in', data),
  getStockHistory: () => ipcRenderer.invoke('get-stock-history'),

  // WhatsApp
  openWhatsApp: (url) => ipcRenderer.invoke('open-external-url', url),

  // Bill Number
  getNextBillNumber: () => ipcRenderer.invoke('get-next-bill-number'),

  // Auto Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAllReleases: () => ipcRenderer.invoke('get-all-releases'),
});