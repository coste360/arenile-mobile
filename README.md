# Arenile mobile

L'app per lo staff degli stabilimenti balneari che usano [Arenile](https://arenile.app), il gestionale
con codice sorgente disponibile di Coste360 SRL. Si collega alla **tua** istanza Arenile (VPS, hosting
gestito o app desktop in rete locale) con il QR code del pannello: non ha un server predefinito e non
invia dati a Coste360.

> **Stato:** fasi 0–3 implementate e verificate con i test (`make check-full` verde), **non ancora
> provate su dispositivi reali né compilate con EAS Build** e non pubblicate negli store: servono gli
> account Expo/EAS, Apple Developer e Google Play di Coste360. Le notifiche push aspettano anche una
> release del core. Dettagli nel [piano dell'app](docs/spec/README.md) e in
> [Da fare prima della pubblicazione](#da-fare-prima-della-pubblicazione).

## Cosa fa oggi

**Collegamento (fase 0)**

- **Collega a un'istanza** inquadrando il QR di _Configurazione → Dispositivi → Abbina un dispositivo_
  (anche con la fotocamera di sistema: il link `arenile://pair?d=…` apre l'app) oppure digitando indirizzo
  e codice di abbinamento.
- Verifica che l'istanza sia Arenile e compatibile (`GET /api/admin/v1/meta`): versione minima di Arenile
  supportata **1.0.0**; avvisa anche quando è l'app a dover essere aggiornata.
- Conserva il token del dispositivo nel portachiavi (Keychain / Keystore). Se il dispositivo viene
  revocato dal pannello, l'app lo spiega e torna alla schermata di collegamento.
- Si collega anche all'app desktop in **rete locale** (certificato autogenerato): accetta solo il
  certificato con l'impronta del QR, avvisa prima del rinnovo e chiede di riabbinare dopo
  ([ADR 0006](docs/adr/0006-rete-locale-desktop-certificato-autofirmato.md), modulo nativo
  [`modules/pinned-fetch`](modules/pinned-fetch/README.md)). Serve la build dell'app (EAS Build): in Expo
  Go la rete locale del desktop non è disponibile.
- Impostazioni: lingua (italiano, inglese, tedesco, francese), tema chiaro/scuro, _Scollega questo
  dispositivo_. Layout per telefono e per tablet/iPad (pannello di navigazione laterale).

**Il lavoro del giorno (fase 1)**

- **Oggi:** arrivi, presenti, postazioni libere, da saldare e giorni rilasciati, ognuno apre l'elenco
  filtrato.
- **Prenotazioni del giorno** di oggi o domani con filtri, ricerca e ordinamento, e la scheda della
  prenotazione (su tablet elenco e scheda affiancati).
- **Mappa del giorno** con i colori di stato del pannello (sempre con simbolo ed etichetta), zoom e
  spostamento con i gesti, ricerca, vista a elenco, scheda della postazione
  ([ADR 0008](docs/adr/0008-mappa-del-giorno-renderer-svg.md)).
- **Operazioni:** check-in dal QR della prenotazione o del biglietto o dal codice, ingresso al varco,
  rilascio del giorno degli abbonati, note, incasso in contanti, blocco delle postazioni
  ([ADR 0009](docs/adr/0009-operazioni-check-in-qr-e-azioni-solo-online.md)).
- **Offline:** mappa e prenotazioni di oggi e domani restano consultabili; check-in, rilasci, note e
  incassi in contanti vanno in coda con chiavi di idempotenza e partono alla riconnessione; indicatore
  della connessione sempre visibile ([ADR 0007](docs/adr/0007-offline-cache-e-coda-delle-operazioni.md)).

**Fase 2** ([ADR 0011](docs/adr/0011-fase-2-vendita-spostamenti-lista-attesa-stampa-push.md), tutto solo online)

- Vendita giornaliera rapida dalla mappa, spostamento di una prenotazione, lista d'attesa con l'offerta
  di un posto, stampa del biglietto sulla stampante ESC/POS del pannello (edizione desktop).
- Notifiche push facoltative: il client è pronto ma la card compare solo sulle istanze che le offrono
  (serve una release del core successiva alla v1.0.1, più le credenziali APNs/Firebase di Coste360).

**Fase 3** ([ADR 0010](docs/adr/0010-report-essenziali-e-widget.md))

- Report essenziali (incassato, occupazione, prenotazioni e prenotato rispetto all'anno precedente) per
  titolare, gestore e sola lettura.
- Widget della schermata principale di iOS e Android con i conteggi di oggi, letti dalla cache.

Ogni azione segue i permessi del ruolo come nel pannello: ciò che il ruolo non può fare non compare, e
un rifiuto del server si mostra come "non consentito".

**Da provare su dispositivo prima del rilascio:** rete locale del desktop (modulo nativo mai compilato
per intero), gesti della mappa con centinaia di postazioni, fotocamera, widget, permessi di sistema,
notifiche push, stampa su una stampante reale.

## Privacy

L'app parla solo con la tua istanza: nessuna telemetria, nessun SDK di analisi, pubblicità o crash
reporting, nessun aggiornamento remoto del codice ([ADR 0005](docs/adr/0005-privacy-niente-telemetria-ne-aggiornamenti-remoti.md)).
Le notifiche push sono facoltative e spente finché non le accendi: passano dal relay di Coste360, che
riceve solo l'identificativo del telefono dato da Apple o Google e un testo generico, mai dati dei
clienti ([ADR 0011](docs/adr/0011-fase-2-vendita-spostamenti-lista-attesa-stampa-push.md)).

## Sviluppo

Prerequisiti: Node.js 22+, npm 10+, `make`. Non servono Xcode né Android SDK: le build native si fanno
con EAS Build.

```bash
make setup   # npm ci
make dev     # Metro (Expo): build di sviluppo o Expo Go
make check   # contratto generato aggiornato + lint + guardia degli stili + tsc + test (< 2 min)
make         # tutti i comandi
```

| Comando                        | Quando                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `make check`                   | Dopo ogni modifica                                                                                  |
| `make check-full`              | Prima di aprire una pull request: aggiunge `expo-doctor` e la compilazione dei bundle iOS e Android |
| `make gen`                     | Dopo aver cambiato la release del core fissata                                                      |
| `make api-bump VERSION=vX.Y.Z` | Per passare al contratto API di un'altra release del core                                           |

Il contratto API è l'`openapi.yaml` della release del core indicata in `api/core-version.json` (oggi
**v1.0.1**), verificato con SHA-256; i tipi TypeScript in `src/api/generated/` si generano con
`make gen` e non si modificano a mano ([ADR 0002](docs/adr/0002-repository-separato-e-contratto-api.md)).

Per provare l'app su un dispositivo serve una **build di sviluppo** con EAS Build (account Expo):
la configurazione (`eas.json`, `expo-dev-client`) si aggiunge con la prima build, quando l'account Expo
di Coste360 sarà disponibile. Fotocamera e portachiavi sono inclusi anche in Expo Go per provare i flussi
base con `make dev`.
Per un'istanza locale usa `http://localhost:8080` dal simulatore o un indirizzo `https` (ad esempio un
tunnel) dal telefono: l'app accetta `http` solo su loopback.

Leggi [AGENTS.md](AGENTS.md) (regole del progetto, anche per gli agenti AI), gli [ADR](docs/adr/README.md)
e [CONTRIBUTING.md](CONTRIBUTING.md).

## Struttura

```
src/app/            rotte expo-router (collega, scansione, manuale, collegamento, area collegata)
src/api/            client API unico, trasporto, errori tipizzati; generated/ = tipi dal contratto
src/features/       abbinamento, sessione, dati, offline, mappa, operazioni, fase 2, report, widget
modules/pinned-fetch/ modulo nativo locale: trasporto con pinning per il desktop in rete locale
src/widgets/        layout del widget della schermata principale (expo-widgets)
src/components/     componenti dell'app; ui/ = React Native Reusables
src/i18n/           i18next, lingue it (sorgente), en, de, fr
docs/spec/          piano dell'app per fasi
docs/adr/           decisioni
```

## Da fare prima della pubblicazione

- **Licenza dell'app:** in attesa di una decisione di Coste360. La specifica del core (sezione 29.2)
  prevede la Business Source License 1.1 come il core, salvo diversa decisione prima della
  pubblicazione. Fino ad allora il repository non contiene un file `LICENSE`: tutti i diritti sono
  riservati a Coste360 SRL.
- **Marchio:** icona, icona adattiva Android, schermata di avvio e simbolo nell'app vengono dal kit
  ufficiale del core (`assets/brand` del core, ADR 0018 del core). Gli asset del marchio non sono coperti
  dalla licenza del codice ([assets/brand/NOTICE.md](assets/brand/NOTICE.md)). Da verificare con il
  marchio: varianti dedicate per l'icona adattiva e per la schermata di avvio (oggi derivate dal simbolo
  ufficiale con margini) e le schede degli store.
- **Account:** Expo/EAS (build e invio), Apple Developer Program e Google Play Console di Coste360,
  identificativo `app.arenile.mobile` (nessuna build EAS è stata ancora fatta: `eas.json` si aggiunge
  con la prima); per il widget iOS anche l'estensione
  `app.arenile.mobile.ExpoWidgetsTarget` e l'app group `group.app.arenile.mobile` (ADR 0010).
- **Build e prove su dispositivo:** una build di sviluppo EAS per iOS e Android (servono per
  `expo-sqlite`, il modulo `modules/pinned-fetch`, l'estensione del widget e `expo-notifications`), poi
  le prove su iPhone, iPad e Android elencate nel [piano dell'app](docs/spec/README.md); il test JUnit del
  modulo Android (`./gradlew :pinned-fetch:testDebugUnitTest` in un progetto generato con prebuild).
- **Kit della mappa:** le illustrazioni dei kit del core non sono ancora usate (ADR 0008): servono una
  release del core che le pubblichi come asset versionato e la decisione sulla licenza dell'app.
- **Notifiche push (fase 2, ADR 0011):** una chiave APNs del team Apple di Coste360 e un progetto
  Firebase di Coste360 per FCM (il file `google-services.json` va indicato in `android.googleServicesFile`
  al momento della build EAS, non nel repository), consegnati al relay `push.coste360.it`; una release
  del core con `/api/device/v1/push`, poi `make api-bump` e la sostituzione di `src/api/push-adapter.ts`
  con i tipi generati.

## Contatti

Coste360 SRL — [arenile.app](https://arenile.app). Vulnerabilità: [SECURITY.md](SECURITY.md).
