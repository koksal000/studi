
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CONTACT_INFO, VILLAGE_NAME, GOOGLE_MAPS_EMBED_URL } from '@/lib/constants';
import { Mail, MapPin, User as UserIcon, MessageSquare, Send, Loader2, ExternalLink } from 'lucide-react'; // Renamed User to UserIcon
import { useToast } from "@/hooks/use-toast";
import { useState, type FormEvent } from 'react';
import { useUser } from '@/contexts/user-context';
import { EntryForm } from '@/components/specific/entry-form';
import { useContactMessages } from '@/hooks/use-contact-messages'; 

export default function ContactPage() {
  const { toast } = useToast();
  const { user, showEntryForm } = useUser();
  const [formData, setFormData] = useState({ subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addContactMessage } = useContactMessages();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) { 
      toast({
        title: "Giriş Gerekli",
        description: "Mesaj göndermek için lütfen adınızı, soyadınızı ve e-postanızı giriş formunda belirtin.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.subject.trim() || !formData.message.trim()) {
      toast({
        title: "Eksik Bilgi",
        description: "Lütfen konu ve mesaj alanlarını doldurun.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    
    try {
      const payload = {
        name: `${user.name} ${user.surname}`, 
        email: user.email, 
        subject: formData.subject,
        message: formData.message,
      };

      await addContactMessage(payload); 

      toast({
        title: "Mesajınız Gönderildi!",
        description: "En kısa sürede sizinle iletişime geçeceğiz.",
      });
      setFormData({ subject: '', message: '' }); 
    } catch (error: any) {
      console.error("Form Submission Error:", error);
      // Toast for error is handled within useContactMessages or here if it's not caught there
      if (!(error.message?.includes("Sunucu hatası") || error.message?.includes("Ağ hatası"))) {
          toast({ title: "Mesaj Gönderilemedi", description: error.message || "Bilinmeyen bir hata oluştu.", variant: "destructive"});
      }
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
              <p className="text-sm text-muted-foreground">E-posta: {user.email} (Bu bilgiler mesajınıza otomatik eklenecektir)</p>
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
                    href="https://maps.app.goo.gl/TdNCaaRwhZ61oA5QA"
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
            <p className="text-xs text-muted-foreground mt-1 mb-3">Gönderdiğiniz mesajlar kimseyle paylaşılmayacak olup, yalnızca site yöneticisine iletilerek taleplerinizin işleme alınması amacıyla kullanılacaktır.</p>
             <div className="space-y-2">
              <Label htmlFor="subject" className="flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-muted-foreground"/> Konu</Label>
              <Input id="subject" type="text" placeholder="Mesajınızın konusu" value={formData.subject} onChange={handleChange} required disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message" className="flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-muted-foreground"/> Mesajınız</Label>
              <Textarea id="message" placeholder="Mesajınızı buraya yazın..." rows={5} value={formData.message} onChange={handleChange} required disabled={isSubmitting} />
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
