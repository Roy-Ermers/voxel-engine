import { IDType } from "../ID";
import BlockList from "../blocks/BlockList";
import config from "../config";

export type ChunkData = Uint8Array;
export default class Chunk {
  data: ChunkData;

  constructor(data?: Uint8Array) {
    this.data = data ?? new Uint8Array(config.chunkSize ** 3);
  }
  [Symbol.species] = Array;

  [Symbol.iterator]() {
    return this.data[Symbol.iterator]();
  }

  /**
   * do a check to see if aabb is only test
   */
  checkBounds(
    position: [number, number],
    size: [number, number],
    test: string
  ) {
    const blockId = BlockList.getId(test);

    const [x, y] = position;
    const [w, h] = size;

    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        if (this.getBlockId(x + i, y + j, 0) !== blockId) return false;
      }
    }

    return true;
  }

  computeBlockOffset(x: number, y: number, z: number) {
    if (
      x < 0 ||
      y < 0 ||
      z < 0 ||
      x >= config.chunkSize ||
      y >= config.chunkSize ||
      z >= config.chunkSize
    ) {
      return -1;
    }

    const voxelX =
      ((x % config.chunkSize) + config.chunkSize) % config.chunkSize;
    const voxelY =
      ((y % config.chunkSize) + config.chunkSize) % config.chunkSize;
    const voxelZ =
      ((z % config.chunkSize) + config.chunkSize) % config.chunkSize;

    return voxelY * config.chunkSize ** 2 + voxelZ * config.chunkSize + voxelX;
  }

  indexToCoordinates(index: number) {
    const y = Math.floor(index / config.chunkSize ** 2);
    const z = Math.floor(
      (index - y * config.chunkSize ** 2) / config.chunkSize
    );
    const x = index - y * config.chunkSize ** 2 - z * config.chunkSize;

    return [x, y, z];
  }

  public setBlock(id: number | string, x: number, y: number, z: number) {
    const offset = this.computeBlockOffset(x, y, z);
    if (offset === -1) return;

    this.data[offset] = typeof id === "string" ? BlockList.getId(id) : id;
  }

  public getBlockId(x: number, y: number, z: number) {
    const offset = this.computeBlockOffset(x, y, z);
    if (offset === -1) return 0;

    return this.data[offset] ?? 0;
  }

  public getBlockIdentifier(x: number, y: number, z: number) {
    return BlockList.getById(this.getBlockId(x, y, z)).identifier;
  }
}
