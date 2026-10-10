import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ThumbsUp, ThumbsDown, Share2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

import { useSearchParams } from 'react-router-dom';

export default function Shorts() {
  const [posts, setPosts] = useState<any[]>([]);
  const { user, openAuthModal } = useAuth();
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get('id');

  useEffect(() => {
    axios.get('/api/shorts').then(res => {
      let data = res.data.data || [];
      if (targetId) {
        const targetIndex = data.findIndex((p: any) => p._id === targetId || p.id === targetId);
        if (targetIndex > -1) {
          const target = data.splice(targetIndex, 1)[0];
          data.unshift(target);
        }
      }
      setPosts(data);
    });
  }, [targetId]);

  const handleVote = async (postId: string, type: string) => {
    try {
      const res = await axios.post('/api/votes?action=vote', { post_id: postId, type });
      // Update local state naively for demo
      setPosts(prev => prev.map(p => {
        if (p._id === postId) {
          p.upvotes = res.data.upvotes;
          p.downvotes = res.data.downvotes;
        }
        return p;
      }));
    } catch (err) {
      if (!user) {
        openAuthModal();
      } else {
        alert('Failed to vote');
      }
    }
  };

  return (
    <div className="max-w-[400px] mx-auto h-[calc(100vh-80px)] snap-y snap-mandatory overflow-y-scroll hide-scrollbar rounded-2xl bg-black relative shadow-2xl ring-1 ring-dark-700">
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <h2 className="text-xl font-bold text-gray-300">No shorts available</h2>
        </div>
      ) : (
        posts.map(post => (
          <div key={post._id} className="h-full w-full snap-start relative group bg-dark-900 flex items-center justify-center">
            {post.mime_type?.startsWith('image/') ? (
              <img src={post.media_url} className="w-full h-full object-contain" />
            ) : (
              <video 
                className="w-full h-full object-cover cursor-pointer" 
                loop playsInline autoPlay muted
                onClick={(e) => {
                  const v = e.target as HTMLVideoElement;
                  v.paused ? v.play() : v.pause();
                }}
              >
                <source src={post.media_url} type={post.mime_type || 'video/mp4'} />
              </video>
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80 pointer-events-none"></div>

            <div className="absolute bottom-6 left-4 right-16 pointer-events-auto">
              <h3 className="text-white font-bold text-lg leading-tight mb-1">{post.title}</h3>
              <p className="text-gray-300 text-sm line-clamp-2 mb-3">{post.description}</p>
              <Link to={`/profile?username=${post.author}`} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-500 flex items-center justify-center font-bold text-sm text-white">
                  {post.author_pfp ? (
                    <img src={post.author_pfp} alt={post.author} className="w-full h-full object-cover" />
                  ) : (
                    post.author.substring(0, 1).toUpperCase()
                  )}
                </div>
                <span className="font-medium text-white shadow-sm">@{post.author}</span>
              </Link>
            </div>

            <div className="absolute right-4 bottom-6 flex flex-col items-center gap-6 pointer-events-auto">
              <button onClick={() => handleVote(post._id, 'upvote')} className="flex flex-col items-center group">
                <div className="w-12 h-12 rounded-full bg-dark-800/80 backdrop-blur flex items-center justify-center hover:bg-brand-500 hover:text-white transition-colors text-white">
                  <ThumbsUp className="w-6 h-6" />
                </div>
                <span className="text-white text-xs font-bold mt-1 drop-shadow-md">{post.upvotes || 0}</span>
              </button>

              <button onClick={() => handleVote(post._id, 'downvote')} className="flex flex-col items-center group">
                <div className="w-12 h-12 rounded-full bg-dark-800/80 backdrop-blur flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors text-white">
                  <ThumbsDown className="w-6 h-6" />
                </div>
                <span className="text-white text-xs font-bold mt-1 drop-shadow-md">{post.downvotes || 0}</span>
              </button>

              <button className="flex flex-col items-center group" onClick={() => navigator.share({title: post.title, url: window.location.href})}>
                <div className="w-12 h-12 rounded-full bg-dark-800/80 backdrop-blur flex items-center justify-center hover:bg-gray-600 hover:text-white transition-colors text-white">
                  <Share2 className="w-5 h-5" />
                </div>
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
