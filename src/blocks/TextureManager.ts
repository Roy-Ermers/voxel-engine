import config from "../config";
import atlasData from "../data/atlas/atlas.json";
import Atlas from "../types/Atlas";

const atlas = atlasData as unknown as Atlas;

export default class TextureManager {
  public static get tileSize() {
    return atlas.tileSize;
  }

  public static get atlasTileWidth() {
    return this.tileSize / atlas.size[0];
  }

  public static get atlasTileHeight() {
    return this.tileSize / atlas.size[1];
  }

  public static getPosition(name: string) {
    if (!atlas.textures[name])
      throw new Error(`Texture ${name} does not exist!`);

    const [x, y] = atlas.textures[name];

    return [x, y];
  }

  public static getUV(name: string) {
    if (!atlas.textures[name]) {
      return [0, 0, 1, 1];
      // throw new Error(`Texture ${name} does not exist!`);
    }

    const [x, y] = atlas.textures[name];
    const [atlasWidth, atlasHeight] = atlas.size;

    const u = x / atlasWidth;
    const v = 1 - y / atlasHeight;

    const u2 = (x + this.tileSize) / atlasWidth;
    const v2 = 1 - (y + this.tileSize) / atlasHeight;

    return [u, v, u2, v2];
  }

  /**
   * Get the UV coordinates for a specific rectangle on a texture
   */
  public static getBoxUV(
    name: string,
    position: [number, number],
    size: [number, number]
  ) {
    if (!atlas.textures[name])
      throw new Error(`Texture ${name} does not exist!`);

    const [x, y] = atlas.textures[name];
    const [atlasWidth, atlasHeight] = atlas.size;

    const [x2, y2] = position;
    const [width, height] = size;

    const u = (x + x2) / atlasWidth;
    const v = 1 - (y + y2) / atlasHeight;

    const u2 = (x + x2 + width) / atlasWidth;
    const v2 = 1 - (y + y2 + height) / atlasHeight;

    return [u, v, u2, v2];
  }
}
