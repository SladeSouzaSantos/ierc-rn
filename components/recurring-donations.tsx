"use client";

import { useState } from "react";
import { ArrowUpRight, CreditCard, Landmark, Repeat2, ShieldCheck } from "lucide-react";
import {
  DONATION_MONTHLY_AMOUNTS,
  parseCustomMonthlyAmount,
  type MonthlyAmountChoice,
  type MonthlyDonationConfig,
} from "@/lib/recurring-donations";
import { IERC_OFFICIAL_EMAIL_LINK } from "@/lib/institutional-contact";

type Method = "pix" | "credit" | "debit";

const METHODS: ReadonlyArray<{
  id: Method;
  label: string;
  explanation: string;
}> = [
  {
    id: "pix",
    label: "Pix mensal",
    explanation: "O provedor gera uma cobrança a cada mês. Você paga cada Pix no aplicativo do seu banco; não é débito automático.",
  },
  {
    id: "credit",
    label: "Cartão de crédito",
    explanation: "Após sua autorização no checkout, o provedor realiza as tentativas de cobrança mensal no cartão.",
  },
  {
    id: "debit",
    label: "Cartão de débito",
    explanation: "Débito recorrente automático exige serviço específico do adquirente. Ainda não está habilitado pelo IERC-RN.",
  },
];

export function RecurringDonations({ config }: { config: MonthlyDonationConfig }) {
  const [choice, setChoice] = useState<MonthlyAmountChoice>(50);
  const [customAmount, setCustomAmount] = useState("");
  const [method, setMethod] = useState<Method>("pix");
  const amount = choice === "custom" ? parseCustomMonthlyAmount(customAmount) : choice;
  const href = method === "debit" || amount === null
    ? undefined
    : config.links[method][choice];
  const canProceed = config.enabled && amount !== null && Boolean(href);
  const formatter = new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 2,
  });

  return (
    <div className="support-recurring" aria-labelledby="recurring-title">
      <div className="support-recurring-header">
        <span className="support-donation-icon" aria-hidden="true"><Repeat2 size={27} /></span>
        <div>
          <h4 id="recurring-title">Quero apoiar todos os meses</h4>
          <p>Escolha um valor e conheça as formas de pagamento disponíveis.</p>
        </div>
      </div>
      {!config.enabled && (
        <p className="support-recurring-notice" role="status">
          <strong>Contribuições mensais em preparação.</strong> O checkout só ficará disponível
          após a confirmação institucional da conta recebedora e do provedor.
          Nenhuma assinatura será iniciada por esta página enquanto isso.
        </p>
      )}

      <fieldset className="support-recurring-fieldset">
        <legend>Valor da contribuição mensal</legend>
        <div className="support-recurring-values">
          {DONATION_MONTHLY_AMOUNTS.map(value => (
            <label key={value} className="support-recurring-choice">
              <input
                type="radio" name="recurring-monthly-amount"
                value={value} checked={choice === value}
                onChange={() => setChoice(value)}
              />
              <span>{formatter.format(value)}</span>
            </label>
          ))}
          <label className="support-recurring-choice">
            <input
              type="radio" name="recurring-monthly-amount"
              value="custom" checked={choice === "custom"}
              onChange={() => setChoice("custom")}
            />
            <span>Outro valor</span>
          </label>
        </div>
        {choice === "custom" && (
          <div className="support-recurring-custom">
            <label htmlFor="recurring-custom-amount">Valor mensal personalizado (R$)</label>
            <div className="support-recurring-custom-input">
              <span aria-hidden="true">R$</span>
              <input
                id="recurring-custom-amount" name="recurring-custom-amount"
                type="text" inputMode="decimal" autoComplete="off"
                value={customAmount} onChange={event => setCustomAmount(event.target.value)}
                placeholder="Ex.: 35,50"
                aria-invalid={customAmount.length > 0 && amount === null}
                aria-describedby="recurring-custom-help"
              />
            </div>
            <p id="recurring-custom-help">
              Informe de R$ 5,00 a R$ 100.000,00, com até duas casas decimais.
              O valor será confirmado novamente no checkout do Asaas antes de iniciar a assinatura.
            </p>
          </div>
        )}
      </fieldset>

      <fieldset className="support-recurring-fieldset">
        <legend>Forma de pagamento</legend>
        <div className="support-recurring-methods">
          {METHODS.map(option => (
            <label className="support-recurring-method" key={option.id}>
              <input
                type="radio" name="recurring-payment-method"
                value={option.id} checked={method === option.id}
                onChange={() => setMethod(option.id)}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.explanation}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="support-recurring-outcome">
        <div className="support-recurring-summary" aria-live="polite" aria-atomic="true">
          <p>
            <strong>{amount === null ? "Informe um valor mensal" : `${formatter.format(amount)} por mês`}</strong> —{" "}
            {METHODS.find(option => option.id === method)?.label}
          </p>
          <p className="support-recurring-status">
            {method === "debit"
              ? "Cartão de débito automático ainda indisponível. Necessária habilitação específica pelo adquirente."
              : amount === null
                ? "Digite um valor válido para sua contribuição mensal."
                : !config.enabled
                  ? "Checkout ainda não habilitado pela instituição."
                  : !href
                    ? "Esta combinação de valor e forma de pagamento ainda não foi disponibilizada."
                    : choice === "custom"
                      ? "O valor digitado é uma simulação. Digite e confirme o mesmo valor no checkout Asaas antes de autorizar a assinatura."
                      : method === "pix"
                        ? "O pagamento de cada cobrança Pix requer confirmação mensal no banco."
                        : "O provedor administrará as cobranças mensais após sua autorização."}
          </p>
        </div>

        {canProceed && href ? (
          <a
            className="button button-dark support-recurring-checkout"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={choice === "custom"
              ? `Continuar no checkout seguro para informar e confirmar o valor mensal, ${METHODS.find(option => option.id === method)?.label} (abre em nova aba)`
              : `Continuar no checkout seguro para doar ${formatter.format(amount)} por mês, ${METHODS.find(option => option.id === method)?.label} (abre em nova aba)`}
          >
            Continuar no checkout seguro
            <ArrowUpRight size={19} aria-hidden="true" />
          </a>
        ) : (
          <button className="button button-dark support-recurring-checkout" type="button" disabled>
            Checkout ainda indisponível
          </button>
        )}
      </div>

      <div className="support-recurring-notes">
        <p>
          <ShieldCheck size={19} aria-hidden="true" />
          <span>Os dados de pagamento serão informados somente na página do provedor,
            nunca neste portal. Confirme o nome e o CNPJ do beneficiário antes de autorizar.</span>
        </p>
        <p>
          <CreditCard size={19} aria-hidden="true" />
          <span>Uma assinatura não é parcelamento: as cobranças se repetem até o cancelamento.
            Para solicitar encerramento ou esclarecimentos, <a href={IERC_OFFICIAL_EMAIL_LINK}>
              fale com o IERC-RN por e-mail</a>. O provedor deve registrar o cancelamento.</span>
        </p>
        <p>
          <Landmark size={19} aria-hidden="true" />
          <span>Pix Automático, com débito sem nova confirmação mensal, depende de uma
            autorização bancária específica e ainda não está ativado nesta integração.</span>
        </p>
      </div>
    </div>
  );
}
