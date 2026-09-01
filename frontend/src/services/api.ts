// src/services/api.ts

import type { Chat, Message } from '../types/dashboard';

export type { Chat, Message };

// Backward-compatible alias for older imports.
export type AgentChat = Chat;

/* ==========================================================================
   RESPONSE TYPES
   ========================================================================== */

export type ApiErrorPayload = {
  success?: boolean;
  error?: string;
  message?: string;
  details?: string;
  metaCode?: number | null;
  metaDetails?: string | null;
  [key: string]: unknown;
};

export type AgentChatsResponse = {
  success: boolean;
  chats?: Chat[];
  error?: string;
  message?: string;
};

export type AssignChatResponse = {
  success: boolean;
  message?: string;
  patient?: Chat;
  error?: string;
};

export type SendAgentReplyResponse = {
  success: boolean;
  simulated?: boolean;
  metaMessageId?: string;
  message?: Message;
  patient?: Chat;
  error?: string;
  details?: string;
  metaCode?: number | null;
  metaDetails?: string | null;
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
      success?: boolean;
      appointments?: Appointment[];
      data?: Appointment[];
      error?: string;
      message?: string;
    };

/* ==========================================================================
   REQUEST TYPES
   ========================================================================== */

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  signal?: AbortSignal | null;
  timeoutMs?: number;
}

/* ==========================================================================
   CONFIGURATION
   ========================================================================== */

const API_BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  'http://localhost:5000'
).replace(/\/$/, '');

const DEFAULT_TIMEOUT_MS = 15_000;

/* ==========================================================================
   ERROR CLASS
   ========================================================================== */

/**
 * API request error that contains the HTTP status and parsed backend payload.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly payload?: ApiErrorPayload;

  constructor(
    message: string,
    status: number,
    statusText: string,
    payload?: ApiErrorPayload,
  ) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.payload = payload;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/* ==========================================================================
   INTERNAL HELPERS
   ========================================================================== */

/**
 * Extracts a useful message from common API error response formats.
 */
function parseErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const errorPayload = payload as Record<string, unknown>;

    if (
      typeof errorPayload.error === 'string' &&
      errorPayload.error.trim()
    ) {
      return errorPayload.error;
    }

    if (
      typeof errorPayload.message === 'string' &&
      errorPayload.message.trim()
    ) {
      return errorPayload.message;
    }

    if (
      typeof errorPayload.details === 'string' &&
      errorPayload.details.trim()
    ) {
      return errorPayload.details;
    }
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  return fallback;
}

/**
 * Reads JSON, plain-text, empty, and 204 responses safely.
 */
async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    const text = await response.text();

    if (!text.trim()) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

/**
 * Combines an externally supplied AbortSignal with an internal timeout signal.
 */
function combineTimeoutAndSignal(
  externalSignal?: AbortSignal | null,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const safeExternalSignal = externalSignal ?? undefined;

  const timeoutId = window.setTimeout(() => {
    controller.abort(
      new DOMException('Request timed out.', 'TimeoutError'),
    );
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort(safeExternalSignal?.reason);
  };

  if (safeExternalSignal) {
    if (safeExternalSignal.aborted) {
      controller.abort(safeExternalSignal.reason);
    } else {
      safeExternalSignal.addEventListener(
        'abort',
        onExternalAbort,
        { once: true },
      );
    }
  }

  return {
    signal: controller.signal,

    cleanup: () => {
      window.clearTimeout(timeoutId);

      if (safeExternalSignal) {
        safeExternalSignal.removeEventListener(
          'abort',
          onExternalAbort,
        );
      }
    },
  };
}

/**
 * Sends a request to the hospital API and returns a typed parsed response.
 *
 * Important:
 * - No API key is included here.
 * - Do not store secret API keys in VITE_* environment variables.
 * - Staff endpoints should be protected by server-side authentication,
 *   secure cookies, or an Authorization token.
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    signal: externalSignal,
    timeoutMs,
    headers,
    body,
    ...restOptions
  } = options;

  const { signal, cleanup } = combineTimeoutAndSignal(
    externalSignal,
    timeoutMs,
  );

  const sanitizedEndpoint = endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`;

  const url = `${API_BASE_URL}${sanitizedEndpoint}`;

  try {
    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',

      ...(body && typeof body === 'string'
        ? { 'Content-Type': 'application/json' }
        : {}),

      ...(headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...restOptions,
      body,
      signal,
      headers: requestHeaders,

      /*
       * Enable this only if your backend authenticates with cookies.
       *
       * credentials: 'include',
       */
    });

    const payload = await readResponseBody(response);

    if (!response.ok) {
      const errorMessage = parseErrorMessage(
        payload,
        `Request failed with status ${response.status} (${response.statusText})`,
      );

      throw new ApiError(
        errorMessage,
        response.status,
        response.statusText,
        (payload && typeof payload === 'object'
          ? payload
          : undefined) as ApiErrorPayload | undefined,
      );
    }

    return payload as T;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (
      error instanceof DOMException &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      throw new Error('The request was cancelled or timed out.');
    }

    if (
      error instanceof TypeError &&
      error.message.toLowerCase().includes('fetch')
    ) {
      throw new Error(
        'Unable to connect to the hospital API server. Please check your network connection or verify the backend is running.',
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
   AGENT CHAT ENDPOINTS
   ========================================================================== */

/**
 * GET /api/agent/chats
 *
 * Backend response:
 * {
 *   success: true,
 *   chats: Chat[]
 * }
 */
export async function fetchAgentChats(
  signal?: AbortSignal | null,
): Promise<Chat[]> {
  const response = await request<AgentChatsResponse>(
    '/api/agent/chats',
    {
      method: 'GET',
      signal,
    },
  );

  if (!response.success) {
    throw new Error(response.error || 'Unable to fetch agent chats.');
  }

  return Array.isArray(response.chats) ? response.chats : [];
}

/**
 * POST /api/agent/assign
 */
export async function assignChatToAgent(
  patientId: string,
  agentName: string,
  signal?: AbortSignal | null,
): Promise<AssignChatResponse> {
  return request<AssignChatResponse>('/api/agent/assign', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      patientId,
      agentName,
    }),
  });
}

/**
 * POST /api/agent/reply
 */
export async function sendAgentReply(
  patientId: string,
  messageText: string,
  agentName: string,
  signal?: AbortSignal | null,
): Promise<SendAgentReplyResponse> {
  return request<SendAgentReplyResponse>('/api/agent/reply', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      patientId,
      messageText,
      agentName,
    }),
  });
}

/* ==========================================================================
   APPOINTMENT ENDPOINTS
   ========================================================================== */

/**
 * GET /api/appointments
 *
 * Supports all of these backend response formats:
 *
 * 1. Appointment[]
 *
 * 2. {
 *      success: true,
 *      appointments: Appointment[]
 *    }
 *
 * 3. {
 *      success: true,
 *      data: Appointment[]
 *    }
 */
export async function fetchAppointments(
  signal?: AbortSignal | null,
): Promise<Appointment[]> {
  const response = await request<AppointmentResponse>(
    '/api/appointments',
    {
      method: 'GET',
      signal,
    },
  );

  if (Array.isArray(response)) {
    return response;
  }

  if (response && typeof response === 'object') {
    if ('success' in response && response.success === false) {
      throw new Error(
        typeof response.error === 'string' && response.error.trim()
          ? response.error
          : 'Unable to fetch appointments.',
      );
    }

    if (Array.isArray(response.appointments)) {
      return response.appointmen
      ts;
    }

    if (Array.isArray(response.data)) {
      return response.data;
    }
  }

  return [];
}