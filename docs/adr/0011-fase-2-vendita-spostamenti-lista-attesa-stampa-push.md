# 0011 — Fase 2: vendita, spostamenti, lista d'attesa e stampa solo online; push tramite l'istanza

- **Stato:** proposto
- **Data:** 2026-10-25
- **Sezioni della specifica:** `docs/spec/03-fase-2.md`; core §10.5 (lista d'attesa), §11.3 (vista
  operativa), §14.3 (vendita giornaliera), §21.2 (offline), §29.2 (app mobile); core ADR 0020 (vendita
  giornaliera), ADR 0021 (stampa ESC/POS), ADR 0027 (notifiche push tramite relay)

## Contesto

La fase 2 porta nell'app cinque funzioni del pannello: la vendita giornaliera rapida, lo spostamento di
una prenotazione, la lista d'attesa, la stampa del biglietto e le notifiche push facoltative. Le prime
quattro creano o spostano occupazioni (o le chiedono al server); la quinta passa da un servizio esterno
all'istanza e richiede endpoint che il core ha scritto dopo la release fissata dall'app (v1.0.1).

Vincoli: l'app non decide la disponibilità (vincoli del database del core) e non numera i biglietti;
l'offline accoda solo operazioni a basso rischio (ADR 0007, core §21.2); la privacy esclude servizi
terzi diversi dall'istanza e, solo se attivato, dal relay di Coste360 (ADR 0005); il codice generato non
si modifica e la versione fissata del core non si cambia senza una decisione (ADR 0002).

## Decisione

1. **Solo online, mai in coda.** Vendita giornaliera, spostamento, offerta della lista d'attesa e stampa
   chiamano l'istanza subito e sono disattivate senza connessione, con il motivo. Nessuna entra nella
   coda offline né nella cache persistita (le loro chiavi non sono nella lista ammessa, con test).
2. **Idempotenza delle creazioni.** Vendita, offerta e lavoro di stampa mandano un `Idempotency-Key` che
   resta lo stesso finché la richiesta non cambia: un doppio tocco o un nuovo tentativo dopo un timeout
   producono un solo effetto; dopo l'esito la richiesta successiva ha una chiave nuova.
3. **Vendita giornaliera solo per postazione.** Dalla scheda di una postazione libera (o con il giorno
   rilasciato dall'abbonato), ruoli con `bookings.write` e `cash.operate` e istanza con la funzione
   `cash`: fascia, pacchetti vendibili in cassa nella zona, extra del pacchetto, nome facoltativo,
   preventivo del server, contanti (solo con la cassa aperta, con il resto) o carta, conferma. Il totale
   visto viaggia come `expected_total` (409 `price_changed` se cambia). La vendita per zona resta nel
   pannello. Con la stampa automatica del pannello il biglietto va subito in stampa.
4. **Spostamento con anteprima.** Ogni scelta di postazione passa dal `dry_run` del core (conflitti negli
   altri giorni del soggiorno, nuovo totale); lo spostamento si applica con `If-Match` sulla versione
   della prenotazione. Un soggiorno già iniziato si sposta da oggi. Una prenotazione di una vendita
   giornaliera si sposta tramite il suo biglietto (`If-Match` sulla versione del biglietto, totale
   invariato), come nel pannello.
5. **Lista d'attesa come nel pannello.** Consultazione con `bookings.read`, offerta con `bookings.write`:
   la prima postazione compatibile o una scelta, durata dell'offerta 5–10080 minuti (predefinita dalle
   impostazioni). Una postazione liberata sulla mappa apre la lista sulle richieste compatibili (giorno,
   zona, postazione) e la propone già scelta. Il resto della gestione (iscrizioni, ordine, impostazioni)
   resta nel pannello.
6. **Stampa: il server stampa, l'app chiede.** Solo con `cash.operate`. L'app risolve l'instradamento
   `daily_ticket` per la cassa della sessione aperta, accoda il lavoro e lo segue fino a stampato o non
   riuscito (con "Riprova"). Quando nessuna stampante è pronta (edizione server, nessuna regola,
   stampante spenta o irraggiungibile) l'app lo dice e non offre il pulsante: l'app non stampa da sé.
7. **Push: consenso esplicito, token nativo, solo verso l'istanza.** La card delle impostazioni compare
   solo con `capabilities.push_notifications` in `/meta` e il modulo nativo nella build. Accendere chiede
   il permesso del sistema (su Android dopo aver creato il canale), legge il token **nativo** APNs/FCM
   (`getDevicePushTokenAsync` di `expo-notifications`) e lo registra con `PUT /api/device/v1/push`
   insieme agli argomenti scelti tra quelli ammessi dal ruolo, alla lingua e all'ambiente APNs. Mai il
   token o il servizio push di Expo, mai la registrazione automatica del modulo (un test lo impedisce).
   Un token rinnovato dal sistema viene registrato di nuovo finché il dispositivo è registrato.
8. **Adattatore tipizzato per gli endpoint non ancora rilasciati.** `GET/PUT/DELETE /api/device/v1/push`
   e il tipo di problema `push_unavailable` non sono nel contratto fissato: `src/api/push-adapter.ts` ne
   copia i tipi dall'`openapi.yaml` del core, passa dall'unico client API e porta l'istruzione di essere
   sostituito dai tipi generati quando una release del core li contiene. Il codice generato non si tocca.
9. **FCM dormiente fino al consenso.** Un plugin di configurazione (`plugins/with-fcm-privacy.js`)
   disattiva l'inizializzazione automatica di Firebase Messaging, così Android non chiede un token a
   Google prima che l'utente accenda le notifiche. I token iOS sono di produzione (`mode` del plugin
   `expo-notifications`, tenuto uguale all'ambiente inviato da un test).

## Conseguenze

- Positive: nessuna operazione che tocca la disponibilità può partire offline o due volte; le regole
  restano quelle del server; le push non portano dati personali e si spengono dall'app o dal pannello;
  l'adattatore si elimina con un solo `make api-bump` e una sostituzione dei tipi.
- Negative: senza rete la vendita, gli spostamenti, la lista d'attesa e la stampa non ci sono; la stampa
  funziona solo con l'edizione desktop (sull'edizione server il core non raggiunge le stampanti) e
  l'edizione desktop in rete locale aspetta il trasporto con pinning (ADR 0006); le push richiedono il
  relay di Coste360, le credenziali APNs/FCM di Coste360 e una build EAS; fino alla release del core la
  card push non compare sulle istanze v1.0.1 (la capacità in `/meta` è falsa).
- Verifiche: test di unità delle regole (`features/daily-sale`, `move-booking`, `waitlist`, `printing`,
  `push`), test delle schermate a larghezza telefono e tablet in `src/test/screens/`, test della lista di
  chiavi persistite (`persist.test.ts`) e i controlli di privacy in `features/push/push.test.ts`.
