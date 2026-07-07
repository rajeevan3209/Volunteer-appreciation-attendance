import React, { useState, useEffect, useRef, useCallback } from 'react';
import './TreePage.css';

const API = '';
const POLL_INTERVAL = 5000;

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

// Multi-zone canopy map — ellipses tracing the real leaf/branch area.
// Values are fractions of the tree-inner container (width / height).
//
// Calibration rules applied from screenshot review:
//  • Long names (~120px wide at 9px bold) need their centre ≥ 8% inside the
//    canopy edge so the text doesn't spill into the sky (at 780px container).
//  • Top crown raised to cy=0.20 so names land on crown leaves, not the
//    sunburst / circular text ring (which ends at ~y=13%).
//  • All left zones pulled right, all right zones pulled left vs. previous.
//  • New lower-centre zone fills the previously empty gap above the trunk.
const ZONES = [
  // top crown — raised above sunburst; narrow so names stay on leaves
  { cx: 0.50, cy: 0.20, rx: 0.12, ry: 0.07 },
  // upper-left  (leftmost centre 0.33 → safe at 780 px)
  { cx: 0.42, cy: 0.26, rx: 0.09, ry: 0.09 },
  // upper-right (rightmost centre 0.67)
  { cx: 0.58, cy: 0.26, rx: 0.09, ry: 0.09 },
  // centre bulk — widest safe zone through the dense middle canopy
  { cx: 0.50, cy: 0.32, rx: 0.16, ry: 0.12 },
  // mid-left  (leftmost 0.31)
  { cx: 0.41, cy: 0.39, rx: 0.10, ry: 0.10 },
  // mid-right (rightmost 0.69)
  { cx: 0.59, cy: 0.39, rx: 0.10, ry: 0.10 },
  // lower-left branch (leftmost 0.33)
  { cx: 0.41, cy: 0.46, rx: 0.08, ry: 0.07 },
  // lower-centre — NEW: fills the empty area above the trunk
  { cx: 0.50, cy: 0.48, rx: 0.14, ry: 0.07 },
  // lower-right branch (rightmost 0.67)
  { cx: 0.59, cy: 0.46, rx: 0.08, ry: 0.07 },
];

function randomInCanopy() {
  // Pick a zone at random, then rejection-sample within its ellipse
  for (let attempt = 0; attempt < 300; attempt++) {
    const zone = ZONES[Math.floor(Math.random() * ZONES.length)];
    const x = zone.cx + (Math.random() * 2 - 1) * zone.rx;
    const y = zone.cy + (Math.random() * 2 - 1) * zone.ry;
    const dx = (x - zone.cx) / zone.rx;
    const dy = (y - zone.cy) / zone.ry;
    if (dx * dx + dy * dy <= 1) return { x, y };
  }
  // Fallback to centre canopy
  return { x: 0.50, y: 0.31 };
}

// Avoid overlapping — thresholds tuned for 350 names at ~8px font in a 780px container.
// dx=0.085 ≈ 66px wide slot, dy=0.020 ≈ 10px tall slot (just above font height).
function findPosition(placed, attempts = 300) {
  for (let i = 0; i < attempts; i++) {
    const pos = randomInCanopy();
    const tooClose = placed.some(p => {
      const dx = Math.abs(p.x - pos.x);
      const dy = Math.abs(p.y - pos.y);
      return dx < 0.085 && dy < 0.020;
    });
    if (!tooClose) return pos;
  }
  return randomInCanopy(); // fallback when very crowded
}

export default function TreePage() {
  const [names, setNames] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null); // [{ id, name, x, y, delay }]
  const placedRef = useRef([]);
  const knownIdsRef = useRef(new Set());

  const fetchNames = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/attendance`);
      const data = await res.json();
      const newEntries = data.filter(a => !knownIdsRef.current.has(a.id));
      if (newEntries.length === 0) return;

      const newNodes = newEntries.map((a, i) => {
        const pos = findPosition(placedRef.current);
        placedRef.current.push(pos);
        knownIdsRef.current.add(a.id);
        const color = NAME_COLORS[Math.floor(Math.random() * NAME_COLORS.length)];
        return { id: a.id, name: a.participantName, x: pos.x, y: pos.y, delay: i * 150, color };
      });

      setNames(prev => [...prev, ...newNodes]);
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
        <h1>Welcome to Volunteer Appreciation Dinner</h1>
        <p>Pasir Ris West Community Centre · Our Volunteers</p>
        <span className="tree-count">{names.length} volunteer{names.length !== 1 ? 's' : ''} on the tree</span>
      </header>

      <main className="tree-main">
        <div className="tree-container" ref={containerRef}>
          <div className="tree-inner">
            <img src="/tree.png" alt="Tree" className="tree-img" draggable={false} />
            {names.map(n => (
              <span
                key={n.id}
                className="tree-name"
                style={{
                  left: `${n.x * 100}%`,
                  top: `${n.y * 100}%`,
                  animationDelay: `${n.delay}ms`,
                  color: n.color,
                  // Dark outline on all 4 sides so the name reads on any leaf colour
                  textShadow: `
                    0 0 3px #000,
                    0 0 6px rgba(0,0,0,0.85),
                    1px 1px 0 #000,
                    -1px -1px 0 #000,
                    1px -1px 0 #000,
                    -1px  1px 0 #000
                  `.trim(),
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
