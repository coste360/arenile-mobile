# Piano dell'app mobile di Arenile

L'app mobile è l'app per lo **staff in spiaggia** e per il **gestore in movimento**. È un'unica app
pubblicata da Coste360 su App Store e Google Play che ogni stabilimento collega alla **propria** istanza
Arenile (VPS, hosting gestito o edizione desktop in rete locale), sul modello di Nextcloud o Home
Assistant: non ha un server predefinito.

La specifica autorevole resta quella del core: sezione 29.2 (app mobile), 16 (ruoli e permessi),
21.2 (funzionamento offline), 11.3 (vista operativa della mappa), 19 (notifiche). Questo piano la
traduce in fasi di rilascio; le decisioni tecniche sono negli [ADR](../adr/README.md).

## Principi

- **Privacy first.** L'app parla solo con l'istanza del gestore: nessun dato passa da Coste360, nessuna
  telemetria, nessun SDK di analisi, pubblicità o crash reporting, nessun aggiornamento remoto del codice
  (ADR 0005).
- **Stessi permessi del pannello.** Il token del dispositivo ha i permessi del ruolo dell'utente nello
  stabilimento del codice (sezione 16 del core); l'app non inventa permessi propri e nasconde ciò che il
  ruolo non consente.
- **Il pannello resta il posto della configurazione.** Configurazione, prezzi, mappe, utenti, rimborsi ed
  esportazioni restano nel pannello web.
- **Contratto unico.** L'app usa solo le API pubblicate nel contratto OpenAPI di una release del core
  (ADR 0002). Una funzione che richiede un endpoint nuovo parte dal core.
- **Telefono e tablet.** Ogni schermata funziona su telefono e su tablet/iPad, con layout dedicati.
- **Lingue e accessibilità.** Italiano (lingua sorgente), inglese, tedesco e francese come il pannello;
  lettori di schermo, testo dinamico, contrasto AA, aree tattili di almeno 44 pt.

## Fasi

| Fase | Documento                                                 | Contenuto                                                                            | Stato                                                   |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| 0    | [Fondamenta](01-fase-0-fondamenta.md)                     | Collegamento, token, versioni, lingue, tema, layout                                  | implementata, da provare su dispositivo                 |
| 1    | [Prima versione negli store](02-fase-1-prima-versione.md) | Oggi, mappa, prenotazioni, check-in, rilasci, incassi in contanti, offline           | implementata, da provare su dispositivo; non pubblicata |
| 2    | [Fase 2](03-fase-2.md)                                    | Notifiche push facoltative, vendita giornaliera, spostamenti, lista d'attesa, stampa | implementata; push in attesa del core e degli account   |
| 3    | [Fase 3](04-fase-3.md)                                    | Report essenziali, widget                                                            | implementata, widget da provare su dispositivo          |
| —    | [Esclusi per decisione](05-esclusi.md)                    | Cosa l'app non farà                                                                  | —                                                       |

"Implementata" vuol dire: codice, test di unità e delle schermate (telefono e tablet) e `make check-full`
verdi. Nessuna fase è stata ancora provata su un iPhone, un iPad o un telefono Android reale né
compilata con EAS Build: servono gli account Expo/EAS, Apple Developer e Google Play di Coste360. Il
dettaglio di cosa manca è nella sezione _Stato_ di ogni fase.
