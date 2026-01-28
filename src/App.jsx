import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, query, addDoc, 
  serverTimestamp, initializeFirestore, orderBy, limit 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  Shield, Send, Video, Zap, BookOpen, 
  Share2, MessageSquare, Youtube, Globe
} from 'lucide-react';

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
  en: { 
    welcome: "Operational HQ", 
    enter: "Enter Meditation", 
    nav_members: "Members", 
    nav_mod: "Moderator", 
    live_chat: "LIVE COMMS", 
    type_msg: "Message...", 
    submit: "Submit to HQ", 
    ai_feedback: "Gemini AI Analysis",
    placeholder_name: "Your Name",
    placeholder_verse: "Verse (ex: Joshua 1:8)",
    placeholder_text: "What is your revelation?",
    yt_live: "YouTube Live Stream"
  },
  fr: { 
    welcome: "QG Opérationnel", 
    enter: "Entrer en Méditation", 
    nav_members: "Membres", 
    nav_mod: "Modérateur", 
    live_chat: "COMMUNICATIONS LIVE", 
    type_msg: "Message pour le QG...", 
    submit: "Soumettre au QG", 
    ai_feedback: "Analyse Gemini IA",
    placeholder_name: "Votre Nom",
    placeholder_verse: "Verset (ex: Josué 1:8)",
    placeholder_text: "Quelle est votre révélation ?",
    yt_live: "Direct YouTube"
  },
  pt: { 
    welcome: "QG Operacional", 
    enter: "Entrar na Meditação", 
    nav_members: "Membros", 
    nav_mod: "Moderador", 
    live_chat: "COMUNICAÇÕES AO VIVO", 
    type_msg: "Mensagem...", 
    submit: "Enviar ao QG", 
    ai_feedback: "Análise da IA Gemini",
    placeholder_name: "Seu Nome",
    placeholder_verse: "Versículo (ex: Josué 1:8)",
    placeholder_text: "Qual é a sua revelação?",
    yt_live: "Direto YouTube"
  }
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
    const prompt = `Act like a spiritual mentor. Analyze this meditation. Language: ${lang}. Return ONLY a JSON object: { "encouragement": "...", "prayer": "..." }. Content: ${formData.text}`;
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
    } catch (e) { 
      console.error("Gemini Error:", e);
      setStatus('idle'); 
    }
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
      <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-6 shadow-2xl">
          <Shield size={60} className="mx-auto text-blue-500 animate-pulse" />
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">ACCÈS UNITÉ JOSUÉ</h1>
          <input type="password" placeholder="CODE JOSUE24" className="w-full bg-black border border-white/20 rounded-2xl p-4 text-center text-white text-xl font-bold focus:border-blue-500 outline-none"
            value={authCode} onChange={(e) => setAuthCode(e.target.value.toUpperCase())} />
          <button onClick={() => authCode === "JOSUE24" ? setIsAuthorized(true) : alert("Code Invalide")} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 transition-all">ENTRER AU QG</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans">
      <nav className="p-4 border-b border-white/10 flex justify-between items-center bg-black/90 sticky top-0 z-50 backdrop-blur-xl">
        <div className="flex items-center gap-2 font-black text-white text-xl italic" onClick={() => setView('home')}>
          <Shield className="text-blue-500" fill="currentColor" size={24} /> JOSUÉ HQ
        </div>
        <div className="flex gap-4 items-center">
          <div className="hidden md:flex bg-white/5 rounded-full p-1 border border-white/10">
            {['fr', 'en', 'pt'].map(l => (
              <button key={l} onClick={() => setLang(l)} className={`px-4 py-1.5 text-[10px] rounded-full font-black uppercase transition-all ${lang === l ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-500'}`}>{l}</button>
            ))}
          </div>
          <button onClick={() => setView('member')} className={`text-[11px] font-black uppercase tracking-widest ${view === 'member' ? 'text-blue-500' : 'text-gray-400'}`}>{t.nav_members}</button>
          <button onClick={() => setView('mod')} className={`text-[11px] font-black uppercase tracking-widest ${view === 'mod' ? 'text-blue-500' : 'text-gray-400'}`}>{t.nav_mod}</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-10">
        {view === 'home' && (
          <div className="text-center py-32 space-y-10 animate-in fade-in zoom-in duration-700">
            <h1 className="text-6xl md:text-8xl font-black text-white italic tracking-tighter uppercase leading-none">{t.welcome}</h1>
            <p className="max-w-xl mx-auto text-gray-500 text-xl font-medium">{t.placeholder_text}</p>
            <button onClick={() => setView('member')} className="px-16 py-6 bg-white text-black rounded-full font-black uppercase text-sm hover:scale-105 transition-all shadow-2xl shadow-white/10">{t.enter}</button>
          </div>
        )}

        {(view === 'member' || view === 'mod') && (
          <div className="grid lg:grid-cols-12 gap-10">
            
            {/* COLONNE GAUCHE : MEDITATION / YOUTUBE */}
            <div className="lg:col-span-8 space-y-10">
              {view === 'member' && (
                <>
                  <section className="bg-white/5 p-10 rounded-[3rem] border border-white/10 shadow-3xl">
                    <h2 className="text-3xl font-black text-white flex items-center gap-4 mb-8 italic"><BookOpen className="text-blue-500" size={32}/> {t.submit}</h2>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      analyzeWithAI({ name: e.target.name.value, verse: e.target.verse.value, text: e.target.text.value });
                    }} className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <input name="name" placeholder={t.placeholder_name} required className="bg-black border border-white/10 rounded-2xl p-5 text-white focus:border-blue-500 outline-none text-lg" />
                        <input name="verse" placeholder={t.placeholder_verse} required className="bg-black border border-white/10 rounded-2xl p-5 text-white focus:border-blue-500 outline-none text-lg" />
                      </div>
                      <textarea name="text" placeholder={t.placeholder_text} required rows="5" className="w-full bg-black border border-white/10 rounded-2xl p-6 text-white focus:border-blue-500 outline-none text-lg" />
                      <button className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-blue-500 shadow-xl shadow-blue-600/20 transition-all">
                        {status === 'loading' ? 'IA EN COURS...' : t.submit}
                      </button>
                    </form>
                  </section>

                  {geminiResult && (
                    <section className="bg-gradient-to-br from-blue-700 to-blue-900 p-10 rounded-[3rem] text-white shadow-3xl animate-in slide-in-from-bottom-6 duration-500">
                      <h3 className="font-black uppercase text-xs flex items-center gap-2 mb-6 tracking-widest"><Zap size={20} fill="white"/> {t.ai_feedback}</h3>
                      <p className="text-2xl font-bold italic mb-8 leading-tight">"{geminiResult.encouragement}"</p>
                      <div className="bg-black/30 p-6 rounded-2xl border border-white/10">
                        <span className="block mb-2 text-blue-300 font-black text-[10px] uppercase tracking-[0.3em]">Activation Spirituelle</span>
                        <p className="text-lg text-blue-50">{geminiResult.prayer}</p>
                      </div>
                    </section>
                  )}
                </>
              )}

              {view === 'mod' && (
                <section className="grid gap-6">
                  <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 flex justify-between items-center">
                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Flux des Rapports</h2>
                    <button onClick={() => window.open('https://meet.jit.si/JosueHQ_Live', '_blank')} className="px-8 py-4 bg-red-600 text-white rounded-full font-black text-xs flex items-center gap-2 animate-pulse"><Video size={18}/> LIVE STUDIO</button>
                  </div>
                  {reports.map(r => (
                    <div key={r.id} className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 flex justify-between items-center hover:bg-white/[0.08] transition-all">
                      <div className="space-y-3">
                        <span className="px-3 py-1 bg-blue-600/20 text-blue-400 font-black text-[10px] rounded-full border border-blue-600/30 uppercase tracking-widest">{r.verse}</span>
                        <h4 className="text-white font-black text-2xl tracking-tighter">{r.name}</h4>
                        <p className="text-gray-400 text-lg italic">"{r.text}"</p>
                      </div>
                      <button onClick={() => {
                        const link = `https://wa.me/?text=${encodeURIComponent(`*⚔️ JOSUÉ 1:8 REPORT*\n*Warrior:* ${r.name}\n*Verse:* ${r.verse}\n\n"${r.text}"\n\n*IA:* ${r.aiFeedback?.encouragement}`)}`;
                        window.open(link, '_blank');
                      }} className="p-5 bg-green-500/10 text-green-500 rounded-2xl hover:bg-green-500 hover:text-white transition-all"><Share2 size={24}/></button>
                    </div>
                  ))}
                </section>
              )}

              {/* SECTION YOUTUBE LIVE (Sous la méditation) */}
              <section className="bg-black rounded-[3rem] border border-white/10 overflow-hidden aspect-video shadow-2xl">
                <div className="bg-white/5 p-4 border-b border-white/10 flex items-center gap-3">
                  <Youtube className="text-red-600" fill="currentColor"/>
                  <span className="text-xs font-black uppercase tracking-widest text-white">{t.yt_live}</span>
                </div>
                {/* REMPLACER "ID_VIDEO_YOUTUBE" par votre ID de direct ou lien de chaine */}
                <iframe width="100%" height="100%" src="https://www.youtube.com/embed/live_stream?channel=VOTRE_ID_CHAINE" title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen></iframe>
              </section>
            </div>

            {/* COLONNE DROITE : CHAT LIVE */}
            <aside className="lg:col-span-4 flex flex-col h-[850px] bg-white/5 rounded-[3rem] border border-white/10 overflow-hidden shadow-3xl sticky top-28">
              <div className="p-8 border-b border-white/10 bg-black/40 backdrop-blur-md flex justify-between items-center">
                <h3 className="font-black text-white text-sm flex items-center gap-3 uppercase tracking-widest"><MessageSquare className="text-blue-500" size={20}/> {t.live_chat}</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_green]"></div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.uid === user?.uid ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] p-5 rounded-[1.5rem] text-sm font-medium leading-relaxed ${m.uid === user?.uid ? 'bg-blue-600 text-white rounded-tr-none shadow-xl shadow-blue-600/20' : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/5'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
              <form onSubmit={sendLiveMessage} className="p-6 bg-black border-t border-white/10 flex gap-3">
                <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} placeholder={t.type_msg} className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none" />
                <button type="submit" className="p-4 bg-white text-black rounded-2xl hover:bg-blue-600 hover:text-white transition-all"><Send size={20}/></button>
              </form>
            </aside>

          </div>
        )}
      </main>
    </div>
  );
};

export default App;