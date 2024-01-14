import ID, { IDType } from "../ID";
import BlockList from "../blocks/BlockList";
import config from "../config";

export type ChunkDataType = Uint8Array;

const CHUNK_HEIGHT_MAP_CACHE = new WeakMap<Chunk, Uint8Array>();
export default class Chunk {
  sharedData: SharedArrayBuffer;
  private data: ChunkDataType;

  id: IDType;

  currentPass: string = "unloaded";

  dirty = false;

  static readonly size = config.chunkSize;

  get position() {
    return ID.toChunkCoordinates(this.id);
  }

  get worldPosition() {
    return this.position.map((x) => x * Chunk.size) as [number, number, number];
  }

  constructor(id: IDType, data?: Uint8Array) {
    this.id = id;
    this.sharedData = new SharedArrayBuffer(Chunk.size ** 3);
    this.data = new Uint8Array(this.sharedData);

    if (data) {
      // store data using atomics
      for (let i = 0; i < data.length; i++) {
        Atomics.store(this.data, i, data[i]);
      }
    }
  }

  markDirty() {
    // queueMicrotask(() => {
    //   CHUNK_HEIGHT_MAP_CACHE.delete(this);
    //   this.generateHeightMap();
    // });

    // World.instance.updateChunkEvent(this);

    this.dirty = true;
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

  toLocalCoordinates(x: number, y: number, z: number) {
    return [
      x - this.worldPosition[0],
      y - this.worldPosition[1],
      z - this.worldPosition[2],
    ] as [number, number, number];
  }

  static computeBlockOffset(x: number, y: number, z: number) {
    if (
      x < 0 ||
      y < 0 ||
      z < 0 ||
      x >= Chunk.size ||
      y >= Chunk.size ||
      z >= Chunk.size
    ) {
      return -1;
    }

    function part1By2(n: number) {
      n &= 0x000003ff; // we only care about the first 10 bits
      n = (n ^ (n << 16)) & 0xff0000ff;
      n = (n ^ (n << 8)) & 0x0300f00f;
      n = (n ^ (n << 4)) & 0x030c30c3;
      n = (n ^ (n << 2)) & 0x09249249;
      return n;
    }

    return (part1By2(z) << 2) + (part1By2(y) << 1) + part1By2(x);
  }

  static indexToCoordinates(index: number) {
    function compactBy2(x: number) {
      x &= 0x09249249;
      x = (x ^ (x >> 2)) & 0x030c30c3;
      x = (x ^ (x >> 4)) & 0x0300f00f;
      x = (x ^ (x >> 8)) & 0xff0000ff;
      x = (x ^ (x >> 16)) & 0x000003ff;
      return x;
    }

    return [compactBy2(index), compactBy2(index >> 1), compactBy2(index >> 2)];
  }

  public setBlock(id: number | string, x: number, y: number, z: number) {
    const offset = Chunk.computeBlockOffset(x, y, z);

    if (offset === -1) return;

    const blockId = typeof id === "string" ? BlockList.getId(id) : id;
    Atomics.store(this.data, offset, blockId);
  }

  public getBlockId(x: number, y: number, z: number) {
    const offset = Chunk.computeBlockOffset(x, y, z);
    if (offset === -1) return 0;

    return Atomics.load(this.data, offset);
  }

  public getIndex(index: number) {
    return Atomics.load(this.data, index);
  }

  public setIndex(index: number, value: number) {
    Atomics.store(this.data, index, value);
  }

  public setChunkData(chunk: Chunk) {
    for (let i = 0; i < this.data.length; i++) {
      Atomics.store(this.data, i, chunk.getIndex(i));
    }
  }

  public getBlockIdentifier(x: number, y: number, z: number) {
    return BlockList.getById(this.getBlockId(x, y, z)).identifier;
  }

  public generateHeightMap() {
    if (CHUNK_HEIGHT_MAP_CACHE.has(this)) {
      return CHUNK_HEIGHT_MAP_CACHE.get(this)!;
    }

    const heightMap = this.updateHeightMap();

    return heightMap;
  }

  public getHeight(x: number, z: number) {
    const heightMap = CHUNK_HEIGHT_MAP_CACHE.get(this);

    if (heightMap && heightMap[z * Chunk.size + x] !== 0) {
      return heightMap[z * Chunk.size + x];
    }

    const newHeightMap = new Uint8Array(Chunk.size ** 2);

    for (let y = Chunk.size; y > 0; y--) {
      if (this.getBlockId(x, y, z) !== 0) {
        newHeightMap[z * Chunk.size + x] = y;
        return y;
      }
    }

    CHUNK_HEIGHT_MAP_CACHE.set(this, newHeightMap);

    return -1;
  }

  private updateHeightMap() {
    const heightMap = new Uint8Array(Chunk.size ** 2);

    if (!this.data.some((x) => x !== 0)) return heightMap;

    for (let x = 0; x < Chunk.size; x++) {
      for (let z = 0; z < Chunk.size; z++) {
        for (let y = Chunk.size; y > 0; y--) {
          if (this.getBlockId(x, y, z) !== 0) {
            heightMap[z * Chunk.size + x] = y + 1;
          }
        }
      }
    }

    CHUNK_HEIGHT_MAP_CACHE.set(this, heightMap);

    return heightMap;
  }
}
