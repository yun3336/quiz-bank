import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 本機打包殼：載入 webDir（www），不指向 production Vercel。
 * 建置：npm run native:www && npx cap sync ios
 */
const config: CapacitorConfig = {
  appId: "app.quizbank.practice",
  appName: "題庫刷題",
  webDir: "www",
  server: {
    iosScheme: "capacitor",
    androidScheme: "https",
  },
};

export default config;
