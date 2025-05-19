
"use client";

import type PeerType from 'peerjs'; // Import Peer type for type checking
import type { DataConnection, MediaConnection } from 'peerjs';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useUser } from './user-context';
import { useToast } from '@/hooks/use-toast';

// Define a well-known ID for the admin peer
export const ADMIN_PEER_ID_PREFIX = 'camlica-village-admin-';

interface PeerContextType {
  peer: PeerType | null;
  peerId: string | null;
  adminFullPeerId: string | null;
  connections: React.MutableRefObject<Map<string, DataConnection>>;
  initializePeer: () => void;
  connectToPeer: (targetPeerId: string) => DataConnection | undefined;
  broadcastData: (data: any) => void;
  sendDataToPeer: (targetPeerId: string, data: any) => void;
  registerDataHandler: (handler: (data: any, peerId: string) => void) => void;
  requestInitialAnnouncements: () => void;

  // Media Call related properties and functions
  startMediaCall: (targetPeerId: string) => Promise<void>;
  answerIncomingCall: () => Promise<void>;
  rejectIncomingCall: () => void;
  endMediaCall: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isReceivingCall: boolean;
  currentCall: MediaConnection | null;
  isCallInProgress: boolean;
}

const PeerContext = createContext<PeerContextType | undefined>(undefined);

interface PeerProviderProps {
  children: ReactNode;
}

export const PeerProvider = ({ children }: PeerProviderProps) => {
  const [Peer, setPeer] = useState<typeof PeerType | null>(null);
  const [peerInstance, setPeerInstance] = useState<PeerType | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const connections = useRef<Map<string, DataConnection>>(new Map());
  const dataHandler = useRef<((data: any, peerId: string) => void) | null>(null);
  const [adminFullPeerId, setAdminFullPeerId] = useState<string | null>(null);

  // State for Media Calls
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [currentCall, setCurrentCall] = useState<MediaConnection | null>(null);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [isCallInProgress, setIsCallInProgress] = useState(false);

  useEffect(() => {
    import('peerjs').then(module => {
      setPeer(() => module.default);
    }).catch(err => console.error("Failed to load PeerJS", err));
  }, []);

  useEffect(() => {
    if (user && isAdmin) {
        const uniqueAdminSuffix = user.name.toLowerCase().replace(/\s+/g, '-') || 'default';
        const fullId = `${ADMIN_PEER_ID_PREFIX}${uniqueAdminSuffix}`;
        setAdminFullPeerId(fullId);
    } else {
        setAdminFullPeerId(`${ADMIN_PEER_ID_PREFIX}default`); 
    }
  }, [user, isAdmin]);

  const endMediaCallInternals = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    if (currentCall) {
      // currentCall.close(); // Avoid double closing if event already triggered
      setCurrentCall(null);
    }
    setIsReceivingCall(false);
    setIsCallInProgress(false);
  }, [localStream, currentCall]);


  const initializePeer = useCallback(() => {
    if (!Peer || peerInstance || !user) return;

    let currentPeerIdToUse = '';
    if (isAdmin && adminFullPeerId) {
      currentPeerIdToUse = adminFullPeerId;
    }

    const newPeer = currentPeerIdToUse ? new Peer(currentPeerIdToUse) : new Peer();
    
    newPeer.on('open', (id) => {
      setPeerId(id);
      console.log('My peer ID is: ' + id);
      toast({ title: 'P2P Ağı Aktif', description: `Kimliğiniz: ${id.substring(0,12)}...` });
      if (!isAdmin) {
        if(adminFullPeerId) connectToPeer(adminFullPeerId);
      }
    });

    newPeer.on('connection', (conn) => {
      console.log(`Incoming data connection from ${conn.peer}`);
      toast({ title: 'Yeni Veri Bağlantısı', description: `${conn.peer.substring(0,12)}... bağlandı.` });
      connections.current.set(conn.peer, conn);
      conn.on('data', (data) => {
        console.log('Received data:', data, 'from', conn.peer);
        if (dataHandler.current) {
          dataHandler.current(data, conn.peer);
        }
      });
      conn.on('close', () => {
        console.log(`Data connection from ${conn.peer} closed.`);
        toast({ title: 'Veri Bağlantısı Kapandı', description: `${conn.peer.substring(0,12)}... ayrıldı.`, variant: 'destructive' });
        connections.current.delete(conn.peer);
      });
       conn.on('error', (err) => {
        console.error(`Data connection error with ${conn.peer}:`, err);
        toast({ title: 'Veri Bağlantı Hatası', description: `${conn.peer.substring(0,12)}... ile hata: ${err.message}`, variant: 'destructive' });
        connections.current.delete(conn.peer);
      });
    });

    // Handle incoming media calls
    newPeer.on('call', (call) => {
      toast({ title: 'Gelen Arama', description: `${call.peer.substring(0,12)}... sizi arıyor.` });
      setCurrentCall(call);
      setIsReceivingCall(true);
      // UI should prompt user to answer or reject
    });

    newPeer.on('error', (err) => {
      console.error('PeerJS error:', err);
      toast({ title: 'P2P Ağ Hatası', description: `${err.type}: ${err.message}`, variant: 'destructive' });
      if (err.type === 'unavailable-id' && isAdmin && adminFullPeerId) {
        toast({ title: 'Yönetici Kimliği Alınamadı', description: `"${adminFullPeerId}" kimliği zaten kullanımda.`, variant: 'destructive' });
      }
      // Consider resetting peerInstance for re-initialization attempt on certain errors
      // setPeerInstance(null); 
    });

    newPeer.on('disconnected', () => {
        console.log('Peer disconnected from signaling server. Attempting to reconnect...');
        toast({ title: 'Sinyal Sunucusu Koptu', description: 'Yeniden bağlanmaya çalışılıyor...', variant: 'destructive'});
        // PeerJS attempts to reconnect automatically.
    });

    setPeerInstance(newPeer);

  }, [Peer, peerInstance, user, isAdmin, adminFullPeerId, toast, connectToPeer]); // Added connectToPeer

  const connectToPeer = useCallback((targetPeerId: string): DataConnection | undefined => {
    if (!peerInstance || !targetPeerId || peerInstance.disconnected) {
      if(!peerInstance?.disconnected && peerInstance) toast({ title: 'Bağlantı Hatası', description: 'P2P altyapısı hazır değil.', variant: 'destructive' });
      return undefined;
    }
    if (connections.current.has(targetPeerId)) {
        return connections.current.get(targetPeerId);
    }
    if (targetPeerId === peerId) return undefined;

    const conn = peerInstance.connect(targetPeerId, { reliable: true });
    conn.on('open', () => {
      toast({ title: 'Bağlantı Başarılı', description: `${targetPeerId.substring(0,12)}... ile veri bağlantısı kuruldu.` });
      connections.current.set(targetPeerId, conn);
      if (!isAdmin && targetPeerId.startsWith(ADMIN_PEER_ID_PREFIX)) {
         setTimeout(() => { 
            console.log("Requesting initial announcements from admin:", targetPeerId);
            if (conn.open) conn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
         }, 1000);
      }
    });
    conn.on('data', (data) => {
      if (dataHandler.current) dataHandler.current(data, conn.peer);
    });
    conn.on('close', () => {
      toast({ title: 'Veri Bağlantısı Kapandı', description: `${conn.peer.substring(0,12)}... ayrıldı.`, variant: 'destructive' });
      connections.current.delete(conn.peer);
    });
    conn.on('error', (err) => {
      toast({ title: 'Veri Bağlantı Hatası', description: `${conn.peer.substring(0,12)}... ile hata: ${err.message}`, variant: 'destructive' });
      connections.current.delete(conn.peer);
    });
    return conn;
  }, [peerInstance, isAdmin, peerId, toast]);

  const broadcastData = useCallback((data: any) => {
    if (!peerInstance) return;
    connections.current.forEach((conn) => {
      if (conn && conn.open) conn.send(data);
    });
  }, [peerInstance]);

  const sendDataToPeer = useCallback((targetPeerId: string, data: any) => {
    const conn = connections.current.get(targetPeerId);
    if (conn && conn.open) {
      conn.send(data);
    } else {
       // connectToPeer(targetPeerId)?.send(data); // Potentially aggressive
    }
  }, [/* connectToPeer */]); // Removed connectToPeer to avoid potential loops if used aggressively

  const registerDataHandler = useCallback((handler: (data: any, peerId: string) => void) => {
    dataHandler.current = handler;
  }, []);
  
  const requestInitialAnnouncements = useCallback(() => {
    if (isAdmin || !adminFullPeerId || !peerInstance || peerInstance.disconnected) return;
    const adminConn = connections.current.get(adminFullPeerId);
    if (adminConn && adminConn.open) {
        adminConn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
    } else {
        connectToPeer(adminFullPeerId); // Connection attempt will trigger announcement request if successful
    }
  }, [isAdmin, adminFullPeerId, peerInstance, connectToPeer]);

  // Media Call Functions
  const startMediaCall = useCallback(async (targetPeerId: string) => {
    if (!peerInstance || !user || peerInstance.disconnected) {
      toast({ title: 'Arama Hatası', description: 'P2P hazır değil veya kullanıcı yok.', variant: 'destructive' });
      return;
    }
    if (isCallInProgress) {
      toast({ title: 'Arama Hatası', description: 'Zaten bir görüşmedesiniz.', variant: 'destructive' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      toast({ title: 'Arama Başlatılıyor', description: `${targetPeerId.substring(0,12)}... aranıyor.` });
      const call = peerInstance.call(targetPeerId, stream);
      setCurrentCall(call);
      setIsCallInProgress(true);
      call.on('stream', (stream) => {
        toast({ title: 'Arama', description: 'Uzak akış alındı.' });
        setRemoteStream(stream);
      });
      call.on('close', () => {
        toast({ title: 'Arama Sonlandı', description: 'Arama kapatıldı.' });
        endMediaCallInternals();
      });
      call.on('error', (err) => {
        toast({ title: 'Arama Hatası', description: err.message, variant: 'destructive' });
        endMediaCallInternals();
      });
    } catch (err: any) {
      console.error('Yerel akış alınamadı veya arama başlatılamadı', err);
      toast({ title: 'Arama Hatası', description: `Arama başlatılamadı: ${err.message}`, variant: 'destructive' });
      endMediaCallInternals(); // Clean up if starting call failed
    }
  }, [peerInstance, user, toast, endMediaCallInternals, isCallInProgress]);

  const answerIncomingCall = useCallback(async () => {
    if (!currentCall) {
      toast({ title: 'Arama Cevaplama Hatası', description: 'Cevaplanacak gelen arama yok.', variant: 'destructive' });
      return;
    }
    if (isCallInProgress) {
      toast({ title: 'Arama Hatası', description: 'Zaten bir görüşmedesiniz. Önce mevcut aramayı sonlandırın.', variant: 'destructive' });
      rejectIncomingCall(); // Reject the new call if already in one
      return;
    }
    setIsReceivingCall(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      currentCall.answer(stream);
      setIsCallInProgress(true);
      toast({ title: 'Arama Aktif', description: `${currentCall.peer.substring(0,12)}... ile bağlantı kuruldu.` });
      currentCall.on('stream', (remoteStream) => {
        setRemoteStream(remoteStream);
      });
      currentCall.on('close', () => {
        toast({ title: 'Arama Sonlandı', description: 'Arama kapatıldı.' });
        endMediaCallInternals();
      });
      currentCall.on('error', (err) => {
        toast({ title: 'Arama Hatası', description: err.message, variant: 'destructive' });
        endMediaCallInternals();
      });
    } catch (err: any) {
      console.error('Yerel akış alınamadı veya arama cevaplanamadı', err);
      toast({ title: 'Arama Cevaplama Hatası', description: `Arama cevaplanamadı: ${err.message}`, variant: 'destructive' });
      currentCall.close(); // Close the call if we can't answer
      endMediaCallInternals();
    }
  }, [currentCall, toast, endMediaCallInternals, isCallInProgress]);

  const rejectIncomingCall = useCallback(() => {
    if (currentCall && isReceivingCall) { // Only reject if it's an incoming call we haven't answered
      currentCall.close(); // Inform the other peer
      toast({ title: 'Arama Reddedildi', description: 'Gelen arama reddedildi.' });
    }
    // Clean up local state associated with the call attempt
    setCurrentCall(null);
    setIsReceivingCall(false);
    // Do not stop localStream here as it might be in use or not yet acquired
  }, [currentCall, isReceivingCall, toast]);

  const endMediaCall = useCallback(() => {
    if (currentCall) {
      currentCall.close();
    }
    endMediaCallInternals(); // This handles stopping local stream and resetting states
    toast({ title: 'Arama', description: 'Arama sonlandırıldı.' });
  }, [currentCall, endMediaCallInternals, toast]);

  useEffect(() => {
    return () => {
      endMediaCallInternals();
      if (peerInstance) {
        peerInstance.destroy();
      }
      connections.current.clear();
    };
  }, [peerInstance, endMediaCallInternals]);

   useEffect(() => {
    if (Peer && user && !peerInstance) {
      initializePeer();
    }
  }, [Peer, user, peerInstance, initializePeer]);


  return (
    <PeerContext.Provider value={{ 
        peer: peerInstance, 
        peerId, 
        adminFullPeerId,
        connections, 
        initializePeer, 
        connectToPeer, 
        broadcastData, 
        sendDataToPeer,
        registerDataHandler,
        requestInitialAnnouncements,
        // Media call values
        startMediaCall,
        answerIncomingCall,
        rejectIncomingCall,
        endMediaCall,
        localStream,
        remoteStream,
        isReceivingCall,
        currentCall,
        isCallInProgress
    }}>
      {children}
    </PeerContext.Provider>
  );
};

export const usePeer = (): PeerContextType => {
  const context = useContext(PeerContext);
  if (context === undefined) {
    throw new Error('usePeer must be used within a PeerProvider');
  }
  return context;
};

    