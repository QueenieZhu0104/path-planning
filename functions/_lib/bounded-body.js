export class RequestBodyError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'RequestBodyError';
    this.code = code;
    this.status = status;
  }
}

function declaredLength(headers) {
  const raw = headers?.get?.('content-length');
  if (raw == null || !/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

export async function readBoundedText(message, maxBytes, tooLargeCode = 'body_too_large') {
  const statedLength = declaredLength(message?.headers);
  if (statedLength != null && statedLength > maxBytes) throw new Error(tooLargeCode);

  if (!message?.body) return '';
  const reader = message.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel(tooLargeCode).catch(() => {});
        throw new Error(tooLargeCode);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function readJsonRequest(request, maxBytes) {
  let text;
  try {
    text = await readBoundedText(request, maxBytes, 'request_too_large');
  } catch (error) {
    if (error?.message === 'request_too_large') throw new RequestBodyError('request_too_large', 413);
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestBodyError('invalid_json', 400);
  }
}
