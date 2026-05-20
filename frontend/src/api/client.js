import axios from 'axios';

const apiBase = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

const api = axios.create({
  baseURL: apiBase,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
