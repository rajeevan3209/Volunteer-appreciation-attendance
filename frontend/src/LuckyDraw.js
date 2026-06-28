import React, { useState, useEffect, useRef, useCallback } from 'react';
import './LuckyDraw.css';

const COLORS = [
  '#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#558b2f',
  '#33691e', '#4caf50', '#1a7c2a', '#2d6a2d', '#3d8b37',
];

function getCanvasSize() {
  return Math.min(520, window.innerWidth - 40);
}

export default function LuckyDraw() {
  const [allParticipants, setAllParticipants] = useState([]);
  const [wheel, setWheel] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canvasSize, setCanvasSize] = useState(getCanvasSize());
  const canvasRef = useRef(null);
  const spinAngleRef = useRef(0);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const onResize = () => setCanvasSize(getCanvasSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    fetch('/api/attendance')
      .then(r => r.json())
      .then(data => {
        const names = [...new Set(data.map(a => a.participantName))];
        setAllParticipants(names);
        setWheel(names);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const drawWheel = useCallback((angle, participants) => {
    const canvas = canvasRef.current;
    if (!canvas || participants.length === 0) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = cx - 14;
    const arc = (2 * Math.PI) / participants.length;

    ctx.clearRect(0, 0, size, size);

    // Shadow ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 6, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fill();

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#1b5e20';
    ctx.fill();

    participants.forEach((name, i) => {
      const startAngle = angle + i * arc;
      const endAngle = startAngle + arc;

      // Segment fill
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();

      // Segment border
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Name text
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      const fontSize = Math.max(9, Math.min(14, 180 / participants.length + 4));
      ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 3;
      let displayName = name;
      const maxChars = Math.max(10, Math.floor(400 / participants.length));
      if (displayName.length > maxChars) displayName = displayName.substring(0, maxChars - 1) + '…';
      ctx.fillText(displayName, radius - 14, fontSize / 3);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, 2 * Math.PI);
    ctx.fillStyle = '#1b5e20';
    ctx.fill();

    // Pointer arrow at top
    const pw = 14;
    const ph = 30;
    ctx.beginPath();
    ctx.moveTo(cx - pw, ph / 2);
    ctx.lineTo(cx + pw, ph / 2);
    ctx.lineTo(cx, ph + 10);
    ctx.closePath();
    ctx.fillStyle = '#ff8f00';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  useEffect(() => {
    drawWheel(spinAngleRef.current, wheel);
  }, [wheel, drawWheel, canvasSize]);

  const spin = () => {
    if (spinning || wheel.length === 0) return;
    setSpinning(true);
    setWinner(null);

    const minRotations = 6;
    const extraRotations = Math.random() * 6;
    const totalRotation = (minRotations + extraRotations) * 2 * Math.PI;
    const duration = 5000;
    const startTime = performance.now();
    const startAngle = spinAngleRef.current;

    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease out quint for satisfying deceleration
      const eased = 1 - Math.pow(1 - t, 5);
      const currentAngle = startAngle + totalRotation * eased;
      spinAngleRef.current = currentAngle;
      drawWheel(currentAngle, wheel);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Pointer is at top of canvas (angle -PI/2 from unit circle)
        // Segment 0 starts at `currentAngle`, pointer points "up" = 3*PI/2 (or -PI/2)
        const arc = (2 * Math.PI) / wheel.length;
        const norm = ((currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        // How far around from segment 0's start to the pointer (top = 3PI/2)
        const pointerOffset = ((3 * Math.PI / 2) - norm + 2 * Math.PI) % (2 * Math.PI);
        const winnerIdx = Math.floor(pointerOffset / arc) % wheel.length;
        setWinner(wheel[winnerIdx]);
        setSpinning(false);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  const removeWinner = () => {
    setWheel(prev => prev.filter(p => p !== winner));
    setWinner(null);
  };

  const keepAndSpinAgain = () => {
    setWinner(null);
  };

  const resetWheel = () => {
    setWheel(allParticipants);
    setWinner(null);
    spinAngleRef.current = 0;
  };

  return (
    <div className="ld-app">
      <header className="ld-header">
        <div>
          <h1>Welcome to Volunteer Appreciation Dinner</h1>
          <p>Pasir Ris West Community Centre · Lucky Draw</p>
        </div>
      </header>

      <main className="ld-main">
        {loading ? (
          <div className="ld-loading">⏳ Loading participants…</div>
        ) : allParticipants.length === 0 ? (
          <div className="ld-empty-state">
            <p>No attended participants found.</p>
            <p className="ld-empty-sub">Mark attendance first before running the lucky draw.</p>
          </div>
        ) : (
          <>
            <div className="ld-meta">
              <span className="ld-count">{wheel.length} on wheel</span>
              {wheel.length < allParticipants.length && (
                <button className="ld-btn-reset" onClick={resetWheel}>↺ Reset wheel</button>
              )}
            </div>

            <div className="ld-wheel-wrapper">
              <canvas
                ref={canvasRef}
                width={canvasSize}
                height={canvasSize}
                className="ld-canvas"
              />
            </div>

            {wheel.length === 0 ? (
              <div className="ld-all-drawn">
                🎊 All participants have been drawn!
                <button className="ld-btn-reset" onClick={resetWheel}>↺ Reset wheel</button>
              </div>
            ) : !winner ? (
              <button
                className="ld-spin-btn"
                onClick={spin}
                disabled={spinning || wheel.length < 2}
              >
                {spinning ? '🌀 Spinning…' : '🎡 SPIN'}
              </button>
            ) : (
              <div className="ld-winner-card">
                <div className="ld-winner-trophy">🏆</div>
                <div className="ld-winner-label">🎉 Winner!</div>
                <div className="ld-winner-name">{winner}</div>
                <div className="ld-winner-actions">
                  <button className="ld-btn-remove" onClick={removeWinner}>
                    Remove from wheel
                  </button>
                  <button className="ld-btn-keep" onClick={keepAndSpinAgain}>
                    Keep &amp; spin again
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
