import ID, { IDType } from "../ID";
import BlockList from "../blocks/BlockList";
import Chunk from "../chunks/Chunk";
import { ChunkMeshManager } from "../chunks/ChunkMeshManager";
import ChunkProcessor from "../chunks/ChunkProcessor";
import type GreedyMesherType from "../chunks/GreedyMesher.js";
import GreedyMesher from "../chunks/GreedyMesher.js?worker";
import DecorationPass from "../chunks/passes/DecorationPass";
import TerrainPass from "../chunks/passes/TerrainPass";
import config from "../config";
import Proxy from "../threads/Proxy";
import Thread, { ThreadedContext } from "../threads/Thread";
import Mesh from "../types/Mesh";

let _instance: World;

export default class World extends Thread<ChunkMeshManager> {
  public static get instance() {
    return _instance;
  }

  private visibleChunks = new Set<IDType>();
  private meshedChunks = new Map<IDType, Mesh>();
  private stagedChunks = new Set<IDType>();
  /* private */ chunks = new Map<IDType, Chunk>();

  private mesher!: ThreadedContext<GreedyMesherType>;
  private meshManager!: Proxy<ChunkMeshManager>;
  private chunkProcessor!: ChunkProcessor;

  constructor() {
    super();
    if (_instance) {
      throw new Error("World already exists");
    }

    console.trace("Creating world", self.name, location.toString());

    _instance = this;
  }

  async initialize(meshManager: Proxy<ChunkMeshManager>, seed: number = 0) {
    await BlockList.load();
    this.chunkProcessor = new ChunkProcessor(this, [
      new TerrainPass(seed),
      new DecorationPass(seed),
    ]);

    await this.chunkProcessor.initialize();

    try {
      this.mesher = await Thread.create<GreedyMesherType>(GreedyMesher);
    } catch {
      console.error("Mesher failed to initialize.");
    }
    this.meshManager = meshManager;
  }

  getStatus() {
    return {
      stagedChunks: [...this.stagedChunks],
      chunks: [...this.chunks.keys()],
      visibleChunks: [...this.visibleChunks],
      meshedChunks: this.meshedChunks.size,
      dirtyChunks: [...this.chunks.values()].filter((c) => c.dirty).length,
    };
  }

  generateSpawn() {
    this.log("Creating spawn");

    const radius = 3;
    const diameter = radius * 2;
    for (let x = 0; x < diameter; x++) {
      for (let z = 0; z < diameter; z++) {
        for (let y = diameter; y > 0; y--) {
          this.stagedChunks.add(
            ID.fromChunkCoordinates(x - radius, y - radius, z - radius)
          );
        }
      }
    }
  }

  /**
   * Fetches a chunk from the world. If no chunk exists at the given coordinates, it will create a new one.
   *
   * @param x The x-coordinate of the chunk.
   * @param y The y-coordinate of the chunk.
   * @param z The z-coordinate of the chunk.
   * @returns The chunk at the given coordinates.
   */
  private getOrCreateChunk(x: number, y: number, z: number): Chunk;

  /**
   * Fetches a chunk from the world. If no chunk exists at the given ID, it will create a new one.
   *
   * @param id The ID of the chunk.
   * @returns The chunk at the given coordinates.
   */
  private getOrCreateChunk(id: IDType): Chunk;

  /**
   * Fetches a chunk from the world. If no chunk exists at the given coordinates, it will create a new one. If the given
   * parameter is an ID, it will use that as the ID of the chunk.
   *
   * @param x The x-coordinate of the chunk, or the ID of the chunk.
   * @param y The y-coordinate of the chunk.
   * @param z The z-coordinate of the chunk.
   * @returns The chunk at the given coordinates.
   */
  private getOrCreateChunk(x: IDType | number, y?: number, z?: number): Chunk {
    let id: IDType;

    if (typeof x === "number" && y !== undefined && z !== undefined) {
      id = ID.fromCoordinates(x, y, z);
    } else {
      id = x as IDType;
    }

    let chunk = this.chunks.get(id);

    if (chunk === undefined) {
      chunk = new Chunk(id);
      this.chunks.set(id, chunk);
    }

    return chunk;
  }

  /**
   * Sets the block at the given coordinates to the given block ID.
   *
   * @param id The ID of the block to set.
   * @param x The x-coordinate of the block.
   * @param y The y-coordinate of the block.
   * @param z The z-coordinate of the block.
   */
  public setBlock(id: number | string, x: number, y: number, z: number) {
    const chunk = this.getOrCreateChunk(x, y, z);

    chunk.setBlock(id, ...chunk.toLocalCoordinates(x, y, z));
    chunk.markDirty();
  }

  /**
   * Gets the block ID of the block at the given coordinates.
   *
   * @param x The x-coordinate of the block.
   * @param y The y-coordinate of the block.
   * @param z The z-coordinate of the block.
   * @returns The block ID of the block at the given coordinates.
   */
  public getBlockId(x: number, y: number, z: number) {
    const chunk = this.getOrCreateChunk(x, y, z);

    return chunk.getBlockId(x, y, z);
  }

  /**
   * Gets the block identifier of the block at the given coordinates.
   *
   * @param x The x-coordinate of the block.
   * @param y The y-coordinate of the block.
   * @param z The z-coordinate of the block.
   * @returns The block identifier of the block at the given coordinates.
   */
  public getBlock(
    x: number,
    y: number,
    z: number,
    { createNewChunks } = { createNewChunks: true }
  ) {
    if (createNewChunks) {
      const chunk = this.getOrCreateChunk(x, y, z);

      return chunk.getBlockIdentifier(x, y, z);
    } else {
      const chunk = this.getChunk(x, y, z);

      if (chunk === undefined) return "air";

      return chunk.getBlockIdentifier(x, y, z);
    }
  }

  /**
   * Gets the chunk at the given coordinates.
   * @param x The x-coordinate of the chunk.
   * @param y The y-coordinate of the chunk.
   * @param z The z-coordinate of the chunk.
   * @returns The chunk at the given coordinates.
   */
  private getChunk(x: number, y: number, z: number): Chunk | undefined;
  /**
   * Gets the chunk at the given ID.
   * @param id The ID of the chunk.
   * @returns The chunk at the given ID.
   */
  private getChunk(id: IDType): Chunk | undefined;
  private getChunk(
    x: IDType | number,
    y?: number,
    z?: number
  ): Chunk | undefined {
    let id: IDType;

    if (typeof x === "number" && y !== undefined && z !== undefined) {
      id = ID.fromCoordinates(x, y, z);
    } else {
      id = x as IDType;
    }

    return this.chunks.get(id);
  }

  public isChunkSurrounded(id: IDType) {
    const [x, y, z] = ID.toChunkCoordinates(id);

    if (
      this.chunks.has(ID.fromChunkCoordinates(x + 1, y, z)) &&
      this.chunks.has(ID.fromChunkCoordinates(x - 1, y, z)) &&
      this.chunks.has(ID.fromChunkCoordinates(x, y + 1, z)) &&
      this.chunks.has(ID.fromChunkCoordinates(x, y - 1, z)) &&
      this.chunks.has(ID.fromChunkCoordinates(x, y, z + 1)) &&
      this.chunks.has(ID.fromChunkCoordinates(x, y, z - 1))
    )
      return true;

    return false;
  }

  /**
   * Cast a ray from the given coordinates in the given direction.
   * and returns the first block that is hit.
   * @param x The x-coordinate of the ray.
   * @param y The y-coordinate of the ray.
   * @param z The z-coordinate of the ray.
   * @param angleX The x-component of the direction of the ray in radians.
   * @param angleY The y-component of the direction of the ray in radians.
   * @param angleZ The z-component of the direction of the ray in radians.
   * @param options Options for the ray.
   * @param options.ignore A list of block IDs to ignore. Defaults to `["air"]`.
   * @param options.maxDistance The maximum distance the ray can travel. Defaults to `16`.
   * @returns The first block that is hit by the ray.
   */
  public castRay(
    x: number,
    y: number,
    z: number,
    angleX: number,
    angleY: number,
    angleZ: number,
    options?: { ignore?: string[]; maxDistance?: number }
  ) {
    let { ignore = ["air"], maxDistance = 16 } = options ?? {};

    let t = 0;

    const stepX = Math.sign(angleX);
    const stepY = Math.sign(angleY);
    const stepZ = Math.sign(angleZ);

    let tMaxX = stepX > 0 ? Math.ceil(x) - x : x - Math.floor(x);
    let tMaxY = stepY > 0 ? Math.ceil(y) - y : y - Math.floor(y);
    let tMaxZ = stepZ > 0 ? Math.ceil(z) - z : z - Math.floor(z);

    const tDeltaX = stepX / angleX;
    const tDeltaY = stepY / angleY;
    const tDeltaZ = stepZ / angleZ;

    maxDistance /= Math.sqrt(angleX ** 2 + angleY ** 2 + angleZ ** 2);

    while (t <= maxDistance) {
      const position = [
        Math.floor(x + t * angleX),
        Math.floor(y + t * angleY),
        Math.floor(z + t * angleZ),
      ] as const;
      const voxel = this.getBlock(...position, { createNewChunks: false });

      if (!ignore.includes(voxel)) {
        return { position, voxel };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          t = tMaxX;
          tMaxX += tDeltaX;
        } else {
          t = tMaxZ;
          tMaxZ += tDeltaZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          t = tMaxY;
          tMaxY += tDeltaY;
        } else {
          t = tMaxZ;
          tMaxZ += tDeltaZ;
        }
      }
    }

    return null;
  }

  public async generateChunkMesh(id: IDType): Promise<Mesh>;
  public async generateChunkMesh(chunk: Chunk): Promise<Mesh>;
  public async generateChunkMesh(chunk: IDType | Chunk): Promise<Mesh> {
    if (typeof chunk === "string") {
      chunk = this.getOrCreateChunk(chunk);
    }

    if (this.meshedChunks.has(chunk.id)) {
      console.log("[mesher] getting mesh from cache", chunk.id);
      return this.meshedChunks.get(chunk.id)!;
    }

    const mesh = await this.mesher.generate(chunk);
    this.meshedChunks.set(chunk.id, mesh);

    return mesh;
  }

  private async createChunkMesh(id: IDType): Promise<void>;
  private async createChunkMesh(chunk: Chunk): Promise<void>;
  private async createChunkMesh(chunk: Chunk | IDType) {
    chunk = typeof chunk === "string" ? this.getOrCreateChunk(chunk) : chunk;

    const mesh = await this.generateChunkMesh(chunk);
    this.meshManager.call("addChunk", chunk, mesh);
  }

  async updateChunkEvent(id: IDType): Promise<void>;
  async updateChunkEvent(chunk: Chunk): Promise<void>;
  async updateChunkEvent(chunk: Chunk | IDType) {
    chunk = typeof chunk === "string" ? this.getOrCreateChunk(chunk) : chunk;

    this.meshedChunks.delete(chunk.id);

    const mesh = await this.generateChunkMesh(chunk);
    console.log("Updated chunk mesh", chunk.id);

    this.meshManager.call("updateChunk", chunk, mesh);
  }

  private _processingChunks = false;

  public async processChunks() {
    if (this._processingChunks) return;

    this._processingChunks = true;

    const chunks = [...this.stagedChunks];
    for (const chunkId of chunks) {
      const chunk = this.getOrCreateChunk(chunkId);

      if (chunk.currentPass === ChunkProcessor.DONE_PASS) {
        continue;
      }

      const done = await this.chunkProcessor.process(chunk);

      if (!done) {
        continue;
      }

      this.stagedChunks.delete(chunkId);
      this.visibleChunks.add(chunkId);

      this.createChunkMesh(chunk);
    }

    for (const chunkId of this.visibleChunks) {
      const chunk = this.getChunk(chunkId);
      if (!chunk || !chunk.dirty) {
        continue;
      }

      this.updateChunkEvent(chunk);
      chunk.dirty = false;
    }

    this._processingChunks = false;
  }

  public onPlayerMove(x: number, y: number, z: number) {
    if (1 === 1) return;
    const renderDistance = Math.ceil(config.renderDistance / 2);
    // If the player has moved to a new chunk, we need to load the surrounding chunks.
    for (let offsetX = -renderDistance; offsetX <= renderDistance; offsetX++) {
      for (
        let offsetY = renderDistance;
        offsetY >= -renderDistance;
        offsetY--
      ) {
        for (
          let offsetZ = -renderDistance;
          offsetZ <= renderDistance;
          offsetZ++
        ) {
          const chunkID = ID.fromCoordinates(
            x + offsetX * Chunk.size,
            y + offsetY * Chunk.size,
            z + offsetZ * Chunk.size
          );

          if (!this.chunks.has(chunkID) && !this.stagedChunks.has(chunkID))
            this.stagedChunks.add(chunkID);
        }
      }
    }

    // remove all chunks out of render distance
    for (const [chunkID, chunk] of this.chunks) {
      const [chunkX, chunkY, chunkZ] = ID.toChunkCoordinates(chunkID);

      if (
        Math.abs(chunkX * Chunk.size - x) / Chunk.size > renderDistance ||
        Math.abs(chunkY * Chunk.size - y) / Chunk.size > renderDistance ||
        Math.abs(chunkZ * Chunk.size - z) / Chunk.size > renderDistance
      ) {
        this.visibleChunks.delete(chunkID);
        this.meshManager.call("removeChunk", chunkID);
      }
    }
  }
}

if (import.meta.url.includes("worker_file")) new World();
