import Thread from "../threads/Thread";
import Mesh from "../types/Mesh";
import Chunk from "./Chunk";

export default interface ChunkMesher extends Thread {
  generate(data: Chunk, resolution?: number): Promise<Mesh>;
}
