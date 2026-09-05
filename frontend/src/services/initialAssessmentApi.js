import api from './api';

export async function startAssessment(learningPathId) {
  const { data } = await api.post('/learning/assessment/start', { learningPathId });
  return data;
}

export async function getAssessment(id) {
  const { data } = await api.get(`/learning/assessment/${id}`);
  return data;
}

export async function getByPath(pathId) {
  const { data } = await api.get(`/learning/assessment/by-path/${pathId}`);
  return data;
}

export async function submitAnswer(id, questionId, answer) {
  const { data } = await api.post(`/learning/assessment/${id}/answer`, { questionId, answer });
  return data;
}

export async function completeAssessment(id) {
  const { data } = await api.post(`/learning/assessment/${id}/complete`);
  return data;
}
