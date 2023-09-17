import Encoder from "../Encoder";

export default class ProxyEncoder implements Encoder<ArrayBuffer> {
  canEncode(data: any): boolean {
    return data instanceof ArrayBuffer;
  }
  encode(data: ArrayBuffer) {
    return Buffer.from(data).toJSON();
  }
  decode(buffer: { type: "Buffer"; data: number[] }): ArrayBuffer {
    return Buffer.from(buffer.data).buffer;
  }
}
