import config from "../config";
import Thread from "../threads/thread";
import Mesher from "./Mesher";
import BlockModelManager from "../blocks/BlockModelManager";
import Chunk, { ChunkData } from "./Chunk";
import { FACES, FACE_OPPOSITE_MAP, Face } from "../types/Face";
import BlockList from "../blocks/BlockList";

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

export default class GreedyMesher extends Thread implements Mesher {
  constructor() {
    super();
  }

  protected async initialize(cullMap: Map<number, Face[]>) {
    await BlockList.load();

    CULLED_FACE_MAP = new Map<number, number[]>(
      [...cullMap.entries()].map(([key, faces]) => [
        key,
        faces.map((x) => FACES.indexOf(x)),
      ])
    );
  }

  public async generate(data: ChunkData, resolution: number = 1) {
    const chunk = new Chunk(data);
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let y = 0; y < config.chunkSize; y += resolution) {
      for (let z = 0; z < config.chunkSize; z += resolution) {
        for (let x = 0; x < config.chunkSize; x += resolution) {
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
              ...model.uvs.slice(
                faceIndex * UVSlice,
                faceIndex * UVSlice + UVSlice
              )
            );

            indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
          }
        }
      }
    }

    return { vertices, normals, uvs, indices };
  }
}

if (self) new GreedyMesher();
