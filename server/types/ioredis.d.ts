declare module "ioredis" {
  export default class Redis {
    constructor(url: string, options?: Record<string, unknown>);
    get(key: string): Promise<string | null>;
    set(
      key: string,
      value: string,
      mode?: "EX" | "PX" | string,
      ttl?: number,
    ): Promise<unknown>;
    scan(
      cursor: string,
      ...args: Array<string | number>
    ): Promise<[string, string[]]>;
    del(...keys: string[]): Promise<number>;
    connect(): Promise<void>;
    on(event: "error" | "end", listener: (err?: unknown) => void): void;
  }
}
