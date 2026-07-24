import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSubCommittee, setNewSubCommittee] = useState('');
  const [newSubCommitteeOther, setNewSubCommitteeOther] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [subCommittees, setSubCommittees] = useState([]);

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

  useEffect(() => {
    fetch(`${API}/api/subcommittees`).then(r => r.json()).then(setSubCommittees).catch(() => {});
  }, []);

  const openAddParticipant = () => {
    setNewName('');
    setNewSubCommittee('');
    setNewSubCommitteeOther('');
    setAddError('');
    setShowAddParticipant(true);
  };

  const handleAddParticipant = async () => {
    const sub = newSubCommittee === '__other__' ? newSubCommitteeOther.trim() : newSubCommittee;
    if (!newName.trim()) { setAddError('Name is required.'); return; }
    if (!sub) { setAddError('Sub-committee is required.'); return; }
    setAddLoading(true);
    setAddError('');
    try {
      const res = await fetch(`${API}/api/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), subCommittee: sub }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || 'Failed to add participant.'); return; }
      showToast(`${newName.trim()} added. They can now mark attendance.`);
      setShowAddParticipant(false);
      await fetchAttendance();
    } catch {
      setAddError('Network error. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };

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

  const handleExportPdf = () => {
    const now = new Date();
    const rate = totalParticipants
      ? `${Math.round((attendance.length / totalParticipants) * 100)}%` : '—';

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Volunteer Appreciation & Appointment Ceremony 2026', pageW / 2, 18, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Pasir Ris West', pageW / 2, 25, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Report generated: ${now.toLocaleString()}`, pageW / 2, 31, { align: 'center' });
    doc.setTextColor(0);

    // Stats table
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Attendance Summary', 14, 40);
    autoTable(doc, {
      startY: 43,
      head: [['Metric', 'Value']],
      body: [
        ['Attended',        String(attendance.length)],
        ['Total Expected',  String(totalParticipants ?? '—')],
        ['Attendance Rate', rate],
        ['Sub-Committees',  String(sortedGroups.length)],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [46, 125, 50] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
      margin: { left: 14, right: 14 },
    });

    // Breakdown by sub-committee
    const afterStats = doc.lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Breakdown by Sub-Committee', 14, afterStats);
    autoTable(doc, {
      startY: afterStats + 3,
      head: [['Sub-Committee', 'Count']],
      body: sortedGroups.map(g => [g, grouped[g].length]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [46, 125, 50] },
      margin: { left: 14, right: 14 },
    });

    // Participants list
    const afterBreakdown = doc.lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Participants', 14, afterBreakdown);
    autoTable(doc, {
      startY: afterBreakdown + 3,
      head: [['#', 'Name', 'Sub-Committee', 'Time Registered']],
      body: attendance.map((a, i) => [
        i + 1,
        a.participantName,
        a.subCommittee,
        new Date(a.markedAt).toLocaleString(),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [46, 125, 50] },
      columnStyles: { 0: { cellWidth: 10 }, 3: { cellWidth: 38 } },
      margin: { left: 14, right: 14 },
    });

    doc.save(`attendance-report-${now.toISOString().slice(0, 10)}.pdf`);
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

      {/* Add Participant Modal */}
      {showAddParticipant && (
        <div className="att-overlay">
          <div className="att-dialog">
            <div className="att-dialog-icon">➕</div>
            <h3 className="att-dialog-title">Add New Participant</h3>
            <p className="att-dialog-msg">
              This person will be added to the participant list and can then mark their attendance on the main page.
            </p>

            <div className="att-add-form">
              <label className="att-add-label">Full Name</label>
              <input
                className="att-add-input"
                type="text"
                placeholder="Enter full name"
                value={newName}
                onChange={e => { setNewName(e.target.value); setAddError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAddParticipant()}
                autoFocus
              />

              <label className="att-add-label">Sub-Committee</label>
              <select
                className="att-add-input"
                value={newSubCommittee}
                onChange={e => { setNewSubCommittee(e.target.value); setAddError(''); }}
              >
                <option value="">— Select sub-committee —</option>
                {subCommittees.map(sc => (
                  <option key={sc} value={sc}>{sc}</option>
                ))}
                <option value="__other__">Other (type below)</option>
              </select>

              {newSubCommittee === '__other__' && (
                <input
                  className="att-add-input"
                  type="text"
                  placeholder="Enter sub-committee name"
                  value={newSubCommitteeOther}
                  onChange={e => { setNewSubCommitteeOther(e.target.value); setAddError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleAddParticipant()}
                />
              )}

              {addError && <span className="att-pin-error-msg">{addError}</span>}
            </div>

            <div className="att-dialog-actions">
              <button className="att-dialog-cancel" onClick={() => setShowAddParticipant(false)} disabled={addLoading}>
                Cancel
              </button>
              <button className="att-dialog-confirm" onClick={handleAddParticipant} disabled={addLoading}>
                {addLoading ? 'Adding…' : 'Add Participant'}
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
          <button className="att-btn-icon att-btn-refresh" onClick={fetchAttendance} title="Refresh attendance list">↺</button>
          <button className="att-btn-icon" onClick={handleExport} title="Export to Excel" disabled={attendance.length === 0}>⬇ Excel</button>
          <button className="att-btn-icon" onClick={handleExportPdf} title="Export to PDF" disabled={attendance.length === 0}>⬇ PDF</button>
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
            <button
              className="att-admin-btn add-participant"
              onClick={openAddParticipant}
            >
              ➕ Add Participant
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
