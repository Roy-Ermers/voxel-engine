import BlockList from "../blocks/BlockList";
import BlockModelManager from "../blocks/BlockModelManager";
import Thread from "../threads/Thread";
import { FACES, FACE_OPPOSITE_MAP, Face } from "../types/Face";
import Chunk from "./Chunk";
import ChunkMesher from "./ChunkMesher";

const FACE_OFFSET = {
  front: [0, 0, -1],
  back: [0, 0, 1],
  top: [0, 1, 0],
  bottom: [0, -1, 0],
  right: [1, 0, 0],
  left: [-1, 0, 0],
} as Record<Face, [number, number, number]>;

const FACE_VERTICES: Record<Face, number[]> = {
  front: [
    //bottom right
    1, 0, 0,
    //bottom left
    0, 0, 0,
    //top right
    1, 1, 0,
    //top left
    0, 1, 0,
  ],
  back: [
    //bottom left
    0, 0, 1,
    //bottom right
    1, 0, 1,
    //top left
    0, 1, 1,
    //top right
    1, 1, 1,
  ],
  top: [
    //bottom left
    0, 1, 1,
    //bottom right
    1, 1, 1,
    //top left
    0, 1, 0,
    //top right
    1, 1, 0,
  ],
  bottom: [
    //bottom right
    1, 0, 1,
    //bottom left
    0, 0, 1,
    //top right
    1, 0, 0,
    //top left
    0, 0, 0,
  ],
  right: [
    //top right
    1, 1, 1,
    //bottom right
    1, 0, 1,
    //top left
    1, 1, 0,
    //bottom left
    1, 0, 0,
  ],
  left: [
    //top left
    0, 1, 0,
    //bottom left
    0, 0, 0,
    //top right
    0, 1, 1,
    //bottom right
    0, 0, 1,
  ],
};

const FACE_NORMALS: Record<Face, number[]> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  top: [0, 1, 0],
  bottom: [0, -1, 0],
  right: [1, 0, 0],
  left: [-1, 0, 0],
};

let CULLED_FACE_MAP = new Map<number, number[]>();

export default class GreedyMesher extends Thread implements ChunkMesher {
  constructor() {
    super();
  }

  async generateCullmap() {
    for (const block of BlockList) {
      const model = await BlockModelManager.generateBlockModel(block);

      CULLED_FACE_MAP.set(
        block.id,
        model.cullFaces.map((x) => FACES.indexOf(x))
      );
    }
  }

  async initialize() {
    this.log("Loading block models...");

    await BlockList.load();
    await this.generateCullmap();

    this.log("Done!");
  }

  public async generate(chunk: Chunk, resolution: number = 1) {
    performance.mark(`meshing-chunk-${chunk.id}-start`);
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let m = 0; m < Chunk.size ** 3; m += resolution) {
      const [x, y, z] = Chunk.indexToCoordinates(m);
      const voxel = chunk.getBlockId(x, y, z);

      if (voxel === -1 || voxel === 0) {
        continue;
      }

      const model = await BlockModelManager.generateMesh(voxel);

      if (!CULLED_FACE_MAP.has(voxel)) {
        CULLED_FACE_MAP.set(
          voxel,
          model.cullFaces.map((x) => FACES.indexOf(x))
        );
      }

      if (!model.isCube) {
        const index = vertices.length / 3;
        vertices.push(
          ...model.vertices.map((vert, i) => {
            if (i % 3 === 0) {
              return vert + x;
            } else if (i % 3 === 1) {
              return vert + y;
            } else {
              return vert + z;
            }
          })
        );
        normals.push(...model.normals);
        uvs.push(...model.uvs);
        indices.push(...model.indices.map((x) => x + index));
        continue;
      }

      for (const face of FACES) {
        const faceIndex = FACES.indexOf(face);
        const faceOpposite = FACE_OPPOSITE_MAP[face];
        const offset = FACE_OFFSET[face];

        const neighbor = chunk.getBlockId(
          x + offset[0] * resolution,
          y + offset[1] * resolution,
          z + offset[2] * resolution
        );

        if (CULLED_FACE_MAP.get(neighbor)?.includes(faceOpposite)) {
          continue;
        }

        const ndx = vertices.length / 3;
        const faceVertices = FACE_VERTICES[face].map((vert, i) => {
          if (i % 3 === 0) {
            return vert * resolution + x;
          } else if (i % 3 === 1) {
            return vert * resolution + y;
          } else {
            return vert * resolution + z;
          }
        });

        vertices.push(...faceVertices);

        normals.push(
          ...FACE_NORMALS[face],
          ...FACE_NORMALS[face],
          ...FACE_NORMALS[face],
          ...FACE_NORMALS[face]
        );

        const UVSlice = model.uvs.length / FACES.length;
        uvs.push(
          ...model.uvs.slice(faceIndex * UVSlice, faceIndex * UVSlice + UVSlice)
        );

        indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
      }
    }

    performance.mark(`meshing-chunk-${chunk.id}-end`);
    performance.measure(
      `meshing-${chunk.id}`,
      `meshing-chunk-${chunk.id}-start`,
      `meshing-chunk-${chunk.id}-end`
    );
    return { vertices, normals, uvs, indices };
  }
}

if (self) new GreedyMesher();
