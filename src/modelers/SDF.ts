import Vector3 from "../types/Vector3";

export default class SDF {
  /**
   * Returns the distance to the nearest on the surface of a cone with center position, a height h and radius r.
   */
  static cone(
    position: Vector3,
    height: number,
    baseRadius: number,
    roundness = 0.1
  ) {
    const distance = Math.sqrt(
      Math.pow(position.x, 2) + Math.pow(position.z, 2)
    );

    const distanceToBase = distance - baseRadius;
    const distanceToTop = position.y - height;

    const distanceToCone = Math.max(distanceToBase, distanceToTop);

    const distanceToRoundness = Math.sqrt(
      Math.pow(distanceToBase, 2) + Math.pow(distanceToTop, 2)
    );

    return distanceToCone - roundness * distanceToRoundness;
  }
}
