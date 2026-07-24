import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import './Attendees.css';

const API = '';

export default function Attendees() {
  const [attendance, setAttendance] = useState([]);
  const [totalParticipants, setTotalParticipants] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const ADMIN_PIN = '1986';

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const [attRes, countRes] = await Promise.all([
        fetch(`${API}/api/attendance`),
        fetch(`${API}/api/participants/count`),
      ]);
      const data = await attRes.json();
      const countData = await countRes.json();
      setAttendance(data);
      setTotalParticipants(countData.total);
      setLastRefreshed(new Date());
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const grouped = attendance.reduce((acc, a) => {
    if (!acc[a.subCommittee]) acc[a.subCommittee] = [];
    acc[a.subCommittee].push(a);
    return acc;
  }, {});
  const sortedGroups = Object.keys(grouped).sort();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const now = new Date();
    const rate = totalParticipants
      ? `${Math.round((attendance.length / totalParticipants) * 100)}%` : '—';

    // ── Sheet 1: Summary ──────────────────────────────────────────────────────
    const summaryRows = [
      ['Volunteer Appreciation & Appointment Ceremony 2026'],
      ['Pasir Ris West'],
      [],
      ['Report Generated', now.toLocaleString()],
      [],
      ['ATTENDANCE SUMMARY'],
      ['Attended',        attendance.length],
      ['Total Expected',  totalParticipants ?? '—'],
      ['Attendance Rate', rate],
      ['Sub-Committees',  sortedGroups.length],
      [],
      ['BREAKDOWN BY SUB-COMMITTEE'],
      ['Sub-Committee', 'Count'],
      ...sortedGroups.map(g => [g, grouped[g].length]),
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // ── Sheet 2: Participants ─────────────────────────────────────────────────
    const detailRows = attendance.map((a, i) => ({
      '#': i + 1,
      Name: a.participantName,
      'Sub-Committee': a.subCommittee,
      'Time Registered': new Date(a.markedAt).toLocaleString(),
    }));
    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    wsDetail['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 28 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Participants');

    XLSX.writeFile(wb, `attendance-report-${now.toISOString().slice(0, 10)}.xlsx`);
  };

  const handleConfirm = async () => {
    if (!confirmDialog) return;
    if (pin !== ADMIN_PIN) {
      setPinError('Incorrect PIN. Please try again.');
      return;
    }
    setActionLoading(true);
    try {
      const postEndpoints = {
        '__reload-lucky-draw__': '/api/admin/reload-lucky-draw',
        '__reload-participants__': '/api/admin/reload-participants',
      };
      const isPost = confirmDialog.endpoint in postEndpoints;
      const url = isPost ? postEndpoints[confirmDialog.endpoint] : confirmDialog.endpoint;
      const res = await fetch(url, { method: isPost ? 'POST' : 'DELETE' });
      const data = await res.json();
      showToast(data.message);
      await fetchAttendance();
    } catch {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setActionLoading(false);
      setConfirmDialog(null);
      setPin('');
      setPinError('');
    }
  };

  const handleOpenDialog = (dialog) => {
    setPin('');
    setPinError('');
    setConfirmDialog(dialog);
  };

  const handleReloadLuckyDraw = () => {
    handleOpenDialog({
      icon: '🔄',
      title: 'Reset Lucky Draw',
      message: 'This will clear all lucky draw results and bulk draw selections, then reload every attendee as a fresh participant. Use this to restart the draw after a mistake.',
      endpoint: '__reload-lucky-draw__',
    });
  };

  const handleReloadParticipants = () => {
    handleOpenDialog({
      icon: '📋',
      title: 'Reload Participants from CSV',
      message: 'This will wipe all participants, attendance records, and draw data, then reload the participant list fresh from the CSV file. This cannot be undone.',
      endpoint: '__reload-participants__',
    });
  };

  return (
    <div className="att-app">
      {/* Toast */}
      {toast && <div className={`att-toast att-toast-${toast.type}`}>{toast.message}</div>}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="att-overlay">
          <div className="att-dialog">
            <div className="att-dialog-icon">{confirmDialog.icon}</div>
            <h3 className="att-dialog-title">{confirmDialog.title}</h3>
            <p className="att-dialog-msg">{confirmDialog.message}</p>

            <div className="att-pin-group">
              <label className="att-pin-label">Enter Admin PIN to confirm</label>
              <input
                className={`att-pin-input ${pinError ? 'att-pin-error' : ''}`}
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="● ● ● ●"
                value={pin}
                onChange={e => { setPin(e.target.value); setPinError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                autoFocus
              />
              {pinError && <span className="att-pin-error-msg">{pinError}</span>}
            </div>

            <div className="att-dialog-actions">
              <button className="att-dialog-cancel" onClick={() => { setConfirmDialog(null); setPin(''); setPinError(''); }} disabled={actionLoading}>
                Cancel
              </button>
              <button className="att-dialog-confirm" onClick={handleConfirm} disabled={actionLoading}>
                {actionLoading ? 'Clearing…' : 'Yes, Clear'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="att-header">
        <div className="att-header-content">
          <h1>Welcome to Volunteer Appreciation &amp; Appointment Ceremony 2026</h1>
          <p>Pasir Ris West · Admin</p>
        </div>
        <div className="att-header-actions">
          <button className="att-btn-icon" onClick={fetchAttendance} title="Refresh">↺</button>
          <button className="att-btn-icon" onClick={handleExport} title="Export to Excel" disabled={attendance.length === 0}>⬇</button>
        </div>
      </header>

      <main className="att-main">
        {/* Summary bar */}
        <div className="att-summary">
          <div className="att-stat">
            <span className="att-stat-number">{attendance.length}</span>
            <span className="att-stat-label">Attended</span>
          </div>
          <div className="att-stat att-stat--total">
            <span className="att-stat-number">{totalParticipants ?? '—'}</span>
            <span className="att-stat-label">Total Expected</span>
          </div>
          <div className="att-stat att-stat--pct">
            <span className="att-stat-number">
              {totalParticipants ? `${Math.round((attendance.length / totalParticipants) * 100)}%` : '—'}
            </span>
            <span className="att-stat-label">Attendance Rate</span>
          </div>
          <div className="att-stat">
            <span className="att-stat-number">{sortedGroups.length}</span>
            <span className="att-stat-label">Sub-Committees</span>
          </div>
          {lastRefreshed && (
            <div className="att-refreshed">Last updated: {lastRefreshed.toLocaleTimeString()}</div>
          )}
        </div>

        {/* Admin Actions */}
        <div className="att-admin-panel">
          <div className="att-admin-label">⚙️ Admin Actions</div>
          <div className="att-admin-actions">
            <button
              className="att-admin-btn danger"
              onClick={() => handleOpenDialog({
                icon: '🗑️',
                title: 'Clear All Attendance',
                message: `This will permanently delete all ${attendance.length} attendance records and reset the lucky draw. Participants will be able to re-submit their attendance. This cannot be undone.`,
                endpoint: '/api/admin/attendance',
              })}
              disabled={attendance.length === 0}
            >
              🗑️ Clear Attendance
            </button>
            <button
              className="att-admin-btn warning"
              onClick={() => handleOpenDialog({
                icon: '⚠️',
                title: 'Clear All Data',
                message: 'This will delete ALL attendance records, lucky draw data, and bulk draw results. Everything resets. This cannot be undone.',
                endpoint: '/api/admin/all',
              })}
            >
              ⚠️ Reset Everything
            </button>
            <button
              className="att-admin-btn reload"
              onClick={handleReloadLuckyDraw}
              disabled={attendance.length === 0}
            >
              🔄 Reset Lucky Draw
            </button>
            <button
              className="att-admin-btn reload-csv"
              onClick={handleReloadParticipants}
            >
              📋 Reload Participants
            </button>
          </div>
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
