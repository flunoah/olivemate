"use client";
import { useEffect, useRef, useState } from "react";

export function TopProgressBar({ loading }: { loading: boolean }) {
  const [width, setWidth] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const started = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    clear();
    if (loading) {
      started.current = true;
      setOpacity(1);
      setWidth(0);
      timers.current = [
        setTimeout(() => setWidth(20), 30),
        setTimeout(() => setWidth(55), 600),
        setTimeout(() => setWidth(75), 1800),
        setTimeout(() => setWidth(85), 4000),
      ];
    } else if (started.current) {
      started.current = false;
      setWidth(100);
      timers.current = [
        setTimeout(() => setOpacity(0), 250),
        setTimeout(() => { setWidth(0); setOpacity(1); }, 600),
      ];
    }
    return clear;
  }, [loading]);

  if (width === 0 && !loading) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0,
      height: 3, zIndex: 9999, pointerEvents: "none",
      opacity, transition: "opacity 0.35s",
    }}>
      <div style={{
        height: "100%",
        background: "#1B9E5B",
        width: `${width}%`,
        transition: width === 0 ? "none" : width >= 100 ? "width 0.15s ease-out" : "width 0.8s ease-out",
        boxShadow: "0 0 8px rgba(27, 158, 91, 0.5)",
      }} />
    </div>
  );
}
