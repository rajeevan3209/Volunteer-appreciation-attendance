import React, { useState, useEffect, useRef, useCallback } from 'react';
import './TreePage.css';

const API = '';
const POLL_INTERVAL = 5000;

const NAME_COLORS = [
  '#e53935', // red
  '#c62828', // dark red
  '#ff1744', // bright red
  '#fdd835', // yellow
  '#f9a825', // dark yellow
  '#ffee58', // light yellow
  '#800000', // maroon
  '#b71c1c', // maroon-red
  '#8b0000', // dark maroon
];

// Multi-zone canopy map — each zone is an ellipse tracing the real leaf/branch area.
// Values are fractions of the tree-inner container (width / height).
// Analysed against tree.png: circular badge, canopy from ~y=5% to y=54%,
// trunk at x=45–55% y=56–74%, roots below y=73%.
const ZONES = [
  // top crown dome
  { cx: 0.50, cy: 0.14, rx: 0.16, ry: 0.09 },
  // upper-left canopy
  { cx: 0.36, cy: 0.24, rx: 0.17, ry: 0.12 },
  // upper-right canopy
  { cx: 0.64, cy: 0.24, rx: 0.17, ry: 0.12 },
  // centre canopy bulk
  { cx: 0.50, cy: 0.31, rx: 0.15, ry: 0.13 },
  // mid-left canopy
  { cx: 0.34, cy: 0.36, rx: 0.14, ry: 0.12 },
  // mid-right canopy
  { cx: 0.66, cy: 0.36, rx: 0.14, ry: 0.12 },
  // lower-left branch spread
  { cx: 0.26, cy: 0.45, rx: 0.10, ry: 0.07 },
  // lower-right branch spread
  { cx: 0.74, cy: 0.45, rx: 0.10, ry: 0.07 },
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

// Avoid overlapping by checking placed positions
function findPosition(placed, attempts = 120) {
  for (let i = 0; i < attempts; i++) {
    const pos = randomInCanopy();
    const tooClose = placed.some(p => {
      const dx = Math.abs(p.x - pos.x);
      const dy = Math.abs(p.y - pos.y);
      return dx < 0.10 && dy < 0.045;
    });
    if (!tooClose) return pos;
  }
  return randomInCanopy(); // fallback if crowded
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
                  textShadow: `0 0 8px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.6)`,
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
