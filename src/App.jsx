import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, query, addDoc, 
  serverTimestamp, initializeFirestore, orderBy, limit 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { Shield, Send, Zap, BookOpen, Share2, MessageSquare, Award, Star, Video, Radio } from 'lucide-react';

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
  fr: { 
    welcome: "QG Opérationnel", nav_members: "Membres", nav_mod: "Modérateur", submit: "Soumettre au QG", 
    ai_feedback: "Analyse IA Groq", meditation: "Méditation", placeholder_name: "Votre Nom", 
    placeholder_verse: "Verset", placeholder_text: "Votre révélation...", rank: "Grade",
    live_comm: "COMMUNICATIONS LIVE", loading: "COMMUNICATION...", mod_title: "COMMANDEMENT DU FRONT",
    launch_live: "LANCER LIVE STUDIO", chat_placeholder: "Écrire au front...", join_live: "REJOINDRE LE LIVE"
  },
  en: { 
    welcome: "HQ Operational", nav_members: "Members", nav_mod: "Moderator", submit: "Submit to HQ", 
    ai_feedback: "Groq AI Analysis", meditation: "Meditation", placeholder_name: "Your Name", 
    placeholder_verse: "Verse", placeholder_text: "Your revelation...", rank: "Rank",
    live_comm: "LIVE COMMUNICATIONS", loading: "COMMUNICATING...", mod_title: "FRONT COMMAND",
    launch_live: "START LIVE STUDIO", chat_placeholder: "Write to the front...", join_live: "JOIN LIVE"
  },
  pt: { 
    welcome: "QG Operacional", nav_members: "Membros", nav_mod: "Moderador", submit: "Enviar ao QG", 
    ai_feedback: "Análise IA Groq", meditation: "Meditação", placeholder_name: "Seu Nome", 
    placeholder_verse: "Versículo", placeholder_text: "Sua revelação...", rank: "Patente",
    live_comm: "COMUNICAÇÕES AO VIVO", loading: "COMUNICANDO...", mod_title: "COMANDO DE FRENTE",
    launch_live: "INICIAR LIVE STUDIO", chat_placeholder: "Escrever para a frente...", join_live: "ENTRAR NO LIVE"
  }
};

const getRank = (msgCount, lang) => {
  const ranks = {
    fr: ["Soldat", "Capitaine", "Colonel", "Général"],
    en: ["Soldier", "Captain", "Colonel", "General"],
    pt: ["Soldado", "Capitão", "Coronel", "General"]
  };
  const r = ranks[lang] || ranks.fr;
  if (msgCount >= 50) return { name: r[3], color: "text-purple-500", icon: <Star size={10}/> };
  if (msgCount >= 20) return { name: r[2], color: "text-red-500", icon: <Award size={10}/> };
  if (msgCount >= 10) return { name: r[1], color: "text-blue-500", icon: <Shield size={10}/> };
  return { name: r[0], color: "text-slate-500", icon: null };
};

const App = () => {
  const [lang, setLang] = useState('fr');
  const t = translations[lang];
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [view, setView] = useState('member');
  const [status, setStatus] = useState('idle');
  const [debugError, setDebugError] = useState("");
  const [reports, setReports] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [geminiResult, setGeminiResult] = useState(null);
  const [msgInput, setMsgInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    signInAnonymously(auth);
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    const unsubReports = onSnapshot(query(collection(db, 'reports'), orderBy('timestamp', 'desc')), (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubChat = onSnapshot(query(collection(db, 'chat'), orderBy('timestamp', 'asc'), limit(100)), (snap) => {
      setChatMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => { unsubReports(); unsubChat(); };
  }, [isAuthorized]);

  const analyzeWithAI = async (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const formData = { name, verse: e.target.verse.value, text: e.target.text.value };
    setStatus('loading');
    setDebugError("");

    const systemPrompts = {
      fr: "Tu es un mentor spirituel chrétien. Tu DOIS répondre exclusivement en FRANÇAIS. Format JSON: { \"encouragement\": \"...\", \"prayer\": \"...\" }.",
      en: "You are a Christian spiritual mentor. You MUST respond exclusively in ENGLISH. JSON format: { \"encouragement\": \"...\", \"prayer\": \"...\" }.",
      pt: "Você é um mentor espiritual cristão. Você DEVE responder exclusivamente em PORTUGUÊS. Formato JSON: { \"encouragement\": \"...\", \"prayer\": \"...\" }."
    };

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompts[lang] },
            { role: "user", content: `Verset: ${formData.verse}. Texte: ${formData.text}` }
          ],
          temperature: 0.5,
          response_format: { type: "json_object" }
        })
      });

      const data = await res.json();
      const cleanJson = JSON.parse(data.choices[0].message.content);
      setGeminiResult(cleanJson);
      await addDoc(collection(db, 'reports'), { ...formData, aiFeedback: cleanJson, timestamp: serverTimestamp(), uid: user.uid, lang });
      localStorage.setItem('josue_name', name);
      setStatus('success');
    } catch (err) {
      setDebugError(err.message);
      setStatus('idle');
    }
  };

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    await addDoc(collection(db, 'chat'), { 
      text: msgInput, 
      senderName: localStorage.getItem('josue_name') || "Guerrier", 
      uid: user.uid, 
      timestamp: serverTimestamp() 
    });
    setMsgInput("");
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white font-mono">
        <div className="border border-white/10 p-10 rounded-3xl bg-white/5 text-center space-y-6">
          <Shield size={48} className="mx-auto text-blue-600" />
          <h1 className="text-xl font-black italic tracking-tighter uppercase">QG JOSUÉ 1:8</h1>
          <input type="password" autoFocus placeholder="CODE JOSUE24" className="bg-black border border-white/20 p-4 rounded-xl text-center w-full outline-none focus:border-blue-600" 
            onKeyUp={(e) => e.target.value.toUpperCase() === "JOSUE24" && setIsAuthorized(true)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans">
      <nav className="p-4 border-b border-white/10 flex justify-between items-center bg-black/95 sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-2 font-black text-white italic text-lg cursor-pointer" onClick={() => setView('member')}>
          <Shield className="text-blue-600" size={22} fill="currentColor" /> JOSUÉ HQ
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
            {['fr', 'en', 'pt'].map(l => (
              <button key={l} onClick={() => setLang(l)} className={`px-2 py-1 text-[9px] rounded-full font-bold uppercase transition-all ${lang === l ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>{l}</button>
            ))}
          </div>
          <button onClick={() => setView('member')} className={`text-[10px] font-black uppercase ${view === 'member' ? 'text-blue-500' : ''}`}>{t.nav_members}</button>
          <button onClick={() => setView('mod')} className={`text-[10px] font-black uppercase ${view === 'mod' ? 'text-blue-500' : ''}`}>{t.nav_mod}</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            {view === 'member' && (
              <section className="bg-white/5 p-8 rounded-[2rem] border border-white/10 shadow-xl">
                <h2 className="text-xl font-black text-white flex items-center gap-3 mb-8 italic uppercase"><BookOpen className="text-blue-600" /> {t.meditation}</h2>
                <form onSubmit={analyzeWithAI} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <input name="name" placeholder={t.placeholder_name} defaultValue={localStorage.getItem('josue_name') || ""} required className="bg-black border border-white/10 rounded-xl p-5 text-white outline-none focus:border-blue-600" />
                    <input name="verse" placeholder={t.placeholder_verse} required className="bg-black border border-white/10 rounded-xl p-5 text-white outline-none focus:border-blue-600" />
                  </div>
                  <textarea name="text" placeholder={t.placeholder_text} required rows="3" className="w-full bg-black border border-white/10 rounded-xl p-5 text-white outline-none focus:border-blue-600" />
                  <button className="w-full py-5 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-500 transition-all">
                    {status === 'loading' ? t.loading : t.submit}
                  </button>
                </form>
              </section>
            )}

            {geminiResult && view === 'member' && (
              <section className="bg-gradient-to-br from-blue-700 to-blue-900 p-8 rounded-[2rem] text-white shadow-2xl animate-in slide-in-from-bottom-4">
                <h3 className="text-[10px] font-black mb-4 tracking-widest uppercase flex items-center gap-2"><Zap size={16} fill="white"/> {t.ai_feedback}</h3>
                <p className="text-2xl font-bold mb-6 italic italic">"{geminiResult.encouragement}"</p>
                <div className="bg-black/20 p-6 rounded-2xl border border-white/10 text-lg italic">{geminiResult.prayer}</div>
              </section>
            )}

            {view === 'mod' && (
              <section className="space-y-4">
                <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 flex justify-between items-center shadow-lg">
                  <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">{t.mod_title}</h2>
                  <button onClick={() => window.open('https://meet.jit.si/JosueHQ_Live', '_blank')} className="px-6 py-3 bg-red-600 text-white rounded-full font-black text-[10px] animate-pulse flex items-center gap-2">
                    <Video size={14}/> {t.launch_live}
                  </button>
                </div>
                {reports.map(r => (
                  <div key={r.id} className="bg-white/5 p-6 rounded-2xl border border-white/5 flex justify-between items-center">
                    <div className="space-y-1">
                      <span className="text-blue-500 text-[9px] font-black uppercase tracking-widest">{r.verse} | {r.name}</span>
                      <p className="text-white text-base italic opacity-90 font-medium">"{r.text}"</p>
                    </div>
                    <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${r.name}: ${r.text}`)}`, '_blank')} className="p-4 bg-white/5 rounded-2xl hover:bg-green-600 hover:text-white transition-all"><Share2 size={20}/></button>
                  </div>
                ))}
              </section>
            )}

            <section className="bg-black rounded-[2rem] border border-white/10 overflow-hidden aspect-video shadow-2xl relative">
              <iframe width="100%" height="100%" src="https://www.youtube.com/embed/live_stream?channel=UCAUrnN36d0sfMypjsnkFlTA" frameBorder="0" allowFullScreen></iframe>
            </section>
          </div>

          <aside className="lg:col-span-4 flex flex-col h-[750px] bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10 bg-black/40 font-black text-white text-[10px] uppercase tracking-widest flex items-center justify-between">
              <div className="flex items-center gap-2"><MessageSquare className="text-blue-500" size={16}/> {t.live_comm}</div>
              <button onClick={() => window.open('https://meet.jit.si/JosueHQ_Live', '_blank')} className="bg-red-600 px-2 py-1 rounded text-[8px] flex items-center gap-1 animate-pulse">
                <Radio size={10}/> {t.join_live}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {chatMessages.map((m, i) => {
                const userMsgCount = chatMessages.filter(msg => msg.uid === m.uid).length;
                const rank = getRank(userMsgCount, lang);
                return (
                  <div key={i} className={`flex flex-col ${m.uid === user?.uid ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1 mb-1.5 px-1.5">
                      <span className={`text-[8px] font-black uppercase ${rank.color} flex items-center gap-1`}>{rank.icon} {rank.name}</span>
                      <span className="text-[8px] font-black text-gray-500 uppercase italic">| {m.senderName}</span>
                    </div>
                    <div className={`max-w-[90%] p-4 rounded-2xl text-[13px] font-medium leading-relaxed ${m.uid === user?.uid ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-200 border border-white/5'}`}>{m.text}</div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
            <form onSubmit={sendMsg} className="p-4 bg-black border-t border-white/10 flex gap-2">
              <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} placeholder={t.chat_placeholder} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-xs text-white outline-none focus:border-blue-600 transition-all" />
              <button type="submit" className="p-4 bg-white text-black rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Send size={20}/></button>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default App;