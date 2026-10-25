# Changelog

Tutte le modifiche rilevanti dell'app mobile di Arenile sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/) e il progetto adotta il
[Versionamento Semantico](https://semver.org/lang/it/). I messaggi di commit seguono
[Conventional Commits](https://www.conventionalcommits.org/it/v1.0.0/). Ogni versione indica la versione
minima di Arenile supportata e la release del core da cui viene il contratto API.

## [Unreleased]

### Aggiunto

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
