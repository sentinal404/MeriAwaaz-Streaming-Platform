import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Bell, Heart, UserPlus, Eye, CheckCircle, XCircle, PlaySquare, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Notification {
    id: string;
    type: 'like' | 'follow' | 'view' | 'verify' | 'reject' | 'new_follower_video';
    actor_username: string;
    post_id: string | null;
    is_read: boolean;
    created_at: string;
}

export default function Notifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const fetchNotifications = async () => {
            try {
                const res = await axios.get('/api/notifications');
                if (res.data.success) {
                    setNotifications(res.data.data);
                }
            } catch (err) {
                console.error("Failed to fetch notifications:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchNotifications();
    }, [user]);

    const markAllAsRead = async () => {
        try {
            const res = await axios.post('/api/notifications/read-all');
            if (res.data.success) {
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            }
        } catch (err) {
            console.error("Failed to mark all as read:", err);
        }
    };

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center p-20 glass-card rounded-3xl text-center mt-10">
                <Bell className="w-16 h-16 text-slate-400 mb-5" />
                <h2 className="text-xl font-bold text-slate-700">Please log in to view notifications.</h2>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="w-full max-w-2xl mx-auto mt-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-full h-20 bg-slate-200 animate-pulse rounded-2xl"></div>
                ))}
            </div>
        );
    }

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const getIcon = (type: string) => {
        switch (type) {
            case 'like': return <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />;
            case 'follow': return <UserPlus className="w-5 h-5 text-brand-500" />;
            case 'view': return <Eye className="w-5 h-5 text-blue-500" />;
            case 'verify': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'reject': return <XCircle className="w-5 h-5 text-red-500" />;
            case 'new_follower_video': return <PlaySquare className="w-5 h-5 text-purple-500" />;
            default: return <Bell className="w-5 h-5 text-slate-500" />;
        }
    };

    const getMessage = (notification: Notification) => {
        const actor = <span className="font-bold text-slate-800">{notification.actor_username}</span>;
        switch (notification.type) {
            case 'like': return <>{actor} liked your video.</>;
            case 'follow': return <>{actor} started following you.</>;
            case 'view': return <>{actor} viewed your profile.</>;
            case 'verify': return <>Your pending video was <span className="font-bold text-green-600">approved</span> by {actor}.</>;
            case 'reject': return <>Your pending video was <span className="font-bold text-red-600">rejected</span> by {actor}.</>;
            case 'new_follower_video': return <>{actor} uploaded a new verified video.</>;
            default: return <>New notification from {actor}.</>;
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto mt-6 pb-20">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <Bell className="w-6 h-6 text-brand-500" />
                    Notifications
                </h1>
                {unreadCount > 0 && (
                    <button 
                        onClick={markAllAsRead}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-xl font-semibold text-sm transition-colors"
                    >
                        <Check className="w-4 h-4" />
                        Mark all as read
                    </button>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 glass-card rounded-3xl text-center">
                    <Bell className="w-16 h-16 text-slate-300 mb-5" />
                    <h2 className="text-xl font-bold text-slate-600">No notifications yet.</h2>
                    <p className="text-slate-400 mt-2">When you interact with the community, your notifications will appear here.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notifications.map((notification) => (
                        <div 
                            key={notification.id} 
                            className={`flex items-start gap-4 p-4 rounded-2xl border transition-colors ${
                                !notification.is_read 
                                ? 'bg-brand-50/50 border-brand-200' 
                                : 'bg-white border-slate-100 hover:border-slate-200'
                            }`}
                        >
                            <div className="mt-1 shrink-0 bg-white w-10 h-10 rounded-full shadow-sm flex items-center justify-center border border-slate-100">
                                {getIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                                <p className="text-[15px] text-slate-600">
                                    {getMessage(notification)}
                                </p>
                                <p className="text-xs font-medium text-slate-400 mt-1.5">
                                    {new Date(notification.created_at).toLocaleString()}
                                </p>
                            </div>
                            {['verify', 'like', 'new_follower_video'].includes(notification.type) && notification.post_id && (
                                <Link 
                                    to={`/watch?id=${notification.post_id}`}
                                    className="shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                                >
                                    View Video
                                </Link>
                            )}
                            {['follow', 'view'].includes(notification.type) && (
                                <Link 
                                    to={`/profile?username=${notification.actor_username}`}
                                    className="shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                                >
                                    View Profile
                                </Link>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
