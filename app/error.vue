<script setup lang="ts">
defineProps<{ error: { statusCode: number; message?: string } }>()
</script>

<template>
  <div class="error">
    <h1>{{ error.statusCode }}</h1>
    <p>Hier läuft nichts.</p>
    <NuxtLink class="button" to="/" @click="clearError({ redirect: '/' })">
      Zurück zur Loop-Wand
    </NuxtLink>
  </div>
</template>

<style scoped>
.error {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
}

.error h1 {
  margin: 0;
  font-size: 3rem;
}

.error p {
  margin: 0 0 1rem;
  color: var(--fg-muted);
}

.button {
  text-decoration: none;
}
</style>
