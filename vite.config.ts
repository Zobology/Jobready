import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      '5173--01a00979-560f-77a6-9d09-bfff8b96b89e.us-east-1-01.gitpod.dev',
    ],
  },
})
