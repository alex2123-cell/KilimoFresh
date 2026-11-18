// Talks to the back end's REST API. Every page uses this one module.

export class ApiError extends Error {
  constructor(message, status, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields; // { fieldName: 'what is wrong' } from server validation
  }
}

async function request(method, path, body) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('We could not reach the server. Check your connection and try again.', 0);
  }
  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || 'Something went wrong. Please try again.', response.status, data.fields);
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),

  produce: () => request('GET', '/produce').then((d) => d.items),
  zones: () => request('GET', '/zones').then((d) => d.items),
};
