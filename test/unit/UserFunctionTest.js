/**
 * Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

require('should');
const path = require('path');
const {
  HandlerNotFound,
  ImportModuleError,
  MalformedHandlerName,
  UserCodeSyntaxError,
} = require('lambda-runtime/Errors.js');
const UserFunction = require('lambda-runtime/UserFunction.js');

const TEST_ROOT = path.join(__dirname, '../');
const HANDLERS_ROOT = path.join(TEST_ROOT, 'handlers');

describe('UserFunction.load method', () => {
  const echoTestMessage = 'This is a echo test';
  it('should successfully load a user function', async () => {
    const handler = await UserFunction.load(HANDLERS_ROOT, 'core.echo');
    const response = await handler(echoTestMessage);

    response.should.equal(echoTestMessage);
  });

  it('should successfully load a user function nested in an object', async () => {
    const handler = await UserFunction.load(
      HANDLERS_ROOT,
      'nestedHandler.nested.somethingComplex.handler',
    );
    const response = await handler();

    response.should.equal('something interesting');
  });

  it('should successfully load a user function with a path to the module', async () => {
    const handler = await UserFunction.load(
      TEST_ROOT,
      'handlers/nestedHandler.nested.somethingComplex.handler',
    );
    const response = await handler();

    response.should.equal('something interesting');
  });

  it("should throw a MalformedHandlerName error if the handler string contains '..'", () => {
    UserFunction.load(
      HANDLERS_ROOT,
      'malformed..handler',
    ).should.be.rejectedWith(MalformedHandlerName);
  });

  it('should throw a MalformedHandlerName error if the handler string does not contain a dot', () => {
    UserFunction.load(HANDLERS_ROOT, 'malformedHandler').should.be.rejectedWith(
      MalformedHandlerName,
    );
  });

  it('should throw a MalformedHandlerName error if the path to the handler does not exists and malformed handler', () => {
    UserFunction.load(
      path.join(HANDLERS_ROOT, 'non/existent/path'),
      'malformedHandler',
    ).should.be.rejectedWith(MalformedHandlerName);
  });

  it('should throw a ImportModuleError error if the module does not exists', () => {
    UserFunction.load(HANDLERS_ROOT, 'noModule.echo').should.be.rejectedWith(
      ImportModuleError,
    );
  });

  it('should throw a HandlerNotFound error if the handler does not exists', () => {
    UserFunction.load(
      HANDLERS_ROOT,
      'nestedHandler.nested.somethingComplex.nonHandler',
    ).should.be.rejectedWith(HandlerNotFound);
  });

  it('should throw a HandlerNotFound error if the handler is not a function', () => {
    UserFunction.load(
      HANDLERS_ROOT,
      'core.noFunctionHandler',
    ).should.be.rejectedWith(HandlerNotFound);
  });

  it('should successfully load a user function in an ES module in a file with .mjs extension', async () => {
    const handler = await UserFunction.load(HANDLERS_ROOT, 'esModule.echo');
    const response = await handler(echoTestMessage);

    response.should.equal(echoTestMessage);
  });

  it('should successfully load a user function CommonJS module in a file with .cjs extension', async () => {
    const handler = await UserFunction.load(HANDLERS_ROOT, 'cjsModule.echo');
    const response = await handler(echoTestMessage);

    response.should.equal(echoTestMessage);
  });

  it('should default to load the cjs module without extension', async () => {
    // There are multiple files named precendence with different extensions
    // and the .js file should have precedence over all but the current implementation gives
    // priority to files without extension.
    const handler = await UserFunction.load(
      HANDLERS_ROOT,
      'precedence.handler',
    );
    const response = await handler();

    // Currently files without extension have higher precedence over .js files
    response.should.equal("I don't have a .js file suffix");
  });

  it('should default to load the .js file over the .mjs module', async () => {
    // The .js file should be loaded instead of the .mjs file
    const handler = await UserFunction.load(
      HANDLERS_ROOT,
      'precedenceJsVsMjs.handler',
    );
    const response = await handler();

    response.should.equal('I do have a .js file suffix');
  });

  it('should default to load the .mjs file over the .cjs module', async () => {
    // The .mjs file should be loaded instead of the .cjs file
    const handler = await UserFunction.load(
      HANDLERS_ROOT,
      'precedenceMjsVsCjs.handler',
    );
    const response = await handler();

    response.should.equal('I do have a .mjs file suffix');
  });

  it('should support init', async () => {
    // The asyncInit module has a top level await on a timer to set a flag
    // If at the time of invocation, the flag is not set, the handler will throw an Error
    const handler = await UserFunction.load(HANDLERS_ROOT, 'asyncInit.handler');
    const response = await handler();

    response.should.equal('Hi');
  });

  it('should support init in .js files in packages using the module type', async () => {
    // The asyncInit module has a top level await on a timer to set a flag
    // If at the time of invocation, the flag is not set, the handler will throw an Error
    const handler = await UserFunction.load(
      path.join(HANDLERS_ROOT, 'async_init_package'),
      'index.handler',
    );
    const response = await handler();

    response.should.equal('Hi');
  });

  it('should support init in .js files in packages using the module type, nested', async () => {
    const handler = await UserFunction.load(
      path.join(HANDLERS_ROOT, 'async_init_package/nested'),
      'index.handler',
    );
    handler().should.be.resolvedWith(42);
  });

  it('should support init in .js files in packages using the module type, nested even more', async () => {
    const handler = await UserFunction.load(
      path.join(HANDLERS_ROOT, 'async_init_package/nested/even/more'),
      'index.handler',
    );
    handler().should.be.equal(42);
  });

  it('should support init in .js files in packages using the module type, nested even more + moduleRoot', async () => {
    const handler = await UserFunction.load(
      path.join(HANDLERS_ROOT, 'async_init_package/nested'),
      'even/more/index.handler',
    );
    handler().should.be.equal(42);
  });

  it('should use commonjs when package.json cannot be read', async () => {
    const handler = await UserFunction.load(
      path.join(HANDLERS_ROOT, 'async_init_type_not_module'),
      'index.ret42',
    );
    handler().should.be.equal(42);
  });

  it('should use commonjs when node_modules is reached before package.json', async () => {
    const handler = await UserFunction.load(
      path.join(HANDLERS_ROOT, 'async_init_with_node_modules'),
      'node_modules/index.ret42',
    );
    handler().should.be.equal(42);
  });

  it('should bubble up rejections occurred during init as errors', async () => {
    try {
      await UserFunction.load(HANDLERS_ROOT, 'asyncInitRejection.handler');

      should.fail('The rejection did not bubble up!');
    } catch (error) {
      error.should.be.instanceof(Error);
      error.name.should.equal('AsyncInitRejectionException');
      error.message.should.equal('Oh noes! something bad happened');
    }
  });

  it('should not load a CommonJS module if the package has the module type defined', () => {
    UserFunction.load(
      path.join(HANDLERS_ROOT, 'async_init_package'),
      'cjsModuleInEsmPackage.echo',
    ).should.be.rejectedWith(/exports is not defined in ES module scope/);
  });

  it('should throw a ImportModuleError error if the module does not exists', () => {
    UserFunction.load(HANDLERS_ROOT, 'noModule.echo').should.be.rejectedWith(
      ImportModuleError,
    );
  });

  it("should successfully load a user function exported as 'default'", async () => {
    const handler = await UserFunction.load(
      HANDLERS_ROOT,
      'defaultHandler.default',
    );
    const response = handler();

    response.should.be.equal(42);
  });

  it("should successfully load a user function exported as 'default', esm", async () => {
    const handler = await UserFunction.load(
      HANDLERS_ROOT,
      'defaultHandlerESM.default',
    );
    const response = handler();

    response.should.be.equal(42);
  });

  it('should successfully load a user function that uses different import styles, esm', async () => {
    const handler = await UserFunction.load(
      HANDLERS_ROOT,
      'esModuleImports.echo',
    );
    const response = handler('moon');

    response.should.be.resolvedWith('moon');
  });

  it('should successfully load a CJS handler from extensionless file (no package.json)', async () => {
    const handler = await UserFunction.load(
      path.join(HANDLERS_ROOT, 'extensionless'),
      'index.handler',
    );
    const response = await handler('test event');

    response.should.equal('Hello from extensionless CJS');
  });

  xit('should fail to load ESM syntax from extensionless file (no package.json)', async () => {
    await UserFunction.load(
      path.join(HANDLERS_ROOT, 'extensionless'),
      'esm-extensionless.handler',
    ).should.be.rejectedWith(UserCodeSyntaxError);
  });

  it('should load CJS handler from extensionless file with type:commonjs', async () => {
    // package.json is ignored in the case of extensionless
    const handler = await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg', 'type-cjs'),
      'cjs.handler',
    );
    const response = await handler('test event');

    response.should.equal('Hello from extensionless CJS');
  });

  xit('should fail to load ESM handler from extensionless file with type:commonjs', async () => {
    // package.json is ignored in the case of extensionless
    await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg', 'type-cjs'),
      'esm.handler',
    ).should.be.rejectedWith(UserCodeSyntaxError);
  });

  it('should load CJS handler from extensionless file with type:module', async () => {
    // package.json is ignored in the case of extensionless
    const handler = await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg', 'type-esm'),
      'cjs.handler',
    );
    const response = await handler('test event');

    response.should.equal('Hello from extensionless CJS');
  });

  xit('should fail to load ESM handler from extensionless file with type:module', async () => {
    // package.json is ignored in the case of extensionless
    await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg', 'type-esm'),
      'esm.handler',
    ).should.be.rejectedWith(UserCodeSyntaxError);
  });

  it('should load CJS handler from JS file with type:commonjs', async () => {
    const handler = await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg', 'type-cjs'),
      'cjsModule.handler',
    );
    const response = await handler('test event');

    response.should.equal('Hello from CJS.js');
  });

  it('should fail to load ESM handler from JS file with type:commonjs', async () => {
    await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg', 'type-cjs'),
      'esmModule.handler',
    ).should.be.rejectedWith(UserCodeSyntaxError);
  });

  it('should load ESM handler from JS file with type:module', async () => {
    const handler = await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg', 'type-esm'),
      'esmModule.handler',
    );
    const response = await handler('test event');

    response.should.equal('Hello from ESM.js');
  });

  it('should fail to load CJS handler from JS file with type:module', async () => {
    await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg', 'type-esm'),
      'cjsModule.handler',
    ).should.be.rejectedWith(
      ReferenceError,
      /module is not defined in ES module scope/,
    );
  });

  xit('should fail to load ESM handler from JS file without type context', async () => {
    await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg-less'),
      'esmModule.handler',
    ).should.be.rejectedWith(UserCodeSyntaxError);
  });

  it('should fail to load CJS handler from MJS file without type context', async () => {
    await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg-less'),
      'cjsInMjs.handler',
    ).should.be.rejectedWith(
      ReferenceError,
      /module is not defined in ES module scope/,
    );
  });

  it('should fail to load ESM handler from CJS file without type context', async () => {
    await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg-less'),
      'esmInCjs.handler',
    ).should.be.rejectedWith(UserCodeSyntaxError);
  });

  it('should fail to load mixed context handler from JS file without type context', async () => {
    await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg-less'),
      'cjsAndMjs.handler',
    ).should.be.rejectedWith(UserCodeSyntaxError);
  });

  it('should successfully load ESM handler importing from CJS', async () => {
    const handler = await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg-less'),
      'esmImportCjs.handler',
    );

    const response = await handler();
    response.should.equal('Hello from CJS!');
  });

  it('should fail when CJS tries to import from ESM using static import', async () => {
    await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg-less'),
      'cjsImportESM.handler',
    ).should.be.rejectedWith(UserCodeSyntaxError);
  });

  it('should successfully load CJS handler importing from CJS', async () => {
    const handler = await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg-less'),
      'cjsImportCjs.handler',
    );

    const response = await handler();
    response.should.equal('Hello from CJS!');
  });

  it('should fail when using require in .mjs', async () => {
    await UserFunction.load(
      path.join(HANDLERS_ROOT, 'pkg-less'),
      'esmRequireCjs.handler',
    ).should.be.rejectedWith(
      ReferenceError,
      /require is not defined in ES module scope/,
    );
  });
});

describe('type guards HandlerFunction', () => {
  it('should compile the code', () => {
    const func = () => {};
    if (UserFunction.isHandlerFunction(func)) {
      func();
    }
  });

  it('should return true if function', () => {
    UserFunction.isHandlerFunction(() => {}).should.be.true();
  });

  it('should return false if not function', () => {
    UserFunction.isHandlerFunction('MyHandler').should.be.false();
  });
});
