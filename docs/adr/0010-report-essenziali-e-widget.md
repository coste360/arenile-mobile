# 0010 — Report essenziali e widget della schermata principale

- **Stato:** proposto
- **Data:** 2026-10-25
- **Sezioni della specifica:** `docs/spec/04-fase-3.md`, core §15.3 (report), §16.1 (permessi), §21.2
  (offline), ADR 0004 (UI kit), ADR 0005 (privacy), ADR 0007 (cache offline)

## Contesto

La fase 3 chiede due cose. **Report essenziali** per titolare, gestore e sola lettura: incassi e
occupazione del giorno e della settimana, confronto con l'anno precedente; le esportazioni restano nel
pannello. **Widget** nella schermata principale di iOS e Android con il riepilogo del giorno ("12 arrivi,
3 da saldare") che legge solo dati già in cache sul dispositivo e non contatta servizi diversi dall'istanza.

Per i report il contratto della release fissata (core v1.0.1) offre già tutto: `GET reports/summary`,
`reports/occupancy`, `reports/revenue` e `reports/comparison`, tutti con permesso `reports.read`. Il
confronto restituisce in una sola risposta valore corrente, precedente e variazione (punti base, troncati)
di incassato, occupazione e prenotazioni, con le stesse basi di data del riepilogo del pannello, più una
serie per giorno.

Per il widget, Expo SDK 58 ha un pacchetto ufficiale, **`expo-widgets`** (MIT, mantenuto da Expo): widget
iOS (WidgetKit, layout in SwiftUI) e Android (Jetpack Glance, layout Compose) scritti con i componenti di
Expo UI (`@expo/ui`), con config plugin che crea l'estensione iOS, l'app group e il receiver Android. Il
componente del widget, marcato con la direttiva `'widget'`, gira in un runtime isolato: niente import oltre
a Expo UI, niente hook né stato dell'app; i dati arrivano solo come props scritte dall'app
(`updateSnapshot`; su iOS anche `updateTimeline`). Alternative considerate:

- `react-native-android-widget` (MIT, ben mantenuto): solo Android, servirebbe comunque un'estensione
  Swift scritta a mano per iOS;
- config plugin della comunità per estensioni WidgetKit (es. `@bacons/apple-targets`): solo iOS, codice
  Swift da mantenere fuori dal ciclo di Expo;
- estensioni native scritte a mano in `ios/` e `android/`: contro la Continuous Native Generation (le
  cartelle native sono generate e ignorate da git).

## Decisione

1. **Report:** l'app usa solo `GET reports/comparison` (granularità giorno, confronto con l'anno precedente,
   allineamento "stessa data" come default del pannello o "stesso giorno della settimana" a scelta) per un
   **giorno** o una **settimana ISO** (lunedì–domenica) dello stabilimento, navigabili all'indietro fino a
   quella corrente. Mostra incassato, occupazione, prenotazioni e prenotato con il valore dell'anno
   precedente e la variazione come il pannello (icona e parola per la direzione, mai solo il colore), più
   il giorno per giorno della settimana. Nessuna esportazione nell'app.
2. **Permessi:** voce e schermata solo con `reports.read` (`useAbilities().canSeeReports`: titolare,
   gestore, sola lettura); chi non lo ha non vede la voce e, aprendo la rotta, legge "non consentito"
   senza richieste all'istanza; un 403 dell'istanza mostra lo stesso messaggio.
3. **Report solo online:** le chiavi `['est', id, 'reports', …]` non entrano nella lista ammessa della
   cache persistita (ADR 0007): i report non sono dati operativi (core §21.2). Senza rete la schermata lo
   dice; i dati già scaricati nella sessione restano visibili con l'avviso "dati non aggiornati".
4. **Widget con `expo-widgets`:** un widget `DaySummary` (iOS `systemSmall` e `systemMedium`, Android
   2×2 ridimensionabile), app group `group.app.arenile.mobile`, push e Live Activity disattivati,
   Android senza aggiornamento periodico (`updatePeriodMillis` 0). Il widget non ha un timeline provider
   che scarica dati: mostra solo le props pubblicate dall'app.
5. **Solo dati già in cache:** l'app calcola il riepilogo dal giorno operativo di oggi presente nella
   cache delle query (scaricato dalle schermate o dal riscaldamento offline, ripristinato a freddo,
   aggiornato dalle operazioni in coda) con una query disabilitata: il widget non provoca mai una
   richiesta. Pubblica: arrivi, prenotazioni da saldare (contate una volta), presenti, postazioni libere.
6. **Privacy della schermata principale:** solo conteggi, nome dello stabilimento e giorno: niente nomi
   di clienti, codici o importi. Allo scollegamento il widget passa subito al messaggio "collega questo
   dispositivo".
7. **Mai i numeri di ieri come oggi:** su iOS la timeline sostituisce i conteggi con "dati di …, apri
   Arenile" alla mezzanotte dello stabilimento; su Android (niente timeline) il widget mostra sempre il
   giorno dei dati e l'ora dell'aggiornamento.
8. **Testi e colori dall'app:** il runtime del widget non traduce né formatta: l'app passa tutte le
   stringhe già tradotte (it, en, de, fr) e un'etichetta unica per i lettori di schermo; su Android anche
   i colori della superficie, derivati dal tema (`src/lib/theme.ts`). Il layout Android usa i ruoli
   tipografici Material (`style={{ typography }}`): unica esenzione della guardia degli stili, con il
   motivo nello script (ADR 0004).
9. **Effetto iniettato:** la scrittura passa da `Dependencies.widget` (`WidgetBridge`); il modulo del
   widget si carica in modo pigro solo su iOS e Android, così l'app funziona dove il modulo nativo manca
   (Expo Go, web).

## Conseguenze

- Positive: una sola richiesta per periodo, stessi numeri e stesse basi del pannello; nessun dato
  personale sulla schermata principale; il widget funziona offline e non contatta nessuno; pacchetto
  ufficiale Expo, niente codice nativo nel repository.
- Negative: servono una build EAS e un nuovo profilo di provisioning (app group ed estensione
  `app.arenile.mobile.ExpoWidgetsTarget`); nome e descrizione del widget nella galleria sono solo in
  italiano (il config plugin accetta una stringa); su Android i conteggi restano fino alla prossima
  apertura dell'app (con il giorno ben visibile); `expo-widgets` è giovane e i componenti Android sono un
  sottoinsieme di Compose.
- Da verificare su dispositivo: aspetto e leggibilità del widget su iPhone, iPad e Android (chiaro, scuro,
  testo grande, VoiceOver e TalkBack), il passaggio a "dati di ieri" alla mezzanotte su iOS, la
  pubblicazione dopo un check-in offline e dopo lo scollegamento.
- Verifiche: `features/reports/*.test.ts` (periodi, formati, variazioni), `features/widget/*.test.ts`
  (riepilogo, mezzanotte con ora legale, stringhe, colori, bridge), `persist.test.ts` (report esclusi
  dalla cache), `src/test/screens/reports.test.tsx` (ruoli, telefono e tablet, settimana, navigazione,
  allineamento, 403, offline, 501), `src/test/screens/widget.test.tsx` (pubblicazione dalla cache, avvio
  a freddo senza rete, scollegamento, lingua).
