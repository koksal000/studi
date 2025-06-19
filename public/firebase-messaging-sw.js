
// Import the Firebase app and messaging services that you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-sw.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCOSV6WbtG54nkNrcBipUjg8WwspbgR_6U",
  authDomain: "amlca-village-connect.firebaseapp.com",
  projectId: "amlca-village-connect",
  storageBucket: "amlca-village-connect.firebasestorage.app",
  messagingSenderId: "449359458698",
  appId: "1:449359458698:web:1bfd5fcd7fdc2470a49873",
  measurementId: "G-N6EZCZXND2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

onBackgroundMessage(messaging, (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);

  const notificationTitle = payload.notification?.title || "Yeni Bildirim";
  const notificationOptions = {
    body: payload.notification?.body || "Yeni bir mesajınız var.",
    icon: '/images/logo.png' // Ensure you have this icon at public/images/logo.png
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
