import { useEffect } from "react";
import { useToast } from "../context/ToastContext";

export default function FormToastListener() {
  const { addToast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("form") === "success") {
      addToast("Form submitted successfully!", "success");

      params.delete("form");
      const newUrl =
        window.location.pathname +
        (params.toString() ? `?${params.toString()}` : "");

      window.history.replaceState({}, "", newUrl);
    }

    if (params.get("form") === "error") {
      addToast("Form submission failed", "error");

      params.delete("form");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [addToast]);

  return null;
}
