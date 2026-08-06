import { useState, useRef, useEffect } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3002";

const CrownIcon = () => (
  <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
    <path d="M4 32L8 12L18 22L24 4L30 22L40 12L44 32H4Z" fill="#D4AF37" stroke="#B8960C" strokeWidth="1.5" strokeLinejoin="round"/>
    <circle cx="24" cy="4" r="3" fill="#C0392B"/>
    <circle cx="8" cy="12" r="2.5" fill="#C0392B"/>
    <circle cx="40" cy="12" r="2.5" fill="#C0392B"/>
    <rect x="2" y="31" width="44" height="4" rx="1" fill="#D4AF37" stroke="#B8960C" strokeWidth="1"/>
  </svg>
);

// Semi delle carte sparsi sullo sfondo della pagina, dietro alla cornice principale
const CARD_SUITS = ["♠", "♥", "♦", "♣"];
const BACKGROUND_SUITS = [
  { suit:0, top:"4%",  left:"6%",  size:70,  rot:-18 },
  { suit:1, top:"12%", left:"88%", size:56,  rot:22 },
  { suit:2, top:"28%", left:"3%",  size:44,  rot:12 },
  { suit:3, top:"22%", left:"93%", size:64,  rot:-10 },
  { suit:1, top:"48%", left:"9%",  size:50,  rot:-24 },
  { suit:0, top:"55%", left:"90%", size:46,  rot:16 },
  { suit:3, top:"70%", left:"5%",  size:60,  rot:8 },
  { suit:2, top:"75%", left:"91%", size:54,  rot:-14 },
  { suit:0, top:"90%", left:"12%", size:40,  rot:20 },
  { suit:1, top:"92%", left:"85%", size:48,  rot:-8 },
];

const CardSuitsBackground = () => (
  <div style={{ position:"absolute", inset:0, zIndex:1, pointerEvents:"none", overflow:"hidden", borderRadius:12 }}>
    {BACKGROUND_SUITS.map((s, i) => (
      <span key={i} style={{
        position:"absolute", top:s.top, left:s.left,
        fontSize:s.size, color: s.suit % 2 === 0 ? "#8B1A1A" : "#D4AF37",
        opacity:0.16, transform:`rotate(${s.rot}deg)`,
        fontFamily:"Georgia, serif", userSelect:"none",
      }}>
        {CARD_SUITS[s.suit]}
      </span>
    ))}
  </div>
);

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [dots, setDots] = useState(".");
  const [error, setError] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micSupported, setMicSupported] = useState(true);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const isMutedRef = useRef(false);
  const recognitionRef = useRef(null);
  const revealIntervalRef = useRef(null);
  const revealTargetRef = useRef(null);
  const ff = "Georgia, 'Palatino Linotype', Palatino, serif";

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setMicSupported(!!SR);
  }, []);


  useEffect(() => {
    document.body.style.cssText = "margin:0;padding:0;background:#0d0000;height:100%;";
    document.documentElement.style.cssText = "margin:0;padding:0;background:#0d0000;height:100%;";
    return () => { document.body.style.cssText=""; document.documentElement.style.cssText=""; };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 450);
    return () => clearInterval(id);
  }, [loading]);

  const unlockAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  };

  const stopAudio = () => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch(e) {}
      sourceRef.current = null;
    }
  };

  // Scarica l'audio e restituisce l'AudioBuffer pronto
  const fetchAudio = async (text) => {
    if (isMutedRef.current) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      const ctx = audioCtxRef.current;
      if (!ctx) return null;
      if (ctx.state === "suspended") await ctx.resume();
      return await ctx.decodeAudioData(arrayBuffer);
    } catch(e) {
      console.error("Errore fetch audio:", e);
      return null;
    }
  };

  const playBuffer = (audioBuffer) => {
    if (!audioBuffer || !audioCtxRef.current) return;
    stopAudio();
    const source = audioCtxRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtxRef.current.destination);
    source.start(0);
    sourceRef.current = source;
  };

  // Completa istantaneamente l'animazione del testo in corso (se presente)
  const finishActiveReveal = () => {
    if (revealIntervalRef.current) {
      clearInterval(revealIntervalRef.current);
      revealIntervalRef.current = null;
    }
    if (revealTargetRef.current) {
      const { index, text } = revealTargetRef.current;
      setMessages(prev => {
        const copy = [...prev];
        if (copy[index]) copy[index] = { ...copy[index], displayContent: text };
        return copy;
      });
      revealTargetRef.current = null;
    }
  };

  // Rivela il testo progressivamente, calibrato sulla durata reale dell'audio
  const revealText = (index, fullText, durationMs) => {
    finishActiveReveal();
    if (!fullText) return;
    revealTargetRef.current = { index, text: fullText };
    const start = performance.now();
    const total = fullText.length;
    revealIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - start;
      const ratio = Math.min(elapsed / durationMs, 1);
      const chars = Math.max(1, Math.ceil(total * ratio));
      setMessages(prev => {
        const copy = [...prev];
        if (copy[index]) copy[index] = { ...copy[index], displayContent: fullText.slice(0, chars) };
        return copy;
      });
      if (ratio >= 1) {
        clearInterval(revealIntervalRef.current);
        revealIntervalRef.current = null;
        revealTargetRef.current = null;
      }
    }, 35);
  };

  const toggleMute = () => {
    if (!isMuted) stopAudio();
    setIsMuted(prev => !prev);
  };

  const callBackend = async (msgs) => {
    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ messages: msgs }),
    });
    if (!res.ok) throw new Error(`Errore server: ${res.status}`);
    return await res.json();
  };

  const startAudience = async () => {
    unlockAudio();
    setError(null); setStarted(true); setLoading(true); setMessages([]); setFinished(false);
    const initialHistory = [{ role:"user", content:"Presentati e inizia l'udienza." }];
    try {
      // Chiamate parallele: chat + audio insieme
      const data = await callBackend(initialHistory);
      if (!data.reply) {
        setError("Errore: nessuna risposta dalla Regina");
        return;
      }
      const buffer = await fetchAudio(data.reply);
      setMessages([
        { role:"user", content:"Presentati e inizia l'udienza.", hidden:true },
        { role:"assistant", content:data.reply, displayContent:"" },
      ]);
      playBuffer(buffer);
      const durationMs = buffer ? buffer.duration * 1000 : Math.max(1500, data.reply.length * 45);
      revealText(1, data.reply, durationMs);
    } catch(e) { setError(e.message); setStarted(false); }
    finally { setLoading(false); setTimeout(() => inputRef.current?.focus(), 150); }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || finished) return;
    stopListening();
    finishActiveReveal();
    unlockAudio();
    setError(null);
    const userMsg = { role:"user", content:input.trim() };
    const historyForBackend = [...messages.filter(m => !m.hidden), userMsg]
      .map(({ role, content }) => ({ role, content }));
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput(""); setLoading(true);
    try {
      // Chat e audio in parallelo
      const data = await callBackend(historyForBackend);
      const buffer = await fetchAudio(data.reply);
      const assistantIndex = newMessages.length;
      setMessages([...newMessages, { role:"assistant", content:data.reply, displayContent:"" }]);
      playBuffer(buffer);
      const durationMs = buffer ? buffer.duration * 1000 : Math.max(1500, data.reply.length * 45);
      revealText(assistantIndex, data.reply, durationMs);
      if (data.isFinale) setFinished(true);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); setTimeout(() => inputRef.current?.focus(), 150); }
  };

  const handleKey = (e) => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMicSupported(false); return; }

    if (isListening) { stopListening(); return; }

    stopAudio(); // non ascoltare mentre la Regina sta ancora parlando
    unlockAudio();

    const recognition = new SR();
    recognition.lang = "it-IT";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += transcript;
        else interim += transcript;
      }
      setInput((finalTranscript + interim).trim());
    };

    recognition.onerror = (event) => {
      console.error("Errore riconoscimento vocale:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const saveDialog = () => {
    const visible = messages.filter(m => !m.hidden);
    if (!visible.length) return;
    const text = visible.map(m => m.role==="assistant" ? `REGINA DI CUORI:\n${m.content}` : `SUDDITO:\n${m.content}`).join("\n\n---\n\n");
    const blob = new Blob([`UDIENZA REALE\n${"=".repeat(40)}\n\n${text}`], { type:"text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "udienza-regina-di-cuori.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  const resetDialog = () => {
    stopAudio();
    if (revealIntervalRef.current) { clearInterval(revealIntervalRef.current); revealIntervalRef.current = null; }
    revealTargetRef.current = null;
    setMessages([]); setStarted(false); setError(null); setInput(""); setFinished(false);
  };

  const visible = messages.filter(m => !m.hidden);
  const userCount = visible.filter(m => m.role === "user").length;

  return (
    <div className="app-shell" style={{ width:"100%", background:"radial-gradient(ellipse at center, #2a0000 0%, #0d0000 70%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"clamp(8px,2vw,24px)", boxSizing:"border-box", fontFamily:ff }}>

      <style>{`
        @keyframes fiamma {
          0%   { text-shadow: 0 0 8px #fff, 0 0 20px #fff, 0 0 40px #FF4500, 0 0 60px #FF4500, 0 0 80px #CC2200; color: #FFD700; }
          25%  { text-shadow: 0 0 6px #fff, 0 0 16px #FFD700, 0 0 32px #FF6600, 0 0 52px #FF4500, 0 0 72px #AA1100; color: #FF8C00; }
          50%  { text-shadow: 0 0 12px #fff, 0 0 24px #fff, 0 0 48px #FF3300, 0 0 70px #FF2200, 0 0 92px #CC0000; color: #FFD700; }
          75%  { text-shadow: 0 0 5px #FFD700, 0 0 18px #FF8C00, 0 0 36px #FF4500, 0 0 56px #FF2200, 0 0 76px #990000; color: #FFA500; }
          100% { text-shadow: 0 0 8px #fff, 0 0 20px #fff, 0 0 40px #FF4500, 0 0 60px #FF4500, 0 0 80px #CC2200; color: #FFD700; }
        }
        @keyframes pulseMic {
          0%   { box-shadow: 0 0 8px rgba(192,57,43,0.6); }
          50%  { box-shadow: 0 0 22px rgba(192,57,43,0.95); }
          100% { box-shadow: 0 0 8px rgba(192,57,43,0.6); }
        }
        .fire-title { animation: fiamma 1.8s ease-in-out infinite; font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; text-align: center; display: block; width: 100%; }
        .btn-salva { position:relative; }
        .btn-salva::after { content:"Salva il dialogo"; position:absolute; bottom:-28px; left:50%; transform:translateX(-50%); background:rgba(20,0,0,0.95); color:#D4AF37; padding:3px 8px; border-radius:3px; font-size:10px; white-space:nowrap; border:1px solid #5a3a1a; opacity:0; pointer-events:none; transition:opacity 0.2s; }
        .btn-salva:hover::after { opacity:1; }
        .btn-nuova { position:relative; }
        .btn-nuova::after { content:"Nuova udienza"; position:absolute; bottom:-28px; left:50%; transform:translateX(-50%); background:rgba(20,0,0,0.95); color:#8B3333; padding:3px 8px; border-radius:3px; font-size:10px; white-space:nowrap; border:1px solid #8B1A1A; opacity:0; pointer-events:none; transition:opacity 0.2s; }
        .btn-nuova:hover::after { opacity:1; }
        body { margin:0; padding:0; background:#0d0000; }
        .app-shell { height:100vh; height:100dvh; }
        .frame-outer {
          width:100%;
          max-width: calc(820px + clamp(12px,4vw,80px) * 2);
          height: 88vh;
          height: 88dvh;
          min-height: calc(400px + clamp(12px,4vw,80px) * 2);
          max-height: calc(900px + clamp(12px,4vw,80px) * 2);
          padding: clamp(12px,4vw,80px);
          box-sizing: border-box;
          position: relative;
          border-style: solid;
          border-width: clamp(12px,4vw,80px);
          border-image-source: url('/frame-gold.png');
          border-image-slice: 30;
          border-image-width: clamp(12px,4vw,80px);
          border-image-repeat: stretch;
          filter: drop-shadow(0 0 45px rgba(0,0,0,0.75)) drop-shadow(0 0 90px rgba(0,0,0,0.5));
        }
      `}</style>

      <div className="frame-outer">

      <div style={{ width:"100%", maxWidth:820, height:"100%", position:"relative", display:"flex", flexDirection:"column", background:"linear-gradient(160deg,#1a0000 0%,#2a0000 50%,#1a0008 100%)", borderRadius:12, boxShadow:"0 0 60px rgba(192,57,43,0.2), 0 0 120px rgba(0,0,0,0.8)" }}>

        <CardSuitsBackground/>

        <div style={{ position:"relative", zIndex:3, flex:1, display:"flex", flexDirection:"column", padding:"clamp(24px,4vw,40px) clamp(20px,4vw,36px) 0", minHeight:0 }}>

          <div style={{ textAlign:"center", marginBottom:"clamp(6px,1.5vw,10px)", flexShrink:0 }}>
            <div style={{ display:"flex", justifyContent:"center", alignItems:"center", marginBottom:6, gap:12 }}>
              <div style={{ filter:"drop-shadow(0 0 8px #D4AF37)" }}><CrownIcon/></div>
            </div>
            <div style={{ fontSize:"clamp(20px,5vw,32px)", fontWeight:"bold", color:"#D4AF37", letterSpacing:3, textShadow:"0 0 20px rgba(212,175,55,0.5)", marginBottom:3 }}>La Regina di Cuori</div>
            <div style={{ color:"#8B3333", fontSize:"clamp(10px,2.5vw,13px)", fontStyle:"italic", letterSpacing:1 }}>♥ &nbsp; Sovrana Assoluta del Regno delle Carte &nbsp; ♥</div>
            <div style={{ display:"flex", alignItems:"center", gap:10, margin:"6px 0" }}>
              <div style={{ flex:1, height:1, background:"linear-gradient(to right,transparent,#8B1A1A)" }}/>
              <span style={{ color:"#D4AF37", fontSize:14 }}>♦</span>
              <div style={{ flex:1, height:1, background:"linear-gradient(to left,transparent,#8B1A1A)" }}/>
            </div>
          </div>

          {error && <div style={{ marginBottom:8, background:"rgba(180,0,0,0.3)", border:"1px solid #C0392B", borderRadius:6, padding:"8px 14px", color:"#ff9999", fontSize:13, fontStyle:"italic", flexShrink:0 }}>⚠ {error}</div>}

          {started && (
            <div style={{ display:"flex", justifyContent:"center", marginBottom:8, flexShrink:0 }}>
              <video autoPlay loop muted playsInline style={{ width:"clamp(70px,14vw,110px)", borderRadius:8, border:"2px solid #8B1A1A", boxShadow:"0 0 18px rgba(192,57,43,0.5)" }}>
                <source src="/regina.mp4" type="video/mp4"/>
              </video>
            </div>
          )}

          <div style={{ borderTop:"1px solid #3d0000", borderBottom:"1px solid #3d0000", marginBottom:8, flexShrink:0, padding:"clamp(6px,1.5vw,10px) 0", position:"relative" }}>
            <span className="fire-title" style={{ fontSize:"clamp(20px,4.5vw,40px)" }}>
              ♥ &nbsp; Udienza Reale &nbsp; ♥
            </span>
            {started && (
              <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:8 }}>
                {[...Array(10)].map((_, i) => (
                  <div key={i} style={{ width:10, height:10, borderRadius:"50%", background: i < userCount ? "#C0392B" : "rgba(139,26,26,0.25)", border: i < userCount ? "1px solid #D4AF37" : "1px solid #8B1A1A", boxShadow: i < userCount ? "0 0 6px rgba(192,57,43,0.6)" : "none", transition:"all 0.3s" }}/>
                ))}
              </div>
            )}
            {started && (
              <div style={{ position:"absolute", right:0, top:"50%", transform:"translateY(-50%)", display:"flex", gap:6 }}>
                <button className="btn-salva" onClick={saveDialog} style={{ background:"transparent", border:"1px solid #5a3a1a", borderRadius:3, color:"#D4AF37", fontSize:13, padding:"4px 10px", cursor:"pointer", fontFamily:ff }}>💾</button>
                <button className="btn-nuova" onClick={resetDialog} style={{ background:"transparent", border:"1px solid #8B1A1A", borderRadius:3, color:"#8B3333", fontSize:13, padding:"4px 10px", cursor:"pointer", fontFamily:ff }}>↺</button>
              </div>
            )}
          </div>

          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:14, WebkitOverflowScrolling:"touch", paddingBottom:8 }}>

            {!started && !loading && (
              <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"clamp(12px,2.5vw,20px)", padding:"clamp(4px,1vw,12px) 0" }}>
                <video autoPlay loop muted playsInline style={{ width:"clamp(260px,55vw,520px)", borderRadius:14, border:"2px solid #8B1A1A", boxShadow:"0 0 50px rgba(192,57,43,0.6), 0 0 100px rgba(100,0,0,0.4)" }}>
                  <source src="/regina.mp4" type="video/mp4"/>
                </video>
                <div style={{ color:"#6b3333", fontStyle:"italic", fontSize:"clamp(13px,3vw,16px)", textAlign:"center", lineHeight:1.9 }}>
                  La Regina di Cuori ti attende in udienza.<br/>
                  <span style={{ color:"#8B3333" }}>Osa presentarti alla sua corte...</span>
                </div>
                <button onClick={startAudience} style={{ background:"linear-gradient(135deg,#8B1A1A,#C0392B 50%,#8B1A1A)", border:"2px solid #D4AF37", color:"#D4AF37", fontSize:"clamp(14px,3.5vw,18px)", fontWeight:"bold", letterSpacing:2, padding:"clamp(12px,3vw,18px) clamp(28px,7vw,52px)", borderRadius:4, cursor:"pointer", fontFamily:ff, boxShadow:"0 0 20px rgba(212,175,55,0.2)" }}>
                  ♥ &nbsp; Chiedi Udienza &nbsp; ♥
                </button>
                <div style={{ color:"#3d1a1a", fontSize:"clamp(9px,1.8vw,11px)", fontStyle:"italic", textAlign:"center" }}>
                  Attenzione: potreste non avere la testa al termine dell'udienza.
                </div>
              </div>
            )}

            {started && loading && visible.length === 0 && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                  <span style={{ color:"#D4AF37", fontSize:12 }}>♥</span>
                  <span style={{ fontSize:12, letterSpacing:1, color:"#D4AF37" }}>Sua Maestà</span>
                </div>
                <div style={{ padding:"12px 20px", background:"linear-gradient(135deg,rgba(139,26,26,0.22),rgba(80,0,0,0.28))", border:"1px solid rgba(212,175,55,0.2)", borderRadius:14, color:"#D4AF37", fontSize:24, letterSpacing:4 }}>{dots}</div>
              </div>
            )}

            {visible.map((msg,i) => (
              <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                {msg.role==="assistant" ? (
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                    <span style={{ color:"#D4AF37", fontSize:12 }}>♥</span>
                    <span style={{ fontSize:12, letterSpacing:1, color:"#D4AF37" }}>Sua Maestà</span>
                  </div>
                ) : (
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                    <span style={{ fontSize:12, letterSpacing:1, color:"#6b5050" }}>Suddito</span>
                    <span style={{ color:"#6b5050", fontSize:12 }}>♠</span>
                  </div>
                )}
                <div style={{ maxWidth:"85%", padding:"clamp(10px,2.5vw,13px) clamp(12px,3vw,18px)", fontSize:"clamp(14px,3.5vw,16px)", lineHeight:1.8, borderRadius:14, background:msg.role==="assistant"?"linear-gradient(135deg,rgba(139,26,26,0.22),rgba(80,0,0,0.28))":"rgba(18,8,8,0.85)", border:msg.role==="assistant"?"1px solid rgba(212,175,55,0.2)":"1px solid rgba(80,40,40,0.55)", color:msg.role==="assistant"?"#f5e6d3":"#b08080", fontStyle:msg.role==="user"?"italic":"normal", textAlign:"center" }}>
                  {msg.displayContent ?? msg.content}
                </div>
              </div>
            ))}

            {loading && visible.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                  <span style={{ color:"#D4AF37", fontSize:12 }}>♥</span>
                  <span style={{ fontSize:12, letterSpacing:1, color:"#D4AF37" }}>Sua Maestà</span>
                </div>
                <div style={{ padding:"12px 20px", background:"linear-gradient(135deg,rgba(139,26,26,0.22),rgba(80,0,0,0.28))", border:"1px solid rgba(212,175,55,0.2)", borderRadius:14, color:"#D4AF37", fontSize:24, letterSpacing:4 }}>{dots}</div>
              </div>
            )}

            {finished && (
              <div style={{ textAlign:"center", padding:"16px", color:"#8B3333", fontStyle:"italic", fontSize:"clamp(12px,2.5vw,14px)", borderTop:"1px solid #3d0000", marginTop:8 }}>
                ♥ L'udienza è terminata — clicca il pulsante per una nuova udienza ♥
              </div>
            )}

            <div ref={bottomRef}/>
          </div>
        </div>

        {started && !finished && (
          <div style={{ position:"relative", zIndex:3, borderTop:"1px solid #3d0000", padding:"clamp(10px,2vw,14px) clamp(20px,4vw,36px)", background:"rgba(8,0,0,0.9)", display:"flex", gap:10, alignItems:"flex-end", borderRadius:"0 0 12px 12px", flexShrink:0 }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} disabled={loading} placeholder={isListening ? "Sto ascoltando…" : "Osa parlare alla Regina…"} rows={2}
              style={{ flex:1, background:"rgba(25,0,0,0.85)", border: isListening ? "1px solid #D4AF37" : "1px solid #8B1A1A", borderRadius:4, color:"#f5e6d3", fontSize:"clamp(16px,3.5vw,17px)", padding:"clamp(10px,2vw,12px) 14px", fontFamily:ff, fontStyle:"italic", resize:"none", outline:"none", boxSizing:"border-box" }}
              onFocus={e => e.target.style.borderColor="#D4AF37"}
              onBlur={e => e.target.style.borderColor="#8B1A1A"}
            />
            {micSupported && (
              <button onClick={toggleListening} disabled={loading} title={isListening ? "Ferma ascolto" : "Parla al microfono"}
                style={{ background: isListening ? "linear-gradient(135deg,#C0392B,#8B1A1A)" : "rgba(80,20,20,0.5)", border:"1px solid #D4AF37", borderRadius:4, color:"#D4AF37", fontSize:"clamp(15px,3.5vw,18px)", padding:"clamp(10px,2vw,12px) clamp(12px,2.5vw,16px)", cursor: loading?"not-allowed":"pointer", fontFamily:ff, boxShadow: isListening ? "0 0 14px rgba(192,57,43,0.7)" : "none", animation: isListening ? "pulseMic 1.2s ease-in-out infinite" : "none" }}>
                {isListening ? "⏺" : "🎙"}
              </button>
            )}
            <button onClick={toggleMute} title={isMuted ? "Attiva voce" : "Silenzia voce"}
              style={{ background:"rgba(80,20,20,0.5)", border:"1px solid #D4AF37", borderRadius:4, color: isMuted ? "#6b3333" : "#D4AF37", fontSize:"clamp(15px,3.5vw,18px)", padding:"clamp(10px,2vw,12px) clamp(12px,2.5vw,16px)", cursor:"pointer", fontFamily:ff, lineHeight:1 }}>
              {isMuted ? "🔇" : "🔊"}
            </button>
            <button onClick={sendMessage} disabled={loading||!input.trim()}
              style={{ background:loading||!input.trim()?"rgba(80,20,20,0.5)":"linear-gradient(135deg,#8B1A1A,#C0392B)", border:"1px solid #D4AF37", borderRadius:4, color:loading||!input.trim()?"#6b3333":"#D4AF37", fontSize:"clamp(13px,3vw,15px)", fontWeight:"bold", padding:"clamp(10px,2vw,12px) clamp(14px,3vw,22px)", cursor:loading||!input.trim()?"not-allowed":"pointer", fontFamily:ff, whiteSpace:"nowrap" }}>
              ♥ Parla
            </button>
          </div>
        )}

        {started && finished && (
          <div style={{ position:"relative", zIndex:3, borderTop:"1px solid #3d0000", padding:"clamp(10px,2vw,14px) clamp(20px,4vw,36px)", background:"rgba(8,0,0,0.9)", display:"flex", justifyContent:"center", borderRadius:"0 0 12px 12px", flexShrink:0 }}>
            <button onClick={resetDialog} style={{ background:"linear-gradient(135deg,#8B1A1A,#C0392B 50%,#8B1A1A)", border:"2px solid #D4AF37", color:"#D4AF37", fontSize:"clamp(13px,3vw,16px)", fontWeight:"bold", letterSpacing:2, padding:"clamp(10px,2vw,14px) clamp(20px,5vw,40px)", borderRadius:4, cursor:"pointer", fontFamily:ff }}>
              ♥ &nbsp; Nuova Udienza &nbsp; ♥
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}