import React, { useState, useEffect, useRef, useCallback } from 'react';
import './LuckyDrawBulk.css';

const COLORS = [
  '#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#558b2f',
  '#33691e', '#4caf50', '#1a7c2a', '#2d6a2d', '#3d8b37',
];

function getCanvasSize() {
  return Math.min(480, window.innerWidth - 40);
}

export default function LuckyDrawBulk() {
  const [wheel, setWheel] = useState([]);
  const [selected, setSelected] = useState([]);   // bulk-selected this session
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [canvasSize, setCanvasSize] = useState(getCanvasSize());
  const [toast, setToast] = useState(null);

  // Count modal state
  const [showCountModal, setShowCountModal] = useState(false);
  const [countInput, setCountInput] = useState('');
  const [countError, setCountError] = useState('');

  // Flash overlay when each winner lands
  const [flashWinner, setFlashWinner] = useState(null); // { name, subCommittee, rank }

  // Bulk run state
  const [bulkTotal, setBulkTotal] = useState(0);        // how many to pick
  const [bulkPicked, setBulkPicked] = useState(0);      // how many picked so far
  const [bulkDone, setBulkDone] = useState(false);

  const canvasRef = useRef(null);
  const spinAngleRef = useRef(0);
  const animFrameRef = useRef(null);
  const wheelRef = useRef([]);
  // Queued picks: resolved per-spin to avoid stale closures
  const pendingCountRef = useRef(0);
  const pickedRef = useRef([]);

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
      const pending = all
        .filter(e => e.status === 'PENDING')
        .map(e => ({ id: e.id, name: e.participantName, subCommittee: e.subCommittee }));
      setWheel(pending);
      wheelRef.current = pending;
    } catch {
      showToast('Failed to load lucky draw data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Drawing ───────────────────────────────────────────────────────────────

  const drawWheel = useCallback((angle, participants) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = cx - 14;

    ctx.clearRect(0, 0, size, size);

    if (participants.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#c8e6c9';
      ctx.fill();
      ctx.fillStyle = '#388e3c';
      ctx.font = `700 ${size * 0.06}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('All drawn!', cx, cy);
      return;
    }

    const arc = (2 * Math.PI) / participants.length;

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

    // Pointer
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

  // ── Spin one slot and resolve with the winner entry ───────────────────────

  const spinOnce = useCallback((currentWheel) => {
    return new Promise((resolve) => {
      const totalRotation = (6 + Math.random() * 6) * 2 * Math.PI;
      const duration = 4000 + Math.random() * 1000;
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
          resolve({ winner: currentWheel[idx], idx });
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    });
  }, [drawWheel]);

  // ── Accept winner via API ─────────────────────────────────────────────────

  const acceptViaAPI = async (entry) => {
    const res = await fetch(`/api/lucky-draw/${entry.id}/accept`, { method: 'PATCH' });
    if (!res.ok) throw new Error('API error');
  };

  // ── Run bulk selection sequentially ──────────────────────────────────────

  const runBulk = useCallback(async (count) => {
    setSpinning(true);
    setBulkTotal(count);
    setBulkPicked(0);
    setBulkDone(false);
    pendingCountRef.current = count;
    pickedRef.current = [];

    let remaining = [...wheelRef.current];

    for (let i = 0; i < count; i++) {
      if (remaining.length === 0) break;

      // Spin
      const { winner } = await spinOnce(remaining);

      // Brief flash overlay (1.8s) so audience can see the winner
      const rank = pickedRef.current.length + 1;
      setFlashWinner({ name: winner.name, subCommittee: winner.subCommittee, rank });

      // Accept in DB (non-blocking from UX perspective — fire and handle error separately)
      try { await acceptViaAPI(winner); } catch { /* toast after loop */ }

      // Update local state
      pickedRef.current = [...pickedRef.current, winner];
      remaining = remaining.filter(p => p.id !== winner.id);

      // Update wheel state for re-draw
      wheelRef.current = remaining;
      setWheel([...remaining]);
      setSelected([...pickedRef.current]);
      setBulkPicked(rank);

      // Hold the flash overlay for 1.8s before spinning again
      await new Promise(r => setTimeout(r, 1800));
      setFlashWinner(null);

      // Small gap before next spin
      if (i < count - 1) await new Promise(r => setTimeout(r, 400));
    }

    setBulkDone(true);
    setSpinning(false);
    showToast(`${pickedRef.current.length} winner(s) selected!`, 'success');
  }, [spinOnce]);

  // ── Count modal handlers ──────────────────────────────────────────────────

  const openCountModal = () => {
    if (wheel.length < 1) return;
    setCountInput('');
    setCountError('');
    setShowCountModal(true);
  };

  const confirmCount = () => {
    const n = parseInt(countInput, 10);
    if (!n || n < 1) { setCountError('Please enter a number ≥ 1.'); return; }
    if (n > wheel.length) { setCountError(`Only ${wheel.length} participant(s) available.`); return; }
    setShowCountModal(false);
    runBulk(n);
  };

  const handleCountKeyDown = (e) => { if (e.key === 'Enter') confirmCount(); };

  // ── Reset session (does NOT clear DB winners, just resets local view) ─────

  const resetSession = async () => {
    setBulkDone(false);
    setBulkTotal(0);
    setBulkPicked(0);
    setSelected([]);
    pickedRef.current = [];
    await loadData();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ldb-app">
      {toast && <div className={`ldb-toast ldb-toast-${toast.type}`}>{toast.message}</div>}

      <header className="ldb-header">
        <h1>Welcome to Volunteer Appreciation Dinner</h1>
        <p>Pasir Ris West Community Centre · Bulk Lucky Draw</p>
      </header>

      <main className="ldb-main">
        {loading ? (
          <div className="ldb-state">⏳ Loading lucky draw…</div>
        ) : wheel.length === 0 && selected.length === 0 ? (
          <div className="ldb-state">
            <p>No participants in the lucky draw yet.</p>
            <p className="ldb-state-sub">Participants are added when they mark attendance.</p>
          </div>
        ) : (
          <>
            {/* Count input modal */}
            {showCountModal && (
              <div className="ldb-overlay">
                <div className="ldb-modal">
                  <h2>How many winners?</h2>
                  <p className="ldb-modal-sub">{wheel.length} participants available</p>
                  <input
                    className="ldb-count-input"
                    type="number"
                    min="1"
                    max={wheel.length}
                    value={countInput}
                    onChange={e => { setCountInput(e.target.value); setCountError(''); }}
                    onKeyDown={handleCountKeyDown}
                    autoFocus
                    placeholder={`1 – ${wheel.length}`}
                  />
                  {countError && <p className="ldb-count-error">{countError}</p>}
                  <div className="ldb-modal-actions">
                    <button className="ldb-btn-cancel" onClick={() => setShowCountModal(false)}>Cancel</button>
                    <button className="ldb-btn-start" onClick={confirmCount}>Start Spin</button>
                  </div>
                </div>
              </div>
            )}

            {/* Flash winner overlay */}
            {flashWinner && (
              <div className="ldb-overlay ldb-flash-overlay">
                <div className="ldb-flash-card">
                  <div className="ldb-flash-confetti">🎊</div>
                  <div className="ldb-flash-trophy">🏆</div>
                  <div className="ldb-flash-rank">Winner #{flashWinner.rank}</div>
                  <div className="ldb-flash-name">{flashWinner.name}</div>
                  <div className="ldb-flash-sub">{flashWinner.subCommittee}</div>
                  {bulkPicked < bulkTotal && (
                    <div className="ldb-flash-next">
                      Next spin in a moment… ({bulkPicked}/{bulkTotal})
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="ldb-layout">
              {/* Wheel column */}
              <div className="ldb-wheel-col">
                <div className="ldb-meta">
                  <span className="ldb-count">{wheel.length} on wheel</span>
                  {spinning && (
                    <span className="ldb-progress">
                      Picking {bulkPicked + 1} of {bulkTotal}…
                    </span>
                  )}
                </div>

                <div className="ldb-wheel-wrapper">
                  <canvas
                    ref={canvasRef}
                    width={canvasSize}
                    height={canvasSize}
                    className="ldb-canvas"
                  />
                  <button
                    className={`ldb-spin-btn ${spinning ? 'spinning' : ''}`}
                    onClick={openCountModal}
                    disabled={spinning || wheel.length < 1}
                    style={{
                      width: canvasSize * 0.24,
                      height: canvasSize * 0.24,
                      fontSize: canvasSize * 0.052,
                    }}
                  >
                    {spinning ? `${bulkPicked}/${bulkTotal}` : '🎡 SPIN'}
                  </button>
                </div>

                {bulkDone && (
                  <div className="ldb-done-msg">
                    🎉 Done! {selected.length} winner(s) selected.
                    <button className="ldb-btn-reset" onClick={resetSession}>
                      New Round
                    </button>
                  </div>
                )}
              </div>

              {/* Selected winners column */}
              <div className="ldb-winners-col">
                <div className="ldb-winners-header">
                  <h2>🏆 Selected ({selected.length})</h2>
                </div>
                {selected.length === 0 ? (
                  <div className="ldb-winners-empty">
                    Click SPIN and enter how many winners to pick.
                  </div>
                ) : (
                  <ol className="ldb-winners-list">
                    {selected.map((w, i) => (
                      <li key={w.id} className={`ldb-winner-item ${i === selected.length - 1 ? 'latest' : ''}`}>
                        <span className="ldb-winner-rank">{i + 1}</span>
                        <span className="ldb-winner-info">
                          <span className="ldb-winner-name">{w.name}</span>
                          <span className="ldb-winner-sub">{w.subCommittee}</span>
                        </span>
                        {i === selected.length - 1 && <span className="ldb-new-badge">NEW</span>}
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
