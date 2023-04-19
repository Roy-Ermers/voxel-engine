import { FACES, FACE_OPPOSITE_MAP, Face } from "../types/Face";

const FACE_VERTICES: Record<Face, number[]> = {
  front: [
    //bottom right
    1, 0, 0,
    //bottom left
    0, 0, 0,
    //top right
    1, 1, 0,
    //top left
    0, 1, 0,
  ],
  back: [
    //bottom left
    0, 0, 1,
    //bottom right
    1, 0, 1,
    //top left
    0, 1, 1,
    //top right
    1, 1, 1,
  ],
  top: [
    //bottom left
    0, 1, 1,
    //bottom right
    1, 1, 1,
    //top left
    0, 1, 0,
    //top right
    1, 1, 0,
  ],
  bottom: [
    //bottom right
    1, 0, 1,
    //bottom left
    0, 0, 1,
    //top right
    1, 0, 0,
    //top left
    0, 0, 0,
  ],
  right: [
    //top right
    1, 1, 1,
    //bottom right
    1, 0, 1,
    //top left
    1, 1, 0,
    //bottom left
    1, 0, 0,
  ],
  left: [
    //top left
    0, 1, 0,
    //bottom left
    0, 0, 0,
    //top right
    0, 1, 1,
    //bottom right
    0, 0, 1,
  ],
};

const FACE_NORMALS: Record<Face, number[]> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  top: [0, 1, 0],
  bottom: [0, -1, 0],
  right: [1, 0, 0],
  left: [-1, 0, 0],
};

/**
 * Class to generate primitives.
 */
export default class PrimitiveGenerator {
  /**
   * Generate a cube.
   * @returns A object with the vertices, normals, and indices.
   */
  public static generateCube(
    position: [number, number, number],
    size: [number, number, number]
  ) {
    let [x, y, z] = position;
    let [width, height, depth] = size;

    let vertices: number[] = [];
    let normals: number[] = [];
    let indices: number[] = [];

    for (let face of FACES) {
      let faceVertices = FACE_VERTICES[face];
      let faceNormals = FACE_NORMALS[face];

      //add the vertices
      for (let i = 0; i < faceVertices.length; i += 3) {
        let vertex = faceVertices.slice(i, i + 3);
        vertices.push(
          x + vertex[0] * width,
          y + vertex[1] * height,
          z + vertex[2] * depth
        );
      }

      //add the normals
      for (let i = 0; i < 4; i++) {
        normals.push(...faceNormals);
      }

      //add the indices
      let offset = vertices.length / 3 - 4;
      indices.push(
        offset,
        offset + 1,
        offset + 2,
        offset + 1,
        offset + 3,
        offset + 2
      );
    }

    return { vertices, indices, normals };
  }

  /**
   * Generate a quad.
   * @param size The size of the quad.
   * @param axis The axis to generate the quad on.
   * @param position The position of the quad.
   * @returns A object with the vertices, normals, and indices.
   */
  public static generateQuad(
    size: [number, number],
    face: Face,
    position?: [number, number, number]
  ) {
    let [width, height] = size;
    let [x, y, z] = position || [0, 0, 0];

    let vertices: number[] = [];
    let normals: number[] = [];
    let indices: number[] = [];
    let faceVertices: number[];
    let faceNormals: number[];

    faceVertices = FACE_VERTICES[face];
    faceNormals = FACE_NORMALS[face];

    //add the vertices
    for (let i = 0; i < faceVertices.length; i += 3) {
      let vertex = faceVertices.slice(i, i + 3);
      vertices.push(
        x + vertex[0] * width,
        y + vertex[1] * height,
        z + vertex[2] * width
      );

      //add the normals
      normals.push(...faceNormals);
    }

    //add the indices
    indices.push(0, 1, 2, 1, 3, 2);

    const oppositeFace = FACES[FACE_OPPOSITE_MAP[face]];
    // add the opposite face, so that the quad is double sided
    let oppositeFaceVertices = FACE_VERTICES[oppositeFace];
    let oppositeFaceNormals = FACE_NORMALS[oppositeFace];

    //add the vertices
    for (let i = 0; i < oppositeFaceVertices.length; i += 3) {
      let vertex = oppositeFaceVertices.slice(i, i + 3);
      vertices.push(
        x + (vertex[0] + oppositeFaceNormals[0]) * width,
        y + (vertex[1] + oppositeFaceNormals[1]) * height,
        z + (vertex[2] + oppositeFaceNormals[2]) * width
      );

      //add the normals
      normals.push(...faceNormals);
    }

    //add the indices
    indices.push(4, 5, 6, 5, 7, 6);

    return { vertices, indices, normals };
  }
}
