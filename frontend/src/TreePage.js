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
// Zones recalibrated from screenshot review (v3):
//  • All zones kept below y=0.27 — the golden sunburst occupies y=0–27%
//    and has no leaves; anything above 0.27 was the red-circled problem area.
//  • Lower-left / lower-right moved outward (cx 0.41→0.29, 0.59→0.71)
//    to reach the branch-leaf areas the user circled green (empty).
//  • Centre bulk and mid zones shifted down ~6% to match where leaves
//    actually are in the image.
// v4 — expanded left boundary + raised top crown + right mirror kept symmetric
const ZONES = [
  // top crown — raised from cy=0.29 to cy=0.26 and taller (ry 0.04→0.06)
  // so the very top of the leaf mass fills with names
  { cx: 0.50, cy: 0.26, rx: 0.13, ry: 0.06 },
  // upper-left — shifted left (cx 0.41→0.37) and wider (rx 0.10→0.13)
  { cx: 0.37, cy: 0.33, rx: 0.13, ry: 0.08 },
  // upper-right — mirror
  { cx: 0.63, cy: 0.33, rx: 0.13, ry: 0.08 },
  // centre bulk — unchanged, already good
  { cx: 0.50, cy: 0.39, rx: 0.17, ry: 0.10 },
  // mid-left — shifted left (cx 0.39→0.35) and wider (rx 0.11→0.13)
  { cx: 0.35, cy: 0.44, rx: 0.13, ry: 0.09 },
  // mid-right — mirror
  { cx: 0.65, cy: 0.44, rx: 0.13, ry: 0.09 },
  // lower-left branch — shifted left (cx 0.29→0.25, rx 0.09→0.10)
  { cx: 0.25, cy: 0.51, rx: 0.10, ry: 0.07 },
  // lower-centre — unchanged
  { cx: 0.50, cy: 0.51, rx: 0.13, ry: 0.06 },
  // lower-right branch — mirror
  { cx: 0.75, cy: 0.51, rx: 0.10, ry: 0.07 },
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

// Overlap grid — dx matches actual rendered name width (~90px at 9px bold in
// a 780px container = 0.115). dy keeps rows just one line-height apart (10px = 0.018).
// 500 attempts before falling back so the dense middle zones get fully packed first.
function findPosition(placed, attempts = 500) {
  for (let i = 0; i < attempts; i++) {
    const pos = randomInCanopy();
    const tooClose = placed.some(p => {
      const dx = Math.abs(p.x - pos.x);
      const dy = Math.abs(p.y - pos.y);
      return dx < 0.115 && dy < 0.018;
    });
    if (!tooClose) return pos;
  }
  return randomInCanopy(); // fallback when very crowded
}

// Trunk zones — the narrow brown trunk sits roughly cx=0.50, y=0.58–0.88
const TRUNK_ZONES = [
  { cx: 0.50, cy: 0.63, rx: 0.055, ry: 0.04 },
  { cx: 0.50, cy: 0.72, rx: 0.050, ry: 0.04 },
  { cx: 0.50, cy: 0.81, rx: 0.045, ry: 0.04 },
];

function randomInTrunk() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const zone = TRUNK_ZONES[Math.floor(Math.random() * TRUNK_ZONES.length)];
    const x = zone.cx + (Math.random() * 2 - 1) * zone.rx;
    const y = zone.cy + (Math.random() * 2 - 1) * zone.ry;
    const dx = (x - zone.cx) / zone.rx;
    const dy = (y - zone.cy) / zone.ry;
    if (dx * dx + dy * dy <= 1) return { x, y };
  }
  return { x: 0.50, y: 0.72 };
}

function findTrunkPosition(placed) {
  for (let i = 0; i < 300; i++) {
    const pos = randomInTrunk();
    const tooClose = placed.some(p => Math.abs(p.x - pos.x) < 0.09 && Math.abs(p.y - pos.y) < 0.020);
    if (!tooClose) return pos;
  }
  return randomInTrunk();
}

export default function TreePage() {
  const [canopyNames, setCanopyNames] = useState([]);
  const [trunkNames, setTrunkNames] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const canopyPlacedRef = useRef([]);
  const trunkPlacedRef = useRef([]);
  const knownIdsRef = useRef(new Set());

  const fetchNames = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/attendance`);
      const data = await res.json();
      const newEntries = data.filter(a => !knownIdsRef.current.has(a.id));
      if (newEntries.length === 0) return;

      const newCanopy = [];
      const newTrunk = [];

      newEntries.forEach((a, i) => {
        knownIdsRef.current.add(a.id);
        const isLeader = a.subCommittee?.trim() === 'Leaders';
        if (isLeader) {
          const pos = findTrunkPosition(trunkPlacedRef.current);
          trunkPlacedRef.current.push(pos);
          newTrunk.push({ id: a.id, name: a.participantName, x: pos.x, y: pos.y, delay: i * 150 });
        } else {
          const pos = findPosition(canopyPlacedRef.current);
          canopyPlacedRef.current.push(pos);
          const color = NAME_COLORS[Math.floor(Math.random() * NAME_COLORS.length)];
          newCanopy.push({ id: a.id, name: a.participantName, x: pos.x, y: pos.y, delay: i * 150, color });
        }
      });

      if (newCanopy.length) setCanopyNames(prev => [...prev, ...newCanopy]);
      if (newTrunk.length) setTrunkNames(prev => [...prev, ...newTrunk]);
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
        <p>Pasir Ris Elias Community Club · Our Volunteers</p>
        <span className="tree-count">{canopyNames.length + trunkNames.length} volunteer{canopyNames.length + trunkNames.length !== 1 ? 's' : ''} on the tree</span>
      </header>

      <main className="tree-main">
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
