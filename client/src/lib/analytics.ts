declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, string> }) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;

export function installPlausibleAnalytics() {
  if (!plausibleDomain || typeof document === "undefined") {
    return;
  }

  const existing = document.querySelector('script[data-plausible="true"]');
  if (existing) {
    return;
  }

  const script = document.createElement("script");
  script.defer = true;
  script.dataset.domain = plausibleDomain;
  script.dataset.plausible = "true";
  script.src = "https://plausible.io/js/script.js";
  document.head.appendChild(script);
}

export function trackCtaClick(ctaName: string, location: string) {
  const props = { ctaName, location };

  if (typeof window !== "undefined" && typeof window.plausible === "function") {
    window.plausible("Landing CTA Click", { props });
  }

  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "landing_cta_click", props);
  }
}
