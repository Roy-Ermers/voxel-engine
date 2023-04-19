import * as THREE from "three";
import tooloud, { Simplex } from "tooloud";
import config from "../../config.js";
import Thread from "../../threads/thread.js";
import Random from "../../utils/Random.js";
import BlockList from "../../blocks/BlockList.js";
import Chunk from "../../chunks/Chunk.js";

const { Simplex: simplex } = tooloud;

const decoration = ["pyramid", "structure_block", "small_block", "oak_log"];
export default class OverworldGenerator extends Thread implements OverworldGenerator {
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
  }

  private computeBlockOffset(x: number, y: number, z: number) {
    const voxelX = THREE.MathUtils.euclideanModulo(x, config.chunkSize) | 0;
    const voxelY = THREE.MathUtils.euclideanModulo(y, config.chunkSize) | 0;
    const voxelZ = THREE.MathUtils.euclideanModulo(z, config.chunkSize) | 0;

    return voxelY * config.chunkSize ** 2 + voxelZ * config.chunkSize + voxelX;
  }

  public generateChunk(chunkX: number, chunkY: number, chunkZ: number) {
    if (this.noise === undefined || this.random === undefined) {
      throw new Error("Generator not initialized.");
    }

    const chunk = new Chunk();

    for (let localX = 0; localX < config.chunkSize; localX++) {
      const x = localX + chunkX * config.chunkSize;

      for (let localZ = 0; localZ < config.chunkSize; localZ++) {
        const z = localZ + chunkZ * config.chunkSize;
        const mountains =
          Math.abs(this.noise(x / 200, z / 200, 100) ** 2) * 1024;
        const layerThickness = Math.abs(this.noise(x / 75, z / 75, 50)) * 7;
        const height = Math.floor(
          this.noise(x / 25, z / 25, 0) ** 2 * 64 + mountains
        );

        for (let localY = 0; localY < config.chunkSize; localY++) {
          const y = localY + chunkY * config.chunkSize;
          if (y === height + 1 && this.random() < 0.01) {
            chunk.setBlock(
              decoration[Math.floor(this.random() * decoration.length)],
              localX,
              localY,
              localZ
            );
          }

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
