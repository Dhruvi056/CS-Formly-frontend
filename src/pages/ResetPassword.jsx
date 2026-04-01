import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import "../styles/ResetPassword.css";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize Lucide icons if available
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!token) {
      setError("Reset link is invalid or missing.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Reset failed. The link might be expired.");
        return;
      }
      setSuccess(true);
      addToast("Password reset successfully!", "success");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.message || "Reset failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-password-container">
      <div className="reset-card">
        <div className="brand-section">
          <div className="brand-logo">CS <span>Formly</span></div>
        </div>

        <div className="header-section">
          <div className="icon-wrapper">
             <i data-lucide="shield-check" style={{ width: '32px', height: '32px' }}></i>
          </div>
          <h1>Reset Password</h1>
          <p>Please enter your new password below to regain access to your account.</p>
        </div>

        {error && (
          <div className="status-msg status-error">
            <i data-lucide="alert-circle" className="me-2" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }}></i>
            {error}
          </div>
        )}
        {success && !error && (
          <div className="status-msg status-success">
            <i data-lucide="check-circle" className="me-2" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }}></i>
            Password updated. Redirecting to login…
          </div>
        )}

        <form onSubmit={handleReset}>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <i data-lucide="lock" style={{ width: '18px', height: '18px' }}></i>
              </span>
              <input 
                type={showPassword ? "text" : "password"} 
                className="reset-input" 
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <button 
                type="button" 
                className="btn btn-link position-absolute end-0 me-2 text-decoration-none text-muted"
                onClick={() => setShowPassword(!showPassword)}
                style={{ padding: '0 8px' }}
              >
                <i data-lucide={showPassword ? "eye-off" : "eye"} style={{ width: '18px', height: '18px' }}></i>
              </button>
            </div>
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="reset-button"
          >
            {loading ? "Updating Password..." : "Save Password"}
          </button>
        </form>
        
        <button 
          type="button" 
          className="back-link btn btn-link w-100"
          onClick={() => navigate("/login")}
        >
          ← Back to Login
        </button>
      </div>
    </div>
  );
}
