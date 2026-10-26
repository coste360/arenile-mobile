# 0015 — "Prova la demo": abbinamento allo stabilimento dimostrativo di Coste360

- **Stato:** proposto
- **Data:** 2026-10-26
- **Sezioni della specifica:** core `docs/spec/29-edizione-desktop-e-app-mobile.md` §29.2 ("Stabilimento
  dimostrativo"), core ADR 0027; ADR 0003, 0005 (eccezione alla decisione 3)

## Contesto

L'app non ha un server predefinito: si collega solo all'istanza dello stabilimento, con un codice di
abbinamento monouso creato dal pannello. Chi la scarica dallo store senza avere Arenile non può vederla
funzionare, e la revisione di Apple rifiuta spesso le app che non si usano senza un account o un
server.

Dalla v1.0.4 il core espone `POST /api/device/v1/demo-pairing` (ADR 0027 del core): sulle sole istanze
dimostrative configurate restituisce un codice di abbinamento nuovo per un utente demo con ruolo
cassiere, staff di spiaggia o sola lettura, senza login, con un limite di 5 richieste all'ora per rete
del client; altrove risponde `404`. Scartati: email e password della demo nell'app (l'app accede solo
con il token del dispositivo, e una password nel codice sarebbe estraibile) e un codice fisso nell'app
(i codici sono monouso).

## Decisione

1. La schermata "Collega" ha un pulsante **"Prova la demo"**, separato dai due modi di abbinare la
   propria istanza, con una riga che dice dove porta: lo stabilimento di esempio sul server
   dimostrativo di Coste360, con dati inventati azzerati ogni notte.
2. L'unico indirizzo nel codice dell'app è quello della demo, `DEMO_INSTANCE_URL`
   (`https://demo.arenile.app`, `src/config/app.ts`), usato solo da quel pulsante: è l'unica eccezione
   a "nessun server predefinito" e parte solo da una scelta esplicita. Nessuna richiesta verso la demo
   avviene altrimenti.
3. Stessi passi dell'abbinamento normale (`pairDemo`, `src/features/pairing/pair.ts`): `/meta` e
   compatibilità, poi il codice da `demo-pairing`, subito scambiato con `POST /api/device/v1/pair`. Un
   codice non viene chiesto se l'istanza è incompatibile. Il token va nel portachiavi come ogni altro
   (ADR 0003); la sessione demo è una sessione normale e si scollega dalle Impostazioni.
4. Esiti: `404` da `demo-pairing`, e un'istanza demo non Arenile, troppo vecchia o senza abbinamento,
   sono "Demo non disponibile" con "Riprova", che chiede ogni volta un codice nuovo; `429` da
   `demo-pairing` spiega il limite orario, senza "Riprova". Non si offrono QR o inserimento del
   codice, che riguardano la propria istanza.

## Conseguenze

- Positive: l'app si prova senza un server proprio, anche dai revisori degli store; nessuna credenziale
  nel codice; il server decide il ruolo e non consegna mai un dispositivo da titolare o gestore.
- Negative: l'app contiene un indirizzo di Coste360 e, solo dopo il tocco, gli rivela l'IP del
  telefono (già registrato nell'audit della demo). Quando la demo viene ricreata il dispositivo perde
  l'accesso e l'app torna a "Collega" con il messaggio di dispositivo revocato. Chi ricompila l'app
  per un'altra demo cambia `DEMO_INSTANCE_URL`.
- Verifiche: `pair.test.ts` (ordine delle chiamate, nessun codice chiesto a un'istanza incompatibile,
  esiti tipizzati), `pairing.test.tsx` e `connect.test.tsx` (pulsante a larghezza di telefono e
  tablet, abbinamento senza conferma, demo non disponibile, limite orario).
