import { Face } from "./Face";

export interface BlockModelPart {
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];

  textures: Record<string, string>;
}

export default interface BlockModelDefinition {
  name: string;

  /**
   * Extend an existing model.
   */
  extends?: {
    model: string;
    textures: Record<string, string>;
  };

  /**
   * Which adjacent faces should be culled?
   */
  cullFaces: Face[];

  /**
   * The textures used by this model.
   * this is just a list of texture names, not the actual textures.
   */
  textures: string[];

  /**
   * The parts of the block.
   */
  parts: BlockModelPart[];

  /**
   * Should the texture be locked to the UV grid?
   */
  uvLock?: boolean;
}
