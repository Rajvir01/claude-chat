export interface RawSSEEvent {
  event: string;
  data: string;
}

/**
 * Turns a streamed response body into Server-Sent Events.
 *
 * The network delivers bytes in arbitrary chunks: one chunk can hold half an
 * event, or three events at once. So we keep a text buffer and only cut out
 * an event once we've seen its terminating blank line ("\n\n").
 */
export async function* readSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<RawSSEEvent> {
  const reader = body.getReader();
  // { stream: true } handles a multi-byte character (like an emoji) that
  // gets split across two network chunks.
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) return;

    buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let event = "message";
      const dataLines: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length > 0) yield { event, data: dataLines.join("\n") };
    }
  }
}
