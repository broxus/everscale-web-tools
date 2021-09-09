export {};

declare global {
  interface TonRequestOptions<M extends string, P extends {} | undefined> {
    method: string;
    params: P;
  }

  interface Ton {
    request(data: TonRequestOptions): Promise<any>;
  }

  interface Window {
    ton: Ton;
  }
}
