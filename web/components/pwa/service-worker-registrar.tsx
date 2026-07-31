"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js, which is what makes the browser offer "Install".
 * Renders nothing.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        // Not fatal: the app works fine, it just will not be installable.
        console.warn("Service worker registration failed:", error);
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
