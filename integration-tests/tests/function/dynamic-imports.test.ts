import { describe, it, expect } from "vitest";
import path from "path";
import { tryAwaitImport } from "../../../src/function/dynamic-imports";

const testDir = path.join(__dirname, "../../test-files/dynamic-imports");
const intentTestDir = path.join(__dirname, "../../test-files/loading-intent");

describe("dynamic-imports", () => {
  describe("tryAwaitImport", () => {
    // tryRequireESM deduces CJS vs ESM by looking at the syntax itself
    const combinations = [
      { extension: "", moduleType: "cjs-module", expectation: "defaults" }, // Extensionless + CJS
      { extension: ".js", moduleType: "cjs-module", expectation: "defaults" }, // .js + CJS
      { extension: ".cjs", moduleType: "cjs-module", expectation: "defaults" }, // .cjs + CJS
      // ! The following scenario should throw but vitest's test runner won't catch it since it runs TS on the fly. Needs to be tested by E2E/Test Harness
      { extension: ".mjs", moduleType: "cjs-module", expectation: "defaults" }, // .mjs +  CJS
      { extension: "", moduleType: "esm-module", expectation: "throw" }, // Extensionless + ESM
      { extension: ".js", moduleType: "esm-module", expectation: "throw" }, // .js + ESM
      { extension: ".cjs", moduleType: "esm-module", expectation: "throw" }, // .cjs + ESM
      { extension: ".mjs", moduleType: "esm-module", expectation: "load" }, // .mjs + CJS
    ];

    combinations.forEach(({ extension, moduleType, expectation }) => {
      it(`should ${expectation} for file with extension ${extension || "(none)"} and module type ${moduleType}`, async () => {
        const filePathWithoutExtension = path.join(testDir, moduleType);

        if (expectation === "load") {
          // WHEN & THEN
          const result = await tryAwaitImport(
            filePathWithoutExtension,
            extension,
          );
          expect(result).toHaveProperty("greet");
          expect(result.greet).toBeInstanceOf(Function);
          expect(result.greet()).toBe("Hello from ESM!");
        } else if (expectation === "defaults") {
          // WHEN & THEN
          const result = await tryAwaitImport(
            filePathWithoutExtension,
            extension,
          );
          expect(result.default).toEqual({ greet: expect.any(Function) });
          expect(result).toHaveProperty("greet");
          expect(result.greet).toBeInstanceOf(Function);
          expect(result.greet()).toBe("Hello from CJS!");
        } else {
          // WHEN & THEN
          await expect(() => {
            return tryAwaitImport(filePathWithoutExtension, extension);
          }).rejects.toThrow();
        }
      });
    });

    it("should return undefined if the file does not exist", async () => {
      // GIVEN
      const filePath = path.join(testDir, "nonexistent-file.cjs");

      // WHEN
      const result = await tryAwaitImport(filePath);

      // THEN
      expect(result).toBeUndefined();
    });

    it("should handle undefined extension", async () => {
      // GIVEN
      const cjsFilePathWithoutExtension = path.join(testDir, "cjs-module");
      const esmFilePathWithoutExtension = path.join(testDir, "esm-module");

      // WHEN & THEN
      // Test for CJS module with null extension
      const result = await tryAwaitImport(cjsFilePathWithoutExtension);
      expect(result).toHaveProperty("greet");
      expect(result.greet).toBeInstanceOf(Function);
      expect(result.greet()).toBe("Hello from CJS!");

      // WHEN & THEN
      // Test for ESM module with null extension
      await expect(() => {
        return tryAwaitImport(esmFilePathWithoutExtension);
      }).rejects.toThrow();
    });

    it("should handle nearest package.json intent set to ESM", async () => {
      // GIVEN
      const esmModulePath = path.join(
        intentTestDir,
        "esm-intent",
        "esm-module.js",
      );

      const cjsModulePath = path.join(
        intentTestDir,
        "esm-intent",
        "cjs-module.js",
      );

      // WHEN & THEN
      const result = await tryAwaitImport(esmModulePath);
      expect(result).toHaveProperty("greet");
      expect(result.greet).toBeInstanceOf(Function);
      expect(result.greet()).toBe("Hello from ESM!");

      await expect(() => {
        return tryAwaitImport(cjsModulePath);
      }).rejects.toThrow();
    });

    it("should handle deeply nested nearest package.json intent set to ESM", async () => {
      // GIVEN
      const esmModulePath = path.join(
        intentTestDir,
        "esm-intent",
        "deeply",
        "nested",
        "dir",
        "esm-module.js",
      );

      const cjsModulePath = path.join(
        intentTestDir,
        "esm-intent",
        "deeply",
        "nested",
        "dir",
        "cjs-module.js",
      );

      // WHEN & THEN
      const result = await tryAwaitImport(esmModulePath);
      expect(result).toHaveProperty("greet");
      expect(result.greet).toBeInstanceOf(Function);
      expect(result.greet()).toBe("Hello from ESM!");

      await expect(() => {
        return tryAwaitImport(cjsModulePath);
      }).rejects.toThrow();
    });

    it("should handle nearest package.json intent set to CJS", async () => {
      // GIVEN
      const esmModulePath = path.join(
        intentTestDir,
        "cjs-intent",
        "esm-module.js",
      );

      const cjsModulePath = path.join(
        intentTestDir,
        "cjs-intent",
        "cjs-module.js",
      );

      // WHEN & THEN
      const result = await tryAwaitImport(cjsModulePath);
      expect(result).toHaveProperty("greet");
      expect(result.greet).toBeInstanceOf(Function);
      expect(result.greet()).toBe("Hello from CJS!");

      await expect(() => {
        return tryAwaitImport(esmModulePath);
      }).rejects.toThrow();
    });

    it("should handle deeply nested nearest package.json intent set to CJS", async () => {
      // GIVEN
      const esmModulePath = path.join(
        intentTestDir,
        "cjs-intent",
        "deeply",
        "nested",
        "dir",
        "esm-module.js",
      );

      const cjsModulePath = path.join(
        intentTestDir,
        "cjs-intent",
        "deeply",
        "nested",
        "dir",
        "cjs-module.js",
      );

      // WHEN & THEN
      const result = await tryAwaitImport(cjsModulePath);
      expect(result).toHaveProperty("greet");
      expect(result.greet).toBeInstanceOf(Function);
      expect(result.greet()).toBe("Hello from CJS!");

      await expect(() => {
        return tryAwaitImport(esmModulePath);
      }).rejects.toThrow();
    });
  });
});
