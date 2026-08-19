import { useState, useEffect } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useNavigate } from 'react-router-dom';
const Users = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { askConfirm } = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/auth/users?page=${page}&limit=10`);
      setUsers(response.data.users);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleDelete = async (id) => {
    const ok = await askConfirm('Are you sure you want to delete this user? This action cannot be undone.', 'Delete User');
    if (!ok) return;
    try {
      await api.delete(`/auth/${id}`);
      showToast('User deleted successfully');
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete user', 'error');
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>Users</h2>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="table-wrapper">
            {users.length === 0 ? (
              <p className="empty-text">No users found.</p>
            ) : (
              <table className="users-table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} className="clickable-area" onClick={() => navigate(`/users/${u._id}`)}>
                      <td data-label="Name">
                        <div className="user-cell">
                          <div className="user-avatar-small">{u.name?.charAt(0).toUpperCase()}</div>
                          {u.name}
                        </div>
                      </td>
                      <td data-label="Email">{u.email}</td>
                      <td data-label="Role"><span className={`role-tag ${u.role === 'admin' ? 'role-admin' : 'role-user'}`}>{u.role}</span></td>
                      <td data-label="" onClick={(e) => e.stopPropagation()}>
                         <button className="btn-delete-small" onClick={() => handleDelete(u._id)}>Delete</button>
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {totalPages || 1}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </>
      )}
    </Layout>
  );
};

export default Users;