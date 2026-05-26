import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Verifying your email...");
  const [isError, setIsError] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setIsError(true);
      setStatus("Verification token missing.");
      return;
    }

    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setIsError(true);
          setStatus(data.message || "Verification failed.");
          setDone(true);
          return;
        }
        setStatus("Email verified successfully. You can log in now.");
        setDone(true);
      } catch (err) {
        if (!active) return;
        setIsError(true);
        setStatus("Unable to verify email right now.");
        setDone(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [searchParams]);

  return (
    <div className="main-wrapper">
      <div className="page-wrapper full-page">
        <div className="page-content container-xxl d-flex align-items-center justify-content-center">
          <div className="card shadow-sm border-0 p-4" style={{ maxWidth: 520, width: "100%" }}>
            <div className="d-flex justify-content-center mb-3">
              <img
                src={`${process.env.PUBLIC_URL}/assets/images/brand/formbridge-logo.png`}
                alt="formbridge"
              />
            </div>
            <h5 className={`text-center mb-0 ${isError ? "text-danger" : "text-success"}`}>{status}</h5>
            {done && (
              <div className="text-center mt-3">
                <Link className="btn btn-primary" to="/login?verified=1">Go to Login</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
