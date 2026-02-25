/**
 * Database Manager for Daily Mart POS System
 * Production-ready SQLite database operations
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor(dbPath = null) {
        // Use app data directory in production
        this.dbPath = dbPath || path.join(__dirname, '..', 'dailymart.db');
        this.db = null;
    }

    /**
     * Initialize database connection
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    // Enable foreign keys
                    this.db.run('PRAGMA foreign_keys = ON');
                    // Enable WAL mode for better concurrency
                    this.db.run('PRAGMA journal_mode = WAL');
                    console.log('Database connected successfully');
                    resolve();
                }
            });
        });
    }

    /**
     * Initialize database schema
     */
    async initializeSchema() {
        const schemaPath = path.join(__dirname, '..', 'database_schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));

        for (const statement of statements) {
            await this.run(statement);
        }
        
        console.log('Database schema initialized');
    }

    /**
     * Run a SQL query with parameters
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * Get a single row
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * Get all rows
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Execute transaction
     */
    async transaction(callback) {
        await this.run('BEGIN TRANSACTION');
        try {
            await callback();
            await this.run('COMMIT');
        } catch (error) {
            await this.run('ROLLBACK');
            throw error;
        }
    }

    // =====================================================
    // PRODUCT OPERATIONS
    // =====================================================

    /**
     * Get product by barcode
     */
    async getProductByBarcode(barcode) {
        return await this.get(
            'SELECT * FROM products WHERE barcode = ?',
            [barcode]
        );
    }

    /**
     * Add new product
     */
    async addProduct(product) {
        const { barcode, name, category, buy_price, sell_price, quantity = 0 } = product;
        
        return await this.run(
            `INSERT INTO products (barcode, name, category, buy_price, sell_price, quantity)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [barcode, name, category, buy_price, sell_price, quantity]
        );
    }

    /**
     * Update product
     */
    async updateProduct(id, updates) {
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), id];
        
        return await this.run(
            `UPDATE products SET ${fields} WHERE id = ?`,
            values
        );
    }

    /**
     * Search products
     */
    async searchProducts(searchTerm) {
        return await this.all(
            `SELECT * FROM products 
             WHERE barcode LIKE ? OR name LIKE ? OR category LIKE ?
             ORDER BY name`,
            [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
        );
    }

    /**
     * Get all products
     */
    async getAllProducts() {
        return await this.all('SELECT * FROM products ORDER BY name');
    }

    /**
     * Get low stock products
     */
    async getLowStockProducts() {
        return await this.all('SELECT * FROM low_stock_products');
    }

    // =====================================================
    // STOCK OPERATIONS
    // =====================================================

    /**
     * Add stock (Stock In)
     */
    async addStock(barcode, quantityAdded, notes = '', userId = null) {
        return await this.transaction(async () => {
            // Get product
            const product = await this.getProductByBarcode(barcode);
            if (!product) {
                throw new Error('Product not found');
            }

            // Update quantity
            await this.run(
                'UPDATE products SET quantity = quantity + ? WHERE id = ?',
                [quantityAdded, product.id]
            );

            // Record in history
            await this.run(
                `INSERT INTO stock_in_history (product_id, quantity_added, notes, user_id)
                 VALUES (?, ?, ?, ?)`,
                [product.id, quantityAdded, notes, userId]
            );

            return { success: true, newQuantity: product.quantity + quantityAdded };
        });
    }

    /**
     * Get stock history
     */
    async getStockHistory(productId, limit = 50) {
        return await this.all(
            `SELECT sih.*, p.name as product_name, p.barcode
             FROM stock_in_history sih
             JOIN products p ON sih.product_id = p.id
             WHERE sih.product_id = ?
             ORDER BY sih.date_time DESC
             LIMIT ?`,
            [productId, limit]
        );
    }

    // =====================================================
    // SALES OPERATIONS
    // =====================================================

    /**
     * Generate unique bill number
     */
    async generateBillNumber() {
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const lastBill = await this.get(
            `SELECT bill_number FROM sales 
             WHERE bill_number LIKE ? 
             ORDER BY id DESC LIMIT 1`,
            [`BILL-${today}-%`]
        );

        let sequence = 1;
        if (lastBill) {
            const lastSeq = parseInt(lastBill.bill_number.split('-').pop());
            sequence = lastSeq + 1;
        }

        return `BILL-${today}-${sequence.toString().padStart(4, '0')}`;
    }

    /**
     * Create sale
     */
    async createSale(saleData, items) {
        return await this.transaction(async () => {
            const { customer_phone, discount_amount = 0, payment_method = 'cash', user_id = null } = saleData;

            // Calculate totals
            const total_amount = items.reduce((sum, item) => sum + item.total_price, 0);
            const final_amount = total_amount - discount_amount;

            // Generate bill number
            const bill_number = await this.generateBillNumber();

            // Insert sale
            const saleResult = await this.run(
                `INSERT INTO sales (bill_number, total_amount, discount_amount, final_amount, 
                                   customer_phone, payment_method, user_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [bill_number, total_amount, discount_amount, final_amount, 
                 customer_phone, payment_method, user_id]
            );

            const sale_id = saleResult.lastID;

            // Insert sale items (triggers will handle stock reduction)
            for (const item of items) {
                const product = await this.getProductByBarcode(item.barcode);
                
                if (!product) {
                    throw new Error(`Product not found: ${item.barcode}`);
                }

                if (product.quantity < item.quantity) {
                    throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}`);
                }

                await this.run(
                    `INSERT INTO sale_items (sale_id, product_id, barcode, product_name, 
                                            quantity, unit_price, total_price)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [sale_id, product.id, product.barcode, product.name,
                     item.quantity, product.sell_price, item.quantity * product.sell_price]
                );
            }

            return { sale_id, bill_number, final_amount };
        });
    }

    /**
     * Get sale details
     */
    async getSaleDetails(billNumber) {
        const sale = await this.get(
            'SELECT * FROM sales WHERE bill_number = ?',
            [billNumber]
        );

        if (!sale) return null;

        const items = await this.all(
            'SELECT * FROM sale_items WHERE sale_id = ?',
            [sale.id]
        );

        return { ...sale, items };
    }

    /**
     * Mark WhatsApp sent
     */
    async markWhatsAppSent(billNumber) {
        return await this.run(
            'UPDATE sales SET whatsapp_sent = 1 WHERE bill_number = ?',
            [billNumber]
        );
    }

    // =====================================================
    // REPORTS
    // =====================================================

    /**
     * Get daily sales report
     */
    async getDailySalesReport(date = null) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        const summary = await this.get(
            `SELECT 
                COUNT(*) as total_bills,
                SUM(total_amount) as gross_sales,
                SUM(discount_amount) as total_discounts,
                SUM(final_amount) as net_sales,
                AVG(final_amount) as avg_bill_value
             FROM sales
             WHERE DATE(date_time) = ?`,
            [targetDate]
        );

        const sales = await this.all(
            `SELECT s.*, COUNT(si.id) as items_count
             FROM sales s
             LEFT JOIN sale_items si ON s.id = si.sale_id
             WHERE DATE(s.date_time) = ?
             GROUP BY s.id
             ORDER BY s.date_time DESC`,
            [targetDate]
        );

        return { summary, sales };
    }

    /**
     * Get monthly sales report
     */
    async getMonthlySalesReport(yearMonth = null) {
        const targetMonth = yearMonth || new Date().toISOString().substring(0, 7);
        
        return await this.get(
            `SELECT 
                COUNT(*) as total_bills,
                SUM(total_amount) as gross_sales,
                SUM(discount_amount) as total_discounts,
                SUM(final_amount) as net_sales,
                AVG(final_amount) as avg_bill_value
             FROM sales
             WHERE strftime('%Y-%m', date_time) = ?`,
            [targetMonth]
        );
    }

    /**
     * Get profit report
     */
    async getProfitReport(startDate, endDate = null) {
        const end = endDate || new Date().toISOString().split('T')[0];
        
        return await this.get(
            `SELECT 
                SUM(si.total_price) as total_revenue,
                SUM(si.quantity * p.buy_price) as total_cost,
                SUM(si.quantity * (si.unit_price - p.buy_price)) as gross_profit,
                ROUND((SUM(si.quantity * (si.unit_price - p.buy_price)) / SUM(si.total_price)) * 100, 2) as profit_margin
             FROM sales s
             JOIN sale_items si ON s.id = si.sale_id
             JOIN products p ON si.product_id = p.id
             WHERE DATE(s.date_time) BETWEEN ? AND ?`,
            [startDate, end]
        );
    }

    /**
     * Get top selling products
     */
    async getTopSellingProducts(days = 30, limit = 10) {
        return await this.all(
            `SELECT 
                p.barcode,
                p.name,
                p.category,
                COUNT(si.id) as times_sold,
                SUM(si.quantity) as total_quantity_sold,
                SUM(si.total_price) as total_revenue,
                SUM(si.quantity * (si.unit_price - p.buy_price)) as total_profit
             FROM products p
             JOIN sale_items si ON p.id = si.product_id
             JOIN sales s ON si.sale_id = s.id
             WHERE DATE(s.date_time) >= DATE('now', '-' || ? || ' days')
             GROUP BY p.id
             ORDER BY total_quantity_sold DESC
             LIMIT ?`,
            [days, limit]
        );
    }

    /**
     * Get stock value report
     */
    async getStockValueReport() {
        return await this.get(
            `SELECT 
                COUNT(*) as total_products,
                SUM(quantity) as total_items,
                SUM(quantity * buy_price) as total_investment,
                SUM(quantity * sell_price) as potential_revenue,
                SUM(quantity * (sell_price - buy_price)) as potential_profit
             FROM products`
        );
    }

    // =====================================================
    // USER OPERATIONS
    // =====================================================

    /**
     * Get user by username
     */
    async getUserByUsername(username) {
        return await this.get(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
    }

    /**
     * Create user
     */
    async createUser(username, passwordHash, role) {
        return await this.run(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            [username, passwordHash, role]
        );
    }

    /**
     * Close database connection
     */
    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) reject(err);
                    else {
                        console.log('Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = DatabaseManager;
