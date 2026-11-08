import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AccessibilityPanel } from "@/components/accessibility-panel";
import { MotionEnhancements } from "@/components/motion-enhancements";

export const metadata: Metadata = {
  title: { default: "IERC-RN | Educação, autonomia e possibilidades", template: "%s | IERC-RN" },
  description: "Conheça o Instituto de Educação e Reabilitação de Cegos do Rio Grande do Norte, suas atividades, esporte, bazar solidário e oportunidades de participação.",
  metadataBase: new URL("https://example.org"),
  robots: { index: false, follow: false },
  openGraph: { title: "IERC-RN", locale: "pt_BR", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">Pular para o conteúdo principal</a>
        <SiteHeader />
        <main id="conteudo" tabIndex={-1}>{children}</main>
        <SiteFooter />
        <AccessibilityPanel />
        <MotionEnhancements />
      </body>
    </html>
  );
}
