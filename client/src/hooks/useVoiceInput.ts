import { useState, useRef, useCallback } from 'react';

interface UseVoiceInputOptions {
  onTranscriptionComplete?: (text: string) => void;
  language?: string;
}

export function useVoiceInput({ onTranscriptionComplete, language = 'es-ES' }: UseVoiceInputOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Check if browser supports Web Speech API
  const supportsWebSpeechAPI = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return !!SpeechRecognition;
  }, []);

  // Initialize speech recognition
  const initializeSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Tu navegador no soporta reconocimiento de voz. Por favor, usa Chrome, Firefox o Edge.');
      return false;
    }

    const recognition = new SpeechRecognition();
    
    // Configuration for Spanish language
    recognition.language = language;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          setTranscript(prev => prev + transcript + ' ');
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Show interim results to user while they're speaking
      if (interimTranscript) {
        setTranscript(prev => {
          const base = prev.split(' ').slice(0, -1).join(' ');
          return base ? base + ' ' + interimTranscript : interimTranscript;
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      let errorMessage = 'Error en el reconocimiento de voz';
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No se detectó audio. Por favor, intenta de nuevo.';
          break;
        case 'audio-capture':
          errorMessage = 'No se puede acceder al micrófono. Verifica los permisos.';
          break;
        case 'network':
          errorMessage = 'Error de conexión. Intenta de nuevo.';
          break;
        case 'not-allowed':
          errorMessage = 'Acceso al micrófono denegado. Verifica los permisos del navegador.';
          break;
      }
      
      setError(errorMessage);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsRecording(false);
      
      if (transcript.trim() && onTranscriptionComplete) {
        onTranscriptionComplete(transcript.trim());
      }
    };

    recognitionRef.current = recognition;
    return true;
  }, [language, transcript, onTranscriptionComplete]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      if (!supportsWebSpeechAPI()) {
        setError('Tu navegador no soporta reconocimiento de voz');
        return;
      }

      // Request microphone permission
      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
      } catch (permError: any) {
        if (permError.name === 'NotAllowedError') {
          setError('Debes permitir el acceso al micrófono para usar esta función.');
        } else {
          setError('No se puede acceder al micrófono. Verifica que no esté siendo usado por otra aplicación.');
        }
        return;
      }

      setIsRecording(true);
      setTranscript('');
      
      if (!recognitionRef.current) {
        initializeSpeechRecognition();
      }

      recognitionRef.current?.start();
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setError('Error al iniciar el grabador de voz');
      setIsRecording(false);
    }
  }, [supportsWebSpeechAPI, initializeSpeechRecognition]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    setIsRecording(false);
  }, []);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    isRecording,
    isListening,
    transcript,
    error,
    startRecording,
    stopRecording,
    clearTranscript,
    supportsWebSpeechAPI: supportsWebSpeechAPI(),
  };
}
