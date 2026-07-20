'use client';

// BottomDock — a drag-resizable bottom panel for the standalone windows
// (Scan & Trade, Hedge & Trade, EMIL). Same grip-dot dragger pattern as the
// main terminal's chart/positions divider.

import { useCallback, useEffect, useRef, useState } from 'react';

export default function BottomDock({ children, initialHeight = 220 }: { children: React.ReactNode; initialHeight?: number }) {
  const [height, setHeight] = useState(initialHeight);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(initialHeight);

  const onDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [height]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      setHeight(Math.max(80, Math.min(600, startH.current + (startY.current - e.clientY))));
    };
    const up = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  return (
    <>
      {/* Dragger */}
      <div onMouseDown={onDown} className="relative shrink-0" style={{ height: 6, cursor: 'row-resize', zIndex: 50 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,145,213,0.1) 50%, rgba(255,255,255,0.02) 100%)',
          borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', gap: 3 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
        </div>
      </div>
      <div className="shrink-0 overflow-auto" style={{ height }}>
        {children}
      </div>
    </>
  );
}
