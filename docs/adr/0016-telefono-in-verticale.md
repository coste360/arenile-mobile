# 0016 — Telefono in verticale, tablet in ogni orientazione

- **Stato:** proposto
- **Data:** 2026-10-27
- **Sezioni della specifica:** `docs/spec/01-fase-0-fondamenta.md` (layout); ADR 0001 (decisione 5,
  modificata), ADR 0004

## Contesto

Finora l'app ruotava in ogni orientazione anche sul telefono. Provandola su iPhone, in orizzontale
restano circa 390 pt di altezza per intestazione, barra del giorno, legenda e contenuto: la mappa del
giorno diventa una striscia e i moduli (vendita, spostamento) un lungo scorrimento. Lo staff in
spiaggia usa il telefono con una mano, in verticale; la rotazione accidentale è solo fastidio. Su
iPad invece l'orizzontale è comune (supporto in cassa) e il layout lista + dettaglio è pensato per
quello; Apple chiede ogni orientazione alle app iPad con multitasking (`requireFullScreen: false`).

## Decisione

1. **Telefono solo in verticale (dritto), tablet in ogni orientazione.** "Telefono" è la classe
   hardware (`Dependencies.formFactor`, da `expo-device`), non la larghezza della finestra: un iPad in
   Split View resta un tablet e ruota. Un telefono il cui schermo (non la finestra) raggiunge 600 dp sul
   lato corto è un tablet (`useFormFactor`): su Android il tipo di dispositivo è calcolato una volta
   all'avvio, e un pieghevole aperto resterebbe bloccato.
2. **iOS:** `ios.infoPlist` dichiara `UISupportedInterfaceOrientations` solo verticale per iPhone e
   le quattro orientazioni in `UISupportedInterfaceOrientations~ipad`; la proprietà astratta
   `orientation` di `app.json` è tolta perché non distingue i due.
3. **A runtime, iOS e Android:** le pile di navigazione chiedono `orientation: 'portrait_up'` sul
   telefono (opzione di schermata di react-native-screens via expo-router, `orientationFor` in
   `src/components/layout/stack-options.ts`; su iOS si interseca con l'Info.plist). `portrait_up`
   perché su Android `portrait` ammette anche il capovolto, che iPhone non ha. Nessuna dipendenza
   nuova. Il manifest Android resta senza orientazione, per lasciare liberi i tablet.

## Conseguenze

- Positive: un layout in meno da progettare e provare sul telefono; niente rotazioni accidentali.
- Negative: chi vuole usare il telefono in orizzontale non può. Su Android il blocco parte quando si
  monta la navigazione: splash e primo fotogramma possono ancora ruotare. Da Android 16 il sistema
  ignora le richieste di orientazione sugli schermi grandi; da iOS 27 un'app iPhone ridimensionabile
  (iPhone Mirroring) può trattarla come preferenza (documentazione di `expo-screen-orientation`,
  SDK 58): i layout restano adattivi comunque. In Expo Go manca solo il blocco all'avvio dell'Info.plist;
  quello a runtime vale.
- Verifiche: `stack-options.test.ts`, `use-form-factor.test.tsx` (pieghevole aperto); i test delle
  schermate passano `formFactor` secondo la dimensione (`renderApp`). Che le pile usino l'opzione si
  verifica sul dispositivo: il mock delle schermate native non la espone.
