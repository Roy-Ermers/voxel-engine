import PacketEncoder from "./PacketEncoder";
import Proxy from "./Proxy";

export type ThreadedContext<t> = {
  [k in keyof t]: t[k] extends (...args: infer p) => infer r
    ? (...args: p) => Promise<r>
    : never;
};
type ThreadMessage =
  | {
      type: "signatures";
      value: string[];
    }
  | {
      type: "log";
      value: any[];
    }
  | {
      type: "error";
      value: Error;
    }
  | {
      type: "functionCall";
      function: string;
      arguments: any[];
      argumentIndex?: number;
      timestamp: number;
    }
  | {
      type: "returnData";
      function: string;
      value: any;
      timestamp: number;
    }
  | {
      type: "constructorArguments";
      value: any[];
    };

let isInitialized = false;
export default class Thread<
  p extends Record<keyof p, (...args: any[]) => any> = {}
> {
  static async create<t extends Thread<any>>(
    workerClass: { new (): Worker },
    ...args: Parameters<t["initialize"]>
  ) {
    return new Promise<ThreadedContext<t>>(async (resolve, reject) => {
      let workerName = workerClass.name;

      const worker = new workerClass();

      const initializeTimeout = setTimeout(() => {
        console.error(
          `[${workerName}]`,
          "Thread initialization timed out. Check your thread code for errors."
        );

        reject(
          "Thread initialization timed out. Check your thread code for errors."
        );
      }, 5000);

      const constructor: ThreadMessage = {
        type: "constructorArguments",
        value: args,
      };

      for (const arg of args) {
        if (arg instanceof Proxy) {
          arg.startConnection(worker);
        }
      }

      worker.postMessage(PacketEncoder.encode(constructor));

      worker.addEventListener("error", (e) => console.error(e));
      worker.addEventListener("messageerror", (e) => console.error(e));

      worker.addEventListener(
        "message",
        ({ data }) => {
          const message: ThreadMessage = PacketEncoder.decode(data);

          if (message.type == "signatures") {
            clearTimeout(initializeTimeout);

            const { name, functions } = message.value as unknown as {
              name: string;
              functions: string[];
            };

            workerName = name;

            const dataObject = Thread.createContext<t>(functions, worker);

            console.log(`[Thread] ${workerName} is loaded.`);
            resolve(dataObject as unknown as ThreadedContext<t>);
          }
        },
        { once: true }
      );
    });
  }

  /**
   * Creates a context object that can be used to call functions on the thread.
   */
  private static createContext<t extends Record<string, any>>(
    keys: string[],
    worker: Worker
  ) {
    const context: Record<string, (...args: any[]) => Promise<any>> = {};
    let id = 0;
    for (const name of keys) {
      context[name] = async (...args: any[]) => {
        return await new Promise<any>((resolve) => {
          const timestamp = Date.now() + id++;

          worker.addEventListener(
            "message",
            function receiveReturnValue({ data }) {
              const message: ThreadMessage = PacketEncoder.decode(data);

              if (
                message.type == "returnData" &&
                message.function == name &&
                message.timestamp === timestamp
              ) {
                worker.removeEventListener("message", receiveReturnValue);
                resolve(message.value);
              }
            }
          );

          const callMessage: ThreadMessage = {
            type: "functionCall",
            function: name,
            arguments: args,
            timestamp,
          };

          worker.postMessage(PacketEncoder.encode(callMessage));
        });
      };
    }
    return context as ThreadedContext<t>;
  }

  protected log(...args: any[]) {
    console.log(
      `%c${this.constructor.name}%c`,
      "background:deepskyblue;color:white;border-radius:0.5rem;padding: 0 0.5rem;font-family: sans-serif",
      "color: white",
      ...args
    );
  }

  protected constructor() {
    if (!self) {
      console.error(
        "Can't create a thread like this, use Thread.create(<path>)."
      );
      return;
    }

    if (isInitialized) {
      return;
    }

    isInitialized = true;

    this.addEventListeners();
  }

  public initialize(...args: any[]): void | Promise<void> {}

  private addEventListeners() {
    self.onmessage = async ({ data }) => {
      const message: ThreadMessage = PacketEncoder.decode(data);
      if (message.type == "functionCall") {
        try {
          // @ts-ignore
          const returnData = await this[message.function as keyof this](
            ...message.arguments
          );

          const response: ThreadMessage = {
            type: "returnData",
            function: message.function,
            value: returnData,
            timestamp: message.timestamp,
          };

          self.postMessage(PacketEncoder.encode(response));
        } catch (e) {
          console.error(`[${this.constructor.name}]`, e);
        }
      }

      if (message.type == "constructorArguments") {
        await this.initialize(...message.value);
        this.sendSignatures();
      }
    };
  }

  private sendSignatures() {
    let functions = [];
    const properties = Object.getOwnPropertyNames(Object.getPrototypeOf(this));

    for (const key of properties) {
      if (key == "constructor") continue;

      if (typeof this[key as keyof this] == "function") functions.push(key);
    }

    const signatures = {
      type: "signatures",
      value: { name: this.constructor.name, functions },
    };

    self.postMessage(PacketEncoder.encode(signatures));
  }
}
