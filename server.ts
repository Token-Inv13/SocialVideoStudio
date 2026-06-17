import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, GenerateVideosOperation, Type } from "@google/genai";

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
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Keep a simple in-memory simulation state for polling when sandbox mode is active
interface SimulatedOperation {
  id: string;
  sceneId: string;
  visualPrompt: string;
  aspectRatio: string;
  progress: number;
}
const simulatedOperations: Record<string, SimulatedOperation> = {};

// Helper to determine if we can make actual AI calls
function isGeminiConfigured() {
  return !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
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
    const { prompt, aspectRatio, sceneId, referenceImage, simulate } = req.body;

    const opId = `op-${Math.random().toString(36).substr(2, 9)}`;

    if (simulate || !isGeminiConfigured()) {
      // Store a simulated operation progress monitor
      simulatedOperations[opId] = {
        id: opId,
        sceneId: sceneId || "generic-scene",
        visualPrompt: prompt || "Abstract particles in visual stream",
        aspectRatio: aspectRatio || "16:9",
        progress: 0
      };

      return res.json({ operationName: `models/veo-3.1-lite-generate-preview/operations/${opId}`, isSimulated: true });
    }

    try {
      // Real API Call with @google/genai as documented in Veo Guidelines
      const ai = getGenAI();
      
      let resolution = "720p"; // default lite supports up to 1080p but 720p is fast !
      
      const config: any = {
        numberOfVideos: 1,
        resolution,
        aspectRatio: aspectRatio === "9:16" ? "9:16" : "16:9"
      };

      let operation;

      if (referenceImage) {
        // Image-to-Video Workflow
        const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          operation = await ai.models.generateVideos({
            model: "veo-3.1-lite-generate-preview",
            prompt: prompt || "Bring this scene to life with natural cinematic fluid motion",
            image: {
              imageBytes: match[2],
              mimeType: match[1]
            },
            config
          });
        } else {
          throw new Error("Invalid reference image format. Must be base64 data URI.");
        }
      } else {
        // Text-to-Video Workflow
        operation = await ai.models.generateVideos({
          model: "veo-3.1-lite-generate-preview",
          prompt: prompt || "A cinematic scenic flow",
          config
        });
      }

      res.json({ operationName: operation.name, isSimulated: false });
    } catch (veoError: any) {
      console.warn("Real Veo generation failed (e.g. Quota/rate-limit error). Auto-falling back to resilient simulation mode:", veoError.message || veoError);
      
      simulatedOperations[opId] = {
        id: opId,
        sceneId: sceneId || "generic-scene",
        visualPrompt: prompt || "Abstract particles in visual stream",
        aspectRatio: aspectRatio || "16:9",
        progress: 0
      };

      res.json({ 
        operationName: `models/veo-3.1-lite-generate-preview/operations/${opId}`, 
        isSimulated: true,
        warning: `Limite de quota Veo ou sature-limit active : ${veoError.message || "quota épuisé"}. Passage automatique en simulation de rendu.`
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
    if (operationName.includes("/operations/op-")) {
      const match = operationName.match(/\/operations\/(op-\w+)/);
      const opId = match ? match[1] : "";
      const sOp = simulatedOperations[opId];
      if (!sOp) {
        return res.json({ done: true, progress: 100, error: "Operation not found" });
      }

      sOp.progress += 25; // simulate progress incremental increases
      if (sOp.progress >= 100) {
        sOp.progress = 100;
        return res.json({ done: true, progress: 100 });
      }

      return res.json({ done: false, progress: sOp.progress });
    }

    try {
      // Real API polling
      const ai = getGenAI();
      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      
      // Veo does not supply fractional progress but we can state done/pending
      res.json({ done: updated.done, response: updated.response });
    } catch (pollError: any) {
      console.warn("Polling real operation failed (e.g. Rate limit or quota error while waiting for Veo). Auto-simulating complete state:", pollError.message || pollError);
      res.json({ 
        done: true, 
        isSimulated: true,
        warning: `Erreur d'interrogation API : ${pollError.message || "quota épuisé"}. Rendu simulé finalisé.`
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

    // Handle simulation fallback stream or link with high-quality theme-derived video routing
    if (operationName.includes("/operations/op-")) {
      const match = operationName.match(/\/operations\/(op-\w+)/);
      const opId = match ? match[1] : "";
      const sOp = simulatedOperations[opId];
      
      const fallbackVideos = [
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4"
      ];
      
      let videoUrl = fallbackVideos[0];
      if (opId.includes("fun")) {
        videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4";
      } else if (opId.includes("joy")) {
        videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";
      } else if (opId.includes("blaze")) {
        videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
      } else if (opId.includes("escape")) {
        videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4";
      } else if (sOp && sOp.visualPrompt) {
        const text = sOp.visualPrompt.toLowerCase();
        if (text.includes("car") || text.includes("vehicle") || text.includes("road") || text.includes("drive") || text.includes("street")) {
          videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4";
        } else if (text.includes("fire") || text.includes("burn") || text.includes("hot") || text.includes("neon") || text.includes("circuit") || text.includes("glow")) {
          videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
        } else if (text.includes("escape") || text.includes("nature") || text.includes("rain") || text.includes("green") || text.includes("forest")) {
          videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4";
        } else if (text.includes("tech") || text.includes("robot") || text.includes("code") || text.includes("smart") || text.includes("cyber")) {
          videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4";
        } else if (text.includes("joy") || text.includes("sunset") || text.includes("happy") || text.includes("gold") || text.includes("apartment")) {
          videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";
        } else {
          // Semi-random deterministic mapping so each scene index stays unique
          const hash = opId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
          videoUrl = fallbackVideos[hash % fallbackVideos.length];
        }
      } else {
        const hash = opId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        videoUrl = fallbackVideos[hash % fallbackVideos.length];
      }
      // Helper function to robustly download video files, with user agent headers and secure fallbacks
      async function fetchVideoAsBuffer(url: string): Promise<{ buf: Buffer; contentType: string }> {
        const headers = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*"
        };
        try {
          const vres = await fetch(url, { headers });
          if (vres.ok) {
            const ab = await vres.arrayBuffer();
            return { buf: Buffer.from(ab), contentType: vres.headers.get("Content-Type") || "video/mp4" };
          }
          console.warn(`Fetch to standard GCS URL returned status ${vres.status} for ${url}`);
        } catch (err) {
          console.error(`Fetch failed for standard GCS URL: ${url}`, err);
        }

        // Extremely reliable public backup streams for development sandbox simulation
        const backups = [
          "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
          "https://www.w3schools.com/html/movie.mp4",
          "https://www.w3schools.com/html/mov_bbb.mp4"
        ];
        for (const bUrl of backups) {
          try {
            console.log(`Trying fallback backup stream URL: ${bUrl}`);
            const vres = await fetch(bUrl, { headers });
            if (vres.ok) {
              const ab = await vres.arrayBuffer();
              return { buf: Buffer.from(ab), contentType: vres.headers.get("Content-Type") || "video/mp4" };
            }
          } catch (err) {
            console.error(`Backup fetch failed for ${bUrl}:`, err);
          }
        }
        throw new Error("All public simulation video fetch URL endpoints failed.");
      }

      // Instead of returning res.redirect directly, which can trigger iframe sandbox and CORS blocks (ReferenceError for WritableStream),
      // we stream the content on the server side under the same local origin for seamless playback and downloads.
      try {
        const { buf, contentType } = await fetchVideoAsBuffer(videoUrl);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", buf.length);
        if (req.query.download === "true") {
          res.setHeader("Content-Disposition", `attachment; filename="scene_${opId || "video"}.mp4"`);
        }
        res.send(buf);
        return;
      } catch (streamErr) {
        console.error("Streaming/buffer error for simulation video:", streamErr);
        res.status(500).json({ error: "Failed to load simulation video files." });
        return;
      }
    }

    const ai = getGenAI();
    const op = new GenerateVideosOperation();
    op.name = operationName;
    
    const updated = await ai.operations.getVideosOperation({ operation: op });
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    
    if (!uri) {
      return res.status(404).json({ error: "Video uri not found yet. Is generation done?" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const videoRes = await fetch(uri, {
      headers: { "x-goog-api-key": apiKey || "" }
    });

    if (!videoRes.ok) {
      return res.status(videoRes.status).json({ error: `Failed to fetch video from Veo API: ${videoRes.statusText}` });
    }

    const ab = await videoRes.arrayBuffer();
    const buf = Buffer.from(ab);

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", buf.length);
    if (req.query.download === "true") {
      res.setHeader("Content-Disposition", `attachment; filename="veo_compiled_video.mp4"`);
    }

    res.send(buf);
    return;
  } catch (error: any) {
    console.error("Video download streaming error:", error);
    res.status(500).json({ error: error.message || "Failed to download/stream Veo video file" });
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
