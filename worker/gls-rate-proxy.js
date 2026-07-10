const ALLOWED = [
  'https://sandbox-smart4i.gls-canada.com',
  'https://smart4i.gls-canada.com'
];

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-Gls-Target',
      'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST')    return new Response('POST seulement', { status: 405, headers: cors });

    const target = request.headers.get('X-Gls-Target');
    if (!ALLOWED.includes(target)) {
      return new Response('Cible non autorisée', { status: 400, headers: cors });
    }

    const incoming = new URL(request.url);
    const upstream = target + '/v1' + incoming.pathname + incoming.search;

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
      headers: { ...cors, 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' }
    });
  }
};
