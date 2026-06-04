"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Crew {
  crewId: string;
  name: string;
  loginId: string;
  role: string;
}

interface Workday {
  workDate: string;
  pointGranted: boolean;
  skipped: boolean;
}

interface Ledger {
  id?: string | number;
  ledgerType?: string;
  type?: string;
  amount: number;
  description?: string;
  grantedAt?: string;
  expiredAt: string | null;
  createdAt: string;
}

type Tab = "workdays" | "history" | "grant" | "info";

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "admin-key";

export default function AdminPage() {
  const router = useRouter();
  const [crews, setCrews] = useState<Crew[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Crew | null>(null);
  const [tab, setTab] = useState<Tab>("workdays");

  const [workdays, setWorkdays] = useState<Workday[]>([]);
  const [wdLoading, setWdLoading] = useState(false);
  const [monthDate, setMonthDate] = useState(new Date());

  const [ledgers, setLedgers] = useState<Ledger[]>([]);

  const [actLoading, setActLoading] = useState(false);

  const [grantAmount, setGrantAmount] = useState("");
  const [grantDesc, setGrantDesc] = useState("");
  const [grantDate, setGrantDate] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);

  const [showReg, setShowReg] = useState(false);
  const [regName, setRegName] = useState("");
  const [regLoginId, setRegLoginId] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");

  const [showDelete, setShowDelete] = useState(false);

  const [toast, setToast] = useState({ msg: "", type: "success" as "success" | "error" });

  const tok = () => localStorage.getItem("adminToken") || "";

  const ah = (extra: Record<string, string> = {}): Record<string, string> => ({
    Authorization: `Bearer ${tok()}`,
    "X-Admin-Key": ADMIN_KEY,
    ...extra,
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(t => t.msg === msg ? { msg: "", type: "success" } : t), 3000);
  };

  const fetchCrews = async () => {
    try {
      const res = await fetch("/api/v1/admin/crews", { headers: ah() });
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (res.ok) setCrews(await res.json());
    } catch {}
  };

  const fetchWorkdays = async (crewId: string, date: Date) => {
    setWdLoading(true);
    try {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const last = new Date(y, date.getMonth() + 1, 0).getDate();
      const from = `${y}-${m}-01`;
      const to = `${y}-${m}-${String(last).padStart(2, "0")}`;
      const res = await fetch(
        `/api/v1/admin/workdays?crewId=${crewId}&from=${from}&to=${to}`,
        { headers: ah() }
      );
      if (res.ok) setWorkdays(await res.json());
      else setWorkdays([]);
    } catch { setWorkdays([]); }
    finally { setWdLoading(false); }
  };

  const fetchHistory = async (crewId: string) => {
    try {
      const res = await fetch(`/api/v1/points/history/${crewId}`, { headers: ah() });
      if (res.ok) setLedgers(await res.json());
      else setLedgers([]);
    } catch { setLedgers([]); }
  };

  useEffect(() => {
    const t = localStorage.getItem("adminToken");
    if (!t) { router.push("/admin/login"); return; }
    fetchCrews();
  }, []);

  useEffect(() => {
    if (!selected) return;
    if (tab === "workdays") fetchWorkdays(selected.crewId, monthDate);
    else if (tab === "history") fetchHistory(selected.crewId);
  }, [selected?.crewId, tab, monthDate]);

  const selectCrew = (crew: Crew) => {
    setSelected(crew);
    setTab("workdays");
    setWorkdays([]);
    setLedgers([]);
    setMonthDate(new Date());
  };

  const handleAbsent = async (workDate: string) => {
    if (!selected) return;
    setActLoading(true);
    try {
      const res = await fetch(
        `/api/v1/attendance/cancel?crewId=${selected.crewId}&workDate=${workDate}`,
        { method: "DELETE", headers: ah() }
      );
      if (res.ok) { showToast("결근 처리됐어요."); fetchWorkdays(selected.crewId, monthDate); }
      else showToast("처리에 실패했습니다.", "error");
    } catch { showToast("오류가 발생했습니다.", "error"); }
    finally { setActLoading(false); }
  };

  const handleReinstate = async (workDate: string) => {
    if (!selected) return;
    setActLoading(true);
    try {
      const res = await fetch(
        `/api/v1/attendance/reinstate?crewId=${selected.crewId}&workDate=${workDate}`,
        { method: "PUT", headers: ah() }
      );
      if (res.ok) { showToast("복원됐어요."); fetchWorkdays(selected.crewId, monthDate); }
      else showToast("처리에 실패했습니다.", "error");
    } catch { showToast("오류가 발생했습니다.", "error"); }
    finally { setActLoading(false); }
  };

  const handleGrant = async () => {
    if (!selected || !grantAmount) return;
    setGrantLoading(true);
    try {
      const body: Record<string, unknown> = {
        crewId: selected.crewId,
        amount: Number(grantAmount),
        description: grantDesc || "수동 적립",
      };
      if (grantDate) body.workDate = grantDate;
      const res = await fetch("/api/v1/admin/points/grant", {
        method: "POST",
        headers: ah({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast(`${Number(grantAmount).toLocaleString()}P 적립됐어요.`);
        setGrantAmount(""); setGrantDesc(""); setGrantDate("");
      } else {
        showToast("적립에 실패했습니다.", "error");
      }
    } catch { showToast("오류가 발생했습니다.", "error"); }
    finally { setGrantLoading(false); }
  };

  const handleRegister = async () => {
    if (!regName || !regLoginId || !regPassword) { setRegError("모든 항목을 입력해주세요."); return; }
    setRegLoading(true); setRegError("");
    try {
      const res = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: ah({ "Content-Type": "application/json" }),
        body: JSON.stringify({ loginId: regLoginId, password: regPassword, name: regName }),
      });
      if (!res.ok) { setRegError("이미 사용 중인 사번입니다."); return; }
      showToast(`${regName} 크루가 등록됐어요.`);
      setShowReg(false);
      setRegName(""); setRegLoginId(""); setRegPassword("");
      fetchCrews();
    } catch { setRegError("서버 연결에 실패했습니다."); }
    finally { setRegLoading(false); }
  };

  const handleDeleteCrew = async () => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/v1/admin/crews/${selected.crewId}`, {
        method: "DELETE",
        headers: ah(),
      });
      if (res.ok) {
        showToast(`${selected.name} 크루가 삭제됐어요.`);
        setSelected(null);
        setShowDelete(false);
        fetchCrews();
      } else {
        showToast("삭제에 실패했습니다.", "error");
      }
    } catch { showToast("오류가 발생했습니다.", "error"); }
  };

  const filtered = crews.filter(c =>
    c.name.includes(search) || c.loginId.includes(search)
  );

  const tabBtn = (t: Tab, label: string) => (
    <button key={t} onClick={() => setTab(t)} style={{
      padding: "8px 14px", borderRadius: 8,
      background: tab === t ? "#1B9E5B" : "transparent",
      color: tab === t ? "#fff" : "#888",
      border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
    }}>{label}</button>
  );

  const ledgerInfo = (l: Ledger) => {
    const t = l.ledgerType || l.type || "";
    if (t === "EARN") return { label: "적립", color: "#1B9E5B", sign: "+" };
    if (t === "USE")  return { label: "사용", color: "#E53935", sign: "-" };
    if (t === "INIT") return { label: "초기 지급", color: "#1565C0", sign: "+" };
    return { label: "소멸", color: "#888", sign: "-" };
  };

  const y = monthDate.getFullYear();
  const mi = monthDate.getMonth();
  const DAY = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <>
      {/* Toast */}
      {toast.msg && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "success" ? "#1B9E5B" : "#E53935",
          color: "#fff", padding: "12px 20px", borderRadius: 10,
          fontSize: 14, fontWeight: 500, zIndex: 9999, whiteSpace: "nowrap",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}>{toast.msg}</div>
      )}

      {/* Register Modal */}
      {showReg && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>크루 등록</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                { label: "이름", value: regName, set: setRegName, placeholder: "홍길동" },
                { label: "사번", value: regLoginId, set: setRegLoginId, placeholder: "사번 입력" },
                { label: "비밀번호", value: regPassword, set: setRegPassword, placeholder: "초기 비밀번호", type: "password" },
              ] as { label: string; value: string; set: (v: string) => void; placeholder: string; type?: string }[]).map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input
                    type={f.type || "text"}
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    style={{ width: "100%", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              ))}
              {regError && <p style={{ fontSize: 12, color: "#E53935", margin: 0 }}>{regError}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => { setShowReg(false); setRegError(""); }}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 8, background: "#f0f0f0", color: "#555", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  취소
                </button>
                <button onClick={handleRegister} disabled={regLoading}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 8, background: "#1B9E5B", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: regLoading ? 0.5 : 1 }}>
                  {regLoading ? "등록 중..." : "등록"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDelete && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 360 }}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>크루 삭제</p>
            <p style={{ fontSize: 14, color: "#555", marginBottom: 6 }}>
              <strong>{selected.name}</strong> ({selected.loginId}) 크루를 삭제할까요?
            </p>
            <p style={{ fontSize: 12, color: "#E53935", marginBottom: 20 }}>이 작업은 되돌릴 수 없습니다.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowDelete(false)}
                style={{ flex: 1, padding: "11px 0", borderRadius: 8, background: "#f0f0f0", color: "#555", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                취소
              </button>
              <button onClick={handleDeleteCrew}
                style={{ flex: 1, padding: "11px 0", borderRadius: 8, background: "#E53935", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: "100%", minHeight: "100vh", background: "#f5f5f5", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ background: "#1B9E5B", color: "#fff", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>🫒 MATE Admin</div>
          <button
            onClick={() => {
              localStorage.removeItem("adminToken");
              document.cookie = "adminToken=; path=/; max-age=0";
              router.push("/admin/login");
            }}
            style={{ fontSize: 13, opacity: 0.85, background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
            로그아웃
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Sidebar */}
          <div style={{ width: 240, background: "#fff", borderRight: "0.5px solid #e0e0e0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "12px 12px 8px" }}>
              <button
                onClick={() => setShowReg(true)}
                style={{ width: "100%", padding: "9px 0", borderRadius: 8, background: "#1B9E5B", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>
                + 크루 등록
              </button>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="이름 또는 사번 검색"
                style={{ width: "100%", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
              {filtered.length === 0 && (
                <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "20px 0" }}>크루 없음</p>
              )}
              {filtered.map(c => (
                <button
                  key={c.crewId}
                  onClick={() => selectCrew(c)}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8, border: "none",
                    background: selected?.crewId === c.crewId ? "#E8F5E9" : "transparent",
                    textAlign: "left", cursor: "pointer", marginBottom: 2,
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: selected?.crewId === c.crewId ? "#1B9E5B" : "#1a1a1a" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>{c.loginId}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
            {!selected ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#bbb", fontSize: 14 }}>
                왼쪽에서 크루를 선택하세요
              </div>
            ) : (
              <div style={{ maxWidth: 680 }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", margin: "0 0 12px" }}>{selected.name}</p>

                {/* Tab bar */}
                <div style={{ display: "flex", gap: 2, background: "#f0f0f0", borderRadius: 10, padding: 4, marginBottom: 16, width: "fit-content" }}>
                  {tabBtn("workdays", "근무 관리")}
                  {tabBtn("history", "포인트 내역")}
                  {tabBtn("grant", "포인트 적립")}
                  {tabBtn("info", "회원 정보")}
                </div>

                {/* ── 근무 관리 ── */}
                {tab === "workdays" && (
                  <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <button onClick={() => setMonthDate(new Date(y, mi - 1, 1))}
                        style={{ width: 32, height: 32, borderRadius: "50%", background: "#f5f5f5", border: "none", fontSize: 18, cursor: "pointer", color: "#555" }}>‹</button>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{y}년 {mi + 1}월</span>
                      <button onClick={() => setMonthDate(new Date(y, mi + 1, 1))}
                        style={{ width: 32, height: 32, borderRadius: "50%", background: "#f5f5f5", border: "none", fontSize: 18, cursor: "pointer", color: "#555" }}>›</button>
                    </div>

                    {wdLoading ? (
                      <p style={{ textAlign: "center", color: "#aaa", padding: "24px 0", fontSize: 13 }}>불러오는 중...</p>
                    ) : workdays.length === 0 ? (
                      <p style={{ textAlign: "center", color: "#aaa", padding: "24px 0", fontSize: 13 }}>이 달의 근무 데이터 없음</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {workdays.map(wd => {
                          const d = new Date(wd.workDate + "T00:00:00");
                          const label = `${mi + 1}월 ${d.getDate()}일 (${DAY[d.getDay()]})`;
                          let statusText = "대기중", statusColor = "#E65100";
                          let bg = "#FFFBF0", border = "0.5px solid #FFE0B2";
                          if (wd.skipped)      { statusText = "결근";    statusColor = "#E53935"; bg = "#FFF5F5"; border = "0.5px solid #FFCDD2"; }
                          else if (wd.pointGranted) { statusText = "적립 완료"; statusColor = "#1B9E5B"; bg = "#F0FFF4"; border = "0.5px solid #A5D6A7"; }
                          return (
                            <div key={wd.workDate} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: bg, border }}>
                              <div>
                                <span style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a" }}>{label}</span>
                                <span style={{ fontSize: 12, color: statusColor, marginLeft: 8, fontWeight: 600 }}>{statusText}</span>
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                {!wd.skipped && (
                                  <button onClick={() => handleAbsent(wd.workDate)} disabled={actLoading}
                                    style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "0.5px solid #E53935", color: "#E53935", background: "#fff", cursor: "pointer", opacity: actLoading ? 0.5 : 1 }}>
                                    결근
                                  </button>
                                )}
                                {wd.skipped && (
                                  <button onClick={() => handleReinstate(wd.workDate)} disabled={actLoading}
                                    style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "0.5px solid #1B9E5B", color: "#1B9E5B", background: "#fff", cursor: "pointer", opacity: actLoading ? 0.5 : 1 }}>
                                    복원
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

                {/* ── 포인트 내역 ── */}
                {tab === "history" && (
                  <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: 16 }}>
                    {ledgers.length === 0 ? (
                      <p style={{ textAlign: "center", color: "#aaa", padding: "24px 0", fontSize: 13 }}>내역 없음</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {ledgers.map((l, i) => {
                          const info = ledgerInfo(l);
                          return (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: i < ledgers.length - 1 ? "0.5px solid #f0f0f0" : "none" }}>
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{info.label}</span>
                                {l.description && <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>{l.description}</span>}
                                <p style={{ fontSize: 11, color: "#aaa", margin: "2px 0 0" }}>{l.createdAt.slice(0, 10)}</p>
                              </div>
                              <span style={{ fontSize: 14, fontWeight: 700, color: info.color, flexShrink: 0 }}>
                                {info.sign}{l.amount.toLocaleString()}P
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── 포인트 적립 ── */}
                {tab === "grant" && (
                  <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: 16 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#1a1a1a" }}>수동 적립 (소급)</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>포인트</label>
                        <input
                          type="number"
                          value={grantAmount}
                          onChange={e => setGrantAmount(e.target.value)}
                          placeholder="4000"
                          style={{ width: "100%", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>사유</label>
                        <input
                          type="text"
                          value={grantDesc}
                          onChange={e => setGrantDesc(e.target.value)}
                          placeholder="예: 5월 15일 근무 소급 적립"
                          style={{ width: "100%", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>근무일 (선택)</label>
                        <input
                          type="date"
                          value={grantDate}
                          onChange={e => setGrantDate(e.target.value)}
                          style={{ width: "100%", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                      <button
                        onClick={handleGrant}
                        disabled={grantLoading || !grantAmount}
                        style={{ padding: "12px 0", borderRadius: 8, background: "#1B9E5B", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: (grantLoading || !grantAmount) ? 0.5 : 1 }}>
                        {grantLoading ? "적립 중..." : "적립하기"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── 회원 정보 ── */}
                {tab === "info" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: 16 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#1a1a1a" }}>회원 정보</p>
                      {([["이름", selected.name], ["사번", selected.loginId], ["역할", selected.role]] as [string, string][]).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                          <span style={{ fontSize: 13, color: "#888" }}>{k}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowDelete(true)}
                      style={{ padding: "13px 0", borderRadius: 10, background: "#fff", color: "#E53935", border: "0.5px solid #FFCDD2", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                      크루 삭제
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
