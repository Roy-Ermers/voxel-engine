import { assert, describe, test } from "vitest";
import Chunk from "../../src/chunks/Chunk";
import ChunkProcessor from "../../src/chunks/ChunkProcessor";
import TestPass from "../../src/chunks/passes/TestPass";

describe("Chunk processor", () => {
  const processor = new ChunkProcessor([new TestPass()]);

  test("Should process chunks", async () => {
    const chunk = new Chunk("0:0:0");

    const done = await processor.process(chunk);

    assert.equal(chunk.currentPass, "test");
    assert.equal(done, true);
    assert.isTrue(chunk.data.some((x) => x !== 0));
  });
});
