import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, getDoc, 
  onSnapshot, query, addDoc, serverTimestamp, initializeFirestore 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  Shield, User, Send, TrendingUp, Video, 
  Award, Zap, BookOpen, Volume2, 
  Lock, Share2, LogOut, Globe, MessageSquare
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

// CORRECTIF CRUCIAL : Force la connexion même si le navigateur bloque
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

const appId = "qg-josue-global";
const apiKey = import.meta.env.VITE_GEMINI_KEY;
const ACCESS_CODE = "JOSUE24"; 

const translations = {
  en: {
    welcome: "Operational HQ",
    subtitle: "Spiritual combat space assisted by AI.",
    enter: "Enter Meditation",
    login_title: "Secure Access",
    nav_members: "Members",
    nav_mod: "Moderator",
    meditation_title: "Daily Meditation",
    submit: "Submit to HQ",
    ai_feedback: "Gemini AI Analysis",
    live_chat: "LIVE COMMS",
    type_msg: "Message to HQ..."
  },
  fr: {
    welcome: "QG Opérationnel",
    subtitle: "Espace de combat spirituel assisté par IA.",
    enter: "Entrer en Méditation",
    login_title: "Accès Sécurisé",
    nav_members: "Membres",
    nav_mod: "Modérateur",
    meditation_title: "Méditation du Jour",
    submit: "Soumettre au QG",
    ai_feedback: "Analyse Gemini IA",
    live_chat: "COMMUNICATIONS LIVE",
    type_msg: "Message pour le QG..."
  },
  pt: {
    welcome: "QG Operacional",
    subtitle: "Espaço de combate espiritual assistido por IA.",
    enter: "Entrar em Meditação",
    login_title: "Acesso Seguro",
    nav_members: "Membros",
    nav_mod: "Moderador",
    meditation_title: "Meditação Diária",
    submit: "Enviar ao QG",
    ai_feedback: "Análise da IA Gemini",
    live_chat: "COMUNICAÇÕES AO VIVO",
    type_msg: "Mensagem para o QG..."
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
  const [liveMessages, setLiveMessages] = useState([]);
  const [userData, setUserData] = useState({ level: 1, xp: 0 });
  const [geminiResult, setGeminiResult] = useState(null);

  useEffect(() => {
    signInAnonymously(auth).catch(e => console.error("Auth Error", e));
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !isAuthorized) return;
    const qReports = query(collection(db, 'reports'));
    const unsubReports = onSnapshot(qReports, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const qChat = query(collection(db, 'chat'));
    const unsubChat = onSnapshot(qChat, (snap) => {
      setLiveMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubReports(); unsubChat(); };
  }, [user, isAuthorized]);

  const analyzeWithAI = async (formData) => {
    setStatus('loading');
    const prompt = `Spiritual Mentor. Analyze. Language: ${lang}. Return JSON only: { "encouragement": "...", "prayer": "...", "xp_gain": 20 }. Verse: ${formData.verse} | Text: ${formData.text}`;
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
        aiFeedback: result, timestamp: serverTimestamp()
      });
      setStatus('success');
    } catch (e) { 
      console.error(e);
      setStatus('idle'); 
    }
  };

  const shareToWhatsApp = (r) => {
    const text = `*⚔️ QG JOSUÉ 1:8 - RAPPORT ⚔️*\n\n*👤 GUERRIER:* ${r.name}\n*📖 VERSET:* ${r.verse}\n\n"${r.text}"\n\n*🕊️ RÉPONSE IA:* ${r.aiFeedback?.encouragement}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-6">
          <Shield size={48} className="mx-auto text-blue-500" />
          <h1 className="text-2xl font-black text-white uppercase">{t.login_title}</h1>
          <input type="password" placeholder="CODE JOSUE24" className="w-full bg-black border border-white/10 rounded-xl p-4 text-center text-white"
            value={authCode} onChange={(e) => setAuthCode(e.target.value.toUpperCase())} />
          <button onClick={() => authCode === ACCESS_CODE ? setIsAuthorized(true) : alert("Invalide")} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold">VALIDER</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080a] text-slate-300">
      <nav className="p-4 border-b border-white/5 flex justify-between items-center bg-black/50 sticky top-0 z-50">
        <div className="flex items-center gap-2 font-black text-white" onClick={() => setView('home')}>
          <Shield className="text-blue-500" /> JOSUÉ HQ
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
            {['fr', 'en', 'pt'].map(l => (
              <button key={l} onClick={() => setLang(l)} className={`px-2 py-1 text-[10px] uppercase font-bold ${lang === l ? 'bg-blue-600 text-white' : ''}`}>{l}</button>
            ))}
          </div>
          <button onClick={() => setView('member')} className="text-xs font-bold uppercase">{t.nav_members}</button>
          <button onClick={() => setView('mod')} className="text-xs font-bold uppercase">{t.nav_mod}</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-6">
        {view === 'home' && (
          <div className="text-center py-20 space-y-6">
            <h1 className="text-6xl font-black text-white">{t.welcome}</h1>
            <p className="text-gray-500">{t.subtitle}</p>
            <button onClick={() => setView('member')} className="px-10 py-4 bg-white text-black rounded-full font-black uppercase text-sm">Entrer</button>
          </div>
        )}

        {view === 'member' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 space-y-6">
              <h2 className="text-2xl font-black text-white flex items-center gap-2"><BookOpen/> {t.meditation_title}</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                analyzeWithAI({ name: e.target.name.value, verse: e.target.verse.value, text: e.target.text.value });
              }} className="space-y-4">
                <input name="name" placeholder="Nom" required className="w-full bg-black/40 border border-white/10 rounded-xl p-4" />
                <input name="verse" placeholder="Verset (ex: Josué 1:8)" required className="w-full bg-black/40 border border-white/10 rounded-xl p-4" />
                <textarea name="text" placeholder="Révélation..." required rows="4" className="w-full bg-black/40 border border-white/10 rounded-xl p-4" />
                <button className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold">{status === 'loading' ? 'Analyse...' : t.submit}</button>
              </form>
            </div>
            {geminiResult && (
              <div className="bg-blue-600/10 border border-blue-600/30 p-8 rounded-[2rem] space-y-4 animate-in zoom-in-95">
                <h3 className="text-blue-400 font-black uppercase text-xs flex items-center gap-2"><Zap size={14}/> {t.ai_feedback}</h3>
                <p className="text-white italic">"{geminiResult.encouragement}"</p>
                <p className="text-sm text-gray-400"><strong>Prière:</strong> {geminiResult.prayer}</p>
              </div>
            )}
          </div>
        )}

        {view === 'mod' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-blue-600/10 p-6 rounded-2xl border border-blue-600/20">
              <h2 className="text-2xl font-black text-white">CONTRÔLE LIVE</h2>
              <div className="flex gap-4">
                <button onClick={() => window.open('https://meet.jit.si/JosueHQ_Live', '_blank')} className="px-4 py-2 bg-green-600 rounded-lg text-xs font-bold flex items-center gap-2"><Video size={14}/> ACTIVER AUDIO/VIDEO</button>
              </div>
            </div>
            <div className="grid gap-4">
              {reports.map(r => (
                <div key={r.id} className="bg-white/5 p-6 rounded-2xl border border-white/5 flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-blue-400 font-bold text-xs uppercase">{r.verse}</span>
                    <h4 className="text-white font-black">{r.name}</h4>
                    <p className="text-gray-400 text-sm italic">"{r.text}"</p>
                  </div>
                  <button onClick={() => shareToWhatsApp(r)} className="p-3 bg-green-600/20 text-green-500 rounded-xl hover:bg-green-600 hover:text-white transition-all"><Share2 size={18}/></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;