/**
 * Helper adaptativo para peticiones a la API
 * - En local (NODE_ENV=development): usa REACT_APP_BACKEND_URL (http://localhost:8001)
 * - En Vercel (producción): usa rutas relativas /api/* (mismo dominio)
 */

const isDev = process.env.NODE_ENV === 'development';
const backendUrl = process.env.REACT_APP_BACKEND_URL || '';

export const API_BASE = isDev && backendUrl ? `${backendUrl}/api` : '/api';

export default API_BASE;
