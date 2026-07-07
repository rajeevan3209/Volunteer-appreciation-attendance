import React, { useState, useEffect, useRef, useCallback } from 'react';
import PptxGenJS from 'pptxgenjs';
import './LuckyDrawBulk.css';

const COLORS = [
  '#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#558b2f',
  '#33691e', '#4caf50', '#1a7c2a', '#2d6a2d', '#3d8b37',
];

function getCanvasSize() {
  const available = Math.min(window.innerHeight - 120, window.innerWidth - 340);
  return Math.max(320, available);
}

export default function LuckyDrawBulk() {
  const [wheel, setWheel] = useState([]);
  // rounds: [{ roundNum, winners: [{id, name, subCommittee}] }]
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [canvasSize, setCanvasSize] = useState(getCanvasSize());
  const [toast, setToast] = useState(null);

  const [showCountModal, setShowCountModal] = useState(false);
  const [countInput, setCountInput] = useState('');
  const [countError, setCountError] = useState('');
  const [pptWarnCount, setPptWarnCount] = useState(null); // pending count awaiting PPT warning confirmation

  const [flashWinner, setFlashWinner] = useState(null);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkPicked, setBulkPicked] = useState(0);
  const [currentRoundDone, setCurrentRoundDone] = useState(false);

  const canvasRef = useRef(null);
  const spinAngleRef = useRef(0);
  const animFrameRef = useRef(null);
  const wheelRef = useRef([]);
  const pickedRef = useRef([]);
  const roundNumRef = useRef(0);

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
      const [ldRes, bulkRes] = await Promise.all([
        fetch('/api/lucky-draw'),
        fetch('/api/bulk-draw'),
      ]);
      const all = await ldRes.json();
      const bulkAll = await bulkRes.json();

      // Wheel: PENDING entries only
      const pending = all
        .filter(e => e.status === 'PENDING')
        .map(e => ({ id: e.id, name: e.participantName, subCommittee: e.subCommittee }));
      setWheel(pending);
      wheelRef.current = pending;

      // Rebuild rounds from persisted bulk draw history
      const roundMap = new Map();
      bulkAll.forEach(row => {
        if (!roundMap.has(row.roundNum)) roundMap.set(row.roundNum, []);
        roundMap.get(row.roundNum).push({
          id: row.id,
          name: row.participantName,
          subCommittee: row.subCommittee,
        });
      });
      const loadedRounds = Array.from(roundMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([roundNum, winners]) => ({ roundNum, winners }));
      setRounds(loadedRounds);

      // Seed round counter so new rounds continue from the last saved round
      const maxRound = loadedRounds.length > 0
        ? loadedRounds[loadedRounds.length - 1].roundNum
        : 0;
      roundNumRef.current = maxRound;
    } catch {
      showToast('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Canvas drawing ────────────────────────────────────────────────────────

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

  // ── Single spin → resolves with winner ───────────────────────────────────

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
          resolve({ winner: currentWheel[idx] });
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    });
  }, [drawWheel]);

  const acceptViaAPI = async (entry) => {
    const res = await fetch(`/api/lucky-draw/${entry.id}/accept`, { method: 'PATCH' });
    if (!res.ok) throw new Error('API error');
  };

  const saveBulkSelection = async (roundNum, rankInRound, winner) => {
    await fetch('/api/bulk-draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roundNum,
        rankInRound,
        participantName: winner.name,
        subCommittee: winner.subCommittee,
      }),
    });
  };

  // ── Bulk run ──────────────────────────────────────────────────────────────

  const runBulk = useCallback(async (count) => {
    setSpinning(true);
    setCurrentRoundDone(false);
    setBulkTotal(count);
    setBulkPicked(0);
    pickedRef.current = [];

    roundNumRef.current += 1;
    const thisRound = roundNumRef.current;

    setRounds(prev => [...prev, { roundNum: thisRound, winners: [] }]);

    let remaining = [...wheelRef.current];

    for (let i = 0; i < count; i++) {
      if (remaining.length === 0) break;

      const { winner } = await spinOnce(remaining);

      const rank = pickedRef.current.length + 1;
      setFlashWinner({ name: winner.name, subCommittee: winner.subCommittee, rank });

      // Persist to lucky_draw and bulk_draw_selection tables
      try {
        await Promise.all([
          acceptViaAPI(winner),
          saveBulkSelection(thisRound, rank, winner),
        ]);
      } catch { /* best effort — UI continues regardless */ }

      pickedRef.current = [...pickedRef.current, winner];
      remaining = remaining.filter(p => p.id !== winner.id);

      wheelRef.current = remaining;
      setWheel([...remaining]);
      setBulkPicked(rank);

      setRounds(prev => prev.map(r =>
        r.roundNum === thisRound
          ? { ...r, winners: [...r.winners, winner] }
          : r
      ));

      await new Promise(r => setTimeout(r, 1800));
      setFlashWinner(null);
      if (i < count - 1) await new Promise(r => setTimeout(r, 400));
    }

    setCurrentRoundDone(true);
    setSpinning(false);
    showToast(`Round ${thisRound}: ${pickedRef.current.length} winner(s) selected!`, 'success');
  }, [spinOnce]);

  // ── Count modal ───────────────────────────────────────────────────────────

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
    if (n > 10) {
      // Show PPT formatting warning before proceeding
      setPptWarnCount(n);
      return;
    }
    setShowCountModal(false);
    runBulk(n);
  };

  const handleCountKeyDown = (e) => { if (e.key === 'Enter') confirmCount(); };

  const confirmPptWarn = () => {
    const n = pptWarnCount;
    setPptWarnCount(null);
    setShowCountModal(false);
    runBulk(n);
  };

  const dismissPptWarn = () => {
    setPptWarnCount(null);
  };

  // "New Round" — keep all rounds, just refresh the wheel and allow another spin
  const startNewRound = async () => {
    setCurrentRoundDone(false);
    await loadData();
  };

  // ── PPT export ────────────────────────────────────────────────────────────

  const downloadPPT = () => {
    const prs = new PptxGenJS();
    prs.layout = 'LAYOUT_WIDE'; // 13.33" x 7.5"

    const BG = '#1b5e20';
    const GOLD = '#ffd600';
    const WHITE = '#ffffff';
    const LIGHT = '#e8f5e9';

    // Title slide
    const title = prs.addSlide();
    title.background = { color: BG };
    title.addText('🏆 Lucky Draw Results', {
      x: 0.5, y: 2.2, w: 12.33, h: 1.2,
      fontSize: 40, bold: true, color: GOLD, align: 'center',
    });
    title.addText('Volunteer Appreciation & Appointment Ceremony 2026', {
      x: 0.5, y: 3.6, w: 12.33, h: 1.2,
      fontSize: 20, color: WHITE, align: 'center',
    });
    title.addText(`Total rounds: ${rounds.length}  ·  Total winners: ${rounds.reduce((s, r) => s + r.winners.length, 0)}`, {
      x: 0.5, y: 5.5, w: 12.33, h: 0.5,
      fontSize: 14, color: LIGHT, align: 'center',
    });

    rounds.forEach((round) => {
      // Round header slide
      const hdr = prs.addSlide();
      hdr.background = { color: BG };
      hdr.addText(`Round ${round.roundNum}`, {
        x: 0.5, y: 2.8, w: 12.33, h: 1.2,
        fontSize: 52, bold: true, color: GOLD, align: 'center',
      });
      hdr.addText(`${round.winners.length} winner(s)`, {
        x: 0.5, y: 4.2, w: 12.33, h: 0.7,
        fontSize: 22, color: WHITE, align: 'center',
      });

      // Winners slides — 10 per slide, displayed as 2 columns of 5
      // Layout: slide is 13.33" × 7.5"
      //   Left column:  x=0.35,  column width=5.9"
      //   Right column: x=6.75,  column width=5.9"
      //   5 rows per column, rowH=1.1", startY=1.0"
      const PER_SLIDE = 10;
      const ROWS = 5;
      const COL_X = [0.35, 6.75];
      const COL_W = 5.9;
      const BADGE_W = 0.6;
      const rowH = 1.08;
      const startY = 1.05;

      for (let s = 0; s < round.winners.length; s += PER_SLIDE) {
        const slice = round.winners.slice(s, s + PER_SLIDE);
        const slide = prs.addSlide();
        slide.background = { color: 'f1f8e9' };

        // Header bar
        slide.addShape('rect', {
          x: 0, y: 0, w: 13.33, h: 0.72,
          fill: { color: '1b5e20' }, line: { color: '1b5e20', pt: 0 },
        });
        slide.addText(`Round ${round.roundNum} — Winners`, {
          x: 0.4, y: 0.1, w: 8, h: 0.52,
          fontSize: 18, bold: true, color: WHITE,
        });
        const pageLabel = round.winners.length > PER_SLIDE
          ? `(${s + 1}–${Math.min(s + PER_SLIDE, round.winners.length)} of ${round.winners.length})`
          : `${round.winners.length} winner(s)`;
        slide.addText(pageLabel, {
          x: 8.5, y: 0.1, w: 4.43, h: 0.52,
          fontSize: 13, color: 'a5d6a7', align: 'right',
        });

        // Divider between columns
        slide.addShape('line', {
          x: 6.665, y: 0.85, w: 0, h: 6.4,
          line: { color: 'c8e6c9', pt: 1 },
        });

        slice.forEach((w, i) => {
          const col = i < ROWS ? 0 : 1;        // left col: 0–4, right col: 5–9
          const row = i < ROWS ? i : i - ROWS;
          const cx = COL_X[col];
          const y = startY + row * rowH;
          const rank = s + i + 1;

          // Rank badge
          slide.addShape('ellipse', {
            x: cx, y: y + 0.06, w: BADGE_W, h: BADGE_W,
            fill: { color: rank === 1 ? 'ff8f00' : '2e7d32' },
            line: { color: 'ffffff', pt: 1 },
          });
          slide.addText(`${rank}`, {
            x: cx, y: y + 0.12, w: BADGE_W, h: BADGE_W - 0.1,
            fontSize: 13, bold: true, color: WHITE, align: 'center',
          });

          // Name
          slide.addText(w.name, {
            x: cx + BADGE_W + 0.1, y: y + 0.04, w: COL_W - BADGE_W - 0.15, h: 0.42,
            fontSize: 14, bold: true, color: '1b5e20',
          });
          // Sub-committee
          slide.addText(w.subCommittee, {
            x: cx + BADGE_W + 0.1, y: y + 0.46, w: COL_W - BADGE_W - 0.15, h: 0.32,
            fontSize: 10, color: '388e3c',
          });

          // Separator line (within each column, between rows)
          const isLastInCol = (col === 0 && row === Math.min(ROWS, slice.length) - 1)
                           || (col === 1 && i === slice.length - 1);
          if (!isLastInCol) {
            slide.addShape('line', {
              x: cx + BADGE_W + 0.1, y: y + rowH - 0.05,
              w: COL_W - BADGE_W - 0.15, h: 0,
              line: { color: 'c8e6c9', pt: 0.5 },
            });
          }
        });
      }
    });

    prs.writeFile({ fileName: 'lucky-draw-results.pptx' });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const totalWinners = rounds.reduce((s, r) => s + r.winners.length, 0);

  return (
    <div className="ldb-app">
      {toast && <div className={`ldb-toast ldb-toast-${toast.type}`}>{toast.message}</div>}

      <header className="ldb-header">
        <h1>Welcome to Volunteer Appreciation &amp; Appointment Ceremony 2026</h1>
        <p>Pasir Ris Elias CC · Bulk Lucky Draw</p>
      </header>

      <main className="ldb-main">
        {loading ? (
          <div className="ldb-state">⏳ Loading lucky draw…</div>
        ) : wheel.length === 0 && rounds.length === 0 ? (
          <div className="ldb-state">
            <p>No participants in the lucky draw yet.</p>
            <p className="ldb-state-sub">Participants are added when they mark attendance.</p>
          </div>
        ) : (
          <>
            {/* Count modal */}
            {showCountModal && (
              <div className="ldb-overlay">
                <div className="ldb-modal">
                  {pptWarnCount ? (
                    <>
                      <div className="ldb-ppt-warn-icon">⚠️</div>
                      <h2 className="ldb-warn-title">PPT Formatting Notice</h2>
                      <p className="ldb-warn-body">
                        You selected <strong>{pptWarnCount} winners</strong>. The PowerPoint export
                        will still include all winners, but slides with more than 10 entries
                        may not be formatted as neatly.
                      </p>
                      <p className="ldb-warn-body ldb-warn-sub">
                        Do you want to go ahead?
                      </p>
                      <div className="ldb-modal-actions">
                        <button className="ldb-btn-cancel" onClick={dismissPptWarn}>Go Back</button>
                        <button className="ldb-btn-start" onClick={confirmPptWarn}>Yes, Proceed</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2>How many winners?</h2>
                      <p className="ldb-modal-sub">{wheel.length} participants available</p>
                      <input
                        className="ldb-count-input"
                        type="number"
                        min="1"
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
                    </>
                  )}
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

                {currentRoundDone && !spinning && (
                  <div className="ldb-done-msg">
                    🎉 Round {roundNumRef.current} complete!
                    {wheel.length > 0 && (
                      <button className="ldb-btn-reset" onClick={startNewRound}>
                        New Round
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Results panel */}
              <div className="ldb-winners-col">
                <div className="ldb-winners-header">
                  <h2>🏆 Results ({totalWinners})</h2>
                  {totalWinners > 0 && (
                    <button className="ldb-btn-ppt" onClick={downloadPPT} title="Download as PowerPoint">
                      ⬇ PPT
                    </button>
                  )}
                </div>

                {rounds.length === 0 ? (
                  <div className="ldb-winners-empty">
                    Click SPIN and enter how many winners to pick.
                  </div>
                ) : (
                  <div className="ldb-rounds-container">
                    {rounds.map((round) => (
                      <div key={round.roundNum} className="ldb-round-block">
                        <div className="ldb-round-label">
                          Round {round.roundNum}
                          <span className="ldb-round-count">{round.winners.length} winners</span>
                        </div>
                        <ol className="ldb-winners-list">
                          {round.winners.map((w, i) => (
                            <li
                              key={w.id}
                              className={`ldb-winner-item ${
                                round.roundNum === roundNumRef.current &&
                                i === round.winners.length - 1 &&
                                spinning ? 'latest' : ''
                              }`}
                            >
                              <span className="ldb-winner-rank">{i + 1}</span>
                              <span className="ldb-winner-info">
                                <span className="ldb-winner-name">{w.name}</span>
                                <span className="ldb-winner-sub">{w.subCommittee}</span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
