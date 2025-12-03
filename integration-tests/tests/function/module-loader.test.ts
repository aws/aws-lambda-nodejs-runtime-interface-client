import { describe, it, expect } from "vitest";
import path from "path";
import { loadModule } from "../../../src/function/module-loader";
import { ModuleLoaderOptions } from "../../../src/function";
import { ImportModuleError, UserCodeSyntaxError } from "../../../src/utils";

const APP_ROOT = path.join(__dirname, "../../test-files/module-loader");

describe("module-loader", () => {
  describe("loadModule", () => {
    it("should load an echo file", async () => {
      // GIVEN
      const options: ModuleLoaderOptions = {
        appRoot: APP_ROOT,
        moduleRoot: "",
        moduleName: "echo",
      };

      // WHEN
      const module = await loadModule(options);

      // THEN
      expect(module).toHaveProperty("echo");
      expect(module.echo).toBeInstanceOf(Function);
      expect(module.echo("hello")).toBe("hello");
    });

    it("should load a deeply nested file", async () => {
      // GIVEN
      const options: ModuleLoaderOptions = {
        appRoot: APP_ROOT,
        moduleRoot: "deeply/nested/dir",
        moduleName: "index",
      };

      // WHEN
      const module = await loadModule(options);

      // THEN
      expect(module).toHaveProperty("handler");
      expect(module.handler).toBeInstanceOf(Function);
      expect(module.handler()).toBe("Hello from index.js");
    });

    it("should throw a ImportModuleError if the module does not exists", async () => {
      // GIVEN
      const options: ModuleLoaderOptions = {
        appRoot: APP_ROOT,
        moduleRoot: "some_random_dir",
        moduleName: "this_does_not_exist",
      };

      // WHEN & THEN
      await expect(loadModule(options)).rejects.toThrow(ImportModuleError);
    });

    it("should throw a UserCodeSyntaxError if the module had bad syntax", async () => {
      // GIVEN
      const options: ModuleLoaderOptions = {
        appRoot: APP_ROOT,
        moduleRoot: "",
        moduleName: "python",
      };

      // WHEN & THEN
      await expect(loadModule(options)).rejects.toThrow(UserCodeSyntaxError);
    });

    it("should propogate errors upstread coming from the module", async () => {
      // GIVEN
      const options: ModuleLoaderOptions = {
        appRoot: APP_ROOT,
        moduleRoot: "",
        moduleName: "error",
      };

      // WHEN & THEN
      await expect(loadModule(options)).rejects.toThrow("Random Foo Error");
    });

    it("should give precedence to extensionless module", async () => {
      // GIVEN
      const options: ModuleLoaderOptions = {
        appRoot: APP_ROOT,
        moduleRoot: "precedence-extensionless",
        moduleName: "cjs-module",
      };

      // WHEN
      const module = await loadModule(options);

      // THEN
      expect(module).toHaveProperty("greet");
      expect(module.greet).toBeInstanceOf(Function);
      expect(module.greet()).toBe("Hello from extensionless!");
    });

    it("should give precedence to .js module in absense of extensionless", async () => {
      // GIVEN
      const options: ModuleLoaderOptions = {
        appRoot: APP_ROOT,
        moduleRoot: "precedence-js",
        moduleName: "hello",
      };

      // WHEN
      const module = await loadModule(options);

      // THEN
      expect(module).toHaveProperty("handler");
      expect(module.handler).toBeInstanceOf(Function);
      expect(module.handler()).toBe("Hello from hello.js");
    });

    it("should give precedence to .mjs module in absense of extensionless and .js", async () => {
      // GIVEN
      const options: ModuleLoaderOptions = {
        appRoot: APP_ROOT,
        moduleRoot: "precedence-mjs",
        moduleName: "hello",
      };

      // WHEN
      const module = await loadModule(options);

      // THEN
      expect(module).toHaveProperty("handler");
      expect(module.handler).toBeInstanceOf(Function);
      expect(module.handler()).toBe("Hello from hello.mjs");
    });
  });
});
