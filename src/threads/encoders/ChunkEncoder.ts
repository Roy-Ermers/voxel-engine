import Chunk from "../../chunks/Chunk";
import Encoder from "../Encoder";

export default class ChunkEncoder implements Encoder<Chunk> {
  encode(data: Chunk) {
    return {
      shared: [],
      data: {
        id: data.id,
        data: data.sharedData,
        dirty: data.dirty,
        currentPass: data.currentPass,
      }
    };
  }

  decode(data: ReturnType<this["encode"]>["data"], shared: ReturnType<this["encode"]>["shared"]): Chunk {
    const chunk = new Chunk(data.id, new Uint8Array(data.data));

    chunk.currentPass = data.currentPass;

    if (data.dirty) {
      chunk.markDirty();
    }

    return chunk;
  }

  canEncode(data: any): boolean {
    return data instanceof Chunk;
  }
}
