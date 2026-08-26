// src/services/api.ts

import type { Chat, Message } from '../types/dashboard';

export type { Chat, Message };

// Backward-compatible alias for any existing imports
export type AgentChat = Chat;

export type ApiErrorPayload = {
  success?: boolean;
  error?: string;
  message?: string;
  [key: string]: unknown;
};

export type Appointment = {
  id: string;
  patientId?: string;
  patientPhone?: string;
  patientName?: string | null;
  specialty: string;
  doctorName: string;
  slotTime: string;
  status: string;
  createdAt?: string;
};

type AppointmentResponse =
  | Appointment[]
  | {
      appointments?: Appointment[];
      data?: Appointment[];
    };

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  signal?: AbortSignal | null;
  timeoutMs?: number;
}

const API_BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  'http://localhost:5000'
).replace(/\/$/, '');

const API_KEY = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_PUBLIC_API_KEY : '';

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Production API Request Error carrying HTTP status and typed payload.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly payload?: ApiErrorPayload;

  constructor(
    message: string,
    status: number,
    statusText: string,
    payload?: ApiErrorPayload
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.payload = payload;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Normalizes error messages from various backend error payloads.
 */
const parseErrorMessage = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === 'object') {
    const errorPayload = payload as Record<string, unknown>;
    if (typeof errorPayload.error === 'string' && errorPayload.error.trim()) {
      return errorPayload.error;
    }
    if (typeof errorPayload.message === 'string' && errorPayload.message.trim()) {
      return errorPayload.message;
    }
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  return fallback;
};

/**
 * Safely parses response body handling empty, text/plain, or JSON responses.
 */
const readResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    const text = await response.text();
    if (!text.trim()) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
};

/**
 * Combines an optional external AbortSignal (null | undefined safe) with an internal timeout controller.
 */
const combineTimeoutAndSignal = (
  externalSignal?: AbortSignal | null,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
) => {
  const controller = new AbortController();
  const safeExternalSignal = externalSignal ?? undefined;

  const timeoutId = window.setTimeout(() => {
    controller.abort(new DOMException('Request timeout', 'TimeoutError'));
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort(safeExternalSignal?.reason);
  };

  if (safeExternalSignal) {
    if (safeExternalSignal.aborted) {
      controller.abort(safeExternalSignal.reason);
    } else {
      safeExternalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeoutId);
      if (safeExternalSignal) {
        safeExternalSignal.removeEventListener('abort', onExternalAbort);
      }
    },
  };
};

/**
 * Core type-safe request utility.
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { signal: externalSignal, timeoutMs, headers, body, ...restOptions } = options;
  const { signal, cleanup } = combineTimeoutAndSignal(externalSignal, timeoutMs);

  const sanitizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${sanitizedEndpoint}`;

  try {
    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      ...(body && typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...restOptions,
      body,
      signal,
      headers: requestHeaders,
    });

    const payload = await readResponseBody(response);

    if (!response.ok) {
      const errorMessage = parseErrorMessage(
        payload,
        `Request failed with status ${response.status} (${response.statusText})`
      );

      throw new ApiError(
        errorMessage,
        response.status,
        response.statusText,
        (payload && typeof payload === 'object' ? payload : undefined) as ApiErrorPayload | undefined
      );
    }

    return payload as T;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new Error('The request was cancelled or timed out.');
    }

    if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
      throw new Error(
        'Unable to connect to the hospital API server. Please check your network connection or verify the backend is running.'
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('An unexpected network error occurred.');
  } finally {
    cleanup();
  }
}

/* ==========================================================================
   API ENDPOINTS
   ========================================================================== */

export async function fetchAgentChats(
  signal?: AbortSignal | null
): Promise<Chat[]> {
  const response = await request<Chat[]>('/api/agent/chats', {
    method: 'GET',
    signal,
  });

  return Array.isArray(response) ? response : [];
}

export async function assignChatToAgent(
  patientId: string,
  agentName: string,
  signal?: AbortSignal | null
) {
  return request<{
    success: boolean;
    patient?: Chat;
    error?: string;
  }>('/api/agent/assign', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      patientId,
      agentName,
    }),
  });
}

export async function sendAgentReply(
  patientId: string,
  messageText: string,
  agentName: string,
  signal?: AbortSignal | null
) {
  return request<{
    success: boolean;
    message?: Message;
    error?: string;
  }>('/api/agent/reply', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      patientId,
      messageText,
      agentName,
    }),
  });
}

export async function fetchAppointments(
  signal?: AbortSignal | null
): Promise<Appointment[]> {
  const response = await request<AppointmentResponse>('/api/appointments', {
    method: 'GET',
    signal,
  });

  if (Array.isArray(response)) {
    return response;
  }

  if (response && typeof response === 'object') {
    if (Array.isArray(response.appointments)) {
      return response.appointments;
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
  }

  return [];
}