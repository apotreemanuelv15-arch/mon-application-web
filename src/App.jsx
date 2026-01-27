import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, 
  onSnapshot, query, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Shield, User, TrendingUp, Video, 
  Award, Zap, BookOpen, Lock, Share2, LogOut, Globe, Radio
} from 'lucide-react';

// --- CONFIGURATION SÉCURISÉE (FLUX DIRECT) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialisation sécurisée
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = import.meta.env.VITE_APP_ID || 'qg-josue-global';
const apiKey = import.meta.env.VITE_GEMINI_KEY;

const ACCESS_CODE = "JOSUE24"; 

const translations = {
  fr: {
    welcome: "QG Opérationnel",
    subtitle: "Bienvenue dans votre espace de combat spirituel assisté par IA.",
    enter: "Entrer en Méditation",
    login_title: "Accès Sécurisé QG",
    login_placeholder: "Entrez le code de combat...",
    validate: "Valider l'entrée",
    nav_members: "Membres",
    nav_mod: "Modérateur",
    rank_soldier: "Soldat de la Parole",
    rank_general: "Général de Foi",
    meditation_title: "Méditation du Jour",
    name_label: "Warrior Name",
    verse_label: "Verset (Ex: Jean 3:16)",
    revelation_label: "Votre révélation...",
    submit: "Soumettre au QG",
    analyzing: "Analyse IA...",
    ai_feedback: "Analyse Gemini IA",
    prayer_label: "Prière :",
    live_chat: "COMMUNICATIONS LIVE",
    type_msg: "Message pour le QG...",
    join_live: "REJOINDRE LA SALLE DE GUERRE",
    no_reports: "En attente de rapports...",
    invalid_code: "Code de combat invalide !"
  },
  en: {
    welcome: "Operational HQ",
    subtitle: "Welcome to your spiritual combat space assisted by AI.",
    enter: "Enter Meditation",
    login_title: "Secure HQ Access",
    login_placeholder: "Enter combat code...",
    validate: "Validate Entry",
    nav_members: "Members",
    nav_mod: "Moderator",
    rank_soldier: "Word Soldier",
    rank_general: "Faith General",
    meditation_title: "Daily Meditation",
    name_label: "Warrior Name",
    verse_label: "Verse (e.g. John 3:16)",
    revelation_label: "Your revelation...",
    submit: "Submit to HQ",
    analyzing: "AI Analyzing...",
    ai_feedback: "Gemini AI Analysis",
    prayer_label: "Prayer:",
    live_chat: "LIVE COMMS",
    type_msg: "Type message to HQ...",
    join_live: "JOIN WAR ROOM",
    no_reports: "Waiting for reports...",
    invalid_code: "Invalid combat code!"
  }
};

const App = () => {
  const [lang, setLang] = useState('fr'); 
  const t = useMemo(() => translations[lang] || translations.fr, [lang]);
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [view, setView] = useState('home');
  const [status, setStatus] = useState('idle');
  const [reports, setReports] = useState([]);
  const [liveMessages, setLiveMessages] = useState([]);
  const [userData, setUserData] = useState({ level: 1, xp: 0 });
  const [geminiResult, setGeminiResult] = useState(null);

  const currentTitle = useMemo(() => userData.level > 5 ? t.rank_general : t.rank_soldier, [userData.level, t]);

  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Erreur Auth:", err));
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !isAuthorized) return;
    const unsubReports = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'reports')), (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    });
    const unsubChat = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'chat')), (snap) => {
      setLiveMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)));
    });
    return () => { unsubReports(); unsubChat(); };
  }, [user, isAuthorized]);

  const analyzeWithAI = async (formData) => {
    if (!user || !apiKey) {
        alert("Erreur: Clé IA manquante ou utilisateur non identifié.");
        return;
    }
    setStatus('loading');
    try {
      const prompt = `Agis en mentor spirituel. Analyse ce verset: ${formData.verse} et cette révélation: ${formData.text}. Réponds UNIQUEMENT en JSON avec ce format: {"encouragement": "texte court", "prayer": "une courte prière", "xp_gain": 20}`;
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
      });
      
      const data = await res.json();
      
      if (data.candidates && data.candidates[0]) {
        const result = JSON.parse(data.candidates[0].content.parts[0].text);
        setGeminiResult(result);
        
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'reports'), {
          uid: user.uid, name: formData.name, verse: formData.verse, text: formData.text, aiFeedback: result, timestamp: serverTimestamp()
        });
        
        const newXp = userData.xp + (result.xp_gain || 10);
        const update = { level: newXp >= 100 ? userData.level + 1 : userData.level, xp: newXp % 100 };
        setUserData(update);
        setStatus('success');
      } else {
        throw new Error("Réponse IA vide");
      }
    } catch (e) { 
      console.error("Erreur IA:", e);
      setStatus('idle');
      alert("Le QG IA est momentanément indisponible. Vérifiez vos clés.");
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || !user) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chat'), {
      uid: user.uid, userName: userData.name || "Soldat", text: text, timestamp: serverTimestamp()
    });
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#08080a] flex flex-col items-center justify-center p-6 text-slate-200">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-[2.5rem] p-10 backdrop-blur-2xl shadow-2xl space-y-8 text-center">
          <div className="inline-flex p-5 bg-blue-600/20 rounded-full text-blue-500"><Lock size={42} /></div>
          <h1 className="text-3xl font-black uppercase text-white">{t.login_title}</h1>
          <input type="password" placeholder={t.login_placeholder} className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-center text-white outline-none focus:ring-2 focus:ring-blue-600 uppercase" value={authCode} onChange={(e) => setAuthCode(e.target.value.toUpperCase())} />
          <button onClick={() => authCode === ACCESS_CODE ? setIsAuthorized(true) : alert(t.invalid_code)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase shadow-lg shadow-blue-600/20"> {t.validate} </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080a] text-slate-300 font-sans">
      <nav className="sticky top-0 z-50 bg-black/60 backdrop-blur-md border-b border-white/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('home')}>
          <div className="bg-blue-600 p-2 rounded-xl"><Shield className="text-white w-6 h-6" /></div>
          <span className="font-black text-xl text-white tracking-tighter">JOSUÉ HQ</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setView('member')} className={`text-xs font-black uppercase ${view === 'member' ? 'text-blue-400' : 'text-gray-500'}`}>{t.nav_members}</button>
          <button onClick={() => setView('mod')} className={`text-xs font-black uppercase ${view === 'mod' ? 'text-blue-400' : 'text-gray-500'}`}>{t.nav_mod}</button>
          <button onClick={() => setIsAuthorized(false)} className="text-gray-600 hover:text-red-500 ml-2"><LogOut size={20}/></button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6">
        {view === 'home' && (
          <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-1000">
            <h1 className="text-7xl md:text-9xl font-black text-white tracking-tighter leading-none uppercase">{t.welcome}</h1>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto font-medium">{t.subtitle}</p>
            <button onClick={() => setView('member')} className="px-12 py-5 bg-white text-black rounded-full font-black text-lg hover:scale-105 transition-all shadow-2xl shadow-white/5 uppercase">{t.enter}</button>
          </div>
        )}

        {view === 'member' && (
          <div className="grid lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-6 duration-700">
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
                <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3"><BookOpen className="text-blue-500"/> {t.meditation_title}</h2>
                <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); analyzeWithAI({ name: e.target.name.value, verse: e.target.verse.value, text: e.target.text.value }); }}>
                  <div className="grid md:grid-cols-2 gap-6">
                    <input name="name" placeholder={t.name_label} required className="bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-600" />
                    <input name="verse" placeholder={t.verse_label} required className="bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-600" />
                  </div>
                  <textarea name="text" placeholder={t.revelation_label} required rows="4" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-600 resize-none"></textarea>
                  <button disabled={status === 'loading'} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase flex items-center justify-center gap-3">
                    {status === 'loading' ? t.analyzing : <><Zap size={20}/> {t.submit}</>}
                  </button>
                </form>
              </div>
              {geminiResult && (
                <div className="bg-blue-600/10 border border-blue-500/30 rounded-[2.5rem] p-8 space-y-4">
                  <span className="text-blue-400 font-black uppercase text-[10px] tracking-widest">{t.ai_feedback}</span>
                  <p className="text-xl font-medium text-white italic">"{geminiResult.encouragement}"</p>
                  <p className="text-sm text-gray-400"><span className="text-blue-400 font-bold">{t.prayer_label}</span> {geminiResult.prayer}</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 space-y-8">
              <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex flex-col h-[500px]">
                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Radio size={14} className="text-red-500"/> {t.live_chat}</h4>
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 custom-scrollbar">
                  {liveMessages.map((m) => (
                    <div key={m.id} className="p-3 rounded-2xl bg-white/5 border border-white/5">
                      <span className="font-black text-blue-400 uppercase text-[9px] block">{m.userName}</span>
                      <p className="text-gray-200 text-xs">{m.text}</p>
                    </div>
                  ))}
                </div>
                <input type="text" placeholder={t.type_msg} className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white outline-none" onKeyDown={(e) => { if(e.key === 'Enter') { sendMessage(e.target.value); e.target.value = ''; } }} />
              </div>
              <div className="bg-gradient-to-b from-blue-600/10 to-transparent border border-white/10 rounded-[2.5rem] p-8 text-center space-y-4">
                <div className="relative inline-block">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto"><Award size={30} className="text-white"/></div>
                  <div className="absolute -bottom-1 -right-1 bg-white text-black w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px]">{userData.level}</div>
                </div>
                <h3 className="text-lg font-black text-white uppercase">{currentTitle}</h3>
              </div>
            </div>
          </div>
        )}

        {view === 'mod' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row justify-between items-center bg-blue-600/10 p-8 rounded-[2.5rem] border border-blue-600/20 gap-6">
              <h2 className="text-4xl font-black text-white uppercase">{t.nav_mod}</h2>
              <div className="flex gap-4">
                <button onClick={() => window.open(`https://meet.jit.si/${appId}_WarRoom`, '_blank')} className="px-6 py-3 bg-green-600 text-white rounded-xl font-black text-xs flex items-center gap-2"><Video size={16}/> DIRECT VIDÉO</button>
              </div>
            </header>
            <div className="grid lg:grid-cols-2 gap-8">
              {reports.map((r) => (
                <div key={r.id} className="bg-white/5 border border-white/10 p-6 rounded-[1.5rem] space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-black text-white flex items-center gap-2 uppercase text-sm"><User size={14} className="text-blue-500"/> {r.name}</h4>
                    <span className="text-[10px] text-blue-400 font-bold">{r.verse}</span>
                  </div>
                  <p className="text-xs text-gray-400 italic">"{r.text}"</p>
                  <div className="p-3 bg-blue-600/10 rounded-xl text-[10px] text-blue-300 italic">{r.aiFeedback?.encouragement}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.2); border-radius: 10px; }`}</style>
    </div>
  );
};

export default App;