import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface WatchData {
  post: any;
  related: any[];
  upvotes: number;
  downvotes: number;
  is_owner?: boolean;
  is_following?: boolean;
}


export default function Watch() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const [data, setData] = useState<WatchData | null>(null);
  const { user, openAuthModal } = useAuth();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState('Fake News');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (data && data.is_following !== undefined) {
      setIsFollowing(data.is_following);
    }
  }, [data]);

  const handleFollow = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    try {
      const res = await axios.post(`/api/follow?action=toggle`, { username: data?.post?.author });
      if (res.data.success) {
        setIsFollowing(res.data.isFollowing);
      }
    } catch (err) {
      alert('Failed to update follow status');
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard!');
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this video? This action is irreversible.")) return;
    setIsDeleting(true);
    try {
      const res = await axios.delete(`/api/posts/${id}`);
      if (res.data.success) {
        alert('Video deleted successfully');
        window.location.href = '/';
      }
    } catch (err) {
      alert('Failed to delete video');
      setIsDeleting(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setIsReportModalOpen(false);
      openAuthModal();
      return;
    }
    setIsSubmittingReport(true);
    try {
      const res = await axios.post('/api/reports', {
        post_id: id,
        category: reportCategory,
        description: reportDescription
      });
      if (res.data.success) {
        alert('Report submitted successfully.');
        setIsReportModalOpen(false);
        setReportDescription('');
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit report. Please try again later.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    const fetchWatch = async () => {
      try {
        const res = await axios.get(`/api/watch?id=${id}`);
        setData(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchWatch();
  }, [id]);

  const handleVote = async (type: string) => {
    try {
      const res = await axios.post('/api/votes?action=vote', { post_id: id, type });
      if (res.data.success) {
        const fetchRes = await axios.get(`/api/watch?id=${id}`);
        setData(fetchRes.data);
      }
    } catch (err) {
      if (!user) {
        openAuthModal();
      } else {
        alert('Failed to vote');
      }
    }
  };

  if (!data) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 max-w-[1600px] mx-auto animate-pulse">
        <div className="xl:col-span-2">
          <div className="bg-slate-200 rounded-2xl w-full aspect-video shadow-lg mb-4"></div>
          <div className="h-8 bg-slate-200 rounded w-3/4 mb-4"></div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                <div>
                   <div className="h-4 bg-slate-200 rounded w-24 mb-2"></div>
                   <div className="h-3 bg-slate-200 rounded w-16"></div>
                </div>
             </div>
             <div className="w-24 h-10 bg-slate-200 rounded-full"></div>
          </div>
        </div>
        <div className="xl:col-span-1 space-y-4">
          <div className="h-6 bg-slate-200 rounded w-32 mb-6"></div>
          {[...Array(5)].map((_, i) => (
             <div key={i} className="flex gap-3">
                <div className="w-40 aspect-video bg-slate-200 rounded-lg shrink-0"></div>
                <div className="flex flex-col gap-2 w-full pt-1">
                   <div className="h-4 bg-slate-200 rounded w-full"></div>
                   <div className="h-4 bg-slate-200 rounded w-4/5"></div>
                   <div className="h-3 bg-slate-200 rounded w-1/2 mt-2"></div>
                </div>
             </div>
          ))}
        </div>
      </div>
    );
  }

  const { post, related, upvotes, downvotes } = data;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 max-w-[1600px] mx-auto">
      <div className="xl:col-span-2">
        <div className="bg-black rounded-2xl overflow-hidden aspect-video shadow-lg relative flex items-center justify-center group">
          {post.mime_type?.startsWith('image/') ? (
            <img src={post.media_url} alt={post.title} className="max-w-full max-h-full object-contain" />
          ) : (
            <video key={post._id} controls autoPlay className="w-full h-full object-contain z-10">
              <source src={post.media_url} type={post.mime_type || 'video/mp4'} />
            </video>
          )}
        </div>

        <div className="mt-4 pb-4 border-b border-slate-200">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">{post.title}</h1>
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to={`/profile?username=${post.author}`} className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-brand-500 to-orange-500 flex items-center justify-center font-bold text-white text-lg shadow-md group-hover:ring-2 ring-brand-500 transition-all">
                  {post.author_pfp ? (
                    <img src={post.author_pfp} alt={post.author} className="w-full h-full object-cover" />
                  ) : (
                    post.author.substring(0, 1).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 group-hover:text-brand-500 transition-colors">{post.author}</p>
                  <p className="text-xs text-slate-500">{post.views || 0} views</p>
                </div>
              </Link>
              {data.is_owner ? (
                <Link to={`/profile?username=${post.author}`} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-full transition-colors ml-2">
                  See Profile
                </Link>
              ) : (
                <button 
                  onClick={handleFollow}
                  className={`text-xs font-bold px-4 py-2 rounded-full transition-colors ml-2 ${isFollowing ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/20'}`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-slate-100 rounded-full border border-slate-200 overflow-hidden shadow-sm">
                <button onClick={() => handleVote('upvote')} className="flex items-center gap-2 px-5 py-2 hover:bg-slate-200 transition-colors text-slate-700 font-medium group border-r border-slate-200">
                  <ThumbsUp className="w-5 h-5 text-slate-500 group-hover:text-brand-500 transition-colors" />
                  <span>{upvotes || 0}</span>
                </button>
                <button onClick={() => handleVote('downvote')} className="flex items-center gap-2 px-5 py-2 hover:bg-slate-200 transition-colors text-slate-700 font-medium group">
                  <ThumbsDown className="w-5 h-5 text-slate-500 group-hover:text-red-500 transition-colors" />
                  <span>{downvotes || 0}</span>
                </button>
              </div>

              <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-full border border-slate-200 transition-colors text-slate-700 font-medium shadow-sm">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                Share
              </button>

              {data.is_owner ? (
                <button onClick={handleDelete} disabled={isDeleting} className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-full border border-red-100 transition-colors font-medium shadow-sm cursor-pointer disabled:opacity-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              ) : (
                <button onClick={() => setIsReportModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full border border-slate-200 transition-colors font-medium shadow-sm">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path></svg>
                  Report
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 bg-slate-100/50 border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600 mb-2">
            <span>{new Date(post.created_at).toLocaleDateString()}</span>
            <span className="w-1 h-1 rounded-full bg-slate-400"></span>
            <span className="bg-slate-200/50 border border-slate-300/50 px-2.5 py-1 rounded-md text-slate-700 capitalize shadow-sm">{post.city}, {post.state}</span>
          </div>
          <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{post.description}</p>
        </div>
      </div>

      <div className="xl:col-span-1">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">Up Next</h3>
        <div className="flex flex-col gap-3">
          {related.map(rel => (
            <Link to={`/watch?id=${rel._id}`} key={rel._id} className="flex gap-3 group p-2 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-200">
              <div className="relative w-40 shrink-0 aspect-video bg-black rounded-lg overflow-hidden shadow-sm">
                <img src={rel.thumbnail_url || 'https://images.unsplash.com/photo-1495020689067-958852a7765e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="flex flex-col py-0.5 justify-start">
                <h4 className="font-semibold text-sm text-slate-900 line-clamp-2 group-hover:text-brand-600 transition-colors leading-snug">{rel.title}</h4>
                <p className="text-[13px] text-slate-600 mt-1">{rel.author}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">{rel.views || 0} views • {new Date(rel.created_at).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Report Video</h3>
              <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <form onSubmit={handleReportSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Reason for reporting</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-medium"
                >
                  <option value="Fake News">Fake News</option>
                  <option value="Misleading">Misleading</option>
                  <option value="Illegal Activity">Illegal Activity</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Spam">Spam</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  maxLength={500}
                  rows={4}
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Provide more details to help us investigate..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-medium resize-none"
                />
                <div className="text-right text-xs mt-1 font-medium text-slate-500">
                  <span className={reportDescription.length >= 500 ? 'text-red-500' : ''}>{reportDescription.length}</span>/500
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm shadow-red-500/20 transition-colors disabled:opacity-50"
                >
                  {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

