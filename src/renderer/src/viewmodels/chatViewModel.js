import { ref, watch } from 'vue'
import { LlmRepository } from '../repositories/llmRepository'
import { TtsRepository } from '../repositories/ttsRepository'

export function useChatViewModel() {
  const repository = new LlmRepository()
  const tts = new TtsRepository()

  const models = ref([
    { name: 'Gemma-3n-E2B', file: 'gemma-3n-E2B-it-int4-Web.litertlm' },
    { name: 'Gemma-3n-E4B', file: 'gemma-3n-E4B-it-int4-Web.litertlm' },
    { name: 'TranslateGemma-4B', file: 'translategemma-4b-it-int8-web.task' }
  ])

  const selectedModel = ref(models.value[0])

  const isModelLoaded = ref(false)
  const isLoadingModel = ref(false)
  const loadedModelName = ref(null)

  const modelLoadProgress = ref(0)
  const modelLoadTimeMs = ref(null)

  const isWarmingUp = ref(false)
  const warmupTimeMs = ref(null)
  const isRecording = ref(false)
  const isSystemRecording = ref(false)
  let audioCtx
  let processor
  let systemStream
  let micStream
  let micAudioCtx
  let micProcessor

  watch(selectedModel, () => {
    isModelLoaded.value = loadedModelName.value === selectedModel.value.name
    modelLoadTimeMs.value = null
    warmupTimeMs.value = null
  })

  function simulateProgress() {
    modelLoadProgress.value = 0
    return setInterval(() => {
      if (modelLoadProgress.value < 90) modelLoadProgress.value += 5
    }, 200)
  }

  async function loadModel() {
    if (isLoadingModel.value) return
    if (loadedModelName.value === selectedModel.value.name) return

    isLoadingModel.value = true
    isModelLoaded.value = false

    const timer = simulateProgress()
    const start = performance.now()

    try {
      await repository.dispose?.()

      const modelPath = window.paths.getModelUrl(selectedModel.value.file)
      await repository.load(modelPath)

      modelLoadTimeMs.value = Math.round(performance.now() - start)
      modelLoadProgress.value = 100

      loadedModelName.value = selectedModel.value.name

      await warmupModel()

      isModelLoaded.value = true
    } catch (err) {
      console.error('Model load failed:', err)
      loadedModelName.value = null
    } finally {
      clearInterval(timer)
      setTimeout(() => (modelLoadProgress.value = 0), 800)
      isLoadingModel.value = false
    }
  }

  async function warmupModel() {
    isWarmingUp.value = true
    const start = performance.now()

    await repository.generate('Say OK')

    warmupTimeMs.value = Math.round(performance.now() - start)
    isWarmingUp.value = false
  }

  const defaultPrompts = [
    {
      label: 'Translate to Tamil',
      template: `You are a professional translator.

Task: Translate the given text to Tamil.

Rules:
- Output ONLY the translated Tamil text
- Do NOT explain
- Do NOT add extra text

Text:
`
    },
    {
      label: 'Translate to Hindi',
      template: `You are a professional translator.

Task: Translate the given text to Hindi.

Rules:
- Output ONLY the translated Hindi text
- Do NOT explain
- Do NOT add extra text

Text:
`
    },
    {
      label: 'Yoda Style',
      template: `Rewrite the following sentence in Yoda’s speaking style.

Rules:
- Keep the same meaning
- Output ONLY the rewritten sentence
- No explanation

Sentence:
`
    },
    {
      label: 'Caesar Style',
      template: `Rewrite the following sentence in the speaking style of Caesar from Planet of the Apes.

Rules:
- Keep meaning
- Output only the rewritten text
- No explanation

Sentence:
`
    }
  ]

  const prompts = ref(JSON.parse(localStorage.getItem('prompts')) || defaultPrompts)

  const selectedPrompt = ref(null)

  function updatePrompt(updatedPrompt) {
    const index = prompts.value.findIndex((p) => p.label === updatedPrompt.label)

    if (index !== -1) {
      prompts.value[index] = updatedPrompt
    }

    selectedPrompt.value = updatedPrompt

    localStorage.setItem('prompts', JSON.stringify(prompts.value))
  }

  const chatInput = ref('')
  const inferences = ref([])
  const isInferencing = ref(false)

  function buildPrompt(text) {
    if (!selectedPrompt.value) {
      return `<start_of_turn>user
${text}
<end_of_turn>
<start_of_turn>model`
    }

    return `<start_of_turn>user
${selectedPrompt.value.template}

${text}
<end_of_turn>
<start_of_turn>model`
  }

  async function sendMessage() {
    if (!chatInput.value.trim()) return
    if (!isModelLoaded.value || isInferencing.value || isWarmingUp.value) return

    const userText = chatInput.value
    chatInput.value = ''

    isInferencing.value = true
    const start = performance.now()

    try {
      const result = await repository.generate(buildPrompt(userText))

      inferences.value.push({
        model: selectedModel.value.name,
        task: selectedPrompt.value?.label || 'Normal Chat',
        input: userText,
        output: result.response,
        timeMs: Math.round(performance.now() - start)
      })
    } finally {
      isInferencing.value = false
    }
  }

  function clearAll() {
    inferences.value = []
  }

  async function startRecording() {
    if (isRecording.value) return
    if (!isModelLoaded.value) return

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true })

      micAudioCtx = new AudioContext()

      const source = micAudioCtx.createMediaStreamSource(micStream)

      micProcessor = micAudioCtx.createScriptProcessor(2048, 1, 1)

      const silent = micAudioCtx.createGain()
      silent.gain.value = 0

      source.connect(micProcessor)
      micProcessor.connect(silent)
      silent.connect(micAudioCtx.destination)

      let pcmBuffer = []

      function resampleTo16k(input, inputRate) {
        const outputRate = 16000
        const ratio = inputRate / outputRate
        const newLength = Math.floor(input.length / ratio)

        const output = new Float32Array(newLength)

        for (let i = 0; i < newLength; i++) {
          const pos = i * ratio
          const left = Math.floor(pos)
          const right = Math.min(left + 1, input.length - 1)
          const frac = pos - left

          output[i] = input[left] * (1 - frac) + input[right] * frac
        }

        return output
      }

      micProcessor.onaudioprocess = async (event) => {
        const input = event.inputBuffer.getChannelData(0)

        pcmBuffer.push(new Float32Array(input))

        const duration = (pcmBuffer.length * 2048) / micAudioCtx.sampleRate

        if (duration >= 2.5) {
          const start = performance.now()

          const merged = new Float32Array(pcmBuffer.length * 2048)

          pcmBuffer.forEach((chunk, i) => {
            merged.set(chunk, i * 2048)
          })

          pcmBuffer = []

          let max = 0
          for (let i = 0; i < merged.length; i++) {
            max = Math.max(max, Math.abs(merged[i]))
          }

          if (max > 0) {
            for (let i = 0; i < merged.length; i++) {
              merged[i] /= max
            }
          }

          let energy = 0
          for (let i = 0; i < merged.length; i++) {
            energy += merged[i] * merged[i]
          }

          const rms = Math.sqrt(energy / merged.length)

          if (rms < 0.01) return

          const resampled = resampleTo16k(merged, micAudioCtx.sampleRate)

          const audioBuffer = micAudioCtx.createBuffer(1, resampled.length, 16000)

          audioBuffer.copyToChannel(resampled, 0)

          try {
            const result = await repository.generate([
              '<start_of_turn>user\n',
              'Transcribe the spoken audio exactly.\n',
              { audioSource: audioBuffer },
              '\n<end_of_turn>\n<start_of_turn>model\n'
            ])

            const newText = result.response.trim()

            if (!newText || newText.toLowerCase() === 'okay.') {
              return
            }

            chatInput.value += (chatInput.value ? ' ' : '') + newText

            const transcriptionTime = Math.round(performance.now() - start)

            console.log('Mic Transcription:', newText)
            console.log('Time:', transcriptionTime, 'ms')
          } catch (err) {
            console.error('Mic transcription error:', err)
          }
        }
      }

      isRecording.value = true
    } catch (err) {
      console.error('Mic error:', err)
      isRecording.value = false
    }
  }
  function stopRecording() {
    if (!micAudioCtx) return

    micProcessor.disconnect()
    micAudioCtx.close()

    micStream.getTracks().forEach((t) => t.stop())

    isRecording.value = false
  }

  async function startSystemAudio() {
    if (isSystemRecording.value) return

    systemStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    })

    const audioTracks = systemStream.getAudioTracks()

    if (!audioTracks.length) {
      console.error('No system audio track')
      return
    }

    audioCtx = new AudioContext()

    const source = audioCtx.createMediaStreamSource(new MediaStream(audioTracks))

    processor = audioCtx.createScriptProcessor(4096, 1, 1)

    source.connect(processor)
    processor.connect(audioCtx.destination)

    let pcmBuffer = []

    processor.onaudioprocess = async (event) => {
      const input = event.inputBuffer.getChannelData(0)

      pcmBuffer.push(new Float32Array(input))

      const duration = (pcmBuffer.length * 4096) / audioCtx.sampleRate

      if (duration >= 5) {
        const start = performance.now()

        const merged = new Float32Array(pcmBuffer.length * 4096)

        pcmBuffer.forEach((chunk, i) => {
          merged.set(chunk, i * 4096)
        })

        pcmBuffer = []

        const audioBuffer = audioCtx.createBuffer(1, merged.length, audioCtx.sampleRate)

        audioBuffer.copyToChannel(merged, 0)

        const result = await repository.generate([
          '<start_of_turn>user\n',
          'Transcribe the spoken audio exactly.\n',
          { audioSource: audioBuffer },
          '\n<end_of_turn>\n<start_of_turn>model\n'
        ])

        const transcriptionTime = Math.round(performance.now() - start)

        const newText = result.response.trim()
        chatInput.value += (chatInput.value ? ' ' : '') + newText

        console.log('Transcription:', result.response)
        console.log('Time:', transcriptionTime, 'ms')
      }
    }

    isSystemRecording.value = true
  }

  function stopSystemAudio() {
    if (!audioCtx) return

    processor.disconnect()
    audioCtx.close()

    systemStream.getTracks().forEach((t) => t.stop())

    isSystemRecording.value = false
  }

  function sendToMic() {
    if (!chatInput.value.trim()) return

    const text = chatInput.value

    tts.speak(text)
  }
  return {
    models,
    selectedModel,

    modelLoadTimeMs,
    modelLoadProgress,
    isLoadingModel,
    isModelLoaded,

    isWarmingUp,
    warmupTimeMs,

    loadModel,

    prompts,
    selectedPrompt,
    updatePrompt,

    chatInput,
    inferences,
    sendMessage,
    clearAll,
    isInferencing,
    loadedModelName,
    isRecording,
    startRecording,
    stopRecording,
    isSystemRecording,
    startSystemAudio,
    stopSystemAudio,
    sendToMic
  }
}
