export function getOptionalEnv(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}