# Changelog

Tutte le modifiche rilevanti dell'app mobile di Arenile sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/) e il progetto adotta il
[Versionamento Semantico](https://semver.org/lang/it/). I messaggi di commit seguono
[Conventional Commits](https://www.conventionalcommits.org/it/v1.0.0/). Ogni versione indica la versione
minima di Arenile supportata e la release del core da cui viene il contratto API.

## [Unreleased]

### Aggiunto

- **Contattare il cliente dalla scheda:** "Chiama", "WhatsApp" (solo numeri in formato internazionale,
  come li salva il core) e "Scrivi" aprono le app del telefono, solo per i ruoli che vedono i contatti.
- **Clienti per fila:** toccare una postazione apre la sua prenotazione.
- **Disponibilità**: per il cliente che arriva in cassa, le postazioni libere per tutto il soggiorno
  fila per fila (date fino a 199 giorni, durata, fascia, mappa), le file e le zone piene nascoste a
  richiesta e le postazioni libere solo in parte elencate con i giorni liberi, le zone a zona o a
  quantità della mappa e quelle senza mappa con i posti liberi, filtri per le caratteristiche delle
  postazioni (tutte quelle scelte); una postazione libera apre la nuova prenotazione al volo con le
  stesse date. Dal pulsante nell'intestazione della mappa (con il giorno e la mappa scelti), dalla home
  e dal pannello del tablet, per chi scrive le prenotazioni, solo online (core `GET availability`, spec
  7.8 e 30.4). Il _Trova posto_ del core (spec 30.6, proposte con cambi di posto) resta per dopo.
- **Clienti per fila** (la "lista per i bagnini" del core 1.1, spec 30.10): le postazioni occupate del giorno fila per fila, a
  caratteri grandi per la spiaggia, con cognome, allestimento, gruppo, arrivo, partenza e da saldare,
  mai contatti; filtri per arrivi, partenze e da saldare, calendario come mappa e prenotazioni. Oggi e
  domani anche offline (scaricate e salvate con il giorno operativo), gli altri giorni solo online. Dal
  menu, dall'inizio e dal pannello di navigazione su tablet, per i ruoli che leggono le prenotazioni.
- **Mappa del giorno più ricca** (core 1.1, spec 30.4, come nel pannello):
  - arrivi e partenze segnati sulle postazioni con un indicatore (freccia in entrata o in uscita) e
    contati nella legenda; anche nell'elenco e nel nome letto dagli screen reader;
  - filtri rapidi "Evidenzia": arrivi, partenze, da incassare, presenti, ogni convenzione o partner e
    ogni gruppo del giorno, uno alla volta, con il conteggio; le altre postazioni si attenuano, l'elenco
    mostra solo quelle filtrate e la ricerca cerca al loro interno;
  - etichette sotto le postazioni occupate combinabili: cliente, fine soggiorno ("16/8"), allestimento
    ("2L 1S");
  - nella scheda della postazione allestimento, persone, gruppo, convenzione con il partner (o il
    partner da solo).
- **Calendario della postazione** (spec 30.5) dalla scheda, solo online: la stagione mese per mese,
  ogni giorno diviso in mattina e pomeriggio con i colori e i glifi della mappa; un giorno occupato apre
  la prenotazione; sotto, le prenotazioni della stagione con il saldo. Un giorno libero (da oggi in poi)
  avvia una nuova prenotazione da quel giorno, con la mezza giornata libera, per chi scrive le
  prenotazioni; un giorno occupato a metà chiede se aprire la prenotazione o prenotare l'altra metà. Su
  tablet i mesi stanno affiancati.
- **Scheda prenotazione (core 1.1)**: gruppo e ospiti (provenienza, adulti e bambini, nomi);
  convenzione e partner con la quota a carico del partner; requisito della convenzione (es.
  residenti) con "Verificato", che registra data e operatore, anche al check-in senza bloccarlo;
  "Invia riepilogo al cliente" apre la condivisione del telefono con il testo nella lingua del
  cliente e un nuovo link di gestione. Verifica e riepilogo solo online, per cassa e direzione.
- **Nuova prenotazione al volo** (solo online, ADR 0009) dalla scheda di una postazione libera, dalla
  lista delle postazioni libere e dalle prenotazioni del giorno, per i ruoli che scrivono le
  prenotazioni: postazione, date dal–al (calendario o 1/7/14 giorni), fascia, pacchetto ammesso per la
  durata, extra, cognome del cliente (telefono ed email facoltativi). Il prezzo stimato e le regole
  di prenotazione arrivano dall'anteprima del server mentre si compila (`bookings/quote`), con i giorni
  in cui la postazione è occupata; _Blocca per 15 minuti_ tiene la postazione (`holds`) finché si
  conferma, la prenotazione converte il blocco e lasciare la schermata lo rilascia. La prenotazione
  nasce confermata, il saldo si incassa dalla scheda.
- **Prova la demo** nella schermata "Collega" (ADR 0015): abbina l'app allo stabilimento di esempio
  sul server dimostrativo di Coste360 (`demo.arenile.app`) con un codice chiesto alla demo, senza
  server proprio; serve un'istanza demo del core v1.0.6 o successiva (`arenile seed demo` crea l'utente `cassa@lido-demo.example`).
- **Calendario** per mappa e prenotazioni (ADR 0014): "Oggi · Domani · 📅", qualsiasi giorno con il
  calendario nativo; oggi e domani anche offline, gli altri giorni solo online.
- Operazioni su tablet come lista e dettaglio: check-in e postazioni a sinistra, la postazione o il
  codice cercato a destra.
- _Report_: per la settimana, grafico a barre giorno per giorno di incassato e occupazione rispetto
  all'anno precedente, dalla serie giornaliera del confronto del core; legenda, scala e riepilogo
  accessibile con tutti i valori.
- _Oggi_: occupazione per fascia (mattina e pomeriggio: occupate, libere, non disponibili) dal giorno
  operativo in cache, con le regole di stato della mappa; i cinque numeri in righe piene a ogni
  larghezza (niente più 3 + 2 su tablet).

- Fase 2 (ADR 0011), tutto solo online e mai in coda:
  - _Vendita giornaliera rapida_ dalla scheda di una postazione libera: fascia, pacchetto, extra, nome
    facoltativo, totale dal server, contanti con il resto o carta, biglietto numerato.
  - _Sposta su un'altra postazione_ dalla mappa e dalla scheda prenotazione, con l'anteprima del server
    (conflitti e nuovo totale); le vendite giornaliere si spostano tramite il biglietto.
  - _Spostamenti avanzati_ (core 1.1): un soggiorno in corso si sposta da oggi o da domani;
    _Scambiare con un'altra prenotazione_ scambia le postazioni di due prenotazioni con l'anteprima dei
    due totali; _Annulla spostamento_ entro 5 minuti, dall'esito o riaprendo lo spostamento.
  - _Lista d'attesa_: coda, offerte in corso e offerta di un posto come nel pannello; dalla mappa le
    richieste compatibili con la postazione liberata.
  - _Stampa il biglietto_ sulla stampante ESC/POS instradata nel pannello: stampa il server, l'app la
    chiede e ne segue l'esito.
- Fase 1 — **Mappa del giorno** (ADR 0008): vista operativa di oggi o domani con i colori di stato del
  pannello, sempre con etichetta e glifo, legenda sempre visibile con i conteggi, fasce giornata /
  mattina / pomeriggio, più mappe dello stabilimento; zoom e spostamento con i gesti (fluidi anche con
  centinaia di postazioni) e con i pulsanti; ricerca per postazione, cliente o codice prenotazione;
  vista Elenco accessibile. Scheda della postazione con stato, prenotazione o abbonamento, cliente
  (solo con il permesso di vedere le prenotazioni), saldo e azioni del ruolo: check-in e rilascio del
  giorno anche offline (coda), blocco e sblocco della postazione solo online. Su tablet la scheda si
  apre accanto alla mappa. Funziona sulla cache offline del giorno.
- Fase 1 — _Oggi_: arrivi, presenti, postazioni libere sul totale, prenotazioni da saldare con
  l'importo, giorni rilasciati dagli abbonati, nel fuso dello stabilimento; ogni numero apre il proprio
  elenco filtrato e ne è la lunghezza. Elenco delle postazioni libere e rilasciate (con la mezza
  giornata libera). Avviso di stabilimento chiuso.
- Fase 1 — _Prenotazioni del giorno_ (oggi e domani): filtri arrivi, presenti, da saldare, abbonati,
  online/cassa; ricerca per codice, cliente (senza accenti) o postazione; ordinamento per postazione,
  cliente, arrivo o saldo; cancellate e scadute su richiesta; trascina per aggiornare.
- _Scheda prenotazione_: postazioni e pacchetti, periodo, fasce, formula, canale, cliente, importi,
  pagamenti e rimborsi, note, cronologia essenziale; avviso delle operazioni ancora in coda per la
  prenotazione. Contatti e note del cliente solo per i ruoli che scrivono prenotazioni (titolare,
  gestore, cassiere); cliente anonimizzato mostrato come tale.
- Su tablet elenco e scheda affiancati; _Oggi_ e _Prenotazioni_ nel pannello di navigazione, scheda
  _Giornata_ nella schermata principale del telefono. Dati salvati sul dispositivo segnalati con l'ora
  dell'ultimo aggiornamento.
- Fase 1 — operazioni (ADR 0009): check-in con la scansione del QR della prenotazione (anche senza
  rete, dai dati del giorno) o del biglietto d'ingresso (ammesso al varco con l'esito: entrato, già
  entrato, annullato, altro giorno), oppure con il codice digitato; schermata delle operazioni di una
  prenotazione con check-in, incasso rapido in contanti (con conferma, mai oltre il saldo, avviso se la
  cassa è chiusa), rilascio del giorno degli abbonati e note interne, tutte nella coda offline;
  postazioni di oggi con ricerca e blocco/sblocco (solo online). Azioni mostrate secondo il ruolo.
- Fase 3 — report essenziali per titolare, gestore e sola lettura (ADR 0010): incassato, occupazione,
  prenotazioni e prenotato del giorno o della settimana a confronto con l'anno precedente (stessa data
  o stesso giorno della settimana), con il giorno per giorno della settimana, dal confronto del core
  (`GET reports/comparison`); solo online; le esportazioni restano nel pannello.
- Fase 3 — widget della schermata principale per iOS e Android con arrivi, da saldare, presenti e
  postazioni libere di oggi, calcolati dai dati già in cache sul dispositivo, senza nessuna connessione;
  solo conteggi; "dati di ieri" alla mezzanotte su iOS; svuotato allo scollegamento. Richiede una
  nuova build nativa (estensione widget e app group `group.app.arenile.mobile`).
- Dipendenze: `expo-widgets` e `@expo/ui` (MIT, Expo).

- Fase 1 — fondamenta dei dati e dell'offline (ADR 0007): cache di mappa e prenotazioni di oggi e
  domani (nel fuso dello stabilimento) consultabile senza rete, anche all'avvio, e cancellata a ogni
  scollegamento; coda di check-in, rilasci del giorno, note e incassi in contanti inviata in ordine
  alla riconnessione con chiavi di idempotenza, conflitti e rifiuti mostrati con il motivo finché
  l'utente non riprova o elimina; creazione e spostamento di prenotazioni solo online.
- Indicatore della connessione sempre visibile (telefono e tablet) con le operazioni in attesa e da
  controllare; schermata _Operazioni in attesa_; avviso delle operazioni non inviate prima dello
  scollegamento, che prova prima a inviarle.
- Permessi dei ruoli come nel pannello (sezione 16 del core) per nascondere le azioni non consentite.
- Importi in centesimi formattati in italiano, date di calendario nel fuso dello stabilimento.
- Dipendenze: `expo-sqlite`, `expo-network`, `expo-crypto`, `@tanstack/react-query-persist-client`,
  `@tanstack/query-async-storage-persister` (MIT, nessuna connessione verso terzi).

- Fase 0 — fondamenta dell'app (Expo SDK 58, React Native 0.88, expo-router, TypeScript strict).
- Collegamento a un'istanza con il QR del pannello (anche dalla fotocamera di sistema con il link
  `arenile://pair?d=…`, che chiede conferma dell'indirizzo dell'istanza) o con indirizzo e codice di
  abbinamento; decodificatore del QR con le stesse regole del core; `http` accettato solo su loopback.
- Verifica della compatibilità con `GET /api/admin/v1/meta`: versione minima di Arenile supportata
  **1.0.0**, avviso quando l'istanza richiede un'app più recente (`min_client_versions.mobile`).
- Token del dispositivo nel portachiavi (Keychain / Keystore, solo questo dispositivo); verifica
  all'avvio con `GET /api/device/v1/self`; dispositivo revocato → ritorno a _Collega_ con spiegazione;
  _Scollega questo dispositivo_ con conferma, anche quando l'istanza non è raggiungibile.
- Collegamento all'app desktop in rete locale (certificato autogenerato) con il modulo nativo
  `modules/pinned-fetch` (ADR 0006): accetta il server solo se lo SHA-256 del certificato foglia coincide
  con l'impronta del QR (confronto in tempo costante; iOS `URLSession`, Android `OkHttpClient` dedicato),
  senza mai indebolire TLS per le altre connessioni. Certificato diverso → nuovo QR all'abbinamento,
  "Abbina di nuovo" da collegato; avviso nei 30 giorni prima di `lan_cert_renews_at`; permesso "Rete
  locale" di iOS spiegato. Nelle build senza il modulo (Expo Go, web) resta il messaggio chiaro.
- Schermata principale (stabilimento, utente e ruolo, connessione, versione ed edizione dell'istanza) e
  Impostazioni (istanza, dispositivo, lingua, tema, informazioni).
- Lingue italiano (sorgente), inglese, tedesco e francese, anche per il nome dell'app e il permesso
  della fotocamera; tema chiaro e scuro con i colori del pannello; layout per telefono e per
  tablet/iPad (navigazione laterale), tutte le orientazioni.
- Contratto API dalla release **v1.0.1** del core, verificato con SHA-256 (`make gen`, `make gen-check`,
  `make api-bump`).
- Strumenti: `Makefile`, ESLint, Prettier, guardia degli stili, Jest con test delle schermate a
  larghezza di telefono e di tablet, CI su GitHub Actions (`make check`, `expo-doctor`, bundle iOS e
  Android), regole e agenti per Claude Code, ADR 0001–0006, piano dell'app per fasi.

- Mappa del giorno con le illustrazioni dei kit del pannello (ADR 0013): ombrelloni, lettini,
  gazebo, passerelle, bar e servizi come nel pannello, nel kit scelto dallo stabilimento (_Moderno_ con
  lo stato sul disegno, _Classico_ con l'alone), in tema chiaro e scuro; codice della postazione su una
  pillola leggibile. I kit vengono dalla release del core fissata, verificati con SHA-256
  (`make gen`).

### Modificato

- Sul telefono l'app resta in verticale; tablet e iPad ruotano in ogni orientazione (ADR 0016).
- La scheda della postazione sulla mappa copre tutta la mappa quando non c'è spazio per affiancarla
  (telefono, tablet stretto), così dettagli e azioni si vedono insieme; chiudendola la mappa resta
  dov'era. Su Android il tasto Indietro la chiude.
- Le postazioni libere e i giorni rilasciati di _Oggi_ si toccano: aprono la postazione sulla mappa,
  con vendita, prenotazione e le altre azioni del ruolo.
- Contratto API e kit della mappa dalla release **v1.1.3** del core (prima v1.0.1; la 1.1.3 documenta
  soltanto la risposta della verifica del requisito, nessun cambiamento per l'app). La versione minima
  di Arenile supportata resta la 1.0.0. Spostamento, vendita giornaliera e offerta della lista d'attesa
  rifiutati perché il contingente di una convenzione è esaurito (core 1.1) dicono che la postazione non
  è libera.
- Una vendita giornaliera rifiutata per le regole di prenotazione dello stabilimento (422
  `policy_violation`, per esempio vendite per oggi chiuse dopo l'orario limite) dice quale regola
  invece di "Vendita non riuscita. Riprova.". Dal core 1.1.2 lo dice già l'anteprima, con "Vendi"
  disattivato.
- Core 1.1.2: un conflitto "riprova" (409 `concurrent_update`, un'altra modifica degli stessi dati in
  corso) resta in coda e si rimanda da solo con la stessa chiave, come una richiesta online; uno
  spostamento che chiede l'approvazione del gestore (409 `approval_required`) lo dice, invece di "non si
  può spostare nel suo stato".
- Per un soggiorno diviso su più postazioni (core 1.1), la scheda della postazione sulla mappa mostra i
  giorni su quella postazione, non tutto il soggiorno.
  La scheda della prenotazione elenca le postazioni in ordine (A2 → B4) con i giorni di ciascuna; lo
  spostamento parte dalla postazione occupata il primo giorno spostato, non la propone come
  destinazione e indica tutte le postazioni che libera. Uno spostamento di un soggiorno diviso non
  ancora iniziato lo porta tutto sulla nuova postazione.
- Su tablet ogni schermata usa tutta la larghezza con lo stesso margine delle liste; le card si
  affiancano quando c'è spazio (Impostazioni).
- Avviso "Stabilimento chiuso" uguale su Oggi e sulla mappa, con il giorno mostrato.
- Mappa del giorno con lo stesso fondo del pannello: sabbia chiara con la grana, mare tenue con le
  onde e la battigia, scritta "Mare" spaziata e sfumata, codici delle postazioni non disponibili
  sfumati (prima due rettangoli pieni con i colori della vecchia mappa).

### Rimosso

- Notifiche push: per decisione di Coste360 non fanno parte dell'app pubblica (ADR 0012, sostituisce la
  parte push dell'ADR 0011) e potranno diventare una funzione di una futura edizione a pagamento. Tolti
  il client mai attivato (card nelle impostazioni, registrazione del token, adattatore degli endpoint),
  la dipendenza `expo-notifications` e il plugin di configurazione per Firebase Messaging: nessun
  entitlement o permesso di notifica nella build. L'app aggiorna i dati quando viene aperta o torna in
  primo piano.

### Corretto

- Disponibilità: una postazione libera un solo giorno del soggiorno diceva "1 giorni su 7", ora "1 giorno su 7".
- In Expo Go la mappa mostrava l'errore "Cannot find native module 'ExpoWidgets'": il widget della
  home non viene più cercato in Expo Go, dove non esiste.
- Il calendario per scegliere il giorno su iOS si apriva vuoto: il calendario nativo non si disegna
  nella finestra sovrapposta dei dialoghi; ora il dialogo si apre nell'app e la tastiera si chiude.
- Su tablet le righe delle prenotazioni erano illeggibili nella lista stretta: l'importo da saldare
  occupava una colonna propria e schiacciava nome e stato. Ora sta sotto il nome.
- Dopo una vendita giornaliera o uno spostamento l'esito si apriva scorso sotto l'intestazione, con
  lo scorrimento del modulo: ora riparte dall'inizio.
- Su tablet le schermate aperte da un'altra (postazione, prenotazione, scanner, spostamento) non
  avevano il pulsante Indietro.

- Mappa del giorno: l'app si chiudeva alla fine di ogni spostamento o zoom con le dita (il worklet di
  fine gesto veniva catturato prima di essere definito); ora lo zoom e lo spostamento restano.
- iPad: il menu laterale si chiude in una barra di icone con il pulsante ≡ dell'intestazione; in
  verticale parte chiuso e, aperto, scorre da sinistra sopra il contenuto (si chiude toccando fuori o
  scegliendo una voce), in orizzontale sta accanto. Prenotazioni e Lista d'attesa usano lo stesso
  elenco + dettaglio: in verticale il dettaglio ha di nuovo spazio (prima circa 220 pt), con l'elenco
  vuoto o in errore niente "Seleziona…" accanto, il dettaglio segue rotazione e Split View. Stessa
  intestazione delle liste (ricerca con l'icona e il tasto per cancellare nel campo, filtri che
  scorrono fino al bordo, conteggio), stati vuoti in alto, campi e pulsanti alti 44 pt anche su iPad.
- Mappa del giorno su iPad in verticale (e finestre strette): la scheda della postazione si apriva
  accanto alla mappa lasciandole pochi punti di larghezza; ora si apre sotto quando accanto non c'è
  spazio. Barra più compatta (giorno e fascia su una riga, Mappa/Elenco accanto alla ricerca, legenda
  su una riga scorrevole) e risultati della ricerca chiusi quando si sceglie una postazione.
- iOS 26: ricerca e filtri di Prenotazioni, Lista d'attesa e Mappa finivano sotto l'intestazione
  trasparente; l'intestazione è ora opaca in tutte le schermate.
- Expo Go e build senza widget: il widget non viene più caricato se manca il suo modulo nativo (prima
  in sviluppo compariva una schermata rossa all'avvio).
- Desktop in rete locale: la coda offline usa lo stesso trasporto con pinning del resto dell'app (prima
  non poteva inviare nulla) e, se il certificato del desktop cambia, le operazioni restano in attesa per
  il nuovo abbinamento invece di risultare "non inviate".
- Vendita, offerta della lista d'attesa, stampa e blocchi: dopo un rifiuto del server il nuovo tentativo
  usa una chiave di idempotenza nuova (prima il core rigiocava lo stesso rifiuto per 24 ore); la stampa
  riusa la chiave dopo una risposta persa, così non stampa due volte.
