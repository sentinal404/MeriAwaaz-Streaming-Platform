import { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, Search, Video, ShieldAlert, LogOut, MoreVertical } from 'lucide-react';
import axios from 'axios';

interface UploadStats {
  used: number;
  limit: number;
  remaining: number;
}

export default function Navbar() {
  const { user, openAuthModal, logout } = useAuth();
  const location = useLocation();
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      axios.get('/api/posts/upload-limit')
        .then(res => setUploadStats(res.data))
        .catch(err => console.error("Failed to load upload limit", err));
    } else {
      setUploadStats(null);
    }
  }, [user, location.pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <nav className="fixed top-0 w-full z-50 px-4 md:px-6 py-3 glass flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3 md:gap-4">
        <button className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-800 lg:hidden">
          <Menu className="w-5 h-5 md:w-6 md:h-6" />
        </button>
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Meri Awaaz" className="w-7 h-7 md:w-8 md:h-8 object-contain" />
          <span className="text-slate-800 font-bold text-lg md:text-xl tracking-tight hidden sm:block">Meri Awaaz</span>
        </Link>
      </div>

      {!location.pathname.startsWith('/admin') && (
        <div className="hidden md:flex flex-1 max-w-xl mx-8">
          <form action="/" method="GET" className="w-full flex items-center group">
            <div className="flex w-full bg-white/50 border border-slate-200 rounded-full overflow-hidden focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500/50 transition-all shadow-inner">
              <input type="text" name="q" placeholder="Search news..." className="w-full bg-transparent px-5 py-2.5 text-sm text-slate-800 focus:outline-none placeholder-slate-400" />
              <button type="submit" className="px-5 py-2.5 text-slate-400 hover:text-brand-500 hover:bg-slate-100 transition-colors">
              <Search className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center gap-2 md:gap-4 relative" ref={dropdownRef}>
        {!location.pathname.startsWith('/admin') && (
          <>
            {user ? (
              <>
                {/* Desktop Actions */}
                <div className="hidden md:flex items-center gap-3">
                  {user.role !== 'moderator' && (
                    <>
                      {uploadStats !== null && (
                        <span className="text-[11px] text-slate-500 font-semibold bg-slate-100/80 border border-slate-200/60 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-inner">
                          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${uploadStats.remaining === 0 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]' : 'bg-brand-500 shadow-[0_0_8px_rgba(37,99,235,0.7)]'}`}></span>
                          <span>{uploadStats.remaining} / {uploadStats.limit} left</span>
                        </span>
                      )}
                      <Link to="/upload" className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-full text-sm font-medium transition-all shadow-lg hover:shadow-[0_0_20px_rgba(37,99,235,0.5)]">
                        <Video className="w-4 h-4" />
                        <span>Upload</span>
                      </Link>
                    </>
                  )}
                  {(user.role === 'admin' || user.role === 'moderator') && (
                    <Link to="/admin" className="text-xs text-brand-600 hover:text-brand-500 font-medium flex items-center gap-1 bg-brand-50 px-3 py-2 rounded-full border border-brand-100">
                      <ShieldAlert className="w-4 h-4" /> Dashboard
                    </Link>
                  )}
                  <button onClick={logout} className="text-sm font-medium text-slate-700 hover:text-red-600 transition-colors bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-full shadow-sm flex items-center gap-2">
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>

                {/* Mobile Actions Toggle */}
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                  className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {/* Mobile Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden py-1 md:hidden animate-in fade-in slide-in-from-top-2">
                    {user.role !== 'moderator' && (
                      <>
                        {uploadStats !== null && (
                          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                            <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${uploadStats.remaining === 0 ? 'bg-red-500' : 'bg-brand-500'}`}></span>
                              {uploadStats.remaining} / {uploadStats.limit} uploads left
                            </span>
                          </div>
                        )}
                        <Link to="/upload" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors">
                          <Video className="w-4 h-4 text-brand-500" /> Upload Video
                        </Link>
                      </>
                    )}
                    {(user.role === 'admin' || user.role === 'moderator') && (
                      <Link to="/admin" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors border-t border-slate-100">
                        <ShieldAlert className="w-4 h-4 text-brand-500" /> Admin Dashboard
                      </Link>
                    )}
                    <div className="border-t border-slate-100 my-1"></div>
                    <button onClick={() => { setIsDropdownOpen(false); logout(); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors">
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button onClick={openAuthModal} className="text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors bg-white hover:bg-slate-50 border border-slate-200 px-4 md:px-5 py-1.5 md:py-2 rounded-full shadow-sm">
                Sign In
              </button>
            )}
          </>
        )}
      </div>
    </nav>
  );
}
