
"use client";

import type { Reply } from '@/hooks/use-announcements';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays, MessageSquare, Send, Loader2, CornerDownRight, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useToast } from '@/hooks/use-toast';
import { AdminPasswordDialog } from './admin-password-dialog';
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
  onReplyDeleted?: () => void; // Callback after successful deletion
}

export function ReplyItem({ reply, announcementId, commentId, onReplyDeleted }: ReplyItemProps) {
  const { user, isAdmin } = useUser();
  const { addReplyToComment, deleteReply } = useAnnouncements();
  const { toast } = useToast();

  const [showReplyToReplyForm, setShowReplyToReplyForm] = useState(false);
  const [replyToReplyText, setReplyToReplyText] = useState('');
  const [isSubmittingReplyToReply, setIsSubmittingReplyToReply] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdminPasswordDialogOpenForDelete, setIsAdminPasswordDialogOpenForDelete] = useState(false);
  
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
    } catch (error) {
      // Toast for error already handled in hook
    } finally {
      setIsSubmittingReplyToReply(false);
    }
  };

  const handleDeleteReply = async () => {
    setIsDeleting(true);
    try {
      await deleteReply(announcementId, commentId, reply.id);
      toast({ title: "Yanıt Silindi", description: "Yanıt başarıyla kaldırıldı." });
      if (onReplyDeleted) onReplyDeleted();
    } catch (error: any) {
       if (!error.message?.includes("Admin privileges required")) {
        toast({ title: "Silme Başarısız", description: error.message || "Yanıt silinirken bir sorun oluştu.", variant: "destructive"});
      }
    } finally {
      setIsDeleting(false);
      setIsAdminPasswordDialogOpenForDelete(false);
    }
  };
  
  const canDeleteReply = isAdmin; // Simplified: Only admin can delete any reply for now

  return (
    <>
    <div className="flex space-x-2 items-start text-xs">
      <CornerDownRight className="h-3.5 w-3.5 mt-1 text-muted-foreground flex-shrink-0" />
      <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
        <AvatarFallback className="bg-accent text-accent-foreground text-[10px]">
          {getInitials(reply.authorName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-0.5 min-w-0"> {/* Added min-w-0 here */}
        <p className="text-foreground/90 whitespace-pre-wrap break-words"> {/* Added break-words */}
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
            disabled={!user}
          >
            <MessageSquare className="h-3 w-3 mr-0.5" /> Yanıtla
          </Button>
          {canDeleteReply && (
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="xs" className="p-0 h-auto text-[10px] text-destructive hover:text-destructive" disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-0.5"/> : <Trash2 className="h-3 w-3 mr-0.5" />}
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
                    <AlertDialogCancel>İptal</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setIsAdminPasswordDialogOpenForDelete(true)} className="bg-destructive hover:bg-destructive/90">
                      Evet, Sil
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
    <AdminPasswordDialog
        isOpen={isAdminPasswordDialogOpenForDelete}
        onOpenChange={setIsAdminPasswordDialogOpenForDelete}
        onVerified={handleDeleteReply}
    />
    </>
  );
}
