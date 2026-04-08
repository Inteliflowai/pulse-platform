/**
 * CORE Integration — Quiz & Assessment Delivery
 *
 * Imports quizzes from CORE into Pulse's quiz engine.
 * Syncs student results back to CORE via cloud.
 */

import { log } from '../logger';

const CLOUD_API_URL = process.env.CLOUD_API_URL ?? '';

interface CoreQuizPayload {
  external_id: string;
  title: string;
  questions: {
    question_text: string;
    question_type: 'multiple_choice' | 'true_false' | 'short_answer';
    options?: { text: string; is_correct: boolean }[];
    correct_answer?: string;
    points: number;
  }[];
  time_limit_minutes?: number;
  pass_percentage?: number;
}

export async function importCoreQuiz(payload: CoreQuizPayload): Promise<string | null> {
  try {
    const res = await fetch(`${CLOUD_API_URL}/api/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: payload.title,
        time_limit_minutes: payload.time_limit_minutes,
        pass_percentage: payload.pass_percentage ?? 50,
        source: 'core',
        external_id: payload.external_id,
        questions: payload.questions.map((q, i) => ({
          question_type: q.question_type,
          question_text: q.question_text,
          options: (q.options ?? []).map((o, j) => ({ id: String(j), text: o.text, is_correct: o.is_correct })),
          correct_answer: q.correct_answer,
          points: q.points,
        })),
      }),
    });

    if (res.ok) {
      const quiz: any = await res.json();
      log('info', 'CORE quiz imported', { external_id: payload.external_id, quiz_id: quiz.id });
      return quiz.id;
    }
    return null;
  } catch (err: any) {
    log('error', 'CORE integration error', { error: err.message });
    return null;
  }
}

export async function syncCoreResults(results: any[]): Promise<void> {
  try {
    await fetch(`${CLOUD_API_URL}/api/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz_attempts: results }),
    });
    log('info', 'CORE results synced to cloud', { count: results.length });
  } catch (err: any) {
    log('warning', 'Failed to sync CORE results', { error: err.message });
  }
}
