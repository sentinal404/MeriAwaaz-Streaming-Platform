import React, { createContext, useContext, useState, useEffect } from 'react';
import axios, { type InternalAxiosRequestConfig } from 'axios';

// Ensure cookies are always sent with requests
axios.defaults.withCredentials = true;

// Axios interceptor for automatic token refresh and ban handling
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403 && error.response?.data?.detail === "Account Suspended") {
        alert(error.response.data.message || "Account Suspended");
        try { await axios.post('/api/auth/logout'); } catch(e) {}
        window.location.href = '/';
        return Promise.reject(error);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // If the error is 401 Unauthorized, we haven't retried yet, and it's not an authentication endpoint
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/api/auth')) {
      originalRequest._retry = true;
      try {
        // Attempt to refresh the token using the refresh_token cookie
        await axios.post('/api/auth/refresh');
        // If successful, retry the original request
        return axios(originalRequest);
      } catch (refreshError) {
        // If refresh fails, let the error propagate (user is logged out)
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

interface User {
  username: string;
  email: string;
  role: string;
  trust_score?: number;
  pfp_url?: string | null;
  is_superadmin?: boolean;
  moderator_state?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthModalOpen: false,
  checkAuth: async () => {},
  logout: async () => {},
  openAuthModal: () => {},
  closeAuthModal: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const checkAuth = async () => {
    try {
      const res = await axios.get('/api/profile');
      if (res.data && res.data.user) {
        setUser({
          ...res.data.user,
          pfp_url: res.data.pfp_url
        });
      } else {
        setUser(null);
      }
    } catch (err) {
      // 401 will be caught here if refresh token also fails
      setUser(null);
    }
    setLoading(false);
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (e) {
      console.error('Logout error', e);
    }
    setUser(null);
    window.location.href = '/';
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthModalOpen, checkAuth, logout, openAuthModal, closeAuthModal }}>
      {children}
    </AuthContext.Provider>
  );
};
