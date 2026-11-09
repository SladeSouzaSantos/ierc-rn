"use client";

import { Accessibility, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Preferences = { largeText: boolean; highContrast: boolean; reduceMotion: boolean; smoothScroll: boolean };
const defaults: Preferences = { largeText: false, highContrast: false, reduceMotion: false, smoothScroll: false };
const STORAGE_KEY = "ierc-rn-accessibility";

function applyPreferences(prefs: Preferences) {
  const root = document.documentElement;
  root.dataset.largeText = String(prefs.largeText);
  root.dataset.highContrast = String(prefs.highContrast);
  root.dataset.reduceMotion = String(prefs.reduceMotion);
  root.dataset.smoothScroll = String(prefs.smoothScroll);
  document.dispatchEvent(new Event("ierc-preferences-changed"));
}

export function AccessibilityPanel() {
  const [visible, setVisible] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const saved = stored ? JSON.parse(stored) as Partial<Preferences> : {};
      const next = { ...defaults, ...saved };
      setPrefs(next);
      applyPreferences(next);
    } catch {
      applyPreferences(defaults);
    }
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && visible) {
        setVisible(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [visible]);

  function update(key: keyof Preferences, value: boolean) {
    const next = { ...prefs, [key]: value };
    if (key === "reduceMotion" && value) next.smoothScroll = false;
    setPrefs(next);
    applyPreferences(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* preferências temporárias */ }
  }

  return (
    <div className="accessibility-root">
      <section className="accessibility-panel" id="painel-acessibilidade" aria-label="Preferências de acessibilidade" hidden={!visible}>
          <div className="panel-heading"><strong>Personalize sua experiência</strong><button className="icon-button" aria-label="Fechar preferências" onClick={() => { setVisible(false); triggerRef.current?.focus(); }}><X size={20} aria-hidden="true" /></button></div>
          <p>O site já funciona com teclado e leitores de tela. Estas opções são adicionais.</p>
          <label className="preference-row"><span>Ampliar textos</span><input type="checkbox" checked={prefs.largeText} onChange={(event) => update("largeText", event.target.checked)} /></label>
          <label className="preference-row"><span>Alto contraste</span><input type="checkbox" checked={prefs.highContrast} onChange={(event) => update("highContrast", event.target.checked)} /></label>
          <label className="preference-row"><span>Reduzir animações</span><input type="checkbox" checked={prefs.reduceMotion} onChange={(event) => update("reduceMotion", event.target.checked)} /></label>
          <label className="preference-row"><span>Rolagem suave opcional</span><input type="checkbox" checked={prefs.smoothScroll} disabled={prefs.reduceMotion} onChange={(event) => update("smoothScroll", event.target.checked)} /></label>
      </section>
      <button ref={triggerRef} className="accessibility-trigger" type="button" aria-controls="painel-acessibilidade" aria-expanded={visible} onClick={() => setVisible((value) => !value)}><Accessibility aria-hidden="true" size={22} /><span>Acessibilidade</span></button>
    </div>
  );
}
