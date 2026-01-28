import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, query, addDoc, 
  serverTimestamp, initializeFirestore, orderBy, limit 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  Shield, Send, Video, Zap, BookOpen, 
  Share2, MessageSquare, Youtube, Award, User
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
  en: { welcome: "Operational HQ", nav_members: "Members", nav_mod: "Moderator", live_chat: "LIVE COMMS", submit: "Submit", ai_feedback: "AI Analysis", grade: "Rank", xp: "Experience" },
  fr: { welcome: "QG Opérationnel", nav_members: "Membres", nav_mod: "Modérateur", live_chat: "COMMUNICATIONS LIVE", submit: "Soumettre", ai_feedback: "Analyse Gemini IA", grade: "Grade", xp: "Expérience" },
  pt: { welcome: "QG Operacional", nav_members: "Membros", nav_mod: "Moderador", live_chat: "COMUNICAÇÕES AO VIVO", submit: "Enviar", ai_feedback: "Análise IA", grade: "Patente", xp: "Experiência" }
};

const getRank = (xp) => {
  if (xp < 100) return "RECRUE";
  if (xp < 300) return "GUERRIER";
  if (xp < 600) return "GARDIEN";
  return "COMMANDANT";
};

const App = () => {
  const [lang, setLang] = useState('fr'); 
  const t = useMemo(() => translations[lang], [lang]);
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState(localStorage.getItem('josue_name') || "");
  const [userXP, setUserXP] = useState(parseInt(localStorage.getItem('josue_xp')) || 0);
  const [isAuthorized, setIsAuthorized] = useState(false);
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
    // Le Commandant voit TOUT (OrderBy timestamp)
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
    setUserName(formData.name);
    localStorage.setItem('josue_name', formData.name);
    
    const prompt = `Mentor Spirituel. Analyse. Langue: ${lang}. Réponds en JSON: { "encouragement": "...", "prayer": "..." }. Texte: ${formData.text}`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      const result = JSON.parse(data.candidates[0].content.parts[0].text);
      
      const newXP = userXP + 20;
      setUserXP(newXP);
      localStorage.setItem('josue_xp', newXP);

      setGeminiResult(result);
      await addDoc(collection(db, 'reports'), {
        name: formData.name, verse: formData.verse, text: formData.text,
        aiFeedback: result, timestamp: serverTimestamp(), xp_awarded: 20
      });
      setStatus('success');
    } catch (e) { setStatus('idle'); }
  };

  const sendLiveMessage = async (e) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    await addDoc(collection(db, 'chat'), {
      text: msgInput, 
      senderName: userName || "Anonyme",
      uid: user.uid, 
      timestamp: serverTimestamp()
    });
    setMsgInput("");
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-6">
          <Shield size={60} className="mx-auto text-blue-500" />
          <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">UNITÉ JOSUÉ 1:8</h1>
          <input type="password" placeholder="CODE JOSUE24" className="w-full bg-black border border-white/20 rounded-2xl p-4 text-center text-white"
            onChange={(e) => e.target.value.toUpperCase() === "JOSUE24" && setIsAuthorized(true)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans">
      <nav className="p-4 border-b border-white/10 flex justify-between items-center bg-black/90 sticky top-0 z-50 backdrop-blur-xl">
        <div className="flex items-center gap-2 font-black text-white italic" onClick={() => setView('home')}>
          <Shield className="text-blue-500" size={24} /> JOSUÉ HQ
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => setView('member')} className={`text-[11px] font-black uppercase ${view === 'member' ? 'text-blue-500' : ''}`}>{t.nav_members}</button>
          <button onClick={() => setView('mod')} className={`text-[11px] font-black uppercase ${view === 'mod' ? 'text-blue-500' : ''}`}>{t.nav_mod}</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-8">
            {view === 'member' && (
              <>
                <section className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-white flex items-center gap-3 italic"><BookOpen className="text-blue-500"/> Méditation</h2>
                    <div className="text-right">
                      <div className="text-[10px] font-black text-blue-400 tracking-widest">{t.grade}</div>
                      <div className="text-white font-black italic">{getRank(userXP)}</div>
                    </div>
                  </div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    analyzeWithAI({ name: e.target.name.value, verse: e.target.verse.value, text: e.target.text.value });
                  }} className="space-y-4">
                    <input name="name" defaultValue={userName} placeholder="Votre Nom" required className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white focus:border-blue-500 outline-none" />
                    <input name="verse" placeholder="Verset" required className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white focus:border-blue-500 outline-none" />
                    <textarea name="text" placeholder="Révélation..." required rows="4" className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white focus:border-blue-500 outline-none" />
                    <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 shadow-xl shadow-blue-600/20">
                      {status === 'loading' ? 'IA EN COURS...' : t.submit}
                    </button>
                  </form>
                </section>

                {geminiResult && (
                  <section className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl animate-in slide-in-from-bottom-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-black uppercase text-[10px] flex items-center gap-2 tracking-widest"><Zap size={16} fill="white"/> {t.ai_feedback}</h3>
                      <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black">+20 XP</div>
                    </div>
                    <p className="text-xl font-bold italic mb-6 leading-tight">"{geminiResult.encouragement}"</p>
                    <div className="bg-black/20 p-4 rounded-xl text-sm border border-white/10">{geminiResult.prayer}</div>
                  </section>
                )}
              </>
            )}

            {view === 'mod' && (
              <section className="space-y-4">
                <div className="bg-blue-600/10 p-6 rounded-[2rem] border border-blue-600/20 flex justify-between items-center">
                  <h2 className="text-xl font-black text-white italic uppercase">Rapports des Membres</h2>
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black">{reports.length} UNITÉS</span>
                </div>
                {reports.map(r => (
                  <div key={r.id} className="bg-white/5 p-6 rounded-3xl border border-white/5 flex justify-between items-center group">
                    <div className="space-y-1">
                      <span className="text-blue-400 font-black text-[10px] uppercase">{r.verse} | {r.name}</span>
                      <p className="text-white text-sm italic">"{r.text}"</p>
                      <div className="text-[10px] text-gray-500 font-bold mt-2">IA: {r.aiFeedback?.encouragement.substring(0, 50)}...</div>
                    </div>
                    <button onClick={() => {
                      const link = `https://wa.me/?text=${encodeURIComponent(`*⚔️ RAPPORT JOSUÉ 1:8*\n*Guerrier:* ${r.name}\n*Verset:* ${r.verse}\n\n"${r.text}"`)}`;
                      window.open(link, '_blank');
                    }} className="p-4 bg-green-500/10 text-green-500 rounded-2xl hover:bg-green-600 hover:text-white transition-all"><Share2 size={20}/></button>
                  </div>
                ))}
              </section>
            )}

            <section className="bg-black rounded-[2.5rem] border border-white/10 overflow-hidden aspect-video shadow-2xl">
              <div className="bg-white/5 p-4 border-b border-white/10 flex items-center gap-3">
                <Youtube className="text-red-600" size={20} fill="currentColor"/>
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Direct QG</span>
              </div>
              <iframe width="100%" height="100%" src="https://www.youtube.com/embed/live_stream?channel=VOTRE_ID_CHAINE" frameBorder="0" allowFullScreen></iframe>
            </section>
          </div>

          <aside className="lg:col-span-4 flex flex-col h-[700px] bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10 bg-black/40 flex justify-between items-center">
              <h3 className="font-black text-white text-xs flex items-center gap-2 uppercase tracking-widest"><MessageSquare className="text-blue-500" size={16}/> {t.live_chat}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.uid === user?.uid ? 'items-end' : 'items-start'}`}>
                  <span className="text-[9px] font-black text-gray-500 uppercase mb-1 px-2">{m.senderName}</span>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-medium ${m.uid === user?.uid ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/10 text-slate-200 rounded-tl-none'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form onSubmit={sendLiveMessage} className="p-4 bg-black border-t border-white/10 flex gap-2">
              <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} placeholder="Votre message..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none" />
              <button type="submit" className="p-3 bg-white text-black rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Send size={18}/></button>
            </form>
          </aside>

        </div>
      </main>
    </div>
  );
};

export default App;