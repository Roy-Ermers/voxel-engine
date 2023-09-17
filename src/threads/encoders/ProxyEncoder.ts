import Encoder from "../Encoder";
import Proxy from "../Proxy";

export default class ProxyEncoder implements Encoder<Proxy<any>> {
  canEncode(data: any): boolean {
    return data instanceof Proxy;
  }
  encode(data: Proxy<any>) {
    return data.id;
  }
  decode(id: string): Proxy<any> {
    return new Proxy<any>(id);
  }
}
