# Esclusi per decisione

- **Modalità "tablet cassa" con il server dentro l'app:** non per ora. Un'istanza in un'app mobile
  avrebbe problemi di backup, aggiornamenti e funzionamento in background; per una cassa senza server
  online c'è l'edizione desktop (sezione 29.1 del core), a cui l'app si collega in rete locale.
- **Notifiche push:** non nell'app pubblica
  ([ADR 0012](../adr/0012-niente-notifiche-push-nell-edizione-pubblica.md)). Richiedono un relay
  centrale gestito da Coste360; potranno diventare una funzione di una futura edizione a pagamento.
  L'app aggiorna i dati quando viene aperta o torna in primo piano.
- **Pagamento con carta dal telefono** (tap to pay, lettori collegati): no. I pagamenti con carta
  restano quelli dei provider configurati nel pannello e della cassa.
- **Funzioni del pannello web:** configurazione dello stabilimento, prezzi e listini, policy, mappe ed
  editor, utenti e ruoli, rimborsi, esportazioni e importazioni restano nel pannello.
