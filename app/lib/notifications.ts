import { authFetch } from "./auth";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  deepLink: string | null;
  read: boolean;
  sentAt: string;
}

function unwrap(data: unknown): AppNotification[] {
  if (Array.isArray(data)) return data;
  const wrapped = (data as { data?: unknown })?.data;
  return Array.isArray(wrapped) ? wrapped : [];
}

export async function fetchNotifications(unreadOnly = false): Promise<AppNotification[]> {
  try {
    const res = await authFetch(`/api/v1/notifications?unreadOnly=${unreadOnly}`);
    if (!res.ok) return [];
    return unwrap(await res.json());
  } catch {
    return [];
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  await authFetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
}
