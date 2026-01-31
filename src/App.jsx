import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, query, addDoc, 
  serverTimestamp, initializeFirestore, orderBy, limit 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { Shield, Send, Video, Zap, BookOpen, Share2, MessageSquare, Youtube, Globe } from 'lucide-react';

// --- CONFIGURATION FIREBASE ---
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
const apiKey = import.meta.env.VITE_GEMINI_KEY; 

const translations = {
  fr: { welcome: "QG Opérationnel", nav_members: "Membres", nav_mod: "Modérateur", submit: "Soumettre au QG", ai_feedback: "Analyse Gemini IA", placeholder: "Votre révélation..." },
  en: { welcome: "Operational HQ", nav_members: "Members", nav_mod: "Moderator", submit: "Submit to HQ", ai_feedback: "Gemini AI Analysis", placeholder: "Your revelation..." },
  pt: { welcome: "QG Operacional", nav_members: "Membros", nav_mod: "Moderador", submit: "Enviar ao QG", ai_feedback: "Análise IA Gemini", placeholder: "Sua revelação..." }
};

const App = () => {
  const [lang, setLang] = useState('fr');
  const t = translations[lang];
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [view, setView] = useState('home');
  const [status, setStatus] = useState('idle');
  const [debugError, setDebugError] = useState("");
  const [reports, setReports] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [geminiResult, setGeminiResult] = useState(null);
  const [msgInput, setMsgInput] = useState("");
  const scrollRef = useRef(null);

  // AUTHENTIFICATION
  useEffect(() => {
    signInAnonymously(auth).catch(e => console.error("Auth Error", e));
    onAuthStateChanged(auth, setUser);
  }, []);

  // ECOUTE DES DONNEES FIREBASE
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

  // FONCTION D'ANALYSE IA
  const analyzeWithAI = async (e) => {
    e.preventDefault();
    const formData = { name: e.target.name.value, verse: e.target.verse.value, text: e.target.text.value };
    setStatus('loading');
    setDebugError("");
    setGeminiResult(null);

    // URL CORRECTE (Placée à l'intérieur de la fonction)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ 
            parts: [{ text: `Mentor spirituel. Analyse en ${lang}. Réponse JSON: { "encouragement": "...", "prayer": "..." }. Texte: ${formData.text}` }] 
          }] 
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Erreur API");

      const rawText = data.candidates[0].content.parts[0].text;
      const jsonStart = rawText.indexOf('{');
      const jsonEnd = rawText.lastIndexOf('}') + 1;
      const cleanJson = JSON.parse(rawText.substring(jsonStart, jsonEnd));
      
      setGeminiResult(cleanJson);
      await addDoc(collection(db, 'reports'), { ...formData, aiFeedback: cleanJson, timestamp: serverTimestamp(), uid: user.uid });
      setStatus('success');
    } catch (err) {
      setDebugError(err.message);
      setStatus('idle');
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-[2rem] p-10 space-y-8 shadow-2xl">
          <Shield size={64} className="mx-auto text-blue-600 animate-pulse" />
          <h1 className="text-2xl font-black text-white italic uppercase tracking-widest">QG JOSUÉ 1:8</h1>
          <input type="password" placeholder="CODE D'ACCÈS" className="w-full bg-black border border-white/20 rounded-2xl p-5 text-center text-white text-2xl font-bold focus:border-blue-600 outline-none transition-all" 
            onKeyUp={(e) => e.target.value.toUpperCase() === "JOSUE24" && setIsAuthorized(true)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans selection:bg-blue-500/30">
      <nav className="p-4 border-b border-white/10 flex justify-between items-center bg-black/95 sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-2 font-black text-white text-xl italic cursor-pointer" onClick={() => setView('home')}>
          <Shield className="text-blue-600" fill="currentColor" size={24} /> JOSUÉ HQ
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
            {['fr', 'en', 'pt'].map(l => (
              <button key={l} onClick={() => setLang(l)} className={`px-3 py-1 text-[10px] rounded-full font-black uppercase transition-all ${lang === l ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>{l}</button>
            ))}
          </div>
          <button onClick={() => setView('member')} className={`text-[10px] font-black uppercase transition-all ${view === 'member' ? 'text-blue-500' : 'hover:text-white'}`}>{t.nav_members}</button>
          <button onClick={() => setView('mod')} className={`text-[10px] font-black uppercase transition-all ${view === 'mod' ? 'text-blue-500' : 'hover:text-white'}`}>{t.nav_mod}</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {view === 'home' && (
              <div className="py-24 text-center space-y-10 animate-in zoom-in duration-700">
                <h1 className="text-6xl md:text-8xl font-black text-white italic uppercase leading-none tracking-tighter">{t.welcome}</h1>
                <button onClick={() => setView('member')} className="px-20 py-6 bg-blue-600 text-white rounded-full font-black uppercase shadow-2xl shadow-blue-600/40 hover:scale-105 transition-transform active:scale-95">Commencer</button>
              </div>
            )}

            {view === 'member' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl backdrop-blur-sm">
                  <h2 className="text-2xl font-black text-white flex items-center gap-3 mb-8 italic uppercase"><BookOpen className="text-blue-600"/> Méditation</h2>
                  <form onSubmit={analyzeWithAI} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <input name="name" placeholder="Votre Nom" required className="bg-black border border-white/10 rounded-2xl p-5 text-white focus:border-blue-600 outline-none transition-all" />
                      <input name="verse" placeholder="Verset Biblique" required className="bg-black border border-white/10 rounded-2xl p-5 text-white focus:border-blue-600 outline-none transition-all" />
                    </div>
                    <textarea name="text" placeholder={t.placeholder} required rows="4" className="w-full bg-black border border-white/10 rounded-2xl p-5 text-white focus:border-blue-600 outline-none transition-all" />
                    <button className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50" disabled={status === 'loading'}>
                      {status === 'loading' ? <Zap className="animate-spin" size={20}/> : null}
                      {status === 'loading' ? 'COMMUNICATION IA...' : t.submit}
                    </button>
                  </form>
                  {debugError && <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400 text-[10px] font-mono uppercase tracking-tight">ERREUR SYSTÈME: {debugError}</div>}
                </section>

                {geminiResult && (
                  <section className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-[2.5rem] text-white shadow-3xl animate-in slide-in-from-bottom-6 duration-700 relative overflow-hidden">
                    <Zap className="absolute top-[-20px] right-[-20px] text-white/10 w-40 h-40" />
                    <h3 className="font-black uppercase text-[10px] flex items-center gap-2 mb-4 tracking-widest relative z-10"><Zap size={20} fill="white"/> {t.ai_feedback}</h3>
                    <p className="text-2xl font-bold italic mb-6 relative z-10">"{geminiResult.encouragement}"</p>
                    <div className="bg-black/20 p-6 rounded-2xl border border-white/10 text-lg leading-relaxed relative z-10 italic">{geminiResult.prayer}</div>
                  </section>
                )}
              </div>
            )}

            {view === 'mod' && (
              <section className="space-y-4 animate-in fade-in duration-500">
                <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 flex justify-between items-center shadow-xl">
                  <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Commandement de l'Unité</h2>
                  <button onClick={() => window.open('https://meet.jit.si/JosueHQ_Live', '_blank')} className="px-6 py-3 bg-red-600 text-white rounded-full font-black text-xs animate-pulse hover:bg-red-700 transition-colors">LANCER LIVE STUDIO</button>
                </div>
                {reports.map(r => (
                  <div key={r.id} className="bg-white/5 p-6 rounded-[2rem] border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all">
                    <div className="space-y-1">
                      <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">{r.verse} | {r.name}</span>
                      <p className="text-white text-lg font-medium italic opacity-90">"{r.text}"</p>
                    </div>
                    <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`*⚔️ JOSUÉ 1:8*\n*Guerrier:* ${r.name}\n\n"${r.text}"`)}`, '_blank')} className="p-4 bg-green-500/10 text-green-500 rounded-2xl hover:bg-green-600 hover:text-white transition-all shadow-lg"><Share2 size={24}/></button>
                  </div>
                ))}
              </section>
            )}

            <section className="bg-black rounded-[2.5rem] border border-white/10 overflow-hidden aspect-video shadow-2xl relative group">
              <div className="absolute top-4 left-4 z-10 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse uppercase tracking-tighter shadow-lg group-hover:scale-110 transition-transform">Direct QG</div>
              <iframe width="100%" height="100%" src="https://www.youtube.com/embed/live_stream?channel=UCAUrnN36d0sfMypjsnkFlTA" frameBorder="0" allowFullScreen title="Live Stream"></iframe>
            </section>
          </div>

          <aside className="lg:col-span-4 flex flex-col h-[800px] bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-3xl backdrop-blur-sm">
            <div className="p-6 border-b border-white/10 bg-black/40 font-black text-white text-[10px] uppercase tracking-widest flex items-center gap-3"><MessageSquare className="text-blue-500" size={18}/> LIVE COMMUNICATIONS</div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.uid === user?.uid ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
                  <span className="text-[9px] font-black text-gray-500 uppercase mb-1 px-2 tracking-tighter">{m.senderName}</span>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] font-medium leading-relaxed ${m.uid === user?.uid ? 'bg-blue-600 text-white shadow-blue-600/20 shadow-lg' : 'bg-white/10 text-slate-200 border border-white/5'}`}>{m.text}</div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault(); if (!msgInput.trim()) return;
              const name = localStorage.getItem('josue_name') || "Guerrier";
              await addDoc(collection(db, 'chat'), { text: msgInput, senderName: name, uid: user.uid, timestamp: serverTimestamp() });
              setMsgInput("");
            }} className="p-4 bg-black border-t border-white/10 flex gap-2">
              <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} placeholder="Écrire au front..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-xs text-white outline-none focus:border-blue-600 shadow-inner transition-all" />
              <button type="submit" className="p-4 bg-white text-black rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-md active:scale-90"><Send size={20}/></button>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default App;