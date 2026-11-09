import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Instagram, MapPin } from "lucide-react";

const footerNavigation = [
  { href: "/instituto", label: "O Instituto" },
  { href: "/atividades", label: "Atividades" },
  { href: "/esportes", label: "Esporte" },
  { href: "/historias", label: "Histórias" },
  { href: "/noticias", label: "Notícias" },
  { href: "/eventos", label: "Eventos" },
  { href: "/galeria", label: "Galeria" },
  { href: "/visitas", label: "Visitas" },
  { href: "/contato", label: "Contato" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-identity">
          <div className="footer-logo-lockup"><Image src="/ierc-logo.webp" alt="" width={100} height={70} className="footer-logo" /><span>IERC-RN</span></div>
          <p className="eyebrow light">O futuro é mais inclusivo quando construído em conjunto.</p>
          <h2>Um lugar de encontro, aprendizado e possibilidades.</h2>
          <Link className="button button-yellow" href="/apoie">Apoie o Instituto <ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
        <div className="footer-links">
          <h3>Explore</h3>
          <ul>{footerNavigation.map((item) => <li key={item.href}><Link href={item.href}>{item.label}</Link></li>)}</ul>
        </div>
        <div className="footer-contact">
          <h3>Onde estamos</h3>
          <p><MapPin size={19} aria-hidden="true" /> Natal, Rio Grande do Norte</p>
          <a className="footer-social" href="https://www.instagram.com/iercrn/" target="_blank" rel="noopener noreferrer"><Instagram size={19} aria-hidden="true" /> @iercrn <span className="sr-only">(abre em nova aba)</span></a>
          <p className="footer-small">Dados de atendimento e agendamento serão publicados após confirmação institucional.</p>
        </div>
      </div>
      <div className="container footer-base">
        <span>© {new Date().getFullYear()} IERC-RN. Portal institucional em desenvolvimento.</span>
        <span>Acessibilidade desde o primeiro componente.</span>
      </div>
    </footer>
  );
}
