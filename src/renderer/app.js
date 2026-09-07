const views=document.querySelectorAll('.view');
const navButtons=document.querySelectorAll('nav button');

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function fmtDate(v){if(!v)return 'No identificada';try{return new Date(`${String(v).slice(0,10)}T00:00:00`).toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'2-digit'});}catch{return v;}}
function directUrl(d){return d.pdf_url||d.source_url||'';}
function geoText(d){return [d.geographic_scope,d.department,d.municipality].filter((x,i,a)=>x&&a.indexOf(x)===i).join(' · ')||'No identificado';}
function isIntelligence(d){return d.document_family==='Noticias y alertas';}
function linkLabel(d){return isIntelligence(d)?'Abrir publicación fuente ↗':'Ver / descargar documento ↗';}
function alertClass(level){return level==='Alta'?'alert-high':level==='Media'?'alert-medium':'alert-info';}

function go(view){
  navButtons.forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  views.forEach(v=>v.classList.toggle('active',v.id===view));
  if(view==='dashboard')loadDashboard();
  if(view==='database')loadDatabase();
  if(view==='searchView')runSearch();
  if(view==='intelligence')loadIntelligence();
  if(view==='news')loadNews();
  if(view==='jurisprudence')loadJurisprudence();
  if(view==='sources')loadSources();
}
navButtons.forEach(btn=>btn.addEventListener('click',()=>go(btn.dataset.view)));
document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>go(btn.dataset.go)));

function documentCard(d){
  const url=directUrl(d), intel=isIntelligence(d);
  return `<article class="doccard ${d.is_new?'newdoc':''} ${intel?'intelcard':''}">
    <div class="cardtop">
      ${d.is_new?'<span class="badge fresh">NOVEDAD</span>':''}
      ${intel&&d.alert_level?`<span class="badge ${alertClass(d.alert_level)}">ALERTA ${esc(d.alert_level).toUpperCase()}</span>`:''}
      <span class="badge family">${esc(d.document_family||'Sin clasificar')}</span>
      <span class="badge ${d.importance==='alta'?'high':''}">${esc(d.document_type||'Documento')}</span>
      ${d.sector?`<span class="badge sector">${esc(d.sector)}</span>`:''}
    </div>
    <h3>${esc(d.title)}</h3>
    <div class="meta">${esc(d.authority||d.entity||'Fuente no identificada')}${d.source_category?` · ${esc(d.source_category)}`:''}</div>
    <p>${esc(d.about_text||d.summary||'Sin descripción disponible.')}</p>
    ${intel?`<div class="why"><b>¿Por qué importa?</b><span>${esc(d.relevance_reason||'Contenido de interés para la gestión ambiental y de sostenibilidad.')}</span></div>`:''}
    <div class="metadata">
      <div><b>${intel?'Fecha publicación':'Fecha documento'}</b><span>${esc(fmtDate(intel?d.date_published:d.date_issued))}</span></div>
      ${!intel?`<div><b>Fecha publicación</b><span>${esc(fmtDate(d.date_published))}</span></div>`:''}
      <div><b>Tema principal</b><span>${esc(d.main_topic||d.topic||'Sin clasificar')}</span></div>
      <div><b>Ámbito</b><span>${esc(geoText(d))}</span></div>
      ${intel?`<div><b>Impacto empresarial</b><span>${esc(d.business_impact||'Seguimiento estratégico')}</span></div><div><b>Relevancia</b><span>${esc(d.relevance_score||0)}/100</span></div>`:`<div><b>Número / año</b><span>${esc([d.document_number,d.year].filter(Boolean).join(' / ')||'No aplica')}</span></div><div><b>Alcance</b><span>${esc(d.legal_force||'Por verificar')}</span></div>`}
      <div><b>Subtemas</b><span>${esc(d.subtopics||'No identificados')}</span></div>
      <div><b>Palabras clave</b><span>${esc(d.keywords||'No identificadas')}</span></div>
    </div>
    <div class="links">
      ${url?`<a href="${esc(url)}" target="_blank" rel="noopener">${linkLabel(d)}</a>`:''}
      ${d.repository_url?`<a class="secondary" href="${esc(d.repository_url)}" target="_blank" rel="noopener">Abrir repositorio / sección ↗</a>`:''}
    </div>
    <details><summary>Más metadatos</summary><p><b>Estado:</b> ${esc(d.status||'Por verificar')} &nbsp; <b>Fuente:</b> ${esc(d.source_name||'')} &nbsp; <b>Detectado:</b> ${esc(fmtDate((d.first_seen||'').slice(0,10)))}</p></details>
  </article>`;
}

function latestRow(x){
  return `<div class="latestrow"><span class="meta">${esc(fmtDate(x.date_published||x.date_issued))}</span><div><b>${esc(x.title)}</b><div class="meta">${esc(x.main_topic||x.topic||'')} · ${esc(x.authority||'')}${x.sector?` · ${esc(x.sector)}`:''}</div></div>${directUrl(x)?`<a href="${esc(directUrl(x))}" target="_blank">Abrir ↗</a>`:''}</div>`;
}

async function loadDashboard(){
  const d=await window.radarAPI.getDashboard();
  document.getElementById('dashboardStats').innerHTML=`
    <div class="stat"><strong>${d.total}</strong><span>registros consolidados</span></div>
    <div class="stat"><strong>${d.newDocuments}</strong><span>novedades pendientes</span></div>
    <div class="stat"><strong>${d.normative}</strong><span>normativa</span></div>
    <div class="stat"><strong>${d.jurisprudence}</strong><span>jurisprudencia</span></div>
    <div class="stat"><strong>${d.planning}</strong><span>planes y políticas</span></div>
    <div class="stat"><strong>${d.technical}</strong><span>documentos técnicos</span></div>
    <div class="stat business"><strong>${d.intelligence}</strong><span>noticias y alertas</span></div>
    <div class="stat warning"><strong>${d.regulatoryAlerts}</strong><span>alertas regulatorias gremiales</span></div>`;
  renderBars('topicChart',d.byTopic); renderBars('familyChart',d.byFamily);
  document.getElementById('latestList').innerHTML=d.latest.length?d.latest.map(latestRow).join(''):'<p class="muted">Aún no hay documentos.</p>';
  document.getElementById('latestIntelligence').innerHTML=d.latestIntelligence.length?d.latestIntelligence.map(x=>`<div class="latestrow intelrow"><span class="badge ${alertClass(x.alert_level)}">${esc(x.alert_level||'Info')}</span><div><b>${esc(x.title)}</b><div class="meta">${esc(x.main_topic||x.topic||'')} · ${esc(x.sector||x.authority||'')}</div></div>${directUrl(x)?`<a href="${esc(directUrl(x))}" target="_blank">Abrir ↗</a>`:''}</div>`).join(''):'<p class="muted">Aún no hay inteligencia sectorial.</p>';
}
function renderBars(id,rows){const max=Math.max(1,...rows.map(r=>r.value));document.getElementById(id).innerHTML=rows.map(r=>`<div class="barrow"><span>${esc(r.label)}</span><div class="bartrack"><div class="barfill" style="width:${Math.max(4,(r.value/max)*100)}%"></div></div><b>${r.value}</b></div>`).join('')||'<p class="muted">Sin datos.</p>';}

async function loadDatabase(){
  const docs=await window.radarAPI.getDocuments({excludeIntelligence:true});
  document.getElementById('databaseTable').innerHTML=`<div class="tablewrap"><table><thead><tr><th>Fecha documento</th><th>Publicación</th><th>Tipo</th><th>Documento</th><th>Tema principal</th><th>Autoridad</th><th>Geografía</th><th>Acceso</th></tr></thead><tbody>${docs.map(d=>`<tr><td>${esc(fmtDate(d.date_issued))}</td><td>${esc(fmtDate(d.date_published))}</td><td>${esc(d.document_type||'')}</td><td><b>${esc(d.title)}</b><div class="meta">${esc(d.document_number||'')} ${d.year||''}</div></td><td>${esc(d.main_topic||d.topic||'')}</td><td>${esc(d.authority||d.entity||'')}</td><td>${esc(geoText(d))}</td><td>${directUrl(d)?`<a href="${esc(directUrl(d))}" target="_blank">Ver ↗</a>`:'—'}</td></tr>`).join('')}</tbody></table></div>`;
}

async function loadFilters(){
  const f=await window.radarAPI.getFilters();
  fillSelect('topicFilter',f.topics,'Todos los temas'); fillSelect('authorityFilter',f.authorities,'Todas las autoridades/fuentes'); fillSelect('geoFilter',f.geographies,'Todo el territorio'); fillSelect('familyFilter',f.families,'Todos los tipos'); fillSelect('sectorFilter',f.sectors,'Todos los sectores');
  fillSelect('intelTopicFilter',f.topics,'Todos los temas'); fillSelect('intelSectorFilter',f.sectors,'Todos los sectores'); fillSelect('intelAlertFilter',f.alertLevels,'Todos los niveles');
}
function fillSelect(id,values,label){const el=document.getElementById(id);if(!el)return;const current=el.value;el.innerHTML=`<option value="">${label}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(values.includes(current))el.value=current;}
async function runSearch(){
  const filters={search:document.getElementById('search').value,topic:document.getElementById('topicFilter').value,authority:document.getElementById('authorityFilter').value,geography:document.getElementById('geoFilter').value,family:document.getElementById('familyFilter').value,sector:document.getElementById('sectorFilter').value};
  const docs=await window.radarAPI.getDocuments(filters); document.getElementById('searchCount').textContent=`${docs.length} resultado(s) mostrados`;
  document.getElementById('searchResults').innerHTML=docs.length?docs.map(documentCard).join(''):'<div class="panel"><p class="muted">No hay resultados para estos filtros.</p></div>';
}
async function loadIntelligence(){
  const filters={intelligence:true,search:document.getElementById('intelSearch').value,topic:document.getElementById('intelTopicFilter').value,sector:document.getElementById('intelSectorFilter').value,alertLevel:document.getElementById('intelAlertFilter').value};
  const docs=await window.radarAPI.getDocuments(filters);
  document.getElementById('intelligenceCount').textContent=`${docs.length} noticia(s) o alerta(s) mostradas · priorizadas por relevancia empresarial`;
  document.getElementById('intelligenceList').innerHTML=docs.length?docs.map(documentCard).join(''):'<div class="panel"><p class="muted">No hay noticias o alertas para estos filtros.</p></div>';
}

async function loadNews(){const docs=await window.radarAPI.getDocuments({newOnly:true,excludeIntelligence:true});document.getElementById('newsList').innerHTML=docs.length?docs.map(documentCard).join(''):'<div class="panel"><p class="muted">No hay novedades documentales pendientes.</p></div>';}
async function loadJurisprudence(){const docs=await window.radarAPI.getDocuments({jurisprudence:true});document.getElementById('jurisprudenceList').innerHTML=docs.length?docs.map(documentCard).join(''):'<div class="panel"><p class="muted">Todavía no se ha identificado jurisprudencia ambiental.</p></div>';}
async function loadSources(){
  const sources=await window.radarAPI.getSources();
  document.getElementById('sourcesList').innerHTML=sources.map(s=>`<div class="source"><div><div class="cardtop"><span class="badge family">${esc(s.source_category||s.type)}</span>${s.sector?`<span class="badge sector">${esc(s.sector)}</span>`:''}</div><h3>${esc(s.name)}</h3><div class="meta">${esc(s.type)} · ${esc(s.geographic_scope||'')} ${s.department?`· ${esc(s.department)}`:''}</div><div class="coverage">${esc(s.coverage||'Fuente configurada para monitoreo.')}</div><div class="meta">Última revisión: ${esc(s.last_checked?fmtDate(s.last_checked.slice(0,10)):'pendiente')} ${s.last_error?'· acceso con alerta':'· acceso configurado'}</div>${s.last_error?`<div class="error">⚠ ${esc(s.last_error)}</div>`:''}</div>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">Abrir fuente rastreada ↗</a>`:''}</div>`).join('');
}

function setSync(p){
  const status=document.getElementById('syncStatus'),detail=document.getElementById('syncDetail'),bar=document.getElementById('progressBar');
  if(p.status==='started'){status.textContent='Actualizando automáticamente…';detail.textContent='Revisando fuentes oficiales, gremios y portales de sostenibilidad';bar.style.width='1%';}
  if(p.status==='source'){const pct=Math.round((p.current/p.sourcesTotal)*100);status.textContent=`Consultando: ${p.source}`;detail.textContent=`Progreso ${pct}% · nuevos ${p.inserted} · actualizados ${p.updated} · sin cambios ${p.unchanged}`;bar.style.width=`${pct}%`;}
  if(p.status==='finished'){status.textContent='Radar actualizado';detail.textContent=`Nuevos ${p.inserted} · actualizados ${p.updated} · sin cambios ${p.unchanged} · fuentes con alerta ${p.errors}`;bar.style.width='100%';refreshAll();}
}
async function refreshAll(){await loadFilters();await Promise.all([loadDashboard(),loadDatabase(),runSearch(),loadIntelligence(),loadNews(),loadJurisprudence(),loadSources()]);}
window.radarAPI.onSyncProgress(setSync);
document.getElementById('refresh').addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await window.radarAPI.startSync();}finally{e.currentTarget.disabled=false;}});
document.getElementById('searchButton').addEventListener('click',runSearch);
document.getElementById('search').addEventListener('keydown',e=>{if(e.key==='Enter')runSearch();});
['topicFilter','authorityFilter','geoFilter','familyFilter','sectorFilter'].forEach(id=>document.getElementById(id).addEventListener('change',runSearch));
document.getElementById('clearButton').addEventListener('click',()=>{['search','topicFilter','authorityFilter','geoFilter','familyFilter','sectorFilter'].forEach(id=>document.getElementById(id).value='');runSearch();});
document.getElementById('intelSearchButton').addEventListener('click',loadIntelligence);
document.getElementById('intelSearch').addEventListener('keydown',e=>{if(e.key==='Enter')loadIntelligence();});
['intelTopicFilter','intelSectorFilter','intelAlertFilter'].forEach(id=>document.getElementById(id).addEventListener('change',loadIntelligence));
document.getElementById('intelClearButton').addEventListener('click',()=>{['intelSearch','intelTopicFilter','intelSectorFilter','intelAlertFilter'].forEach(id=>document.getElementById(id).value='');loadIntelligence();});
document.getElementById('markSeen').addEventListener('click',async()=>{await window.radarAPI.markSeen('documents');await Promise.all([loadNews(),loadDashboard()]);});
document.getElementById('markIntelligenceSeen').addEventListener('click',async()=>{await window.radarAPI.markSeen('intelligence');await Promise.all([loadIntelligence(),loadDashboard()]);});
loadFilters().then(refreshAll);
