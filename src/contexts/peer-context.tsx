
"use client";

import type PeerType from 'peerjs'; // Import Peer type for type checking
import type { DataConnection } from 'peerjs';
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


  useEffect(() => {
    // Dynamically import PeerJS only on the client side
    import('peerjs').then(module => {
      setPeer(() => module.default);
    }).catch(err => console.error("Failed to load PeerJS", err));
  }, []);

  useEffect(() => {
    if (user && isAdmin) {
        // Generate a unique part for the admin ID, e.g., based on user's name if available
        // This is a simple example; you might want a more robust way to make it unique yet discoverable
        const uniqueAdminSuffix = user.name.toLowerCase().replace(/\s+/g, '-') || 'default';
        const fullId = `${ADMIN_PEER_ID_PREFIX}${uniqueAdminSuffix}`;
        setAdminFullPeerId(fullId);
    } else {
        // For non-admins or if admin ID cannot be determined yet, try to find an admin
        // This part is tricky without a discovery mechanism. For now, we assume admin ID might be known
        // or a general broadcast/discovery would be needed.
        // Placeholder: In a real app, you might fetch a list of active admin IDs.
        // For this example, we'll assume clients might try to connect to a "known" admin later.
        // Let's set a default admin ID that clients might try to connect to.
        // This is a simplification.
        setAdminFullPeerId(`${ADMIN_PEER_ID_PREFIX}default`); 
    }
  }, [user, isAdmin]);


  const initializePeer = useCallback(() => {
    if (!Peer || peerInstance || !user) return; // PeerJS not loaded, already initialized, or no user

    let currentPeerId = '';
    if (isAdmin && adminFullPeerId) {
      currentPeerId = adminFullPeerId;
    }
    // For non-admins, PeerJS will assign a random ID if the first arg is undefined or null.

    const newPeer = currentPeerId ? new Peer(currentPeerId) : new Peer();
    
    newPeer.on('open', (id) => {
      setPeerId(id);
      console.log('My peer ID is: ' + id);
      toast({ title: 'P2P Ağı Aktif', description: `Kimliğiniz: ${id.substring(0,12)}...` });
      if (!isAdmin) {
        // Non-admin clients try to connect to the admin
        // Note: adminFullPeerId here might be the "default" one if a specific one isn't known.
        // This needs a robust discovery mechanism in a real app.
        if(adminFullPeerId) connectToPeer(adminFullPeerId);
      }
    });

    newPeer.on('connection', (conn) => {
      console.log(`Incoming connection from ${conn.peer}`);
      toast({ title: 'Yeni Bağlantı', description: `${conn.peer.substring(0,12)}... bağlandı.` });
      
      connections.current.set(conn.peer, conn);

      conn.on('data', (data) => {
        console.log('Received data:', data, 'from', conn.peer);
        if (dataHandler.current) {
          dataHandler.current(data, conn.peer);
        }
      });

      conn.on('close', () => {
        console.log(`Connection from ${conn.peer} closed.`);
        toast({ title: 'Bağlantı Kapandı', description: `${conn.peer.substring(0,12)}... ayrıldı.`, variant: 'destructive' });
        connections.current.delete(conn.peer);
      });
       conn.on('error', (err) => {
        console.error(`Connection error with ${conn.peer}:`, err);
        toast({ title: 'Bağlantı Hatası', description: `${conn.peer.substring(0,12)}... ile hata: ${err.message}`, variant: 'destructive' });
        connections.current.delete(conn.peer);
      });
    });

    newPeer.on('error', (err) => {
      console.error('PeerJS error:', err);
      toast({ title: 'P2P Ağ Hatası', description: err.message, variant: 'destructive' });
      if (err.type === 'unavailable-id' && isAdmin && adminFullPeerId) {
        toast({ title: 'Yönetici Kimliği Alınamadı', description: `"${adminFullPeerId}" kimliği zaten kullanımda. Farklı bir yönetici oturumu aktif olabilir.`, variant: 'destructive' });
        // Potentially try to re-initialize with a different ID or notify user.
      }
      setPeerInstance(null); // Reset to allow re-initialization attempt
    });

    newPeer.on('disconnected', () => {
        console.log('Peer disconnected from signaling server. Attempting to reconnect...');
        toast({ title: 'Sinyal Sunucusu Bağlantısı Kesildi', description: 'Yeniden bağlanmaya çalışılıyor...', variant: 'destructive'});
        // PeerJS will attempt to reconnect automatically.
        // If you want to handle it manually: setTimeout(() => newPeer.reconnect(), 3000);
    });

    setPeerInstance(newPeer);

  }, [Peer, peerInstance, user, isAdmin, adminFullPeerId, toast]); // Added toast to deps

  const connectToPeer = useCallback((targetPeerId: string): DataConnection | undefined => {
    if (!peerInstance || !targetPeerId || peerInstance.disconnected) {
      console.error('Peer instance not available or disconnected, or no target ID.');
      if(!peerInstance?.disconnected) toast({ title: 'Bağlantı Hatası', description: 'P2P altyapısı hazır değil.', variant: 'destructive' });
      return undefined;
    }
    if (connections.current.has(targetPeerId)) {
        console.log(`Already connected to ${targetPeerId}`);
        return connections.current.get(targetPeerId);
    }
    if (targetPeerId === peerId) {
        console.log("Cannot connect to self.");
        return undefined;
    }

    console.log(`Attempting to connect to ${targetPeerId}`);
    const conn = peerInstance.connect(targetPeerId, { reliable: true });

    conn.on('open', () => {
      console.log(`Connection established with ${targetPeerId}`);
      toast({ title: 'Bağlantı Başarılı', description: `${targetPeerId.substring(0,12)}... ile bağlantı kuruldu.` });
      connections.current.set(targetPeerId, conn);
      // If this is a non-admin connecting to an admin, request initial announcements
      if (!isAdmin && targetPeerId.startsWith(ADMIN_PEER_ID_PREFIX)) {
         setTimeout(() => { // Give a slight delay for connection to fully establish
            console.log("Requesting initial announcements from admin:", targetPeerId);
            conn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
         }, 1000);
      }
    });

    conn.on('data', (data) => {
      console.log('Received data:', data, 'from', conn.peer);
      if (dataHandler.current) {
        dataHandler.current(data, conn.peer);
      }
    });

    conn.on('close', () => {
      console.log(`Connection from ${conn.peer} closed.`);
      toast({ title: 'Bağlantı Kapandı', description: `${conn.peer.substring(0,12)}... ayrıldı.`, variant: 'destructive' });
      connections.current.delete(conn.peer);
    });
    conn.on('error', (err) => {
      console.error(`Connection error with ${conn.peer}:`, err);
      toast({ title: 'Bağlantı Hatası', description: `${conn.peer.substring(0,12)}... ile hata: ${err.message}`, variant: 'destructive' });
      connections.current.delete(conn.peer);
    });
    return conn;
  }, [peerInstance, isAdmin, peerId, toast]);

  const broadcastData = useCallback((data: any) => {
    if (!peerInstance) return;
    console.log("Broadcasting data to all connected peers:", data, connections.current.size);
    connections.current.forEach((conn) => {
      if (conn && conn.open) {
        conn.send(data);
      }
    });
  }, [peerInstance]);

  const sendDataToPeer = useCallback((targetPeerId: string, data: any) => {
    const conn = connections.current.get(targetPeerId);
    if (conn && conn.open) {
      conn.send(data);
    } else {
      console.warn(`No open connection to peer ${targetPeerId} to send data.`);
      // Optionally, try to connect if not already connected
      // connectToPeer(targetPeerId)?.send(data); // This might be too aggressive
    }
  }, []);

  const registerDataHandler = useCallback((handler: (data: any, peerId: string) => void) => {
    dataHandler.current = handler;
  }, []);
  
  const requestInitialAnnouncements = useCallback(() => {
    if (isAdmin || !adminFullPeerId || !peerInstance || peerInstance.disconnected) return;
    
    const adminConn = connections.current.get(adminFullPeerId);
    if (adminConn && adminConn.open) {
        console.log("Requesting initial announcements from admin:", adminFullPeerId);
        adminConn.send({ type: 'REQUEST_INITIAL_ANNOUNCEMENTS' });
    } else {
        console.log("Admin connection not found or not open, attempting to connect to request announcements.");
        const newConn = connectToPeer(adminFullPeerId);
        // The request is now part of connectToPeer if target is admin
    }
  }, [isAdmin, adminFullPeerId, peerInstance, connectToPeer]);


  useEffect(() => {
    // Cleanup peer instance on component unmount
    return () => {
      if (peerInstance) {
        peerInstance.destroy();
        console.log("Peer instance destroyed");
      }
      connections.current.clear();
    };
  }, [peerInstance]);

  // Initialize PeerJS connection when user context is available
   useEffect(() => {
    if (Peer && user && !peerInstance) { // Only initialize if PeerJS is loaded, user exists, and not already initialized
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
        requestInitialAnnouncements
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
