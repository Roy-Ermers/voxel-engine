import * as THREE from "three";
import config from "../config";
import Thread from "../threads/thread";
import Mesher from "./Mesher";

export default class GreedyMesher extends Thread implements Mesher {
  private atlasWidth: number = 0;
  private atlasHeight: number = 0;

  private computeBlockOffset(x: number, y: number, z: number) {
    // if coordinates are outside of the chunk, return -1
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

    const voxelX = THREE.MathUtils.euclideanModulo(x, config.chunkSize) | 0;
    const voxelY = THREE.MathUtils.euclideanModulo(y, config.chunkSize) | 0;
    const voxelZ = THREE.MathUtils.euclideanModulo(z, config.chunkSize) | 0;

    return voxelY * config.chunkSize ** 2 + voxelZ * config.chunkSize + voxelX;
  }

  private getBlock(data: Uint8Array, x: number, y: number, z: number) {
    const offset = this.computeBlockOffset(x, y, z);
    if (offset === -1) return 0;

    return data[offset] ?? 0;
  }

  constructor() {
    super();
  }

  protected initialize(atlasWidth: number, atlasHeight: number) {
    this.atlasWidth = atlasWidth;
    this.atlasHeight = atlasHeight;
  }

  public generate(data: Uint8Array, resolution: number = 1) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let y = 0; y < config.chunkSize; y++) {
      for (let z = 0; z < config.chunkSize; z++) {
        for (let x = 0; x < config.chunkSize; x++) {
          const voxel = this.getBlock(data, x, y, z);
          if (!voxel) {
            continue;
          }

          // voxel 0 is sky (empty) so for UVs we start at 0
          const uvVoxel = voxel - 1;
          // There is a voxel here but do we need faces for it?
          for (const { dir, corners, uvRow } of GreedyMesher.faces) {
            const neighbor = this.getBlock(
              data,
              x + dir[0],
              y + dir[1],
              z + dir[2]
            );

            if (neighbor) {
              continue;
            }

            // this voxel has no neighbor in this direction so we need a face.
            const ndx = positions.length / 3;
            for (const { pos, uv } of corners) {
              positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
              normals.push(...dir);
              uvs.push(
                ((uvVoxel + uv[0]) * config.textureSize) / this.atlasWidth,
                1 -
                  ((uvRow + 1 - uv[1]) * config.textureSize) / this.atlasHeight
              );
            }
            indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
          }
        }
      }
    }
    return { positions, normals, uvs, indices };
  }

  private static faces = [
    {
      // left
      uvRow: 0,
      dir: [-1, 0, 0],
      corners: [
        { pos: [0, 1, 0], uv: [0, 1] },
        { pos: [0, 0, 0], uv: [0, 0] },
        { pos: [0, 1, 1], uv: [1, 1] },
        { pos: [0, 0, 1], uv: [1, 0] },
      ],
    },
    {
      // right
      uvRow: 0,
      dir: [1, 0, 0],
      corners: [
        { pos: [1, 1, 1], uv: [0, 1] },
        { pos: [1, 0, 1], uv: [0, 0] },
        { pos: [1, 1, 0], uv: [1, 1] },
        { pos: [1, 0, 0], uv: [1, 0] },
      ],
    },
    {
      // bottom
      uvRow: 1,
      dir: [0, -1, 0],
      corners: [
        { pos: [1, 0, 1], uv: [1, 0] },
        { pos: [0, 0, 1], uv: [0, 0] },
        { pos: [1, 0, 0], uv: [1, 1] },
        { pos: [0, 0, 0], uv: [0, 1] },
      ],
    },
    {
      // top
      uvRow: 2,
      dir: [0, 1, 0],
      corners: [
        { pos: [0, 1, 1], uv: [1, 1] },
        { pos: [1, 1, 1], uv: [0, 1] },
        { pos: [0, 1, 0], uv: [1, 0] },
        { pos: [1, 1, 0], uv: [0, 0] },
      ],
    },
    {
      // back
      uvRow: 0,
      dir: [0, 0, -1],
      corners: [
        { pos: [1, 0, 0], uv: [0, 0] },
        { pos: [0, 0, 0], uv: [1, 0] },
        { pos: [1, 1, 0], uv: [0, 1] },
        { pos: [0, 1, 0], uv: [1, 1] },
      ],
    },
    {
      // front
      uvRow: 0,
      dir: [0, 0, 1],
      corners: [
        { pos: [0, 0, 1], uv: [0, 0] },
        { pos: [1, 0, 1], uv: [1, 0] },
        { pos: [0, 1, 1], uv: [0, 1] },
        { pos: [1, 1, 1], uv: [1, 1] },
      ],
    },
  ];
}

if (self) new GreedyMesher();
