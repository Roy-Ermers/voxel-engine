export default interface Mesher {
  generate(
    data: Uint8Array,
    resolution?: number
  ): {
    positions: number[];
    normals: number[];
    uvs: number[];
    indices: number[];
  };
}
