
"use client";

import type { Announcement } from '@/hooks/use-announcements';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, UserCircle, CalendarDays, Image as ImageIconLucide, Video as VideoIconLucide, Link2, Play, Pause, Volume2, VolumeX, ThumbsUp, MessageCircle, Send, Loader2 } from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AdminPasswordDialog } from '@/components/specific/admin-password-dialog';
import { useState, useRef, type FormEvent } from 'react';
import { AnnouncementDetailDialog } from '@/components/specific/announcement-detail-dialog';
import { CommentItem } from './comment-item';

interface AnnouncementCardProps {
  announcement: Announcement;
  isCompact?: boolean;
  allowDelete?: boolean;
}

export function AnnouncementCard({ announcement, isCompact = false, allowDelete = false }: AnnouncementCardProps) {
  const { user } = useUser();
  const { deleteAnnouncement: removeAnnouncement, toggleAnnouncementLike, addCommentToAnnouncement } = useAnnouncements();
  const { toast } = useToast();
  const [isAdminPasswordDialogOpen, setIsAdminPasswordDialogOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const currentUserIdentifier = user ? `${user.name} ${user.surname}` : null;
  const hasLiked = announcement.likes && announcement.likes.some(like => like.userId === currentUserIdentifier);

  const canAttemptDelete = !!user;

  const performDelete = () => {
    removeAnnouncement(announcement.id);
    toast({
      title: "Duyuru Silindi",
      description: `"${announcement.title}" başlıklı duyuru başarıyla silindi.`,
    });
  };

  const formattedDate = new Date(announcement.date).toLocaleDateString('tr-TR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused || videoRef.current.ended) {
        videoRef.current.play(); setIsPlaying(true);
      } else {
        videoRef.current.pause(); setIsPlaying(false);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const handleLikeToggle = async () => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Beğeni yapmak için giriş yapın.", variant: "destructive" });
      return;
    }
    try {
      await toggleAnnouncementLike(announcement.id);
    } catch (error) {
      // Error already toasted in hook
    }
  };

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Yorum yapmak için giriş yapın.", variant: "destructive" });
      return;
    }
    if (!commentText.trim()) {
      toast({ title: "Yorum Boş", description: "Lütfen bir yorum yazın.", variant: "destructive" });
      return;
    }
    setIsSubmittingComment(true);
    try {
      await addCommentToAnnouncement(announcement.id, commentText);
      setCommentText('');
      setShowCommentInput(false); 
    } catch (error) {
      // Error already toasted in hook
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const renderAuthorInfo = () => {
    if (announcement.authorId === "ADMIN_ACCOUNT") {
      return (
        <span className="flex items-center">
          <Image src="https://files.catbox.moe/4dmtuq.png" alt="Yönetim Hesabı Logosu" width={24} height={24} className="mr-1.5 rounded-sm" />
          {announcement.author}
        </span>
      );
    }
    return (
      <span className="flex items-center">
        <UserCircle className="h-3.5 w-3.5 mr-1" /> {announcement.author}
      </span>
    );
  };

  const renderMedia = () => {
    if (!announcement.media) return null;
    const isDirectVideoFile = announcement.mediaType === 'video/mp4' || announcement.mediaType === 'video/webm' || announcement.mediaType === 'video/ogg' || (announcement.mediaType === 'video/url' && /\.(mp4|webm|ogg)(\?|$)/i.test(announcement.media));
    const isYouTube = announcement.mediaType === 'video/url' && (announcement.media.includes("youtube.com/watch?v=") || announcement.media.includes("youtu.be/"));
    const isVimeo = announcement.mediaType === 'video/url' && announcement.media.includes("vimeo.com/");

    if (announcement.mediaType?.startsWith('image/')) {
      return (
        <div className="my-4 rounded-md overflow-hidden aspect-video relative bg-muted">
          <Image src={announcement.media} alt={announcement.title} layout="fill" objectFit="contain" data-ai-hint="announcement media" />
        </div>
      );
    }
    if (isDirectVideoFile || (announcement.mediaType?.startsWith('video/') && announcement.media.startsWith('data:video/'))) {
      return (
        <div className="my-4 rounded-md overflow-hidden relative bg-black group w-full">
          <video ref={videoRef} src={announcement.media} className="w-full max-h-[400px] aspect-video" playsInline onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} onVolumeChange={() => { if(videoRef.current) setIsMuted(videoRef.current.muted);}} onClick={togglePlayPause} />
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50 p-2 rounded">
            <Button onClick={togglePlayPause} variant="ghost" size="icon" className="text-white hover:bg-white/20">{isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}</Button>
            <Button onClick={toggleMute} variant="ghost" size="icon" className="text-white hover:bg-white/20">{isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</Button>
          </div>
        </div>
      );
    }
    if (isYouTube) {
      const videoId = announcement.media.includes("youtu.be/") ? announcement.media.split("youtu.be/")[1].split("?")[0] : new URL(announcement.media).searchParams.get("v");
      if (videoId) return <div className="my-4 rounded-md overflow-hidden aspect-video relative bg-muted"><iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="absolute top-0 left-0 w-full h-full"></iframe></div>;
    }
    if (isVimeo) {
      const videoIdMatch = announcement.media.match(/vimeo\.com\/(\d+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;
      if (videoId) return <div className="my-4 rounded-md overflow-hidden aspect-video relative bg-muted"><iframe src={`https://player.vimeo.com/video/${videoId}`} width="100%" height="100%" frameBorder="0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title="Vimeo video player" className="absolute top-0 left-0 w-full h-full"></iframe></div>;
    }
     if (announcement.mediaType === 'video/url' || announcement.mediaType === 'url/link') {
      return (
        <div className="my-4 p-3 bg-muted rounded-md w-full overflow-hidden">
          <a 
            href={announcement.media} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-primary hover:underline flex items-center w-full"
          >
            <Link2 className="h-4 w-4 mr-2 flex-shrink-0"/>
            <span className="truncate">
              {announcement.mediaType === 'video/url' ? 'Video Bağlantısı' : 'Medyayı Görüntüle'}: {announcement.media}
            </span>
          </a>
        </div>
      );
    }
    return null;
  };

  const contentToShow = isCompact ? (announcement.content.length > 150 ? announcement.content.substring(0, 147) + "..." : announcement.content) : announcement.content;
  const getCompactMediaIndicator = () => {
    if (!announcement.media) return null;
    if (announcement.mediaType?.startsWith('image/')) return <><ImageIconLucide className="h-3.5 w-3.5 mr-1 text-primary" /> Resim</>;
    if (announcement.mediaType?.startsWith('video/')) return <><VideoIconLucide className="h-3.5 w-3.5 mr-1 text-primary" /> Video</>;
    if (announcement.mediaType === 'url/link') return <><Link2 className="h-3.5 w-3.5 mr-1 text-primary" /> Bağlantı</>;
    return <><Link2 className="h-3.5 w-3.5 mr-1 text-primary" /> Medya</>;
  };

  return (
    <>
      <Card className={`shadow-md hover:shadow-lg transition-shadow duration-300 ${isCompact ? 'cursor-pointer' : ''}`} onClick={isCompact ? () => setIsDetailModalOpen(true) : undefined}>
        <CardHeader>
          <CardTitle className={isCompact ? "text-xl" : "text-2xl"}>{announcement.title}</CardTitle>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 items-center mt-1">
            <span className="flex items-center"><CalendarDays className="h-3.5 w-3.5 mr-1" /> {formattedDate}</span>
            {renderAuthorInfo()}
            {isCompact && announcement.media && <span className="flex items-center">{getCompactMediaIndicator()}</span>}
            {!isCompact && announcement.media && (announcement.mediaType === 'url/link' || announcement.mediaType === 'video/url') && 
             !/\.(jpeg|jpg|gif|png|webp|mp4|webm|ogg)(\?|$)/i.test(announcement.media) && 
             !/youtu\.?be/i.test(announcement.media) && !/vimeo\.com/i.test(announcement.media) &&
             <span className="flex items-center"><Link2 className="h-3.5 w-3.5 mr-1 text-primary" /> Medya Bağlantısı</span>
            }
          </div>
        </CardHeader>
        <CardContent>
          {!isCompact && renderMedia()}
          <p className={`text-foreground/90 ${isCompact ? 'text-sm' : 'text-base'} whitespace-pre-wrap`}>{contentToShow}</p>
          
          {!isCompact && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center space-x-4 mb-4">
                <Button variant={hasLiked ? "default" : "outline"} size="sm" onClick={handleLikeToggle} disabled={!user}>
                  <ThumbsUp className={`mr-2 h-4 w-4 ${hasLiked ? '' : 'text-primary'}`} />
                  {hasLiked ? "Beğenildi" : "Beğen"} ({announcement.likes?.length || 0})
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowCommentInput(!showCommentInput)} disabled={!user}>
                  <MessageCircle className="mr-2 h-4 w-4 text-primary" />
                  Yorum Yap ({announcement.comments?.length || 0})
                </Button>
              </div>

              {showCommentInput && user && (
                <form onSubmit={handleCommentSubmit} className="space-y-2 mb-4">
                  <Textarea
                    placeholder={`${user.name} ${user.surname} olarak yorum yap...`}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={2}
                    disabled={isSubmittingComment}
                  />
                  <Button type="submit" size="sm" disabled={isSubmittingComment || !commentText.trim()}>
                    {isSubmittingComment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Gönder
                  </Button>
                </form>
              )}

              {announcement.comments && announcement.comments.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h4 className="text-md font-semibold text-primary">Yorumlar ({announcement.comments.length})</h4>
                  {announcement.comments.map(comment => (
                    <CommentItem key={comment.id} comment={comment} announcementId={announcement.id} />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end items-center">
          {canAttemptDelete && !isCompact && allowDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" /> Sil</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Duyuruyu Silmeyi Onayla</AlertDialogTitle><AlertDialogDescription>"{announcement.title}" başlıklı duyuruyu kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz. (Render.com'da kalıcı disk doğru yapılandırıldıysa değişiklik kalıcı olacaktır.)</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>İptal</AlertDialogCancel><AlertDialogAction onClick={() => setIsAdminPasswordDialogOpen(true)} className="bg-destructive hover:bg-destructive/90">Evet, Sil</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardFooter>
      </Card>

      <AdminPasswordDialog isOpen={isAdminPasswordDialogOpen} onOpenChange={setIsAdminPasswordDialogOpen} onVerified={() => { performDelete(); setIsAdminPasswordDialogOpen(false); }} />
      {isCompact && <AnnouncementDetailDialog isOpen={isDetailModalOpen} onOpenChange={setIsDetailModalOpen} announcement={announcement} />}
    </>
  );
}
