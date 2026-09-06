import api from './api';

export async function getExercise({ pathId, topicId }) {
  const { data } = await api.get('/learning/practice/exercise', { params: { pathId, topicId } });
  return data.exercise;
}

export async function startPractice({ pathId, topicId, projectId, stageId }) {
  const { data } = await api.post('/learning/practice/start', { pathId, topicId, projectId, stageId });
  return data;
}

export async function getPracticeHint({ pathId, topicId, exerciseId, code, output, error, hintLevel }) {
  const { data } = await api.post('/learning/practice/hint', { pathId, topicId, exerciseId, code, output, error, hintLevel });
  return data;
}

export async function reviewPracticeCode({ pathId, topicId, exerciseId, code, output, error }) {
  const { data } = await api.post('/learning/practice/review', { pathId, topicId, exerciseId, code, output, error });
  return data;
}

export async function getPracticeSolution({ pathId, topicId, exerciseId }) {
  const { data } = await api.post('/learning/practice/solution', { pathId, topicId, exerciseId });
  return data;
}

export async function completePractice({ pathId, topicId, exerciseId, code, output, error, projectId }) {
  const { data } = await api.post('/learning/practice/complete', { pathId, topicId, exerciseId, code, output, error, projectId });
  return data;
}

// Persist practice context for CodeWorkspace pickup (IDs only, no large content)
export function storePracticeContext(exercise, extra = {}) {
  try {
    localStorage.setItem('voxcode:practiceExercise', JSON.stringify({
      exerciseId: exercise.exerciseId,
      pathId: exercise.pathId,
      stageId: exercise.stageId,
      topicId: exercise.topicId,
      lessonId: exercise.lessonId,
      title: exercise.title,
      instructions: exercise.instructions,
      difficulty: exercise.difficulty,
      technology: exercise.technology,
      language: exercise.language,
      fileName: exercise.fileName,
      starterCode: exercise.starterCode,
      hints: exercise.hints || [],
      expectedBehavior: exercise.expectedBehavior,
      projectId: extra.projectId || null,
    }));
  } catch {}
}

export function readPracticeContext() {
  try {
    const raw = localStorage.getItem('voxcode:practiceExercise');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPracticeContext() {
  try { localStorage.removeItem('voxcode:practiceExercise'); } catch {}
}

export default { getExercise, startPractice, getPracticeHint, reviewPracticeCode, getPracticeSolution, completePractice, storePracticeContext, readPracticeContext, clearPracticeContext };
