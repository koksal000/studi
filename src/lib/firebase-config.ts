
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
    console.warn('Push notifications not supported in this environment.');
    return null;
  }

  const msg = getFirebaseMessaging();
  if (!msg) {
    console.warn('Firebase Messaging not initialized.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      const currentToken = await getToken(msg, { vapidKey: VAPID_KEY });
      if (currentToken) {
        console.log('FCM Token:', currentToken);
        // Send this token to your server to store it
        try {
            await fetch('/api/fcm/register-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: currentToken }),
            });
            console.log("FCM token sent to server for registration.");
        } catch (apiError) {
            console.error("Failed to send FCM token to server:", apiError);
        }
        return currentToken;
      } else {
        console.warn('No registration token available. Request permission to generate one.');
        return null;
      }
    } else {
      console.log('Unable to get permission to notify.');
      return null;
    }
  } catch (err) {
    console.error('An error occurred while retrieving token or permission. ', err);
    return null;
  }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  const msg = getFirebaseMessaging();
  if (msg) {
    return onMessage(msg, callback);
  }
  return () => {}; // Return an empty unsubscribe function if messaging is not available
};
