import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, CheckCircle2, XCircle, X, ArrowRight, User, Loader2, Camera, Trash2 } from 'lucide-react';

export default function AuthModal() {
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ length: false, number: false, special: false });
  const [isLoading, setIsLoading] = useState(false);
  const { checkAuth, isAuthModalOpen, closeAuthModal } = useAuth();

  // Step 2: Username claiming
  const [signupToken, setSignupToken] = useState('');
  const [isClaimingUsername, setIsClaimingUsername] = useState(false);
  const [username, setUsername] = useState('');
  const [publicName, setPublicName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  
  // Username availability
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setProfilePhoto(null);
    setProfilePhotoPreview(null);
  };

  useEffect(() => {
    setPasswordStrength({
      length: password.length >= 8,
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    });
  }, [password]);

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // Reset all state when modal closes
  useEffect(() => {
    if (!isAuthModalOpen) {
      setError('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setSignupToken('');
      setIsClaimingUsername(false);
      setUsername('');
      setPublicName('');
      setIsUsernameAvailable(null);
      setSuggestions([]);
      setProfilePhoto(null);
      setProfilePhotoPreview(null);
    }
  }, [isAuthModalOpen]);

  // Debounced username availability check
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setIsUsernameAvailable(null);
      setSuggestions([]);
      setIsCheckingUsername(false);
      return;
    }

    setIsCheckingUsername(true);
    setIsUsernameAvailable(null);

    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/auth/check-username?username=${encodeURIComponent(trimmed)}`);
        setIsUsernameAvailable(res.data.available);
        setSuggestions(res.data.suggestions || []);
      } catch {
        setIsUsernameAvailable(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 800);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [username]);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/unified', { email, password });
      if (res.data.status === 'success') {
        if (res.data.action === 'claim_username') {
          // New user — move to username step
          setSignupToken(res.data.signup_token);
          setIsClaimingUsername(true);
        } else {
          // Existing user — logged in
          await checkAuth();
          closeAuthModal();
        }
      } else {
        setError(res.data.message || 'Authentication failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Network error. Make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimUsername = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isUsernameAvailable === false) {
      setError('This username is taken. Pick one from the suggestions or try another.');
      return;
    }
    setIsLoading(true);
    setError('');

    const getGPS = (): Promise<{lat: number, lng: number}> => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser"));
        } else {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            (_error) => reject(new Error("Please allow location access to create an account. It is mandatory."))
          );
        }
      });
    };

    try {
      const coords = await getGPS();

      const formData = new FormData();
      formData.append('signup_token', signupToken);
      formData.append('username', username.trim());
      if (publicName.trim()) {
        formData.append('public_name', publicName.trim());
      }
      formData.append('lat', coords.lat.toString());
      formData.append('lng', coords.lng.toString());
      
      if (profilePhoto) {
        formData.append('profile_photo', profilePhoto);
      }

      const res = await axios.post('/api/auth/claim-username', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.status === 'success') {
        await checkAuth();
        closeAuthModal();
      } else {
        setError(res.data.message || 'Failed to claim username');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Network error. Make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const pickSuggestion = (name: string) => {
    setUsername(name);
    setIsUsernameAvailable(true);
    setSuggestions([]);
    setError('');
  };

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeAuthModal}>
      <div 
        className="w-full max-w-md p-8 bg-white border border-slate-200 rounded-2xl shadow-2xl relative animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={closeAuthModal}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        {isClaimingUsername ? (
          /* ===== STEP 2: Claim Username ===== */
          <>
            <div className="text-center mb-6">
              {/* Profile Photo Uploader */}
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="relative group w-20 h-20">
                  <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner relative">
                    {profilePhotoPreview ? (
                      <img src={profilePhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-slate-300" />
                    )}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Camera className="w-5 h-5" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoChange} 
                      className="hidden" 
                    />
                  </label>
                </div>
                <div className="mt-2 text-center">
                  {profilePhoto ? (
                    <button 
                      type="button" 
                      onClick={removePhoto} 
                      className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors flex items-center justify-center gap-1 mx-auto"
                    >
                      <Trash2 className="w-3 h-3" /> Remove Photo
                    </button>
                  ) : (
                    <label className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors cursor-pointer block">
                      Upload Profile Photo
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handlePhotoChange} 
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>
              </div>

              <h2 className="text-2xl font-bold text-slate-800">Almost there!</h2>
              <p className="text-slate-500 text-sm mt-1">Pick a unique username and optional profile photo to complete your account.</p>
            </div>
            
            {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}
            
            <form onSubmit={handleClaimUsername} className="space-y-5">
              <div>
                <label className="block text-sm text-slate-600 mb-1.5 font-medium">Username</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input 
                    type="text" 
                    required 
                    minLength={3}
                    maxLength={30}
                    value={username}
                    onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="Pick a username"
                    className={`w-full bg-slate-50 border rounded-lg pl-10 pr-10 py-2.5 text-slate-800 focus:outline-none focus:ring-1 transition-all ${
                      isUsernameAvailable === true
                        ? 'border-green-500 focus:border-green-500 focus:ring-green-500/50'
                        : isUsernameAvailable === false
                        ? 'border-red-400 focus:border-red-400 focus:ring-red-400/50'
                        : 'border-slate-200 focus:border-brand-500 focus:ring-brand-500/50'
                    }`}
                    autoFocus
                  />
                  {/* Status icon */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isCheckingUsername ? (
                      <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                    ) : isUsernameAvailable === true ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : isUsernameAvailable === false ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : null}
                  </div>
                </div>

                {/* Availability text */}
                {username.trim().length >= 3 && !isCheckingUsername && (
                  <p className={`text-xs mt-1.5 ${isUsernameAvailable ? 'text-green-600' : isUsernameAvailable === false ? 'text-red-500' : 'text-slate-400'}`}>
                    {isUsernameAvailable ? '✓ Username is available!' : isUsernameAvailable === false ? '✗ Username is taken' : ''}
                  </p>
                )}
                
                {username.trim().length < 3 && (
                  <p className="text-xs text-slate-400 mt-1.5">Letters, numbers, and underscores only. 3–30 characters.</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1.5 font-medium">Public Name (Optional)</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input 
                    type="text" 
                    maxLength={50}
                    value={publicName}
                    onChange={e => setPublicName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 transition-all"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">This is the name that will be displayed on your profile. If left blank, your username will be used.</p>
              </div>

              {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500 mb-2 font-medium">Try one of these:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => pickSuggestion(s)}
                          className="px-3 py-1.5 text-xs font-medium bg-brand-50 text-brand-600 border border-brand-200 rounded-full hover:bg-brand-100 hover:border-brand-300 transition-all cursor-pointer"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              
              <button 
                type="submit" 
                disabled={isLoading || username.trim().length < 3 || isUsernameAvailable === false || isCheckingUsername}
                className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25"
              >
                {isLoading ? 'Creating account...' : (
                  <>Continue <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </>
        ) : (
          /* ===== STEP 1: Email + Password ===== */
          <>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Welcome</h2>
              <p className="text-slate-500 text-sm mt-2">Sign in or create an account instantly.</p>
            </div>
            
            {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}
          
            <form onSubmit={handleAuth} className="space-y-5">
              <div>
                <label className="block text-sm text-slate-600 mb-1.5 font-medium">Email address</label>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 transition-all" 
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-600 mb-1.5 font-medium">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 pr-10 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 transition-all" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                {/* Strength indicators */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs">
                    <div className={`flex items-center gap-1 ${passwordStrength.length ? 'text-green-600' : 'text-slate-400'}`}>
                      {passwordStrength.length ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} At least 8 characters
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.number ? 'text-green-600' : 'text-slate-400'}`}>
                      {passwordStrength.number ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} Contains a number
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.special ? 'text-green-600' : 'text-slate-400'}`}>
                      {passwordStrength.special ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} Contains a special character
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm text-slate-600 mb-1.5 font-medium">Confirm Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={`w-full bg-slate-50 border rounded-lg px-4 py-2.5 text-slate-800 pr-10 focus:outline-none focus:ring-1 transition-all ${
                      confirmPassword.length > 0 
                        ? passwordsMatch ? 'border-green-500 focus:border-green-500 focus:ring-green-500/50' : 'border-red-400 focus:border-red-400 focus:ring-red-400/50' 
                        : 'border-slate-200 focus:border-brand-500 focus:ring-brand-500/50'
                    }`}
                  />
                  {confirmPassword.length > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {passwordsMatch ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-400" />}
                    </div>
                  )}
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25"
              >
                {isLoading ? 'Processing...' : 'Continue'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
