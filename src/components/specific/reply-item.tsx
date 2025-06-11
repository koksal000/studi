
"use client";

import type { Reply } from '@/hooks/use-announcements';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays, MessageSquare, Send, Loader2, CornerDownRight } from 'lucide-react'; // ThumbsUp kaldırıldı
import { useState, type FormEvent } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useToast } from '@/hooks/use-toast';

interface ReplyItemProps {
  reply: Reply;
  announcementId: string;
  commentId: string;
}

export function ReplyItem({ reply, announcementId, commentId }: ReplyItemProps) {
  const { user } = useUser();
  const { addReplyToComment } = useAnnouncements(); // toggleReplyLike kaldırıldı
  const { toast } = useToast();

  const [showReplyToReplyForm, setShowReplyToReplyForm] = useState(false);
  const [replyToReplyText, setReplyToReplyText] = useState('');
  const [isSubmittingReplyToReply, setIsSubmittingReplyToReply] = useState(false);
  
  const formattedDate = new Date(reply.date).toLocaleDateString('tr-TR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // Yanıt beğenme ile ilgili kısımlar kaldırıldı
  // const currentUserFullName = user ? `${user.name} ${user.surname}` : null;
  // const hasLikedReply = reply.likes && reply.likes.some(like => like.userId === currentUserFullName);

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

  // handleReplyLikeToggle fonksiyonu kaldırıldı

  return (
    <div className="flex space-x-2 items-start text-xs">
      <CornerDownRight className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
      <Avatar className="h-6 w-6 flex-shrink-0">
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
          {/* Yanıt beğen butonu kaldırıldı */}
          <Button 
            variant="ghost" 
            size="xs" 
            className="p-0 h-auto text-[10px] text-muted-foreground hover:text-primary"
            onClick={() => setShowReplyToReplyForm(!showReplyToReplyForm)}
            disabled={!user}
          >
            <MessageSquare className="h-3 w-3 mr-0.5" /> Yanıtla
          </Button>
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
  );
}
