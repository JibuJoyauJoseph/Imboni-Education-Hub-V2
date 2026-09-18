const BASE_URL = import.meta.env.VITE_API_URL || 'https://imboni-education-hub-v2-production.up.railway.app/api';
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

async function request(path, { method = 'GET', body, isForm = false, token } = {}) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  const storedToken = token || localStorage.getItem('imboni_token');
  if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || 'Request failed');
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts = {}) => request(path, { method: 'POST', body, ...opts }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' })
};
