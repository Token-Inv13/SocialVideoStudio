import express from "express";
import { randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { spawn } from "child_process";
import dotenv from "dotenv";
import { GenerateVideosOperation, GoogleGenAI, Type } from "@google/genai";
import { put } from "@vercel/blob";
import ffmpegPath from "ffmpeg-static";

dotenv.config();

const app = express();
const SANDBOX_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";
const SCRIPT_MODEL = "gemini-2.5-flash";
const simulatedOperations = new Map<string, { readyAt: number }>();
const assembledArtifacts = new Map<
  string,
  { buffer: Buffer; createdAt: number; filename: string }
>();
const ASSEMBLED_ARTIFACT_TTL_MS = 30 * 60 * 1000;
const VEO_QUOTA_COOLDOWN_MS = 5 * 60 * 1000;
let veoQuotaBlockedUntil = 0;

app.use(express.json({ limit: "50mb" }));

type AssembleClipSource = {
  operationName?: string;
  videoUrl?: string;
  sceneId?: string;
};

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

function normalizeVeoDurationSeconds(durationSeconds: unknown) {
  // The current Veo 3.1 preview endpoint rejects some nominally valid values
  // below 8 seconds. Use the stable accepted duration to avoid partial renders.
  return 8;
}

function isVeoQuotaError(error: any) {
  return error?.status === 429 || /RESOURCE_EXHAUSTED|quota|429/i.test(error?.message || "");
}

function getVeoQuotaRetryAfterSeconds() {
  return Math.max(1, Math.ceil((veoQuotaBlockedUntil - Date.now()) / 1000));
}

function createVideoOperationHandle(operationName: string) {
  const operation = new GenerateVideosOperation();
  operation.name = operationName;
  return operation;
}

function cleanupAssembledArtifacts() {
  const now = Date.now();
  for (const [artifactId, artifact] of assembledArtifacts.entries()) {
    if (now - artifact.createdAt > ASSEMBLED_ARTIFACT_TTL_MS) {
      assembledArtifacts.delete(artifactId);
    }
  }
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
                uri: SANDBOX_VIDEO_URL,
              },
            },
          ],
        }
      : undefined,
  };
}

function isDemoOperationName(operationName: string) {
  return (
    operationName.startsWith("/operations/op-demo-") ||
    operationName === "/operations/op-compiled-film"
  );
}

function getSafeFilename(baseName: string) {
  const normalized = baseName
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  return normalized || "social-video-studio";
}

function getFfmpegBinaryPath() {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static binary is unavailable in this environment.");
  }
  return ffmpegPath;
}

async function fetchVideoBufferFromRemote(url: string, headers?: Record<string, string>) {
  const videoRes = await fetch(url, headers ? { headers } : undefined);
  if (!videoRes.ok) {
    throw new Error(`Failed to fetch remote video asset (${videoRes.status}).`);
  }

  const ab = await videoRes.arrayBuffer();
  return Buffer.from(ab);
}

async function downloadOperationVideo(operationName: string) {
  if (simulatedOperations.has(operationName) || isDemoOperationName(operationName)) {
    return fetchVideoBufferFromRemote(SANDBOX_VIDEO_URL);
  }

  const ai = getGenAI();
  const updated = await ai.operations.getVideosOperation({
    operation: createVideoOperationHandle(operationName),
  });
  const uri = updated.response?.generatedVideos?.[0]?.video?.uri;

  if (!uri) {
    throw new Error(`Video uri not found for operation ${operationName}.`);
  }

  return fetchVideoBufferFromRemote(uri, {
    "x-goog-api-key": process.env.GEMINI_API_KEY || "",
  });
}

function extractOperationNameFromVideoUrl(videoUrl: string) {
  try {
    const parsed = new URL(videoUrl, "https://social-video-studio.local");
    if (!parsed.pathname.includes("/api/video-download")) {
      return null;
    }
    return parsed.searchParams.get("operationName");
  } catch {
    return null;
  }
}

async function downloadClipSource(source: AssembleClipSource) {
  if (source.operationName) {
    return downloadOperationVideo(source.operationName);
  }

  if (!source.videoUrl) {
    throw new Error("Each clip must include either operationName or videoUrl.");
  }

  const maybeOperationName = extractOperationNameFromVideoUrl(source.videoUrl);
  if (maybeOperationName) {
    return downloadOperationVideo(maybeOperationName);
  }

  if (/^https?:\/\//i.test(source.videoUrl)) {
    return fetchVideoBufferFromRemote(source.videoUrl);
  }

  throw new Error(`Unsupported clip source: ${source.videoUrl}`);
}

async function runFfmpegConcat(inputPaths: string[], outputPath: string) {
  const ffmpegBinary = getFfmpegBinaryPath();
  const workingDir = path.dirname(outputPath);
  const concatListPath = path.join(workingDir, "concat.txt");
  const concatManifest = inputPaths
    .map((inputPath) => `file '${inputPath.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
    .join("\n");

  await writeFile(concatListPath, concatManifest, "utf8");

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(
      ffmpegBinary,
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-an",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      {
        cwd: workingDir,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on("error", (error) => {
      reject(error);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

async function persistAssembledVideo(buffer: Buffer, title?: string) {
  const filename = `${getSafeFilename(title || "vgen-final-video")}.mp4`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`assembled/${filename}`, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: "video/mp4",
    });

    return {
      videoUrl: blob.url,
      storage: "blob" as const,
      filename,
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is required in production to store the assembled final video."
    );
  }

  cleanupAssembledArtifacts();
  const artifactId = randomUUID();
  assembledArtifacts.set(artifactId, {
    buffer,
    createdAt: Date.now(),
    filename,
  });

  return {
    videoUrl: `/api/assembled-video/${artifactId}`,
    storage: "memory" as const,
    filename,
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
      hasReferenceImage: Boolean(referenceImage),
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
- If format is "YouTube (16:9)", structure the narrative as a compelling 3-act story (Introduction/Hook, Deep Dive/Conflict, Resolution/Outro).
- Google Veo requires every individual scene duration to be between 4 and 8 seconds, inclusive. Never output a scene duration below 4 or above 8.
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
            data: match[2],
          },
        });
      }
    }

    if (diagMode === "simple") {
      stage = "call_gemini_simple";
      const simpleResponse = await ai.models.generateContent({
        model: SCRIPT_MODEL,
        contents: "Reply with the single word OK.",
      });
      return res.json({
        ok: true,
        stage: "simple",
        text: simpleResponse.text,
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
                  audioCue: { type: Type.STRING },
                },
                required: ["id", "duration", "visualPrompt", "narration", "cameraMovement", "textOverlay", "audioCue"],
              },
            },
          },
          required: ["title", "brandVoiceApplied", "formatType", "overallMood", "scenes"],
        },
      },
    });

    stage = "parse_response";
    const data = JSON.parse(response.text || "{}");
    console.log("[generate-script] response parsed", {
      hasText: Boolean(response.text),
      sceneCount: Array.isArray(data?.scenes) ? data.scenes.length : 0,
    });
    res.json(data);
  } catch (error: any) {
    console.error("[generate-script] failed", {
      stage,
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({
      error: error?.message || "Failed to generate script",
      stage,
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
        numberOfImages: 1,
      },
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

    if (Date.now() < veoQuotaBlockedUntil) {
      const retryAfterSeconds = getVeoQuotaRetryAfterSeconds();
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: `Quota Gemini/Veo temporairement atteint. Reessayez dans environ ${retryAfterSeconds}s.`,
        retryAfterSeconds,
      });
    }

    const ai = getGenAI();
    let image;
    if (referenceImage) {
      const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        image = {
          mimeType: match[1],
          imageBytes: match[2],
        } as any;
      }
    }

    const config: any = {
      numberOfVideos: 1,
      resolution: "720p",
      aspectRatio: aspectRatio === "9:16" ? "9:16" : "16:9",
    };
    config.durationSeconds = normalizeVeoDurationSeconds(durationSeconds);

    const operation = await ai.models.generateVideos({
      model: model || "veo-3.1-lite-generate-preview",
      prompt: prompt || "A cinematic scenic flow",
      image,
      config,
    });

    res.json({
      operationName: operation.name,
      durationSeconds: config.durationSeconds,
    });
  } catch (error: any) {
    console.error("Veo video initiate error:", error);
    if (isVeoQuotaError(error)) {
      veoQuotaBlockedUntil = Date.now() + VEO_QUOTA_COOLDOWN_MS;
      const retryAfterSeconds = getVeoQuotaRetryAfterSeconds();
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: `Quota Gemini/Veo atteint par Google. Reessayez dans environ ${retryAfterSeconds}s.`,
        retryAfterSeconds,
      });
    }
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
      operation: createVideoOperationHandle(operationName),
    });
    res.json({ done: updated.done, response: updated.response });
  } catch (error: any) {
    console.error("Polling error:", error);
    res.status(500).json({ error: error.message || "Failed to poll operation status" });
  }
});

app.post("/api/assemble-video", async (req, res) => {
  const tempDir = path.join(tmpdir(), `social-video-studio-${randomUUID()}`);

  try {
    const clips = Array.isArray(req.body?.clips) ? (req.body.clips as AssembleClipSource[]) : [];
    const title =
      typeof req.body?.title === "string" && req.body.title.trim()
        ? req.body.title
        : "social-video-studio-final";

    if (clips.length === 0) {
      return res.status(400).json({ error: "clips must contain at least one source." });
    }

    console.log("[assemble-video] start", {
      clipCount: clips.length,
      title,
      hasBlobStorage: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    });

    await mkdir(tempDir, { recursive: true });

    const inputPaths: string[] = [];
    for (let index = 0; index < clips.length; index += 1) {
      const buffer = await downloadClipSource(clips[index]);
      const inputPath = path.join(tempDir, `scene-${String(index + 1).padStart(2, "0")}.mp4`);
      await writeFile(inputPath, buffer);
      inputPaths.push(inputPath);
    }

    const outputPath = path.join(tempDir, "assembled-final.mp4");
    await runFfmpegConcat(inputPaths, outputPath);

    const outputBuffer = await readFile(outputPath);
    const storedVideo = await persistAssembledVideo(outputBuffer, title);

    res.json({
      ok: true,
      clipCount: clips.length,
      filename: storedVideo.filename,
      storage: storedVideo.storage,
      videoUrl: storedVideo.videoUrl,
    });
  } catch (error: any) {
    console.error("[assemble-video] failed", {
      message: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({
      error: error?.message || "Failed to assemble final video.",
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
});

app.get("/api/assembled-video/:artifactId", (req, res) => {
  cleanupAssembledArtifacts();
  const artifact = assembledArtifacts.get(req.params.artifactId);
  if (!artifact) {
    return res.status(404).json({ error: "Assembled video not found or expired." });
  }

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Length", artifact.buffer.length);
  res.setHeader("Content-Disposition", `inline; filename="${artifact.filename}"`);
  res.send(artifact.buffer);
});

app.all("/api/video-download", async (req, res) => {
  try {
    const operationName = (req.method === "GET" || req.method === "HEAD"
      ? req.query.operationName
      : req.body.operationName) as string;
    if (!operationName) {
      return res.status(400).json({ error: "operationName is required" });
    }

    const buffer = await downloadOperationVideo(operationName);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (error: any) {
    console.error("Video download error:", error);
    res.status(500).json({ error: error.message || "Failed to download video" });
  }
});

export default app;
