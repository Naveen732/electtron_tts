export class TtsRepository {
  speak(text) {
    if (!text) return

    const utterance = new SpeechSynthesisUtterance(text)

    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    

    speechSynthesis.speak(utterance)
  }
} 