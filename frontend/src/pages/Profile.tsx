import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import VideoThumbnail from '../components/VideoThumbnail';
import { 
  ShieldCheck, Eye, Video, Heart, Bookmark, Trophy, 
  TrendingUp, Star, CheckCircle2, Clock, AlertTriangle, 
  XCircle, Upload, MapPin, Calendar, MoreHorizontal, Settings, Camera
} from 'lucide-react';

export default function Profile() {
  const [searchParams] = useSearchParams();
  const { user: currentUser, openAuthModal, loading: authLoading } = useAuth();
  const username = searchParams.get('username') || currentUser?.username;
  const [data, setData] = useState<any>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'videos' | 'reports'>('videos');

  // Settings Modal States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'avatar' | 'username' | 'password' | 'profile'>('avatar');
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Profile Details State
  const [publicName, setPublicName] = useState('');
  const [bio, setBio] = useState('');
  const [hideLocation, setHideLocation] = useState(false);
  const [coffeeLink, setCoffeeLink] = useState('');
  const [instagramLink, setInstagramLink] = useState('');
  const [twitterLink, setTwitterLink] = useState('');
  
  const [pfpFile, setPfpFile] = useState<File | null>(null);
  const [pfpPreview, setPfpPreview] = useState<string>('');
  
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDeleteVideo = async (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this video?")) return;
    setIsDeleting(postId);
    try {
      const res = await axios.delete(`/api/posts/${postId}`);
      if (res.data.success) {
        setData((prev: any) => ({
          ...prev,
          posts: prev.posts.filter((p: any) => p._id !== postId)
        }));
      }
    } catch (err) {
      alert('Failed to delete video');
    } finally {
      setIsDeleting(null);
      setActiveDropdown(null);
    }
  };

  const handleShareVideo = (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/watch?id=${postId}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
    setActiveDropdown(null);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!username) return;
    if (!currentUser) {
      openAuthModal();
      return;
    }
    axios.get(`/api/profile?username=${username}`)
      .then(res => {
        setData(res.data);
        if (currentUser?.username === res.data.user.username) {
          setPublicName(res.data.user.public_name || '');
          setBio(res.data.user.bio || '');
          setHideLocation(res.data.user.hide_location || false);
          setCoffeeLink(res.data.user.coffee_link || '');
          setInstagramLink(res.data.user.instagram_link || '');
          setTwitterLink(res.data.user.twitter_link || '');
        }
      })
      .catch(console.error);
  }, [username, currentUser, authLoading]);

  const handleFollow = async () => {
    try {
      const res = await axios.post('/api/follow?action=toggle', { username });
      if (res.data.success) {
        setData((prev: any) => ({ ...prev, isFollowing: !prev.isFollowing }));
        // also update followersCount visually
        setData((prev: any) => ({
          ...prev,
          followersCount: prev.isFollowing ? prev.followersCount + 1 : Math.max(0, prev.followersCount - 1)
        }));
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to follow');
    }
  };

  const handlePfpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pfpFile) return;
    setIsSavingSettings(true);
    setSettingsError('');
    setSettingsSuccess('');
    const formData = new FormData();
    formData.append('pfp', pfpFile);
    try {
      const res = await axios.post('/api/profile/update-pfp', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setSettingsSuccess('Profile picture updated successfully!');
        setData((prev: any) => ({ ...prev, pfp_url: res.data.pfp_url }));
        setPfpFile(null);
      }
    } catch (err: any) {
      setSettingsError(err.response?.data?.detail || 'Failed to update profile picture.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleBannerUpload = async (file: File) => {
    if (!file) return;
    setIsUploadingBanner(true);
    const formData = new FormData();
    formData.append('banner', file);
    try {
      const res = await axios.post('/api/profile/update-banner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setData((prev: any) => ({ ...prev, banner_url: res.data.banner_url }));
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update banner.');
    } finally {
      setIsUploadingBanner(false);
      setBannerFile(null);
    }
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || newUsername.trim() === user?.username) return;
    setIsSavingSettings(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      const res = await axios.post('/api/profile/update-username', { username: newUsername });
      if (res.data.success) {
        setSettingsSuccess('Username updated successfully!');
        window.location.search = `?username=${res.data.username}`;
      }
    } catch (err: any) {
      setSettingsError(err.response?.data?.detail || 'Failed to update username.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      setSettingsError('New passwords do not match.');
      return;
    }
    setIsSavingSettings(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      const res = await axios.post('/api/profile/update-password', {
        currentPassword,
        newPassword
      });
      if (res.data.success) {
        setSettingsSuccess('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setSettingsError(err.response?.data?.detail || 'Failed to update password.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      const res = await axios.post('/api/profile/update-details', {
        public_name: publicName,
        bio,
        hide_location: hideLocation,
        coffee_link: coffeeLink,
        instagram_link: instagramLink,
        twitter_link: twitterLink
      });
      if (res.data.success) {
        setSettingsSuccess('Profile details updated successfully!');
        // Update local data view so changes reflect immediately
        setData((prev: any) => ({
          ...prev,
          user: {
            ...prev.user,
            public_name: publicName,
            bio,
            hide_location: hideLocation,
            coffee_link: coffeeLink,
            instagram_link: instagramLink,
            twitter_link: twitterLink
          }
        }));
      }
    } catch (err: any) {
      setSettingsError(err.response?.data?.detail || 'Failed to update profile details.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (authLoading) return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[70vh] gap-4 text-center px-4">
        <AlertTriangle className="w-16 h-16 text-brand-500 mb-2" />
        <h2 className="text-2xl font-bold text-slate-800">Login Required</h2>
        <p className="text-slate-500 max-w-md">You must be registered and logged in to view user profiles, follow creators, and interact with the community.</p>
        <button 
          onClick={openAuthModal}
          className="mt-6 px-8 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-brand-500/30"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  if (!data) return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const { user, posts, verifiedPostsCount, isFollowing, totalViews, totalLikes } = data;

  // Calculate Trust Tier
  const score = user?.trust_score || 0;
  let trustTier = { name: "New Contributor", color: "text-slate-500", bg: "bg-slate-100", border: "border-slate-200", icon: <Star className="w-4 h-4 text-slate-500" /> };
  if (score >= 500) trustTier = { name: "Elite Reporter", color: "text-purple-600", bg: "bg-purple-100", border: "border-purple-200", icon: <Trophy className="w-4 h-4 text-purple-600" /> };
  else if (score >= 100) trustTier = { name: "Trusted Reporter", color: "text-brand-600", bg: "bg-brand-100", border: "border-brand-200", icon: <ShieldCheck className="w-4 h-4 text-brand-600" /> };
  else if (score >= 10) trustTier = { name: "Verified Contributor", color: "text-green-600", bg: "bg-green-100", border: "border-green-200", icon: <CheckCircle2 className="w-4 h-4 text-green-600" /> };

  const joinDate = user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : 'Unknown';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      <div className="max-w-4xl mx-auto">
        
        {/* TOP HEADER */}
        <div className="flex items-center justify-between px-6 py-6 pt-8">
          <Link to="/" className="text-slate-600 hover:text-slate-900 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </Link>
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-800">Profile</span>
          {currentUser?.username === user?.username ? (
            <button onClick={() => setShowSettingsModal(true)} className="text-slate-600 hover:text-slate-900 transition-colors">
              <MoreHorizontal className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-6"></div>
          )}
        </div>

        {/* STATS & AVATAR */}
        <div className="flex items-center justify-center gap-10 md:gap-20 mt-8 px-6">
          <div className="text-center">
            <p className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">{data.followersCount || 0}</p>
            <p className="text-[9px] md:text-[10px] tracking-widest text-slate-500 font-bold uppercase mt-1">Followers</p>
          </div>
          
          <div className="relative group/avatar">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-[4px] border-white p-1 bg-gradient-to-br from-brand-100 to-brand-50 shadow-xl">
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center text-4xl font-bold text-slate-400">
                {data.pfp_url ? (
                  <img src={data.pfp_url} alt={user?.username} className="w-full h-full object-cover" />
                ) : (
                  user?.username?.substring(0, 1).toUpperCase()
                )}
              </div>
            </div>
            {currentUser?.username !== user?.username && (
              <button onClick={handleFollow} className={`absolute bottom-0 right-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-lg md:text-xl shadow-lg transition-transform hover:scale-110 border-2 border-white ${isFollowing ? 'bg-slate-200 text-slate-600' : 'bg-brand-500 text-white'}`}>
                {isFollowing ? '✓' : '+'}
              </button>
            )}
            {currentUser?.username === user?.username && (
              <button onClick={() => { setActiveSettingsTab('avatar'); setShowSettingsModal(true); }} className="absolute bottom-0 right-0 w-8 h-8 md:w-10 md:h-10 bg-brand-500 hover:bg-brand-600 rounded-full text-white border-2 border-white flex items-center justify-center font-bold shadow-lg transition-transform hover:scale-110">
                +
              </button>
            )}
          </div>

          <div className="text-center">
            <p className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">{score}</p>
            <p className="text-[9px] md:text-[10px] tracking-widest text-slate-500 font-bold uppercase mt-1">Trust Score</p>
          </div>

          <div className="text-center">
            <p className="text-2xl md:text-3xl font-extrabold tracking-tight text-red-600">{user?.strikes || 0}/3</p>
            <p className="text-[9px] md:text-[10px] tracking-widest text-slate-500 font-bold uppercase mt-1">Strikes</p>
          </div>
        </div>

        {/* INFO */}
        <div className="text-center mt-8 px-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            {user?.public_name || user?.username}
          </h1>
          
          {/* Role Badges */}
          <div className="flex justify-center items-center gap-2 mt-3">
            {user?.role === 'admin' && (
              <span className="px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm bg-red-50 text-red-600 border-red-200">
                <ShieldCheck className="w-3.5 h-3.5" /> Admin
              </span>
            )}
            {user?.role === 'moderator' && (
              <span className="px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm bg-orange-50 text-orange-600 border-orange-200">
                <ShieldCheck className="w-3.5 h-3.5" /> Moderator
              </span>
            )}
            <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm ${trustTier.bg} ${trustTier.color} ${trustTier.border}`}>
              {trustTier.icon} {trustTier.name}
            </span>
          </div>

          {user?.is_banned ? (
            <div className="mt-12 px-6 py-12 text-center bg-red-50 border-t border-b border-red-100 rounded-xl">
              <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Account Suspended</h2>
              <p className="text-slate-600 max-w-lg mx-auto">This account has been suspended due to violations of our platform policies. Content from this account is currently unavailable.</p>
            </div>
          ) : (
            <>
              <p className="text-slate-600 text-sm mt-4 leading-relaxed max-w-md mx-auto">
                {user?.bio || 'No bio provided.'}
              </p>
              
              {/* Social Badges */}
              <div className="flex flex-wrap justify-center gap-3 mt-6">
                {user?.coffee_link && (
                  <a href={user.coffee_link} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-[#FFDD00] hover:bg-[#FFD000] text-black font-bold text-sm shadow-sm transition-colors flex items-center gap-2">
                    ☕ Buy me a coffee
                  </a>
                )}
                {user?.instagram_link && (
                  <a href={user.instagram_link} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] text-white font-bold text-sm shadow-sm transition-opacity hover:opacity-90 flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                    Instagram
                  </a>
                )}
                {user?.twitter_link && (
                  <a href={user.twitter_link} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-[#1DA1F2] hover:bg-[#1a91da] text-white font-bold text-sm shadow-sm transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
                    Twitter
                  </a>
                )}
              </div>
            </>
          )}
        </div>

        {/* TABS */}
        {!user?.is_banned && (
          <>
            <div className="mt-10 border-t border-b border-slate-200">
              <div className="flex">
                <button onClick={() => setActiveTab('videos')} className={`flex-1 py-4 text-[10px] md:text-xs font-bold tracking-[0.15em] flex justify-center items-center gap-2 transition-colors ${activeTab === 'videos' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'}`}>
                  {activeTab === 'videos' && <Star className="w-3 h-3 fill-current" />} VIDEOS
                </button>
                <div className="w-px bg-slate-200 my-3"></div>
                <button onClick={() => setActiveTab('reports')} className={`flex-1 py-4 text-[10px] md:text-xs font-bold tracking-[0.15em] flex justify-center items-center gap-2 transition-colors ${activeTab === 'reports' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'}`}>
                  {activeTab === 'reports' && <Star className="w-3 h-3 fill-current" />} REPORTS
                </button>
              </div>
            </div>

            {/* TAB CONTENT: VIDEOS */}
            {activeTab === 'videos' && (
              <div className="px-6 py-8">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  {posts?.length === 0 ? (
                    <div className="col-span-full py-10 text-center text-slate-500">
                      <Video className="w-8 h-8 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No videos uploaded yet.</p>
                    </div>
                  ) : (
                    posts?.map((post: any) => (
                      <div key={post._id} className="relative group bg-white rounded-xl overflow-hidden flex flex-col h-56 md:h-64 shadow-md border border-slate-200 hover:border-slate-300 hover:-translate-y-1 transition-all">
                        <Link to={(post.duration > 0 && post.duration <= 60) ? `/shorts?id=${post._id}` : `/watch?id=${post._id}`} className="flex-1 relative bg-slate-100 border-b border-slate-100 block">
                          <VideoThumbnail postId={post._id} mediaUrl={post.media_url} thumbnailUrl={post.thumbnail_url} mimeType={post.mime_type} title={post.title} />
                          {post.status === 'verified' && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shadow-sm">
                              Verified
                            </div>
                          )}
                        </Link>
                        
                        {/* 3-dot menu for owner */}
                        {currentUser?.username === username && (
                          <div className="absolute top-2 left-2 z-20">
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveDropdown(activeDropdown === post._id ? null : post._id);
                              }}
                              className="bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            
                            {activeDropdown === post._id && (
                              <div className="absolute top-full left-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-slate-200 py-1 overflow-hidden z-30">
                                <button 
                                  onClick={(e) => handleShareVideo(e, post._id)}
                                  className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  Share Link
                                </button>
                                <button 
                                  onClick={(e) => handleDeleteVideo(e, post._id)}
                                  disabled={isDeleting === post._id}
                                  className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                  {isDeleting === post._id ? 'Deleting...' : 'Delete Video'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      <Link to={(post.duration > 0 && post.duration <= 60) ? `/shorts?id=${post._id}` : `/watch?id=${post._id}`} className="bg-white py-4 px-3 text-center shrink-0 flex items-center justify-center block">
                      <h3 className="text-[10px] font-bold tracking-[0.1em] text-slate-800 uppercase truncate w-full">
                        {post.title}
                      </h3>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB CONTENT: REPORTS */}
        {activeTab === 'reports' && (
          <div className="px-6 py-8 max-w-2xl mx-auto">
            {posts?.length === 0 ? (
              <p className="text-slate-500 text-center py-10">No reports submitted.</p>
            ) : (
              <div className="relative border-l-2 border-slate-200 ml-3 space-y-8">
                {posts?.map((post: any) => {
                  let statusColor = "text-yellow-600 bg-yellow-50 border-yellow-200";
                  if (post.status === 'verified') statusColor = "text-green-600 bg-green-50 border-green-200";
                  if (post.status === 'rejected') statusColor = "text-red-600 bg-red-50 border-red-200";

                  return (
                    <div key={post._id} className="relative pl-8">
                      <div className={`absolute -left-[10px] top-1.5 w-5 h-5 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center`}>
                         <div className={`w-2 h-2 rounded-full ${statusColor.split(' ')[0].replace('text-', 'bg-')}`}></div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                          <h4 className="font-bold text-lg text-slate-800">{post.title}</h4>
                          <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${statusColor}`}>
                            {post.status || 'pending'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">{new Date(post.created_at).toLocaleString()}</p>
                        <Link to={(post.duration > 0 && post.duration <= 60) ? `/shorts?id=${post._id}` : `/watch?id=${post._id}`} className="text-brand-600 hover:text-brand-700 text-xs font-bold tracking-wider uppercase flex items-center gap-1 group/link">
                          View Details <TrendingUp className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        </>
      )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-[24px] max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-lg tracking-tight">Profile Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-700 p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">✕</button>
            </div>
            
            {/* Modal Tabs */}
            <div className="flex border-b border-slate-100 bg-white text-xs font-bold text-slate-500 px-2 pt-2">
              <button onClick={() => { setActiveSettingsTab('avatar'); setSettingsError(''); setSettingsSuccess(''); }} className={`flex-1 py-3 text-center transition-all cursor-pointer border-b-2 rounded-t-xl ${activeSettingsTab === 'avatar' ? 'border-brand-600 text-brand-600 bg-slate-50/50' : 'border-transparent hover:text-slate-800 hover:bg-slate-50'}`}>🖼️ Avatar</button>
              <button onClick={() => { setActiveSettingsTab('profile'); setSettingsError(''); setSettingsSuccess(''); }} className={`flex-1 py-3 text-center transition-all cursor-pointer border-b-2 rounded-t-xl ${activeSettingsTab === 'profile' ? 'border-brand-600 text-brand-600 bg-slate-50/50' : 'border-transparent hover:text-slate-800 hover:bg-slate-50'}`}>📝 Profile</button>
              <button onClick={() => { setActiveSettingsTab('username'); setSettingsError(''); setSettingsSuccess(''); }} className={`flex-1 py-3 text-center transition-all cursor-pointer border-b-2 rounded-t-xl ${activeSettingsTab === 'username' ? 'border-brand-600 text-brand-600 bg-slate-50/50' : 'border-transparent hover:text-slate-800 hover:bg-slate-50'}`}>👤 Username</button>
              <button onClick={() => { setActiveSettingsTab('password'); setSettingsError(''); setSettingsSuccess(''); }} className={`flex-1 py-3 text-center transition-all cursor-pointer border-b-2 rounded-t-xl ${activeSettingsTab === 'password' ? 'border-brand-600 text-brand-600 bg-slate-50/50' : 'border-transparent hover:text-slate-800 hover:bg-slate-50'}`}>🔑 Password</button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-left bg-white">
              {settingsError && <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-semibold shadow-sm">⚠️ {settingsError}</div>}
              {settingsSuccess && <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-xs text-green-700 font-semibold shadow-sm">✅ {settingsSuccess}</div>}

              {activeSettingsTab === 'avatar' && (
                <form onSubmit={handlePfpSubmit} className="space-y-6 text-center">
                  <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden bg-slate-100 border border-slate-200 shadow-inner group flex items-center justify-center font-bold text-slate-400 text-4xl">
                    {pfpPreview ? <img src={pfpPreview} alt="Preview" className="w-full h-full object-cover" /> : user?.username?.substring(0, 1).toUpperCase()}
                    <label className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Upload className="w-5 h-5 mb-1" /> Change
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setPfpFile(file); setPfpPreview(URL.createObjectURL(file)); } }} />
                    </label>
                  </div>
                  <button type="submit" disabled={!pfpFile || isSavingSettings} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50">
                    {isSavingSettings ? 'Saving...' : 'Upload New Profile Picture'}
                  </button>
                </form>
              )}

              {activeSettingsTab === 'profile' && (
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Public Name</label>
                    <input type="text" value={publicName} onChange={e => setPublicName(e.target.value)} maxLength={50} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 transition-all" placeholder="e.g. John Doe" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Bio</label>
                    <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={160} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 transition-all resize-none h-24" placeholder="Tell us about yourself..." />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <input type="checkbox" checked={hideLocation} onChange={e => setHideLocation(e.target.checked)} className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" />
                    <span className="text-sm font-medium text-slate-700">Hide my city/state from my profile</span>
                  </label>
                  <div className="pt-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Social Links</h4>
                    <div className="space-y-3">
                      <input type="url" value={coffeeLink} onChange={e => setCoffeeLink(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-all" placeholder="Buy Me a Coffee Link (https://...)" />
                      <input type="url" value={instagramLink} onChange={e => setInstagramLink(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-all" placeholder="Instagram Link (https://...)" />
                      <input type="url" value={twitterLink} onChange={e => setTwitterLink(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-all" placeholder="Twitter/X Link (https://...)" />
                    </div>
                  </div>
                  <button type="submit" disabled={isSavingSettings} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50 mt-4">
                    {isSavingSettings ? 'Saving...' : 'Save Profile Details'}
                  </button>
                </form>
              )}

              {activeSettingsTab === 'username' && (
                <form onSubmit={handleUsernameSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Username</label>
                    <input type="text" required value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Enter new username" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-slate-900 text-sm font-medium transition-all" />
                  </div>
                  <button type="submit" disabled={isSavingSettings || newUsername.trim() === user?.username} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50">
                    {isSavingSettings ? 'Saving...' : 'Save Username'}
                  </button>
                </form>
              )}

              {activeSettingsTab === 'password' && (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Current Password</label>
                    <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-slate-900 text-sm transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Password</label>
                    <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-slate-900 text-sm transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm New Password</label>
                    <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-slate-900 text-sm transition-all" />
                  </div>
                  <button type="submit" disabled={isSavingSettings || !currentPassword || !newPassword} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50">
                    {isSavingSettings ? 'Changing...' : 'Change Password'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
