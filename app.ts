import express from "express";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const SANDBOX_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";
const SCRIPT_MODEL = "gemini-2.5-flash";
const simulatedOperations = new Map<string, { readyAt: number }>();

app.use(express.json({ limit: "50mb" }));

let aiInstance: GoogleGenAI | null = null;
function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: key,
    });
  }
  return aiInstance;
}

function createSimulatedVideoOperation(durationSeconds?: number) {
  const operationName = `/operations/mock-${randomUUID()}`;
  const readyDelay = Math.max(2500, Math.min(12000, (durationSeconds ?? 8) * 600));
  simulatedOperations.set(operationName, { readyAt: Date.now() + readyDelay });
  return operationName;
}

function getSimulatedVideoStatus(operationName: string) {
  const record = simulatedOperations.get(operationName);
  if (!record) return null;

  const done = Date.now() >= record.readyAt;
  return {
    done,
    response: done
      ? {
          generatedVideos: [
            {
              video: {
                uri: SANDBOX_VIDEO_URL
              }
            }
          ]
        }
      : undefined
  };
}

app.post("/api/generate-script", async (req, res) => {
  let stage = "init";
  try {
    stage = "parse_request";
    const diagMode =
      typeof req.query.diag === "string" ? req.query.diag : undefined;
    const { topic, contentType, targetPlatform, tone, brandVoice, referenceImage } = req.body;
    console.log("[generate-script] request received", {
      diagMode,
      hasTopic: Boolean(topic),
      contentType,
      targetPlatform,
      tone,
      hasBrandVoice: Boolean(brandVoice),
      hasReferenceImage: Boolean(referenceImage)
    });

    if (diagMode === "echo") {
      return res.json({ ok: true, stage: "echo" });
    }

    stage = "build_prompt";
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

    stage = "init_client";
    const ai = getGenAI();

    if (diagMode === "client") {
      return res.json({ ok: true, stage: "client" });
    }

    const contents: any[] = [basePrompt];

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

    if (diagMode === "simple") {
      stage = "call_gemini_simple";
      const simpleResponse = await ai.models.generateContent({
        model: SCRIPT_MODEL,
        contents: "Reply with the single word OK."
      });
      return res.json({
        ok: true,
        stage: "simple",
        text: simpleResponse.text
      });
    }

    stage = "call_gemini";
    const response = await ai.models.generateContent({
      model: SCRIPT_MODEL,
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
                  duration: { type: Type.INTEGER },
                  visualPrompt: { type: Type.STRING },
                  narration: { type: Type.STRING },
                  cameraMovement: { type: Type.STRING },
                  textOverlay: { type: Type.STRING },
                  audioCue: { type: Type.STRING }
                },
                required: ["id", "duration", "visualPrompt", "narration", "cameraMovement", "textOverlay", "audioCue"]
              }
            }
          },
          required: ["title", "brandVoiceApplied", "formatType", "overallMood", "scenes"]
        }
      }
    });

    stage = "parse_response";
    const data = JSON.parse(response.text || "{}");
    console.log("[generate-script] response parsed", {
      hasText: Boolean(response.text),
      sceneCount: Array.isArray(data?.scenes) ? data.scenes.length : 0
    });
    res.json(data);
  } catch (error: any) {
    console.error("[generate-script] failed", {
      stage,
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
    res.status(500).json({
      error: error?.message || "Failed to generate script",
      stage
    });
  }
});

app.post("/api/generate-scene-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const ai = getGenAI();
    const response = await ai.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt,
      config: {
        numberOfImages: 1
      }
    });

    const generatedImage = response.generatedImages?.[0]?.image;
    const imageUrl = generatedImage?.imageBytes
      ? `data:${generatedImage.mimeType || "image/png"};base64,${generatedImage.imageBytes}`
      : "";

    if (!imageUrl) {
      throw new Error("No image was returned from the generator model.");
    }

    res.json({ imageUrl });
  } catch (error: any) {
    console.error("Image generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate storyboard preview" });
  }
});

app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt, aspectRatio, model, referenceImage, durationSeconds, simulate } = req.body;

    if (simulate) {
      return res.json({ operationName: createSimulatedVideoOperation(durationSeconds) });
    }

    const ai = getGenAI();
    let image;
    if (referenceImage) {
      const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        image = {
          mimeType: match[1],
          imageBytes: match[2]
        } as any;
      }
    }

    const config: any = {
      numberOfVideos: 1,
      resolution: "720p",
      aspectRatio: aspectRatio === "9:16" ? "9:16" : "16:9"
    };
    if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
      config.durationSeconds = durationSeconds;
    }

    const operation = await ai.models.generateVideos({
      model: model || "veo-3.1-lite-generate-preview",
      prompt: prompt || "A cinematic scenic flow",
      image,
      config
    });

    res.json({ operationName: operation.name });
  } catch (error: any) {
    console.error("Veo video initiate error:", error);
    res.status(500).json({ error: error.message || "Failed to start Veo video generation" });
  }
});

app.post("/api/video-status", async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: "operationName is required" });
    }

    const simulated = getSimulatedVideoStatus(operationName);
    if (simulated) {
      return res.json(simulated);
    }

    const ai = getGenAI();
    const updated = await ai.operations.getVideosOperation({
      operation: { name: operationName } as any
    });
    res.json({ done: updated.done, response: updated.response });
  } catch (error: any) {
    console.error("Polling error:", error);
    res.status(500).json({ error: error.message || "Failed to poll operation status" });
  }
});

app.all("/api/video-download", async (req, res) => {
  try {
    const operationName = (req.method === "GET" ? req.query.operationName : req.body.operationName) as string;
    if (!operationName) {
      return res.status(400).json({ error: "operationName is required" });
    }

    if (simulatedOperations.has(operationName)) {
      return res.redirect(302, SANDBOX_VIDEO_URL);
    }

    const ai = getGenAI();
    const updated = await ai.operations.getVideosOperation({
      operation: { name: operationName } as any
    });
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;

    if (!uri) {
      if (
        operationName.startsWith("/operations/op-demo-") ||
        operationName === "/operations/op-compiled-film"
      ) {
        return res.redirect(302, SANDBOX_VIDEO_URL);
      }
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
  } catch (error: any) {
    console.error("Video download error:", error);
    res.status(500).json({ error: error.message || "Failed to download video" });
  }
});

export default app;
