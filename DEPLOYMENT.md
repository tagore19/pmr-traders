# 🚀 PMR Traders — Deployment Guide

This repository is fully configured for **1-click cloud deployment** on [Render](https://render.com), [Railway](https://railway.app), [Neon](https://neon.tech), or any Node.js + PostgreSQL host.

---

## ⚡ What Was Configured for Cloud Deployment

1. **Unified Full-Stack Deployment (Zero CORS)**:
   - In production, the Express backend automatically builds and serves the Vite React frontend as static files.
   - All API endpoints remain under `/api/*`.
   - Both frontend and backend run together under **a single free web service**.
2. **Dynamic Database Connection**:
   - Accepts cloud standard `DATABASE_URL` (Render, Neon, Supabase, Railway) with automated SSL handling.
   - Still supports local development parameters (`DB_HOST`, `DB_USER`, etc.).
3. **Automated Schema & Seed Migration (`AUTO_MIGRATE=true`)**:
   - On the very first boot on the cloud, the server automatically reads `schema.sql`, creates all tables, sequences, indexes, and extensions, and seeds initial groups and default Admin/Supervisor accounts.
4. **Clean Git Configuration**:
   - `.gitignore` configured to keep local `.env`, credentials, logs, and `node_modules` secure.
5. **Render Blueprint (`render.yaml`)**:
   - Pre-configured infrastructure file for automated 1-click provisioning of both Web Service and PostgreSQL database.

---

## 🌐 Method 1: Deploy on Render (Recommended)

### Step 1: Push Your Code to GitHub
1. Create a new repository on [GitHub](https://github.com/new) (e.g. `pmr-traders`).
2. Run in PowerShell / Terminal:
   ```bash
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/pmr-traders.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 2: Deploy Using Render Blueprint (1-Click)
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub repository `pmr-traders`.
4. Render will detect `render.yaml` and show:
   - **pmr-traders** (Node Web Service)
   - **pmr-traders-db** (PostgreSQL Database)
5. Click **Apply**.
6. Render will:
   - Provision the PostgreSQL database.
   - Link `DATABASE_URL`.
   - Build client and server (`npm run build`).
   - Start the app with `npm start`.
   - Automatically run migrations and seed default users (`AUTO_MIGRATE=true`).

---

### Step 3 (Alternative): Manual Web Service on Render
If you prefer creating services manually instead of using Blueprints:

1. **Create PostgreSQL Database**:
   - Dashboard → **New +** → **PostgreSQL**.
   - Name: `pmr-traders-db`
   - Database: `pmr_traders`
   - Plan: **Free** (or Starter)
   - Region: **Singapore** (or closest to you)
   - Click **Create Database**.
   - Once ready, copy the **Internal Database URL** (or External URL if connecting externally).

2. **Create Web Service**:
   - Dashboard → **New +** → **Web Service**.
   - Connect your GitHub repository.
   - **Name**: `pmr-traders`
   - **Region**: Same as database (e.g., Singapore)
   - **Runtime**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
   - Add **Environment Variables**:
     | Key | Value |
     |---|---|
     | `NODE_ENV` | `production` |
     | `AUTO_MIGRATE` | `true` |
     | `DATABASE_URL` | *(paste the database URL from step 1)* |
     | `JWT_SECRET` | *(click 'Generate' or enter a random secure string)* |
3. Click **Create Web Service**.

Your app will be live at `https://pmr-traders.onrender.com`!

---

## 💡 Pro-Tip: Permanent Free Database (Neon / Supabase)
Render's free PostgreSQL tier expires after 30 days unless upgraded to a paid plan ($7/mo).

To keep your app **100% free forever**:
1. Create a free account at [Neon.tech](https://neon.tech) or [Supabase.com](https://supabase.com).
2. Create a new PostgreSQL database.
3. Copy the Postgres connection string:
   `postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require`
4. In your Render Web Service settings, set `DATABASE_URL` to this connection string!

---

## 🔑 Default Login Credentials

Once deployed, the system automatically initializes these default users:

| Role | Username | Password | Notes |
|---|---|---|---|
| **Admin** | `Admin Owner` | `admin123` | Full access: Paper rates, farm intake costs, margins, ledgers |
| **Supervisor** | `Suresh Supervisor` | `suresh123` | Access to Suresh Group orders and dispatches |
| **Supervisor** | `Sathish Supervisor` | `sathish123` | Access to Sathish Group orders and dispatches |

> [!IMPORTANT]
> After logging in for the first time in production, change the default passwords or create new admin users.

---

## 🛠 Useful Commands

- **Run database migrations manually**:
  ```bash
  npm run db:init
  ```
- **Local development**:
  - Backend: `cd server && npm run dev`
  - Frontend: `cd client && npm run dev`
- **Full production build test**:
  ```bash
  npm run build
  npm start
  ```
