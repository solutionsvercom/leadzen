import api from './client';

const adminApi = {
  getClients: (params) => api.get('/admin/clients', { params }),
  getClient: (businessId, params) => api.get(`/admin/clients/${businessId}`, { params }),
  updateUser: (userId, data) => api.put(`/admin/users/${userId}`, data),
  updateClient: (businessId, data) => api.put(`/admin/clients/${businessId}`, data),
  deleteClient: (businessId) => api.delete(`/admin/clients/${businessId}`),
  addSheetLink: (businessId, data) => api.post(`/admin/clients/${businessId}/sheet-links`, data),
  updateSheetLink: (businessId, linkId, data) =>
    api.put(`/admin/clients/${businessId}/sheet-links/${linkId}`, data),
  deleteSheetLink: (businessId, linkId) =>
    api.delete(`/admin/clients/${businessId}/sheet-links/${linkId}`),
  syncClient: (businessId) => api.post(`/admin/clients/${businessId}/sync`),
  getPlatforms: () => api.get('/admin/platforms'),
  createPlatform: (data) => api.post('/admin/platforms', data),
  updatePlatform: (id, data) => api.put(`/admin/platforms/${id}`, data),
  deletePlatform: (id) => api.delete(`/admin/platforms/${id}`),
};

export default adminApi;
