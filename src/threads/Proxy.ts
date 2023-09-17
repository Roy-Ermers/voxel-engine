import { FunctionExtractor } from "../types/FunctionExtractor";
import PacketEncoder from "./PacketEncoder";

interface ProxyFunctionCall {
  type: "proxyFunctionCall";
  proxyId: string;
  function: string;
  arguments: any[];
  timestamp: number;
}

export default class Proxy<t extends Record<string, any>> {
  private _id;
  get id() {
    return this._id;
  }

  object?: t;

  /**
   * Create a new proxy object, which can be used to allow other threads to call functions on the object
   */
  constructor(object: t);
  /**
   * Establishes a connection to the main thread
   */
  constructor(id: string);
  constructor(objectOrId: t | string) {
    if (typeof objectOrId == "string") {
      this._id = objectOrId;
    } else {
      this._id = crypto.randomUUID() as string;
      this.object = objectOrId;
    }
  }

  startConnection(worker: Worker) {
    if (!this.object) {
      throw new Error("This function can only be called on the main thread");
    }

    function isProxyFunctionType(data: any): data is ProxyFunctionCall {
      return data && data.type === "proxyFunctionCall";
    }

    worker.addEventListener("message", async (event) => {
      if (!this.object) {
        throw new Error("This function can only be called on the main thread");
      }

      const data = PacketEncoder.decode(event.data);

      if (isProxyFunctionType(data)) {
        const func = this.object[data.function];
        if (func && typeof func === "function") {
          try {
            const returnValue = await func.call(this.object, ...data.arguments);

            const returnMessage = {
              type: "returnData",
              function: data.function,
              value: returnValue,
              timestamp: data.timestamp,
            };
            worker.postMessage(PacketEncoder.encode(returnMessage));
          } catch (e) {}
        }
      }
    });
  }

  /**
   * Call a function on the object
   * @param functionName
   * @param args
   *
   * todo: Add return type handling
   */
  call<
    obj extends FunctionExtractor<t>,
    methodName extends keyof FunctionExtractor<obj>
  >(functionName: methodName, ...args: Parameters<obj[methodName]>): void {
    if (!self || !this._id) {
      throw new Error("This function can only be called in a worker thread");
    }

    const packet = {
      type: "proxyFunctionCall",
      proxyId: this._id,
      function: functionName,
      arguments: args,
      timestamp: Date.now(),
    };

    self.postMessage(PacketEncoder.encode(packet));
  }
}
