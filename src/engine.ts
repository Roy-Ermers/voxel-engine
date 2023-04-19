import * as THREE from "three";
import { Mesh } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass";
import config from "./config";
import FlyControls from "./controllers/flyControls";
import type WorldGeneratorKeys from "./generators/worldGenerator/OverworldGenerator";
import WorldGenerator from "./generators/worldGenerator/OverworldGenerator.js?worker";
import Thread, { ThreadedContext } from "./threads/thread";
import KeyboardState from "./utils/keyboardState";
import World from "./world.js";
import ID, { IDType } from "./ID";
import BlockList from "./blocks/BlockList";
import BlockModelManager from "./blocks/BlockModelManager";
import TextureManager from "./blocks/TextureManager";
import { Face } from "./types/Face";
import Gradient from "./colors/Gradient";
import Color from "./colors/Color";

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
  private _generatorWorker?: ThreadedContext<WorldGeneratorKeys>;

  private currentChunk: IDType = "";
  private currentChunks: Set<IDType> = new Set();

  private skyGradient = new Gradient(new Color(0x000000), new Color(0x0280be));

  constructor() {
    this._scene = new THREE.Scene();

    this._scene.background = new THREE.Color(0x0280be);

    //@ts-ignore
    window.scene = this._scene;

    this._camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this._renderer = new THREE.WebGLRenderer();

    this._renderer.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this._renderer.domElement);

    this._keyboard = new KeyboardState();

    this._controls = new FlyControls(
      this._camera,
      this._keyboard,
      this._renderer.domElement
    );

    window.addEventListener("resize", () => this.resizeViewport());
  }

  async load() {
    this.createLight();
    await BlockList.load();
    await this.loadAssets();
    await this.createGenerator();
    // this.createAO();

    // const blockModel = await ModelParser.generateMeshByIdentifier("pyramid");

    // const geometry = new THREE.BufferGeometry();
    // geometry.setAttribute(
    //   "position",
    //   new THREE.BufferAttribute(new Float32Array(blockModel.vertices), 3)
    // );
    // geometry.setAttribute(
    //   "normal",
    //   new THREE.BufferAttribute(new Float32Array(blockModel.normals), 3)
    // );
    // geometry.setAttribute(
    //   "uv",
    //   new THREE.BufferAttribute(new Float32Array(blockModel.uvs), 2)
    // );
    // geometry.setIndex(blockModel.indices);

    // const mesh = new THREE.Mesh(geometry, this._material);
    // mesh.position.set(-0.5, -0.5, 2.5);

    // this.scene.add(mesh);
  }

  private createAO() {
    this._composer = new EffectComposer(this._renderer);
    const ssaoPass = new SSAOPass(
      this.scene,
      this.camera,
      this._renderer.domElement.width,
      this._renderer.domElement.height
    );

    const renderPass = new RenderPass(this._scene, this._camera);
    this._composer.addPass(renderPass);

    this._composer.addPass(ssaoPass);
  }

  private createLight() {
    this._sun = new THREE.DirectionalLight(0xffffff, 1);
    this._sun.position.set(-0.5, 0.5, -0.5);
    this._sun.castShadow = true;

    this._ambientLight = new THREE.AmbientLight(0xffffff, 0.4);

    this.scene.add(this._sun);
    this.scene.add(this._ambientLight);
  }

  private async createGenerator() {
    this._generatorWorker = await Thread.create<WorldGeneratorKeys>(
      new WorldGenerator(),
      1
    );
    console.log("generator loaded");
  }

  private async loadAssets() {
    const { texture } = await this.loadAtlas();

    this._material = new THREE.MeshLambertMaterial({
      map: texture,
      side: THREE.FrontSide,
      alphaTest: 0.5,
      // wireframe: true,
    });

    this._world = new World(this._material);

    const cullMap = new Map<number, Face[]>();

    for (const block of BlockList) {
      const model = await BlockModelManager.generateBlockModel(block.id);

      cullMap.set(block.id, model.cullFaces);
    }

    await this._world.create(cullMap);
    this._world.addEventListener("newchunk", (id) => this.addChunk(id));
    this._world.addEventListener("generatechunk", (id) =>
      this.generateChunk(id)
    );
  }

  private async loadAtlas() {
    const loader = new THREE.TextureLoader();

    const texture = await loader.loadAsync("./atlas/atlas.png");
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    return {
      texture,
      width: texture.image.naturalWidth,
      height: texture.image.naturalHeight,
    };
  }

  public async generateChunk(id: IDType) {
    const chunk = await this._generatorWorker!.generateChunk(
      ...ID.toChunkCoordinates(id)
    );

    this.world.setChunk(id, chunk);

    return chunk;
  }

  public async enqueueChunk(id: IDType) {
    if (this.currentChunks.has(id)) return;

    if (!this.world) throw new Error("World is not defined.");

    if (!this.world.hasChunk(id)) return await this.generateChunk(id);

    this.addChunk(id);
  }

  public async addChunk(id: IDType) {
    const mesh = await this.world.generateChunkMesh(id);
    this.currentChunks.add(id);

    // mesh is empty, so we can save computing power
    if (mesh == null) return;
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    mesh.position.set(
      ...(ID.toChunkCoordinates(id).map((x) => x * config.chunkSize) as [
        number,
        number,
        number
      ])
    );

    this.scene.add(mesh);
  }

  public disposeChunk(id: IDType) {
    if (!this.currentChunks.delete(id))
      throw new Error("Can't remove chunk that is not rendered.");
    let obj = this.scene.getObjectByName(id.toString());
    while (obj) {
      let mesh = obj as Mesh;
      mesh.clear();
      mesh.geometry.dispose();

      if (!Array.isArray(mesh!.material)) mesh.material.dispose();

      this.scene.remove(mesh);
      obj = this.scene.getObjectByName(id.toString());
    }
  }

  public resizeViewport() {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public renderChunks(x: number, y: number, z: number) {
    const halfDistance = Math.ceil(config.renderDistance / 2);
    let ids: IDType[] = [];

    // add ids from center to edges
    for (let i = 0; i < config.renderDistance; i++) {
      for (let j = 0; j < config.renderDistance; j++) {
        for (let k = 0; k < config.renderDistance; k++) {
          ids.push(
            ID.fromCoordinates(
              (x + i - halfDistance) * config.chunkSize,
              (halfDistance + y - j) * config.chunkSize,
              (z + k - halfDistance) * config.chunkSize
            )
          );
        }
      }
    }

    for (const id of ids) {
      if (!this.currentChunks.has(id)) this.enqueueChunk(id);

      this.currentChunks.add(id);
    }

    for (const id of [...this.currentChunks].filter((x) => !ids.includes(x)))
      this.disposeChunk(id);
  }

  private lastFrame = -1;
  public render(frames: number) {
    const delta = frames - this.lastFrame;
    this.lastFrame = frames;

    const skyColorIndex = Math.max(
      0,
      Math.min(this.camera.position.y / 64 + 1, 1)
    );

    this._scene.background = new THREE.Color(
      this.skyGradient.getColorAt(skyColorIndex)
    );
    this._sun!.intensity = Math.min(1, skyColorIndex);
    this._ambientLight!.intensity = Math.min(0.5, Math.max(0.1, skyColorIndex));

    this._renderer.render(this.scene, this.camera);
    this._composer?.render(delta / 16);

    this.controller.update(delta / 16);

    const playerChunk = ID.fromCoordinates(
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z
    );

    if (playerChunk != this.currentChunk) {
      this.renderChunks(...ID.toChunkCoordinates(playerChunk));
      this.currentChunk = playerChunk;
    }

    requestAnimationFrame((frames) => this.render(frames));
  }
}

window.ModelParser = BlockModelManager;
window.blockList = BlockList;
window.TextureManager = TextureManager;

const game = new Game();
// @ts-ignore
window.game = game;
game.load().then(() => {
  console.log("Game is loaded.");
  game.render(0);
});
