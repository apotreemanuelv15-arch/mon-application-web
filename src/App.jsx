import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, getDoc, 
  onSnapshot, query, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Shield, User, TrendingUp, Mic, Video, 
  Award, Zap, BookOpen, Lock, Share2, LogOut, Globe, Radio
} from 'lucide-react';

// --- CONFIGURATION SÉCURISÉE VIA VITE ---
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = import.meta.env.VITE_APP_ID || 'qg-josue-global';
const apiKey = import.meta.env.VITE_GEMINI_KEY;

const ACCESS_CODE = "JOSUE24"; 

const translations = {
  en: {
    welcome: "Operational HQ",
    subtitle: "Welcome to your spiritual combat space assisted by AI.",
    enter: "Enter Meditation",
    login_title: "Secure HQ Access",
    login_sub: "None may enter without their armor.",
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
    no_reports: "Waiting for reports..."
  },
  fr: {
    welcome: "QG Opérationnel",
    subtitle: "Bienvenue dans votre espace de combat spirituel assisté par IA.",
    enter: "Entrer en Méditation",
    login_title: "Accès Sécurisé QG",
    login_sub: "Nul ne peut entrer s'il n'est revêtu de l'armure.",
    login_placeholder: "Entrez le code de combat...",
    validate: "Valider l'entrée",
    nav_members: "Membres",
    nav_mod: "Modérateur",
    rank_soldier: "Soldat de la Parole",
    rank_general: "Général de Foi",
    meditation_title: "Méditation du Jour",
    name_label: "Nom du Guerrier",
    verse_label: "Verset (Ex: Jean 3:16)",
    revelation_label: "Votre révélation...",
    submit: "Soumettre au QG",
    analyzing: "Analyse IA...",
    ai_feedback: "Analyse Gemini IA",
    prayer_label: "Prière :",
    live_chat: "COMMUNICATIONS LIVE",
    type_msg: "Message pour le QG...",
    join_live: "REJOINDRE LA SALLE DE GUERRE",
    no_reports: "En attente de rapports..."
  },
  pt: {
    welcome: "QG Operacional",
    subtitle: "Bem-vindo ao seu espaço de combate espiritual assistido por IA.",
    enter: "Entrar em Meditação",
    login_title: "Acesso Seguro ao QG",
    login_sub: "Ninguém pode entrar sem a sua armadura.",
    login_placeholder: "Digite o código de combate...",
    validate: "Validar Entrada",
    nav_members: "Membros",
    nav_mod: "Moderador",
    rank_soldier: "Soldado da Palavra",
    rank_general: "General da Fé",
    meditation_title: "Meditação Diária",
    name_label: "Nome do Guerreiro",
    verse_label: "Versículo (Ex: João 3:16)",
    revelation_label: "Sua revelação...",
    submit: "Enviar ao QG",
    analyzing: "IA Analisando...",
    ai_feedback: "Análise da IA Gemini",
    prayer_label: "Oração:",
    live_chat: "COMUNICAÇÕES AO VIVO",
    type_msg: "Mensagem para o QG...",
    join_live: "ENTRAR NA SALA DE GUERRA",
    no_reports: "Aguardando relatórios..."
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

  const currentTitle = useMemo(() => userData.level > 5 ? t.rank_general : t.rank_soldier, [userData.level, t]);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
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
    if (!user) return;
    setStatus('loading');
    try {
      const prompt = `Spiritual mentor. Analyze: ${formData.verse} | ${formData.text}. Lang: ${lang}. JSON: {"encouragement": "...", "prayer": "...", "xp_gain": 20}`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
      });
      const data = await res.json();
      const result = JSON.parse(data.candidates[0].content.parts[0].text);
      setGeminiResult(result);
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'reports'), {
        uid: user.uid, name: formData.name, verse: formData.verse, text: formData.text, aiFeedback: result, timestamp: serverTimestamp()
      });
      const newXp = userData.xp + result.xp_gain;
      const update = { level: newXp >= 100 ? userData.level + 1 : userData.level, xp: newXp % 100 };
      setUserData(update);
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'rank'), update);
      setStatus('success');
    } catch (e) { setStatus('idle'); }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || !user) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chat'), {
      uid: user.uid, userName: userData.name || "Soldat", text: text, timestamp: serverTimestamp()
    });
  };

  const openLive = (type) => {
    const url = type === 'direct' ? `https://meet.jit.si/${appId}_WarRoom` : `https://www.youtube.com/live_dashboard`;
    window.open(url, '_blank');
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
        <div className="flex items-center gap-6">
          <div className="flex gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
            {['fr', 'en', 'pt'].map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${lang === l ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>{l}</button>
            ))}
          </div>
          <div className="flex gap-4">
            <button onClick={() => setView('member')} className={`text-xs font-black uppercase ${view === 'member' ? 'text-blue-400' : 'text-gray-500'}`}>{t.nav_members}</button>
            <button onClick={() => setView('mod')} className={`text-xs font-black uppercase ${view === 'mod' ? 'text-blue-400' : 'text-gray-500'}`}>{t.nav_mod}</button>
            <button onClick={() => setIsAuthorized(false)} className="text-gray-600 hover:text-red-500 ml-2"><LogOut size={20}/></button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6">
        {view === 'home' && (
          <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-1000">
            <h1 className="text-7xl md:text-9xl font-black text-white tracking-tighter leading-none">{t.welcome}</h1>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto font-medium">{t.subtitle}</p>
            <button onClick={() => setView('member')} className="px-12 py-5 bg-white text-black rounded-full font-black text-lg hover:scale-105 transition-all shadow-2xl shadow-white/5 uppercase">{t.enter}</button>
          </div>
        )}

        {view === 'member' && (
          <div className="grid lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-6 duration-700">
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 md:p-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-blue-600/20 rounded-2xl text-blue-500"><BookOpen size={28}/></div>
                  <h2 className="text-3xl font-black text-white">{t.meditation_title}</h2>
                </div>
                <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); analyzeWithAI({ name: e.target.name.value, verse: e.target.verse.value, text: e.target.text.value }); }}>
                  <div className="grid md:grid-cols-2 gap-6">
                    <input name="name" placeholder={t.name_label} required className="bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-600" />
                    <input name="verse" placeholder={t.verse_label} required className="bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-600" />
                  </div>
                  <textarea name="text" placeholder={t.revelation_label} required rows="4" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-600 resize-none"></textarea>
                  <button disabled={status === 'loading'} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center justify-center gap-3">
                    {status === 'loading' ? t.analyzing : <><Zap size={20}/> {t.submit}</>}
                  </button>
                </form>
              </div>
              {geminiResult && (
                <div className="bg-gradient-to-r from-blue-600/20 to-transparent border border-blue-500/30 rounded-[2.5rem] p-8 space-y-4">
                  <span className="flex items-center gap-2 text-blue-400 font-black uppercase text-[10px] tracking-widest"><Zap size={14}/> {t.ai_feedback}</span>
                  <p className="text-xl font-medium text-white italic">"{geminiResult.encouragement}"</p>
                  <p className="text-sm text-gray-400"><span className="text-blue-400 font-bold">{t.prayer_label}</span> {geminiResult.prayer}</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 space-y-8">
              <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex flex-col h-[520px] shadow-2xl">
                <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                  <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><Radio size={14} className="animate-pulse text-red-500"/> {t.live_chat}</h4>
                </div>
                
                {/* BOUTON REJOINDRE LE LIVE POUR LES MEMBRES */}
                <button onClick={() => openLive('direct')} className="w-full mb-4 py-3 bg-green-600/20 border border-green-500/30 text-green-500 rounded-xl text-[10px] font-black uppercase hover:bg-green-600 hover:text-white transition-all flex items-center justify-center gap-2">
                  <Video size={14}/> {t.join_live}
                </button>

                <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 custom-scrollbar text-[11px]">
                  {liveMessages.map((m) => (
                    <div key={m.id} className={`p-3 rounded-2xl ${m.uid === user.uid ? 'bg-blue-600/20 border border-blue-600/30 ml-4' : 'bg-white/5 border border-white/5 mr-4'}`}>
                      <span className="font-black text-blue-400 uppercase text-[9px] block mb-1">{m.userName}</span>
                      <p className="text-gray-200">{m.text}</p>
                    </div>
                  ))}
                </div>
                <input type="text" placeholder={t.type_msg} className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-blue-600" onKeyDown={(e) => { if(e.key === 'Enter') { sendMessage(e.target.value); e.target.value = ''; } }} />
              </div>
              <div className="bg-gradient-to-b from-blue-600/10 to-transparent border border-white/10 rounded-[2.5rem] p-8 text-center space-y-4">
                <div className="relative inline-block">
                  <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-600/40"><Award size={32} className="text-white"/></div>
                  <div className="absolute -bottom-1 -right-1 bg-white text-black w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-4 border-[#08080a]">{userData.level}</div>
                </div>
                <h3 className="text-xl font-black text-white uppercase">{currentTitle}</h3>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5"><div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${userData.xp}%` }}></div></div>
              </div>
            </div>
          </div>
        )}

        {view === 'mod' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row justify-between items-center bg-blue-600/10 p-8 rounded-[2.5rem] border border-blue-600/20 gap-6 text-center md:text-left">
              <div>
                <h2 className="text-5xl font-black text-white uppercase tracking-tighter">{t.nav_mod}</h2>
                <p className="text-blue-400 font-medium italic">Centre de Commandement Spirituel.</p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => openLive('direct')} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-black text-xs hover:bg-green-500 transition-all shadow-lg shadow-green-600/20"><Video size={16}/> LANCER VIDÉO</button>
                <button onClick={() => openLive('youtube')} className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-black text-xs hover:bg-red-500 transition-all shadow-lg shadow-red-600/20"><Globe size={16}/> LIVE YOUTUBE</button>
              </div>
            </header>
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 h-[600px] overflow-y-auto custom-scrollbar space-y-4">
                <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3"><TrendingUp className="text-blue-500" /> RAPPORTS DE COMBAT</h3>
                {reports.length === 0 ? <p className="text-center text-gray-600 mt-20">{t.no_reports}</p> : reports.map((r) => (
                  <div key={r.id} className="bg-black/40 border border-white/5 p-6 rounded-[1.5rem] space-y-4 hover:border-blue-600/30 transition-all">
                    <div className="flex justify-between items-start">
                      <div><h4 className="font-black text-white flex items-center gap-2"><User size={14} className="text-blue-500"/> {r.name}</h4><span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">{r.verse}</span></div>
                      <button onClick={() => {
                        const txt = `*⚔️ QG JOSUÉ - RAPPORT ⚔️*\n\n*👤 ${r.name}*\n*📖 ${r.verse}*\n\n"${r.text}"\n\n*🕊️ IA:* ${r.aiFeedback?.encouragement}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
                      }} className="p-2 bg-green-600/10 text-green-500 rounded-lg"><Share2 size={16}/></button>
                    </div>
                    <p className="text-sm text-gray-400 italic">"{r.text}"</p>
                    <div className="p-3 bg-blue-600/5 rounded-xl border border-blue-600/10 text-[11px] text-blue-300"><strong>IA :</strong> {r.aiFeedback?.encouragement}</div>
                  </div>
                ))}
              </div>
              <div className="bg-blue-600 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-blue-600/30 h-fit">
                <h4 className="text-2xl font-black uppercase tracking-tighter mb-2">SÉCURITÉ</h4>
                <div className="bg-black/20 p-5 rounded-2xl border border-white/20 text-center"><span className="text-[10px] font-bold uppercase opacity-50 block mb-1">Code QG</span><span className="text-3xl font-mono font-black tracking-[0.3em]">{ACCESS_CODE}</span></div>
              </div>
            </div>
          </div>
        )}
      </main>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.2); border-radius: 10px; }`}</style>
    </div>
  );
};

export default App;