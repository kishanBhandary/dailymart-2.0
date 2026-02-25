# Database Schema - Quick Reference Guide

## 📊 Database Overview

Production-ready SQLite database for Daily Mart POS System with:
- **5 Core Tables**: Products, Users, Sales, Sale Items, Stock History
- **Automatic Triggers**: Stock management, timestamp updates
- **Built-in Views**: Low stock alerts, sales summaries
- **Complete Constraints**: Foreign keys, checks, unique indexes

---

## 🗃️ Tables Structure

### 1. **products**
Main inventory table with automatic stock management.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY |
| barcode | TEXT | UNIQUE, NOT NULL |
| name | TEXT | NOT NULL |
| category | TEXT | NOT NULL |
| buy_price | REAL | >= 0 |
| sell_price | REAL | >= buy_price |
| quantity | INTEGER | >= 0 |
| low_stock_threshold | INTEGER | Default: 4 |
| created_at | DATETIME | Auto |
| updated_at | DATETIME | Auto |

**Indexes**: barcode (unique), category, name, quantity

### 2. **stock_in_history**
Records all stock additions.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY |
| product_id | INTEGER | FK to products |
| quantity_added | INTEGER | Must be > 0 |
| date_time | DATETIME | Auto timestamp |
| notes | TEXT | Optional |
| user_id | INTEGER | FK to users |

### 3. **sales**
Main sales/billing table.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY |
| bill_number | TEXT | UNIQUE, Auto-generated |
| total_amount | REAL | Before discount |
| discount_amount | REAL | Discount applied |
| final_amount | REAL | After discount |
| customer_phone | TEXT | For WhatsApp |
| payment_method | TEXT | cash/card/upi/other |
| date_time | DATETIME | Auto |
| user_id | INTEGER | FK to users |
| whatsapp_sent | BOOLEAN | Default: 0 |

### 4. **sale_items**
Individual items in each sale.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY |
| sale_id | INTEGER | FK to sales |
| product_id | INTEGER | FK to products |
| barcode | TEXT | Snapshot |
| product_name | TEXT | Snapshot |
| quantity | INTEGER | Amount sold |
| unit_price | REAL | Price at sale time |
| total_price | REAL | quantity × price |

### 5. **users**
System users (admin, cashier, manager).

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY |
| username | TEXT | UNIQUE |
| password_hash | TEXT | Bcrypt hash |
| role | TEXT | admin/cashier/manager |

---

## 🔧 Using the Database Manager

### Initialize Database

```javascript
const DatabaseManager = require('./src/database');

const db = new DatabaseManager();
await db.connect();
await db.initializeSchema(); // First time only
```

### Product Operations

```javascript
// Add product
await db.addProduct({
    barcode: '8901234567890',
    name: 'Product Name',
    category: 'Category',
    buy_price: 50.00,
    sell_price: 70.00,
    quantity: 100
});

// Search by barcode
const product = await db.getProductByBarcode('8901234567890');

// Search products
const results = await db.searchProducts('parle');

// Get low stock items
const lowStock = await db.getLowStockProducts();
```

### Stock Management

```javascript
// Add stock (Stock In)
await db.addStock(
    '8901234567890',  // barcode
    50,                // quantity to add
    'New shipment',    // notes
    1                  // user_id
);

// Get stock history
const history = await db.getStockHistory(productId, 50);
```

### Sales/Billing

```javascript
// Create sale
const items = [
    { barcode: '8901234567890', quantity: 2 },
    { barcode: '8901030123456', quantity: 5 }
];

const sale = await db.createSale({
    customer_phone: '+919876543210',
    discount_amount: 10,
    payment_method: 'cash',
    user_id: 1
}, items);

console.log(sale.bill_number); // BILL-20260225-0001

// Get bill details
const billDetails = await db.getSaleDetails('BILL-20260225-0001');

// Mark WhatsApp sent
await db.markWhatsAppSent('BILL-20260225-0001');
```

### Reports

```javascript
// Daily sales report
const dailyReport = await db.getDailySalesReport('2026-02-25');
console.log(dailyReport.summary); // totals
console.log(dailyReport.sales);   // individual bills

// Monthly report
const monthlyReport = await db.getMonthlySalesReport('2026-02');

// Profit report
const profitReport = await db.getProfitReport(
    '2026-02-01',  // start date
    '2026-02-28'   // end date
);

// Top selling products
const topProducts = await db.getTopSellingProducts(30, 10);

// Stock value
const stockValue = await db.getStockValueReport();
```

---

## 🚨 Low Stock Alerts

### Automatic View

```javascript
// Get all low stock products (quantity < threshold)
const lowStock = await db.getLowStockProducts();

lowStock.forEach(product => {
    console.log(`${product.name}: ${product.quantity} left (need ${product.shortage} more)`);
});
```

### Custom SQL Query

```sql
SELECT * FROM products 
WHERE quantity < low_stock_threshold
ORDER BY quantity ASC;
```

---

## 🔒 Data Integrity Features

### Automatic Triggers

1. **Stock Validation**: Prevents selling more than available
2. **Auto Stock Decrease**: Reduces quantity when sale is created
3. **Auto Stock Increase**: Restores quantity on sale deletion (refund)
4. **Timestamp Updates**: Automatically updates `updated_at`

### Constraints

- ✅ Barcode must be unique
- ✅ Quantity cannot be negative
- ✅ Sell price must be >= buy price
- ✅ Foreign key enforcement
- ✅ Bill number uniqueness

---

## 📈 Common Queries

### Today's Sales Summary

```javascript
const today = new Date().toISOString().split('T')[0];
const report = await db.getDailySalesReport(today);
```

### Products Running Out

```javascript
const critical = await db.all(
    'SELECT * FROM products WHERE quantity < 2 ORDER BY quantity'
);
```

### Customer Purchase History

```javascript
const history = await db.all(
    `SELECT bill_number, date_time, final_amount
     FROM sales
     WHERE customer_phone = ?
     ORDER BY date_time DESC`,
    ['+919876543210']
);
```

### Best Profit Products

```javascript
const bestProfit = await db.all(
    `SELECT * FROM product_sales_performance 
     ORDER BY total_profit DESC 
     LIMIT 10`
);
```

---

## 🔐 Bill Number Format

Auto-generated: `BILL-YYYYMMDD-NNNN`

Example: `BILL-20260225-0001`

- **YYYYMMDD**: Date
- **NNNN**: Sequential number (resets daily)

---

## 📱 WhatsApp Integration

```javascript
// After creating sale
const billDetails = await db.getSaleDetails(billNumber);

// Format message
const message = `
🧾 Bill: ${billDetails.bill_number}
📅 Date: ${billDetails.date_time}
💰 Total: ₹${billDetails.final_amount}

Items:
${billDetails.items.map(item => 
    `${item.product_name} × ${item.quantity} = ₹${item.total_price}`
).join('\n')}

Thank you for shopping! 🙏
`;

// Send via WhatsApp API
// ... then mark as sent
await db.markWhatsAppSent(billNumber);
```

---

## 🛠️ Maintenance

### Database Backup

```bash
# Copy database file
cp dailymart.db dailymart_backup_$(date +%Y%m%d).db

# Or SQL dump
sqlite3 dailymart.db .dump > backup.sql
```

### Optimize Database

```javascript
await db.run('VACUUM');
await db.run('ANALYZE');
```

### Integrity Check

```javascript
const result = await db.get('PRAGMA integrity_check');
console.log(result); // Should return 'ok'
```

---

## 🚀 Performance Tips

1. **WAL Mode**: Already enabled for better concurrency
2. **Foreign Keys**: Enabled automatically
3. **Indexes**: Created on all frequently queried columns
4. **Transactions**: Use for bulk operations

```javascript
await db.transaction(async () => {
    // Multiple operations here
    await db.addProduct(...);
    await db.addStock(...);
    // All or nothing
});
```

---

## ⚠️ Error Handling

```javascript
try {
    await db.createSale(saleData, items);
} catch (error) {
    if (error.message.includes('Insufficient stock')) {
        // Handle out of stock
        alert('Some items are out of stock!');
    } else if (error.message.includes('UNIQUE constraint')) {
        // Handle duplicate barcode
        alert('Product with this barcode already exists!');
    } else {
        console.error('Database error:', error);
    }
}
```

---

## 📊 Sample Data

The schema includes sample data for testing:
- 1 admin user (username: `admin`, password: `admin123`)
- 5 sample products with various stock levels

**⚠️ Remember to change default password in production!**

---

## 🎯 Next Steps

1. Install dependencies: `npm install sqlite3`
2. Initialize database: Run schema file
3. Import DatabaseManager in your app
4. Build your UI around these operations
5. Implement authentication
6. Add WhatsApp API integration
7. Setup automated backups

---

## 📞 Support

For issues or questions:
- Check error messages carefully
- Verify data constraints
- Review foreign key relationships
- Test with sample data first
