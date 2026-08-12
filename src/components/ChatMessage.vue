<script setup>
defineProps({
    message: { type: Object, required: true },
    luciaAvatar: { type: String, required: true },
    commanderAvatar: { type: String, required: true }
})
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
        </div>
    </div>
</template>
