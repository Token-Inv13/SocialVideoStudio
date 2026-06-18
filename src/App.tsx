import { useState, useRef, useEffect, DragEvent } from "react";
import {
  Sparkles,
  Play,
  Pause,
  Layers,
  Check,
  Video,
  Monitor,
  Smartphone,
  Sliders,
  Cpu,
  Coins,
  UploadCloud,
  AlertCircle,
  Music,
  Tv,
  Eye,
  Download,
  Flame,
  ArrowRight,
  User,
  Activity,
  Maximize2,
  Trash2,
  FileText,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { ContentType, TargetPlatform, ToneType, BrandConfig, VideoScript, ScriptScene } from "./types";
import { STORYBOARD_JSON_SCHEMA, MOCK_MARKETING_STORYBOARD_JSON_INSTANCE } from "./contractData";

export default function App() {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState<"studio" | "contract">("studio");

  // User Mode vs Advanced Mode complexity state selector
  const [sidebarMode, setSidebarMode] = useState<"simple" | "expert">("simple");
  
  // Accordion active state trackers (For granular controls)
  const [isBrandAccordionOpen, setIsBrandAccordionOpen] = useState<boolean>(false);
  const [isMediaAccordionOpen, setIsMediaAccordionOpen] = useState<boolean>(false);
  const [isEngineAccordionOpen, setIsEngineAccordionOpen] = useState<boolean>(false);
  const [isLogsAccordionOpen, setIsLogsAccordionOpen] = useState<boolean>(false);

  // Config state
  const [topic, setTopic] = useState("Le futur de la robotique humanoïde en 2026");
  const [contentType, setContentType] = useState<ContentType>("storytelling");
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>("shorts");
  const [tone, setTone] = useState<ToneType>("dynamic");
  const [brandName, setBrandName] = useState("TechPulse");
  const [brandStyle, setBrandStyle] = useState("Direct, fascinant, basé sur la science");

  // Reference image for Image-to-Video Workflow
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advanced generator parameters
  const [selectedModel, setSelectedModel] = useState("veo-3.1-lite-generate-preview");
  const [resolution, setResolution] = useState("720p");
  const [coherence, setCoherence] = useState(85);
  const [simulateInSandbox, setSimulateInSandbox] = useState(false);

  // App running states
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [script, setScript] = useState<VideoScript | null>(null);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);
  const [previewMode, setPreviewMode] = useState<"scene" | "final">("scene");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [renderProgress, setRenderProgress] = useState<Record<string, number>>({});
  const [activePollers, setActivePollers] = useState<Record<string, boolean>>({});
  const [assembledVideoUrl, setAssembledVideoUrl] = useState<string | null>(null);
  const [isAssemblingFinalVideo, setIsAssemblingFinalVideo] = useState(false);
  const [assemblyError, setAssemblyError] = useState<string | null>(null);

  // Error/Alert logs
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [operationLogs, setOperationLogs] = useState<string[]>([
    "ENGINE: VERTEX_MULTIMODAL_V4 initialisé",
    "Prêt pour la génération de scripts et vidéos"
  ]);

  // Handle auto-progress when playing mockup video
  useEffect(() => {
    let interval: any;
    if (isPlaying && script?.scenes[selectedSceneIndex]) {
      const activeScene = script.scenes[selectedSceneIndex];
      interval = setInterval(() => {
        setPlaybackTime((prev) => {
          if (prev >= activeScene.duration) {
            // Next scene loop
            if (selectedSceneIndex < script.scenes.length - 1) {
              setSelectedSceneIndex((idx) => idx + 1);
              return 0;
            } else {
              setIsPlaying(false);
              return 0;
            }
          }
          return prev + 0.1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, selectedSceneIndex, script]);

  // Reset clock when changing active scene
  useEffect(() => {
    setPlaybackTime(0);
  }, [selectedSceneIndex]);

  // Interactive Validation states
  const [valJsonInput, setValJsonInput] = useState(JSON.stringify(MOCK_MARKETING_STORYBOARD_JSON_INSTANCE, null, 2));
  const [valResult, setValResult] = useState<{ success: boolean; text: string } | null>(null);
  const projectCompletionAnnouncedRef = useRef(false);
  const assemblySignatureRef = useRef<string | null>(null);
  const totalSceneCount = script?.scenes.length ?? 0;
  const completedSceneCount = script?.scenes.filter((scene) => Boolean(scene.videoUrl)).length ?? 0;
  const failedSceneCount = script?.scenes.filter((scene) => Boolean(scene.error)).length ?? 0;
  const missingSceneCount =
    script?.scenes.filter((scene) => !scene.videoUrl && !scene.isGeneratingVideo).length ?? 0;
  const isProjectRendering = script?.scenes.some((scene) => scene.isGeneratingVideo) ?? false;
  const isProjectReady = totalSceneCount > 0 && completedSceneCount === totalSceneCount;
  const canRetryMissingScenes = Boolean(script?.scenes.some((scene) => !scene.videoUrl && !scene.isGeneratingVideo));
  const activeScene: ScriptScene | undefined = script?.scenes[selectedSceneIndex];
  const isFinalVideoReady = Boolean(assembledVideoUrl);
  const displayedVideoUrl =
    previewMode === "final" && assembledVideoUrl ? assembledVideoUrl : activeScene?.videoUrl;
  const finalVideoDownloadUrl = assembledVideoUrl ?? null;
  const readySceneDownloadUrl = script?.scenes[selectedSceneIndex]?.videoUrl
    ? `${script.scenes[selectedSceneIndex].videoUrl}&download=true`
    : null;

  const resetFinalAssemblyState = () => {
    setPreviewMode("scene");
    setAssembledVideoUrl(null);
    setAssemblyError(null);
    setIsAssemblingFinalVideo(false);
    assemblySignatureRef.current = null;
  };

  const getAssemblySignature = (targetScript: VideoScript) =>
    targetScript.scenes
      .map((scene) => scene.operationName || scene.videoUrl || scene.id)
      .join("|");

  const assembleProjectVideo = async (targetScript: VideoScript, forcedSignature?: string) => {
    const clips = targetScript.scenes
      .map((scene) => ({
        sceneId: scene.id,
        operationName: scene.operationName,
        videoUrl: scene.videoUrl,
      }))
      .filter((scene) => scene.operationName || scene.videoUrl);

    if (clips.length !== targetScript.scenes.length) {
      return;
    }

    const assemblySignature = forcedSignature || getAssemblySignature(targetScript);
    assemblySignatureRef.current = assemblySignature;
    setIsAssemblingFinalVideo(true);
    setAssemblyError(null);
    setPreviewMode("final");
    addLog(`Assemblage final en cours pour ${clips.length} clips...`);

    try {
      const response = await fetch("/api/assemble-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: targetScript.title,
          clips,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Assemble API returned error ${response.status}`);
      }

      setAssembledVideoUrl(data.videoUrl);
      setPreviewMode("final");
      addLog(`Vidéo finale prête (${data.storage === "blob" ? "stockée" : "session locale"}).`);
    } catch (err: any) {
      assemblySignatureRef.current = null;
      setAssemblyError(err.message);
      setPreviewMode("scene");
      addLog(`ERREUR assemblage final: ${err.message}`);
    } finally {
      setIsAssemblingFinalVideo(false);
    }
  };

  useEffect(() => {
    if (!script?.scenes.length) return;

    const activeScene = script.scenes[selectedSceneIndex];
    if (!activeScene?.videoUrl) {
      const firstReadySceneIndex = script.scenes.findIndex((scene) => Boolean(scene.videoUrl));
      if (firstReadySceneIndex >= 0 && firstReadySceneIndex !== selectedSceneIndex) {
        setSelectedSceneIndex(firstReadySceneIndex);
      }
    }

    const completedCount = script.scenes.filter((scene) => Boolean(scene.videoUrl)).length;
    const allScenesSettled = script.scenes.every((scene) => scene.videoUrl || scene.error);

    if (allScenesSettled && completedCount === script.scenes.length && !projectCompletionAnnouncedRef.current) {
      projectCompletionAnnouncedRef.current = true;
      addLog(
        simulateInSandbox
          ? "Projet terminé en mode sandbox. Les aperçus sont des clips de démonstration identiques par conception."
          : "Projet terminé. Tous les clips générés sont prêts au visionnage."
      );
    }
  }, [script, selectedSceneIndex, simulateInSandbox]);

  useEffect(() => {
    if (!script?.scenes.length) return;
    if (isAssemblingFinalVideo) return;
    if (!isProjectReady) return;
    if (script.scenes.some((scene) => scene.error)) return;

    const assemblySignature = getAssemblySignature(script);
    if (assemblySignatureRef.current === assemblySignature && (assembledVideoUrl || assemblyError)) {
      return;
    }

    void assembleProjectVideo(script, assemblySignature);
  }, [script, isAssemblingFinalVideo, isProjectReady, assembledVideoUrl, assemblyError]);

  const handleValidateJson = (inputStr: string) => {
    try {
      if (!inputStr.trim()) {
        setValResult({ success: false, text: "Veuillez entrer ou coller un document JSON à valider." });
        return;
      }
      const data = JSON.parse(inputStr);
      
      // Step 1: Validate metadata presence
      if (!data.metadata) {
        setValResult({ success: false, text: "Erreur de validation : Le champ obligatoire 'metadata' est manquant à la racine." });
        return;
      }
      const meta = data.metadata;
      if (!meta.title || !meta.aspect_ratio || !meta.global_stylistic_tone) {
        setValResult({ 
          success: false, 
          text: `Erreur de validation (metadata) : Les champs 'title', 'aspect_ratio' et 'global_stylistic_tone' sont requis.` 
        });
        return;
      }
      if (meta.aspect_ratio !== "9:16" && meta.aspect_ratio !== "16:9") {
        setValResult({ 
          success: false, 
          text: `Erreur de validation (metadata.aspect_ratio) : Format incorrect. Valeurs autorisées : '9:16' ou '16:9'. Trouvé : '${meta.aspect_ratio}'` 
        });
        return;
      }

      // Step 2: Validate scenes presence & array layout
      if (!data.scenes) {
        setValResult({ success: false, text: "Erreur de validation : Le tableau obligatoire 'scenes' est manquant à la racine." });
        return;
      }
      if (!Array.isArray(data.scenes)) {
        setValResult({ success: false, text: "Erreur de validation : Le champ 'scenes' doit être un tableau d'objets (Array)." });
        return;
      }
      if (data.scenes.length === 0) {
        setValResult({ success: false, text: "Erreur de validation : Le tableau 'scenes' doit contenir au moins 1 scène complète." });
        return;
      }

      // Step 3: Validate individual scenes
      for (let i = 0; i < data.scenes.length; i++) {
        const scene = data.scenes[i];
        const sceneNum = i + 1;
        const requiredFields = ["id", "visual_prompt", "voice_over_text", "duration", "audio_notes"];
        for (const field of requiredFields) {
          if (scene[field] === undefined || scene[field] === null) {
            setValResult({ 
              success: false, 
              text: `Erreur de validation (Scène #${sceneNum}) : Le champ obligatoire '${field}' est manquant.` 
            });
            return;
          }
        }
        
        // Validate duration
        if (typeof scene.duration !== "number" || scene.duration < 1) {
          setValResult({ 
            success: false, 
            text: `Erreur de validation (Scène #${sceneNum}) : Le champ 'duration' doit être un nombre supérieur ou égal à 1.` 
          });
          return;
        }

        // Validate scene ID format regex alphanumeric
        if (typeof scene.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(scene.id)) {
          setValResult({ 
            success: false, 
            text: `Erreur de validation (Scène #${sceneNum}) : L'identifiant 'id' ('${scene.id}') doit être alphanumérique sans espace (a-z, A-Z, 0-9, _, -).` 
          });
          return;
        }
      }

      setValResult({ 
        success: true, 
        text: "Succès ! Le fichier JSON respecte scrupuleusement le contrat d'architecture. Il est 100% conforme aux spécifications Google Veo." 
      });
    } catch (e: any) {
      setValResult({ success: false, text: `Erreur de syntaxe JSON : ${e.message}. Assurez-vous d'avoir utilisé des guillemets doubles corrects.` });
    }
  };

  // Logger helper
  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setOperationLogs((prev) => [`[${time}] ${message}`, ...prev.slice(0, 19)]);
  };

  const readApiError = async (response: Response, fallback: string) => {
    try {
      const data = await response.json();
      return data.error || fallback;
    } catch {
      return fallback;
    }
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const buildVideoRequestBody = (scene: ScriptScene, index: number) => ({
    prompt: scene.visualPrompt,
    aspectRatio: targetPlatform === "youtube" ? "16:9" : "9:16",
    model: selectedModel,
    durationSeconds: scene.duration,
    sceneId: scene.id,
    referenceImage: index === 0 ? referenceImage : null,
    simulate: simulateInSandbox
  });

  const requestSceneVideoOperation = async (scene: ScriptScene, index: number) => {
    const response = await fetch("/api/generate-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildVideoRequestBody(scene, index))
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, "Video generation request failed"));
    }

    return response.json() as Promise<{ operationName: string; durationSeconds?: number }>;
  };

  const requestSceneVideoOperationWithRetry = async (scene: ScriptScene, index: number) => {
    const maxAttempts = simulateInSandbox ? 1 : 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await requestSceneVideoOperation(scene, index);
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt >= maxAttempts) break;

        const isQuotaError = /429|quota|RESOURCE_EXHAUSTED/i.test(lastError.message);
        const retryDelayMs = isQuotaError ? 65000 * attempt : 3500 * attempt;
        addLog(
          `Tentative ${attempt}/${maxAttempts} Ã©chouÃ©e pour la ScÃ¨ne ${index + 1}. Nouvelle tentative dans ${Math.round(retryDelayMs / 1000)}s...`
        );
        await delay(retryDelayMs);
      }
    }

    throw lastError || new Error("Impossible d'initialiser le rendu vidÃ©o.");
  };

  const renderSceneVideo = async (
    index: number,
    scene: ScriptScene,
    options: { clearExistingVideo?: boolean; queued?: boolean } = {}
  ) => {
    setScript((prev) => {
      if (!prev) return null;
      const updated = [...prev.scenes];
      if (!updated[index]) return prev;
      updated[index] = {
        ...updated[index],
        isGeneratingVideo: true,
        error: undefined,
        isSimulated: simulateInSandbox,
        operationName: options.clearExistingVideo ? undefined : updated[index].operationName,
        renderedDuration: options.clearExistingVideo ? undefined : updated[index].renderedDuration,
        videoUrl: options.clearExistingVideo ? undefined : updated[index].videoUrl
      };
      return { ...prev, scenes: updated };
    });

    setRenderProgress((prev) => ({ ...prev, [scene.id]: options.queued ? 2 : 5 }));
    addLog(`Initialisation du rendu vidÃ©o Veo pour la ScÃ¨ne ${index + 1}...`);

    try {
      const resData = await requestSceneVideoOperationWithRetry(scene, index);
      const opName = resData.operationName;

      setScript((prev) => {
        if (!prev) return null;
        const updated = [...prev.scenes];
        if (!updated[index]) return prev;
        updated[index] = {
          ...updated[index],
          operationName: opName,
          renderedDuration: resData.durationSeconds,
          error: undefined
        };
        return { ...prev, scenes: updated };
      });

      return await startPollingVideo(scene.id, opName, index);
    } catch (err: any) {
      const message = err?.message || "Impossible de lancer le rendu de ce clip.";
      setScript((prev) => {
        if (!prev) return null;
        const updated = [...prev.scenes];
        if (!updated[index]) return prev;
        updated[index] = {
          ...updated[index],
          isGeneratingVideo: false,
          error: message
        };
        return { ...prev, scenes: updated };
      });
      addLog(`ERREUR d'initiation vidÃ©o ScÃ¨ne ${index + 1}: ${message}`);
      return false;
    }
  };

  // Image Upload handler
  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImage(reader.result as string);
      addLog(`Image de référence importée: ${file.name} (${Math.round(file.size / 1024)} KB)`);
    };
    reader.readAsDataURL(file);
  };

  // Drop image logic
  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const clearReferenceImage = () => {
    setReferenceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    addLog("Image de référence supprimée");
  };

  // 1. Script generation trigger (automates video generation immediately!)
  const generateScript = async () => {
    try {
      setIsGeneratingScript(true);
      setErrorStatus(null);
      projectCompletionAnnouncedRef.current = false;
      resetFinalAssemblyState();
      addLog(`Lancement de l'écriture intelligente du script: "${topic}"...`);

      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          contentType,
          targetPlatform,
          tone,
          brandVoice: `${brandName} (Style: ${brandStyle})`,
          referenceImage
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned error ${response.status}`);
      }

      const data: VideoScript = await response.json();
      const hydratedScript: VideoScript = {
        ...data,
        isSimulated: simulateInSandbox,
        scenes: data.scenes.map((scene) => ({
          ...scene,
          isSimulated: simulateInSandbox,
          videoUrl: undefined,
          operationName: undefined,
          error: undefined
        }))
      };
      setScript(hydratedScript);
      setSelectedSceneIndex(0);
      addLog(`Script généré avec succès ! Titre : "${hydratedScript.title}". Lancement automatique du rendu vidéo Google Veo...`);
      
      // Auto-initiate video generation for all scenes simultaneously
      generateAllVideos(hydratedScript);
    } catch (err: any) {
      console.error(err);
      setErrorStatus("Erreur lors de la génération du script. Assurez-vous que l'API key est valide.");
      addLog(`ERREUR de scriptage: ${err.message}`);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // 2. Scene storyboard frame generation (Image generation, kept for fallback)
  const generateSceneImage = async (index: number) => {
    if (!script) return;
    const scene = script.scenes[index];
    
    // Set UI generating state
    setScript((prev) => {
      if (!prev) return null;
      const updated = [...prev.scenes];
      updated[index] = { ...updated[index], isGeneratingImage: true, error: undefined };
      return { ...prev, scenes: updated };
    });
    addLog(`Génération d'un visuel de storyboard pour la Scène ${index + 1}...`);

    try {
      const response = await fetch("/api/generate-scene-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: scene.visualPrompt,
          aspectRatio: targetPlatform === "youtube" ? "16:9" : "9:16"
        })
      });

      if (!response.ok) throw new Error("Image API Error");
      const data = await response.json();

      setScript((prev) => {
        if (!prev) return null;
        const updated = [...prev.scenes];
        updated[index] = {
          ...updated[index],
          imageUrl: data.imageUrl,
          isGeneratingImage: false
        };
        return { ...prev, scenes: updated };
      });
      addLog(` storyboard Scène ${index + 1} créé.`);
    } catch (err: any) {
      setScript((prev) => {
        if (!prev) return null;
        const updated = [...prev.scenes];
        updated[index] = { ...updated[index], isGeneratingImage: false, error: err.message };
        return { ...prev, scenes: updated };
      });
      addLog(`ERREUR image Scène ${index + 1}: ${err.message}`);
    }
  };

  // 3. Initiate Video Generation for a single scene
  const generateSceneVideo = async (index: number) => {
    if (!script) return;
    const scene = script.scenes[index];
    resetFinalAssemblyState();
    await renderSceneVideo(index, scene, { clearExistingVideo: true });
  };
  // 4. Poller status check
  const startPollingVideo = (sceneId: string, opName: string, index: number) => {
    let currentProgress = 5;

    return new Promise<boolean>((resolve) => {
    const interval = setInterval(async () => {
      try {
        const check = await fetch("/api/video-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationName: opName })
        });

        if (!check.ok) {
          throw new Error(await readApiError(check, "Polling status error"));
        }

        const checkData = await check.json();

        if (checkData.done) {
          clearInterval(interval);
          setRenderProgress((prev) => ({ ...prev, [sceneId]: 100 }));
          
          // Re-fetch and update scene state with final simulated/real asset url with Cache Buster
          setScript((prevScript) => {
            if (!prevScript) return null;
            const updated = [...prevScript.scenes];
            
            // Resolve final video via the uniform downloading/proxying pipeline with cache-buster timestamp
            const finalVideoUrl = `/api/video-download?operationName=${encodeURIComponent(opName)}&t=${Date.now()}`;

            updated[index] = {
              ...updated[index],
              isGeneratingVideo: false,
              videoUrl: finalVideoUrl,
              error: undefined
            };
            return { ...prevScript, scenes: updated };
          });

          addLog(`Rendu vidéo de la Scène ${index + 1} complet et prêt au visionnage.`);
          resolve(true);
        } else {
          // Increment progress indicators mock-responsively or retrieve from server if supported
          currentProgress = Math.min(95, currentProgress + 15);
          setRenderProgress((prev) => ({ ...prev, [sceneId]: currentProgress }));
          addLog(`Génération vidéo Scène ${index + 1}: ${currentProgress}%`);
        }
      } catch (err: any) {
        clearInterval(interval);
        const message = err?.message || "La recuperation du flux video a rencontre une interruption.";
        addLog(`Erreur lors du suivi de rendu Scene ${index + 1}: ${message}`);
        setScript((prevScript) => {
          if (!prevScript) return null;
          const updated = [...prevScript.scenes];
          updated[index] = {
            ...updated[index],
            isGeneratingVideo: false,
            error: message
          };
          return { ...prevScript, scenes: updated };
        });
        resolve(false);
      }
    }, 2800);
    });
  };

  // 5. Autogenerate/Render all elements in sequence (All script content workflow)
  const generateAllVideos = async (targetScript: VideoScript) => {
    if (!targetScript || !targetScript.scenes) return;
    projectCompletionAnnouncedRef.current = false;
    resetFinalAssemblyState();
    addLog("Lancement simultané du rendu vidéo Veo pour l'ensemble des scènes...");

    // Set all scenes to generating state at once
    const updatedScenes = targetScript.scenes.map((scene) => ({
      ...scene,
      isGeneratingVideo: true,
      error: undefined,
      videoUrl: undefined,
      isSimulated: simulateInSandbox
    }));

    setScript({ ...targetScript, isSimulated: simulateInSandbox, scenes: updatedScenes });

    // Set initial progress bars
    const initialProgress: Record<string, number> = {};
    updatedScenes.forEach((scene) => {
      initialProgress[scene.id] = 5;
    });
    setRenderProgress(initialProgress);

    for (let i = 0; i < updatedScenes.length; i++) {
      const scene = updatedScenes[i];
      await renderSceneVideo(i, scene, { clearExistingVideo: true, queued: true });
      if (i < updatedScenes.length - 1) {
        await delay(simulateInSandbox ? 250 : 1500);
      }
    }
  };

  const generateMissingVideos = async () => {
    if (!script) return;
    const scenesToRender = script.scenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => !scene.videoUrl && !scene.isGeneratingVideo);

    if (!scenesToRender.length) return;

    projectCompletionAnnouncedRef.current = false;
    resetFinalAssemblyState();
    addLog(`Relance ciblee de ${scenesToRender.length} clip(s) manquant(s)...`);

    for (let i = 0; i < scenesToRender.length; i++) {
      const { scene, index } = scenesToRender[i];
      await renderSceneVideo(index, scene, { clearExistingVideo: true });
      if (i < scenesToRender.length - 1) {
        await delay(simulateInSandbox ? 250 : 1500);
      }
    }
  };

  // Demo auto loader helper so the screen is never uninspired
  const loadExampleScript = () => {
    resetFinalAssemblyState();
    const defaultData: VideoScript = {
      title: "Révolution Robotique 2026",
      brandVoiceApplied: "TechPulse (Direct, fascinant, basé sur la science)",
      formatType: "shorts",
      overallMood: "dynamic",
      isSimulated: true,
      scenes: [
        {
          id: "sc-1",
          duration: 5,
          visualPrompt: "Extreme close-up of a high-tech robotic hand with glowing neon teal circuitry pulsing. Cybernetic aesthetics, dramatic low-key studio lighting with dark shadows",
          narration: "En 2026, l'intelligence artificielle n'a plus seulement de jolis serveurs... Elle a un corps physique.",
          cameraMovement: "Macro slow pan revealing carbon fiber joints",
          textOverlay: "L'IA PHYSIQUE COMMENCE ICI",
          audioCue: "Deep sub-base swoop, electronic swell starting slow",
          isSimulated: true,
          videoUrl: "/api/video-download?operationName=/operations/op-demo-fun"
        },
        {
          id: "sc-2",
          duration: 6,
          visualPrompt: "A humanoid robot sitting in a modern high-rise glass apartment looking out at a raining city sunset. Soft volumetric golden sunset light reflecting on glass shelves",
          narration: "De la simple ligne de code aux assistants autonomes à domicile, les androïdes intègrent nos espaces de vie intimes.",
          cameraMovement: "Tracking shot, low-angle moving slowly right to left",
          textOverlay: "ASSISTANTS AUTONOMES 🤖",
          audioCue: "Synthesizer pad playing warm cinematic notes",
          isSimulated: true,
          videoUrl: "/api/video-download?operationName=/operations/op-demo-joyrides"
        },
        {
          id: "sc-3",
          duration: 7,
          visualPrompt: "Beautiful organic network of light particles flowing rapidly through glass optical fibers. Elegant abstract high contrast visualization",
          narration: "Mais à quel point sommes-nous prêts pour cette fusion technologique ? Êtes-vous prêt pour le bouleversement ?",
          cameraMovement: "Fast camera fly-through following the light streams",
          textOverlay: "LA GRANDE FUSION TECHNIQUE",
          audioCue: "Intense synth build-up, punchy beat drops",
          isSimulated: true,
          videoUrl: "/api/video-download?operationName=/operations/op-demo-blazes"
        }
      ]
    };
    setScript(defaultData);
    setSelectedSceneIndex(0);
    addLog("Exemple de production chargé dans l'espace de travail.");
  };

  return (
    <div id="app-root" className="bg-[#050505] text-zinc-300 font-sans min-h-screen flex flex-col overflow-hidden selection:bg-indigo-600 selection:text-white">
      {/* Header Navigation consistent with 'Sophisticated Dark' styling */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0a0a0a] shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Video className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white m-0">V-GEN <span className="text-indigo-400">PRO</span></h1>
              <span className="text-[10px] bg-indigo-950 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-800/40 font-mono">v3.1</span>
            </div>
          </div>
          <div className="h-4 w-[1px] bg-white/10 mx-2 hidden lg:block"></div>
          <span className="text-xs font-medium text-zinc-500 hidden lg:inline">Smart Studio de Script & Vidéo</span>
        </div>

        {/* Central tab triggers consistent with premium design principles */}
        <div className="flex bg-zinc-950 p-1 rounded-lg border border-white/5 mx-2 shrink-0">
          <button
            onClick={() => setActiveTab("studio")}
            className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "studio"
                ? "bg-indigo-600/10 border border-indigo-500/20 text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            id="tab-studio-trigger"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Studio Créatif</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("contract");
              addLog("Consultation du contrat de données d'architecture JSON Schema.");
            }}
            className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "contract"
                ? "bg-indigo-600/10 border border-indigo-500/20 text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            id="tab-contract-trigger"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Contrat JSON Schema (Veo Link)</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-zinc-900/80 px-3 py-1.5 rounded-full border border-white/5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-ping"></div>
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">Gemini + Veo Connectés</span>
          </div>
          <div className="flex items-center gap-3">
            {script && (
              <div className="bg-zinc-900/80 px-3 py-1.5 rounded-full border border-white/5">
                <span className="text-xs font-mono uppercase tracking-widest text-zinc-300 font-semibold">
                  {isAssemblingFinalVideo
                    ? "Assemblage final..."
                    : assembledVideoUrl
                    ? "Vidéo finale prête"
                    : isProjectReady
                    ? `Projet prêt ${completedSceneCount}/${totalSceneCount}`
                    : isProjectRendering
                    ? `Rendu auto ${completedSceneCount}/${totalSceneCount}`
                    : failedSceneCount > 0
                    ? `Projet partiel ${completedSceneCount}/${totalSceneCount}`
                    : `Storyboard ${completedSceneCount}/${totalSceneCount}`}
                </span>
              </div>
            )}
            {finalVideoDownloadUrl ? (
              <a
                href={finalVideoDownloadUrl}
                download={`${script?.title || "video-finale"}.mp4`}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95 flex items-center gap-1.5 cursor-pointer"
                id="download-final-video-btn"
              >
                <Download className="w-3.5 h-3.5" />
                Télécharger la Vidéo Finale
              </a>
            ) : readySceneDownloadUrl && (
              <a
                href={readySceneDownloadUrl}
                download={`scene_${selectedSceneIndex + 1}_video.mp4`}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95 flex items-center gap-1.5 cursor-pointer"
                id="download-active-video-btn"
              >
                <Download className="w-3.5 h-3.5" />
                Télécharger le Clip Actif
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0 bg-[#080808]">
        {activeTab === "studio" ? (
          <>
            {/* Left Sidebar: Settings, Brand Identity, Text Script generation options */}
            <aside className="w-full lg:w-[420px] border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col bg-[#070707] shrink-0 overflow-y-auto" id="left-sidebar">
              <div className="p-5 flex-1 space-y-6">
                
                {/* Header title & Mode selection toggle */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-bold flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      ① Configuration
                    </span>
                    <button
                      type="button"
                      onClick={loadExampleScript}
                      className="text-[10px] text-zinc-400 hover:text-indigo-300 transition-colors bg-zinc-900 border border-white/10 px-2 py-0.5 rounded cursor-pointer font-bold"
                    >
                      Gabarit Démo
                    </button>
                  </div>

                  {/* Mode switch pills */}
                  <div className="bg-zinc-950 p-1 rounded-xl border border-white/5 shadow-inner flex">
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarMode("simple");
                        addLog("Mode Simple activé - Interface épurée et intuitive.");
                      }}
                      className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        sidebarMode === "simple"
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      🪄 Mode Simple
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarMode("expert");
                        addLog("Mode Expert activé - Affichage des paramètres Veo avancés.");
                      }}
                      className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        sidebarMode === "expert"
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      🛠️ Mode Expert
                    </button>
                  </div>
                </div>

                {/* Preset Inspirations (Instant filling of inputs to facilitate testing) */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold block">
                    ⚡ Inspirations Rapides (Remplissage 1-Clic)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        title: "🚀 App V-GEN PRO",
                        topic: "Lancement de la nouvelle application V-GEN PRO, le premier studio mobile de création de vidéos alimenté par l'IA de Google.",
                        brandName: "V-GEN Corporate",
                        brandStyle: "Dynamique, révolutionnaire, orienté start-up",
                        contentType: "product_demo",
                        tone: "persuasive"
                      },
                      {
                        title: "🤖 Robotique 2026",
                        topic: "Le futur de la robotique humanoïde en 2026, l'intégration aux foyers et l'autonomie physique des assistants androïdes.",
                        brandName: "TechPulse",
                        brandStyle: "Direct, fascinant, basé sur la science",
                        contentType: "storytelling",
                        tone: "narrative"
                      },
                      {
                        title: "⏳ Écho Historique",
                        topic: "Une immersion narrative révélant la découverte de la relativité générale d'Albert Einstein en 1915.",
                        brandName: "Écho Historique",
                        brandStyle: "Inspirant, narratif, majestueux",
                        contentType: "informational",
                        tone: "narrative"
                      },
                      {
                        title: "🌿 Planète Verte",
                        topic: "3 actions quotidiennes simples pour réduire notre empreinte carbone et redonner vie à la biodiversité locale.",
                        brandName: "Planète Éco",
                        brandStyle: "Positif, engageant, accessible",
                        contentType: "tutorial",
                        tone: "dynamic"
                      }
                    ].map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => {
                          setTopic(preset.topic);
                          setBrandName(preset.brandName);
                          setBrandStyle(preset.brandStyle);
                          setContentType(preset.contentType as ContentType);
                          setTone(preset.tone as ToneType);
                          addLog(`Preset "${preset.title}" chargé avec succès.`);
                        }}
                        className={`bg-zinc-950/80 hover:bg-zinc-900 border rounded-lg py-1.5 px-2 text-left transition-all cursor-pointer ${
                          topic === preset.topic ? "border-indigo-500 bg-indigo-950/10 text-indigo-300" : "border-white/5 text-zinc-400 hover:border-white/10"
                        }`}
                        title={preset.topic}
                      >
                        <span className="text-[10px] font-semibold block truncate">
                          {preset.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic Input Description */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] uppercase tracking-wider text-zinc-400 block font-bold">Thème ou Pitch de la Vidéo</label>
                    <span className="text-[10px] text-zinc-500">{topic.length}/200</span>
                  </div>
                  <textarea
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-zinc-650"
                    rows={3}
                    maxLength={200}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Saisissez votre idée ou cliquez sur un bouton d'inspiration ci-dessus..."
                    id="script-topic-input"
                  />
                </div>

                {/* Target Support Social / Format */}
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-wider text-zinc-400 block font-bold">Format de Rendu Cible</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetPlatform("shorts");
                        addLog("Format vertical (9:16) configuré pour les Shorts & TikTok.");
                      }}
                      className={`py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        targetPlatform !== "youtube"
                          ? "bg-indigo-600/10 border-indigo-500/50 text-indigo-400"
                          : "bg-zinc-950 border-white/5 text-zinc-500 hover:border-white/10"
                      }`}
                      id="format-9-16-btn"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      9:16 (Shorts / Reels)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTargetPlatform("youtube");
                        addLog("Format horizontal (16:9) configuré pour YouTube.");
                      }}
                      className={`py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        targetPlatform === "youtube"
                          ? "bg-indigo-600/10 border-indigo-500/50 text-indigo-400"
                          : "bg-zinc-950 border-white/5 text-zinc-500 hover:border-white/10"
                      }`}
                      id="format-16-9-btn"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      16:9 (YouTube / Écrans)
                    </button>
                  </div>
                </div>

                {/* Collapsible regions for Expert users (Keeps Simple Mode absolutely clutter-free) */}
                {sidebarMode === "expert" && (
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    
                    {/* Collapsible Folder 1: Brand configuration */}
                    <div className="border border-white/10 rounded-xl bg-zinc-950/20 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setIsBrandAccordionOpen(!isBrandAccordionOpen);
                          addLog("Menu 'Identité de Marque' basculé.");
                        }}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900/40 transition-all cursor-pointer"
                      >
                        <span className="text-xs uppercase tracking-wider text-zinc-300 font-bold flex items-center gap-2">
                          <Flame className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                          Identité de Marque
                        </span>
                        {isBrandAccordionOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                      </button>
                      
                      {isBrandAccordionOpen && (
                        <div className="p-4 bg-zinc-950/80 border-t border-white/5 space-y-3">
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-550 font-bold uppercase block">Nom de la Marque</span>
                            <input
                              type="text"
                              className="w-full bg-zinc-950 border border-white/10 rounded px-2.5 py-1.5 text-xs text-zinc-300"
                              value={brandName}
                              onChange={(e) => setBrandName(e.target.value)}
                              placeholder="Ex: TechPulse"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-550 font-bold uppercase block">Voix &amp; Ligne Éditoriale</span>
                            <input
                              type="text"
                              className="w-full bg-zinc-950 border border-white/10 rounded px-2.5 py-1.5 text-xs text-zinc-300"
                              value={brandStyle}
                              onChange={(e) => setBrandStyle(e.target.value)}
                              placeholder="Ex: Passionné, énigmatique..."
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="space-y-1">
                              <span className="text-[10px] text-zinc-550 block font-bold uppercase">Catégorie</span>
                              <select
                                className="w-full bg-zinc-950 border border-white/10 rounded px-2 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-indigo-500"
                                value={contentType}
                                onChange={(e) => setContentType(e.target.value as ContentType)}
                              >
                                <option value="storytelling">Storytelling</option>
                                <option value="product_demo">Démo Produit</option>
                                <option value="tutorial">Tutoriel Express</option>
                                <option value="informational">Éducatif &amp; Info</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] text-zinc-550 block font-bold uppercase">Tonalité</span>
                              <select
                                className="w-full bg-zinc-950 border border-white/10 rounded px-2 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-indigo-500"
                                value={tone}
                                onChange={(e) => setTone(e.target.value as ToneType)}
                              >
                                <option value="dynamic">Punchy &amp; Décalé</option>
                                <option value="narrative">Émotionnel</option>
                                <option value="persuasive">Marketing</option>
                                <option value="comedic">Humoristique</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Collapsible Folder 2: Multimodal Dropzone frame */}
                    <div className="border border-white/10 rounded-xl bg-zinc-950/20 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMediaAccordionOpen(!isMediaAccordionOpen);
                          addLog("Menu 'Image de Référence' basculé.");
                        }}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900/40 transition-all cursor-pointer"
                      >
                        <span className="text-xs uppercase tracking-wider text-zinc-300 font-bold flex items-center gap-2">
                          <UploadCloud className="w-3.5 h-3.5 text-zinc-400" />
                          Média Multimodal
                        </span>
                        {isMediaAccordionOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                      </button>

                      {isMediaAccordionOpen && (
                        <div className="p-4 bg-zinc-950/80 border-t border-white/5 space-y-3">
                          {!referenceImage ? (
                            <div
                              onDragEnter={handleDrag}
                              onDragOver={handleDrag}
                              onDragLeave={handleDrag}
                              onDrop={handleDrop}
                              onClick={() => fileInputRef.current?.click()}
                              className={`border border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                                isDragging
                                  ? "border-indigo-500 bg-indigo-950/20 text-indigo-400"
                                  : "border-white/10 hover:border-white/20 bg-zinc-950 text-zinc-500"
                              }`}
                            >
                              <UploadCloud className="w-6 h-6 mb-1 text-zinc-600" />
                              <span className="text-[11px] text-zinc-300 font-medium">Glisser une image de référence</span>
                              <span className="text-[9px] text-zinc-500">Active l&apos;Image-to-Video</span>
                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                                className="hidden"
                                accept="image/*"
                              />
                            </div>
                          ) : (
                            <div className="relative border border-white/10 bg-zinc-950 p-2 rounded-lg flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <img
                                  src={referenceImage}
                                  alt="Ref Preview"
                                  className="w-10 h-10 object-cover rounded"
                                />
                                <div className="overflow-hidden">
                                  <span className="text-xs text-zinc-300 block truncate font-medium">Image chargée</span>
                                  <span className="text-[9px] text-emerald-400 font-mono">Image-to-Video Activé</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={clearReferenceImage}
                                className="text-zinc-500 hover:text-red-400 p-1.5 transition-colors cursor-pointer"
                                title="Supprimer la référence"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Collapsible Folder 3: Veo Parameters & Sliders */}
                    <div className="border border-white/10 rounded-xl bg-zinc-950/20 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEngineAccordionOpen(!isEngineAccordionOpen);
                          addLog("Menu 'Moteur Veo' basculé.");
                        }}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900/40 transition-all cursor-pointer"
                      >
                        <span className="text-xs uppercase tracking-wider text-zinc-300 font-bold flex items-center gap-2">
                          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                          Moteur & Algorithme Veo
                        </span>
                        {isEngineAccordionOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                      </button>

                      {isEngineAccordionOpen && (
                        <div className="p-4 bg-zinc-950/80 border-t border-white/5 space-y-4">
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 block uppercase font-bold">Modèle de Rendu</span>
                            <select
                              className="w-full bg-zinc-950 border border-white/10 rounded px-2 py-1.5 text-xs text-indigo-400 font-semibold focus:outline-none"
                              value={selectedModel}
                              onChange={(e) => {
                                setSelectedModel(e.target.value);
                                addLog(`Modèle configuré : ${e.target.value}`);
                              }}
                            >
                              <option value="veo-3.1-lite-generate-preview">Veo 3.1 Lite (Rapide, Preview)</option>
                              <option value="veo-3.1-generate-preview">Veo 3.1 Pro (4K Coherence)</option>
                              <option value="imagen-3-video">Imagen 2 Video (Mouvements Lents)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 block uppercase font-bold">Résolution</span>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setResolution("720p");
                                  addLog("Résolution ajustée à 720p HD");
                                }}
                                className={`py-1 text-center font-mono rounded text-xs border cursor-pointer ${
                                  resolution === "720p" ? "bg-zinc-900 border-indigo-500 text-indigo-400 font-bold" : "bg-zinc-950 border-white/5 text-zinc-500"
                                }`}
                              >
                                720p HD
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedModel === "veo-3.1-lite-generate-preview") {
                                    setSelectedModel("veo-3.1-generate-preview");
                                  }
                                  setResolution("1080p");
                                  addLog("Résolution ajustée à 1080p Full HD.");
                                }}
                                className={`py-1 text-center font-mono rounded text-xs border cursor-pointer ${
                                  resolution === "1080p" ? "bg-zinc-900 border-indigo-500 text-indigo-400 font-bold" : "bg-zinc-950 border-white/5 text-zinc-500"
                                }`}
                              >
                                1080p FHD
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] uppercase text-zinc-500 font-bold">
                              <span>Cohérence Temporelle</span>
                              <span className="text-indigo-400 font-mono font-bold">{coherence}%</span>
                            </div>
                            <input
                              type="range"
                              min="50"
                              max="95"
                              value={coherence}
                              onChange={(e) => setCoherence(Number(e.target.value))}
                              className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                            />
                          </div>

                          <div className="pt-1">
                            <label className="flex items-center gap-2 cursor-pointer bg-zinc-950/80 p-2 rounded border border-white/5">
                              <input
                                type="checkbox"
                                checked={simulateInSandbox}
                                onChange={(e) => {
                                  setSimulateInSandbox(e.target.checked);
                                  addLog(`Simulation sandbox : ${e.target.checked}`);
                                }}
                                className="accent-indigo-500"
                              />
                              <div>
                                <span className="text-[10px] uppercase font-bold text-zinc-300 block">Environnement Sandbox</span>
                                <p className="text-[9px] text-zinc-500 mb-0">
                                  Utilise un clip de démo identique sur chaque scène pour éviter les coûts réels
                                </p>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Collapsible Folder 4: Technical Diagnostics Console (Moved from right sidebar) */}
                    <div className="border border-white/10 rounded-xl bg-zinc-950/20 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setIsLogsAccordionOpen(!isLogsAccordionOpen);
                          addLog("Console de diagnostics basculée.");
                        }}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900/40 transition-all cursor-pointer"
                      >
                        <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                          Diagnostics &amp; Coûts
                        </span>
                        {isLogsAccordionOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                      </button>

                      {isLogsAccordionOpen && (
                        <div className="p-3 bg-black border-t border-white/5 space-y-4">
                          
                          {/* Execution stats */}
                          <div className="p-3 bg-indigo-950/20 rounded-lg border border-indigo-500/10 space-y-1 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Vitesse estimée</span>
                              <span className="text-zinc-300 font-mono">15s / clip</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Consommation API</span>
                              <span className={`font-mono font-bold ${simulateInSandbox ? "text-amber-400" : "text-emerald-400"}`}>
                                {simulateInSandbox ? "Sandbox (démo)" : "Mode réel"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Hébergement GPU</span>
                              <span className="text-zinc-400 font-mono">Vertex Multi-node</span>
                            </div>
                          </div>

                          {/* Live Console Feed */}
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-mono">Flux en Direct :</span>
                            <div className="bg-[#050505] border border-white/5 rounded-lg p-2.5 h-28 overflow-y-auto font-mono text-[9px] text-zinc-400 leading-normal space-y-1">
                              {operationLogs.map((logStr, lIdx) => (
                                <div key={lIdx} className="border-b border-white/5 pb-1 last:border-b-0 text-zinc-400">
                                  {logStr}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* Always display active setting issues/alerts in the Left Sidebar */}
                {errorStatus && (
                  <div className="bg-red-950/20 border border-red-900/40 text-red-350 rounded-lg p-3 flex items-start gap-2"/>
                )}

              </div>

              {/* Sidebar trigger generate action footer */}
              <div className="p-4 border-t border-white/10 bg-black/40 box-border block shrink-0">
                <button
                  type="button"
                  onClick={generateScript}
                  disabled={isGeneratingScript}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer hover:shadow-indigo-500/20"
                  id="generate-script-btn"
                >
                  {isGeneratingScript ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Scripting & Rendu vidéo...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 animate-pulse text-indigo-300" />
                      Générer Script & Vidéo
                    </>
                  )}
                </button>
                <span className="text-[10px] text-zinc-400 block text-center mt-2">
                  Génère le script et lance automatiquement le rendu de toutes les scènes de la vidéo avec Google Veo.
                </span>
              </div>
            </aside>

        {/* Center Section: Advanced Storyboard Viewer and Canvas Rendering */}
        <section className="flex-1 flex flex-col bg-black relative min-w-0" id="center-panel">
          
          {/* Format aspect-ratio simulation indicator header */}
          <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-zinc-950 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold">Format de Rendu Actif :</span>
              <span className="text-xs bg-zinc-900 text-indigo-400 font-mono font-semibold px-2 py-0.5 rounded border border-white/5 uppercase">
                {targetPlatform === "youtube" ? "Horizontal (16:9)" : "Vertical (9:16)"}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setTargetPlatform("youtube");
                  addLog("Format modifié en 16:9 (YouTube Landscape)");
                }}
                className={`p-1.5 rounded transition-all ${
                  targetPlatform === "youtube" ? "bg-zinc-900 border border-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Format Horizontal 16:9"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setTargetPlatform("shorts");
                  addLog("Format modifié en 9:16 (Vertical Portrait)");
                }}
                className={`p-1.5 rounded transition-all ${
                  targetPlatform !== "youtube" ? "bg-zinc-900 border border-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Format Vertical 9:16"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center space-y-6">
            {script ? (
              <div className="w-full max-w-4xl flex flex-col items-center space-y-6">
                
                {/* Active scene video frame aspect model */}
                <div className="w-full flex flex-col items-center">
                  {(isFinalVideoReady || isAssemblingFinalVideo) && (
                    <div className="mb-3 flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/80 p-1">
                      <button
                        type="button"
                        onClick={() => setPreviewMode("final")}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                          previewMode === "final" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Vidéo Finale
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode("scene")}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                          previewMode === "scene" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Clip de Scène
                      </button>
                    </div>
                  )}
                  <div
                    className={`relative bg-[#0b0b0b] rounded-2xl border border-white/10 overflow-hidden shadow-2xl transition-all duration-300 group flex items-center justify-center ${
                      targetPlatform === "youtube"
                        ? "w-full max-w-2xl aspect-video"
                        : "w-[280px] h-[497px]"
                    }`}
                  >
                    {/* Render status bar */}
                    {previewMode === "scene" && activeScene?.isGeneratingVideo && (
                      <div className="absolute inset-0 bg-black/90 z-20 flex flex-col items-center justify-center p-6 text-center">
                        <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
                          <div className="absolute inset-0 border-4 border-indigo-600/25 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-t-indigo-500 border-r-indigo-500 rounded-full animate-spin"></div>
                          <Video className="w-6 h-6 text-indigo-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-white">Génération Vidéo Veo Actonnée</h4>
                        <p className="text-xs text-zinc-500 mt-1 max-w-[200px]">
                          Création d&apos;un mouvement fluide de 5-7 secondes...
                        </p>
                        <div className="w-32 bg-zinc-800 h-1 rounded-full mt-4 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full transition-all duration-300"
                            style={{ width: `${renderProgress[activeScene.id] || 5}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-indigo-400 mt-2">
                          {renderProgress[activeScene.id] || 5}% complété
                        </span>
                      </div>
                    )}

                    {previewMode === "final" && isAssemblingFinalVideo && !assembledVideoUrl && (
                      <div className="absolute inset-0 bg-black/90 z-20 flex flex-col items-center justify-center p-6 text-center">
                        <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
                          <div className="absolute inset-0 border-4 border-indigo-600/25 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-t-indigo-500 border-r-indigo-500 rounded-full animate-spin"></div>
                          <Layers className="w-6 h-6 text-indigo-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-white">Assemblage Final</h4>
                        <p className="text-xs text-zinc-500 mt-1 max-w-[220px]">
                          Concaténation des clips du projet en une vidéo finale unique...
                        </p>
                      </div>
                    )}

                    {/* Rendering image state */}
                    {previewMode === "scene" && activeScene?.isGeneratingImage && !activeScene?.isGeneratingVideo && (
                      <div className="absolute inset-0 bg-black/90 z-20 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                        <span className="text-xs text-zinc-400">Génération du concept image de storyboard...</span>
                      </div>
                    )}

                    {/* Main media output display */}
                    {displayedVideoUrl ? (
                      <video
                        key={displayedVideoUrl}
                        src={displayedVideoUrl}
                        className="w-full h-full object-cover"
                        loop
                        muted
                        controls
                        autoPlay
                        playsInline
                        id="video-player-frame"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950/15 via-zinc-950 to-purple-950/15 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-14 h-14 bg-indigo-950/40 border border-indigo-500/20 rounded-full flex items-center justify-center mb-4 text-indigo-400 shadow-xl shadow-indigo-500/10">
                          <Video className="w-6 h-6 animate-pulse" />
                        </div>
                        <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">
                          {previewMode === "final" ? "Vidéo Finale" : `Scène ${selectedSceneIndex + 1}`}
                        </span>
                        <p className="text-[11px] text-zinc-400 mt-1.5 max-w-[245px] leading-relaxed">
                          {previewMode === "final"
                            ? "La vidéo finale apparaîtra ici dès que l’assemblage backend sera terminé."
                            : "Le rendu du projet est lancé automatiquement depuis le bouton principal. Ce panneau affichera le clip de la scène dès qu&apos;il sera prêt."}
                        </p>

                        {previewMode === "scene" && sidebarMode === "expert" && (
                        <div className="mt-5">
                          <button
                            onClick={() => generateSceneVideo(selectedSceneIndex)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] uppercase tracking-widest font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-1.5 cursor-pointer hover:shadow-indigo-500/10"
                            id="render-veo-video-btn"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Relancer ce Clip
                          </button>
                        </div>
                        )}
                      </div>
                    )}

                    {/* Subtitle Teleprompter overlay overlay */}
                    {(previewMode === "final" ? script : activeScene) && (
                      <div className="absolute bottom-4 left-4 right-4 z-10 bg-black/80 backdrop-blur px-3 py-2.5 rounded-lg border border-white/5 text-center">
                        <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-mono font-bold block mb-0.5">Captions & Incrustation :</span>
                        <p className="text-xs text-white font-medium tracking-wide">
                          {previewMode === "final" ? script?.title || "Vidéo Finale" : activeScene?.textOverlay || "Aucun texte"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Narrative Prompters & Playback panel */}
                <div className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-white/5">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                        {previewMode === "final" ? "VIDÉO FINALE" : `CLIP ACTIF : ${selectedSceneIndex + 1} / ${script.scenes.length}`}
                      </span>
                      <h2 className="text-sm font-semibold text-white mt-0.5">{script.title}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {assembledVideoUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewMode("final")}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-semibold cursor-pointer shadow-lg active:scale-95 transition-all"
                        >
                          <Play className="w-3.5 h-3.5 text-white" />
                          Voir la Vidéo Finale
                        </button>
                      )}
                      {previewMode === "final" && activeScene?.videoUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewMode("scene")}
                          className="bg-zinc-900 hover:bg-[#121212] hover:text-white text-zinc-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Video className="w-3.5 h-3.5 text-indigo-400" />
                          Voir le Clip de Scène
                        </button>
                      )}
                      {canRetryMissingScenes && (
                        <button
                          type="button"
                          onClick={generateMissingVideos}
                          className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-semibold cursor-pointer shadow-lg active:scale-95 transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                          Relancer les clips manquants ({missingSceneCount})
                        </button>
                      )}
                      {sidebarMode === "expert" && (
                        <>
                          <button
                            onClick={() => script && generateAllVideos(script)}
                            className="bg-zinc-900 hover:bg-[#121212] hover:text-white text-zinc-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Layers className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                            Relancer Tout le Projet
                          </button>
                          <button
                            onClick={() => generateSceneVideo(selectedSceneIndex)}
                            className="bg-zinc-900 hover:bg-[#121212] hover:text-white text-zinc-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                            Relancer ce Clip
                          </button>
                        </>
                      )}
                      {finalVideoDownloadUrl && (
                        <a
                          href={finalVideoDownloadUrl}
                          download={`${script.title || "video-finale"}.mp4`}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-semibold cursor-pointer shadow-lg active:scale-95 transition-all"
                          id="download-final-video-panel-btn"
                        >
                          <Download className="w-3.5 h-3.5 text-white" />
                          Télécharger la Vidéo Finale
                        </a>
                      )}
                      {activeScene?.videoUrl && (
                        <a
                          href={`${activeScene.videoUrl}&download=true`}
                          download={`scene_${selectedSceneIndex + 1}_video.mp4`}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-semibold cursor-pointer shadow-lg active:scale-95 transition-all"
                          id="download-scene-video-btn"
                        >
                          <Download className="w-3.5 h-3.5 text-white" />
                          Télécharger ce Clip
                        </a>
                      )}
                    </div>
                  </div>

                  {simulateInSandbox && (
                    <div className="bg-amber-950/20 border border-amber-700/30 text-amber-200 text-xs rounded-lg p-3">
                      Mode sandbox actif : chaque scène réutilise volontairement le même clip de démonstration. Pour obtenir un rendu différent par scène, désactivez le sandbox avant de lancer la génération du projet.
                    </div>
                  )}

                  {activeScene?.error && (
                    <div className="bg-red-950/20 border border-red-700/30 text-red-200 text-xs rounded-lg p-3">
                      Clip {selectedSceneIndex + 1} non finalise : {activeScene.error}
                    </div>
                  )}

                  {isAssemblingFinalVideo && (
                    <div className="bg-indigo-950/20 border border-indigo-700/30 text-indigo-200 text-xs rounded-lg p-3">
                      Assemblage backend en cours : les clips validés sont concaténés en une vidéo finale téléchargeable.
                    </div>
                  )}

                  {assemblyError && (
                    <div className="bg-red-950/20 border border-red-700/30 text-red-200 text-xs rounded-lg p-3">
                      Échec de l’assemblage final : {assemblyError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Prompt instructions section */}
                    <div className="bg-zinc-950/80 border border-white/5 p-3 rounded-lg space-y-2">
                      <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold uppercase">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        Prompt d&apos;animation Image/Vidéo conseillé (Veo)
                      </div>
                      <p className="text-xs text-zinc-300 italic leading-relaxed">
                        {activeScene?.visualPrompt}
                      </p>
                    </div>

                    {/* Speech audio indications */}
                    <div className="bg-zinc-950/80 border border-white/5 p-3 rounded-lg space-y-2">
                      <div className="space-y-1">
                        <span className="text-zinc-400 text-xs font-semibold uppercase flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-indigo-400" />
                          Voix off et Narration ({activeScene?.renderedDuration || activeScene?.duration}s)
                        </span>
                        <p className="text-xs text-white leading-relaxed">
                          &ldquo;{activeScene?.narration}&rdquo;
                        </p>
                      </div>
                      <div className="pt-2 border-t border-white/5 flex flex-wrap gap-2 text-[10px] text-zinc-400">
                        <span className="bg-zinc-900 border border-white/5 px-2 py-0.5 rounded flex items-center gap-1">
                          <Music className="w-3 h-3 text-indigo-400" />
                          Audio: {activeScene?.audioCue}
                        </span>
                        <span className="bg-zinc-900 border border-white/5 px-2 py-0.5 rounded flex items-center gap-1">
                          <Monitor className="w-3 h-3 text-emerald-400" />
                          Caméra: {activeScene?.cameraMovement}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overall script feedback and brands guidelines box */}
                <div className="w-full bg-indigo-950/10 border border-indigo-900/20 p-4 rounded-xl flex items-start gap-3">
                  <Activity className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="text-indigo-300 font-bold block uppercase mb-1">Moteur d&apos;écriture actif</span>
                    Moteur de scriptage configuré avec succès ! Appliqué à l&apos;identité <strong className="text-white">{script.brandVoiceApplied}</strong>.
                    Pacing optimisé pour <strong className="text-white">{targetPlatform === "youtube" ? "YouTube (Narratif 3 Actes)" : "Reels/Tiktok (accroche d'attention immédiate)"}</strong>.
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center max-w-lg p-8 border border-white/10 bg-zinc-950/45 rounded-2xl space-y-6">
                <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto shadow-inner shadow-indigo-500/10">
                  <Sparkles className="w-7 h-7 text-indigo-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Bienvenue sur V-GEN PRO</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                    Transformez instantanément vos idées en vidéos professionnelles et immersives. Voici le nouveau processus automatisé en 2 étapes simples :
                  </p>
                </div>

                {/* Steps container */}
                <div className="grid grid-cols-1 gap-3.5 text-left border-y border-white/5 py-5">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-950 text-indigo-400 font-mono font-bold text-[10px] flex items-center justify-center border border-indigo-800/20 shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Configurez votre Idée</h4>
                      <p className="text-[11px] text-zinc-500">Sélectionnez ou saisissez votre thème dans la barre latérale gauche (ex: &ldquo;Le futur de la robotique humanoïde&rdquo;).</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-950 text-indigo-400 font-mono font-bold text-[10px] flex items-center justify-center border border-indigo-800/20 shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Génération Globale Auto-Lancée</h4>
                      <p className="text-[11px] text-zinc-500">
                        Cliquez sur <strong className="text-indigo-400">&ldquo;Générer Script & Vidéo&rdquo;</strong>. Notre IA Gemini conçoit le scénario, et l&apos;Animateur Google Veo lance immédiatement le rendu de toutes vos scènes en arrière-plan.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                  <button
                    onClick={generateScript}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    Lancer l&apos;Automatisation
                  </button>
                  <button
                    onClick={loadExampleScript}
                    className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 text-xs font-semibold px-5 py-3 rounded-xl transition-all cursor-pointer"
                  >
                    🚀 Charger la Démo (Animation incluse)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom timeline strip slider representing storyboard scenes */}
          <div className="h-40 bg-zinc-900/60 border-t border-white/10 p-4 shrink-0 overflow-x-auto select-none" id="storyboard-timeline">
            <div className="flex gap-4 min-w-max h-full">
              {script?.scenes.map((scene, i) => (
                <div
                  key={scene.id}
                  onClick={() => setSelectedSceneIndex(i)}
                  className={`w-48 flex-shrink-0 rounded-xl transition-all p-3 relative flex flex-col justify-between cursor-pointer border ${
                    selectedSceneIndex === i
                      ? "bg-indigo-900/20 border-indigo-500/80 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                      : "bg-zinc-950 border-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-400 font-mono">
                      SCÈNE 0{i + 1}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-semibold font-mono">
                      {scene.duration}s
                    </span>
                  </div>

                  {/* Tiny thumbnail simulation representing media element style */}
                  <div className="bg-zinc-900 h-11 my-1.5 rounded relative overflow-hidden border border-white/5 flex items-center justify-center">
                    {scene.videoUrl ? (
                      <div className="absolute inset-0 bg-emerald-950/20 flex items-center justify-center text-[10px] text-emerald-400 font-mono font-bold">
                        <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                        CLIP ok
                      </div>
                    ) : scene.isGeneratingVideo ? (
                      <div className="absolute inset-0 bg-indigo-950/20 flex items-center justify-center text-[10px] text-indigo-300 font-mono font-bold">
                        RENDU {renderProgress[scene.id] || 2}%
                      </div>
                    ) : scene.error ? (
                      <div className="absolute inset-0 bg-red-950/20 flex items-center justify-center text-[10px] text-red-300 font-mono font-bold">
                        A RELANCER
                      </div>
                    ) : scene.imageUrl ? (
                      <img
                        src={scene.imageUrl}
                        className="w-full h-full object-cover opacity-80"
                        alt="Scene snapshot"
                      />
                    ) : (
                      <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">Inoccupé</span>
                    )}
                  </div>

                  <p className="text-[9px] text-zinc-500 font-medium truncate">
                    {scene.textOverlay || "Pas de texte d'incrustation"}
                  </p>
                </div>
              ))}

              {/* Dynamic plus button block to extend script storyboard directly */}
              {script && (
                <button
                  onClick={() => {
                    if (!script) return;
                    const nextId = `sc-${Math.random().toString(36).substr(2, 9)}`;
                    const updatedScenes = [
                      ...script.scenes,
                      {
                        id: nextId,
                        duration: 5,
                        visualPrompt: "A sleek modern conceptual high-tech element displaying social icons glowing in modern pastel aesthetic, cinematic macro, studio, clean shadows",
                        narration: "Et pour ne rater aucun des prochains hacks de création, rejoignez-nous maintenant.",
                        cameraMovement: "Zoom avant progressif",
                        textOverlay: "REJOIGNEZ LA RÉVOLUTION VEO",
                        audioCue: "Fin enthousiaste avec impact musical et fade-out",
                        isSimulated: simulateInSandbox
                      }
                    ];
                    setScript({ ...script, scenes: updatedScenes });
                    setSelectedSceneIndex(updatedScenes.length - 1);
                    addLog("Nouvelle scène générique de conclusion ajoutée au script.");
                  }}
                  className="w-40 flex-shrink-0 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl hover:bg-zinc-900/30 transition-all text-zinc-500 hover:text-indigo-400 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 mb-1 text-zinc-650" />
                  <span className="text-[10px] uppercase tracking-wider font-semibold">Ajouter Scène</span>
                </button>
              )}
            </div>
          </div>
        </section>
      </>
    ) : (
        /* JSON Schema Contract Viewer & Interactive Architecture Dashboard */
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0 bg-[#060606] divide-y lg:divide-y-0 lg:divide-x divide-white/10" id="contract-view-panel">
          
          {/* Left panel of the contract workspace: Validator tools and actions */}
          <aside className="w-full lg:w-96 flex flex-col bg-[#080808] shrink-0 overflow-y-auto p-5 space-y-6">
            
            {/* Quick Actions to Save the schemas */}
            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold block mb-3">
                Outils de Contrat
              </span>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(STORYBOARD_JSON_SCHEMA, null, 2));
                    const downloadAnchor = document.createElement("a");
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", "vgen_storyboard_schema.json");
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                    addLog("Téléchargement du fichier de spécifications schéma JSON initié.");
                  }}
                  className="w-full bg-zinc-900 hover:bg-zinc-850 hover:text-white text-zinc-300 border border-white/10 rounded-lg p-2.5 text-xs font-semibold flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-indigo-400" />
                    Télécharger le Schéma JSON
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500 font-bold">.JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(MOCK_MARKETING_STORYBOARD_JSON_INSTANCE, null, 2));
                    const downloadAnchor = document.createElement("a");
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", "storyboard_campagne_lancement.json");
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                    addLog("Téléchargement de l'exemple d'instance marketing initié.");
                  }}
                  className="w-full bg-zinc-900 hover:bg-zinc-850 hover:text-white text-zinc-300 border border-white/10 rounded-lg p-2.5 text-xs font-semibold flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-indigo-400" />
                    Télécharger l&apos;Exemple (3 scènes)
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500 font-bold">.JSON</span>
                </button>

                {/* Instant integration trigger tool */}
                <button
                  type="button"
                  onClick={() => {
                    resetFinalAssemblyState();
                    const mappedScript = {
                      title: MOCK_MARKETING_STORYBOARD_JSON_INSTANCE.metadata.title,
                      brandVoiceApplied: MOCK_MARKETING_STORYBOARD_JSON_INSTANCE.metadata.brand_voice_signature,
                      isSimulated: true,
                      scenes: MOCK_MARKETING_STORYBOARD_JSON_INSTANCE.scenes.map(s => ({
                        id: s.id,
                        duration: s.duration,
                        visualPrompt: s.visual_prompt,
                        narration: s.voice_over_text,
                        cameraMovement: s.visual_prompt.includes("zoom") ? "Zoom rapide cinématique" : "Panoramique lent",
                        textOverlay: s.voice_over_text,
                        audioCue: s.audio_notes,
                        imageUrl: s.id === "scene_01" 
                          ? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=500&q=80"
                          : s.id === "scene_02"
                          ? "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=500&q=80"
                          : "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=500&q=80",
                        isSimulated: true,
                        videoUrl: s.id === "scene_01"
                          ? "/api/video-download?operationName=/operations/op-demo-fun"
                          : undefined
                      }))
                    };
                    setScript(mappedScript);
                    setSelectedSceneIndex(0);
                    setActiveTab("studio");
                    addLog("Storyboard de lancement d'application chargé dans le lecteur d'aperçu d'intégration.");
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg p-2.5 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
                >
                  <Play className="w-4 h-4 text-white" />
                  Tester l&apos;Exemple sur le Lecteur
                </button>
              </div>
            </div>

            {/* Sandbox Verification zone */}
            <div className="bg-[#0b0b0b] border border-white/5 rounded-xl p-4 space-y-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold block mb-1">
                  Validateur de Schéma Interactif
                </span>
                <p className="text-[9px] text-zinc-500 leading-normal mb-3">
                  Modifiez ou collez votre payload ci-dessous pour tester son intégrité avant de l&apos;envoyer à Google Veo.
                </p>
              </div>

              <textarea
                value={valJsonInput}
                onChange={(e) => setValJsonInput(e.target.value)}
                className="w-full h-48 bg-black border border-white/10 rounded-lg p-2 font-mono text-[10px] text-zinc-300 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="Insérez votre JSON complet ici..."
                id="validator-payload-area"
              />

              <button
                type="button"
                onClick={() => handleValidateJson(valJsonInput)}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold py-2 px-3 rounded border border-white/10 transition-colors flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Valider par rapport au Schéma
              </button>

              {valResult && (
                <div className={`p-3 rounded-lg text-[11px] leading-relaxed border ${
                  valResult.success 
                    ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400" 
                    : "bg-red-950/20 border-red-900/40 text-red-400"
                }`}>
                  <strong className="block mb-0.5">{valResult.success ? "✓ Conforme" : "✗ Rejeté"}</strong>
                  {valResult.text}
                </div>
              )}
            </div>

            {/* Google Cloud recommendations segment block */}
            <div className="bg-indigo-500/5 rounded-xl p-4 border border-indigo-500/10 space-y-3">
              <h4 className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                Recommandations Google Cloud
              </h4>
              <p className="text-[10px] text-zinc-400 leading-normal">
                Pour connecter ce contrat à votre pipeline de production automatique, nous préconisons :
              </p>
              <ul className="text-[10px] text-zinc-500 space-y-1.5 list-disc list-inside">
                <li><strong className="text-zinc-300 font-medium font-mono">Gemini 1.5 Pro / 2.5</strong> : écriture structurée avec formatage JSON contraint (Response Schema).</li>
                <li><strong className="text-zinc-300 font-medium font-mono">Vertex AI pipeline</strong> : orchestration cloud pour diffuser les scènes sur l&apos;API Veo de Google.</li>
              </ul>
            </div>
          </aside>

          {/* Main Workspace representing schemas and architectures */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8" id="contract-core-content">
            
            {/* Header info about the schema contract */}
            <div>
              <span className="text-indigo-400 font-bold font-mono text-[10px] uppercase block tracking-widest mb-1">
                CONTRAT DE SCRIPT ET RENDU VIDÉO MULTIMODAL
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">Spécifications d&apos;Architecture V-GEN PRO (Google Veo Direct Line)</h2>
              <p className="text-xs text-zinc-500 mt-2 max-w-3xl leading-relaxed">
                Ce contrat stricte garantit que les scripts créés par l&apos;IA possèdent toutes les propriétés de cohérence requises pour être ingérés séquentiellement par les modèles de génération vidéo avancés comme Google Veo. Il impose une structure métadonnées globale couplée à un minutage millimétré.
              </p>
            </div>

            {/* Side-by-side JSON contract displays */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* Left Column: JSON Schema */}
              <div className="bg-[#090909] border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[520px]">
                <div className="h-10 bg-[#101010] border-b border-white/10 px-4 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span className="text-xs font-mono font-bold text-white uppercase">Schéma JSON Validateur (STRICT)</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(STORYBOARD_JSON_SCHEMA, null, 2));
                      addLog("Schéma JSON copié dans le presse-papiers.");
                    }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800/20"
                  >
                    Copier
                  </button>
                </div>
                <div className="flex-1 p-4 overflow-auto font-mono text-[11px] text-indigo-300/90 leading-snug bg-black/60 select-all">
                  <pre>{JSON.stringify(STORYBOARD_JSON_SCHEMA, null, 2)}</pre>
                </div>
              </div>

              {/* Right Column: compliant Instance Mock block */}
              <div className="bg-[#090909] border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[520px]">
                <div className="h-10 bg-[#101010] border-b border-white/10 px-4 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-mono font-bold text-white uppercase">Instance Exemple de Campagne Marketing (3 Scènes)</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(MOCK_MARKETING_STORYBOARD_JSON_INSTANCE, null, 2));
                      addLog("Exemple d'instance JSON copié dans le presse-papiers.");
                    }}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/20"
                  >
                    Copier
                  </button>
                </div>
                <div className="flex-1 p-4 overflow-auto font-mono text-[11px] text-emerald-300/90 leading-snug bg-black/60 select-all">
                  <pre>{JSON.stringify(MOCK_MARKETING_STORYBOARD_JSON_INSTANCE, null, 2)}</pre>
                </div>
              </div>

            </div>

            {/* Comprehensive Technical analysis segment on major engineering challenges */}
            <div className="bg-zinc-900/20 border border-white/10 p-6 rounded-2xl space-y-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                Analyse Technique de Production & Défis Majeurs de Rendu (Veo)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="space-y-2 bg-[#090909] p-4 rounded-xl border border-white/5">
                  <span className="text-xs bg-indigo-950 text-indigo-400 px-2 py-0.5 font-mono font-semibold rounded inline-block">CHALLENGE 1</span>
                  <h4 className="text-xs font-bold text-white uppercase mt-1">Cohérence Temporelle & Stylistique</h4>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    La génération vidéo image par image souffre souvent de flickering (tremblements) ou de mutations de décors/visages. 
                  </p>
                  <p className="text-[11px] text-zinc-500 italic leading-normal">
                    <strong>Solution V-GEN :</strong> Le schéma utilise des invites visuelles (<code className="text-[9px] bg-zinc-950 px-1 py-0.5 text-indigo-405 font-mono">visual_prompt</code>) détaillées et standardisées basées sur des directives de caméra claires en anglais (ex. zoom lent, profondeur de champ constante) et l&apos;utilisation d&apos;un paramètre de cohérence temporelle élevé.
                  </p>
                </div>

                <div className="space-y-2 bg-[#090909] p-4 rounded-xl border border-white/5">
                  <span className="text-xs bg-indigo-950 text-indigo-400 px-2 py-0.5 font-mono font-semibold rounded inline-block">CHALLENGE 2</span>
                  <h4 className="text-xs font-bold text-white uppercase mt-1">Latence de Génération</h4>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    La création d&apos;un clip vidéo fluide de 5 à 10 secondes via Google Veo requiert un temps de calcul de GPU significatif dans le cloud (15s à 60s par clip).
                  </p>
                  <p className="text-[11px] text-zinc-500 italic leading-normal">
                    <strong>Solution V-GEN :</strong> Notre modèle de flux utilise une technique d&apos;écriture asynchrone progressive. Au lieu de bloquer l&apos;utilisateur, le back-end génère d&apos;abord le script complet et les images d&apos;aperçu (storyboard fixe ultra-rapide) d&apos;abord, puis lance le rendu vidéo en arrière-plan scène par scène.
                  </p>
                </div>

                <div className="space-y-2 bg-[#090909] p-4 rounded-xl border border-white/5">
                  <span className="text-xs bg-indigo-950 text-indigo-400 px-2 py-0.5 font-mono font-semibold rounded inline-block">CHALLENGE 3</span>
                  <h4 className="text-xs font-bold text-white uppercase mt-1">Liaison Multimodale Sécurisée</h4>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Les marques exigent souvent que la vidéo soit générée à partir d&apos;un élément graphique réel et exact (ex: le logo officiel, le design de l&apos;application).
                  </p>
                  <p className="text-[11px] text-zinc-500 italic leading-normal">
                    <strong>Solution V-GEN :</strong> Le champ optionnel <code className="text-[9px] bg-zinc-950 px-1 py-0.5 text-indigo-405 font-mono">image_reference_id</code> lie directement une image chargée au moteur Veo (Image-to-Video) garantissant que les éléments clés de l&apos;interface d&apos;application restent parfaits.
                  </p>
                </div>

              </div>
            </div>

          </div>

        </div>
      )}
    </main>

      {/* Persistent Status Bar to ground aesthetic with professional design properties */}
      <footer className="h-8 bg-zinc-950 border-t border-white/5 px-6 flex items-center justify-between text-[10px] text-zinc-650 font-mono z-20 shrink-0">
        <div className="flex gap-6">
          <span>REGION: europe-west2</span>
          <span className="hidden md:inline">SYSTEM: VE-ENGINE_PRO_v3.1</span>
          <span className={`font-semibold ${simulateInSandbox ? "text-amber-400" : "text-emerald-400"}`}>
            {simulateInSandbox ? "SANDBOX ACTIVE" : "REAL RENDER ACTIVE"}
          </span>
        </div>
        <div className="flex gap-4">
          <span>MEMORY_FLOW: OPTIMIZED</span>
          <span className="text-indigo-500 hidden sm:inline">SECURE CONNECTION TLS_v1.3</span>
        </div>
      </footer>
    </div>
  );
}
