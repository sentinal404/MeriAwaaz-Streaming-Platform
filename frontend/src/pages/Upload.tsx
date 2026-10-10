import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UploadCloud, Loader, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import stateDistricts from '../Data.json';

export default function Upload() {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadLimitReached, setUploadLimitReached] = useState(false);
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      axios.get('/api/posts/upload-limit')
        .then(res => {
          if (res.data.remaining === 0) {
            setUploadLimitReached(true);
          }
        })
        .catch(err => console.error("Failed to fetch upload limit:", err));
    }
  }, [user]);

  const districts = selectedState ? (stateDistricts as any)[selectedState] || [] : [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const formElement = e.currentTarget;
    const originalFormData = new FormData(formElement);
    const title = originalFormData.get('title') as string;
    const description = originalFormData.get('description') as string;
    const state = originalFormData.get('state') as string;
    const city = originalFormData.get('city') as string;

    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) {
      setErrorMessage('Please select a video file.');
      setLoading(false);
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setErrorMessage('File is too large. Maximum allowed size is 500MB.');
      setLoading(false);
      return;
    }

    let duration = 0;
    if (file.type.startsWith('video/')) {
      try {
        duration = await new Promise<number>((resolve) => {
          const video = document.createElement('video');
          video.preload = 'metadata';
          
          let resolved = false;
          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve(0);
            }
          }, 3000);

          video.onloadedmetadata = () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              window.URL.revokeObjectURL(video.src);
              resolve(Math.round(video.duration));
            }
          };
          video.onerror = () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve(0);
            }
          };
          video.src = window.URL.createObjectURL(file);
        });
      } catch (err) {
        console.error('Failed to read video duration', err);
      }
    }

    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    setUploadProgress(0);
    
    try {
      let uploadSuccess = false;
      const chunkProgresses = new Array(totalChunks).fill(0);
      const concurrencyLimit = 1;

      const uploadChunk = async (chunkIndex: number) => {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const chunkFormData = new FormData();
        chunkFormData.append('chunk', chunk);
        chunkFormData.append('chunkIndex', chunkIndex.toString());
        chunkFormData.append('totalChunks', totalChunks.toString());
        chunkFormData.append('uploadId', uploadId);
        chunkFormData.append('filename', file.name);
        
        chunkFormData.append('title', title || '');
        chunkFormData.append('description', description || '');
        chunkFormData.append('state', state || '');
        chunkFormData.append('city', city || '');
        chunkFormData.append('duration', duration.toString());

        const apiUrl = window.location.port === '5173' || window.location.port === '5174'
            ? `http://${window.location.hostname}:3004/api/feed/chunk`
            : '/api/feed/chunk';

        const res = await axios.post(apiUrl, chunkFormData, {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              chunkProgresses[chunkIndex] = progressEvent.loaded / progressEvent.total;
              const totalProgress = chunkProgresses.reduce((acc, val) => acc + val, 0);
              const totalUploadedPercentage = Math.round((totalProgress / totalChunks) * 100);
              setUploadProgress(Math.min(totalUploadedPercentage, 99));
            }
          }
        });

        if (res.data.status === 'success' && res.data.merged) {
          uploadSuccess = true;
          setUploadProgress(100);
        } else if (res.data.status !== 'success') {
          throw new Error(res.data.message || 'Upload failed.');
        }
      };

      for (let i = 0; i < totalChunks; i += concurrencyLimit) {
        const batch = [];
        for (let j = 0; j < concurrencyLimit && i + j < totalChunks; j++) {
          batch.push(uploadChunk(i + j));
        }
        await Promise.all(batch);
      }

      if (uploadSuccess) {
        setShowSuccessModal(true);
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.response?.data?.detail || 'Network error. Please try again.');
      // Cleanup broken upload from DB
      await axios.post('/api/feed/cancel', { uploadId }).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[80vh] flex items-center justify-center">
      {!user ? (
        <div className="max-w-md w-full mx-auto text-center mt-10 p-10 bg-white border border-slate-200/80 rounded-2xl shadow-xl">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Authentication Required</h2>
          <p className="text-slate-500 mb-6 text-sm">You must be logged in to upload and report news.</p>
          <button 
            onClick={openAuthModal}
            className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md shadow-brand-500/10 cursor-pointer"
          >
            Sign In to Upload
          </button>
        </div>
      ) : (
        <>
          {/* Main Upload Card */}
          <div className={`max-w-2xl w-full mx-auto mt-4 bg-white border border-slate-200/80 rounded-2xl shadow-xl p-8 text-left transition-all duration-300 ${showSuccessModal ? 'filter blur-xs pointer-events-none opacity-40' : ''}`}>
            <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Report News</h1>
          <p className="text-slate-500 text-sm">Upload video evidence of local issues.</p>
        </div>

        <div className="p-4 mb-6 bg-blue-50 border border-blue-200/80 rounded-xl text-sm text-blue-700 font-medium flex items-start gap-3 shadow-sm">
          <span className="shrink-0 text-base mt-0.5">ℹ️</span>
          <div>
            <strong className="block text-blue-800 mb-0.5">Video Categorization Rules</strong>
            Videos <strong>1 minute or less</strong> will automatically be stored as quick-view <span className="font-bold">Shorts</span>. Videos longer than 1 minute will be published as standard long-form news reports.
          </div>
        </div>

        {uploadLimitReached && (
          <div className="p-4 mb-6 bg-red-50 border border-red-200/80 rounded-xl text-sm text-red-700 font-semibold flex items-center gap-2.5 shadow-sm">
            <span className="shrink-0 text-base">⚠️</span>
            <span>You've hit your upload limit for today. You can upload again tomorrow.</span>
          </div>
        )}

        {errorMessage && !uploadLimitReached && (
          <div className="p-4 mb-6 bg-red-50 border border-red-200/80 rounded-xl text-sm text-red-700 font-semibold flex items-center gap-2.5 shadow-sm animate-pulse">
            <span className="shrink-0 text-base">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Title</label>
            <input 
              type="text" 
              name="title" 
              required 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-medium text-sm" 
              placeholder="Briefly describe the issue" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
            <textarea 
              name="description" 
              required 
              rows={4} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-medium text-sm" 
              placeholder="Provide more details..." 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">State</label>
              <select
                name="state"
                required
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-medium text-sm"
              >
                <option value="">Select State</option>
                <option value="National">National (All India)</option>
                {Object.keys(stateDistricts).map((stateName) => (
                  <option key={stateName} value={stateName}>
                    {stateName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">City/District</label>
              {selectedState === 'National' ? (
                <>
                  <input type="hidden" name="city" value="National" />
                  <select
                    disabled
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-medium text-sm disabled:opacity-60"
                  >
                    <option value="National">All Districts (National)</option>
                  </select>
                </>
              ) : (
                <select
                  name="city"
                  required
                  disabled={!selectedState}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-medium text-sm disabled:opacity-50"
                >
                  <option value="">Select District</option>
                  {districts.map((districtName: string) => (
                    <option key={districtName} value={districtName}>
                      {districtName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Evidence Media</label>
            <div 
              className="mt-1 flex justify-center px-6 pt-6 pb-7 border-2 border-slate-200 border-dashed rounded-xl bg-slate-50 hover:bg-slate-100/50 hover:border-brand-300 transition-all group cursor-pointer" 
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <div className="space-y-2 text-center">
                <UploadCloud className="mx-auto h-10 w-10 text-slate-400 group-hover:text-brand-500 transition-colors" />
                <div className="flex text-sm text-slate-600 justify-center font-medium">
                  <span className="relative font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                    <span>Upload a file</span>
                    <input 
                      id="file-upload" 
                      name="media" 
                      type="file" 
                      className="sr-only" 
                      required 
                      accept="video/*" 
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file && !file.type.startsWith('video/')) {
                          setErrorMessage('Only video files are allowed.');
                          setFileName('');
                          e.target.value = '';
                        } else {
                          setFileName(file?.name || '');
                          setErrorMessage('');
                        }
                      }} 
                    />
                  </span>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className={`text-xs ${fileName ? 'text-brand-600 font-bold' : 'text-slate-400'}`}>
                  {fileName || 'MP4, WebM up to 500MB'}
                </p>
              </div>
            </div>
          </div>

          {loading && (
            <div className="space-y-2 py-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                <span>{uploadProgress > 0 ? 'Uploading video evidence...' : 'Preparing file metadata...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/50">
                <div 
                  className="bg-brand-600 h-full rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || uploadLimitReached} 
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-500/10 hover:shadow-brand-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
          >
            {loading && <Loader className="w-5 h-5 animate-spin" />}
            <span>{uploadLimitReached ? "Daily Limit Reached" : loading ? 'Uploading...' : 'Submit Report'}</span>
          </button>
        </form>
      </div>

      {/* Success Modal Overlay */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl border border-slate-100 transform scale-100 transition-all duration-300">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-green-100">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Upload Accepted!</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Your video has been successfully received. It is currently <strong>processing in the background</strong> and will automatically appear in the moderation queue once finished.
            </p>
            <button 
              onClick={() => navigate('/')}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-brand-500/10 hover:shadow-brand-500/20 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              Go to Home Feed
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
