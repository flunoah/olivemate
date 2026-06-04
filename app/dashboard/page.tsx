"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Balance {
  balance: number;
  monthlyEarned: number;
  monthlyUsed: number;
  expiringAmount: number;
  expiringDate: string | null;
  expiringIn7Days: number;
}

interface PendingUndo {
  ledgerId: string | number;
  amount: number;
  product: string;
}

type DayStatus =
  | "COMPLETED"          // past, registered, scheduled
  | "EXTRA_DONE"         // past, registered, not scheduled
  | "ABSENT"             // past, not registered, scheduled
  | "PAST_NONE"          // past, not registered, not scheduled
  | "TODAY_COMPLETED"    // today, registered, scheduled
  | "TODAY_EXTRA"        // today, registered, not scheduled
  | "TODAY_SCHEDULED"    // today, not registered, scheduled
  | "TODAY_NONE"         // today, not registered, not scheduled
  | "UPCOMING_SCHEDULED" // future, not registered, scheduled
  | "UPCOMING_EXTRA"     // future, registered, not scheduled
  | "UPCOMING_NONE";     // future, not registered, not scheduled

const DAY_LABELS: Record<number, string> = {
  1: "월요일", 2: "화요일", 3: "수요일", 4: "목요일",
  5: "금요일", 6: "토요일", 0: "일요일",
};
const DAY_SHORT: Record<number, string> = {
  1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토", 0: "일",
};

// 서버: 1=월,2=화,3=수,4=목,5=금,6=토,7=일 → JS: 0=일,1=월,...,6=토
const serverDayToJsDay = (d: number): number => (d === 7 ? 0 : d);

// Returns Mon~Sun dates for this week as { dateStr, jsDay } pairs
function getThisWeekDateStrings(todayStr: string): { dateStr: string; jsDay: number }[] {
  if (!todayStr) return [];
  const [y, m, d] = todayStr.split("-").map(Number);
  const today = new Date(Date.UTC(y, m - 1, d));
  const dow = today.getUTCDay();
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + i);
    return { dateStr: date.toISOString().slice(0, 10), jsDay: date.getUTCDay() };
  });
}

function apiErrorMessage(status: number): string {
  if (status === 401) return "아이디 또는 비밀번호를 확인해주세요";
  if (status === 403) return "접근 권한이 없습니다";
  if (status === 409) return "이미 등록된 근무일입니다";
  if (status >= 500) return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요";
  return "오류가 발생했습니다.";
}

function Toast({ message, type, onClose }: {
  message: string; type: "success" | "error"; onClose: () => void;
}) {
  if (!message) return null;
  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 999, padding: "0 16px 40px" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 448, borderRadius: 16, padding: "16px 20px", background: type === "success" ? "#1B9E5B" : "#E53935", color: "#fff" }}
        onClick={e => e.stopPropagation()}
      >
        <p style={{ fontSize: 14, fontWeight: 500 }}>{message}</p>
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>탭하여 닫기</p>
      </div>
    </div>
  );
}

function UndoToastBar({ amount, product, countdown, onUndo }: {
  amount: number; product: string; countdown: number; onUndo: () => void;
}) {
  return (
    <div style={{
      position: "fixed", bottom: 20, left: 16, right: 16, zIndex: 997,
      background: "#333", borderRadius: 10, padding: "14px 16px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
    }}>
      <div style={{ color: "#fff" }}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
          {amount.toLocaleString()}P 사용 완료{product ? ` — ${product}` : ""}
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "3px 0 0" }}>취소 가능 {countdown}초</p>
      </div>
      <button onClick={onUndo}
        style={{ background: "none", border: "none", color: "#1B9E5B", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, padding: "8px 14px" }}>
        취소
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [crewId, setCrewId] = useState("");
  const [balance, setBalance] = useState<Balance>({
    balance: 0, monthlyEarned: 0, monthlyUsed: 0,
    expiringAmount: 0, expiringDate: null, expiringIn7Days: 0,
  });
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [registeredDates, setRegisteredDates] = useState<string[]>([]);
  const [useAmount, setUseAmount] = useState("");
  const [productName, setProductName] = useState("");
  const [pointError, setPointError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [todayStr, setTodayStr] = useState("");
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(10);
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast(msg); setToastType(type);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("homeAddBannerDismissed", "true");
  };

  const tok = () => localStorage.getItem("token") || "";

  const fetchAll = async (id: string, t: string) => {
    try {
      const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY || 'admin-key';
      const [balRes, schRes, wdRes] = await Promise.all([
        fetch(`/api/v1/points/balance/${id}`, { headers: { Authorization: `Bearer ${t}`, 'X-Admin-Key': adminKey } }),
        fetch(`/api/v1/schedule/me/${id}`, { headers: { Authorization: `Bearer ${t}`, 'X-Admin-Key': adminKey } }),
        fetch(`/api/v1/attendance/week/${id}`, { headers: { Authorization: `Bearer ${t}`, 'X-Admin-Key': adminKey } }),
      ]);
      if (balRes.status === 401) { router.push("/"); return; }
      if (balRes.ok) {
        const data = await balRes.json();
        setBalance({
          balance: data.balance ?? 0,
          monthlyEarned: data.monthlyEarned ?? 0,
          monthlyUsed: data.monthlyUsed ?? 0,
          expiringAmount: data.expiringAmount ?? 0,
          expiringDate: data.expiringDate ?? null,
          expiringIn7Days: data.expiringIn7Days ?? 0,
        });
      }
      if (schRes.ok) {
        const schData = await schRes.json();
        // API: { daysOfWeek: [3,4,5], startDate: "..." } — 서버 기준(1=월~7=일)
        const rawDays: number[] = Array.isArray(schData)
          ? schData
          : (schData?.daysOfWeek ?? []);
        const converted = rawDays.map(serverDayToJsDay);
        console.log("[schedule] 서버 원본:", rawDays);
        console.log("[schedule] JS 변환:", converted);
        setScheduleDays(converted);
      }
      if (wdRes.ok) {
        const w = await wdRes.json();
        const dates = Array.isArray(w) ? w : [];
        console.log("[workday] 등록된 날짜:", dates);
        setRegisteredDates(dates);
      }
    } catch {
      showToast("데이터를 불러오지 못했습니다.", "error");
    }
  };

  useEffect(() => {
    const now = new Date();
    const koreaOffset = 9 * 60 * 60 * 1000;
    const koreaTime = new Date(now.getTime() + koreaOffset);
    setTodayStr(koreaTime.toISOString().slice(0, 10));

    const t = localStorage.getItem("token");
    if (!t) { router.push("/"); return; }
    try {
      const payload = JSON.parse(atob(t.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.clear();
        document.cookie = "token=; path=/; max-age=0";
        router.push("/");
        return;
      }
      const id = payload.sub;
      setCrewId(id);
      fetchAll(id, t);
    } catch {
      localStorage.clear();
      document.cookie = "token=; path=/; max-age=0";
      router.push("/");
    }
  }, []);

  // 모바일 홈 화면 추가 배너
  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSmall  = window.innerWidth <= 480;
    const dismissed = localStorage.getItem("homeAddBannerDismissed");
    if (isMobile && isSmall && !dismissed) {
      const t = setTimeout(() => setShowBanner(true), 500);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!pendingUndo) return;
    setUndoCountdown(10);
    undoIntervalRef.current = setInterval(() => {
      setUndoCountdown(prev => {
        if (prev <= 1) {
          clearInterval(undoIntervalRef.current!);
          setPendingUndo(null);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (undoIntervalRef.current) clearInterval(undoIntervalRef.current); };
  }, [pendingUndo?.ledgerId]);

  // 디버그: 요일별 상태 출력
  useEffect(() => {
    if (!todayStr || (!scheduleDays.length && !registeredDates.length)) return;
    getThisWeekDateStrings(todayStr).forEach(({ dateStr, jsDay }) => {
      const registered = registeredDates.includes(dateStr);
      console.log(
        `[${DAY_SHORT[jsDay]}] ${dateStr}`,
        "scheduled:", scheduleDays.includes(jsDay),
        "registered:", registered,
        "extra:", registered && !scheduleDays.includes(jsDay),
      );
    });
  }, [scheduleDays, registeredDates, todayStr]);

  const refresh = () => fetchAll(crewId, tok());

  const isScheduled = (jsDay: number) => scheduleDays.includes(jsDay);

  const getDayStatus = (dateStr: string, jsDay: number): DayStatus => {
    if (!todayStr) return "UPCOMING_NONE";
    const registered = registeredDates.includes(dateStr);
    const scheduled = isScheduled(jsDay);
    if (dateStr < todayStr) {
      if (registered && scheduled)  return "COMPLETED";
      if (registered && !scheduled) return "EXTRA_DONE";
      if (!registered && scheduled) return "ABSENT";
      return "PAST_NONE";
    }
    if (dateStr === todayStr) {
      if (registered && scheduled)  return "TODAY_COMPLETED";
      if (registered && !scheduled) return "TODAY_EXTRA";
      if (!registered && scheduled) return "TODAY_SCHEDULED";
      return "TODAY_NONE";
    }
    if (registered && !scheduled) return "UPCOMING_EXTRA";
    if (!registered && scheduled) return "UPCOMING_SCHEDULED";
    return "UPCOMING_NONE";
  };

  const handleRegister = async (dateStr: string, jsDay: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/attendance/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}`, 'X-Admin-Key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'admin-key' },
        body: JSON.stringify({ crewId, workDate: dateStr, type: "EXTRA" }),
      });
      if (res.ok) {
        const payDay = new Date(dateStr + "T00:00:00");
        payDay.setDate(payDay.getDate() + 1);
        const payLabel = `${payDay.getMonth() + 1}월 ${payDay.getDate()}일`;
        showToast(`${DAY_SHORT[jsDay]}요일 연장 근무 등록! 근무한 다음 날에 포인트가 지급돼요.`);
        refresh();
      } else {
        showToast(apiErrorMessage(res.status), "error");
      }
    } catch { showToast("오류가 발생했습니다.", "error"); }
    finally { setLoading(false); }
  };

  const handleCancel = async (dateStr: string, jsDay: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/attendance/cancel?crewId=${crewId}&workDate=${dateStr}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${tok()}`, 'X-Admin-Key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'admin-key' } }
      );
      if (res.ok) {
        showToast(`${DAY_SHORT[jsDay]}요일 근무 취소됐어요.`);
        refresh();
      } else {
        showToast(apiErrorMessage(res.status), "error");
      }
    } catch { showToast("오류가 발생했습니다.", "error"); }
    finally { setLoading(false); }
  };

  const handleMarkAbsent = async (dateStr: string, jsDay: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/attendance/absent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}`, 'X-Admin-Key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'admin-key' },
        body: JSON.stringify({ crewId, workDate: dateStr }),
      });
      if (res.ok) {
        showToast(`${DAY_SHORT[jsDay]}요일 결근 처리됐어요.`);
        refresh();
      } else {
        showToast(apiErrorMessage(res.status), "error");
      }
    } catch { showToast("오류가 발생했습니다.", "error"); }
    finally { setLoading(false); }
  };

  const handleUsePoint = async () => {
    setPointError("");
    if (!useAmount || !crewId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/points/use/${crewId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}`, 'X-Admin-Key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'admin-key' },
        body: JSON.stringify({
          amount: Number(useAmount),
          description: productName || "포인트 사용",
          referenceId: null,
          productName: productName || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 400 || (err.message && err.message.includes("부족"))) {
          setPointError("잔액이 부족합니다.");
        } else {
          setPointError(err.message || apiErrorMessage(res.status));
        }
        return;
      }
      const data = await res.json();
      const usedAmt = data.usedAmount ?? Number(useAmount);
      const ledgerId = data.ledgerId ?? data.id ?? "";
      const prod = productName;

      setUseAmount(""); setProductName("");
      refresh();

      if (ledgerId) {
        if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
        setPendingUndo({ ledgerId, amount: usedAmt, product: prod });
      } else {
        showToast(`${usedAmt.toLocaleString()}P 사용 완료!`);
      }
    } catch { setPointError("오류가 발생했습니다."); }
    finally { setLoading(false); }
  };

  const handleUndoUse = async () => {
    if (!pendingUndo) return;
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    const target = pendingUndo;
    setPendingUndo(null);
    try {
      const res = await fetch("/api/v1/points/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}`, 'X-Admin-Key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'admin-key' },
        body: JSON.stringify({ ledgerId: target.ledgerId, crewId }),
      });
      if (res.ok) {
        showToast("포인트 사용이 취소됐어요.");
        refresh();
      } else {
        showToast("취소 가능 시간이 지났습니다.", "error");
      }
    } catch { showToast("오류가 발생했습니다.", "error"); }
  };

  const weekDays = getThisWeekDateStrings(todayStr);

  // 연장 추가 가능한 날 — 비소정 + 미등록 + 오늘 이후
  const availableExtraDays = weekDays.filter(({ dateStr, jsDay }) =>
    !isScheduled(jsDay) &&
    !registeredDates.includes(dateStr) &&
    todayStr ? dateStr >= todayStr : false
  );

  const scheduledLabel = [...scheduleDays]
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map(d => DAY_SHORT[d])
    .join("");

  return (
    <>
      <Toast message={toast} type={toastType} onClose={() => setToast("")} />

      {showExtraModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowExtraModal(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: "16px 16px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 448 }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#1a1a1a" }}>연장 근무 추가</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {availableExtraDays.map(({ jsDay, dateStr }) => (
                <button
                  key={dateStr}
                  onClick={() => { handleRegister(dateStr, jsDay); setShowExtraModal(false); }}
                  disabled={loading}
                  style={{
                    width: "100%", padding: "14px 16px", borderRadius: 10,
                    border: "0.5px solid #eee", background: "#f8f8f8",
                    textAlign: "left", fontSize: 14, color: "#1a1a1a",
                    cursor: "pointer", opacity: loading ? 0.5 : 1,
                  }}
                >
                  {DAY_SHORT[jsDay]}요일 {dateStr.slice(5).replace("-", ".")}
                </button>
              ))}
              <button
                onClick={() => setShowExtraModal(false)}
                style={{
                  width: "100%", padding: "12px", marginTop: 4, borderRadius: 10,
                  border: "none", background: "#f0f0f0", color: "#888",
                  fontSize: 14, cursor: "pointer",
                }}
              >닫기</button>
            </div>
          </div>
        </div>
      )}

      {showBanner && (
        <div className="home-add-banner" style={{
          position: "fixed", bottom: 60, left: 12, right: 12, zIndex: 200,
          background: "#fff", borderRadius: 16, padding: "14px 16px",
          display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 -2px 20px rgba(0,0,0,0.12)", border: "0.5px solid #e0e0e0",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: "#1B9E5B",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: 22,
          }}>🫒</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a", marginBottom: 2 }}>홈 화면에 추가하기</div>
            <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>
              {/iPhone|iPad|iPod/i.test(navigator.userAgent)
                ? "하단 공유 버튼 → '홈 화면에 추가'를 탭하세요"
                : "브라우저 메뉴 → '홈 화면에 추가'를 탭하세요"}
            </div>
          </div>
          <button onClick={handleDismiss} style={{
            width: 28, height: 28, borderRadius: "50%", background: "#f0f0f0",
            border: "none", cursor: "pointer", flexShrink: 0,
            fontSize: 14, color: "#888", display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>
      )}

      {pendingUndo && (
        <UndoToastBar
          amount={pendingUndo.amount}
          product={pendingUndo.product}
          countdown={undoCountdown}
          onUndo={handleUndoUse}
        />
      )}

      <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
        {/* 헤더 */}
        <div style={{ background: "#1B9E5B", color: "#fff", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>🫒 MATE 포인트</div>
          <button onClick={() => { localStorage.clear(); document.cookie = "token=; path=/; max-age=0"; router.push("/"); }}
            style={{ fontSize: 13, opacity: 0.85, background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
            로그아웃
          </button>
        </div>

        <div style={{ maxWidth: 448, margin: "0 auto", padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* 포인트 카드 */}
          <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: "20px 20px 16px" }}>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>사용 가능 포인트</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: "#1B9E5B", marginBottom: 12 }}>
              {balance.balance.toLocaleString()}P
            </p>
            {balance.expiringDate && balance.expiringAmount > 0 && (
              <div style={{ background: "#FFF3E0", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span>⚠️</span>
                <span style={{ fontSize: 13, color: "#E65100", fontWeight: 500 }}>
                  {balance.expiringAmount.toLocaleString()}P가 {new Date(balance.expiringDate).getMonth() + 1}월 {new Date(balance.expiringDate).getDate()}일 소멸 예정이에요
                </span>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div style={{ background: "#F0FAF4", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>이번달 적립</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#1B9E5B" }}>+{balance.monthlyEarned.toLocaleString()}P</p>
              </div>
              <div style={{ background: "#FFF0F0", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>이번달 사용</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#E53935" }}>-{balance.monthlyUsed.toLocaleString()}P</p>
              </div>
              <div style={{ background: "#FFF8E1", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>소멸 예정</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#E65100" }}>{balance.expiringAmount.toLocaleString()}P</p>
              </div>
            </div>
          </div>

          {/* 이번 주 근무 현황 */}
          <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>이번 주 근무 현황</p>
              {scheduledLabel && (
                <span style={{ fontSize: 12, color: "#888" }}>소정: {scheduledLabel}</span>
              )}
            </div>

            {/* 요일 칩 — 실제 날짜(DD) 표시, 월~일 순 */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              {weekDays.map(({ dateStr, jsDay }) => {
                const isToday = dateStr === todayStr;
                const isPast = todayStr ? dateStr < todayStr : false;
                const sched = isScheduled(jsDay);
                const dd = dateStr.slice(8);
                return (
                  <div key={dateStr} style={{
                    flex: 1, textAlign: "center", padding: "5px 2px 4px", borderRadius: 8,
                    background: isToday ? "#1B9E5B" : sched ? "#E8F5E9" : "#f5f5f5",
                    color: isToday ? "#fff" : sched ? "#1B9E5B" : isPast ? "#ccc" : "#aaa",
                    border: isToday ? "none" : sched ? "1px solid #A5D6A7" : "none",
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.75, lineHeight: 1.3 }}>{DAY_SHORT[jsDay]}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>{dd}</div>
                  </div>
                );
              })}
            </div>

            {/* 이번 주 리스트 — 소정이거나 등록된 날만 표시 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {weekDays.filter(({ dateStr, jsDay }) =>
                isScheduled(jsDay) || registeredDates.includes(dateStr)
              ).map(({ dateStr, jsDay }) => {
                const [, mm, dd] = dateStr.split("-");
                const dateLabel = `${DAY_LABELS[jsDay]} ${mm}.${dd}`;
                const isPast   = todayStr ? dateStr < todayStr : false;
                const isToday  = dateStr === todayStr;
                const scheduled  = isScheduled(jsDay);
                const registered = registeredDates.includes(dateStr);

                // --- visual config (getDayStatus를 거치지 않고 직접 판단) ---
                let bg = "#fff", border = "0.5px solid #eee", opacity = 1;
                let iconBg = "#e8e8e8", iconColor = "#fff", iconText = DAY_SHORT[jsDay];
                let badge = "", badgeBg = "transparent", badgeColor = "#888", sub = "";

                if (isPast) {
                  if (scheduled && registered) {
                    bg = "#F0FFF4"; border = "0.5px solid #A5D6A7";
                    iconBg = "#1B9E5B"; iconText = "✓";
                    sub = "4,000P 적립 완료";
                  } else if (!scheduled && registered) {
                    bg = "#EFF6FF"; border = "0.5px solid #93C5FD";
                    iconBg = "#1565C0"; iconText = "↑";
                    badge = "연장"; badgeBg = "#E3F2FD"; badgeColor = "#1565C0";
                    sub = "추가 근무 완료";
                  } else {
                    // scheduled + not registered → ABSENT
                    bg = "#fff"; opacity = 0.5; iconBg = "#e0e0e0";
                    badge = "결근"; badgeBg = "#FFEBEE"; badgeColor = "#E53935";
                    sub = "포인트 미적립";
                  }
                } else if (isToday) {
                  if (scheduled) {
                    bg = "#F0FFF4"; border = "1px solid #1B9E5B";
                    iconBg = "#1B9E5B"; iconText = registered ? "✓" : DAY_SHORT[jsDay];
                    sub = registered ? "내일 4,000P 적립" : "오늘 근무";
                  } else {
                    bg = "#EFF6FF"; border = "1px solid #1565C0";
                    iconBg = "#1565C0"; iconText = "↑";
                    badge = "연장"; badgeBg = "#E3F2FD"; badgeColor = "#1565C0";
                  }
                } else {
                  // future
                  if (scheduled) {
                    bg = "#F8FFFE"; border = "1px dashed #5DCAA5";
                    iconBg = "#E1F5EE"; iconColor = "#1B9E5B";
                  } else {
                    bg = "#EFF6FF"; border = "1px dashed #93C5FD";
                    iconBg = "#DBEAFE"; iconColor = "#60A5FA"; iconText = "↑";
                    badge = "연장"; badgeBg = "#DBEAFE"; badgeColor = "#60A5FA";
                    sub = "추가 근무 예정";
                  }
                }

                const btnS = (variant: "red" | "gray") => ({
                  fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "#fff",
                  cursor: "pointer" as const, fontWeight: 600, opacity: loading ? 0.5 : 1,
                  ...(variant === "red"  ? { border: "0.5px solid #E53935", color: "#E53935" } : {}),
                  ...(variant === "gray" ? { border: "0.5px solid #ccc",    color: "#555"    } : {}),
                });

                return (
                  <div key={dateStr} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10, background: bg,
                    border, opacity,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%", background: iconBg,
                      color: iconColor, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, flexShrink: 0,
                    }}>
                      {iconText}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{dateLabel}</span>
                        {badge && (
                          <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 20, background: badgeBg, color: badgeColor, fontWeight: 600 }}>
                            {badge}
                          </span>
                        )}
                      </div>
                      {sub && <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{sub}</p>}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {!isPast && scheduled && (
                        <button onClick={() => handleMarkAbsent(dateStr, jsDay)} disabled={loading} style={btnS("red")}>결근</button>
                      )}
                      {!isPast && !scheduled && registered && (
                        <button onClick={() => handleCancel(dateStr, jsDay)} disabled={loading} style={btnS("gray")}>삭제</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {availableExtraDays.length > 0 && (
              <button
                onClick={() => setShowExtraModal(true)}
                style={{
                  width: "100%", padding: "12px", borderRadius: 10, marginTop: 8,
                  border: "1px dashed #1565C0", background: "#fff",
                  color: "#1565C0", fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}>
                + 연장 추가
              </button>
            )}
          </div>

          {/* 포인트 사용 */}
          <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: "16px" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 12 }}>포인트 사용</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="number"
                value={useAmount}
                onChange={e => { setUseAmount(e.target.value); setPointError(""); }}
                placeholder="사용할 포인트"
                style={{ border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" }}
              />
              <input
                type="text"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder="제품명 입력 (예: 닥터자르트 시카페어 크림)"
                style={{ border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" }}
              />
              {pointError && (
                <p style={{ fontSize: 12, color: "#E53935", margin: 0 }}>{pointError}</p>
              )}
              <button onClick={handleUsePoint} disabled={loading}
                style={{ padding: "12px 0", borderRadius: 8, background: "#E53935", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.5 : 1 }}>
                사용하기
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
