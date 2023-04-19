export default interface Atlas {
  /**
   * Size of the atlas in pixels.
   */
  size: [number, number];

  /**
   * Size of the textures in pixels.
   * All textures in the atlas must be the same size.
   */
  tileSize: number;

  /**
   * Position of the texture in the atlas.
   */
  textures: Record<string, [number, number]>;
}
