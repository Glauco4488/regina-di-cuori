require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VOICE_ID = "PGzgufLTCZyBEIdThUDC";

const SYSTEM_PROMPT = `Sei la Regina di Cuori, sovrana assoluta e arbitraria del regno delle Carte da Gioco. Parli sempre in italiano con tono imperioso, teatrale, bizzarro e magnificamente assurdo.

1. SOSTIENI TESI ASSURDE CON LOGICA APPARENTE: usi sillogismi storti ma formalmente plausibili.
2. MAI AMMETTERE TORTO: chi ti contraddice e colpevole di lesa maesta.
3. RIBALTA CAUSA ED EFFETTO: Prima la sentenza, poi il processo.
4. AUTORITA COME ARGOMENTO SUPREMO: E vero perche lo dico io.
5. SEDUCENTE E TEATRALE: affascinante, umoristica, grandiosa.
6. USA ESCLAMAZIONI REGIE: Mozzategli la testa!, Che impertinenza!, con eleganza.
7. CITA LEGGI ASSURDE del tuo regno come prove inconfutabili.
8. LUNGHEZZA: 3-5 frasi al massimo.
9. APERTURA: presentati con magnificenza e poni subito una tesi assurda.
10. GRAMMATICA IMPECCABILE: usa sempre il congiuntivo corretto e la sintassi perfetta.
11. PARLA SOLO IN PRIMA PERSONA: esprimi ogni reazione attraverso il linguaggio, mai con didascalie teatrali.
12. NON USARE MAI NUMERI ROMANI: scrivi sempre i numeri in cifre arabe o in lettere.

Non uscire mai dal personaggio.`;

const SENTENZA_FINALE = `Sei la Regina di Cuori. L'udienza sta per concludersi. Pronuncia una sentenza finale teatrale e assurda sul suddito che hai appena interrogato, in stile regale. Dichiara l'udienza chiusa con un colpo di scena finale degno della tua magnificenza. 3-5 frasi al massimo. Niente asterischi.`;

function removeAsterisks(text) {
  return text
    .replace(/\*[^*]*\*/g, "")
    .replace(/\*+/g, "")
    .replace(/[A-ZÀÈÌÒÙ\s]{10,}[?!.,]{1,3}/g, "")
    .replace(/\n\s*\n/g, "\n")
    .replace(/  +/g, " ")
    .trim();
}

// Correzioni di accento tonico per ElevenLabs: alcune parole italiane vengono lette
// con l'accento sbagliato (es. "regia" letta come "regìa" invece di "règia").
// Si forza la pronuncia corretta scrivendo l'accento esplicito sulla vocale tonica.
const STRESS_FIXES = {
  "regia": "règia",
  "regie": "règie",
  "regio": "règio",
  "regi": "règi",
};

function fixStressForSpeech(text) {
  let result = text;
  for (const [wrong, right] of Object.entries(STRESS_FIXES)) {
    const pattern = new RegExp(`\\b${wrong}\\b`, "gi");
    result = result.replace(pattern, (match) =>
      match[0] === match[0].toUpperCase()
        ? right[0].toUpperCase() + right.slice(1)
        : right
    );
  }
  return result;
}

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  const userMessages = messages.filter(m => m.role === "user");
  const isLastMessage = userMessages.length >= 10;
  try {
    const systemToUse = isLastMessage
      ? SYSTEM_PROMPT + "\n\n" + SENTENZA_FINALE
      : SYSTEM_PROMPT;
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemToUse,
      messages: messages,
    });
    const reply = removeAsterisks(response.content[0].text);
    res.json({ reply, isFinale: isLastMessage });
  } catch (error) {
    console.error("Errore API Anthropic:", error.message);
    res.status(500).json({ error: "Errore del server" });
  }
});

app.post("/api/speak", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Testo mancante" });
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: fixStressForSpeech(text),
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.80,
            style: 0.55,
            use_speaker_boost: true,
          },
        }),
      }
    );
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs: ${response.status} — ${errText}`);
    }
    const audioBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error("Errore ElevenLabs:", error.message);
    res.status(500).json({ error: "Errore TTS" });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Regina in ascolto sulla porta ${PORT}`);
});