# 0002 — Repository separato e contratto API da una release fissata del core

- **Stato:** accettato
- **Data:** 2026-10-25
- **Sezioni della specifica:** core §29.2 ("Contratto e compatibilità"), core ADR 0005 (OpenAPI
  spec-first), core ADR 0015 (`/meta`, token per dispositivo)

## Contesto

L'app ha un ciclo di rilascio legato agli store e una toolchain diversa dal core (Go + React, binario
unico). La specifica chiede un repository separato (`coste360/arenile-mobile`) e un client generato da
`api/openapi.yaml`, pubblicato come asset di ogni release del core; l'app non importa codice del pannello.
Le istanze in campo hanno versioni diverse: l'app deve sapere con quale contratto è stata scritta e
verificare la compatibilità a runtime.

## Decisione

1. Il contratto è l'asset `openapi.yaml` di una **release fissata** del core. `api/core-version.json`
   registra tag e **SHA-256**; `api/openapi.yaml` ne è la copia verbatim, versionata nel repository.
2. `make gen` (`scripts/gen-api.mjs`) verifica lo SHA-256 (scarica il file dalla release se manca o non
   corrisponde) e genera `src/api/generated/schema.d.ts` con openapi-typescript. Il file generato è
   versionato e non si modifica a mano (hook `guard-generated.sh`). `make gen-check`, in `make check`,
   lavora senza rete e fallisce se contratto o tipi non sono allineati.
3. `make api-bump VERSION=vX.Y.Z` fissa un'altra release: scarica, registra lo SHA-256, rigenera; il diff
   del contratto si rivede nella pull request.
4. Le chiamate usano **openapi-fetch** sui tipi generati; gli alias dei tipi stanno in `src/api/types.ts`.
   L'app non importa codice del core.
5. Compatibilità a runtime con `GET /api/admin/v1/meta`: l'app dichiara la versione minima di Arenile
   che supporta (`MIN_INSTANCE_VERSION`, oggi 1.0.0, la prima con abbinamento e `min_client_versions`)
   e confronta la propria versione con `min_client_versions.mobile`, con le stesse regole semver del
   client desktop del core (`VersionAtLeast`).

## Conseguenze

- Positive: build riproducibili e verificabili; `make check` senza rete; aggiornare il contratto è un
  atto esplicito e rivedibile; un endpoint nuovo segue il percorso API-first del core.
- Negative: un file di circa 900 KB versionato due volte (core e app); per usare un endpoint nuovo serve
  prima una release del core; le regole condivise (QR, codici, versioni) sono duplicate in TypeScript e
  vanno tenute allineate ai test Go del core.
- Verifiche: `make gen-check` in CI; hook `guard-generated.sh`; regola `.claude/rules/api-client.md`;
  test che riprendono i casi Go (`qr.test.ts`, `target.test.ts`, `version.test.ts`).
