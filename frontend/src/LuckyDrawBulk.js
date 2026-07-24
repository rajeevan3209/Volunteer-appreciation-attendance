import React, { useState, useEffect, useRef, useCallback } from 'react';
import PptxGenJS from 'pptxgenjs';
import './LuckyDrawBulk.css';

const COLORS = [
  '#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#558b2f',
  '#33691e', '#4caf50', '#1a7c2a', '#2d6a2d', '#3d8b37',
];

function getCanvasSize() {
  const available = Math.min(window.innerHeight - 180, window.innerWidth - 348);
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
  const [prizeInput, setPrizeInput] = useState('');
  const [countError, setCountError] = useState('');
  const [pptWarnCount, setPptWarnCount] = useState(null); // pending count awaiting PPT warning confirmation
  const pendingPrizeRef = useRef('');

  const [flashWinner, setFlashWinner] = useState(null);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkPicked, setBulkPicked] = useState(0);
  const [currentRoundDone, setCurrentRoundDone] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef = useRef(null);
  const appRef = useRef(null);
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

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => setCanvasSize(getCanvasSize()), 100);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) appRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

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

  const runBulk = useCallback(async (count, prize) => {
    setSpinning(true);
    setCurrentRoundDone(false);
    setBulkTotal(count);
    setBulkPicked(0);
    pickedRef.current = [];

    roundNumRef.current += 1;
    const thisRound = roundNumRef.current;

    setRounds(prev => [...prev, { roundNum: thisRound, winners: [], prize: prize || '' }]);

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
          ? { ...r, winners: [...r.winners, winner], prize: prize || '' }
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
    setPrizeInput('');
    setCountError('');
    setShowCountModal(true);
  };

  const confirmCount = () => {
    const n = parseInt(countInput, 10);
    if (!n || n < 1) { setCountError('Please enter a number ≥ 1.'); return; }
    if (n > wheel.length) { setCountError(`Only ${wheel.length} participant(s) available.`); return; }
    if (n > 10) {
      pendingPrizeRef.current = prizeInput;
      setPptWarnCount(n);
      return;
    }
    setShowCountModal(false);
    runBulk(n, prizeInput);
  };

  const handleCountKeyDown = (e) => { if (e.key === 'Enter') confirmCount(); };

  const confirmPptWarn = () => {
    const n = pptWarnCount;
    const prize = pendingPrizeRef.current;
    setPptWarnCount(null);
    setShowCountModal(false);
    runBulk(n, prize);
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
      // Reverse so last spin = 1st prize, first spin = nth prize
      const reversed = [...round.winners].reverse();
      const hasPrize = !!round.prize;

      // Round header slide
      const hdr = prs.addSlide();
      hdr.background = { color: BG };
      hdr.addText(`Round ${round.roundNum}`, {
        x: 0.5, y: hasPrize ? 2.2 : 2.8, w: 12.33, h: 1.2,
        fontSize: 52, bold: true, color: GOLD, align: 'center',
      });
      if (hasPrize) {
        hdr.addText(round.prize, {
          x: 0.5, y: 3.6, w: 12.33, h: 0.8,
          fontSize: 28, bold: true, color: WHITE, align: 'center',
        });
      }
      hdr.addText(`${round.winners.length} winner(s)`, {
        x: 0.5, y: hasPrize ? 4.55 : 4.2, w: 12.33, h: 0.7,
        fontSize: 22, color: WHITE, align: 'center',
      });

      // Winners slides — 10 per slide, displayed as 2 columns of 5
      const PER_SLIDE = 10;
      const ROWS = 5;
      const COL_X = [0.35, 6.75];
      const COL_W = 5.9;
      const BADGE_W = 0.6;
      const rowH = 1.08;
      const startY = 1.05;

      for (let s = 0; s < reversed.length; s += PER_SLIDE) {
        const slice = reversed.slice(s, s + PER_SLIDE);
        const slide = prs.addSlide();
        slide.background = { color: 'f1f8e9' };

        // Header bar
        slide.addShape('rect', {
          x: 0, y: 0, w: 13.33, h: 0.72,
          fill: { color: '1b5e20' }, line: { color: '1b5e20', pt: 0 },
        });
        const headerLabel = hasPrize
          ? `Round ${round.roundNum} — ${round.prize}`
          : `Round ${round.roundNum} — Winners`;
        slide.addText(headerLabel, {
          x: 0.4, y: 0.1, w: 8, h: 0.52,
          fontSize: 18, bold: true, color: WHITE,
        });
        const pageLabel = reversed.length > PER_SLIDE
          ? `(${s + 1}–${Math.min(s + PER_SLIDE, reversed.length)} of ${reversed.length})`
          : `${reversed.length} winner(s)`;
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
          const col = i < ROWS ? 0 : 1;
          const row = i < ROWS ? i : i - ROWS;
          const cx = COL_X[col];
          const y = startY + row * rowH;
          const prizeRank = s + i + 1;

          // Rank badge (gold for 1st prize, green otherwise)
          slide.addShape('ellipse', {
            x: cx, y: y + 0.06, w: BADGE_W, h: BADGE_W,
            fill: { color: prizeRank === 1 ? 'ff8f00' : '2e7d32' },
            line: { color: 'ffffff', pt: 1 },
          });
          slide.addText(`${prizeRank}`, {
            x: cx, y: y + 0.12, w: BADGE_W, h: BADGE_W - 0.1,
            fontSize: 13, bold: true, color: WHITE, align: 'center',
          });

          // Name + optional prize label
          const nameY = hasPrize ? y + 0.02 : y + 0.04;
          slide.addText(w.name, {
            x: cx + BADGE_W + 0.1, y: nameY, w: COL_W - BADGE_W - 0.15, h: 0.38,
            fontSize: 14, bold: true, color: '1b5e20',
          });
          if (hasPrize) {
            const medal = prizeRank === 1 ? '🥇' : prizeRank === 2 ? '🥈' : prizeRank === 3 ? '🥉' : `#${prizeRank}`;
            slide.addText(`${medal} ${round.prize}`, {
              x: cx + BADGE_W + 0.1, y: nameY + 0.37, w: COL_W - BADGE_W - 0.15, h: 0.24,
              fontSize: 9, bold: true, color: 'b8860b',
            });
          }
          slide.addText(w.subCommittee, {
            x: cx + BADGE_W + 0.1, y: y + (hasPrize ? 0.62 : 0.46), w: COL_W - BADGE_W - 0.15, h: 0.28,
            fontSize: 10, color: '388e3c',
          });

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
    <div className="ldb-app" ref={appRef}>
      {toast && <div className={`ldb-toast ldb-toast-${toast.type}`}>{toast.message}</div>}

      <header className="ldb-header">
        <h1>Welcome to Volunteer Appreciation &amp; Appointment Ceremony 2026</h1>
        <p>Pasir Ris West · Bulk Lucky Draw</p>
        <button className="ldb-fullscreen-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {isFullscreen ? '⊠' : '⤢'}
        </button>
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
                      <input
                        className="ldb-prize-input"
                        type="text"
                        value={prizeInput}
                        onChange={e => setPrizeInput(e.target.value)}
                        onKeyDown={handleCountKeyDown}
                        placeholder="Prize name (optional)"
                      />
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
                    {rounds.map((round) => {
                      // Reverse so last spin = 1st prize, first spin = nth prize
                      const reversed = [...round.winners].reverse();
                      const total = round.winners.length;
                      const hasPrize = !!round.prize;
                      return (
                        <div key={round.roundNum} className="ldb-round-block">
                          <div className="ldb-round-label">
                            Round {round.roundNum}
                            {hasPrize && <span className="ldb-round-prize">{round.prize}</span>}
                            <span className="ldb-round-count">{total} winner{total !== 1 ? 's' : ''}</span>
                          </div>
                          <ol className="ldb-winners-list">
                            {reversed.map((w, i) => {
                              const prizeRank = i + 1;
                              const spinRank = total - i; // original spin order
                              const isLatest =
                                round.roundNum === roundNumRef.current &&
                                spinRank === round.winners.length &&
                                spinning;
                              return (
                                <li key={w.id} className={`ldb-winner-item ${isLatest ? 'latest' : ''}`}>
                                  <span className="ldb-winner-rank">{prizeRank}</span>
                                  <span className="ldb-winner-info">
                                    {hasPrize && (
                                      <span className="ldb-winner-prize-label">
                                        {prizeRank === 1 ? '🥇' : prizeRank === 2 ? '🥈' : prizeRank === 3 ? '🥉' : `#${prizeRank}`} {round.prize}
                                      </span>
                                    )}
                                    <span className="ldb-winner-name">{w.name}</span>
                                    <span className="ldb-winner-sub">{w.subCommittee}</span>
                                  </span>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      );
                    })}
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
