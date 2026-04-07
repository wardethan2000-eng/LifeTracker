import type { JSX, ReactNode } from "react";

type BannerTone = "info" | "success" | "warning" | "danger";

type BannerProps = {
  tone?: BannerTone;
  title?: string;
  children: ReactNode;
};

const BannerIcon = ({ tone }: { tone: BannerTone }): JSX.Element => {
  switch (tone) {
    case "success":
      return (
        <svg className="banner__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      );
    case "warning":
      return (
        <svg className="banner__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      );
    case "danger":
      return (
        <svg className="banner__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      );
    default:
      return (
        <svg className="banner__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      );
  }
};

export function Banner({ tone = "info", title, children }: BannerProps): JSX.Element {
  return (
    <div className={`banner banner--${tone}`} role={tone === "danger" || tone === "warning" ? "alert" : "note"}>
      <BannerIcon tone={tone} />
      <div className="banner__body">
        {title ? <p className="banner__title">{title}</p> : null}
        <p className="banner__message">{children}</p>
      </div>
    </div>
  );
}
