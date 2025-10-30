/* ========= Config ========= */
const API_PREFIX = "/caixa-odonto/";

/* ========= Helpers ========= */
const brl = n => (Number(n) || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const parseBRL = s => parseFloat(String(s||"").replace(/\s/g,"").replace(/\./g,"").replace(",",".")||0);
const todayISO = () => new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const toInt = v => { const n = parseInt(v||0,10); return isFinite(n)&&n>0?n:0; };
const urlAuth = p => API_PREFIX + "auth/" + p;
const urlApi  = p => API_PREFIX + "api/"  + p;

async function apiGet(url){
  const r = await fetch(url,{credentials:'same-origin'});
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}
async function apiPost(url,data){
  const r = await fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'same-origin',
    body:JSON.stringify(data)
  });
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error||('HTTP '+r.status));
  return j;
}

/* ========= Preenche usuário logado ========= */
function fillLoggedUserFields(me, tries = 8){
  const name = me?.name || me?.displayName || me || "";
  console.log("[fillLoggedUserFields] start", { name, tries });
  if (!name) return;

  const headerUser = document.getElementById("currentUser");
  if (headerUser) headerUser.textContent = name;

  const setVal = (id) => {
    const el = document.getElementById(id);
    if (!el) { console.warn(`[fillLoggedUserFields] #${id} não encontrado`); return false; }
    el.readOnly = true;
    el.value = name;
    el.defaultValue = name;
    el.placeholder = name;
    console.log(`[fillLoggedUserFields] set ${id} =`, el.value);
    el.addEventListener("input", ()=> console.warn(`[watch] input em #${id}:`, el.value));
    el.addEventListener("change", ()=> console.warn(`[watch] change em #${id}:`, el.value));
    return true;
  };

  const ok1 = setVal("fcQuemDisplay");
  const ok2 = setVal("plQuemDisplay");

  if (!(ok1 && ok2) && tries > 0){
    requestAnimationFrame(()=> fillLoggedUserFields(me, tries-1));
  }

  // Observa alterações do DOM nesses campos
  ["fcQuemDisplay","plQuemDisplay"].forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    const mo = new MutationObserver(()=> console.warn(`[MO] mudança detectada em #${id}: value=`, el.value));
    mo.observe(el,{attributes:true,attributeFilter:["value"]});
  });
}

/* ========= Boot ========= */
document.addEventListener("DOMContentLoaded", async ()=>{
  if (location.pathname.endsWith("login.html")) return;

  let me;
  try{
    me = await apiGet(urlAuth("me.php"));
  }catch(e){
    console.error("Erro no auth:", e);
    location.href = "login.html";
    return;
  }
  window.__me_cached = me;
  fillLoggedUserFields(me);

  // Observa resets
  document.getElementById("fechamentoForm")?.addEventListener("reset",()=>{
    console.warn("[reset] fechamentoForm");
    setTimeout(()=> fillLoggedUserFields(window.__me_cached),0);
  });
  document.getElementById("planosForm")?.addEventListener("reset",()=>{
    console.warn("[reset] planosForm");
    setTimeout(()=> fillLoggedUserFields(window.__me_cached),0);
  });

  // reforço automático temporário
  let _i=0; const _timer=setInterval(()=>{
    const top=document.getElementById("currentUser")?.textContent?.trim();
    if(top){
      const f=document.getElementById("fcQuemDisplay");
      const p=document.getElementById("plQuemDisplay");
      if(f && !f.value) f.value=f.defaultValue=top;
      if(p && !p.value) p.value=p.defaultValue=top;
    }
    if(++_i>6) clearInterval(_timer);
  },1000);

  const logoutBtn=document.getElementById("logoutBtn");
  if(logoutBtn) logoutBtn.onclick=async()=>{
    await apiGet(urlAuth("logout.php"));
    location.href="login.html";
  };

  const buttons=[...document.querySelectorAll(".tab-btn")];
  const panels=[...document.querySelectorAll(".tab-panel")];
  function showTab(id){
    buttons.forEach(b=>{
      const act=b.dataset.tab===id;
      b.classList.toggle("active",act);
      b.setAttribute("aria-selected",String(act));
    });
    panels.forEach(p=>{
      const act=p.id===id;
      p.classList.toggle("active",act);
      p.hidden=!act;
    });
    fillLoggedUserFields(me);
    if(id==="dashboard") renderDashboard();
  }
  buttons.forEach(btn=>btn.addEventListener("click",()=>showTab(btn.dataset.tab)));
  showTab(document.querySelector(".tab-btn.active")?.dataset.tab||"fechamento");

  initFechamento(me);
  initRelatorios();
  initPlanos(me);
  renderDashboard();
});

/* ========= Fechamento ========= */
function initFechamento(me){
  const fcData=document.getElementById("fcData");
  if(fcData) fcData.value=todayISO();
  fillLoggedUserFields(me);

  const ids=["fcDinheiro","fcPix","fcDebito","fcCredito","fcBoletos"];
  const inputs=ids.map(id=>document.getElementById(id)).filter(Boolean);
  const fcTotal=document.getElementById("fcTotal");
  const calcTotal=()=>{
    const tot=inputs.map(i=>parseBRL(i.value)).reduce((a,b)=>a+b,0);
    if(fcTotal) fcTotal.value=tot.toLocaleString("pt-BR",{minimumFractionDigits:2});
  };
  inputs.forEach(inp=>inp.addEventListener("blur",()=>{
    const v=parseBRL(inp.value);
    inp.value=v?v.toLocaleString("pt-BR",{minimumFractionDigits:2}):"";
    calcTotal();
  }));
  document.getElementById("calcTotal")?.addEventListener("click",calcTotal);

  const form=document.getElementById("fechamentoForm");
  if(!form) return;
  form.addEventListener("submit",async e=>{
    e.preventDefault(); calcTotal();
    const payload={
      data:fcData?.value||todayISO(),
      dinheiro:parseBRL(document.getElementById("fcDinheiro")?.value),
      pix:parseBRL(document.getElementById("fcPix")?.value),
      debito:parseBRL(document.getElementById("fcDebito")?.value),
      credito:parseBRL(document.getElementById("fcCredito")?.value),
      boletos:parseBRL(document.getElementById("fcBoletos")?.value),
      total:parseBRL(fcTotal?.value),
      plano:toInt(document.getElementById("fcPlano")?.value),
      orto:toInt(document.getElementById("fcOrto")?.value),
      orto_puro:toInt(document.getElementById("fcOrtoApenas")?.value),
      obs:(document.getElementById("fcObs")?.value||"").trim()
    };
    try{
      await apiPost(urlApi("fechamentos_create.php"),payload);
      form.reset(); fillLoggedUserFields(me);
      if(fcData) fcData.value=todayISO();
      ["fcPlano","fcOrto","fcOrtoApenas"].forEach(id=>{const e=document.getElementById(id);if(e)e.value=0;});
      alert("Fechamento salvo!");
    }catch(err){ alert("Erro ao salvar: "+err.message); }
  });
}

/* ========= Relatórios ========= */
async function buildRelatorioRows(){
  const ini=document.getElementById("fDataIni")?.value||'';
  const fim=document.getElementById("fDataFim")?.value||'';
  const quem=document.getElementById("fQuem")?.value||'';
  const plano=document.getElementById("fPlanoTipo")?.value||'';
  const qs=new URLSearchParams();
  if(ini)qs.set('ini',ini); if(fim)qs.set('fim',fim);
  if(quem)qs.set('quem',quem); if(plano)qs.set('plano',plano);
  return apiGet(urlApi("fechamentos_list.php")+(qs.toString()?'?'+qs.toString():''));
}

async function aplicarFiltrosRelatorios(){
  const body=document.querySelector("#relTabela tbody");
  if(!body)return;
  body.innerHTML="<tr><td colspan='12'>Carregando...</td></tr>";
  const rows=await buildRelatorioRows();
  body.innerHTML="";
  const sum=rows.reduce((a,r)=>({
    dinheiro:a.dinheiro+Number(r.dinheiro||0),
    pix:a.pix+Number(r.pix||0),
    debito:a.debito+Number(r.debito||0),
    credito:a.credito+Number(r.credito||0),
    boletos:a.boletos+Number(r.boletos||0),
    total:a.total+Number(r.total||0),
    life:a.life+Number(r.plano||0),
    orto:a.orto+Number(r.orto||0),
    orto_puro:a.orto_puro+Number(r.orto_puro||0)
  }),{dinheiro:0,pix:0,debito:0,credito:0,boletos:0,total:0,life:0,orto:0,orto_puro:0});
  const setText=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  setText("sumDinheiro",brl(sum.dinheiro));
  setText("sumPix",brl(sum.pix));
  setText("sumDebito",brl(sum.debito));
  setText("sumCredito",brl(sum.credito));
  setText("sumBoletos",brl(sum.boletos));
  setText("sumTotal",brl(sum.total));
  setText("sumLife",sum.life);
  setText("sumOrto",sum.orto);
  setText("sumOrtoPuro",sum.orto_puro);

  rows.forEach(r=>{
    const tr=document.createElement("tr");
    [r.data,r.quem,brl(r.dinheiro),brl(r.pix),brl(r.debito),brl(r.credito),brl(r.boletos),brl(r.total),
     Number(r.plano||0),Number(r.orto||0),Number(r.orto_puro||0),r.obs||"-"].forEach((v,i)=>{
      const td=document.createElement("td"); td.textContent=v; if(i===7)td.style.fontWeight="700"; tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

/* Popula o select de "Quem fechou" com nomes distintos vindos da API */
async function populateSelectQuem() {
  const sel = document.getElementById("fQuem");
  if (!sel) return;
  try {
    const rows = await apiGet(urlApi("fechamentos_list.php"));
    const nomes = [...new Set(rows.map(r => r.quem).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'pt-BR'));
    sel.innerHTML = '<option value="">Todos</option>' + nomes.map(n => `<option value="${n}">${n}</option>`).join('');
  } catch (e) {
    console.warn("Não foi possível carregar lista de 'Quem fechou':", e);
  }
}

function initRelatorios(){
  document.getElementById("btnAplicarFiltros")?.addEventListener("click",aplicarFiltrosRelatorios);
  document.getElementById("btnLimparFiltros")?.addEventListener("click",()=>{
    ["fDataIni","fDataFim","fQuem","fPlanoTipo"].forEach(id=>{const e=document.getElementById(id);if(e)e.value="";});
    aplicarFiltrosRelatorios();
  });
  document.getElementById("btnExportarCSV")?.addEventListener("click",()=>window.location.href=urlApi("fechamentos_csv.php"));

  // Primeiro popula o select com os nomes; depois aplica os filtros para a primeira renderização.
  populateSelectQuem().then(aplicarFiltrosRelatorios);
}

/* ========= Dashboard ========= */
let chartPagamentos,chartDiario;
async function renderDashboard(){
  const c1=document.getElementById("chartPagamentos"); const c2=document.getElementById("chartDiario");
  if(!c1&&!c2)return;
  let rows=[]; try{rows=await apiGet(urlApi("fechamentos_list.php"));}catch{}
  const soma={Dinheiro:0,PIX:0,Débito:0,Crédito:0,Boletos:0};
  rows.forEach(r=>{
    soma.Dinheiro+=+r.dinheiro||0; soma.PIX+=+r.pix||0;
    soma.Débito+=+r.debito||0; soma.Crédito+=+r.credito||0; soma.Boletos+=+r.boletos||0;
  });
  if(c1){ if(chartPagamentos)chartPagamentos.destroy();
    chartPagamentos=new Chart(c1,{type:"doughnut",data:{labels:Object.keys(soma),datasets:[{data:Object.values(soma)}]},options:{plugins:{legend:{position:"bottom"}}}});
  }
  const porDia={}; rows.forEach(r=>porDia[r.data]=(porDia[r.data]||0)+(+r.total||0));
  const dias=Object.keys(porDia).sort();
  if(c2){ if(chartDiario)chartDiario.destroy();
    chartDiario=new Chart(c2,{type:"line",data:{labels:dias,datasets:[{label:"Total diário (R$)",data:dias.map(d=>porDia[d]),tension:.25}]}});}
}

/* ========= Planos ========= */
function initPlanos(me){
  const form = document.getElementById("planosForm");
  const body = document.querySelector("#plTabela tbody");
  if(!form || !body) return;

  fillLoggedUserFields(me);

  const $nome  = document.getElementById("plNome");
  const $cpf   = document.getElementById("plCPF");
  const $tel   = document.getElementById("plTelefone");
  const $plano = document.getElementById("plPlano");

  form.addEventListener("submit", async e=>{
    e.preventDefault();
    const v = {
      nome: ($nome?.value || "").trim(),
      cpf: ($cpf?.value || "").trim(),
      telefone: ($tel?.value || "").trim(),
      plano: $plano?.value
    };
    if(!v.nome) return alert("Nome é obrigatório");
    try{
      await apiPost(urlApi("planos_create.php"), v);
      form.reset();
      fillLoggedUserFields(me);
      renderTabelaPlanos();
    }catch(err){
      alert("Erro ao salvar: "+err.message);
    }
  });

  document.getElementById("plExportCSV")?.addEventListener("click",()=>window.location.href=urlApi("planos_csv.php"));
  renderTabelaPlanos();
}

async function renderTabelaPlanos(){
  const body=document.querySelector("#plTabela tbody");
  if(!body)return;
  body.innerHTML="<tr><td colspan='6'>Carregando...</td></tr>";
  try{
    const rows=await apiGet(urlApi("planos_list.php"));
    body.innerHTML="";
    rows.forEach(r=>{
      const tr=document.createElement("tr");
      [r.data,r.nome,r.cpf||"-",r.telefone||"-",r.plano,r.quem].forEach(v=>{
        const td=document.createElement("td"); td.textContent=v; tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }catch{
    body.innerHTML="<tr><td colspan='6'>Erro ao carregar.</td></tr>";
  }
}
