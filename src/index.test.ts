import { describe, it, expect, vi } from "vitest";

vi.mock("./worker/ignition.js", () => ({
  ignition: vi.fn().mockResolvedValue(undefined),
}));

describe("index", () => {
  it("should call ignition", async () => {
    // GIVEN
    const { ignition } = await import("./worker/ignition.js");

    // WHEN
    await import("./index.js");

    // THEN
    expect(ignition).toHaveBeenCalled();
  });
});
