import * as THREE from 'three';
import ID, { IDType } from "./ID";
import Chunk, { ChunkDataType } from "./chunks/Chunk";
import ChunkMesher from "./chunks/ChunkMesher";
import GreedyMesher from "./chunks/GreedyMesher.js?worker";
import config from "./config.js";
import Thread, { ThreadedContext } from "./threads/Thread";
import { Face } from "./types/Face";
import Vector3 from "./types/Vector3.js";
import EventEmitter from "./utils/EventEmitter.js";
export default class World extends EventEmitter<"newchunk" | "generatechunk"> {
  private get chunkSliceSize() {
    return config.chunkSize ** 2;
  }

  private chunks = new Map<IDType, Chunk>();

  private meshes = new Map<IDType, THREE.Mesh>();

  private mesher!: ThreadedContext<ChunkMesher>;

  constructor(private material: THREE.Material) {
    super();
  }

  public async create(cullMap: Map<number, Face[]>) {
    this.mesher = await Thread.create<ChunkMesher>(GreedyMesher, cullMap);
  }

  public getChunkWorldCoordinates(id: IDType): [number, number, number] {
    return ID.toChunkCoordinates(id).map((x) => x * config.chunkSize) as [
      number,
      number,
      number
    ];
  }

  hasChunk(x: number, y: number, z: number): boolean;
  hasChunk(id: IDType): boolean;
  hasChunk(x: IDType | number, y?: number, z?: number): boolean {
    if (typeof x === "number" && y !== undefined && z !== undefined) {
      return this.chunks.has(ID.fromCoordinates(x, y, z));
    }

    return this.chunks.has(x as IDType);
  }

  getChunk(
    x: number,
    y: number,
    z: number,
    options?: { createNewChunk?: boolean }
  ) {
    const id = ID.fromCoordinates(x, y, z);

    let chunk = this.chunks.get(id);

    if (chunk === undefined && options?.createNewChunk !== false) {
      chunk = new Chunk(id);
      this.chunks.set(id, chunk);

      this.emit("generatechunk", id);
    }

    return chunk;
  }

  setChunk(id: IDType, data: Chunk | ChunkDataType) {
    const chunk = data instanceof Chunk ? data : new Chunk(id, data);
    this.chunks.set(id, chunk);

    this.emit("newchunk", id);
  }

  setBlock(
    x: number,
    y: number,
    z: number,
    id: number,
    options?: { createNewChunk?: boolean }
  ) {
    const chunk = this.getChunk(x, y, z, options);

    if (chunk == undefined) throw new Error("Chunk isn't initialized yet.");

    chunk.setBlock(id, x, y, z);
  }

  getBlock(
    x: number,
    y: number,
    z: number,
    options?: { createNewChunk?: boolean }
  ) {
    const chunk = this.getChunk(x, y, z, options);

    if (chunk === undefined) return 0;

    return chunk.getBlockId(x, y, z);
  }

  public async generateChunkMesh(id: IDType, force?: boolean) {
    const existingMesh = this.meshes.get(id);
    if (!force && existingMesh) {
      return existingMesh;
    }
    const chunk = this.getChunk(...this.getChunkWorldCoordinates(id));

    if (!chunk) throw new Error("Can't generate ungenerated chunk.");

    const { vertices, normals, uvs, indices } = await this.mesher.generate(
      chunk
    );

    if (
      vertices.length == 0 &&
      normals.length == 0 &&
      uvs.length == 0 &&
      indices.length == 0
    )
      return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(vertices), 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(normals), 3)
    );
    geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array(uvs), 2)
    );
    geometry.setIndex(indices);
    // geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.name = id.toString();
    this.meshes.set(id, mesh);

    return mesh;
  }

  castRay(start: Vector3, end: Vector3) {
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    let dz = end.z - start.z;

    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    dx /= length;
    dy /= length;
    dz /= length;

    let t = 0.0;
    let ix = Math.floor(start.x);
    let iy = Math.floor(start.y);
    let iz = Math.floor(start.z);

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;

    const txDelta = Math.abs(1 / dx);
    const tyDelta = Math.abs(1 / dy);
    const tzDelta = Math.abs(1 / dz);

    const xDist = stepX > 0 ? ix + 1 - start.x : start.x - ix;
    const yDist = stepY > 0 ? iy + 1 - start.y : start.y - iy;
    const zDist = stepZ > 0 ? iz + 1 - start.z : start.z - iz;

    // location of nearest voxel boundary, in units of t
    let txMax = txDelta < Infinity ? txDelta * xDist : Infinity;
    let tyMax = tyDelta < Infinity ? tyDelta * yDist : Infinity;
    let tzMax = tzDelta < Infinity ? tzDelta * zDist : Infinity;

    let steppedIndex = -1;

    while (t <= length) {
      const voxel = this.getBlock(ix, iy, iz);
      if (voxel != 0) {
        return {
          position: [start.x + t * dx, start.y + t * dy, start.z + t * dz],
          normal: [
            steppedIndex === 0 ? -stepX : 0,
            steppedIndex === 1 ? -stepY : 0,
            steppedIndex === 2 ? -stepZ : 0,
          ],
          voxel,
        };
      }

      // advance t to next nearest voxel boundary
      if (txMax < tyMax) {
        if (txMax < tzMax) {
          ix += stepX;
          t = txMax;
          txMax += txDelta;
          steppedIndex = 0;
        } else {
          iz += stepZ;
          t = tzMax;
          tzMax += tzDelta;
          steppedIndex = 2;
        }
      } else {
        if (tyMax < tzMax) {
          iy += stepY;
          t = tyMax;
          tyMax += tyDelta;
          steppedIndex = 1;
        } else {
          iz += stepZ;
          t = tzMax;
          tzMax += tzDelta;
          steppedIndex = 2;
        }
      }
    }
    return null;
  }
}
