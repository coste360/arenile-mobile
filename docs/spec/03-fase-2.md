# Fase 2

- **Vendita giornaliera rapida** dalla mappa o dalla scheda postazione, **solo online** (garanzia di
  disponibilità e numerazione dei biglietti lato server).
- **Spostamento di una prenotazione**, solo online.
- **Lista d'attesa:** consultazione e offerta di una postazione liberata, come nel pannello.
- **Stampa del ticket** su stampanti ESC/POS Wi-Fi/Ethernet configurate nel pannello (ADR 0021 del
  core): la stampa la esegue il server, l'app la richiede.

## Stato

Decisioni in [ADR 0011](../adr/0011-fase-2-vendita-spostamenti-lista-attesa-stampa-push.md). Tutte le
funzioni di questa fase sono **solo online**: disattivate senza connessione, mai in coda. Implementate e
coperte da test delle schermate; nessuna è stata provata su un dispositivo o con una stampante reale.

- **Vendita giornaliera rapida:** pulsante _Vendita giornaliera_ nella scheda di una postazione libera o
  rilasciata (oggi o domani), per i ruoli con `bookings.write` e `cash.operate` (titolare, gestore,
  cassiere). Fascia, pacchetto vendibile in cassa nella zona, extra, nome facoltativo, totale dal
  preventivo del server, contanti con il resto (solo a cassa aperta) o carta, conferma; poi il biglietto
  numerato, stampato subito se nel pannello è attiva la stampa automatica. Solo per postazione: la
  vendita per zona resta nel pannello.
- **Spostamento:** _Sposta su un'altra postazione_ dalla scheda della postazione occupata e dalla scheda
  prenotazione (`bookings.write`). Postazioni libere per le fasce della prenotazione nel primo giorno
  spostato, anteprima del server (conflitti negli altri giorni, nuovo totale), conferma. Un soggiorno già
  iniziato si sposta da oggi; una vendita giornaliera si sposta tramite il biglietto, senza cambiare il
  totale.
- **Lista d'attesa:** schermata _Lista d'attesa_ (home del telefono, pannello di navigazione del tablet)
  per chi legge le prenotazioni: coda in ordine di priorità, offerte in corso, ricerca per cliente,
  dettaglio della richiesta e dell'offerta. Chi scrive le prenotazioni offre un posto (la prima
  postazione compatibile o una scelta, per 5–10080 minuti). Dalla mappa _Offri a chi è in lista
  d'attesa_ apre le richieste compatibili con la postazione liberata.
- **Stampa del biglietto:** _Stampa il biglietto_ nella scheda della postazione di una vendita
  giornaliera, nella scheda prenotazione e dopo la vendita, per chi ha `cash.operate`. Il server stampa
  sulla stampante instradata nel pannello e l'app segue il lavoro; senza una stampante pronta (edizione
  server, nessuna regola, stampante spenta o irraggiungibile) l'app dice perché.
- **Notifiche push: non in questa edizione.** Per decisione di Coste360 l'app pubblica non ha notifiche
  push ([ADR 0012](../adr/0012-niente-notifiche-push-nell-edizione-pubblica.md)): richiederebbero un
  relay centrale e le credenziali APNs/Firebase di Coste360, e potranno diventare una funzione di una
  futura edizione a pagamento. L'app rilegge i dati dall'istanza quando viene aperta o torna in primo
  piano e alla riconnessione.
