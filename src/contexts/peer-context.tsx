
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
        console.log(`Admin user detected. Determined adminFullPeerId: ${fullId}`);
        setAdminFullPeerId(fullId);
    } else if (user && !isAdmin) {
        // For non-admin users, set a generic target admin ID they might try to connect to.
        const defaultAdminTargetSuffix = 'default-admin-user'; // This could be configurable
        const targetAdminId = `${ADMIN_PEER_ID_PREFIX}${defaultAdminTargetSuffix}`;
        console.log(`Non-admin user. Target adminFullPeerId for connection: ${targetAdminId}`);
        setAdminFullPeerId(targetAdminId); 
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
      setCurrentCall(null);
    }
    setIsReceivingCall(false);
    setIsCallInProgress(false);
  }, [localStream, currentCall]);

  const connectToPeer = useCallback((targetPeerId: string): DataConnection | undefined => {
    if (!peerInstance || !targetPeerId || peerInstance.disconnected) {
      if(!peerInstance?.disconnected && peerInstance) toast({ title: 'Bağlantı Hatası', description: 'P2P altyapısı hazır değil.', variant: 'destructive' });
      console.warn("connectToPeer: Peer instance not ready or targetPeerId missing. Peer disconnected:", peerInstance?.disconnected);
      return undefined;
    }
    if (connections.current.has(targetPeerId) && connections.current.get(targetPeerId)?.open) {
        return connections.current.get(targetPeerId);
    }
    if (targetPeerId === peerId) { 
        console.warn("Attempting to connect to self, aborting.");
        return undefined; 
    }

    console.log(`Attempting to connect to data peer: ${targetPeerId}`);
    const conn = peerInstance.connect(targetPeerId, { reliable: true });
    
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
  }, [peerInstance, isAdmin, peerId, toast, dataHandler]);


  const initializePeer = useCallback(() => {
    if (!Peer || peerInstance || !user) {
        console.log("InitializePeer: Pre-conditions not met. PeerJS lib loaded?", !!Peer, "Peer instance exists?", !!peerInstance, "User exists?", !!user);
        return;
    }
     // For admins, ensure adminFullPeerId is determined before initializing
    if (isAdmin && !adminFullPeerId) {
      console.log("InitializePeer: Admin user, but adminFullPeerId not yet determined. Waiting...");
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
    
    console.log(`InitializePeer: Creating new Peer instance with ID: ${peerIdToUse || 'auto-generated'}`);
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
           console.warn(`Admin intended to use ${peerIdToUse} but got ${currentId}. The desired ID was likely taken or there was an issue.`);
           toast({ 
            title: 'Yönetici Kimliği Sorunu!', 
            description: `İstenen yönetici kimliği ("${peerIdToUse.substring(0,12)}...") kullanılamadı. Size "${currentId.substring(0,12)}..." atandı. Diğer kullanıcılar size bağlanamayabilir.`, 
            variant: 'destructive',
            duration: 15000 
          });
           // Update adminFullPeerId to the actual ID assigned if it differs, so admin knows its real ID
           // However, clients will still target the original name-based ID. This mismatch is problematic.
           // The toast informs the admin. A more robust solution would involve a discovery service.
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
      if (err.type === 'unavailable-id') {
        if (isAdmin && peerIdToUse === adminFullPeerId) {
          // The 'open' event will fire with a new random ID. The toast in 'open' for admins covers this.
        } else if (!isAdmin && peerIdToUse) {
          localStorage.removeItem(NON_ADMIN_PEER_ID_KEY); 
          toast({ title: 'P2P Kimlik Sorunu', description: 'Saklanan P2P kimliğiniz kullanılamadı, yeni bir kimlik oluşturulacak.', variant: 'destructive'});
          // PeerJS will attempt to get a new ID. If newPeer instance needs to be recreated:
          // setPeerInstance(null); // This would trigger re-init in the main useEffect
        }
      } else if (err.type === 'peer-unavailable' && adminFullPeerId && err.message.includes(adminFullPeerId) && !isAdmin) {
         console.warn(`Admin peer ${adminFullPeerId} is unavailable or does not exist. Client won't connect to admin.`);
         toast({ title: 'Yönetici Ulaşılamaz', description: `Yönetici (${adminFullPeerId.substring(0,12)}...) bulunamıyor. Duyurular alınamayabilir.`, variant: 'destructive', duration: 10000});
      }
    });

    newPeer.on('disconnected', () => {
        console.log('Peer disconnected from signaling server. PeerJS will attempt to reconnect.');
        toast({ title: 'Sinyal Sunucusu Koptu', description: 'Yeniden bağlanmaya çalışılıyor...', variant: 'destructive'});
    });

    setPeerInstance(newPeer);
  }, [Peer, peerInstance, user, isAdmin, adminFullPeerId, toast, connectToPeer, setPeerId, dataHandler]);

  const broadcastData = useCallback((data: any) => {
    if (!peerInstance || peerInstance.disconnected) {
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
  }, [peerInstance, toast]);

  const sendDataToPeer = useCallback((targetPeerId: string, data: any) => {
    const conn = connections.current.get(targetPeerId);
    if (conn && conn.open) {
      conn.send(data);
    } else {
       console.warn(`No open connection to ${targetPeerId} to send data. Attempting to connect.`);
       connectToPeer(targetPeerId); // Attempt to connect, then data needs to be resent or queued.
       toast({title: "Bağlantı Yok", description: `${targetPeerId.substring(0,12)}... ile bağlantı kuruluyor, veri daha sonra gönderilebilir.`, variant: "default"});
    }
  }, [connectToPeer]);

  const registerDataHandler = useCallback((handler: (data: any, peerId: string) => void) => {
    console.log("PeerContext: Registering new data handler.");
    dataHandler.current = handler;
  }, []);
  
  const requestInitialAnnouncements = useCallback(() => {
    // This function is mostly for explicit calls if needed, primary logic is in connectToPeer's 'open'
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
      currentCall.close(); // This should trigger the 'close' event on the call object for both peers
      toast({ title: 'Arama Reddedildi', description: 'Gelen arama reddedildi.' });
    }
    // Do not call endMediaCallInternals directly here if relying on 'close' event, to avoid double state update
    setCurrentCall(null); // Clear the current call being handled
    setIsReceivingCall(false); // No longer receiving this specific call
  }, [currentCall, isReceivingCall, toast]);

  const endMediaCall = useCallback(() => {
    if (currentCall) {
      currentCall.close(); // This will trigger 'close' event which calls endMediaCallInternals
    } else {
      // If there's no currentCall object but streams might exist (e.g. from a partially failed setup)
      endMediaCallInternals();
    }
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
        setPeerInstance(null); // Ensure peerInstance state is also cleared
        setPeerId(null);       // Clear peerId state
      }
    };
  }, [peerInstance, endMediaCallInternals]);

   useEffect(() => {
    if (Peer && user && !peerInstance) {
      // For admins, ensure adminFullPeerId is determined before initializing
      if (isAdmin && !adminFullPeerId) {
        // adminFullPeerId is set by another useEffect. If it's not set yet, wait.
        // This effect will re-run when adminFullPeerId changes.
        console.log("Peer init useEffect: Admin user, waiting for adminFullPeerId to be determined.");
        return; 
      }
      console.log(`Peer init useEffect: Conditions met. Peer: ${!!Peer}, User: ${!!user}, PeerInstance: ${!!peerInstance}, IsAdmin: ${isAdmin}, AdminFullPeerId: ${adminFullPeerId}`);
      initializePeer();
    }
    
    if (!user && peerInstance && !peerInstance.destroyed) {
        console.log("Peer init useEffect: User logged out, destroying peer instance:", peerInstance.id);
        // Cleanup logic is handled by the peerInstance-dependent useEffect above.
        // Setting peerInstance to null there will also ensure this condition doesn't re-trigger init.
    }
  }, [Peer, user, peerInstance, initializePeer, isAdmin, adminFullPeerId]); // Added isAdmin and adminFullPeerId


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
