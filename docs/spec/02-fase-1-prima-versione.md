# Fase 1 — Prima versione negli store

Obiettivo: le operazioni quotidiane dello staff in spiaggia e della cassa, anche con rete instabile.
I permessi seguono il ruolo come nel pannello (sezione 16 del core): ogni azione non consentita al ruolo
è nascosta, e il server resta l'unico giudice (un `403` si mostra come "non consentito").

## Oggi

Riepilogo del giorno nel fuso dello stabilimento: arrivi, presenti, postazioni libere, prenotazioni da
saldare, abbonati che hanno rilasciato il giorno. Ogni numero porta all'elenco filtrato.

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
