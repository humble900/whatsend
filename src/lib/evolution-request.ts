import { request } from "node:https";
import * as tls from "node:tls";

/** Use trusted OS certificates as well as Node roots; keep TLS verification enabled. */
export async function trustedServerRequest(url: string, init: RequestInit = {}, timeoutMs = 20000, timeoutMessage = "Service request timed out."): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const systemCertificates = (tls as typeof tls & { getCACertificates?: (type: string) => string[] }).getCACertificates?.("system") || [];
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  return new Promise((resolve, reject) => {
    const req = request(parsed, {
      method: init.method || "GET", headers,
      ca: [...tls.rootCertificates, ...systemCertificates],
      rejectUnauthorized: true,
    }, response => {
      const chunks: Buffer[] = [];
      response.on("data", chunk => chunks.push(Buffer.from(chunk)));
      response.on("error", reject);
      response.on("end", () => {
        const responseHeaders = new Headers();
        for (const [key,value] of Object.entries(response.headers)) if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
        const status = response.statusCode || 502;
        resolve(new Response([204,205,304].includes(status) ? null : Buffer.concat(chunks), { status, headers: responseHeaders }));
      });
    });
    const timeout = setTimeout(() => req.destroy(new Error(timeoutMessage)), timeoutMs);
    const abort = () => req.destroy(new Error("Service request was cancelled."));
    if (init.signal?.aborted) abort();
    else init.signal?.addEventListener("abort",abort,{once:true});
    req.on("error", reject);
    req.on("close", () => {clearTimeout(timeout);init.signal?.removeEventListener("abort",abort);});
    req.end(typeof init.body === "string" ? init.body : undefined);
  });
}
export async function evolutionRequest(url: string, init: RequestInit = {}, timeoutMs = 20000) {
  return trustedServerRequest(url,init,timeoutMs,"WhatsApp provider timed out. Check message history before retrying.");
}
