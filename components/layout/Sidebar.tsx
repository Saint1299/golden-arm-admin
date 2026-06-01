"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMobileNav } from "./MobileNav";

type NavItem = {
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { label: "Hierarchy", href: "/hierarchy" },
  { label: "Inventory", href: "/inventory" },
  { label: "Compliance Board", href: "/compliance" },
];

function SidebarLink({
  item,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  onNavigate: () => void;
}) {
  const [hover, setHover] = useState(false);

  const backgroundColor = isActive
    ? "rgba(201, 169, 97, 0.12)"
    : hover
      ? "rgba(255, 255, 255, 0.04)"
      : "transparent";

  const color = isActive || hover ? "#f5f5f7" : "rgba(245, 245, 247, 0.6)";

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "block",
        padding: "10px 16px",
        margin: "0 12px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        color,
        backgroundColor,
        textDecoration: "none",
        transition: "background-color 200ms ease-out, color 200ms ease-out",
      }}
    >
      {isActive ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: 2,
            backgroundColor: "#c9a961",
            borderRadius: "0 2px 2px 0",
          }}
        />
      ) : null}
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, close } = useMobileNav();

  return (
    <aside
      className={`sidebar-shell ${isOpen ? "sidebar-mobile-open" : "sidebar-mobile-closed"}`}
      style={{
        width: 240,
        flexShrink: 0,
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ height: 24 }} />

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <SidebarLink
              key={item.href}
              item={item}
              isActive={isActive}
              onNavigate={close}
            />
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />
    </aside>
  );
}
