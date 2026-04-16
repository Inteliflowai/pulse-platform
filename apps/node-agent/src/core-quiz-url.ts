/**
 * CORE Quiz URL Builder
 *
 * Builds the correct CORE quiz URL for a given sequence item.
 * Included in lesson_complete classroom_event payloads so student
 * devices know exactly where to redirect.
 */

export function buildCoreQuizUrl(params: {
  core_api_url: string;
  sequence_item_id: string;
  student_id: string;
  core_session_token: string;
  classroom_id: string;
  node_id: string;
}): string {
  const base = params.core_api_url.replace(/\/+$/, '');
  const qs = new URLSearchParams({
    student: params.student_id,
    token: params.core_session_token,
    classroom: params.classroom_id,
    node: params.node_id,
  });
  return `${base}/quiz/pulse/${encodeURIComponent(params.sequence_item_id)}?${qs.toString()}`;
}
