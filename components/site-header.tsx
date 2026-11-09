"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Instagram, Menu, X } from "lucide-react";
import { navigation } from "@/lib/site-data";

export function SiteHeader() {
  const pathname = usePathname();
  const [opened, setOpened] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => { setOpened(false); }, [pathname]);
  useEffect(() => {
    if (opened) firstLink.current?.focus();
  }, [opened]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && opened) {
        setOpened(false);
        menuButton.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [opened]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" onClick={() => setOpened(false)}>
          {/* O nome textual adjacente já identifica o destino do link.
              alt="" evita anunciar a mesma instituição duas vezes. */}
          <Image src="/ierc-logo.webp" alt="" aria-hidden="true" className="brand-logo" width={94} height={65} priority />
          <span className="brand-copy">
            <strong>IERC<span className="brand-slash">/</span>RN</strong>
            <small>Instituto de Educação e Reabilitação de Cegos</small>
          </span>
        </Link>
        <button ref={menuButton} className="menu-trigger" type="button" aria-label={opened ? "Fechar menu" : "Abrir menu"} aria-controls="menu-principal" aria-expanded={opened} onClick={() => setOpened((value) => !value)}>
          {opened ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
        <nav id="menu-principal" className={opened ? "primary-nav nav-open" : "primary-nav"} aria-label="Menu principal">
          {navigation.map((item, index) => (
            <Link ref={index === 0 ? firstLink : undefined} href={item.href} key={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={() => setOpened(false)}>{item.label}</Link>
          ))}
          <Link href="/apoie" className="nav-cta" aria-current={pathname === "/apoie" ? "page" : undefined} onClick={() => setOpened(false)}>
            Apoie o IERC <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
          <a className="nav-instagram" href="https://www.instagram.com/iercrn/" target="_blank" rel="noopener noreferrer" aria-label="Instagram oficial do IERC-RN, abre em nova aba"><Instagram size={18} aria-hidden="true" /></a>
        </nav>
      </div>
    </header>
  );
}
