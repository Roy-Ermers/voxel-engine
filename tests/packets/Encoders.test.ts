import { assert, describe, test } from "vitest";
import Chunk from "../../src/chunks/Chunk";
import PacketEncoder from "../../src/threads/PacketEncoder";
import Proxy from "../../src/threads/Proxy";

describe("Chunk encoder", () => {
  const chunkData = new Uint8Array(16);
  crypto.getRandomValues(chunkData);

  const chunk = new Chunk("0:0:0", chunkData);

  test("Should revive chunks", () => {
    const chunkData = PacketEncoder.encode(chunk);

    const revivedChunkData = PacketEncoder.decode<Chunk>(chunkData);

    assert.equal(revivedChunkData.id, chunk.id);
    assert.deepEqual(revivedChunkData.data, chunk.data);
  });
});

describe("Uint8Array encoder", () => {
  const data = new Uint8Array(16);
  crypto.getRandomValues(data);

  test("revive UintArray8", () => {
    const encodedValue = PacketEncoder.encode(data);

    const decodedData = PacketEncoder.decode<Uint8Array>(encodedValue);

    assert.deepEqual(data, decodedData);
  });
});

describe("Proxy encoder", () => {
  const functions = {
    id: "id here",
    get() {
      return "test";
    },
  };
  test("Revive proxy", () => {
    const proxy = new Proxy(functions);

    const encodedProxy = PacketEncoder.encode(proxy);

    const decodedProxy =
      PacketEncoder.decode<Proxy<typeof functions>>(encodedProxy);

    assert.equal(proxy.id, decodedProxy.id);
  });
});
