# 0006 — Rete locale del desktop: certificato autofirmato e trasporto con pinning

- **Stato:** proposto
- **Data:** 2026-10-25
- **Sezioni della specifica:** core §29.1 (edizione desktop, modalità rete locale), §29.2, core ADR 0015

## Contesto

In modalità rete locale l'app desktop del core serve il pannello in TLS su un indirizzo del lido (ad
esempio `https://192.168.1.20:8443`) con un **certificato autogenerato**. Il QR di abbinamento porta
l'impronta (`fingerprint`): SHA-256 del certificato foglia in DER, esadecimale maiuscolo separato da `:`
(core `internal/desktop/lan.go`, `Fingerprint`). Il client desktop del core in modalità remota accetta il
certificato solo se l'impronta coincide (`PinnedClientConfig`). Il certificato si rigenera 30 giorni prima
della scadenza (`lan_cert_renews_at` in `/meta`) e i dispositivi vanno riabbinati.

Il `fetch` di React Native usa `NSURLSession` (iOS) e OkHttp (Android) con la validazione di sistema:
rifiuta il certificato autofirmato e non espone un modo per accettare un'impronta specifica.

Alternative scartate:

- **Disattivare la validazione TLS** (anche solo per gli IP privati): espone il token a chiunque sia
  sulla stessa rete Wi-Fi. Mai.
- **Installare un certificato nel sistema** (profilo iOS, CA utente Android): procedura lunga e fragile
  per lo staff; da Android 7 le app non si fidano delle CA utente senza configurazione esplicita.
- **`network_security_config` (Android) / ATS (iOS) con pin statici:** l'impronta non è nota al momento
  della build, cambia per ogni lido e a ogni rinnovo.

## Decisione

1. In fase 0 l'app **rifiuta** le istanze con impronta: `selectTransport()` lancia
   `LanTransportUnavailableError` e il collegamento mostra "Rete locale del desktop: in arrivo" con la
   spiegazione, senza alcuna richiesta di rete. Nessun aggiramento di TLS.
2. Soluzione prevista: un **modulo Expo locale** (`modules/pinned-fetch`, Expo Modules API) che espone
   un trasporto `(Request) → Response` e accetta il server **solo** se lo SHA-256 del certificato foglia
   coincide con l'impronta salvata nella sessione, confrontata in tempo costante:
   - iOS: `URLSession` con un delegate che gestisce
     `NSURLAuthenticationMethodServerTrust` in `urlSession(_:didReceive:completionHandler:)`, calcola lo
     SHA-256 del certificato foglia (`SecTrustCopyCertificateChain`) e risponde `.useCredential` solo se
     coincide, altrimenti `.cancelAuthenticationChallenge`;
   - Android: `OkHttpClient` dedicato con un `X509TrustManager` che confronta lo SHA-256 del certificato
     foglia e un `HostnameVerifier` limitato all'host dell'istanza abbinata (`CertificatePinner` di
     OkHttp non basta: pinna la chiave pubblica e richiede comunque una catena valida).
     Il modulo si attiva solo per le sessioni con impronta; le istanze con certificato pubblico continuano
     a usare il `fetch` di sistema.
3. Il trasporto si innesta in un solo punto: `selectTransport()` in `src/api/transport.ts`
   (`canPinCertificates()` diventa vero quando il modulo nativo è presente). Client, errori e schermate
   non cambiano.
4. Il rinnovo del certificato produce un errore di impronta: l'app lo distingue da "non raggiungibile" e
   chiede di riabbinare con un nuovo QR; la schermata principale avvisa quando `lan_cert_renews_at` è
   vicino.
5. Il modulo si compila con **EAS Build** (su questa macchina non c'è Xcode) e si prova su dispositivi
   reali contro l'app desktop in rete locale; la normalizzazione e il confronto dell'impronta hanno test
   unitari in TypeScript e nativi.

## Conseguenze

- Positive: stessa garanzia del client desktop del core (pinning esatto), nessuna fiducia generica in
  certificati autofirmati; il resto dell'app non cambia.
- Negative: codice nativo da mantenere in Swift e Kotlin; non funziona in Expo Go (serve una build di
  sviluppo); fino al rilascio del modulo i lidi con solo l'edizione desktop non possono usare l'app.
- Verifiche: `client.test.ts` e `pair.test.ts` (rifiuto senza richieste di rete), test della schermata
  di collegamento con impronta; quando il modulo esiste, test di accettazione con impronta giusta,
  sbagliata e certificato rinnovato.
