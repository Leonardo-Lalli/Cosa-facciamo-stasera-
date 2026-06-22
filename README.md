# 🎯 Cosa facciamo stasera?

**Scopri cosa fare stasera attorno a te.** Inserisci una città, scegli il raggio e i tuoi interessi — l'app ti mostra discoteche, pub, cinema, ristoranti e molto altro, con tempi di percorrenza a piedi, in bici o in auto.

<p align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen">
  <img src="https://img.shields.io/badge/license-MIT-blue">
  <img src="https://img.shields.io/badge/free-100%25-success">
</p>

---

## ✨ Funzionalità

- 🔍 **Cerca per città** o usa la geolocalizzazione 📍
- 📏 **Raggio personalizzabile** da 1 a 50 km
- 🚶🚲🚗 **3 modalità di trasporto** con tempi reali (OSRM)
- ⏱ **Filtra per tempo massimo** di percorrenza
- 🏷️ **13 tipi di locali**: discoteche, bar, pub, cinema, teatri, ristoranti, musica dal vivo, bowling, sale eventi, ballo, casinò, sale giochi, karaoke
- 🗺️ **Mappa interattiva** stile Google Maps (Leaflet + OpenStreetMap)
- 🌐 **Link diretti** ai siti dei locali per comprare biglietti

## 🛠️ Stack

| Cosa | Tecnologia | Costo |
|---|---|---|
| Frontend | Vanilla JS + Leaflet | Gratis |
| Mappa | OpenStreetMap / CARTO | Gratis |
| Dati locali | Overpass API (OSM) | Gratis |
| Routing | OSRM | Gratis |
| Hosting | GitHub Pages | Gratis |

**Zero server, zero database, zero costi.**

## 🚀 Setup

```bash
git clone https://github.com/Leonardo-Lalli/Cosa-facciamo-stasera-.git
cd Cosa-facciamo-stasera-
# Apri index.html nel browser, oppure:
npx serve .
```

Oppure attiva **GitHub Pages**: `Settings > Pages` → branch `main`, root `/`.

## 📁 Struttura

```
├── index.html          # Interfaccia principale
├── css/style.css       # Stile Google Maps-like
├── js/
│   ├── api.js          # Overpass API (query locali OSM)
│   ├── routing.js      # OSRM routing batch
│   ├── map.js          # Leaflet map + marker
│   ├── ui.js           # Sidebar, filtri, card locali
│   └── app.js          # Controller principale
└── data/events.json    # Eventi/serate (work in progress)
```

## 🔮 Prossimi passi

- [ ] Scraping automatico eventi/serate da fonti esterne
- [ ] Partnership con locali (biglietti, tavoli, guest list)
- [ ] Dark mode
- [ ] App nativa (PWA)
- [ ] Notifiche per nuovi eventi nella zona

## 📄 Licenza

MIT — fai quel che vuoi, basta citare la fonte.
