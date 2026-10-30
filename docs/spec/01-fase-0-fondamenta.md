# Fase 0 — Fondamenta

Obiettivo: un'app installabile che si collega in modo sicuro a un'istanza Arenile, verifica la
compatibilità, resta collegata finché il dispositivo non viene revocato e prepara le basi (lingue,
tema, accessibilità, layout telefono e tablet) per le funzioni operative della fase 1. Nessuna funzione
finta o segnaposto "in arrivo" nelle schermate.

## Collegamento

- **QR code.** Il pannello (_Configurazione → Dispositivi → Abbina un dispositivo_) mostra un QR con il
  testo `arenile://pair?d=<base64url(JSON)>`, JSON `{v:1, url, code, fingerprint?, establishment_name?}`
  (core `internal/domain/device/qr.go`). L'app lo legge con la fotocamera; inquadrandolo con la
  fotocamera di sistema si apre l'app sulla schermata di collegamento (schema `arenile`). Un link
  aperto da fuori dell'app (fotocamera di sistema, un'altra app, una pagina web, un tag NFC) mostra
  prima l'indirizzo dell'istanza e chiede conferma: nessuna richiesta parte senza il consenso
  dell'utente. Il link accetta solo il parametro `d`; QR inquadrato nell'app e modulo manuale passano
  l'indirizzo in memoria.
  Regole del decodificatore uguali al core: `v` deve essere 1, `code` non vuoto, `url` http o https con
  host; un QR che non è di Arenile mostra un avviso e la scansione continua.
- **Indirizzo e codice a mano.** In alternativa l'utente digita l'indirizzo dell'istanza e il codice di
  abbinamento (8 caratteri Crockford, `ABCD-EFGH`, maiuscole e trattini indifferenti). Un indirizzo senza
  schema diventa `https://`; `http` è accettato solo su loopback (sviluppo), perché il token non deve mai
  viaggiare in chiaro.
- **Verifica dell'istanza.** Prima di usare il codice l'app legge `GET /api/admin/v1/meta`: se non è
  Arenile, se è più vecchia della versione minima supportata dall'app (1.0.0) o se `min_client_versions`
  dice che l'app è troppo vecchia, lo spiega con un messaggio chiaro e non invia il codice.
- **Abbinamento.** `POST /api/device/v1/pair` scambia il codice (monouso, 5 minuti) con il token del
  dispositivo `ar_dev_…`, legato all'utente e allo stabilimento del codice: non serve scegliere lo
  stabilimento. Errori distinti: codice non valido/scaduto/usato, troppi tentativi, istanza non
  raggiungibile, abbinamento non disponibile (desktop senza rete locale), risposta inattesa.
- **Nome del dispositivo.** Quello del sistema (es. "iPad"), mostrato nel pannello accanto all'utente.

## Token e revoca

- Il token si conserva nel **portachiavi del dispositivo** (Keychain iOS, Keystore Android), accessibile
  dopo il primo sblocco e mai migrato su un altro dispositivo con i backup (ADR 0003). Nessun cookie.
- All'avvio, se c'è un token, l'app verifica `GET /api/device/v1/self` e `/meta`. Un `401` dell'istanza
  (`application/problem+json` di tipo `unauthorized`: dispositivo
  revocato dal pannello o inattivo da 90 giorni) cancella la sessione e riporta a _Collega_ con la
  spiegazione. Se l'istanza non è raggiungibile la sessione resta e la schermata principale lo dice.
- **Scollega dispositivo** (Impostazioni) chiede conferma in una finestra di dialogo, revoca il token con
  `DELETE /api/device/v1/self` e lo cancella. Se l'istanza non risponde si può scollegare solo il
  dispositivo, sapendo che l'accesso resta nel pannello finché non viene revocato.

## Rete locale del desktop

L'edizione desktop in modalità rete locale usa un certificato autogenerato; il QR ne porta l'impronta
SHA-256. Il trasporto di rete di React Native non accetta certificati autofirmati e l'app non indebolisce
mai TLS: le istanze con impronta passano dal modulo nativo `modules/pinned-fetch`, che accetta **solo** il
certificato con quell'impronta (ADR 0006). In dettaglio:

- l'impronta del QR viene validata; il collegamento avviene come per le altre istanze e l'impronta resta
  nella sessione, così ogni richiesta successiva è legata allo stesso certificato;
- se il server presenta un altro certificato il collegamento si ferma prima di inviare il codice e chiede
  un nuovo QR dall'app desktop;
- il certificato si rinnova 30 giorni prima della scadenza (`lan_cert_renews_at` in `/meta`): nei 30
  giorni precedenti la schermata principale annuncia la data; dopo il rinnovo spiega che il certificato è
  cambiato e offre "Abbina di nuovo" (la schermata "Collega" ricorda di revocare il vecchio abbinamento
  nel pannello);
- in una build senza il modulo nativo (Expo Go, web) un QR con impronta mostra "Rete locale del desktop
  non supportata" con la spiegazione, senza richieste di rete;
- su iOS il primo collegamento chiede il permesso "Rete locale", con la spiegazione tradotta.

## Schermate

- **Collega a un'istanza:** marchio, due azioni (QR, indirizzo e codice), nota sulla privacy, motivo
  dell'ultima disconnessione (revoca, scollegamento, certificato del desktop cambiato).
- **Scansione:** permesso della fotocamera con spiegazione, rinvio alle impostazioni se negato,
  alternativa manuale sempre visibile.
- **Collegamento in corso / errori:** stato di avanzamento e, per ogni errore, cosa fare (riprova, nuovo
  QR, inserimento manuale, torna all'inizio).
- **Schermata principale:** nome dello stabilimento, utente e ruolo, stato della connessione con ultima
  verifica e "Verifica di nuovo", indirizzo, versione ed edizione dell'istanza, avviso se l'istanza o
  l'app vanno aggiornate; sull'app desktop in rete locale, avviso di rinnovo del certificato e, dopo il
  rinnovo, "Abbina di nuovo".
- **Impostazioni:** istanza, dispositivo (nome nel pannello, utente, ruolo, data del collegamento),
  lingua (del dispositivo, italiano, inglese, tedesco, francese), tema (sistema, chiaro, scuro),
  informazioni sull'app, _Scollega questo dispositivo_.

## Lingua, tema, accessibilità, layout

- Lingua: scelta dell'utente, altrimenti la prima lingua del dispositivo supportata, altrimenti
  italiano. Anche i messaggi di sistema (permesso della fotocamera, nome dell'app) sono tradotti.
- Tema chiaro e scuro con i colori del pannello (design system Coste360).
- Accessibilità: ruoli ed etichette su ogni controllo, stati annunciati, testo dinamico, aree tattili
  di almeno 44 pt.
- Layout: su telefono una pila di schermate; su tablet e iPad (lato corto di almeno 600 dp) un pannello
  di navigazione laterale con il dettaglio a destra; su iPad in Slide Over o Split View stretta il
  layout da telefono. Telefono in verticale, tablet in ogni orientazione (ADR 0016).

## Stato

Implementata. Collegamento da QR, link e modulo manuale, compatibilità, token nel portachiavi e revoca,
lingue, tema e layout telefono/tablet sono coperti dai test delle schermate. La rete locale del desktop
usa il modulo nativo `modules/pinned-fetch` (ADR 0006, accettato): logica JS e test Swift del
fingerprint verificati, ma il modulo iOS completo e il modulo Kotlin con il suo test JUnit non sono mai
stati compilati (servono Xcode, JDK e Android SDK o una build EAS). Da provare su iPhone, iPad e Android
contro l'app desktop in rete locale: impronta giusta, sbagliata, certificato rinnovato e permesso "Rete
locale" di iOS.

## Criteri di accettazione

- Collegamento da QR (app e fotocamera di sistema) e a mano, con tutti gli errori sopra, coperti da test.
- Token solo nel portachiavi; revoca dal pannello gestita al primo avvio o alla prima richiesta.
- Messaggio chiaro per istanza troppo vecchia, app troppo vecchia e rete locale del desktop non
  supportata dalla build.
- App desktop in rete locale: collegamento con l'impronta giusta, rifiuto con impronta sbagliata o
  certificato rinnovato (test con il modulo nativo simulato; prova su dispositivi reali prima del
  rilascio).
- Quattro lingue con le stesse chiavi (test), tema chiaro e scuro, schermate provate a larghezza di
  telefono e di tablet.
- `make check-full` verde: test, lint, guardia degli stili, `expo-doctor`, bundle iOS e Android.
