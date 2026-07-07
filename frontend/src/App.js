import React, { useState, useEffect } from 'react';
import './App.css';

const API = '';

export default function App() {
  const [subCommittees, setSubCommittees] = useState([]);
  const [selectedSubCommittee, setSelectedSubCommittee] = useState('');
  const [participants, setParticipants] = useState([]);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [thankYouName, setThankYouName] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/subcommittees`)
      .then(r => r.json())
      .then(setSubCommittees)
      .catch(() => showToast('Failed to load sub-committees', 'error'));
  }, []);

  useEffect(() => {
    if (!selectedSubCommittee) {
      setParticipants([]);
      setSelectedParticipant(null);
      setSearchText('');
      return;
    }
    fetch(`${API}/api/participants?subCommittee=${encodeURIComponent(selectedSubCommittee)}`)
      .then(r => r.json())
      .then(data => {
        setParticipants(data);
        setSelectedParticipant(null);
        setSearchText('');
      })
      .catch(() => showToast('Failed to load participants', 'error'));
  }, [selectedSubCommittee]);

  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleConfirmAttendance = async () => {
    setLoading(true);
    setShowConfirm(false);
    try {
      const res = await fetch(`${API}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantName: selectedParticipant.name,
          subCommittee: selectedSubCommittee,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to mark attendance', 'error');
      } else {
        setThankYouName(selectedParticipant.name);
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectParticipant = (p) => {
    if (p.attended) return;
    setSelectedParticipant(p);
    setSearchText(p.name);
    setShowDropdown(false);
  };

  const attendedCount = participants.filter(p => p.attended).length;

  // Thank you screen
  if (thankYouName) {
    return (
      <div className="app">
        <header className="header">
          <h1>Welcome to Volunteer Appreciation &amp; Appointment Ceremony 2026</h1>
          <p>Pasir Ris Elias CC</p>
                  </header>
        <div className="thankyou-wrapper">
          <div className="thankyou-card">
            <div className="thankyou-icon">🎉</div>
            <h2 className="thankyou-name">{thankYouName}</h2>
            <p className="thankyou-message">
              Thank you for participating and serving the community.
            </p>
            <p className="thankyou-sub">
              Sit back and enjoy the Appreciation Day events!
            </p>
            <button className="btn-thumbs" onClick={() => window.close()} title="Close">
              👍
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="overlay">
          <div className="dialog">
            <h3 className="dialog-title">Confirm Attendance</h3>
            <div className="dialog-row">
              <span className="dialog-label">Sub-Committee</span>
              <span className="dialog-value">{selectedSubCommittee}</span>
            </div>
            <div className="dialog-row">
              <span className="dialog-label">Participant</span>
              <span className="dialog-value">{selectedParticipant?.name}</span>
            </div>
            <div className="dialog-actions">
              <button className="btn-cancel" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button className="btn-primary btn-confirm" onClick={handleConfirmAttendance} disabled={loading}>
                {loading ? 'Submitting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="header">
        <h1>Welcome to Volunteer Appreciation &amp; Appointment Ceremony 2026</h1>
              </header>

      <main className="main">
        <div className="card">
          <h2 className="card-title">Mark Attendance</h2>

          <div className="form-group">
            <label htmlFor="subcommittee">Sub-Committee</label>
            <select
              id="subcommittee"
              value={selectedSubCommittee}
              onChange={e => setSelectedSubCommittee(e.target.value)}
              className="select"
            >
              <option value="">— Select Sub-Committee —</option>
              {subCommittees.map(sc => (
                <option key={sc} value={sc}>{sc}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="participant">
              Participant Name
              {selectedSubCommittee && (
                <span className="badge">
                  {attendedCount}/{participants.length} attended
                </span>
              )}
            </label>
            <div className="search-wrapper">
              <input
                id="participant"
                type="text"
                placeholder={selectedSubCommittee ? 'Search participant...' : 'Select a sub-committee first'}
                value={searchText}
                onChange={e => { setSearchText(e.target.value); setSelectedParticipant(null); setShowDropdown(true); }}
                onFocus={() => { if (selectedSubCommittee) setShowDropdown(true); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                disabled={!selectedSubCommittee}
                className={`input ${selectedParticipant ? 'input-selected' : ''}`}
                autoComplete="off"
              />
              {showDropdown && filteredParticipants.length > 0 && (
                <ul className="dropdown">
                  {filteredParticipants.map(p => (
                    <li
                      key={p.id}
                      className={`dropdown-item ${p.attended ? 'attended' : ''}`}
                      onMouseDown={() => handleSelectParticipant(p)}
                    >
                      <span className="participant-name">{p.name}</span>
                      {p.attended && <span className="attended-badge">✓ Attended</span>}
                    </li>
                  ))}
                </ul>
              )}
              {showDropdown && filteredParticipants.length === 0 && searchText && (
                <div className="dropdown no-results">No participants found</div>
              )}
            </div>
          </div>

          <button
            className="btn-primary"
            onClick={() => setShowConfirm(true)}
            disabled={!selectedParticipant || !selectedSubCommittee || loading}
          >
            Mark Attendance
          </button>
        </div>
      </main>
    </div>
  );
}
