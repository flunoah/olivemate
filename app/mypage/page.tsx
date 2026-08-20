"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopProgressBar } from "../components/TopProgressBar";
import { authFetch, clearAuth, isTokenExpired, silentRefresh } from "../lib/auth";

// ponytail: 버그 제보 섹션은 기능은 유지하고 노출만 끔 (FR-01). 재노출 시 true로.
const SHOW_BUG_REPORT = false;

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
  const [bugType, setBugType] = useState("");
  const [bugDesc, setBugDesc] = useState("");
  const [bugSubmitted, setBugSubmitted] = useState(false);

  const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY || 'admin-key';

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.push("/"); return; }

    const proceed = (token: string) => {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setName(payload.name || "크루");
        const crewId = payload.sub;

        setPageLoading(true);
        authFetch(`/api/v1/schedule/me/${crewId}`, {
          headers: { 'X-Admin-Key': adminKey },
        })
          .then(async res => {
            if (!res.ok) return null;
            const res2 = await res.json();
            const data = res2?.data ?? res2;
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
      } catch { clearAuth(); router.push("/"); }
    };

    if (isTokenExpired()) {
      silentRefresh().then(newToken => {
        if (newToken) proceed(newToken);
        else { clearAuth(); router.push("/"); }
      });
    } else {
      proceed(t);
    }
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
      const res = await authFetch("/api/v1/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json", 'X-Admin-Key': adminKey },
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
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>내 주소정</h1>
      </div>

      <div style={{ maxWidth: 448, margin: "0 auto", padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* 프로필 */}
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#1B9E5B", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
            {initial}
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>{name}</p>
            <p style={{ fontSize: 12, color: "#888", margin: "3px 0 0" }}>올리브영 마이자소 · 크루</p>
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

        {/* 버그 제보 */}
        {SHOW_BUG_REPORT && (
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e0e0e0", padding: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 12 }}>🐛 버그 제보하기</p>
          {bugSubmitted ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1B9E5B", margin: 0 }}>제보해주셔서 감사해요!</p>
              <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>빠르게 확인하고 수정할게요.</p>
              <button
                onClick={() => { setBugSubmitted(false); setBugType(""); setBugDesc(""); }}
                style={{ marginTop: 12, fontSize: 12, color: "#888", background: "none", border: "none", cursor: "pointer" }}>
                다시 제보하기
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>버그 유형</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {["UI 문제", "기능 오류", "포인트 오류", "기타"].map(type => (
                  <button key={type} onClick={() => setBugType(type)} style={{
                    padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                    background: bugType === type ? "#1B9E5B" : "#f5f5f5",
                    color: bugType === type ? "#fff" : "#555",
                    border: bugType === type ? "none" : "0.5px solid #e0e0e0",
                  }}>{type}</button>
                ))}
              </div>
              <textarea
                value={bugDesc}
                onChange={e => setBugDesc(e.target.value)}
                placeholder="어떤 문제가 발생했는지 알려주세요."
                rows={4}
                style={{ width: "100%", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit" }}
              />
              <button
                onClick={async () => {
                  if (!bugDesc.trim()) return;
                  const subject = encodeURIComponent(`[마이자소 버그 제보] ${bugType || "기타"}`);
                  const mailBody = encodeURIComponent(`크루: ${name}\n유형: ${bugType || "기타"}\n\n내용:\n${bugDesc}`);
                  window.open(`mailto:dragonusuny@naver.com?subject=${subject}&body=${mailBody}`);
                  await fetch("/api/bugs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ crewName: name, type: bugType || "기타", description: bugDesc }),
                  }).catch(() => {});
                  setBugSubmitted(true);
                }}
                disabled={!bugDesc.trim()}
                style={{ width: "100%", marginTop: 10, padding: "12px 0", borderRadius: 8, background: "#1B9E5B", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: bugDesc.trim() ? "pointer" : "default", opacity: bugDesc.trim() ? 1 : 0.4 }}>
                제보하기
              </button>
            </>
          )}
        </div>
        )}

        {/* 로그아웃 */}
        <button
          onClick={() => { clearAuth(); router.push("/"); }}
          style={{ marginTop: 8, padding: "14px 0", borderRadius: 10, background: "#fff", color: "#E53935", border: "0.5px solid #e0e0e0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          로그아웃
        </button>

        {/* 팁박스 (FR-02) */}
        <div style={{ background: "#FFF8E1", borderRadius: 10, border: "0.5px solid #FFE7A0", padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#8a6d1a", marginBottom: 8 }}>💡 사용 전 확인해주세요</p>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            <li style={{ fontSize: 12, color: "#8a6d1a", lineHeight: 1.5 }}>포인트는 익일 오전 1시에 적립돼요.</li>
            <li style={{ fontSize: 12, color: "#8a6d1a", lineHeight: 1.5 }}>근무 스케줄 변경은 가급적 적용되는 해당 주의 월요일에 입력해주세요.</li>
            <li style={{ fontSize: 12, color: "#8a6d1a", lineHeight: 1.5 }}>
              자소 추가, 삭제 기타 오류가 발생하면{" "}
              <a href="https://open.kakao.com/o/gMhCNOFi" target="_blank" rel="noopener noreferrer" style={{ color: "#1B9E5B", fontWeight: 600, textDecoration: "underline" }}>
                오픈채팅방
              </a>
              에 남겨주세요.
            </li>
          </ul>
        </div>

      </div>
    </div>
    </>
  );
}
