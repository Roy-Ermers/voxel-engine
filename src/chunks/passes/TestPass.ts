import Chunk from "../Chunk";
import ChunkPass from "../ChunkPass";

export default class TestPass implements ChunkPass {
  readonly name = "test";

  async initialize(): Promise<void> {}

  validate(chunk: Chunk): boolean {
    return chunk.currentPass === "unloaded";
  }

  async process(chunk: Chunk) {
    chunk.data.set([2], 16);
  }
}
