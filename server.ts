import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));

// Lazy initializer for Gemini SDK as required by development guidelines
let aiInstance: GoogleGenAI | null = null;
function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: key,
    });
  }
  return aiInstance;
}

// Helper to determine if we can make actual AI calls
function isGeminiConfigured() {
  return !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
}

// Stateless Simulation Helpers
function createSimulatedOpId(prompt: string = "") {
  const timestamp = Date.now();
  const hash = Buffer.from(prompt).toString("base64").substring(0, 16);
  return `sim-${timestamp}-${hash}`;
}

function parseSimulatedOpId(opId: string) {
  const parts = opId.split("-");
  if (parts.length < 3) return null;
  const timestamp = parseInt(parts[1]);
  const hash = parts[2];
  return { timestamp, hash };
}

// API Routes FIRST

// 1. Script Generation
app.post("/api/generate-script", async (req, res) => {
  try {
    const { topic, contentType, targetPlatform, tone, brandVoice, referenceImage } = req.body;

    const basePrompt = `Write a video scripting storyboard about "${topic}".
Category/Format details:
- Content Category: ${contentType || "General Storytelling"}
- Target Format/Platform: ${targetPlatform || "Shorts/TikTok (9:16)"}
- Voice & Tone: ${tone || "Dynamic and engaging"}
- Brand Style/Identity Constraints: ${brandVoice || "Professional, modern, authentic"}`;

    const systemInstruction = `You are a world-class social media scripting director and video production planner.
Your goal is to optimize the script structure:
- If format starts with "Shorts", "Reels" or "TikTok" (usually 9:16 format), you MUST write a highly structured script that starts with an explosive, high-impact hook in the first 2 seconds to retain viewer attention. Keep total duration under 60 seconds (around 4-6 concise scenes).
- If format is "YouTube (16:9)", structure the narrative as a compelling 3-act story (Introduction/Hook, Deep Dive/Conflict, Resolution/Outro). Keep durations around 10-15 seconds per scene for pacing.
- For each scene, write detailed image/video generation prompts (Visual prompts for GenAI models like Veo). Describe specific physical objects, lighting (e.g. dramatic volumetric light, cinematic golden hour), colors, actions, and specific camera styles (e.g., pan left, slow zoom-in, macro lens). Include audio directions (music/voice tones) and exactly what gets spoken. Use english for visual prompts so the video models understand them correctly.`;

    if (!isGeminiConfigured()) {
      // High-quality sandbox mode simulated script when key isn't provided
      const dummyScenes = targetPlatform && targetPlatform.includes("16:9")
        ? [
            {
              id: "scene-1",
              duration: 10,
              visualPrompt: "A sleek modern creator studio desk with a neon glow, camera panning in slowly on a designer laptop, volumetric lighting, futuristic vibe, highly detailed",
              narration: "Avez-vous déjà voulu créer du contenu qui marque les esprits instantanément ? Aujourd'hui, nous débloquons le secret ultime.",
              cameraMovement: "Slow zoom in towards the computer screen",
              textOverlay: "LE SECRET DES CRÉATEURS",
              audioCue: "Cinematic synth pulsing softly, building up"
            },
            {
              id: "scene-2",
              duration: 15,
              visualPrompt: "Close up of an AI algorithm visual on screen, glowing cybernetic lines of data shifting rapidly, high-tech, cinematic 4k",
              narration: "Tout commence par la puissance alliée de l'intelligence artificielle et d'un scriptage chirurgical adapté à votre audience.",
              cameraMovement: "Macro pan left on screen reflections",
              textOverlay: "PUISSANCE DE L'IA",
              audioCue: "Digital glitch noises combined with medium-tempo electronic beat"
            },
            {
              id: "scene-3",
              duration: 12,
              visualPrompt: "Cinematic shot of a creator smiling while reviewing successful video analytics graphs on a phone, bright warm side light, shallow depth of field",
              narration: "En mariant une voix de marque unique à des visuels d'une cohérence irréprochable, vous multipliez votre engagement par dix.",
              cameraMovement: "Tracking shot moving softly from left to right",
              textOverlay: "10X D'ENGAGEMENT",
              audioCue: "Positive acoustic notes with upbeat drum kick"
            },
            {
              id: "scene-4",
              duration: 10,
              visualPrompt: "Sleek metallic call to action button glowing with modern radial gradient, 3d render style, dark elegant background",
              narration: "Prêt à transformer vos idées en chefs-d'œuvre visuels? Commencez à générer dès maintenant.",
              cameraMovement: "Static lock-on with subtle light sweep effect",
              textOverlay: "CRÉEZ VOTRE PREMIÈRE VIDÉO",
              audioCue: "Sleek swoosh element concluding with a warm chime"
            }
          ]
        : [
            {
              id: "scene-1",
              duration: 5,
              visualPrompt: "Dynamic young developer typing code furiously on glowing mechanical keyboard, retro synthwave lights, extreme close-up, dramatic focus, high key energy",
              narration: "Stop ! Ne faites plus JAMAIS vos vidéos de la même manière.",
              cameraMovement: "High speed whip pan into center focus",
              textOverlay: "ARRÊTEZ TOUT !",
              audioCue: "Heavy bass drop, fast rhythmic sound effect"
            },
            {
              id: "scene-2",
              duration: 7,
              visualPrompt: "Creative brain abstract neon model spinning, glowing lines highlighting connections, dark minimal futuristic background, macro photography",
              narration: "L'IA vient de rendre la génération vidéo accessible en un clic, et voici la formule secrète.",
              cameraMovement: "Slow rotational camera spin around the neon brain",
              textOverlay: "LA FORMULE SECRÈTE 🧠",
              audioCue: "Futuristic digital sweep sound effect"
            },
            {
              id: "scene-3",
              duration: 8,
              visualPrompt: "Graph showing views climbing rapidly in vertical analytics dashboard on high-tech smartphone, neon green arrow pointing high up, glowing 3d look, high contrast",
              narration: "1: Écrivez avec un ton ultra-direct. 2: Générez des scènes ultra-cohérentes avec Veo. Et voilà les millions de vues.",
              cameraMovement: "Fast tilt-down revealing smartphone",
              textOverlay: "FORMULE EN 2 ÉTAPES 📈",
              audioCue: "Inspiring electro crescendo"
            },
            {
              id: "scene-4",
              duration: 5,
              visualPrompt: "A sleek modern smartphone on screen pointing at viewer, dynamic arrows circulating, subscribe symbol flashing, professional styling",
              narration: "Abonnez-vous pour dominer l'algorithme !",
              cameraMovement: "Wobble shake zoom to phone face",
              textOverlay: "CLIQUEZ ICI ! Double-tap !",
              audioCue: "Sleek keyboard tap SFX and subscription bell ring"
            }
          ];

      return res.json({
        title: `Script: ${topic || "Nouveau Concept"}`,
        brandVoiceApplied: brandVoice || "Voix de marque par défaut",
        formatType: targetPlatform || "Shorts/TikTok (9:16)",
        overallMood: tone || "Élastique et dynamique",
        scenes: dummyScenes,
        isSimulated: true
      });
    }

    // Call real Gemini API
    try {
      const ai = getGenAI();
      const contents: any[] = [basePrompt];
      
      // Support image analysis if referenceImage was uploaded
      if (referenceImage) {
        const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          contents.push({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          });
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              brandVoiceApplied: { type: Type.STRING },
              formatType: { type: Type.STRING },
              overallMood: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    duration: { type: Type.INTEGER, description: "Duration in seconds (between 3 and 15)" },
                    visualPrompt: { type: Type.STRING, description: "Highly cinematic description of scene, suited for text-to-video tools. Explain mood, objects, action, and lighting in English." },
                    narration: { type: Type.STRING, description: "Spoken voiceover script in the user's language" },
                    cameraMovement: { type: Type.STRING, description: "Detailed camera style directions (tilt, zoom, pan, steady, track)" },
                    textOverlay: { type: Type.STRING, description: "Captions or title lines on screen" },
                    audioCue: { type: Type.STRING, description: "Atmosphere sound details or music prompt guides" }
                  },
                  required: ["id", "duration", "visualPrompt", "narration", "cameraMovement", "textOverlay", "audioCue"]
                }
              }
            },
            required: ["title", "brandVoiceApplied", "formatType", "overallMood", "scenes"]
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      res.json({ ...data, isSimulated: false });
    } catch (realApiErr: any) {
      console.warn("Real Gemini script generation failed, auto-falling back to sandbox simulation:", realApiErr);
      
      const dummyScenes = targetPlatform && targetPlatform.includes("16:9")
        ? [
            {
              id: "scene-1",
              duration: 10,
              visualPrompt: "A sleek modern creator studio desk with a neon glow, camera panning in slowly on a designer laptop, volumetric lighting, futuristic vibe, highly detailed",
              narration: "Avez-vous déjà voulu créer du contenu qui marque les esprits instantanément ? Aujourd'hui, nous débloquons le secret ultime.",
              cameraMovement: "Slow zoom in towards the computer screen",
              textOverlay: "LE SECRET DES CRÉATEURS",
              audioCue: "Cinematic synth pulsing softly, building up"
            },
            {
              id: "scene-2",
              duration: 15,
              visualPrompt: "Close up of an AI algorithm visual on screen, glowing cybernetic lines of data shifting rapidly, high-tech, cinematic 4k",
              narration: "Tout commence par la puissance alliée de l'intelligence artificielle et d'un scriptage chirurgical adapté à votre audience.",
              cameraMovement: "Macro pan left on screen reflections",
              textOverlay: "PUISSANCE DE L'IA",
              audioCue: "Digital glitch noises combined with medium-tempo electronic beat"
            },
            {
              id: "scene-3",
              duration: 12,
              visualPrompt: "Cinematic shot of a creator smiling while reviewing successful video analytics graphs on a phone, bright warm side light, shallow depth of field",
              narration: "En mariant une voix de marque unique à des visuels d'une cohérence irréprochable, vous multipliez votre engagement par dix.",
              cameraMovement: "Tracking shot moving softly from left to right",
              textOverlay: "10X D'ENGAGEMENT",
              audioCue: "Positive acoustic notes with upbeat drum kick"
            },
            {
              id: "scene-4",
              duration: 10,
              visualPrompt: "Sleek metallic call to action button glowing with modern radial gradient, 3d render style, dark elegant background",
              narration: "Prêt à transformer vos idées en chefs-d'œuvre visuels? Commencez à générer dès maintenant.",
              cameraMovement: "Static lock-on with subtle light sweep effect",
              textOverlay: "CRÉEZ VOTRE PREMIÈRE VIDÉO",
              audioCue: "Sleek swoosh element concluding with a warm chime"
            }
          ]
        : [
            {
              id: "scene-1",
              duration: 5,
              visualPrompt: "Dynamic young developer typing code furiously on glowing mechanical keyboard, retro synthwave lights, extreme close-up, dramatic focus, high key energy",
              narration: "Stop ! Ne faites plus JAMAIS vos vidéos de la même manière.",
              cameraMovement: "High speed whip pan into center focus",
              textOverlay: "ARRÊTEZ TOUT !",
              audioCue: "Heavy bass drop, fast rhythmic sound effect"
            },
            {
              id: "scene-2",
              duration: 7,
              visualPrompt: "Creative brain abstract neon model spinning, glowing lines highlighting connections, dark minimal futuristic background, macro photography",
              narration: "L'IA vient de rendre la génération vidéo accessible en un clic, et voici la formule secrète.",
              cameraMovement: "Slow rotational camera spin around the neon brain",
              textOverlay: "LA FORMULE SECRÈTE 🧠",
              audioCue: "Futuristic digital sweep sound effect"
            },
            {
              id: "scene-3",
              duration: 8,
              visualPrompt: "Graph showing views climbing rapidly in vertical analytics dashboard on high-tech smartphone, neon green arrow pointing high up, glowing 3d look, high contrast",
              narration: "1: Écrivez avec un ton ultra-direct. 2: Générez des scènes ultra-cohérentes avec Veo. Et voilà les millions de vues.",
              cameraMovement: "Fast tilt-down revealing smartphone",
              textOverlay: "FORMULE EN 2 ÉTAPES 📈",
              audioCue: "Inspiring electro crescendo"
            },
            {
              id: "scene-4",
              duration: 5,
              visualPrompt: "A sleek modern smartphone on screen pointing at viewer, dynamic arrows circulating, subscribe symbol flashing, professional styling",
              narration: "Abonnez-vous pour dominer l'algorithme !",
              cameraMovement: "Wobble shake zoom to phone face",
              textOverlay: "CLIQUEZ ICI ! Double-tap !",
              audioCue: "Sleek keyboard tap SFX and subscription bell ring"
            }
          ];

      res.json({
        title: `Script: ${topic || "Nouveau Concept"}`,
        brandVoiceApplied: brandVoice || "Voix de marque par défaut",
        formatType: targetPlatform || "Shorts/TikTok (9:16)",
        overallMood: tone || "Élastique et dynamique",
        scenes: dummyScenes,
        isSimulated: true,
        warning: `Clé API en surcapacité : ${realApiErr.message || "RESOURCE_EXHAUSTED"}. Mode simulation interactive actif.`
      });
    }
  } catch (error: any) {
    console.error("Script generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate script" });
  }
});

// 2. Storyboard Image Generation (Image-to-Video initiation base or visual drafting)
app.post("/api/generate-scene-image", async (req, res) => {
  try {
    const { prompt, aspectRatio } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    if (!isGeminiConfigured()) {
      return res.status(200).json({
        simulated: true,
        imageUrl: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80` // beautiful generic fluid abstract
      });
    }

    try {
      const ai = getGenAI();
      let geminiAspectRatio = "1:1";
      if (aspectRatio === "9:16") geminiAspectRatio = "9:16";
      else if (aspectRatio === "16:9") geminiAspectRatio = "16:9";

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: geminiAspectRatio as any,
            imageSize: "1K"
          }
        }
      });

      let imageUrl = "";
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!imageUrl) {
        throw new Error("No image was returned from the generator model.");
      }

      res.json({ imageUrl, simulated: false });
    } catch (imageErr: any) {
      console.warn("Real image generation failed (e.g. rate limit, quota). Auto-falling back to robust abstract stock simulation image:", imageErr.message || imageErr);
      res.json({
        simulated: true,
        imageUrl: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80`,
        warning: `Limite de quota image active : ${imageErr.message || "quota épuisé"}. Utilisation de l'aperçu simulé.`
      });
    }
  } catch (error: any) {
    console.error("Image generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate storyboard preview" });
  }
});

// 3. Real Veo / Simulated Video Generation Start (POST)
app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt, aspectRatio, simulate } = req.body;

    if (simulate || !isGeminiConfigured()) {
      const opId = createSimulatedOpId(prompt);
      return res.json({ operationName: `models/veo-3.1-lite-generate-preview/operations/${opId}`, isSimulated: true });
    }

    try {
      const ai = getGenAI();
      const config: any = {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: aspectRatio === "9:16" ? "9:16" : "16:9"
      };

      const operation = await ai.models.generateVideos({
        model: "veo-3.1-lite-generate-preview",
        prompt: prompt || "A cinematic scenic flow",
        config
      });

      res.json({ operationName: operation.name, isSimulated: false });
    } catch (veoError: any) {
      console.warn("Real Veo generation failed:", veoError.message);
      const opId = createSimulatedOpId(prompt);
      res.json({ 
        operationName: `models/veo-3.1-lite-generate-preview/operations/${opId}`, 
        isSimulated: true,
        warning: `Mode simulation activé suite à une erreur API.`
      });
    }
  } catch (error: any) {
    console.error("Veo video initiate error:", error);
    res.status(500).json({ error: error.message || "Failed to start Veo video generation" });
  }
});

// 4. Video Polling Status
app.post("/api/video-status", async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: "operationName is required" });
    }

    // Check if simulated
    if (operationName.includes("/operations/sim-")) {
      const match = operationName.match(/\/operations\/(sim-\w+-\w+)/);
      const opId = match ? match[1] : "";
      const parsed = parseSimulatedOpId(opId);
      
      if (!parsed) {
        return res.json({ done: true, progress: 100, error: "Invalid simulated operation" });
      }

      const elapsed = Date.now() - parsed.timestamp;
      const progress = Math.min(100, Math.floor((elapsed / 20000) * 100)); // 20 seconds simulation

      return res.json({ done: progress >= 100, progress });
    }

    try {
      const ai = getGenAI();
      const updated = await ai.operations.get(operationName);
      res.json({ done: updated.done, response: updated.response });
    } catch (pollError: any) {
      console.warn("Polling error:", pollError.message);
      res.json({ 
        done: true, 
        isSimulated: true,
        warning: `Erreur d'interrogation API. Affichage de la simulation.`
      });
    }
  } catch (error: any) {
    console.error("Polling error:", error);
    res.status(500).json({ error: error.message || "Failed to poll operation status" });
  }
});

// 5. Video Download (supports both GET and POST)
app.all("/api/video-download", async (req, res) => {
  try {
    const operationName = (req.method === "GET" ? req.query.operationName : req.body.operationName) as string;
    if (!operationName) {
      return res.status(400).json({ error: "operationName is required" });
    }

    if (operationName.includes("/operations/sim-")) {
      const match = operationName.match(/\/operations\/(sim-\w+-\w+)/);
      const opId = match ? match[1] : "";
      
      const fallbackVideos = [
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
      ];
      
      const hash = opId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const videoUrl = fallbackVideos[hash % fallbackVideos.length];

      async function fetchVideoAsBuffer(url: string): Promise<{ buf: Buffer; contentType: string }> {
        const headers = { "User-Agent": "Mozilla/5.0", "Accept": "*/*" };
        const vres = await fetch(url, { headers });
        if (vres.ok) {
          const ab = await vres.arrayBuffer();
          return { buf: Buffer.from(ab), contentType: vres.headers.get("Content-Type") || "video/mp4" };
        }
        throw new Error("Failed to fetch simulation video.");
      }

      try {
        const { buf, contentType } = await fetchVideoAsBuffer(videoUrl);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", buf.length);
        res.send(buf);
        return;
      } catch (streamErr) {
        res.status(500).json({ error: "Failed to load simulation video." });
        return;
      }
    }

    const ai = getGenAI();
    const updated = await ai.operations.get(operationName);
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    
    if (!uri) {
      return res.status(404).json({ error: "Video uri not found yet." });
    }

    const videoRes = await fetch(uri, {
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY || "" }
    });

    if (!videoRes.ok) {
      return res.status(videoRes.status).json({ error: "Failed to fetch video from API." });
    }

    const ab = await videoRes.arrayBuffer();
    const buf = Buffer.from(ab);

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
    return;
  } catch (error: any) {
    console.error("Video download error:", error);
    res.status(500).json({ error: error.message || "Failed to download video" });
  }
});

// Serve static assets and mount Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Social Video Studio Server] running on http://0.0.0.0:${PORT}`);
  });
}

// Only start the server if not running on Vercel
if (!process.env.VERCEL) {
  startServer();
}

export default app;
