import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import stateDistricts from '../Data.json';
import { LogOut } from 'lucide-react';
import NotFound from './NotFound';
import { Link } from 'react-router-dom';

export default function Admin() {
  const [posts, setPosts] = useState<any[]>([]);
  const { user, loading, logout } = useAuth();

  const [telegramChannelName, setTelegramChannelName] = useState('');
  const [telegramBotTokens, setTelegramBotTokens] = useState<string[]>(['']);
  const [telegramChannelId, setTelegramChannelId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | ''>('');

  // Telegram Chat Auto-Detection States
  const [detectedChats, setDetectedChats] = useState<any[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState('');
  const [hasAttemptedDetect, setHasAttemptedDetect] = useState(false);

  // Regional Storage Managers States
  const [managers, setManagers] = useState<any[]>([]);
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerState, setNewManagerState] = useState('');
  const [newManagerCity, setNewManagerCity] = useState('');
  const [newManagerTokens, setNewManagerTokens] = useState<string[]>(['']);
  const [newManagerChannelId, setNewManagerChannelId] = useState('');
  const [isAddingManager, setIsAddingManager] = useState(false);
  
  // Detection for New Manager
  const [detectedNewChats, setDetectedNewChats] = useState<any[]>([]);
  const [isDetectingNewManager, setIsDetectingNewManager] = useState(false);
  const [detectNewError, setDetectNewError] = useState('');
  const [activeTab, setActiveTab] = useState<'approvals' | 'settings' | 'managers' | 'regional_admins' | 'analytics' | 'users' | 'videos' | 'audit_logs' | 'system_logs' | 'pfp_settings' | 'system_settings' | 'reports' | 'escalated_reviews'>('analytics');
  const [previewPost, setPreviewPost] = useState<any | null>(null);

  // Regional Admins States
  const [regionalAdmins, setRegionalAdmins] = useState<any[]>([]);
  const [newRegionalEmail, setNewRegionalEmail] = useState('');
  const [newRegionalState, setNewRegionalState] = useState('');
  const [newRegionalCity, setNewRegionalCity] = useState('');
  const [moderatorPincode, setModeratorPincode] = useState('');
  const [isAddingRegional, setIsAddingRegional] = useState(false);
  const [detectedRegion, setDetectedRegion] = useState<{ state: string; city: string } | null>(null);

  // Analytics States
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // User Management States
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [activeUserDropdown, setActiveUserDropdown] = useState<string | null>(null);

  // Video Management States
  const [verifiedPosts, setVerifiedPosts] = useState<any[]>([]);
  const [videoSearch, setVideoSearch] = useState('');
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);

  // Approvals Batch Selection
  const [selectedApprovals, setSelectedApprovals] = useState<string[]>([]);

  // Audit Logs States
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // System Logs States
  const [systemLogFile, setSystemLogFile] = useState<'global_error' | 'crash' | 'pfp_error'>('global_error');
  const [systemLogContent, setSystemLogContent] = useState('');
  const [isLoadingSystemLog, setIsLoadingSystemLog] = useState(false);
  // System Settings States
  const [dailyUploadLimit, setDailyUploadLimit] = useState<number>(3);
  const [isSavingSystemSettings, setIsSavingSystemSettings] = useState(false);
  const [systemSaveStatus, setSystemSaveStatus] = useState<'success' | 'error' | ''>('');

  const [reports, setReports] = useState<any[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  const [escalatedReviews, setEscalatedReviews] = useState<any[]>([]);
  const [isLoadingEscalated, setIsLoadingEscalated] = useState(false);

  const [moderatorLogs, setModeratorLogs] = useState<any[]>([]);
  const [isLoadingModeratorLogs, setIsLoadingModeratorLogs] = useState(false);

  // Modal States
  const [rejectModalState, setRejectModalState] = useState<{isOpen: boolean, postId: string | null}>({isOpen: false, postId: null});
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  
  const [systemWarningModal, setSystemWarningModal] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [reasonModal, setReasonModal] = useState<{isOpen: boolean, reason: string | null}>({isOpen: false, reason: null});
  const [videoPreviewModal, setVideoPreviewModal] = useState<{isOpen: boolean, videoUrl: string | null}>({isOpen: false, videoUrl: null});

  const fetchModeratorLogs = async () => {
    setIsLoadingModeratorLogs(true);
    try {
      const res = await axios.get('/api/admin/moderator-logs');
      if (res.data.success) {
        setModeratorLogs(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch moderator logs", err);
    } finally {
      setIsLoadingModeratorLogs(false);
    }
  };

  const fetchEscalatedReviews = async () => {
    setIsLoadingEscalated(true);
    try {
      const res = await axios.get('/api/admin/escalated');
      if (res.data.success) {
        setEscalatedReviews(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch escalated reviews", err);
    } finally {
      setIsLoadingEscalated(false);
    }
  };

  const handleEscalatedAction = async (postId: string, action: 'confirm_rejection' | 'overturn_rejection') => {
    if (!window.confirm(`Are you sure you want to ${action.replace('_', ' ')}?`)) return;
    try {
      const res = await axios.post(`/api/admin/escalated/${postId}/action`, { action });
      if (res.data.success) {
        setEscalatedReviews(prev => prev.filter(p => p.id !== postId));
      }
    } catch (err) {
      alert("Failed to process escalated review action");
    }
  };

  const fetchReports = async () => {
    setIsLoadingReports(true);
    try {
      const res = await axios.get('/api/admin/reports');
      if (res.data.success) {
        setReports(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch reports", err);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleReportAction = async (reportId: string, action: 'dismiss' | 'delete_post') => {
    if (action === 'delete_post') {
      if (!window.confirm("Are you sure you want to delete this video and dismiss the report? This cannot be undone.")) return;
    }
    try {
      const res = await axios.post(`/api/admin/reports/${reportId}/action`, { action });
      if (res.data.success) {
        setReports(prev => prev.filter(r => r.id !== reportId));
        if (action === 'delete_post') {
          fetchAnalytics(); // Refresh analytics if a post was deleted
        }
      }
    } catch (err) {
      alert('Failed to process report action');
    }
  };

  const newManagerDistricts = newManagerState ? (stateDistricts as any)[newManagerState] || [] : [];
  const newRegionalDistricts = newRegionalState ? (stateDistricts as any)[newRegionalState] || [] : [];

  const fetchAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const res = await axios.get('/api/admin/analytics');
      if (res.data.success) {
        setAnalyticsData(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics", err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const fetchUsers = async (searchVal = '') => {
    setIsLoadingUsers(true);
    try {
      const res = await axios.get(`/api/admin/users?search=${encodeURIComponent(searchVal)}`);
      if (res.data.success) {
        setUsers(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchVerifiedPosts = async (searchVal = '') => {
    setIsLoadingVideos(true);
    try {
      const res = await axios.get(`/api/admin/posts-all?search=${encodeURIComponent(searchVal)}`);
      if (res.data.success) {
        setVerifiedPosts(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch verified posts", err);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  const fetchAuditLogs = async (searchVal = '', pg = 1) => {
    setIsLoadingAudit(true);
    try {
      const res = await axios.get(`/api/admin/audit-logs?search=${encodeURIComponent(searchVal)}&page=${pg}`);
      if (res.data.success) {
        setAuditLogs(res.data.data || []);
        setAuditTotalPages(res.data.pages || 1);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs", err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const fetchSystemLogs = async (fileKey: string) => {
    setIsLoadingSystemLog(true);
    try {
      const res = await axios.get(`/api/admin/logs?logFile=${fileKey}`);
      if (res.data.success) {
        setSystemLogContent(res.data.content || '');
      }
    } catch (err) {
      console.error("Failed to fetch system logs", err);
    } finally {
      setIsLoadingSystemLog(false);
    }
  };

  const fetchApprovals = () => {
    axios.get('/api/posts')
      .then(res => {
        setPosts(res.data.data || []);
        setDetectedRegion(res.data.detected_region || null);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'moderator')) {
      if (activeTab === 'approvals') {
        fetchApprovals();
      }
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (user && user.role === 'admin') {
      if (activeTab === 'analytics') {
        fetchAnalytics();
      } else if (activeTab === 'users') {
        fetchUsers(userSearch);
      } else if (activeTab === 'videos') {
        fetchVerifiedPosts(videoSearch);
      } else if (activeTab === 'audit_logs') {
        fetchAuditLogs(auditSearch, auditPage);
      } else if (activeTab === 'system_logs') {
        fetchSystemLogs(systemLogFile);
      } else if (activeTab === 'escalated_reviews') {
        fetchEscalatedReviews();
      } else if (activeTab === 'moderator_logs') {
        fetchModeratorLogs();
      }
    }
  }, [user, activeTab, auditPage, systemLogFile]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    console.log("[SSE] Connecting to admin events channel...");
    const eventSource = new EventSource('/api/admin/events');

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log(`[SSE] Received event: ${payload.event}`, payload.data);
        
        if (payload.event === 'post_uploaded' || payload.event === 'posts_updated') {
          if (activeTab === 'approvals') fetchApprovals();
          if (activeTab === 'analytics') fetchAnalytics();
          if (activeTab === 'videos') fetchVerifiedPosts(videoSearch);
        } else if (payload.event === 'users_updated') {
          if (activeTab === 'users') fetchUsers(userSearch);
          if (activeTab === 'analytics') fetchAnalytics();
        } else if (payload.event === 'audit_log') {
          if (activeTab === 'audit_logs') fetchAuditLogs(auditSearch, auditPage);
        }
      } catch (e) {
        console.error("[SSE] Error parsing event payload:", e);
      }
    };

    eventSource.onerror = (err) => {
      console.error("[SSE] Connection error:", err);
      eventSource.close();
    };

    return () => {
      console.log("[SSE] Closing connection...");
      eventSource.close();
    };
  }, [user, activeTab, userSearch, videoSearch, auditSearch, auditPage, systemLogFile]);

  useEffect(() => {
    if (activeTab === 'reports' && user && (user.role === 'admin' || user.role === 'moderator')) {
      fetchReports();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (user && user.role === 'admin') {
      axios.get('/api/admin/storage-managers')
        .then(res => setManagers(res.data.data || []))
        .catch(err => console.error("Failed to load storage managers", err));

      axios.get('/api/admin/pfp-storage-config')
        .then(res => {
          setTelegramChannelName(res.data.data.storage_name || '');
          setTelegramBotTokens(res.data.data.storage_tokens?.length ? res.data.data.storage_tokens : ['']);
          setTelegramChannelId(res.data.data.storage_id || '');
        })
        .catch(err => console.error("Failed to load PFP config", err));

      axios.get('/api/admin/regional-admins')
        .then(res => setRegionalAdmins(res.data.data || []))
        .catch(err => console.error("Failed to load regional admins", err));

      axios.get('/api/admin/system-settings')
        .then(res => {
          if (res.data.data && res.data.data.daily_upload_limit !== undefined) {
            setDailyUploadLimit(res.data.data.daily_upload_limit);
          }
        })
        .catch(err => console.error("Failed to load system settings", err));
    }
  }, [user]);

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSystemSettings(true);
    setSystemSaveStatus('');
    try {
      await axios.post('/api/admin/system-settings', {
        daily_upload_limit: dailyUploadLimit
      });
      setSystemSaveStatus('success');
      setTimeout(() => setSystemSaveStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setSystemSaveStatus('error');
    } finally {
      setIsSavingSystemSettings(false);
    }
  };

  const handleSavePFPConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus('');
    try {
      await axios.post('/api/admin/pfp-storage-config', {
        storage_name: telegramChannelName,
        storage_id: telegramChannelId,
        storage_tokens: telegramBotTokens,
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDetectPFPChatId = async () => {
    setIsDetecting(true);
    setDetectError('');
    setDetectedChats([]);
    setHasAttemptedDetect(true);
    try {
      const tokenQuery = telegramBotTokens[0] ? `?token=${encodeURIComponent(telegramBotTokens[0].trim())}` : '';
      const res = await axios.get(`/api/admin/detect-chat-id${tokenQuery}`);
      if (res.data.success) {
        setDetectedChats(res.data.chats || []);
      }
    } catch (err: any) {
      console.error(err);
      setDetectError(err.response?.data?.detail || err.message || 'Failed to detect chats.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleDetectNewManagerChatId = async () => {
    setIsDetectingNewManager(true);
    setDetectNewError('');
    setDetectedNewChats([]);
    try {
      const res = await axios.get(`/api/admin/detect-chat-id?token=${encodeURIComponent((newManagerTokens[0] || '').trim())}`);
      if (res.data.success) {
        setDetectedNewChats(res.data.chats || []);
      }
    } catch (err: any) {
      console.error(err);
      setDetectNewError(err.response?.data?.detail || err.message || 'Failed to detect chats.');
    } finally {
      setIsDetectingNewManager(false);
    }
  };

  const handleAddManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingManager(true);
    try {
      const res = await axios.post('/api/admin/storage-managers', {
        name: newManagerName,
        state: newManagerState,
        city: newManagerCity,
        storage_tokens: newManagerTokens,
        storage_id: newManagerChannelId,
      });
      if (res.data.success) {
        setManagers(prev => [...prev, res.data.data]);
        setNewManagerName('');
        setNewManagerState('');
        setNewManagerCity('');
        setNewManagerTokens(['']);
        setNewManagerChannelId('');
        setDetectedNewChats([]);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add manager.');
    } finally {
      setIsAddingManager(false);
    }
  };

  const handleDeleteManager = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this storage manager?")) return;
    try {
      await axios.delete(`/api/admin/storage-managers/${id}`);
      setManagers(prev => prev.filter(m => m._id !== id));
    } catch (err) {
      alert('Failed to delete manager.');
    }
  };

  const handleAddRegionalAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingRegional(true);
    try {
      const res = await axios.post('/api/admin/regional-admins', {
        email: newRegionalEmail,
        state: newRegionalState,
        city: newRegionalCity,
      });
      if (res.data.success) {
        setRegionalAdmins(prev => [...prev, res.data.data]);
        setNewRegionalEmail('');
        setNewRegionalState('');
        setNewRegionalCity('');
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add regional admin.');
    } finally {
      setIsAddingRegional(false);
    }
  };

  const handleDeleteRegionalAdmin = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this regional admin assignment?")) return;
    try {
      await axios.delete(`/api/admin/regional-admins/${id}`);
      setRegionalAdmins(prev => prev.filter(a => a._id !== id));
    } catch (err) {
      alert('Failed to delete regional admin.');
    }
  };

  const handleAction = async (postId: string, action: 'verify' | 'reject') => {
    if (action === 'reject') {
        setRejectModalState({ isOpen: true, postId });
        return;
    }
    
    try {
      await axios.post(`/api/posts?action=${action}`, { post_id: postId });
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch (err: any) {
      setSystemWarningModal({ isOpen: true, message: err.response?.data?.message || err.response?.data?.detail || 'Failed to update post' });
    }
  };

  const submitRejection = async () => {
      if (!rejectModalState.postId) return;
      if (rejectReasonInput.trim() === '') {
          alert("Reason is required."); // Wait, could use another modal but alert is fine for empty validation, or better yet, disabled button.
          return;
      }
      
      const postId = rejectModalState.postId;
      const reason = rejectReasonInput.trim();
      setRejectModalState({ isOpen: false, postId: null });
      setRejectReasonInput('');
      
      try {
        const res = await axios.post(`/api/posts?action=reject`, { post_id: postId, reason });
        setPosts(prev => prev.filter(p => p._id !== postId));
        
        if (res.data.message && res.data.message.includes("suspicious")) {
            setSystemWarningModal({ isOpen: true, message: "Our system detected an insufficient or suspicious reason. I have forwarded your rejection request for Admin review. If an admin finds your reason invalid, they may issue a strike or ban your account." });
        }
      } catch (err: any) {
        setSystemWarningModal({ isOpen: true, message: err.response?.data?.message || err.response?.data?.detail || 'Failed to reject post' });
      }
  };

  const handleAssignArea = async () => {
    if (!newRegionalState || !newRegionalCity || !moderatorPincode) {
      alert("Please fill in all fields.");
      return;
    }
    try {
      const res = await axios.post('/api/moderation/assign-area', {
        state: newRegionalState,
        city: newRegionalCity,
        pincode: moderatorPincode
      });
      if (res.data.success) {
        alert("Area assigned successfully.");
        window.location.reload(); // Quick way to refresh AuthContext state
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to assign area");
    }
  };

  const handleUserAction = async (userId: string, action: string) => {
    try {
      const res = await axios.post(`/api/admin/users/${userId}/action`, { action });
      if (res.data.success) {
        fetchUsers(userSearch);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to perform action");
    }
  };

  const handleBulkUserAction = async (action: string) => {
    try {
      const res = await axios.post(`/api/admin/users/bulk-action`, { userIds: selectedUsers, action });
      if (res.data.success) {
        fetchUsers(userSearch);
        setSelectedUsers([]);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to perform bulk action");
    }
  };

  const handleDeleteUser = async (targetId: string, targetUsername: string) => {
    const confirmation = window.confirm(`WARNING: Are you sure you want to delete user @${targetUsername}? This will recursively delete all of their videos, local cached files, profile photo, and regional admin assignments. This action is IRREVERSIBLE!`);
    if (!confirmation) return;

    setIsDeletingUser(targetId);
    try {
      const res = await axios.delete(`/api/admin/users/${targetId}`);
      if (res.data.success) {
        alert(res.data.message || "User deleted successfully");
        setUsers(prev => prev.filter(u => u.id !== targetId));
        fetchAnalytics().catch(() => {});
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete user");
    } finally {
      setIsDeletingUser(null);
    }
  };

  const handleDeleteVideo = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this verified video? This will delete it from the database, the local VPS cache, and the offsite cloud storage. This action cannot be undone.")) return;
    try {
      const res = await axios.delete(`/api/posts/${postId}`);
      if (res.data.success) {
        setVerifiedPosts(prev => prev.filter(p => p._id !== postId));
        alert("Video deleted successfully");
        fetchAnalytics().catch(() => {});
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete video");
    }
  };

  const handleBatchPostAction = async (action: 'verify' | 'reject' | 'delete') => {
    const list = action === 'delete' ? selectedVideos : selectedApprovals;
    if (list.length === 0) return;
    if (!window.confirm(`Are you sure you want to perform bulk "${action}" on ${list.length} selected post(s)?`)) return;
    
    try {
      const res = await axios.post('/api/admin/posts/batch-action', { action, post_ids: list });
      if (res.data.success) {
        alert(res.data.message);
        if (action === 'verify' || action === 'reject') {
          setSelectedApprovals([]);
          fetchApprovals();
        } else if (action === 'delete') {
          setSelectedVideos([]);
          fetchVerifiedPosts(videoSearch);
        }
        fetchAnalytics().catch(() => {});
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Batch action failed");
    }
  };

  const handleBatchUserDelete = async () => {
    if (selectedUsers.length === 0) return;
    if (!window.confirm(`WARNING: Are you sure you want to recursively delete ${selectedUsers.length} selected user(s) and all their associated files, posts, and data? This action is IRREVERSIBLE!`)) return;

    try {
      const res = await axios.post('/api/admin/users/batch-delete', { user_ids: selectedUsers });
      if (res.data.success) {
        alert(res.data.message);
        setSelectedUsers([]);
        fetchUsers(userSearch);
        fetchAnalytics().catch(() => {});
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Batch user deletion failed");
    }
  };

  const isAuthorized = user && (user.role === 'admin' || user.role === 'moderator');

  if (loading) {
    return <div className="text-center py-20 text-slate-500 font-medium">Checking authorization...</div>;
  }

  if (!isAuthorized) {
    return <NotFound />;
  }

  return (
    <>
      <div className={`transition-all duration-300 ${previewPost ? 'filter blur-xs pointer-events-none opacity-40' : ''}`}>
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
            {detectedRegion && (
              <p className="text-xs font-semibold text-brand-600 mt-1 flex items-center gap-1">
                📍 Auto-detected region: <span className="capitalize">{detectedRegion.city ? `${detectedRegion.city}, ` : ''}{detectedRegion.state}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-center shadow-sm">
              <div className="text-sm text-slate-500 font-medium">Pending Approvals</div>
              <div className="text-2xl font-bold text-yellow-600">{posts.length}</div>
            </div>
            <button onClick={logout} className="text-sm font-medium text-slate-700 hover:text-red-600 transition-colors bg-white hover:bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg shadow-sm flex items-center gap-2 h-full">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-8 items-start mt-4">
          {/* Local Admin Sidebar */}
          <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-1.5 bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-left">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Admin Navigation</h3>
            
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer ${activeTab === 'analytics' ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                📊 Analytics Dashboard
              </button>
            )}

            <button
              onClick={() => setActiveTab('approvals')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer ${activeTab === 'approvals' ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              📋 Pending Approvals
              {posts.length > 0 && (
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'approvals' ? 'bg-white text-brand-600' : 'bg-yellow-100 text-yellow-800'}`}>
                  {posts.length}
                </span>
              )}
            </button>

            {user?.role === 'admin' && (
              <Link
                to="/admin/ai-blue-teamer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer bg-slate-900 text-indigo-400 hover:bg-slate-800 border border-slate-800 shadow-md"
              >
                🤖 AI Blue Teamer
              </Link>
            )}
            
            {user?.role === 'admin' && (
              <>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer ${activeTab === 'users' ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  👤 Manage Users
                </button>
                <button
                  onClick={() => setActiveTab('videos')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer ${activeTab === 'videos' ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  ▶️ All Videos
                </button>
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer ${activeTab === 'reports' ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  🚨 User Reports
                </button>
                <button
                  onClick={() => setActiveTab('escalated_reviews')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer ${activeTab === 'escalated_reviews' ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  ⚖️ Escalated Reviews
                </button>
                <button
                  onClick={() => setActiveTab('audit_logs')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer ${activeTab === 'audit_logs' ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  🛡️ Audit Logs
                </button>
                <button
                  onClick={() => setActiveTab('moderator_logs')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer ${activeTab === 'moderator_logs' ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  📋 Moderator Logs
                </button>
                <button
                  onClick={() => setActiveTab('system_logs')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer ${activeTab === 'system_logs' ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  💻 System Logs
                </button>

                <button
                  onClick={() => setActiveTab('pfp_settings')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer ${activeTab === 'pfp_settings' ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  ⚙️ PFP Storage Settings
                </button>

                <button
                  onClick={() => setActiveTab('managers')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer ${activeTab === 'managers' ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  👥 Storage Workers
                </button>
                {user?.is_superadmin && (
                  <button
                    onClick={() => setActiveTab('regional_admins')}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer ${activeTab === 'regional_admins' ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    🛡️ Regional Admins
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('system_settings')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left cursor-pointer ${activeTab === 'system_settings' ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  🌐 Global Platform Limits
                </button>
              </>
            )}
          </aside>

        {/* Content Pane */}
        <div className="flex-1 w-full">
          {activeTab === 'approvals' && (
            user?.role === 'moderator' && !user?.moderator_state ? (
              <div className="glass-card rounded-xl p-6 bg-white shadow-sm border border-slate-200 text-left animate-fade-in max-w-lg mx-auto mt-10">
                <h2 className="text-xl font-bold text-slate-800">Assign Moderation Area</h2>
                <p className="text-sm text-slate-500 mt-2 mb-6">You must select a permanent moderation area before you can review videos. This assignment cannot be changed later.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                    <select
                      value={newRegionalState}
                      onChange={(e) => setNewRegionalState(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-slate-200 focus:border-brand-500 outline-none text-sm"
                    >
                      <option value="">Select State</option>
                      {Object.keys(stateDistricts).map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">City/District</label>
                    <select
                      value={newRegionalCity}
                      onChange={(e) => setNewRegionalCity(e.target.value)}
                      disabled={!newRegionalState}
                      className="w-full px-3 py-2 rounded border border-slate-200 focus:border-brand-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">Select District</option>
                      {newRegionalDistricts.map((city: string) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Pincode</label>
                    <input
                      type="text"
                      value={moderatorPincode}
                      onChange={(e) => setModeratorPincode(e.target.value)}
                      placeholder="Enter pincode..."
                      className="w-full px-3 py-2 rounded border border-slate-200 focus:border-brand-500 outline-none text-sm"
                    />
                  </div>
                  <button
                    onClick={handleAssignArea}
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 rounded-lg transition-colors mt-4 text-sm"
                  >
                    Confirm Permanent Assignment
                  </button>
                </div>
              </div>
            ) : (
            <div className="space-y-4">
              {/* Batch Actions Bar */}
              {selectedApprovals.length > 0 && (
                <div className="bg-brand-50 border border-brand-200 px-6 py-4 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="text-xs font-bold text-brand-800">
                    Selected {selectedApprovals.length} item(s) for bulk action
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBatchPostAction('verify')}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-sm shadow-green-500/10"
                    >
                      Approve Selected
                    </button>
                    <button
                      onClick={() => handleBatchPostAction('reject')}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-sm shadow-red-500/10"
                    >
                      Reject Selected
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-medium w-12">
                        <input
                          type="checkbox"
                          checked={posts.length > 0 && selectedApprovals.length === posts.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedApprovals(posts.map(p => p._id));
                            } else {
                              setSelectedApprovals([]);
                            }
                          }}
                          className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-4 font-medium">Post Title</th>
                      <th className="px-6 py-4 font-medium">Author</th>
                      <th className="px-6 py-4 font-medium">Location</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {posts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-semibold">
                          No any video available from region {detectedRegion ? `(${detectedRegion.city ? `${detectedRegion.city.charAt(0).toUpperCase() + detectedRegion.city.slice(1)}, ` : ''}${detectedRegion.state ? detectedRegion.state.charAt(0).toUpperCase() + detectedRegion.state.slice(1) : ''})` : ''}
                        </td>
                      </tr>
                    ) : posts.map(post => (
                      <tr key={post._id} className={`hover:bg-slate-50 ${post.is_flagged ? 'bg-red-50/10' : ''}`}>
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedApprovals.includes(post._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedApprovals(prev => [...prev, post._id]);
                              } else {
                                setSelectedApprovals(prev => prev.filter(id => id !== post._id));
                              }
                            }}
                            className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-left">
                            <button
                              onClick={() => setPreviewPost(post)}
                              className="font-semibold text-slate-800 hover:text-brand-600 block text-left cursor-pointer hover:underline"
                            >
                              {post.title}
                              <span className="text-[10px] text-slate-400 font-normal ml-2 hover:no-underline">(click to preview)</span>
                            </button>
                            {post.is_flagged && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-red-600 font-bold bg-red-50 border border-red-100 px-2 py-0.5 rounded-full mt-1.5 w-fit">
                                ⚠️ Flagged: {post.flag_reason || 'Suspicious upload content'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">@{post.author}</td>
                        <td className="px-6 py-4 capitalize">{post.city}, {post.state}</td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2 items-center">
                          <button onClick={() => handleAction(post._id, 'verify')} className="bg-green-100 text-green-700 hover:bg-green-600 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer">Approve</button>
                          <button onClick={() => handleAction(post._id, 'reject')} className="bg-red-100 text-red-700 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer">Reject</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )
          )}

          {activeTab === 'analytics' && user?.role === 'admin' && (
            <div className="space-y-8 text-left animate-fade-in">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/60 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:scale-[1.01] transition-transform duration-200">
                  <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-blue-500/20">
                    👤
                  </div>
                  <div>
                    <div className="text-xs text-blue-600 font-bold uppercase tracking-wider">Total Users</div>
                    <div className="text-2xl font-bold text-slate-800 mt-0.5">{analyticsData?.summary?.totalUsers ?? '...'}</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/60 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:scale-[1.01] transition-transform duration-200">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-emerald-500/20">
                    🎥
                  </div>
                  <div>
                    <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Verified Videos</div>
                    <div className="text-2xl font-bold text-slate-800 mt-0.5">{analyticsData?.summary?.totalPosts ?? '...'}</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/60 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:scale-[1.01] transition-transform duration-200">
                  <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-amber-500/20">
                    ⏳
                  </div>
                  <div>
                    <div className="text-xs text-amber-600 font-bold uppercase tracking-wider">Pending Posts</div>
                    <div className="text-2xl font-bold text-slate-800 mt-0.5">{analyticsData?.summary?.totalPendingPosts ?? '...'}</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200/60 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:scale-[1.01] transition-transform duration-200">
                  <div className="w-12 h-12 rounded-xl bg-purple-500 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-purple-500/20">
                    👁️
                  </div>
                  <div>
                    <div className="text-xs text-purple-600 font-bold uppercase tracking-wider">Total Video Views</div>
                    <div className="text-2xl font-bold text-slate-800 mt-0.5">{analyticsData?.summary?.totalViews ?? '...'}</div>
                  </div>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Activity Trend Double Bar Chart */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col items-stretch text-left lg:col-span-2">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    📈 Weekly Activity Trend <span className="text-xs font-normal text-slate-400">(Last 7 Days)</span>
                  </h3>
                  {isLoadingAnalytics ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm h-64 animate-pulse">
                      Loading chart...
                    </div>
                  ) : analyticsData?.dailyUploads && analyticsData.dailyUploads.length > 0 ? (
                    <div className="flex flex-col h-64 mt-2 justify-between">
                      <div className="flex-1 flex items-end gap-3 justify-around border-b border-slate-100 pb-2 relative">
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                          <div className="border-t border-slate-100/85 w-full h-0"></div>
                          <div className="border-t border-slate-100/85 w-full h-0"></div>
                          <div className="border-t border-slate-100/85 w-full h-0"></div>
                          <div className="border-t border-slate-100/85 w-full h-0"></div>
                        </div>
                        {analyticsData.dailyUploads.map((day: any, idx: number) => {
                          const maxVal = Math.max(...analyticsData.dailyUploads.map((d: any) => d.verified + d.pending), 5);
                          const verifiedHeight = (day.verified / maxVal) * 100;
                          const pendingHeight = (day.pending / maxVal) * 100;
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center group relative z-10">
                              <div className="absolute bottom-full mb-2 bg-slate-900 text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex flex-col gap-0.5 whitespace-nowrap shadow-md z-50">
                                <span className="font-bold border-b border-slate-700 pb-0.5 mb-0.5">{day.date}</span>
                                <span className="text-green-400">✓ Verified: {day.verified}</span>
                                <span className="text-yellow-400">⏳ Pending: {day.pending}</span>
                              </div>
                              <div className="w-8 flex gap-1 items-end h-40">
                                <div 
                                  style={{ height: `${verifiedHeight}%` }} 
                                  className="flex-1 bg-gradient-to-t from-green-500 to-emerald-400 rounded-t transition-all duration-500 hover:brightness-105 cursor-pointer"
                                ></div>
                                <div 
                                  style={{ height: `${pendingHeight}%` }} 
                                  className="flex-1 bg-gradient-to-t from-yellow-500 to-amber-400 rounded-t transition-all duration-500 hover:brightness-105 cursor-pointer"
                                ></div>
                              </div>
                              <span className="text-[10px] text-slate-400 mt-2 font-medium">{day.date}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-center gap-4 text-xs font-semibold mt-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-gradient-to-t from-green-500 to-emerald-400 block"></span>
                          <span className="text-slate-600">Verified Uploads</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-gradient-to-t from-yellow-500 to-amber-400 block"></span>
                          <span className="text-slate-600">Pending Uploads</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm h-64">
                      No activity trend data available.
                    </div>
                  )}
                </div>

                {/* State Distribution */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col text-left">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    🗺️ Geographic Distribution <span className="text-xs font-normal text-slate-400">(Top Regions)</span>
                  </h3>
                  {isLoadingAnalytics ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm animate-pulse">
                      Loading regions...
                    </div>
                  ) : analyticsData?.postsByRegion && analyticsData.postsByRegion.length > 0 ? (
                    <div className="space-y-4 flex-1 flex flex-col justify-center">
                      {analyticsData.postsByRegion.map((region: any, idx: number) => {
                        const total = analyticsData.summary.totalPosts || 1;
                        const percent = Math.min(Math.round((region.count / total) * 100), 100);
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-slate-700">
                              <span className="capitalize">{region._id || 'Unknown'}</span>
                              <span>{region.count} ({percent}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div 
                                style={{ width: `${percent}%` }}
                                className="bg-brand-600 h-2 rounded-full transition-all duration-1000"
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                      No geographic distribution.
                    </div>
                  )}
                </div>
              </div>

              {/* Top Creators Grid */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-left">
                <h3 className="text-sm font-bold text-slate-800 mb-4">👑 Top Active Reporters</h3>
                {isLoadingAnalytics ? (
                  <div className="text-center py-12 text-slate-400 text-sm animate-pulse">
                    Loading top creators...
                  </div>
                ) : !analyticsData?.topCreators || analyticsData.topCreators.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    No reporter statistics available.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-medium">Rank</th>
                          <th className="px-4 py-3 font-medium">Reporter Username</th>
                          <th className="px-4 py-3 font-medium">Total Reports Uploaded</th>
                          <th className="px-4 py-3 font-medium">Accumulated Views</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {analyticsData.topCreators.map((creator: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-bold text-slate-400">#{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">@{creator._id}</td>
                            <td className="px-4 py-3 font-medium text-slate-600">{creator.count} reports</td>
                            <td className="px-4 py-3 font-medium text-slate-600">{creator.views} views</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && user?.role === 'admin' && (
            <div className="glass-card rounded-xl p-6 bg-white shadow-sm border border-slate-200 text-left space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-800 font-semibold font-semibold">User Administration</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Search, review trust scores, and delete user accounts. Deleting a user will recursively delete all their reports (from DB & offsite cloud storage) and profile photo.
                </p>
              </div>

              {/* User Search Form */}
              <form onSubmit={(e) => { e.preventDefault(); fetchUsers(userSearch); }} className="flex gap-2 max-w-xl">
                <input
                  type="text"
                  placeholder="Search user by username or email ID..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:border-brand-500 outline-none text-slate-800 text-xs font-medium transition-all"
                />
                <button
                  type="submit"
                  disabled={isLoadingUsers}
                  className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                >
                  {isLoadingUsers ? 'Searching...' : 'Search'}
                </button>
              </form>

              {/* Batch Actions Bar */}
              {selectedUsers.length > 0 && (
                <div className="bg-red-50 border border-red-200 px-6 py-4 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="text-xs font-bold text-red-800">
                    Selected {selectedUsers.length} user(s) for bulk action
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleBulkUserAction('ban')} className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">Ban</button>
                    <button onClick={() => handleBulkUserAction('unban')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">Unban</button>
                    <button onClick={() => handleBulkUserAction('strike')} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">Strike</button>
                    <button onClick={handleBatchUserDelete} className="bg-red-650 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">Delete</button>
                  </div>
                </div>
              )}

              {/* Users Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl min-h-[350px] pb-32">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-medium w-12 text-center">
                        <input
                          type="checkbox"
                          checked={users.length > 0 && selectedUsers.length === users.filter(u => u.username !== user?.username).length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers(users.filter(u => u.username !== user?.username).map(u => u.id));
                            } else {
                              setSelectedUsers([]);
                            }
                          }}
                          className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 font-medium">Username</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Strikes</th>
                      <th className="px-4 py-3 font-medium">Trust Score</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {isLoadingUsers ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-semibold">
                          Fetching user list...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-semibold">
                          No users found matching "{userSearch}"
                        </td>
                      </tr>
                    ) : (
                      users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              disabled={u.username === user?.username}
                              checked={selectedUsers.includes(u.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsers(prev => [...prev, u.id]);
                                } else {
                                  setSelectedUsers(prev => prev.filter(id => id !== u.id));
                                }
                              }}
                              className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            @{u.username}
                            {u.is_banned && <span className="ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[9px] uppercase tracking-wider">Banned</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-red-100 text-red-700' : u.role === 'moderator' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-600">
                            {u.strikes || 0}/3
                          </td>
                          <td className="px-4 py-3 font-medium">
                            <span className={`px-2 py-0.5 rounded font-bold ${u.trust_score >= 50 ? 'bg-green-150 text-green-700' : u.trust_score > 0 ? 'bg-emerald-50 text-emerald-600' : u.trust_score < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-105 text-slate-500'}`}>
                              {u.trust_score}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right relative">
                            {u.username === user?.username ? (
                              <span className="text-slate-400 text-[10px] font-bold uppercase">Self (Locked)</span>
                            ) : (
                              <div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setActiveUserDropdown(activeUserDropdown === u.id ? null : u.id); }}
                                  className="p-1.5 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                                >
                                  •••
                                </button>
                                {activeUserDropdown === u.id && (
                                  <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 shadow-xl rounded-lg z-20 py-1 text-left text-xs font-medium text-slate-700">
                                    <button onClick={() => { handleUserAction(u._id || u.id, u.is_banned ? 'unban' : 'ban'); setActiveUserDropdown(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50">{u.is_banned ? 'Unban User' : 'Ban User'}</button>
                                    <button onClick={() => { handleUserAction(u._id || u.id, 'strike'); setActiveUserDropdown(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-orange-600">Issue Strike</button>
                                    <button onClick={() => { handleUserAction(u._id || u.id, 'remove_strike'); setActiveUserDropdown(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-emerald-600">Remove Strike</button>
                                    {u.role === 'user' && <button onClick={() => { handleUserAction(u._id || u.id, 'make_moderator'); setActiveUserDropdown(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-blue-600">Make Moderator</button>}
                                    {u.role === 'moderator' && <button onClick={() => { handleUserAction(u._id || u.id, 'remove_moderator'); setActiveUserDropdown(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-blue-600">Remove Moderator</button>}
                                    <button onClick={() => { handleDeleteUser(u._id || u.id, u.username); setActiveUserDropdown(null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 border-t border-slate-100 mt-1 pt-2">Delete Account</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && user?.role === 'admin' && (
            <div className="glass-card rounded-xl p-6 bg-white shadow-sm border border-slate-200 text-left space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-800 font-semibold">User Reports</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Manage user-submitted reports regarding content violations.
                </p>
              </div>

              {isLoadingReports ? (
                <div className="text-center py-10 text-slate-500 font-medium">Loading reports...</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Video Title</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Reporter</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {reports.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No pending reports.</td>
                        </tr>
                      ) : (
                        reports.map(report => (
                          <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <Link to={`/watch?id=${report.post_id}`} className="font-semibold text-brand-600 hover:text-brand-700 block truncate max-w-[200px]" target="_blank" rel="noopener noreferrer">
                                {report.post_title}
                              </Link>
                              <span className="text-[10px] text-slate-400">By: {report.post_author}</span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-600">@{report.reporter_username}</td>
                            <td className="px-4 py-3">
                              <span className="bg-red-50 text-red-700 border border-red-100 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide">
                                {report.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600 max-w-[250px] truncate" title={report.description}>
                              {report.description || <span className="text-slate-400 italic">No description provided</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleReportAction(report.id, 'dismiss')}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded transition-colors text-[10px] font-bold"
                                >
                                  Dismiss
                                </button>
                                <button
                                  onClick={() => handleReportAction(report.id, 'delete_post')}
                                  className="bg-red-50 border border-red-200 hover:bg-red-600 hover:text-white text-red-700 px-3 py-1.5 rounded transition-colors text-[10px] font-bold"
                                >
                                  Delete Video
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'escalated_reviews' && user?.role === 'admin' && (
            <div className="glass-card rounded-xl p-6 bg-white shadow-sm border border-slate-200 text-left space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-800 font-semibold">Escalated Moderator Reviews</h2>
                <p className="text-sm text-slate-500 mt-1">
                  These videos were rejected by moderators with suspicious or insufficient rejection reasons. Review and confirm the rejection, or overturn it. Overturning a rejection will issue a strike to the moderator and approve the video.
                </p>
              </div>

              {isLoadingEscalated ? (
                <div className="text-center py-10 text-slate-500 font-medium">Loading escalated reviews...</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Video Title</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Moderator Username</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Rejection Reason</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {escalatedReviews.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No escalated reviews found.</td>
                        </tr>
                      ) : (
                        escalatedReviews.map(review => (
                          <tr key={review.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-700 block truncate max-w-[200px]" title={review.title}>
                                {review.title}
                              </span>
                              <span className="text-[10px] text-slate-400">By: {review.author}</span>
                              <div className="mt-1">
                                <button 
                                  onClick={() => setVideoPreviewModal({isOpen: true, videoUrl: review.media_url})} 
                                  className="text-[10px] bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold px-2 py-1 rounded transition-colors"
                                >
                                  ▶ See Video
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-blue-600 cursor-pointer hover:underline" title="View Profile">
                                @{review.moderator_id}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <button
                                onClick={() => setReasonModal({isOpen: true, reason: `Rejection Reason by @${review.moderator_id}:\n\n"${review.rejected_reason || 'No reason provided'}"`})}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-bold transition-colors cursor-pointer"
                              >
                                View Reason
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEscalatedAction(review.id, 'overturn_rejection')}
                                  className="bg-emerald-50 border border-emerald-200 hover:bg-emerald-600 hover:text-white text-emerald-700 px-3 py-1.5 rounded transition-colors text-[10px] font-bold"
                                >
                                  Overturn & Approve
                                </button>
                                <button
                                  onClick={() => handleEscalatedAction(review.id, 'confirm_rejection')}
                                  className="bg-red-50 border border-red-200 hover:bg-red-600 hover:text-white text-red-700 px-3 py-1.5 rounded transition-colors text-[10px] font-bold"
                                >
                                  Confirm Rejection
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'videos' && user?.role === 'admin' && (
            <div className="glass-card rounded-xl p-6 bg-white shadow-sm border border-slate-200 text-left space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-800 font-semibold">Verified Videos Management</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Monitor and manage verified, active videos on the platform. Click on a video title to preview it, and delete a video if it violates guidelines.
                </p>
              </div>

              {/* Video Search Form */}
              <form onSubmit={(e) => { e.preventDefault(); fetchVerifiedPosts(videoSearch); }} className="flex gap-2 max-w-xl">
                <input
                  type="text"
                  placeholder="Search video by title, reporter username, city or state..."
                  value={videoSearch}
                  onChange={(e) => setVideoSearch(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:border-brand-500 outline-none text-slate-800 text-xs font-medium transition-all"
                />
                <button
                  type="submit"
                  disabled={isLoadingVideos}
                  className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                >
                  {isLoadingVideos ? 'Searching...' : 'Search'}
                </button>
              </form>

              {/* Batch Actions Bar */}
              {selectedVideos.length > 0 && (
                <div className="bg-red-50 border border-red-200 px-6 py-4 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="text-xs font-bold text-red-800">
                    Selected {selectedVideos.length} video(s) for bulk deletion
                  </div>
                  <button
                    onClick={() => handleBatchPostAction('delete')}
                    className="bg-red-650 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-sm shadow-red-500/10"
                  >
                    Delete Selected Videos
                  </button>
                </div>
              )}

              {/* Videos Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-medium w-12 text-center">
                        <input
                          type="checkbox"
                          checked={verifiedPosts.length > 0 && selectedVideos.length === verifiedPosts.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedVideos(verifiedPosts.map(p => p._id));
                            } else {
                              setSelectedVideos([]);
                            }
                          }}
                          className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 font-medium">Video Title</th>
                      <th className="px-4 py-3 font-medium">Author</th>
                      <th className="px-4 py-3 font-medium">Region</th>
                      <th className="px-4 py-3 font-medium">Views</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {isLoadingVideos ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-semibold">
                          Fetching video list...
                        </td>
                      </tr>
                    ) : verifiedPosts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-semibold">
                          No verified videos found matching "{videoSearch}"
                        </td>
                      </tr>
                    ) : (
                      verifiedPosts.map(post => (
                        <tr key={post._id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedVideos.includes(post._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVideos(prev => [...prev, post._id]);
                                } else {
                                  setSelectedVideos(prev => prev.filter(id => id !== post._id));
                                }
                              }}
                              className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setPreviewPost(post)}
                              className="font-bold text-slate-800 hover:text-brand-600 block text-left cursor-pointer hover:underline"
                            >
                              {post.title}
                              <span className="text-[9px] text-slate-400 font-normal ml-2 hover:no-underline">(preview)</span>
                            </button>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-600">@{post.author}</td>
                          <td className="px-4 py-3 capitalize">{post.city}, {post.state}</td>
                          <td className="px-4 py-3 font-mono font-medium">{post.views || 0} views</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteVideo(post._id)}
                              className="bg-red-55 border border-red-200 hover:bg-red-600 hover:text-white text-red-700 px-3 py-1.5 rounded transition-colors text-[10px] font-bold cursor-pointer"
                            >
                              Delete Video
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'system_settings' && user?.role === 'admin' && (
            <div className="glass-card rounded-xl p-6 bg-white shadow-sm border border-slate-200 text-left animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold text-slate-800 mb-4 font-semibold flex items-center gap-2">
                🌐 Global Platform Limits
              </h2>
              <p className="text-sm text-slate-500 mb-6 max-w-3xl leading-relaxed">
                Configure platform-wide restrictions and rate limits to prevent abuse and manage server resources. These settings apply globally to all standard users.
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 max-w-2xl">
                <form onSubmit={handleSaveSystemSettings} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Daily Video Upload Limit (Per User)
                    </label>
                    <p className="text-[11px] text-slate-500 mb-3">
                      The maximum number of videos a single user can upload within a 24-hour period. Once reached, their uploads will be blocked until the timer resets.
                    </p>
                    <div className="flex gap-4">
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        required
                        className="flex-1 w-full p-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-medium transition-all"
                        value={dailyUploadLimit}
                        onChange={(e) => setDailyUploadLimit(Number(e.target.value))}
                      />
                      <button 
                        type="submit" 
                        disabled={isSavingSystemSettings}
                        className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md shadow-brand-500/20 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                      >
                        {isSavingSystemSettings ? 'Saving...' : 'Save Limit'}
                      </button>
                    </div>
                  </div>
                  
                  {systemSaveStatus === 'success' && (
                    <div className="bg-green-50 text-green-700 border border-green-200 p-3 rounded-lg text-sm font-medium flex items-center gap-2">
                      ✅ Settings updated successfully
                    </div>
                  )}
                  {systemSaveStatus === 'error' && (
                    <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-lg text-sm font-medium flex items-center gap-2">
                      ❌ Failed to save settings
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {activeTab === 'pfp_settings' && user?.role === 'admin' && (
            <div className="glass-card rounded-xl p-6 bg-white shadow-sm border border-slate-200 text-left">
              <h2 className="text-xl font-bold text-slate-800 mb-4 font-semibold">Profile Photo (PFP) Storage Settings</h2>
              <p className="text-sm text-slate-500 mb-6">
                Configure offsite cloud storage channels and connection keys to offload user profile photo (PFP) storage. This saves local disk space and optimizes media delivery.
              </p>
              <form onSubmit={handleSavePFPConfig} className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Storage Config Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Primary Storage Bot"
                    value={telegramChannelName}
                    onChange={(e) => setTelegramChannelName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-slate-800 text-sm font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Storage Bot Token Keys</label>
                  <p className="text-xs text-slate-500 mb-2">Add multiple bot tokens for load balancing. Requests will be distributed randomly to bypass Telegram rate limits.</p>
                  {telegramBotTokens.map((token, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="e.g. 123456789:ABCdef..."
                        value={token}
                        onChange={(e) => {
                          const newTokens = [...telegramBotTokens];
                          newTokens[index] = e.target.value;
                          setTelegramBotTokens(newTokens);
                        }}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-slate-800 text-sm font-medium transition-all"
                      />
                      {telegramBotTokens.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setTelegramBotTokens(telegramBotTokens.filter((_, i) => i !== index))}
                          className="px-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-200"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTelegramBotTokens([...telegramBotTokens, ''])}
                    className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg transition-colors border border-brand-100 mt-1"
                  >
                    + Add Another Bot Token
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Storage Channel Reference ID</label>
                  <input
                    type="text"
                    placeholder="e.g. -100123456789 or @my_channel"
                    value={telegramChannelId}
                    onChange={(e) => setTelegramChannelId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-slate-800 text-sm font-medium transition-all"
                  />

                  {/* Chat ID Detection Helper */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chat ID Assistant</span>
                      <button
                        type="button"
                        onClick={handleDetectPFPChatId}
                        disabled={isDetecting}
                        className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-white border border-slate-200 hover:border-brand-200 px-3 py-1.5 rounded shadow-sm transition-all flex items-center gap-1 disabled:opacity-50"
                      >
                        {isDetecting ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5 text-brand-600" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Detecting...
                          </>
                        ) : 'Detect Chat ID'}
                      </button>
                    </div>
                    
                    {detectError && (
                      <div className="text-xs text-red-600 font-medium bg-red-50 border border-red-100 rounded p-2 mb-2">
                        ⚠️ {detectError}
                      </div>
                    )}

                    {hasAttemptedDetect && !isDetecting && detectedChats.length === 0 && !detectError && (
                      <div className="text-xs text-slate-600 bg-yellow-50 border border-yellow-100 rounded p-2.5">
                        <p className="font-semibold mb-1">No chats detected yet. Please ensure:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Your bot token is saved correctly.</li>
                          <li>You have added the bot to your Group/Channel as an administrator.</li>
                          <li>You have sent a message (e.g. "test") in that group/channel.</li>
                        </ul>
                      </div>
                    )}

                    {detectedChats.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Click a detected chat below to auto-populate the fields:</p>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                          {detectedChats.map(chat => (
                            <button
                              key={chat.id}
                              type="button"
                              onClick={() => {
                                setTelegramChannelId(chat.id);
                                if (chat.title && !telegramChannelName) {
                                  setTelegramChannelName(chat.title);
                                }
                              }}
                              className="flex items-center justify-between p-2 bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded text-left text-xs transition-all cursor-pointer group"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-base">
                                  {chat.type === 'channel' ? '📢' : chat.type === 'supergroup' || chat.type === 'group' ? '👥' : '👤'}
                                </span>
                                <div>
                                  <div className="font-bold text-slate-700 group-hover:text-brand-700">{chat.title}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{chat.type}</div>
                                </div>
                              </div>
                              <div className="font-mono font-semibold text-slate-500 bg-slate-50 group-hover:bg-brand-100 group-hover:text-brand-600 px-2 py-0.5 rounded border border-slate-100">
                                {chat.id}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md shadow-brand-500/10 transition-colors flex items-center gap-2"
                  >
                    {isSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                  {saveStatus === 'success' && (
                    <span className="text-sm font-semibold text-green-600">✓ Settings saved successfully!</span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="text-sm font-semibold text-red-600">✗ Failed to save settings.</span>
                  )}
                </div>
              </form>
            </div>
          )}

          {activeTab === 'managers' && user?.role === 'admin' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
              {/* Form to Add Storage Manager */}
              <div className="lg:col-span-1 glass-card rounded-xl p-6 md:p-8 bg-white shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-5">Add Regional Manager</h3>
                <form onSubmit={handleAddManager} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Manager Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pune Regional Manager"
                      value={newManagerName}
                      onChange={(e) => setNewManagerName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-500 outline-none text-slate-800 text-sm font-medium transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">State</label>
                      <select
                        required
                        value={newManagerState}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewManagerState(val);
                          if (val === 'National') {
                            setNewManagerCity('National');
                          } else {
                            setNewManagerCity('');
                          }
                        }}
                        className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-500 outline-none text-slate-800 text-sm font-medium transition-all"
                      >
                        <option value="">Select State</option>
                        <option value="National">National (All India)</option>
                        {Object.keys(stateDistricts).map((stateName) => (
                          <option key={stateName} value={stateName}>
                            {stateName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">City/District</label>
                      <select
                        value={newManagerCity}
                        onChange={(e) => setNewManagerCity(e.target.value)}
                        disabled={!newManagerState || newManagerState === 'National'}
                        className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-500 outline-none text-slate-800 text-sm font-medium transition-all disabled:opacity-50"
                      >
                        {newManagerState === 'National' ? (
                          <option value="National">All Districts (National)</option>
                        ) : (
                          <>
                            <option value="">All Districts (Fallback)</option>
                            {newManagerDistricts.map((districtName: string) => (
                              <option key={districtName} value={districtName}>
                                {districtName}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telegram Bot Tokens (Load Balancing)</label>
                    {newManagerTokens.map((token, index) => (
                      <div key={index} className="flex gap-2 mb-3">
                        <input
                          type="text"
                          required={index === 0}
                          placeholder="e.g. 1234567:ABC..."
                          value={token}
                          onChange={(e) => {
                            const newTokens = [...newManagerTokens];
                            newTokens[index] = e.target.value;
                            setNewManagerTokens(newTokens);
                          }}
                          className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-500 outline-none text-slate-800 text-sm font-medium transition-all"
                        />
                        {newManagerTokens.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewManagerTokens(newManagerTokens.filter((_, i) => i !== index))}
                            className="px-4 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-200 font-bold transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setNewManagerTokens([...newManagerTokens, ''])}
                      className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-2 rounded-lg transition-colors border border-brand-100"
                    >
                      + Add Bot Token
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telegram Channel ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. -100123456789"
                      value={newManagerChannelId}
                      onChange={(e) => setNewManagerChannelId(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-500 outline-none text-slate-800 text-sm font-medium transition-all"
                    />
                  </div>

                  {/* Auto Detection inside Regional Form */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chat ID Assistant</span>
                      <button
                        type="button"
                        onClick={handleDetectNewManagerChatId}
                        disabled={isDetectingNewManager || !newManagerTokens[0]?.trim()}
                        className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                      >
                        {isDetectingNewManager ? 'Detecting...' : 'Detect Chat ID'}
                      </button>
                    </div>
                    
                    {detectNewError && (
                      <div className="text-xs text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg p-3 mb-2">
                        ⚠️ {detectNewError}
                      </div>
                    )}

                    {detectedNewChats.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-2 mt-2">
                        {detectedNewChats.map(chat => (
                          <button
                            key={chat.id}
                            type="button"
                            onClick={() => setNewManagerChannelId(chat.id)}
                            className="w-full flex items-center justify-between p-3 bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-lg text-left text-xs cursor-pointer transition-colors"
                          >
                            <span className="truncate font-medium">{chat.title}</span>
                            <span className="font-mono text-slate-500">{chat.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isAddingManager}
                    className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white py-3.5 rounded-xl text-sm font-bold transition-all shadow-sm"
                  >
                    {isAddingManager ? 'Adding...' : 'Add Manager'}
                  </button>
                </form>
              </div>

              {/* List of Storage Managers */}
              <div className="lg:col-span-2 glass-card rounded-xl p-6 md:p-8 bg-white shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Configured Managers</h3>
                {managers.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-sm">
                    No regional storage managers configured. Posts will use the default settings or local fallback.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200 font-bold">
                        <tr>
                          <th className="px-6 py-4">Name</th>
                          <th className="px-6 py-4">State</th>
                          <th className="px-6 py-4">City/District</th>
                          <th className="px-6 py-4">Storage ID</th>
                          <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {managers.map(m => (
                          <tr key={m._id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-800">{m.name}</td>
                            <td className="px-6 py-4 capitalize">{m.state}</td>
                            <td className="px-6 py-4 capitalize">{m.city || <span className="text-slate-400 italic font-normal text-xs">State fallback</span>}</td>
                            <td className="px-6 py-4 font-mono text-slate-500">{m.storage_id}</td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleDeleteManager(m._id)}
                                className="bg-red-50 border border-red-200 hover:bg-red-600 hover:text-white text-red-700 px-4 py-2 rounded-lg transition-colors text-xs font-bold"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'regional_admins' && user?.is_superadmin && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
              {/* Form to Add Regional Admin */}
              <div className="lg:col-span-1 glass-card rounded-xl p-6 bg-white shadow-sm border border-slate-200">
                <h3 className="text-base font-bold text-slate-800 mb-4 font-semibold">Add Regional Admin</h3>
                <form onSubmit={handleAddRegionalAdmin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Email</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. moderator@example.com"
                      value={newRegionalEmail}
                      onChange={(e) => setNewRegionalEmail(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-brand-500 outline-none text-slate-855 text-xs font-medium transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                      <select
                        required
                        value={newRegionalState}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewRegionalState(val);
                          if (val === 'National') {
                            setNewRegionalCity('National');
                          } else {
                            setNewRegionalCity('');
                          }
                        }}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-brand-500 outline-none text-slate-855 text-xs font-medium transition-all"
                      >
                        <option value="">Select State</option>
                        <option value="National">National / All Regions</option>
                        {Object.keys(stateDistricts).map((stateName) => (
                          <option key={stateName} value={stateName}>
                            {stateName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">City/District</label>
                      <select
                        value={newRegionalCity}
                        onChange={(e) => setNewRegionalCity(e.target.value)}
                        disabled={!newRegionalState || newRegionalState === 'National'}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-brand-500 outline-none text-slate-855 text-xs font-medium transition-all disabled:opacity-50"
                      >
                        {newRegionalState === 'National' ? (
                          <option value="National">All Districts (National)</option>
                        ) : (
                          <>
                            <option value="">All Districts (Fallback)</option>
                            {newRegionalDistricts.map((districtName: string) => (
                              <option key={districtName} value={districtName}>
                                {districtName}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAddingRegional}
                    className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
                  >
                    {isAddingRegional ? 'Adding...' : 'Add Regional Admin'}
                  </button>
                </form>
              </div>

              {/* List of Regional Admins */}
              <div className="lg:col-span-2 glass-card rounded-xl p-6 bg-white shadow-sm border border-slate-200">
                <h3 className="text-base font-bold text-slate-800 mb-4 font-semibold">Configured Regional Admins</h3>
                {regionalAdmins.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    No regional admins configured. All moderators will have global access or default permissions.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-medium">Email</th>
                          <th className="px-4 py-3 font-medium">State</th>
                          <th className="px-4 py-3 font-medium">City/District</th>
                          <th className="px-4 py-3 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {regionalAdmins.map(a => (
                          <tr key={a._id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-semibold text-slate-800">{a.email}</td>
                            <td className="px-4 py-3 capitalize">{a.state}</td>
                            <td className="px-4 py-3 capitalize">{a.city || <span className="text-slate-400 italic font-normal text-[10px]">State fallback</span>}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleDeleteRegionalAdmin(a._id)}
                                className="bg-red-55 border border-red-200 hover:bg-red-600 hover:text-white text-red-700 px-2 py-1 rounded transition-colors text-[10px] font-bold"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'audit_logs' && user?.role === 'admin' && (
            <div className="glass-card rounded-xl p-6 bg-white shadow-sm border border-slate-200 text-left space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-800 font-semibold">Administrative Audit Logs</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Track and review all moderation and configuration actions performed by administrators and moderators.
                </p>
              </div>

              {/* Search Audit Logs */}
              <div className="flex gap-2 max-w-xl">
                <input
                  type="text"
                  placeholder="Filter by actor username, action, or target..."
                  value={auditSearch}
                  onChange={(e) => {
                    setAuditSearch(e.target.value);
                    setAuditPage(1);
                    fetchAuditLogs(e.target.value, 1);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:border-brand-500 outline-none text-slate-800 text-xs font-medium transition-all"
                />
              </div>

              {/* Logs Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-medium">Actor</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Target</th>
                      <th className="px-4 py-3 font-medium">Date & Time</th>
                      <th className="px-4 py-3 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {isLoadingAudit ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-semibold">
                          Loading audit records...
                        </td>
                      </tr>
                    ) : auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-semibold">
                          No audit logs found.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log._id || log.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800">@{log.actor_username}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.action.includes('delete') || log.action.includes('reject') ? 'bg-red-50 text-red-700' : log.action.includes('verify') || log.action.includes('approve') ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                              {log.action.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-650">{log.target || '-'}</td>
                          <td className="px-4 py-3 text-slate-500 font-medium">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] text-slate-400 max-w-xs truncate">
                            {log.details ? JSON.stringify(log.details) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {auditTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    disabled={auditPage <= 1 || isLoadingAudit}
                    onClick={() => {
                      setAuditPage(prev => Math.max(1, prev - 1));
                    }}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-500 font-bold">
                    Page {auditPage} of {auditTotalPages}
                  </span>
                  <button
                    disabled={auditPage >= auditTotalPages || isLoadingAudit}
                    onClick={() => {
                      setAuditPage(prev => Math.min(auditTotalPages, prev + 1));
                    }}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'moderator_logs' && user?.role === 'admin' && (
            <div className="glass-card rounded-xl p-6 bg-white shadow-sm border border-slate-200 text-left space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-800 font-semibold">Moderator Action Logs</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Track all video approvals and rejections performed by moderators, including their rejection reasons.
                </p>
              </div>

              {isLoadingModeratorLogs ? (
                <div className="text-center py-10 text-slate-500 font-medium">Loading moderator logs...</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Moderator</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Target Video</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {moderatorLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No moderator logs found.</td>
                        </tr>
                      ) : (
                        moderatorLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700">@{log.actor_username}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                log.action.includes('reject') ? 'bg-red-100 text-red-700' :
                                log.action.includes('verify') ? 'bg-green-100 text-green-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {log.action.replace('_post', '').replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]" title={log.target}>
                              {log.target}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {log.action.includes('reject') || log.action.includes('escalate') ? (
                                <button
                                  onClick={() => setReasonModal({isOpen: true, reason: `Rejection Reason by @${log.actor_username}:\n\n"${log.details?.reason || 'No reason provided'}"`})}
                                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-bold transition-colors cursor-pointer"
                                >
                                  View Reason
                                </button>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'system_logs' && user?.role === 'admin' && (
            <div className="glass-card rounded-xl p-6 bg-white shadow-sm border border-slate-200 text-left space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 font-semibold font-semibold">Live System Logs Viewer</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Examine system diagnostic log files directly from the VPS disk.
                  </p>
                </div>
                
                {/* File selector */}
                <div className="flex gap-2">
                  <select
                    value={systemLogFile}
                    onChange={(e) => {
                      const fileKey = e.target.value as any;
                      setSystemLogFile(fileKey);
                      fetchSystemLogs(fileKey);
                    }}
                    className="px-3 py-2.5 rounded-lg border border-slate-200 outline-none text-slate-800 text-xs font-semibold bg-white cursor-pointer"
                  >
                    <option value="global_error">Global Errors (global_error.log)</option>
                    <option value="crash">Crashes & Exceptions (crash.log)</option>
                    <option value="pfp_error">Profile Photo Errors (pfp_error.log)</option>
                  </select>
                  
                  <button
                    onClick={() => fetchSystemLogs(systemLogFile)}
                    disabled={isLoadingSystemLog}
                    className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Console Viewer */}
              <div className="bg-slate-900 border border-slate-950 rounded-2xl overflow-hidden shadow-inner flex flex-col h-[500px]">
                <div className="bg-slate-950 px-4 py-2 border-b border-slate-900 flex justify-between items-center">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500 block"></span>
                    <span className="w-3 h-3 rounded-full bg-yellow-500 block"></span>
                    <span className="w-3 h-3 rounded-full bg-green-500 block"></span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">terminal - {systemLogFile}.log</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(systemLogContent);
                      alert("Logs copied to clipboard!");
                    }}
                    className="text-slate-400 hover:text-slate-200 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-800 bg-slate-900/50 hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Copy Logs
                  </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text text-left">
                  {isLoadingSystemLog ? (
                    <div className="h-full flex items-center justify-center text-slate-500 animate-pulse">
                      Loading terminal output...
                    </div>
                  ) : systemLogContent ? (
                    systemLogContent.split('\n').map((line, index) => {
                      const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('exception') || line.toLowerCase().includes('fail');
                      const isWarning = line.toLowerCase().includes('warn');
                      return (
                        <div
                          key={index}
                          className={`${isError ? 'text-red-400 font-bold' : isWarning ? 'text-yellow-400' : 'text-slate-300'}`}
                        >
                          {line}
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-600 italic">
                      This log file is empty.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Video/Media Preview Modal */}
      {previewPost && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-base truncate">{previewPost.title}</h3>
              <button 
                onClick={() => setPreviewPost(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Player */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-left">
              {/* Video / Image Display */}
              <div className="bg-slate-950 rounded-xl overflow-hidden aspect-video shadow-inner relative flex items-center justify-center border border-slate-200">
                {previewPost.mime_type?.startsWith('image/') ? (
                  <img src={previewPost.media_url} alt={previewPost.title} className="max-w-full max-h-full object-contain" />
                ) : (
                  <video controls autoPlay className="w-full h-full object-contain">
                    <source src={previewPost.media_url} type={previewPost.mime_type || 'video/mp4'} />
                  </video>
                )}
              </div>

              {/* Metadata */}
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
                  <span>By @{previewPost.author}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded capitalize">{previewPost.city}, {previewPost.state}</span>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-48 overflow-y-auto break-words">
                  {previewPost.description}
                </p>
              </div>
            </div>

            {/* Modal Footer (Action Buttons) */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
              <button 
                onClick={() => setPreviewPost(null)}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Close Preview
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={async () => {
                    await handleAction(previewPost._id, 'verify');
                    setPreviewPost(null);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm shadow-green-500/10 transition-colors cursor-pointer"
                >
                  Approve Post
                </button>
                <button 
                  onClick={async () => {
                    await handleAction(previewPost._id, 'reject');
                    setPreviewPost(null);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm shadow-red-500/10 transition-colors cursor-pointer"
                >
                  Reject Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Reject Modal */}
      {rejectModalState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Reject Video</h3>
            <p className="text-sm text-slate-500 mb-4">Please provide a detailed reason for rejecting this video. This will be recorded in the audit logs.</p>
            <textarea
              className="w-full border border-slate-200 rounded-xl p-3 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
              placeholder="E.g., Inappropriate content, violates community guidelines..."
              value={rejectReasonInput}
              onChange={(e) => setRejectReasonInput(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setRejectModalState({isOpen: false, postId: null}); setRejectReasonInput(''); }}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitRejection}
                disabled={!rejectReasonInput.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600 rounded-lg transition-colors"
              >
                Submit Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Warning Modal */}
      {systemWarningModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border-t-4 border-amber-500">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xl">⚠️</div>
              <h3 className="text-lg font-bold text-slate-800">System Alert</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {systemWarningModal.message}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setSystemWarningModal({isOpen: false, message: ''})}
                className="px-5 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reason Modal */}
      {reasonModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Rejection Reason</h3>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap">
              {reasonModal.reason || "No reason provided."}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setReasonModal({isOpen: false, reason: null})}
                className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      {videoPreviewModal.isOpen && videoPreviewModal.videoUrl && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-black rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setVideoPreviewModal({isOpen: false, videoUrl: null})}
                className="bg-black/50 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur transition-colors"
              >
                ✕
              </button>
            </div>
            <video 
              src={videoPreviewModal.videoUrl} 
              controls 
              autoPlay 
              className="w-full max-h-[80vh]"
            />
          </div>
        </div>
      )}

    </>
  );
}
