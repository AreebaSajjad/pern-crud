import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';
import CountdownTimer from '../components/CountdownTimer';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog'; 

const Meetings = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { showToast } = useToast();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
   const { askConfirm } = useConfirm(); 

  const [page, setPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);

const fetchMeetings = async () => {
  setLoading(true);
  try {
    const res = await api.get(`/meetings?page=${page}&limit=10`);
    setMeetings(res.data.meetings);
    setTotalPages(res.data.totalPages);
  } catch (err) {
    showToast('Failed to load meetings', 'error');
  } finally {
    setLoading(false);
  }
};
useEffect(() => {
  fetchMeetings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [page]);
  const handleDelete = async (id) => {
     const ok = await askConfirm('Are you sure you want to cancel this meeting?'); if (!ok) return;
    try {
      await api.delete(`/meetings/${id}`);
      showToast('Meeting cancelled');
      fetchMeetings();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to cancel meeting', 'error');
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeStr) => {
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const now = new Date();
  const filteredMeetings = meetings
    .filter((m) => {
      const meetingTime = new Date(`${m.date}T${m.time}`);
      return tab === 'upcoming' ? meetingTime >= now : meetingTime < now;
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return tab === 'upcoming' ? dateA - dateB : dateB - dateA;
    });

  return (
    <Layout>
      <div className="page-header products-header-row">
        <h2>Meetings</h2>
        {user?.role === 'admin' && (
          <button className="btn-primary btn-add-new" onClick={() => navigate('/meetings/schedule')}>
            + Schedule Meeting
          </button>
        )}
      </div>

      <div className="tabs-row">
        <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Upcoming
        </button>
        <button className={`tab-btn ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
          Past
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : filteredMeetings.length === 0 ? (
        <p className="empty-text">No {tab} meetings.</p>
      ) : (
        <div className="meetings-grid">
          {filteredMeetings.map((m) => (
            <div key={m._id} className="meeting-card">
              <div className="meeting-card-header">
                <h4>{m.title}</h4>
                {tab === 'upcoming' && <CountdownTimer date={m.date} time={m.time} />}
              </div>

              <div className="meeting-card-body">
                <div className="meeting-detail-row">
                  <span className="meeting-icon">👥</span>
                  <span>{m.participants?.map((p) => p.name).join(' & ')}</span>
                </div>
                <div className="meeting-detail-row">
                  <span className="meeting-icon">📅</span>
                  <span>{formatDate(m.date)}</span>
                </div>
                <div className="meeting-detail-row">
                  <span className="meeting-icon">🕐</span>
                  <span>{formatTime(m.time)} • {m.duration} min</span>
                </div>
                <div className="meeting-detail-row">
                  <span className="meeting-icon">{m.mode === 'online' ? '🌐' : '📍'}</span>
                  <span>{m.mode === 'online' ? m.link : m.location}</span>
                </div>
                {user?.role !== 'admin' && (
                  <div className="meeting-detail-row">
                    <span className="meeting-icon">👤</span>
                    <span>Scheduled by: {m.createdBy?.name || 'Admin'}</span>
                  </div>
                )}
              </div>
              {tab === 'upcoming' && user?.role === 'admin' && (
                <div className="meeting-card-actions">
                  <button className="btn-edit" onClick={() => navigate(`/meetings/edit/${m._id}`)}>Edit</button>
                  <button className="btn-delete" onClick={() => handleDelete(m._id)}>Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!loading && meetings.length > 0 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {totalPages || 1}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </Layout>
  );
};

export default Meetings;