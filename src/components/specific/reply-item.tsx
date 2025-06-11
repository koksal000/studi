
"use client";

import type { Reply } from '@/hooks/use-announcements';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays, MessageSquare, Send, Loader2, CornerDownRight, Trash2 } from 'lucide-react';
import { useState, type FormEvent, useEffect } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useToast } from '@/hooks/use-toast';
// AdminPasswordDialog kaldırıldı
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

interface ReplyItemProps {
  reply: Reply;
  announcementId: string;
  commentId: string;
  onReplyAction?: () => void; 
}

export function ReplyItem({ reply: initialReply, announcementId, commentId, onReplyAction }: ReplyItemProps) {
  const { user, isAdmin } = useUser();
  const { addReplyToComment, deleteReply, getAnnouncementById } = useAnnouncements();
  const { toast } = useToast();

  const [reply, setReply] = useState<Reply>(initialReply);

  useEffect(() => {
    const parentAnnouncement = getAnnouncementById(announcementId);
    const parentComment = parentAnnouncement?.comments?.find(c => c.id === commentId);
    const updatedReply = parentComment?.replies?.find(r => r.id === initialReply.id);
    if (updatedReply) {
      setReply(updatedReply);
    } else {
      setReply(initialReply); 
    }
  }, [initialReply, announcementId, commentId, getAnnouncementById]);


  const [showReplyToReplyForm, setShowReplyToReplyForm] = useState(false);
  const [replyToReplyText, setReplyToReplyText] = useState('');
  const [isSubmittingReplyToReply, setIsSubmittingReplyToReply] = useState(false);
  const [isDeletingReply, setIsDeletingReply] = useState(false);
  // AdminPasswordDialog state'i kaldırıldı
  // const [isAdminPasswordDialogOpenForDelete, setIsAdminPasswordDialogOpenForDelete] = useState(false);
  
  const formattedDate = new Date(reply.date).toLocaleDateString('tr-TR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleReplyToReplySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Yanıtlamak için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    if (!replyToReplyText.trim()) {
      toast({ title: "Yanıt Boş Olamaz", description: "Lütfen bir yanıt yazın.", variant: "destructive" });
      return;
    }
    setIsSubmittingReplyToReply(true);
    try {
      await addReplyToComment(announcementId, commentId, replyToReplyText, reply.authorName);
      setReplyToReplyText('');
      setShowReplyToReplyForm(false);
      if (onReplyAction) onReplyAction();
    } catch (error) {
    } finally {
      setIsSubmittingReplyToReply(false);
    }
  };

  const handleDeleteReply = async () => {
    if (!user) {
        toast({ title: "Giriş Gerekli", description: "Yanıt silmek için giriş yapmalısınız.", variant: "destructive" });
        return;
    }
    const currentUserAuthorId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    if (currentUserAuthorId !== reply.authorId) {
        toast({ title: "Yetki Hatası", description: "Bu yanıtı silme yetkiniz yok.", variant: "destructive" });
        return;
    }
    setIsDeletingReply(true);
    try {
      await deleteReply(announcementId, commentId, reply.id);
      toast({ title: "Yanıt Silindi", description: "Yanıtınız başarıyla kaldırıldı." });
      if (onReplyAction) onReplyAction();
    } catch (error: any) {
      if (!error.message?.includes("Bu yanıtı silme yetkiniz yok")) {
        toast({ title: "Silme Başarısız", description: error.message || "Yanıt silinirken bir sorun oluştu.", variant: "destructive"});
      }
    } finally {
      setIsDeletingReply(false);
      // setIsAdminPasswordDialogOpenForDelete(false); // Kaldırıldı
    }
  };
  
  const currentUserAuthorId = user ? (isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`) : null;
  const canDeleteThisReply = currentUserAuthorId === reply.authorId; 

  if (!reply) return null;

  return (
    <>
    <div className="flex space-x-2 items-start text-xs">
      <CornerDownRight className="h-3.5 w-3.5 mt-1 text-muted-foreground flex-shrink-0" />
      <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
        <AvatarFallback className="bg-accent text-accent-foreground text-[10px]">
          {getInitials(reply.authorName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-0.5 min-w-0">
        <p className="text-foreground/90 whitespace-pre-wrap break-words">
          <span className="font-semibold text-primary">{reply.authorName}</span>
          {reply.replyingToAuthorName && <span className="text-muted-foreground"> yanıtladı (@{reply.replyingToAuthorName})</span>}
          : {reply.text}
        </p>
        <div className="flex items-center space-x-2 text-muted-foreground text-[10px]">
          <span>{formattedDate}</span>
          <Button 
            variant="ghost" 
            size="xs" 
            className="p-0 h-auto text-[10px] text-muted-foreground hover:text-primary"
            onClick={() => setShowReplyToReplyForm(!showReplyToReplyForm)}
            disabled={!user || isSubmittingReplyToReply}
          >
            <MessageSquare className="h-3 w-3 mr-0.5" /> Yanıtla
          </Button>
          {canDeleteThisReply && (
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="xs" className="p-0 h-auto text-[10px] text-destructive hover:text-destructive" disabled={isDeletingReply}>
                        {isDeletingReply ? <Loader2 className="h-3 w-3 animate-spin mr-0.5"/> : <Trash2 className="h-3 w-3 mr-0.5" />}
                        Sil
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Yanıtı Silmeyi Onayla</AlertDialogTitle>
                    <AlertDialogDescription>
                      Bu yanıtı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeletingReply}>İptal</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleDeleteReply} // Direkt silme işlemi
                        className="bg-destructive hover:bg-destructive/90"
                        disabled={isDeletingReply}
                    >
                      {isDeletingReply ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Evet, Sil"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
          )}
        </div>

        {showReplyToReplyForm && user && (
          <form onSubmit={handleReplyToReplySubmit} className="space-y-1 mt-1.5">
            <Textarea
              placeholder={`${user.name} ${user.surname} olarak @${reply.authorName} adlı kişiye yanıt ver...`}
              value={replyToReplyText}
              onChange={(e) => setReplyToReplyText(e.target.value)}
              rows={1}
              disabled={isSubmittingReplyToReply}
              className="text-xs min-h-[30px]"
            />
            <Button type="submit" size="xs" className="text-[10px] h-6" disabled={isSubmittingReplyToReply || !replyToReplyText.trim()}>
              {isSubmittingReplyToReply ? <Loader2 className="mr-0.5 h-3 w-3 animate-spin" /> : <Send className="mr-0.5 h-3 w-3" />}
              Gönder
            </Button>
          </form>
        )}
      </div>
    </div>
    {/* AdminPasswordDialog kaldırıldı */}
    </>
  );
}
