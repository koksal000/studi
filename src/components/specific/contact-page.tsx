
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CONTACT_INFO, VILLAGE_NAME, GOOGLE_MAPS_EMBED_URL, GOOGLE_MAPS_SHARE_URL } from '@/lib/constants';
import { Mail, MapPin, User as UserIcon, MessageSquare, Send, Loader2, ExternalLink } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useState, type FormEvent, useEffect } from 'react';
import { useUser } from '@/contexts/user-context';
import { EntryForm } from '@/components/specific/entry-form';
import { useContactMessages } from '@/hooks/use-contact-messages'; 

export default function ContactPage() {
  const { toast } = useToast();
  const { user, showEntryForm } = useUser();
  
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addContactMessage } = useContactMessages();

  useEffect(() => {
    if (user?.email) {
      setContactEmail(user.email);
    } else {
      setContactEmail('');
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) { 
      toast({ title: "Giriş Gerekli", variant: "destructive" });
      return;
    }
    if (!subject.trim() || !message.trim() || !contactEmail.trim()) {
      toast({ title: "Eksik Bilgi", description: "Lütfen tüm alanları doldurun.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    try {
      const payload = {
        name: `${user.name} ${user.surname}`, 
        email: contactEmail, 
        subject: subject,
        message: message,
      };

      await addContactMessage(payload); 

      toast({ title: "Mesajınız Gönderildi!", description: "En kısa sürede sizinle iletişime geçeceğiz." });
      setSubject('');
      setMessage('');
      if (!user.email) { // Clear email only if it wasn't pre-filled
        setContactEmail('');
      }
    } catch (error: any) {
      console.error("Form Submission Error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showEntryForm || !user) {
    return <EntryForm />;
  }

  return (
    <div className="space-y-8 content-page">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center">
            <Mail className="mr-3 h-8 w-8" /> İletişim Bilgileri ve Formu
          </CardTitle>
          <CardDescription className="text-lg">
            Bizimle iletişime geçmek için aşağıdaki bilgileri veya formu kullanabilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-primary mb-2 flex items-center"><UserIcon className="mr-2 h-5 w-5" /> Gönderen</h3>
              <p className="text-foreground/80">{user.name} {user.surname}</p>
              <p className="text-sm text-muted-foreground">{user.email ? `E-posta: ${user.email} (otomatik eklendi)` : 'Yanıt alabilmek için formda e-posta belirtin.'}</p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-primary mb-2 flex items-center"><MapPin className="mr-2 h-5 w-5" /> Adresimiz</h3>
              <p className="text-foreground/80">{CONTACT_INFO.address}</p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-primary mb-2 flex items-center"><UserIcon className="mr-2 h-5 w-5" /> Muhtar</h3>
              <p className="text-foreground/80">{CONTACT_INFO.muhtar}</p>
            </div>
             <div>
              <h3 className="text-xl font-semibold text-primary mb-2 flex items-center"><Mail className="mr-2 h-5 w-5" /> Köy E-postası</h3>
              <a href={`mailto:${CONTACT_INFO.email}`} className="text-accent hover:underline break-all">{CONTACT_INFO.email}</a>
            </div>
            <div>
                <h3 className="text-xl font-semibold text-primary mb-3">Konumumuz</h3>
                <div className="aspect-video rounded-md overflow-hidden border shadow-sm">
                    <iframe
                    src={GOOGLE_MAPS_EMBED_URL}
                    width="100%"
                    height="100%"
                    style={{ border:0 }}
                    allowFullScreen={false}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={`${VILLAGE_NAME} Haritası`}
                    ></iframe>
                </div>
                <p className="text-center mt-2">
                  <a
                    href={GOOGLE_MAPS_SHARE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Google Maps'te daha büyük haritada görüntüle
                  </a>
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-6 border rounded-lg shadow-sm bg-card">
            <h3 className="text-xl font-semibold text-primary mb-2 border-b pb-2">Bize Mesaj Gönderin</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-3">Mesajınıza yanıt alabilmek için geçerli bir e-posta adresi girdiğinizden emin olun. Bu bilgiler yalnızca site yöneticisine iletilir.</p>
            
            {!user.email && (
              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground"/> Yanıt için E-posta Adresiniz</Label>
                <Input id="contactEmail" type="email" placeholder="yanıt_adresi@example.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required disabled={isSubmitting} />
              </div>
            )}
             <div className="space-y-2">
              <Label htmlFor="subject" className="flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-muted-foreground"/> Konu</Label>
              <Input id="subject" type="text" placeholder="Mesajınızın konusu" value={subject} onChange={(e) => setSubject(e.target.value)} required disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message" className="flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-muted-foreground"/> Mesajınız</Label>
              <Textarea id="message" placeholder="Mesajınızı buraya yazın..." rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required disabled={isSubmitting} />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Gönder
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
