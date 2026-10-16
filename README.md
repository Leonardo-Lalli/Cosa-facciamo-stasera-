# Serata · Cosa facciamo stasera?

[Apri il sito pubblico](https://leonardo-lalli.github.io/Cosa-facciamo-stasera-/)

Un’app web installabile per scegliere dove uscire con gli amici. La nuova interfaccia, sviluppata su `develop` a partire dal design Stitch, separa la home dall’esplorazione con mappa. Il sito pubblico non cambia finché il branch non viene pubblicato.

## Avvio e controlli

Richiede Node.js 22 o successivo. Nessuna dipendenza da installare.

```sh
npm start
# http://127.0.0.1:8081
npm test
npm run check
```

## Funzionalità

- Home con città, GPS facoltativo, raggio e categorie multiple.
- Mappa e lista, sola mappa o sola lista; navigazione mobile con Home, Esplora e Preferiti.
- Ricerca OpenStreetMap tramite Overpass con server di riserva; inclusi nodi, edifici e relazioni, senza il vecchio limite arbitrario di 100 posti.
- Eventi futuri dal file raccolto, quando disponibili nella zona; nessun evento dimostrativo pubblicato.
- Filtri per categoria, raggio, trasporto, tempo indicativo e apertura interpretabile; ordinamento per distanza o nome.
- Preferiti sul dispositivo, WhatsApp, condivisione nativa/copia e indicazioni esterne.
- Tema chiaro/scuro e app installabile. Home e preferiti disponibili offline dopo una prima visita completa; cartografia e nuove ricerche richiedono la rete. L’ultima ricerca può essere recuperata se le fonti non rispondono.

I tempi sono **stime in linea d’aria**, non percorsi reali. Gli orari OSM hanno una sintassi complessa: quelli non interpretabili restano sconosciuti e vengono esclusi dal filtro di apertura. Non sono presenti votazioni in tempo reale o valutazioni inventate.

## Dati e copertura

La copertura dipende dai dati disponibili nelle fonti. Il frontend integra `data/cities/<città>.json`, ma l’indice iniziale del repository è vuoto. Verificare l’esecuzione del workflow `collect.yml` e i secret configurati su GitHub per ottenere dati aggiuntivi. Il collettore mantiene i dati già salvati se la fonte non produce nuovi risultati. Non inserire chiavi private nel frontend.

Le tessere CARTO mostravano “API KEY REQUIRED”: la cartografia usa ora il servizio standard OpenStreetMap. Leaflet 1.9.4 è incluso in `vendor/leaflet`, con licenza. Sono rispettati attribuzione, cache HTTP del browser e assenza di prefetch massivo delle tessere. Per traffico consistente scegliere un servizio cartografico con capacità adeguata.

## PWA e pubblicazione

Il manifest apre sempre `#home`. Gli URL `#explore`, `#map`, `#list` e `#favorites` permettono l’accesso diretto alle viste. Un link privo di frammento apre la home. Il service worker usa un’app shell versionata per evitare HTML e JavaScript di versioni diverse. Un aggiornamento si attiva dopo aver chiuso tutte le finestre dell’app e averla riaperta.

`validate.yml` controlla `develop`, `main` e le pull request. Nessun deploy automatico di `develop` viene aggiunto. Pubblicare solo dopo la revisione del branch e verificare in GitHub Pages la sorgente selezionata.

## Collaudo browser con dati simulati

Il server di sviluppo può usare una fixture locale di 95 posti per provare lista lunga, preferiti e contenuti non attendibili. Il banner identifica chiaramente i dati simulati. La fixture non è inclusa in `index.html` o nella cache PWA di produzione.

```powershell
$env:SERATA_TEST_FIXTURES='1'
$env:PORT='8083'
npm start
```

I test reali delle API restano separati dal collaudo simulato. Non pubblicare il server di sviluppo come servizio di produzione.
