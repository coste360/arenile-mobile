## Cosa cambia

<!-- Descrivi la modifica e il motivo. Collega la issue: "Closes #123". -->

Closes #

## Come è stato testato

<!-- Test aggiunti o aggiornati, comandi eseguiti e risultati, prove su dispositivo (quale, con quale istanza). -->

- [ ] Test unitari
- [ ] Test delle schermate (telefono e tablet)
- [ ] Prova su dispositivo o simulatore (build di sviluppo EAS)
- [ ] Tema chiaro e scuro verificati

## Domande aperte

<!-- Dubbi, compromessi, punti su cui vuoi un parere. Nuove dipendenze: spiega perché sono necessarie e indica la licenza. -->

## Checklist

- [ ] `make check` passa
- [ ] `make check-full` passa (expo-doctor ed export dei bundle iOS e Android)
- [ ] I tipi delle API vengono dal contratto della release del core fissata (`make gen`); nessuna modifica a mano in `api/` o `src/api/generated/`
- [ ] Nuovi pacchetti aggiunti con `npx expo install`, con il motivo e la licenza qui sopra
- [ ] Nessuna telemetria, SDK di analisi o aggiornamento remoto; nessun token o dato personale nei log
- [ ] Testi tramite chiavi i18n in italiano, inglese, tedesco e francese
- [ ] Solo componenti React Native Reusables e token del tema (la guardia degli stili passa)
- [ ] Documentazione aggiornata (`docs/`, README) e voce in `CHANGELOG.md` sotto `[Unreleased]`
- [ ] Titolo della PR in formato Conventional Commits (`feat:`, `fix:`, `docs:` ...)
- [ ] Ho firmato il [CLA](https://github.com/coste360/arenile/blob/main/CLA.md) di Arenile
