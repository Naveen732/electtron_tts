import { FilesetResolver, LlmInference } from '@mediapipe/tasks-genai'

export class LlmRepository {
  constructor() {
    this.llm = null
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
      
    })
    const end = performance.now()

    const loadTime = (end - start).toFixed(2)

    return { loadTime }
    
  }

  async generate(prompt) {
    if (!this.llm) {
      throw new Error('Model not loaded')
    }

    const start = performance.now()
    let response

    if (typeof prompt === "string") {
    response = await this.llm.generateResponse(prompt)
  }

  // handle multimodal prompt
  else if (Array.isArray(prompt)) {
    response = await this.llm.generateResponse(prompt)
  }

  else {
    throw new Error("Invalid prompt format")
  }

    const end = performance.now()

    const inferenceTime = (end - start).toFixed(2)

    return {
      response,
      inferenceTime
    }
  }
  

  async dispose() {
    if (!this.llm) return

    await this.llm.close()
    this.llm = null
  }
}