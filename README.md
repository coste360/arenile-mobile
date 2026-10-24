# Arenile mobile

L'app per lo staff degli stabilimenti balneari che usano [Arenile](https://arenile.app), il gestionale
con codice sorgente disponibile di Coste360 SRL. Si collega alla **tua** istanza Arenile (VPS, hosting
gestito o app desktop in rete locale) con il QR code del pannello: non ha un server predefinito e non
invia dati a Coste360.

> **Stato:** fase 0 (fondamenta). L'app si collega a un'istanza, verifica la compatibilità, gestisce la
> revoca del dispositivo, lingua e tema, su telefono e tablet. Le funzioni operative (mappa del giorno,
> prenotazioni, check-in, incassi, offline) arrivano con la fase 1: vedi il [piano dell'app](docs/spec/README.md).

## Cosa fa oggi

- **Collega a un'istanza** inquadrando il QR di _Configurazione → Dispositivi → Abbina un dispositivo_
  (anche con la fotocamera di sistema: il link `arenile://pair?d=…` apre l'app) oppure digitando indirizzo
  e codice di abbinamento.
- Verifica che l'istanza sia Arenile e compatibile (`GET /api/admin/v1/meta`): versione minima di Arenile
  supportata **1.0.0**; avvisa anche quando è l'app a dover essere aggiornata.
- Conserva il token del dispositivo nel portachiavi (Keychain / Keystore). Se il dispositivo viene
  revocato dal pannello, l'app lo spiega e torna alla schermata di collegamento.
- Schermata principale con stabilimento, utente e ruolo, stato della connessione, versione dell'istanza.
- Impostazioni: lingua (italiano, inglese, tedesco, francese), tema chiaro/scuro, _Scollega questo
  dispositivo_.
- Layout per telefono e per tablet/iPad (pannello di navigazione laterale), tutte le orientazioni.
- L'app desktop in **rete locale** (certificato autogenerato) non è ancora supportata: l'app lo dice
  chiaramente; la soluzione è descritta nell'[ADR 0006](docs/adr/0006-rete-locale-desktop-certificato-autofirmato.md).

## Privacy

L'app parla solo con la tua istanza: nessuna telemetria, nessun SDK di analisi, pubblicità o crash
reporting, nessun aggiornamento remoto del codice ([ADR 0005](docs/adr/0005-privacy-niente-telemetria-ne-aggiornamenti-remoti.md)).

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
src/features/       abbinamento, sessione, compatibilità, preferenze
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
  identificativo `app.arenile.mobile`.

## Contatti

Coste360 SRL — [arenile.app](https://arenile.app). Vulnerabilità: [SECURITY.md](SECURITY.md).
