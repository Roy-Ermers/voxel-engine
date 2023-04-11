import config from "./config";

export type IDType = string;

export default class ID {
  static fromChunkCoordinates(x: number, y: number, z: number): IDType {
    return `${x}:${y}:${z}`;
  }

  static fromCoordinates(x: number, y: number, z: number): IDType {
    const chunkX = Math.floor(x / config.chunkSize);
    const chunkY = Math.floor(y / config.chunkSize);
    const chunkZ = Math.floor(z / config.chunkSize);

    return this.fromChunkCoordinates(chunkX, chunkY, chunkZ);
  }

  static toChunkCoordinates(id: IDType): [number, number, number] {
    const [x, y, z] = id.split(":").map((x) => Number(x));

    return [x, y, z];
  }
}
