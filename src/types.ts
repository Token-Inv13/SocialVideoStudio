export type ContentType = "storytelling" | "product_demo" | "tutorial" | "informational";

export type TargetPlatform = "shorts" | "reels" | "tiktok" | "youtube";

export type ToneType = "persuasive" | "narrative" | "comedic" | "dynamic";

export interface BrandConfig {
  name: string;
  voiceStyle: string;
  brandColors?: string[];
  additionalConstraints?: string;
}

export interface ScriptScene {
  id: string;
  duration: number;
  visualPrompt: string;
  narration: string;
  cameraMovement: string;
  textOverlay: string;
  audioCue: string;
  
  // App state attributes
  isGeneratingVideo?: boolean;
  isGeneratingImage?: boolean;
  isSimulated?: boolean;
  videoUrl?: string;
  imageUrl?: string;
  operationName?: string;
  renderedDuration?: number;
  error?: string;
}

export interface VideoScript {
  title: string;
  brandVoiceApplied: string;
  formatType: string;
  overallMood: string;
  scenes: ScriptScene[];
  isSimulated?: boolean;
}
