
export type CallableFunctions<t> = {
    [k in keyof t]: t[k] extends Function ? k : never;
}[keyof t];

export type ThreadedContext<t> = {
    [k in CallableFunctions<t>]: (...args: (Parameters<t[k]>)) => Promise<ReturnType<t[k]>>
};


type ThreadMessage = {
    type: "signatures",
    value: string[],
} | {
    type: "log",
    value: any[],
} | {
    type: "functionCall",
    function: string,
    arguments: any[];
    timestamp: number;
} | {
    type: "returnData",
    function: string,
    value: any;
    timestamp: number;
};

export default class Thread {
    static async create<t>(path: string) {
        return new Promise<ThreadedContext<t>>(resolve => {
            const worker = new Worker(path, { type: 'module' });

            const name = (path.match(/(.+)\/(.+)\.js$/)?.[2] ?? "Unknown thread").trim();
            console.log(`[Thread] Initializing ${name}`);

            worker.addEventListener("message", ({ data }) => {
                const message: ThreadMessage = data;
                if (message.type == "signatures") {
                    const dataObject: Record<string, (...args: any[]) => Promise<any>> = Thread.createContext(message.value, worker);
                    resolve(dataObject as unknown as ThreadedContext<t>);
                    console.log(`[Thread] ${name} is loaded.`);
                }

                if (message.type == "log") {
                    console.log(`[${name}]`, ...message.value);
                }
            });
        });
    }

    private static createContext(keys: string[], worker: Worker) {
        const context: Record<string, (...args: any[]) => Promise<any>> = {};

        for (const name of keys) {
            context[name] = async (...args: any[]) => {
                return await new Promise<any>(resolve => {
                    const timestamp = performance.now();
                    worker.addEventListener("message", function receiveReturnValue({ data }) {
                        const message: ThreadMessage = data;
                        if (message.type == "returnData" && message.function == name && message.timestamp == timestamp) {
                            resolve(data.value);

                            worker.removeEventListener("message", receiveReturnValue);
                        }
                    });
                    const callMessage: ThreadMessage = { type: "functionCall", function: name, arguments: args, timestamp };
                    worker.postMessage(callMessage);
                });
            };
        }
        return context;
    }

    protected log(...args: any[]) {
        self.postMessage({ type: 'log', value: args });
    }


    protected constructor() {
        if (!self) {
            console.error("Can't create a thread like this, use Thread.create(<path>).");
            return;
        }

        this.sendSignatures();
        this.addEventListeners();
    }

    private addEventListeners() {
        self.onmessage = ({ data }: { data: any; }) => {
            const message: ThreadMessage = data;
            if (message.type == "functionCall") {
                // @ts-ignore
                const returnData = this[message.function as keyof this](...message.arguments);
                const response: ThreadMessage = { type: "returnData", function: message.function, value: returnData, timestamp: message.timestamp };

                self.postMessage(response);
            }
        };
    }

    private sendSignatures() {
        let functions = [];
        const properties = Object.getOwnPropertyNames(Object.getPrototypeOf(this));

        for (const key of properties) {
            if (key == "constructor")
                continue;

            if (typeof this[key as keyof this] == "function")
                functions.push(key);
        }

        self.postMessage({ type: "signatures", value: functions });
    }
}
