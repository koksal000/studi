
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
        // For non-admin users, or if admin details are not yet available for some reason.
        // This assumes a 'default' admin peer ID they might try to connect to.
        // Adjust if non-admins should not guess an admin ID or if there's a different discovery mechanism.
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
    if (connections.current.has(targetPeerId)) {
        // console.log(`Already connected or connecting to ${targetPeerId}`);
        return connections.current.get(targetPeerId);
    }
    if (targetPeerId === peerId) return undefined; // Cannot connect to self

    console.log(`Attempting to connect to peer: ${targetPeerId}`);
    const conn = peerInstance.connect(targetPeerId, { reliable: true });
    conn.on('open', () => {
      console.log(`Data connection established with ${conn.peer}`);
      toast({ title: 'Bağlantı Başarılı', description: `${conn.peer.substring(0,12)}... ile veri bağlantısı kuruldu.` });
      connections.current.set(conn.peer, conn);
      // If a non-admin connects to an admin, request initial announcements
      if (!isAdmin && conn.peer.startsWith(ADMIN_PEER_ID_PREFIX)) {
         // Add a small delay to ensure the connection is fully ready on both ends
         setTimeout(() => { 
            console.log("Requesting initial announcements from admin:", conn.peer);
            if (conn.open) conn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
         }, 1000); // 1-second delay, adjust as needed
      }
    });
    conn.on('data', (data) => {
      console.log('Received data:', data, 'from', conn.peer);
      if (dataHandler.current) dataHandler.current(data, conn.peer);
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
    return conn;
  }, [peerInstance, isAdmin, peerId, toast]); // dataHandler.current is intentionally not a dependency to avoid re-creating connectToPeer when dataHandler changes. It's a ref.


  const initializePeer = useCallback(() => {
    if (!Peer || peerInstance || !user) return;

    let currentPeerIdToUse = '';
    // Only attempt to use a predefined ID if isAdmin and adminFullPeerId is set
    if (isAdmin && adminFullPeerId) {
      currentPeerIdToUse = adminFullPeerId;
    } else if (!isAdmin && peerId) { // If a non-admin already has an ID, don't re-initialize with a blank one
        return;
    }


    // If currentPeerIdToUse is empty, PeerJS will generate a random ID.
    const newPeer = currentPeerIdToUse ? new Peer(currentPeerIdToUse) : new Peer();
    
    newPeer.on('open', (id) => {
      setPeerId(id);
      console.log('My peer ID is: ' + id);
      toast({ title: 'P2P Ağı Aktif', description: `Kimliğiniz: ${id.substring(0,12)}...` });
      // If this peer is not an admin and has a target admin ID, try to connect
      if (!isAdmin && adminFullPeerId && id !== adminFullPeerId) {
        connectToPeer(adminFullPeerId);
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
        connections.current.delete(conn.peer); // Ensure connection is removed on error
      });
    });

    // Handle incoming media calls
    newPeer.on('call', (call) => {
      console.log(`Incoming media call from ${call.peer}`);
      toast({ title: 'Gelen Arama', description: `${call.peer.substring(0,12)}... sizi arıyor.` });
      setCurrentCall(call);
      setIsReceivingCall(true);
      // UI should prompt user to answer or reject via usePeer() consumers
    });

    newPeer.on('error', (err) => {
      console.error('PeerJS error:', err);
      toast({ title: 'P2P Ağ Hatası', description: `${err.type}: ${err.message}`, variant: 'destructive' });
      if (err.type === 'unavailable-id' && isAdmin && adminFullPeerId) {
        toast({ title: 'Yönetici Kimliği Alınamadı', description: `"${adminFullPeerId}" kimliği zaten kullanımda. Lütfen farklı bir yönetici adı/soyadı ile tekrar deneyin veya mevcut oturumu sonlandırın.`, variant: 'destructive' });
        // Potentially reset adminFullPeerId or offer a way for user to change their admin identifier if this is critical
      } else if (err.type === 'peer-unavailable' && err.message.includes(adminFullPeerId || '')) {
         console.warn(`Admin peer ${adminFullPeerId} is unavailable.`);
         // This is expected if the admin peer is not online.
         // Could add a toast here if desired, but might be noisy.
      }
      // Consider resetting peerInstance for re-initialization attempt on certain errors
      // setPeerInstance(null); 
    });

    newPeer.on('disconnected', () => {
        console.log('Peer disconnected from signaling server. Attempting to reconnect...');
        toast({ title: 'Sinyal Sunucusu Koptu', description: 'Yeniden bağlanmaya çalışılıyor...', variant: 'destructive'});
        // PeerJS attempts to reconnect automatically.
        // We might not need to do anything here, but good to be aware.
    });

    setPeerInstance(newPeer);

  }, [Peer, peerInstance, user, isAdmin, adminFullPeerId, peerId, toast, connectToPeer]); // Added peerId as a dependency for the non-admin check

  const broadcastData = useCallback((data: any) => {
    if (!peerInstance || peerInstance.disconnected) {
        toast({ title: 'Yayın Hatası', description: 'P2P altyapısı hazır değil.', variant: 'destructive' });
        return;
    }
    let sentCount = 0;
    connections.current.forEach((conn) => {
      if (conn && conn.open) {
        conn.send(data);
        sentCount++;
      }
    });
    if (sentCount > 0) {
        // console.log(`Broadcasted data to ${sentCount} peers.`);
    } else {
        // console.log("No active connections to broadcast data to.");
    }
  }, [peerInstance, toast]);

  const sendDataToPeer = useCallback((targetPeerId: string, data: any) => {
    const conn = connections.current.get(targetPeerId);
    if (conn && conn.open) {
      conn.send(data);
    } else {
       console.warn(`No open connection to ${targetPeerId}. Attempting to connect and send is not implemented here to avoid loops. Ensure connection exists.`);
       // toast({ title: 'Gönderim Hatası', description: `${targetPeerId.substring(0,12)}... ile bağlantı yok.`, variant: 'destructive' });
       // Potentially: connectToPeer(targetPeerId)?.on('open', () => { conn.send(data); }); but this adds complexity.
    }
  }, [/* connectToPeer - removed to avoid potential issues, connection should be established first */]);

  const registerDataHandler = useCallback((handler: (data: any, peerId: string) => void) => {
    dataHandler.current = handler;
  }, []);
  
  const requestInitialAnnouncements = useCallback(() => {
    // This function is typically called by a non-admin user after connecting to an admin
    if (isAdmin || !adminFullPeerId || !peerInstance || peerInstance.disconnected) return;

    const adminConn = connections.current.get(adminFullPeerId);
    if (adminConn && adminConn.open) {
        console.log("Requesting initial announcements from admin (explicit call):", adminFullPeerId);
        adminConn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
    } else {
        // If not connected, try to connect. The connection 'open' handler will then request announcements.
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
      setIsCallInProgress(true); // Set immediately after initiating call

      call.on('stream', (receivedRemoteStream) => { // Renamed to avoid confusion with state variable
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
      endMediaCallInternals(); // Clean up if starting call failed
    }
  }, [peerInstance, user, toast, endMediaCallInternals, isCallInProgress]);

  const answerIncomingCall = useCallback(async () => {
    if (!currentCall) {
      toast({ title: 'Arama Cevaplama Hatası', description: 'Cevaplanacak gelen arama yok.', variant: 'destructive' });
      return;
    }
    if (isCallInProgress && currentCall.open) { // Check if currentCall is already open and part of an active call
        toast({ title: 'Arama Hatası', description: 'Zaten bir görüşmedesiniz. Yeni aramayı reddetmelisiniz.', variant: 'destructive' });
        // currentCall.close(); // This would close the *new* incoming call if it overwrote the existing one
        // Consider a mechanism to explicitly reject the *new* call if state indicates another active one.
        // For now, this logic might be tricky if `currentCall` gets reassigned before old one is fully closed.
        // A safer approach is UI preventing answering if `isCallInProgress` is true with a *different* call.
        return;
    }
    setIsReceivingCall(false); // No longer just "receiving", now trying to answer
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      currentCall.answer(stream); // Answer the call with our stream
      setIsCallInProgress(true); // Call is now active
      toast({ title: 'Arama Aktif', description: `${currentCall.peer.substring(0,12)}... ile bağlantı kuruldu.` });
      
      currentCall.on('stream', (receivedRemoteStream) => { // Renamed to avoid confusion
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
      if (currentCall) currentCall.close(); // Close the call attempt if we can't answer
      endMediaCallInternals();
    }
  }, [currentCall, toast, endMediaCallInternals, isCallInProgress]);

  const rejectIncomingCall = useCallback(() => {
    if (currentCall && isReceivingCall) { // Only reject if it's an incoming call we haven't answered
      currentCall.close(); // Inform the other peer we are not answering
      toast({ title: 'Arama Reddedildi', description: 'Gelen arama reddedildi.' });
    }
    // Clean up local state associated with this specific incoming call attempt
    setCurrentCall(null); // Clear the call object as it's been rejected
    setIsReceivingCall(false); // No longer receiving this call
    // Do not stop localStream here, as it might be from a previous or unrelated call, or not yet acquired.
    // endMediaCallInternals is too broad here as it would affect an ongoing separate call.
  }, [currentCall, isReceivingCall, toast]);

  const endMediaCall = useCallback(() => {
    if (currentCall) {
      currentCall.close(); // This will trigger the 'close' event on the call object for both peers
    }
    // Call endMediaCallInternals to clean up streams and state
    // The 'close' event handler on the call object will also call endMediaCallInternals,
    // but calling it here ensures cleanup even if the event doesn't fire immediately or correctly.
    endMediaCallInternals(); 
    toast({ title: 'Arama', description: 'Arama sonlandırıldı.' });
  }, [currentCall, endMediaCallInternals, toast]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("PeerProvider unmounting. Cleaning up PeerJS resources.");
      endMediaCallInternals(); // Clean up any active call streams
      if (peerInstance) {
        // Close all data connections explicitly
        connections.current.forEach(conn => {
          if (conn.open) conn.close();
        });
        connections.current.clear();
        
        // Destroy the peer instance
        if (!peerInstance.destroyed) {
          peerInstance.destroy();
        }
        setPeerInstance(null);
        setPeerId(null);
      }
    };
  }, [peerInstance, endMediaCallInternals]); // Ensure peerInstance is in dependency array for proper cleanup

   // Initialize PeerJS instance when Peer library and user are available
   useEffect(() => {
    if (Peer && user && !peerInstance) { // Only initialize if not already initialized
      console.log("Attempting to initialize peer...");
      initializePeer();
    }
    // If user logs out, peerInstance should be destroyed
    if (!user && peerInstance && !peerInstance.destroyed) {
        console.log("User logged out, destroying peer instance.");
        peerInstance.destroy();
        setPeerInstance(null);
        setPeerId(null);
        connections.current.clear();
        endMediaCallInternals();
    }
  }, [Peer, user, peerInstance, initializePeer, endMediaCallInternals]);


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

    
