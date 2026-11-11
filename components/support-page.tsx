import Link from "next/link";
import {
  ArrowUpRight, CalendarDays, HeartHandshake, Megaphone,
  MessageCircle, ShoppingBag, ShieldCheck,
} from "lucide-react";

/**
 * Non-financial support routes only. The Institute must confirm the current
 * bazaar schedule, accepted goods and any collaboration opportunities.
 * No payment credentials, forms, unverified phone numbers or QR codes.
 */
export function SupportPage() {
  return <>
    <div className="detail-intro support-intro">
      <p className="eyebrow">Solidariedade e participação</p>
      <h2>Há diferentes formas de caminhar junto com o IERC-RN.</h2>
      <p>Colaborar também pode significar participar do Bazar Solidário,
        compartilhar as iniciativas do Instituto ou conversar com a equipe
        sobre outras possibilidades de apoio. Antes de fazer uma entrega
        ou visita, confirme as orientações atuais com a instituição.</p>
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
        <p>O bazar é uma das formas divulgadas de contribuir com as atividades
          do IERC-RN. Quem deseja doar itens ou conhecer o espaço deve
          consultar as orientações da equipe antes de se deslocar.</p>
        <p className="support-day-reference">
          <CalendarDays size={20} aria-hidden="true" />
          <span><strong>Referência divulgada: terças-feiras.</strong> Confirme se o funcionamento está mantido.</span>
        </p>
        <Link className="button button-dark" href="/contato">
          Consultar canais de contato <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <div className="support-bazar-aside">
        <h3>Antes de visitar ou doar</h3>
        <p>As informações abaixo ainda precisam de confirmação atual pela instituição:</p>
        <ul>
          <li>Dia e horário de funcionamento;</li>
          <li>Itens aceitos e condições para doação;</li>
          <li>Local e orientações de entrega;</li>
          <li>Disponibilidade para compras e atendimento.</li>
        </ul>
        <p className="support-aside-note">Não há reserva, retirada ou cadastro de doações por este site.</p>
      </div>
    </section>

    <section className="support-options editorial-section" id="formas-de-apoio"
      aria-labelledby="support-options-title">
      <p className="eyebrow">Participação da comunidade</p>
      <h2 className="interior-subtitle" id="support-options-title">Como você pode colaborar</h2>
      <p className="editorial-intro">Escolha uma forma de se aproximar do Instituto.
        As orientações sobre recebimento de itens e colaboração são confirmadas diretamente com a equipe.</p>
      <div className="support-choice-grid">
        <article className="detail-card support-choice">
          <span className="support-choice-icon" aria-hidden="true"><HeartHandshake size={30} /></span>
          <h3>Doar itens para o bazar</h3>
          <p>Converse com a equipe para saber o que está sendo recebido,
            em quais condições e como combinar a entrega. Não leve itens
            antes de verificar as regras atuais.</p>
          <Link className="inline-link" href="/contato">
            Consultar orientações <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </article>
        <article className="detail-card support-choice">
          <span className="support-choice-icon" aria-hidden="true"><ShoppingBag size={30} /></span>
          <h3>Conhecer o Bazar Solidário</h3>
          <p>Visitar o bazar e conhecer os produtos é outra possibilidade.
            Confirme antecipadamente a programação, o atendimento e
            o local antes de planejar a ida.</p>
          <Link className="inline-link" href="/contato">
            Ver canais do IERC-RN <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </article>
        <article className="detail-card support-choice">
          <span className="support-choice-icon" aria-hidden="true"><Megaphone size={30} /></span>
          <h3>Divulgar e propor colaboração</h3>
          <p>Acompanhe e compartilhe as publicações do IERC-RN. Se deseja
            oferecer tempo ou habilidades, converse com a equipe para
            verificar se há alguma iniciativa recebendo apoio.</p>
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
        <li><strong>Confirme as necessidades.</strong> Consulte a equipe antes de separar itens, oferecer ajuda ou visitar o bazar.</li>
        <li><strong>Combine a participação.</strong> Siga apenas orientações confirmadas pelos canais institucionais.</li>
      </ol>
      <aside className="support-finance" aria-labelledby="support-finance-title">
        <ShieldCheck size={27} aria-hidden="true" />
        <div>
          <h3 id="support-finance-title">Sobre doações financeiras</h3>
          <p>Este portal ainda não recebe pagamentos. Não há Pix, QR Code,
            cartão ou contribuição recorrente disponíveis por aqui.
            Essas opções dependerão de validação institucional, segurança
            do recebimento e prestação de contas.</p>
        </div>
      </aside>
    </section>

    <section className="detail-callout support-contact"
      aria-labelledby="support-contact-title">
      <MessageCircle size={34} aria-hidden="true" />
      <p className="eyebrow light">Próximo passo</p>
      <h2 id="support-contact-title">Quer apoiar o IERC-RN?</h2>
      <p>Consulte a página de contato para encontrar o endereço documentado
        e o perfil informado da instituição. Os detalhes de atendimento
        e recebimento ainda dependem de confirmação com a equipe.</p>
      <Link className="button button-yellow" href="/contato">
        Ir para Contato <ArrowUpRight size={18} aria-hidden="true" />
      </Link>
    </section>
  </>;
}
