import { FilesetResolver, LlmInference } from '@mediapipe/tasks-genai'

export class LlmRepository {
  constructor() {
    this.llm = null
    this.isProcessing = false
  }

  wasmPath = window.paths.getWasmUrl()

  async load(modelPath) {
    if (this.llm) return

    const start = performance.now()

    const genai = await FilesetResolver.forGenAiTasks(this.wasmPath)

    this.llm = await LlmInference.createFromOptions(genai, {
      baseOptions: { modelAssetPath: modelPath, delegate: 'gpu' },
      maxTokens: 4096,
      supportAudio: true,
      maxNumImages: 5,
      temperature: 0
    })

    const end = performance.now()

    return { loadTime: (end - start).toFixed(2) }
  }

  async generate(prompt) {
    if (!this.llm) {
      throw new Error('Model not loaded')
    }

 
    if (this.isProcessing) {
      return { response: "", inferenceTime: 0 }
    }

    this.isProcessing = true

    try {
      const start = performance.now()

      let response

      if (typeof prompt === 'string') {
        response = await this.llm.generateResponse(prompt)
      } else if (Array.isArray(prompt)) {
        response = await this.llm.generateResponse(prompt)
      } else {
        throw new Error('Invalid prompt format')
      }

      const end = performance.now()

      return {
        response,
        inferenceTime: (end - start).toFixed(2)
      }

    } finally {
      this.isProcessing = false
    }
  }

  async dispose() {
    if (!this.llm) return

    await this.llm.close()
    this.llm = null
  }
}