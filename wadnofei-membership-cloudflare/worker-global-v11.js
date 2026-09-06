import app from './worker-global-v10.js';
import { LOGO_B64, LOGO_MIME } from './logo.js';

const DATA_URI = `data:${LOGO_MIME};base64,${LOGO_B64}`;
const LOGO_PATH = '/wdn-logo.jpg?v=11';

function logoResponse() {
  const raw = atob(LOGO_B64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      'content-type': LOGO_MIME,
      'cache-control': 'public, max-age=86400',
      'x-content-type-options': 'nosniff'
    }
  });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/wdn-logo.jpg') return logoResponse();

    const response = await app.fetch(req, env, ctx);
    const type = response.headers.get('content-type') || '';
    if (req.method !== 'GET' || !type.includes('text/html')) return response;

    let html = await response.text();
    html = html.split(DATA_URI).join(LOGO_PATH);

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-store, max-age=0');
    headers.set('x-wadnofei-ui', 'v11-logo-route');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
