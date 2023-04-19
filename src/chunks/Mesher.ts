import Chunk, { ChunkData } from "./Chunk";

export default interface Mesher {
  generate(
    data: ChunkData,
    resolution?: number
  ): Promise<{
    vertices: number[];
    normals: number[];
    uvs: number[];
    indices: number[];
  }>;
}
