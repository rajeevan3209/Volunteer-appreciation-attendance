import React, { useState, useEffect, useRef, useCallback } from 'react';
import './TreePage.css';

const API = '';
const POLL_INTERVAL = 5000;

const NAME_COLORS = [
  '#c62828', // red
  '#e53935',
  '#f57f17', // amber
  '#f9a825',
  '#558b2f', // green
  '#2e7d32',
  '#1565c0', // blue
  '#6a1b9a', // purple
  '#00838f', // teal
  '#d84315', // deep orange
];

// Canopy zone as an ellipse — tweak if tree image changes
// Values are fractions of the container width/height
const CANOPY = {
  cx: 0.50,  // horizontal center
  cy: 0.38,  // vertical center
  rx: 0.40,  // horizontal radius
  ry: 0.34,  // vertical radius
};

function randomInCanopy() {
  // Pick a random point inside the ellipse using rejection sampling
  for (let i = 0; i < 200; i++) {
    const x = CANOPY.cx + (Math.random() * 2 - 1) * CANOPY.rx;
    const y = CANOPY.cy + (Math.random() * 2 - 1) * CANOPY.ry;
    const dx = (x - CANOPY.cx) / CANOPY.rx;
    const dy = (y - CANOPY.cy) / CANOPY.ry;
    if (dx * dx + dy * dy <= 1) return { x, y };
  }
  return { x: CANOPY.cx, y: CANOPY.cy };
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
          <img src="/tree.png" alt="Tree" className="tree-img" draggable={false} />
          <button className="tree-fullscreen-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? '⊠' : '⤢'}
          </button>
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
        </div>
      </main>
    </div>
  );
}
