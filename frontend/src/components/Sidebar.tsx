import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Home, Map, PlaySquare, MapPin, LogOut } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import stateDistricts from '../Data.json';

export default function Sidebar() {
  const { layout } = useLayout();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await axios.get('/api/notifications/unread-count');
        if (res.data.success) setUnreadCount(res.data.count);
      } catch (err) {
        // Ignore errors to prevent spamming console if offline
      }
    };
    
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [user, location.pathname]); // Refresh when navigating

  
  // Dynamic width based on layout
  const sidebarClass = layout === 'layout-instagram' ? 'w-20 hover:w-64 group z-50' : 'w-64';

  const textClass = layout === 'layout-instagram' ? 'opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap' : '';

  const getLinkClass = (isActive: boolean) => {
    if (isActive) {
      return "flex items-center gap-4 px-4 py-3 bg-brand-500/10 border border-brand-500/20 rounded-xl text-brand-600 font-bold transition-all overflow-hidden";
    }
    return "flex items-center gap-4 px-4 py-3 hover:bg-slate-100 border border-transparent rounded-xl text-slate-500 hover:text-slate-800 transition-all font-medium overflow-hidden";
  };

  const getRegionClass = (stateName: string) => {
    const searchParams = new URLSearchParams(location.search);
    const isActive = location.pathname === '/' && searchParams.get('state') === stateName;
    if (isActive) {
      return "flex items-center gap-4 px-4 py-2 bg-brand-500/10 border border-brand-500/20 rounded-xl text-brand-600 font-bold transition-all text-sm overflow-hidden";
    }
    return "flex items-center gap-4 px-4 py-2 hover:bg-slate-100 border border-transparent rounded-xl text-slate-500 hover:text-slate-800 transition-all text-sm font-medium overflow-hidden";
  };

  return (
    <aside className={`${sidebarClass} fixed h-[calc(100vh-64px)] top-16 overflow-y-auto hidden lg:flex flex-col py-6 px-4 border-r border-slate-200 bg-[#fcfbf8]/90 backdrop-blur-xl z-40 transition-all duration-300`}>
      <div className="space-y-2 w-full">
        <NavLink to="/" end className={({ isActive }) => getLinkClass(isActive)}>
          <Home className="w-5 h-5 shrink-0" /> 
          <span className={textClass}>Home Feed</span>
        </NavLink>
        <NavLink to="/heatmap" className={({ isActive }) => getLinkClass(isActive)}>
          <Map className="w-5 h-5 shrink-0" /> 
          <span className={textClass}>Live Heatmap</span>
        </NavLink>
        <NavLink to="/shorts" className={({ isActive }) => getLinkClass(isActive)}>
          <PlaySquare className="w-5 h-5 shrink-0" /> 
          <span className={textClass}>Quick Shorts</span>
        </NavLink>
        
        <div className="h-px bg-slate-200 my-6 mx-2"></div>
        
        {user && (
          <NavLink to="/notifications" className={({ isActive }) => getLinkClass(isActive)}>
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-1 border border-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span className={textClass}>Notifications</span>
          </NavLink>
        )}
      </div>

      {user && (
        <div className="mt-auto w-full pt-6">
          <div className="h-px bg-slate-200 mb-6 mx-2"></div>
          <div className="flex items-center justify-between px-2 gap-2">
            <Link to={`/profile?username=${user.username}`} className="flex items-center gap-3 group/profile overflow-hidden min-w-0" title={user.username}>
              <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden bg-gradient-to-tr from-brand-500 to-orange-500 flex items-center justify-center font-bold text-sm shadow-md text-white">
                {user.pfp_url ? (
                  <img src={user.pfp_url} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  user.username.substring(0, 1).toUpperCase()
                )}
              </div>
              <span className={`text-sm font-medium text-slate-600 group-hover/profile:text-slate-900 transition-colors truncate ${textClass}`}>
                {user.username}
              </span>
            </Link>
            <button 
              onClick={logout} 
              className={`p-2 shrink-0 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all ${layout === 'layout-instagram' ? 'hidden group-hover:block' : ''}`} 
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

