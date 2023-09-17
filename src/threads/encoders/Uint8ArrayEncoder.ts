import Encoder from "../Encoder";

export default class ProxyEncoder implements Encoder<Uint8Array> {
  canEncode(data: any): boolean {
    return data instanceof Uint8Array;
  }
  encode(data: Uint8Array) {
    return [...data];
  }
  decode(array: number[]): Uint8Array {
    return new Uint8Array(array);
  }
}
