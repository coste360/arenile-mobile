# Arenile mobile — app per lo staff degli stabilimenti balneari (Expo + React Native), Coste360 SRL.
#
# This Makefile is the ONLY supported interface for building, testing and
# checking the app, like in the core repository. Humans, CI and coding agents
# all use the same targets. Run `make` or `make help` for the list.
#
# Compatible with GNU Make >= 3.81 (the version shipped with macOS): no
# .ONESHELL, no .SHELLFLAGS. Multi-line recipes use explicit `set -euo pipefail`.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# No usage data from the Expo CLI either (ADR 0005).
export EXPO_NO_TELEMETRY := 1

# Generated code: never edited by hand, checked by gen-check.
GENERATED := api/openapi.yaml src/api/generated assets/map-kits src/features/day-map/kit/generated
# Pinned core release of the API contract (api/core-version.json).
CORE_VERSION = $(shell node -p "require('./api/core-version.json').version" 2>/dev/null)

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Mostra questo aiuto (target predefinito)
	@printf 'Arenile mobile — comandi disponibili (contratto API del core %s)\n\n' '$(CORE_VERSION)'
	@grep -hE '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-13s\033[0m %s\n", $$1, $$2}'
	@printf '\nVariabili utili: VERSION=vX.Y.Z (per api-bump)\n'

# ---------------------------------------------------------------------------
# Setup and development
# ---------------------------------------------------------------------------

.PHONY: setup
setup: ## Installa le dipendenze esatte del lockfile (npm ci)
	npm ci

.PHONY: dev
dev: ## Avvia Metro (Expo) per una build di sviluppo o Expo Go
	npx expo start

# ---------------------------------------------------------------------------
# Code generation (API contract of the pinned core release, ADR 0002)
# ---------------------------------------------------------------------------

.PHONY: gen
gen: ## Verifica contratto e kit della mappa sulla release fissata del core e rigenera il codice generato
	node scripts/gen-api.mjs
	node scripts/gen-map-kits.mjs

.PHONY: gen-check
gen-check: ## Verifica (senza rete) che contratto e tipi generati siano allineati a quelli versionati
	@node scripts/gen-api.mjs --offline
	@node scripts/gen-map-kits.mjs --offline
	@set -euo pipefail; \
	if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then echo "gen-check: not a git repository, skipped"; exit 0; fi; \
	changes="$$(git status --porcelain --untracked-files=all -- $(GENERATED))"; \
	if [ -n "$$changes" ]; then \
		echo "gen-check: generated code is out of date or not committed:"; \
		echo "$$changes"; \
		echo "Run 'make gen' and commit the result."; \
		exit 1; \
	fi; \
	echo "gen-check: generated code is up to date (core $(CORE_VERSION))"

.PHONY: api-bump
api-bump: ## Fissa un'altra release del core (VERSION=vX.Y.Z): scarica openapi.yaml, registra lo SHA-256, rigenera
	@if [ -z "$(VERSION)" ]; then echo "usage: make api-bump VERSION=v1.0.2" >&2; exit 2; fi
	node scripts/gen-api.mjs --bump $(VERSION)

# ---------------------------------------------------------------------------
# Quality
# ---------------------------------------------------------------------------

.PHONY: lint
lint: ## ESLint, guardia degli stili, Prettier in verifica, tsc --noEmit
	npm run lint
	npm run format:check
	npm run typecheck

.PHONY: fmt
fmt: ## Formatta il codice con Prettier
	npm run format

.PHONY: test
test: ## Test unitari e delle schermate (Jest, jest-expo, Testing Library; senza rete)
	npm test

.PHONY: check
check: gen-check lint test ## Verifica del codice generato + lint + test (< 2 min)

.PHONY: doctor
doctor: ## expo-doctor: dipendenze e configurazione compatibili con l'SDK
	npx --yes expo-doctor

.PHONY: export-check
export-check: ## Compila i bundle JavaScript iOS e Android (prova che l'app compila, senza Xcode né Android SDK)
	@set -euo pipefail; \
	out="$$(mktemp -d)"; \
	trap 'rm -rf "$$out"' EXIT; \
	npx expo export --platform ios --output-dir "$$out/ios"; \
	npx expo export --platform android --output-dir "$$out/android"; \
	echo "export-check: iOS and Android bundles built"

.PHONY: check-full
check-full: check doctor export-check ## check + expo-doctor + bundle iOS e Android (prima della PR)

.PHONY: clean
clean: ## Rimuove cache e file temporanei (.expo, dist, coverage)
	rm -rf .expo dist coverage
