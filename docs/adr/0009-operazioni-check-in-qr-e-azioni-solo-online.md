# 0009 — Operazioni: check-in con QR, ingressi al varco e blocchi solo online

- **Stato:** accettato
- **Data:** 2026-10-25
- **Sezioni della specifica:** `docs/spec/02-fase-1-prima-versione.md` ("Operazioni", "Offline"), core
  §11.3 (blocchi), §14.3 e ADR 0020 del core (biglietti e varco), §16.1, §21.2; ADR 0007

## Contesto

La fase 1 chiede il check-in con la scansione del QR della prenotazione o del biglietto d'ingresso, il
rilascio del giorno degli abbonati, il blocco della postazione, le note e l'incasso rapido in contanti,
"anche con rete instabile". Il core usa due QR diversi:

- il QR della prenotazione (email, pagina pubblica, ricevuta) codifica `ARENILE:<codice>`
  (`internal/domain/notify/qr.go`);
- il QR di un biglietto (ingresso o vendita giornaliera) codifica il suo _gate token_, 26 caratteri
  base32 casuali (`internal/domain/ticketing`), mai il codice della prenotazione, che è sequenziale e
  indovinabile. Il varco (`POST entry-gate/check-in`) ammette un biglietto una sola volta con un
  aggiornamento condizionale e risponde con l'esito (`admitted`, `already_entered`, `voided`,
  `wrong_date`); un codice digitato entra solo come inserimento manuale confermato (`manual: true`).

Check-in, note, incassi e rilasci entrano già nella coda offline (ADR 0007). Restano da decidere il
varco e i blocchi, e come trovare una prenotazione dal QR senza rete.

## Decisione

1. **Riconoscimento:** l'app accetta solo i due formati del core (`ARENILE:<codice>` e un gate token,
   anche dentro un URL come fa `NormalizeCode`); un altro QR non viene mai cercato. A mano si possono
   digitare un codice di prenotazione o il numero del biglietto del giorno.
2. **Prenotazione dal QR:** prima i dati del giorno in cache (oggi e domani, funziona offline), poi
   l'istanza con `GET bookings?q=` accettando solo il codice identico. Il check-in resta un'operazione
   in coda (ADR 0007), con un tocco dopo la scansione: niente check-in automatico alla lettura.
3. **Biglietti e varco solo online:** i gate token non sono in cache e l'esito del varco è la decisione
   che lo staff applica alla persona davanti a sé; un ingresso in coda sarebbe un "sì" non verificato.
   Un biglietto d'ingresso scansionato viene ammesso subito; uno digitato (numero o codice) solo dopo la
   conferma dello staff, come inserimento manuale. Il QR di una vendita giornaliera porta alla sua
   prenotazione.
4. **Blocchi solo online:** un blocco è un'allocazione come una prenotazione (409 `spot_unavailable`):
   servono le garanzie di disponibilità del server, come per creare e spostare (core §21.2). Non entra
   mai nella coda; senza istanza il modulo lascia il posto alla spiegazione. La `Idempotency-Key` resta
   la stessa finché la richiesta non cambia (doppio tocco o nuovo tentativo dopo un timeout).
5. **Incasso:** solo su una prenotazione con saldo, mai oltre il saldo (niente eccedenza a credito
   dall'app), con conferma. Online l'app legge la sessione di cassa aperta (`cash-sessions/current`) e,
   se è chiusa, spiega di aprirla dal pannello invece di offrire l'incasso; offline avvisa che non può
   saperlo e accoda (un rifiuto diventa un conflitto, ADR 0007).
6. **Rilascio:** oggi o domani dentro il periodo dell'abbonamento, giornata intera o metà, con
   conferma. Revoca del rilascio e periodi più lunghi restano nel pannello.
7. **Permessi:** come `useAbilities()` (core §16.1): check-in, varco, rilasci e blocchi con
   `operations.run`, note con `bookings.write`, incasso con `cash.operate`; incasso e rilasci anche
   solo se `/meta` riporta `cash` e `season_passes`. Il server resta l'unico giudice.

## Conseguenze

- Positive: il check-in delle prenotazioni funziona in spiaggia senza rete; un biglietto non entra mai
  due volte né senza la verifica del server; nessun blocco può sovrapporsi a una prenotazione.
- Negative: al varco serve la rete (come nel pannello); un blocco o una sua rimozione non si possono
  preparare offline; l'app non apre né chiude la cassa (resta nel pannello).
- Verifiche: `scan-code.test.ts`, `resolve.test.ts`, `rules.test.ts`, `forms.test.ts`,
  `spot-blocks.test.ts`, `src/test/screens/operations.test.tsx` (check-in offline dalla cache, ricerca
  online con `If-Match` e `Idempotency-Key`, esiti del varco, ruoli, incasso con conferma e limiti,
  cassa chiusa, note, rilascio, blocchi online e offline).
