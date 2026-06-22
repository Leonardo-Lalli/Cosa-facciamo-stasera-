# Guida: Scraper su Proxmox

Server: Proxmox con Xeon 2682v4, 32GB RAM, Quadro P400, Tailscale + DuckDNS

---

## 1. Crea la VM

Su Proxmox:
- **OS**: Ubuntu Server 22.04 LTS
- **CPU**: 2 vCore
- **RAM**: 4 GB
- **Disco**: 20 GB
- **Rete**: bridged (vmbr0)

Installa Ubuntu normalmente (SSH server abilitato).

---

## 2. Entra nella VM

```bash
ssh utente@ip-della-vm
```

---

## 3. Installa Tailscale (per accedere da fuori)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Apri il link che appare nel terminale, loggati. Da ora la VM è raggiungibile via `ssh utente@ip-tailscale`.

---

## 4. Setup scraper

```bash
# Aggiorna sistema
sudo apt update && sudo apt upgrade -y

# Installa dipendenze
sudo apt install -y python3 python3-pip python3-venv git curl \
  libnss3 libnspr4 libatk-bridge2.0-0 libatk1.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0

# Crea cartella
mkdir -p /opt/scraper && cd /opt/scraper

# Clona il repo
git clone https://github.com/Leonardo-Lalli/Cosa-facciamo-stasera-.git .

# Configura git (per push automatici)
git config user.name "scraper-bot"
git config user.email "scraper@localhost"

# Setup venv Python
python3 -m venv venv
source venv/bin/activate
pip install playwright
playwright install chromium
```

---

## 5. Testa lo scraper

```bash
cd /opt/scraper
source venv/bin/activate
python scripts/scrape_maps.py
```

Dovresti vedere output tipo:
```
=== Google Maps Scraper ===
📍 Roma...
  🔍 discoteche... 12 trovati, 3 siti, 5 nuovi
  🔍 pub e birrerie... 18 trovati, 8 siti, 7 nuovi
  ...
✅ Totale nuovi locali aggiunti: 47
```

Ora fai un push manuale per verificare:
```bash
git add data/
git commit -m "Test scraper run"
git push
```

Se git push chiede credenziali, usa un **Personal Access Token**:
1. Vai su https://github.com/settings/tokens
2. Genera un token con permesso `repo`
3. `git remote set-url origin https://TOKEN@github.com/Leonardo-Lalli/Cosa-facciamo-stasera-.git`

---

## 6. Automatizza con cron

Lo scraper gira ogni 3 ore e pusha i risultati:

```bash
sudo nano /etc/cron.d/scraper
```

Incolla:

```
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
0 */3 * * * root cd /opt/scraper && git pull && source venv/bin/activate && python scripts/scrape_maps.py && git add data/ && git commit -m "Auto: scraped venues [skip ci]" && git push
```

```bash
sudo chmod 644 /etc/cron.d/scraper
```

---

## 7. (Opzionale) Fai girare anche il collector Node.js

Se vuoi che il server faccia anche da collector (invece di GitHub Actions):

```bash
# Installa Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Crea file .env con le API key
nano /opt/scraper/.env
```

```env
GOOGLE_API_KEY=la_tua_chiave
TICKETMASTER_API_KEY=la_tua_chiave
SONGKICK_API_KEY=la_tua_chiave
GEMINI_API_KEY=la_tua_chiave
```

```bash
# Testa il collector
cd /opt/scraper
source .env
node scripts/collect.js
```

Poi aggiungi al cron anche il collector (ogni 4 ore, sfalsato di 30 min):

```
30 */4 * * * root cd /opt/scraper && git pull && source .env && node scripts/collect.js && git add data/ && git commit -m "Auto: collector run [skip ci]" && git push
```

---

## 8. Monitoraggio

```bash
# Vedi i log del cron
sudo grep scraper /var/log/syslog

# Vedi se lo scraper sta girando
ps aux | grep scrape_maps

# Ultimi commit fatti dal bot
cd /opt/scraper && git log --oneline -10
```

---

## 9. Se Google blocca l'IP (CAPTCHA)

Lo scraper ha pause random tra le richieste, ma se Google inizia a mostrare CAPTCHA:

1. Ferma il cron: `sudo rm /etc/cron.d/scraper`
2. Aspetta 12-24 ore
3. Riduci le città in `scripts/scrape_maps.py` (togli le meno importanti)
4. Riattiva il cron

L'IP residenziale (casa tua) è molto più difficile da bloccare rispetto a un datacenter. Dovrebbe funzionare per mesi senza problemi.

---

## Comandi rapidi

```bash
# Esegui subito
cd /opt/scraper && source venv/bin/activate && python scripts/scrape_maps.py

# Vedi se il cron è attivo
systemctl status cron

# Riavvia dopo modifiche al cron
sudo systemctl restart cron
```
