# 0014 — Giorni oltre la finestra offline: calendario per mappa e prenotazioni

- **Stato:** proposto
- **Data:** 2026-10-26
- **Sezioni della specifica:** `docs/spec/02-fase-1-prima-versione.md` (mappa del giorno, prenotazioni
  del giorno); core §11.3, §21.2; ADR 0004, 0007, 0008 (modifica la decisione 5 sui giorni)

## Contesto

Mappa del giorno e prenotazioni mostravano solo oggi e domani, i giorni che la cache offline conserva
(ADR 0007), con due pulsanti "Oggi" / "Domani". Provando l'app su iPad il titolare ha chiesto di poter
guardare qualsiasi giorno con un calendario, come nel pannello: per preparare il fine settimana, per
rispondere a un cliente al telefono, per controllare un giorno passato. L'API lo permette già
(`operations/day` e `bookings` accettano qualsiasi `date`); il limite era solo dell'app.

React Native Reusables non ha un calendario. `@expo/ui` (già una dipendenza per i widget, ADR 0010)
offre `DateTimePicker`, sostituto compatibile di `@react-native-community/datetimepicker` disegnato
con SwiftUI e Jetpack Compose, incluso in Expo Go. Scartati: aggiungere
`@react-native-community/datetimepicker` (una dipendenza in più per la stessa cosa) e un calendario
disegnato a mano con i componenti Reusables (più codice e accessibilità da rifare).

## Decisione

1. **Selettore del giorno** (`src/components/day-picker.tsx`), uguale su mappa e prenotazioni: un
   controllo segmentato "Oggi · Domani · 📅". Il terzo segmento apre il calendario nativo di
   `@expo/ui/community/datetime-picker` (iOS: calendario grafico in un `AlertDialog`; Android: il
   dialogo di sistema) e, scelto un giorno, ne mostra la data. Intervallo: 400 giorni prima e dopo
   oggi.
2. **Oggi e domani restano relativi:** la scelta è `'today' | 'tomorrow' | YYYY-MM-DD`
   (`DaySelection`, `src/lib/calendar.ts`); scegliere oggi o domani nel calendario torna ai due
   pulsanti, così a mezzanotte (fuso dello stabilimento) il giorno avanza come prima.
3. **Offline invariato:** la cache persistita resta limitata a oggi e domani (lista ammessa di
   `persist.ts`, ADR 0007). Gli altri giorni si caricano solo online; senza rete l'app lo dice
   ("Giorno disponibile solo online") invece di un errore generico.
4. **Azioni:** le regole non cambiano. Check-in solo oggi, rilascio dell'abbonato oggi o domani (in
   coda), blocchi e vendita su qualsiasi giorno ma solo online (ADR 0009, 0011).
5. **Unica eccezione all'ADR 0004** per il calendario: un componente `@expo/ui` nelle schermate, con
   i colori di sistema (nessun colore grezzo nel codice dell'app).

## Conseguenze

- Positive: stesso comportamento del pannello; nessuna nuova dipendenza; oggi e domani funzionano
  ancora senza rete.
- Negative: il calendario ha l'aspetto del sistema e non i token del tema; i giorni fuori dalla
  finestra non sono consultabili offline.
- Verifiche: `src/lib/calendar.test.ts` (selezione, finestra offline, andata e ritorno dal
  calendario nativo), test delle schermate mappa e prenotazioni; `jest.setup.ts` sostituisce il
  calendario nativo con una vista semplice.
