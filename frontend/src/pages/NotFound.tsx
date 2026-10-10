import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Auto-detect all 404 illustrations in the notfound directory
const imagesGlob = import.meta.glob('../Public/assets/notfound/*.{png,jpg,jpeg,svg,webp}', { eager: true });
const images = Object.values(imagesGlob).map((mod: any) => mod.default);

export default function NotFound({ message }: { message?: string }) {
  const navigate = useNavigate();

  // Select a random image once when the component mounts
  const [selectedImage] = useState(() => {
    if (images.length === 0) return '';
    const randomIndex = Math.floor(Math.random() * images.length);
    return images[randomIndex];
  });

  const defaultMsg = "It seems you have wandered off the track. The link might be broken, or the page may have been moved.";

  return (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex flex-col items-center justify-center p-4 sm:p-6 text-center bg-slate-50 overflow-y-auto selection:bg-orange-200">
      {/* Decorative gradient blobs in background */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-brand-200/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative max-w-md w-full p-6 sm:p-10 bg-white/95 border-2 border-solid border-orange-500 rounded-3xl shadow-xl space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500 my-auto">
        
        {/* Stylized Canvas for the Illustration */}
        <div className="relative group max-w-[200px] sm:max-w-[280px] mx-auto">
          {/* Decorative glowing back-ring */}
          <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/10 to-indigo-500/10 rounded-2xl blur-xl transition-all duration-500 group-hover:scale-105"></div>
          
          <div className="relative overflow-hidden transition-all duration-500">
            <img 
              src={selectedImage} 
              alt="You may Lost" 
              className="w-full h-auto object-contain transition-transform duration-500 ease-out group-hover:scale-105" 
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-brand-600 bg-brand-50 px-3 py-1 rounded-full inline-block">Error Code 404</span>
            <h1 className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 font-black text-3xl sm:text-4xl md:text-5xl tracking-tight pt-2">
              Page Not Found
            </h1>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-5 space-y-2">
            <p className="text-slate-800 text-sm sm:text-base font-bold">
              You may Lost
            </p>
            <p className="text-slate-500 text-[11px] sm:text-xs font-semibold leading-relaxed max-w-xs sm:max-w-sm mx-auto">
              {message || defaultMsg}
            </p>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => navigate('/')}
            className="w-full max-w-xs bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold py-3 sm:py-3.5 rounded-xl shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer mx-auto block text-sm"
          >
            Return to Safety (Home)
          </button>
        </div>
      </div>
    </div>
  );
}
