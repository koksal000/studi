
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCOSV6WbtG54nkNrcBipUjg8WwspbgR_6U",
  authDomain: "amlca-village-connect.firebaseapp.com",
  projectId: "amlca-village-connect",
  storageBucket: "amlca-village-connect.firebasestorage.app",
  messagingSenderId: "449359458698",
  appId: "1:449359458698:web:1bfd5fcd7fdc2470a49873",
  measurementId: "G-N6EZCZXND2"
};

const VAPID_KEY = 'BFkJmkxX7pMDk3S8-YkG-UeJYDMy3IDW9-cVOHAuZrux8bXcftLrCKtyM4H0OImXCaqy6j9leUWQQg_8rIAWy0k';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export const initializeFirebaseApp = () => {
  if (typeof window !== 'undefined' && !app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
};

export const getFirebaseMessaging = () => {
  if (typeof window !== 'undefined') {
    if (!app) {
      initializeFirebaseApp();
    }
    if (app && !messaging) {
      messaging = getMessaging(app);
    }
  }
  return messaging;
};

export const requestNotificationPermissionAndToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[FCM-Config] Push notifications not supported in this environment.');
    return null;
  }

  const msg = getFirebaseMessaging();
  if (!msg) {
    console.warn('[FCM-Config] Firebase Messaging not initialized.');
    return null;
  }

  try {
    console.log('[FCM-Config] Current Notification.permission before request:', Notification.permission);
    
    const permissionResult = await Notification.requestPermission();
    console.log('[FCM-Config] Notification.permission after request:', permissionResult);

    if (permissionResult === 'granted') {
      console.log('[FCM-Config] Notification permission granted by user.');
      const currentToken = await getToken(msg, { vapidKey: VAPID_KEY });
      if (currentToken) {
        console.log('[FCM-Config] FCM Token retrieved:', currentToken.substring(0, 20) + "...");
        return currentToken;
      } else {
        console.warn('[FCM-Config] No registration token available even after permission granted. This is unusual.');
        return null;
      }
    } else {
      console.log('[FCM-Config] Notification permission was not granted. Status:', permissionResult);
      return null;
    }
  } catch (err) {
    console.error('[FCM-Config] An error occurred while retrieving token or permission: ', err);
    return null;
  }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  const msg = getFirebaseMessaging();
  if (msg) {
    return onMessage(msg, callback);
  }
  return () => {}; 
};
