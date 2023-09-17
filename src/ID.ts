import Chunk from "./chunks/Chunk";

export type IDType = string;

export default class ID {
  static fromChunkCoordinates(x: number, y: number, z: number): IDType {
    return `${x}:${y}:${z}`;
  }

  static fromCoordinates(x: number, y: number, z: number): IDType {
    const chunkX = Math.floor(x / Chunk.size);
    const chunkY = Math.floor(y / Chunk.size);
    const chunkZ = Math.floor(z / Chunk.size);

    return this.fromChunkCoordinates(chunkX, chunkY, chunkZ);
  }

  static toChunkCoordinates(id: IDType): [number, number, number] {
    const [x, y, z] = id.split(":").map((x) => Number(x));

    return [x, y, z];
  }
}
