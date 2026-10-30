# Contribuire all'app mobile di Arenile

Grazie per voler contribuire. L'app mobile segue le stesse regole del progetto principale: leggi la guida
[CONTRIBUTING del core](https://github.com/coste360/arenile/blob/main/CONTRIBUTING.md) e il
[Codice di condotta](https://github.com/coste360/arenile/blob/main/CODE_OF_CONDUCT.md), che valgono anche
qui. Partecipando accetti di rispettarli.

## Prima di scrivere codice

1. Cerca se esiste già una issue; altrimenti aprine una con il modello adatto. Per modifiche non banali
   attendi un riscontro dei maintainer.
2. Leggi [AGENTS.md](AGENTS.md), il [piano dell'app](docs/spec/README.md) e gli [ADR](docs/adr/README.md).
   Per cambiare una decisione serve un nuovo ADR.
3. Se la funzione richiede un endpoint che il contratto non ha, la modifica parte dal
   [repository del core](https://github.com/coste360/arenile) (API-first), poi arriva qui con
   `make api-bump`.
4. Le vulnerabilità **non** si segnalano con issue pubbliche: segui [SECURITY.md](SECURITY.md).

## Ambiente e verifiche

```bash
make setup        # una tantum
make check        # dopo ogni modifica (< 2 min)
make check-full   # prima della pull request
```

I pacchetti si aggiungono solo con `npx expo install <pacchetto>`; ogni nuova dipendenza va motivata
nella pull request, con una licenza compatibile sia con la BSL 1.1 sia con la AGPL-3.0 (ad esempio MIT,
BSD, Apache-2.0) e senza telemetria propria.

## Commit e pull request

- [Conventional Commits](https://www.conventionalcommits.org/it/v1.0.0/) (`feat:`, `fix:`, `docs:`,
  `test:`, `refactor:`, `build:`, `ci:`, `chore:`), anche nel titolo della pull request.
- Una pull request tocca un'area; compila il modello (cosa cambia, come è stato testato, domande aperte)
  e aggiungi una voce in `CHANGELOG.md` sotto `[Unreleased]`.
- Testi in italiano (lingua sorgente) con le traduzioni in inglese, tedesco e francese.

## Licenza e CLA

Il codice è sotto la Business Source License 1.1, come il core ([LICENSE](LICENSE), ADR 0017). I contributi richiedono
la firma del [CLA di Arenile](https://github.com/coste360/arenile/blob/main/CLA.md), lo stesso del core.
