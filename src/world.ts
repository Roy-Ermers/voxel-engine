import * as THREE from 'three';
import config from "./config.js";
import Vector3 from "./types/Vector3.js";
import EventEmitter from "./utils/EventEmitter.js";

export default class World extends EventEmitter<"newchunk" | "generatechunk"> {
    public get chunkSize() {
        return config.chunkSize;
    }

    private get chunkSliceSize() {
        return this.chunkSize ** 2;
    }

    private chunks = new Map<string, Uint8Array>();

    private meshes = new Map<string, THREE.Mesh>();

    private _tileSize: number = 16;

    private static faces = [
        { // left
            uvRow: 0,
            dir: [-1, 0, 0,],
            corners: [
                { pos: [0, 1, 0], uv: [0, 1], },
                { pos: [0, 0, 0], uv: [0, 0], },
                { pos: [0, 1, 1], uv: [1, 1], },
                { pos: [0, 0, 1], uv: [1, 0], },
            ],
        },
        { // right
            uvRow: 0,
            dir: [1, 0, 0,],
            corners: [
                { pos: [1, 1, 1], uv: [0, 1], },
                { pos: [1, 0, 1], uv: [0, 0], },
                { pos: [1, 1, 0], uv: [1, 1], },
                { pos: [1, 0, 0], uv: [1, 0], },
            ],
        },
        { // bottom
            uvRow: 1,
            dir: [0, -1, 0,],
            corners: [
                { pos: [1, 0, 1], uv: [1, 0], },
                { pos: [0, 0, 1], uv: [0, 0], },
                { pos: [1, 0, 0], uv: [1, 1], },
                { pos: [0, 0, 0], uv: [0, 1], },
            ],
        },
        { // top
            uvRow: 2,
            dir: [0, 1, 0,],
            corners: [
                { pos: [0, 1, 1], uv: [1, 1], },
                { pos: [1, 1, 1], uv: [0, 1], },
                { pos: [0, 1, 0], uv: [1, 0], },
                { pos: [1, 1, 0], uv: [0, 0], },
            ],
        },
        { // back
            uvRow: 0,
            dir: [0, 0, -1,],
            corners: [
                { pos: [1, 0, 0], uv: [0, 0], },
                { pos: [0, 0, 0], uv: [1, 0], },
                { pos: [1, 1, 0], uv: [0, 1], },
                { pos: [0, 1, 0], uv: [1, 1], },
            ],
        },
        { // front
            uvRow: 0,
            dir: [0, 0, 1,],
            corners: [
                { pos: [0, 0, 1], uv: [0, 0], },
                { pos: [1, 0, 1], uv: [1, 0], },
                { pos: [0, 1, 1], uv: [0, 1], },
                { pos: [1, 1, 1], uv: [1, 1], },
            ],
        },
    ];

    constructor(private atlasWidth: number, private atlasHeight: number, private material: THREE.Material) { super(); }

    private computeBlockOffset(x: number, y: number, z: number) {
        const voxelX = THREE.MathUtils.euclideanModulo(x, this.chunkSize) | 0;
        const voxelY = THREE.MathUtils.euclideanModulo(y, this.chunkSize) | 0;
        const voxelZ = THREE.MathUtils.euclideanModulo(z, this.chunkSize) | 0;

        return voxelY * this.chunkSliceSize + voxelZ * this.chunkSize + voxelX;
    }

    getChunkID(x: number, y: number, z: number) {
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkY = Math.floor(y / this.chunkSize);
        const chunkZ = Math.floor(z / this.chunkSize);

        return `${chunkX} ${chunkY} ${chunkZ}`;
    }

    public getChunkWorldCoordinates(id: string): [number, number, number] {
        return id.split(' ').map(x => Number(x) * this.chunkSize) as [number, number, number];
    }

    hasChunk(x: number, y: number, z: number): boolean;
    hasChunk(id: string): boolean;
    hasChunk(x: number | string, y?: number, z?: number): boolean {
        let id = x;

        if (y !== undefined && z !== undefined)
            id = `${x} ${y} ${z}`;

        return this.chunks.has(id);
    }

    getChunk(x: number, y: number, z: number, options?: { createNewChunk?: boolean; }) {
        const id = this.getChunkID(x, y, z);

        let chunk = this.chunks.get(id);

        if (chunk === undefined && options?.createNewChunk !== false) {
            chunk = new Uint8Array(this.chunkSize ** 3);
            this.chunks.set(id, chunk);

            this.emit("generatechunk", id);
        }

        return chunk;
    }

    setChunk(id: string, data: Uint8Array) {
        this.chunks.set(id, data);

        this.emit("newchunk", id);
    }

    setBlock(x: number, y: number, z: number, id: number, options?: { createNewChunk?: boolean; }) {
        const chunk = this.getChunk(x, y, z, options);

        if (chunk == undefined)
            throw new Error("Chunk isn't initialized yet.");

        const offset = this.computeBlockOffset(x, y, z);

        chunk[offset] = id;

        chunk.set([id], offset);
    }

    getBlock(x: number, y: number, z: number, options?: { createNewChunk?: boolean; }) {
        const chunk = this.getChunk(x, y, z, options);

        if (chunk === undefined)
            return 0;

        const offset = this.computeBlockOffset(x, y, z);

        return chunk[offset];
    }

    public generateChunkMesh(id: string, force?: boolean) {
        const existingMesh = this.meshes.get(id);
        if (!force && existingMesh) {
            return existingMesh;
        }

        const [startX, startY, startZ] = this.getChunkWorldCoordinates(id);
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        for (let y = 0; y < this.chunkSize; y++) {
            const voxelY = startY + y;
            for (let z = 0; z < this.chunkSize; z++) {
                const voxelZ = startZ + z;
                for (let x = 0; x < this.chunkSize; x++) {
                    const voxelX = startX + x;
                    const voxel = this.getBlock(voxelX, voxelY, voxelZ, { createNewChunk: false });
                    if (voxel) {
                        // voxel 0 is sky (empty) so for UVs we start at 0
                        const uvVoxel = voxel - 1;
                        // There is a voxel here but do we need faces for it?
                        for (const { dir, corners, uvRow } of World.faces) {

                            const neighbor = this.getBlock(
                                voxelX + dir[0],
                                voxelY + dir[1],
                                voxelZ + dir[2], { createNewChunk: false });

                            if (!neighbor) {
                                // this voxel has no neighbor in this direction so we need a face.
                                const ndx = positions.length / 3;
                                for (const { pos, uv } of corners) {
                                    positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
                                    normals.push(...dir);
                                    uvs.push(
                                        (uvVoxel + uv[0]) * this._tileSize / this.atlasWidth,
                                        1 - (uvRow + 1 - uv[1]) * this._tileSize / this.atlasHeight);
                                }
                                indices.push(
                                    ndx, ndx + 1, ndx + 2,
                                    ndx + 2, ndx + 1, ndx + 3,
                                );
                            }
                        }
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
        geometry.setIndex(indices);
        geometry.computeBoundingSphere();

        const mesh = new THREE.Mesh(geometry, this.material);
        mesh.name = id;
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

        const stepX = (dx > 0) ? 1 : -1;
        const stepY = (dy > 0) ? 1 : -1;
        const stepZ = (dz > 0) ? 1 : -1;

        const txDelta = Math.abs(1 / dx);
        const tyDelta = Math.abs(1 / dy);
        const tzDelta = Math.abs(1 / dz);

        const xDist = (stepX > 0) ? (ix + 1 - start.x) : (start.x - ix);
        const yDist = (stepY > 0) ? (iy + 1 - start.y) : (start.y - iy);
        const zDist = (stepZ > 0) ? (iz + 1 - start.z) : (start.z - iz);

        // location of nearest voxel boundary, in units of t
        let txMax = (txDelta < Infinity) ? txDelta * xDist : Infinity;
        let tyMax = (tyDelta < Infinity) ? tyDelta * yDist : Infinity;
        let tzMax = (tzDelta < Infinity) ? tzDelta * zDist : Infinity;

        let steppedIndex = -1;

        while (t <= length) {
            const voxel = this.getBlock(ix, iy, iz);
            if (voxel != 0) {
                return {
                    position: [
                        start.x + t * dx,
                        start.y + t * dy,
                        start.z + t * dz,
                    ],
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