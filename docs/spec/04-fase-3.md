# Fase 3

- **Report essenziali** per titolare, gestore e sola lettura (stessi permessi del pannello): incassi e
  occupazione del giorno e della settimana, confronto con l'anno precedente. Le esportazioni restano
  nel pannello.
- **Widget nella schermata principale** di iOS e Android con il riepilogo del giorno, ad esempio
  "12 arrivi, 3 da saldare". Il widget legge solo dati già in cache sul dispositivo e non contatta
  servizi diversi dall'istanza.

## Stato

- **Report:** schermata _Report_ (scorciatoia nell'intestazione del telefono, voce del pannello di
  navigazione su tablet) solo per i ruoli con `reports.read`. Giorno o settimana (lunedì–domenica), con
  navigazione all'indietro fino a quella corrente; incassato, occupazione, prenotazioni e prenotato
  rispetto all'anno precedente (stessa data o stesso giorno della settimana) e, per la settimana, il
  giorno per giorno. Dati dal confronto con l'anno precedente del core (`GET reports/comparison`); solo
  online, non salvati nella cache offline ([ADR 0008](../adr/0008-report-essenziali-e-widget.md)).
- **Widget:** `DaySummary` per iOS (piccolo e medio) e Android con arrivi, da saldare, presenti e
  postazioni libere di oggi, calcolati dall'app dal giorno operativo già in cache; solo conteggi, nessun
  nome o importo; alla mezzanotte dello stabilimento iOS passa a "dati di ieri", Android mostra sempre il
  giorno dei dati. Allo scollegamento il widget chiede di collegare il dispositivo. Da provare su
  dispositivo con una build EAS (ADR 0008).
