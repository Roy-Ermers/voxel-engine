type noiseFunction = (x: number, y: number, z: number) => number;
type seedFunction = (seed: number) => void;

declare module "tooloud" {
    export class Perlin {
        static noise: noiseFunction;
        static setSeed: seedFunction;

        noise: noiseFunction;
        setSeed: seedFunction;

        static create: (seed: number) => Perlin;
    }

    export class Simplex {
        static noise: noiseFunction;
        static setSeed: seedFunction;

        noise: noiseFunction;
        setSeed: seedFunction;
        static create: (seed: number) => Simplex;
    }

    export class Worley {
        Euclidean: (x: number, y: number, z: number) => [number, number, number];
        Manhattan: (x: number, y: number, z: number) => [number, number, number];
        setSeed: seedFunction;

        static Euclidean: (x: number, y: number, z: number) => [number, number, number];
        static Manhattan: (x: number, y: number, z: number) => [number, number, number];
        static setSeed: seedFunction;

        static create: (seed: number) => Worley;
    }

    export class Fractal {
        static noise(x: number, y: number, z: number, octaves: number, noiseFunction: noiseFunction): number;
    }

    export default class Tooloud {
        static Perlin: typeof Perlin;
        static Simplex: typeof Simplex;
        static Worley: typeof Worley;
        static Fractal: typeof Fractal;
    }
}