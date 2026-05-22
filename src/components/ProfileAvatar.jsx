import { useState, useEffect } from "react";
import { resolveAvatarUrl, isExternalAvatarUrl } from "../utils/avatarUrl";

function LucideIcon({ name, className = "", style = {} }) {
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
}

/**
 * Profile image with validation, Google CDN referrer policy, and fallback icon.
 */
export default function ProfileAvatar({
  src,
  size = 38,
  iconSize = "icon-sm",
  className = "",
  wrapperClassName = "rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center border",
}) {
  const safeSrc = resolveAvatarUrl(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [safeSrc]);

  const showImage = safeSrc && !failed;

  return (
    <div
      className={wrapperClassName}
      style={{ width: size, height: size, overflow: "hidden", flexShrink: 0 }}
    >
      {showImage ? (
        <img
          src={safeSrc}
          alt=""
          className={`w-100 h-100 object-fit-cover ${className}`}
          referrerPolicy={isExternalAvatarUrl(safeSrc) ? "no-referrer" : undefined}
          onError={() => setFailed(true)}
        />
      ) : (
        <LucideIcon name="user" className={`${iconSize} text-primary`} style={size > 50 ? { width: size * 0.5, height: size * 0.5 } : undefined} />
      )}
    </div>
  );
}
