# Politica di sicurezza

L'app mobile di Arenile custodisce il token di accesso del dispositivo all'istanza di uno stabilimento e
mostra dati operativi e personali dei clienti. Prendiamo sul serio ogni segnalazione e ringraziamo chi ci
aiuta con una divulgazione responsabile.

## Versioni supportate

| Versione                               | Supportata                                   |
| -------------------------------------- | -------------------------------------------- |
| `main` (sviluppo)                      | Sì                                           |
| Ultima versione pubblicata negli store | Sì, con rilascio di correzione               |
| Versioni precedenti                    | No: aggiorna dall'App Store o da Google Play |

Le vulnerabilità del server, del pannello o delle API si segnalano per il
[core](https://github.com/coste360/arenile/blob/main/SECURITY.md), con la stessa procedura.

## Come segnalare una vulnerabilità

**Non aprire issue, discussioni o pull request pubbliche per le vulnerabilità.**

Scrivi a **security@coste360.it** oppure usa
[Report a vulnerability](https://github.com/coste360/arenile-mobile/security/advisories/new) di GitHub
(segnalazione privata). Includi versione dell'app, sistema e dispositivo, versione ed edizione
dell'istanza, passi per riprodurre e impatto. Non includere dati personali reali, token o codici di
abbinamento validi.

Conferma di ricezione entro 3 giorni lavorativi, prima valutazione entro 10; chiediamo di non divulgare
la vulnerabilità prima della correzione o, in assenza di risposta, prima di 90 giorni.

## Ambito

Rientrano nell'ambito, ad esempio:

- estrazione del token del dispositivo (portachiavi, backup, log, URL, schermate);
- abbinamento con un'istanza diversa da quella del QR, accettazione di certificati non validi o di
  un'impronta diversa da quella abbinata, invio del token su `http`;
- accesso a dati o azioni oltre i permessi del ruolo dell'utente;
- deep link `arenile://` che eseguono azioni senza conferma o con dati manipolati;
- dati inviati a host diversi dall'istanza abbinata.

Fuori ambito: dispositivi con jailbreak o root, accesso fisico a un dispositivo sbloccato, istanze
configurate in modo non sicuro dal gestore, segnalazioni automatiche senza impatto dimostrato.

## Pratiche del progetto

- Token solo nel portachiavi del sistema, mai migrato con i backup; nessun cookie.
- `https` obbligatorio verso l'istanza (`http` solo su loopback per lo sviluppo); nessuna disattivazione
  della validazione TLS.
- Nessuna telemetria né SDK di terze parti; nessun aggiornamento remoto del codice.
- Nessun token, email o telefono nei log.

## Safe harbor

Non intraprenderemo azioni legali contro chi, in buona fede, ricerca e segnala vulnerabilità nel rispetto
di questa politica, senza accedere a dati altrui oltre il minimo necessario e senza interrompere servizi.
