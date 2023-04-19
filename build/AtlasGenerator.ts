import glob from "fast-glob";
import config from "../src/config.js";
import { createCanvas, loadImage } from "canvas";
import { createWriteStream } from "fs";
import Atlas from "../src/types/Atlas.js";
import { basename, extname, join, resolve } from "path";
import { mkdir, writeFile } from "fs/promises";
import { fileURLToPath } from "url";

const ATLAS_TEXTURE_DIRECTORY = "./public/atlas";
const ATLAS_METADATA_DIRECTORY = "./src/data/atlas";

export interface AtlasGeneratorOptions {
  /**
   * Size of the textures in pixels.
   */
  tileSize?: number;
  /**
   * Name of the atlas.
   * This will be used for the atlas texture and metadata.
   * Defaults to "atlas".
   * @default "atlas"
   */
  atlasName?: string;
  /**
   * Input glob.
   */
  input?: string;
}

export default class AtlasGenerator {
  static async generateAtlas(options: AtlasGeneratorOptions = {}) {
    const input = options.input ?? "./assets/textures/*.{png,jpg}";
    const files = await glob(input);

    const atlasTextureDirectory = resolve(
      join(fileURLToPath(import.meta.url), "../../", ATLAS_TEXTURE_DIRECTORY)
    );
    const atlasMetaDataDirectory = resolve(
      join(fileURLToPath(import.meta.url), "../../", ATLAS_METADATA_DIRECTORY)
    );

    const name = options.atlasName ?? "atlas";

    const optimalWidth = Math.ceil(Math.sqrt(files.length));
    const optimalHeight = Math.ceil(files.length / optimalWidth);

    const tileSize = options.tileSize ?? 16;

    const atlas: Atlas = {
      size: [optimalWidth * tileSize, optimalHeight * tileSize],

      tileSize,

      textures: {},
    };

    const canvas = createCanvas(
      optimalWidth * tileSize,
      optimalHeight * tileSize
    );

    const ctx = canvas.getContext("2d");

    for (const file of files) {
      const image = await loadImage(file);
      const index = files.indexOf(file);
      const x = index % optimalWidth;
      const y = Math.floor(index / optimalWidth);

      atlas.textures[basename(file, extname(file))] = [
        x * tileSize,
        y * tileSize,
      ];

      ctx.drawImage(
        image,
        0,
        0,
        tileSize,
        tileSize,
        x * tileSize,
        y * tileSize,
        tileSize,
        tileSize
      );
    }

    await mkdir(atlasTextureDirectory, { recursive: true });
    await mkdir(atlasMetaDataDirectory, { recursive: true });

    canvas
      .createPNGStream()
      .pipe(createWriteStream(join(atlasTextureDirectory, `./${name}.png`)));

    await writeFile(
      join(atlasMetaDataDirectory, `./${name}.json`),
      JSON.stringify(atlas, null, 4)
    );

    console.log(
      `generated atlas ${name} to ${atlasMetaDataDirectory} and ${atlasTextureDirectory}`
    );
  }
}

await AtlasGenerator.generateAtlas();
