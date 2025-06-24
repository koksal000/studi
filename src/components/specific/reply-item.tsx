
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
}

export function ReplyItem({ reply: replyProp, announcementId, commentId }: ReplyItemProps) {
  const { user, isAdmin } = useUser();
  const { addReplyToComment, deleteReply } = useAnnouncements();
  const { toast } = useToast();

  const [showReplyToReplyForm, setShowReplyToReplyForm] = useState(false);
  const [replyToReplyText, setReplyToReplyText] = useState('');
  const [isSubmittingReplyToReply, setIsSubmittingReplyToReply] = useState(false);
  const [isDeletingReply, setIsDeletingReply] = useState(false);

  const formattedDate = new Date(replyProp.date).toLocaleDateString('tr-TR', {
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
      await addReplyToComment(announcementId, commentId, replyToReplyText, replyProp.authorName, replyProp.authorId);
      setReplyToReplyText('');
      setShowReplyToReplyForm(false);
    } catch (error) {
    } finally {
      setIsSubmittingReplyToReply(false);
    }
  };

  const handleDeleteReply = async () => {
    setIsDeletingReply(true);
    try {
      await deleteReply(announcementId, commentId, replyProp.id);
    } catch (error: any) {
      // Toast is handled by hook
    } finally {
      setIsDeletingReply(false);
    }
  };

  const currentUserAuthorId = user ? (isAdmin ? "ADMIN_ACCOUNT" : user.email) : null;
  const canDeleteThisReply = isAdmin || currentUserAuthorId === replyProp.authorId;

  if (!replyProp) return null;

  return (
    <>
    <div className="flex space-x-2 items-start text-xs">
      <CornerDownRight className="h-3.5 w-3.5 mt-1 text-muted-foreground flex-shrink-0" />
      <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
        <AvatarFallback className="bg-accent text-accent-foreground text-[10px]">
          {getInitials(replyProp.authorName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-0.5 min-w-0">
        <p className="text-foreground/90 whitespace-pre-wrap break-words">
          <span className="font-semibold text-primary">{replyProp.authorName}</span>
          {replyProp.replyingToAuthorName && <span className="text-muted-foreground"> yanıtladı (@{replyProp.replyingToAuthorName})</span>}
          : {replyProp.text}
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
                        onClick={handleDeleteReply}
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
              placeholder={`@${replyProp.authorName} adlı kişiye yanıt ver...`}
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
    </>
  );
}
