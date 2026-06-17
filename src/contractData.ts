/**
 * V-GEN PRO - Architecture Storyboard Contract
 * JSON Schema standard representing a complete high-fidelity video production sequence,
 * and a fully-formed compliance instance for a 3-scene marketing campaign video.
 */

export const STORYBOARD_JSON_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "StoryboardContract",
  "description": "Rigid design schema for multimodal video scripting generation, mapped directly for Google Veo / Vertex AI video ingestion engines.",
  "type": "object",
  "required": [
    "metadata",
    "scenes"
  ],
  "properties": {
    "metadata": {
      "type": "object",
      "description": "Global settings and identity parameters for the video production output.",
      "required": [
        "title",
        "aspect_ratio",
        "global_stylistic_tone"
      ],
      "properties": {
        "title": {
          "type": "string",
          "description": "Overall campaign or video project title",
          "example": "V-Gen Smart App Release Campaign"
        },
        "aspect_ratio": {
          "type": "string",
          "enum": ["9:16", "16:9"],
          "description": "Horizontal (16:9) or Vertical (9:16) viewport formats."
        },
        "global_stylistic_tone": {
          "type": "string",
          "description": "Tone directive used to maintain voice consistency (e.g. Persuasive, Narrative, Comedic, High-end Corporate).",
          "example": "Persuasive and highly energetic with tech-accents"
        },
        "brand_voice_signature": {
          "type": "string",
          "description": "Optional custom editorial style signature."
        }
      }
    },
    "scenes": {
      "type": "array",
      "description": "Sequential array of chronological scenes comprising the final video structure.",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": [
          "id",
          "visual_prompt",
          "voice_over_text",
          "duration",
          "audio_notes"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "Chronological unique alphanumeric identifier for the scene.",
            "pattern": "^[a-zA-Z0-9_-]+$"
          },
          "visual_prompt": {
            "type": "string",
            "description": "Exhaustive cinematic instruction for the Veo model. Must details lighting, colors, camera movements (track, slide, zoom), and specific focal structures in English.",
            "example": "Macro camera shot of shiny robotic fingers typing on a futuristic glass neon keyboard. Glowing cyan data flows, dramatic contrast, cinematic shallow-depth-of-field, 4K rendering."
          },
          "voice_over_text": {
            "type": "string",
            "description": "Spoken teleprompter text or automated voiceover script accompanying this segment."
          },
          "duration": {
            "type": "integer",
            "minimum": 1,
            "maximum": 60,
            "description": "Scene playback duration in seconds."
          },
          "audio_notes": {
            "type": "string",
            "description": "Directions for ambient audio, background score pacing, sound FX triggers, or musical category guides.",
            "example": "Sleek physical keys tick sound-effect, backed by spacey growing lo-fi synth beats"
          },
          "image_reference_id": {
            "type": "string",
            "description": "Optional base64 reference or image ID descriptor to switch execution to multi-modal Image-to-Video generation style."
          }
        }
      }
    }
  }
};

export const MOCK_MARKETING_STORYBOARD_JSON_INSTANCE = {
  "metadata": {
    "title": "V-Gen Pro - Lancement de l'Application Révolutionnaire",
    "aspect_ratio": "9:16",
    "global_stylistic_tone": "Persuasive, dynamic, high-retention hook styling for social media",
    "brand_voice_signature": "TechPulse (Direct, captivant, orienté innovation)"
  },
  "scenes": [
    {
      "id": "scene_01",
      "visual_prompt": "First 2 seconds hyper-hook: Extreme close-up of a human finger tapping a glowing virtual holographic 'Go' button hovering in mid-air. Millions of teal light particles burst outwards directly towards the camera, high energy, fast zoom-in, volumetric neon glow, cyberpunk aesthetics.",
      "voice_over_text": "Arrêtez tout ! Voici l'application intelligente qui va libérer 10 heures par semaine de votre temps !",
      "duration": 5,
      "audio_notes": "Heavy bass drop impact directly at second 0.5, followed by building upbeat modern electro drums.",
      "image_reference_id": "img_ref_launcher_button"
    },
    {
      "id": "scene_02",
      "visual_prompt": "Cinematic floating view of an elegant smartphone resting on a matte dark desk. Beautiful visual animations of interactive colorful graphics and video scenes flowing out of the phone's glass screen. Soft ambient office lighting, cinematic slow pan from left to right, high-fidelity lens flares.",
      "voice_over_text": "En un seul clic, connectez vos médias, configurez en quelques secondes, et laissez l'intelligence artificielle générer vos films en qualité studio.",
      "duration": 8,
      "audio_notes": "Rhythmic hi-hats acceleration, synthesizer arpeggios dancing softly in the background.",
      "image_reference_id": "img_ref_mockup_screen"
    },
    {
      "id": "scene_03",
      "visual_prompt": "Close-up tracking of a smiling, excited digital creator looking at their computer screen with warm reflections of orange charts and metric lines glowing in their eyes. Cozy, modern room, high-contrast twilight glow, professional depth of field, subtle lock-on focus.",
      "voice_over_text": "Plus de 1000 créateurs l'utilisent déjà pour multiplier leurs vues par dix. Cliquez sur le lien ci-dessous et commencez gratuitement !",
      "duration": 7,
      "audio_notes": "Inspiring synth crescendo leading up to a vibrant and bright sound effect chime.",
      "image_reference_id": "img_ref_creator_close_up"
    }
  ]
};
