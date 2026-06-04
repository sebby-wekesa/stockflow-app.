export const APP_URL = "https://stockflow-app-beta.vercel.app";

export function getAuthCallbackUrl() {
  return `${APP_URL}/auth/callback`;
}
