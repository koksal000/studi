
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
  adminFullPeerId: string | null; // The ID an admin *tries* to get, or a client *targets*
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
  const peerInstanceRef = useRef<PeerType | null>(null); // Use ref to avoid stale closures in callbacks
  const [peerId, setPeerId] = useState<string | null>(null);
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const connections = useRef<Map<string, DataConnection>>(new Map());
  const dataHandler = useRef<((data: any, peerId: string) => void) | null>(null);
  const [adminFullPeerId, setAdminFullPeerId] = useState<string | null>(null); // Admin's desired ID

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [currentCall, setCurrentCall] = useState<MediaConnection | null>(null);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  
  const isInitializingRef = useRef(false); // Prevent multiple initializations

  useEffect(() => {
    import('peerjs').then(module => {
      setPeer(() => module.default);
    }).catch(err => console.error("Failed to load PeerJS", err));
  }, []);

  useEffect(() => {
    if (user && isAdmin) {
        const uniqueAdminSuffix = user.name.toLowerCase().replace(/\s+/g, '-') || 'default-admin-user';
        const fullId = `${ADMIN_PEER_ID_PREFIX}${uniqueAdminSuffix}`;
        console.log(`Admin user detected. Determined adminFullPeerId: ${fullId}`);
        setAdminFullPeerId(fullId);
    } else if (user && !isAdmin) {
        const defaultAdminTargetSuffix = 'default-admin-user'; 
        const targetAdminId = `${ADMIN_PEER_ID_PREFIX}${defaultAdminTargetSuffix}`;
        console.log(`Non-admin user. Target adminFullPeerId for connection: ${targetAdminId}`);
        setAdminFullPeerId(targetAdminId); // Non-admins target this ID
    } else {
        setAdminFullPeerId(null); 
    }
  }, [user, isAdmin]);

  const endMediaCallInternals = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    if (currentCall) {
      setCurrentCall(null);
    }
    setIsReceivingCall(false);
    setIsCallInProgress(false);
  }, [localStream, currentCall]);

  const connectToPeer = useCallback((targetPeerId: string): DataConnection | undefined => {
    const currentPeer = peerInstanceRef.current;
    if (!currentPeer || !targetPeerId || currentPeer.disconnected) {
      if(currentPeer && !currentPeer.disconnected) {
          // toast({ title: 'Bağlantı Hatası', description: 'P2P altyapısı hazır değil.', variant: 'destructive' });
      }
      console.warn("connectToPeer: Peer instance not ready or targetPeerId missing. Peer disconnected:", currentPeer?.disconnected);
      return undefined;
    }
    if (connections.current.has(targetPeerId) && connections.current.get(targetPeerId)?.open) {
        console.log(`Already connected to ${targetPeerId}. Returning existing connection.`);
        return connections.current.get(targetPeerId);
    }
    if (targetPeerId === peerId) { 
        console.warn("Attempting to connect to self, aborting.");
        return undefined; 
    }

    console.log(`Attempting to connect to data peer: ${targetPeerId}`);
    const conn = currentPeer.connect(targetPeerId, { reliable: true });
    
    conn.on('open', () => {
      console.log(`Data connection established with ${conn.peer}`);
      toast({ title: 'Bağlantı Başarılı', description: `${conn.peer.substring(0,12)}... ile veri bağlantısı kuruldu.` });
      connections.current.set(conn.peer, conn);
      
      if (!isAdmin && conn.peer.startsWith(ADMIN_PEER_ID_PREFIX)) {
         console.log("Requesting initial announcements from admin:", conn.peer);
         if (conn.open) conn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
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
  }, [isAdmin, peerId, toast, dataHandler]);


  const initializePeer = useCallback(() => {
    if (!Peer || peerInstanceRef.current || !user || isInitializingRef.current) {
        console.log("InitializePeer: Pre-conditions not met or already initializing. PeerJS lib loaded?", !!Peer, "Peer instance exists?", !!peerInstanceRef.current, "User exists?", !!user, "Initializing?", isInitializingRef.current);
        return;
    }
    
    if (isAdmin && !adminFullPeerId) {
      console.log("InitializePeer: Admin user, but adminFullPeerId not yet determined. Waiting...");
      return; 
    }
    isInitializingRef.current = true;

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
    
    console.log(`InitializePeer: Creating new Peer instance with ID: ${peerIdToUse || 'auto-generated'}`);
    const newPeer = peerIdToUse ? new Peer(peerIdToUse) : new Peer();
    peerInstanceRef.current = newPeer;
    
    newPeer.on('open', (currentId) => {
      setPeerId(currentId); 
      console.log('My peer ID is: ' + currentId);
      toast({ title: 'P2P Ağı Aktif', description: `Kimliğiniz: ${currentId.substring(0,12)}...` });
      isInitializingRef.current = false;

      if (!isAdmin) {
        localStorage.setItem(NON_ADMIN_PEER_ID_KEY, currentId);
        if (adminFullPeerId && currentId !== adminFullPeerId) {
          console.log(`Non-admin peer ${currentId} attempting to connect to admin: ${adminFullPeerId}`);
          connectToPeer(adminFullPeerId);
        }
      } else { 
        if (peerIdToUse && currentId !== peerIdToUse) {
           console.warn(`Admin intended to use ${peerIdToUse} but got ${currentId}. The desired ID ${peerIdToUse} was likely taken or there was an issue. Current admin ID is ${currentId}.`);
           toast({ 
            title: 'Yönetici Kimliği Çakışması!', 
            description: `İstenen yönetici kimliği ("${peerIdToUse.substring(0,12)}...") kullanılamadı. Size "${currentId.substring(0,12)}..." atandı. Diğer kullanıcılar size bağlanamayabilir.`, 
            variant: 'destructive',
            duration: 15000 
          });
           // Update adminFullPeerId to the actual ID assigned if it differs
           // This is tricky because clients target the original name-based ID.
           // setAdminFullPeerId(currentId); // This could cause loops if not handled carefully. For now, admin is just informed.
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
        } else {
          console.warn("Data received but no dataHandler registered in PeerContext for peer:", incomingConn.peer, "Data:", data);
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
      isInitializingRef.current = false; // Allow re-initialization on error
      if (err.type === 'unavailable-id') {
        if (isAdmin && peerIdToUse === adminFullPeerId) {
           // 'open' event will fire with a new random ID. The toast in 'open' for admins covers this.
           console.warn(`Admin's desired ID ${adminFullPeerId} is unavailable. PeerJS will assign a random ID.`);
        } else if (!isAdmin && peerIdToUse) {
          localStorage.removeItem(NON_ADMIN_PEER_ID_KEY); 
          toast({ title: 'P2P Kimlik Sorunu', description: 'Saklanan P2P kimliğiniz kullanılamadı, yeni bir kimlik oluşturulacak.', variant: 'destructive'});
          if (peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
            peerInstanceRef.current.destroy();
          }
          peerInstanceRef.current = null; // Force re-creation with new ID
          setPeerId(null);
          // Re-call initializePeer after a delay to allow PeerJS to recover or to avoid rapid loops
          // setTimeout(() => initializePeer(), 1000); // Be careful with this
        }
      } else if (err.type === 'peer-unavailable' && adminFullPeerId && err.message.includes(adminFullPeerId) && !isAdmin) {
         console.warn(`Admin peer ${adminFullPeerId} is unavailable or does not exist. Client won't connect to admin.`);
         toast({ title: 'Yönetici Ulaşılamaz', description: `Yönetici (${adminFullPeerId.substring(0,12)}...) bulunamıyor. Duyurular alınamayabilir.`, variant: 'destructive', duration: 10000});
      }
      // Potentially destroy and nullify peerInstanceRef.current here to allow re-init
      if (peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
          peerInstanceRef.current.destroy();
      }
      peerInstanceRef.current = null;
      setPeerId(null);
    });

    newPeer.on('disconnected', () => {
        console.log('Peer disconnected from signaling server. PeerJS will attempt to reconnect.');
        toast({ title: 'Sinyal Sunucusu Koptu', description: 'Yeniden bağlanmaya çalışılıyor...', variant: 'destructive'});
    });

  }, [Peer, user, isAdmin, adminFullPeerId, toast, connectToPeer, setPeerId, dataHandler]);

  const broadcastData = useCallback((data: any) => {
    const currentPeer = peerInstanceRef.current;
    if (!currentPeer || currentPeer.disconnected) {
        toast({ title: 'Yayın Hatası', description: 'P2P altyapısı hazır değil.', variant: 'destructive' });
        return;
    }
    let sentCount = 0;
    console.log(`Broadcasting data. Total connections in map: ${connections.current.size}. Data:`, data);
    connections.current.forEach((conn, peerIdIter) => {
      if (conn && conn.open) {
        console.log(`Sending data to connected and open peer: ${peerIdIter}`);
        conn.send(data);
        sentCount++;
      } else {
        console.warn(`Skipping send to ${peerIdIter}, connection not open or doesn't exist. Open: ${conn?.open}, Exists: ${!!conn}`);
      }
    });
    if (sentCount > 0) {
        console.log(`Broadcasted data to ${sentCount} peers.`);
    } else {
        console.warn("No active and open connections to broadcast data to. Check connection status and map content.");
    }
  }, [toast]);

  const sendDataToPeer = useCallback((targetPeerId: string, data: any) => {
    const conn = connections.current.get(targetPeerId);
    if (conn && conn.open) {
      conn.send(data);
    } else {
       console.warn(`No open connection to ${targetPeerId} to send data. Attempting to connect.`);
       const newConn = connectToPeer(targetPeerId); // Attempt to connect
       if (newConn) {
         // Queue data or send on 'open' event of newConn
         newConn.on('open', () => {
            console.log(`Connection to ${targetPeerId} opened for queued send. Sending data.`);
            newConn.send(data);
         });
       } else {
        toast({title: "Bağlantı Yok", description: `${targetPeerId.substring(0,12)}... ile bağlantı kurulamadı. Veri gönderilemedi.`, variant: "destructive"});
       }
    }
  }, [connectToPeer, toast]);

  const registerDataHandler = useCallback((handler: (data: any, peerId: string) => void) => {
    console.log("PeerContext: Registering new data handler.");
    dataHandler.current = handler;
  }, []);
  
  const requestInitialAnnouncements = useCallback(() => {
    const currentPeer = peerInstanceRef.current;
    if (!adminFullPeerId || !currentPeer || currentPeer.disconnected) return;
    
    // Try to connect to admin if not already connected
    let adminConn = connections.current.get(adminFullPeerId);
    if (!adminConn || !adminConn.open) {
        console.log("Not connected to admin for initial announcements request. Attempting connection to:", adminFullPeerId);
        adminConn = connectToPeer(adminFullPeerId);
    }

    if (adminConn) { // It might still be undefined if connectToPeer failed
        if (adminConn.open) {
            console.log("Requesting initial announcements from admin (explicit call):", adminFullPeerId);
            adminConn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
        } else {
            // If connection was just initiated, wait for it to open
            adminConn.on('open', () => {
                console.log("Connection to admin opened. Requesting initial announcements from admin:", adminFullPeerId);
                adminConn!.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
            });
        }
    } else {
        console.warn("Could not establish or find connection to admin to request initial announcements.");
    }
  }, [adminFullPeerId, connectToPeer]);

  // Media Call Functions
  const startMediaCall = useCallback(async (targetPeerId: string) => {
    const currentPeer = peerInstanceRef.current;
    if (!currentPeer || !user || currentPeer.disconnected) {
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
      
      const call = currentPeer.call(targetPeerId, stream);
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
  }, [user, toast, endMediaCallInternals, isCallInProgress]);

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
    } else {
      endMediaCallInternals();
    }
    toast({ title: 'Arama', description: 'Arama sonlandırıldı.' });
  }, [currentCall, endMediaCallInternals, toast]);

   useEffect(() => {
    const peerToCleanup = peerInstanceRef.current;
    return () => {
      if (peerToCleanup && !peerToCleanup.destroyed) {
        console.log("PeerProvider cleanup: Destroying peer instance:", peerToCleanup.id);
        endMediaCallInternals();
        connections.current.forEach(conn => {
          if (conn.open) conn.close();
        });
        connections.current.clear();
        peerToCleanup.destroy();
        peerInstanceRef.current = null; 
        setPeerId(null);       
      }
    };
  }, [endMediaCallInternals]); // Only depends on endMediaCallInternals

   useEffect(() => {
    // This effect handles initializing the peer when conditions are met.
    if (Peer && user && !peerInstanceRef.current && !isInitializingRef.current) {
      if (isAdmin && !adminFullPeerId) {
        console.log("Peer init useEffect: Admin user, waiting for adminFullPeerId to be determined.");
        return; 
      }
      console.log(`Peer init useEffect: Conditions met. Initializing peer. Peer Lib: ${!!Peer}, User: ${!!user}, PeerInstance: ${!!peerInstanceRef.current}, IsAdmin: ${isAdmin}, AdminFullPeerId: ${adminFullPeerId}`);
      initializePeer();
    }
    
    // This effect handles destroying the peer when the user logs out.
    if (!user && peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
        console.log("Peer init useEffect: User logged out, destroying peer instance:", peerInstanceRef.current.id);
        // Cleanup is handled by the previous useEffect when peerInstanceRef.current changes or on unmount.
        // Forcing destroy here ensures cleanup if the component doesn't unmount immediately.
        const peerToDestroy = peerInstanceRef.current;
        endMediaCallInternals();
        connections.current.forEach(conn => {
            if(conn.open) conn.close();
        });
        connections.current.clear();
        peerToDestroy.destroy();
        peerInstanceRef.current = null;
        setPeerId(null);
    }
  }, [Peer, user, initializePeer, isAdmin, adminFullPeerId, endMediaCallInternals]);


  return (
    <PeerContext.Provider value={{ 
        peer: peerInstanceRef.current, 
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

