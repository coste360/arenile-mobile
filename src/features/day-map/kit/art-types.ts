// Shape of the generated kit art (scripts/gen-map-kits.mjs).

/** react-native-svg props of one element; a colour is `none` or `$<beach token>`. */
export type KitProps = Readonly<Record<string, string | number>>;

/** One SVG element: tag, props, children (or the text of a <text>). */
export type KitNode = readonly [
  tag: string,
  props: KitProps,
  children: readonly KitNode[] | string,
];

/** Element trees of every asset of a kit, in its 120 x 120 viewBox. */
export type KitArt = Readonly<Record<string, readonly KitNode[]>>;
