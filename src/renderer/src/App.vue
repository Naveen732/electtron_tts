<script>
import { defineComponent, onMounted } from 'vue'
import { useChatViewModel } from './viewmodels/chatViewModel'
import ChatView from './views/chatview.vue'

export default defineComponent({
  components: { ChatView },

  setup() {
    const vm = useChatViewModel()

    if (vm.init) {
      onMounted(vm.init)
    }

    return vm
  }
})
</script>

<template>
  <ChatView
    :models="models"
    :selected-model="selectedModel"
    :model-load-time-ms="modelLoadTimeMs"
    :model-load-progress="modelLoadProgress"
    :is-loading-model="isLoadingModel"
    :is-model-loaded="isModelLoaded"
    :is-warming-up="isWarmingUp"
    :warmup-time-ms="warmupTimeMs"
    :loaded-model-name="loadedModelName"
    :prompts="prompts"
    :selected-prompt="selectedPrompt"
    :chat-input="chatInput"
    :inferences="inferences"
    :is-recording="isRecording"
    :is-inferencing="isInferencing"
    :is-system-recording="isSystemRecording"
    @update:chat-input="chatInput = $event"
    @update:selected-model="selectedModel = $event"
    @update:selected-prompt="selectedPrompt = $event"
    @update-prompt="updatePrompt"
    @load-model="loadModel"
    @send="sendMessage"
    @start-recording="startRecording"
    @stop-recording="stopRecording"
    @clear-all="clearAll"
    @start-system-audio="startSystemAudio"
    @stop-system-audio="stopSystemAudio"
    @sendToMic="sendToMic"
  />
</template>
