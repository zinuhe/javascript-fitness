import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { tokenStore } from '../api/client';
import { handlers, resetApi } from './api';

export const server = setupServer(...handlers);

beforeAll(() => {
  // Any request without a handler is a bug in the test or the app: fail loudly.
  server.listen({ onUnhandledFrame: 'error' });
  // Node's fetch can't send jsdom's FormData (two different Blob implementations), so tests
  // encode uploads themselves, as a browser would: multipart bytes with their boundary.
  // Installed after listen(), so it runs before MSW sees the request.
  const intercepted = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (!(init?.body instanceof FormData)) return intercepted(input, init);
    const boundary = 'test-form-boundary';
    const headers = new Headers(init.headers);
    headers.set('content-type', `multipart/form-data; boundary=${boundary}`);
    return intercepted(input, {
      ...init,
      headers,
      body: await encodeMultipart(init.body, boundary),
    });
  };
  // jsdom doesn't implement scrolling; the router's scroll restoration calls it, and the
  // workout form scrolls back to a taken date.
  window.scrollTo = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetApi();
  tokenStore.clear();
  localStorage.clear(); // view preferences (catalog sort, filters)
});

afterAll(() => server.close());

async function encodeMultipart(form: FormData, boundary: string): Promise<Uint8Array<ArrayBuffer>> {
  const text = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const [name, value] of form.entries()) {
    const head =
      typeof value === 'string'
        ? `Content-Disposition: form-data; name="${name}"\r\n`
        : `Content-Disposition: form-data; name="${name}"; filename="${value.name || name}"\r\n` +
          `Content-Type: ${value.type || 'application/octet-stream'}\r\n`;
    chunks.push(text.encode(`--${boundary}\r\n${head}\r\n`));
    chunks.push(
      typeof value === 'string' ? text.encode(value) : new Uint8Array(await value.arrayBuffer()),
    );
    chunks.push(text.encode('\r\n'));
  }
  chunks.push(text.encode(`--${boundary}--\r\n`));
  const body = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
}
