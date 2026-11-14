import Link from "next/link";
import { ArrowUpRight, BookOpen, Footprints, Music2, Users } from "lucide-react";
import { SourceLink, Timeline } from "@/components/editorial-records";

/**
 * Historical presentation: editorial paraphrases with dated references.
 * The IERC must approve any claim that these are its CURRENT statutory texts.
 */
export function InstitutionStory() {
  return (
    <>
      <div className="detail-intro institution-intro">
        <p className="eyebrow">Desde 16 de julho de 1952</p>
        <h2>Uma história construída com educação, autonomia e pertencimento.</h2>
        <p>Fundado em Natal, o Instituto de Educação e Reabilitação de Cegos do Rio
          Grande do Norte tornou-se um espaço de aprendizagem, encontros e participação
          social de pessoas cegas e com baixa visão. Sua trajetória reúne iniciativas
          de educação, habilitação, reabilitação, cultura e esporte.</p>
        <p>A história do IERC também é feita de diferentes gerações de estudantes,
          educadores, famílias e colaboradores. A linha do tempo abaixo reúne
          registros verificáveis; datas e descrições são atribuídas às respectivas fontes.</p>
      </div>

      <section className="institution-purpose editorial-section" aria-labelledby="institution-purpose-title">
        <p className="eyebrow">Identidade institucional</p>
        <h2 id="institution-purpose-title" className="interior-subtitle">Por que o IERC existe e o que busca construir</h2>
        <p className="editorial-intro">Missão e finalidade são complementares:
          a missão expressa o compromisso social; a finalidade descreve o propósito
          educacional e de reabilitação registrado na história da instituição.</p>
        <div className="institution-purpose-grid">
          <article className="institution-purpose-card institution-mission">
            <span className="institution-card-index">01 / Compromisso social</span>
            <h3>Missão</h3>
            <p>Favorecer a participação social e a cidadania de pessoas com deficiência
              visual, inclusive quando associada a outras deficiências, por meio de
              educação, habilitação, reabilitação e construção de uma cultura inclusiva.</p>
            <p className="institution-provenance">Síntese editorial da missão divulgada
              em uma campanha pública de apoio ao Instituto em 2019.</p>
            <SourceLink source="campaign2019" label="Consultar registro da missão (2019)" />
          </article>
          <article className="institution-purpose-card institution-purpose-detail">
            <span className="institution-card-index">02 / Propósito educacional</span>
            <h3>Finalidade</h3>
            <p>Promover oportunidades de desenvolvimento para pessoas cegas e com
              deficiência visual grave, apoiando sua educação, habilitação,
              reabilitação, autonomia e participação na sociedade.</p>
            <p className="institution-provenance">Síntese da finalidade descrita
              no histórico publicado pelo próprio IERC-RN em 2010.</p>
            <SourceLink source="history" label="Consultar histórico institucional (2010)" />
          </article>
        </div>
        <p className="institution-history-disclaimer">Os textos acima são sínteses de fontes históricas
          identificadas, não transcrições certificadas do estatuto ou da missão formal
          atualmente aprovada pela diretoria. A redação oficial vigente depende de validação do IERC-RN.</p>
      </section>

      <section className="institution-axes editorial-section" aria-labelledby="institution-axes-title">
        <p className="eyebrow">Nossa atuação ao longo do tempo</p>
        <h2 id="institution-axes-title" className="interior-subtitle">Eixos que conectam educação e vida cotidiana</h2>
        <p className="editorial-intro">A atuação historicamente documentada do Instituto
          combina diferentes formas de aprender, comunicar-se, movimentar-se,
          expressar-se e participar da comunidade.</p>
        <div className="institution-axes-grid">
          <article className="institution-axis">
            <BookOpen size={30} aria-hidden="true" />
            <h3>Educação e aprendizagem</h3>
            <p>Alfabetização em Braille, leitura, informática e apoio pedagógico
              integram os registros históricos de formação.</p>
          </article>
          <article className="institution-axis">
            <Footprints size={30} aria-hidden="true" />
            <h3>Autonomia e mobilidade</h3>
            <p>Orientação e mobilidade, estimulação precoce e práticas para a vida
              diária ampliam possibilidades de independência.</p>
          </article>
          <article className="institution-axis">
            <Music2 size={30} aria-hidden="true" />
            <h3>Cultura e esporte</h3>
            <p>Música, expressões artísticas, educação física e goalball fazem parte
              da trajetória documentada do IERC-RN.</p>
          </article>
          <article className="institution-axis">
            <Users size={30} aria-hidden="true" />
            <h3>Convivência e cidadania</h3>
            <p>A participação das famílias, a construção de vínculos e parcerias
              comunitárias reforçam o caráter social do Instituto.</p>
          </article>
        </div>
        <p className="institution-axes-link"><Link className="inline-link" href="/atividades">
          Conhecer as atividades do IERC-RN <ArrowUpRight size={17} aria-hidden="true" />
        </Link></p>
      </section>

      <section className="institution-history-overview editorial-section" aria-labelledby="institution-history-title">
        <p className="eyebrow">Um percurso coletivo</p>
        <h2 id="institution-history-title" className="interior-subtitle">Da assistência inicial à educação e à inclusão</h2>
        <div className="institution-history-columns">
          <p>Registros históricos apontam que os primeiros atendimentos se relacionavam
            à assistência e à alfabetização, passando por espaços nas Rocas e pela
            estruturação do trabalho educativo. A reorganização nas décadas seguintes
            fortaleceu o papel da educação, da reabilitação e da autonomia.</p>
          <p>Com a sede no Alecrim e atividades em áreas como Braille, informática, música
            e esporte, o IERC acumulou experiências que também passaram a ser estudadas
            por pesquisadores. Os marcos recentes registram ações de cidadania e
            participações em competições de goalball.</p>
        </div>
        <div className="institution-history-sources">
          <SourceLink source="academiaHistory" label="Pesquisa histórica e depoimentos — UFERSA" />
          <SourceLink source="brailleNortheast" label="História do Braille no RN — UEPB" />
        </div>
      </section>
      <Timeline />

      <p className="institution-history-footer">
        Esta cronologia combina fontes do próprio Instituto, pesquisas acadêmicas,
        imprensa e registros públicos. Não apresenta números antigos de pessoas
        atendidas como indicadores atuais; documentos, nomes, datas e mudanças
        institucionais ainda podem receber complementações do acervo do IERC-RN.
      </p>
      <div className="institution-history-cta">
        <div>
          <p className="eyebrow">A história continua</p>
          <h2>Conheça de perto o Instituto</h2>
          <p>Conheça suas atividades e descubra como entrar em contato, visitar
            ou contribuir com o trabalho da instituição.</p>
        </div>
        <Link className="button button-dark" href="/contato">
          Falar com o IERC-RN <ArrowUpRight size={18} aria-hidden="true"/>
        </Link>
      </div>
    </>
  );
}
