
"use client";

import type { Announcement } from '@/hooks/use-announcements';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Image from 'next/image';
import { UserCircle, CalendarDays, Link2, Play, Pause, Volume2, VolumeX, ThumbsUp, MessageCircle, Send, Loader2, Expand, Minimize } from 'lucide-react';
import { useState, useRef, type FormEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/contexts/user-context';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useToast } from '@/hooks/use-toast';
import { CommentItem } from './comment-item';
import { Slider } from '@/components/ui/slider';

interface AnnouncementDetailDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  announcement: Announcement | null; 
}

export function AnnouncementDetailDialog({ isOpen, onOpenChange, announcement: annProp }: AnnouncementDetailDialogProps) {
  const { user, isAdmin } = useUser();
  const { toggleAnnouncementLike, addCommentToAnnouncement } = useAnnouncements();
  const { toast } = useToast();
  
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setShowCommentInput(false);
      setCommentText('');
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isOpen]);

  const handleShowControls = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };
  
  useEffect(() => {
      return () => {
          if(controlsTimeoutRef.current) {
              clearTimeout(controlsTimeoutRef.current)
          }
      }
  }, [])


  const handleDialogClose = (openState: boolean) => {
    if (!openState && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    onOpenChange(openState);
  };

  if (!annProp) return null;

  const currentUserIdentifier = user ? (isAdmin ? "ADMIN_ACCOUNT" : user.email) : null;
  const hasLiked = annProp.likes && annProp.likes.some(like => like.userId === currentUserIdentifier);

  const formattedDate = new Date(annProp.date).toLocaleDateString('tr-TR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const renderAuthorInfoDialog = () => {
    if (annProp.authorId === "ADMIN_ACCOUNT") {
      return (
        <span className="flex items-center">
          <Image src="https://files.catbox.moe/4dmtuq.png" alt="Yönetim Hesabı Logosu" width={24} height={24} className="mr-1.5 rounded-sm" />
          {annProp.author}
        </span>
      );
    }
    return (<span className="flex items-center"><UserCircle className="h-3.5 w-3.5 mr-1" /> {annProp.author}</span>);
  };

  const togglePlayPause = () => { if (videoRef.current) { if (videoRef.current.paused || videoRef.current.ended) { videoRef.current.play(); } else { videoRef.current.pause(); }}};
  const toggleMute = () => { if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setIsMuted(videoRef.current.muted); }};
  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(err => {
        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };
  
  const handleTimeUpdate = () => {
    if(videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };
  
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleLikeToggle = async () => {
    if (!user) { toast({ title: "Giriş Gerekli", variant: "destructive" }); return; }
    try {
      await toggleAnnouncementLike(annProp.id);
    } catch (error) {/* Hook toasts */}
  };

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) { toast({ title: "Giriş Gerekli", variant: "destructive" }); return; }
    if (!commentText.trim()) { toast({ title: "Yorum Boş", variant: "destructive" }); return; }
    setIsSubmittingComment(true);
    try {
      await addCommentToAnnouncement(annProp.id, commentText);
      setCommentText('');
      setShowCommentInput(false);
    } catch (error) {/* Hook toasts */}
    finally { setIsSubmittingComment(false); }
  };

  const renderMedia = () => {
    if (!annProp.media) return null;
    const isDirectVideoFile = annProp.mediaType === 'video/mp4' || annProp.mediaType === 'video/webm' || annProp.mediaType === 'video/ogg' || (annProp.mediaType === 'video/url' && /\.(mp4|webm|ogg)(\?|$)/i.test(annProp.media));
    const isYouTube = annProp.mediaType === 'video/url' && (annProp.media.includes("youtube.com/watch?v=") || annProp.media.includes("youtu.be/"));
    const isVimeo = annProp.mediaType === 'video/url' && annProp.media.includes("vimeo.com/");

    if (annProp.mediaType?.startsWith('image/')) {
      return <div className="my-4 rounded-md overflow-hidden relative bg-muted w-full aspect-auto flex justify-center"><Image src={annProp.media} alt={annProp.title} width={800} height={800} style={{width: 'auto', height: 'auto', maxHeight: '70vh'}} objectFit="contain" data-ai-hint="announcement media detail"/></div>;
    }
    if (isDirectVideoFile || (annProp.mediaType?.startsWith('video/') && annProp.media.startsWith('data:video/'))) {
       return (
        <div ref={videoContainerRef} onMouseMove={handleShowControls} onMouseLeave={() => { if(isPlaying) setShowControls(false) }} onClick={togglePlayPause} className="my-4 rounded-md overflow-hidden relative bg-black group w-full flex items-center justify-center cursor-pointer">
          <video ref={videoRef} src={annProp.media} className="w-full h-auto max-h-[70vh] block" preload="metadata" playsInline onPlay={() => {setIsPlaying(true); handleShowControls();}} onPause={() => {setIsPlaying(false); handleShowControls();}} onEnded={() => setIsPlaying(false)} onVolumeChange={() => { if(videoRef.current) setIsMuted(videoRef.current.muted);}} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} muted={isMuted}/>
          <div onClick={(e) => { e.stopPropagation(); togglePlayPause(); }} className={`absolute inset-0 bg-transparent flex items-center justify-center transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
             <Button variant="ghost" size="icon" className="text-white bg-black/50 hover:bg-black/70 w-16 h-16"><span className="sr-only">Oynat/Durdur</span>{isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}</Button>
          </div>
           <div onClick={(e) => e.stopPropagation()} className={`absolute bottom-0 left-0 right-0 flex flex-col gap-1.5 transition-opacity duration-300 bg-gradient-to-t from-black/60 to-transparent p-2 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <Slider
                    value={[currentTime]}
                    max={duration || 0}
                    onValueChange={handleSeek}
                    className="w-full h-2 cursor-pointer"
                />
                <div className="flex items-center justify-between text-white text-xs">
                    <div className="flex items-center gap-2">
                         <Button onClick={toggleMute} variant="ghost" size="icon" className="text-white hover:bg-white/20 h-7 w-7"><span className="sr-only">Sesi Aç/Kapat</span>{isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</Button>
                         <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                    </div>
                     <Button onClick={toggleFullscreen} variant="ghost" size="icon" className="text-white hover:bg-white/20 h-7 w-7"><span className="sr-only">Tam Ekran</span>{isFullscreen ? <Minimize className="h-5 w-5" /> : <Expand className="h-5 w-5" />}</Button>
                </div>
            </div>
        </div>
      );
    }
    if (isYouTube) {
      const videoId = annProp.media.includes("youtu.be/") ? annProp.media.split("youtu.be/")[1].split("?")[0] : new URL(annProp.media).searchParams.get("v");
      if (videoId) return <div className="my-4 rounded-md overflow-hidden aspect-video relative bg-muted"><iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="absolute top-0 left-0 w-full h-full"></iframe></div>;
    }
    if (isVimeo) {
      const videoIdMatch = annProp.media.match(/vimeo\.com\/(\d+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;
      if (videoId) return <div className="my-4 rounded-md overflow-hidden aspect-video relative bg-muted"><iframe src={`https://player.vimeo.com/video/${videoId}`} width="100%" height="100%" frameBorder="0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title="Vimeo video player" className="absolute top-0 left-0 w-full h-full"></iframe></div>;
    }
    if (annProp.mediaType === 'video/url' || annProp.mediaType === 'url/link') {
        return (<div className="my-4 p-3 bg-muted rounded-md w-full overflow-hidden"><a href={annProp.media} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center w-full"><Link2 className="h-4 w-4 mr-2 flex-shrink-0"/><span className="truncate">{annProp.mediaType === 'video/url' ? 'Video Bağlantısı' : 'Medyayı Görüntüle'}: {annProp.media}</span></a></div>);
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b flex-shrink-0">
          <DialogTitle className="text-xl sm:text-2xl">{annProp.title}</DialogTitle>
          <DialogDescription asChild className="text-xs pt-1">
            <div className="text-muted-foreground">
              <div className="flex flex-wrap gap-x-3 gap-y-1 items-center mt-1 text-muted-foreground">
                <span className="flex items-center"><CalendarDays className="h-3.5 w-3.5 mr-1" /> {formattedDate}</span>
                {renderAuthorInfoDialog()}
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          {renderMedia()}
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{annProp.content}</p>

          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center space-x-4 mb-4">
              <Button variant={hasLiked ? "default" : "outline"} size="sm" onClick={handleLikeToggle} disabled={!user}>
                <ThumbsUp className={`mr-2 h-4 w-4 ${hasLiked ? '' : 'text-primary'}`} />
                {hasLiked ? "Beğenildi" : "Beğen"} ({annProp.likes?.length || 0})
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCommentInput(!showCommentInput)} disabled={!user || isSubmittingComment}>
                <MessageCircle className="mr-2 h-4 w-4 text-primary" />
                Yorum Yap ({annProp.comments?.length || 0})
              </Button>
            </div>

            {showCommentInput && user && (
              <form onSubmit={handleCommentSubmit} className="space-y-2 mb-4">
                <Textarea placeholder={`${user.name} ${user.surname} olarak yorum yap...`} value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={2} disabled={isSubmittingComment} />
                <Button type="submit" size="sm" disabled={isSubmittingComment || !commentText.trim()}>
                  {isSubmittingComment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Gönder
                </Button>
              </form>
            )}

            {annProp.comments && annProp.comments.length > 0 && (
              <div className="space-y-3 mt-4">
                <h4 className="text-md font-semibold text-primary">Yorumlar ({annProp.comments.length})</h4>
                {annProp.comments.map(comment => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    announcementId={annProp.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

    