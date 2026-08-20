<script setup>
defineProps({
    message: { type: Object, required: true },
    luciaAvatar: { type: String, required: true },
    commanderAvatar: { type: String, required: true }
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
            <span class="message-author">{{ message.role === 'user' ? '指挥官' : '露西亚' }}</span>
            <p>{{ message.content }}</p>
            <div
                v-if="message.role === 'assistant' && !message.localOnly && !message.thinking && !message.streaming"
                class="voice-actions"
            >
                <button
                    type="button"
                    class="voice-button"
                    :disabled="['pending', 'processing'].includes(message.voice?.status)"
                    @click="$emit('speak', { message, target: 'computer' })"
                >
                    {{ message.voice?.target === 'computer' ? voiceLabel(message) : '电脑播放' }}
                </button>
                <button
                    type="button"
                    class="voice-button"
                    :disabled="['pending', 'processing'].includes(message.voice?.status)"
                    @click="$emit('speak', { message, target: 'mobile' })"
                >
                    {{ message.voice?.target === 'mobile' ? voiceLabel(message) : '手机播放' }}
                </button>
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
