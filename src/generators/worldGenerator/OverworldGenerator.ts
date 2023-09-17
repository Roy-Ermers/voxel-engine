import tooloud, { Simplex } from "tooloud";
import BlockList from "../../blocks/BlockList.js";
import Chunk from "../../chunks/Chunk.js";
import Thread from "../../threads/Thread.js";
import Random from "../../utils/Random.js";
import WorldGenerator from "./WorldGenerator.js";

const { Simplex: simplex } = tooloud;

export default class OverworldGenerator
  extends Thread
  implements WorldGenerator
{
  random!: () => number;
  noise!: (x: number, y: number, z: number) => number;
  caveNoise!: Simplex;

  constructor() {
    super();
  }

  public async initialize(seed: number) {
    await BlockList.load();
    this.random = new Random(seed + seed);

    const noise = simplex.create(this.random());
    this.noise = noise.noise;
    this.caveNoise = simplex.create(this.random() * 2);

    this.log("Initialized OverworldGenerator");
  }

  public generateChunk(chunkX: number, chunkY: number, chunkZ: number) {
    if (this.noise === undefined || this.random === undefined) {
      throw new Error("Generator not initialized.");
    }

    const chunk = new Chunk("proto");

    for (let localX = 0; localX < Chunk.size; localX++) {
      const x = localX + chunkX * Chunk.size;

      for (let localZ = 0; localZ < Chunk.size; localZ++) {
        const z = localZ + chunkZ * Chunk.size;
        const mountains =
          Math.abs(this.noise(x / 200, z / 200, 100) ** 2) * 1024;
        const layerThickness = Math.abs(this.noise(x / 75, z / 75, 50)) * 7;
        const height = Math.floor(
          this.noise(x / 25, z / 25, 0) ** 2 * 64 + mountains
        );

        for (let localY = 0; localY < Chunk.size; localY++) {
          const y = localY + chunkY * Chunk.size;

          if (y > height) {
            continue;
          }

          if (y === height) {
            if (y < 72) chunk.setBlock("grass_block", localX, localY, localZ);
            else if (y < 128) {
              chunk.setBlock("stone", localX, localY, localZ);
            } else chunk.setBlock("snow", localX, localY, localZ);
            continue;
          }

          if (y > height - layerThickness) {
            if (y < 128) chunk.setBlock("dirt", localX, localY, localZ);
            else chunk.setBlock("snow", localX, localY, localZ);
            continue;
          }

          if (y < height - layerThickness) {
            chunk.setBlock("stone", localX, localY, localZ);
            continue;
          }
        }
      }
    }

    return chunk.data;
  }
}

if (self) new OverworldGenerator();
