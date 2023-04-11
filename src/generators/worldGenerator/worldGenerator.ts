import * as THREE from "three";
import tooloud, { Worley } from "tooloud";
import config from "../../config.js";
import Thread from "../../threads/thread.js";
import Random from "../../utils/Random";

const { Fractal, Worley: worley } = tooloud;

const biomes = [
  { ground: 14, depth: 7 }, // grass
  { ground: 4, depth: 5 }, // stone
  { ground: 3, depth: 3 }, // desert
  { ground: 7, depth: 7 }, // dirt
  { ground: 8, depth: 8 }, // dirt 2
];
export default class WorldGenerator extends Thread {
  random!: () => number;
  noise!: Worley;

  constructor() {
    super();
  }

  public initialize(seed: number) {
    this.random = new Random(seed + seed);

    this.noise = worley.create(this.random());
  }

  private computeBlockOffset(x: number, y: number, z: number) {
    const voxelX = THREE.MathUtils.euclideanModulo(x, config.chunkSize) | 0;
    const voxelY = THREE.MathUtils.euclideanModulo(y, config.chunkSize) | 0;
    const voxelZ = THREE.MathUtils.euclideanModulo(z, config.chunkSize) | 0;

    return voxelY * config.chunkSize ** 2 + voxelZ * config.chunkSize + voxelX;
  }

  public getChunkWorldCoordinates(id: string): [number, number, number] {
    return id.split(" ").map((x) => Number(x) * config.chunkSize) as [
      number,
      number,
      number
    ];
  }

  public generateChunk(chunkX: number, chunkY: number, chunkZ: number) {
    if (this.noise === undefined || this.random === undefined) {
      throw new Error("Generator not initialized.");
    }

    const chunk = new Uint8Array(config.chunkSize ** 3);

    const biome =
      biomes[
        Math.floor(
          this.noise.Euclidean(chunkX / 50, chunkY / 50, chunkZ / 50)[0] *
            (biomes.length - 1)
        )
      ];

    if (biome === undefined) {
      this.log(
        "Biome not found",
        chunkX,
        chunkY,
        chunkZ,
        Math.abs(
          this.noise.Euclidean(chunkX / 50, chunkY / 50, chunkZ / 50)[0]
        ) *
          (biomes.length - 1)
      );
      throw new Error("Biome not found");
    }

    for (let localX = 0; localX < config.chunkSize; localX++) {
      const x = localX + chunkX * config.chunkSize;

      for (let localZ = 0; localZ < config.chunkSize; localZ++) {
        const z = localZ + chunkZ * config.chunkSize;

        const riverNoise = this.noise.Euclidean(x / 50, 0, z / 50);
        const river = riverNoise[2] * riverNoise[0];

        const height =
          ((this.noise.Euclidean(x / 20, z / 20, 0)[0] * 10 - river * 100) /
            110) *
            config.hillSize -
          16;
        for (let localY = 0; localY < config.chunkSize; localY++) {
          const y = localY + chunkY * config.chunkSize;
          const offset = this.computeBlockOffset(localX, localY, localZ);

          if (y > height) continue;

          if (y == Math.floor(height)) chunk[offset] = biome.ground;
          else chunk[offset] = biome.depth;
        }
      }
    }

    return chunk;
  }
}

if (self)
    new WorldGenerator();