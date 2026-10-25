# Fase 2

- **Notifiche push facoltative** (sezione 29.2 del core): per vincolo di Apple e Google passano da un
  relay centrale. Il relay di Coste360 riceve solo un identificativo opaco del dispositivo e un testo
  generico ("Nuova prenotazione"), mai dati personali; l'istanza può anche non usare push (l'app
  aggiorna i dati all'apertura). Attivazione esplicita dall'utente e dal gestore.
- **Vendita giornaliera rapida** dalla mappa o dalla scheda postazione, **solo online** (garanzia di
  disponibilità e numerazione dei biglietti lato server).
- **Spostamento di una prenotazione**, solo online.
- **Lista d'attesa:** consultazione e offerta di una postazione liberata, come nel pannello.
- **Stampa del ticket** su stampanti ESC/POS Wi-Fi/Ethernet configurate nel pannello (ADR 0021 del
  core): la stampa la esegue il server, l'app la richiede.

## Stato

Decisioni in [ADR 0011](../adr/0011-fase-2-vendita-spostamenti-lista-attesa-stampa-push.md). Tutte le
funzioni di questa fase sono **solo online**: disattivate senza connessione, mai in coda.

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
- **Notifiche push:** card _Notifiche push_ nelle impostazioni, solo se l'istanza le offre (`/meta`).
  Spente finché l'utente non le accende: permesso del sistema, token nativo APNs/FCM registrato
  sull'istanza con gli avvisi scelti (nuove prenotazioni online, prenotazioni da approvare, pagamenti
  non riusciti, secondo il ruolo). Mai il servizio push di Expo. **In attesa della release del core**
  con `/api/device/v1/push` (ADR 0027 del core): fino ad allora la card non compare sulle istanze v1.0.1
  e il client usa un adattatore tipizzato da sostituire con i tipi generati. Da provare su dispositivo
  con una build EAS, con le credenziali APNs e Firebase di Coste360 e il relay attivo.
