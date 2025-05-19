"use client";

import { useState, type FormEvent } from 'react';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DISTRICT_NAME, VILLAGE_NAME } from '@/lib/constants';

export function EntryForm() {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const { login, showEntryForm, setShowEntryForm } = useUser();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && surname.trim()) {
      login(name.trim(), surname.trim());
    }
  };

  if (!showEntryForm) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">{VILLAGE_NAME}</CardTitle>
          <CardDescription className="text-muted-foreground">{DISTRICT_NAME}'in Merkez Köyü</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="userName">Adınız:</Label>
              <Input
                id="userName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-input"
                placeholder="Adınızı girin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userSurname">Soyadınız:</Label>
              <Input
                id="userSurname"
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                required
                className="bg-input"
                placeholder="Soyadınızı girin"
              />
            </div>
            <Button type="submit" className="w-full text-lg py-3">
              Giriş Yap
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}