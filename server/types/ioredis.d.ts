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
    ping(): Promise<string>;
    publish(channel: string, message: string): Promise<number>;
    subscribe(channel: string, cb?: (err: unknown) => void): Promise<number>;
    connect(): Promise<void>;
    quit(): Promise<void>;
    disconnect(): void;
    on(event: "error" | "end" | "connect" | "close", listener: (err?: unknown) => void): void;
    on(event: "reconnecting", listener: (delay: number) => void): void;
    on(event: "message", listener: (channel: string, message: string) => void): void;
  }
}
