const cheerio = require('cheerio');
const crypto = require('crypto');

const NORM_RE = /\b(ley|decreto|resoluci[oó]n|acuerdo|ordenanza|circular|auto|sentencia|concepto|conpes|jurisprudencia|normograma|normativa|proyecto de (?:ley|decreto|resoluci[oó]n))\b/i;
const PLAN_RE = /\b(plan(?:es)?|pol[ií]tica|estrategia|programa|pnd|pgar|pomca|porh|psmv|pueaa|pgirs|pot|pbot|eot|plan ambiental|plan de desarrollo|plan de acci[oó]n|plan clim[aá]tico|plan integral|determinante ambiental)\b/i;
const TECH_RE = /\b(protocolo|gu[ií]a|manual|lineamiento|metodolog[ií]a|norma t[eé]cnica|est[aá]ndar|especificaci[oó]n|instructivo|documento t[eé]cnico|referente ambiental)\b/i;
const NEWS_RE = /\b(noticia|comunicado|informe|bolet[ií]n|estudio|actualidad|alerta|monitoreo|notijur[ií]dico|an[aá]lisis|balance|reporte|publicaci[oó]n|opini[oó]n|tendencia|hoja de ruta|premio|reconocimiento)\b/i;
const ENV_RE = /\b(ambient|agua|h[ií]dric|aire|residu|vertim|biodivers|bosque|forest|licencia|emisi[oó]n|cambio clim|suelo|mineri|hidrocarb|recurso natural|fauna|flora|ecosistem|p[aá]ramo|humedal|sancionatorio|econom[ií]a circular|contamin|ruido|qu[ií]mic|pl[aá]stic|carbono|energ[ií]a|territori|sostenib|riesgo|cuenca|ordenamiento|deforest|conservaci[oó]n|restauraci[oó]n|transici[oó]n energ[eé]tica|fen[oó]meno de el ni[nñ]o|fen[oó]meno del ni[nñ]o)\b/i;
const ESG_RE = /\b(esg|asg|sostenibilidad empresarial|desarrollo sostenible|net zero|cero emisiones|naturaleza positiva|doble materialidad|materialidad|niif s1|niif s2|issb|gri|taxonom[ií]a verde|finanzas sostenibles|bonos verdes|derechos humanos y empresa|debida diligencia|gobernanza|diversidad|inclusi[oó]n|desigualdad|impacto social|comunidad|conducta empresarial responsable|inversi[oó]n de impacto|cadena de suministro|proveedores sostenibles|reporte de sostenibilidad|informe de sostenibilidad|responsabilidad extendida del productor|\brep\b|posconsumo|ecodise[nñ]o|movilidad sostenible|seguridad energ[eé]tica|eficiencia energ[eé]tica|econom[ií]a circular)\b/i;
const ORG_RE = /\b(empresa|empresarial|industria|sector|gremio|regulaci[oó]n|normativ|ministerio|gobierno|autoridad|resoluci[oó]n|decreto|ley|licencia|tr[aá]mite|mercado|inversi[oó]n|competitividad|tarifa|abastecimiento|seguridad energ[eé]tica|infraestructura|riesgo clim[aá]tico|continuidad operativa|cumplimiento|obligaci[oó]n|proyecto|producci[oó]n|cadena de valor|financiamiento|financiaci[oó]n|impuesto|costos?|exportaci[oó]n|importaci[oó]n)\b/i;
const GENERIC_LINK = /^(ver|ver m[aá]s|leer m[aá]s|descargar|archivo|pdf|documento|aqu[ií]|clic aqu[ií]|consulta|abrir|enlace|inicio|home|noticias|actualidad)$/i;

function sha(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex'); }
function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function normalizeText(s) { return clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function canonicalUrl(raw) {
  try {
    const u = new URL(raw); u.hash = '';
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(k => u.searchParams.delete(k));
    if (u.pathname !== '/') u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch { return raw || ''; }
}

function classifyType(text, source={}) {
  const t = normalizeText(text);
  if (source.regulatory_monitoring && NORM_RE.test(text)) return 'Alerta regulatoria';
  if (source.accept_news) {
    if (/informe de sostenibilidad|reporte de sostenibilidad/.test(t)) return 'Informe de sostenibilidad';
    if (/comunicado/.test(t)) return 'Comunicado gremial';
    if (/alerta/.test(t)) return 'Alerta sectorial';
    if (/estudio|informe|balance|reporte|panorama|hoja de ruta/.test(t)) return 'Estudio / informe sectorial';
    if (source.accept_technical && /guia|manual|protocolo|lineamiento|metodologia|norma tecnica|estandar/.test(t)) return 'Documento técnico sectorial';
    return 'Noticia sectorial';
  }
  const tests = [
    [/sentencia/, 'Sentencia'], [/ordenanza/, 'Ordenanza'], [/\bley\b/, 'Ley'], [/decreto/, 'Decreto'], [/resolucion/, 'Resolución'], [/acuerdo/, 'Acuerdo'], [/circular/, 'Circular'], [/\bauto\b/, 'Auto'], [/concepto/, 'Concepto'], [/conpes/, 'CONPES'],
    [/plan nacional de desarrollo|\bpnd\b/, 'Plan Nacional de Desarrollo'], [/plan de desarrollo/, 'Plan de Desarrollo'], [/\bpgar\b|plan de gestion ambiental regional/, 'PGAR'], [/\bpomca\b|plan de ordenacion y manejo de.*cuenca/, 'POMCA'], [/\bporh\b/, 'PORH'], [/\bpsmv\b/, 'PSMV'], [/\bpueaa\b/, 'PUEAA'], [/\bpgirs\b/, 'PGIRS'], [/\bpbot\b/, 'PBOT'], [/\beot\b/, 'EOT'], [/\bpot\b|plan de ordenamiento territorial/, 'POT'], [/plan de accion clim/, 'Plan de Acción Climática'], [/plan estrateg/, 'Plan Estratégico'], [/plan de accion/, 'Plan de Acción'], [/plan ambiental/, 'Plan Ambiental'], [/\bpolitica\b/, 'Política pública'], [/estrategia/, 'Estrategia'],
    [/protocolo/, 'Protocolo técnico'], [/guia/, 'Guía técnica'], [/manual/, 'Manual técnico'], [/lineamiento/, 'Lineamiento técnico'], [/metodologia/, 'Metodología'], [/norma tecnica|estandar/, 'Norma técnica']
  ];
  for (const [re, value] of tests) if (re.test(t)) return value;
  return 'Documento ambiental';
}

function familyFor(type) {
  if (['Alerta regulatoria','Alerta sectorial','Comunicado gremial','Estudio / informe sectorial','Informe de sostenibilidad','Noticia sectorial'].includes(type)) return 'Noticias y alertas';
  if (type === 'Documento técnico sectorial') return 'Técnico';
  if (['Sentencia','Auto'].includes(type)) return 'Jurisprudencia';
  if (['Ley','Decreto','Resolución','Acuerdo','Ordenanza','Circular','Concepto','CONPES'].includes(type)) return type === 'CONPES' ? 'Política pública' : 'Normativa';
  if (/Política|Estrategia/.test(type)) return 'Política pública';
  if (/Plan|PGAR|POMCA|PORH|PSMV|PUEAA|PGIRS|POT|PBOT|EOT/.test(type)) return 'Plan / instrumento';
  if (/técnic|Metodología|Protocolo|Guía|Manual|Lineamiento|Norma técnica/.test(type)) return 'Técnico';
  return 'Documento ambiental';
}

function extractNumberYear(text) {
  const t = clean(text);
  const p = /(?:Ley|Decreto|Resoluci[oó]n|Acuerdo|Ordenanza|Circular|Auto|Sentencia|CONPES)\s*(?:No\.?|N[°ºo]\.?|n[uú]mero)?\s*[-:]?\s*([A-Z-]*\s*\d{1,6}(?:[-/]\d{1,4})?)\s*(?:de|del|\/|-)\s*((?:19|20)\d{2})/i;
  const m = t.match(p); if (m) return { number: clean(m[1]).replace(/\s/g,''), year:Number(m[2]) };
  const m2 = t.match(/(?:Ley|Decreto|Resoluci[oó]n|Acuerdo|Ordenanza|Circular|Auto|Sentencia|CONPES)\s*(?:No\.?|N[°ºo]\.?|n[uú]mero)?\s*[-:]?\s*([A-Z-]*\s*\d{1,6})/i);
  const y = t.match(/\b((?:19|20)\d{2})\b/);
  return { number:m2?clean(m2[1]).replace(/\s/g,''):null, year:y?Number(y[1]):null };
}

const MONTHS = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
function isoDate(y,m,d){ return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function parseDate(text) {
  const s = clean(text);
  let m = s.match(/\b((?:19|20)\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)\b/); if(m) return isoDate(m[1],m[2],m[3]);
  m = s.match(/\b([0-3]?\d)[-\/]([01]?\d)[-\/]((?:19|20)\d{2})\b/); if(m) return isoDate(m[3],m[2],m[1]);
  m = s.match(/\b([0-3]?\d)\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre),?\s+(?:de\s+)?((?:19|20)\d{2})\b/i);
  if(m) return isoDate(m[3], MONTHS[normalizeText(m[2])], m[1]);
  m = s.match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+([0-3]?\d),?\s+((?:19|20)\d{2})\b/i);
  if(m) return isoDate(m[3], MONTHS[normalizeText(m[1])], m[2]);
  return null;
}
function publicationDate(text) {
  const m = clean(text).match(/(?:publicad[oa]|fecha de publicaci[oó]n|actualizado|modificado)\s*:?\s*([^|•]{5,45})/i);
  return parseDate(m ? m[1] : text);
}

function topicFor(text) {
  const t = normalizeText(text);
  const map = [
    ['Agua y gestión hídrica', /agua|vertim|cuenca|hidric|acuifer|pomca|porh|psmv|pueaa|saneamiento/],
    ['Residuos y economía circular', /residu|economia circular|plastico|posconsumo|responsabilidad extendida|\brep\b|pgirs|ecodiseno/],
    ['Aire, ruido y emisiones', /aire|emision|atmosfer|calidad del aire|ruido/],
    ['Biodiversidad y naturaleza', /biodivers|fauna|flora|bosque|forest|paramo|humedal|area protegida|deforest|naturaleza positiva|restauracion|conservacion/],
    ['Licenciamiento y evaluación ambiental', /licencia|estudio de impacto|evaluacion ambiental|anla/],
    ['Cambio climático, carbono y energía', /cambio clim|carbono|energia|geoterm|renovable|gei|variabilidad clim|net zero|hidrogeno|biogas|biometano|seguridad energetica/],
    ['Sancionatorio ambiental', /sancion|medida preventiva|infraccion/],
    ['Ordenamiento territorial y determinantes', /ordenamiento|territori|zonificacion|determinante ambiental|\bpot\b|\bpbot\b|\beot\b/],
    ['Planeación y política ambiental', /politica|plan ambiental|plan de desarrollo|plan estrateg|\bpgar\b/],
    ['Gestión del riesgo y resiliencia', /gestion del riesgo|desastre|amenaza|vulnerab|resilien|fenomeno de el nino|fenomeno del nino/],
    ['ESG, reporte y sostenibilidad empresarial', /\besg\b|\basg\b|materialidad|niif s1|niif s2|issb|gri|reporte de sostenibilidad|derechos humanos y empresa|gobernanza|finanzas sostenibles|taxonomia verde/],
    ['Información, monitoreo y técnica ambiental', /protocolo|metodologia|monitoreo|lineamiento|guia tecnica|norma tecnica|estadistica ambiental/]
  ];
  for (const [topic,re] of map) if (re.test(t)) return topic;
  return 'General ambiental y sostenibilidad';
}
function subtopicsFor(text, main) {
  const t = normalizeText(text); const out=[];
  const tags=[['Cambio climático',/cambio clim|gei|carbono|net zero/],['Recurso hídrico',/agua|hidric|cuenca|vertim/],['Biodiversidad',/biodivers|fauna|flora|ecosistem|naturaleza positiva/],['Residuos',/residu|pgirs|economia circular|posconsumo/],['Ordenamiento',/ordenamiento|\bpot\b|pbot|eot|determinante/],['Calidad del aire',/aire|emision|ruido/],['Gestión del riesgo',/riesgo|desastre|amenaza|resilien/],['Bosques',/bosque|forest|deforest/],['Licenciamiento',/licencia|anla/],['Planeación',/plan|politica|estrategia|pgar/],['ESG/ASG',/\besg\b|\basg\b|materialidad|gri|niif s/],['Energía',/energia|renovable|hidrogeno|gas natural|biogas/]];
  for(const [label,re] of tags) if(re.test(t) && label!==main) out.push(label);
  return out.slice(0,6).join(', ');
}
function keywordsFor(text) {
  const t=normalizeText(text); const terms=['agua','vertimientos','residuos','economía circular','posconsumo','aire','emisiones','ruido','biodiversidad','bosques','deforestación','cambio climático','carbono','net zero','energía','transición energética','licenciamiento','ordenamiento territorial','POT','POMCA','PGAR','PGIRS','gestión del riesgo','sostenibilidad','ESG','ASG','doble materialidad','NIIF S1','NIIF S2','GRI','finanzas sostenibles'];
  return terms.filter(k=>t.includes(normalizeText(k))).slice(0,10).join(', ');
}

function businessImpactFor(text) {
  const t=normalizeText(text); const out=[];
  const impacts=[
    ['Cumplimiento normativo',/normativ|regulaci|resolucion|decreto|ley|licencia|obligacion|cumplimiento|proyecto de resolucion|proyecto de decreto/],
    ['Operación ambiental',/agua|vertim|residu|emision|aire|ruido|licencia|monitoreo|recurso natural/],
    ['Costos y eficiencia',/tarifa|precio|costo|eficiencia|ahorro|consumo|impuesto|tasa|inversion/],
    ['Riesgo climático y continuidad',/cambio clim|fenomeno de el nino|fenomeno del nino|riesgo clim|desastre|resilien|abastecimiento/],
    ['Estrategia y competitividad',/competitividad|mercado|innovacion|transicion|hidrogeno|renovable|oportunidad|inversion|productividad/],
    ['Reputación y ESG',/sostenib|\besg\b|\basg\b|derechos humanos|gobernanza|biodivers|naturaleza positiva|transparencia/],
    ['Cadena de suministro',/cadena de suministro|cadena de valor|proveedor|materia prima|abastecimiento/]
  ];
  for(const [label,re] of impacts) if(re.test(t)) out.push(label);
  return (out.length?out:['Seguimiento estratégico']).slice(0,4).join(', ');
}
function relevanceScore(text, source, type) {
  const t=normalizeText(text); let score=30;
  if(source.regulatory_monitoring || type==='Alerta regulatoria') score+=35;
  if(source.specialist_sustainability || source.specialist_environment) score+=15;
  if(ENV_RE.test(text)) score+=12;
  if(ESG_RE.test(text)) score+=12;
  if(ORG_RE.test(text)) score+=8;
  if(/colombia|nacional|ministerio|gobierno|autoridad/.test(t)) score+=5;
  return Math.max(1,Math.min(100,score));
}
function relevanceReasonFor(topic, impacts, type) {
  if(type==='Alerta regulatoria') return `Alerta con posible efecto en cumplimiento. Tema: ${topic}. Impacto potencial: ${impacts}.`;
  return `Contenido relevante para gestión ambiental y sostenibilidad empresarial. Tema: ${topic}. Impacto potencial: ${impacts}.`;
}
function alertLevel(score,type){ if(type==='Alerta regulatoria'||score>=82)return 'Alta'; if(score>=62)return 'Media'; return 'Informativa'; }

function identityKey(doc, source) {
  const type=normalizeText(doc.document_type), num=normalizeText(doc.document_number), year=doc.year||'';
  if(num && year && doc.document_family!=='Noticias y alertas') {
    if(['ley','decreto','conpes'].includes(type)) return `national:${type}:${num}:${year}`;
    return `${normalizeText(doc.authority||source.authority||source.name).replace(/\s+/g,'-').slice(0,90)}:${type}:${num}:${year}`;
  }
  const normalizedTitle=normalizeText(doc.title).replace(/\b(descargar|ver en linea|pdf|leer mas|ver mas)\b/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  if(doc.document_family==='Noticias y alertas') return `news:${sha([normalizedTitle,doc.date_published||doc.date_issued||''].join('|'))}`;
  return `text:${sha([normalizedTitle,doc.date_issued||doc.date_published||'',normalizeText(doc.authority||source.authority||source.name)].join('|'))}`;
}

async function fetchHtml(url, timeoutMs=22000) {
  const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try {
    const r=await fetch(url,{signal:ctrl.signal,redirect:'follow',headers:{'User-Agent':'RadarAmbientalColombia/0.4 (+environmental-sustainability-intelligence-monitor)','Accept':'text/html,application/xhtml+xml'}});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const type=r.headers.get('content-type')||''; if(!type.includes('html')) throw new Error(`Contenido no HTML: ${type}`);
    return await r.text();
  } finally { clearTimeout(timer); }
}
function bestTitle(a, container) {
  let title=clean(a.text()) || clean(a.attr('title')) || clean(a.attr('aria-label'));
  if(!title || GENERIC_LINK.test(title) || title.length<5) {
    const h=container.find('h1,h2,h3,h4,h5,strong,.title,.entry-title,.post-title,.field--name-title').first();
    if(h.length) title=clean(h.text());
  }
  if(!title || GENERIC_LINK.test(title)) {
    const text=clean(container.text()); title=text.slice(0,240);
  }
  return clean(title).slice(0,500);
}
function articleLike(text,url,source){
  if(/\.pdf(?:$|\?)/i.test(url)) return true;
  if(NEWS_RE.test(text) || parseDate(text)) return true;
  if(source.specialist_sustainability && (ESG_RE.test(text)||ENV_RE.test(text))) return true;
  if(source.specialist_environment && (ENV_RE.test(text)&&ORG_RE.test(text))) return true;
  return false;
}
function shouldAccept(text, url, source) {
  const isPdf=/\.pdf(?:$|\?)/i.test(url);
  const norm=NORM_RE.test(text), plan=PLAN_RE.test(text), tech=TECH_RE.test(text), env=ENV_RE.test(text), esg=ESG_RE.test(text), org=ORG_RE.test(text), news=NEWS_RE.test(text);
  if(source.regulatory_monitoring) return env && norm && articleLike(text,url,source);
  if(source.accept_news) {
    if(source.require_environment && !env && !esg) return false;
    if(source.require_business_environment && !(env||esg) ) return false;
    if(source.specialist_environment && !(env && org)) return false;
    if(source.specialist_sustainability && !(env||esg)) return false;
    return articleLike(text,url,source) && (news || env || esg || org || isPdf);
  }
  if(source.require_environment && !env) return false;
  if(source.type==='Jurisprudencia') return norm && env;
  if(norm && (env || /ambient/i.test(source.coverage||'') || /normativ/i.test(source.type||''))) return true;
  if(source.accept_planning && plan && (env || /ambient|territor|plan|polit/i.test(`${source.coverage||''} ${source.type||''}`))) return true;
  if(source.accept_technical && tech && (env || /ambient|territor|t[eé]cn/i.test(`${source.coverage||''} ${source.type||''}`))) return true;
  return isPdf && (env || (source.accept_planning && plan) || (source.accept_technical && tech));
}
function extractCandidates(html,pageUrl,source){
  const $=cheerio.load(html); const out=new Map();
  $('a[href]').each((_,el)=>{
    const a=$(el); if(a.closest('nav,header,footer,.menu,.navbar,.breadcrumb').length) return;
    const href=a.attr('href'); if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('javascript:')) return;
    let url; try{url=canonicalUrl(new URL(href,pageUrl).toString());}catch{return;}
    if(url===canonicalUrl(pageUrl) || url===canonicalUrl(source.url)) return;
    const container=a.closest('article,li,tr,.item,.post,.entry,.views-row,.card,.documento,.field__item,.news-item,.blog-post,.elementor-post,.jeg_post');
    const context=clean([a.text(),a.attr('title'),a.attr('aria-label'),container.text()].filter(Boolean).join(' ')).slice(0,6000);
    if(context.length<8 || !shouldAccept(context,url,source)) return;
    const title=bestTitle(a,container.length?container:a.parent()); if(title.length<8 || GENERIC_LINK.test(title)) return;
    const nt=extractNumberYear(`${title} ${context}`), type=classifyType(`${title} ${context}`,source), family=familyFor(type), mainTopic=topicFor(`${title} ${context}`);
    const datePub=publicationDate(context); const dateIssued=family==='Noticias y alertas'?null:(parseDate(title) || (['Normativa','Jurisprudencia'].includes(family)?parseDate(context):null));
    const impacts=businessImpactFor(`${title} ${context}`), score=relevanceScore(`${title} ${context}`,source,type);
    const doc={
      title, document_type:type, document_family:family, document_number:family==='Noticias y alertas'?null:nt.number, year:nt.year || (dateIssued?Number(dateIssued.slice(0,4)):(datePub?Number(datePub.slice(0,4)):null)),
      date_issued:dateIssued, date_published:datePub, authority:source.authority||source.name, entity:source.authority||source.name,
      jurisdiction:source.geographic_scope||'Colombia', geographic_scope:source.geographic_scope||'Colombia', department:source.department||null, municipality:source.municipality||null,
      status:family==='Noticias y alertas'?'Publicado / fuente secundaria':'Por verificar',
      legal_force: family==='Normativa'?'Vinculante / verificar vigencia':family==='Jurisprudencia'?'Interpretación judicial / verificar alcance':family==='Técnico'?'Técnico / orientador':family==='Noticias y alertas'?'Informativo / verificar fuente primaria cuando cite regulación':'Instrumento de política o planeación',
      topic:mainTopic, main_topic:mainTopic, subtopics:subtopicsFor(`${title} ${context}`,mainTopic), keywords:keywordsFor(`${title} ${context}`),
      importance:type==='Alerta regulatoria'||['Ley','Decreto','Sentencia','CONPES','Plan Nacional de Desarrollo','PGAR','POMCA','Política pública'].includes(type)?'alta':score>=75?'alta':'media',
      about_text:context.slice(0,1100), summary:context.slice(0,1600), source_name:source.name, source_url:url, pdf_url:/\.pdf(?:$|\?)/i.test(url)?url:null,
      repository_url:source.url, source_category:source.source_category||'Fuente institucional', sector:source.sector||null,
      content_kind:family==='Noticias y alertas'?'Inteligencia empresarial':'Documento', news_category:family==='Noticias y alertas'?type:null,
      business_impact:impacts, relevance_score:score, relevance_reason:relevanceReasonFor(mainTopic,impacts,type), alert_level:alertLevel(score,type)
    };
    doc.identity_key=identityKey(doc,source);
    doc.content_hash=sha([normalizeText(doc.title),normalizeText(doc.summary),doc.date_issued||'',doc.date_published||'',normalizeText(doc.authority||'')].join('|'));
    out.set(`${doc.identity_key}|${canonicalUrl(url)}`,doc);
  });
  return [...out.values()];
}
async function collectSource(source){
  const urls=[...new Set([...(source.crawl_urls||[]),source.url].filter(Boolean))].slice(0,source.max_pages||1),docs=[],errors=[];
  for(const url of urls){try{docs.push(...extractCandidates(await fetchHtml(url),url,source));}catch(e){errors.push(`${url}: ${e.message}`);}}
  const unique=new Map(); docs.forEach(d=>unique.set(`${d.identity_key}|${canonicalUrl(d.source_url)}`,d));
  return {documents:[...unique.values()],errors};
}
module.exports={collectSource,canonicalUrl,sha,extractCandidates,topicFor,businessImpactFor};
