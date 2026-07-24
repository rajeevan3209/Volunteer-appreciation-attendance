import React, { useState, useEffect, useRef, useCallback } from 'react';
import './TreePage.css';

const API = '';
const POLL_INTERVAL = 2000;

// High-contrast colours that stand out on the dark-green tree canopy.
// Each gets a strong dark shadow in the JSX so it's legible on any leaf colour.
const NAME_COLORS = [
  '#FFFFFF',   // white   — brightest, most readable
  '#FFE500',   // gold    — warm, pops on green
  '#FF8C00',   // orange  — warm contrast
  '#40E0D0',   // teal    — cool contrast on green
  '#FF6EB4',   // pink    — vivid on green
  '#ADFF2F',   // lime    — yellow-green, still visible on dark green
  '#87CEEB',   // sky blue — soft, readable
  '#FFA07A',   // salmon  — warm pastel
];

// Canopy zones — calibrated to the actual leaf boundary in the tree image.
// Do NOT expand these: the upper-left/right zones already reach the sky edge.
const ZONES = [
  { cx: 0.50, cy: 0.26, rx: 0.12, ry: 0.06 },  // top crown
  { cx: 0.38, cy: 0.33, rx: 0.11, ry: 0.08 },  // upper-left
  { cx: 0.62, cy: 0.33, rx: 0.11, ry: 0.08 },  // upper-right
  { cx: 0.50, cy: 0.39, rx: 0.15, ry: 0.09 },  // centre bulk
  { cx: 0.36, cy: 0.44, rx: 0.09, ry: 0.07 },  // mid-left
  { cx: 0.64, cy: 0.44, rx: 0.09, ry: 0.07 },  // mid-right
  { cx: 0.31, cy: 0.49, rx: 0.07, ry: 0.04 },  // lower-left branch
  { cx: 0.50, cy: 0.48, rx: 0.10, ry: 0.04 },  // lower-centre
  { cx: 0.69, cy: 0.49, rx: 0.07, ry: 0.04 },  // lower-right branch
];

// Pre-build a shuffled staggered grid (~290 slots).
// Tighter step (0.044) fills the safe zones densely enough for 272+ names.
function buildCanopyGrid() {
  const X_STEP = 0.044;
  const Y_STEP = 0.010;
  const positions = [];
  let row = 0;
  for (let y = 0.21; y <= 0.535; y += Y_STEP, row++) {
    const xOff = (row % 2) * (X_STEP / 2);
    for (let x = 0.20 + xOff; x <= 0.85; x += X_STEP) {
      for (const zone of ZONES) {
        const dx = (x - zone.cx) / zone.rx;
        const dy = (y - zone.cy) / zone.ry;
        if (dx * dx + dy * dy <= 1) {
          positions.push({ x, y });
          break;
        }
      }
    }
  }
  // Shuffle so names fill the tree naturally rather than row-by-row
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions;
}

function randomInCanopy() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const zone = ZONES[Math.floor(Math.random() * ZONES.length)];
    const x = zone.cx + (Math.random() * 2 - 1) * zone.rx;
    const y = zone.cy + (Math.random() * 2 - 1) * zone.ry;
    const dx = (x - zone.cx) / zone.rx;
    const dy = (y - zone.cy) / zone.ry;
    if (dx * dx + dy * dy <= 1) return { x, y };
  }
  return { x: 0.50, y: 0.35 };
}

// Trunk: random within the dark-green circled bark area.
// Trunk sits at x≈0.46–0.55, y≈0.58–0.80 (above roots).
function randomTrunkPos(placed) {
  for (let i = 0; i < 400; i++) {
    const x = 0.505 + (Math.random() * 2 - 1) * 0.028;
    const y = 0.59 + Math.random() * 0.20; // 0.59–0.79, well above roots
    const tooClose = placed.some(p => Math.abs(p.x - x) < 0.06 && Math.abs(p.y - y) < 0.022);
    if (!tooClose) return { x, y };
  }
  return { x: 0.505, y: 0.59 + Math.random() * 0.20 };
}

export default function TreePage() {
  const [canopyNames, setCanopyNames] = useState([]);
  const [trunkNames, setTrunkNames] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const canopyGridRef = useRef(null);   // shuffled grid, built on first fetch
  const canopyIndexRef = useRef(0);     // next available grid slot
  const trunkPlacedRef = useRef([]);
  const knownIdsRef = useRef(new Set());

  const fetchNames = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/attendance`);
      const data = await res.json();
      const newEntries = data.filter(a => !knownIdsRef.current.has(a.id));
      if (newEntries.length === 0) return;

      // Build the grid once on first real fetch
      if (!canopyGridRef.current) canopyGridRef.current = buildCanopyGrid();

      const newCanopy = [];
      const newTrunk = [];
      newEntries.forEach((a, i) => {
        knownIdsRef.current.add(a.id);
        if (a.subCommittee?.split(',')[0].trim() === 'Leaders') {
          const pos = randomTrunkPos(trunkPlacedRef.current);
          trunkPlacedRef.current.push(pos);
          const color = NAME_COLORS[Math.floor(Math.random() * NAME_COLORS.length)];
          newTrunk.push({ id: a.id, name: a.participantName, x: pos.x, y: pos.y, delay: i * 150, color });
        } else {
          const grid = canopyGridRef.current;
          const idx = canopyIndexRef.current;
          const pos = idx < grid.length ? grid[idx] : randomInCanopy();
          canopyIndexRef.current++;
          const color = NAME_COLORS[Math.floor(Math.random() * NAME_COLORS.length)];
          newCanopy.push({ id: a.id, name: a.participantName, x: pos.x, y: pos.y, delay: i * 150, color });
        }
      });

      if (newCanopy.length || newTrunk.length) {
        setTimeout(() => {
          if (newCanopy.length) setCanopyNames(prev => [...prev, ...newCanopy]);
          if (newTrunk.length) setTrunkNames(prev => [...prev, ...newTrunk]);
        }, 3000);
      }
    } catch {
      // silently retry
    }
  }, []);

  useEffect(() => {
    fetchNames();
    const interval = setInterval(fetchNames, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNames]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  return (
    <div className="tree-app">
      <header className="tree-header">
        <h1>Welcome to Volunteer Appreciation &amp; Appointment Ceremony 2026</h1>
        <p>Pasir Ris West · Our Volunteers</p>
        <span className="tree-count">{canopyNames.length + trunkNames.length} volunteer{canopyNames.length + trunkNames.length !== 1 ? 's' : ''} on the tree</span>
      </header>

      <main className="tree-main">
        <img src="/pa.jpg" alt="Pasir Ris West" className="tree-pa-logo" />
        <div className="tree-container" ref={containerRef}>
          <div className="tree-inner">
            <img src="/tree.png" alt="Tree" className="tree-img" draggable={false} />
            {canopyNames.map(n => (
              <span
                key={n.id}
                className="tree-name"
                style={{
                  left: `${n.x * 100}%`,
                  top: `${n.y * 100}%`,
                  animationDelay: `${n.delay}ms`,
                  color: n.color,
                  textShadow: `0 0 3px #000, 0 0 6px rgba(0,0,0,0.85), 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000`,
                }}
              >
                {n.name}
              </span>
            ))}
            {trunkNames.map(n => (
              <span
                key={n.id}
                className="tree-name tree-trunk-name"
                style={{
                  left: `${n.x * 100}%`,
                  top: `${n.y * 100}%`,
                  animationDelay: `${n.delay}ms`,
                  color: n.color,
                }}
              >
                {n.name}
              </span>
            ))}
            <button className="tree-fullscreen-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? '⊠' : '⤢'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
