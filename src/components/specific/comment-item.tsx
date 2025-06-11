
"use client";

import type { Comment, Reply } from '@/hooks/use-announcements';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UserCircle, CalendarDays, MessageSquare, Send, Loader2, CornerDownRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useToast } from '@/hooks/use-toast';

interface CommentItemProps {
  comment: Comment;
  announcementId: string;
}

export function CommentItem({ comment, announcementId }: CommentItemProps) {
  const { user } = useUser();
  const { addReplyToComment } = useAnnouncements();
  const { toast } = useToast();

  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const formattedDate = new Date(comment.date).toLocaleDateString('tr-TR', {
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
      await addReplyToComment(announcementId, comment.id, replyText, comment.authorName);
      setReplyText('');
      setShowReplyForm(false);
    } catch (error) {
      // Toast for error already handled in hook
    } finally {
      setIsSubmittingReply(false);
    }
  };

  return (
    <div className="p-3 bg-secondary/30 rounded-md shadow-sm">
      <div className="flex space-x-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {getInitials(comment.authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-primary">{comment.authorName}</h4>
            <p className="text-xs text-muted-foreground flex items-center">
              <CalendarDays className="h-3 w-3 mr-1" />
              {formattedDate}
            </p>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{comment.text}</p>
          <div className="flex items-center space-x-2 pt-1">
            <Button 
              variant="ghost" 
              size="xs" 
              className="text-xs text-muted-foreground hover:text-primary"
              onClick={() => setShowReplyForm(!showReplyForm)}
              disabled={!user}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" /> Yanıtla
            </Button>
          </div>

          {showReplyForm && user && (
            <form onSubmit={handleReplySubmit} className="space-y-2 mt-2 ml-4 pl-4 border-l border-primary/50">
              <Textarea
                placeholder={`${user.name} ${user.surname} olarak @${comment.authorName} adlı kişiye yanıt ver...`}
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

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 ml-8 pl-4 border-l border-primary/30 space-y-3">
          {comment.replies.map(reply => (
            <div key={reply.id} className="flex space-x-2 items-start text-xs">
              <CornerDownRight className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarFallback className="bg-accent text-accent-foreground text-[10px]">
                  {getInitials(reply.authorName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-foreground/90 whitespace-pre-wrap">
                  <span className="font-semibold text-primary">{reply.authorName}</span> yanıtladı (<em>@{reply.replyingToCommentAuthorName}</em>): {reply.text}
                </p>
                <p className="text-muted-foreground text-[10px] mt-0.5">
                  {new Date(reply.date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
