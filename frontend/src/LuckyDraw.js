import React, { useState, useEffect, useRef, useCallback } from 'react';
import './LuckyDraw.css';

const COLORS = [
  '#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#558b2f',
  '#33691e', '#4caf50', '#1a7c2a', '#2d6a2d', '#3d8b37',
];

function getCanvasSize() {
  return Math.min(480, window.innerWidth - 40);
}

export default function LuckyDraw() {
  const [allParticipants, setAllParticipants] = useState([]);
  const [wheel, setWheel] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [winners, setWinners] = useState([]);
  const [currentWinner, setCurrentWinner] = useState(null);
  const [toast, setToast] = useState(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const wheelRef = useRef([]);  // always-current wheel ref for animation closure
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
    // Load attended participants AND existing winners in parallel
    Promise.all([
      fetch('/api/attendance').then(r => r.json()),
      fetch('/api/lucky-draw').then(r => r.json()),
    ]).then(([attendanceData, winnersData]) => {
      // Build unique participants from attendance
      const seen = new Set();
      const unique = attendanceData.filter(a => {
        if (seen.has(a.participantName)) return false;
        seen.add(a.participantName);
        return true;
      }).map(a => ({ name: a.participantName, subCommittee: a.subCommittee }));

      // Restore winners from DB (newest first)
      const dbWinners = winnersData.map(w => ({
        id: w.id,
        name: w.participantName,
        subCommittee: w.subCommittee,
      }));

      const winnerNames = new Set(dbWinners.map(w => w.name));

      const remaining = unique.filter(p => !winnerNames.has(p.name));
      setAllParticipants(unique);
      setWinners(dbWinners);
      setWheel(remaining);
      wheelRef.current = remaining;
      setLoading(false);
    }).catch(() => setLoading(false));
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

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 6, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#1b5e20';
    ctx.fill();

    participants.forEach((name, i) => {
      const startAngle = angle + i * arc;
      const endAngle = startAngle + arc;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      const fontSize = Math.max(9, Math.min(14, 180 / participants.length + 4));
      ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 3;
      const maxChars = Math.max(10, Math.floor(400 / participants.length));
      const displayName = name.name.length > maxChars ? name.name.substring(0, maxChars - 1) + '…' : name.name;
      ctx.fillText(displayName, radius - 14, fontSize / 3);
      ctx.restore();
    });

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
    wheelRef.current = wheel;
    drawWheel(spinAngleRef.current, wheel);
  }, [wheel, drawWheel, canvasSize]);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const spin = () => {
    const currentWheel = wheelRef.current;
    if (spinning || currentWheel.length < 2) return;
    setSpinning(true);
    const totalRotation = (6 + Math.random() * 6) * 2 * Math.PI;
    const duration = 5000;
    const startTime = performance.now();
    const startAngle = spinAngleRef.current;

    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 5);
      const currentAngle = startAngle + totalRotation * eased;
      spinAngleRef.current = currentAngle;
      drawWheel(currentAngle, currentWheel); // use snapshot from spin start

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        const arc = (2 * Math.PI) / currentWheel.length;
        const norm = ((currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const pointerOffset = ((3 * Math.PI / 2) - norm + 2 * Math.PI) % (2 * Math.PI);
        const winnerIdx = Math.floor(pointerOffset / arc) % currentWheel.length;
        setCurrentWinner(currentWheel[winnerIdx]);
        setSpinning(false);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  const removeWinner = async () => {
    setRemoveLoading(true);
    try {
      const res = await fetch('/api/lucky-draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantName: currentWinner.name,
          subCommittee: currentWinner.subCommittee,
        }),
      });
      const saved = await res.json();
      if (!res.ok) {
        showToast(saved.error || 'Failed to save winner. Please try again.');
        return;
      }
      // Success — update state and close popup
      setWinners(prev => [{ id: saved.id, name: saved.participantName, subCommittee: saved.subCommittee }, ...prev]);
      setWheel(prev => prev.filter(p => p.name !== currentWinner.name));
      setCurrentWinner(null);
    } catch (e) {
      showToast('Network error. Could not save winner. Please try again.');
    } finally {
      setRemoveLoading(false);
    }
  };

  const keepAndSpinAgain = () => {
    setCurrentWinner(null);
  };

  const resetWheel = () => {
    const winnerNames = new Set(winners.map(w => w.name));
    const remaining = allParticipants.filter(p => !winnerNames.has(p.name));
    setWheel(remaining);
    spinAngleRef.current = 0;
  };

  const clearWinners = async () => {
    try {
      const res = await fetch('/api/lucky-draw', { method: 'DELETE' });
      if (!res.ok) { showToast('Failed to clear winners.'); return; }
      setWinners([]);
      setWheel(allParticipants);
      setCurrentWinner(null);
      spinAngleRef.current = 0;
    } catch {
      showToast('Network error. Could not clear winners.');
    }
  };

  return (
    <div className="ld-app">
      {toast && <div className={`ld-toast ld-toast-${toast.type}`}>{toast.message}</div>}
      <header className="ld-header">
        <h1>Welcome to Volunteer Appreciation Dinner</h1>
        <p>Pasir Ris West Community Centre · Lucky Draw</p>
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
            {currentWinner && (
              <div className="ld-overlay">
                <div className="ld-winner-popup">
                  <div className="ld-confetti">🎊</div>
                  <div className="ld-winner-trophy">🏆</div>
                  <div className="ld-winner-label">Winner!</div>
                  <div className="ld-winner-popup-name">{currentWinner.name}</div>
                  <div className="ld-winner-popup-sub">{currentWinner.subCommittee}</div>
                  <div className="ld-winner-actions">
                    <button className="ld-btn-remove" onClick={removeWinner} disabled={removeLoading}>
                      {removeLoading ? 'Saving…' : 'Remove from wheel'}
                    </button>
                    <button className="ld-btn-keep" onClick={keepAndSpinAgain}>
                      Keep &amp; spin again
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="ld-layout">
              <div className="ld-wheel-col">
                <div className="ld-meta">
                  <span className="ld-count">{wheel.length} on wheel</span>
                  {wheel.length < allParticipants.length - winners.length && (
                    <button className="ld-btn-text" onClick={resetWheel}>↺ Restore removed</button>
                  )}
                </div>

                <div className="ld-wheel-wrapper">
                  <canvas
                    ref={canvasRef}
                    width={canvasSize}
                    height={canvasSize}
                    className="ld-canvas"
                  />
                  <button
                    className={`ld-spin-btn ${spinning ? 'spinning' : ''}`}
                    onClick={spin}
                    disabled={spinning || wheel.length < 2}
                    style={{ width: canvasSize * 0.24, height: canvasSize * 0.24, fontSize: canvasSize * 0.055 }}
                  >
                    {spinning ? '…' : '🎡 SPIN'}
                  </button>
                </div>

                {wheel.length === 0 && (
                  <div className="ld-all-drawn">
                    🎊 All drawn!
                    <button className="ld-btn-text" onClick={clearWinners}>Reset all</button>
                  </div>
                )}
              </div>

              <div className="ld-winners-col">
                <div className="ld-winners-header">
                  <h2>🏆 Winners</h2>
                  {winners.length > 0 && (
                    <button className="ld-btn-text small" onClick={clearWinners}>Clear all</button>
                  )}
                </div>

                {winners.length === 0 ? (
                  <div className="ld-winners-empty">Spin the wheel to pick a winner!</div>
                ) : (
                  <ol className="ld-winners-list">
                    {winners.map((name, i) => (
                      <li key={`${name.name}-${i}`} className={`ld-winner-item ${i === 0 ? 'latest' : ''}`}>
                        <span className="ld-winner-rank">{i + 1}</span>
                        <span className="ld-winner-info">
                          <span className="ld-winner-name">{name.name}</span>
                          <span className="ld-winner-sub">{name.subCommittee}</span>
                        </span>
                        {i === 0 && <span className="ld-new-badge">NEW</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
