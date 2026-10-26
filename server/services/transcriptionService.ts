/**
 * Mindly 2.0 Transcription Service
 * Pluggable speech-to-text service abstraction.
 * Uses Google Gemini 3.5 Transcribe ('gemini-3.5-transcribe') via @google/genai by default.
 * Architecture is modular and configurable via TRANSCRIPTION_PROVIDER env var.
 */
import { GoogleGenAI } from '@google/genai';

let genAIClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

export interface TranscribeAudioOptions {
  audioBase64: string;
  mimeType?: string;
  promptHint?: string;
  mode?: 'voice_note' | 'capture_lesson';
}

export interface TranscriptionResult {
  transcript: string;
  provider: string;
  detectedLanguage?: string;
  durationSecondsEstimate?: number;
  wordCount: number;
}

export interface ITranscriptionService {
  transcribe(options: TranscribeAudioOptions): Promise<TranscriptionResult>;
}

export class GeminiTranscriptionService implements ITranscriptionService {
  async transcribe(options: TranscribeAudioOptions): Promise<TranscriptionResult> {
    const { audioBase64, mimeType = 'audio/webm', promptHint, mode = 'capture_lesson' } = options;

    if (!audioBase64 || audioBase64.length < 20) {
      throw new Error('Audio data is required and must not be empty.');
    }

    // Clean data URL prefix if present
    const cleanBase64 = audioBase64.replace(/^data:[a-zA-Z0-9\/\-\+]+;base64,/, '');

    const ai = getAIClient();

    const systemInstruction = mode === 'voice_note'
      ? `You are an accurate, verbatim speech-to-text transcriber for personal voice study notes.
Transcribe all spoken words clearly and accurately with proper punctuation and paragraphs.
Do not omit terms or technical vocabulary. Output ONLY the clean verbatim transcription.`
      : `You are an educational lecture and presentation transcriber for Mindly.
Transcribe spoken academic lectures, tutorials, classes, and explanations verbatim with high fidelity.
Format the transcription into organized paragraphs where the speaker naturally shifts topics or pauses.
Correctly transcribe specialized subject terminology, mathematical terms, coding syntax, or technical jargon.
Output ONLY the clean, full transcription without conversational commentary.`;

    const userPrompt = promptHint
      ? `Transcribe the attached audio accurately. Speaker context/topic hint: ${promptHint}`
      : `Transcribe the attached audio accurately.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: `${systemInstruction}\n\n${userPrompt}`,
            },
          ],
        },
      ],
    });

    const transcript = response.text?.trim() || '';

    if (!transcript) {
      throw new Error('Transcription service returned an empty transcript. Please verify audio clarity.');
    }

    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    // Estimate ~140 words per minute of speech
    const durationSecondsEstimate = Math.round((wordCount / 140) * 60);

    return {
      transcript,
      provider: 'gemini-3.5-transcribe',
      wordCount,
      durationSecondsEstimate,
    };
  }
}

// Service Factory allowing pluggable transcription providers
export function getTranscriptionService(): ITranscriptionService {
  const provider = (process.env.TRANSCRIPTION_PROVIDER || 'gemini').toLowerCase();
  switch (provider) {
    case 'gemini':
    default:
      return new GeminiTranscriptionService();
  }
}

export const transcriptionService = getTranscriptionService();
