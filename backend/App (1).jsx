import { useState, useRef, useEffect } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3002";

const CrownIcon = () => (
  <svg width="44" height="33" viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 32L8 12L18 22L24 4L30 22L40 12L44 32H4Z" fill="#D4AF37" stroke="#B8960C" strokeWidth="1.5" strokeLinejoin="round"/>
    <circle cx="24" cy="4" r="3" fill="#C0392B"/>
    <circle cx="8" cy="12" r="2.5" fill="#C0392B"/>
    <circle cx="40" cy="12" r="2.5" fill="#C0392B"/>
    <rect x="2" y="31" width="44" height="4" rx="1" fill="#D4AF37" stroke="#B8960C" strokeWidth="1"/>
  </svg>
);

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [dots, setDots] = useState(".");
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 450);
    return () => clearInterval(id);
  }, [loading]);

  const callBackend = async (msgs) => {
    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: msgs }),
    });
    if (!res.ok) throw new Error(`Errore server: ${res.status}`);
    const data = await res.json();
    return data.reply;
  };

  const startAudience = async () => {
    setError(null);
    setStarted(true);
    setLoading(true);
    try {
      const initMsgs = [{ role: "user", content: "Presentati e inizia l'udienza." }];
      const greeting = await callBackend(initMsgs);
      setMessages([
        { role: "user", content: "Presentati e inizia l'udienza.", hidden: true },
        { role: "assistant", content: greeting },
      ]);
    } catch (e) {
      setError(e.message);
      setStarted(false);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    setError(null);
    const userMsg = { role: "user", content: input.trim() };
    const history = [...messages.filter(m => !m.hidden), userMsg];
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const reply = await callBackend(history);
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const visible = messages.filter(m => !m.hidden);
  const ff = "Georgia, 'Palatino Linotype', Palatino, serif";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg,#1a0000 0%,#2d0000 50%,#1a0008 100%)",
      fontFamily: ff,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "16px 12px 16px",
      boxSizing: "border-box",
    }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 16, width: "100%", maxWidth: 620 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10,
          filter: "drop-shadow(0 0 6px #D4AF37)" }}>
          <CrownIcon />
        </div>
        <div style={{
          fontSize: "clamp(20px,5vw,30px)", fontWeight: "bold",
          color: "#D4AF37", letterSpacing: 2,
          textShadow: "0 0 16px rgba(212,175,55,0.4), 0 2px 4px rgba(0,0,0,0.8)",
          marginBottom: 4,
        }}>La Regina di Cuori</div>
        <div style={{ color: "#8B3333", fontSize: 13, fontStyle: "italic", letterSpacing: 1 }}>
          ♥ &nbsp; Sovrana Assoluta del Regno delle Carte &nbsp; ♥
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to right,transparent,#8B1A1A)" }}/>
          <span style={{ color: "#D4AF37", fontSize: 14 }}>♦</span>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to left,transparent,#8B1A1A)" }}/>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          width: "100%", maxWidth: 620, marginBottom: 12,
          background: "rgba(180,0,0,0.3)", border: "1px solid #C0392B",
          borderRadius: 6, padding: "10px 14px",
          color: "#ff9999", fontSize: 13, fontStyle: "italic",
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 620,
        background: "linear-gradient(180deg,rgba(30,0,0,0.97),rgba(18,0,4,0.99))",
        border: "1px solid #8B1A1A",
        boxShadow: "0 0 0 1px #3d0000, 0 8px 32px rgba(0,0,0,0.7)",
        borderRadius: 8, overflow: "hidden",
      }}>
        {/* Top bar */}
        <div style={{
          background: "linear-gradient(90deg,rgba(139,26,26,0.25),transparent)",
          padding: "8px 14px", borderBottom: "1px solid #3d0000",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ color: "#D4AF37", fontSize: 12 }}>♥</span>
          <span style={{ fontSize: 11, letterSpacing: 2, color: "#8B3333", textTransform: "uppercase" }}>Udienza Reale</span>
          <span style={{ color: "#D4AF37", fontSize: 12, marginLeft: "auto" }}>♥</span>
        </div>

        {/* Messages */}
        <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 14, minHeight: 320 }}>

          {!started && !loading && (
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 20, padding: "32px 20px",
            }}>
              <div style={{ color: "#6b3333", fontStyle: "italic", fontSize: 15, textAlign: "center", lineHeight: 1.8 }}>
                La Regina di Cuori ti attende in udienza.<br/>
                <span style={{ color: "#8B3333" }}>Osa presentarti alla sua corte...</span>
              </div>
              <button
                onClick={startAudience}
                style={{
                  background: "linear-gradient(135deg,#8B1A1A,#C0392B 50%,#8B1A1A)",
                  border: "2px solid #D4AF37", color: "#D4AF37",
                  fontSize: 16, fontWeight: "bold", letterSpacing: 2,
                  padding: "16px 44px", borderRadius: 4, cursor: "pointer",
                  fontFamily: ff,
                }}
              >
                ♥ &nbsp; Chiedi Udienza &nbsp; ♥
              </button>
              <div style={{ color: "#3d1a1a", fontSize: 11, fontStyle: "italic", textAlign: "center" }}>
                Attenzione: potreste non avere la testa al termine dell'udienza.
              </div>
            </div>
          )}

          {started && loading && visible.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", paddingTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <span style={{ color: "#D4AF37", fontSize: 12 }}>♥</span>
                <span style={{ fontSize: 11, letterSpacing: 1, color: "#D4AF37" }}>Sua Maestà</span>
              </div>
              <div style={{
                padding: "11px 18px",
                background: "linear-gradient(135deg,rgba(139,26,26,0.22),rgba(80,0,0,0.28))",
                border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: "2px 12px 12px 12px",
                color: "#D4AF37", fontSize: 22, letterSpacing: 4,
              }}>{dots}</div>
            </div>
          )}

          {visible.map((msg, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "assistant" ? "flex-start" : "flex-end" }}>
              {msg.role === "assistant" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <span style={{ color: "#D4AF37", fontSize: 12 }}>♥</span>
                  <span style={{ fontSize: 11, letterSpacing: 1, color: "#D4AF37" }}>Sua Maestà</span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 11, letterSpacing: 1, color: "#6b5050" }}>Suddito</span>
                  <span style={{ color: "#6b5050", fontSize: 12 }}>♠</span>
                </div>
              )}
              <div style={{
                maxWidth: "88%", padding: "11px 15px", fontSize: 15, lineHeight: 1.75,
                borderRadius: msg.role === "assistant" ? "2px 12px 12px 12px" : "12px 2px 12px 12px",
                background: msg.role === "assistant"
                  ? "linear-gradient(135deg,rgba(139,26,26,0.22),rgba(80,0,0,0.28))"
                  : "rgba(18,8,8,0.85)",
                border: msg.role === "assistant"
                  ? "1px solid rgba(212,175,55,0.2)"
                  : "1px solid rgba(80,40,40,0.55)",
                color: msg.role === "assistant" ? "#f5e6d3" : "#b08080",
                fontStyle: msg.role === "user" ? "italic" : "normal",
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && visible.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <span style={{ color: "#D4AF37", fontSize: 12 }}>♥</span>
                <span style={{ fontSize: 11, letterSpacing: 1, color: "#D4AF37" }}>Sua Maestà</span>
              </div>
              <div style={{
                padding: "11px 18px",
                background: "linear-gradient(135deg,rgba(139,26,26,0.22),rgba(80,0,0,0.28))",
                border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: "2px 12px 12px 12px",
                color: "#D4AF37", fontSize: 22, letterSpacing: 4,
              }}>{dots}</div>
            </div>
          )}

          <div ref={bottomRef}/>
        </div>

        {/* Input area */}
        {started && (
          <div style={{
            borderTop: "1px solid #3d0000", padding: 12,
            background: "rgba(8,0,0,0.65)",
            display: "flex", gap: 8, alignItems: "flex-end",
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              placeholder="Osa parlare alla Regina… (Invio per inviare)"
              rows={2}
              style={{
                flex: 1, background: "rgba(25,0,0,0.85)",
                border: "1px solid #8B1A1A", borderRadius: 4,
                color: "#f5e6d3", fontSize: 15, padding: "10px 13px",
                fontFamily: ff, fontStyle: "italic",
                resize: "none", outline: "none", boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = "#D4AF37"}
              onBlur={e => e.target.style.borderColor = "#8B1A1A"}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim()
                  ? "rgba(80,20,20,0.5)"
                  : "linear-gradient(135deg,#8B1A1A,#C0392B)",
                border: "1px solid #D4AF37", borderRadius: 4,
                color: loading || !input.trim() ? "#6b3333" : "#D4AF37",
                fontSize: 14, fontWeight: "bold", letterSpacing: 1,
                padding: "10px 18px",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                fontFamily: ff, whiteSpace: "nowrap",
              }}
            >
              ♥ Parla
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, color: "#3d1a1a", fontSize: 11, fontStyle: "italic", letterSpacing: 1, textAlign: "center" }}>
        ♥ &nbsp; Philosophein — La Regina di Cuori &nbsp; ♥
      </div>
    </div>
  );
}
