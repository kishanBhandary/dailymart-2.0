-- =====================================================
-- PRODUCTION-READY SQLITE DATABASE SCHEMA
-- Daily Mart Point of Sale System
-- =====================================================

-- Enable foreign key constraints (must be done per connection in SQLite)
PRAGMA foreign_keys = ON;

-- =====================================================
-- 1. USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'cashier', 'manager')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);

-- =====================================================
-- 2. PRODUCTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    buy_price REAL NOT NULL CHECK(buy_price >= 0),
    sell_price REAL NOT NULL CHECK(sell_price >= buy_price),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
    low_stock_threshold INTEGER DEFAULT 4,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE UNIQUE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_low_stock ON products(quantity) WHERE quantity < 4;

-- =====================================================
-- 3. STOCK IN HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS stock_in_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity_added INTEGER NOT NULL CHECK(quantity_added > 0),
    date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    user_id INTEGER,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_stock_in_product ON stock_in_history(product_id);
CREATE INDEX idx_stock_in_date ON stock_in_history(date_time);

-- =====================================================
-- 4. SALES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT NOT NULL UNIQUE,
    total_amount REAL NOT NULL CHECK(total_amount >= 0),
    discount_amount REAL DEFAULT 0 CHECK(discount_amount >= 0),
    final_amount REAL NOT NULL CHECK(final_amount >= 0),
    customer_phone TEXT,
    payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'upi', 'other')),
    date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    whatsapp_sent BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_sales_bill_number ON sales(bill_number);
CREATE INDEX idx_sales_date ON sales(date_time);
CREATE INDEX idx_sales_customer_phone ON sales(customer_phone);

-- =====================================================
-- 5. SALE ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    barcode TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    total_price REAL NOT NULL CHECK(total_price >= 0),
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_sale_items_barcode ON sale_items(barcode);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- =====================================================

-- Update timestamp for products
CREATE TRIGGER update_products_timestamp 
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
    UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update timestamp for users
CREATE TRIGGER update_users_timestamp 
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =====================================================
-- TRIGGERS FOR STOCK MANAGEMENT
-- =====================================================

-- Prevent negative stock when creating sale items
CREATE TRIGGER check_stock_before_sale
BEFORE INSERT ON sale_items
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'Insufficient stock for product')
    WHERE (SELECT quantity FROM products WHERE id = NEW.product_id) < NEW.quantity;
END;

-- Auto-decrease stock when sale item is added
CREATE TRIGGER decrease_stock_on_sale
AFTER INSERT ON sale_items
FOR EACH ROW
BEGIN
    UPDATE products 
    SET quantity = quantity - NEW.quantity
    WHERE id = NEW.product_id;
END;

-- Auto-increase stock when sale is deleted (refund)
CREATE TRIGGER increase_stock_on_sale_delete
AFTER DELETE ON sale_items
FOR EACH ROW
BEGIN
    UPDATE products 
    SET quantity = quantity + OLD.quantity
    WHERE id = OLD.product_id;
END;

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Low stock products view
CREATE VIEW IF NOT EXISTS low_stock_products AS
SELECT 
    id,
    barcode,
    name,
    category,
    quantity,
    low_stock_threshold,
    (low_stock_threshold - quantity) as shortage
FROM products
WHERE quantity < low_stock_threshold
ORDER BY quantity ASC;

-- Daily sales summary view
CREATE VIEW IF NOT EXISTS daily_sales_summary AS
SELECT 
    DATE(date_time) as sale_date,
    COUNT(*) as total_bills,
    SUM(total_amount) as total_sales,
    SUM(discount_amount) as total_discounts,
    SUM(final_amount) as net_sales,
    AVG(final_amount) as avg_bill_value
FROM sales
GROUP BY DATE(date_time)
ORDER BY sale_date DESC;

-- Product sales performance view
CREATE VIEW IF NOT EXISTS product_sales_performance AS
SELECT 
    p.id,
    p.barcode,
    p.name,
    p.category,
    p.buy_price,
    p.sell_price,
    COALESCE(SUM(si.quantity), 0) as total_sold,
    COALESCE(SUM(si.total_price), 0) as total_revenue,
    COALESCE(SUM(si.quantity * (si.unit_price - p.buy_price)), 0) as total_profit
FROM products p
LEFT JOIN sale_items si ON p.id = si.product_id
GROUP BY p.id, p.barcode, p.name, p.category, p.buy_price, p.sell_price;

-- =====================================================
-- SAMPLE DATA (OPTIONAL - FOR TESTING)
-- =====================================================

-- Insert default admin user (password: admin123 - hashed with bcrypt)
-- Note: Replace with actual hashed password in production
INSERT OR IGNORE INTO users (username, password_hash, role) 
VALUES ('admin', '$2b$10$rKJHxLMNAKbKQYZ5IxJ8GuWzNvYvGhXN8xRlGJCkFTKqHKZd5HqP6', 'admin');

-- Sample products
INSERT OR IGNORE INTO products (barcode, name, category, buy_price, sell_price, quantity) VALUES
('8901030123456', 'Parle-G Biscuit 100g', 'Biscuits', 10.00, 15.00, 50),
('8901234567890', 'Colgate Toothpaste 200g', 'Personal Care', 85.00, 120.00, 25),
('8904567890123', 'Tata Salt 1kg', 'Grocery', 18.00, 22.00, 100),
('8905678901234', 'Maggi Noodles', 'Instant Food', 10.00, 14.00, 3),
('8906789012345', 'Britannia Bread', 'Bakery', 30.00, 40.00, 2);

-- =====================================================
-- COMMON QUERIES
-- =====================================================

-- ==================
-- 1. LOW STOCK ALERT
-- ==================
/*
SELECT * FROM low_stock_products;

-- Or with custom threshold
SELECT 
    barcode,
    name,
    category,
    quantity,
    (4 - quantity) as items_needed
FROM products
WHERE quantity < 4
ORDER BY quantity ASC;
*/

-- ==================
-- 2. STOCK IN (INCREASE QUANTITY)
-- ==================
/*
-- Add stock and record in history
BEGIN TRANSACTION;

UPDATE products 
SET quantity = quantity + 50 
WHERE barcode = '8901030123456';

INSERT INTO stock_in_history (product_id, quantity_added, notes, user_id)
SELECT id, 50, 'New stock arrival', 1
FROM products
WHERE barcode = '8901030123456';

COMMIT;
*/

-- ==================
-- 3. CREATE SALE (STOCK OUT WITH VALIDATION)
-- ==================
/*
-- Create a new sale
BEGIN TRANSACTION;

-- Insert sale header
INSERT INTO sales (bill_number, total_amount, discount_amount, final_amount, customer_phone, payment_method, user_id)
VALUES ('BILL-2026-0001', 44.00, 4.00, 40.00, '+919876543210', 'cash', 1);

-- Get the sale_id
-- In application code, use last_insert_rowid()

-- Insert sale items (triggers will auto-decrease stock)
INSERT INTO sale_items (sale_id, product_id, barcode, product_name, quantity, unit_price, total_price)
SELECT last_insert_rowid(), id, barcode, name, 2, sell_price, (2 * sell_price)
FROM products WHERE barcode = '8901030123456';

INSERT INTO sale_items (sale_id, product_id, barcode, product_name, quantity, unit_price, total_price)
SELECT last_insert_rowid(), id, barcode, name, 1, sell_price, (1 * sell_price)
FROM products WHERE barcode = '8901234567890';

COMMIT;
*/

-- ==================
-- 4. PREVENT NEGATIVE STOCK
-- ==================
/*
-- This is handled by trigger 'check_stock_before_sale'
-- Attempt to sell more than available will throw error:
-- Error: Insufficient stock for product
*/

-- ==================
-- 5. DAILY SALES REPORT
-- ==================
/*
SELECT * FROM daily_sales_summary
WHERE sale_date = DATE('now');

-- Detailed daily report
SELECT 
    s.bill_number,
    s.date_time,
    s.total_amount,
    s.discount_amount,
    s.final_amount,
    s.payment_method,
    s.customer_phone,
    COUNT(si.id) as items_count
FROM sales s
LEFT JOIN sale_items si ON s.id = si.id
WHERE DATE(s.date_time) = DATE('now')
GROUP BY s.id
ORDER BY s.date_time DESC;
*/

-- ==================
-- 6. MONTHLY SALES REPORT
-- ==================
/*
SELECT 
    strftime('%Y-%m', date_time) as month,
    COUNT(*) as total_bills,
    SUM(total_amount) as gross_sales,
    SUM(discount_amount) as total_discounts,
    SUM(final_amount) as net_sales,
    AVG(final_amount) as avg_bill_value
FROM sales
WHERE strftime('%Y-%m', date_time) = strftime('%Y-%m', 'now')
GROUP BY strftime('%Y-%m', date_time);
*/

-- ==================
-- 7. PROFIT REPORT (DAILY)
-- ==================
/*
SELECT 
    DATE(s.date_time) as sale_date,
    SUM(si.total_price) as total_revenue,
    SUM(si.quantity * p.buy_price) as total_cost,
    SUM(si.quantity * (si.unit_price - p.buy_price)) as gross_profit,
    ROUND((SUM(si.quantity * (si.unit_price - p.buy_price)) / SUM(si.total_price)) * 100, 2) as profit_margin_percent
FROM sales s
JOIN sale_items si ON s.id = si.sale_id
JOIN products p ON si.product_id = p.id
WHERE DATE(s.date_time) = DATE('now')
GROUP BY DATE(s.date_time);
*/

-- ==================
-- 8. PROFIT REPORT (MONTHLY)
-- ==================
/*
SELECT 
    strftime('%Y-%m', s.date_time) as month,
    SUM(si.total_price) as total_revenue,
    SUM(si.quantity * p.buy_price) as total_cost,
    SUM(si.quantity * (si.unit_price - p.buy_price)) as gross_profit,
    ROUND((SUM(si.quantity * (si.unit_price - p.buy_price)) / SUM(si.total_price)) * 100, 2) as profit_margin_percent
FROM sales s
JOIN sale_items si ON s.id = si.sale_id
JOIN products p ON si.product_id = p.id
WHERE strftime('%Y-%m', s.date_time) = strftime('%Y-%m', 'now')
GROUP BY strftime('%Y-%m', s.date_time);
*/

-- ==================
-- 9. PRODUCT WISE PROFIT ANALYSIS
-- ==================
/*
SELECT * FROM product_sales_performance
ORDER BY total_profit DESC;
*/

-- ==================
-- 10. TOP SELLING PRODUCTS
-- ==================
/*
SELECT 
    p.barcode,
    p.name,
    p.category,
    COUNT(si.id) as times_sold,
    SUM(si.quantity) as total_quantity_sold,
    SUM(si.total_price) as total_revenue
FROM products p
JOIN sale_items si ON p.id = si.product_id
JOIN sales s ON si.sale_id = s.id
WHERE DATE(s.date_time) >= DATE('now', '-30 days')
GROUP BY p.id
ORDER BY total_quantity_sold DESC
LIMIT 10;
*/

-- ==================
-- 11. SEARCH PRODUCT BY BARCODE
-- ==================
/*
SELECT * FROM products WHERE barcode = '8901030123456';
*/

-- ==================
-- 12. GET BILL DETAILS FOR WHATSAPP
-- ==================
/*
SELECT 
    s.bill_number,
    s.date_time,
    s.total_amount,
    s.discount_amount,
    s.final_amount,
    s.payment_method,
    s.customer_phone,
    si.product_name,
    si.quantity,
    si.unit_price,
    si.total_price
FROM sales s
JOIN sale_items si ON s.id = si.sale_id
WHERE s.bill_number = 'BILL-2026-0001'
ORDER BY si.id;
*/

-- ==================
-- 13. MARK WHATSAPP SENT
-- ==================
/*
UPDATE sales 
SET whatsapp_sent = 1 
WHERE bill_number = 'BILL-2026-0001';
*/

-- ==================
-- 14. CUSTOMER PURCHASE HISTORY
-- ==================
/*
SELECT 
    s.bill_number,
    s.date_time,
    s.final_amount,
    COUNT(si.id) as items_purchased
FROM sales s
JOIN sale_items si ON s.id = si.sale_id
WHERE s.customer_phone = '+919876543210'
GROUP BY s.id
ORDER BY s.date_time DESC;
*/

-- ==================
-- 15. STOCK VALUE REPORT
-- ==================
/*
SELECT 
    SUM(quantity * buy_price) as total_investment,
    SUM(quantity * sell_price) as potential_revenue,
    SUM(quantity * (sell_price - buy_price)) as potential_profit
FROM products;
*/

-- =====================================================
-- MAINTENANCE QUERIES
-- =====================================================

-- Clean old stock history (older than 1 year)
/*
DELETE FROM stock_in_history 
WHERE date_time < DATE('now', '-1 year');
*/

-- Vacuum database to reclaim space
/*
VACUUM;
*/

-- Analyze database for query optimization
/*
ANALYZE;
*/

-- =====================================================
-- DATABASE BACKUP RECOMMENDATION
-- =====================================================
/*
For production use, implement regular backups:

1. File-based backup (copy the SQLite file)
2. SQL dump: sqlite3 database.db .dump > backup.sql
3. Use WAL mode for better concurrency:
   PRAGMA journal_mode=WAL;
4. Regular integrity checks:
   PRAGMA integrity_check;
*/
