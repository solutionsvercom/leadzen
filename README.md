# Lead Management Portal (MERN)

Multi-user lead management for **Instagram**, **Facebook**, **YouTube**, and **WhatsApp**. Leads are imported from **Google Form response sheets** (linked Google Sheets).

## Features

- **Onboarding step 1:** Business name, optional logo, your name, username, password
- **Onboarding step 2:** Paste Google Sheet URLs per platform (saved in browser until payment)
- **Onboarding step 3:** **Razorpay** checkout — account is created only after verified payment; sheet links are imported then
- **Dashboard:** View leads by platform, search, and re-sync sheets
- **Multi-tenant:** Each business account has isolated data

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [MongoDB](https://www.mongodb.com/) running locally, or a [MongoDB Atlas](https://www.mongodb.com/atlas) connection string

## Google Sheets setup

1. Create a Google Form for each channel (or one form per platform).
2. In the form: **Responses → Link to Sheets** (creates/opens the response spreadsheet).
3. Open the spreadsheet → **Share** → set to **Anyone with the link can view** (required for CSV import without OAuth).
4. Copy the spreadsheet URL and paste it in onboarding **step 3**, choosing the correct platform.

## Quick start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env (MongoDB, JWT, Razorpay keys for signup — see "Signup payment" below).
npm run dev
```

Server runs at `http://localhost:5001`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`.

## Project structure

```
backend/          Express API + public/ (built React app for production)
frontend/         React (Vite) source — build outputs to backend/public/
hosting/          Hostinger helpers (.htaccess, nginx example)
```

## Git & Hostinger deployment

- **`.gitignore`** — excludes `node_modules`, `.env`, `backend/public/*` (build output), and uploaded logos.
- **`DEPLOY-HOSTINGER.md`** — deploy **only `backend/`** to Hostinger (includes `public/` after build).
- **Build:** `npm run build` from project root → files go to **`backend/public/`**.
- **Run production:** `cd backend && npm start` with `NODE_ENV=production` and `SERVE_FRONTEND=1` in `backend/.env`.

Do **not** commit `backend/.env`. Set secrets in Hostinger’s environment variable panel.

## Super Admin portal

Open **http://localhost:5173/admin/login**

Default credentials (set in `backend/.env`):

| Variable | Default |
|----------|---------|
| `ADMIN_USERNAME` | superadmin |
| `ADMIN_PASSWORD` | admin123 |

**Admin can:**
- View all clients and lead counts
- Open any client dashboard (charts, leads, stats)
- Edit user account (name, username, active/disabled)
- Edit business name and onboarding status
- Add / edit / delete Google Sheet links per client
- Sync sheets for a client
- Add / enable / disable / delete platforms globally
- Delete a client and all their data

## Signup payment (Razorpay — verified)

New users complete **step 2** only through **Razorpay Checkout**. The server verifies the payment signature before creating the account — you cannot skip payment with a checkbox.

1. Create a [Razorpay](https://razorpay.com/) account and copy **Key ID** and **Key Secret** (use **Test** keys while developing).
   - If the dashboard asks for a **website URL**, that field is for your **public business site** (usually `https://…`). Razorpay typically **does not accept** `http://localhost:5173` there. Use your real domain, a staging site, or another **public** page you control; it does **not** have to match where you run this app locally. **Standard Checkout** on localhost still works in **Test mode** with test keys once keys are in `.env`.
2. Add to **`backend/.env`** (see **`backend/.env.example`**):
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_AMOUNT_PAISE` (amount in paise; minimum **100** = ₹1)
   - Optional: `RAZORPAY_BUSINESS_NAME`, `RAZORPAY_DESCRIPTION`
3. Restart the backend. On step 3, the user clicks **Pay securely**, completes payment in the Razorpay window, then the app registers them, imports sheet links, and opens the dashboard.

## API overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/payment-config` | Razorpay enabled flag, public key id, amount |
| POST | `/api/auth/payment-order` | Create Razorpay order for signup |
| GET | `/api/auth/payment-info` | Legacy optional UPI display fields |
| POST | `/api/auth/register` | Create business + user (requires verified Razorpay payment fields) |
| POST | `/api/auth/login` | Sign in |
| PATCH | `/api/business/logo` | Upload logo (multipart) |
| POST | `/api/business/sheet-links` | Add sheet URLs + sync |
| GET | `/api/leads` | List leads (`?platform=`, `?search=`) |
| POST | `/api/leads/sync` | Re-fetch all configured sheets |
| GET | `/api/admin/clients` | List all clients (super admin) |
| GET | `/api/admin/clients/:id` | Client dashboard data |
| PUT | `/api/admin/users/:id` | Update client user |
| PUT | `/api/admin/clients/:id` | Update business |
| POST/PUT/DELETE | `/api/admin/clients/:id/sheet-links` | Manage sheet links |
| GET/POST/PUT/DELETE | `/api/admin/platforms` | Manage platforms |

## Notes

- Sheet data is read via Google’s public CSV export. Private sheets need link sharing enabled.
- Form column names (Name, Email, Phone, etc.) appear as lead fields automatically.
- You can suggest UI/feature changes and extend from this simple baseline.
