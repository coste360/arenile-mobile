# Immagini per gli store

Schermate vere dell'app (Expo Go nei simulatori iPhone 6,9" e iPad 13", collegata a **Prova la demo**,
ora fissata alle 9:41) con una didascalia in Titillium Web, il carattere del marchio Arenile, sul blu
Coste360. Le genera `scripts/store/compose.py`.

| Cartella                          | Misura      | Per                                                       |
| --------------------------------- | ----------- | --------------------------------------------------------- |
| `app-store/iphone-6.9/`           | 1320 × 2868 | App Store, iPhone 6,9" (richiesto)                        |
| `app-store/ipad-13/`              | 2064 × 2752 | App Store, iPad 13" (richiesto); anche tablet Google Play |
| `app-store/header-16x9.png`       | 5244 × 2950 | App Store, intestazione e risultati di ricerca (16:9)     |
| `app-store/header-21x9.png`       | 3840 × 1646 | App Store, intestazione (21:9)                            |
| `google-play/phone/`              | 1080 × 1920 | Google Play, telefoni                                     |
| `google-play/feature-graphic.png` | 1024 × 500  | Google Play, grafica in evidenza                          |

Le didascalie sono in italiano; per le altre lingue si rifanno le schermate con l'app in quella lingua.

## Rifarle

1. Catturare le schermate grezze in `store/raw/` (ignorata da git) con i nomi elencati in `PHONE` e
   `IPAD` dello script, per esempio `xcrun simctl io <simulatore> screenshot store/raw/phone-01-map.png`,
   dopo aver fissato la barra di stato con
   `xcrun simctl status_bar <simulatore> override --time 9:41 --batteryState charged --batteryLevel 100`.
2. `python3 scripts/store/compose.py` (serve Pillow: `pip install Pillow`). Il carattere si scarica in
   `store/.fonts/` (ignorata da git) la prima volta.

In Expo Go la barra di stato dell'iPad mostra "Expo Go": lo script la copre. Con una build EAS non
serve.

## Note

- I dati sono quelli inventati dell'istanza demo (email `example.com`, telefoni fittizi).
- Il simbolo e i colori sono del marchio Arenile: non sono coperti dalla licenza del codice
  ([assets/brand/NOTICE.md](../assets/brand/NOTICE.md)). Titillium Web è sotto SIL Open Font License 1.1.
