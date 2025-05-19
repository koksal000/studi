
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
  const peerInstanceRef = useRef<PeerType | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const connections = useRef<Map<string, DataConnection>>(new Map());
  const dataHandler = useRef<((data: any, peerId: string) => void) | null>(null);
  const [adminFullPeerId, setAdminFullPeerId] = useState<string | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [currentCall, setCurrentCall] = useState<MediaConnection | null>(null);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  
  const isInitializingRef = useRef(false);

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
        // Non-admins will try to connect to an admin with a known suffix if provided,
        // otherwise, they might connect to any peer claiming to be admin or a specific one.
        // For simplicity, let's assume a default admin they try to connect to for initial data.
        const defaultAdminTargetSuffix = 'default-admin-user'; 
        const targetAdminId = `${ADMIN_PEER_ID_PREFIX}${defaultAdminTargetSuffix}`;
        console.log(`Non-admin user. Target adminFullPeerId for connection: ${targetAdminId}`);
        setAdminFullPeerId(targetAdminId); // Non-admins target this for initial sync
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
      // currentCall.close(); // This is handled by the caller (endMediaCall) or event handlers
      setCurrentCall(null);
    }
    setIsReceivingCall(false);
    setIsCallInProgress(false);
  }, [localStream, currentCall]);


  const connectToPeer = useCallback((targetPeerId: string): DataConnection | undefined => {
    const currentPeer = peerInstanceRef.current;
    if (!currentPeer || !targetPeerId || currentPeer.disconnected) {
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
      
      // If a non-admin connects to the designated admin peer, request initial announcements
      if (!isAdmin && adminFullPeerId && conn.peer === adminFullPeerId) {
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
      toast({ title: 'Veri Bağlantısı Kapandı', description: `${(conn.peer || targetPeerId).substring(0,12)}... ayrıldı.`, variant: 'destructive' });
      connections.current.delete(conn.peer);
      connections.current.delete(targetPeerId); // Ensure removal by target ID as well
    });
    conn.on('error', (err) => {
      console.error(`Data connection error with target ${targetPeerId} (conn.peer: ${conn.peer}):`, err);
      if (!isAdmin && targetPeerId === adminFullPeerId) {
        toast({ title: 'Yöneticiye Bağlanılamadı', description: `Yönetici (${targetPeerId.substring(0,12)}...) ile bağlantı kurulamadı. Duyurular alınamayabilir. Hata: ${err.message}`, variant: 'destructive', duration: 8000 });
      } else {
        toast({ title: 'Veri Bağlantı Hatası', description: `${targetPeerId.substring(0,12)}... ile hata: ${err.message}`, variant: 'destructive' });
      }
      connections.current.delete(conn.peer); // conn.peer might be undefined
      connections.current.delete(targetPeerId);
    });
    return conn;
  }, [isAdmin, peerId, toast, adminFullPeerId, dataHandler]);


  const initializePeer = useCallback(() => {
    if (!Peer || peerInstanceRef.current || !user || isInitializingRef.current) {
        console.log("InitializePeer: Pre-conditions not met or already initializing/initialized. PeerJS lib loaded?", !!Peer, "Peer instance exists?", !!peerInstanceRef.current, "User exists?", !!user, "Initializing?", isInitializingRef.current);
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
    // Ensure any old instance is destroyed before creating a new one, especially if retrying with a different ID
    if(peerInstanceRef.current && !peerInstanceRef.current.destroyed){
        peerInstanceRef.current.destroy();
    }
    const newPeer = peerIdToUse ? new Peer(peerIdToUse) : new Peer();
    peerInstanceRef.current = newPeer;
    
    newPeer.on('open', (currentId) => {
      setPeerId(currentId); 
      console.log('My peer ID is: ' + currentId);
      toast({ title: 'P2P Ağı Aktif', description: `Kimliğiniz: ${currentId.substring(0,12)}...` });
      
      if (!isAdmin) {
        localStorage.setItem(NON_ADMIN_PEER_ID_KEY, currentId);
        // Attempt to connect to the admin peer if not already trying/connected
        if (adminFullPeerId && currentId !== adminFullPeerId && (!connections.current.has(adminFullPeerId) || !connections.current.get(adminFullPeerId)?.open)) {
          console.log(`Non-admin peer ${currentId} attempting to connect to admin: ${adminFullPeerId}`);
          connectToPeer(adminFullPeerId);
        }
      } else { // Current user is admin
        if (peerIdToUse && currentId !== peerIdToUse) {
           // This means the admin's desired ID was taken, and PeerJS assigned a random one.
           console.warn(`Admin intended to use ${peerIdToUse} but got ${currentId}. The desired ID ${peerIdToUse} was likely taken. Current admin ID is ${currentId}.`);
           toast({ 
            title: 'Yönetici Kimliği Sorunu!', 
            description: `İstenen yönetici kimliği ("${peerIdToUse.substring(0,12)}...") kullanılamadı. Size "${currentId.substring(0,12)}..." atandı. Diğer kullanıcılar size bağlanamayabilir.`, 
            variant: 'destructive',
            duration: 15000 
          });
           // It's important adminFullPeerId reflects the *actual* ID for internal logic if needed,
           // but clients will still target the name-based one. This is a known limitation.
           // setAdminFullPeerId(currentId); // This could be problematic if clients target the name-based ID.
        }
      }
      isInitializingRef.current = false; // Allow re-initialization if needed after 'open'
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
        console.error(`Data connection error with incoming ${incomingConn.peer}:`, err);
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
           console.warn(`Admin's desired ID ${adminFullPeerId} is unavailable. PeerJS will assign a random ID on 'open'.`);
        } else if (!isAdmin && peerIdToUse) { // Non-admin's stored ID is unavailable
          console.warn(`Stored non-admin ID ${peerIdToUse} is unavailable. Removing it.`);
          localStorage.removeItem(NON_ADMIN_PEER_ID_KEY); 
          toast({ title: 'P2P Kimlik Sorunu', description: 'Saklanan P2P kimliğiniz kullanılamadı, yeni bir kimlik oluşturulacak.', variant: 'destructive'});
          if (peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
            peerInstanceRef.current.destroy();
          }
          peerInstanceRef.current = null; 
          setPeerId(null);
          isInitializingRef.current = false; // Allow re-initialization attempt
          // setTimeout(() => initializePeer(), 1000); // Re-attempt with auto-generated ID
        }
      } else if (err.type === 'peer-unavailable' && adminFullPeerId && err.message.includes(adminFullPeerId) && !isAdmin) {
         console.warn(`Admin peer ${adminFullPeerId} is unavailable or does not exist. Client won't connect to admin.`);
         toast({ title: 'Yönetici Ulaşılamaz', description: `Yönetici (${adminFullPeerId.substring(0,12)}...) bulunamıyor. Duyurular alınamayabilir.`, variant: 'destructive', duration: 10000});
      }
      
      // General cleanup for most errors to allow re-initialization
      if (peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
          peerInstanceRef.current.destroy();
      }
      peerInstanceRef.current = null;
      setPeerId(null); // Reset peerId state
      isInitializingRef.current = false; // Reset flag to allow re-initialization
    });

    newPeer.on('disconnected', () => {
        console.log('Peer disconnected from signaling server. PeerJS will attempt to reconnect.');
        toast({ title: 'Sinyal Sunucusu Koptu', description: 'Yeniden bağlanmaya çalışılıyor...', variant: 'destructive'});
        // isInitializingRef.current = false; // Allow re-initialization if reconnection fails
    });

  }, [Peer, user, isAdmin, adminFullPeerId, toast, connectToPeer, setPeerId, dataHandler]); // Removed peerId from here

  const broadcastData = useCallback((data: any) => {
    const currentPeer = peerInstanceRef.current;
    if (!currentPeer || currentPeer.disconnected) {
        // toast({ title: 'Yayın Hatası', description: 'P2P altyapısı hazır değil.', variant: 'destructive' });
        console.warn("BroadcastData: Peer instance not ready. Data not sent.", data);
        return;
    }
    let sentCount = 0;
    let connectedPeersInfo = Array.from(connections.current.keys()).map(key => ({id: key, open: connections.current.get(key)?.open }));
    console.log(`Broadcasting data. Total connections in map: ${connections.current.size}. Connections: ${JSON.stringify(connectedPeersInfo)}. Data:`, data);
    
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
    } else if (connections.current.size > 0) {
        console.warn("No *open* connections to broadcast data to, though some connections exist. Check their 'open' status.");
    } else {
        console.warn("No connections in map to broadcast data to.");
    }
  }, [toast]);

  const sendDataToPeer = useCallback((targetPeerId: string, data: any) => {
    const conn = connections.current.get(targetPeerId);
    if (conn && conn.open) {
      conn.send(data);
    } else {
       console.warn(`No open connection to ${targetPeerId} to send data. Attempting to connect.`);
       const newConn = connectToPeer(targetPeerId); 
       if (newConn) {
         newConn.on('open', () => {
            console.log(`Connection to ${targetPeerId} opened for queued send. Sending data.`);
            newConn.send(data);
         });
       } else {
        // connectToPeer itself will show a toast if it fails to create a connection object or it errors.
        console.error(`Failed to initiate connection attempt to ${targetPeerId} for sendDataToPeer.`);
       }
    }
  }, [connectToPeer, toast]);

  const registerDataHandler = useCallback((handler: (data: any, peerId: string) => void) => {
    console.log("PeerContext: Registering new data handler.");
    dataHandler.current = handler;
  }, []);
  
  const requestInitialAnnouncements = useCallback(() => {
    const currentPeer = peerInstanceRef.current;
    if (!adminFullPeerId || !currentPeer || currentPeer.disconnected) {
        console.warn("requestInitialAnnouncements: AdminFullPeerId not set or peer not ready.");
        return;
    }
    
    let adminConn = connections.current.get(adminFullPeerId);
    if (!adminConn || !adminConn.open) {
        console.log("Not connected to admin for initial announcements request. Attempting connection to:", adminFullPeerId);
        adminConn = connectToPeer(adminFullPeerId);
    }

    if (adminConn) { 
        if (adminConn.open) {
            console.log("Requesting initial announcements from admin (explicit call):", adminFullPeerId);
            adminConn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
        } else {
            adminConn.on('open', () => {
                console.log("Connection to admin opened. Requesting initial announcements from admin (onOpen):", adminFullPeerId);
                if (adminConn?.open) adminConn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
            });
        }
    } else {
        console.warn("Could not establish or find connection to admin to request initial announcements.");
    }
  }, [adminFullPeerId, connectToPeer]);

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
    }
    // endMediaCallInternals will be called by the 'close' event of the call
    // or if there's no currentCall, we call it directly.
    if(!currentCall) {
      endMediaCallInternals();
    }
    toast({ title: 'Arama', description: 'Arama sonlandırıldı.' });
  }, [currentCall, endMediaCallInternals, toast]);

   useEffect(() => {
    const peerToCleanup = peerInstanceRef.current;
    return () => {
      if (peerToCleanup && !peerToCleanup.destroyed) {
        console.log("PeerProvider cleanup on unmount: Destroying peer instance:", peerToCleanup.id);
        endMediaCallInternals();
        connections.current.forEach(conn => {
          if (conn.open) conn.close();
        });
        connections.current.clear();
        peerToCleanup.destroy();
        // peerInstanceRef.current = null; // No need, ref will be stale anyway if component unmounts
        // setPeerId(null);       
      }
    };
  }, [endMediaCallInternals]); 

   useEffect(() => {
    if (Peer && user && !peerInstanceRef.current && !isInitializingRef.current) {
      if (isAdmin && !adminFullPeerId) {
        console.log("Peer init useEffect: Admin user, waiting for adminFullPeerId to be determined before initializing peer.");
        return; 
      }
      console.log(`Peer init useEffect: Conditions met. Initializing peer. Peer Lib: ${!!Peer}, User: ${!!user}, PeerInstance: ${!!peerInstanceRef.current}, IsAdmin: ${isAdmin}, AdminFullPeerId: ${adminFullPeerId}`);
      initializePeer();
    }
    
    if (!user && peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
        console.log("Peer init useEffect: User logged out, destroying peer instance:", peerInstanceRef.current.id);
        const peerToDestroy = peerInstanceRef.current;
        endMediaCallInternals();
        connections.current.forEach(conn => {
            if(conn.open) conn.close();
        });
        connections.current.clear();
        peerToDestroy.destroy();
        peerInstanceRef.current = null;
        setPeerId(null);
        isInitializingRef.current = false; // Reset for potential re-login
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

