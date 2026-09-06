import api from './api';

// Backend is authoritative; frontend only displays state and sends actions.
export async function getReview(pathId) {
  const { data } = await api.get('/learning/progress/review', { params: pathId ? { pathId } : {} });
  return data.items || [];
}

export async function markReviewed(topicId, pathId) {
  const { data } = await api.post(`/learning/progress/review/${topicId}`, pathId ? { pathId } : {});
  return data;
}

export async function getProgressionCheck(pathId, topicId) {
  const { data } = await api.get('/learning/progress/check', { params: { pathId, topicId } });
  return data;
}

export async function getProgressSummary(pathId) {
  const { data } = await api.get('/learning/progress/summary', { params: { pathId } });
  return data;
}

export async function postLearningEvent({ type, pathId, stageId, topicId, detail }) {
  const { data } = await api.post('/learning/progress/event', { type, pathId, stageId, topicId, detail });
  return data;
}
