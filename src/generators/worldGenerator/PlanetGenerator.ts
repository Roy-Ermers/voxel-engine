import tooloud from "tooloud";
import BlockList from "../../blocks/BlockList";
import Chunk from "../../chunks/Chunk";
import config from "../../config";
import Thread from "../../threads/Thread";
import Random from "../../utils/Random";
import WorldGenerator from "./WorldGenerator";

export default class PlanetGenerator extends Thread implements WorldGenerator {
  random!: () => number;
  worley!: (x: number, y: number, z: number) => [number, number, number];

  constructor() {
    super();
  }

  async initialize(seed: number) {
    await BlockList.load();
    this.random = new Random(seed + seed);
    this.worley = tooloud.Worley.create(this.random()).Euclidean;
  }
  generateChunk(chunkX: number, chunkY: number, chunkZ: number): Uint8Array {
    const chunk = new Chunk();

    for (let localX = 0; localX < config.chunkSize; localX++) {
      const x = localX + chunkX * config.chunkSize;

      for (let localZ = 0; localZ < config.chunkSize; localZ++) {
        const z = localZ + chunkZ * config.chunkSize;

        for (let localY = 0; localY < config.chunkSize; localY++) {
          const y = localY + chunkY * config.chunkSize;
          const value = this.worley(x / 50, y / 50, z / 50);

          if (value[0] < 0.1) {
            chunk.setBlock("grass_block", localX, localY, localZ);
          }
        }
      }
    }

    return chunk.data;
  }
}

if (self) new PlanetGenerator();
