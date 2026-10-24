# 0003 — Autenticazione con il token del dispositivo

- **Stato:** accettato
- **Data:** 2026-10-25
- **Sezioni della specifica:** core §29.2 ("Collegamento e autenticazione"), §16, core ADR 0015

## Contesto

Il core abbina un dispositivo scambiando un codice monouso a breve scadenza (QR o digitato) con un token
`ar_dev_<prefix>_<secret>` (`POST /api/device/v1/pair`), legato all'utente e allo stabilimento del
codice, con i permessi del suo ruolo. Il token si usa come `Authorization: Bearer` sulle API admin e
`/api/device/v1`; è revocabile dal pannello e smette di funzionare dopo 90 giorni di inattività. Non ci
sono cookie, quindi nemmeno CSRF né CORS per l'app.

## Decisione

1. Il token si conserva solo nel **portachiavi del dispositivo** con `expo-secure-store` (Keychain su iOS,
   Keystore su Android), opzione `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: leggibile dopo il primo sblocco
   (servirà agli aggiornamenti in background), mai migrato su un altro dispositivo con i backup.
   L'accesso passa da un'interfaccia (`KeyValueStore` → `SessionStore`) con un'implementazione in
   memoria per i test; nessun altro modulo importa `expo-secure-store`.
2. La sessione salvata contiene istanza, token, dispositivo, stabilimento e data di abbinamento. Un token
   vale per **un solo stabilimento**: nessun selettore di stabilimento in fase 0.
3. Un unico punto costruisce i client (`createApiClient`): base URL dell'istanza, bearer, nessuna
   credenziale implicita (`credentials: 'omit'`), timeout.
4. Un `401` dell'istanza (`application/problem+json` di tipo `unauthorized`: revoca, inattività)
   cancella la sessione e riporta a _Collega_ con la spiegazione: lo fa solo `SessionProvider`,
   osservando le query e le mutation; le schermate non gestiscono il 401. Un `401` senza quel corpo
   (portale captive di un Wi-Fi, proxy, altro host in rete) è un errore qualsiasi e non cancella il token.
5. Un link di abbinamento aperto da fuori dell'app (`arenile://pair?d=…`) mostra l'indirizzo dell'istanza
   e parte solo dopo la conferma dell'utente: qualsiasi pagina web, app o tag NFC può aprire quel link, e
   un'istanza estranea con il nome di un lido vero riceverebbe i dati dei clienti. Il codice è monouso:
   dopo un errore del portachiavi si riprova solo il salvataggio, mai lo scambio.
6. **Scollega** chiama `DELETE /api/device/v1/self` e poi cancella la sessione; se l'istanza non risponde
   l'utente può scollegare solo il dispositivo, avvisato che l'accesso resta nel pannello.
7. L'indirizzo dell'istanza deve usare `https`; `http` solo su loopback (sviluppo), come il client
   desktop del core: il token non viaggia mai in chiaro, nemmeno in VPN.
8. Token, email e telefoni non finiscono mai nei log né negli URL.

## Conseguenze

- Positive: nessuna password sul telefono; revoca immediata dal pannello; permessi identici al pannello;
  test deterministici grazie alle dipendenze iniettate.
- Negative: chi ripristina un backup su un nuovo telefono deve riabbinarlo (voluto); un dispositivo
  inattivo per 90 giorni va riabbinato; senza rete non si può revocare dal telefono.
- Verifiche: `session.test.ts`, `connected.test.tsx` (401 → _Collega_, scollegamento online e offline),
  `pair.test.ts`; regola `.claude/rules/api-client.md`.
