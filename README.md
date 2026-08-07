# Beige Unisex Salon — Salon Management App

A tablet-friendly salon management app: dashboard, appointments, billing with
receipts, customer profiles, inventory (with automatic stock deduction),
services, employees & commissions, expenses, and reports.

## Run it locally

```bash
npm install
npm run dev
```

Then open the local URL it prints (usually http://localhost:5173).

## Deploy for free on Vercel (via GitHub)

1. **Create a GitHub repo** and push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Beige Unisex Salon app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and sign up/log in with your GitHub account.
3. Click **Add New → Project**, then pick the repo you just pushed.
4. Vercel auto-detects Vite — leave the default settings and click **Deploy**.
5. In a minute you'll get a live URL like `https://your-repo.vercel.app`.
6. Open that URL on the salon tablet, then use the browser's **"Add to Home
   Screen"** option so it behaves like an installed app.

## Important: data storage

This build saves all data (customers, bills, inventory, etc.) in the
browser's local storage on whichever device it's opened on. That means:

- It works immediately, no setup, no cost.
- Data does **not** sync between devices — a phone and the salon tablet will
  each have their own separate data.

If you want every device at the salon to see the same live data (recommended
once you're running this for real), the next step is wiring in a small
backend such as **Supabase** (free tier available). Ask Claude to help set
that up when you're ready — it's a small change to how data is loaded and
saved, not a redesign.
