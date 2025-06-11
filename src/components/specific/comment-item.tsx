
"use client";

import type { Comment } from '@/hooks/use-announcements';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCircle, CalendarDays } from 'lucide-react';

interface CommentItemProps {
  comment: Comment;
  announcementId: string; // For potential future actions like delete comment by admin
}

export function CommentItem({ comment }: CommentItemProps) {
  const formattedDate = new Date(comment.date).toLocaleDateString('tr-TR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // Create a simple initial from the author's name for the avatar fallback
  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex space-x-3 p-3 bg-secondary/30 rounded-md shadow-sm">
      <Avatar className="h-8 w-8">
        {/* <AvatarImage src={comment.authorAvatarUrl} alt={comment.authorName} /> Avatar image if available */}
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
        {/* Future: Add like button for comments, reply button here */}
        {/* 
        <div className="flex items-center space-x-2 pt-1">
            <Button variant="ghost" size="xs" className="text-xs text-muted-foreground hover:text-primary">
                <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Beğen (0)
            </Button>
            <Button variant="ghost" size="xs" className="text-xs text-muted-foreground hover:text-primary">
                <MessageSquare className="h-3.5 w-3.5 mr-1" /> Yanıtla
            </Button>
        </div>
        */}
      </div>
    </div>
  );
}
