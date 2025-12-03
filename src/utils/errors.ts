export class NativeClientLoadingError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "Runtime.NativeClientLoading";
  }
}

export class HandlerNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "Runtime.HandlerNotFound";
  }
}

export class MalformedHandlerNameError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "Runtime.MalformedHandlerName";
  }
}

export class ImportModuleError extends Error {
  public constructor(originalError: Error) {
    super(String(originalError));
    this.name = "Runtime.ImportModuleError";
  }
}

export class UserCodeSyntaxError extends Error {
  public constructor(originalError: Error) {
    super(String(originalError));
    this.name = "Runtime.UserCodeSyntaxError";
    this.stack = originalError.stack;
  }
}

export class InvalidStreamingOperation extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "Runtime.InvalidStreamingOperation";
  }
}

export class MalformedStreamingHandler extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "Runtime.MalformedStreamingHandler";
  }
}

export class JSONStringifyError extends Error {
  public constructor(message: string = "Unable to stringify response body") {
    super(message);
    this.name = "Runtime.JSONStringifyError";
  }
}

export class PlatformError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "Runtime.PlatformError";
  }
}

export class CallbackHandlerDeprecatedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "Runtime.CallbackHandlerDeprecated";
  }
}
