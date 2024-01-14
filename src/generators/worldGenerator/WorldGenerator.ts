import Chunk from "../../chunks/Chunk";

export default interface WorldGenerator {
  generateChunk(chunkX: number, chunkY: number, chunkZ: number): Chunk;
}
