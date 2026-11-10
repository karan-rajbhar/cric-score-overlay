import type { NextRequest } from "next/server";

/**
 * A POST whose body streams `chunks` pieces of `chunkBytes` bytes and
 * declares no content-length, the way a client can send a body of any
 * size. `pulled()` says how many pieces the route read.
 */
export function streamedRequest(
  url: string,
  {
    chunkBytes = 1024,
    chunks = 1024,
    headers = {},
  }: { chunkBytes?: number; chunks?: number; headers?: HeadersInit } = {},
): { request: NextRequest; pulled: () => number } {
  let pulled = 0;
  const piece = new Uint8Array(chunkBytes).fill(0x78);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled >= chunks) {
        controller.close();
        return;
      }
      pulled += 1;
      controller.enqueue(piece);
    },
  });
  const request = new Request(url, {
    method: "POST",
    headers,
    body,
    duplex: "half",
  } as RequestInit);
  return { request: request as unknown as NextRequest, pulled: () => pulled };
}
