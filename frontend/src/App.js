import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API = '';

export default function App() {
  const [subCommittees, setSubCommittees] = useState([]);
  const [selectedSubCommittee, setSelectedSubCommittee] = useState('');
  const [participants, setParticipants] = useState([]);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [attendanceLog, setAttendanceLog] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);

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

  useEffect(() => {
    fetch(`${API}/api/attendance`)
      .then(r => r.json())
      .then(setAttendanceLog)
      .catch(() => {});
  }, []);

  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleMarkAttendance = async () => {
    if (!selectedParticipant || !selectedSubCommittee) {
      showToast('Please select a sub-committee and a participant.', 'error');
      return;
    }
    setLoading(true);
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
        setParticipants(prev =>
          prev.map(p => p.name === selectedParticipant.name ? { ...p, attended: true } : p)
        );
        setAttendanceLog(prev => [data, ...prev]);
        setSelectedParticipant(null);
        setSearchText('');
        showToast(`Attendance marked for ${data.participantName}!`);
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

  const handleSearchFocus = () => {
    if (selectedSubCommittee) setShowDropdown(true);
  };

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    setSelectedParticipant(null);
    setShowDropdown(true);
  };

  const attendedCount = participants.filter(p => p.attended).length;

  return (
    <div className="app">
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      <header className="header">
        <div className="header-content">
          <h1>Volunteer Appreciation</h1>
          <p>Mark Attendance</p>
        </div>
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

          <div className="form-group" ref={searchRef}>
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
                onChange={handleSearchChange}
                onFocus={handleSearchFocus}
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
            onClick={handleMarkAttendance}
            disabled={!selectedParticipant || !selectedSubCommittee || loading}
          >
            {loading ? 'Marking...' : 'Mark Attendance'}
          </button>
        </div>

        {attendanceLog.length > 0 && (
          <div className="card">
            <h2 className="card-title">Attendance Log</h2>
            <div className="log-table-wrapper">
              <table className="log-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Sub-Committee</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLog.map((a, i) => (
                    <tr key={a.id}>
                      <td>{i + 1}</td>
                      <td>{a.participantName}</td>
                      <td>{a.subCommittee}</td>
                      <td>{new Date(a.markedAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
