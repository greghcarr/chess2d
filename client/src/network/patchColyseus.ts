// Patch colyseus.js WebSocketTransport for browser compatibility.
// colyseus.js v0.15 passes { headers, protocols } as the 2nd arg to WebSocket,
// which browsers reject. This wraps the global WebSocket to handle that.

const OriginalWebSocket = globalThis.WebSocket;

globalThis.WebSocket = function PatchedWebSocket(
  url: string | URL,
  protocols?: string | string[] | Record<string, unknown>
) {
  // If protocols is an object (Node-style options), extract the actual protocols
  if (protocols && typeof protocols === "object" && !Array.isArray(protocols)) {
    const opts = protocols as Record<string, unknown>;
    return new OriginalWebSocket(url, opts.protocols as string | string[] | undefined);
  }
  return new OriginalWebSocket(url, protocols as string | string[]);
} as unknown as typeof WebSocket;

// Copy static properties
Object.assign(globalThis.WebSocket, OriginalWebSocket);
globalThis.WebSocket.prototype = OriginalWebSocket.prototype;
