"use client";

import { useState } from "react";
import { IERC_DONATION_PIX_CNPJ } from "@/lib/institutional-contact";

/**
 * Displays the institution-supplied Pix identifier as selectable text.
 * Copying never starts a transaction or collects donor information.
 */
export function PixDonationKey() {
  const [message, setMessage] = useState("");

  async function copyKey() {
    try {
      // CNPJ Pix keys are numeric; remove formatting for pasting into bank apps.
      await navigator.clipboard.writeText(IERC_DONATION_PIX_CNPJ.replace(/\D/g, ""));
      setMessage("Chave Pix copiada, somente números.");
    } catch {
      setMessage("Não foi possível copiar automaticamente. Selecione a chave acima.");
    }
  }

  return <div className="support-pix-key">
    <p className="support-pix-label">Chave Pix para doações (CNPJ)</p>
    <div className="support-pix-actions">
      <strong className="support-pix-value">{IERC_DONATION_PIX_CNPJ}</strong>
      <button type="button" className="support-pix-copy" onClick={copyKey}>
        Copiar chave Pix
      </button>
    </div>
    <p className="support-pix-status" role="status" aria-live="polite">{message}</p>
  </div>;
}
