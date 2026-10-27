# 0001 — Stack: Expo, React Native e TypeScript

- **Stato:** accettato; orientazione in [0016](0016-telefono-in-verticale.md)
- **Data:** 2026-10-25
- **Sezioni della specifica:** core `docs/spec/29-edizione-desktop-e-app-mobile.md` §29.2,
  `docs/spec/01-fase-0-fondamenta.md`

## Contesto

La specifica del core prevede un'app per lo staff pubblicata da Coste360 negli store, collegata
all'istanza del gestore, con fotocamera (QR), portachiavi sicuro, funzionamento offline con coda,
notifiche push facoltative (poi escluse dall'app pubblica, ADR 0012), widget e layout per tablet. Il
team scrive già TypeScript e React (pannello e pagina di prenotazione) e genera i tipi delle API con
openapi-typescript. Su questa macchina non ci sono Xcode né Android SDK.

Alternative considerate:

- **Capacitor** (il pannello in una WebView con plugin nativi): riuso massimo del codice web, ma il
  pannello è pensato per schermi da scrivania, la WebView non dà un'esperienza nativa su mappa e liste
  lunghe, e portachiavi, fotocamera, widget e lavoro in background passano comunque da plugin nativi.
- **Flutter:** ottimo rendering, ma un secondo linguaggio (Dart) e un secondo ecosistema, senza riuso
  delle competenze React né di openapi-typescript/openapi-fetch.
- **Solo PWA:** il pannello è già una PWA. Su iOS non c'è un portachiavi accessibile, le push richiedono
  l'installazione sulla schermata Home, il lavoro in background è limitato e manca la presenza negli
  store che la specifica chiede; i certificati autofirmati della rete locale restano un problema.

## Decisione

1. Usiamo **Expo SDK 58** (React Native 0.88, New Architecture, Hermes, React Compiler) con
   **expo-router** (rotte in `src/app/`) e **TypeScript strict** (`noUncheckedIndexedAccess`).
2. **Continuous Native Generation:** `ios/` e `android/` non sono nel repository; il comportamento
   nativo si configura in `app.json` e con i config plugin. Le build native si fanno con **EAS Build**
   (nessun Xcode locale richiesto). I pacchetti si aggiungono solo con `npx expo install`.
3. Moduli ufficiali Expo dove esistono: `expo-camera` (QR), `expo-secure-store` (portachiavi),
   `expo-localization`, `expo-device`, `expo-linking`.
4. Stato del server con **TanStack Query**, form con **react-hook-form + zod**, testi con **i18next**
   (come il pannello); test con **jest-expo + Testing Library**.
5. L'app è pensata per telefono e tablet/iPad (`ios.supportsTablet`); telefono in verticale, tablet
   in ogni orientazione (ADR 0016).

## Conseguenze

- Positive: competenze e librerie condivise con il pannello (React, TanStack Query, zod, i18next,
  shadcn tramite Reusables); componenti nativi veri; un solo codice per iOS e Android; build native
  senza Mac con Xcode.
- Negative: dipendenza dal ciclo degli SDK Expo (un aggiornamento all'anno almeno, con breaking change
  da verificare sulla documentazione versionata); le build native richiedono un account Expo/EAS; i
  test girano senza dispositivo (niente end-to-end su simulatore per ora).
- Verifiche: `make doctor` (expo-doctor) e `make export-check` (bundle iOS e Android) in CI; regola
  "do not trust your training data" in `AGENTS.md`.
