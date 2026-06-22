# 🎯 Cosa facciamo stasera?

**Scopri cosa fare stasera attorno a te.** Inserisci una città, scegli il raggio e i tuoi interessi — l'app ti mostra discoteche, pub, cinema, ristoranti e molto altro, con tempi di percorrenza a piedi, in bici o in auto.

<p align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen">
  <img src="https://img.shields.io/badge/license-MIT-blue">
  <img src="https://img.shields.io/badge/costo-0€-success">
  <img src="https://img.shields.io/badge/PWA-installabile-orange">
</p>

> **Primi in Italia**: nessun'altra app unisce mappa interattiva, routing, descrizioni automatiche dei locali con pro/contro, eventi in tempo reale, e pianificatore AI per la serata — tutto gratis e open source.

---

## ✨ Funzionalità

- 🔍 **Cerca per città** o usa la geolocalizzazione 📍
- 📏 **Raggio personalizzabile** da 1 a 50 km
- 🚶🚲🚗 **3 modalità di trasporto** con tempi reali (OSRM)
- ⏱ **Filtra per tempo massimo** di percorrenza
- 🏷️ **13 tipi di locali**: discoteche, bar, pub, cinema, teatri, ristoranti, musica dal vivo, bowling, sale eventi, ballo, casinò, sale giochi, karaoke
- 🗺️ **Mappa interattiva** stile Google Maps (Leaflet + OpenStreetMap)
- 📝 **Descrizioni automatiche** con pro e contro per ogni locale (da dati OSM)
- 🎟️ **Eventi in zona** con prezzi e link biglietti (Ticketmaster + Songkick)
- 🤖 **Pianificatore AI** che ti crea un programma per la serata (Gemini, gratis)
- 📱 **Condivisione social** WhatsApp / Telegram / Copia link
- 🌙 **Dark mode** con toggle e salvataggio automatico
- ⌨️ **Logo animato** — "Cosa guardiamo stasera?", "Cosa mangiamo stasera?", etc.
- 📲 **PWA** — installabile su telefono come app nativa

## 🛠️ Stack

| Cosa | Tecnologia | Costo |
|---|---|---|
| Frontend | Vanilla JS + Leaflet | Gratis |
| Mappa | OpenStreetMap / CARTO | Gratis |
| Dati locali | Overpass API (OSM) | Gratis |
| Routing | OSRM | Gratis |
| Eventi | Ticketmaster + Songkick API | Tier gratuito |
| AI Planner | Gemini 2.0 Flash | Tier gratuito |
| Hosting | GitHub Pages | Gratis |
| Data collector | GitHub Actions | Gratis (2000 min/mese) |

**Zero server, zero database, zero costi.**

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
| Secret | A cosa serve | Come ottenerlo |
|---|---|---|
| `GOOGLE_API_KEY` | Google Places (200M+ posti) | [console.cloud.google.com](https://console.cloud.google.com) |
| `TICKETMASTER_API_KEY` | Eventi/serate/biglietti | [developer.ticketmaster.com](https://developer.ticketmaster.com) |
| `SONGKICK_API_KEY` | Concerti | [songkick.com/developer](https://www.songkick.com/developer) |

### Gemini API (per il pianificatore AI)
Ogni utente inserisce la sua chiave nell'interfaccia (o la pre-carichi via localStorage).

## 📁 Struttura

```
├── index.html               # UI principale
├── manifest.json            # PWA manifest
├── sw.js                    # Service worker (offline cache)
├── css/style.css            # Stile + dark mode
├── js/
│   ├── api.js               # Overpass API (query locali OSM)
│   ├── routing.js           # OSRM routing batch
│   ├── describer.js         # Descrizioni auto + pro/contro
│   ├── planner.js           # AI pianificatore serata (Gemini)
│   ├── map.js               # Leaflet map + marker
│   ├── ui.js                # Sidebar, filtri, card, condivisione
│   └── app.js               # Controller principale
├── scripts/                 # Data collector per GitHub Actions
│   ├── collect.js
│   └── sources/
│       ├── google.js        # Google Places
│       ├── events.js        # Ticketmaster
│       └── songkick.js      # Songkick
└── data/
    ├── events.json          # Eventi/serate (auto-generato)
    └── cities/              # Dati per città (auto-generato)
```

## 📈 Monetizzazione

| Strategia | Come funziona | Stima |
|---|---|---|
| **Locali sponsorizzati** | Badge "In evidenza" in cima ai risultati | €20-50/mese a locale |
| **Affiliazione biglietti** | TicketOne/Dice/Eventbrite (3-8% a vendita) | Passivo |
| **Prenotazione tavoli** | Integrazione con sistemi locali | Commissione |

## 🔮 Prossimi passi

- [ ] Scraping automatico serate da fonti web
- [ ] Partnership con locali (biglietti, tavoli, guest list)
- [ ] Notifiche push per nuovi eventi
- [ ] Modalità "Weekend" (pianifica Venerdì + Sabato)
- [ ] Form "Segnala locale mancante"

## 📄 Licenza

MIT
