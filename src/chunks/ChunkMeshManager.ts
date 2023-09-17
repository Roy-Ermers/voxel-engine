import { IDType } from "../ID";
import Mesh from "../types/Mesh";
import Chunk from "./Chunk";

export interface ChunkMeshManager {
  addChunk(chunk: Chunk, mesh: Mesh): void;
  updateChunk(chunk: Chunk, mesh: Mesh): void;
  removeChunk(chunk: IDType): void;
}
