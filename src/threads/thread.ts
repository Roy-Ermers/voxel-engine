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

export default class Thread {
  static async create<t>(worker: Worker, ...args: any[]) {
    return new Promise<ThreadedContext<t>>(async (resolve) => {
      let workerName = "Thread";

      worker.addEventListener("message", ({ data }) => {
        const message: ThreadMessage = data;
        if (message.type == "signatures") {
          if (args.length > 0) {
            const constructor: ThreadMessage = {
              type: "constructorArguments",
              value: args,
            };
            worker.postMessage(constructor);
          }

          const { name, functions } = message.value as unknown as {
            name: string;
            functions: string[];
          };

          workerName = name;

          const dataObject: Record<string, (...args: any[]) => Promise<any>> =
            Thread.createContext(functions, worker);

          resolve(dataObject as unknown as ThreadedContext<t>);
          console.log(`[Thread] ${workerName} is loaded.`);
        }

        if (message.type === "error") {
          console.error(`[${workerName}]`, message.value);
        }
      });
    });
  }

  private static createContext(keys: string[], worker: Worker) {
    const context: Record<string, (...args: any[]) => Promise<any>> = {};
    let id = 0;
    for (const name of keys) {
      context[name] = async (...args: any[]) => {
        return await new Promise<any>((resolve) => {
          const timestamp = Date.now() + id++;
          worker.addEventListener(
            "message",
            function receiveReturnValue({ data }) {
              const message: ThreadMessage = data;
              if (
                message.type == "returnData" &&
                message.function == name &&
                message.timestamp == timestamp
              ) {
                resolve(data.value);

                worker.removeEventListener("message", receiveReturnValue);
              }
            }
          );
          const callMessage: ThreadMessage = {
            type: "functionCall",
            function: name,
            arguments: args,
            timestamp,
          };
          worker.postMessage(callMessage);
        });
      };
    }
    return context;
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

    this.sendSignatures();
    this.addEventListeners();
  }

  protected initialize(...args: any[]) {}

  private addEventListeners() {
    self.onmessage = async ({ data }: { data: any }) => {
      const message: ThreadMessage = data;
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

          self.postMessage(response);
        } catch (e) {
          console.error(`[${this.constructor.name}]`, e);
        }
      }

      if (message.type == "constructorArguments") {
        this.initialize(...message.value);
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

    self.postMessage({
      type: "signatures",
      value: { name: this.constructor.name, functions },
    });
  }
}
