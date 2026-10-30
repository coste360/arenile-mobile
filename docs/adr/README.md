# Architecture Decision Records

Ogni scelta non ovvia dell'app ha un ADR breve: contesto, decisione, conseguenze, stato.
Gli agenti e i contributori li leggono **prima** di proporre alternative. Cambiare una decisione esistente
richiede un nuovo ADR che sostituisce il precedente (il vecchio passa a "sostituito da NNNN", non si cancella).
Le decisioni del core sono nel suo repository (`docs/adr/` di `coste360/arenile`) e valgono anche qui
quando riguardano il contratto API, il marchio o la licenza.

## Indice

| N.                                                                  | Titolo                                                                                                                                                  | Stato                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| [0001](0001-stack-expo-react-native.md)                             | Stack: Expo SDK 58, React Native, expo-router, TypeScript strict, build con EAS (scartati Capacitor, Flutter, solo PWA)                                 | accettato; orientazione in 0016       |
| [0002](0002-repository-separato-e-contratto-api.md)                 | Repository separato e contratto API dall'`openapi.yaml` di una release fissata del core (tag + SHA-256), compatibilità con `/meta`                      | accettato                             |
| [0003](0003-autenticazione-con-token-del-dispositivo.md)            | Autenticazione con il token del dispositivo nel portachiavi, niente cookie, 401 gestito in un solo punto                                                | accettato                             |
| [0004](0004-ui-kit-reusables-nativewind.md)                         | UI kit: React Native Reusables su NativeWind 4 (Tailwind 3), solo token del tema del pannello, layout master/detail su tablet                           | accettato; eccezione in 0014          |
| [0005](0005-privacy-niente-telemetria-ne-aggiornamenti-remoti.md)   | Privacy: niente telemetria, SDK di analisi o crash reporting, niente `expo-updates`/EAS Update                                                          | accettato; eccezione in 0015          |
| [0006](0006-rete-locale-desktop-certificato-autofirmato.md)         | Rete locale del desktop: certificato autofirmato, trasporto nativo con pinning dell'impronta (`modules/pinned-fetch`)                                   | accettato                             |
| [0007](0007-offline-cache-e-coda-delle-operazioni.md)               | Offline: cache persistita di oggi e domani (SQLite, lista di chiavi ammesse), coda con chiavi di idempotenza, conflitti visibili                        | accettato                             |
| [0008](0008-mappa-del-giorno-renderer-svg.md)                       | Mappa del giorno: SVG tagliato all'area visibile, gesti sul thread UI, palette di stato del pannello, kit rinviati                                      | proposto; kit in 0013, giorni in 0014 |
| [0009](0009-operazioni-check-in-qr-e-azioni-solo-online.md)         | Operazioni: check-in dal QR della prenotazione (anche offline), ingressi al varco e blocchi delle postazioni solo online                                | accettato                             |
| [0010](0010-report-essenziali-e-widget.md)                          | Report dal confronto con l'anno precedente (solo online, `reports.read`); widget con `expo-widgets` alimentato dalla cache                              | proposto                              |
| [0011](0011-fase-2-vendita-spostamenti-lista-attesa-stampa-push.md) | Fase 2: vendita, spostamenti, lista d'attesa e stampa solo online e idempotenti; push con consenso, token nativo, adattatore tipizzato                  | proposto; push sostituite da 0012     |
| [0012](0012-niente-notifiche-push-nell-edizione-pubblica.md)        | Niente notifiche push nell'edizione pubblica (possibile funzione di una futura edizione a pagamento); dati aggiornati all'apertura                      | accettato                             |
| [0013](0013-illustrazioni-dei-kit-della-mappa.md)                   | Illustrazioni dei kit della mappa dalla release fissata del core (vendorizzate, SHA-256), simboli SVG con colori per tema e stato                       | proposto                              |
| [0014](0014-giorni-oltre-la-finestra-offline.md)                    | Calendario per mappa e prenotazioni: qualsiasi giorno online, oggi e domani anche offline; calendario nativo di `@expo/ui`                              | proposto                              |
| [0015](0015-prova-la-demo.md)                                       | "Prova la demo": abbinamento allo stabilimento dimostrativo di Coste360 con `demo-pairing` del core, unica eccezione a "nessun server predefinito"      | proposto                              |
| [0016](0016-telefono-in-verticale.md)                               | Telefono solo in verticale (classe hardware, non finestra), tablet in ogni orientazione; Info.plist per iOS, opzione di schermata per Android           | proposto                              |
| [0017](0017-licenza-bsl.md)                                         | Licenza: Business Source License 1.1 con i parametri del core, conversione in AGPL-3.0 dopo tre anni; "source available"; marchio escluso; CLA del core | accettato                             |

## Come aggiungere un ADR

1. Copia [`template.md`](template.md) in `NNNN-titolo-in-kebab-case.md` con il numero successivo.
2. Compila contesto, decisione e conseguenze in italiano, in modo conciso.
3. Aggiungi la riga all'indice qui sopra.
4. Se sostituisci un ADR, aggiorna lo stato del precedente e collega i due documenti.
