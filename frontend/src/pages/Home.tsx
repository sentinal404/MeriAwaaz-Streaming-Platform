import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Inbox, Play, Heart, MessageCircle, Share2, MoreHorizontal, MapPin, ChevronDown } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';
import { useAuth } from '../context/AuthContext';
import VideoThumbnail from '../components/VideoThumbnail';
import stateDistricts from '../Data.json';

interface Post {
  _id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  media_url: string;
  status: string;
  duration: number;
  author: string;
  views: number;
  city: string;
  mime_type?: string;
  author_pfp?: string | null;
}

export default function Home() {
  const [searchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [shorts, setShorts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [detectedRegion, setDetectedRegion] = useState<{ state: string; city: string } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { layout } = useLayout();
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const state = searchParams.get('state') || '';
  const city = searchParams.get('city') || '';

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/feed?state=${state}&city=${city}`);
        if (res.data.status === 'success') {
          setPosts(res.data.data);
          setDetectedRegion(res.data.detected_region || null);
        }
      } catch (err) {
        console.error('Failed to fetch feed', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, [state, city]);

  useEffect(() => {
    const fetchShorts = async () => {
      try {
        const res = await axios.get('/api/shorts');
        if (res.data.status === 'success') {
          setShorts(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch shorts', err);
      }
    };
    fetchShorts();
  }, []);

  if (loading) {
    return (
      <div className="w-full">
        {layout === 'layout-instagram' && (
          <div className="flex flex-col items-center gap-8 pb-10 w-full max-w-[470px] mx-auto">
            <div className="flex items-center gap-4 overflow-x-hidden w-full py-4">
               {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-16 h-16 rounded-full bg-slate-200 animate-pulse shrink-0"></div>
               ))}
            </div>
            {[...Array(3)].map((_, i) => (
               <div key={`post-${i}`} className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center gap-3 p-3">
                     <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse"></div>
                     <div className="h-4 bg-slate-200 rounded w-24 animate-pulse"></div>
                  </div>
                  <div className="w-full aspect-[4/5] bg-slate-200 animate-pulse"></div>
                  <div className="p-3 space-y-3">
                     <div className="h-6 bg-slate-200 rounded w-32 animate-pulse"></div>
                     <div className="h-4 bg-slate-200 rounded w-full animate-pulse"></div>
                     <div className="h-4 bg-slate-200 rounded w-2/3 animate-pulse"></div>
                  </div>
               </div>
            ))}
          </div>
        )}
        
        {(layout === 'layout-youtube' || layout === 'layout-news') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10 mt-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className={`w-full aspect-video bg-slate-200 animate-pulse ${layout === 'layout-news' ? 'rounded-2xl border border-slate-200' : 'rounded-xl'}`}></div>
                <div className="flex gap-3 px-1">
                  <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse shrink-0"></div>
                  <div className="flex flex-col gap-2 w-full pt-1">
                    <div className="h-4 bg-slate-200 rounded w-[90%] animate-pulse"></div>
                    <div className="h-3 bg-slate-200 rounded w-[60%] animate-pulse"></div>
                    <div className="h-3 bg-slate-200 rounded w-[40%] animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const hasNoPosts = !Array.isArray(posts) || posts.length === 0 || !posts[0];

  return (
    <>

      {hasNoPosts ? (
        <div className="flex flex-col items-center justify-center p-20 glass-card rounded-3xl text-center mt-10">
          <Inbox className="w-16 h-16 text-slate-400 mb-5" />
          <h2 className="text-xl font-bold text-slate-700">No live streams or news available.</h2>
          <Link to="/upload" className="mt-5 text-brand-500 font-semibold hover:text-brand-600 transition-colors">
            Start a stream
          </Link>
        </div>
      ) : (
        <div className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              {/* Anonymous GPS Auto-detected Region */}
              {detectedRegion && !state && !city && (
                <p className="text-sm font-semibold text-brand-600 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> Auto-detected region: <span className="capitalize text-brand-700">{detectedRegion.city ? `${detectedRegion.city}, ` : ''}{detectedRegion.state}</span>
                </p>
              )}
              {state && (
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-brand-500" />
                  Showing Feed for {state}
                </h2>
              )}
            </div>
            
            <div className="relative z-20">
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-brand-300 rounded-xl text-sm font-medium text-slate-700 hover:text-brand-600 transition-all shadow-sm group"
              >
                <MapPin className="w-4 h-4 text-brand-500" />
                <span>{state ? state : 'Explore Regions'}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-80 overflow-y-auto scrollbar-thin">
                      <button 
                        onClick={() => { navigate('/'); setDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${!state ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:bg-slate-50 hover:text-brand-600'}`}
                      >
                        Global Feed
                      </button>
                      <div className="h-px w-full bg-slate-100"></div>
                      {Object.keys(stateDistricts).map((stateName) => (
                        <button
                          key={stateName}
                          onClick={() => { navigate(`/?state=${encodeURIComponent(stateName)}`); setDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${state === stateName ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:bg-slate-50 hover:text-brand-600'}`}
                        >
                          {stateName}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* LAYOUT: INSTAGRAM */}
          {layout === 'layout-instagram' && (
            <div className="flex flex-col items-center gap-8 pb-10 w-full max-w-[470px] mx-auto">
              {/* Instagram Stories Simulator */}
              <div className="flex items-center gap-4 overflow-x-auto w-full py-4 hide-scrollbar">
                {posts.slice(0, 6).map(p => (
                  <Link to={`/watch?id=${p._id}`} key={`story-${p._id}`} className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-red-500 to-fuchsia-600">
                      <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-slate-100 flex items-center justify-center font-bold text-slate-800">
                        {p.author_pfp ? (
                          <img src={p.author_pfp} alt={p.author} className="w-full h-full object-cover" />
                        ) : (
                          (p.author || '?').substring(0, 1).toUpperCase()
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-700 font-medium max-w-[64px] truncate">{p.author || 'User'}</span>
                  </Link>
                ))}
              </div>

              {/* Feed */}
              {posts.map((post) => (
                <div key={post._id} className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center font-bold text-white text-xs">
                        {post.author_pfp ? (
                          <img src={post.author_pfp} alt={post.author} className="w-full h-full object-cover" />
                        ) : (
                          (post.author || '?').substring(0, 1).toUpperCase()
                        )}
                      </div>
                      <span className="font-semibold text-sm text-slate-800">{post.author || 'Unknown'}</span>
                    </div>
                    <MoreHorizontal className="w-5 h-5 text-slate-400" />
                  </div>
                  
                  <Link to={`/watch?id=${post._id}`} className="block relative w-full aspect-[4/5] bg-slate-100 overflow-hidden group">
                    <VideoThumbnail
                      postId={post._id}
                      mediaUrl={post.media_url}
                      thumbnailUrl={post.thumbnail_url}
                      mimeType={post.mime_type}
                      title={post.title}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <Play className="w-16 h-16 text-white/90" />
                    </div>
                  </Link>

                  <div className="p-3">
                    <div className="flex items-center gap-4 mb-3">
                      <Heart 
                        className="w-6 h-6 text-slate-800 hover:text-red-500 cursor-pointer transition-colors" 
                        onClick={() => {
                          if (!user) {
                            openAuthModal();
                          }
                        }}
                      />
                      <MessageCircle 
                        className="w-6 h-6 text-slate-800 hover:text-slate-500 cursor-pointer transition-colors" 
                        onClick={() => {
                          if (!user) {
                            openAuthModal();
                          }
                        }}
                      />
                      <Share2 className="w-6 h-6 text-slate-800 hover:text-brand-500 cursor-pointer transition-colors" />
                    </div>
                    <div className="font-semibold text-sm mb-1 text-slate-800">{post.views || 0} views</div>
                    <div className="text-sm text-slate-800">
                      <span className="font-semibold mr-2">{post.author || 'Unknown'}</span>
                      <span className="text-slate-600">{post.title}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-2 uppercase font-medium">{post.city ? post.city : 'Location unknown'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LAYOUT: YOUTUBE OR NEWS GRID */}
          {(layout === 'layout-youtube' || layout === 'layout-news') && (
            <div className="w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10 mt-6">
                {posts.map((post) => {
                  const durationMin = Math.floor((post.duration || 0) / 60);
                  const durationSec = (post.duration || 0) % 60;
                  const formattedDuration = `${durationMin}:${durationSec.toString().padStart(2, '0')}`;

                  return (
                    <Link to={`/watch?id=${post._id}`} key={post._id} className="group flex flex-col cursor-pointer relative transition-all duration-300">
                      <div className={`relative w-full aspect-video bg-slate-100 overflow-hidden mb-3 ${layout === 'layout-news' ? 'rounded-2xl border border-slate-200 shadow-sm' : 'rounded-xl'}`}>
                        <VideoThumbnail
                          postId={post._id}
                          mediaUrl={post.media_url}
                          thumbnailUrl={post.thumbnail_url}
                          mimeType={post.mime_type}
                          title={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                        
                        {post.duration > 0 && (
                          <div className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-sm text-white text-xs font-semibold px-1.5 py-0.5 rounded z-20">
                            {formattedDuration}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 px-1">
                        <div className="w-9 h-9 mt-0.5 rounded-full overflow-hidden bg-gradient-to-tr from-brand-600 to-brand-400 shrink-0 flex items-center justify-center font-bold text-white text-sm shadow-sm">
                          {post.author_pfp ? (
                            <img src={post.author_pfp} alt={post.author} className="w-full h-full object-cover" />
                          ) : (
                            (post.author || '?').substring(0, 1).toUpperCase()
                          )}
                        </div>
                        <div className="flex flex-col">
                          <h3 className="font-semibold text-[15px] text-slate-800 leading-snug group-hover:text-brand-600 transition-colors line-clamp-2">
                            {post.title || 'Untitled'}
                          </h3>
                          <p className="text-sm text-slate-500 mt-1 hover:text-slate-700 transition-colors font-medium">
                            {post.author || ''}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                            {post.views || 0} views • {post.city ? post.city.charAt(0).toUpperCase() + post.city.slice(1) : 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* YouTube-style Shorts shelf */}
              {shorts.length > 0 && (
                <div className="mt-14 border-t border-slate-200/60 pt-10 pb-10">
                  <div className="flex items-center gap-2 mb-6">
                    <svg className="w-6 h-6 text-red-600 fill-red-600 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.77 10.32l-1.2-.69a2 2 0 00-2.73.73l-2.62 4.56-1.52-.88a2 2 0 00-2.73.73l-1.2.69a2 2 0 00.73 2.73l1.2.69a2 2 0 002.73-.73l2.62-4.56 1.52.88a2 2 0 002.73-.73l1.2-.69a2 2 0 00-.73-2.73zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    </svg>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">Shorts</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {shorts.slice(0, 6).map((short) => (
                      <Link to={`/shorts?id=${short._id}`} key={short._id} className="group flex flex-col relative transition-all duration-300">
                        <div className="relative w-full aspect-[9/16] bg-slate-900 rounded-2xl overflow-hidden shadow-md border border-slate-200/50">
                          <VideoThumbnail
                            postId={short._id}
                            mediaUrl={short.media_url}
                            thumbnailUrl={short.thumbnail_url}
                            mimeType={short.mime_type}
                            title={short.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                          />
                        </div>
                        <div className="mt-3 px-1">
                          <h4 className="font-semibold text-sm text-slate-800 leading-snug line-clamp-2 group-hover:text-brand-600 transition-colors">
                            {short.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-1 font-medium">
                            {short.views || 0} views
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
