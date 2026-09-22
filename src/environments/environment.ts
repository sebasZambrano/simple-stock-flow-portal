/**
 * The URL is relative on purpose: nginx serves the bundle and proxies /api to the service,
 * so the front end never knows the backend host.
 */
export const environment = {
  production: true,
  apiUrl: '/api',
};
