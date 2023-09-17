import tooloud, { Worley } from "tooloud";
import SDF from "../../modelers/SDF";
import World from "../../storage/World";
import Random from "../../utils/Random";
import Chunk from "../Chunk";
import ChunkPass from "../ChunkPass";
const { Worley: worley } = tooloud;

export default class DecorationPass implements ChunkPass {
  initialize(world: World): void | Promise<void> {
    this.world = world;
  }

  readonly name = "decoration";

  world?: World;
  worleyNoise: Worley;
  constructor(private seed: number) {
    this.worleyNoise = worley.create(this.seed);
  }

  validate(chunk: Chunk): boolean {
    if (!this.world) throw new Error("World does not exist");

    return chunk.id === "0:0:0" || this.world.isChunkSurrounded(chunk.id);
  }

  async process(chunk: Chunk): Promise<void> {
    for (let x = 0; x < Chunk.size; x++) {
      for (let z = 0; z < Chunk.size; z++) {
        const y = chunk.getHeight(x, z);

        if (y <= 0) continue;

        const worldPosition = [
          x + chunk.worldPosition[0],
          y + chunk.worldPosition[1] + 1,
          z + chunk.worldPosition[2],
        ] as const;

        const distance = worley.Euclidean(
          worldPosition[0] * Chunk.size,
          worldPosition[1] * Chunk.size,
          worldPosition[2] * Chunk.size
        );

        const value = Math.min(...distance);

        if (value < 0.005 && this.world?.getBlock(worldPosition[0], worldPosition[1] - 1, worldPosition[2]) === "grass_block") {
          const seed = x + y + z;
          this.createTree(seed, ...worldPosition);
        }
      }
    }
  }

  createTree(seed: number, x: number, y: number, z: number) {
    if (!this.world) {
      throw new Error("World does not exist.");
    }

    const random = new Random(seed);
    const thrunkHeight = Math.floor(random() * 6 + 6);
    console.log(`Creating tree at ${x}, ${y}, ${z} of height ${thrunkHeight}`);

    for (let i = 0; i < thrunkHeight; i++) {
      this.world.setBlock("oak_log", x, y + i, z);
    }

    const leavesHeight = Math.floor(random() * 3 + 4);
    const leavesRadius = Math.floor(random() * 2 + 4);

    for (let localX = -leavesRadius; localX < leavesRadius; localX++) {
      for (let localZ = -leavesRadius; localZ < leavesRadius; localZ++) {
        for (let localY = 0; localY < leavesHeight; localY++) {
          const distance = SDF.cone(
            { x: localX, y: localY, z: localZ },
            leavesHeight,
            leavesRadius
          );
          if (distance <= 0) {
            this.world.setBlock(
              "leaves",
              x + localX,
              y + localY + thrunkHeight,
              z + localZ
            );
          }
        }
      }
    }
  }
}
