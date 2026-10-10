import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, ShieldAlert, Activity, Users, Settings, Play, Square, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// API routes will be proxyed by Vite
const API_BASE = '/api';

export default function AdminAI() {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    const [stats, setStats] = useState({ totalLogs: 0, suspiciousLogs: 0, activeThreats: 0, bannedUsers: 0 });
    const [logs, setLogs] = useState<any[]>([]);
    const [actions, setActions] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>({
        ai_enabled: false,
        endpoint_url: 'https://nature-developers-culture-conferencing.trycloudflare.com/api/generate',
        model_name: 'qwen:7b',
        api_key: '',
        batch_size: 750,
        analysis_interval_ms: 60000,
        auto_action_toggle: false
    });
    const [activeTab, setActiveTab] = useState<'feed' | 'decisions' | 'settings'>('feed');

    useEffect(() => {
        if (!user || user.role !== 'admin') {
            navigate('/');
            return;
        }

        const fetchInitialData = async () => {
            try {
                const [statsRes, logsRes, settingsRes, actionsRes] = await Promise.all([
                    axios.get(`${API_BASE}/admin/ai/stats`),
                    axios.get(`${API_BASE}/admin/ai/logs`),
                    axios.get(`${API_BASE}/admin/ai/settings`),
                    axios.get(`${API_BASE}/admin/ai/actions`)
                ]);
                
                setStats(statsRes.data.stats);
                setLogs(logsRes.data.logs || []);
                setSettings(settingsRes.data.settings || settings);
                setActions(actionsRes.data.actions || []);
            } catch (err) {
                console.error("Failed to load AI Admin data", err);
            }
        };

        fetchInitialData();

        // Connect to SSE stream
        const eventSource = new EventSource(`${API_BASE}/admin/ai/logs/stream`);
        eventSource.onmessage = (event) => {
            const newLog = JSON.parse(event.data);
            setLogs(prev => [newLog, ...prev].slice(0, 500)); // Keep last 500
            setStats(prev => ({ ...prev, totalLogs: prev.totalLogs + 1 }));
        };

        return () => {
            eventSource.close();
        };
    }, [user, navigate]);

    const saveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post(`${API_BASE}/admin/ai/settings`, settings);
            alert("Settings saved successfully.");
        } catch (err) {
            alert("Failed to save settings.");
        }
    };

    const reverseAction = async (id: string) => {
        try {
            await axios.post(`${API_BASE}/admin/ai/actions/${id}/reverse`);
            setActions(actions.map(a => a._id === id ? { ...a, status: 'reversed' } : a));
            alert("Action reversed successfully.");
        } catch (err) {
            alert("Failed to reverse action.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 pt-24 font-mono">
            <div className="max-w-7xl mx-auto space-y-8">
                
                <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                    <div className="flex items-center gap-3">
                        <Shield className="w-8 h-8 text-indigo-500" />
                        <h1 className="text-3xl font-bold tracking-tight">AI Blue Teamer <span className="text-sm font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded ml-2">SOC Dashboard</span></h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {settings.ai_enabled ? (
                            <span className="flex items-center gap-2 text-green-400 bg-green-400/10 px-3 py-1.5 rounded border border-green-400/20">
                                <Activity className="w-4 h-4 animate-pulse" /> Active Protection
                            </span>
                        ) : (
                            <span className="flex items-center gap-2 text-yellow-500 bg-yellow-500/10 px-3 py-1.5 rounded border border-yellow-500/20">
                                <Square className="w-4 h-4" /> Monitoring Only
                            </span>
                        )}
                    </div>
                </div>

                {/* Widgets */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-lg shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Activity className="w-16 h-16" /></div>
                        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Total Events</h3>
                        <p className="text-3xl font-bold text-white mt-2">{stats.totalLogs.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-lg shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><AlertTriangle className="w-16 h-16 text-yellow-500" /></div>
                        <h3 className="text-yellow-500 text-sm font-medium uppercase tracking-wider">Suspicious Events</h3>
                        <p className="text-3xl font-bold text-white mt-2">{stats.suspiciousLogs.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-lg shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldAlert className="w-16 h-16 text-red-500" /></div>
                        <h3 className="text-red-400 text-sm font-medium uppercase tracking-wider">Active Threats Blocked</h3>
                        <p className="text-3xl font-bold text-white mt-2">{stats.activeThreats.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-lg shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Users className="w-16 h-16 text-indigo-500" /></div>
                        <h3 className="text-indigo-400 text-sm font-medium uppercase tracking-wider">Banned Users</h3>
                        <p className="text-3xl font-bold text-white mt-2">{stats.bannedUsers.toLocaleString()}</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700">
                    <button 
                        onClick={() => setActiveTab('feed')}
                        className={`px-6 py-3 font-medium transition-colors ${activeTab === 'feed' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400 hover:text-white'}`}
                    >
                        Live Threat Feed
                    </button>
                    <button 
                        onClick={() => setActiveTab('decisions')}
                        className={`px-6 py-3 font-medium transition-colors ${activeTab === 'decisions' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400 hover:text-white'}`}
                    >
                        AI Decisions & Reversals
                    </button>
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${activeTab === 'settings' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Settings className="w-4 h-4" /> Configuration
                    </button>
                </div>

                {/* Content */}
                <div className="bg-slate-800 border border-slate-700 rounded-lg min-h-[500px]">
                    {activeTab === 'feed' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-900/50 border-b border-slate-700 text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Timestamp</th>
                                        <th className="px-4 py-3 font-medium">Action</th>
                                        <th className="px-4 py-3 font-medium">User/IP</th>
                                        <th className="px-4 py-3 font-medium">Endpoint</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3 font-medium">AI Risk</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {logs.map((log, idx) => (
                                        <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="px-4 py-3 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                            <td className="px-4 py-3 font-medium text-slate-300">
                                                <span className={`px-2 py-0.5 rounded text-xs ${
                                                    log.action_type.includes('Login') ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                                                    log.action_type.includes('Delete') ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                    'bg-slate-700 text-slate-300'
                                                }`}>
                                                    {log.action_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-200">{log.username !== 'anonymous' ? log.username : log.ip_address}</span>
                                                    {log.username !== 'anonymous' && <span className="text-xs text-slate-500">{log.ip_address}</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate" title={log.endpoint}>
                                                <span className={`mr-2 font-bold ${log.method === 'GET' ? 'text-green-500' : 'text-yellow-500'}`}>{log.method}</span>
                                                {log.endpoint}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs ${log.status_code >= 400 ? 'text-red-400 bg-red-400/10' : 'text-green-400 bg-green-400/10'}`}>
                                                    {log.status_code}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {log.is_processed ? (
                                                    <span className={`font-bold ${log.risk_score > 70 ? 'text-red-500' : log.risk_score > 40 ? 'text-yellow-500' : 'text-green-500'}`}>
                                                        {log.risk_score}/100
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500 animate-pulse">Analyzing...</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'decisions' && (
                        <div className="p-6 space-y-4">
                            {actions.length === 0 ? (
                                <p className="text-slate-400 text-center py-12">No AI actions have been executed yet.</p>
                            ) : (
                                actions.map(action => (
                                    <div key={action._id} className={`p-4 rounded-lg border ${action.status === 'reversed' ? 'bg-slate-800/50 border-slate-700 opacity-75' : 'bg-red-500/5 border-red-500/20'}`}>
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    {action.status === 'reversed' ? <Square className="w-5 h-5 text-slate-500" /> : <ShieldAlert className="w-5 h-5 text-red-500" />}
                                                    <h4 className="text-lg font-bold text-slate-200">
                                                        {action.action_taken} 
                                                        <span className="ml-2 text-sm font-normal text-slate-400">on {new Date(action.timestamp).toLocaleString()}</span>
                                                    </h4>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
                                                    <p><span className="text-slate-500">Target User:</span> <span className="text-slate-300 font-medium">{action.target_user || 'N/A'}</span></p>
                                                    <p><span className="text-slate-500">Target IP:</span> <span className="text-slate-300 font-medium">{action.target_ip || 'N/A'}</span></p>
                                                    <p><span className="text-slate-500">Risk Score:</span> <span className="text-red-400 font-bold">{action.risk_score}/100</span></p>
                                                    <p><span className="text-slate-500">Status:</span> <span className={action.status === 'reversed' ? 'text-yellow-500' : 'text-green-500'}>{action.status.toUpperCase()}</span></p>
                                                </div>
                                                <div className="bg-slate-900/50 p-3 rounded border border-slate-700 text-sm text-slate-300">
                                                    <strong>AI Reason:</strong> {action.reason}
                                                </div>
                                                {action.status === 'reversed' && (
                                                    <div className="mt-3 text-sm text-yellow-500">
                                                        Reversed by {action.reversed_by} on {new Date(action.reversed_at).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                            {action.status !== 'reversed' && (
                                                <button 
                                                    onClick={() => reverseAction(action._id)}
                                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded transition-colors"
                                                >
                                                    Reverse Decision
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <form onSubmit={saveSettings} className="p-8 max-w-2xl space-y-6">
                            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                                <div>
                                    <h4 className="text-lg font-medium text-white">Enable AI Blue Teamer</h4>
                                    <p className="text-sm text-slate-400">Activate background log analysis and threat detection.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={settings.ai_enabled} onChange={e => setSettings({...settings, ai_enabled: e.target.checked})} />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-red-500/5 rounded-lg border border-red-500/20">
                                <div>
                                    <h4 className="text-lg font-medium text-white">Auto-Execute Actions</h4>
                                    <p className="text-sm text-red-400">Allow AI to automatically ban users and block IPs based on risk score.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={settings.auto_action_toggle} onChange={e => setSettings({...settings, auto_action_toggle: e.target.checked})} />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                                </label>
                            </div>

                            <div className="space-y-4 pt-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">AI Model Endpoint URL</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        value={settings.endpoint_url} onChange={e => setSettings({...settings, endpoint_url: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Model Name</label>
                                        <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            value={settings.model_name} onChange={e => setSettings({...settings, model_name: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">API Key (Optional)</label>
                                        <input type="password" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            value={settings.api_key} onChange={e => setSettings({...settings, api_key: e.target.value})} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Log Batch Size</label>
                                        <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            value={settings.batch_size} onChange={e => setSettings({...settings, batch_size: parseInt(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Analysis Interval (ms)</label>
                                        <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            value={settings.analysis_interval_ms} onChange={e => setSettings({...settings, analysis_interval_ms: parseInt(e.target.value)})} />
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors mt-6">
                                Save Configuration
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
