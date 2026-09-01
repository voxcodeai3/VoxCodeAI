import api from './api';

export const learningMemoryApi = {
  getMemory: () => api.get('/learning/memory').then(r => r.data),
  getResume: () => api.get('/learning/memory/resume').then(r => r.data),
  updateProgress: (payload) => api.post('/learning/memory/progress', payload).then(r => r.data),
  addWeakTopic: (topic) => api.post('/learning/memory/weak-topic', { topic }).then(r => r.data),
  saveExercise: (payload) => api.post('/learning/memory/exercise', payload).then(r => r.data),
  saveQuiz: (payload) => api.post('/learning/memory/quiz', payload).then(r => r.data),
  saveProject: (payload) => api.post('/learning/memory/project', payload).then(r => r.data),
  getWeakTopics: () => api.get('/learning/memory/weak-topics').then(r => r.data),
};

export default learningMemoryApi;
