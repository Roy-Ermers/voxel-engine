import * as THREE from "three";
import config from "../../config.js";
import Thread from "../../threads/thread.js";
import SimplexNoise from "../../utils/SimplexNoise.js";

export default class WorldGenerator extends Thread {
    noise: SimplexNoise;

    constructor() {
        super();
        this.noise = new SimplexNoise();
    }

    private computeBlockOffset(x: number, y: number, z: number) {
        const voxelX = THREE.MathUtils.euclideanModulo(x, config.chunkSize) | 0;
        const voxelY = THREE.MathUtils.euclideanModulo(y, config.chunkSize) | 0;
        const voxelZ = THREE.MathUtils.euclideanModulo(z, config.chunkSize) | 0;

        return voxelY * (config.chunkSize ** 2) + voxelZ * config.chunkSize + voxelX;
    }

    public getChunkWorldCoordinates(id: string): [number, number, number] {
        return id.split(' ').map(x => Number(x) * config.chunkSize) as [number, number, number];
    }

    public generateChunk(chunkX: number, chunkY: number, chunkZ: number) {
        const chunk = new Uint8Array(config.chunkSize ** 3);

        let blocksSet = 0;
        for (let localX = 0; localX < config.chunkSize; localX++) {
            const x = localX + chunkX * config.chunkSize;

            for (let localZ = 0; localZ < config.chunkSize; localZ++) {
                const z = localZ + chunkZ * config.chunkSize;

                const height = Math.round(Math.abs(this.noise.get2D(x / 100, z / 100) * config.hillSize));

                for (let localY = 0; localY < config.chunkSize; localY++) {
                    const y = localY + chunkY * config.chunkSize;

                    if (y > height)
                        continue;

                    const offset = this.computeBlockOffset(localX, localY, localZ);

                    chunk[offset] = 14;
                    blocksSet++;
                }
            }
        }

        return chunk;
    }

}

if (self)
    new WorldGenerator();