# Architecture Decision Records

Ogni scelta non ovvia dell'app ha un ADR breve: contesto, decisione, conseguenze, stato.
Gli agenti e i contributori li leggono **prima** di proporre alternative. Cambiare una decisione esistente
richiede un nuovo ADR che sostituisce il precedente (il vecchio passa a "sostituito da NNNN", non si cancella).
Le decisioni del core sono nel suo repository (`docs/adr/` di `coste360/arenile`) e valgono anche qui
quando riguardano il contratto API, il marchio o la licenza.

## Indice

| N.                                                                | Titolo                                                                                                                             | Stato     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------- |
| [0001](0001-stack-expo-react-native.md)                           | Stack: Expo SDK 58, React Native, expo-router, TypeScript strict, build con EAS (scartati Capacitor, Flutter, solo PWA)            | accettato |
| [0002](0002-repository-separato-e-contratto-api.md)               | Repository separato e contratto API dall'`openapi.yaml` di una release fissata del core (tag + SHA-256), compatibilità con `/meta` | accettato |
| [0003](0003-autenticazione-con-token-del-dispositivo.md)          | Autenticazione con il token del dispositivo nel portachiavi, niente cookie, 401 gestito in un solo punto                           | accettato |
| [0004](0004-ui-kit-reusables-nativewind.md)                       | UI kit: React Native Reusables su NativeWind 4 (Tailwind 3), solo token del tema del pannello, layout master/detail su tablet      | accettato |
| [0005](0005-privacy-niente-telemetria-ne-aggiornamenti-remoti.md) | Privacy: niente telemetria, SDK di analisi o crash reporting, niente `expo-updates`/EAS Update                                     | accettato |
| [0006](0006-rete-locale-desktop-certificato-autofirmato.md)       | Rete locale del desktop: certificato autofirmato, trasporto nativo con pinning dell'impronta (rifiuto chiaro fino ad allora)       | proposto  |
| [0007](0007-offline-cache-e-coda-delle-operazioni.md)             | Offline: cache persistita di oggi e domani (SQLite, lista di chiavi ammesse), coda con chiavi di idempotenza, conflitti visibili   | accettato |

## Come aggiungere un ADR

1. Copia [`template.md`](template.md) in `NNNN-titolo-in-kebab-case.md` con il numero successivo.
2. Compila contesto, decisione e conseguenze in italiano, in modo conciso.
3. Aggiungi la riga all'indice qui sopra.
4. Se sostituisci un ADR, aggiorna lo stato del precedente e collega i due documenti.
