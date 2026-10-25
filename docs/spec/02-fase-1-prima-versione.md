# Fase 1 — Prima versione negli store

Obiettivo: le operazioni quotidiane dello staff in spiaggia e della cassa, anche con rete instabile.
I permessi seguono il ruolo come nel pannello (sezione 16 del core): ogni azione non consentita al ruolo
è nascosta, e il server resta l'unico giudice (un `403` si mostra come "non consentito").

## Oggi

Riepilogo del giorno nel fuso dello stabilimento: arrivi, presenti, postazioni libere, prenotazioni da
saldare, abbonati che hanno rilasciato il giorno. Ogni numero porta all'elenco filtrato.

Regole dei numeri (le stesse dei totali operativi del core, `DayMovementsOn` e `ActiveStatuses`):
**arrivi** = prenotazioni attive non abbonamento che iniziano oggi; **presenti** = check-in fatto;
**da saldare** = prenotazioni attive con saldo; **postazioni libere** = libere o rilasciate (come
`totals.free`); **giorni rilasciati** = postazioni rilasciate anche solo per mezza giornata. Ogni numero
è calcolato con lo stesso filtro dell'elenco che apre, quindi coincide con la sua lunghezza.

## Mappa del giorno

- Vista operativa della mappa (sezione 11.3 del core) con i colori di stato del pannello, sempre
  accompagnati da etichetta e simbolo (mai solo il colore).
- Zoom e spostamento con i gesti, ricerca per postazione, cliente o codice prenotazione.
- **Scheda postazione:** stato, prenotazione o abbonamento, cliente (solo i dati che il ruolo può
  vedere), saldo, azioni consentite.
- Su tablet la mappa occupa il dettaglio e la scheda si apre accanto, senza coprire la mappa.

## Prenotazioni del giorno

Elenco con filtri (arrivi, presenti, da saldare, abbonati, online/cassa), ricerca e ordinamento.
**Scheda prenotazione:** postazione, periodo e fasce, cliente, importi in centesimi formattati in
italiano, pagamenti, note, cronologia essenziale.

- L'elenco copre oggi e domani (la finestra offline); cancellate, scadute, rifiutate e bozze sono
  nascoste salvo richiesta. "Online" comprende la pagina pubblica e le integrazioni API (il badge le
  distingue). La ricerca trova codice, cliente (anche senza accenti) e postazione.
- **Cliente secondo il ruolo:** nome ed etichette per tutti i ruoli con `bookings.read`; email,
  telefono e note sul cliente solo per chi ha `bookings.write` (titolare, gestore, cassiere), che
  lavora con il cliente alla cassa. Personale di spiaggia e sola lettura vedono quanto basta a
  riconoscere il cliente in spiaggia (minimizzazione, sezione 23 del core). Il core oggi invia lo
  stesso dettaglio a ogni ruolo con `bookings.read`: nascondere qui limita ciò che lo schermo espone,
  non ciò che il ruolo può ottenere; un filtro lato server sarebbe una modifica del core.
- Su tablet elenco e scheda sono affiancati; un collegamento a una prenotazione apre la vista affiancata
  con la prenotazione selezionata.

## Operazioni

- **Check-in** con scansione del QR della prenotazione o del biglietto d'ingresso, oppure manuale dalla
  scheda.
- **Rilascio del giorno degli abbonati** e **blocco della postazione** (permessi come il pannello).
- **Note** sulla prenotazione.
- **Incasso rapido in contanti** su una prenotazione esistente, solo per cassiere, gestore e titolare.

## Offline

Stesse regole del pannello (sezione 21.2 del core):

- cache della mappa e delle prenotazioni del giorno corrente e del successivo, consultabili offline;
- coda delle operazioni a basso rischio — check-in, rilasci, note, incassi in contanti — inviate in
  ordine alla riconnessione con **chiavi di idempotenza**; i conflitti si mostrano all'utente;
- creazione e spostamento di prenotazioni **solo online** (servono le garanzie di disponibilità del
  server);
- indicatore della connessione sempre visibile e numero di operazioni in attesa.

## Pubblicazione

- Build e invio con EAS Build/Submit, account Apple Developer e Google Play di Coste360.
- Revisione degli store sulla demo pubblica azzerata ogni notte (sezione 26 del core).
- Licenza dell'app decisa da Coste360 prima della pubblicazione.
- Icone e schermata di avvio con il marchio ufficiale; schede degli store in quattro lingue.
