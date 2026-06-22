# 🎯 Cosa facciamo stasera?

**[🌐 Apri il sito](https://leonardo-lalli.github.io/Cosa-facciamo-stasera-/)** — cerca subito cosa fare stasera nella tua zona!

**Scopri locali, eventi e serate vicino a te.** Inserisci una città, scegli il raggio e i tuoi interessi — l'app ti mostra discoteche, pub, cinema, ristoranti e molto altro, con tempi di percorrenza a piedi, in bici o in auto.

<p align="center">
  <img src="https://img.shields.io/badge/sito-online-brightgreen">
  <img src="https://img.shields.io/badge/license-MIT-blue">
  <img src="https://img.shields.io/badge/costo-0€-success">
  <img src="https://img.shields.io/badge/PWA-installabile-orange">
</p>

> **Primi in Italia**: nessun'altra app unisce mappa interattiva, routing, descrizioni automatiche dei locali con pro/contro, eventi in tempo reale, e pianificatore AI per la serata — tutto gratis e open source.

---

## ✨ Funzionalità

### 🔍 Scoperta locali
- Cerca per città o geolocalizzazione
- Raggio 1-50 km personalizzabile
- 13 tipi di locale: discoteche, bar, pub, cinema, teatri, ristoranti, musica dal vivo, bowling, sale eventi, ballo, casinò, sale giochi, karaoke
- Mappa interattiva stile Google Maps con marker cliccabili

### 🚶 Routing e filtri
- 3 modalità di trasporto: 🚶 a piedi, 🚲 bici, 🚗 auto (tempi reali via OSRM)
- Filtra per tempo massimo di percorrenza
- 🕐 **Aperto ora** — mostra solo locali aperti in questo momento
- 🗓️ **Weekend** — filtra per venerdì/sabato
- 🔥 **Heatmap** — mappa di calore con la densità dei locali

### 📝 Contenuti automatici
- **Descrizioni con pro/contro** generate dai tag OpenStreetMap (WiFi, terrazza, accessibilità, fumatori, parcheggio...)
- **Etichette smart** su ogni card (⭐ Top, 👥 Gruppi, 🕯️ Romantico, 🌿 Terrazza...)
- **🏷️ Logo animato** — "Cosa guardiamo stasera?", "Cosa mangiamo stasera?", "Dove balliamo stasera?"

### 🎟️ Eventi e serate
- Eventi in zona con date, prezzi e link biglietti (Ticketmaster + Songkick)
- Badge "🆕 nuovi eventi" quando trovi serate che non avevi ancora visto
- 🔍 **Ricerca sito** — se il locale non ha il sito, link diretto a Google

### 🤖 AI
- **Pianificatore automatico** — piano serata in 2-3 tappe (aperitivo → cena → dopocena)
- 3 varianti: 🪩 Party, 🎭 Cultura, 🍝 Food & Drink
- Smart fallback per qualsiasi città (anche senza AI pre-generato)

### 🎨 UI/UX
- 🌙 **Dark mode** con toggle e salvataggio automatico
- 📱 **Condivisione social** WhatsApp / Telegram / Copia link
- ⭐ **Preferiti** salvati nel browser (localStorage, nessun login)
- 🎰 **Pesca un locale a caso**
- 📲 **PWA** — installabile su telefono come app nativa
- ☀️ **Meteo** in tempo reale nella città cercata
- 📱 **Layout mobile** con drawer scorrevole dal basso

### 📊 Smart features
- 🔥 **Trending** — i locali più cliccati
- 🗺️ **Esplora zona** — muovi la mappa e i risultati si aggiornano
- **Siti web auto-trovati** via Wikidata + Google (scraper Python)
- **Collettore dati** ogni 6 ore (GitHub Actions) con Google Places + Ticketmaster + Songkick + Gemini

---

## 🛠️ Stack

| Cosa | Tecnologia | Costo |
|---|---|---|
| Frontend | Vanilla JS + Leaflet | Gratis |
| Mappa | OpenStreetMap / CARTO | Gratis |
| Dati locali | Overpass API (OSM) | Gratis |
| Routing | OSRM | Gratis |
| Meteo | Open-Meteo | Gratis |
| Eventi | Ticketmaster + Songkick API | Tier gratuito |
| AI Planner | Gemini 2.0 Flash | Tier gratuito |
| Hosting | GitHub Pages | Gratis |
| Data collector | GitHub Actions | Gratis (2000 min/mese) |
| Scraper | Python + Playwright | Server casalingo |

**Zero server, zero database, zero costi di hosting.**

## 🚀 Setup

```bash
git clone https://github.com/Leonardo-Lalli/Cosa-facciamo-stasera-.git
cd Cosa-facciamo-stasera-
npx serve .
```

### GitHub Pages
`Settings > Pages` → branch `main`, root `/`.

### API Keys (per dati arricchiti)
Aggiungi come GitHub Secrets:
| Secret | A cosa serve |
|---|---|
| `GOOGLE_API_KEY` | Google Places (200M+ posti) |
| `TICKETMASTER_API_KEY` | Eventi/serate/biglietti |
| `SONGKICK_API_KEY` | Concerti |
| `GEMINI_API_KEY` | Piani AI pre-generati per 15 città |

## 📁 Struttura

```
├── index.html, css/, js/      # Frontend
├── sw.js, manifest.json       # PWA
├── scripts/
│   ├── collect.js             # Collector principale
│   ├── scrape_maps.py         # Scraper Google Maps
│   ├── setup_scraper.sh       # Setup VM scraper
│   └── sources/               # Google, Ticketmaster, Songkick, Wikidata, Gemini
└── data/                      # JSON auto-generati
```

## 📄 Licenza

MIT
