import { createContext, useContext, useEffect, useState } from "react";

/**
 * AuthContext provides authentication state and functions across the app.
 */
const AuthContext = createContext();

/**
 * Custom hook to easily consume the AuthContext.
 */
export function useAuth() {
  return useContext(AuthContext);
}

/**
 * AuthProvider component to wrap the application and provide auth state.
 */
export function AuthProvider({ children }) {
  // --- STATE ---
  const [currentUser, setCurrentUser] = useState(null); // Firebase-like user object
  const [userMeta, setUserMeta] = useState(null);       // Custom user data (role, names, etc.)
  const [loading, setLoading] = useState(true);         // App initialization loader

  // --- API UTILITIES ---

  /**
   * Internal helper for making authentication requests to our Node.js backend.
   * @param {string} endpoint - The auth API endpoint (login or register).
   * @param {object} body - The request body data.
   */
  const callAuthApi = async (endpoint, body) => {
    const response = await fetch(`/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.error || "Authentication failed");
    }
    return data;
  };

  // --- SESSION / STATE SYNC ---
  // Single place to merge server profile/session into localStorage + React state.
  const applyAuthUpdate = (partial) => {
    const prev = JSON.parse(localStorage.getItem("authUser") || "{}");
    const merged = { ...prev, ...(partial || {}) };
    localStorage.setItem("authUser", JSON.stringify(merged));
    updateAuthState(merged);
    return merged;
  };

  // --- AUTH FUNCTIONS ---

  /**
   * Registers a new user via the Node.js backend.
   * @param {string} email - User email.
   * @param {string} password - User password.
   * @param {string} name - Full name (split into first/last on backend).
   */
  async function signup(email, password, name) {
    try {
      const userData = await callAuthApi("register", {
        firstName: name.split(" ")[0] || "",
        lastName: name.split(" ").slice(1).join(" ") || "",
        email,
        password,
        role: "vendor_admin", // Default role
      });

      // Persist session to local storage
      storeSession(userData);

      // Update application state
      updateAuthState(userData);

      return userData;
    } catch (error) {
      console.error("Signup failed:", error);
      throw error;
    }
  }

  /**
   * Authenticates a user via the Node.js backend.
   * @param {string} email - User email.
   * @param {string} password - User password.
   */
  async function login(email, password) {
    try {
      const userData = await callAuthApi("login", { email, password });

      // Persist session to local storage
      storeSession(userData);

      // Update application state
      updateAuthState(userData);

      return userData;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  }

  /**
   * Clears the current session and logs out the user.
   */
  function logout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    localStorage.removeItem("lastRoute");
    setCurrentUser(null);
    setUserMeta(null);
    return Promise.resolve(true);
  }

  /**
   * Sends a password reset email via the custom backend (Mongo-based).
   * @param {string} email - User email to reset.
   */
  async function resetPassword(email) {
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, origin: window.location.origin }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Reset password request failed");
      }
      return await response.json();
    } catch (err) {
      console.error("Reset password request failed:", err);
      throw err;
    }
  }

  /**
   * Updates the current user's metadata in Firestore and local state.
   * @param {object} data - The metadata fields to update.
   */
  async function updateUserMeta(data) {
    if (!currentUser) return;
    try {
      const token = localStorage.getItem("authToken");
      const payload = {
        firstName: data?.name ? String(data.name).split(" ")[0] || "" : data?.firstName,
        lastName: data?.name ? String(data.name).split(" ").slice(1).join(" ") || "" : data?.lastName,
        email: data?.email,
        photoURL: data?.photoURL,
        coverURL: data?.coverURL,
        joined: data?.joined,
        lives: data?.lives,
        website: data?.website,
        about: data?.about,
      };
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Profile update failed");
      }
      applyAuthUpdate(result);
    } catch (err) {
      console.error("Profile update failed:", err);
      throw err;
    }
  }

  /**
   * Refetches the user profile from the backend to sync state.
   */
  async function refreshProfile() {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      const response = await fetch("/api/auth/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          logout();
        }
        throw new Error("Failed to refresh profile");
      }

      const data = await response.json();
      applyAuthUpdate(data);
      return data;
    } catch (err) {
      console.error("Profile refresh failed:", err);
      throw err;
    }
  }

  // --- HELPERS ---

  const storeSession = (data) => {
    localStorage.setItem("authToken", data.token);
    localStorage.setItem("authUser", JSON.stringify(data));
  };

  const updateAuthState = (data) => {
    const firstName = data.firstName || "";
    const lastName = data.lastName || "";
    const fullName = data.name || `${firstName} ${lastName}`.trim();
    setCurrentUser({
      uid: data.id || data.uid,
      email: data.email,
      displayName: fullName,
    });
    setUserMeta({
      firstName,
      lastName,
      name: fullName,
      email: data.email,
      role: data.role,
      subscriptionPlan: data.subscriptionPlan || "free",
      vendorId: data.id || data.uid,
      photoURL: data.photoURL || data.profileImage || "",
      coverURL: data.coverURL || data.coverImage || "",
      joined: data.joined || (data.createdAt ? new Date(data.createdAt).toLocaleDateString() : ""),
      createdAt: data.createdAt,
      lives: data.lives || "",
      website: data.website || "",
      about: data.about || "",
    });
  };

  // --- INITIALIZATION ---

  useEffect(() => {
    // 1. Check local session first (prioritize the custom Node.js backend)
    const token = localStorage.getItem("authToken");
    const storedUser = localStorage.getItem("authUser");

    if (token && storedUser) {
      try {
        updateAuthState(JSON.parse(storedUser));
        setLoading(false);
        return;
      } catch (e) {
        console.error("Session restoration error:", e);
        logout(); // Clear potentially corrupted session
      }
    }
    // No Firebase fallback: fully Mongo/JWT session
    setLoading(false);
    return;
  }, []);

  // --- CONTEXT PROVIDER ---

  const contextValue = {
    currentUser,
    loading,
    userMeta,
    signup,
    login,
    logout,
    resetPassword,
    updateUserMeta,
    refreshProfile,
    applyAuthUpdate,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

