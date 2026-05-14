require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
11. PARLA SOLO IN PRIMA PERSONA: descrivi tutto con le parole, mai con azioni tra asterischi o in maiuscolo. Esprimi ogni reazione attraverso il linguaggio, non attraverso didascalie teatrali.

Non uscire mai dal personaggio.`;

function removeAsterisks(text) {
  return text
    .replace(/\*[^*]*\*/g, "")
    .replace(/\*+/g, "")
    .replace(/[A-ZÀÈÌÒÙ\s]{10,}[?!.,]{1,3}/g, "")
    .replace(/\n\s*\n/g, "\n")
    .replace(/  +/g, " ")
    .trim();
}

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages,
    });
    const reply = removeAsterisks(response.content[0].text);
    res.json({ reply });
  } catch (error) {
    console.error("Errore API:", error.message);
    res.status(500).json({ error: "Errore del server" });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Regina in ascolto sulla porta ${PORT}`);
});