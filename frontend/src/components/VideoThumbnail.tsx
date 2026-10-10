import { useState, useRef, useEffect } from 'react';

interface VideoThumbnailProps {
  postId: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  mimeType?: string;
  title: string;
  className?: string;
}

export default function VideoThumbnail({
  postId,
  mediaUrl,
  thumbnailUrl,
  mimeType,
  title,
  className = "w-full h-full object-cover"
}: VideoThumbnailProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isVideo = mimeType?.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(mediaUrl);

  useEffect(() => {
    if (!isHovered) {
      setIsPlaying(false);
      return;
    }

    // Delay playback slightly (150ms) to avoid loading streams on fast sweeps over the grid
    const timer = setTimeout(() => {
      setIsPlaying(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [isHovered]);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-full h-full overflow-hidden bg-slate-900 flex items-center justify-center group/thumbnail"
    >
      {/* Thumbnail Image (Always Present) */}
      <img
        src={thumbnailUrl || (isVideo ? "https://images.unsplash.com/photo-1495020689067-958852a7765e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" : `/api/posts/media/${postId}`)}
        loading="lazy"
        className={`${className} absolute inset-0 transition-transform duration-500 ease-out group-hover/thumbnail:scale-105`}
        alt={title}
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1495020689067-958852a7765e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
        }}
      />

      {/* Video Hover Playback */}
      {isVideo && isPlaying && (
        <video
          ref={videoRef}
          src={`/api/posts/media/${postId}`}
          className="absolute inset-0 w-full h-full object-cover z-10 animate-fade-in group-hover/thumbnail:scale-105 transition-transform duration-500"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        />
      )}
    </div>
  );
}
