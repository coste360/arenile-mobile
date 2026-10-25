# 0012 — Niente notifiche push nell'edizione pubblica dell'app

- **Stato:** accettato
- **Data:** 2026-10-25
- **Sezioni della specifica:** `docs/spec/03-fase-2.md`, `docs/spec/05-esclusi.md`; core §29.2 (app
  mobile), §19 (notifiche); sostituisce i punti 7, 8 e 9 dell'[ADR 0011](0011-fase-2-vendita-spostamenti-lista-attesa-stampa-push.md)

## Contesto

L'ADR 0011 aveva previsto notifiche push facoltative: token nativo APNs/FCM con `expo-notifications`,
registrazione sull'istanza con endpoint non ancora rilasciati dal core (adattatore tipizzato) e consegna
tramite il relay di Coste360, con le credenziali APNs/Firebase di Coste360. Il client era pronto ma mai
attivo: nessuna release del core pubblicava gli endpoint e la capacità in `/meta` restava falsa.

Il repository ora è pubblico. Coste360 ha deciso che le notifiche push non fanno parte dell'app pubblica:
richiedono un servizio centrale gestito da Coste360 (relay, credenziali, costi e responsabilità di
consegna) e potranno diventare una funzione di una futura edizione a pagamento ("Pro"), da definire.
Tenere nel codice pubblico un client spento avrebbe portato una dipendenza nativa, entitlement e
permessi che l'app non usa, e codice morto da mantenere.

## Decisione

1. **L'app pubblica non ha notifiche push.** Niente `expo-notifications`, niente token APNs/FCM, niente
   registrazione sull'istanza, niente card nelle impostazioni, niente plugin per Firebase Messaging.
2. **Nessuna configurazione nativa per le notifiche:** in `app.json` nessun entitlement
   `aps-environment`, nessun `android.googleServicesFile`, nessun meta-data FCM, nessun permesso
   `POST_NOTIFICATIONS`; il widget resta senza push (opzione predefinita di `expo-widgets`).
3. **Dati aggiornati all'apertura:** l'app rilegge i dati dall'istanza quando viene aperta o torna in
   primo piano (`focusManager` di TanStack Query legato ad `AppState`) e alla riconnessione, come già fa.
4. La capacità `push_notifications` di `/meta` resta nel contratto del core ma l'app la ignora.
5. Un'eventuale edizione a pagamento con le push sarà una decisione separata, con un nuovo ADR.

## Conseguenze

- Positive: nessun servizio di terzi oltre all'istanza (ADR 0005 senza eccezioni); una dipendenza
  nativa in meno; nessun permesso o entitlement di notifica da dichiarare negli store; nessuna
  credenziale APNs/Firebase o relay necessari per pubblicare l'app.
- Negative: lo staff non riceve avvisi a app chiusa (nuove prenotazioni online, prenotazioni da
  approvare, pagamenti non riusciti): li vede aprendo l'app o nel pannello.
- Verifiche: `npx expo config --type introspect` senza entitlement o permessi di notifica;
  `expo-notifications` assente da `package.json`.
