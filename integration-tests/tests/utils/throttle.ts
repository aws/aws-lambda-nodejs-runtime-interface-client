import { Transform, TransformCallback } from "stream";
import { vi } from "vitest";

export class Throttle extends Transform {
  private readonly bps: number;
  private readonly chunkSize: number;

  public constructor(opts: { bps: number; chunkSize: number }) {
    super();
    this.bps = opts.bps;
    this.chunkSize = opts.chunkSize;
  }

  public _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    const delay = Math.ceil((chunk.length * 1000) / this.bps);
    setTimeout(() => {
      this.push(chunk);
      callback();
    }, delay);
    vi.runAllTimers();
  }
}
