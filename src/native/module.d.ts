declare module "*rapid-client.node" {
  export interface NativeClient {
    next(): Promise<{
      bodyJson: string;
      headers: Record<string, string>;
    }>;
    done(id: string, response: string): void;
    error(id: string, errorResponse: string, xrayResponse: string): void;
  }

  const client: NativeClient;
  export = client;
}
