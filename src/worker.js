const GLS_ALLOWED = [
  'https://sandbox-smart4i.gls-canada.com',
  'https://smart4i.gls-canada.com'
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-Gls-Target, X-Admin-Pass',
  'Access-Control-Max-Age': '86400'
};

const SETTINGS_KEY = 'gls-settings';
const ADMIN_HASH = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname === '/api/settings') {
      return handleSettings(request, env);
    }

    if (url.pathname === '/api/settings/public') {
      return handlePublicSettings(env);
    }

    if (url.pathname.startsWith('/api/gls-rate')) {
      return handleGlsProxy(request, url, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function verifyAdmin(request) {
  const pass = request.headers.get('X-Admin-Pass') || '';
  const hash = await sha256(pass);
  return hash === ADMIN_HASH;
}

async function handleSettings(request, env) {
  if (request.method === 'GET') {
    if (!(await verifyAdmin(request))) {
      return new Response('Non autorisé', { status: 401, headers: CORS });
    }
    const data = await env.SETTINGS.get(SETTINGS_KEY);
    return new Response(data || '{}', { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  if (request.method === 'POST') {
    if (!(await verifyAdmin(request))) {
      return new Response('Non autorisé', { status: 401, headers: CORS });
    }
    const body = await request.text();
    await env.SETTINGS.put(SETTINGS_KEY, body);
    return new Response('OK', { headers: CORS });
  }

  return new Response('Method not allowed', { status: 405, headers: CORS });
}

async function handlePublicSettings(env) {
  const raw = await env.SETTINGS.get(SETTINGS_KEY);
  const cfg = raw ? JSON.parse(raw) : {};
  const pub = { factor: cfg.factor ?? 25, env: cfg.env || 'https://sandbox-smart4i.gls-canada.com' };
  return new Response(JSON.stringify(pub), { headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function handleGlsProxy(request, url, env) {
  if (request.method !== 'POST') {
    return new Response('POST seulement', { status: 405, headers: CORS });
  }

  const raw = await env.SETTINGS.get(SETTINGS_KEY);
  const cfg = raw ? JSON.parse(raw) : {};

  const target = request.headers.get('X-Gls-Target') || cfg.env || 'https://sandbox-smart4i.gls-canada.com';
  if (!GLS_ALLOWED.includes(target)) {
    return new Response('Cible non autorisée', { status: 400, headers: CORS });
  }

  const user = cfg.apiUser || '';
  const pass = cfg.apiPass || '';
  const auth = 'Basic ' + btoa(user + ':' + pass);

  const subpath = url.pathname.replace('/api/gls-rate', '') || '';
  const upstream = target + '/v1/rate' + subpath + url.search;

  const res = await fetch(upstream, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: await request.text()
  });

  return new Response(res.body, {
    status: res.status,
    headers: { ...CORS, 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' }
  });
}
