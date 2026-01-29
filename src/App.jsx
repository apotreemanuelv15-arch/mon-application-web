import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, query, addDoc, 
  serverTimestamp, initializeFirestore, orderBy, limit 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { Shield, Send, Video, Zap, BookOpen, Share2, MessageSquare, Youtube } from 'lucide-react';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

// --- C'EST ICI QUE TOUT SE JOUE ---
const apiKey = import.meta.env.VITE_GEMINI_KEY; 

const App = () => {
  const [lang, setLang] = useState('fr');
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [view, setView] = useState('home');
  const [status, setStatus] = useState('idle');
  const [debugError, setDebugError] = useState(""); // Pour afficher l'erreur exacte
  const [reports, setReports] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [geminiResult, setGeminiResult] = useState(null);
  const [msgInput, setMsgInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    signInAnonymously(auth).catch(e => console.error("Auth Error", e));
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    const unsubReports = onSnapshot(query(collection(db, 'reports'), orderBy('timestamp', 'desc')), (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubChat = onSnapshot(query(collection(db, 'chat'), orderBy('timestamp', 'asc'), limit(50)), (snap) => {
      setChatMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => { unsubReports(); unsubChat(); };
  }, [isAuthorized]);

  const analyzeWithAI = async (e) => {
    e.preventDefault();
    const formData = { name: e.target.name.value, verse: e.target.verse.value, text: e.target.text.value };
    setStatus('loading');
    setDebugError("");

    // Utilisation de la version v1 (plus stable que v1beta)
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Agis en mentor spirituel. Analyse en ${lang}. Réponse JSON: { "encouragement": "...", "prayer": "..." }. Texte: ${formData.text}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await res.json();

      if (!res.ok) {
        // Détection précise de l'erreur Google
        const errorMsg = data.error?.message || "Erreur Inconnue";
        const errorCode = data.error?.status || res.status;
        throw new Error(`[CODE ${errorCode}] : ${errorMsg}`);
      }

      const rawText = data.candidates[0].content.parts[0].text;
      const cleanJson = JSON.parse(rawText.substring(rawText.indexOf('{'), rawText.lastIndexOf('}') + 1));
      
      setGeminiResult(cleanJson);
      await addDoc(collection(db, 'reports'), { ...formData, aiFeedback: cleanJson, timestamp: serverTimestamp(), uid: user.uid });
      setStatus('success');
    } catch (err) {
      console.error("Diagnostic IA:", err.message);
      setDebugError(err.message); // On affiche la vraie raison sur l'écran
      setStatus('idle');
    }
  };

  const sendLiveMessage = async (e) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    const name = localStorage.getItem('josue_name') || "Guerrier";
    await addDoc(collection(db, 'chat'), { text: msgInput, senderName: name, uid: user.uid, timestamp: serverTimestamp() });
    setMsgInput("");
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-[2rem] p-10 text-center space-y-8">
          <Shield size={64} className="mx-auto text-blue-600 animate-pulse" />
          <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">ACCÈS QG</h1>
          <input type="password" placeholder="CODE D'ACCÈS" className="w-full bg-black border border-white/20 rounded-2xl p-5 text-center text-white text-2xl font-bold" 
            onKeyUp={(e) => e.target.value.toUpperCase() === "JOSUE24" && setIsAuthorized(true)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans">
      <nav className="p-4 border-b border-white/10 flex justify-between items-center bg-black/95 sticky top-0 z-50">
        <div className="flex items-center gap-2 font-black text-white text-xl italic cursor-pointer" onClick={() => setView('home')}>
          <Shield className="text-blue-600" fill="currentColor" size={24} /> JOSUÉ HQ
        </div>
        <div className="flex gap-4">
          <button onClick={() => setView('member')} className={`text-[10px] font-black uppercase ${view === 'member' ? 'text-blue-500' : ''}`}>Membres</button>
          <button onClick={() => setView('mod')} className={`text-[10px] font-black uppercase ${view === 'mod' ? 'text-blue-500' : ''}`}>Modérateur</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-8">
            {view === 'member' && (
              <div className="space-y-6">
                <section className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
                  <h2 className="text-2xl font-black text-white flex items-center gap-3 mb-8 italic uppercase"><BookOpen className="text-blue-600"/> Méditation</h2>
                  <form onSubmit={analyzeWithAI} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <input name="name" placeholder="Votre Nom" required className="bg-black border border-white/10 rounded-2xl p-5 text-white focus:border-blue-600 outline-none" />
                      <input name="verse" placeholder="Verset" required className="bg-black border border-white/10 rounded-2xl p-5 text-white focus:border-blue-600 outline-none" />
                    </div>
                    <textarea name="text" placeholder="Votre révélation..." required rows="4" className="w-full bg-black border border-white/10 rounded-2xl p-5 text-white focus:border-blue-600 outline-none" />
                    <button className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 transition-all">
                      {status === 'loading' ? 'ANALYSE EN COURS...' : 'SOUMETTRE'}
                    </button>
                  </form>
                  
                  {/* AFFICHAGE DE L'ERREUR DE DIAGNOSTIC */}
                  {debugError && (
                    <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 text-xs font-mono">
                      <strong>DÉFAUT SYSTÈME :</strong> {debugError}
                      <p className="mt-2 text-[10px] opacity-70">Vérifiez Vercel > Settings > Env Variables > VITE_GEMINI_KEY</p>
                    </div>
                  )}
                </section>

                {geminiResult && (
                  <section className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-[2.5rem] text-white shadow-3xl animate-in slide-in-from-bottom-4">
                    <h3 className="font-black uppercase text-[10px] flex items-center gap-2 mb-4 tracking-widest"><Zap size={20} fill="white"/> RÉPONSE DU QG</h3>
                    <p className="text-2xl font-bold italic mb-6">"{geminiResult.encouragement}"</p>
                    <div className="bg-black/20 p-5 rounded-2xl border border-white/10">{geminiResult.prayer}</div>
                  </section>
                )}
              </div>
            )}

            {view === 'mod' && (
              <section className="space-y-4">
                <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 flex justify-between items-center">
                  <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Rapports Militaires</h2>
                  <button onClick={() => window.open('https://meet.jit.si/JosueHQ_Live', '_blank')} className="px-6 py-3 bg-red-600 text-white rounded-full font-black text-xs animate-pulse">LANCER LIVE</button>
                </div>
                {reports.map(r => (
                  <div key={r.id} className="bg-white/5 p-6 rounded-[2rem] border border-white/5 flex justify-between items-center group">
                    <div className="space-y-1">
                      <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">{r.verse} | {r.name}</span>
                      <p className="text-white text-lg font-medium italic">"{r.text}"</p>
                    </div>
                    <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`*⚔️ JOSUÉ 1:8*\n*Guerrier:* ${r.name}\n\n"${r.text}"`)}`, '_blank')} className="p-4 bg-green-500/10 text-green-500 rounded-2xl hover:bg-green-600"><Share2 size={24}/></button>
                  </div>
                ))}
              </section>
            )}

            {/* YOUTUBE LIVE */}
            <section className="bg-black rounded-[2.5rem] border border-white/10 overflow-hidden aspect-video shadow-2xl relative">
              <iframe width="100%" height="100%" src="https://www.youtube.com/embed/live_stream?channel=UCAUrnN36d0sfMypjsnkFlTA" frameBorder="0" allowFullScreen></iframe>
            </section>
          </div>

          {/* CHAT LIVE */}
          <aside className="lg:col-span-4 flex flex-col h-[750px] bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-3xl">
            <div className="p-6 border-b border-white/10 bg-black/40 font-black text-white text-[10px] uppercase tracking-widest flex items-center gap-3"><MessageSquare className="text-blue-500" size={18}/> LIVE COMMS</div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.uid === user?.uid ? 'items-end' : 'items-start'}`}>
                  <span className="text-[9px] font-black text-gray-600 uppercase mb-1 px-2">{m.senderName}</span>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] font-medium ${m.uid === user?.uid ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-200'}`}>{m.text}</div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form onSubmit={sendLiveMessage} className="p-4 bg-black border-t border-white/10 flex gap-2">
              <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} placeholder="Message..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-xs text-white outline-none focus:border-blue-600" />
              <button type="submit" className="p-4 bg-white text-black rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Send size={20}/></button>
            </form>
          </aside>

        </div>
      </main>
    </div>
  );
};

export default App;