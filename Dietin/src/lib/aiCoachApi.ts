// Shared helper for talking to the AI Coach FastAPI server.
//
// Every request carries the current user's Firebase ID token in the
// `Authorization: Bearer <token>` header. The FastAPI server verifies the
// token via firebase-admin (see ai/exercise_recognition/inference/app/security.py),
// so anonymous browser traffic and replays are rejected.
//
// Base URL comes from VITE_AI_API_URL. When unset, isAiConfigured() returns
// false and the UI shows the BackendOfflineEmpty state instead of throwing.

import { auth } from "@/lib/firebase";

const RAW = (import.meta.env.VITE_AI_API_URL as string | undefined)?.trim() ?? "";

export function aiBase(): string {
  return RAW.replace(/\/+$/, "");
}

export function isAiConfigured(): boolean {
  return aiBase().length > 0;
}

export class AiServerError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AiServerError";
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  if (!u) return {};
  try {
    const token = await u.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

export async function aiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isAiConfigured()) {
    throw new AiServerError(0, "AI Coach is not configured (set VITE_AI_API_URL).");
  }
  const url = `${aiBase()}${path}`;
  const idHeader = await authHeader();
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...idHeader,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.text();
      if (body) detail = body.slice(0, 500);
    } catch {
      /* ignore */
    }
    throw new AiServerError(res.status, `${res.status} ${detail}`);
  }
  return (await res.json()) as T;
}
