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
  // rounds: [{ roundNum, winners: [{id, name, subCommittee}], prize }]
  const [rounds, setRounds] = useState([]);
  const [currentRoundNum, setCurrentRoundNum] = useState(1);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [canvasSize, setCanvasSize] = useState(getCanvasSize());
  const [toast, setToast] = useState(null);

  const [showCountModal, setShowCountModal] = useState(false);
  const [countInput, setCountInput] = useState('');
  const [prizeInput, setPrizeInput] = useState('');
  const [countError, setCountError] = useState('');

  const [flashWinner, setFlashWinner] = useState(null);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkPicked, setBulkPicked] = useState(0);
  const [spinDone, setSpinDone] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const spinAngleRef = useRef(0);
  const animFrameRef = useRef(null);
  const wheelRef = useRef([]);
  const pickedRef = useRef([]);
  const roundNumRef = useRef(1);
  const batchIdRef = useRef(0);
  const initializedRef = useRef(false);

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
          prize: row.prize || '',
        });
      });
      const loadedRounds = Array.from(roundMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([roundNum, winners]) => ({ roundNum, winners }));
      setRounds(loadedRounds);

      // Seed round counter from DB only on first load; subsequent calls preserve the user's current round
      const maxRound = loadedRounds.length > 0
        ? loadedRounds[loadedRounds.length - 1].roundNum
        : 0;
      if (!initializedRef.current) {
        const stored = parseInt(localStorage.getItem('bulkDrawRound') || '0', 10);
        const activeRound = Math.max(maxRound, stored, 1);
        roundNumRef.current = activeRound;
        setCurrentRoundNum(activeRound);
        localStorage.setItem('bulkDrawRound', String(activeRound));
        initializedRef.current = true;
      }
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
    const res = await fetch(`/api/lucky-draw/${entry.id}/bulk-accept`, { method: 'PATCH' });
    if (!res.ok) throw new Error('API error');
  };

  const saveBulkSelection = async (roundNum, rankInRound, winner, prize) => {
    await fetch('/api/bulk-draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roundNum,
        rankInRound,
        participantName: winner.name,
        subCommittee: winner.subCommittee,
        prize: prize || '',
      }),
    });
  };

  // ── Bulk run ──────────────────────────────────────────────────────────────

  const runBulk = useCallback(async (count, prize) => {
    setSpinning(true);
    setSpinDone(false);
    setBulkTotal(count);
    setBulkPicked(0);
    pickedRef.current = [];

    const thisRound = roundNumRef.current;
    batchIdRef.current += 1;
    const thisBatch = batchIdRef.current;

    setRounds(prev => [...prev, { roundNum: thisRound, batchId: thisBatch, winners: [], prize: prize || '' }]);

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
          saveBulkSelection(thisRound, rank, winner, prize),
        ]);
      } catch { /* best effort — UI continues regardless */ }

      pickedRef.current = [...pickedRef.current, winner];
      remaining = remaining.filter(p => p.id !== winner.id);

      wheelRef.current = remaining;
      setWheel([...remaining]);
      setBulkPicked(rank);

      setRounds(prev => prev.map(r =>
        r.batchId === thisBatch
          ? { ...r, winners: [...r.winners, { ...winner, prize: prize || '' }] }
          : r
      ));

      await new Promise(r => setTimeout(r, 1800));
      setFlashWinner(null);
      if (i < count - 1) await new Promise(r => setTimeout(r, 400));
    }

    setSpinDone(true);
    setSpinning(false);
    showToast(`${pickedRef.current.length} winner(s) selected!`, 'success');
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
    setShowCountModal(false);
    runBulk(n, prizeInput);
  };

  const handleCountKeyDown = (e) => { if (e.key === 'Enter') confirmCount(); };

  const moveToNextRound = async () => {
    roundNumRef.current += 1;
    localStorage.setItem('bulkDrawRound', String(roundNumRef.current));
    setCurrentRoundNum(roundNumRef.current);
    setSpinDone(false);
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
    title.addText(`Total winners: ${rounds.reduce((s, r) => s + r.winners.length, 0)}`, {
      x: 0.5, y: 5.5, w: 12.33, h: 0.5,
      fontSize: 14, color: LIGHT, align: 'center',
    });

    // Current round only, newest spin-batch first, within each batch reversed
    const allWinnersPpt = rounds
      .filter(r => r.roundNum === currentRoundNum)
      .slice().reverse()
      .flatMap(r => [...r.winners].reverse());

    // Winner slides — 30 per slide, 3 columns × 10 rows
    const PER_SLIDE = 30;
    const ROWS = 10;
    const COL_W = 4.11;
    const COL_X = [0.3, 0.3 + COL_W + 0.1, 0.3 + 2 * (COL_W + 0.1)];
    const BADGE_W = 0.42;
    const startY = 0.82;
    const rowH = (7.5 - startY - 0.08) / ROWS;

    for (let s = 0; s < allWinnersPpt.length; s += PER_SLIDE) {
      const slice = allWinnersPpt.slice(s, s + PER_SLIDE);
      const slide = prs.addSlide();
      slide.background = { color: 'f1f8e9' };

      // Header bar
      slide.addShape('rect', {
        x: 0, y: 0, w: 13.33, h: 0.72,
        fill: { color: '1b5e20' }, line: { color: '1b5e20', pt: 0 },
      });
      slide.addText('Lucky Draw Winners', {
        x: 0.4, y: 0.1, w: 9, h: 0.52,
        fontSize: 18, bold: true, color: WHITE,
      });
      const pageLabel = allWinnersPpt.length > PER_SLIDE
        ? `(${s + 1}–${Math.min(s + PER_SLIDE, allWinnersPpt.length)} of ${allWinnersPpt.length})`
        : `${allWinnersPpt.length} winner(s)`;
      slide.addText(pageLabel, {
        x: 9.5, y: 0.1, w: 3.63, h: 0.52,
        fontSize: 13, color: 'a5d6a7', align: 'right',
      });

      // Dividers between columns
      [COL_X[1] - 0.05, COL_X[2] - 0.05].forEach(dx => {
        slide.addShape('line', {
          x: dx, y: 0.78, w: 0, h: 6.62,
          line: { color: 'c8e6c9', pt: 1 },
        });
      });

      slice.forEach((w, i) => {
        const col = Math.floor(i / ROWS);
        const row = i % ROWS;
        const cx = COL_X[col];
        const y = startY + row * rowH;
        const rank = s + i + 1;

        // Rank badge
        slide.addShape('ellipse', {
          x: cx, y: y + 0.12, w: BADGE_W, h: BADGE_W,
          fill: { color: '2e7d32' },
          line: { color: 'ffffff', pt: 1 },
        });
        slide.addText(`${rank}`, {
          x: cx, y: y + 0.16, w: BADGE_W, h: BADGE_W - 0.08,
          fontSize: 11, bold: true, color: WHITE, align: 'center',
        });

        const textX = cx + BADGE_W + 0.08;
        const textW = COL_W - BADGE_W - 0.12;

        slide.addText(w.name, {
          x: textX, y: y + 0.1, w: textW, h: 0.3,
          fontSize: 12, bold: true, color: '1b5e20',
        });
        slide.addText(w.subCommittee, {
          x: textX, y: y + 0.38, w: textW, h: 0.2,
          fontSize: 9, color: '388e3c',
        });

        if (row < ROWS - 1 && i < slice.length - 1) {
          slide.addShape('line', {
            x: cx, y: y + rowH - 0.03, w: COL_W, h: 0,
            line: { color: 'c8e6c9', pt: 0.5 },
          });
        }
      });
    }

    prs.writeFile({ fileName: 'lucky-draw-results.pptx' });
  };

  // ── DOCX export (JSZip + raw OOXML — no extra packages) ──────────────────

  const downloadDOCX = async () => {
    const JSZip = (await import('jszip')).default;
    const winners = allWinners;

    const esc = (s) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const GREEN  = '1b5e20';
    const WHITE  = 'FFFFFF';
    const BORDER = `<w:top w:val="single" w:sz="6" w:color="2e7d32"/><w:left w:val="single" w:sz="6" w:color="2e7d32"/><w:bottom w:val="single" w:sz="6" w:color="2e7d32"/><w:right w:val="single" w:sz="6" w:color="2e7d32"/>`;

    const hdrCell = (text, w) => `
      <w:tc>
        <w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${GREEN}"/><w:tcBorders>${BORDER}</w:tcBorders><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
          <w:r><w:rPr><w:b/><w:color w:val="${WHITE}"/><w:sz w:val="22"/></w:rPr><w:t>${esc(text)}</w:t></w:r>
        </w:p>
      </w:tc>`;

    const dataCell = (text, w) => `
      <w:tc>
        <w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:tcBorders>${BORDER}</w:tcBorders><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>
      </w:tc>`;

    const sigCell = (w) => `
      <w:tc>
        <w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:tcBorders>${BORDER}</w:tcBorders></w:tcPr>
        <w:p><w:r><w:t></w:t></w:r></w:p>
      </w:tc>`;

    const headerRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${hdrCell('No.', 600)}${hdrCell('Name', 2800)}${hdrCell('Sub-Committee', 2600)}${hdrCell('Prize', 1760)}${hdrCell('Signature', 1600)}</w:tr>`;

    const dataRows = winners.map((w, i) =>
      `<w:tr>${dataCell(String(i + 1), 600)}${dataCell(w.name, 2800)}${dataCell(w.subCommittee, 2600)}${dataCell(w.prize || '', 1760)}${sigCell(1600)}</w:tr>`
    ).join('');

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:pStyle w:val="Heading1"/></w:pPr>
    <w:r><w:rPr><w:b/><w:color w:val="${GREEN}"/><w:sz w:val="28"/></w:rPr>
      <w:t>Volunteer Appreciation &amp; Appointment Ceremony 2026</w:t>
    </w:r>
  </w:p>
  <w:p>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:color w:val="388e3c"/><w:sz w:val="22"/></w:rPr>
      <w:t>Pasir Ris West &#xB7; Lucky Draw Winners &#xB7; ${winners.length} winner(s)</w:t>
    </w:r>
  </w:p>
  <w:p><w:r><w:t></w:t></w:r></w:p>
  <w:tbl>
    <w:tblPr>
      <w:tblW w:w="9360" w:type="dxa"/>
      <w:tblBorders>${BORDER}</w:tblBorders>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="600"/><w:gridCol w:w="2800"/><w:gridCol w:w="2600"/><w:gridCol w:w="1760"/><w:gridCol w:w="1600"/>
    </w:tblGrid>
    ${headerRow}${dataRows}
  </w:tbl>
  <w:sectPr>
    <w:pgSz w:w="12240" w:h="15840"/>
    <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/>
  </w:sectPr>
</w:body>
</w:document>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const zip = new JSZip();
    zip.file('[Content_Types].xml', contentTypes);
    zip.file('_rels/.rels', rels);
    zip.file('word/document.xml', docXml);

    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lucky-draw-round-${currentRoundNum}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const totalWinners = rounds.reduce((s, r) => s + r.winners.length, 0);

  // Current round's winners only — newest spin-batch first, within each batch reversed
  const currentRoundBatches = rounds.filter(r => r.roundNum === currentRoundNum);
  // prize is stored on each winner (both in-session and loaded from DB)
  const allWinners = currentRoundBatches
    .slice().reverse()
    .flatMap(r => [...r.winners].reverse());

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
        ) : wheel.length === 0 && allWinners.length === 0 && totalWinners === 0 ? (
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

                {spinDone && !spinning && (
                  <div className="ldb-done-msg">🎉 Spin complete!</div>
                )}
              </div>

              {/* Results panel */}
              <div className="ldb-winners-col">
                <div className="ldb-winners-header">
                  <h2>🏆 Round {currentRoundNum} <span className="ldb-round-tally">({allWinners.length})</span></h2>
                  <div className="ldb-winners-actions">
                    {allWinners.length > 0 && (
                      <>
                        <button className="ldb-btn-ppt" onClick={downloadPPT} title="Download Round PPT">
                          ⬇ PPT
                        </button>
                        <button className="ldb-btn-docx" onClick={downloadDOCX} title="Download Word document">
                          ⬇ DOCX
                        </button>
                      </>
                    )}
                    <button
                      className="ldb-btn-next-round"
                      onClick={moveToNextRound}
                      disabled={spinning}
                      title="Move to next round"
                    >
                      Next Round →
                    </button>
                  </div>
                </div>

                {allWinners.length === 0 ? (
                  <div className="ldb-winners-empty">
                    Click SPIN and enter how many winners to pick.
                  </div>
                ) : (
                  <ol className="ldb-winners-list">
                    {allWinners.map((w, i) => {
                      const rank = i + 1;
                      const isLatest = spinning && i === 0;
                      return (
                        <li key={`${w.id}-${i}`} className={`ldb-winner-item ${isLatest ? 'latest' : ''}`}>
                          <span className="ldb-winner-rank">{rank}</span>
                          <span className="ldb-winner-info">
                            {w.prize && (
                              <span className="ldb-winner-prize-label">
                                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`} {w.prize}
                              </span>
                            )}
                            <span className="ldb-winner-name">{w.name}</span>
                            <span className="ldb-winner-sub">{w.subCommittee}</span>
                          </span>
                        </li>
                      );
                    })}
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
