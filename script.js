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
    return true;
  };

  const ok1 = setVal("fcQuemDisplay");
  const ok2 = setVal("plQuemDisplay");

  if (!(ok1 && ok2) && tries > 0){
    requestAnimationFrame(()=> fillLoggedUserFields(me, tries-1));
  }

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
    setTimeout(()=> fillLoggedUserFields(window.__me_cached),0);
  });
  document.getElementById("planosForm")?.addEventListener("reset",()=>{
    setTimeout(()=> fillLoggedUserFields(window.__me_cached),0);
  });

  // reforço temporário
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

  // Primeira carga da lista do dia
  const diaInicial = document.getElementById("fcData")?.value || todayISO();
  loadFechamentosDoDia(diaInicial);
});

/* ========= Fechamento ========= */
function initFechamento(me){
  const fcData=document.getElementById("fcData");
  if(fcData && !fcData.value) fcData.value=todayISO();
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

  // recarrega lista do dia ao mudar a data
  fcData?.addEventListener("change",(e)=>{
    const dia = e.target.value || todayISO();
    loadFechamentosDoDia(dia);
  });

  const form=document.getElementById("fechamentoForm");
  if(!form) return;

  const afterSaveReload = async ()=>{
    const dia = document.getElementById("fcData")?.value || todayISO();
    await loadFechamentosDoDia(dia);
  };

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
      if(fcData) fcData.value=payload.data || todayISO();
      ["fcPlano","fcOrto","fcOrtoApenas"].forEach(id=>{const e=document.getElementById(id);if(e)e.value=0;});
      alert("Fechamento salvo!");
      await afterSaveReload();
    }catch(err){ alert("Erro ao salvar: "+err.message); }
  });
}

/* ========= Lista do dia (aba Fechamento) ========= */
async function loadFechamentosDoDia(diaISO){
  const body = document.querySelector("#diaTabela tbody");
  if(!body) return;

  // Garante que estamos usando a data do input, se existir
  const dataInput = document.getElementById("fcData")?.value;
  const dia = (diaISO || dataInput || todayISO());

  body.innerHTML = "<tr><td colspan='13'>Carregando...</td></tr>";

  try{
    const qs = new URLSearchParams({ ini: dia, fim: dia });
    const url = urlApi("fechamentos_list.php") + "?" + qs.toString();
    const rows = await apiGet(url);

    console.log("[loadFechamentosDoDia]", { dia, url, rowsCount: rows.length });

    body.innerHTML = "";

    if (!rows.length){
      body.innerHTML = "<tr><td colspan='13'>Nenhum fechamento encontrado para este dia.</td></tr>";
      // zera totais do rodapé
      const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent = val; };
      set("diaDinheiro", "R$ 0,00");
      set("diaPix",      "R$ 0,00");
      set("diaDebito",   "R$ 0,00");
      set("diaCredito",  "R$ 0,00");
      set("diaBoletos",  "R$ 0,00");
      set("diaTotal",    "R$ 0,00");
      set("diaLife",     0);
      set("diaLifeOrto", 0);
      set("diaOrto",     0);
      return;
    }

    const tot = {dinheiro:0,pix:0,debito:0,credito:0,boletos:0,total:0,plano:0,orto:0,orto_puro:0};

    rows.forEach(r=>{
      tot.dinheiro += +r.dinheiro||0;
      tot.pix      += +r.pix||0;
      tot.debito   += +r.debito||0;
      tot.credito  += +r.credito||0;
      tot.boletos  += +r.boletos||0;
      tot.total    += +r.total||0;
      tot.plano    += +r.plano||0;
      tot.orto     += +r.orto||0;
      tot.orto_puro+= +r.orto_puro||0;

      const tr = document.createElement("tr");
      // tenta created_at; se não vier, mostra "--:--"
      const hora = (r.created_at?.split(" ")[1]?.slice(0,5)) || "--:--";

      const cells = [
        hora, r.quem,
        brl(r.dinheiro), brl(r.pix), brl(r.debito), brl(r.credito), brl(r.boletos), brl(r.total),
        Number(r.plano||0), Number(r.orto||0), Number(r.orto_puro||0),
        r.obs||"-"
      ];
      cells.forEach((v,i)=>{
        const td=document.createElement("td");
        td.textContent=v;
        if(i===7) td.style.fontWeight="700";
        tr.appendChild(td);
      });

      const tdAcoes = document.createElement("td");
      tdAcoes.innerHTML = `
        <button class="btn btn-sm" data-act="edit" data-id="${r.id}">Editar</button>
        <button class="btn btn-sm btn-outline" data-act="del" data-id="${r.id}">Excluir</button>
      `;
      tr.appendChild(tdAcoes);

      tr.dataset.row = JSON.stringify(r);
      body.appendChild(tr);
    });

    // Totais rodapé
    const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent = val; };
    set("diaDinheiro", brl(tot.dinheiro));
    set("diaPix",      brl(tot.pix));
    set("diaDebito",   brl(tot.debito));
    set("diaCredito",  brl(tot.credito));
    set("diaBoletos",  brl(tot.boletos));
    set("diaTotal",    brl(tot.total));
    set("diaLife",     tot.plano);
    set("diaLifeOrto", tot.orto);
    set("diaOrto",     tot.orto_puro);

  }catch(e){
    console.error("[loadFechamentosDoDia][ERROR]", e);
    body.innerHTML = "<tr><td colspan='13'>Erro ao carregar.</td></tr>";
  }
}


/* ========= Delegação para Editar / Excluir (lista do dia) ========= */
document.addEventListener("click", async (ev)=>{
  const btn = ev.target.closest("[data-act]");
  if(!btn) return;

  const act = btn.dataset.act;
  const id  = Number(btn.dataset.id||0);
  if(!id) return;

  if(act === "edit"){
    const tr = btn.closest("tr");
    const r  = tr?.dataset?.row ? JSON.parse(tr.dataset.row) : null;
    if(!r) return;
    openEditFechDialog(r);
  }

  if(act === "del"){
    if(!confirm("Deseja realmente excluir este fechamento?")) return;
    try{
      await apiPost(urlApi("fechamentos_delete.php"), { id });
      const dia = document.getElementById("fcData")?.value || todayISO();
      await loadFechamentosDoDia(dia);
      alert("Fechamento excluído!");
    }catch(e){
      alert("Erro ao excluir: " + e.message);
    }
  }
});

/* ========= Modal de edição ========= */
function fillEditField(id, val){ const el=document.getElementById(id); if(el) el.value = val ?? ""; }

function openEditFechDialog(row){
  const dlg = document.getElementById("editFechDialog");
  if(!dlg) return;
  fillEditField("efId",        row.id);
  fillEditField("efData",      row.data);
  fillEditField("efDinheiro",  (Number(row.dinheiro)||0).toLocaleString("pt-BR",{minimumFractionDigits:2}));
  fillEditField("efPix",       (Number(row.pix)||0).toLocaleString("pt-BR",{minimumFractionDigits:2}));
  fillEditField("efDebito",    (Number(row.debito)||0).toLocaleString("pt-BR",{minimumFractionDigits:2}));
  fillEditField("efCredito",   (Number(row.credito)||0).toLocaleString("pt-BR",{minimumFractionDigits:2}));
  fillEditField("efBoletos",   (Number(row.boletos)||0).toLocaleString("pt-BR",{minimumFractionDigits:2}));
  fillEditField("efTotal",     (Number(row.total)||0).toLocaleString("pt-BR",{minimumFractionDigits:2}));
  fillEditField("efPlano",     row.plano||0);
  fillEditField("efOrto",      row.orto||0);
  fillEditField("efOrtoPuro",  row.orto_puro||0);
  fillEditField("efObs",       row.obs||"");

  document.getElementById("efCancel")?.addEventListener("click", ()=> dlg.close(), { once:true });

  const form = document.getElementById("editFechForm");
  form.onsubmit = async (e)=>{
    e.preventDefault();

    const payload = {
      id: Number(document.getElementById("efId").value),
      data: document.getElementById("efData").value,
      dinheiro: parseBRL(document.getElementById("efDinheiro").value),
      pix:      parseBRL(document.getElementById("efPix").value),
      debito:   parseBRL(document.getElementById("efDebito").value),
      credito:  parseBRL(document.getElementById("efCredito").value),
      boletos:  parseBRL(document.getElementById("efBoletos").value),
      total:    parseBRL(document.getElementById("efTotal").value),
      plano:    toInt(document.getElementById("efPlano").value),
      orto:     toInt(document.getElementById("efOrto").value),
      orto_puro:toInt(document.getElementById("efOrtoPuro").value),
      obs: (document.getElementById("efObs").value||"").trim()
    };
    try{
      await apiPost(urlApi("fechamentos_update.php"), payload);
      dlg.close();
      const dia = document.getElementById("fcData")?.value || todayISO();
      await loadFechamentosDoDia(dia);
      alert("Fechamento atualizado!");
    }catch(err){
      alert("Erro ao atualizar: " + err.message);
    }
  };

  dlg.showModal();
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

// ===== Relatórios com paginação =====
let relatorioRows = [];    // dados carregados
let relatorioPage = 1;     // página atual
const relatorioPerPage = 50; // 50 lançamentos por página

async function aplicarFiltrosRelatorios(){
  const body=document.querySelector("#relTabela tbody");
  if(!body)return;
  body.innerHTML="<tr><td colspan='12'>Carregando...</td></tr>";

  try{
    relatorioRows = await buildRelatorioRows();
    relatorioPage = 1;
    renderPaginaRelatorios();
  }catch(e){
    console.error(e);
    body.innerHTML="<tr><td colspan='12'>Erro ao carregar relatórios.</td></tr>";
  }
}

function renderPaginaRelatorios(){
  const body=document.querySelector("#relTabela tbody");
  if(!body)return;

  const start = (relatorioPage-1)*relatorioPerPage;
  const end = start + relatorioPerPage;
  const rows = relatorioRows.slice(start,end);

  body.innerHTML = "";

  if(!rows.length){
    body.innerHTML="<tr><td colspan='12'>Nenhum registro encontrado.</td></tr>";
    document.getElementById("relPaginacao")?.remove();
    return;
  }

  // Totais gerais
  const sum=relatorioRows.reduce((a,r)=>({
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

  // Render linhas da página
  rows.forEach(r=>{
    const tr=document.createElement("tr");
    [r.data,r.quem,brl(r.dinheiro),brl(r.pix),brl(r.debito),brl(r.credito),brl(r.boletos),brl(r.total),
     Number(r.plano||0),Number(r.orto||0),Number(r.orto_puro||0),r.obs||"-"].forEach((v,i)=>{
      const td=document.createElement("td"); td.textContent=v; if(i===7)td.style.fontWeight="700"; tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  // ======= Paginação =======
  let pagDiv = document.getElementById("relPaginacao");
  if(!pagDiv){
    pagDiv = document.createElement("div");
    pagDiv.id = "relPaginacao";
    pagDiv.className = "paginacao-bar";
    body.parentElement.parentElement.appendChild(pagDiv);
  }

  const totalPages = Math.ceil(relatorioRows.length / relatorioPerPage);
  pagDiv.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;">
      <button class="btn btn-sm" id="relPrev" ${relatorioPage<=1?'disabled':''}>◀ Anterior</button>
      <span>Página ${relatorioPage} de ${totalPages} (${relatorioRows.length} lançamentos)</span>
      <button class="btn btn-sm" id="relNext" ${relatorioPage>=totalPages?'disabled':''}>Próxima ▶</button>
    </div>
  `;

  document.getElementById("relPrev")?.addEventListener("click",()=>{
    if(relatorioPage>1){ relatorioPage--; renderPaginaRelatorios(); }
  });
  document.getElementById("relNext")?.addEventListener("click",()=>{
    const totalPages = Math.ceil(relatorioRows.length / relatorioPerPage);
    if(relatorioPage<totalPages){ relatorioPage++; renderPaginaRelatorios(); }
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
