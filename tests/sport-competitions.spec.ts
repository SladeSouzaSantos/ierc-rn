import {expect,test} from "@playwright/test";
import {parseCbdvGoalballCalendar} from "../lib/cbdv-calendar-parser";

const calendar = (rows:string) =>
  '<html><h2>TORNEIOS</h2><h3 style="text-align:left">CALENDÁRIO 2026</h3>'+
  '<table><tbody><tr><th>Início</th><th>Término</th><th>Evento</th><th>Local</th>'+
  '<th>Modalidade</th></tr>'+rows+'</tbody></table>'+
  '<h3>CALENDÁRIO 2025</h3><table><tr><td>09/nov</td><td>15/nov</td>'+
  '<td>Campeonato de Goalball 2025</td><td>Natal/RN</td><td>Goalball</td></tr></table>'+
  '<h2>FASES DE TREINAMENTO</h2><h3>CALENDÁRIO 2026</h3>'+
  '<table><tr><td>10/nov</td><td>15/nov</td>'+
  '<td>Campeonato de Goalball fake treinamento</td><td>Natal/RN</td>'+
  '<td>Goalball</td></tr></table></html>';
const row=(start:string,end:string,title:string,location="São Paulo/SP",sport="Goalball") =>
  '<tr><td>'+start+'</td><td>'+end+'</td><td>'+title+'</td><td>'+
  location+'</td><td>'+sport+'</td><td>Download</td></tr>';
const now=new Date("2026-11-11T18:00:00.000Z");

test("leitor automático CBDV reconhece calendário oficial e ignora treino e outras modalidades",()=>{
  const html=calendar([
    row("10/nov","15/nov","Campeonato Brasileiro de Goalball - Série B"),
    row("26/abr","02/mai","Regional Nordeste de Goalball","Campina Grande/PB"),
    row("29/nov","04/dez","Campeonato Brasileiro de Futebol de Cegos - Série B","São Paulo/SP","Futebol de Cegos"),
    row("11/nov","15/nov","Participação da Arbitragem em Goalball"),
    row("04/dez","05/dez","Goalball Open Internacional"),
  ].join(""));
  const out=parseCbdvGoalballCalendar(html,{now});
  expect(out.map(item=>item.title)).toEqual([
    "Campeonato Brasileiro de Goalball - Série B","Goalball Open Internacional",
  ]);
  expect(out[0].startsAt).toBe("2026-11-10");
  expect(out[0].endsAt).toBe("2026-11-15");
  expect(out[0].location).toBe("São Paulo/SP");
  expect(out[0].sourceUrl).toBe("https://www.cbdv.org.br/calendario");
  expect(out[0].participation).toBe("nao_confirmada");
});

test("leitor CBDV deduplica, descarta datas inválidas e títulos suspeitos",()=>{
  const item=row("10/nov","15/nov","Campeonato de Goalball");
  const html=calendar([
    item,item,
    row("31/fev","03/mar","Goalball Dia Inexistente"),
    row("29/nov","04/dez","Goalball Final"),
    row("10/nov","15/nov","<script>injeta</script> Goalball Evento"),
  ].join(""));
  const results=parseCbdvGoalballCalendar(html,{now});
  expect(results.filter(x=>x.title==="Campeonato de Goalball")).toHaveLength(1);
  expect(results.some(x=>x.title.includes("Inexistente"))).toBe(false);
  expect(results.some(x=>x.title.includes("injeta"))).toBe(false);
  expect(parseCbdvGoalballCalendar("<html>pagina alterada</html>",{now})).toEqual([]);
  expect(results.every(x=>x.participation==="nao_confirmada")).toBe(true);
});

test("página esportes distingue CBDV, competições manuais e lista histórica",async({page})=>{
  await page.goto("/esportes");
  await expect(page.getByRole("heading",{name:"Competições e calendário esportivo"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Competições informadas pelo IERC-RN"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Calendário oficial da CBDV · Goalball"})).toBeVisible();
  await expect(page.getByText(/Estar no calendário da CBDV/)).toBeVisible();
  await expect(page.getByRole("link",{name:/Abrir calendário da CBDV/}))
    .toHaveAttribute("href","https://www.cbdv.org.br/calendario");
  await expect(page.getByRole("heading",{name:"Equipes registradas pela CBDV"})).toBeVisible();
  await expect(page.locator(".sport-roster li")).toHaveCount(6);
});
