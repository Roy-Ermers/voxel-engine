import PrimitiveGenerator from "../modelers/PrimitiveGenerator";
import BlockModelDefinition, {
  BlockModelPart,
} from "../types/BlockModelDefinition";
import { FACES, Face } from "../types/Face";
import BlockList from "./BlockList";
import TextureManager from "./TextureManager";

const BLOCK_MODEL_SIZE = 16;

const UV_ORDER_MAP: Record<Face, number[]> = {
  left: [0, 1, 0, 3, 2, 1, 2, 3], // [2, 1, 0, 1, 2, 3, 0, 3]
  right: [0, 1, 0, 3, 2, 1, 2, 3],
  bottom: [2, 1, 0, 1, 2, 3, 0, 3],
  top: [2, 3, 0, 3, 2, 1, 0, 1],
  front: [0, 3, 2, 3, 0, 1, 2, 1],
  back: [0, 3, 2, 3, 0, 1, 2, 1],
};
type GeneratedBlockModel = Omit<BlockModelDefinition, "extends"> & {
  extends: string[];
};

type ModelGenerator = (textures: Record<string, string>) => GeneratedBlockModel;

const MODELS = Object.fromEntries(
  Object.entries(
    import.meta.glob("../../assets/blockmodels/*.json", {
      import: "default",
      eager: true,
    })
  ).map(([key, value]) => [
    key.replace("../../assets/blockmodels/", "").replace(".json", ""),
    value,
  ])
);

const loadedModels = new Map<string, BlockModelDefinition>();
const modelGenerators: Map<string, ModelGenerator> = new Map();

const blockMeshes = new Map<number, BlockMesh>();

interface BlockMesh {
  name: string;
  isCube: boolean;
  vertices: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  cullFaces: Face[];
}

export default class BlockModelManager {
  static {
    Object.keys(MODELS).map((x) => this.parseModel(x));
  }

  public static get modelStore() {
    return loadedModels;
  }

  public static async generateMeshByIdentifier(blockIdentifier: string) {
    const block = BlockList.getId(blockIdentifier);

    return this.generateMesh(block);
  }

  public static async generateMesh(
    blockIdentifier: number
  ): Promise<BlockMesh> {
    if (blockMeshes.has(blockIdentifier))
      return blockMeshes.get(blockIdentifier) as BlockMesh;
    const model = await BlockModelManager.generateBlockModel(blockIdentifier);

    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // generate a cube for each part of the model. based on the part's position and size.
    for (const part of model.parts) {
      const quadAxis = part.size.findIndex((x) => x === 0);

      if (quadAxis === -1) {
        const {
          vertices: cubeVertices,
          normals: cubeNormals,
          indices: cubeIndices,
        } = PrimitiveGenerator.generateCube(
          [
            part.position[0] / BLOCK_MODEL_SIZE,
            part.position[1] / BLOCK_MODEL_SIZE,
            part.position[2] / BLOCK_MODEL_SIZE,
          ],
          [
            part.size[0] / BLOCK_MODEL_SIZE,
            part.size[1] / BLOCK_MODEL_SIZE,
            part.size[2] / BLOCK_MODEL_SIZE,
          ]
        );
        const modelUVs = BlockModelManager.generateUVs(
          part,
          model.uvLock ?? false
        );
        uvs.push(...modelUVs);

        const offset = vertices.length / 3;
        for (let i = 0; i < cubeIndices.length; i++) {
          cubeIndices[i] += offset;
        }

        vertices.push(...cubeVertices);
        normals.push(...cubeNormals);
        indices.push(...cubeIndices);
      } else {
        const quadSize = part.size.filter((x) => x !== 0);
        const quadFace = FACES[quadAxis * 2];
        const backquadFace = FACES[quadAxis * 2 + 1];

        // TODO: offset the quad so it is aligned in the middle of a gridcell
        const axisOffset = {
          x: 0,
          y: 0,
          z: 0,
        };

        switch (quadFace) {
          case "left":
            axisOffset.x = 1;
            break;
          case "right":
            axisOffset.x = -1;
            break;
          case "bottom":
            axisOffset.y = 1;
            break;
          case "top":
            axisOffset.y = -1;
            break;
          case "front":
            axisOffset.z = 1;
            break;
          case "back":
            axisOffset.z = -1;
            break;
        }

        const {
          vertices: cubeVertices,
          normals: cubeNormals,
          indices: cubeIndices,
        } = PrimitiveGenerator.generateQuad(
          [quadSize[0] / BLOCK_MODEL_SIZE, quadSize[1] / BLOCK_MODEL_SIZE],
          quadFace,
          [
            part.position[0] / BLOCK_MODEL_SIZE + axisOffset.x,
            part.position[1] / BLOCK_MODEL_SIZE + axisOffset.y,
            part.position[2] / BLOCK_MODEL_SIZE + axisOffset.z,
          ]
        );

        const faceTextureUV = TextureManager.getUV(part.textures[quadFace]);
        const backfaceTextureUV = TextureManager.getUV(
          part.textures[backquadFace] ?? part.textures[quadFace]
        );

        uvs.push(...this.generateUVsForFace(quadFace, faceTextureUV));

        const backfaceUV = this.generateUVsForFace(
          backquadFace,
          backfaceTextureUV
        );
        uvs.push(
          ...backfaceUV.slice(2, 4),
          ...backfaceUV.slice(0, 2),
          ...backfaceUV.slice(6, 8),
          ...backfaceUV.slice(4, 6)
        );

        const offset = vertices.length / 3;
        for (let i = 0; i < cubeIndices.length; i++) {
          cubeIndices[i] += offset;
        }

        vertices.push(...cubeVertices);
        normals.push(...cubeNormals);
        indices.push(...cubeIndices);
      }
    }

    const isCube =
      model.parts.length === 1 &&
      model.parts[0].size[0] === 16 &&
      model.parts[0].size[1] === 16 &&
      model.parts[0].size[2] === 16;

    const mesh: BlockMesh = {
      name: model.name,
      isCube,
      vertices,
      normals,
      uvs,
      indices,
      cullFaces: model.cullFaces,
    };

    blockMeshes.set(blockIdentifier, mesh);

    return mesh;
  }

  private static rotateVertex(
    vertex: [number, number, number],
    rotation: [number, number, number]
  ) {
    const rx = (rotation[0] ?? 0) * (Math.PI / 180);
    const ry = (rotation[1] ?? 0) * (Math.PI / 180);
    const rz = (rotation[2] ?? 0) * (Math.PI / 180);

    const cosx = Math.cos(rx);
    const sinx = Math.sin(rx);
    const cosy = Math.cos(ry);
    const siny = Math.sin(ry);
    const cosz = Math.cos(rz);
    const sinz = Math.sin(rz);

    const rotateX = (vertex: number[]) => {
      const [x, y, z] = vertex;
      return [x, y * cosx - z * sinx, y * sinx + z * cosx];
    };

    const rotateY = (vertex: number[]) => {
      const [x, y, z] = vertex;
      return [x * cosy + z * siny, y, -x * siny + z * cosy];
    };

    const rotateZ = (vertex: number[]) => {
      const [x, y, z] = vertex;
      return [x * cosz - y * sinz, x * sinz + y * cosz, z];
    };

    let rotated = rotateX(vertex);
    rotated = rotateY(rotated);
    rotated = rotateZ(rotated);

    return rotated;
  }

  private static generateUVsForFace(face: Face, uvs: number[]) {
    if (!(face in UV_ORDER_MAP)) {
      throw new Error(`Invalid face: ${face}`);
    }
    return UV_ORDER_MAP[face].map((i) => uvs[i]);
  }

  private static generateUVs(part: BlockModelPart, uvLock: boolean) {
    if (uvLock) return this.generateUVlockUVs(part);

    const UVmap = {
      front: TextureManager.getUV(part.textures.front),
      back: TextureManager.getUV(part.textures.back),
      top: TextureManager.getUV(part.textures.top),
      bottom: TextureManager.getUV(part.textures.bottom),
      right: TextureManager.getUV(part.textures.right),
      left: TextureManager.getUV(part.textures.left),
    };

    return FACES.flatMap((face) => this.generateUVsForFace(face, UVmap[face]));
  }

  private static generateUVlockUVs(part: BlockModelPart) {
    const x = (part.position[0] / BLOCK_MODEL_SIZE) * TextureManager.tileSize;
    const y = (part.position[1] / BLOCK_MODEL_SIZE) * TextureManager.tileSize;
    const z = (part.position[2] / BLOCK_MODEL_SIZE) * TextureManager.tileSize;

    const width = (part.size[0] / BLOCK_MODEL_SIZE) * TextureManager.tileSize;
    const height = (part.size[1] / BLOCK_MODEL_SIZE) * TextureManager.tileSize;
    const depth = (part.size[2] / BLOCK_MODEL_SIZE) * TextureManager.tileSize;

    const UVmap = {
      front: TextureManager.getBoxUV(
        part.textures.front,
        [x, y],
        [width, height]
      ),
      back: TextureManager.getBoxUV(
        part.textures.back,
        [x, y],
        [width, height]
      ),

      top: TextureManager.getBoxUV(part.textures.top, [x, z], [width, depth]),

      bottom: TextureManager.getBoxUV(
        part.textures.bottom,
        [x, z],
        [width, depth]
      ),

      right: TextureManager.getBoxUV(
        part.textures.right,
        [z, y],
        [depth, height]
      ),

      left: TextureManager.getBoxUV(
        part.textures.left,
        [z, y],
        [depth, height]
      ),
    };

    return FACES.flatMap((face) => this.generateUVsForFace(face, UVmap[face]));
  }

  public static async generateBlockModel(
    blockIdentifier: number
  ): Promise<GeneratedBlockModel> {
    const block = BlockList.getById(blockIdentifier);

    if (!block.model) {
      return {
        name: "air",
        extends: [],
        textures: [],
        cullFaces: [],
        parts: [],
        uvLock: false,
      };
    }

    const generator = this.parseModel(block.model.name);

    const model = generator(block.model.textures);

    return model;
  }

  private static loadModel(model: string) {
    if (loadedModels.has(model)) return loadedModels.get(model)!;

    if (!(model in MODELS)) throw new Error(`Model ${model} does not exist!`);

    const modelData = MODELS[model] as BlockModelDefinition;
    modelData.cullFaces ??= [];
    loadedModels.set(model, modelData);

    return modelData;
  }

  /**
   * returns a function that automatically generates a model with the given textures.
   */
  private static parseModel(modelIdentifier: string): ModelGenerator {
    if (modelGenerators.has(modelIdentifier))
      return modelGenerators.get(modelIdentifier)!;
    const modelData = this.loadModel(modelIdentifier);

    if (modelData.extends) {
      const parentModel = this.parseModel(modelData.extends.model);
      const parentTextures = modelData.extends.textures;

      return (textures: Record<string, string>) => {
        const parentTextureMap = Object.fromEntries(
          Object.entries(parentTextures).map(([key, value]) => [
            key,
            textures[value],
          ])
        );

        const model = parentModel(parentTextureMap);
        model.extends ??= [];
        model.extends.push(model.name);
        model.name = modelIdentifier;

        return model;
      };
    }

    return (textures: Record<string, string>) => {
      const generatedModel: GeneratedBlockModel = {
        ...modelData,
        extends: [],
        name: modelIdentifier,
        textures: [],
        parts: modelData.parts.map((part) => ({
          ...part,
          textures: Object.fromEntries(
            Object.entries(part.textures).map(([key, value]) => [
              key,
              textures[value],
            ])
          ),
        })),
      };

      generatedModel.extends = [];
      generatedModel.textures = [];
      generatedModel.name = modelIdentifier;

      return generatedModel;
    };
  }
}
