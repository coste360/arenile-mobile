# 0017 — Licenza: Business Source License 1.1 come il core

- **Stato:** accettato
- **Data:** 2026-10-30
- **Sezioni della specifica:** core `docs/spec/29-edizione-desktop-e-app-mobile.md` §29.2; core
  `LICENSE`, `CLA.md`, `TRADEMARK.md`

## Contesto

Fino a questa decisione il repository non aveva un file `LICENSE`: tutti i diritti erano riservati a
Coste360 SRL, in attesa della scelta prevista dalla specifica del core (§29.2: la BSL 1.1 come il core,
salvo diversa decisione prima della pubblicazione). La pubblicazione negli store è vicina e la scelta non
si può più rimandare.

Il codice dell'app vale poco senza il core: si collega solo a un'istanza Arenile e ne usa le API.
Renderlo leggibile permette a chiunque di verificare le promesse dell'ADR 0005 (nessuna telemetria,
nessun server predefinito, dati solo verso l'istanza dello stabilimento). Una licenza aperta permissiva
(MIT, Apache-2.0) permetterebbe invece a terzi di ripubblicare l'app negli store come prodotto
concorrente; le licenze copyleft (GPL, AGPL) non si conciliano bene con la distribuzione degli store da
parte di terzi e rendono più delicati i contributi esterni.

## Decisione

1. **Il codice dell'app è sotto la Business Source License 1.1** (SPDX `BUSL-1.1`), con gli stessi
   parametri del core: licenziante Coste360 SRL, la stessa _Additional Use Grant_ (uso in produzione per
   gli stabilimenti balneari gestiti direttamente, valutazione e sviluppo; esclusi servizi a terzi e
   prodotti sostitutivi), _Change Date_ tre anni dopo la prima pubblicazione di ogni versione, _Change
   License_ GNU AGPL v3.0 o successive. Il testo è in `LICENSE`, identico a quello del core salvo il nome
   dell'opera ("Arenile mobile").
2. **Il progetto si descrive come "source available"**, mai "open source": la BSL non è una licenza
   open source finché una versione non passa alla licenza di conversione.
3. **Il marchio resta fuori dalla licenza del codice**: nome "Arenile", simbolo, icone e schede degli
   store seguono il `TRADEMARK.md` del core (`assets/brand/NOTICE.md`).
4. **I contributi richiedono il CLA di Arenile**, lo stesso del core, così Coste360 può continuare a
   pubblicare l'app negli store e a concedere licenze commerciali.
5. **Le dipendenze nuove** devono avere una licenza compatibile sia con la BSL 1.1 sia con la AGPL-3.0
   (MIT, BSD, Apache-2.0...), come già richiesto da `AGENTS.md`.

## Conseguenze

- Positive: le promesse sulla privacy sono verificabili sul codice; core e app hanno le stesse regole;
  i kit della mappa del core (BSL 1.1) sono compatibili con la licenza dell'app (ADR 0008, ADR 0013).
- Negative: gli stabilimenti e gli sviluppatori che vogliono offrire servizi a terzi sull'app hanno
  bisogno di una licenza commerciale; la parte della _Additional Use Grant_ sulla pagina di prenotazione
  pubblica e sul widget del core non riguarda l'app ma resta per tenere il testo identico al core.
- Verifiche: `LICENSE` nella radice, `"license": "BUSL-1.1"` in `package.json`; la PR della decisione
  aggiorna README, CONTRIBUTING, `AGENTS.md` e il piano dell'app.
