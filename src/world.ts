import * as THREE from 'three';
import Mesher from "./chunks/Mesher";
import GreedyMesher from "./chunks/GreedyMesher.js?worker";
import config from "./config.js";
import Thread, { ThreadedContext } from "./threads/thread";
import Vector3 from "./types/Vector3.js";
import EventEmitter from "./utils/EventEmitter.js";
import ID, { IDType } from "./ID";
export default class World extends EventEmitter<"newchunk" | "generatechunk"> {
  private get chunkSliceSize() {
    return config.chunkSize ** 2;
  }

  private chunks = new Map<IDType, Uint8Array>();

  private meshes = new Map<IDType, THREE.Mesh>();

  private mesher!: ThreadedContext<Mesher>;

  constructor(private material: THREE.Material) {
    super();
  }

  public async create(atlasWidth: number, atlasHeight: number) {
    this.mesher = await Thread.create<Mesher>(
      new GreedyMesher(),
      atlasWidth,
      atlasHeight
    );
  }

  private computeBlockOffset(x: number, y: number, z: number) {
    const voxelX = THREE.MathUtils.euclideanModulo(x, config.chunkSize) | 0;
    const voxelY = THREE.MathUtils.euclideanModulo(y, config.chunkSize) | 0;
    const voxelZ = THREE.MathUtils.euclideanModulo(z, config.chunkSize) | 0;

    return voxelY * this.chunkSliceSize + voxelZ * config.chunkSize + voxelX;
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
    let id = x;

    if (typeof x === "number" && y !== undefined && z !== undefined) {
      id = ID.fromCoordinates(x, y, z);

      return this.chunks.has(id);
    }

    return this.chunks.has(id as IDType);
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
      chunk = new Uint8Array(config.chunkSize ** 3);
      this.chunks.set(id, chunk);

      this.emit("generatechunk", id);
    }

    return chunk;
  }

  setChunk(id: IDType, data: Uint8Array) {
    this.chunks.set(id, data);

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

    const offset = this.computeBlockOffset(x, y, z);

    chunk[offset] = id;

    chunk.set([id], offset);
  }

  getBlock(
    x: number,
    y: number,
    z: number,
    options?: { createNewChunk?: boolean }
  ) {
    const chunk = this.getChunk(x, y, z, options);

    if (chunk === undefined) return 0;

    const offset = this.computeBlockOffset(x, y, z);

    return chunk[offset];
  }

  public async generateChunkMesh(id: IDType, force?: boolean) {
    const existingMesh = this.meshes.get(id);
    if (!force && existingMesh) {
      return existingMesh;
    }
    const chunk = this.getChunk(...this.getChunkWorldCoordinates(id));

    if (!chunk) throw new Error("Can't generate ungenerated chunk.");

    const { positions, normals, uvs, indices } = await this.mesher.generate(
      new Uint8Array(chunk)
    );

    if (
      positions.length == 0 &&
      normals.length == 0 &&
      uvs.length == 0 &&
      indices.length == 0
    )
      return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(positions), 3)
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