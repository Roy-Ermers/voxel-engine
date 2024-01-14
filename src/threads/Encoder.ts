export default interface Encoder<T, EncodeReturnType extends { data: any, shared: any[] } = { data: any, shared: any[] }> {
  canEncode(data: any): boolean;

  /**
   * Encode data into a format that can be sent over the wire
   */
  encode(data: T): EncodeReturnType;

  /**
   * Decode data from a format that can be sent over the wire
   * @param data
   */
  decode(data: EncodeReturnType['data'], shared: EncodeReturnType['shared']): T;
}
