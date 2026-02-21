'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Web Speech API type definitions
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface ToothSelection {
  toothType: string;
  quadrant: string;
}

interface ParsedCommand {
  action: 'select' | 'deselect' | 'clear' | 'unknown';
  teeth: ToothSelection[];
  rawTranscript?: string;
}

interface VoiceCommandProps {
  onCommand: (command: ParsedCommand) => void;
}

// Check if SpeechRecognition is available
const SpeechRecognition: SpeechRecognitionConstructor | null =
  typeof window !== 'undefined'
    ? ((window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
       (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition) ?? null
    : null;

const SILENCE_TIMEOUT_MS = 2000; // Stop after 2 seconds of silence

export default function VoiceCommand({ onCommand }: VoiceCommandProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>('');

  useEffect(() => {
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  const processTranscript = useCallback(async (text: string) => {
    setStatus('processing');
    try {
      const response = await fetch('/api/parse-voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse command');
      }

      const parsed: ParsedCommand = await response.json();
      onCommand(parsed);
      setStatus('idle');
    } catch (error) {
      console.error('Error processing voice command:', error);
      setStatus('error');
      setErrorMessage('Failed to process command');
      setTimeout(() => setStatus('idle'), 2000);
    }
  }, [onCommand]);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setErrorMessage('Speech recognition not supported in this browser');
      setStatus('error');
      return;
    }

    // Stop any existing recognition
    stopListening();

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true; // Keep listening continuously
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Reset silence timeout function
    const resetSilenceTimeout = () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      silenceTimeoutRef.current = setTimeout(() => {
        // Process the final transcript after silence
        if (finalTranscriptRef.current.trim()) {
          processTranscript(finalTranscriptRef.current.trim());
        }
        stopListening();
      }, SILENCE_TIMEOUT_MS);
    };

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('listening');
      setTranscript('');
      setErrorMessage('');
      finalTranscriptRef.current = '';
      resetSilenceTimeout();
    };

    recognition.onresult = (event) => {
      // Build the full transcript from all results
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      finalTranscriptRef.current = finalTranscript;
      setTranscript((finalTranscript + interimTranscript).trim());

      // Reset the silence timeout on any speech
      resetSilenceTimeout();
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      // Don't stop on no-speech error in continuous mode, just reset timeout
      if (event.error === 'no-speech') {
        return;
      }
      stopListening();
      setStatus('error');
      if (event.error === 'not-allowed') {
        setErrorMessage('Microphone access denied');
      } else {
        setErrorMessage(`Error: ${event.error}`);
      }
      setTimeout(() => setStatus('idle'), 2000);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    };

    recognition.start();
  }, [processTranscript, stopListening]);

  if (!isSupported) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 text-gray-500 text-sm border border-gray-200 shadow-sm">
        Voice commands not supported in this browser. Try Chrome or Edge.
      </div>
    );
  }

  const handleButtonClick = useCallback(() => {
    if (isListening) {
      // Stop and process what we have
      if (finalTranscriptRef.current.trim()) {
        processTranscript(finalTranscriptRef.current.trim());
      }
      stopListening();
    } else if (status !== 'processing') {
      startListening();
    }
  }, [isListening, status, processTranscript, stopListening, startListening]);

  return (
    <div className="relative">
      <button
        onClick={handleButtonClick}
        disabled={status === 'processing'}
        className={`p-3 rounded-lg font-medium transition-all flex items-center justify-center ${
          isListening
            ? 'bg-red-500 text-white animate-pulse'
            : status === 'processing'
            ? 'bg-blue-500 text-white'
            : 'bg-white text-gray-700 hover:bg-blue-100 border border-gray-200'
        }`}
        title={status === 'listening' ? 'Click to finish' : status === 'processing' ? 'Processing...' : 'Voice Command'}
      >
        {status === 'listening' ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V22h-2v-6.07z" />
          </svg>
        ) : status === 'processing' ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      {transcript && status !== 'idle' && (
        <div className="absolute bottom-14 right-0 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-gray-200 max-w-xs shadow-sm whitespace-nowrap">
          <p className="text-sm text-gray-700 truncate">&quot;{transcript}&quot;</p>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="absolute bottom-14 right-0 bg-red-50 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-red-200 shadow-sm whitespace-nowrap">
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
