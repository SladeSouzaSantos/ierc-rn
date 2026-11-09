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
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const saved: Partial<Preferences> = stored ? JSON.parse(stored) : {};
      const next = {
        largeText: saved.largeText === true,
        highContrast: saved.highContrast === true,
        reduceMotion: saved.reduceMotion === true,
        smoothScroll: saved.smoothScroll === true && saved.reduceMotion !== true,
      };
      setPrefs(next);
      applyPreferences(next);
    } catch {
      applyPreferences(defaults);
    }
  }, []);

  useEffect(() => {
    if (visible) closeRef.current?.focus();
  }, [visible]);

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

  function close() {
    setVisible(false);
    triggerRef.current?.focus();
  }

  function update(key: keyof Preferences, value: boolean) {
    const next = { ...prefs, [key]: value };
    if (key === "reduceMotion" && value) next.smoothScroll = false;
    setPrefs(next);
    applyPreferences(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Opções permanecem ativas nesta sessão quando armazenamento é bloqueado.
    }
  }

  return (
    <div className="accessibility-root">
      <section className="accessibility-panel" id="painel-acessibilidade" aria-labelledby="titulo-preferencias" hidden={!visible}>
        <div className="panel-heading">
          <h2 id="titulo-preferencias">Preferências de acessibilidade</h2>
          <button ref={closeRef} type="button" className="icon-button" aria-label="Fechar preferências de acessibilidade" onClick={close}><X size={20} aria-hidden="true" /></button>
        </div>
        <p>O conteúdo pode ser navegado por teclado e leitores de tela. Ajuste a apresentação conforme sua preferência.</p>
        <label className="preference-row"><span>Ampliar textos</span><input type="checkbox" checked={prefs.largeText} onChange={(event) => update("largeText", event.target.checked)} /></label>
        <label className="preference-row"><span>Alto contraste</span><input type="checkbox" checked={prefs.highContrast} onChange={(event) => update("highContrast", event.target.checked)} /></label>
        <label className="preference-row"><span>Reduzir animações</span><input type="checkbox" checked={prefs.reduceMotion} onChange={(event) => update("reduceMotion", event.target.checked)} /></label>
        <label className="preference-row"><span>Rolagem suave opcional</span><input type="checkbox" checked={prefs.smoothScroll} disabled={prefs.reduceMotion} onChange={(event) => update("smoothScroll", event.target.checked)} /></label>
        <p className="accessibility-help">As preferências ficam salvas neste navegador. Seu leitor de tela pode ser utilizado sem ativar nenhuma opção.</p>
      </section>
      <button ref={triggerRef} className="accessibility-trigger" type="button" aria-controls="painel-acessibilidade" aria-expanded={visible} onClick={() => setVisible((value) => !value)}>
        <Accessibility aria-hidden="true" size={22} /><span>Acessibilidade</span>
      </button>
    </div>
  );
}
