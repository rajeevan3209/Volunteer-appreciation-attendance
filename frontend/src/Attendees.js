import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import './Attendees.css';

const API = '';

export default function Attendees() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/attendance`);
      const data = await res.json();
      setAttendance(data);
      setLastRefreshed(new Date());
    } catch {
      // silently retry on next refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Group by subCommittee
  const grouped = attendance.reduce((acc, a) => {
    const key = a.subCommittee;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const sortedGroups = Object.keys(grouped).sort();

  const handleExport = () => {
    const rows = attendance.map((a, i) => ({
      '#': i + 1,
      Name: a.participantName,
      'Sub-Committee': a.subCommittee,
      'Marked At': new Date(a.markedAt).toLocaleString(),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, 'attendance.xlsx');
  };

  return (
    <div className="att-app">
      <header className="att-header">
        <div className="att-header-content">
          <h1>Welcome to Volunteer Appreciation Dinner</h1>
          <p>Pasir Ris West Community Centre</p>
        </div>
        <div className="att-header-actions">
          <button className="att-btn-icon" onClick={fetchAttendance} title="Refresh">
            ↺
          </button>
          <button className="att-btn-icon" onClick={handleExport} title="Export to Excel" disabled={attendance.length === 0}>
            ⬇
          </button>
        </div>
      </header>

      <main className="att-main">
        {/* Summary bar */}
        <div className="att-summary">
          <div className="att-stat">
            <span className="att-stat-number">{attendance.length}</span>
            <span className="att-stat-label">Total Attended</span>
          </div>
          <div className="att-stat">
            <span className="att-stat-number">{sortedGroups.length}</span>
            <span className="att-stat-label">Sub-Committees</span>
          </div>
          {lastRefreshed && (
            <div className="att-refreshed">
              Last updated: {lastRefreshed.toLocaleTimeString()}
            </div>
          )}
        </div>

        {loading ? (
          <div className="att-loading">⏳ Loading attendance data…</div>
        ) : attendance.length === 0 ? (
          <div className="att-empty">No attendance marked yet.</div>
        ) : (
          <div className="att-groups">
            {sortedGroups.map(group => (
              <div key={group} className="att-group">
                <div className="att-group-header">
                  <h2 className="att-group-title">{group}</h2>
                  <span className="att-group-count">{grouped[group].length}</span>
                </div>
                <div className="att-names">
                  {grouped[group].map((a, i) => (
                    <div key={a.id} className="att-name-card">
                      <span className="att-name-num">{i + 1}</span>
                      <span className="att-name-text">{a.participantName}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
