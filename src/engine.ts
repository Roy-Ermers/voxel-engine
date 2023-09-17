import * as THREE from "three";
import { IDType } from "./ID";
import BlockList from "./blocks/BlockList";
import BlockModelManager from "./blocks/BlockModelManager";
import TextureManager from "./blocks/TextureManager";
import Chunk from "./chunks/Chunk";
import { ChunkMeshManager } from "./chunks/ChunkMeshManager";
import Color from "./colors/Color";
import Gradient from "./colors/Gradient";
import FlyControls from "./controllers/flyControls";
import fragmentShader from "./shaders/shader.frag?raw";
import vertexShader from "./shaders/shader.vert?raw";
import type WorldType from "./storage/World.js";
import World from "./storage/World.js?worker";
import Proxy from "./threads/Proxy";
import Thread, { ThreadedContext } from "./threads/Thread";
import Mesh from "./types/Mesh";
import meshToThreeMesh from "./utils/MeshToThreeMesh";
import KeyboardState from "./utils/keyboardState";

export default class Game implements ChunkMeshManager {
  stats?: HTMLDivElement;

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

  private _world?: ThreadedContext<WorldType>;
  private _material?: THREE.ShaderMaterial;
  private _raycast?: THREE.Line;
  private chunkBounds?: THREE.LineSegments;
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

  addChunk(chunk: Chunk, meshData: Mesh): void {
    const mesh = meshToThreeMesh(meshData, this._material!);
    mesh.name = chunk.id.toString();
    mesh.position.set(
      chunk.worldPosition[0],
      chunk.worldPosition[1],
      chunk.worldPosition[2]
    );

    this._scene.add(mesh);
  }

  updateChunk(chunk: Chunk, mesh: Mesh): void {
    this.removeChunk(chunk.id);

    this.addChunk(chunk, mesh);
  }

  removeChunk(chunk: IDType): void {
    let mesh = this._scene.getObjectByName(chunk) as THREE.Mesh | undefined;
    if (!mesh) return;
    while (mesh) {
      mesh.clear();
      mesh.geometry.dispose();

      if (!Array.isArray(mesh!.material)) mesh.material.dispose();

      this.scene.remove(mesh);
      mesh = this.scene.getObjectByName(chunk.toString()) as
        | THREE.Mesh
        | undefined;
    }
  }

  async load() {
    this.createLight();
    await BlockList.load();
    await this.loadAssets();
    await this.createWorld();
    this.createStatsWindow();
    this.addDebuggingHelpers();

    this.render(0);
    setInterval(() => this.tick(), 20);
  }

  tick() {
    this.world?.processChunks();

    this.chunkBounds?.position.set(
      Math.floor(this._camera.position.x / Chunk.size) * Chunk.size +
        Chunk.size / 2,
      Math.floor(this._camera.position.y / Chunk.size) * Chunk.size +
        Chunk.size / 2,
      Math.floor(this._camera.position.z / Chunk.size) * Chunk.size +
        Chunk.size / 2
    );

    this.world?.getStatus().then((status) => {
      this.stats!.textContent = `Chunks: ${status.chunks.length} |\nStaged Chunks: ${status.stagedChunks.length} |\nVisible Chunks: ${status.visibleChunks.length} |\nMeshed Chunks: ${status.meshedChunks} |\nDirty Chunks: ${status.dirtyChunks}`;
    });
  }

  private createLight() {
    this._sun = new THREE.DirectionalLight(0xffffff, 1);
    this._sun.position.set(-1, 0.75, -1);
    this._sun.castShadow = true;

    this._ambientLight = new THREE.AmbientLight(0xffffff, 0.4);

    this.scene.add(this._sun);
    this.scene.add(this._ambientLight);
  }

  private async loadAssets() {
    const { texture } = await this.loadAtlas();

    this._material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uTime: { value: 0 },
        uSunDirection: { value: this._sun!.position },
      },
      vertexShader,
      fragmentShader,
      // wireframe: true,
    });
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

  private async createWorld() {
    this._world = await Thread.create<WorldType>(
      World,
      new Proxy(this),
      Math.random()
    );

    this._world.generateSpawn();
  }

  public createStatsWindow() {
    this.stats = document.createElement("div");
    this.stats.classList.add("stats");
    document.body.appendChild(this.stats);
  }

  private addDebuggingHelpers() {
    var geo = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(Chunk.size, Chunk.size, Chunk.size)
    ); // or WireframeGeometry( geometry )

    var mat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      linewidth: 2,
      depthTest: false,
    });

    this.chunkBounds = new THREE.LineSegments(geo, mat);
    this.chunkBounds.renderOrder = 99999;

    this._scene.add(this.chunkBounds);

    const raycastGeo = new THREE.BufferGeometry();
    raycastGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3)
    );

    this._raycast = new THREE.Line(
      raycastGeo,
      new THREE.LineBasicMaterial({ color: 0xff0000 })
    );

    this._scene.add(this._raycast);
  }

  public resizeViewport() {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(window.innerWidth, window.innerHeight);
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

    this._material!.uniforms.uTime.value = frames / 60;
    this._renderer.render(this.scene, this.camera);

    const oldPosition = this._camera.position.clone();
    this.controller.update(delta / 16);

    if (oldPosition.distanceTo(this._camera.position) > 0.1) {
      this._world?.onPlayerMove(
        this._camera.position.x,
        this._camera.position.y,
        this._camera.position.z
      );
    }

    requestAnimationFrame((frames) => this.render(frames));
  }
}
const game = new Game();

// @ts-ignore
window.ModelParser = BlockModelManager;
// @ts-ignore
window.blockList = BlockList;
// @ts-ignore
window.TextureManager = TextureManager;
// @ts-ignore
window.game = game;

game
  .load()
  .then(() => {
    console.log("Game is loaded.");
  })
  .catch(console.error);
