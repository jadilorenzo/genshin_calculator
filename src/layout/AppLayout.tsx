import { Suspense } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { AuthControls } from "../components/AuthControls.tsx";
import { BannerPullingDayNotice } from "../components/BannerPullingDayNotice.tsx";
import { PageLoader } from "../components/PageLoader.tsx";
import { BrandMoonLogo, ChevronLeftIcon } from "../components/icons.tsx";
import { SiteSettingsMenu } from "../components/SiteSettingsMenu.tsx";
import { useLocalStorage } from "../hooks/useLocalStorage.ts";
import { BannerRegionProvider } from "../hooks/useBannerRegion.tsx";
import { prefetchDesk } from "./routePrefetch.ts";
import {
  deskForPath,
  END_NAV_LINKS,
  linksForDesk,
  MAIN_NAV_LINKS,
  type PrimaryLink,
} from "./siteNav.ts";

const GITHUB_URL = "https://github.com/jadilorenzo/genshin_calculator";

function SidebarNavLink({
  link,
  active,
  collapsed,
}: {
  link: PrimaryLink;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = link.icon;
  const classes = ["sidebar-link"];
  if (active) classes.push("active");
  if (link.align === "end") classes.push("sidebar-link-end");

  return (
    <NavLink
      to={link.to}
      className={classes.join(" ")}
      title={link.label}
      onMouseEnter={() => prefetchDesk(link.desk)}
      onFocus={() => prefetchDesk(link.desk)}
    >
      <Icon className="sidebar-link-icon" aria-hidden />
      {collapsed ? null : (
        <span className="sidebar-link-label">{link.label}</span>
      )}
    </NavLink>
  );
}

function SidebarAccordionItem({
  link,
  active,
  collapsed,
  pathname,
}: {
  link: PrimaryLink;
  active: boolean;
  collapsed: boolean;
  pathname: string;
}) {
  const Icon = link.icon;
  const children = linksForDesk(link.desk);
  const open = active || Boolean(link.defaultExpanded);

  if (collapsed) {
    return (
      <NavLink
        to={link.to}
        className={active ? "sidebar-link active" : "sidebar-link"}
        title={link.label}
        onMouseEnter={() => prefetchDesk(link.desk)}
        onFocus={() => prefetchDesk(link.desk)}
      >
        <Icon className="sidebar-link-icon" aria-hidden />
      </NavLink>
    );
  }

  return (
    <div
      className={[
        "sidebar-accordion-item",
        open ? "is-open" : "",
        active ? "is-active-section" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <NavLink
        to={link.to}
        className={active ? "sidebar-link active" : "sidebar-link"}
        title={link.label}
        onMouseEnter={() => prefetchDesk(link.desk)}
        onFocus={() => prefetchDesk(link.desk)}
      >
        <Icon className="sidebar-link-icon" aria-hidden />
        <span className="sidebar-link-label">{link.label}</span>
      </NavLink>
      <div className="sidebar-accordion-panel" aria-hidden={!open}>
        <div className="sidebar-accordion-panel-inner">
          <nav
            className="sidebar-accordion-links"
            aria-label={`${link.label} tools`}
          >
            {children.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                end={child.end}
                className={() =>
                  child.isActive(pathname)
                    ? "sidebar-sub-link active"
                    : "sidebar-sub-link"
                }
              >
                {child.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { pathname } = useLocation();
  const isRotationEditor = pathname.startsWith("/rotations/editor");
  const isLanding = pathname === "/";
  const isCharacters = pathname.startsWith("/characters");
  const desk = isRotationEditor ? null : deskForPath(pathname);
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage(
    "gc:sidebar:collapsed",
    false,
  );
  const effectiveSidebarCollapsed = sidebarCollapsed || isRotationEditor;

  const appClass = [
    "app",
    isRotationEditor ? "app--rotation-editor" : "",
    isLanding ? "app--landing" : "",
    isCharacters ? "app--fill-page" : "",
    effectiveSidebarCollapsed ? "app--sidebar-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={appClass}>
      <aside className="site-sidebar" aria-label="Site">
        <div className="site-sidebar-inner">
          <Link
            to="/"
            className="brand-block"
            aria-label="False Moon's Reckoning home"
          >
            <div className="brand-mark" aria-hidden="true">
              <BrandMoonLogo />
            </div>
            <div className="brand-copy">
              <p className="brand">
                <span className="brand-line">False Moon&apos;s</span>
                <span className="brand-line">Reckoning</span>
              </p>
            </div>
          </Link>

          <div className="sidebar-nav-stack">
            <div className="sidebar-accordion" aria-label="Primary">
              {MAIN_NAV_LINKS.map((link) => {
                const children = linksForDesk(link.desk);
                const active = desk === link.desk;

                if (children.length === 0) {
                  return (
                    <SidebarNavLink
                      key={link.desk}
                      link={link}
                      active={active}
                      collapsed={effectiveSidebarCollapsed}
                    />
                  );
                }

                return (
                  <SidebarAccordionItem
                    key={link.desk}
                    link={link}
                    active={active}
                    collapsed={effectiveSidebarCollapsed}
                    pathname={pathname}
                  />
                );
              })}
            </div>

            <nav className="sidebar-nav sidebar-nav-end" aria-label="Data">
              {END_NAV_LINKS.map((link) => (
                <SidebarNavLink
                  key={link.desk}
                  link={link}
                  active={desk === link.desk}
                  collapsed={effectiveSidebarCollapsed}
                />
              ))}
            </nav>
          </div>

          {isRotationEditor ? null : (
            <div className="sidebar-footer">
              <AuthControls />
              <SiteSettingsMenu />
              <button
                type="button"
                className="sidebar-collapse-toggle"
                onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                aria-expanded={!sidebarCollapsed}
                aria-label={
                  sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                }
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <ChevronLeftIcon className="sidebar-collapse-icon" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="app-main">
        <div className="app-body">
          <BannerRegionProvider>
            {desk === "wish" ? <BannerPullingDayNotice /> : null}
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </BannerRegionProvider>
          {isRotationEditor || isCharacters ? null : (
            <footer className="site-footnote">
              <p>
                Built by Jacob Di Lorenzo ·{" "}
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                  GitHub
                </a>
              </p>
              <p>
                Estimates use community rate models and may not match live
                in-game odds or drop tables. Not affiliated with HoYoverse.
              </p>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
