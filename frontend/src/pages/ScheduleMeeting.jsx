import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import TimeSlotPicker from '../components/TimeSlotPicker';
import { getBookedSlotsForParticipants } from '../utils/meetingHelpers';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

const ScheduleMeeting = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useSelector((state) => state.auth);

  const [users, setUsers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [participant1, setParticipant1] = useState(user?.id || '');
  const [participant2, setParticipant2] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [mode, setMode] = useState('online');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersRes = await api.get('/auth/users');
        setUsers(usersRes.data.users);

        const meetingsRes = await api.get('/meetings');
        setMeetings(meetingsRes.data.meetings);
      } catch (err) {
        setError('Failed to load data');
      }
    };
    fetchData();
  }, []);

  const selectedParticipantIds = [participant1, participant2].filter(Boolean);

  const bookedTimesForDate = date && selectedParticipantIds.length > 0
    ? getBookedSlotsForParticipants(meetings, date, selectedParticipantIds)
    : [];

  const validate = () => {
    const errs = {};
    if (!participant1) errs.participant1 = 'Please select participant 1';
    if (!participant2) errs.participant2 = 'Please select participant 2';
    if (participant1 && participant2 && participant1 === participant2) {
      errs.participant2 = 'Participants must be different';
    }
    if (!title.trim()) errs.title = 'Title is required';
    if (!date) errs.date = 'Date is required';
    if (!time) errs.time = 'Time is required';
    if (mode === 'physical' && !location.trim()) errs.location = 'Location is required';
    if (mode === 'online' && !link.trim()) errs.link = 'Meeting link is required';
    return errs;
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    setError('');
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      await api.post('/meetings', {
        participants: [participant1, participant2],
        title,
        date,
        time,
        duration,
        mode,
        location: mode === 'physical' ? location : undefined,
        link: mode === 'online' ? link : undefined,
      });
      showToast('Meeting scheduled successfully');
      navigate('/meetings');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule meeting');
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>Schedule Meeting</h2>
      </div>
      {error && <p className="error-text">{error}</p>}

      <form onSubmit={handleSchedule} className="product-form edit-form">
        <div className="form-group">
          <label>Participant 1</label>
          <select value={participant1} onChange={(e) => { setParticipant1(e.target.value); setTime(''); }} className="select-input">
            <option value="">-- Select user --</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>{u.name} ({u.email}){u._id === user?.id ? ' — You' : ''}</option>
            ))}
          </select>
          {fieldErrors.participant1 && <span className="field-error">{fieldErrors.participant1}</span>}
        </div>

        <div className="form-group">
          <label>Participant 2</label>
          <select value={participant2} onChange={(e) => { setParticipant2(e.target.value); setTime(''); }} className="select-input">
            <option value="">-- Select user --</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>{u.name} ({u.email}){u._id === user?.id ? ' — You' : ''}</option>
            ))}
          </select>
          {fieldErrors.participant2 && <span className="field-error">{fieldErrors.participant2}</span>}
        </div>

        <div className="form-group">
          <label>Meeting Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Project Discussion" />
          {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
        </div>

        <div className="form-group">
          <label>Duration</label>
          <select value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setTime(''); }} className="select-input">
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>{d} minutes</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Meeting Mode</label>
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${mode === 'online' ? 'active' : ''}`}
              onClick={() => setMode('online')}
            >
              🌐 Online
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'physical' ? 'active' : ''}`}
              onClick={() => setMode('physical')}
            >
              📍 Physical
            </button>
          </div>
        </div>

        {mode === 'online' ? (
          <div className="form-group">
            <label>Meeting Link</label>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="e.g. https://meet.google.com/xyz" />
            {fieldErrors.link && <span className="field-error">{fieldErrors.link}</span>}
          </div>
        ) : (
          <div className="form-group">
            <label>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Conference Room A, 3rd Floor" />
            {fieldErrors.location && <span className="field-error">{fieldErrors.location}</span>}
          </div>
        )}

        <div className="form-group">
          <label>Date</label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => { setDate(e.target.value); setTime(''); }}
          />
          {fieldErrors.date && <span className="field-error">{fieldErrors.date}</span>}
        </div>

        <div className="form-group">
          <label>Time</label>
          <TimeSlotPicker value={time} onChange={setTime} bookedTimes={bookedTimesForDate} />
          {fieldErrors.time && <span className="field-error">{fieldErrors.time}</span>}
          {selectedParticipantIds.length < 2 && (
            <span className="file-hint">Select both participants first to check availability</span>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">Schedule Meeting</button>
          <button type="button" className="btn-cancel" onClick={() => navigate('/meetings')}>Cancel</button>
        </div>
      </form>
    </Layout>
  );
};

export default ScheduleMeeting;