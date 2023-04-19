export default class Color {
  static fromGrayscale(value: number) {
    return (
      (Math.ceil(value) << 16) | (Math.ceil(value) << 8) | Math.ceil(value)
    );
  }

  static fromRgb(r: number, g: number, b: number) {
    return (r << 16) | (g << 8) | b;
  }

  static toRgb(color: number) {
    return {
      r: (color >> 16) & 255,
      g: (color >> 8) & 255,
      b: color & 255,
    };
  }

  public get r() {
    return this._r;
  }

  public get g() {
    return this._g;
  }

  public get b() {
    return this._b;
  }
  private _r: number;
  private _g: number;
  private _b: number;

  constructor(r: number);
  constructor(r: number, g: number, b: number);
  constructor(r: number, g?: number, b?: number) {
    if (r !== undefined && g === undefined && b === undefined) {
      const color = Color.toRgb(r);

      this._r = color.r;
      this._g = color.g;
      this._b = color.b;
      return;
    }

    this._r = r;
    this._g = g!;
    this._b = b!;
  }

  valueOf() {
    return (this._r << 16) | (this._g << 8) | this._b;
  }

  [Symbol.toPrimitive]() {
    return this.valueOf();
  }
}
