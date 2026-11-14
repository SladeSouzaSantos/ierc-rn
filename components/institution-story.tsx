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
        <p>Nos primeiros anos, o atendimento ocorreu em consultórios médicos nas ruas
          Dr. Barata e Floriano Peixoto e, depois, na chamada Escola das Rocas,
          onde ensino e acolhimento caminhavam juntos. Esses espaços são descritos
          em pesquisa historiográfica realizada a partir do acervo e de entrevistas no IERC.</p>
        <p>A história também é feita de estudantes, educadores, famílias e colaboradores.
          Os marcos abaixo reúnem registros de diferentes épocas, sempre com fontes
          identificadas e sem confundir memória histórica com oferta atual de serviços.</p>
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
            <p>Desenvolver ações de habilitação e reabilitação de pessoas cegas
              e com deficiência visual, além de educação, formação, integração social
              e qualificação profissional, conforme a finalidade registrada
              no estatuto de 2003 citado em pesquisa acadêmica.</p>
            <p className="institution-provenance">Síntese do estatuto registrado
              em 26 de março de 2003, documentado na pesquisa de Vieira e Carvalho Filho
              (2024). A versão estatutária vigente ainda deve ser confirmada.</p>
            <SourceLink source="academiaHistory" label="Consultar pesquisa sobre o estatuto de 2003" />
          </article>
        </div>
        <p className="institution-history-disclaimer">Os textos acima são sínteses de fontes históricas
          identificadas, não transcrições certificadas do estatuto ou da missão formal
          atualmente aprovada pela diretoria. O estudo acadêmico consultou um estatuto
          registrado em 2003; sua vigência e a redação oficial atual dependem de validação do IERC-RN.</p>
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
            <p>Alfabetização em Braille, escrita cursiva, informática e materiais
              táteis adaptados aparecem nas práticas documentadas pelo estudo de 2024.</p>
          </article>
          <article className="institution-axis">
            <Footprints size={30} aria-hidden="true" />
            <h3>Autonomia e mobilidade</h3>
            <p>Orientação e mobilidade, estimulação precoce e experiências com
              sons e texturas apoiavam a aprendizagem e a autonomia nas visitas de 2024.</p>
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
            <p>Acolhimento de famílias, troca de saberes, festas e encontros
              reforçam a dimensão comunitária registrada nas entrevistas de 2024.</p>
          </article>
        </div>
        <p className="institution-axes-link"><Link className="inline-link" href="/atividades">
          Conhecer as atividades do IERC-RN <ArrowUpRight size={17} aria-hidden="true" />
        </Link></p>
      </section>

      <section className="institution-research editorial-section" aria-labelledby="institution-research-title">
        <p className="eyebrow">Memórias registradas em 2024</p>
        <h2 id="institution-research-title" className="interior-subtitle">
          O IERC também é feito das relações que acontecem ali
        </h2>
        <p className="editorial-intro">Em trabalho de especialização em Atendimento
          Educacional Especializado pela UFERSA, Arthur Cassio de Oliveira Vieira
          e Evanilson Gurgel de Carvalho Filho reuniram documentos, visitas e
          entrevistas para investigar a história e a sociabilidade no IERC-RN.
          A pesquisa permite conhecer práticas pedagógicas da época sem
          apresentá-las como programação atual.</p>
        <div className="institution-research-grid">
          <article className="institution-research-card">
            <span>Aprender pelo tato</span>
            <h3>Braille e materiais criados para ensinar</h3>
            <p>O estudo documenta professoras que adaptavam materiais de
              alfabetização com recursos táteis, criando alternativas quando
              equipamentos especializados eram caros ou indisponíveis.</p>
          </article>
          <article className="institution-research-card">
            <span>Descobrir e experimentar</span>
            <h3>Estimulação precoce e experiências sensoriais</h3>
            <p>Nas visitas realizadas para a pesquisa, uma sala de estimulação
              precoce reunia objetos com diferentes sons, cores, tamanhos e
              texturas para apoiar o desenvolvimento e a interação infantil.</p>
          </article>
          <article className="institution-research-card">
            <span>Compartilhar saberes</span>
            <h3>Acolhimento, convivência e cidadania</h3>
            <p>As entrevistas destacam a presença das famílias, a convivência
              em atividades culturais e esportivas e pessoas que difundiram
              aprendizados em Braille para além dos muros do Instituto.</p>
          </article>
        </div>
        <p className="institution-research-footnote">Retrato histórico de 2024.
          Depoimentos foram resumidos sem reproduzir entrevistas individuais
          ou expor crianças. Serviços, profissionais, equipamentos e horários
          atuais devem ser confirmados com o IERC-RN.</p>
        <SourceLink source="academiaHistory"
          label="Ler pesquisa de Vieira e Carvalho Filho (UFERSA, 2024)" />
      </section>

      <section className="institution-history-overview editorial-section" aria-labelledby="institution-history-title">
        <p className="eyebrow">Um percurso coletivo</p>
        <h2 id="institution-history-title" className="interior-subtitle">Da assistência inicial à educação e à inclusão</h2>
        <div className="institution-history-prose">
          <p>Uma pesquisa com documentos e memória oral descreve a iniciativa de
            médicos de Natal, os primeiros atendimentos em consultórios e o
            funcionamento da Escola das Rocas. O estudo também cita reconhecimentos
            de utilidade pública municipal (1978) e estadual (1979), anteriores
            à transferência para a sede no Alecrim, relatada como ocorrida em 1982.</p>
          <p>O estatuto registrado em 2003, conforme apresentado no estudo, reúne
            educação, reabilitação, integração social e formação profissional
            entre as finalidades do IERC. A trajetória passou por mudanças no
            modelo escolar e de financiamento, sem que este registro permita
            determinar o funcionamento ou as fontes de recursos atuais.</p>
        </div>
        <div className="institution-history-sources">
          <SourceLink source="academiaHistory" label="Pesquisa histórica e depoimentos — UFERSA" />
          <SourceLink source="brailleNortheast" label="História do Braille no RN — UEPB" />
        </div>
      </section>
      <Timeline />

      <p className="institution-history-footer">
        Esta cronologia combina fontes do próprio Instituto, pesquisas acadêmicas,
        imprensa e registros públicos. O trabalho de 2024 é de Arthur Cassio de
        Oliveira Vieira e Evanilson Gurgel de Carvalho Filho. Fotografias do estudo
        não foram reproduzidas por dependerem de autorização. Não apresenta
        números antigos de pessoas
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
