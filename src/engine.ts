import * as THREE from "three";
import { Mesh } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass";
import config from "./config";
import FlyControls from './controllers/flyControls';
import WorldGenerator from "./generators/worldGenerator/worldGenerator";
import Thread, { ThreadedContext } from "./threads/thread";
import KeyboardState from "./utils/keyboardState";
import World from "./world.js";
export default class Game {
    public get scene() {
        return this._scene;
    }

    public get camera() {
        return this._camera;
    }

    public get world() {
        return this._world!;
    }

    public get controller() {
        return this._controls!;
    }
    public get keyboard() {
        return this._keyboard;
    }

    private _scene: THREE.Scene;
    private _camera: THREE.PerspectiveCamera;
    private _renderer: THREE.WebGLRenderer;
    private _controls: FlyControls;
    private _keyboard: KeyboardState;

    private _sun?: THREE.DirectionalLight;
    private _ambientLight?: THREE.AmbientLight;

    private _world?: World;
    private _material?: THREE.Material;

    private _composer?: EffectComposer;
    private _generatorWorker?: ThreadedContext<WorldGenerator>;

    private currentChunk = '';
    private currentChunks: Set<string> = new Set();

    constructor() {
        this._scene = new THREE.Scene();

        this._scene.background = new THREE.Color('skyblue');

        //@ts-ignore
        window.scene = this._scene;

        this._camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this._camera.position.z = 2;
        this._camera.position.y = 64;

        this._renderer = new THREE.WebGLRenderer();

        this._renderer.setSize(window.innerWidth, window.innerHeight);

        document.body.appendChild(this._renderer.domElement);


        this._keyboard = new KeyboardState();

        this._controls = new FlyControls(this._camera, this._keyboard, this._renderer.domElement);

        window.addEventListener("resize", this.resizeViewport);
    }

    async load() {
        this.createLight();
        await this.loadAssets();
        await this.createGenerator();

        this.renderChunks(0, 0, 0);
    }

    private createAO() {
        this._composer = new EffectComposer(this._renderer);
        const ssaoPass = new SSAOPass(this.scene, this.camera, this._renderer.domElement.width, this._renderer.domElement.height);
        this._composer.addPass(ssaoPass);
    }

    private createLight() {
        this._sun = new THREE.DirectionalLight(0xffffff, 1);
        this._sun.position.set(-1, -1, -1);

        this._ambientLight = new THREE.AmbientLight(0xffffff, 0.5);

        this.scene.add(this._sun);
        this.scene.add(this._ambientLight);
    }

    private async createGenerator() {
        this._generatorWorker = await Thread.create<WorldGenerator>("js/generators/worldGenerator/worldGenerator.js");
        console.log("generator loaded");
    }

    private async loadAssets() {
        const { width, height, texture } = await this.loadAtlas();

        this._material = new THREE.MeshLambertMaterial({
            map: texture,
            side: THREE.DoubleSide,
            alphaTest: 0.1,
            transparent: true,
        });

        this._world = new World(width, height, this._material);

        this._world.addEventListener("newchunk", id => this.addChunk(id));
        this._world.addEventListener("generatechunk", id => this.generateChunk(id));

    }

    private async loadAtlas() {
        const loader = new THREE.TextureLoader();

        const texture = await loader.loadAsync("/assets/atlas.png"); //comments
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;

        return { texture, width: texture.image.naturalWidth, height: texture.image.naturalHeight };
    }

    public async generateChunk(id: string) {
        const chunk = await this._generatorWorker!.generateChunk(...this.idToCoordinates(id));

        this.world.setChunk(id, chunk);

        return chunk;
    }

    public async enqueueChunk(id: string) {
        if (this.currentChunks.has(id))
            return;

        if (!this.world)
            throw new Error("World is not defined.");

        if (!this.world.hasChunk(id))
            await this.generateChunk(id);

        this.addChunk(id);
    }

    public addChunk(id: string) {
        const mesh = this.world.generateChunkMesh(id);
        mesh.position.set(...this.world.getChunkWorldCoordinates(id));

        this.scene.add(mesh);


        this.currentChunks.add(id);
    }

    public disposeChunk(id: string) {
        console.log("removing chunk " + id);

        if (!this.currentChunks.delete(id))
            throw new Error("Can't remove chunk that is not rendered.");
        let obj = this.scene.getObjectByName(id);
        let count = 0;
        while (obj) {
            let mesh = obj as Mesh;
            mesh.clear();
            mesh.geometry.dispose();

            if (!Array.isArray(mesh!.material))
                mesh.material.dispose();


            this.scene.remove(mesh);
            count++;
            obj = this.scene.getObjectByName(id);
        }

        console.log(count);

    }

    public resizeViewport() {
        this._camera.aspect = window.innerWidth / window.innerHeight;
        this._camera.updateProjectionMatrix();
        this._renderer.setSize(window.innerWidth, window.innerHeight);

        this.render();
    }

    private worldToChunkCoordinates(x: number, y: number, z: number) {
        const chunkX = Math.floor(x / config.chunkSize);
        const chunkY = Math.floor(y / config.chunkSize);
        const chunkZ = Math.floor(z / config.chunkSize);

        return `${chunkX} ${chunkY} ${chunkZ}`;
    }

    private idToCoordinates(id: string) {
        return id.split(' ').map(x => Number(x)) as [number, number, number];
    }

    public renderChunks(x: number, y: number, z: number) {
        console.log("rendering chunks", x, y, z);
        const distance = Math.floor(config.renderDistance / 2);
        let ids: string[] = [];

        for (let chunkX = x - distance; chunkX < x + distance; chunkX++)
            for (let chunkY = y - distance; chunkY < y + distance; chunkY++)
                for (let chunkZ = z - distance; chunkZ < z + distance; chunkZ++)
                    ids.push(`${chunkX} ${chunkY} ${chunkZ}`);


        for (const id of ids) {
            if (!this.currentChunks.has(id))
                this.enqueueChunk(id);
        }

        for (const id of [...this.currentChunks].filter(x => !ids.includes(x)))
            this.disposeChunk(id);
    }

    public render() {
        this._renderer.render(this.scene, this.camera);
        this._composer?.render(1);

        this.controller.update(1);

        const playerChunk = this.worldToChunkCoordinates(this.camera.position.x, this.camera.position.y, this.camera.position.z);

        if (playerChunk != this.currentChunk)
            this.renderChunks(...this.idToCoordinates(playerChunk));

        this.currentChunk = playerChunk;


        requestAnimationFrame(() => this.render());
    }
}

const game = new Game();
// @ts-ignore
window.game = game;
game.load()
    .then(() => {
        console.log("Game is loaded.");
        game.render();
    });
