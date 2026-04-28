import { useState, useEffect } from "react";
import { useAuthWithToast } from "../hooks/useAuthWithToast";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";

export default function Signup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuthWithToast();
  const navigate = useNavigate();

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

  const [fieldErrors, setFieldErrors] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  /**
   * Handles the signup form submission.
   */
  async function handleSubmit(e) {
    e.preventDefault();
    
    // Reset errors
    setFieldErrors({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
    setFormError("");

    // --- VALIDATION ---
    const newFieldErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;

    if (!firstName.trim()) newFieldErrors.firstName = "First name is required.";
    if (!lastName.trim()) newFieldErrors.lastName = "Last name is required.";
    
    if (!email.trim()) {
      newFieldErrors.email = "Email is required.";
    } else if (!emailRegex.test(email.trim())) {
      newFieldErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      newFieldErrors.password = "Password is required.";
    } else if (!passwordRegex.test(password)) {
      newFieldErrors.password ="Password must include uppercase, lowercase , number and special character  (min 6 chars)";
  }

    if (!confirmPassword) {
      newFieldErrors.confirmPassword = "Confirm password is required.";
    } else if (password !== confirmPassword) {
      newFieldErrors.confirmPassword = "Passwords do not match.";
    }

    // Stop if there are validation errors
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }

    // --- API CALL ---
    try {
      setLoading(true);
      const fullName = `${firstName} ${lastName}`.trim();
      
      await signup(email, password, fullName);
      
      toast.success("Welcome! Your account has been created.", { position: 'top-right' });
      navigate("/");
      
    } catch (err) {
      console.error("Signup error:", err);
      
      const errorMessage = err.message || "Something went wrong. Please try again.";
      
      // Handle specific backend error cases
      if (errorMessage.toLowerCase().includes("exists")) {
        setFieldErrors(prev => ({ ...prev, email: "This email is already registered." }));
      } else {
        setFormError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }

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
            <div className="col-md-6 col-lg-4 col-xl-5 mx-auto">
              <div className="card shadow-sm border-0 overflow-hidden">
                <div className="row">
                  <div className="col-md-12 ps-md-0">
                    <div className="auth-form-wrapper px-4 py-5">
                      <div className="nobleui-logo d-block mb-2 text-center">CS <span>Formly</span></div>
                      <h5 className="text-secondary fw-normal mb-4 text-center">Create a free account.</h5>

                      {formError && (
                        <div className="alert alert-danger py-2 d-flex align-items-center" role="alert">
                          <LucideIcon name="alert-circle" className="icon-sm me-2" />
                          <span className="fs-13px">{formError}</span>
                        </div>
                      )}

                      <form className="forms-sample" onSubmit={handleSubmit} noValidate>
                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label className="form-label">First Name</label>
                            <div className={`input-group custom-auth-group ${fieldErrors.firstName ? "border-danger" : ""}`}>
                              <input
                                type="text"
                                className={`form-control border-0 bg-transparent auth-form-input ${fieldErrors.firstName ? "is-invalid" : ""}`}
                                placeholder="First Name"
                                value={firstName}
                                onChange={(e) => {
                                  setFirstName(e.target.value);
                                  setFieldErrors((prev) => ({ ...prev, firstName: "" }));
                                }}
                              />
                            </div>
                            {fieldErrors.firstName && <div className="invalid-feedback d-block">{fieldErrors.firstName}</div>}
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Last Name</label>
                            <div className={`input-group custom-auth-group ${fieldErrors.lastName ? "border-danger" : ""}`}>
                              <input
                                type="text"
                                className={`form-control border-0 bg-transparent auth-form-input ${fieldErrors.lastName ? "is-invalid" : ""}`}
                                placeholder="Last Name"
                                value={lastName}
                                onChange={(e) => {
                                  setLastName(e.target.value);
                                  setFieldErrors((prev) => ({ ...prev, lastName: "" }));
                                }}
                              />
                            </div>
                            {fieldErrors.lastName && <div className="invalid-feedback d-block">{fieldErrors.lastName}</div>}
                          </div>
                        </div>
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
                              autoComplete="new-password"
                              placeholder="Password"
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                setFieldErrors((prev) => ({ ...prev, password: "" }));
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
                        <div className="mb-3">
                          <label className="form-label">Confirm Password</label>
                          <div className={`input-group custom-auth-group ${fieldErrors.confirmPassword ? "border-danger" : ""}`}>
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              className={`form-control border-0 bg-transparent auth-form-input ${fieldErrors.confirmPassword ? "is-invalid" : ""}`}
                              autoComplete="new-password"
                              placeholder="Confirm Password"
                              value={confirmPassword}
                              onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
                              }}
                            />
                            <button
                              className="btn btn-link d-flex align-items-center bg-transparent border-0 eye-icon-btn px-3"
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              style={{ 
                                textDecoration: 'none', 
                                color: 'inherit'
                              }}
                              title={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                              <LucideIcon name={showConfirmPassword ? "eye-off" : "eye"} style={{ width: '18px', height: '18px' }} />
                            </button>
                          </div>
                          {fieldErrors.confirmPassword && (
                            <div className="invalid-feedback d-block">{fieldErrors.confirmPassword}</div>
                          )}
                        </div>
                        <div className="text-center pt-2">
                          <button
                            type="submit"
                            className="btn btn-primary d-block w-100 text-white py-2 mb-3 shadow-sm fw-bold"
                            disabled={loading}
                          >
                            {loading ? "Creating account..." : "Sign Up"}
                          </button>
                        </div>
                        <p className="mt-3 text-secondary text-center fs-14px">
                          Already have an account? <Link to="/login" className="text-primary fw-bold text-decoration-none ms-1">Log in</Link>
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
    </div>
  );
}

