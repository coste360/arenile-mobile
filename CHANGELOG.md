# Changelog

Tutte le modifiche rilevanti dell'app mobile di Arenile sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/) e il progetto adotta il
[Versionamento Semantico](https://semver.org/lang/it/). I messaggi di commit seguono
[Conventional Commits](https://www.conventionalcommits.org/it/v1.0.0/). Ogni versione indica la versione
minima di Arenile supportata e la release del core da cui viene il contratto API.

## [Unreleased]

### Aggiunto

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
