# 0004 — UI kit: React Native Reusables su NativeWind, solo token del tema, layout per tablet

- **Stato:** accettato
- **Data:** 2026-10-25
- **Sezioni della specifica:** core ADR 0009 (UI kit shadcn/ui, niente CSS custom), core ADR 0018
  (marchio e colori), `docs/spec/01-fase-0-fondamenta.md`

## Contesto

Il pannello usa solo shadcn/ui con Tailwind e una guardia che rifiuta CSS custom e valori arbitrari
(core ADR 0009). L'app deve avere lo stesso aspetto e la stessa disciplina, su telefono e tablet.
L'equivalente di shadcn per React Native è **React Native Reusables**, che genera componenti con una CLI
su **NativeWind** e sulle primitive accessibili `@rn-primitives`.

Verifica fatta il 2026-10-25: NativeWind stabile è la **4.2.7** (richiede **Tailwind 3**, oggi 3.4); la
5.0 (Tailwind 4) è ancora release candidate. NativeWind 4.2 supporta Reanimated 4. La CLI di Reusables
(0.7.1) funziona su questo progetto SDK 58 (`add` e `doctor`), `expo-doctor` è verde e i bundle iOS e
Android si compilano. Alternative considerate: Tamagui e gluestack-ui (sistemi di stile propri, lontani
da shadcn), React Native Paper (Material Design, estraneo al marchio), componenti scritti a mano (CSS e
accessibilità da mantenere da soli).

## Decisione

1. **Reusables è l'unico sistema di componenti** (`src/components/ui`, generati dalla CLI con
   `--styling-library nativewind`), icone **lucide-react-native**. NativeWind 4.2 con Tailwind 3.4; si
   passa a NativeWind 5 / Tailwind 4 con un nuovo ADR quando saranno stabili.
2. **Niente stile custom.** Nessun `StyleSheet`, nessuno `style={…}`, nessun foglio di stile oltre a
   `src/global.css` (variabili del tema), nessun colore grezzo, nessun colore della palette predefinita
   di Tailwind (`bg-red-500`, `text-white`), nessun valore arbitrario di colore, tipografia, pixel o
   proprietà. Un componente esterno senza `className` riceve `cssInterop`, non uno `style`. Niente
   `Alert` nativo: le conferme sono `AlertDialog`.
3. **Colori del pannello:** i token di `src/global.css` sono quelli di
   `web/shared/src/styles/globals.css` del core (navy/sky Coste360, chiaro e scuro), convertiti in
   triplette HSL perché funzionino i modificatori di opacità; i valori traslucidi sono pre-miscelati
   sullo sfondo. `src/lib/theme.ts` ripete i pochi colori che servono a React Navigation; un test li
   tiene uguali. Modifiche locali ai componenti generati elencate in `src/components/ui/README.md`
   (testo del pulsante distruttivo leggibile in tema scuro).
4. **Tablet dal primo giorno:** `useDeviceLayout()` sceglie il layout dal lato corto della finestra
   (tablet da 600 dp: tutti gli iPad a schermo intero; Slide Over e Split View strette usano il layout
   da telefono). Telefono: pila di schermate. Tablet: pannello di navigazione laterale e dettaglio
   (master/detail). `Screen` centra il contenuto in una colonna leggibile su tablet. Il componente
   sperimentale `expo-router/unstable-split-view` (split view nativa di iPad) si valuterà quando sarà
   stabile.
5. Accessibilità: ruoli ed etichette su ogni controllo, aree tattili di almeno 44 pt, regioni live per
   gli stati, testo dinamico sempre consentito.

## Conseguenze

- Positive: stesso linguaggio visivo e stessi nomi di token del pannello; componenti accessibili e
  modificabili (codice nostro, non una dipendenza chiusa); nessuno stile da mantenere a mano.
- Negative: Tailwind 3 mentre il pannello usa Tailwind 4 (configurazione diversa, stessi token); i
  componenti generati vanno riallineati a mano quando Reusables cambia; ogni primitiva aggiunge un
  pacchetto `@rn-primitives/*`; i colori di React Navigation sono duplicati (protetti da un test).
- Verifiche: `scripts/style-guard.js` in `npm run lint` (con i propri test) rifiuta fogli di stile,
  CSS-in-JS, `StyleSheet`, `style={}`, colori grezzi, palette predefinita e valori arbitrari, con le
  sole esenzioni elencate nello script (componenti generati, tema di navigazione, layout del widget
  Android che gira in Jetpack Glance fuori da React Native, ADR 0008); ESLint blocca `Alert`,
  `Text`, `TextInput` e `Button` di React Native fuori dai componenti generati; `theme.test.ts`;
  test delle schermate a larghezza di telefono e di tablet; regola `.claude/rules/frontend.md`.
