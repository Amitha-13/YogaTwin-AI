import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Target of the standalone Yoga Pose Correction engine (Node + tfjs-node).
  // Override with CORRECTION_ENGINE_URL when the engine runs elsewhere.
  const correctionTarget = env.CORRECTION_ENGINE_URL || 'http://127.0.0.1:3002'

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Only the correction-specific routes are proxied, each mapped from the
        // dedicated '/correction-api' prefix to the engine's native '/api'
        // namespace. Scoping to these exact paths means the engine's bundled
        // (and conflicting) auth/session/practice routes are NEVER reachable
        // from the frontend. Same-origin via the proxy → no CORS needed.
        '/correction-api/analyze-frame': {
          target: correctionTarget,
          changeOrigin: true,
          ws: false,
          rewrite: (path) => path.replace(/^\/correction-api/, '/api'),
        },
        '/correction-api/ollama-feedback': {
          target: correctionTarget,
          changeOrigin: true,
          ws: false,
          rewrite: (path) => path.replace(/^\/correction-api/, '/api'),
        },
        '/correction-api/poses': {
          target: correctionTarget,
          changeOrigin: true,
          ws: false,
          rewrite: (path) => path.replace(/^\/correction-api/, '/api'),
        },
        '/correction-api/ideal-landmarks': {
          target: correctionTarget,
          changeOrigin: true,
          ws: false,
          rewrite: (path) => path.replace(/^\/correction-api/, '/api'),
        },
      },
    },
  }
})
