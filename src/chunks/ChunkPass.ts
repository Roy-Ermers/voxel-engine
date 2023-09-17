import World from "../storage/World";
import Chunk from "./Chunk";

export default interface ChunkPass {
  readonly name: string;

  initialize(world: World): Promise<void> | void;

  validate(chunk: Chunk): boolean;

  process(chunk: Chunk): Promise<void> | void;
}
