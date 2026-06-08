"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopProgressBar } from "../components/TopProgressBar";

interface Ledger {
  id?: string | number;
  ledgerType: string;
  amount: number;
  grantedAt: string;
  expiredAt: string | null;
  createdAt: string;
  description?: string;
}

interface CancelTarget {
  ledgerIds: (string | number)[];
  amount: number;
  description: string;
}

type DisplayLedger = Ledger & { mergedIds: (string | number)[] };

function mergeUseLedgers(ledgers: Ledger[]): DisplayLedger[] {
  const result: DisplayLedger[] = [];
  const useGroups: Record<string, DisplayLedger> = {};

  for (const l of ledgers) {
    if (l.ledgerType === "USE") {
      const key = l.description || "포인트 사용";
      if (useGroups[key]) {
        useGroups[key].amount += l.amount;
        if (l.id != null) useGroups[key].mergedIds.push(l.id);
      } else {
        const merged: DisplayLedger = { ...l, mergedIds: l.id != null ? [l.id] : [] };
        useGroups[key] = merged;
        result.push(merged);
      }
    } else {
      result.push({ ...l, mergedIds: l.id != null ? [l.id] : [] });
    }
  }

  return result;
}

function dDayLabel(expiredAt: string | null): string {
  if (!expiredAt) return "만료일 없음 (영구 보유)";
  const diff = Math.ceil((new Date(expiredAt).getTime() - Date.now()) / 86400000);
  if (diff < 0) return "소멸됨";
  const m = new Date(expiredAt).getMonth() + 1;
  const d = new Date(expiredAt).getDate();
  return `${m}월 ${d}일 소멸 예정 (D-${diff})`;
}

function CancelModal({ target, onClose, onConfirm, error }: {
  target: CancelTarget; onClose: () => void; onConfirm: () => void; error: string;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "0 24px" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 360 }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>
          {target.amount.toLocaleString()}P 사용을 취소하시겠어요?
        </p>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 0 }}>제품명: {target.description}</p>
        {error && (
          <p style={{ fontSize: 12, color: "#E53935", marginTop: 10, marginBottom: 0 }}>{error}</p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
          <button onClick={onClose}
            style={{ padding: "12px 0", borderRadius: 8, background: "#f5f5f5", color: "#666", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            닫기
          </button>
          <button onClick={onConfirm}
            style={{ padding: "12px 0", borderRadius: 8, background: "#E53935", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            취소하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const [crewId, setCrewId] = useState("");
  const [token, setToken] = useState("");
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  const [todayStr, setTodayStr] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchHistory = (id: string, t: string) => {
    setLoading(true);
    fetch(`/api/v1/points/history/${id}`, {
      headers: { Authorization: `Bearer ${t}`, 'X-Admin-Key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'admin-key' },
    })
      .then(async res => {
        if (res.status === 401) { router.push("/"); return []; }
        if (!res.ok) return [];
        return res.json();
      })
      .then(data => setLedgers(Array.isArray(data) ? data : []))
      .catch(() => setLedgers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const now = new Date();
    setCurrentMonth(now);
    setTodayStr(now.toISOString().slice(0, 10));

    const t = localStorage.getItem("token");
    if (!t) { router.push("/"); return; }
    const payload = JSON.parse(atob(t.split(".")[1]));
    const id = payload.sub;
    setCrewId(id);
    setToken(t);
    fetchHistory(id, t);
  }, []);

  const handleCancelLedger = async () => {
    if (!cancelTarget) return;
    setCancelError("");
    setCancelLoading(true);
    try {
      for (const ledgerId of cancelTarget.ledgerIds) {
        const res = await fetch("/api/v1/points/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, 'X-Admin-Key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'admin-key' },
          body: JSON.stringify({ ledgerId, crewId }),
        });
        if (!res.ok) {
          setCancelError("취소 가능 시간이 지났습니다.");
          setCancelLoading(false);
          return;
        }
      }
      setCancelTarget(null);
      fetchHistory(crewId, token);
    } catch {
      setCancelError("오류가 발생했습니다.");
    } finally {
      setCancelLoading(false);
    }
  };

  const calBase = currentMonth ?? new Date(2000, 0, 1);
  const year = calBase.getFullYear();
  const month = calBase.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const fmt = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const ledgersByDate = ledgers.reduce((acc, l) => {
    const date = l.createdAt.slice(0, 10);
    if (!acc[date]) acc[date] = [];
    acc[date].push(l);
    return acc;
  }, {} as Record<string, Ledger[]>);

  const expiringByDate = ledgers.reduce((acc, l) => {
    if (l.expiredAt && l.ledgerType !== "EXPIRE" && l.ledgerType !== "USE") {
      const date = l.expiredAt.slice(0, 10);
      if (!acc[date]) acc[date] = 0;
      acc[date] += l.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const getDots = (dateStr: string) => {
    const items = ledgersByDate[dateStr] || [];
    return {
      hasInit: items.some(l => l.ledgerType === "INIT"),
      hasEarn: items.some(l => l.ledgerType === "EARN"),
      hasUse: items.some(l => l.ledgerType === "USE"),
      hasExpire: items.some(l => l.ledgerType === "EXPIRE"),
      hasExpiring: !!expiringByDate[dateStr],
    };
  };

  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const thisMonthLedgers = ledgers.filter(l => l.createdAt.startsWith(currentMonthPrefix));
  const totalEarned = thisMonthLedgers.filter(l => l.ledgerType === "EARN" || l.ledgerType === "INIT").reduce((s, l) => s + l.amount, 0);
  const totalUsed = thisMonthLedgers.filter(l => l.ledgerType === "USE").reduce((s, l) => s + l.amount, 0);
  const totalExpiring = Object.values(expiringByDate).reduce((s, v) => s + v, 0);

  const nextExpiry = Object.entries(expiringByDate)
    .filter(([d]) => d >= todayStr)
    .sort(([a], [b]) => a.localeCompare(b))[0];

  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthIdx = month === 0 ? 11 : month - 1;
  const prevMonthPrefix = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, "0")}`;
  const prevMonthLedgers = ledgers.filter(l =>
    l.createdAt.startsWith(prevMonthPrefix) && (l.ledgerType === "EARN" || l.ledgerType === "INIT")
  );

  const selectedLedgers = selectedDate ? (ledgersByDate[selectedDate] || []) : [];

  const typeInfo = (l: Ledger) => {
    if (l.ledgerType === "INIT") return { icon: "🎁", label: "초기 지급", color: "#1565C0", sign: "+", sub: dDayLabel(l.expiredAt) };
    if (l.ledgerType === "EARN") return { icon: "✅", label: "적립", color: "#1B9E5B", sign: "+", sub: dDayLabel(l.expiredAt) };
    if (l.ledgerType === "USE")  return { icon: "🛍️", label: "사용", color: "#E53935", sign: "-", sub: l.description || "포인트 사용" };
    return { icon: "⏰", label: "소멸", color: "#888", sign: "-", sub: "소멸된 포인트" };
  };

  return (
    <>
      <TopProgressBar loading={loading || cancelLoading} />
      {cancelTarget && (
        <CancelModal
          target={cancelTarget}
          onClose={() => { setCancelTarget(null); setCancelError(""); }}
          onConfirm={handleCancelLedger}
          error={cancelError}
        />
      )}

      <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
        <div style={{ background: "#1B9E5B", color: "#fff", padding: "16px 24px" }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>포인트 내역</h1>
        </div>

        <div style={{ maxWidth: 448, margin: "0 auto", padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* 요약 카드 */}
          <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div style={{ background: "#F0FAF4", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>총 적립</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#1B9E5B" }}>+{totalEarned.toLocaleString()}P</p>
              </div>
              <div style={{ background: "#FFF0F0", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>총 사용</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#E53935" }}>-{totalUsed.toLocaleString()}P</p>
              </div>
              <div style={{ background: "#FFF8E1", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>소멸 예정</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#E65100" }}>{totalExpiring.toLocaleString()}P</p>
              </div>
            </div>
          </div>

          {/* 소멸 예정 배너 */}
          {nextExpiry && (
            <div style={{ background: "#FFF3E0", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, border: "0.5px solid #FFE0B2" }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <span style={{ fontSize: 13, color: "#E65100", fontWeight: 500 }}>
                {nextExpiry[1].toLocaleString()}P가 {new Date(nextExpiry[0]).getMonth() + 1}월 {new Date(nextExpiry[0]).getDate()}일 소멸 예정이에요.{" "}
                {Math.ceil((new Date(nextExpiry[0]).getTime() - Date.now()) / 86400000)}일 전에 사용해보세요!
              </span>
            </div>
          )}

          {/* 캘린더 */}
          <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} disabled={!currentMonth}
                style={{ width: 32, height: 32, borderRadius: "50%", background: "#f5f5f5", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}>
                ‹
              </button>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>{year}년 {month + 1}월</p>
              <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} disabled={!currentMonth}
                style={{ width: 32, height: 32, borderRadius: "50%", background: "#f5f5f5", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}>
                ›
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
              {["일", "월", "화", "수", "목", "금", "토"].map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: 12, color: "#aaa", padding: "4px 0" }}>{d}</div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px 0" }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = fmt(year, month, day);
                const dots = getDots(dateStr);
                const isToday = dateStr === todayStr;
                const isSel = dateStr === selectedDate;

                return (
                  <button key={day}
                    onClick={() => setSelectedDate(isSel ? null : dateStr)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", padding: "5px 0",
                      borderRadius: 8, border: "none", cursor: "pointer",
                      background: isSel || isToday ? "#1B9E5B" : dots.hasExpiring ? "#FFF3E0" : "transparent",
                    }}>
                    <span style={{
                      fontSize: 13, fontWeight: isToday || isSel ? 700 : 400,
                      color: isSel || isToday ? "#fff" : "#1a1a1a",
                      width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "50%",
                    }}>{day}</span>
                    <div style={{ display: "flex", gap: 2, marginTop: 2, height: 6 }}>
                      {dots.hasInit   && <div style={{ width: 5, height: 5, borderRadius: "50%", background: isSel ? "#fff" : "#1565C0" }} />}
                      {dots.hasEarn   && <div style={{ width: 5, height: 5, borderRadius: "50%", background: isSel ? "#fff" : "#1B9E5B" }} />}
                      {dots.hasUse    && <div style={{ width: 5, height: 5, borderRadius: "50%", background: isSel ? "#fcc" : "#E53935" }} />}
                      {(dots.hasExpire || dots.hasExpiring) && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#aaa" }} />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #f0f0f0", flexWrap: "wrap" }}>
              {[
                { color: "#1565C0", label: "초기 지급" },
                { color: "#1B9E5B", label: "적립" },
                { color: "#E53935", label: "사용" },
                { color: "#aaa", label: "소멸 예정" },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                  <span style={{ fontSize: 11, color: "#888" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 선택 날짜 상세 패널 */}
          {selectedDate && (
            <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 12 }}>
                {selectedDate.slice(5).replace("-", "월 ")}일 내역
              </p>
              {selectedLedgers.length === 0 ? (
                <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "16px 0" }}>내역이 없습니다.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {mergeUseLedgers(selectedLedgers).map((l, i, arr) => {
                    const info = typeInfo(l);
                    const isTodayUse = l.ledgerType === "USE" && l.createdAt.startsWith(todayStr) && l.mergedIds.length > 0;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingBottom: 10, borderBottom: i < arr.length - 1 ? "0.5px solid #f0f0f0" : "none" }}>
                        <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{info.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>{info.label}</p>
                          <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>{info.sub}</p>
                          {l.grantedAt && l.ledgerType === "EARN" && (
                            <p style={{ fontSize: 11, color: "#aaa", margin: "1px 0 0" }}>지급일: {l.grantedAt.slice(0, 10)}</p>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: info.color }}>
                            {info.sign}{l.amount.toLocaleString()}P
                          </span>
                          {isTodayUse && (
                            <button
                              onClick={() => {
                                setCancelError("");
                                setCancelTarget({
                                  ledgerIds: l.mergedIds,
                                  amount: l.amount,
                                  description: l.description || "포인트 사용",
                                });
                              }}
                              disabled={cancelLoading}
                              style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "#FFEBEE", color: "#E53935", border: "0.5px solid #FFCDD2", cursor: "pointer", fontWeight: 600 }}>
                              취소
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 지난달 내역 */}
          {prevMonthLedgers.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", overflow: "hidden" }}>
              <button
                onClick={() => setPrevOpen(o => !o)}
                style={{ width: "100%", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>
                  {prevYear}년 {prevMonthIdx + 1}월 적립 내역
                </span>
                <span style={{ fontSize: 13, color: "#888" }}>{prevOpen ? "▲ 접기" : "▼ 펼치기"}</span>
              </button>
              {prevOpen && (
                <div style={{ borderTop: "0.5px solid #f0f0f0" }}>
                  {prevMonthLedgers.map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < prevMonthLedgers.length - 1 ? "0.5px solid #f5f5f5" : "none" }}>
                      <div>
                        <p style={{ fontSize: 13, color: "#1a1a1a", margin: 0 }}>근무일 {l.grantedAt ? l.grantedAt.slice(0, 10) : l.createdAt.slice(0, 10)}</p>
                        <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>지급 {l.createdAt.slice(0, 10)}</p>
                        {l.expiredAt && (
                          <p style={{ fontSize: 11, color: "#E65100", margin: "1px 0 0" }}>{dDayLabel(l.expiredAt)}</p>
                        )}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1B9E5B" }}>+{l.amount.toLocaleString()}P</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
