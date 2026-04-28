# 🎤 Voice Input Feature - Quick Start Guide for Developers

## What Was Added

Three main additions to make the AI Assistant voice-enabled:

### 1. **useVoiceInput Hook** (`client/src/hooks/useVoiceInput.ts`)
- Handles speech-to-text using browser's Web Speech API
- No external dependencies needed
- Returns recording state, transcript, and control functions

### 2. **useAIContext Hook** (`client/src/hooks/useAIContext.ts`)
- Fetches app state data for AI context awareness
- Returns company settings, pending items, employee list
- Uses React Query for caching and deduplication

### 3. **Updated AIAssistantChat Component**
- Added mic button next to send button
- Integrated voice input hook
- Added transcript preview display
- Added error messages for voice issues

---

## 🔧 How to Use (For Developers)

### Using Voice Input in Your Component

```typescript
import { useVoiceInput } from '@/hooks/useVoiceInput';

function MyComponent() {
  const { 
    isRecording, 
    transcript, 
    error, 
    startRecording, 
    stopRecording,
    supportsWebSpeechAPI
  } = useVoiceInput({
    onTranscriptionComplete: (text) => {
      console.log('Transcription:', text);
    },
    language: 'es-ES' // Change language here
  });

  return (
    <div>
      {!supportsWebSpeechAPI && <p>Voice not supported</p>}
      
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop' : 'Start'} Recording
      </button>
      
      {transcript && <p>Transcript: {transcript}</p>}
      {error && <p style={{color: 'red'}}>Error: {error}</p>}
    </div>
  );
}
```

### Using App Context in Your Component

```typescript
import { useAIContext, formatAIContextPrompt } from '@/hooks/useAIContext';

function MyComponent() {
  const { context, isLoading } = useAIContext();

  if (isLoading) return <p>Loading context...</p>;

  return (
    <div>
      <h3>Company: {context.company?.name}</h3>
      <p>Working hours: {context.company?.workingHoursPerDay}h/day</p>
      <p>Employees: {context.employees?.length}</p>
      
      {context.isPendingApprovals && (
        <p>⚠️ You have pending approvals!</p>
      )}

      {/* Use formatted context in AI prompts */}
      <p>{formatAIContextPrompt(context)}</p>
    </div>
  );
}
```

---

## 🎯 Common Tasks

### Task 1: Change Voice Language
Edit `AIAssistantChat.tsx`:
```typescript
const { ... } = useVoiceInput({
  language: 'en-US'  // Change to English, French, German, etc.
});
```

### Task 2: Add Voice Button to Custom Component
```typescript
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { Mic, MicOff } from 'lucide-react';

export function CustomVoiceInput() {
  const { isRecording, startRecording, stopRecording, transcript } = 
    useVoiceInput({ onTranscriptionComplete: (text) => console.log(text) });

  return (
    <>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? <MicOff /> : <Mic />}
      </button>
      {transcript && <span>{transcript}</span>}
    </>
  );
}
```

### Task 3: Use Context in AI Response
```typescript
const { context } = useAIContext();

// Include in system prompt to OpenAI
const systemPrompt = `
Current app state:
- Company: ${context.company?.name}
- Active session: ${context.hasActiveSession}
- Pending approvals: ${context.isPendingApprovals}
- Employees: ${context.employees?.length}
`;
```

### Task 4: Detect Recording State
```typescript
const { isRecording, isListening } = useVoiceInput();

// Disable other inputs while recording
<input disabled={isRecording || isListening} />
```

### Task 5: Handle Voice Errors Gracefully
```typescript
const { error, supportsWebSpeechAPI } = useVoiceInput();

if (!supportsWebSpeechAPI) {
  return <p>Voice input not supported. Please use text.</p>;
}

if (error) {
  return <p>Voice error: {error}</p>;
}
```

---

## 🔍 Debugging

### Check if Web Speech API is supported
```javascript
const supported = !!window.SpeechRecognition || !!window.webkitSpeechRecognition;
console.log('Web Speech API supported:', supported);
```

### Enable verbose logging
Edit `useVoiceInput.ts`:
```typescript
recognition.onstart = () => {
  console.log('[Voice] Listening started'); // ADD THIS
  setIsListening(true);
  // ...
};
```

### Monitor context data
```typescript
const { context } = useAIContext();
console.log('AI Context:', context); // See what data is available
```

### Test microphone access
```javascript
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(() => console.log('Mic access granted'))
  .catch(err => console.error('Mic access denied:', err));
```

---

## 📊 Performance Tips

### 1. Optimize Context Fetching
Only fetch context when needed:
```typescript
const { context, isLoading } = useAIContext();

// Only refresh every 30 seconds minimum
useEffect(() => {
  // Won't refetch if data is fresh
}, [context]);
```

### 2. Cache Voice Preferences
```typescript
// Remember user's language preference
localStorage.setItem('voiceLanguage', 'en-US');
const voiceLanguage = localStorage.getItem('voiceLanguage') || 'es-ES';

const { ... } = useVoiceInput({ language: voiceLanguage });
```

### 3. Debounce Transcript Updates
```typescript
const [debouncedTranscript, setDebouncedTranscript] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedTranscript(transcript);
  }, 500); // Wait 500ms after speech stops

  return () => clearTimeout(timer);
}, [transcript]);
```

---

## 🧪 Testing

### Test Voice Input
```bash
# In browser console:
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(() => console.log('✅ Microphone access granted'))
  .catch(() => console.error('❌ Microphone access denied'));
```

### Test Web Speech API
```javascript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
console.log('✅ Web Speech API available');
```

### Simulate Context Data
```typescript
// In test component:
const mockContext = {
  company: { name: 'Test Company', workingHoursPerDay: 8 },
  employees: [{ id: 1, fullName: 'Test User' }],
  dashboard: { activeSession: null },
  isPendingApprovals: false,
  hasActiveSession: false,
  hasUnreadMessages: false
};
```

---

## 🚀 Deployment Checklist

- [ ] Test on Chrome (desktop + mobile)
- [ ] Test on Firefox
- [ ] Test on Safari (iOS)
- [ ] Test voice in quiet environment
- [ ] Test voice in noisy environment
- [ ] Verify microphone permission flow
- [ ] Check battery drain on mobile
- [ ] Verify text fallback works
- [ ] Load test with multiple users
- [ ] Check network latency impact

---

## ❓ FAQ

**Q: Can I use a different speech recognition service?**
A: Yes, modify `useVoiceInput.ts` to use Whisper API or other services instead of Web Speech API.

**Q: How do I add text-to-speech?**
A: Use `window.speechSynthesis` API. See `FUTURE_ENHANCEMENTS_EXAMPLES.md` for code.

**Q: Can I record audio locally?**
A: Yes, add MediaRecorder API. See MDN docs for implementation.

**Q: How do I support more languages?**
A: Change the `language` prop to any BCP-47 language code (e.g., 'en-US', 'fr-FR', 'de-DE').

**Q: What if the user denies microphone permission?**
A: Text input still works. Error message guides user to allow permission.

**Q: How much does this cost?**
A: Web Speech API is free (part of browser). Whisper API (if used) costs ~$0.02 per 1m audio.

---

## 📚 Resources

### Web Speech API
- [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [W3C Specification](https://w3c.github.io/speech-api/)
- [Browser Support](https://caniuse.com/speech-recognition)

### React Hooks
- [React Hooks Guide](https://react.dev/reference/react)
- [useEffect Cleanup](https://react.dev/reference/react/useEffect#cleaning-up-an-effect)

### Audio APIs
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

## 🆘 Getting Help

1. **Check console logs**: Browser console shows detailed error messages
2. **Test in Chrome**: Chrome has best Web Speech API support
3. **Check permissions**: Settings > Privacy > Microphone
4. **Verify network**: Some APIs may need internet (e.g., Web Speech cloud)
5. **Read documentation**: Full guide in `AI_ASSISTANT_VOICE_ENHANCEMENT.md`

---

## ✅ You're All Set!

The voice input system is ready to use. Start by:

1. Open AI Assistant chat (blue button, bottom-right)
2. Click green mic button
3. Speak your command
4. Watch transcript appear
5. Click send or let it auto-insert

Happy coding! 🎉
