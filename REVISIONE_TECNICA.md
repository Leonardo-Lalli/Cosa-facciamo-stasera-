# Revisione tecnica · branch develop · 16 ottobre 2026

## Risultato
Home e schermata Esplora ridisegnate dal riferimento Stitch “Serata Notturna”: blu inchiostro, corallo, lilla, Plus Jakarta Sans, layout desktop a colonne e navigazione mobile esplicita. I dati dimostrativi, valutazioni, votazioni e promesse di prenotazione del mockup non diventano informazioni fittizie nell’app. Le card di ispirazione sono illustrazioni CSS leggere, non fotografie di locali inventati.

## Correzioni incluse
- Home visibile direttamente nell’HTML, senza mappa di sfondo o dipendenza da Leaflet all’avvio. Manifest indirizzato a #home. Esplora si apre con un’azione o un URL esplicito.
- CARTO sostituito con OSM Standard: sul sito pubblico era stata riprodotta la scritta “API KEY REQUIRED”. Leaflet incluso localmente con licenza; messaggio di errore cartografico, attribuzione visibile e ridimensionamento del contenitore.
- Query Overpass corrette per tutte le categorie, relazioni comprese, nessun vecchio limite a 100 risultati, ID distinti tra tipi OSM, endpoint di riserva aggiornato e errori parziali segnalati. Bar comprende cafe e biergarten; musica comprende live_music=yes.
- Richieste annullabili, timeout complessivo, cache breve in memoria, ultima ricerca su dispositivo e fallback quando la fonte non risponde. Nessuna ricerca automatica durante il trascinamento: comando Cerca in questa zona.
- Lista progressiva a gruppi di 40; canvas per più di 180 marker. Eliminato il routing automatico pesante e inaccurato di tutti i locali.
- Filtri realmente collegati a lista e marker; tempi e mezzo selezionati applicati. Parser orari conservativo, anche oltre mezzanotte e con intervalli settimanali; formati non supportati rimangono sconosciuti. Rimosso il vecchio Weekend che controllava solo il giorno corrente.
- Preferiti separati dai risultati e salvataggio gestito anche con storage bloccato o pieno. Testi da fonti esterne inseriti con textContent; URL limitati a HTTP/HTTPS. Eventi futuri filtrati, dettagli e condivisione senza handler HTML interpolati.
- App shell PWA coerente per versione; dati e cartografia non intercettati dal service worker. Avviso di aggiornamento; mantenuta cache HTTP delle tessere.
- Collettore: città già raccolte conservate quando le nuove risposte sono vuote, così un’esecuzione senza chiavi non svuota l’indice esistente. Aggiunti server locale e workflow di validazione.

## Verifiche
12 test automatici superati: query, identità OSM, guasti totali/parziali, URL non sicuri, storage indisponibile, orari notturni, intervalli settimanali, deduplicazione/raggio/categorie, trasporto/tempo e home iniziale. Controlli di sintassi e riferimenti agli asset locali superati.

Collaudo browser desktop e viewport mobile 390×844: home visibile, apertura Esplora e cartografia OSM, apertura/chiusura filtri. Collaudo separato con fixture locale dichiarata: 95 risultati, lista da 40 a 80 elementi, dettagli, preferito salvato e recuperato nella vista dedicata; un nome contenente markup rimane testo e un URL javascript viene escluso.

Durante le prove le fonti Overpass pubbliche hanno restituito errori: il successo della ricerca reale end-to-end non è certificato. La mappa di base si carica; le prove con fixture verificano l’interfaccia, non la copertura del provider. Nessun test su dispositivo fisico, nessuna verifica remota dei secret GitHub e nessun deploy eseguito.

## Da decidere con dati reali
L’indice data/cities/index.json di partenza è vuoto. Per verificare la copertura servono città e nomi concreti di posti mancanti, oltre allo stato del workflow remoto. Per una crescita consistente occorrono backend/cache e un provider dati con disponibilità adeguata. Votazioni e shortlist condivise sincronizzate richiedono un backend separato: le grafiche Stitch non ne forniscono uno.

Fonti tecniche: https://operations.osmfoundation.org/policies/tiles/ e https://wiki.openstreetmap.org/wiki/Overpass_API .


## Aggiornamento del 20 ottobre 2026
- Ricerca con eventi non bloccanti, timeout separati per geocoding (5 s), fonti locali (3 s), eventi (3,5 s) e Overpass (9 s per istanza). Limite complessivo 22 s; nessun risultato vecchio lasciato sotto una nuova città quando la ricerca fallisce.
- Query Overpass raggruppate per tag in una sola richiesta, inviata nel formato data= URL-encoded. Risposte parziali utilizzabili; rispetto del cooldown di 30 s dopo HTTP 406/429 e guasti del server. Non vengono più lanciate query di categorie in parallelo.
- Cache di più ricerche su dispositivo: risultati recenti subito disponibili; riutilizzo di un raggio maggiore e di categorie già scaricate per filtri locali. Una richiesta vecchia non può sovrascrivere l’ultima. Riprova forza una nuova richiesta.
- Tessere OSM adattate al tema scuro con un filtro sul solo layer raster. Marker, popup e attribuzione restano leggibili; nessuna nuova chiave o dipendenza cartografica. Anche i controlli seguono il tema.
- Cache PWA incrementata a v6 per distribuire i file aggiornati.

Verifica del 20 ottobre: 21 test automatici superati e controlli di sintassi/asset. Le richieste dirette a Overpass hanno restituito 406 o timeout: queste modifiche correggono attese, formato e aggiornamento dell’interfaccia, ma non garantiscono disponibilità delle fonti pubbliche. Riferimento sui limiti e sugli errori 406/429: https://wiki.openstreetmap.org/wiki/Overpass_API .

Nel collaudo browser della revisione, la cartografia OSM scura è stata verificata e il toggle tema rimuove immediatamente il filtro in modalità chiara. La fixture locale ha restituito 95 locali e il riuso della cache è stato verificato dopo un reload. La ricerca reale a Bologna ha invece confermato l’indisponibilità dei server Overpass, ora segnalata nella lista anziché lasciare dati vecchi o attese indefinite. Gli eventi raccolti restano consultabili anche in caso di errore della fonte locali; quando i locali sono disponibili la sezione eventi è comprimibile per non nasconderli sotto molti eventi futuri.
