# 0005 — Privacy: niente telemetria, niente aggiornamenti remoti del codice

- **Stato:** accettato; eccezione in [0015](0015-prova-la-demo.md)
- **Data:** 2026-10-25
- **Sezioni della specifica:** core §29.2 ("Privacy first"), core §23 (privacy e GDPR), core ADR 0025

## Contesto

La specifica è netta: l'app parla solo con l'istanza del gestore, nessun dato passa da Coste360, nessuna
telemetria, nessun SDK di analisi o pubblicità. Lo stack Expo offre servizi comodi che contattano server
terzi: EAS Update / `expo-updates` (scarica codice JavaScript dai server Expo a ogni avvio), SDK di crash
reporting e analytics, la telemetria della CLI Expo durante lo sviluppo.

## Decisione

1. **Nessuna telemetria, nessun SDK di analisi, pubblicità o crash reporting** nell'app.
2. **Niente `expo-updates` né EAS Update:** il codice cambia solo con una nuova versione negli store.
   `eas update` è negato anche nelle impostazioni di Claude Code del repository.
3. L'app non contatta altri host oltre all'istanza abbinata (unica eccezione: l'istanza demo di
   Coste360, solo dopo il tocco su "Prova la demo", ADR 0015). Le notifiche push, che per vincolo di
   Apple e Google passerebbero da un relay, non fanno parte dell'app pubblica (ADR 0012).
4. Anche gli strumenti di sviluppo non inviano dati d'uso: `EXPO_NO_TELEMETRY=1` nel `Makefile` e in CI.
5. Un nuovo pacchetto che apre connessioni di rete proprie va dichiarato e motivato nella PR.

## Conseguenze

- Positive: promessa di privacy verificabile; nessun dato del lido fuori dall'istanza; nessun
  trattamento da dichiarare negli store oltre al minimo.
- Negative: ogni correzione richiede un rilascio negli store (giorni di revisione, non minuti); senza
  crash reporting gli errori arrivano solo dalle console degli store (dati aggregati, condivisi dagli
  utenti che lo consentono nel sistema) e dalle segnalazioni: servono test più severi prima del rilascio.
- Verifiche: revisione delle dipendenze in ogni PR (checklist del modello di PR), `.claude/settings.json`
  nega `eas update`, il revisore (`.claude/agents/reviewer.md`) controlla l'assenza di SDK di terze parti.
