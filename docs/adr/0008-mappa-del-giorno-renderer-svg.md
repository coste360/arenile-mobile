# 0008 — Mappa del giorno: renderer SVG, gesti sul thread UI, palette di stato del pannello

- **Stato:** proposto; decisione 7 (kit) sostituita da [0013](0013-illustrazioni-dei-kit-della-mappa.md); decisione 5 (giorni) modificata da [0014](0014-giorni-oltre-la-finestra-offline.md)
- **Data:** 2026-10-25
- **Sezioni della specifica:** `docs/spec/02-fase-1-prima-versione.md` ("Mappa del giorno"), core §11.3
  (vista operativa), §16.1, §21.2; core ADR 0012 e 0024 (kit della mappa); ADR 0004 e 0007

## Contesto

La fase 1 chiede la vista operativa del pannello sul telefono e sul tablet: colori di stato sempre con
etichetta e simbolo, zoom e spostamento con i gesti, ricerca, scheda della postazione, mappa visibile
accanto alla scheda su tablet. Un lido ha centinaia di postazioni e la mappa deve restare fluida anche
su telefoni modesti, senza rete (cache di ADR 0007).

Il pannello disegna la mappa in SVG nel browser (`web/shared/src/map`) con le illustrazioni dei kit
(`assets/map-kits`, generate in TypeScript con colori `var(--beach-*)`) e una classe Tailwind per ogni
stato. Sul telefono:

- `react-native-svg` (già nel progetto) è il renderer previsto; i colori non possono leggere le
  variabili CSS e risolvere una classe NativeWind su ogni elemento di centinaia di forme costa.
- Ridisegnare l'SVG a ogni fotogramma di un gesto non è fluido; scalare uno strato già disegnato sì,
  ma diventa sfocato.
- Le illustrazioni dei kit sono © Coste360 sotto BSL 1.1 nel core; l'app non importa codice del core
  (ADR 0002) e la licenza dell'app è ancora da decidere; i simboli usano variabili CSS (e nel kit
  `modern` la parte di stato `--beach-state`) che `react-native-svg` non risolve.

Alternative considerate: Skia (`@shopify/react-native-skia`, dipendenza nativa pesante in più per una
vista), WebView con il renderer del pannello (fuori dal kit UI, nessuna cache offline condivisa,
accessibilità peggiore), un `Pressable` per ogni postazione (centinaia di gestori, conflitti con pan e
pinch), `SvgXml` con le stringhe dei kit (parsing a runtime, niente stato per postazione).

## Decisione

1. **Renderer:** `react-native-svg`, disegno in unità della mappa sotto un'unica trasformazione
   (`translate + scale`). Sabbia, fascia del mare con le regole del pannello, decorazioni e postazioni
   con la forma del documento (`circle`/`rect`, rotazione), il colore di stato, il **glifo** di ogni
   stato prenotato (stessi tracciati del pannello), la barra sulle bloccate, il codice e il cognome
   dell'occupante quando leggibili (minimo 9 dp, come il pannello). Le postazioni sono memoizzate e
   **tagliate all'area visibile** (più un margine): pan e zoom cambiano un solo attributo.
2. **Gesti:** hook v3 di `react-native-gesture-handler` con Reanimated. Durante pan e pinch il thread UI
   sposta e scala lo strato già disegnato (`useAnimatedStyle`, nessun render React); al rilascio la
   trasformazione diventa la camera (stato React) e l'SVG si ridisegna nitido. Lo strato copre un quarto
   di finestra in più per lato, così uno spostamento mostra mappa e non vuoti. Un **solo gesto di tocco**
   individua la postazione con un bersaglio di almeno 44 dp a ogni zoom, invece di un gestore per forma.
   Pulsanti Ingrandisci, Riduci e Mostra tutta la mappa per chi non usa i gesti.
3. **Colori:** i token `--status-*` e `--map-*` del pannello (chiaro e scuro) entrano in
   `src/global.css` e nel tema Tailwind (`bg-status-*` per legenda e scheda). Per le props SVG
   `src/features/day-map/palette.ts` ripete gli stessi valori; un test li tiene uguali al CSS, come
   `src/lib/theme.ts` per la navigazione. La guardia degli stili esenta questo file dai colori e
   `components/map-viewport.tsx` dallo `style` (trasformazione da valori condivisi e posizionamento in
   dp: nessuna classe può esprimerli). Nessun'altra esenzione.
4. **Mai solo il colore:** ogni stato ha etichetta e glifo nella legenda (sempre visibile, con i
   conteggi del giorno), sulla mappa, nell'elenco e nella scheda. L'SVG è nascosto ai lettori di
   schermo: la vista **Elenco** (virtualizzata) e la ricerca sono il percorso accessibile, la mappa ha
   un nome accessibile con il numero di postazioni e il livello di zoom.
5. **Dati:** documento della mappa (`useMapDocument`) e giorno operativo **intero** (`useOperationsDay`
   con `FULL`, quello che la cache offline conserva); mattina e pomeriggio vengono da `am_status` /
   `pm_status` con le regole del pannello (`slotStatus`, `toSpotStatus`). Oggi e domani, la
   finestra offline; gli altri giorni dal calendario, solo online (ADR 0014). Nomi dei clienti (mappa, scheda, ricerca)
   solo con `bookings.read`; mai email o telefono.
6. **Azioni della scheda:** dai permessi di `useAbilities()`. Check-in (oggi, prenotazione confermata) e
   rilascio del giorno dell'abbonato passano dalla coda di ADR 0007; blocco e sblocco della postazione
   per il giorno e la fascia mostrati sono **solo online** (tolgono disponibilità, che garantisce il
   server) con `Idempotency-Key`; un 403 si mostra come "non consentito".
7. **Illustrazioni dei kit: rinviate** (sostituita da ADR 0013). In questa versione le postazioni sono forme geometriche con lo
   stato, non le illustrazioni dei kit. Per usarle serve: una release del core che pubblichi i kit
   sanificati come asset versionato (come `openapi.yaml`, ADR 0002) o la decisione di Coste360 di
   vendorizzarli; la licenza dell'app compatibile con quella dei kit (BSL 1.1); una conversione dei
   colori `var(--beach-*)` in props per tema. Lo sfondo immagine della mappa (`background.url`) non è
   disegnato: potrebbe puntare fuori dall'istanza (ADR 0005).

## Conseguenze

- Positive: stessi colori, glifi e regole di stato del pannello; fluidità indipendente dal numero di
  postazioni durante i gesti; funziona offline sulla cache del giorno; niente dipendenze nuove
  (`react-native-svg`, gesture handler, Reanimated e worklets erano già nel progetto).
- Negative: al rilascio di un gesto l'SVG si ridisegna (un render per gesto); durante uno zoom forte lo
  strato è sfocato finché le dita non si alzano; due copie dei colori (CSS e palette, protette da un
  test); niente illustrazioni dei kit finché non sono risolti formato e licenza.
- Verifiche: `geometry.test.ts` (fascia del mare, camera, zoom attorno al fuoco, limiti, taglio,
  bersaglio di 44 dp), `status.test.ts` (stessi casi del pannello), `model.test.ts` (unione con il
  giorno, fasce, nomi per ruolo, ricerca), `actions.test.ts` (azioni per ruolo e giorno),
  `palette.test.ts`, `map-canvas.test.tsx` (600 postazioni, taglio con lo zoom),
  `src/test/screens/day-map.test.tsx` (telefono e tablet, tocco, ricerca, scheda, coda, blocchi,
  ruoli, fasce, elenco); `scripts/style-guard.js` con le due esenzioni motivate.
