import Block from "./Block";

const blocks = import.meta.glob("../../assets/blocks/**/*.json", {
  import: "default",
  eager: true,
});
export default class BlockList {
  static identifierMap: Map<string, number> = new Map();
  static blockMap: Map<string, Block> = new Map();

  static async load() {
    this.blockMap.set("air", { id: 0, identifier: "air" });
    this.identifierMap.set("air", 0);

    let id = 1;
    for (const block of Object.keys(blocks)) {
      const blockClass = blocks[block] as Block;

      this.identifierMap.set(blockClass.identifier, id);
      this.blockMap.set(blockClass.identifier, { ...blockClass, id });

      id++;
    }
  }

  static [Symbol.iterator]() {
    return this.blockMap.values();
  }

  static get(identifier: string) {
    const block = this.blockMap.get(identifier);

    if (!block) throw new Error(`Block ${identifier} not found`);

    return block;
  }

  static getById(id: number) {
    for (const [identifier, identifierId] of this.identifierMap) {
      if (identifierId === id) return this.get(identifier);
    }

    throw new Error(`Block with id ${id} not found`);
  }

  static getId(identifier: string) {
    const id = this.identifierMap.get(identifier);

    if (id === undefined) throw new Error(`Block ${identifier} not found`);
    return id;
  }
}
