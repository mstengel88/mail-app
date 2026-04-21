import type { MailMessage } from "@/features/mail-reader/mailData";

const configuredMailApiUrl = import.meta.env.VITE_MAIL_API_URL?.replace(/\/$/, "") ?? "";
const sameOriginMailApiUrl =
  !import.meta.env.DEV && typeof window !== "undefined" && window.location.protocol.startsWith("http")
    ? window.location.origin
    : "";
const mailApiUrl = configuredMailApiUrl || sameOriginMailApiUrl;

export const isMailApiConfigured = Boolean(mailApiUrl);
const tokenStorageKey = "mail-app-session-token";

type MailApiResponse = {
  messages: MailMessage[];
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!mailApiUrl) {
    throw new Error("Mail API is not configured.");
  }

  const response = await fetch(`${mailApiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Mail API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function getAuthHeaders() {
  const token = getMailSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getMailSessionToken() {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(tokenStorageKey) ?? "";
}

export function setMailSessionToken(token: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(tokenStorageKey, token);
}

export function clearMailSessionToken() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(tokenStorageKey);
}

export async function loginToMailbox(credentials: { email: string; password: string; displayName?: string }) {
  const response = await request<{ token: string; email: string; displayName: string }>("/api/login", {
    method: "POST",
    body: JSON.stringify(credentials),
    headers: {},
  });
  setMailSessionToken(response.token);
  return response;
}

export async function getMailboxSession() {
  return request<{ email: string; displayName: string }>("/api/session");
}

export async function logoutMailbox() {
  try {
    await request<{ ok: true }>("/api/logout", { method: "POST" });
  } finally {
    clearMailSessionToken();
  }
}

export async function fetchMailMessages(folder: string) {
  const response = await request<MailApiResponse>(`/api/messages?folder=${encodeURIComponent(folder)}`);
  return response.messages;
}

export async function markMailMessageSeen(id: string, seen: boolean) {
  return request<{ ok: true }>(`/api/messages/${encodeURIComponent(id)}/seen`, {
    method: "PATCH",
    body: JSON.stringify({ seen }),
  });
}

export async function markMailMessageFlagged(id: string, flagged: boolean) {
  return request<{ ok: true }>(`/api/messages/${encodeURIComponent(id)}/flagged`, {
    method: "PATCH",
    body: JSON.stringify({ flagged }),
  });
}

export async function archiveMailMessage(id: string) {
  return request<{ ok: true }>(`/api/messages/${encodeURIComponent(id)}/archive`, {
    method: "POST",
  });
}

export async function trashMailMessage(id: string) {
  return request<{ ok: true }>(`/api/messages/${encodeURIComponent(id)}/trash`, {
    method: "POST",
  });
}

export async function sendMailMessage(message: { to: string; subject: string; text: string }) {
  return request<{ ok: true }>("/api/send", {
    method: "POST",
    body: JSON.stringify(message),
  });
}
