const GLS_ALLOWED = [
  'https://sandbox-smart4i.gls-canada.com',
  'https://smart4i.gls-canada.com'
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-Gls-Target',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/gls-rate')) {
      return handleGlsProxy(request, url);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleGlsProxy(request, url) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (request.method !== 'POST') {
    return new Response('POST seulement', { status: 405, headers: CORS });
  }

  const target = request.headers.get('X-Gls-Target');
  if (!GLS_ALLOWED.includes(target)) {
    return new Response('Cible non autorisée', { status: 400, headers: CORS });
  }

  const subpath = url.pathname.replace('/api/gls-rate', '') || '';
  const upstream = target + '/v1/rate' + subpath + url.search;

  const res = await fetch(upstream, {
    method: 'POST',
    headers: {
      'Authorization': request.headers.get('Authorization') ?? '',
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
