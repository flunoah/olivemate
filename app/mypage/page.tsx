"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopProgressBar } from "../components/TopProgressBar";

const DAYS = [
  { label: "일", value: 0 },
  { label: "월", value: 1 },
  { label: "화", value: 2 },
  { label: "수", value: 3 },
  { label: "목", value: 4 },
  { label: "금", value: 5 },
  { label: "토", value: 6 },
];

interface ScheduleInfo {
  daysOfWeek: number[];
  startDate: string;
}

export default function MyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [currentSchedule, setCurrentSchedule] = useState<ScheduleInfo | null>(null);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/"); return; }
    const payload = JSON.parse(atob(token.split(".")[1]));
    setName(payload.name || "크루");
    const crewId = payload.sub;

    setPageLoading(true);
    fetch(`/api/v1/schedule/me/${crewId}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Admin-Key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'admin-key' },
    })
      .then(async res => {
        if (!res.ok) return null;
        const data = await res.json();
        if (Array.isArray(data)) {
          setCurrentSchedule({ daysOfWeek: data, startDate: "" });
          setSelectedDays(data);
        } else if (data && Array.isArray(data.daysOfWeek)) {
          setCurrentSchedule(data);
          setSelectedDays(data.daysOfWeek);
          setStartDate(data.startDate || "");
        }
      })
      .catch(() => {})
      .finally(() => setPageLoading(false));
  }, []);

  const toggleDay = (day: number) =>
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  const handleRequestSave = () => {
    if (selectedDays.length === 0) { setMessage("근무 요일을 선택해주세요."); setMessageType("error"); return; }
    if (!startDate) { setMessage("적용 시작일을 선택해주세요."); setMessageType("error"); return; }
    setMessage("");
    setConfirmStep(true);
  };

  const handleSave = async () => {
    setLoading(true); setMessage("");
    const token = localStorage.getItem("token") || "";
    const payload = JSON.parse(atob(token.split(".")[1]));
    const crewId = payload.sub;
    try {
      const res = await fetch("/api/v1/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, 'X-Admin-Key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'admin-key' },
        body: JSON.stringify({ crewId, daysOfWeek: selectedDays, startDate }),
      });
      if (res.ok) {
        setMessage("근무 요일이 저장됐어요!");
        setMessageType("success");
        setCurrentSchedule({ daysOfWeek: selectedDays, startDate });
        setConfirmStep(false);
        setShowChangeForm(false);
      } else {
        const status = res.status;
        if (status === 401) setMessage("아이디 또는 비밀번호를 확인해주세요");
        else if (status === 403) setMessage("접근 권한이 없습니다");
        else if (status >= 500) setMessage("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요");
        else setMessage("저장에 실패했습니다.");
        setMessageType("error");
        setConfirmStep(false);
      }
    } catch { setMessage("서버 연결에 실패했습니다."); setMessageType("error"); setConfirmStep(false); }
    finally { setLoading(false); }
  };

  const sortedDays = (days: number[]) =>
    [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));

  const initial = name.slice(0, 1);

  return (
    <>
    <TopProgressBar loading={pageLoading || loading} />
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <div style={{ background: "#1B9E5B", color: "#fff", padding: "16px 24px" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>마이페이지</h1>
      </div>

      <div style={{ maxWidth: 448, margin: "0 auto", padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* 프로필 */}
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#1B9E5B", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
            {initial}
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>{name}</p>
            <p style={{ fontSize: 12, color: "#888", margin: "3px 0 0" }}>올리브영 MATE · 크루</p>
          </div>
        </div>

        {/* 현재 소정 근무일 카드 */}
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>현재 소정 근무일</p>
            <button
              onClick={() => setShowChangeForm(v => !v)}
              style={{ fontSize: 13, color: "#1B9E5B", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
              {showChangeForm ? "닫기" : "변경하기"}
            </button>
          </div>

          {currentSchedule && currentSchedule.daysOfWeek.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {sortedDays(currentSchedule.daysOfWeek).map(day => (
                  <span key={day} style={{ padding: "5px 10px", borderRadius: 20, background: "#E8F5E9", color: "#1B9E5B", fontSize: 13, fontWeight: 600 }}>
                    {["일", "월", "화", "수", "목", "금", "토"][day]}
                  </span>
                ))}
              </div>
              {currentSchedule.startDate && (
                <span style={{ fontSize: 12, color: "#888", flexShrink: 0, marginLeft: 8 }}>{currentSchedule.startDate}~</span>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#aaa" }}>설정된 소정 근무일이 없습니다.</p>
          )}
        </div>

        {/* 변경 폼 */}
        {showChangeForm && (
          <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 12 }}>변경할 요일 선택</p>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {DAYS.map(day => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: selectedDays.includes(day.value) ? "#1B9E5B" : "#f0f0f0",
                    color: selectedDays.includes(day.value) ? "#fff" : "#888",
                  }}>
                  {day.label}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>적용 시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ width: "100%", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
            />

            {message && !confirmStep && (
              <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13, background: messageType === "success" ? "#F0FAF4" : "#FFF0F0", color: messageType === "success" ? "#1B9E5B" : "#E53935" }}>
                {message}
              </div>
            )}

            {confirmStep ? (
              <div style={{ background: "#F0FFF4", borderRadius: 10, padding: "14px", marginBottom: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>다음과 같이 변경할까요?</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  {sortedDays(selectedDays).map(day => (
                    <span key={day} style={{ padding: "4px 10px", borderRadius: 20, background: "#1B9E5B", color: "#fff", fontSize: 13, fontWeight: 600 }}>
                      {["일", "월", "화", "수", "목", "금", "토"][day]}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>{startDate}부터 적용</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setConfirmStep(false)}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 8, background: "#f0f0f0", color: "#555", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    취소
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 8, background: "#1B9E5B", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.5 : 1 }}>
                    {loading ? "저장 중..." : "확인"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleRequestSave}
                style={{ width: "100%", padding: "12px 0", borderRadius: 8, background: "#1B9E5B", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                저장하기
              </button>
            )}
          </div>
        )}

        {/* 저장 성공 메시지 (폼 닫힌 후) */}
        {!showChangeForm && message && messageType === "success" && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "#F0FAF4", color: "#1B9E5B", fontSize: 13, fontWeight: 500 }}>
            {message}
          </div>
        )}

        {/* 로그아웃 */}
        <button
          onClick={() => { localStorage.removeItem("token"); router.push("/"); }}
          style={{ marginTop: 8, padding: "14px 0", borderRadius: 10, background: "#fff", color: "#E53935", border: "0.5px solid #e0e0e0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          로그아웃
        </button>

      </div>
    </div>
    </>
  );
}
