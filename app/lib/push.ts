"use client";

import { authFetch } from "./auth";

const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY || "admin-key";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn("[push] subscribe 중단: 이 브라우저는 Web Push를 지원하지 않음");
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("[push] subscribe 중단: 알림 권한이 허용되지 않음 (permission=%s)", permission);
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register("/service-worker.js");
    await navigator.serviceWorker.ready;

    const keyRes = await authFetch("/api/v1/push/vapid-public-key", {
      headers: { "X-Admin-Key": adminKey },
    });
    if (!keyRes.ok) {
      console.error("[push] subscribe 실패: VAPID 공개키 조회 실패 (status=%s)", keyRes.status);
      return false;
    }
    const keyJson = await keyRes.json();
    const publicKey: string = keyJson.data ?? keyJson;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    const json = subscription.toJSON();
    const subRes = await authFetch("/api/v1/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
      body: JSON.stringify({
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      }),
    });

    if (!subRes.ok) {
      console.error("[push] subscribe 실패: 백엔드 구독 저장 실패 (status=%s)", subRes.status);
    }
    return subRes.ok;
  } catch (e) {
    console.error("[push] subscribe 실패: 예외 발생", e);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const subscription = await getExistingSubscription();
    if (!subscription) return true;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    const res = await authFetch(`/api/v1/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
      method: "DELETE",
      headers: { "X-Admin-Key": adminKey },
    });
    if (!res.ok) {
      console.error("[push] unsubscribe 실패: 백엔드 구독 삭제 실패 (status=%s)", res.status);
    }
    return res.ok;
  } catch (e) {
    console.error("[push] unsubscribe 실패: 예외 발생", e);
    return false;
  }
}