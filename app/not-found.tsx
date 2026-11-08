import Link from "next/link";
export default function NotFound() { return <div className="container not-found"><p className="eyebrow">Página não encontrada</p><h1>Não encontramos este caminho.</h1><p>Mas você pode continuar explorando o portal do IERC-RN.</p><Link href="/" className="button button-dark">Voltar ao início</Link></div>; }
