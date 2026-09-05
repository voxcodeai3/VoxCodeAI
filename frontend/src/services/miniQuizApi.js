import api from './api';

export async function startQuiz({ topicId, learningPathId, teachingSessionId }) {
  const { data } = await api.post('/learning/quiz/start', { topicId, learningPathId, teachingSessionId });
  return data;
}

export async function getQuiz(quizId) {
  const { data } = await api.get(`/learning/quiz/${quizId}`);
  return data;
}

export async function submitAnswer(quizId, questionId, answer) {
  const { data } = await api.post(`/learning/quiz/${quizId}/answer`, { questionId, answer });
  return data;
}

export async function getHint(quizId, questionId) {
  const { data } = await api.post(`/learning/quiz/${quizId}/hint`, { questionId });
  return data;
}

export async function completeQuiz(quizId) {
  const { data } = await api.post(`/learning/quiz/${quizId}/complete`);
  return data;
}
