// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCdSDG9oWNl02PqBt3t0fNtIwceNHyuFmU",
    authDomain: "eventsnap-fefcc.firebaseapp.com",
    projectId: "eventsnap-fefcc",
    storageBucket: "eventsnap-fefcc.firebasestorage.app",
    messagingSenderId: "382256300419",
    appId: "1:382256300419:web:104428bae4a45fab3ab6b6"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
