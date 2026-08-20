<script setup>
defineProps({
    message: { type: Object, required: true },
    luciaAvatar: { type: String, required: true },
    commanderAvatar: { type: String, required: true },
    computerVoiceEnabled: { type: Boolean, default: false },
    mobileVoiceEnabled: { type: Boolean, default: false }
})
defineEmits(['speak'])
const voiceLabel = message => ({
    pending: '等待电脑',
    processing: '正在生成',
    completed: message.voice?.target === 'computer' ? '电脑已播放' : '重新生成',
    failed: '重新尝试'
})[message.voice?.status]
</script>

<template>
    <div
        class="message"
        :class="[
            message.role === 'user' ? 'user-message' : 'ai-message',
            { 'thinking-message': message.thinking, 'streaming-message': message.streaming }
        ]"
    >
        <img
            :src="message.role === 'user' ? commanderAvatar : luciaAvatar"
            :alt="message.role === 'user' ? '指挥官' : '露西亚'"
            class="avatar"
            :class="message.role === 'user' ? 'user-avatar' : 'ai-avatar'"
        >
        <div class="message-bubble">
            <div class="message-heading">
                <span class="message-author">{{ message.role === 'user' ? '指挥官' : '露西亚' }}</span>
                <div
                    v-if="message.role === 'assistant' && !message.localOnly && !message.thinking && !message.streaming && (computerVoiceEnabled || mobileVoiceEnabled)"
                    class="message-voice-controls"
                >
                    <button v-if="computerVoiceEnabled" type="button" class="message-voice-button" title="电脑播放" aria-label="电脑播放" :disabled="['pending', 'processing'].includes(message.voice?.status)" @click="$emit('speak', { message, target: 'computer' })">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Zm12.5 2a4.5 4.5 0 0 0-2-3.74v7.48A4.5 4.5 0 0 0 16.5 12Zm0-8v2.06a6.5 6.5 0 0 1 0 11.88V20a8.5 8.5 0 0 0 0-16Z" /></svg>
                    </button>
                    <button v-if="mobileVoiceEnabled" type="button" class="message-voice-button" title="手机播放" aria-label="手机播放" :disabled="['pending', 'processing'].includes(message.voice?.status)" @click="$emit('speak', { message, target: 'mobile' })">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="m11 10 4 2-4 2v-4Z" /></svg>
                    </button>
                </div>
            </div>
            <p>{{ message.content }}</p>
            <div v-if="message.voice?.status" class="voice-actions">
                <span v-if="message.voice?.target === 'computer'" class="voice-status">{{ voiceLabel(message) }}</span>
                <span v-if="message.voice?.status === 'failed'" class="voice-error">
                    {{ message.voice.error }}
                </span>
                <audio
                    v-if="message.voice?.status === 'completed' && message.voice?.audioUrl"
                    class="voice-player"
                    :src="message.voice.audioUrl"
                    controls
                    preload="none"
                ></audio>
            </div>
        </div>
    </div>
</template>
