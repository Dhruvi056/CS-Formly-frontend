import { useState, useEffect } from "react";
import { useAuthWithToast } from "../hooks/useAuthWithToast";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, resetPassword } = useAuthWithToast();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [lastResetAttempt, setLastResetAttempt] = useState(0);
  const [resetAttempts, setResetAttempts] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);
  const RESET_ATTEMPT_LIMIT = 3;
  const RESET_COOLDOWN_TIME = 60000; // 1 minute in milliseconds

  // Pre-fill email if rememberMe was previously checked
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (loginSuccess && currentUser) {
      setLoading(false);
      toast.success("Welcome back! Logged in successfully.");
      const lastRoute = localStorage.getItem("lastRoute");
      const target =
        lastRoute &&
        lastRoute !== "/login" &&
        lastRoute !== "/signup" &&
        lastRoute !== "/reset-password"
          ? lastRoute
          : "/";
      navigate(target, { replace: true });
      setLoginSuccess(false);
    } else if (loginSuccess && !currentUser) {
      setTimeout(() => {
        if (!currentUser) {
          setFormError("Login failed. Please check your credentials.");
          setLoading(false);
          setLoginSuccess(false);
        }
      }, 500);
    }
  }, [currentUser, loginSuccess, navigate]);

  /**
   * Handles the login form submission.
   */
  async function handleSubmit(e) {
    e.preventDefault();
    
    // Reset errors
    setFieldErrors({ email: "", password: "" });
    setFormError("");

    // --- VALIDATION ---
    const nextErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!emailRegex.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    // --- API CALL ---
    try {
      setLoading(true);
      await login(email, password);

      // Handle "Remember Me"
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      toast.success("Welcome back!", { position: 'top-right' });
      setLoginSuccess(true);

    } catch (err) {
      setLoginSuccess(false);
      setLoading(false);
      
      const errorMessage = err.message || "Failed to log in";
      
      // Handle common auth errors
      if (errorMessage.toLowerCase().includes("invalid") || errorMessage.toLowerCase().includes("incorrect")) {
        setFormError("Invalid email or password. Please check your credentials.");
      } else if (errorMessage.toLowerCase().includes("too many")) {
        setFormError("Too many attempts. Please try again later.");
      } else {
        setFormError(errorMessage);
      }
    }
  }

  /**
   * Handles the forgot password request.
   */
  async function handleForgotPassword(e) {
    e.preventDefault();
    setResetError("");
    setResetSuccess(false);
    setResetLoading(true);

    // Rate limiting protection
    const now = Date.now();
    if (now - lastResetAttempt < RESET_COOLDOWN_TIME && resetAttempts >= RESET_ATTEMPT_LIMIT) {
      const remaining = Math.ceil((RESET_COOLDOWN_TIME - (now - lastResetAttempt)) / 1000);
      setResetError(`Too many attempts. Please wait ${remaining} seconds.`);
      setResetLoading(false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      setResetError("Please enter a valid email address.");
      setResetLoading(false);
      return;
    }

    try {
      setLastResetAttempt(now);
      setResetAttempts(prev => prev + 1);

      await resetPassword(resetEmail);
      
      setResetSuccess(true);
      setResetEmail("");
      setResetAttempts(0);
      
      // Close modal automatically after success
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetSuccess(false);
      }, 3000);

    } catch (err) {
      setResetError(err.message || "Failed to send reset link.");
    } finally {
      setResetLoading(false);
    }
  }
  const [showPassword, setShowPassword] = useState(false);

  // Helper component to render Lucide icons safely
  const LucideIcon = ({ name, className = "", style = {} }) => {
    useEffect(() => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, [name]);

    return (
      <span
        className={`d-inline-flex align-items-center justify-content-center ${className}`}
        style={style}
        dangerouslySetInnerHTML={{ __html: `<i data-lucide="${name}"></i>` }}
      />
    );
  };

  return (
    <div className="main-wrapper">
      <style>
        {`
          .auth-form-input:focus {
            outline: none;
            box-shadow: none;
          }
          .custom-auth-group {
            border: 1px solid #dee2e6;
            border-radius: 4px;
            transition: all 0.2s ease-in-out;
            background-color: #fff;
          }
          .custom-auth-group:focus-within {
             border-color: #e9ecef !important;
             box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
          }
          .eye-icon-btn {
            box-shadow: none !important;
            opacity: 0.6;
            transition: opacity 0.2s;
          }
          .eye-icon-btn:hover {
            opacity: 1;
            background-color: transparent !important;
          }
        `}
      </style>
      <div className="page-wrapper full-page">
        <div className="page-content container-xxl d-flex align-items-center justify-content-center">
          <div className="row w-100 mx-0 auth-page">
            <div className="col-md-8 col-lg-6 col-xl-4 mx-auto">
              <div className="card shadow-sm border-0 overflow-hidden">
                <div className="row">
                  <div className="col-md-12 ps-md-0">
                    <div className="auth-form-wrapper px-4 py-5">
                      <div className="nobleui-logo d-block mb-2 text-center">CS <span>Formly</span></div>
                      <h5 className="text-secondary fw-normal mb-4 text-center">Welcome back! Log in to your account.</h5>

                      {formError && (
                        <div className="alert alert-danger py-2 d-flex align-items-center" role="alert">
                          <LucideIcon name="alert-circle" className="icon-sm me-2" />
                          <span className="fs-13px">{formError}</span>
                        </div>
                      )}

                      <form className="forms-sample" onSubmit={handleSubmit} noValidate>
                        <div className="mb-3">
                          <label className="form-label">Email address</label>
                          <div className={`input-group custom-auth-group ${fieldErrors.email ? "border-danger" : ""}`}>
                            <input
                              type="email"
                              className={`form-control border-0 bg-transparent auth-form-input ${fieldErrors.email ? "is-invalid" : ""}`}
                              placeholder="Email"
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                setFieldErrors((prev) => ({ ...prev, email: "" }));
                              }}
                            />
                          </div>
                          {fieldErrors.email && <div className="invalid-feedback d-block">{fieldErrors.email}</div>}
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Password</label>
                          <div className={`input-group custom-auth-group ${fieldErrors.password ? "border-danger" : ""}`}>
                            <input
                              type={showPassword ? "text" : "password"}
                              className={`form-control border-0 bg-transparent auth-form-input ${fieldErrors.password ? "is-invalid" : ""}`}
                              autoComplete="current-password"
                              placeholder="Password"
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                setFieldErrors((prev) => ({ ...prev, password: "" }));
                              }}
                              style={{
                                backgroundImage: fieldErrors.password ? "none" : undefined,
                                paddingRight: fieldErrors.password ? "0.75rem" : undefined,
                              }}
                            />
                            <button
                              className="btn btn-link d-flex align-items-center bg-transparent border-0 eye-icon-btn px-3"
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              style={{ 
                                textDecoration: 'none', 
                                color: 'inherit'
                              }}
                              title={showPassword ? "Hide password" : "Show password"}
                            >
                              <LucideIcon name={showPassword ? "eye-off" : "eye"} style={{ width: '18px', height: '18px' }} />
                            </button>
                          </div>
                          {fieldErrors.password && <div className="invalid-feedback d-block">{fieldErrors.password}</div>}
                        </div>
                        <div className="mb-3 d-flex justify-content-between align-items-center">
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id="authCheck"
                              checked={rememberMe}
                              onChange={(e) => setRememberMe(e.target.checked)}
                            />
                            <label className="form-check-label ms-1" htmlFor="authCheck" style={{ cursor: 'pointer' }}>
                              Remember me
                            </label>
                          </div>
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none fs-13px"
                            onClick={() => {
                              setShowForgotPassword(true);
                              setResetEmail(email);
                            }}
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="text-center pt-2">
                          <button
                            type="submit"
                            className="btn btn-primary d-block w-100 text-white py-2 mb-3 shadow-sm fw-bold"
                            disabled={loading}
                          >
                            {loading ? "Logging in..." : "Login"}
                          </button>
                        </div>
                        <p className="mt-3 text-secondary text-center fs-14px">
                          Don't have an account? <Link to="/signup" className="text-primary fw-bold text-decoration-none ms-1">Sign up</Link>
                        </p>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Forgot Password Modal (Restructured for Bootstrap) */}
      {showForgotPassword && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail("");
                    setResetError("");
                    setResetSuccess(false);
                    setResetAttempts(0);
                  }}
                ></button>
              </div>
              <div className="modal-body p-4 text-center">
                <div className="mb-4 d-inline-block p-3 bg-primary-subtle rounded-circle">
                  <i className="text-primary fs-1" data-lucide="unlock"></i>
                </div>
                <h4 className="fw-bold mb-2">Reset Password</h4>
                <p className="text-secondary mb-4">Enter your email and we'll send you a link to reset your password</p>

                {resetSuccess && (
                  <div className="alert alert-success text-start" role="alert">
                    <h6 className="alert-heading fw-bold">Email Sent!</h6>
                    Check your inbox for password reset instructions.
                  </div>
                )}

                {!resetSuccess && (
                  <form onSubmit={handleForgotPassword}>
                    <div className="mb-3 text-start">
                      <label className="form-label fw-semibold">Email Address</label>
                      <input
                        type="email"
                        required
                        className={`form-control ${resetError ? 'is-invalid' : ''}`}
                        placeholder="you@example.com"
                        value={resetEmail}
                        onChange={(e) => {
                          setResetEmail(e.target.value);
                          setResetError("");
                        }}
                      />
                      {resetError && <div className="invalid-feedback">{resetError}</div>}
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary w-100 py-2 mb-3 shadow-sm"
                      disabled={resetLoading || (resetAttempts >= RESET_ATTEMPT_LIMIT && Date.now() - lastResetAttempt < RESET_COOLDOWN_TIME)}
                    >
                      {resetLoading ? "Sending Reset Link..." : "Send Reset Link"}
                    </button>
                  </form>
                )}

                <button
                  type="button"
                  className="btn btn-link text-secondary text-decoration-none"
                  onClick={() => setShowForgotPassword(false)}
                >
                  ← Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

