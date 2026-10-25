# 0006 — Rete locale del desktop: certificato autofirmato e trasporto con pinning

- **Stato:** accettato (implementato in `modules/pinned-fetch`; prova su dispositivi reali da fare)
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

1. Una build **senza** il modulo nativo (Expo Go, web) rifiuta le istanze con impronta:
   `selectTransport()` lancia `LanTransportUnavailableError` e il collegamento mostra "Rete locale del
   desktop non supportata" con la spiegazione, senza alcuna richiesta di rete. Nessun aggiramento di TLS.
   (Fino a questa implementazione era il comportamento di tutte le build.)
2. Un **modulo Expo locale** (`modules/pinned-fetch`, Expo Modules API) espone un trasporto
   `(Request) → Response` e accetta il server **solo** se lo SHA-256 del certificato foglia coincide con
   l'impronta salvata nella sessione, confrontata in tempo costante:
   - iOS: `URLSession` con un delegate che gestisce
     `NSURLAuthenticationMethodServerTrust` in `urlSession(_:didReceive:completionHandler:)`, calcola lo
     SHA-256 del certificato foglia (`SecTrustCopyCertificateChain`) e risponde `.useCredential` solo se
     coincide, altrimenti `.cancelAuthenticationChallenge`;
   - Android: `OkHttpClient` dedicato con un `X509TrustManager` che confronta lo SHA-256 del certificato
     foglia e un `HostnameVerifier` limitato all'host dell'istanza abbinata (`CertificatePinner` di
     OkHttp non basta: pinna la chiave pubblica e richiede comunque una catena valida).
     Il modulo si attiva solo per le sessioni con impronta; le istanze con certificato pubblico continuano
     a usare il `fetch` di sistema.
   - in entrambi: una sessione o un client per host e porta dell'istanza abbinata (ricreato se l'impronta
     cambia), niente cookie, cache o credenziali salvate, redirect mai seguiti (la risposta 3xx torna a
     JavaScript), annullamento della richiesta quando scade il timeout del client;
   - il lato JavaScript (`createPinnedFetch`) serializza la richiesta (corpo di testo UTF-8: l'API usa
     solo JSON) e ricostruisce la `Response`; gli errori nativi diventano `PinnedFetchError` con codice
     (`certificate_mismatch`, `invalid_request`, `aborted`, `network`).
3. Il trasporto si innesta in un solo punto: `selectTransport()` in `src/api/transport.ts`
   (`canPinCertificates()` è vero quando il modulo nativo è presente). Il trasporto è una dipendenza
   iniettata (`Dependencies.pinnedFetch`): i test usano un finto server con un'impronta data.
   L'impronta del QR viene validata e normalizzata (`AA:BB:…`); un'impronta malformata rende il QR non
   valido, mai "senza pinning".
4. Il rinnovo del certificato produce `CertificateMismatchError`, distinto da "non raggiungibile" e mai
   ritentato: all'abbinamento la schermata chiede un nuovo QR (il codice non viene mai inviato); da
   collegato la schermata principale lo spiega e offre "Abbina di nuovo" (la sessione si chiude con il
   motivo `certificate_changed`, "Collega" ricorda di revocare il vecchio abbinamento nel pannello). Nei
   30 giorni prima di `lan_cert_renews_at` la schermata principale annuncia la data del rinnovo.
5. iOS chiede il permesso "Rete locale" al primo collegamento a un indirizzo privato:
   `NSLocalNetworkUsageDescription` spiega perché (tradotto in `native-locales/`).
6. Il modulo si compila con **EAS Build** (su questa macchina non c'è Xcode né Android SDK) e si prova su
   dispositivi reali contro l'app desktop in rete locale. Test: Jest per il lato JavaScript con il modulo
   nativo simulato; test Swift eseguibili con i soli Command Line Tools
   (`swift test --package-path modules/pinned-fetch/ios/Tests`); test JUnit del `TrustManager`
   (`./gradlew :pinned-fetch:testDebugUnitTest` in un progetto generato con `expo prebuild`). Swift e
   Kotlin condividono lo stesso certificato di prova.

## Conseguenze

- Positive: stessa garanzia del client desktop del core (pinning esatto), nessuna fiducia generica in
  certificati autofirmati; il resto dell'app non cambia.
- Negative: codice nativo da mantenere in Swift e Kotlin; non funziona in Expo Go (serve una build di
  sviluppo); fino al rilascio del modulo i lidi con solo l'edizione desktop non possono usare l'app.
- Limiti accettati: il trasporto con pinning porta solo corpi di testo (JSON); download binari e upload
  multipart, quando serviranno, richiedono un'estensione del modulo.
- Verifiche: `transport.test.ts`, `client.test.ts`, `pair.test.ts`, i test delle schermate di
  collegamento e principale (impronta giusta, sbagliata, certificato rinnovato, build senza modulo, avviso
  di rinnovo); `modules/pinned-fetch/src/*.test.ts`; test nativi sopra. Da fare prima del rilascio:
  prova su iPhone, iPad e Android contro l'app desktop in rete locale, anche dopo un rinnovo.
