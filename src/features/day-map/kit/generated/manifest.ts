// GENERATED FILE, DO NOT EDIT.
// Catalogue of the kits from assets/map-kits of Arenile core v1.0.6 (scripts/gen-map-kits.mjs,
// 'make gen'). Artwork © Coste360 SRL, BSL 1.1: see assets/map-kits/*/NOTICE.md.

/** Kits of the core, the default first. */
export const MAP_KIT_KEYS = ["modern","classic"] as const;

export type MapKitKey = (typeof MAP_KIT_KEYS)[number];

/** How each kit draws the status: `fill` paints the art's status part, `halo` a disc under it. */
export const MAP_KIT_STYLE: Readonly<Record<MapKitKey, 'fill' | 'halo'>> = {"modern":"fill","classic":"halo"};

export const KIT_ASSET_IDS = [
  "ombrellone_navy",
  "ombrellone_sabbia",
  "ombrellone_salvia",
  "ombrellone_corallo",
  "ombrellone_1_lettini",
  "ombrellone_2_lettini",
  "ombrellone_3_lettini",
  "ombrellone_4_lettini",
  "ombrellone_2_sdraio",
  "ombrellone_2_sedie",
  "ombrellone_chiuso",
  "lettino",
  "lettino_orizzontale",
  "sdraio",
  "sedia_regista",
  "lettino_matrimoniale",
  "daybed",
  "gazebo",
  "gazebo_lettini",
  "gazebo_matrimoniale",
  "cabana",
  "passerella_verticale",
  "passerella_orizzontale",
  "passerella_angolo",
  "passerella_t",
  "passerella_croce",
  "passerella_curva",
  "passerella_terminale",
  "passerella_ingresso",
  "pedana_legno",
  "rampa_accessibile",
  "gradini",
  "pontile",
  "staccionata",
  "bar",
  "ristorante",
  "reception",
  "cassa",
  "deposito",
  "cabina",
  "cabina_spogliatoio",
  "cabina_accessibile",
  "cabine_multiple",
  "pergola",
  "piscina",
  "doccia",
  "doccia_doppia",
  "wc",
  "wc_accessibile",
  "lavapiedi",
  "primo_soccorso",
  "torretta_bagnino",
  "pattino_salvataggio",
  "gommone_salvataggio",
  "salvagente",
  "salvagente_palo",
  "boa",
  "bandiera",
  "kayak",
  "sup",
  "pedalo",
  "beach_volley",
  "beach_tennis",
  "beach_soccer",
  "area_giochi",
  "area_yoga",
  "area_massaggi",
  "tavolo_2_sedie",
  "tavolo_4_sedie",
  "tavolo_6_sedie",
  "panchina",
  "cestino",
  "illuminazione",
  "palma",
  "palma_piccola",
  "albero",
  "fioriera",
  "fioriera_rotonda",
  "fioriera_lunga",
  "sabbia",
  "mare",
  "linea_costa",
  "duna",
  "scoglio",
  "confine",
  "confine_tratteggiato",
  "zona_prenotabile",
  "zona_non_disponibile",
  "ingresso",
  "check_in",
  "punto_mappa",
  "non_disponibile",
  "parcheggio",
  "biciclette",
  "ombrellone_paglia",
  "tenda_righe",
  "ombrellone_quadrato",
  "ombrellone_tavolino",
  "amaca",
  "pouf",
  "dae",
  "sedia_job",
  "fontanella",
  "area_cani",
  "corridoio_lancio",
  "bandiera_mare",
  "rosa_venti"
] as const;

export type KitAssetId = (typeof KIT_ASSET_IDS)[number];

export interface KitAssetInfo {
  id: KitAssetId;
  type: 'bookable' | 'structure' | 'decoration';
  /** Modular walkway tile, repeated along the long side. */
  tile: boolean;
}

export const KIT_ASSETS: readonly KitAssetInfo[] = [
  {
    "id": "ombrellone_navy",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "ombrellone_sabbia",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "ombrellone_salvia",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "ombrellone_corallo",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "ombrellone_1_lettini",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "ombrellone_2_lettini",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "ombrellone_3_lettini",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "ombrellone_4_lettini",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "ombrellone_2_sdraio",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "ombrellone_2_sedie",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "ombrellone_chiuso",
    "type": "structure",
    "tile": false
  },
  {
    "id": "lettino",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "lettino_orizzontale",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "sdraio",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "sedia_regista",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "lettino_matrimoniale",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "daybed",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "gazebo",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "gazebo_lettini",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "gazebo_matrimoniale",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "cabana",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "passerella_verticale",
    "type": "structure",
    "tile": true
  },
  {
    "id": "passerella_orizzontale",
    "type": "structure",
    "tile": true
  },
  {
    "id": "passerella_angolo",
    "type": "structure",
    "tile": true
  },
  {
    "id": "passerella_t",
    "type": "structure",
    "tile": true
  },
  {
    "id": "passerella_croce",
    "type": "structure",
    "tile": true
  },
  {
    "id": "passerella_curva",
    "type": "structure",
    "tile": true
  },
  {
    "id": "passerella_terminale",
    "type": "structure",
    "tile": true
  },
  {
    "id": "passerella_ingresso",
    "type": "structure",
    "tile": true
  },
  {
    "id": "pedana_legno",
    "type": "structure",
    "tile": false
  },
  {
    "id": "rampa_accessibile",
    "type": "structure",
    "tile": false
  },
  {
    "id": "gradini",
    "type": "structure",
    "tile": false
  },
  {
    "id": "pontile",
    "type": "structure",
    "tile": false
  },
  {
    "id": "staccionata",
    "type": "structure",
    "tile": false
  },
  {
    "id": "bar",
    "type": "structure",
    "tile": false
  },
  {
    "id": "ristorante",
    "type": "structure",
    "tile": false
  },
  {
    "id": "reception",
    "type": "structure",
    "tile": false
  },
  {
    "id": "cassa",
    "type": "structure",
    "tile": false
  },
  {
    "id": "deposito",
    "type": "structure",
    "tile": false
  },
  {
    "id": "cabina",
    "type": "structure",
    "tile": false
  },
  {
    "id": "cabina_spogliatoio",
    "type": "structure",
    "tile": false
  },
  {
    "id": "cabina_accessibile",
    "type": "structure",
    "tile": false
  },
  {
    "id": "cabine_multiple",
    "type": "structure",
    "tile": false
  },
  {
    "id": "pergola",
    "type": "structure",
    "tile": false
  },
  {
    "id": "piscina",
    "type": "structure",
    "tile": false
  },
  {
    "id": "doccia",
    "type": "structure",
    "tile": false
  },
  {
    "id": "doccia_doppia",
    "type": "structure",
    "tile": false
  },
  {
    "id": "wc",
    "type": "structure",
    "tile": false
  },
  {
    "id": "wc_accessibile",
    "type": "structure",
    "tile": false
  },
  {
    "id": "lavapiedi",
    "type": "structure",
    "tile": false
  },
  {
    "id": "primo_soccorso",
    "type": "structure",
    "tile": false
  },
  {
    "id": "torretta_bagnino",
    "type": "structure",
    "tile": false
  },
  {
    "id": "pattino_salvataggio",
    "type": "structure",
    "tile": false
  },
  {
    "id": "gommone_salvataggio",
    "type": "structure",
    "tile": false
  },
  {
    "id": "salvagente",
    "type": "structure",
    "tile": false
  },
  {
    "id": "salvagente_palo",
    "type": "structure",
    "tile": false
  },
  {
    "id": "boa",
    "type": "structure",
    "tile": false
  },
  {
    "id": "bandiera",
    "type": "structure",
    "tile": false
  },
  {
    "id": "kayak",
    "type": "structure",
    "tile": false
  },
  {
    "id": "sup",
    "type": "structure",
    "tile": false
  },
  {
    "id": "pedalo",
    "type": "structure",
    "tile": false
  },
  {
    "id": "beach_volley",
    "type": "structure",
    "tile": false
  },
  {
    "id": "beach_tennis",
    "type": "structure",
    "tile": false
  },
  {
    "id": "beach_soccer",
    "type": "structure",
    "tile": false
  },
  {
    "id": "area_giochi",
    "type": "structure",
    "tile": false
  },
  {
    "id": "area_yoga",
    "type": "structure",
    "tile": false
  },
  {
    "id": "area_massaggi",
    "type": "structure",
    "tile": false
  },
  {
    "id": "tavolo_2_sedie",
    "type": "structure",
    "tile": false
  },
  {
    "id": "tavolo_4_sedie",
    "type": "structure",
    "tile": false
  },
  {
    "id": "tavolo_6_sedie",
    "type": "structure",
    "tile": false
  },
  {
    "id": "panchina",
    "type": "structure",
    "tile": false
  },
  {
    "id": "cestino",
    "type": "structure",
    "tile": false
  },
  {
    "id": "illuminazione",
    "type": "structure",
    "tile": false
  },
  {
    "id": "palma",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "palma_piccola",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "albero",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "fioriera",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "fioriera_rotonda",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "fioriera_lunga",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "sabbia",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "mare",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "linea_costa",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "duna",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "scoglio",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "confine",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "confine_tratteggiato",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "zona_prenotabile",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "zona_non_disponibile",
    "type": "decoration",
    "tile": false
  },
  {
    "id": "ingresso",
    "type": "structure",
    "tile": false
  },
  {
    "id": "check_in",
    "type": "structure",
    "tile": false
  },
  {
    "id": "punto_mappa",
    "type": "structure",
    "tile": false
  },
  {
    "id": "non_disponibile",
    "type": "structure",
    "tile": false
  },
  {
    "id": "parcheggio",
    "type": "structure",
    "tile": false
  },
  {
    "id": "biciclette",
    "type": "structure",
    "tile": false
  },
  {
    "id": "ombrellone_paglia",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "tenda_righe",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "ombrellone_quadrato",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "ombrellone_tavolino",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "amaca",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "pouf",
    "type": "bookable",
    "tile": false
  },
  {
    "id": "dae",
    "type": "structure",
    "tile": false
  },
  {
    "id": "sedia_job",
    "type": "structure",
    "tile": false
  },
  {
    "id": "fontanella",
    "type": "structure",
    "tile": false
  },
  {
    "id": "area_cani",
    "type": "structure",
    "tile": false
  },
  {
    "id": "corridoio_lancio",
    "type": "structure",
    "tile": false
  },
  {
    "id": "bandiera_mare",
    "type": "structure",
    "tile": false
  },
  {
    "id": "rosa_venti",
    "type": "structure",
    "tile": false
  }
];
