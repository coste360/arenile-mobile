# 0007 — Offline: cache persistita e coda delle operazioni

- **Stato:** accettato
- **Data:** 2026-10-25
- **Sezioni della specifica:** `docs/spec/02-fase-1-prima-versione.md` ("Offline"), core §21.2, §16,
  §17.1 (idempotenza), core ADR 0016 (offline del pannello), core ADR 0019 C (If-Match sul check-in)

## Contesto

In spiaggia la rete è instabile. La fase 1 chiede le stesse regole del pannello (core §21.2): mappa e
prenotazioni di oggi e domani consultabili offline, coda delle operazioni a basso rischio inviate in
ordine con chiavi di idempotenza, conflitti mostrati all'utente, creazione e spostamento solo online,
indicatore della connessione sempre visibile. Il pannello lo fa con IndexedDB e una coda propria
(`web/shared/src/offline`). Sul telefono il portachiavi (ADR 0003) non può contenere i dati del giorno
(limiti di dimensione, lentezza) e i dati vanno comunque protetti e cancellati allo scollegamento.

Alternative considerate: `@react-native-async-storage/async-storage` (pacchetto in più, stesse
garanzie), le mutation in pausa di TanStack Query persistite (ordine e chiavi non controllabili,
riprese legate ai `mutationFn` registrati all'avvio), un database con sincronizzazione (sproporzionato:
le operazioni sono poche e il server resta l'unico giudice).

## Decisione

1. **Archivio:** `expo-sqlite/kv-store` (pacchetto Expo, nessuna connessione di rete) nella sandbox
   dell'app, protetta dalla cifratura del sistema; il portachiavi resta solo per il token. Accesso
   tramite l'interfaccia `KeyValueStore` iniettata (`Dependencies.offlineStore`), in memoria nei test.
2. **Cache:** persistenza ufficiale di TanStack Query (`@tanstack/react-query-persist-client` con
   `query-async-storage-persister`) con una **lista di chiavi ammesse**, applicata al salvataggio e dopo
   il ripristino: dispositivo, `/auth/me`, stabilimento (fuso orario), meta dell'istanza, mappe e
   documenti delle mappe, giorno operativo e prenotazioni di oggi e domani nel fuso dello stabilimento,
   dettagli delle prenotazioni il cui soggiorno li tocca. Nient'altro (clienti, pagamenti, report,
   cassa). La copia è legata all'abbinamento (buster con l'id del dispositivo), dura al massimo 48 ore,
   è ripristinata prima della prima schermata e viene **cancellata a ogni scollegamento** (volontario o
   per revoca), annullando anche un salvataggio ritardato ancora in corso.
3. **Coda:** FIFO persistente (porting della coda del pannello) per check-in, rilascio del giorno di un
   abbonamento, nota interna, incasso in contanti su una prenotazione esistente. Ogni operazione ha una
   `Idempotency-Key` generata all'inserimento e riusata a ogni nuovo invio; il "riprova" dell'utente
   dopo un rifiuto genera una chiave nuova. Errori di rete, timeout, 429 e 5xx lasciano l'operazione in
   attesa e fermano l'invio (l'ordine resta); 409/412/422 diventano **conflitti** e gli altri 4xx
   **non inviate**, con lo slug del problema, finché l'utente non riprova o elimina: nessuna operazione
   sparisce senza l'utente. Un 401 `unauthorized` mette in pausa la coda e scollega la sessione. Sul
   desktop in rete locale (ADR 0006) la coda passa dallo stesso trasporto con pinning del resto
   dell'app; un certificato cambiato ferma l'invio come un errore di rete (nulla ha raggiunto il
   server) e le operazioni ripartono dopo "Abbina di nuovo" con lo stesso desktop.
4. **Ambito:** ogni operazione registra istanza e stabilimento; quelle di un altro abbinamento non
   vengono mai inviate con il token sbagliato e restano visibili come "non inviate".
5. **Scollegamento:** prima dello scollegamento volontario l'app prova a inviare la coda (al massimo
   5 secondi) e dice quante operazioni non inviate andranno perse; poi le elimina. Dopo una **revoca**
   la coda resta (contiene contanti incassati davvero) e riparte al nuovo abbinamento dello stesso
   stabilimento.
6. **Check-in:** `If-Match` con la versione letta quando è affidabile, `*` quando l'operazione è in
   coda dietro altre sulla stessa prenotazione (la transizione di stato la protegge, 409 altrimenti).
7. **Solo online:** creazione e spostamento di prenotazioni non entrano mai nella coda
   (`ONLINE_ONLY_OPERATIONS`, `useOnlineOnly`, `OnlineOnlyNotice`).
8. **Connessione:** lo stato del dispositivo viene dal sistema (`expo-network`, solo `isConnected`:
   un'istanza desktop in rete locale funziona senza internet); la raggiungibilità dell'istanza dalle
   risposte alle richieste. Stati: connesso, istanza non raggiungibile, senza rete, invio in corso.
   Nuovi invii alla riconnessione, quando l'istanza risponde di nuovo, al ritorno in primo piano e ogni
   30 secondi mentre ci sono operazioni in attesa.

## Conseguenze

- Positive: stesse regole e stessi casi del pannello; doppio invio impossibile grazie alle chiavi;
  nessun dato personale fuori dalla sandbox né dopo lo scollegamento; consultazione immediata a freddo.
- Negative: le modifiche ottimistiche sono una stima finché il server non risponde; un incasso in coda
  su una cassa chiusa diventa un conflitto da risolvere a mano; dati del giorno leggibili da chi ha il
  telefono sbloccato (come il pannello nel browser) fino allo scollegamento o a 48 ore.
- Verifiche: `queue.test.ts` (ordine, chiavi, ripresa dopo il riavvio, conflitti, pausa sul 401,
  ambito), `runtime.test.ts`, `persist.test.ts` (lista ammessa, buster, cancellazione), `senders.test.ts`
  (intestazioni), `src/test/screens/offline.test.tsx` (indicatore su telefono e tablet, invio alla
  riconnessione, conflitti, avvio a freddo senza rete, scollegamento); guida per gli sviluppatori in
  `docs/data-and-offline.md`.
