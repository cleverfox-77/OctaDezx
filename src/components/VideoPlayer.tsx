
import { useState } from "react";
import { Play } from "lucide-react";

interface VideoPlayerProps {
    videoId: string;
    title?: string;
}

export const VideoPlayer = ({ videoId, title = "Video player" }: VideoPlayerProps) => {
    const [isPlaying, setIsPlaying] = useState(false);

    if (isPlaying) {
        return (
            <div className="w-full h-full aspect-video">
                <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0`}
                    title={title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="w-full h-full rounded-lg"
                />
            </div>
        );
    }

    return (
        <div
            className="relative w-full h-full aspect-video bg-gray-100 cursor-pointer group rounded-lg overflow-hidden"
            onClick={() => setIsPlaying(true)}
        >
            <img
                src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                    // Fallback if maxresdefault doesn't exist
                    (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
                    <Play className="w-8 h-8 text-white fill-current ml-1" />
                </div>
            </div>
            <div className="absolute bottom-4 left-4 text-white font-medium text-lg drop-shadow-md">
                {title}
            </div>
        </div>
    );
};
