"use client";

import Link from "next/link";
import { Logo } from "@/components/common/Logo";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, memo } from "react";
import {
  Search,
  LogOut,
  Menu,
  X,
  Compass,
  FileCheck2,
  Users,
  ShieldAlert,
} from "lucide-react";
import { useUnreadConnectionRequestCount, useUnreadDmCount } from "@/lib/services/notificationService";
import { useSession, signOut } from "@/lib/services/authService";
import { MessagesMenu, NotificationsMenu } from "@/components/notifications/NavPanels";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

export const Header = memo(function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const { language, setLanguage, t } = useLanguage();

  const [fontSize, setFontSize] = useState<"standard" | "large">("standard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const unreadDms = useUnreadDmCount();
  const unreadConnectionRequests = useUnreadConnectionRequestCount();
  const connectionBadge = unreadDms + unreadConnectionRequests;
  const [scrolled, setScrolled] = useState(false);

  // Elevate the header once the user scrolls
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile drawer on navigation or Escape
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const savedFont = localStorage.getItem("tsunagu_font_size");
    if (savedFont === "large") {
      setFontSize("large");
      document.documentElement.classList.add("large-text");
    }
  }, []);

  const handleToggleFontSize = (size: "standard" | "large") => {
    setFontSize(size);
    localStorage.setItem("tsunagu_font_size", size);
    if (size === "large") {
      document.documentElement.classList.add("large-text");
    } else {
      document.documentElement.classList.remove("large-text");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
    router.push("/");
  };

  const postsLabel = session ? t("nav.posts") : t("nav.explore");

  const toggleBtn = (active: boolean, activeClass = "bg-card text-foreground") =>
    `px-2 py-1 rounded-md text-[13px] font-semibold transition-all duration-200 ${
      active ? `${activeClass} font-bold shadow-xs` : "text-muted-foreground hover:text-foreground hover:bg-card/60"
    }`;

  const renderToggles = () => (
    <>
      <div
        className="flex items-center rounded-lg border border-border bg-muted/60 p-0.5 shrink-0"
        role="group"
        aria-label={t("nav.fontSize")}
      >
        <button
          type="button"
          onClick={() => handleToggleFontSize("standard")}
          className={toggleBtn(fontSize === "standard")}
          title={t("nav.fontSizeStandard")}
          aria-pressed={fontSize === "standard"}
        >
          A
        </button>
        <button
          type="button"
          onClick={() => handleToggleFontSize("large")}
          className={toggleBtn(fontSize === "large", "bg-primary text-primary-foreground")}
          title={t("nav.fontSizeLarge")}
          aria-pressed={fontSize === "large"}
        >
          A+
        </button>
      </div>
      <div
        className="flex items-center rounded-lg border border-border bg-muted/60 p-0.5 shrink-0"
        role="group"
        aria-label={t("nav.languageSelector")}
      >
        <button
          type="button"
          onClick={() => setLanguage("en")}
          className={toggleBtn(language === "en")}
          title="English"
          aria-pressed={language === "en"}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLanguage("ja")}
          className={toggleBtn(language === "ja", "bg-card text-primary")}
          title="日本語"
          aria-pressed={language === "ja"}
        >
          JA
        </button>
      </div>
    </>
  );

  const navLinks: { href: string; label: string; icon: typeof Compass; badge?: number }[] = [
    { href: "/posts", label: postsLabel, icon: Compass },
    { href: "/my-activity", label: t("nav.myActivity"), icon: FileCheck2 },
    { href: "/search", label: t("nav.search"), icon: Search },
    ...(session
      ? [{ href: "/connections", label: language === "ja" ? "つながり" : "Connections", icon: Users, badge: connectionBadge }]
      : []),
    ...(session?.isAdmin
      ? [{ href: "/admin", label: language === "ja" ? "管理" : "Admin", icon: ShieldAlert }]
      : []),
  ];

  return (
    <header
      className={`site-header sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md supports-[backdrop-filter]:bg-card/80 transition-shadow duration-300 ${
        scrolled ? "shadow-soft" : ""
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 h-[56px] sm:h-[68px] lg:h-[72px]">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 lg:gap-4 xl:gap-6 min-w-0">
          <Link
            href="/"
            className="flex flex-col group rounded-md shrink-0"
            aria-label="Musubi Home"
            data-no-translate
          >
            <Logo className="transition-transform duration-300 group-hover:scale-[1.03]" />
            <span className="text-[10px] text-muted-foreground font-medium hidden xl:inline mt-0.5 pl-[2.75rem] whitespace-nowrap">
              {t("brandSubtitle")}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-[8px] rounded-md font-medium text-[14px] lg:text-[15px] transition-colors duration-200 shrink-0 after:absolute after:left-2.5 after:right-2.5 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary after:transition-transform after:duration-300 after:origin-left ${
                    active
                      ? "text-primary font-bold after:scale-x-100"
                      : "text-foreground hover:bg-muted/70 hover:text-primary after:scale-x-0"
                  }`}
                >
                  <Icon className="h-[17px] w-[17px] shrink-0" />
                  <span className="whitespace-nowrap">{link.label}</span>
                  {link.badge ? (
                    <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold leading-none text-destructive-foreground tabular-nums" aria-label={`${link.badge} new`}>
                      {link.badge > 9 ? "9+" : link.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Action Controls & User Menu */}
        <div className="flex items-center gap-1 sm:gap-2 flex-nowrap shrink-0">
          {/* Accessibility toggles (tablet & desktop; mobile shows them in the drawer) */}
          <div className="hidden sm:flex items-center gap-1.5">{renderToggles()}</div>

          {/* If Logged In: Notifications, Chat, Profile Menu */}
          {session ? (
            <>
              {/* Messenger (desktop dropdown; phones use the bottom nav) */}
              <MessagesMenu label={t("nav.messages")} />

              {/* Notifications bell (desktop dropdown, phones link to the page) */}
              <NotificationsMenu label={t("nav.notifications")} />

              {/* User Avatar & Name Link */}
              <div className="hidden md:flex items-center gap-1 pl-2 ml-1 border-l border-border shrink-0">
                <Link
                  href={`/profile/${session.id}`}
                  className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-muted transition-colors duration-200"
                  title={t("nav.viewProfile")}
                >
                  <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-secondary text-secondary-foreground font-bold text-[13px] ring-2 ring-card shadow-xs overflow-hidden shrink-0">
                    {session.avatarUrl ? (
                      <img src={session.avatarUrl} alt={session.fullName} className="h-full w-full object-cover" />
                    ) : (
                      initials(session.fullName)
                    )}
                  </div>
                  <span className="hidden xl:inline text-[13px] font-bold text-foreground max-w-[96px] truncate">
                    {session.fullName}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex h-[36px] w-[36px] items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted rounded-full transition-colors duration-200"
                  title={t("nav.signOut")}
                  aria-label={t("nav.signOut")}
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </div>
            </>
          ) : (
            /* Logged Out Visitor Actions */
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <Button asChild variant="ghost" size="sm" className="font-semibold text-[14px] min-h-[36px] px-3">
                <Link href="/login">{t("nav.login")}</Link>
              </Button>
              <Button asChild variant="default" size="sm" className="font-semibold text-[14px] min-h-[36px] px-3.5">
                <Link href="/register">{t("nav.register")}</Link>
              </Button>
            </div>
          )}

          {/* Mobile Drawer Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden h-[40px] w-[40px] rounded-full hover:bg-muted text-foreground shrink-0 flex items-center justify-center transition-colors duration-200"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-drawer"
          >
            {mobileMenuOpen ? <X className="h-[20px] w-[20px]" /> : <Menu className="h-[20px] w-[20px]" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div
          id="mobile-drawer"
          className="md:hidden absolute inset-x-0 top-full border-b border-border bg-card shadow-lift px-4 py-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[calc(100dvh-56px)] overflow-y-auto"
        >
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 min-[380px]:flex-col min-[380px]:justify-center p-3 rounded-xl border font-semibold text-[14px] transition-colors duration-200 ${
                    pathname === link.href || pathname.startsWith(`${link.href}/`)
                      ? "border-primary/40 bg-primary/5 text-primary"
                      : "border-border bg-muted/40 text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-[20px] w-[20px] text-primary" />
                  <span className="text-center">{link.label}</span>
                  {link.badge ? (
                    <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold leading-none text-destructive-foreground tabular-nums" aria-label={`${link.badge} new`}>
                      {link.badge > 9 ? "9+" : link.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          {/* Accessibility toggles */}
          <div className="sm:hidden flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 border border-border p-2.5">
            <span className="text-[12px] font-semibold text-muted-foreground">
              {t("nav.fontSize")} · {t("nav.languageSelector")}
            </span>
            <div className="flex items-center gap-1.5">{renderToggles()}</div>
          </div>

          {session ? (
            <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
              <Link
                href={`/profile/${session.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 min-w-0"
              >
                <div className="h-[40px] w-[40px] rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-[14px] shrink-0 overflow-hidden">
                  {session.avatarUrl ? (
                    <img src={session.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(session.fullName)
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-[14px] text-foreground truncate">{session.fullName}</div>
                  <div className="text-[12px] text-muted-foreground">{t("nav.viewProfile")}</div>
                </div>
              </Link>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="shrink-0 gap-1.5 hover:text-destructive hover:border-destructive/40 text-[14px]">
                <LogOut className="h-4 w-4" />
                {t("nav.signOut")}
              </Button>
            </div>
          ) : (
            <div className="pt-3 border-t border-border grid grid-cols-2 gap-2">
              <Button asChild variant="outline" className="w-full font-bold text-[14px]">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  {t("nav.login")}
                </Link>
              </Button>
              <Button asChild variant="default" className="w-full font-bold text-[14px]">
                <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                  {t("nav.register")}
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
});
