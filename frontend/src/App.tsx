import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LayoutProvider, useLayout } from './context/LayoutContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Watch from './pages/Watch';
import Shorts from './pages/Shorts';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';

import Upload from './pages/Upload';
import Heatmap from './pages/Heatmap';

import AuthModal from './components/AuthModal';
import NotFound from './pages/NotFound';

const Admin = React.lazy(() => import('./pages/Admin'));
const AdminAI = React.lazy(() => import('./pages/AdminAI'));

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-500 font-medium">
        Loading...
      </div>
    );
  }
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return <NotFound />;
  }
  return <>{children}</>;
}

function AppContent() {
  const { layout } = useLayout();
  const location = useLocation();
  
  const VALID_PATHS = ['/', '/watch', '/shorts', '/profile', '/upload', '/admin', '/admin/ai-blue-teamer', '/heatmap', '/notifications'];
  const isValidPath = VALID_PATHS.includes(location.pathname);
  const shouldHideSidebar = location.pathname.startsWith('/admin') || location.pathname.startsWith('/watch') || !isValidPath;

  // Calculate dynamic margins based on the active layout
  let mainMargin = shouldHideSidebar ? '' : 'lg:ml-64'; // layout-youtube and layout-news default
  if (!shouldHideSidebar && layout === 'layout-instagram') mainMargin = 'lg:ml-20'; // Collapsed sidebar in Instagram layout

  return (
    <div className="min-h-screen pb-16 md:pb-0 font-sans flex flex-col">
      <Navbar />
      <div className={`flex flex-1 ${location.pathname.startsWith('/admin') ? '' : 'pt-14'}`}>
        {!shouldHideSidebar && <Sidebar />}
        <main className={`flex-1 ${mainMargin} p-4 lg:p-6 w-full max-w-full overflow-x-hidden transition-all duration-300`}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="/shorts" element={<Shorts />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<Notifications />} />

            <Route path="/upload" element={<Upload />} />
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <Suspense fallback={<div className="p-6 text-slate-500 font-medium text-center">Loading admin panel...</div>}>
                    <Admin />
                  </Suspense>
                </AdminRoute>
              } 
            />
            <Route 
              path="/admin/ai-blue-teamer" 
              element={
                <AdminRoute>
                  <Suspense fallback={<div className="p-6 text-slate-500 font-medium text-center">Loading SOC Dashboard...</div>}>
                    <AdminAI />
                  </Suspense>
                </AdminRoute>
              } 
            />
            <Route path="/heatmap" element={<Heatmap />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
      <AuthModal />
    </div>
  );
}

function App() {
  return (
    <LayoutProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </LayoutProvider>
  );
}

export default App;
