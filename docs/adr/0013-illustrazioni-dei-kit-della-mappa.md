# 0013 — Illustrazioni dei kit della mappa dalla release fissata del core

- **Stato:** proposto
- **Data:** 2026-10-25
- **Sezioni della specifica:** core §11.3 (vista operativa); core ADR 0012 e 0024 (kit della mappa);
  ADR 0002, 0004, 0008 (sostituisce la decisione 7)

## Contesto

L'ADR 0008 aveva rinviato le illustrazioni dei kit: le postazioni erano forme geometriche colorate,
mentre il pannello disegna ombrelloni, lettini, passerelle e strutture con i kit di Coste360. Sul
telefono la mappa risultava così diversa da quella che il personale conosce. Le condizioni poste
dall'ADR 0008 ora sono soddisfatte:

- i kit (`assets/map-kits/<kit>/`: `manifest.json`, `svg/*.svg`, `NOTICE.md`) sono parte della
  release del core, come `openapi.yaml`: il tag fissato in `api/core-version.json` li identifica;
- sono opera di Coste360 SRL sotto BSL 1.1, lo stesso titolare che pubblica l'app; vengono
  vendorizzati verbatim con il loro `NOTICE.md`;
- `react-native-svg` non legge le variabili CSS: i colori `var(--beach-*, fallback)` vanno convertiti
  in props per tema.

Alternative scartate: `SvgXml` con le stringhe SVG (parsing a runtime, nessun colore per tema o
stato), importare i file generati del pannello (codice del core, vietato dall'ADR 0002), ridisegnare
le illustrazioni nell'app (due fonti di verità).

## Decisione

1. **Sorgente:** `make gen` esegue `scripts/gen-map-kits.mjs`, che scarica i kit `modern` e `classic`
   del tag fissato del core (`raw.githubusercontent.com/coste360/arenile/<tag>/assets/map-kits/…`) in
   `assets/map-kits/<kit>/`, verbatim, e ne registra lo SHA-256 in `assets/map-kits/kits.lock.json`.
   Allo stesso tag i file devono avere lo stesso hash; `make gen-check` (in `make check`) lavora senza
   rete e fallisce se i file non corrispondono al lock o il codice generato non è aggiornato.
2. **Conversione:** lo script valida ogni SVG con una lista ristretta di elementi e attributi (come il
   generatore del core: niente script, riferimenti esterni, `style`, `url()`), richiede viewBox
   `0 0 120 120` e colori solo `none` o `var(--beach-*, fallback)`, e scrive in
   `src/features/day-map/kit/generated/` il catalogo e un albero di elementi per ogni illustrazione,
   con i colori come nomi di token (`$ink`, `$state`, `$flag`). Le stesse normalizzazioni del core
   (`ombrellone_quadrato` del classico).
3. **Colori:** i token `--beach-*` sono in `MAP_PALETTE` (chiaro e scuro) con i valori del pannello
   della stessa release; `$state` è il colore di stato della postazione, `$flag` il colore della
   bandiera scelto dalla `variant`.
4. **Disegno:** ogni combinazione (illustrazione, colore di stato, colore della bandiera) presente
   nell'area visibile è un solo `<Symbol>` in `<Defs>`; ogni postazione e decorazione è un `<Use>`.
   Come nel pannello: illustrazione 1,3 volte l'ingombro; kit `modern` con lo stato dipinto
   sull'illustrazione e badge nell'angolo libero; kit `classic` con l'alone colorato sotto e
   l'illustrazione mai ricolorata; codice in una pillola; barra diagonale sulle postazioni bloccate;
   anello di selezione e di ricerca; decorazioni con le passerelle a moduli. Postazioni e decorazioni
   senza illustrazione restano forme geometriche.
5. **Scelta del kit:** `theme.map_kit` dello stabilimento (`GET establishments/{id}`, già in cache
   offline); assente o sconosciuto = `modern`, come il core.
6. Il tocco resta sull'ingombro della postazione (con il bersaglio minimo di 44 dp), non
   sull'illustrazione.

## Conseguenze

- Positive: la mappa del telefono è quella del pannello, nei due kit e nei due temi; i kit seguono
  le release del core con `make api-bump` + `make gen`; un solo disegno per illustrazione anche con
  centinaia di postazioni; nessuna dipendenza nuova.
- Negative: circa 0,9 MB di SVG vendorizzati e 180 KB di dati generati nel bundle; i valori dei token
  sono una copia di quelli del pannello (da aggiornare a ogni cambio del core); i kit sono BSL 1.1,
  da considerare quando Coste360 deciderà la licenza dell'app.
- Verifiche: `kit/kits.test.ts` (kit dello stabilimento, illustrazioni predefinite, misure, moduli
  delle passerelle, ogni illustrazione presente e colorata solo con token della palette),
  `map-canvas.test.tsx` (un simbolo per illustrazione e colore, kit classico non ricolorato),
  `make gen-check`, `scripts/agents/guard-generated.sh` (blocca le modifiche a mano).
