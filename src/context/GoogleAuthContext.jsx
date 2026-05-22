import { createContext, useContext, useEffect, useState } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

const GoogleAuthContext = createContext({
  clientId: "",
  ready: false,
});

export function useGoogleAuth() {
  return useContext(GoogleAuthContext);
}

/**
 * Resolves Google OAuth client ID from build-time env or backend config.
 */
export function GoogleAuthProvider({ children }) {
  const buildTimeClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
  const [clientId, setClientId] = useState(buildTimeClientId);
  const [ready, setReady] = useState(!!buildTimeClientId);

  useEffect(() => {
    if (buildTimeClientId) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/auth/config");
        if (!response.ok) throw new Error("config fetch failed");
        const data = await response.json();
        if (!cancelled) {
          setClientId(data.googleClientId || "");
        }
      } catch {
        if (!cancelled) setClientId("");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [buildTimeClientId]);

  const contextValue = { clientId, ready: ready || !!buildTimeClientId };

  const inner = (
    <GoogleAuthContext.Provider value={contextValue}>
      {children}
    </GoogleAuthContext.Provider>
  );

  if (!contextValue.clientId) {
    return inner;
  }

  return (
    <GoogleOAuthProvider clientId={contextValue.clientId}>
      {inner}
    </GoogleOAuthProvider>
  );
}
