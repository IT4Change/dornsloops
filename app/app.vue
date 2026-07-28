<template>
  <div class="app">
    <NuxtPage />

    <footer class="footer">
      <p>
        Alle Loops stammen von ihren jeweiligen Urhebern; die Quelle ist an jedem
        Loop verlinkt. Kein kommerzielles Angebot — bei Fragen oder einer Bitte um
        Entfernung genügt eine Nachricht.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.footer {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
  color: var(--fg-muted);
  font-size: 0.8rem;
  text-align: center;
}

.footer p {
  max-width: 46rem;
  margin: 0 auto;
}
</style>
