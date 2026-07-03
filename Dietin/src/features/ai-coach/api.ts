// Typed wrappers around the AI Coach REST endpoints.
import { aiFetch } from "@/lib/aiCoachApi";
import { workoutStartSchema } from "@/lib/validation/schemas";
import type {
  Exercise,
  FrameResponse,
  HealthResponse,
  SessionEndResponse,
  SessionStartRequest,
  SessionStartResponse,
  SessionStatusResponse,
} from "./types";

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return aiFetch<HealthResponse>("/api/health", { method: "GET", signal });
}

export function listExercises(signal?: AbortSignal): Promise<Exercise[]> {
  return aiFetch<Exercise[]>("/api/exercises", { method: "GET", signal });
}

export function startSession(payload: SessionStartRequest): Promise<SessionStartResponse> {
  // Bound-check the payload against the shared schema before the wire so we
  // never send anything the FastAPI Pydantic model will 422 on.
  const parsed = workoutStartSchema.safeParse({
    exercise: payload.exercise ?? undefined,
    sets: payload.sets ?? 1,
    target_reps: payload.target_reps ?? 12,
    rest_timer: payload.rest_timer ?? 60,
  });
  if (!parsed.success) {
    return Promise.reject(new Error(parsed.error.issues[0]?.message || "Invalid workout params"));
  }
  return aiFetch<SessionStartResponse>("/api/session/start", {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
}

export function postFrame(
  session_id: string,
  image: string,
  return_annotated_frame = true,
  signal?: AbortSignal,
): Promise<FrameResponse> {
  return aiFetch<FrameResponse>("/api/frame", {
    method: "POST",
    body: JSON.stringify({ session_id, image, return_annotated_frame }),
    signal,
  });
}

export function getStatus(session_id: string): Promise<SessionStatusResponse> {
  return aiFetch<SessionStatusResponse>(`/api/session/status?session_id=${encodeURIComponent(session_id)}`);
}

export function endSession(session_id: string): Promise<SessionEndResponse> {
  return aiFetch<SessionEndResponse>("/api/session/end", {
    method: "POST",
    body: JSON.stringify({ session_id }),
  });
}
