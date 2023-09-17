import { parse, stringify } from "devalue";
import type Encoder from "./Encoder";

const encoders = Object.entries(
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
);

const reducers = Object.fromEntries(
  encoders.map(([key, value]) => [
    key,
    (data: any) => value.canEncode(data) && value.encode(data),
  ])
);

const revivers = Object.fromEntries(
  encoders.map(([key, value]) => [key, (data: any) => value.decode(data)])
);

export default class PacketEncoder {
  static encode(data: any): string {
    return stringify(data, reducers);
  }

  static decode<t>(data: string): t {
    try {
      return parse(data, revivers);
    } catch (error) {
      console.error("Failed to decode packet", data);
      throw error;
    }
  }
}
