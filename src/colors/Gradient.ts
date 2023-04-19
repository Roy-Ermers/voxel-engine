import Color from "./Color";

export default class Gradient {
  constructor(private a: Color, private b: Color) {}

  public getColorAt(interpolation: number) {
    if (interpolation <= 0) return this.a.valueOf();

    if (interpolation >= 1) return this.b.valueOf();

    const r = this.getIndex(interpolation, this.a.r, this.b.r);
    const g = this.getIndex(interpolation, this.a.g, this.b.g);
    const b = this.getIndex(interpolation, this.a.b, this.b.b);

    return Color.fromRgb(r, g, b);
  }

  private getIndex(fraction: number, start: number, end: number) {
    const lower = Gradient.inverseCompanding(start / 255);
    const upper = Gradient.inverseCompanding(end / 255);

    return Gradient.companding((upper - lower) * fraction + lower) * 255;
  }

  private static inverseCompanding(val: number) {
    return val > 0.04045 ? Math.pow((val + 0.055) / 1.055, 2.4) : val / 12.92;
  }

  private static companding(val: number) {
    return val > 0.0031308
      ? 1.055 * Math.pow(val, 1 / 2.4) - 0.055
      : val * 12.92;
  }
}
