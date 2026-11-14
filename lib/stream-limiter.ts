/** Enforce image byte quota while consuming a response, not after buffering it. */
export async function readBoundedStream(
  source: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (!source || !Number.isSafeInteger(maxBytes) || maxBytes < 1) return null;
  const reader = source.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || length + value.byteLength > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
      length += value.byteLength;
    }
    if (length === 0) return null;
    const output = new Uint8Array(length);
    let cursor = 0;
    for (const chunk of chunks) {
      output.set(chunk, cursor);
      cursor += chunk.byteLength;
    }
    return output;
  } catch {
    await reader.cancel().catch(() => {});
    return null;
  } finally {
    reader.releaseLock();
  }
}
