const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Auto-updater config
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Update event listeners
autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: 'The update will be downloaded in the background. You will be notified when it is ready to install.',
      buttons: ['OK']
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'The update will be installed when you close the application. Click "Restart Now" to install immediately.',
      buttons: ['Restart Now', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('No updates available');
  // Only show dialog if user manually checked (not on automatic checks)
  if (mainWindow && mainWindow.isFocused()) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'No Updates Available',
      message: 'You are using the latest version!',
      detail: `Current version: ${app.getVersion()}`,
      buttons: ['OK']
    });
  }
});

autoUpdater.on('error', (err) => {
  console.error('AutoUpdater error:', err);
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates',
      detail: 'Please check your internet connection and try again later.',
      buttons: ['OK']
    });
  }
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Database path - declared here, set inside initializeDatabase after app is ready
let dbPath = null;
let db = null;

// Global reference to main window for dialogs
let mainWindow = null;

// Initialize SQLite Database
const initializeDatabase = () => {
  dbPath = path.join(app.getPath('userData'), 'daily_mart.db');
  console.log('Database path:', dbPath);
  
  db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
      console.error('Database connection error:', err);
      return;
    }
    console.log('✓ Connected to SQLite database at:', dbPath);
    
    // Enable WAL mode for better performance
    db.run('PRAGMA journal_mode=WAL');
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) {
        console.error('Error enabling foreign keys:', err);
      } else {
        console.log('✓ Foreign keys enabled');
      }
    });
    
    createTables();
  });
};

// Create Database Tables
const createTables = () => {
  db.serialize(() => {
    // Products table
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN (
          'Beverages', 'Biscuits', 'Dairy', 'Snacks', 'Ice Creams', 
          'Frozen Foods', 'Bakery', 'Fruits & Vegetables', 'Meat & Seafood',
          'Instant Food', 'Cooking Oil', 'Spices & Masala', 'Rice & Grains',
          'Pulses & Dals', 'Sauces & Condiments', 'Health Drinks', 'Confectionery',
          'Personal Care', 'Health & Wellness', 'Baby Care', 'Cleaning Supplies',
          'Detergents', 'Household Items', 'Stationery', 'Pet Care', 'Other'
        )),
        buy_price REAL NOT NULL CHECK(buy_price >= 0),
        sell_price REAL NOT NULL CHECK(sell_price >= buy_price),
        quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
        low_stock_threshold INTEGER DEFAULT 4,
        is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating products table:', err);
      else console.log('✓ Products table ready');
    });

    // Create indexes for products
    db.run('CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)');
    db.run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)');
    db.run('CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)');

    // Sales table
    db.run(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_number TEXT UNIQUE NOT NULL,
        total_amount REAL NOT NULL CHECK(total_amount >= 0),
        payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'upi', 'other')),
        customer_phone TEXT,
        sale_date DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating sales table:', err);
      else console.log('✓ Sales table ready');
    });

    // Create indexes for sales
    db.run('CREATE INDEX IF NOT EXISTS idx_sales_bill_number ON sales(bill_number)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)');

    // Sales Items table
    db.run(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        barcode TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        unit_price REAL NOT NULL CHECK(unit_price >= 0),
        total_price REAL NOT NULL CHECK(total_price >= 0),
        FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES products(id)
      )
    `, (err) => {
      if (err) console.error('Error creating sale_items table:', err);
      else console.log('✓ Sale items table ready');
    });

    // Create indexes for sale_items
    db.run('CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id)');

    // Stock In table
    db.run(`
      CREATE TABLE IF NOT EXISTS stock_in (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        purchase_price REAL NOT NULL CHECK(purchase_price >= 0),
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('Error creating stock_in table:', err);
      else console.log('✓ Stock table ready');
    });

    // Create index for stock_in
    db.run('CREATE INDEX IF NOT EXISTS idx_stock_in_product ON stock_in(product_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_stock_in_date ON stock_in(date)');

    console.log(' All database tables initialized');    
    // Migration: Add is_active column if it doesn't exist
    db.run('ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1))', (err) => {
      if (err) {
        // Column already exists or other error
        if (err.message && err.message.includes('duplicate column')) {
          console.log('✓ Products table schema already up to date');
        }
      } else {
        console.log('✓ Migration: Added is_active column to products table');
      }
    });  });
};

// IPC Handler to get database path
ipcMain.handle('get-database-path', async () => {
  return dbPath;
});

// IPC Handler to get next sequential bill number
ipcMain.handle('get-next-bill-number', async () => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT bill_number FROM sales WHERE bill_number LIKE 'BILL-%' AND LENGTH(bill_number) <= 12 ORDER BY CAST(SUBSTR(bill_number, 6) AS INTEGER) DESC LIMIT 1`,
      (err, row) => {
        if (err) { reject(err); return; }
        let next = 1;
        if (row) {
          const num = parseInt(row.bill_number.replace('BILL-', ''));
          if (!isNaN(num)) next = num + 1;
        }
        resolve(`BILL-${String(next).padStart(4, '0')}`);
      }
    );
  });
});

// IPC Handler to open external URLs (used for WhatsApp)
ipcMain.handle('open-external-url', async (event, url) => {
  await shell.openExternal(url);
  return { success: true };
});

// IPC Handler to check for updates
ipcMain.handle('check-for-updates', async () => {
  if (app.isPackaged) {
    try {
      await autoUpdater.checkForUpdates();
      return { success: true, message: 'Checking for updates...' };
    } catch (error) {
      console.error('Update check error:', error);
      return { success: false, message: 'Failed to check for updates' };
    }
  } else {
    return { success: false, message: 'Update check only available in production' };
  }
});

// IPC Handlers for Products
ipcMain.handle('get-all-products', async () => {
  return new Promise((resolve, reject) => {
    // Try with is_active first, fall back if column doesn't exist
    db.all('SELECT * FROM products ORDER BY name', [], (err, rows) => {
      if (err) reject(err);
      else {
        // Ensure is_active defaults to 1 if not present
        const products = rows.map(p => ({
          ...p,
          is_active: p.is_active !== undefined ? p.is_active : 1
        }));
        resolve(products);
      }
    });
  });
});

ipcMain.handle('add-product', async (event, product) => {
  return new Promise((resolve, reject) => {
    const { barcode, name, category, buy_price, sell_price, quantity, is_active } = product;
    
    console.log('Adding product:', { barcode, name, category, buy_price, sell_price, quantity, is_active });
    
    // Check if is_active column exists
    db.get("PRAGMA table_info(products)", [], (err, row) => {
      // Try with is_active, fall back to without if it fails
      const hasIsActive = !err;
      
      if (hasIsActive && is_active !== undefined) {
        db.run(
          'INSERT INTO products (barcode, name, category, buy_price, sell_price, quantity, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [barcode, name, category, buy_price, sell_price, quantity, is_active],
          function (err) {
            if (err) {
              console.error('Database error adding product:', err);
              reject(new Error(err.message));
            } else {
              console.log('Product added successfully with ID:', this.lastID);
              resolve({ id: this.lastID });
            }
          }
        );
      } else {
        db.run(
          'INSERT INTO products (barcode, name, category, buy_price, sell_price, quantity) VALUES (?, ?, ?, ?, ?, ?)',
          [barcode, name, category, buy_price, sell_price, quantity],
          function (err) {
            if (err) {
              console.error('Database error adding product:', err);
              reject(new Error(err.message));
            } else {
              console.log('Product added successfully with ID:', this.lastID);
              resolve({ id: this.lastID });
            }
          }
        );
      }
    });
  });
});

ipcMain.handle('update-product', async (event, id, product) => {
  return new Promise((resolve, reject) => {
    const { name, category, buy_price, sell_price, quantity, is_active } = product;
    
    // Try with is_active first, fall back without it
    const query = is_active !== undefined 
      ? 'UPDATE products SET name = ?, category = ?, buy_price = ?, sell_price = ?, quantity = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      : 'UPDATE products SET name = ?, category = ?, buy_price = ?, sell_price = ?, quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    const params = is_active !== undefined
      ? [name, category, buy_price, sell_price, quantity, is_active, id]
      : [name, category, buy_price, sell_price, quantity, id];
    
    db.run(query, params, (err) => {
      if (err) {
        // If error is about is_active column, retry without it
        if (err.message && err.message.includes('is_active')) {
          db.run(
            'UPDATE products SET name = ?, category = ?, buy_price = ?, sell_price = ?, quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [name, category, buy_price, sell_price, quantity, id],
            (err2) => {
              if (err2) reject(err2);
              else resolve({ success: true });
            }
          );
        } else {
          reject(err);
        }
      } else {
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle('delete-product', async (event, id) => {
  return new Promise((resolve, reject) => {
    // First check if product is used in any sales
    db.get(
      'SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?',
      [id],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row.count > 0) {
          // Product is used in sales, return specific error
          reject({
            code: 'PRODUCT_IN_USE',
            message: `Cannot delete this product. It has been used in ${row.count} sale(s). You can edit it or mark it as discontinued instead.`
          });
          return;
        }
        
        // Safe to delete
        db.run('DELETE FROM products WHERE id = ?', [id], (err) => {
          if (err) reject(err);
          else resolve({ success: true });
        });
      }
    );
  });
});

ipcMain.handle('get-product-by-barcode', async (event, barcode) => {
  return new Promise((resolve, reject) => {
    // Try with is_active filter first
    db.get('SELECT * FROM products WHERE barcode = ?', [barcode], (err, row) => {
      if (err) {
        reject(err);
      } else if (row) {
        // Filter out inactive products if the column exists
        if (row.is_active === 0) {
          resolve(null); // Product is discontinued
        } else {
          resolve(row);
        }
      } else {
        resolve(null);
      }
    });
  });
});

// IPC Handlers for Sales
ipcMain.handle('create-sale', async (event, saleData) => {
  return new Promise((resolve, reject) => {
    const { bill_number, total_amount, payment_method, customer_phone, items } = saleData;
    
    db.run(
      'INSERT INTO sales (bill_number, total_amount, payment_method, customer_phone) VALUES (?, ?, ?, ?)',
      [bill_number, total_amount, payment_method, customer_phone],
      function (err) {
        if (err) {
          reject(err);
          return;
        }
        
        const saleId = this.lastID;
        let completed = 0;
        let hasError = false;

        // Insert sale items
        items.forEach((item) => {
          db.run(
            'INSERT INTO sale_items (sale_id, product_id, barcode, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [saleId, item.product_id, item.barcode, item.name, item.quantity, item.unit_price, item.total_price],
            (err) => {
              if (err) {
                hasError = true;
                reject(err);
                return;
              }
              completed++;

              // Update product quantity
              db.run(
                'UPDATE products SET quantity = quantity - ? WHERE id = ?',
                [item.quantity, item.product_id],
                (err) => {
                  if (err && !hasError) {
                    hasError = true;
                    reject(err);
                  } else if (completed === items.length && !hasError) {
                    resolve({ id: saleId, bill_number });
                  }
                }
              );
            }
          );
        });
      }
    );
  });
});

ipcMain.handle('get-sales', async (event, { startDate, endDate }) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT s.*, 
        (SELECT SUM(quantity) FROM sale_items WHERE sale_id = s.id) as items_count
      FROM sales s
      WHERE DATE(s.sale_date) BETWEEN ? AND ?
      ORDER BY s.sale_date DESC
    `;
    db.all(query, [startDate, endDate], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
});

ipcMain.handle('get-sale-items', async (event, saleId) => {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id',
      [saleId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
});

// IPC Handlers for Dashboard Statistics
ipcMain.handle('get-dashboard-stats', async () => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT SUM(quantity) FROM products) as total_quantity,
        (SELECT COUNT(*) FROM products WHERE quantity < 4) as low_stock_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE DATE(sale_date) = DATE('now')) as today_sales,
        (SELECT COALESCE(SUM((sell_price - buy_price) * quantity), 0) FROM products) as inventory_value
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows?.[0] || {});
    });
  });
});

ipcMain.handle('get-low-stock-items', async () => {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT id, barcode, name, category, quantity FROM products WHERE quantity < 4 ORDER BY quantity ASC',
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
});

// IPC Handler for Stock In
ipcMain.handle('add-stock-in', async (event, { product_id, quantity, purchase_price }) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO stock_in (product_id, quantity, purchase_price) VALUES (?, ?, ?)',
      [product_id, quantity, purchase_price],
      (err) => {
        if (err) reject(err);
        else {
          // Update product quantity
          db.run(
            'UPDATE products SET quantity = quantity + ? WHERE id = ?',
            [quantity, product_id],
            (err) => {
              if (err) reject(err);
              else resolve({ success: true });
            }
          );
        }
      }
    );
  });
});

ipcMain.handle('get-stock-history', async () => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT si.id, p.barcode, p.name, si.quantity, si.purchase_price, si.date
      FROM stock_in si
      JOIN products p ON si.product_id = p.id
      ORDER BY si.date DESC
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
});

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  // Create application menu with Help option
  const menuTemplate = [
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            if (app.isPackaged) {
              autoUpdater.checkForUpdates();
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Checking for Updates',
                message: 'Checking for updates...',
                detail: 'Please wait while we check for available updates.',
                buttons: ['OK']
              });
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Development Mode',
                message: 'Update check is only available in production.',
                detail: 'Please use the packaged app to check for updates.',
                buttons: ['OK']
              });
            }
          }
        },
        { type: 'separator' },
        {
          label: `Version ${app.getVersion()}`,
          enabled: false
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Disable DevTools in production (comment out for debugging)
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  initializeDatabase();
  createWindow();

  // Check for updates (only in production)
  if (app.isPackaged) {
    // Check immediately on startup
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000); // Wait 3 seconds after startup
    
    // Check for updates every 4 hours
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 4 * 60 * 60 * 1000);
  }

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (db) {
    db.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
