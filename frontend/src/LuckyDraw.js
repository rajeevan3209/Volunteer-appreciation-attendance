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
  const [wheel, setWheel] = useState([]);         // PENDING entries
  const [winners, setWinners] = useState([]);     // WINNER entries (newest first)
  const [spinning, setSpinning] = useState(false);
  const [currentWinner, setCurrentWinner] = useState(null); // { id, name, subCommittee }
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canvasSize, setCanvasSize] = useState(getCanvasSize());

  const canvasRef = useRef(null);
  const spinAngleRef = useRef(0);
  const animFrameRef = useRef(null);
  const wheelRef = useRef([]);

  useEffect(() => {
    const onResize = () => setCanvasSize(getCanvasSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/lucky-draw');
      const all = await res.json();
      const pending = all.filter(e => e.status === 'PENDING')
                         .map(e => ({ id: e.id, name: e.participantName, subCommittee: e.subCommittee }));
      const won = all.filter(e => e.status === 'WINNER')
                     .sort((a, b) => new Date(b.drawnAt) - new Date(a.drawnAt))
                     .map(e => ({ id: e.id, name: e.participantName, subCommittee: e.subCommittee }));
      setWheel(pending);
      wheelRef.current = pending;
      setWinners(won);
    } catch {
      showToast('Failed to load lucky draw data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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

    participants.forEach((p, i) => {
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
      const displayName = p.name.length > maxChars ? p.name.substring(0, maxChars - 1) + '…' : p.name;
      ctx.fillText(displayName, radius - 14, fontSize / 3);
      ctx.restore();
    });

    const pw = 14, ph = 30;
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
      drawWheel(currentAngle, currentWheel);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        const arc = (2 * Math.PI) / currentWheel.length;
        const norm = ((currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const pointerOffset = ((3 * Math.PI / 2) - norm + 2 * Math.PI) % (2 * Math.PI);
        const idx = Math.floor(pointerOffset / arc) % currentWheel.length;
        setCurrentWinner(currentWheel[idx]);
        setSpinning(false);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  // Accept winner — mark as WINNER in DB, add to winners panel, remove from wheel
  const acceptWinner = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/lucky-draw/${currentWinner.id}/accept`, { method: 'PATCH' });
      if (!res.ok) { showToast('Failed to accept winner. Try again.'); return; }
      setWinners(prev => [currentWinner, ...prev]);
      setWheel(prev => prev.filter(p => p.id !== currentWinner.id));
      setCurrentWinner(null);
      showToast(`${currentWinner.name} added to winners list!`, 'success');
    } catch {
      showToast('Network error. Could not accept winner.');
    } finally {
      setActionLoading(false);
    }
  };

  // Exclude — mark as EXCLUDED in DB, remove from wheel silently
  const excludeFromDraw = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/lucky-draw/${currentWinner.id}/exclude`, { method: 'PATCH' });
      if (!res.ok) { showToast('Failed to remove. Try again.'); return; }
      setWheel(prev => prev.filter(p => p.id !== currentWinner.id));
      setCurrentWinner(null);
      showToast(`${currentWinner.name} removed from the draw.`, 'success');
    } catch {
      showToast('Network error. Could not remove from draw.');
    } finally {
      setActionLoading(false);
    }
  };

  // Spin again — don't change anything in DB or state
  const spinAgain = () => {
    setCurrentWinner(null);
  };

  const clearAll = async () => {
    try {
      await fetch('/api/lucky-draw', { method: 'DELETE' });
      await loadData();
      showToast('Lucky draw reset.', 'success');
    } catch {
      showToast('Failed to reset.');
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
          <div className="ld-loading">⏳ Loading lucky draw…</div>
        ) : wheel.length === 0 && winners.length === 0 ? (
          <div className="ld-empty-state">
            <p>No participants in the lucky draw yet.</p>
            <p className="ld-empty-sub">Participants are added when they mark their attendance.</p>
          </div>
        ) : (
          <>
            {/* Winner popup */}
            {currentWinner && (
              <div className="ld-overlay">
                <div className="ld-winner-popup">
                  <div className="ld-confetti">🎊</div>
                  <div className="ld-winner-trophy">🏆</div>
                  <div className="ld-winner-label">Winner!</div>
                  <div className="ld-winner-popup-name">{currentWinner.name}</div>
                  <div className="ld-winner-popup-sub">{currentWinner.subCommittee}</div>
                  <div className="ld-winner-actions">
                    <button className="ld-btn-accept" onClick={acceptWinner} disabled={actionLoading}>
                      {actionLoading ? '…' : '✅ Accept Winner'}
                    </button>
                    <button className="ld-btn-exclude" onClick={excludeFromDraw} disabled={actionLoading}>
                      ❌ Remove from Draw
                    </button>
                    <button className="ld-btn-keep" onClick={spinAgain} disabled={actionLoading}>
                      🔄 Spin Again
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="ld-layout">
              {/* Wheel column */}
              <div className="ld-wheel-col">
                <div className="ld-meta">
                  <span className="ld-count">{wheel.length} on wheel</span>
                  {winners.length > 0 && (
                    <button className="ld-btn-text" onClick={clearAll}>↺ Reset all</button>
                  )}
                </div>

                <div className="ld-wheel-wrapper">
                  <canvas ref={canvasRef} width={canvasSize} height={canvasSize} className="ld-canvas" />
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
                    🎊 All participants drawn!
                    <button className="ld-btn-text" onClick={clearAll}>Reset all</button>
                  </div>
                )}
              </div>

              {/* Winners side panel */}
              <div className="ld-winners-col">
                <div className="ld-winners-header">
                  <h2>🏆 Winners</h2>
                </div>
                {winners.length === 0 ? (
                  <div className="ld-winners-empty">Spin the wheel to pick a winner!</div>
                ) : (
                  <ol className="ld-winners-list">
                    {winners.map((w, i) => (
                      <li key={w.id} className={`ld-winner-item ${i === 0 ? 'latest' : ''}`}>
                        <span className="ld-winner-rank">{i + 1}</span>
                        <span className="ld-winner-info">
                          <span className="ld-winner-name">{w.name}</span>
                          <span className="ld-winner-sub">{w.subCommittee}</span>
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
