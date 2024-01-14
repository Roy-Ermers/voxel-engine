import type Encoder from "./Encoder";

const encoders = Object.fromEntries(Object.entries(
  import.meta.glob("./encoders/*Encoder.ts", {
    eager: true,
    import: "default",
  })
).map(
  ([key, value]) =>
    [
      key.replace("./encoders/", "").replace(".ts", ""),
      new (value as { new (): Encoder<any> })(),
    ] as const
));

export default class PacketEncoder {
  static encode(data: any): { data: any, shared: any[] } {
    // walk through the data and encode each object that is encodable by an encoder
    const shared: any = [];
    const walk = (data: any): any => {
      if (Array.isArray(data)) {
        return data.map(walk);
      }

      if (data instanceof Object) {
        for (const [name, encoder] of Object.entries(encoders)) {
          if (encoder.canEncode(data)) {
            const { data: encoded, shared: sharedData = [] } = encoder.encode(data);
            shared.push(...sharedData);
            return { _encoder: name, data: encoded, sharedRange: [shared.length - sharedData.length, shared.length] };
          }
        }

        const result: any = {};

        for (const [key, value] of Object.entries(data)) {
          result[key] = walk(value);
        }
        return result;
      }

      return data;
    };

    const encoded = walk(data);

    return { data: encoded, shared };
  }

  static decode<t>(data: any, shared?: any[]): t {
    try {
      const walk = (data: any): any => {
        if (Array.isArray(data)) {
          return data.map(walk);
        }
        if (data instanceof Object) {
          if (data._encoder) {
            const encoder = encoders[data._encoder];
            if (!encoder) throw new Error(`Failed to find encoder ${data._encoder}`);
            return encoder.decode(data.data, shared?.slice(...data.sharedRange) ?? []);
          }

          const result: any = {};
          for (const [key, value] of Object.entries(data)) {
            result[key] = walk(value);
          }
          return result;
        }

        return data;
      };

      return walk(data);
    } catch (error) {
      console.error("Failed to decode packet", data);
      throw error;
    }
  }
}
