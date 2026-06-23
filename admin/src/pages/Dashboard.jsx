import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Users,
  Database,
  History,
  PlusCircle,
  Play,
  UserCheck,
  UserX,
  Clock,
  Loader,
  AlertCircle,
  ShieldCheck,
  Search,
  XCircle,
  Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const formatDateDMY = (dateInput) => {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const Dashboard = ({ activeTab, setActiveTab }) => {
  const { user: currentUser } = useAuth();
  const [usersList, setUsersList] = useState([]);
  const [backupsList, setBackupsList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logsCount, setLogsCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [logSearch, setLogSearch] = useState('');

  // Add User Form state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    mobile: '',
    email: '',
    password: '',
    role: 'User'
  });

  // Edit User Form state
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editUser, setEditUser] = useState({
    id: '',
    name: '',
    mobile: '',
    email: '',
    role: 'User',
    password: ''
  });

  const fetchData = async (clearAlerts = false) => {
    setLoading(true);
    if (clearAlerts) {
      setError('');
      setSuccessMsg('');
    }
    try {
      if (activeTab === 'users') {
        const res = await api.get('/users');
        setUsersList(res.data);
      } else if (activeTab === 'backups') {
        const res = await api.get('/admin/backups');
        setBackupsList(res.data);
      } else if (activeTab === 'logs') {
        const res = await api.get('/admin/audit-logs');
        setAuditLogs(res.data.logs);
        setLogsCount(res.data.total);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load console data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, [activeTab]);

  // Handle Add User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setActionLoading(true);
    try {
      await api.post('/users', newUser);
      setSuccessMsg(`User account for ${newUser.name} created successfully!`);
      setNewUser({ name: '', mobile: '', email: '', password: '', role: 'User' });
      setIsAddUserOpen(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user account.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Update User
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setError('');
    setActionLoading(true);
    try {
      const payload = {
        name: editUser.name,
        mobile: editUser.mobile,
        email: editUser.email,
        role: editUser.role
      };
      if (editUser.password) {
        payload.password = editUser.password;
      }
      await api.put(`/users/${editUser.id}`, payload);
      setSuccessMsg(`User account for ${editUser.name} updated successfully!`);
      setIsEditUserOpen(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user account.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle user active status
  const handleToggleUserStatus = async (userObj) => {
    setError('');
    setSuccessMsg('');
    try {
      await api.put(`/users/${userObj.id}`, { active: !userObj.active });
      setSuccessMsg(`Account status of user ${userObj.name} updated successfully.`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle account status.');
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (userObj) => {
    if (userObj.id === currentUser?.id) {
      setError('You cannot delete your own account.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete user "${userObj.name}"?`)) {
      return;
    }
    setError('');
    setSuccessMsg('');
    try {
      await api.delete(`/users/${userObj.id}`);
      setSuccessMsg(`User account for ${userObj.name} deleted successfully.`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user account.');
    }
  };

  // Handle database backup trigger
  const handleBackupDB = async () => {
    setError('');
    setSuccessMsg('');
    setActionLoading(true);
    try {
      const res = await api.post('/admin/backup');
      setSuccessMsg(`Database dump generated successfully: ${res.data.fileName}`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Backup operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle database restore trigger
  const handleRestoreDB = async (fileName) => {
    if (!window.confirm(`CRITICAL WARNING: Restoring the database to file "${fileName}" will overwrite current data. Continue?`)) return;
    
    setError('');
    setSuccessMsg('');
    setActionLoading(true);
    try {
      await api.post('/admin/restore', { fileName });
      setSuccessMsg('Database restored successfully from backup!');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Restore operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredLogs = auditLogs.filter(log => 
    (log.user_name || '').toLowerCase().includes(logSearch.toLowerCase()) ||
    (log.action || '').toLowerCase().includes(logSearch.toLowerCase()) ||
    (log.details || '').toLowerCase().includes(logSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Add Option */}
      <div className="flex justify-between items-center bg-indigo-950 p-6 rounded-2xl text-white shadow-md">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-indigo-400" />
          <div>
            <h1 className="text-xl font-bold">System Administration Panel</h1>
            <p className="text-xs text-indigo-300">Isolated console for backup services & users CRUD</p>
          </div>
        </div>
        
        {activeTab === 'users' && (
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-indigo-950 px-4 py-2.5 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New User</span>
          </button>
        )}
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 rounded-r-xl flex items-center gap-2 text-xs font-bold animate-fade-in">
          <Clock className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-800 rounded-r-xl flex items-center gap-2 text-xs font-bold animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* RESTORING PROGRESS BAR */}
      {actionLoading && (
        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl flex items-center justify-center gap-3 text-indigo-900 font-bold animate-pulse text-sm">
          <Loader className="w-4 h-4 animate-spin" />
          <span>Executing system commands. Please do not close this window...</span>
        </div>
      )}

      {/* Main tables and control UI */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activeTab === 'users' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  <th className="px-6 py-4 whitespace-nowrap">Name</th>
                  <th className="px-6 py-4 whitespace-nowrap">Mobile Number</th>
                  <th className="px-6 py-4 whitespace-nowrap">Email</th>
                  <th className="px-6 py-4 whitespace-nowrap">Role</th>
                  <th className="px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                {usersList.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">{u.name}</td>
                    <td className="px-6 py-4 text-indigo-600 font-bold whitespace-nowrap">{u.mobile}</td>
                    <td className="px-6 py-4 font-normal text-slate-500 whitespace-nowrap">{u.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${u.role === 'Admin' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {u.active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditUser({
                            id: u.id,
                            name: u.name,
                            mobile: u.mobile,
                            email: u.email || '',
                            role: u.role,
                            password: ''
                          });
                          setIsEditUserOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleUserStatus(u)}
                        disabled={u.id === currentUser?.id}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          u.id === currentUser?.id
                            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                            : u.active
                            ? 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100'
                            : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'
                        }`}
                        title={u.id === currentUser?.id ? 'You cannot deactivate your own account' : ''}
                      >
                        {u.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        <span>{u.active ? 'Deactivate' : 'Activate'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={u.id === currentUser?.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          u.id === currentUser?.id
                            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white'
                        }`}
                        title={u.id === currentUser?.id ? 'You cannot delete your own account' : ''}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'backups' ? (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h4 className="font-bold text-slate-800 text-base">PostgreSQL Database Backups</h4>
                <p className="text-xs text-slate-400">Backups are stored inside backend backups directory</p>
              </div>
              <button
                onClick={handleBackupDB}
                disabled={actionLoading}
                className="bg-indigo-950 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl transition-all text-xs shadow-md flex items-center gap-1"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Backup Database</span>
              </button>
            </div>

            <div className="border border-slate-100 rounded-xl overflow-hidden">
              {backupsList.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-medium">
                  No dump backup files found. Click button to generate first backup!
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      <th className="px-6 py-3.5 whitespace-nowrap">Backup File Name</th>
                      <th className="px-6 py-3.5 whitespace-nowrap">Size</th>
                      <th className="px-6 py-3.5 whitespace-nowrap">Created At</th>
                      <th className="px-6 py-3.5 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {backupsList.map(b => (
                      <tr key={b.fileName}>
                        <td className="px-6 py-3.5 text-indigo-600 whitespace-nowrap">{b.fileName}</td>
                        <td className="px-6 py-3.5 whitespace-nowrap">{(b.size / 1024).toFixed(2)} KB</td>
                        <td className="px-6 py-3.5 text-slate-400 text-xs font-normal whitespace-nowrap">
                          {formatDateDMY(b.createdAt)}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            onClick={() => handleRestoreDB(b.fileName)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-all font-bold"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="relative max-w-xs w-full">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Search logs..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                />
              </div>
              <span className="text-xs text-slate-400 font-bold">Total Logs: {logsCount}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    <th className="px-6 py-4 whitespace-nowrap">Timestamp</th>
                    <th className="px-6 py-4 whitespace-nowrap">Operator</th>
                    <th className="px-6 py-4 whitespace-nowrap">Action</th>
                    <th className="px-6 py-4 whitespace-nowrap">Details</th>
                    <th className="px-6 py-4 whitespace-nowrap">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                  {filteredLogs.map(log => (
                    <tr key={log.log_id} className="hover:bg-slate-50/20 text-slate-700">
                      <td className="px-6 py-4 text-xs font-normal text-slate-400 whitespace-nowrap">
                        {formatDateDMY(log.created_at)}
                      </td>
                      <td className="px-6 py-4 font-bold whitespace-nowrap">{log.user_name || 'System'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-xs font-bold text-indigo-700 uppercase">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-normal text-xs text-slate-600 max-w-[300px] truncate" title={log.details}>
                        {log.details || '-'}
                      </td>
                      <td className="px-6 py-4 text-xs font-normal text-slate-400">{log.ip_address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* CREATE USER ACC MODAL */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-100 animate-slide-up space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900">Create Operator/Admin User</h3>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Phone Number (Login ID)</label>
                <input
                  type="tel"
                  required
                  value={newUser.mobile}
                  onChange={(e) => setNewUser(prev => ({ ...prev, mobile: e.target.value }))}
                  placeholder="10-digit mobile number"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter operator's name"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Password</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Role Type</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none bg-white font-medium text-slate-700"
                  >
                    <option value="User">User / Operator</option>
                    <option value="Admin">Admin / Developer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="operator@threadtrack.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none text-slate-700 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all text-xs"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER ACC MODAL */}
      {isEditUserOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-100 animate-slide-up space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900">Edit User Details</h3>
              <button
                onClick={() => setIsEditUserOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Phone Number (Login ID)</label>
                <input
                  type="tel"
                  required
                  value={editUser.mobile}
                  onChange={(e) => setEditUser(prev => ({ ...prev, mobile: e.target.value }))}
                  placeholder="10-digit mobile number"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  value={editUser.name}
                  onChange={(e) => setEditUser(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter operator's name"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">New Password (Leave blank to keep current)</label>
                <input
                  type="password"
                  value={editUser.password}
                  onChange={(e) => setEditUser(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Role Type</label>
                  <select
                    value={editUser.role}
                    onChange={(e) => setEditUser(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none bg-white font-medium text-slate-700"
                  >
                    <option value="User">User / Operator</option>
                    <option value="Admin">Admin / Developer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={editUser.email}
                    onChange={(e) => setEditUser(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="operator@threadtrack.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none text-slate-700 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditUserOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all text-xs"
                >
                  Update Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
