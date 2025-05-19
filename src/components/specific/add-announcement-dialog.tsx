"use client";

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useAnnouncements } from '@/hooks/use-announcements';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label }