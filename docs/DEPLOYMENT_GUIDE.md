# 🚀 Complete Deployment Guide: Hostinger + Cloudflare Pages

**Your Setup:**
- **Backend (API):** Hostinger VPS → `api.doorsteptn.in`
- **Frontend (Website):** Cloudflare Pages → `doorsteptn.in` & `www.doorsteptn.in`
- **Domain:** `doorsteptn.in` (purchased)

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:
- [ ] Hostinger VPS access (hPanel login)
- [ ] Cloudflare account (free tier is fine)
- [ ] Domain `doorsteptn.in` ready
- [ ] GitHub repository with your code (or create one)
- [ ] Firebase service account JSON file ready

---

# PART 1: HOSTINGER VPS - BACKEND DEPLOYMENT

## Step 1: Log into Hostinger hPanel

1. Go to [hpanel.hostinger.com](https://hpanel.hostinger.com)
2. Click on your VPS server
3. Note down your **Server IP Address** (you'll need this later)

## Step 2: Access Your VPS via SSH

### Option A: Using Hostinger Browser Terminal
1. In hPanel → Click **"Terminal"** or **"Browser terminal"**
2. You're now connected!

### Option B: Using Your Local Terminal (Mac)
```bash
# Replace YOUR_VPS_IP with your actual IP address
ssh root@YOUR_VPS_IP
```

> [!NOTE]
> If prompted for password, use the root password from hPanel → **Server Details**

## Step 3: Install Required Software on VPS

Run these commands **one by one** (copy-paste each):

### Update System
```bash
apt update && apt upgrade -y
```

### Install Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### Verify Node.js
```bash
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x
```

### Install PM2 (Process Manager)
```bash
npm install -g pm2
```

### Install PostgreSQL
```bash
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
```

### Install Redis
```bash
apt install -y redis-server
systemctl start redis-server
systemctl enable redis-server
```

### Install Nginx (Reverse Proxy)
```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

## Step 4: Setup PostgreSQL Database

### Access PostgreSQL
```bash
sudo -u postgres psql
```

### Run These SQL Commands (inside PostgreSQL)
```sql
-- Create database
CREATE DATABASE doorstep_db;

-- Create user with password (CHANGE 'your_secure_password' to something strong!)
CREATE USER doorstep_user WITH ENCRYPTED PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE doorstep_db TO doorstep_user;

-- Connect to the database
\c doorstep_db

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO doorstep_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO doorstep_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO doorstep_user;

-- Exit PostgreSQL
\q
```

> [!IMPORTANT]
> **Write down your password!** You'll need it for the `.env` file.

## Step 5: Create App Directory & Upload Code

### Create Directory
```bash
mkdir -p /var/www/doorstep-api
cd /var/www/doorstep-api
```

### Option A: Clone from GitHub (Recommended)
```bash
# First, push your code to GitHub if not done already
# Then on server:
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
```

### Option B: Upload via SCP (from Your Mac)
Open **a new terminal on your Mac**:
```bash
# Go to your project folder
cd /Users/vjaadhi2799/Downloads/works/full_stack_app

# Upload to server (excluding node_modules)
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' . root@YOUR_VPS_IP:/var/www/doorstep-api/
```

## Step 6: Install Dependencies & Build

Back on your **VPS terminal**:
```bash
cd /var/www/doorstep-api

# Install dependencies
npm install

# Build the application
npm run build
```

## Step 7: Create Production Environment File

```bash
nano /var/www/doorstep-api/.env
```

**Paste this content (edit the values):**
```env
# Database Configuration
DATABASE_URL=postgresql://doorstep_user:your_secure_password@localhost:5432/doorstep_db
PGDATABASE=doorstep_db
PGHOST=localhost
PGPORT=5432
PGUSER=doorstep_user
PGPASSWORD=your_secure_password
DB_POOL_SIZE=20
DB_READ_POOL_SIZE=20

# Server Configuration
PORT=5000
HOST=0.0.0.0
NODE_ENV=production
SESSION_SECRET=GENERATE_A_LONG_RANDOM_STRING_HERE

# CORS Configuration (your frontend domains)
ALLOWED_ORIGINS=https://doorsteptn.in,https://www.doorsteptn.in

# Session Settings
SESSION_COOKIE_SAMESITE=none
SESSION_COOKIE_SECURE=true
SESSION_TTL_SECONDS=2592000

# Redis
REDIS_URL=redis://localhost:6379

# URLs
FRONTEND_URL=https://doorsteptn.in
APP_BASE_URL=https://api.doorsteptn.in

# Admin Credentials
ADMIN_EMAIL=your_admin_email@example.com
ADMIN_PASSWORD=YourSecureAdminPassword

# Firebase (copy these from your current .env)
VITE_FIREBASE_API_KEY=AIzaSyDs4MJm55Aelkvfgh4cC9Yj6KHbyK-yFdY
VITE_FIREBASE_AUTH_DOMAIN=vaasal-d888a.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=vaasal-d888a
VITE_FIREBASE_STORAGE_BUCKET=vaasal-d888a.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=490481415278
VITE_FIREBASE_APP_ID=1:490481415278:web:92e6ac583ad95eb7d3627f

# Job Scheduling
BOOKING_EXPIRATION_CRON=0 * * * *
PAYMENT_REMINDER_CRON=30 * * * *
CRON_TZ=Asia/Kolkata

# Disable test flags
USE_IN_MEMORY_DB=false
DISABLE_RATE_LIMITERS=false
DISABLE_REDIS=false
```

**Save:** Press `Ctrl + X`, then `Y`, then `Enter`

### Generate a Secure Session Secret
```bash
# Run this to generate a random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and put it in `SESSION_SECRET` above.

## Step 8: Upload Firebase Service Account

From **your Mac terminal**:
```bash
scp /Users/vjaadhi2799/Downloads/vaasal-d888a-firebase-adminsdk-fbsvc-05917515c2.json root@YOUR_VPS_IP:/var/www/doorstep-api/firebase-service-account.json
```

Then add to `.env` on VPS:
```bash
nano /var/www/doorstep-api/.env
```
Add this line:
```env
FIREBASE_SERVICE_ACCOUNT_PATH=/var/www/doorstep-api/firebase-service-account.json
```

## Step 9: Run Database Migrations

```bash
cd /var/www/doorstep-api
npm run db:migrate
```

## Step 10: Start Application with PM2

```bash
cd /var/www/doorstep-api

# Start the app
pm2 start ecosystem.config.js

# Save PM2 config (auto-restart on reboot)
pm2 save
pm2 startup
```

### Useful PM2 Commands
```bash
pm2 status          # Check if running
pm2 logs            # View logs
pm2 restart server  # Restart app
pm2 stop server     # Stop app
```

## Step 11: Configure Nginx Reverse Proxy

### Create Nginx Config
```bash
nano /etc/nginx/sites-available/doorstep-api
```

**Paste this:**
```nginx
server {
    listen 80;
    server_name api.doorsteptn.in;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # File uploads
    client_max_body_size 50M;
}
```

### Enable the Config
```bash
ln -s /etc/nginx/sites-available/doorstep-api /etc/nginx/sites-enabled/
nginx -t                    # Test config
systemctl reload nginx      # Apply changes
```

## Step 12: Install SSL Certificate (Free HTTPS)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d api.doorsteptn.in
```

Follow the prompts:
1. Enter your email
2. Agree to terms: `Y`
3. Share email: `N` (optional)
4. Redirect HTTP to HTTPS: Choose `2` (Redirect)

## Step 13: Configure Firewall

```bash
# Enable firewall
ufw allow ssh
ufw allow http
ufw allow https
ufw enable
```

## Step 14: Test Backend

Open in browser: `https://api.doorsteptn.in/api/health`

You should see:
```json
{"status":"ok","uptime":123,"timestamp":1234567890}
```

---

# PART 2: CLOUDFLARE PAGES - FRONTEND DEPLOYMENT

## Step 1: Push Code to GitHub

On **your Mac**:
```bash
cd /Users/vjaadhi2799/Downloads/works/full_stack_app

# If not already a git repo
git init
git add .
git commit -m "Prepare for Cloudflare deployment"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/doorstep-app.git
git branch -M main
git push -u origin main
```

## Step 2: Login to Cloudflare

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign up or login
3. Click **"Workers & Pages"** in left sidebar

## Step 3: Create New Pages Project

1. Click **"Create application"**
2. Click **"Pages"** tab
3. Click **"Connect to Git"**
4. If first time: **"Connect GitHub"** → Authorize Cloudflare
5. Select your repository: `doorstep-app`
6. Click **"Begin setup"**

## Step 4: Configure Build Settings

Set these values:

| Setting | Value |
|---------|-------|
| **Project name** | `doorsteptn` |
| **Production branch** | `main` |
| **Framework preset** | `None` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist/public` |
| **Root directory** | _(leave empty)_ |

## Step 5: Add Environment Variables

Click **"Environment variables"** → **"Add variable"**

Add these variables:

| Variable Name | Value |
|---------------|-------|
| `VITE_API_URL` | `https://api.doorsteptn.in` |
| `VITE_FIREBASE_API_KEY` | `AIzaSyDs4MJm55Aelkvfgh4cC9Yj6KHbyK-yFdY` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `vaasal-d888a.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `vaasal-d888a` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `vaasal-d888a.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `490481415278` |
| `VITE_FIREBASE_APP_ID` | `1:490481415278:web:92e6ac583ad95eb7d3627f` |

## Step 6: Deploy

Click **"Save and Deploy"**

Wait 2-5 minutes for the build to complete. Once done, you'll get a URL like:
`https://doorsteptn.pages.dev`

---

# PART 3: CONNECT YOUR DOMAIN

## Step 1: Add Domain to Cloudflare

1. In Cloudflare Dashboard → **"Add a Site"**
2. Enter: `doorsteptn.in`
3. Choose **Free Plan** → Continue
4. Cloudflare will scan DNS records

## Step 2: Update Nameservers at Hostinger

1. Go to **Hostinger hPanel** → **Domains** → `doorsteptn.in`
2. Find **"Nameservers"** section
3. Change to Cloudflare's nameservers (shown on Cloudflare):
   ```
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```
   (Actual names shown in your Cloudflare dashboard)
4. Save changes

> [!WARNING]
> DNS propagation takes **5 minutes to 48 hours**. Usually ~1 hour.

## Step 3: Configure DNS Records in Cloudflare

Go to **Cloudflare Dashboard** → **DNS** → **Records**

### Add These Records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| **A** | `api` | `YOUR_VPS_IP` | Proxied (Orange cloud) |
| **A** | `@` | `YOUR_VPS_IP` | Proxied |
| **CNAME** | `www` | `doorsteptn.in` | Proxied |

## Step 4: Connect Custom Domain to Cloudflare Pages

1. Go to **Workers & Pages** → your project (`doorsteptn`)
2. Click **"Custom domains"** tab
3. Click **"Set up a custom domain"**
4. Enter: `doorsteptn.in` → Click **Continue**
5. Add another: `www.doorsteptn.in` → Click **Continue**

Cloudflare will automatically configure the DNS for the Pages site.

## Step 5: SSL/TLS Settings

1. Go to **Cloudflare Dashboard** → **SSL/TLS**
2. Set mode to: **"Full (strict)"**
3. Go to **Edge Certificates**:
   - Enable: **Always Use HTTPS**
   - Enable: **Automatic HTTPS Rewrites**

---

# PART 4: UPDATE FRONTEND TO USE API

Before your final deployment, ensure your frontend knows where the API is.

## Create/Update: `client/src/config.ts`

Make sure your API calls use the environment variable:
```typescript
export const API_URL = import.meta.env.VITE_API_URL || '';
```

---

# PART 5: FINAL VERIFICATION ✅

## Test URLs:

| URL | What It Should Show |
|-----|---------------------|
| `https://api.doorsteptn.in/api/health` | JSON health status |
| `https://doorsteptn.in` | Your app homepage |
| `https://www.doorsteptn.in` | Your app homepage |

## Troubleshooting Commands (VPS):

```bash
# Check if server is running
pm2 status

# View server logs
pm2 logs server

# Check Nginx errors
tail -f /var/log/nginx/error.log

# Restart everything
pm2 restart all
systemctl restart nginx
```

---

# 📝 Quick Reference

## Your Final URLs:
- **Frontend:** `https://doorsteptn.in`
- **API:** `https://api.doorsteptn.in`

## Key Files on VPS:
- App: `/var/www/doorstep-api/`
- Env: `/var/www/doorstep-api/.env`
- Nginx: `/etc/nginx/sites-available/doorstep-api`

## Update Workflow:

### Backend Updates:
```bash
cd /var/www/doorstep-api
git pull origin main
npm install
npm run build
pm2 restart all
```

### Frontend Updates:
Just push to GitHub - Cloudflare auto-deploys!

---

> [!TIP]
> **Keep this guide saved!** You can refer back to it whenever you need to make updates or troubleshoot issues.
