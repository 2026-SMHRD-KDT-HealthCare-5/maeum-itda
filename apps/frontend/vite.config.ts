import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // README가 개발 서버를 http://localhost:5173으로 문서화해두고 있어서,
  // 포트가 막혀 있을 때 Vite가 조용히 다음 포트로 넘어가지 않고 바로 에러를 내게 한다.
  server: {
    port: 5173,
    strictPort: true,
  },
})
