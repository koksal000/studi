
"use client";

import type { Comment } from '@/hooks/use-announcements';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UserCircle, CalendarDays, MessageSquare, Send, Loader2, Trash2, TreePine } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useToast } from '@/hooks/use-toast';
import { ReplyItem } from './reply-item';
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

interface CommentItemProps {
  comment: Comment;
  announcementId: string;
}

export function CommentItem({ comment: commentProp, announcementId }: CommentItemProps) {
  const { user, isAdmin } = useUser();
  const { addReplyToComment, deleteComment } = useAnnouncements();
  const { toast } = useToast();

  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const formattedDate = new Date(commentProp.date).toLocaleDateString('tr-TR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleReplySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Yanıtlamak için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    if (!replyText.trim()) {
      toast({ title: "Yanıt Boş Olamaz", description: "Lütfen bir yanıt yazın.", variant: "destructive" });
      return;
    }
    setIsSubmittingReply(true);
    try {
      await addReplyToComment(announcementId, commentProp.id, replyText, commentProp.authorName, commentProp.authorId);
      setReplyText('');
      setShowReplyForm(false);
    } catch (error) {
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleDeleteComment = async () => {
    setIsDeletingComment(true);
    try {
      await deleteComment(announcementId, commentProp.id);
    } catch (error: any) {
      // Toast is handled by hook
    } finally {
      setIsDeletingComment(false);
    }
  };

  const currentUserAuthorId = user ? (isAdmin ? "ADMIN_ACCOUNT" : user.email) : null;
  const canDeleteThisComment = isAdmin || currentUserAuthorId === commentProp.authorId;

  if (!commentProp) return null;

  return (
    <>
    <div className="p-3 bg-secondary/30 rounded-md shadow-sm">
      <div className="flex space-x-3">
        {commentProp.authorId === 'ADMIN_ACCOUNT' ? (
          <Avatar className="h-8 w-8 border-2 border-amber-400 bg-secondary flex items-center justify-center">
              <TreePine className="h-5 w-5 text-amber-500" />
          </Avatar>
        ) : (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(commentProp.authorName)}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className={`text-sm font-semibold ${commentProp.authorId === 'ADMIN_ACCOUNT' ? 'admin-name-gradient' : 'text-primary'}`}>
              {commentProp.authorName}
            </h4>
            <p className="text-xs text-muted-foreground flex items-center">
              <CalendarDays className="h-3 w-3 mr-1" />
              {formattedDate}
            </p>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{commentProp.text}</p>
          <div className="flex items-center space-x-2 pt-1">
            <Button
              variant="ghost"
              size="xs"
              className="text-xs text-muted-foreground hover:text-primary"
              onClick={() => setShowReplyForm(!showReplyForm)}
              disabled={!user || isSubmittingReply}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" /> Yanıtla ({commentProp.replies?.length || 0})
            </Button>
            {canDeleteThisComment && (
               <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="xs" className="text-xs text-destructive hover:text-destructive" disabled={isDeletingComment}>
                    {isDeletingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1"/> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                    Sil
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Yorumu Silmeyi Onayla</AlertDialogTitle>
                    <AlertDialogDescription>
                      Bu yorumu ve tüm yanıtlarını kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeletingComment}>İptal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteComment}
                      className="bg-destructive hover:bg-destructive/90"
                      disabled={isDeletingComment}
                    >
                      {isDeletingComment ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Evet, Sil"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {showReplyForm && user && (
            <form onSubmit={handleReplySubmit} className="space-y-2 mt-2 ml-4 pl-4 border-l border-primary/50">
              <Textarea
                placeholder={`@${commentProp.authorName} adlı kişiye yanıt ver...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                disabled={isSubmittingReply}
                className="text-sm"
              />
              <Button type="submit" size="xs" disabled={isSubmittingReply || !replyText.trim()}>
                {isSubmittingReply ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                Yanıtı Gönder
              </Button>
            </form>
          )}
        </div>
      </div>

      {commentProp.replies && commentProp.replies.length > 0 && (
        <div className="mt-3 ml-4 sm:ml-8 pl-2 sm:pl-4 border-l border-primary/30 space-y-3">
          {commentProp.replies.map(reply => (
            <ReplyItem
                key={reply.id}
                reply={reply}
                announcementId={announcementId}
                commentId={commentProp.id}
            />
          ))}
        </div>
      )}
    </div>
    </>
  );
}
