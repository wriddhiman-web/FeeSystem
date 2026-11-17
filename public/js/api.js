// Small API fetch wrapper
let csrfToken = '';

export function setCsrfToken(token) {
  csrfToken = token;
}

export async function api(endpoint, method = 'GET', body = null) {
  const headers = { 'Accept': 'application/json' };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }

  const opts = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  try {
    const res = await fetch(endpoint, opts);
    if (res.status === 401 && !endpoint.includes('auth.php')) {
      window.location.href = 'index.html';
      return { ok: false, error: 'Unauthorized' };
    }
    const data = await res.json().catch(() => ({ ok: false, error: 'Invalid response from server' }));
    return data;
  } catch (err) {
    return { ok: false, error: err.message || 'Network error' };
  }
}
