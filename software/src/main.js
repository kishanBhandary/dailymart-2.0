const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Auto-updater config
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Database path - declared here, set inside initializeDatabase after app is ready
let dbPath = null;
let db = null;

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

    console.log('✅ All database tables initialized');
  });
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

// IPC Handlers for Products
ipcMain.handle('get-all-products', async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM products ORDER BY name', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
});

ipcMain.handle('add-product', async (event, product) => {
  return new Promise((resolve, reject) => {
    const { barcode, name, category, buy_price, sell_price, quantity } = product;
    
    console.log('Adding product:', { barcode, name, category, buy_price, sell_price, quantity });
    
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
  });
});

ipcMain.handle('update-product', async (event, id, product) => {
  return new Promise((resolve, reject) => {
    const { name, category, buy_price, sell_price, quantity } = product;
    db.run(
      'UPDATE products SET name = ?, category = ?, buy_price = ?, sell_price = ?, quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, category, buy_price, sell_price, quantity, id],
      (err) => {
        if (err) reject(err);
        else resolve({ success: true });
      }
    );
  });
});

ipcMain.handle('delete-product', async (event, id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM products WHERE id = ?', [id], (err) => {
      if (err) reject(err);
      else resolve({ success: true });
    });
  });
});

ipcMain.handle('get-product-by-barcode', async (event, barcode) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM products WHERE barcode = ?', [barcode], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
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
  // Remove default menu bar
  Menu.setApplicationMenu(null);

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

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

  // Check for updates silently (only in production)
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
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
