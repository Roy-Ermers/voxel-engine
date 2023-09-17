import type OverworldGeneratorKeys from "../../generators/worldGenerator/OverworldGenerator";
import OverworldGenerator from "../../generators/worldGenerator/OverworldGenerator?worker";
import WorldGenerator from "../../generators/worldGenerator/WorldGenerator";
import Thread, { ThreadedContext } from "../../threads/Thread";
import Chunk from "../Chunk";
import ChunkPass from "../ChunkPass";

export default class TerrainPass implements ChunkPass {
  readonly name = "terrain";

  chunkGenerator!: ThreadedContext<WorldGenerator>;

  constructor(private seed: number) {}
  async initialize(): Promise<void> {
    this.chunkGenerator = await Thread.create<OverworldGeneratorKeys>(
      OverworldGenerator,
      this.seed
    );
  }

  validate(chunk: Chunk): boolean {
    return true;
  }

  async process(chunk: Chunk) {
    const data = await this.chunkGenerator.generateChunk(...chunk.position);

    for (let i = 0; i < data.length; i++) {
      if (chunk.data[i] === 0) chunk.data[i] = data[i];
    }
  }
}
