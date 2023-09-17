export default interface Encoder<t> {
  canEncode(data: any): boolean;

  /**
   * Encode data into a format that can be sent over the wire
   */
  encode(data: t): any;

  /**
   * Decode data from a format that can be sent over the wire
   * @param data
   */
  decode(data: any): t;
}
