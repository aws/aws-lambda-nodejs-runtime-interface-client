import { describe, it, expect, vi } from "vitest";
import {
  addFailWeakProp,
  toWritableResponseStream,
  tryCallFail,
  WritableResponseStream,
} from "./response-stream.js";
import { ResponseStream } from "./index.js";

describe("response-stream", () => {
  describe("tryCallFail", () => {
    it("returns false when no handler is registered", async () => {
      // GIVEN
      const fakeStream = {} as WritableResponseStream;

      // WHEN
      const result = await tryCallFail(fakeStream, new Error("oops"));

      // THEN
      expect(result).toBe(false);
    });

    it("invokes the registered handler and returns true", async () => {
      // GIVEN
      const fakeStream = {} as WritableResponseStream;
      const captured: unknown[] = [];
      addFailWeakProp(fakeStream, async (err) => {
        captured.push(err);
      });

      const testError = new Error("test-error");

      // WHEN
      const result = await tryCallFail(fakeStream, testError);

      // THEN
      expect(result).toBe(true);
      expect(captured).toHaveLength(1);
      expect(captured[0]).toBe(testError);
    });
  });

  describe("toWritableResponseStream", () => {
    const inner = {
      cork: vi.fn(),
      destroy: vi.fn(),
      end: vi.fn(),
      uncork: vi.fn(),
      write: vi.fn(),

      addListener: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      prependListener: vi.fn(),
      prependOnceListener: vi.fn(),
      off: vi.fn(),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
      setMaxListeners: vi.fn(),
      getMaxListeners: vi.fn(),
      listeners: vi.fn(),
      rawListeners: vi.fn(),
      listenerCount: vi.fn(),
      eventNames: vi.fn(),
      emit: vi.fn(),

      setContentType: vi.fn(),

      // props read-write
      destroyed: false,
      _onBeforeFirstWrite: undefined as unknown as () => void,

      // props read-only
      writableFinished: false,
      writableObjectMode: true,
      writableEnded: false,
      writableNeedDrain: false,
      writableHighWaterMark: 42,
      writableCorked: 0,
      writableLength: 0,
      writable: true,
    } as unknown as ResponseStream;

    // GIVEN
    const wrapper = toWritableResponseStream(inner);

    it("wraps all methods and calls inner with correct this binding", () => {
      // WHEN
      wrapper.cork();
      wrapper.write("foo", "utf8", () => {});
      const cb = () => {};
      wrapper.on("event", cb);

      // THEN
      expect(inner.cork).toHaveBeenCalled();

      expect(inner.write).toHaveBeenCalledWith(
        "foo",
        "utf8",
        expect.any(Function),
      );

      expect(inner.on).toHaveBeenCalledWith("event", cb);
    });

    it("reflects and sets PROPS_READ_WRITE properties", () => {
      // GIVEN
      expect(wrapper.destroyed).toBe(false);

      // WHEN
      const fn = () => {};
      wrapper._onBeforeFirstWrite = fn;
      wrapper.destroyed = true;

      // THEN
      expect(inner.destroyed).toBe(true);
      expect(inner._onBeforeFirstWrite).toBe(fn);
    });

    it("reflects PROPS_READ_ONLY properties and is read-only", () => {
      expect(wrapper.writableFinished).toBe(inner.writableFinished);
      expect(wrapper.writableHighWaterMark).toBe(inner.writableHighWaterMark);

      // Attempting to assign should not change the inner prop or should throw
      // In strict mode, setting a getter-only property throws TypeError
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (wrapper as any).writableFinished = true;
      }).toThrow(TypeError);
      expect(inner.writableFinished).toBe(false);
    });

    it("does not expose any extra keys beyond WRITABLE_METHODS", () => {
      const keys = Object.keys(wrapper).sort();
      const expectedMethods = [
        "cork",
        "destroy",
        "end",
        "uncork",
        "write",
        "addListener",
        "on",
        "once",
        "prependListener",
        "prependOnceListener",
        "off",
        "removeListener",
        "removeAllListeners",
        "setMaxListeners",
        "getMaxListeners",
        "listeners",
        "rawListeners",
        "listenerCount",
        "eventNames",
        "emit",
        "setContentType",
      ].sort();

      expect(keys).toEqual(expectedMethods);

      // these props are intentionally non-enumerable, but should still exist:
      expect("destroyed" in wrapper).toBe(true);
      expect("_onBeforeFirstWrite" in wrapper).toBe(true);

      // PROPS_READ_ONLY are also non-enumerable
      expect("writableFinished" in wrapper).toBe(true);
      expect("writableHighWaterMark" in wrapper).toBe(true);
    });
  });
});
