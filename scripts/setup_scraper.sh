#!/bin/bash
# Setup scraper VM on Ubuntu 22.04+
# Esegui come root o con sudo

set -e

echo "=== Setup Scraper VM ==="

# Update system
apt-get update && apt-get upgrade -y

# Install deps
apt-get install -y python3 python3-pip python3-venv git curl

# Install Playwright deps
apt-get install -y \
  libnss3 libnspr4 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0

# Setup app directory
mkdir -p /opt/scraper
cd /opt/scraper

# Clone repo (replace with your actual repo URL if different)
if [ ! -d ".git" ]; then
  git clone https://github.com/Leonardo-Lalli/Cosa-facciamo-stasera-.git .
fi

# Setup venv
python3 -m venv venv
source venv/bin/activate
pip install playwright
playwright install chromium

# Setup cron (ogni 4 ore)
cat > /etc/cron.d/scraper <<EOF
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
0 */4 * * * root cd /opt/scraper && git pull && source venv/bin/activate && python scripts/scrape_maps.py && git add data/ && git commit -m "Auto-scraped venues" && git push
EOF

chmod 644 /etc/cron.d/scraper

echo ""
echo "✅ Setup completato!"
echo "Il primo scrape parte al prossimo giro del cron (ogni 4 ore)."
echo "Per testarlo subito:"
echo "  cd /opt/scraper && source venv/bin/activate && python scripts/scrape_maps.py"
