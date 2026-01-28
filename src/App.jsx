import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, getDoc, 
  onSnapshot, query, addDoc, serverTimestamp, initializeFirestore, orderBy, limit 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  Shield, User, Send, TrendingUp, Video, 
  Award, Zap, BookOpen, Volume2, 
  Lock, Share2, LogOut, Globe, MessageSquare, Heart
} from 'lucide-react';

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

const apiKey = import.meta.env.VITE_GEMINI_KEY;
const ACCESS_CODE = "JOSUE24"; 

const translations = {
  en: { welcome: "Operational HQ", enter: "Enter", nav_members: "Members", nav_mod: "Moderator", live_chat: "LIVE COMMS", type_msg: "Message...", submit: "Submit to HQ", ai_feedback: "AI Analysis" },
  fr: { welcome: "QG Opérationnel", enter: "Entrer", nav_members: "Membres", nav_mod: "Modérateur", live_chat: "COMMUNICATIONS LIVE", type_msg: "Message pour le QG...", submit: "Soumettre au QG", ai_feedback: "Analyse Gemini IA" },
  pt: { welcome: "QG Operacional", enter: "Entrar", nav_members: "Membros", nav_mod: "Moderador", live_chat: "COMUNICAÇÕES AO VIVO", type_msg: "Mensagem...", submit: "Enviar ao QG", ai_feedback: "Análise da IA Gemini" }
};

const App = () => {
  const [lang, setLang] = useState('fr'); 
  const t = useMemo(() => translations[lang], [lang]);
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [view, setView] = useState('home');
  const [status, setStatus] = useState('idle');
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
    const qReports = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    const unsubReports = onSnapshot(qReports, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const qChat = query(collection(db, 'chat'), orderBy('timestamp', 'asc'), limit(50));
    const unsubChat = onSnapshot(qChat, (snap) => {
      setChatMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => { unsubReports(); unsubChat(); };
  }, [isAuthorized]);

  const analyzeWithAI = async (formData) => {
    setStatus('loading');
    const prompt = `Spiritual Mentor. Analyze. Language: ${lang}. Return JSON: { "encouragement": "...", "prayer": "..." }. Verse: ${formData.verse} | Text: ${formData.text}`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      const result = JSON.parse(data.candidates[0].content.parts[0].text);
      setGeminiResult(result);
      await addDoc(collection(db, 'reports'), {
        name: formData.name, verse: formData.verse, text: formData.text,
        aiFeedback: result, timestamp: serverTimestamp(), uid: user.uid
      });
      setStatus('success');
    } catch (e) { console.error(e); setStatus('idle'); }
  };

  const sendLiveMessage = async (e) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    await addDoc(collection(db, 'chat'), {
      text: msgInput, uid: user.uid, timestamp: serverTimestamp()
    });
    setMsgInput("");
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-6">
          <Shield size={48} className="mx-auto text-blue-500" />
          <h1 className="text-2xl font-black text-white uppercase italic">ACCÈS QG JOSUÉ</h1>
          <input type="password" placeholder="CODE D'ACCÈS" className="w-full bg-black border border-white/10 rounded-xl p-4 text-center text-white"
            value={authCode} onChange={(e) => setAuthCode(e.target.value.toUpperCase())} />
          <button onClick={() => authCode === ACCESS_CODE ? setIsAuthorized(true) : alert("Code incorrect")} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold">ENTRER DANS L'UNITÉ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080a] text-slate-300 font-sans">
      <nav className="p-4 border-b border-white/5 flex justify-between items-center bg-black/80 sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-2 font-black text-white tracking-tighter" onClick={() => setView('home')}>
          <Shield className="text-blue-500" fill="currentColor" size={20} /> JOSUÉ HQ
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
            {['fr', 'en', 'pt'].map(l => (
              <button key={l} onClick={() => setLang(l)} className={`px-3 py-1 text-[10px] rounded-full font-bold uppercase transition-all ${lang === l ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>{l}</button>
            ))}
          </div>
          <button onClick={() => setView('member')} className={`text-xs font-bold uppercase ${view === 'member' ? 'text-blue-500' : ''}`}>{t.nav_members}</button>
          <button onClick={() => setView('mod')} className={`text-xs font-bold uppercase ${view === 'mod' ? 'text-blue-500' : ''}`}>{t.nav_mod}</button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {view === 'home' && (
          <div className="text-center py-24 space-y-8 animate-in fade-in duration-700">
            <h1 className="text-7xl font-black text-white leading-none italic uppercase tracking-tighter">{t.welcome}</h1>
            <p className="max-w-md mx-auto text-gray-500 text-lg">Préparez vos armes spirituelles. L'IA Gemini vous assiste dans le décodage des écritures.</p>
            <button onClick={() => setView('member')} className="px-12 py-5 bg-blue-600 text-white rounded-full font-black uppercase text-sm hover:scale-105 transition-transform shadow-2xl shadow-blue-500/20">Lancer la Méditation</button>
          </div>
        )}

        {(view === 'member' || view === 'mod') && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {view === 'member' && (
                <>
                  <section className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
                    <h2 className="text-2xl font-black text-white flex items-center gap-3 mb-6"><BookOpen className="text-blue-500"/> Méditation du Jour</h2>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      analyzeWithAI({ name: e.target.name.value, verse: e.target.verse.value, text: e.target.text.value });
                    }} className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <input name="name" placeholder="Votre Nom" required className="bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-colors" />
                        <input name="verse" placeholder="Verset (ex: Josué 1:8)" required className="bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-colors" />
                      </div>
                      <textarea name="text" placeholder="Quelle est votre révélation ?" required rows="4" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-colors" />
                      <button className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all">
                        {status === 'loading' ? 'Connexion IA...' : t.submit}
                      </button>
                    </form>
                  </section>
                  {geminiResult && (
                    <section className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl animate-in slide-in-from-bottom-4">
                      <h3 className="font-black uppercase text-sm flex items-center gap-2 mb-4"><Zap size={18} fill="white"/> {t.ai_feedback}</h3>
                      <p className="text-xl font-medium italic mb-6 leading-relaxed">"{geminiResult.encouragement}"</p>
                      <div className="bg-black/20 p-4 rounded-xl text-sm border border-white/10">
                        <strong className="block mb-1 text-blue-200 uppercase text-[10px] tracking-widest">Prière d'activation</strong>
                        {geminiResult.prayer}
                      </div>
                    </section>
                  )}
                </>
              )}

              {view === 'mod' && (
                <section className="space-y-6">
                  <div className="flex justify-between items-center bg-blue-600/10 p-6 rounded-3xl border border-blue-600/20 backdrop-blur-sm">
                    <div>
                      <h2 className="text-2xl font-black text-white italic">RAPPORTS DE GUERRE</h2>
                      <p className="text-xs text-blue-400 font-bold uppercase tracking-widest">Suivi des méditations en temps réel</p>
                    </div>
                    <button onClick={() => window.open('https://meet.jit.si/JosueHQ_Live', '_blank')} className="px-6 py-3 bg-white text-black rounded-full text-xs font-black flex items-center gap-2 hover:bg-blue-500 hover:text-white transition-all"><Video size={16}/> LIVE</button>
                  </div>
                  <div className="grid gap-4">
                    {reports.map(r => (
                      <div key={r.id} className="bg-white/5 p-6 rounded-3xl border border-white/5 flex justify-between items-center group hover:bg-white/[0.08] transition-all">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-600 text-[10px] font-black rounded text-white uppercase">{r.verse}</span>
                            <span className="text-[10px] text-gray-500 font-bold">{r.timestamp?.toDate().toLocaleTimeString()}</span>
                          </div>
                          <h4 className="text-white font-black text-lg">{r.name}</h4>
                          <p className="text-gray-400 text-sm italic line-clamp-2">"{r.text}"</p>
                        </div>
                        <button onClick={() => {
                          const text = `*⚔️ JOSUÉ 1:8 - RAPPORT*\n*Guerrier:* ${r.name}\n*Verset:* ${r.verse}\n\n"${r.text}"\n\n*🕊️ IA:* ${r.aiFeedback?.encouragement}`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                        }} className="p-4 bg-green-600/10 text-green-500 rounded-2xl hover:bg-green-600 hover:text-white transition-all"><Share2 size={20}/></button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* CHAT LIVE - Visible par tout le monde sur le côté */}
            <aside className="bg-black/40 border border-white/10 rounded-[2.5rem] flex flex-col h-[600px] overflow-hidden shadow-2xl backdrop-blur-xl">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <h3 className="font-black text-white text-sm flex items-center gap-2 uppercase tracking-widest"><MessageSquare size={16} className="text-blue-500"/> {t.live_chat}</h3>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold text-green-500 uppercase">Online</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.uid === user?.uid ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${m.uid === user?.uid ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/10 text-slate-300 rounded-tl-none'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
              <form onSubmit={sendLiveMessage} className="p-4 bg-white/5 border-t border-white/10 flex gap-2">
                <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} placeholder={t.type_msg} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500" />
                <button type="submit" className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"><Send size={18}/></button>
              </form>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;