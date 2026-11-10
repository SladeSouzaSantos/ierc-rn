import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coverageFor,mentionsIerc} from '../src/coverage-policy.mjs';
import {relevanceAssessment,rankArticles} from '../src/relevance.mjs';
const ebc={id:'agencia-brasil-esportes',country:'Brasil',section:'esportes'};
const local={title:'Prefeitura de Natal seleciona IERC/RN para chamamento de paradesporto',
 summary:'O Instituto de Educação e Reabilitação de Cegos do Rio Grande do Norte integra a iniciativa de goalball.'};
test('direct references to IERC-RN get highest editorial priority without pretending institutional authorship',()=>{
 assert.equal(mentionsIerc(local),true);
 assert.equal(mentionsIerc({title:'Instituto de Educação e Reabilitação de Cegos do Rio Grande do Norte participa do goalball'}),true);
 assert.equal(coverageFor(local,ebc).track,'ierc');
 assert.equal(coverageFor(local,ebc).scope,'local');
 assert.equal(relevanceAssessment(local,ebc).score,100);
 assert.equal(mentionsIerc({title:'Instituto de cegos de outro estado vence premiação'}),false);
});
test('disability inclusion in Brazil is national; accessible actions overseas are international',()=>{
 const national={title:'Brasil amplia iniciativas de braille e educação inclusiva',
   summary:'Escolas brasileiras oferecem materiais acessíveis para estudantes cegos.'};
 assert.equal(coverageFor(national,ebc).track,'brasil');
 const abroad={title:'No Japão, iniciativa de tecnologia assistiva facilita vida de pessoas cegas',
   summary:'Entidade apresenta ferramentas educacionais de acessibilidade para estudantes.'};
 assert.equal(coverageFor(abroad,ebc).track,'internacional');
 const perkins={id:'perkins',country:'Estados Unidos'};
 assert.equal(coverageFor(national,perkins).track,'internacional');
 const translated={id:'agencia-brasil-internacional',section:'internacional',country:'Brasil'};
 assert.equal(coverageFor(national,translated).track,'internacional');
});
test('ranking prioritizes direct IERC mention over national and international stories',()=>{
 const items=[
   {title:'Internacional: braille e educação inclusiva',summary:'No Canadá, tecnologia assistiva para estudantes cegos',url:'https://x.org/i',publishedAt:'2026-11-10T00:00:00Z'},
   {title:'Brasil amplia educação inclusiva',summary:'Acessibilidade para estudantes com deficiência visual',url:'https://x.org/n',publishedAt:'2026-11-10T00:00:00Z'},
   {...local,url:'https://x.org/l',publishedAt:'2026-11-10T00:00:00Z'},
 ];
 const sorted=rankArticles(items,ebc);
 assert.equal(sorted.length,3);
 assert.equal(sorted[0].coverageTrack,'ierc');
 assert.equal(sorted[1].coverageTrack,'brasil');
 assert.equal(sorted[2].coverageTrack,'internacional');
});
test('normal Portuguese topics work without making unrelated general news relevant',()=>{
 const rn={title:'Tecnologia assistiva ajuda pessoas com deficiência visual',
   summary:'Projeto de acessibilidade e leitura Braille'};
 assert.equal(relevanceAssessment(rn,ebc).relevant,true);
 assert.equal(relevanceAssessment({title:'Resultado de jogo de futebol na noite passada',summary:'Clube da capital vence confronto'},ebc).relevant,false);
 assert.equal(relevanceAssessment({title:'Governo anuncia nova linha de crédito',summary:'Economia do país'},ebc).relevant,false);
});
