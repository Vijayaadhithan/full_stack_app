#!/bin/bash
set -e

REPO_URL=${REPO_URL:-"https://example.com/full_stack_app.git"}
APP_DIR=${APP_DIR:-"/opt/full_stack_app"}
NODE_VERSION=${NODE_VERSION:-"18.x"}
DATABASE_URL=${DATABASE_URL:-"postgres://user:pass@localhost:5432/app"}
BACKUP_BUCKET=${BACKUP_BUCKET:-"s3://my-bucket/backups"}

# Install Node.js, nginx, PM2 and helpers
curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION | bash -
apt-get update
apt-get install -y nodejs git nginx awscli cron
npm install -g pm2

# Fetch or update the application code
if [ ! -d "$APP_DIR" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull
fi

# Environment variables
cat <<ENV > "$APP_DIR/.env"
DATABASE_URL=$DATABASE_URL
NODE_ENV=production
PORT=3000
ENV

# Build and start with PM2
cd "$APP_DIR"
npm install
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $(whoami) --hp $(eval echo ~$USER)

# Backup script for nightly pg_dump
cat <<'SCRIPT' >/usr/local/bin/pg_backup.sh
#!/bin/bash
set -e
DATE=$(date +%F)
pg_dump "$DATABASE_URL" | gzip | aws s3 cp - "$BACKUP_BUCKET/db-$DATE.sql.gz"
SCRIPT
chmod +x /usr/local/bin/pg_backup.sh

# Cron job at 3am UTC
( crontab -l 2>/dev/null; echo "0 3 * * * DATABASE_URL=$DATABASE_URL BACKUP_BUCKET=$BACKUP_BUCKET /usr/local/bin/pg_backup.sh" ) | crontab -

echo "Provisioning complete"