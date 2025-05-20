
"use client";

import type PeerType from 'peerjs'; // Import Peer type for type checking
import type { DataConnection, MediaConnection } from 'peerjs';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useUser } from './user-context';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_CONTACT_PEER_ID } from '@/lib/constants'; // Import default contact peer ID

const MY_PEER_ID_KEY = 'KOYUMDOMANIC_PEER_ID'; // Generic key for storing any user's peer ID

interface PeerContextType {
  peer: PeerType | null;
  peerId: string | null;
  connections: React.MutableRefObject<Map<string, DataConnection>>;
  initializePeer: () => void;
  connectToPeer: (targetPeerId: string, isInitialContactAttempt?: boolean) => DataConnection | undefined;
  broadcastData: (data: any, excludePeerId?: string) => void; // Added excludePeerId
  sendDataToPeer: (targetPeerId: string, data: any) => void;
  registerDataHandler: (handler: (data: any, peerId: string) => void) => void;
  requestInitialAnnouncements: (targetPeerId: string) => void; // Target specific peer

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
  const [PeerModule, setPeerModule] = useState<typeof PeerType | null>(null);
  const peerInstanceRef = useRef<PeerType | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const { user } = useUser();
  const { toast } = useToast();
  const connections = useRef<Map<string, DataConnection>>(new Map());
  const dataHandler = useRef<((data: any, peerId: string) => void) | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [currentCall, setCurrentCall] = useState<MediaConnection | null>(null);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  
  const isInitializingRef = useRef(false);

  useEffect(() => {
    import('peerjs').then(module => {
      setPeerModule(() => module.default);
    }).catch(err => console.error("Failed to load PeerJS", err));
  }, []);


  const endMediaCallInternals = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    if (currentCall) {
      currentCall.close(); // Ensure call is closed on PeerJS side
      setCurrentCall(null);
    }
    setIsReceivingCall(false);
    setIsCallInProgress(false);
  }, [localStream, currentCall]);

  const connectToPeer = useCallback((targetPeerId: string, isInitialContactAttempt = false): DataConnection | undefined => {
    const currentPeer = peerInstanceRef.current;
    if (!currentPeer || !targetPeerId || currentPeer.disconnected) {
      console.warn("connectToPeer: Peer instance not ready or targetPeerId missing. Peer disconnected:", currentPeer?.disconnected, "Target:", targetPeerId);
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
      
      // Request initial announcements from any peer upon successful connection
      console.log(`Requesting initial announcements from newly connected peer: ${conn.peer}`);
      if (conn.open) conn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });

    });
    conn.on('data', (data) => {
      console.log('Received data:', data, 'from', conn.peer);
      if (dataHandler.current) dataHandler.current(data, conn.peer);
    });
    conn.on('close', () => {
      console.log(`Data connection with ${conn.peer} closed.`);
      toast({ title: 'Veri Bağlantısı Kapandı', description: `${(conn.peer || targetPeerId).substring(0,12)}... ayrıldı.`, variant: 'destructive' });
      connections.current.delete(conn.peer);
      connections.current.delete(targetPeerId); 
    });
    conn.on('error', (err) => {
      console.error(`Data connection error with target ${targetPeerId} (conn.peer could be ${conn.peer}):`, err);
       if (isInitialContactAttempt && targetPeerId === DEFAULT_CONTACT_PEER_ID) {
        toast({ title: 'İlk Kontak Kurulamadı', description: `Varsayılan kontak noktası (${targetPeerId.substring(0,12)}...) ile bağlantı kurulamadı. Hata: ${err.message}`, variant: 'destructive', duration: 8000 });
      } else {
        toast({ title: 'Veri Bağlantı Hatası', description: `${targetPeerId.substring(0,12)}... ile hata: ${err.message}`, variant: 'destructive' });
      }
      connections.current.delete(conn.peer); 
      connections.current.delete(targetPeerId);
    });
    return conn;
  }, [peerId, toast, dataHandler]);


  const initializePeer = useCallback(() => {
    if (!PeerModule || !user || isInitializingRef.current || (peerInstanceRef.current && !peerInstanceRef.current.destroyed) ) {
        console.log("InitializePeer: Pre-conditions not met, already initializing, or peer already exists and not destroyed. PeerJS lib loaded?", !!PeerModule, "User exists?", !!user, "Initializing flag?", isInitializingRef.current, "Peer instance exists and not destroyed?", !!(peerInstanceRef.current && !peerInstanceRef.current.destroyed));
        if (peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
            console.log("InitializePeer: Peer instance details - ID:", peerInstanceRef.current.id, "Connected:", peerInstanceRef.current.connected);
        }
        return;
    }
    
    isInitializingRef.current = true;

    let peerIdToUse: string | undefined = undefined;
    const storedPeerId = localStorage.getItem(MY_PEER_ID_KEY);
    if (storedPeerId) {
        peerIdToUse = storedPeerId;
        console.log(`InitializePeer: Attempting to reuse stored ID: ${peerIdToUse}`);
    } else {
        console.log("InitializePeer: No stored ID, PeerJS will generate one.");
    }
    
    console.log(`InitializePeer: Creating new Peer instance with ID: ${peerIdToUse || 'auto-generated'}`);
    
    // If an old, destroyed peer instance exists in the ref, or if there's an ID mismatch, clear it.
    if(peerInstanceRef.current && (peerInstanceRef.current.destroyed || (peerIdToUse && peerInstanceRef.current.id !== peerIdToUse))){
        console.warn("InitializePeer: Destroying existing peer instance before creating a new one. Old ID:", peerInstanceRef.current.id);
        peerInstanceRef.current.destroy();
        peerInstanceRef.current = null; // Clear the ref
    }


    const newPeer = peerIdToUse ? new PeerModule(peerIdToUse) : new PeerModule();
    peerInstanceRef.current = newPeer;
    
    newPeer.on('open', (currentId) => {
      setPeerId(currentId); 
      console.log('My peer ID is: ' + currentId);
      toast({ title: 'P2P Ağı Aktif', description: `Kimliğiniz: ${currentId.substring(0,12)}...` });
      
      localStorage.setItem(MY_PEER_ID_KEY, currentId);

      // Attempt to connect to a default contact peer if not this peer
      if (currentId !== DEFAULT_CONTACT_PEER_ID) {
          console.log(`Peer ${currentId} attempting to connect to default contact peer: ${DEFAULT_CONTACT_PEER_ID}`);
          connectToPeer(DEFAULT_CONTACT_PEER_ID, true);
      }
      isInitializingRef.current = false; 
    });

    newPeer.on('connection', (incomingConn) => {
      console.log(`Incoming data connection from ${incomingConn.peer}`);
      connections.current.set(incomingConn.peer, incomingConn);
      toast({ title: 'Yeni Veri Bağlantısı', description: `${incomingConn.peer.substring(0,12)}... bağlandı.` });

      // Request initial announcements from the new incomer immediately
      const handleOpenAndRequest = () => {
        console.log(`Connection from ${incomingConn.peer} opened, requesting initial announcements.`);
        if (incomingConn.open) {
            incomingConn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
        }
      };

      if (incomingConn.open) { 
         handleOpenAndRequest();
      } else {
        incomingConn.on('open', handleOpenAndRequest);
      }

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
      let showGenericToast = true;
      
      if (err.type === 'unavailable-id') {
        showGenericToast = false; 
        if (peerIdToUse) { 
          console.warn(`Stored peer ID ${peerIdToUse} is unavailable. Removing it.`);
          localStorage.removeItem(MY_PEER_ID_KEY); 
          toast({ title: 'P2P Kimlik Sorunu', description: 'Saklanan P2P kimliğiniz kullanılamadı, yeni bir kimlik oluşturulacak.', variant: 'destructive'});
        }
        if (peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
            peerInstanceRef.current.destroy();
        }
        peerInstanceRef.current = null; 
        setPeerId(null);
        isInitializingRef.current = false; // Reset the flag to allow re-initialization
        // No need to re-call initializePeer here, useEffect will handle it due to peerId change or user change.
      } else if (err.type === 'peer-unavailable' && DEFAULT_CONTACT_PEER_ID && err.message.includes(DEFAULT_CONTACT_PEER_ID)) {
         showGenericToast = false;
         console.warn(`Default contact peer ${DEFAULT_CONTACT_PEER_ID} is unavailable or does not exist.`);
         // Toast for this is already handled in connectToPeer
      } else if (err.type === 'network') {
        showGenericToast = false;
        console.error('PeerJS network error.', err);
        toast({ title: 'P2P Ağ Hatası', description: 'Ağ bağlantı sorunu.', variant: 'destructive', duration: 8000});
      } else if (err.type === 'server-error') {
         showGenericToast = false;
         console.error('PeerJS server error.', err);
         toast({ title: 'Sinyal Sunucu Hatası', description: 'Sinyal sunucusunda bir sorun var.', variant: 'destructive', duration: 8000});
      }
      
      if (showGenericToast) {
        toast({ title: 'P2P Ağ Hatası', description: `${err.type}: ${err.message}`, variant: 'destructive' });
      }
      
      if (peerInstanceRef.current && !peerInstanceRef.current.destroyed && err.type !== 'peer-unavailable') {
          console.warn("Destroying peer instance due to error:", err.type);
          peerInstanceRef.current.destroy();
          peerInstanceRef.current = null;
          setPeerId(null); 
      }

      // For most errors, allow re-initialization attempts.
      // For 'unavailable-id', it's already handled.
      if (err.type !== 'unavailable-id') {
        isInitializingRef.current = false;
      }
    });

    newPeer.on('disconnected', () => {
        console.log('Peer disconnected from signaling server. PeerJS will attempt to reconnect automatically.');
        // toast({ title: 'Sinyal Sunucusu Koptu', description: 'Yeniden bağlanmaya çalışılıyor...', variant: "destructive" });
    });

    newPeer.on('close', () => {
        console.log('Peer connection closed (destroyed).');
        if(peerInstanceRef.current && peerInstanceRef.current.id === newPeer.id) { // Check if it's the same instance
            peerInstanceRef.current = null; // Clear the ref for this specific instance
            setPeerId(null); // Reset peerId if this instance was providing it
        }
        isInitializingRef.current = false;
    });

  }, [PeerModule, user, toast, connectToPeer, dataHandler, peerId]); // Added peerId to deps

  const broadcastData = useCallback((data: any, excludePeerId?: string) => {
    const currentPeer = peerInstanceRef.current;
    if (!currentPeer || currentPeer.disconnected) {
        console.warn("BroadcastData: Peer instance not ready. Data not sent.", data);
        return;
    }
    let sentCount = 0;
    let connectedPeersInfo = Array.from(connections.current.keys()).map(key => ({id: key, open: connections.current.get(key)?.open }));
    console.log(`Broadcasting data. Total connections in map: ${connections.current.size}. Connections: ${JSON.stringify(connectedPeersInfo)}. Data:`, data, `Exclude: ${excludePeerId}`);
    
    connections.current.forEach((conn, peerIdIter) => {
      if (conn && conn.open && peerIdIter !== excludePeerId) {
        console.log(`Sending data to connected and open peer: ${peerIdIter}`);
        try {
            conn.send(data);
            sentCount++;
        } catch (error) {
            console.error(`Error sending data to ${peerIdIter}:`, error);
        }
      } else {
        console.warn(`Skipping send to ${peerIdIter}, connection not open, doesn't exist, or is excluded. Open: ${conn?.open}, Exists: ${!!conn}, Excluded: ${peerIdIter === excludePeerId}`);
      }
    });

    if (sentCount > 0) {
        console.log(`Broadcasted data to ${sentCount} peers.`);
    } else if (connections.current.size > 0 && Array.from(connections.current.keys()).some(key => key !== excludePeerId)) { // Check if there were potential recipients
        console.warn("No *open* connections to broadcast data to (excluding self/excluded), though some connections exist or all were excluded.");
    } else if (connections.current.size === 0){
        console.warn("No connections in map to broadcast data to.");
    }
  }, []); 

  const sendDataToPeer = useCallback((targetPeerId: string, data: any) => {
    const currentPeer = peerInstanceRef.current;
    if (!currentPeer || currentPeer.disconnected) {
        console.warn(`sendDataToPeer: Peer instance not ready. Data to ${targetPeerId} not sent.`, data);
        return;
    }
    const conn = connections.current.get(targetPeerId);
    if (conn && conn.open) {
      console.log(`Sending data directly to ${targetPeerId}`);
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
        console.error(`Failed to initiate connection attempt to ${targetPeerId} for sendDataToPeer.`);
       }
    }
  }, [connectToPeer]);

  const registerDataHandler = useCallback((handler: (data: any, peerId: string) => void) => {
    console.log("PeerContext: Registering new data handler.");
    dataHandler.current = handler;
  }, []);
  
  const requestInitialAnnouncements = useCallback((targetPeerId: string) => {
    const currentPeer = peerInstanceRef.current;
    if (!targetPeerId || !currentPeer || currentPeer.disconnected) {
        console.warn("requestInitialAnnouncements: TargetPeerId not set or peer not ready.");
        return;
    }
    
    let targetConn = connections.current.get(targetPeerId);
    if (!targetConn || !targetConn.open) {
        console.log("Not connected to target for initial announcements request. Attempting connection to:", targetPeerId);
        targetConn = connectToPeer(targetPeerId); 
    }

    if (targetConn) { 
        const sendRequest = () => {
            console.log("Requesting initial announcements from peer (explicit call):", targetPeerId);
            if (targetConn?.open) targetConn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
        };

        if (targetConn.open) {
            sendRequest();
        } else {
            const onOpenHandler = () => {
                console.log("Connection to peer opened. Requesting initial announcements from (onOpen):", targetPeerId);
                sendRequest();
                targetConn?.off('open', onOpenHandler); 
            };
            targetConn.on('open', onOpenHandler);
        }
    } else {
        console.warn("Could not establish or find connection to peer to request initial announcements:", targetPeerId);
    }
  }, [connectToPeer]); 

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
    if(!currentCall) { // If no current call, ensure cleanup
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
      }
    };
  }, [endMediaCallInternals]); 

   useEffect(() => {
    // Initialize PeerJS instance when the module is loaded and user is available
    if (PeerModule && user && !peerInstanceRef.current && !isInitializingRef.current) {
      console.log(`Peer init useEffect: Conditions met. Initializing peer. Peer Lib: ${!!PeerModule}, User: ${!!user}, PeerInstanceRef: ${!!peerInstanceRef.current}, Initializing: ${isInitializingRef.current}`);
      initializePeer();
    }
    
    // Cleanup PeerJS instance when user logs out
    if (!user && peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
        console.log("Peer init useEffect: User logged out, destroying peer instance:", peerInstanceRef.current.id);
        const peerToDestroy = peerInstanceRef.current;
        endMediaCallInternals(); // Clean up any active calls
        connections.current.forEach(conn => { // Close all data connections
            if(conn.open) conn.close();
        });
        connections.current.clear();
        peerToDestroy.destroy();
        peerInstanceRef.current = null; // Clear the ref
        setPeerId(null); // Reset peerId state
        isInitializingRef.current = false; // Reset initializing flag
    }
  }, [PeerModule, user, initializePeer, endMediaCallInternals]); 

  return (
    <PeerContext.Provider value={{ 
        peer: peerInstanceRef.current, 
        peerId, 
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
