// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration (cute schedule)
const firebaseConfig = {
  apiKey: "AIzaSyC0MyP-nVK2qq-lF0lxmawDtKpN4p8WmtY",
  authDomain: "proyou-959b0.firebaseapp.com",
  projectId: "proyou-959b0",
  storageBucket: "proyou-959b0.firebasestorage.app",
  messagingSenderId: "490326434867",
  appId: "1:490326434867:web:12d221011356ca715eef46",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
