# Changelog

Tutte le modifiche rilevanti dell'app mobile di Arenile sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/) e il progetto adotta il
[Versionamento Semantico](https://semver.org/lang/it/). I messaggi di commit seguono
[Conventional Commits](https://www.conventionalcommits.org/it/v1.0.0/). Ogni versione indica la versione
minima di Arenile supportata e la release del core da cui viene il contratto API.

## [Unreleased]

### Aggiunto

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
- Messaggio chiaro per l'app desktop in rete locale (certificato autogenerato), in attesa del trasporto
  con pinning dell'impronta (ADR 0006).
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
