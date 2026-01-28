import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, query, addDoc, 
  serverTimestamp, initializeFirestore, orderBy, limit 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  Shield, Send, Video, Zap, BookOpen, 
  Share2, MessageSquare, Youtube, Award, Globe
} from 'lucide-react';

// --- INITIALISATION ---
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
  fr: { welcome: "QG Opérationnel", enter: "Entrer", nav_members: "Membres", nav_mod: "Modérateur", live_chat: "COMMUNICATIONS LIVE", type_msg: "Message...", submit: "Soumettre au QG", ai_feedback: "Analyse Gemini IA", rank: "Grade", placeholder_text: "Quelle est votre révélation ?" },
  en: { welcome: "Operational HQ", enter: "Enter", nav_members: "Members", nav_mod: "Moderator", live_chat: "LIVE COMMS", type_msg: "Message...", submit: "Submit to HQ", ai_feedback: "Gemini AI Analysis", rank: "Rank", placeholder_text: "What is your revelation?" },
  pt: { welcome: "QG Operacional", enter: "Entrar", nav_members: "Membros", nav_mod: "Moderador", live_chat: "COMUNICAÇÕES AO VIVO", type_msg: "Mensagem...", submit: "Enviar ao QG", ai_feedback: "Análise IA Gemini", rank: "Patente", placeholder_text: "Qual é a sua revelação ?" }
};

const App = () => {
  const [lang, setLang] = useState('fr'); 
  const t = translations[lang]; // Accès direct pour éviter les erreurs de rendu
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [view, setView] = useState('home');
  const [status, setStatus] = useState('idle');
  const [reports, setReports] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [geminiResult, setGeminiResult] = useState(null);
  const [msgInput, setMsgInput] = useState("");
  const [userName, setUserName] = useState(localStorage.getItem('josue_name') || "");
  const [xp, setXp] = useState(parseInt(localStorage.getItem('josue_xp')) || 0);
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
    const formData = {
      name: e.target.name.value,
      verse: e.target.verse.value,
      text: e.target.text.value
    };
    
    setStatus('loading');
    setUserName(formData.name);
    localStorage.setItem('josue_name', formData.name);

    const prompt = `Mentor Spirituel. Analyse cette méditation en ${lang}. Réponds uniquement en JSON: { "encouragement": "Texte court de motivation", "prayer": "Courte prière" }. Texte du membre: ${formData.text}`;
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      
      const data = await response.json();
      const rawText = data.candidates[0].content.parts[0].text;
      const cleanJson = JSON.parse(rawText.substring(rawText.indexOf('{'), rawText.lastIndexOf('}') + 1));
      
      setGeminiResult(cleanJson);
      const newXp = xp + 20;
      setXp(newXp);
      localStorage.setItem('josue_xp', newXp.toString());

      await addDoc(collection(db, 'reports'), {
        ...formData,
        aiFeedback: cleanJson,
        timestamp: serverTimestamp(),
        uid: user.uid
      });
      setStatus('success');
    } catch (err) {
      console.error("Erreur IA:", err);
      setStatus('idle');
      alert("Erreur de connexion IA. Vérifiez votre clé Gemini.");
    }
  };

  const sendLiveMessage = async (e) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    await addDoc(collection(db, 'chat'), {
      text: msgInput, senderName: userName || "Guerrier", uid: user.uid, timestamp: serverTimestamp()
    });
    setMsgInput("");
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-[2rem] p-10 text-center space-y-8">
          <Shield size={64} className="mx-auto text-blue-600 animate-pulse" />
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">UNITÉ JOSUÉ 1:8</h1>
          <input type="password" placeholder="CODE D'ACCÈS" className="w-full bg-black border border-white/20 rounded-2xl p-5 text-center text-white text-2xl font-bold" 
            onKeyUp={(e) => e.target.value.toUpperCase() === "JOSUE24" && setIsAuthorized(true)} />
          <p className="text-gray-600 text-[10px] uppercase font-bold tracking-widest">Sécurité de Niveau 4 Activée</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans">
      {/* HEADER FIXE */}
      <nav className="p-4 border-b border-white/10 flex justify-between items-center bg-black/95 sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-2 font-black text-white text-xl italic cursor-pointer" onClick={() => setView('home')}>
          <Shield className="text-blue-600" fill="currentColor" size={24} /> JOSUÉ HQ
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex bg-white/5 rounded-full p-1 border border-white/10 scale-90">
            {['fr', 'en', 'pt'].map(l => (
              <button key={l} onClick={() => setLang(l)} className={`px-4 py-1.5 text-[10px] rounded-full font-black uppercase ${lang === l ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}>{l}</button>
            ))}
          </div>
          <button onClick={() => setView('member')} className={`text-[10px] font-black uppercase tracking-widest ${view === 'member' ? 'text-blue-500' : ''}`}>{t.nav_members}</button>
          <button onClick={() => setView('mod')} className={`text-[10px] font-black uppercase tracking-widest ${view === 'mod' ? 'text-blue-500' : ''}`}>{t.nav_mod}</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-8">
            {view === 'home' && (
              <div className="py-20 text-center space-y-8 animate-in fade-in duration-500">
                <h1 className="text-6xl md:text-8xl font-black text-white italic uppercase leading-none tracking-tighter">{t.welcome}</h1>
                <p className="text-gray-500 text-xl max-w-lg mx-auto">{t.placeholder_text}</p>
                <button onClick={() => setView('member')} className="px-16 py-6 bg-blue-600 text-white rounded-full font-black uppercase text-sm hover:scale-105 transition-all shadow-xl shadow-blue-500/20">{t.enter}</button>
              </div>
            )}

            {view === 'member' && (
              <div className="space-y-8">
                <section className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-white flex items-center gap-3 italic uppercase tracking-tight"><BookOpen className="text-blue-600"/> {t.nav_members}</h2>
                    <div className="bg-blue-600/20 px-4 py-2 rounded-2xl border border-blue-600/30 text-center">
                      <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{t.rank}</div>
                      <div className="text-white font-black italic">{xp < 100 ? "RECRUE" : xp < 300 ? "GUERRIER" : "COMMANDANT"}</div>
                    </div>
                  </div>
                  <form onSubmit={analyzeWithAI} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <input name="name" defaultValue={userName} placeholder="Votre Nom" required className="bg-black border border-white/10 rounded-2xl p-5 text-white focus:border-blue-600 outline-none" />
                      <input name="verse" placeholder="Verset" required className="bg-black border border-white/10 rounded-2xl p-5 text-white focus:border-blue-600 outline-none" />
                    </div>
                    <textarea name="text" placeholder={t.placeholder_text} required rows="5" className="w-full bg-black border border-white/10 rounded-2xl p-5 text-white focus:border-blue-600 outline-none" />
                    <button className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/30">
                      {status === 'loading' ? 'COMMUNICATION IA...' : t.submit}
                    </button>
                  </form>
                </section>

                {geminiResult && (
                  <section className="bg-gradient-to-br from-blue-600 to-blue-800 p-10 rounded-[2.5rem] text-white shadow-3xl animate-in slide-in-from-bottom-6">
                    <h3 className="font-black uppercase text-[10px] flex items-center gap-2 mb-4 tracking-widest"><Zap size={20} fill="white"/> {t.ai_feedback} (+20 XP)</h3>
                    <p className="text-2xl font-bold italic mb-6">"{geminiResult.encouragement}"</p>
                    <div className="bg-black/20 p-5 rounded-2xl border border-white/10 text-lg">{geminiResult.prayer}</div>
                  </section>
                )}
              </div>
            )}

            {view === 'mod' && (
              <section className="space-y-4">
                <h2 className="text-2xl font-black text-white italic px-2 uppercase">Vision du Commandant</h2>
                {reports.map(r => (
                  <div key={r.id} className="bg-white/5 p-6 rounded-[2rem] border border-white/5 flex justify-between items-center group">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">{r.verse}</span>
                        <span className="text-[10px] text-gray-500 font-bold">{r.name}</span>
                      </div>
                      <p className="text-white text-lg font-medium italic line-clamp-2">"{r.text}"</p>
                    </div>
                    <button onClick={() => {
                      const msg = `*⚔️ JOSUÉ 1:8*\n*Guerrier:* ${r.name}\n*Verset:* ${r.verse}\n\n"${r.text}"\n\n*IA:* ${r.aiFeedback?.encouragement}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                    }} className="p-4 bg-green-500/10 text-green-500 rounded-2xl hover:bg-green-600 hover:text-white transition-all"><Share2 size={24}/></button>
                  </div>
                ))}
              </section>
            )}

            {/* YOUTUBE LIVE ANCRÉ */}
            <section className="bg-black rounded-[2.5rem] border border-white/10 overflow-hidden aspect-video shadow-2xl relative">
              <div className="absolute top-4 left-4 z-10 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse uppercase">Live QG</div>
              <iframe width="100%" height="100%" src="https://www.youtube.com/embed/live_stream?channel=VOTRE_ID_CHAINE" frameBorder="0" allowFullScreen></iframe>
            </section>
          </div>

          {/* CHAT LIVE IDENTIFIÉ */}
          <aside className="lg:col-span-4 flex flex-col h-[800px] bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-3xl">
            <div className="p-6 border-b border-white/10 bg-black/40 flex justify-between items-center">
              <h3 className="font-black text-white text-[10px] flex items-center gap-3 uppercase tracking-widest"><MessageSquare className="text-blue-500" size={18}/> {t.live_chat}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.uid === user?.uid ? 'items-end' : 'items-start'}`}>
                  <span className="text-[9px] font-black text-gray-600 uppercase mb-1 px-2">{m.senderName}</span>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] font-medium leading-relaxed ${m.uid === user?.uid ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-600/20' : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/5'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form onSubmit={sendLiveMessage} className="p-4 bg-black border-t border-white/10 flex gap-2">
              <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} placeholder={t.type_msg} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-xs text-white focus:border-blue-600 outline-none" />
              <button type="submit" className="p-4 bg-white text-black rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Send size={20}/></button>
            </form>
          </aside>

        </div>
      </main>
    </div>
  );
};

export default App;