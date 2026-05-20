# Deploying on Hostinger (backend folder only)

The React app is built into **`backend/public/`**. On Hostinger you deploy **only the `backend/` folder** — the server serves the API, uploads, and the UI from that one directory.

Use **MongoDB Atlas** for production (Hostinger does not provide local MongoDB).

---

## 1. Build locally (before every deploy)

From the **project root** (needs both `frontend/` and `backend/`):

```bash
npm run install:all
npm run build
```

Or from `frontend/`:

```bash
cd frontend
npm install
npm run build
```

This writes `index.html` and assets into **`backend/public/`**.

Verify: `backend/public/index.html` exists.

---

## 2. Prepare `backend/` for upload

Your deploy package should include:

```
backend/
  server.js
  package.json
  package-lock.json
  routes/
  models/
  ...
  public/          ← built UI (required)
  uploads/         ← empty or existing logos
  .env             ← create on server (never commit)
```

On the server (or before zipping):

```bash
cd backend
npm install --production
```

Do **not** upload `frontend/` to Hostinger if you only need the live app.

---

## 3. Hostinger hPanel — Node.js

1. **Websites** → your site → **Node.js**.
2. **Application root:** `backend` (or upload contents of `backend` as the app root).
3. **Startup file:** `server.js`
4. **Start command:** `npm start`
5. **Build command:** leave empty **or** skip — build `public/` on your PC before deploy.  
   If Hostinger clones the **full repo**, you can use:

   ```bash
   cd .. && npm run install:all && npm run build && cd backend && npm install --production
   ```

   with application root still set to `backend`.

6. **Environment variables** (copy from `backend/.env.example`):

   | Variable | Example |
   |----------|---------|
   | `NODE_ENV` | `production` |
   | `SERVE_FRONTEND` | `1` |
   | `HOST` | `0.0.0.0` |
   | `MONGODB_URI` | `mongodb+srv://...` |
   | `JWT_SECRET` | long random string |
   | `CLIENT_URL` | `https://yourdomain.com` |
   | `ADMIN_USERNAME` / `ADMIN_PASSWORD` | super admin |
   | `RAZORPAY_*` | live keys in production |

7. Enable **SSL**; set `CLIENT_URL` to `https://yourdomain.com`.

Open your domain — React app at `/`, API at `/api/...`.

---

## 4. FTP / ZIP deploy

1. Run `npm run build` on your machine.
2. Zip the `backend` folder (include `public/`, exclude `node_modules` if you will run `npm install` on the server).
3. Upload to Hostinger; set Node app root to that folder; `npm install --production`; restart.

---

## 5. VPS + PM2

From project root after build:

```bash
cd backend
npm install --production
pm2 start ../ecosystem.config.cjs
```

`ecosystem.config.cjs` runs with `cwd` = `backend/`.

---

## 6. Static-only on `public_html` (optional)

If the API is on another server:

1. Upload **contents** of `backend/public/` to `public_html/`.
2. Copy `hosting/public_html.htaccess` for SPA routing.
3. Set `VITE_API_BASE` when building (see `frontend/.env.example`).

---

## Local production test

```bash
npm run build
cd backend
# .env: NODE_ENV=production SERVE_FRONTEND=1 CLIENT_URL=http://localhost:5001
npm start
```

Open `http://localhost:5001`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank page | Run `npm run build`; ensure `backend/public/index.html` exists. |
| `public` missing on server | Build locally before upload; include `public/` in ZIP. |
| CORS errors | `CLIENT_URL` must match your live `https://` URL. |
| MongoDB failed | Atlas IP allowlist + correct `MONGODB_URI`. |
