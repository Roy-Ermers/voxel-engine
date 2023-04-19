export default interface Block {
  id: number;

  identifier: string;

  model?: {
    readonly name: string;
    readonly textures: Record<string, string>;
  };
}
