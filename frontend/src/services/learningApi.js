import api from './api';

export const learningApi = {
  getCategories: () => api.get('/learning/categories').then(r => r.data),
  getTechnologies: (params = {}) => api.get('/learning/technologies', { params }).then(r => r.data),
  getTechnology: (slug) => api.get(`/learning/technologies/${slug}`).then(r => r.data),
  getPaths: (params = {}) => api.get('/learning/paths', { params }).then(r => r.data),
  getPath: (pathId) => api.get(`/learning/paths/${pathId}`).then(r => r.data),
  getPathStages: (pathId) => api.get(`/learning/paths/${pathId}/stages`).then(r => r.data),
  getStageTopics: (stageId) => api.get(`/learning/stages/${stageId}/topics`).then(r => r.data),
  getTopicLessons: (topicId) => api.get(`/learning/topics/${topicId}/lessons`).then(r => r.data),
};

export default learningApi;
