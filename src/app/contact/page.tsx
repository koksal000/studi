
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CONTACT_INFO, VILLAGE_NAME, GOOGLE_MAPS_EMBED_URL } from '@/lib/constants';
import { Mail, MapPin, Phone, User, MessageSquare, Send, Loader2, ExternalLink } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useState, type FormEvent, useEffect } from 'react';
import { useUser } from '@/contexts/user-context';
import { EntryForm } from '@/components/specific/entry-form';
import { useContactMessages } from '@/hooks/use-contact-messages'; 

export default function ContactPage() {
  const { toast } = useToast();
  const { user, showEntryForm } = useUser();
  const [formData, setFormData] = useState({ email: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addContactMessage } = useContactMessages();

  useEffect(() => {
    if (user && user.email) { // Assuming user object might have an email
       setFormData(prev => ({ ...prev, email: user.email || '' }));
    } else if (user) {
       setFormData(prev => ({ ...prev, email: '' })); // Clear email if user has no email
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Giriş Gerekli",
        description: "Mesaj göndermek için lütfen adınızı ve soyadınızı girin.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.email.trim() || !formData.subject.trim() || !formData.message.trim()) {
      toast({
        title: "Eksik Bilgi",
        description: "Lütfen tüm alanları doldurun.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    
    try {
      const payload = {
        name: `${user.name} ${user.surname}`, // Name comes from logged-in user
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      };

      await addContactMessage(payload); // This now only sends to API

      toast({
        title: "Mesajınız Gönderildi!",
        description: "En kısa sürede sizinle iletişime geçeceğiz.",
      });
      setFormData({ email: user.email || '', subject: '', message: '' }); // Reset subject and message, keep email if user has one
    } catch (error: any) {
      console.error("Form Submission Error:", error);
      // Error toast is now handled within addContactMessage or by the API response
      // No need to show a generic one here unless the hook re-throws and we want to catch it specifically
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
              <h3 className="text-xl font-semibold text-primary mb-2 flex items-center"><User className="mr-2 h-5 w-5" /> Gönderen</h3>
              <p className="text-foreground/80">{user.name} {user.surname} (Bu bilgi mesajınıza otomatik eklenecektir)</p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-primary mb-2 flex items-center"><MapPin className="mr-2 h-5 w-5" /> Adresimiz</h3>
              <p className="text-foreground/80">{CONTACT_INFO.address}</p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-primary mb-2 flex items-center"><User className="mr-2 h-5 w-5" /> Muhtar</h3>
              <p className="text-foreground/80">{CONTACT_INFO.muhtar}</p>
            </div>
             <div>
              <h3 className="text-xl font-semibold text-primary mb-2 flex items-center"><Mail className="mr-2 h-5 w-5" /> E-posta</h3>
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
            <h3 className="text-xl font-semibold text-primary mb-4 border-b pb-2">Bize Mesaj Gönderin</h3>
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground"/> E-posta Adresiniz</Label>
              <Input id="email" type="email" placeholder="ornek@eposta.com" value={formData.email} onChange={handleChange} required disabled={isSubmitting} />
            </div>
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
