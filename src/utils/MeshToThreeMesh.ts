import {
  BufferAttribute,
  BufferGeometry,
  Material,
  Mesh as ThreeMesh,
} from "three";
import Mesh from "../types/Mesh";

export default function meshToThreeMesh(
  mesh: Mesh,
  material: Material
): ThreeMesh {
  const { vertices, normals, uvs, indices } = mesh;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(vertices), 3)
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array(normals), 3)
  );
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  // geometry.computeBoundingSphere();

  return new ThreeMesh(geometry, material);
}
