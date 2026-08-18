"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserSteamInput } from "@/components/UserSteamInput";
import { useUserSteamId } from "@/lib/useUserSteamId";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userSteamId } = useUserSteamId();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu whenever the route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile fullscreen menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const isProfileActive =
    !!userSteamId &&
    (pathname === `/profile/${encodeURIComponent(userSteamId)}` ||
      pathname.startsWith(`/profile/${userSteamId}`));

  return (
    <div className="app-shell">
      {/* Mobile Header Bar */}
      <header className="mobile-header">
        <Link
          className="brand-title"
          href="/"
          style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <img
            src="/kz-logo.png"
            alt="CS2KZ"
            style={{
              width: "28px",
              height: "28px",
              objectFit: "contain",
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 800, fontSize: "16px", letterSpacing: "0.02em", color: "#ffffff" }}>
            CS2KZ <span style={{ fontWeight: 500, color: "var(--text-subtle)" }}>Viewer</span>
          </span>
        </Link>

        {/* Mobile Menu Trigger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 12px",
            color: "#ffffff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          <span>{mobileMenuOpen ? "✕" : "☰"}</span>
          <span>{mobileMenuOpen ? "Close" : "Menu"}</span>
        </button>
      </header>

      {/* Fullscreen Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-fullscreen-menu"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "var(--bg)",
            display: "flex",
            flexDirection: "column",
            padding: "20px",
            overflowY: "auto",
          }}
        >
          {/* Menu Top Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "16px",
              borderBottom: "1px solid var(--border)",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img
                src="/kz-logo.png"
                alt="CS2KZ"
                style={{ width: "30px", height: "30px", objectFit: "contain" }}
              />
              <span style={{ fontWeight: 800, fontSize: "17px", color: "#ffffff" }}>
                CS2KZ <span style={{ fontWeight: 500, color: "var(--text-subtle)" }}>Viewer</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 14px",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* Navigation Links */}
          <nav
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginBottom: "32px",
            }}
          >
            <Link
              className={`mobile-nav-link ${pathname === "/" ? "active" : ""}`}
              href="/"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span style={{ fontSize: "18px", fontWeight: 700 }}>Home</span>
              <span style={{ color: "var(--text-subtle)", fontSize: "12px" }}>Dashboard & Stats</span>
            </Link>

            <Link
              className={`mobile-nav-link ${pathname === "/maps" || pathname.startsWith("/maps/") ? "active" : ""}`}
              href="/maps"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span style={{ fontSize: "18px", fontWeight: 700 }}>All Maps</span>
              <span style={{ color: "var(--text-subtle)", fontSize: "12px" }}>Browse & Search Catalog</span>
            </Link>

            <Link
              className={`mobile-nav-link ${pathname === "/leaderboards" ? "active" : ""}`}
              href="/leaderboards"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span style={{ fontSize: "18px", fontWeight: 700 }}>Leaderboards</span>
              <span style={{ color: "var(--text-subtle)", fontSize: "12px" }}>Global Rankings & WRs</span>
            </Link>

            <Link
              className={`mobile-nav-link ${pathname === "/servers" ? "active" : ""}`}
              href="/servers"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span style={{ fontSize: "18px", fontWeight: 700 }}>Servers</span>
              <span style={{ color: "var(--text-subtle)", fontSize: "12px" }}>Live Global CKZ Servers</span>
            </Link>

            {userSteamId && (
              <Link
                className={`mobile-nav-link ${isProfileActive ? "active" : ""}`}
                href={`/profile/${encodeURIComponent(userSteamId)}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span style={{ fontSize: "18px", fontWeight: 700 }}>My Profile</span>
                <span style={{ color: "var(--text-subtle)", fontSize: "12px" }}>Personal Bests & Progress</span>
              </Link>
            )}
          </nav>

          {/* Steam ID Tracker Box */}
          <div
            style={{
              marginTop: "auto",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <UserSteamInput />

            <div style={{ paddingTop: "10px", borderTop: "1px solid var(--border)" }}>
              <a
                href="https://github.com/lukewae/kz-dashboard"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: "var(--text-subtle)",
                  fontSize: "12px",
                  fontFamily: "ui-monospace, monospace",
                  textDecoration: "none",
                }}
              >
                <span>lukewae/kz-dashboard</span>
                <span style={{ opacity: 0.7 }}>GitHub ↗</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar (100% untouched for PC) */}
      <aside className="app-sidebar">
        <Link className="sidebar-brand-block" href="/" title="CS2KZ Viewer Home">
          <img
            src="/kz-logo.png"
            alt="CS2KZ"
            style={{
              width: "32px",
              height: "32px",
              objectFit: "contain",
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 800, fontSize: "16px", letterSpacing: "0.02em", color: "#ffffff" }}>
            CS2KZ <span style={{ fontWeight: 500, color: "var(--text-subtle)" }}>Viewer</span>
          </span>
        </Link>

        <nav className="sidebar-nav-section">
          <div className="sidebar-nav-label">Menu</div>

          <Link
            className={`nav-link ${pathname === "/" ? "active" : ""}`}
            href="/"
          >
            <span>Home</span>
          </Link>

          <Link
            className={`nav-link ${pathname === "/maps" || pathname.startsWith("/maps/") ? "active" : ""}`}
            href="/maps"
          >
            <span>All Maps</span>
          </Link>

          <Link
            className={`nav-link ${pathname === "/leaderboards" ? "active" : ""}`}
            href="/leaderboards"
          >
            <span>Leaderboards</span>
          </Link>

          <Link
            className={`nav-link ${pathname === "/servers" ? "active" : ""}`}
            href="/servers"
          >
            <span>Servers</span>
          </Link>

          {userSteamId && (
            <Link
              className={`nav-link ${isProfileActive ? "active" : ""}`}
              href={`/profile/${encodeURIComponent(userSteamId)}`}
            >
              <span>My Profile</span>
            </Link>
          )}
        </nav>

        {/* Bottom Section: Tracker Box & GitHub Repo Info */}
        <div className="sidebar-bottom">
          <UserSteamInput />

          <div className="sidebar-meta">
            <a
              href="https://github.com/lukewae/kz-dashboard"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "var(--text-subtle)",
                textDecoration: "none",
                fontSize: "11px",
                fontFamily: "ui-monospace, monospace",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-subtle)";
              }}
              title="View lukewae/kz-dashboard on GitHub"
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>kz_dashboard</span>
              </div>
              <span style={{ fontSize: "10px", opacity: 0.7 }}>@lukewae ↗</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="app-main">{children}</main>
    </div>
  );
}
