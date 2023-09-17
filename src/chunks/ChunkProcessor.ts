import World from "../storage/World";
import Chunk from "./Chunk";
import ChunkPass from "./ChunkPass";

export default class ChunkProcessor {
  static DONE_PASS = "done";

  passIndex;

  constructor(private _world: World, private passes: ChunkPass[]) {
    this.passIndex = this.passes.map((pass) => pass.name);
  }

  async initialize() {
    for (const pass of this.passes) {
      await pass.initialize(this._world);
    }
  }

  async process(chunk: Chunk): Promise<boolean> {
    if (chunk.currentPass === ChunkProcessor.DONE_PASS) {
      return true;
    }

    let currentPass = this.passIndex.indexOf(chunk.currentPass);

    const nextPass = this.passes[currentPass + 1];
    if (!nextPass) {
      chunk.currentPass = ChunkProcessor.DONE_PASS;
      return true;
    }

    if (!nextPass.validate(chunk)) {
      return false;
    }

    try {
    await nextPass.process(chunk);
    } catch(e) {
      console.error(`Pass ${nextPass.name} failed on chunk ${chunk.id}`, e);
    }
    chunk.currentPass = nextPass.name;

    // change chunk pass to ChunkProcessor.DONE_PASS if this is the last pass
    if (currentPass === this.passIndex.length - 1) {
      chunk.currentPass = ChunkProcessor.DONE_PASS;
      return true;
    }

    return false;
  }
}
