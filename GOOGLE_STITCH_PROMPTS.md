# Prompt Google Stitch — Home

Progetta la home mobile-first di “Cosa facciamo stasera?”, una web app italiana installabile che aiuta gruppi di amici a scegliere dove uscire. Crea schermate ad alta fedeltà a 390 px e una variante desktop a 1440 px, coerenti con la successiva pagina Esplora.

Direzione visiva: atmosfera urbana serale, fondo blu inchiostro, superfici solide, accenti corallo e lilla, tipografia sans leggibile, fotografia editoriale selettiva, icone coerenti. Aspetto curato e vivace, senza effetti vetro, sfondi animati o decorazioni che rallentano il telefono. Supporta anche un tema chiaro accessibile.

La prima schermata deve portare alla ricerca subito: marchio compatto, titolo “Il gruppo c’è. Manca solo il posto.”, sottotitolo breve, campo città chiaramente etichettato, pulsante “Usa la mia posizione” e CTA “Esplora la serata”. La geolocalizzazione è facoltativa. Mostra categorie in chip scorrevoli: Aperitivo, Pub, Cena, Musica, Ballo, Cinema, Giochi. La selezione multipla deve essere evidente. Mostra un riepilogo modificabile del raggio.

Sotto la ricerca: tre passaggi essenziali, eventuali eventi reali con data e fonte e accesso ai preferiti. Non inventare valutazioni, disponibilità, prezzi, popolarità o eventi: usa dati dimostrativi chiaramente identificati. Evita documentazione tecnica e GitHub nella navigazione principale; mettili nel footer.

Navigazione mobile semplice: Esplora e Preferiti. Obiettivi tattili almeno 44 px, testo minimo 16 px nei campi, contrasto accessibile, focus visibile, rispetto delle aree sicure e del movimento ridotto. Prevedi stati campo vuoto, città non trovata, GPS negato, caricamento, offline e nessun evento. Produci componenti riutilizzabili, spaziatura su griglia 8 px e una breve descrizione delle interazioni. Evita un menu hamburger per le azioni principali.

# Prompt Google Stitch — Esplora / Mappa

Progetta la pagina Esplora della stessa app “Cosa facciamo stasera?”. Mantieni identità visiva, font e componenti della home: blu inchiostro, corallo, lilla, superfici solide e testo italiano. Crea viste mobile da 390 px e desktop da 1440 px.

La mappa è il contenuto principale. Su mobile occupa lo schermo con ricerca compatta in alto: città modificabile, pulsante posizione, pulsante Filtri con conteggio selezioni. Sotto, una riga di categorie scorrevoli. In basso un pannello risultati con tre stati espliciti: compatto, metà schermo, esteso. Fornisci sempre pulsanti visibili “Mappa” e “Lista”: il trascinamento deve essere opzionale. Lascia buona parte della mappa visibile nello stato iniziale, non aprire pannelli automaticamente quando cambiano i filtri.

I marker distinguono le categorie tramite icona e colore e hanno uno stato selezionato. Prevedi raggruppamenti per molte località. Quando sposti la mappa compare “Cerca in questa zona”, senza lanciare richieste continue. Attribuzione cartografica sempre leggibile. Comando per tornare alla posizione di ricerca.

Le schede risultati mostrano nome, categoria, distanza, tempi indicativi chiaramente etichettati, indirizzo e preferito. Orari, valutazioni, prezzi e foto compaiono soltanto se disponibili con fonte; mostra “Orari non disponibili” dove mancano. Le card e i marker selezionano lo stesso posto. Un dettaglio mostra navigazione esterna, sito ufficiale, salva e condividi nel gruppo; non inventare un sistema di votazione già funzionante.

Filtri in pannello dedicato: categorie, raggio, trasporto; apertura verificabile distinta dagli orari sconosciuti. CTA “Applica filtri”, ripristina e chiudi raggiungibili con una mano. Non inserire decine di controlli minuscoli sopra la mappa. Desktop: lista laterale e mappa affiancate con ridimensionamento ordinato.

Disegna anche caricamento con skeleton, ricerca fallita con Riprova, fonte dati parzialmente disponibile, nessun risultato, offline con avviso sui dati disponibili e mappa non caricata con accesso alla lista. Rispetta aree sicure iOS, tastiera, orientamento orizzontale, focus, contrasto e target 44 px. Nessun blur esteso o animazione continua. Consegna varianti dei tre stati del pannello e una piccola libreria di componenti e token.
