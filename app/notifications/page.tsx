"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopProgressBar } from "../components/TopProgressBar";
import { clearAuth, isTokenExpired, silentRefresh } from "../lib/auth";
import { AppNotification, fetchNotifications, markNotificationRead } from "../lib/notifications";

function timeAgoLabel(sentAt: string): string {
  const diffMs = Date.now() - new Date(sentAt).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.floor(diffHour / 24)}일 전`;
}

function typeStyle(type: string): { icon: string; iconBg: string; iconColor: string } {
  if (type === "POINT_EXPIRING") {
    return { icon: "⏰", iconBg: "#FFF3E0", iconColor: "#E65100" };
  }
  return { icon: "🎉", iconBg: "#E8F5E9", iconColor: "#1B9E5B" };
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.push("/"); return; }

    const proceed = () => {
      fetchNotifications(false)
        .then(setNotifications)
        .finally(() => setPageLoading(false));
    };

    if (isTokenExpired()) {
      silentRefresh().then((newToken) => {
        if (newToken) proceed();
        else { clearAuth(); router.push("/"); }
      });
    } else {
      proceed();
    }
  }, []);

  const handleClick = async (n: AppNotification) => {
    if (!n.read) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
      markNotificationRead(n.id).catch(() => {});
    }
    router.push(n.deepLink || "/dashboard");
  };

  return (
    <>
      <TopProgressBar loading={pageLoading} />
      <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
        <div style={{ background: "#1B9E5B", color: "#fff", padding: "16px 24px" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>알림</div>
        </div>

        <div style={{ maxWidth: 448, margin: "0 auto", padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
          {!pageLoading && notifications.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#888" }}>
              <p style={{ fontSize: 14 }}>받은 알림이 없어요</p>
            </div>
          )}

          {notifications.map((n) => {
            const { icon, iconBg, iconColor } = typeStyle(n.type);
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "12px 14px", borderRadius: 10,
                  background: n.read ? "#fff" : "#F0FFF4",
                  border: n.read ? "0.5px solid #eee" : "0.5px solid #A5D6A7",
                  cursor: "pointer",
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: "50%", background: iconBg,
                  color: iconColor, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, flexShrink: 0,
                }}>
                  {icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {!n.read && (
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E53935", flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{n.title}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#555", marginTop: 3 }}>{n.body}</p>
                  <p style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>{timeAgoLabel(n.sentAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
