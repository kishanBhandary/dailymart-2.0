# 🚀 Quick Start Guide - Daily Mart POS

## Installation & Running

### Prerequisites
- Node.js installed
- npm or yarn

### Setup Steps

1. **Install Dependencies**
   ```bash
   cd /home/kishan/Documents/dailymart/software
   npm install
   ```

2. **Install SQLite (if not already)**
   ```bash
   npm install sqlite3
   ```

3. **Run the Application**
   ```bash
   npm start
   ```

4. **Initialize Database (First Time)**
   - Database will be created automatically
   - Sample data will be loaded
   - Default admin user created

---

## 🎨 UI Features

### Horizontal Yellow Navbar
- **Logo:** 🛒 Daily Mart (left)
- **Menu Items:** Dashboard, Billing, Products, Stock In, Reports, Settings
- **Date/Time:** Live clock (right side)
- **Active Highlight:** Yellow-dark background

### Available Screens

#### 1. **Dashboard** 📊
- Total products count
- Today's sales amount
- Low stock alert count
- Monthly profit
- Quick action buttons
- Low stock items table

#### 2. **Billing** 💳
- Barcode scanner input
- Shopping cart table
- Quantity adjustment (+/-)
- Discount input
- Customer phone (WhatsApp)
- Payment method selector
- Large checkout button

#### 3. **Products** 📦
- Add/Edit product form
- Search functionality
- Product list table
- Edit/Delete actions

#### 4. **Stock In** 📥
- Barcode scan
- Product info display
- Quantity addition
- Notes field
- Stock history

#### 5. **Reports** 📈
- Daily sales report
- Monthly sales report
- Profit analysis
- Top selling products

#### 6. **Settings** ⚙️
- Shop information
- Database management
- About section

---

## 🎯 How to Use

### Billing Workflow
1. Click **Billing** in navbar
2. Scan or type barcode in input
3. Press **Enter** to add to cart
4. Adjust quantities with +/- buttons
5. Enter discount (optional)
6. Enter customer phone (optional)
7. Select payment method
8. Click **Checkout & Print Bill**

### Adding Products
1. Click **Products** in navbar
2. Fill in product details
   - Barcode (unique)
   - Name
   - Category
   - Buy & Sell prices
   - Initial quantity
3. Click **Save Product**

### Adding Stock
1. Click **Stock In** in navbar
2. Scan product barcode
3. Product info appears
4. Enter quantity to add
5. Add notes (optional)
6. Click **Add Stock**

### Viewing Reports
1. Click **Reports** in navbar
2. Select report tab
3. Choose date/period
4. Click **Generate**

---

## 🎨 Theme Customization

Current theme is **Yellow & White**. To customize:

### Change Primary Color
Edit `src/index.css`:
```css
:root {
  --yellow-primary: #FFC107;  /* Change this */
  --yellow-hover: #FFB300;    /* Change this */
  --yellow-dark: #FFA000;     /* Change this */
}
```

### Popular Alternative Themes

**Blue Professional:**
```css
--primary: #2196F3;
--hover: #1976D2;
--dark: #0D47A1;
```

**Green Fresh:**
```css
--primary: #4CAF50;
--hover: #388E3C;
--dark: #1B5E20;
```

**Orange Warm:**
```css
--primary: #FF9800;
--hover: #F57C00;
--dark: #E65100;
```

---

## 🔧 Development Tips

### Hot Reload
The app uses Webpack with hot reload. Changes to CSS/JS will auto-refresh.

### Debugging
- Open DevTools: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
- Console logs available in DevTools
- Inspect elements for styling

### Database Location
- Default: `software/dailymart.db`
- Can be configured in `src/database.js`

---

## 📋 Keyboard Shortcuts (Future)

| Key | Action |
|-----|--------|
| F1 | Go to Dashboard |
| F2 | Go to Billing |
| F3 | Go to Products |
| F4 | Go to Stock In |
| F5 | Go to Reports |
| Esc | Clear current form |

---

## 🐛 Troubleshooting

### App won't start
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
npm start
```

### CSS not loading
- Check `index.html` has `<link rel="stylesheet" href="index.css" />`
- Verify Webpack config includes CSS loader

### Database errors
- Delete `dailymart.db` and restart
- Check SQLite3 is installed: `npm list sqlite3`

---

## 📱 Screen Resolution Support

| Resolution | Support Level |
|------------|---------------|
| 1920x1080 | ✅ Optimal |
| 1366x768 | ✅ Full support |
| 1280x720 | ✅ Supported |
| <1024 | ⚠️ Limited |

**Recommended:** 1366x768 or higher

---

## 🔄 Next Steps

1. ✅ UI Design Complete
2. ✅ Database Schema Ready
3. 🔄 Connect UI to Database
4. ⏳ WhatsApp Integration
5. ⏳ Thermal Printer Support
6. ⏳ Barcode Scanner Hardware
7. ⏳ User Authentication

---

## 📞 Support

For issues or features:
1. Check UI_DESIGN_DOCUMENTATION.md
2. Check DATABASE_GUIDE.md
3. Review database_schema.sql
4. Inspect browser console logs

---

**Happy Selling! 🛒**
