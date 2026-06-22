# 🎯 Cosa facciamo stasera?

**[🌐 Apri il sito](https://leonardo-lalli.github.io/Cosa-facciamo-stasera-/)** — cerca subito cosa fare stasera nella tua zona!

**Scopri locali, eventi e serate vicino a te.** Inserisci una città, scegli il raggio e i tuoi interessi — l'app ti mostra discoteche, pub, cinema, ristoranti e molto altro, con tempi di percorrenza a piedi, in bici, mezzi o in auto.

<p align="center">
  <img src="https://img.shields.io/badge/sito-online-brightgreen">
  <img src="https://img.shields.io/badge/license-MIT-blue">
  <img src="https://img.shields.io/badge/costo-0€-success">
  <img src="https://img.shields.io/badge/PWA-installabile-orange">
</p>

---

## ✨ Funzionalità

### 🔍 Scoperta locali
- Cerca per città o geolocalizzazione GPS
- Raggio 1-50 km personalizzabile
- 13 tipi: discoteche, bar, pub, cinema, teatri, ristoranti, musica dal vivo, bowling, sale eventi, ballo, casinò, sale giochi, karaoke
- Mappa interattiva (Leaflet + OpenStreetMap) con marker cliccabili
- Dati da OpenStreetMap (Overpass API) + Google Places (opzionale)

### 🚶 Routing
- 4 modalità: 🚶 piedi, 🚲 bici, 🚌 mezzi, 🚗 auto (OSRM + OpenRouteService)
- Tempi reali di percorrenza
- Filtra per tempo massimo
- 🕐 **Aperto ora** — solo locali aperti in questo momento
- 🗓️ **Weekend** — filtra per venerdì/sabato

### 📝 Contenuti automatici
- **Descrizioni** con pro/contro da tag OpenStreetMap (WiFi, terrazza, fumatori, parcheggio...)
- **Etichette smart**: ⭐ Top, 👥 Gruppi, 🕯️ Romantico, 🌿 Terrazza, 📶 WiFi...
- **Logo animato**: "Cosa guardiamo stasera?", "Cosa mangiamo stasera?"

### 🎟️ Eventi e serate
- Eventi da Ticketmaster + Eventbrite (concerti, serate, festival)
- Match geografico: eventi mostrati solo sotto il locale giusto (<500m)
- Sezione comprimibile con prezzi e link biglietti
- Badge "🆕 nuovi eventi"
- Scraper Python per eventi dai siti delle discoteche (tramite server)

### 🎨 UI/UX
- 🌙 **Dark mode** con rilevamento automatico
- 📱 **Condivisione** WhatsApp / Telegram / Copia link
- ⭐ **Preferiti** salvati nel browser (localStorage)
- 🎰 **Pesca un locale a caso**
- 📲 **PWA** installabile su telefono
- ☀️ **Meteo** in tempo reale (Open-Meteo)
- 📱 **Mobile**: mappa full screen, drawer trascinabile dal basso

### 🔧 Developer
- **Collettore dati** via GitHub Actions (Ticketmaster + Eventbrite + Wikidata)
- **Scraper Python** (Playwright) per Google Maps e siti locali
- **WikiData** auto-trova siti ufficiali
- **Sicurezza**: XSS sanitization, null-safe DOM, API keys via GitHub Secrets

---

## 🛠️ Stack

| Cosa | Tecnologia | Costo |
|---|---|---|
| Frontend | Vanilla JS + Leaflet | Gratis |
| Mappa | OpenStreetMap / CARTO | Gratis |
| Dati locali | Overpass API (OSM) | Gratis |
| Routing | OSRM + OpenRouteService | Gratis |
| Meteo | Open-Meteo | Gratis |
| Eventi | Ticketmaster + Eventbrite API | Tier gratuito |
| Hosting | GitHub Pages | Gratis |
| Collector | GitHub Actions | Gratis |
| Scraper | Python + Playwright | Server casalingo |

---

## 🚀 Setup

```bash
git clone https://github.com/Leonardo-Lalli/Cosa-facciamo-stasera-.git
cd Cosa-facciamo-stasera-
npx serve .
```

### GitHub Pages
`Settings > Pages > Source` → **GitHub Actions** (il deploy inietta automaticamente le API key)

### API Keys (GitHub Secrets)
| Secret | A cosa serve |
|---|---|
| `GOOGLE_API_KEY` | Google Places |
| `TICKETMASTER_API_KEY` | Eventi/concerti/biglietti |
| `EVENTBRITE_API_KEY` | Serate locali, club |
| `GEMINI_API_KEY` | Piani AI per 15 città |
| `ORS_API_KEY` | Routing mezzi pubblici reale |

---

## 📁 Struttura

```
├── index.html, css/, js/    # Frontend
├── icon.svg, manifest.json  # PWA
├── sw.js                    # Service Worker
├── scripts/
│   ├── collect.js           # Collector Node.js
│   ├── scrape_maps.py       # Scraper Python
│   ├── setup_scraper.sh     # Setup VM/LXC
│   └── sources/             # API modules
└── data/                    # JSON auto-generati
```

## 📄 Licenza

MIT
