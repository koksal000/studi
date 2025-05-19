
"use client";

import type PeerType from 'peerjs'; // Import Peer type for type checking
import type { DataConnection, MediaConnection } from 'peerjs';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useUser } from './user-context';
import { useToast } from '@/hooks/use-toast';

// Define a well-known ID for the admin peer
export const ADMIN_PEER_ID_PREFIX = 'camlica-village-admin-';
const NON_ADMIN_PEER_ID_KEY = 'camlicaKoyuNonAdminPeerId';

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
  const [peerId, setPeerId] = useState<string | null>(null); // This state will hold the active peer's ID
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
        const uniqueAdminSuffix = user.name.toLowerCase().replace(/\s+/g, '-') || 'default-admin-user';
        const fullId = `${ADMIN_PEER_ID_PREFIX}${uniqueAdminSuffix}`;
        setAdminFullPeerId(fullId);
    } else if (user && !isAdmin) {
        // For non-admin users, set a generic target admin ID they might try to connect to.
        // This could be configurable or discovered via another mechanism in a more complex app.
        // For now, we assume a 'default-admin-user' if no specific admin target logic exists.
        setAdminFullPeerId(`${ADMIN_PEER_ID_PREFIX}default-admin-user`); 
    } else {
        setAdminFullPeerId(null); // No user, no admin ID.
    }
  }, [user, isAdmin]);

  const endMediaCallInternals = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    if (currentCall) {
      // currentCall.close(); // Avoid double closing if event already triggered by PeerJS
      setCurrentCall(null);
    }
    setIsReceivingCall(false);
    setIsCallInProgress(false);
  }, [localStream, currentCall]);

  const connectToPeer = useCallback((targetPeerId: string): DataConnection | undefined => {
    if (!peerInstance || !targetPeerId || peerInstance.disconnected) {
      if(!peerInstance?.disconnected && peerInstance) toast({ title: 'Bağlantı Hatası', description: 'P2P altyapısı hazır değil.', variant: 'destructive' });
      return undefined;
    }
    if (connections.current.has(targetPeerId) && connections.current.get(targetPeerId)?.open) {
        // console.log(`Already connected to ${targetPeerId}`);
        return connections.current.get(targetPeerId);
    }
    if (targetPeerId === peerId) { // Current actual peerId from state
        console.warn("Attempting to connect to self, aborting.");
        return undefined; 
    }

    console.log(`Attempting to connect to peer: ${targetPeerId}`);
    const conn = peerInstance.connect(targetPeerId, { reliable: true });
    
    conn.on('open', () => {
      console.log(`Data connection established with ${conn.peer}`);
      toast({ title: 'Bağlantı Başarılı', description: `${conn.peer.substring(0,12)}... ile veri bağlantısı kuruldu.` });
      connections.current.set(conn.peer, conn);
      
      if (!isAdmin && conn.peer.startsWith(ADMIN_PEER_ID_PREFIX)) {
         setTimeout(() => { 
            console.log("Requesting initial announcements from admin:", conn.peer);
            if (conn.open) conn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
         }, 1000);
      }
    });
    conn.on('data', (data) => {
      console.log('Received data:', data, 'from', conn.peer);
      if (dataHandler.current) dataHandler.current(data, conn.peer);
    });
    conn.on('close', () => {
      console.log(`Data connection with ${conn.peer} closed.`);
      toast({ title: 'Veri Bağlantısı Kapandı', description: `${conn.peer.substring(0,12)}... ayrıldı.`, variant: 'destructive' });
      connections.current.delete(conn.peer);
    });
    conn.on('error', (err) => {
      console.error(`Data connection error with ${conn.peer}:`, err);
      toast({ title: 'Veri Bağlantı Hatası', description: `${conn.peer.substring(0,12)}... ile hata: ${err.message}`, variant: 'destructive' });
      connections.current.delete(conn.peer);
    });
    return conn;
  }, [peerInstance, isAdmin, peerId, toast]);


  const initializePeer = useCallback(() => {
    if (!Peer || peerInstance || !user) {
        return;
    }

    let peerIdToUse: string | undefined = undefined;

    if (isAdmin && adminFullPeerId) {
        peerIdToUse = adminFullPeerId;
        console.log(`InitializePeer: Admin attempting to use ID: ${peerIdToUse}`);
    } else if (!isAdmin) {
        const storedPeerId = localStorage.getItem(NON_ADMIN_PEER_ID_KEY);
        if (storedPeerId) {
            peerIdToUse = storedPeerId;
            console.log(`InitializePeer: Non-admin attempting to reuse stored ID: ${peerIdToUse}`);
        } else {
            console.log("InitializePeer: Non-admin, no stored ID, PeerJS will generate one.");
        }
    }
    
    const newPeer = peerIdToUse ? new Peer(peerIdToUse) : new Peer();
    
    newPeer.on('open', (currentId) => {
      setPeerId(currentId); 
      console.log('My peer ID is: ' + currentId);
      toast({ title: 'P2P Ağı Aktif', description: `Kimliğiniz: ${currentId.substring(0,12)}...` });

      if (!isAdmin) {
        localStorage.setItem(NON_ADMIN_PEER_ID_KEY, currentId);
        if (adminFullPeerId && currentId !== adminFullPeerId) {
          console.log(`Non-admin peer ${currentId} attempting to connect to admin: ${adminFullPeerId}`);
          connectToPeer(adminFullPeerId);
        }
      } else { // User is admin
        if (peerIdToUse && currentId !== peerIdToUse) {
           // This means the desired adminFullPeerId was taken, and PeerJS assigned a new one.
           console.warn(`Admin intended to use ${peerIdToUse} but got ${currentId}. The desired ID was likely taken.`);
           toast({ 
            title: 'Yönetici Kimliği Sorunu!', 
            description: `İstenen yönetici kimliği "${peerIdToUse}" kullanılamadı. Size "${currentId.substring(0,12)}..." atandı. Diğerleri size bağlanamayabilir.`, 
            variant: 'destructive',
            duration: 15000 
          });
        }
      }
    });

    newPeer.on('connection', (incomingConn) => {
      console.log(`Incoming data connection from ${incomingConn.peer}`);
      connections.current.set(incomingConn.peer, incomingConn);
      toast({ title: 'Yeni Veri Bağlantısı', description: `${incomingConn.peer.substring(0,12)}... bağlandı.` });

      incomingConn.on('data', (data) => {
        console.log('Received data:', data, 'from', incomingConn.peer);
        if (dataHandler.current) {
          dataHandler.current(data, incomingConn.peer);
        }
      });
      incomingConn.on('close', () => {
        console.log(`Data connection from ${incomingConn.peer} closed.`);
        toast({ title: 'Veri Bağlantısı Kapandı', description: `${incomingConn.peer.substring(0,12)}... ayrıldı.`, variant: 'destructive' });
        connections.current.delete(incomingConn.peer);
      });
       incomingConn.on('error', (err) => {
        console.error(`Data connection error with ${incomingConn.peer}:`, err);
        toast({ title: 'Veri Bağlantı Hatası', description: `${incomingConn.peer.substring(0,12)}... ile hata: ${err.message}`, variant: 'destructive' });
        connections.current.delete(incomingConn.peer);
      });
    });

    newPeer.on('call', (call) => {
      console.log(`Incoming media call from ${call.peer}`);
      toast({ title: 'Gelen Arama', description: `${call.peer.substring(0,12)}... sizi arıyor.` });
      setCurrentCall(call);
      setIsReceivingCall(true);
    });

    newPeer.on('error', (err) => {
      console.error('PeerJS error:', err);
      toast({ title: 'P2P Ağ Hatası', description: `${err.type}: ${err.message}`, variant: 'destructive' });
      if (err.type === 'unavailable-id') {
        if (isAdmin && peerIdToUse === adminFullPeerId) {
          // The 'open' event will fire with a new random ID. We've handled the toast there.
          // No need to remove NON_ADMIN_PEER_ID_KEY as this is admin path.
        } else if (!isAdmin && peerIdToUse) {
          // A non-admin tried to use a stored ID, but it was taken.
          localStorage.removeItem(NON_ADMIN_PEER_ID_KEY); // Remove the bad stored ID
          toast({ title: 'P2P Kimlik Sorunu', description: 'Saklanan P2P kimliğiniz kullanılamadı, yeni bir kimlik oluşturulacak.', variant: 'destructive'});
          // A new ID will be generated on next 'open' if peer retries or on next initialization
          // To force re-initialization with a generated ID sooner, we might need to destroy and nullify peerInstance here.
          // For now, let's assume 'open' will eventually give a new ID.
        }
      } else if (err.type === 'peer-unavailable' && adminFullPeerId && err.message.includes(adminFullPeerId)) {
         console.warn(`Admin peer ${adminFullPeerId} is unavailable or does not exist.`);
      }
    });

    newPeer.on('disconnected', () => {
        console.log('Peer disconnected from signaling server. PeerJS will attempt to reconnect.');
        toast({ title: 'Sinyal Sunucusu Koptu', description: 'Yeniden bağlanmaya çalışılıyor...', variant: 'destructive'});
    });

    setPeerInstance(newPeer);
  }, [Peer, peerInstance, user, isAdmin, adminFullPeerId, toast, connectToPeer, setPeerId]);

  const broadcastData = useCallback((data: any) => {
    if (!peerInstance || peerInstance.disconnected) {
        toast({ title: 'Yayın Hatası', description: 'P2P altyapısı hazır değil.', variant: 'destructive' });
        return;
    }
    let sentCount = 0;
    console.log(`Broadcasting data. Current connections: ${connections.current.size}`);
    connections.current.forEach((conn, peerId) => {
      if (conn && conn.open) {
        console.log(`Sending data to connected peer: ${peerId}`);
        conn.send(data);
        sentCount++;
      } else {
        console.warn(`Skipping send to ${peerId}, connection not open or doesn't exist.`);
      }
    });
    if (sentCount > 0) {
        console.log(`Broadcasted data to ${sentCount} peers.`);
    } else {
        console.log("No active and open connections to broadcast data to.");
    }
  }, [peerInstance, toast]);

  const sendDataToPeer = useCallback((targetPeerId: string, data: any) => {
    const conn = connections.current.get(targetPeerId);
    if (conn && conn.open) {
      conn.send(data);
    } else {
       console.warn(`No open connection to ${targetPeerId} to send data.`);
       // Attempt to connect if not connected, then send? This could be complex.
       // connectToPeer(targetPeerId); // This would establish, then need a callback to send.
       // For now, assume connection must exist.
    }
  }, []);

  const registerDataHandler = useCallback((handler: (data: any, peerId: string) => void) => {
    dataHandler.current = handler;
  }, []);
  
  const requestInitialAnnouncements = useCallback(() => {
    if (isAdmin || !adminFullPeerId || !peerInstance || peerInstance.disconnected) return;
    const adminConn = connections.current.get(adminFullPeerId);
    if (adminConn && adminConn.open) {
        console.log("Requesting initial announcements from admin (explicit call):", adminFullPeerId);
        adminConn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
    } else {
        console.log("Not connected to admin for initial announcements request. Attempting connection to:", adminFullPeerId);
        connectToPeer(adminFullPeerId);
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

      call.on('stream', (receivedRemoteStream) => {
        toast({ title: 'Arama', description: 'Uzak akış alındı.' });
        setRemoteStream(receivedRemoteStream);
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
      endMediaCallInternals();
    }
  }, [peerInstance, user, toast, endMediaCallInternals, isCallInProgress]);

  const answerIncomingCall = useCallback(async () => {
    if (!currentCall) {
      toast({ title: 'Arama Cevaplama Hatası', description: 'Cevaplanacak gelen arama yok.', variant: 'destructive' });
      return;
    }
    if (isCallInProgress && currentCall.open) {
        toast({ title: 'Arama Hatası', description: 'Zaten bir görüşmedesiniz.', variant: 'destructive' });
        return;
    }
    setIsReceivingCall(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      currentCall.answer(stream);
      setIsCallInProgress(true);
      toast({ title: 'Arama Aktif', description: `${currentCall.peer.substring(0,12)}... ile bağlantı kuruldu.` });
      
      currentCall.on('stream', (receivedRemoteStream) => {
        setRemoteStream(receivedRemoteStream);
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
      if (currentCall) currentCall.close();
      endMediaCallInternals();
    }
  }, [currentCall, toast, endMediaCallInternals, isCallInProgress]);

  const rejectIncomingCall = useCallback(() => {
    if (currentCall && isReceivingCall) {
      currentCall.close();
      toast({ title: 'Arama Reddedildi', description: 'Gelen arama reddedildi.' });
    }
    setCurrentCall(null);
    setIsReceivingCall(false);
  }, [currentCall, isReceivingCall, toast]);

  const endMediaCall = useCallback(() => {
    if (currentCall) {
      currentCall.close();
    }
    endMediaCallInternals(); 
    toast({ title: 'Arama', description: 'Arama sonlandırıldı.' });
  }, [currentCall, endMediaCallInternals, toast]);

  useEffect(() => {
    const peerToCleanup = peerInstance;
    return () => {
      if (peerToCleanup && !peerToCleanup.destroyed) {
        console.log("PeerProvider cleanup: Destroying peer instance:", peerToCleanup.id);
        endMediaCallInternals();
        connections.current.forEach(conn => {
          if (conn.open) conn.close();
        });
        connections.current.clear();
        peerToCleanup.destroy();
      }
    };
  }, [peerInstance, endMediaCallInternals]);

   useEffect(() => {
    if (Peer && user && !peerInstance) {
      console.log("Attempting to initialize peer (Peer lib loaded, user exists, no instance)...");
      initializePeer();
    }
    
    if (!user && peerInstance && !peerInstance.destroyed) {
        console.log("User logged out, destroying peer instance:", peerInstance.id);
        // Cleanup logic is now primarily in the peerInstance-dependent useEffect above
        // Just ensure state is reset
        setPeerInstance(null);
        setPeerId(null);
        // connections.current.clear(); // Already cleared in the above effect due to peerInstance change
        // endMediaCallInternals(); // Also handled by the above effect
    }
  }, [Peer, user, peerInstance, initializePeer, endMediaCallInternals, setPeerId]);


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

    