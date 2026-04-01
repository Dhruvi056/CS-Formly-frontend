import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import { Toaster } from "react-hot-toast";

function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  return currentUser ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  // Always allow reset-password page (even if logged in) so links work
  if (location.pathname === "/reset-password") return children;
  if (!currentUser) return children;
  const lastRoute = typeof window !== "undefined" ? localStorage.getItem("lastRoute") : null;
  const target =
    lastRoute &&
    lastRoute !== "/login" &&
    lastRoute !== "/signup" &&
    lastRoute !== "/reset-password"
      ? lastRoute
      : "/";
  return <Navigate to={target} replace />;
}

function RoutePersist() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath !== "/login" && currentPath !== "/signup" && currentPath !== "/reset-password") {
      localStorage.setItem("lastRoute", currentPath);
    }
  }, [location]);

  useEffect(() => {
    if (currentUser) {
      const lastRoute = localStorage.getItem("lastRoute");
      if (lastRoute && lastRoute !== "/" && lastRoute !== "/login" && lastRoute !== "/signup") {
        const timer = setTimeout(() => {
          if (location.pathname === "/") {
            navigate(lastRoute, { replace: true });
          }
        }, 150);
        
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser, location.pathname, navigate]); 

  return null;
}

function AppRoutes() {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!currentUser && (location.pathname === "/" || location.pathname === "")) {
      const timer = setTimeout(() => {
        if (location.pathname === "/" || location.pathname === "") {
          navigate("/login", { replace: true });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentUser, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#f4f5f7",
        color: "#666",
        fontSize: "16px",
      }}>
        Loading…
      </div>
    );
  }

  return (
    <>
      <RoutePersist />
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <Signup />
            </PublicRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicRoute>
              <ResetPassword />
            </PublicRoute>
          }
        />
        <Route
          path="/forms/:formId"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="*"
          element={
            currentUser ? (
              <Navigate to="/" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </>
  );
}

function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme = savedTheme || systemTheme;
    
    document.documentElement.setAttribute('data-bs-theme', initialTheme);
    if (!savedTheme) {
      localStorage.setItem('theme', initialTheme);
    }
  }, []);

  return (
    <ToastProvider>
      <Toaster position="top-right" />
      <Router basename="/">
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ToastProvider>
  );
}

export default App;
