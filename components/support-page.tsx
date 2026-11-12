import Link from "next/link";
import { PixDonationKey } from "@/components/pix-donation-key";
import {
  ArrowUpRight, CalendarDays, HeartHandshake, Megaphone,
  MessageCircle, ShoppingBag, ShieldCheck, Repeat2, HandCoins,
} from "lucide-react";

/**
 * Bazaar logistics from an institutional contact (11 Nov 2026).
 * Purchases can be paid at the physical bazaar by Pix or cash. The
 * site separately displays the donation Pix CNPJ supplied by the operator.
 * No online checkout, recurring charge, bank-account verification or QR code.
 */
export function SupportPage() {
  return <>
    <div className="detail-intro support-intro">
      <p className="eyebrow">Solidariedade e participação</p>
      <h2>Há diferentes formas de caminhar junto com o IERC-RN.</h2>
      <p>Você pode contribuir com roupas, sapatos e bolsas em bom estado,
        comprar no Bazar Solidário ou conversar sobre voluntariado e
        parcerias. Confira abaixo os horários e as orientações informadas
        pela instituição para participar.</p>
    </div>

    <nav className="support-jump-links" aria-label="Nesta página">
      <a href="#bazar-solidario">Bazar Solidário</a>
      <a href="#formas-de-apoio">Como participar</a>
      <a href="#orientacoes-de-apoio">Orientações importantes</a>
    </nav>

    <section className="support-bazar" id="bazar-solidario"
      aria-labelledby="support-bazar-title">
      <div className="support-bazar-main">
        <div className="support-icon support-bazar-icon" aria-hidden="true">
          <ShoppingBag size={33} />
        </div>
        <p className="eyebrow">Uma iniciativa do Instituto</p>
        <h2 id="support-bazar-title">Bazar Solidário</h2>
        <p>O Bazar Solidário acontece na sede do IERC-RN e está aberto à
          comunidade. A compra de produtos no bazar contribui com
          as atividades da instituição.</p>
        <p className="support-day-reference">
          <CalendarDays size={20} aria-hidden="true" />
          <span><strong>Terças-feiras, das 8h às 11h.</strong> Atendimento presencial na sede do IERC-RN.</span>
        </p>
        <Link className="button button-dark" href="/contato">
          Consultar canais de contato <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <div className="support-bazar-aside">
        <h3>Local, doações e compras</h3>
        <p><strong>Onde:</strong> sede do IERC-RN, Rua Fonseca e Silva, 1113,
          Alecrim, Natal/RN.</p>
        <ul>
          <li><strong>Doação de itens:</strong> segunda a quinta-feira, das 8h às 11h;</li>
          <li><strong>O que doar:</strong> roupas, sapatos e bolsas em bom estado;</li>
          <li><strong>Entrega:</strong> presencial, no IERC-RN. Não há coleta domiciliar;</li>
          <li><strong>Compras:</strong> abertas a qualquer pessoa, com pagamento
            presencial em dinheiro ou Pix.</li>
        </ul>
        <p className="support-aside-note">Em feriados ou mudanças excepcionais,
          consulte a instituição antes de se deslocar.</p>
      </div>
    </section>

    <section className="support-options editorial-section" id="formas-de-apoio"
      aria-labelledby="support-options-title">
      <p className="eyebrow">Participação da comunidade</p>
      <h2 className="interior-subtitle" id="support-options-title">Como você pode colaborar</h2>
      <p className="editorial-intro">O bazar recebe doações presenciais e atende compradores.
        O IERC-RN também informou que aceita voluntariado e parcerias,
        cujas condições devem ser combinadas com a equipe.</p>
      <div className="support-choice-grid">
        <article className="detail-card support-choice">
          <span className="support-choice-icon" aria-hidden="true"><HeartHandshake size={30} /></span>
          <h3>Doar itens para o bazar</h3>
          <p>O IERC-RN recebe roupas, sapatos e bolsas em bom estado,
            presencialmente, de segunda a quinta-feira, das 8h às 11h.
            Não há serviço de coleta.</p>
          <Link className="inline-link" href="/contato">
            Consultar orientações <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </article>
        <article className="detail-card support-choice">
          <span className="support-choice-icon" aria-hidden="true"><ShoppingBag size={30} /></span>
          <h3>Conhecer o Bazar Solidário</h3>
          <p>Qualquer pessoa pode comprar no bazar, realizado às terças-feiras,
            das 8h às 11h, na sede do Instituto. As compras são pagas
            presencialmente em dinheiro ou Pix.</p>
          <Link className="inline-link" href="/contato">
            Ver canais do IERC-RN <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </article>
        <article className="detail-card support-choice">
          <span className="support-choice-icon" aria-hidden="true"><Megaphone size={30} /></span>
          <h3>Voluntariado e parcerias</h3>
          <p>O IERC-RN recebe voluntários e parcerias com empresas,
            inclusive apoio com materiais ou serviços. Para oferecer
            tempo, habilidades, produtos ou outro tipo de contribuição,
            consulte a equipe sobre as necessidades e o recebimento.</p>
          <a className="inline-link" href="https://www.instagram.com/iercrn/"
            target="_blank" rel="noopener noreferrer">
            Conhecer o perfil informado <ArrowUpRight size={17} aria-hidden="true" />
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </article>
      </div>
    </section>

    <section className="support-guidance editorial-section"
      id="orientacoes-de-apoio" aria-labelledby="support-guidance-title">
      <p className="eyebrow">Orientações para apoiar</p>
      <h2 className="interior-subtitle" id="support-guidance-title">Uma contribuição bem combinada começa pela informação.</h2>
      <ol className="support-steps">
        <li><strong>Conheça o Instituto.</strong> Saiba mais sobre as atividades que integram seu trabalho.</li>
        <li><strong>Prepare a contribuição.</strong> Separe apenas roupas, sapatos e bolsas em bom estado; para outros tipos de apoio, consulte a equipe.</li>
        <li><strong>Visite nos horários informados.</strong> A entrega de itens ocorre de segunda a quinta, das 8h às 11h; o bazar atende às terças, das 8h às 11h.</li>
      </ol>
      <aside className="support-finance" aria-labelledby="support-finance-title">
        <ShieldCheck size={27} aria-hidden="true" />
        <div>
          <h3 id="support-finance-title">Sobre doações financeiras</h3>
          <p>O IERC-RN informou a chave Pix por CNPJ abaixo para receber
            doações financeiras. Antes de concluir uma transferência, confira
            no aplicativo do seu banco se o destinatário corresponde ao
            Instituto. <strong>Se o nome do recebedor não corresponder, não
            transfira e entre em contato com o IERC-RN.</strong></p>
          <PixDonationKey />
          <p>Este portal não processa pagamentos nem possui cobrança ou QR Code.
            O Pix e o dinheiro aceitos no bazar referem-se a compras presenciais.</p>
        </div>
      </aside>

      <section className="support-donation-modes" aria-labelledby="support-donation-modes-title">
        <p className="eyebrow">Planejamento de doações</p>
        <h3 id="support-donation-modes-title">Opções para contribuições financeiras</h3>
        <p className="support-donation-lead">A chave Pix acima permite realizar uma
          transferência avulsa diretamente no aplicativo do banco. A opção de
          contribuições mensais ainda está em planejamento. Este portal não
          solicita dados bancários nem processa cobranças.</p>
        <div className="support-donation-grid">
          <article className="support-donation-card">
            <span className="support-donation-icon" aria-hidden="true"><HandCoins size={27}/></span>
            <h4>Doação única por Pix</h4>
            <p>Copie a chave Pix indicada acima, acesse o aplicativo do banco
              e confirme o nome da instituição antes de transferir.</p>
            <p className="support-donation-status">Transferência externa — sem checkout no portal</p>
          </article>
          <article className="support-donation-card">
            <span className="support-donation-icon" aria-hidden="true"><Repeat2 size={27}/></span>
            <h4>Apoio mensal recorrente</h4>
            <p>Uma contribuição a cada mês, mediante autorização expressa.
              A pessoa poderá consultar as condições e cancelar a recorrência
              pelos canais seguros do provedor escolhido.</p>
            <p className="support-donation-status">Em preparação — sem assinatura ativa</p>
          </article>
        </div>
        <p className="support-donation-disclosure">
          <strong>Importante:</strong> as compras no Bazar Solidário continuam
          presenciais. A doação mensal só será ativada após a confirmação
          da conta recebedora, das regras de cancelamento e do provedor de
          pagamentos autorizado pela instituição.
        </p>
      </section>
    </section>

    <section className="detail-callout support-contact"
      aria-labelledby="support-contact-title">
      <MessageCircle size={34} aria-hidden="true" />
      <p className="eyebrow light">Próximo passo</p>
      <h2 id="support-contact-title">Quer apoiar o IERC-RN?</h2>
      <p>As doações de itens são recebidas na sede do IERC-RN, de segunda
        a quinta, das 8h às 11h. Para voluntariado, parcerias ou dúvidas,
        consulte os canais institucionais disponíveis na página de contato.</p>
      <Link className="button button-yellow" href="/contato">
        Ir para Contato <ArrowUpRight size={18} aria-hidden="true" />
      </Link>
    </section>
  </>;
}
