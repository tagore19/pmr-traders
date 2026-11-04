# PMR Traders — Farm Box Distribution System

A full-stack B2B order management system for farm box distribution.

## Project Structure
```
PMR-Traders/
├── client/          # React + Vite frontend (port 5173)
└── server/          # Node.js + Express backend (port 4000)
```

---

## 🚀 Quick Start

### 1. Database Setup (PostgreSQL)

1. Open pgAdmin or psql and create the database:
   ```sql
   CREATE DATABASE pmr_traders;
   ```
2. Run the schema file:
   ```
   psql -U postgres -d pmr_traders -f server/src/db/schema.sql
   ```

### 2. Backend Setup

```powershell
cd server
copy .env.example .env        # then edit .env with your DB password
npm install
npm run seed                  # Creates Admin and Supervisor accounts
npm run dev                   # Starts API on http://localhost:4000
```

**Default Login Credentials:**
| Role       | Name           | Password   |
|------------|----------------|------------|
| Admin      | Admin Owner    | admin123   |
| Supervisor | Supervisor One | super123   |

### 3. Frontend Setup

```powershell
cd client
npm install
npm run dev                   # Opens http://localhost:5173
```

---

## 🔑 Role Capabilities

### Admin
- Set daily Paper Rate (blocks orders if not set)
- Full CRUD: Customers, Farms, Supervisors
- View customer ledger with outstanding dues & payment history
- Log daily stock intake from farms (private — hens/poultry)
- Record payments to farms, track remaining dues
- Override any Supervisor order

### Supervisor
- View today's paper rate
- Place new orders with live price preview
- View their own orders by date

---

## 💰 Pricing Formula

```
Customer Final Rate  = Paper Rate - Customer Minus Rate
Order Total          = Final Rate × Weight (kg)
```

## 🐔 Farm Stock Intake (Admin-only)

```
Net Weight      = KG Brought - Weight Loss
Payable to Farm = Net Weight × Rate per KG
```

---

## 🗄 Database Tables

| Table               | Purpose                              |
|---------------------|--------------------------------------|
| `users`             | Admins & Supervisors                 |
| `farms`             | Farm profiles                        |
| `customers`         | Customer profiles + minus rates      |
| `daily_rates`       | Daily paper rate set by Admin        |
| `orders`            | Customer delivery orders             |
| `customer_payments` | Payments received from customers     |
| `farm_stock_intake` | Daily hens/stock from farms          |
| `farm_payments`     | Payments made to farms               |
