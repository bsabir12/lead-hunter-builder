/** Cold prospecting and professional-contact enrichment. No sending functions. */
const PROSPECT_EVIDENCE_COLS=['lead_id','facts','facts_url','hypothesis','timing_signal','timing_date','timing_url','researched_on'];
const LEGACY_CONTACT_COLS=['lead_id','contact_id','company','domain','name','role','linkedin','identity_status','email','email_status','verified_on','source_urls','checked_on','note','do_not_contact','verified_email','published_email'];
const CONTACT_COLS=LEGACY_CONTACT_COLS.concat(['provider','provider_person_id','phone','phone_type','phone_status','phone_checked_on','pending_request_id']);
const HUNTER_ROLES=contactRolePolicy_().titles;
const CONTACT_BUDGET_KEY='LH_CONTACT_CREDIT_BUDGET';
function prospectConfig_() {
  return BUSINESS_CONFIG.prospecting || {approach:'demand',suitability:'Demand discovery',limitations:[],cold_min_fit:65,
    cold_priority:{fit_weight:.7,contact_weight:.2,timing_weight:.1,half_life_days:30},
    contacts:{provider:'none',monthly_credits:0,max_rows_per_run:5,cache_days:30,verification_days:30}};
}
function isCold_(row) { return row.source==='cold_prospect'; }
function directoryInputValid_(input) {
  const allowed=['searchStringsArray','locationQuery','maxCrawledPlacesPerSearch','language','scrapePlaceDetailPage','scrapeContacts','maximumLeadsEnrichmentRecords','verifyLeadsEnrichmentEmails','maxReviews','maxImages','enableCompetitorAnalysis'];
  return input&&Object.keys(input).every(k=>allowed.includes(k))&&Array.isArray(input.searchStringsArray)&&input.searchStringsArray.length===1&&typeof input.searchStringsArray[0]==='string'&&!!input.searchStringsArray[0].trim()&&typeof input.locationQuery==='string'&&!!input.locationQuery.trim()&&Number.isInteger(input.maxCrawledPlacesPerSearch)&&input.maxCrawledPlacesPerSearch>=1&&input.maxCrawledPlacesPerSearch<=50&&['scrapePlaceDetailPage','scrapeContacts','verifyLeadsEnrichmentEmails','enableCompetitorAnalysis'].every(k=>input[k]===false)&&['maximumLeadsEnrichmentRecords','maxReviews','maxImages'].every(k=>input[k]===0);
}
function directoryLeads_(items) {
  return items.filter(i=>!i.permanentlyClosed&&!i.temporarilyClosed).map(i=>{
    if(!i.placeId||!i.title||!safePublicUrl_(i.url)||!i.categoryName)throw new Error('Directory result lacks its place identity or business evidence.');
    const facts=[i.title,i.categoryName,i.address||i.city||'',i.countryCode||''].filter(Boolean).join(' · '),id='cold:maps:'+i.placeId;
    const domain=professionalDomain_(i.website);
    return {id,company:i.title,source:'cold_prospect',website:domain?'https://'+domain:'',link:safePublicUrl_(i.url),industry:i.categoryName,country:i.countryCode||'',
      what_they_want:'Need unconfirmed — cold prospect',readiness_pct:'Unknown',posted:'',contact:'',email:'',phone:publicPhoneNumber_(i.phone)?'Public: '+publicPhoneNumber_(i.phone):'',people:'',
      notes:'Observed listing facts: '+facts+'\nHypothesis (unconfirmed): potential customer profile fit only',_text:'Cold company listing, not a buying request. '+facts,
      _evidence:[id,facts,safePublicUrl_(i.url),'Potential customer profile fit; need unconfirmed','','','',new Date()]};
  });
}
function contactSheets_() {
  const prior=SpreadsheetApp.getActive().getSheetByName('Contacts');if(prior&&prior.getLastRow())migrateContactSchema_(prior);
  const contacts=sheet_('Contacts',CONTACT_COLS), evidence=sheet_('Prospect evidence',PROSPECT_EVIDENCE_COLS);
  contactRows_(contacts);
  if(PROSPECT_EVIDENCE_COLS.some((c,i)=>evidence.getDataRange().getValues()[0]?.[i]!==c))throw new Error('Prospect evidence schema differs; stop before writing.');
  [contacts,evidence].forEach(plainHeader_);
  contacts.getRange(2,8,Math.max(1,contacts.getMaxRows()-1),1).setDataValidation(list_(['unconfirmed','confirmed','rejected']));
  contacts.getRange(2,15,Math.max(1,contacts.getMaxRows()-1),1).setDataValidation(list_(['','yes']));
  contacts.getRange(1,8).setNote('Confirm only after checking the named person currently works at this company in the relevant role. Provider data alone is unconfirmed.');
  contacts.getRange(1,10).setNote('Provider mailbox result, separate from identity and buying intent. valid is not a delivery guarantee.');
  return {contacts,evidence};
}
function setHunterKey() { askSecret_('HUNTER_KEY','Hunter API key','Enter your own key from hunter.io/api. Never put it in sheet cells or chat.'); }
function contactDate_(value) { const d=new Date(value);return value&&!isNaN(d)?d:null; }
function recentContactDate_(value,days,now) { const d=contactDate_(value),n=now||new Date();return !!d&&d<=n&&n-d<=days*864e5; }
function professionalDomain_(value) {
  const s=String(value||'').trim().toLowerCase();
  const m=s.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,})(?:\/[^\s]*)?$/);
  if(!m||/^(localhost|.*\.local)$/.test(m[1])||/^(gmail\.com|yahoo\.[a-z.]+|hotmail\.com|outlook\.com|icloud\.com|proton\.(me|com)|linkedin\.com|facebook\.com)$/.test(m[1]))return '';
  return m[1];
}
function safePublicUrl_(value) {
  const s=String(value||'').trim();
  return /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:[/?#][^\s]*)?$/i.test(s)&&!/[?&](api[_-]?key|token|access_token|signature)=/i.test(s)?peopleUrl_(s):'';
}
function canonicalLinkedIn_(value) {
  const m=String(value||'').match(/^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([a-z0-9_%.-]+)\/?(?:[?#].*)?$/i);
  return m?'https://www.linkedin.com/in/'+m[1]:'';
}
function contactName_(name) { return String(name||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim(); }
function contactFullName_(name){
  const text=String(name||'').normalize('NFKC').trim();
  return !/[0-9*_<>{}]/.test(text)&&!/(?:obfuscat|unknown|anonymous|not disclosed)/i.test(text)&&text.split(/\s+/).length>=2&&text.split(/\s+/).every(w=>/^[\p{L}][\p{L}'’.-]*[\p{L}]$/u.test(w));
}
function contactRoleText_(role){
  return contactName_(role).replace(/\bcofounder\b/g,'co founder').replace(/\bcmo\b/g,'chief marketing officer').replace(/\bceo\b/g,'chief executive officer').replace(/\bcfo\b/g,'chief financial officer').replace(/\bcoo\b/g,'chief operating officer').replace(/\bcto\b/g,'chief technology officer').replace(/\bciso\b/g,'chief information security officer').replace(/\bhr\b/g,'human resources').replace(/\bvp\b/g,'vice president');
}
/** Only configured targets and their explicit aliases; order expresses owner priority. */
function contactRolePolicy_(){
  const aliases=BUSINESS_CONFIG.decision_role_aliases||{},titles=[];
  BUSINESS_CONFIG.decision_roles.forEach(role=>{
    [role,contactRoleText_(role),...(aliases[role]||[])].forEach(v=>{if(v&&!titles.some(t=>String(t).toLowerCase()===String(v).toLowerCase()))titles.push(v);});
    const normalized=contactRoleText_(role),direction=normalized.match(/^(.+) (director|head|manager)$/);if(direction)titles.push(direction[2]+' of '+direction[1]);
    if(/^vice president /.test(normalized))titles.push(normalized.replace(/^vice president /,'VP '));
    const acronym={'chief marketing officer':'CMO','chief executive officer':'CEO','chief financial officer':'CFO','chief operating officer':'COO','chief technology officer':'CTO','chief information security officer':'CISO'}[contactRoleText_(role)];
    if(acronym&&!titles.includes(acronym))titles.push(acronym);
  });return {titles};
}
function contactRoleRank_(role){
  const text=contactRoleText_(role);
  if(/\b(former|previous|previously|ex|retired|departed)\b/.test(text))return -1;
  return BUSINESS_CONFIG.decision_roles.findIndex(target=>[target,...((BUSINESS_CONFIG.decision_role_aliases||{})[target]||[])].some(alias=>{
    const want=contactRoleText_(alias),words=want.split(' ').filter(w=>!['of','the','and'].includes(w));
    if(!words.length||!words.every(w=>(' '+text+' ').includes(' '+w+' ')))return false;
    return !/\b(assistant|intern|coordinator|junior|trainee|student)\b/.test(text)||/\b(assistant|intern|coordinator|junior|trainee|student)\b/.test(want);
  }));
}
function contactRoleMatches_(role){return contactRoleRank_(role)>=0;}
function contactIdentityKey_(contact){return 'LH_CONTACT_IDENTITY_'+discoveryHash_(String(contact.contact_id||''));}
function contactIdentitySignature_(c,lead){
  return discoveryHash_(JSON.stringify([String(c.contact_id||''),String(c.lead_id||''),contactName_(c.company),professionalDomain_(c.domain),contactName_(c.name),contactRoleText_(c.role),canonicalLinkedIn_(c.linkedin),String(c.provider_person_id||''),websiteIdentitySignature_(lead),BUSINESS_CONFIG.goal,BUSINESS_CONFIG.decision_roles,BUSINESS_CONFIG.decision_role_aliases||{}]));
}
function contactIdentityLead_(c){const sh=SpreadsheetApp.getActive().getSheetByName(TABS.leads);return sh?cellFillRow_(leadData_(sh),c.lead_id):null;}
function contactRoleKind_(role){
  if(!contactRoleMatches_(role))return 'ineligible';
  if(BUSINESS_CONFIG.goal==='jobs')return 'application_route';
  return /\b(founder|owner|chief executive|president)\b/.test(contactRoleText_(role))?'founder_fallback':'function_owner';
}
function contactEvidenceValid_(c,lead,evidence,now){
  const time=now||new Date(),url=safePublicUrl_(evidence?.url),quote=String(evidence?.quote||'').trim();
  if(!evidence||Object.keys(evidence).some(k=>!['url','quote','observedOn','basis','current','relevant'].includes(k))||evidence.current!==true||evidence.relevant!==true||!recentContactDate_(evidence.observedOn,30,time))return false;
  if(!lead||String(lead.id)!==String(c.lead_id)||professionalDomain_(lead.website)!==professionalDomain_(c.domain)||contactName_(lead.company)!==contactName_(c.company)||!contactFullName_(c.name)||!contactRoleMatches_(c.role)||!url||quote.length<25||quote.length>1800)return false;
  if(canonicalLinkedIn_(url)&&canonicalLinkedIn_(url)!==canonicalLinkedIn_(c.linkedin))return false;
  const normalized=' '+contactName_(quote)+' ',name=' '+contactName_(c.name)+' ',company=' '+contactName_(lead.company)+' ';
  if(!normalized.includes(name)||!normalized.includes(company)||/\b(former|formerly|previous|previously|departed|retired|ex employee|used to work|stepped down)\b/.test(normalized))return false;
  const words=contactRoleText_(c.role).split(' ').filter(w=>!['of','the','and'].includes(w)),role=' '+contactRoleText_(quote)+' ';
  if(!words.every(w=>role.includes(' '+w+' ')))return false;
  const kind=contactRoleKind_(c.role);
  if(evidence.basis==='request_owner')return /\b(hiring|requesting|contact|reach out|responsible|oversee|budget)\b/i.test(quote);
  if(evidence.basis==='application_route')return kind==='application_route';
  if(evidence.basis==='function_owner')return kind==='function_owner';
  return evidence.basis==='founder_fallback'&&kind==='founder_fallback'&&(Number(lead.employees)>0&&Number(lead.employees)<=50||/\b(responsible|oversee|budget|hiring|requesting)\b/i.test(quote));
}
function archiveContactIdentityReview_(key,raw,props){
  if(!raw)return;const history=key+'_H_'+discoveryHash_(raw).slice(0,24),old=props.getProperty(history);
  if(old!==null&&old!==raw)throw Error('Identity evidence history conflict; no review changed.');
  if(old===null)props.setProperty(history,raw);if(props.getProperty(history)!==raw)throw Error('Identity evidence history readback failed.');
}
function saveContactIdentityReview_(c,lead,evidence,store,now){
  const checked=(now||new Date()).toISOString();
  if(!contactEvidenceValid_(c,lead,evidence,now))throw Error('Current full name, configured role, company and supporting URL/quote/observation are required; no identity confirmed.');
  const props=store||PropertiesService.getScriptProperties(),key=contactIdentityKey_(c),old=props.getProperty(key),receipt={version:1,state:'reviewed',signature:contactIdentitySignature_(c,lead),checked,evidence:{...evidence},priorHash:old?discoveryHash_(old):null},value=JSON.stringify(receipt);
  if(encodeURIComponent(value).replace(/%[0-9A-F]{2}/g,'x').length>7500)throw Error('Identity evidence exceeds storage bound.');
  archiveContactIdentityReview_(key,old,props);props.setProperty(key,value);if(props.getProperty(key)!==value)throw Error('Identity evidence receipt could not be confirmed; review again.');return receipt;
}
function contactIdentityConfirmed_(c,lead,store,now){
  if(c.identity_status!=='confirmed'||!c.contact_id||!contactFullName_(c.name)||!contactRoleMatches_(c.role))return false;
  lead=lead||contactIdentityLead_(c);if(!lead||(lead.status||'new')!=='new')return false;
  const raw=(store||PropertiesService.getScriptProperties()).getProperty(contactIdentityKey_(c));let receipt;try{receipt=JSON.parse(raw||'null');}catch(e){return false;}
  return !!receipt&&receipt.version===1&&receipt.state==='reviewed'&&receipt.signature===contactIdentitySignature_(c,lead)&&recentContactDate_(receipt.checked,30,now)&&contactEvidenceValid_(c,lead,receipt.evidence,now);
}
function invalidateContactIdentity_(c,reason,store){
  const props=store||PropertiesService.getScriptProperties(),key=contactIdentityKey_(c),raw=props.getProperty(key);if(!raw)return;
  let old;try{old=JSON.parse(raw);}catch(e){old={unreadable:true};}
  archiveContactIdentityReview_(key,raw,props);props.setProperty(key,JSON.stringify({...old,state:'invalidated',invalidated:new Date().toISOString(),reason}));
}
function contactIdentityChanged_(before,result){return ['lead_id','company','domain','name','role','linkedin','provider_person_id'].some(k=>String(before[k]||'')!==String(result[k]??before[k]??''));}
function namedWorkEmail_(value,domain){
  const email=workEmail_(value,domain),local=email.split('@')[0]||'';
  return email&&!/^(?:info|contact|support|help|hello|office|admin|sales|team|enquir(?:y|ies)|inquir(?:y|ies)|jobs|careers?|hr|recruit(?:ing|ment)?|privacy|legal|billing|accounts?|marketing|press|media|webmaster|customer(?:service|support)?)(?:[._+-].*)?$/i.test(local)?email:'';
}
function coldDerive_(a,row,match) {
  const rejected=!!row._site?.text&&(!validProbability_(a.site_matches_post?.noul)||a.site_matches_post.noul<SITE_JEV_ACCEPT);
  const eligible=!rejected&&match>=prospectConfig_().cold_min_fit;
  return {match_pct:rejected?'':match,readiness_pct:'Unknown',next_step:rejected?STEP.decide:eligible?STEP.decide:STEP.skip,
    confidence:'',why:rejected?'Company website identity unconfirmed; review evidence':'Cold prospect: fit is assessed; need, budget and buying timing are unconfirmed',
    missing:'confirmed need, relevant person and verified work email',channel:coldChannel_(row),
    what_to_say:eligible?'Explore whether the documented situation creates a relevant need; label the hypothesis as a question':'',
    lookup:'review: cold prospect; use Find work contacts after reviewing fit',play:eligible?'review':'skip',ai_route:'cold',ai_pitch:'exploratory',ai_lead_type:'unconfirmed prospect'};
}
function coldPriorityFormula_(ref,tables) {
  const p=prospectConfig_(),w=p.cold_priority,id=ref('id');
  const table=tables||{contacts:'Contacts',evidence:'Prospect evidence'};
  const base=`'${table.contacts.replace(/'/g,"''")}'!`,evidence=`'${table.evidence.replace(/'/g,"''")}'!A:H`;
  const domain=`IFERROR(LOWER(REGEXEXTRACT(${ref('website')},"(?i)^(?:https?://)?(?:www\\.)?([^/]+)")),"")`;
  const emailDomain=`IFERROR(REGEXEXTRACT(${base}I2:I,"@([^@]+)$"),"")`;
  const valid=`IFERROR(SUMPRODUCT((${base}A2:A=${id})*(${base}D2:D=${domain})*(${base}H2:H="confirmed")*(${base}J2:J="valid")*(${base}I2:I<>"")*(${base}I2:I=${base}P2:P)*(${emailDomain}=${domain})*ISNUMBER(${base}K2:K)*(${base}K2:K>=TODAY()-${p.contacts.verification_days})*(${base}K2:K<=NOW())*(${base}O2:O<>"yes")),0)>0`;
  const li=`COUNTIFS(${base}A2:A,${id},${base}D2:D,${domain},${base}H2:H,"confirmed",${base}G2:G,"https://www.linkedin.com/in/*",${base}O2:O,"<>yes")>0`;
  const timing=`IFERROR(VLOOKUP(${id},${evidence},6,FALSE),0)`;
  const timingUrl=`IFERROR(VLOOKUP(${id},${evidence},7,FALSE),"")`;
  const timingText=`IFERROR(VLOOKUP(${id},${evidence},5,FALSE),"")`;
  const date=`IFERROR(INT(VALUE(${timing})),0)`;
  const fresh=`IF(AND(${timingUrl}<>"",${timingText}<>"",${date}>0,${date}<=TODAY()),100*POWER(0.5,(TODAY()-${date})/${w.half_life_days}),0)`;
  return `IF(ISNUMBER(${ref('match_pct')}),ROUND(${w.fit_weight}*${ref('match_pct')}+${w.contact_weight}*IF(${valid},100,IF(${li},50,0))+${w.timing_weight}*${fresh},1),"Not scored")`;
}
function coldProspectsCsv_(parsed) {
  const required=['company','website','facts','facts_url','hypothesis'],allowed=[...required,'industry','country','employees','timing_signal','timing_date','timing_url'];
  if(!Array.isArray(parsed)||parsed.length<2)throw new Error('Provide the prospect CSV header and at least one row.');
  const h=parsed[0].map(String);
  if(new Set(h).size!==h.length||required.some(k=>!h.includes(k))||h.some(k=>!allowed.includes(k)))throw new Error('Use prospect-import-template.csv headers.');
  return parsed.slice(1).filter(r=>r.some(x=>String(x).trim())).map((r,i)=>{
    if(r.length!==h.length)throw new Error('Wrong column count on CSV row '+(i+2));
    const o=Object.fromEntries(h.map((k,j)=>[k,String(r[j]).trim()])),domain=professionalDomain_(o.website);
    if(required.some(k=>!o[k])||!domain||!safePublicUrl_(o.facts_url))throw new Error('Company, own business domain, observed facts, public evidence URL and separate hypothesis are required.');
    if(o.employees&&(!/^\d+$/.test(o.employees)||Number(o.employees)<1))throw new Error('Employees must be a positive whole number or blank.');
    if(o.timing_signal||o.timing_date||o.timing_url) {
      if(!o.timing_signal||!/^\d{4}-\d{2}-\d{2}$/.test(o.timing_date)||!contactDate_(o.timing_date)||new Date(o.timing_date).toISOString().slice(0,10)!==o.timing_date||!safePublicUrl_(o.timing_url)||new Date(o.timing_date)>new Date())throw new Error('Timing needs an observed signal, real nonfuture date and supporting public URL.');
    }
    const id='cold:'+Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,domain,Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
    return {lead:{id,company:o.company,website:'https://'+domain,source:'cold_prospect',link:safePublicUrl_(o.facts_url),
      what_they_want:'Need unconfirmed — cold prospect',notes:'Observed facts: '+o.facts+'\nHypothesis (unconfirmed): '+o.hypothesis,
      industry:o.industry||'',country:o.country||'',employees:o.employees?Number(o.employees):'',status:'new',readiness_pct:'Unknown',channel:'Find contact first',lookup:'review: qualify company before contact research'},
      evidence:[id,o.facts,safePublicUrl_(o.facts_url),o.hypothesis,o.timing_signal||'',o.timing_date?new Date(o.timing_date):'',o.timing_url?safePublicUrl_(o.timing_url):'',new Date()]};
  });
}
function importProspectsCsv() {
  if(prospectConfig_().approach==='demand')throw new Error('Choose cold or mixed in the business profile and rebuild before importing prospects.');
  const ui=SpreadsheetApp.getUi(),r=ui.prompt('Import cold prospects','Paste prospect-import-template.csv. Facts and hypotheses are separate; no request for services is assumed. No API call is made.',ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!==ui.Button.OK)return;
  const items=coldProspectsCsv_(Utilities.parseCsv(r.getResponseText())),lock=LockService.getScriptLock();lock.waitLock(5000);
  try {
    const sh=SpreadsheetApp.getActive().getSheetByName(TABS.leads),seen=seenIds_(sh),s=contactSheets_();let count=0;
    for(const {lead,evidence} of items) {
      if(seen.has(lead.id))continue;
      // Evidence first: a failed lead write can be retried without losing its source.
      upsertEvidence_(s.evidence,evidence);
      appendLeadValues_(sh,sh.getLastRow()+1,[LEAD_COLS.map(c=>sheetValue_(lead[c]??(c==='added'?new Date():'')))]);seen.add(lead.id);count++;
    }
    if(count)formatLeadRows_(sh,LEAD_FIRST_ROW,sh.getLastRow()-LEAD_HEADER_ROW);
    logEvent_({type:'import',source:'cold_prospect',items:items.length,added:count,cost:0,note:'Company fit only; buying intent unconfirmed.'});
    SpreadsheetApp.getActive().toast('Imported '+count+' cold prospects.');
  } finally {lock.releaseLock();refreshProgress_();}
}
function upsertEvidence_(sh,evidence) {
  const all=sh.getDataRange().getValues(),index=all.findIndex((r,i)=>i>0&&r[0]===evidence[0]);
  if(index<0)sh.appendRow(evidence.map(sheetValue_)); // Never overwrite a researcher's edits on repeat import.
}
function contactRows_(sh) {
  const values=sh.getDataRange().getValues();
  if(CONTACT_COLS.some((c,i)=>values[0]?.[i]!==c))throw new Error('Contacts schema differs; stop before writing.');
  const ids=new Set();
  return values.slice(1).map((r,i)=>Object.assign(Object.fromEntries(CONTACT_COLS.map((c,k)=>[c,leadFieldValue_(c,r[k]??'')])),{_r:i+2})).filter(c=>{
    if(!c.lead_id&&!c.contact_id&&!c.name&&!c.email)return false;
    if(!c.lead_id||!c.contact_id||ids.has(c.contact_id))throw new Error('Contact identity is missing or duplicated; reconcile IDs before processing.');
    ids.add(c.contact_id);return true;
  });
}
function contactSnapshot_(row) { return JSON.stringify(CONTACT_COLS.map(k=>row[k]??'')); }
function contactSuppressionKey_(value) { return 'LH_CONTACT_SUPPRESS_'+Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join(''); }
function contactSuppressed_(c,rows) {
  const p=PropertiesService.getScriptProperties(),domain=professionalDomain_(c.domain),name=contactName_(c.name),email=String(c.email||'').toLowerCase();
  if(c.do_not_contact==='yes'||p.getProperty(contactSuppressionKey_('domain:'+domain))||p.getProperty(contactSuppressionKey_('person:'+domain+':'+name))||(email&&p.getProperty(contactSuppressionKey_('email:'+email))))return true;
  return (rows||[]).some(r=>r.do_not_contact==='yes'&&((email&&String(r.email||'').toLowerCase()===email)||(r.domain===domain&&(!r.name||contactName_(r.name)===name))));
}
function savedContacts_() { const sh=SpreadsheetApp.getActive().getSheetByName('Contacts');return sh?contactRows_(sh):[]; }
function coldChannel_(lead) {
  const all=savedContacts_(),domain=professionalDomain_(lead.website);
  return all.some(c=>c.lead_id===lead.id&&c.domain===domain&&lead.email===c.email&&contactCanPublish_(c)&&!contactSuppressed_(c,all))?'Email':'Find contact first';
}
function coldEvidenceText_(row) {
  return [row.company,row.industry,row.country,String(row.notes||'').split('\nHypothesis')[0]].filter(Boolean).join(' ');
}
function commitContact_(sh,before,result,store) {
  const live=contactRows_(sh).find(c=>c.contact_id===before.contact_id);
  if(!live||contactSnapshot_(live)!==contactSnapshot_(before))return false;
  if(['lead_id','company','domain'].some(k=>String(result[k]??before[k]??'')!==String(before[k]||'')))return false;
  const changed=contactIdentityChanged_(before,result)||result.email_status==='identity_mismatch',next={...result};
  if(changed){next.identity_status='unconfirmed';next.note=[result.note||'Provider identity changed; review current person evidence.',before.note||''].filter((v,i,a)=>v&&a.indexOf(v)===i).join('\n');invalidateContactIdentity_(before,'Contact identity or provider evidence changed; explicit review required.',store);}
  const expected={...before};
  for(const k of ['name','role','linkedin','identity_status','email','email_status','verified_on','verified_email','source_urls','checked_on','note','do_not_contact','provider','provider_person_id','phone','phone_type','phone_status','phone_checked_on','pending_request_id']){
    const value=next[k]??before[k]??'';if(String(value)===String(before[k]??''))continue;
    const current=contactRows_(sh).find(c=>c.contact_id===before.contact_id);if(!current||contactSnapshot_(current)!==contactSnapshot_(expected))return false;
    const cell=sh.getRange(current._r,CONTACT_COLS.indexOf(k)+1);if(typeof cell.getFormula==='function'&&cell.getFormula())return false;
    cell.setValue(sheetValue_(value));expected[k]=value;
  }
  return true;
}
function onEdit(e) {
  if(!e?.range||e.range.getSheet().getName()!=='Contacts'||e.range.getLastRow()<2)return;
  const sh=e.range.getSheet(),first=Math.max(2,e.range.getRow()),n=e.range.getLastRow()-first+1,left=e.range.getColumn(),right=e.range.getLastColumn();
  if(left<=7&&right>=1){contactRows_(sh).filter(c=>c._r>=first&&c._r<first+n).forEach(c=>invalidateContactIdentity_(c,'Owner edited identity; explicit evidence review required.'));sh.getRange(first,8,n,1).setValues(Array.from({length:n},()=>['unconfirmed']));}
  if(left<=8&&right>=8)contactRows_(sh).filter(c=>c._r>=first&&c._r<first+n&&c.identity_status!=='confirmed').forEach(c=>invalidateContactIdentity_(c,'Owner changed identity review state.'));
  if(left<=9&&right>=9) {
    sh.getRange(first,10,n,1).setValues(Array.from({length:n},()=>['unverified']));
    sh.getRange(first,11,n,1).clearContent();sh.getRange(first,16,n,1).clearContent();
  }
  reconcilePublishedContacts_();
}
function reconcilePublishedContacts_() {
  const ss=SpreadsheetApp.getActive(),tab=ss.getSheetByName('Contacts'),sh=ss.getSheetByName(TABS.leads);
  if(!tab||!sh)return;
  const rows=contactRows_(tab);
  for(const c of rows) {
    const suppressed=contactSuppressed_(c,rows);
    if(suppressed&&c.do_not_contact!=='yes'){tab.getRange(c._r,15).setValue('yes');c.do_not_contact='yes';}
    if(!c.published_email)continue;
    const lead=cellFillRow_(leadData_(sh),c.lead_id);
    if(contactCanPublish_(c)&&!suppressed&&lead&&professionalDomain_(lead.website)===c.domain)continue;
    if(lead&&(lead.status||'new')==='new'&&lead.email===c.published_email&&confirmRow_(sh,lead)) {
      const fresh=cellFillRow_(leadData_(sh),lead.id);
      if(fresh&&(fresh.status||'new')==='new'&&fresh.email===c.published_email) {
        sh.getRange(leadSheetRow_(fresh._r),leadCol_(sh,'email')).setValue('');
        sh.getRange(leadSheetRow_(fresh._r),leadCol_(sh,'channel')).setValue(peopleChannel_({...fresh,email:''}));
      }
    }
    tab.getRange(c._r,17).setValue('');
  }
}
function contactCreditState_(store,month,existingOnly) {
  const raw=store.getProperty(CONTACT_BUDGET_KEY);if(!raw)return {month,reserved:0};
  let s;try{s=JSON.parse(raw);}catch(e){throw new Error('Contact credit ledger is unreadable; reconcile before retrying.');}
  if(typeof s.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month)||typeof s.reserved!=='number'||!Number.isFinite(s.reserved)||s.reserved<0)throw new Error('Contact credit ledger is invalid.');
  if(s.history!==undefined&&(!Array.isArray(s.history)||s.history.length>30||s.history.some(r=>!r||!/^[a-f0-9]{32}$/.test(r.id)||!/^[a-f0-9]{32}$/.test(r.scope)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)||!['domain-search','email-finder','email-verifier'].includes(r.endpoint)||![.5,1].includes(r.ceiling)||!['reserved','held','charged','zero'].includes(r.state)||!Number.isFinite(r.at)||r.charge!==undefined&&r.charge!==0&&r.charge!==r.ceiling)||new Set(s.history.map(r=>r.id)).size!==s.history.length))throw new Error('Contact request history is invalid; reconcile before retrying.');
  return existingOnly||s.month===month?s:{month,reserved:0,...(s.history?{history:s.history}:{})};
}
function saveContactCreditState_(store,state){
  const value=JSON.stringify(state),bytes=encodeURIComponent(value).replace(/%[0-9A-F]{2}/g,'x').length;
  if(bytes>8000)throw new Error('Contact request history reached its storage bound; reconcile before retrying.');
  store.setProperty(CONTACT_BUDGET_KEY,value);
  if(store.getProperty(CONTACT_BUDGET_KEY)!==value)throw new Error('Contact ledger write could not be confirmed; reconcile before retrying.');
}
function contactCreditArchiveLayout_(sh){
  const width=Math.max(LOG_COLS.length,sh.getLastColumn()),headers=sh.getRange(1,1,1,width).getValues()[0].map(v=>String(v||'').trim());
  const formulas=sh.getRange(1,1,1,width).getFormulas()[0];
  if(LOG_COLS.some(name=>headers.filter(h=>h===name).length!==1||formulas[headers.indexOf(name)]))throw new Error('Contact billing archive needs unique Log headers; restore missing or duplicate headers before retrying.');
  return {width,headers,columns:Object.fromEntries(LOG_COLS.map(name=>[name,headers.indexOf(name)+1])),signature:JSON.stringify(headers)};
}
/** Caller owns the script lock. Append/read back only settled credit receipts,
 * never unresolved requests; no private contact data or USD charge is logged. */
function archiveContactCreditReceipt_(receipt,target){
  if(!['charged','zero'].includes(receipt.state)||!Number.isFinite(receipt.ended)||receipt.charge!==(receipt.state==='zero'?0:receipt.ceiling))throw new Error('Only completed contact charge receipts can be archived.');
  const sh=target||SpreadsheetApp.getActive().getSheetByName(TABS.log);if(!sh)throw new Error('Contact billing archive needs the initialized Log sheet; run setup before retrying.');
  const copy=Object.fromEntries(['id','scope','month','endpoint','ceiling','state','at','ended','charge'].map(k=>[k,receipt[k]])),body=JSON.stringify({version:1,unit:'Hunter API credits',...copy}),hash=discoveryHash_(body),id='hunter_receipt:'+receipt.id;
  const expected={date:new Date(receipt.ended),month:receipt.month,type:'contact_credit_receipt',source:'hunter_credit_ledger',run_id:id,items:1,added:'',auto_skipped:'',cost_usd:0,approved_via:'System (credit receipt archive)',note:'Hunter credit receipt v1 | SHA-256 '+hash+' | '+body};
  const layout=contactCreditArchiveLayout_(sh),same=(value,field)=>field==='date'?Number.isFinite(Number(new Date(value)))&&Math.abs(Number(new Date(value))-receipt.ended)<=2:String(value)===String(expected[field]);
  const locate=()=>{
    const fresh=contactCreditArchiveLayout_(sh);if(fresh.signature!==layout.signature)throw new Error('Log columns changed during credit archival; receipt retained.');
    const count=Math.max(0,sh.getLastRow()-1),rows=count?sh.getRange(2,fresh.columns.run_id,count,1).getValues():[],found=[];
    rows.forEach((r,i)=>{if(String(r[0])===id){if(sh.getRange(i+2,fresh.columns.run_id).getFormula())throw new Error('Contact archive identity is a formula; receipt retained.');found.push(i+2);}});
    if(found.length>1)throw new Error('Duplicate contact archive identity; receipt retained for reconciliation.');
    return found[0]||0;
  };
  let row=locate();
  if(!row){
    row=sh.getLastRow()+1;if(row>sh.getMaxRows())sh.insertRowsAfter(sh.getMaxRows(),row-sh.getMaxRows());
    if(contactCreditArchiveLayout_(sh).signature!==layout.signature)throw new Error('Log columns changed before credit archival; receipt retained.');
    const append=sh.getRange(row,1,1,layout.width),current=append.getValues()[0];if(current.some(v=>v!==''&&v!==null)||append.getFormulas()[0].some(Boolean)||append.getNotes()[0].some(Boolean))throw new Error('Log append row changed; no archive data overwritten.');
    if(sh.getLastRow()>=row||contactCreditArchiveLayout_(sh).signature!==layout.signature)throw new Error('Log append row or headers changed; receipt retained.');
    sh.getRange(row,layout.columns.run_id).setValue(id);
  }
  // The stable ID is written first so a sort or an interrupted append can be
  // re-found and completed without overwriting unrelated owner columns.
  for(const field of LOG_COLS.filter(name=>name!=='run_id')){
    row=locate();if(!row)throw new Error('Contact archive row disappeared; original receipt retained.');
    const cell=sh.getRange(row,layout.columns[field]),value=cell.getValue();
    if(cell.getFormula())throw new Error('Contact archive field is a formula; receipt retained.');
    if(value!==''&&value!==null){if(!same(value,field))throw new Error('Contact archive conflicts with existing Log data; receipt retained.');continue;}
    if(cell.getNote())throw new Error('Blank contact archive field has an owner note; receipt retained.');
    if(contactCreditArchiveLayout_(sh).signature!==layout.signature||String(sh.getRange(row,layout.columns.run_id).getValue())!==id||cell.getValue()!==value||cell.getNote()||cell.getFormula())throw new Error('Contact archive identity, field or headers changed before write; receipt retained.');
    if(field==='month'){
      // Even literal rich text reads as Date under an inherited date format.
      // Format only this guarded blank field, then re-find/recheck it before writing.
      cell.setNumberFormat('@');SpreadsheetApp.flush();row=locate();
      if(!row)throw new Error('Contact archive row disappeared after month formatting; receipt retained.');
      const textCell=sh.getRange(row,layout.columns.month),text=SpreadsheetApp.newRichTextValue().setText(expected.month).build();
      if(textCell.getValue()!==value||textCell.getNote()||textCell.getFormula()||textCell.getNumberFormat()!=='@'||contactCreditArchiveLayout_(sh).signature!==layout.signature||String(sh.getRange(row,layout.columns.run_id).getValue())!==id)throw new Error('Contact archive month ownership or format changed; receipt retained.');
      textCell.setRichTextValue(text);
    }else cell.setValue(expected[field]);
  }
  row=locate();if(!row)throw new Error('Contact archive readback failed; original receipt retained.');
  const savedRange=sh.getRange(row,1,1,layout.width),saved=savedRange.getValues()[0],savedFormulas=savedRange.getFormulas()[0];
  if(LOG_COLS.some(field=>savedFormulas[layout.columns[field]-1]||!same(saved[layout.columns[field]-1],field)))throw new Error('Contact archive readback failed; original receipt retained.');
  return {id,hash,row};
}
function reserveContactCredits_(amount,store,month,receipt) {
  const cap=prospectConfig_().contacts.monthly_credits,s=contactCreditState_(store,month);
  if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(cap)||cap<=0||s.reserved+amount>cap+1e-9)throw new Error('Contact credit limit reached; no request made.');
  if(receipt){
    const history=(s.history||[]).slice();if(history.some(r=>r.id===receipt.id))throw new Error('Duplicate contact reservation; no request made.');
    while(history.length>=30){
      const old=history.findIndex(r=>['charged','zero'].includes(r.state));if(old<0)throw new Error('Contact request history is full; reconcile unresolved requests before retrying.');
      archiveContactCreditReceipt_(history[old]);history.splice(old,1);
    }
    history.push(receipt);s.history=history;
  }
  s.reserved+=amount;saveContactCreditState_(store,s);return s;
}
/** Receipt and current request adjustment share one atomic property write. Old
 * counters never change retrospectively; absent/replayed receipts cannot refund. */
function settleContactCredits_(receipt,store,month,charge){
  const lock=LockService.getScriptLock();lock.waitLock(5000);
  try{
    const state=contactCreditState_(store,month,true),entry=(state.history||[]).find(r=>r.id===receipt.id);
    if(state.month!==month||!entry||entry.month!==month||entry.scope!==receipt.scope||entry.endpoint!==receipt.endpoint||entry.ceiling!==receipt.ceiling)throw new Error('Contact reservation changed; no credit adjustment.');
    if(entry.state!=='reserved'){
      if(charge===null?entry.state!=='held':entry.charge!==charge||entry.state!==(charge===0?'zero':'charged'))throw new Error('Contact settlement changed; no credit adjustment.');
      return false;
    }
    if(charge!==null&&charge!==0&&charge!==entry.ceiling)throw new Error('Invalid contact settlement; reservation retained.');
    if(charge===0&&state.reserved<entry.ceiling)throw new Error('Contact counter changed; reservation retained.');
    entry.state=charge===null?'held':charge===0?'zero':'charged';entry.ended=Date.now();
    if(charge!==null)entry.charge=charge;
    if(charge===0)state.reserved-=entry.ceiling;
    saveContactCreditState_(store,state);return true;
  }finally{lock.releaseLock();}
}
function hunterRequest_(endpoint,params,credits) {
  const cfg=prospectConfig_().contacts,store=PropertiesService.getScriptProperties();
  if(BUSINESS_CONFIG.mode!=='assisted'||cfg.provider!=='hunter')throw new Error('Hunter is disabled; choose assisted mode and Hunter in your profile.');
  const key=store.getProperty('HUNTER_KEY');if(!key)throw new Error('Connect your own Hunter account first.');
  const costs={'domain-search':1,'email-finder':1,'email-verifier':.5};
  if(costs[endpoint]!==credits)throw new Error('Unsupported contact operation or credit ceiling.');
  if(endpoint==='domain-search'&&(!Number.isInteger(params.limit)||params.limit<1||params.limit>10))throw new Error('Domain Search requires a 1–10 result limit for this credit ceiling.');
  const lease='LH_CONTACT_REQUEST_'+Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify([endpoint,params]),Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  const month=Utilities.formatDate(new Date(),'UTC','yyyy-MM'),receipt={id:discoveryHash_(Utilities.getUuid()+':'+Date.now()).slice(0,32),scope:lease.slice('LH_CONTACT_REQUEST_'.length, 'LH_CONTACT_REQUEST_'.length+32),month,endpoint,ceiling:credits,state:'reserved',at:Date.now()};
  const lock=LockService.getScriptLock();lock.waitLock(5000);
  try{
    const prior=store.getProperty(lease);
    if(prior&&(!Number.isFinite(Number(prior))||Date.now()-Number(prior)<30*60e3))throw new Error('This contact request is already running or was interrupted; wait 30 minutes before manually retrying.');
    store.setProperty(lease,String(Date.now()));
    try{reserveContactCredits_(credits,store,month,receipt);}catch(e){store.deleteProperty(lease);throw e;}
  }finally{lock.releaseLock();}
  // A reservation survives transport failures/crashes; never assume an unobserved request was free.
  const query=Object.entries(params).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');
  try{
    const response=providerFetch_('https://api.hunter.io/v2/'+endpoint+'?'+query,{headers:{'X-API-KEY':key},muteHttpExceptions:true,followRedirects:false});
    const status=response.getResponseCode();
    if(status===202){settleContactCredits_(receipt,store,month,null);return {pending:true};}
    if(status===451) {
      const scope=endpoint==='domain-search'?'domain:'+params.domain:endpoint==='email-finder'?'person:'+params.domain+':'+contactName_(params.full_name):'email:'+String(params.email).toLowerCase();
      settleContactCredits_(receipt,store,month,null);store.setProperty(contactSuppressionKey_(scope),'yes');return {suppressed:true};
    }
    if(status!==200)throw new Error('Hunter returned HTTP '+status+'; no automatic retry. Check account limits or connection.');
    let body;try{body=JSON.parse(response.getContentText());}catch(e){throw new Error('Hunter returned unreadable data.');}
    if(!body||typeof body.data!=='object'||!body.data||Array.isArray(body.data)||body.errors)throw new Error('Hunter response schema mismatch.');
    if(endpoint==='domain-search'&&(body.data.domain!==params.domain||!Array.isArray(body.data.emails)))throw new Error('Hunter Domain Search response schema or domain mismatch.');
    const charge=endpoint==='domain-search'&&body.data.emails.length===0?0:credits;
    settleContactCredits_(receipt,store,month,charge);
    store.deleteProperty(lease);return body.data;
  }catch(e){try{settleContactCredits_(receipt,store,month,null);}catch(ignored){}throw e;}
}
function hunterCandidates_(data,lead,now) {
  const domain=professionalDomain_(lead.website);
  if(!domain||data.domain!==domain||data.webmail===true||data.disposable===true||!Array.isArray(data.emails))return [];
  return data.emails.filter(p=>p.type==='personal'&&contactFullName_(p.first_name+' '+p.last_name)&&contactRoleMatches_(p.position||p.position_raw)).slice(0,5).map(p=>({
    lead_id:lead.id,contact_id:Utilities.getUuid(),company:lead.company,domain,name:p.first_name+' '+p.last_name,role:p.position||p.position_raw,
    linkedin:canonicalLinkedIn_(p.linkedin),identity_status:'unconfirmed',email:namedWorkEmail_(p.value,domain),
    email_status:data.accept_all?'accept_all':p.verification?.status||'unverified',verified_on:p.verification?.date?contactDate_(p.verification.date)||'':'',verified_email:!data.accept_all&&p.verification?.status==='valid'?namedWorkEmail_(p.value,domain):'',
    source_urls:(p.sources||[]).map(s=>safePublicUrl_(s.uri)).filter(Boolean).slice(0,3).join(' · '),checked_on:now||new Date(),
    note:'Hunter company data; confirm current person/company/role before use.',do_not_contact:''}));
}
function workEmail_(value,domain) {
  const e=String(value||'').trim().toLowerCase();
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)&&e.split('@')[1]===domain&&!/^(no-?reply|abuse|postmaster|unsubscribe)@/.test(e)?e:'';
}
function finderResult_(data,contact) {
  if(data.suppressed)return {...contact,email:'',email_status:'suppressed',do_not_contact:'yes',note:'Provider suppression; do not try another provider.'};
  if(data.pending)return {...contact,email_status:'pending',note:'Provider pending. Retry manually later within budget.'};
  if(!data.email)return {...contact,email:'',email_status:'not_found',note:'No work email returned.'};
  const name=[data.first_name,data.last_name].filter(Boolean).join(' '),email=namedWorkEmail_(data.email,contact.domain);
  if(!email||data.domain!==contact.domain||contactName_(name)!==contactName_(contact.name))return {...contact,email:'',email_status:'identity_mismatch',note:'Provider returned a different person/domain; result rejected.'};
  return {...contact,email,email_status:data.accept_all?'accept_all':data.verification?.status||'unverified',
    verified_on:contactDate_(data.verification?.date)||'',verified_email:!data.accept_all&&data.verification?.status==='valid'?email:'',source_urls:(data.sources||[]).map(s=>safePublicUrl_(s.uri)).filter(Boolean).slice(0,3).join(' · ')};
}
function verificationResult_(data,email,now) {
  if(data.suppressed)return {email_status:'suppressed',verified_on:'',do_not_contact:'yes'};
  if(data.pending)return {email_status:'pending',verified_on:''};
  if(String(data.email||'').toLowerCase()!==email)return {email_status:'identity_mismatch',verified_on:''};
  let status=data.status;
  if(data.accept_all===true)status='accept_all';
  else if(data.webmail===true)status='webmail';
  else if(data.disposable===true)status='disposable';
  else if(data.block===true)status='blocked';
  if(!['valid','invalid','accept_all','webmail','disposable','unknown','blocked'].includes(status))status='unknown';
  return {email_status:status,verified_on:now||new Date(),verified_email:status==='valid'?email:''};
}
function contactPublishableIdentity_(c,lead,store,now){return contactIdentityConfirmed_(c,lead,store,now)&&c.email_status==='valid'&&c.verified_email===c.email&&!!namedWorkEmail_(c.email,c.domain)&&recentContactDate_(c.verified_on,prospectConfig_().contacts.verification_days,now);}
function contactCanPublish_(c,now){return contactPublishableIdentity_(c,undefined,undefined,now)&&!contactSuppressed_(c);}
function enrichContact_(contact,stillEligible) {
  const cfg=prospectConfig_().contacts,now=new Date();let c={...contact};
  if(contactSuppressed_(c,savedContacts_())||c.identity_status==='rejected')return {...c,note:'Suppressed or rejected; no lookup.'};
  if(!contactIdentityConfirmed_(c))throw new Error('Confirm current identity with supporting evidence using Confirm selected identity evidence before named enrichment.');
  if(contactCanPublish_(c,now))return c;
  if(!professionalDomain_(c.domain)||!contactFullName_(c.name))throw new Error('A reviewed name and business domain are needed.');
  if(c.email&&!namedWorkEmail_(c.email,c.domain))throw new Error('Existing email is not a named address at the confirmed business domain; keep generic inboxes as company routes.');
  if(c.identity_status!=='confirmed')throw new Error('Confirm the current person/company/role in Contacts before finding or verifying email.');
  if(stillEligible&&!stillEligible())return {...c,note:'Selected contact or linked company changed; no further enrichment.'};
  if(!c.email)c=finderResult_(hunterRequest_('email-finder',{domain:c.domain,full_name:c.name},1),c);
  if(contactSuppressed_(c,savedContacts_()))return {...c,do_not_contact:'yes',note:'Suppressed during lookup; no further enrichment.'};
  if(stillEligible&&!stillEligible())return {...c,note:'Selected contact or linked company changed during lookup; email retained for review, verifier withheld.'};
  if(c.email&&!['accept_all','invalid','suppressed','identity_mismatch'].includes(c.email_status)&&!(c.email_status==='valid'&&c.verified_email===c.email&&recentContactDate_(c.verified_on,cfg.verification_days,now)))
    Object.assign(c,verificationResult_(hunterRequest_('email-verifier',{email:c.email},.5),c.email,now));
  c.checked_on=now;return c;
}
function findWorkContactsSelected() {
  const ss=SpreadsheetApp.getActive(),ui=SpreadsheetApp.getUi(),sh=ss.getActiveSheet(),cfg=prospectConfig_().contacts;
  if(sh.getName()!==TABS.leads)return ui.alert('Select lead rows in Leads first.');
  const ranges=sh.getActiveRangeList()?.getRanges()||[sh.getActiveRange()];
  const data=leadData_(sh),selected=selectedCellFields_(data,ranges,r=>sh.isRowHiddenByFilter(r)).map(x=>cellFillRow_(data,x.id));
  if(!selected.length||selected.length>cfg.max_rows_per_run)return ui.alert('Select 1–'+cfg.max_rows_per_run+' leads.');
  if(BUSINESS_CONFIG.mode!=='assisted'||cfg.provider!=='hunter'||cfg.monthly_credits<=0)return ui.alert('Contact research is disabled. Configure your own Hunter account and an explicit credit cap first.');
  const ready=selected.filter(r=>(r.status||'new')==='new'&&websiteIdentityConfirmed_(r)&&professionalDomain_(r.website)&&typeof r.match_pct==='number'&&r.match_pct>=prospectConfig_().cold_min_fit);
  if(!ready.length)return ui.alert('Selected leads need a company website, sufficient fit and new outreach status.');
  if(ui.alert('Find work contacts',ready.length+' companies; up to '+ready.length+' Hunter API credits for one limited domain search each. Results stay unconfirmed until reviewed. No email is sent.',ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
  const tab=contactSheets_().contacts;let existing=contactRows_(tab),done=0;
  const deadline=Date.now()+210000;
  for(const lead of ready) {
    if(Date.now()>deadline)break;
    const currentLead=cellFillRow_(leadData_(sh),lead.id);if(!currentLead||!websiteIdentityConfirmed_(currentLead)||cellFillHash_(currentLead)!==cellFillHash_(lead))continue;
    const prior=existing.filter(c=>c.lead_id===lead.id),store=PropertiesService.getScriptProperties();
    const cacheKey='LH_CONTACT_DISCOVERY_'+contactSuppressionKey_(professionalDomain_(lead.website)+':'+BUSINESS_CONFIG.decision_roles.join('|')).slice(-64);
    if(contactSuppressed_({domain:professionalDomain_(lead.website),name:''},existing)||prior.some(c=>c.do_not_contact==='yes'))continue;
    if(recentContactDate_(store.getProperty(cacheKey),cfg.cache_days)) {
      if(!prior.length)existing.filter(c=>c.domain===professionalDomain_(lead.website)&&contactFullName_(c.name)&&c.identity_status!=='rejected'&&contactRoleMatches_(c.role)&&!contactSuppressed_(c,existing)).slice(0,5).forEach(c=>{
        const copy={...c,lead_id:lead.id,company:lead.company,contact_id:Utilities.getUuid(),identity_status:'unconfirmed',published_email:'',note:'Cached company candidate; confirm relevance to this branch/account.'};
        tab.appendRow(CONTACT_COLS.map(k=>sheetValue_(copy[k]??'')));done++;
      });
      existing=contactRows_(tab);continue;
    }
    if(prior.some(c=>!['pending','error'].includes(c.email_status)&&recentContactDate_(c.checked_on,cfg.cache_days)))continue;
    const before=cellFillHash_(lead);let result;
    try{result=hunterRequest_('domain-search',{domain:professionalDomain_(lead.website),type:'personal',job_titles:HUNTER_ROLES.join(','),limit:5},1);}
    catch(e){ss.toast('Contact research paused: '+redactSecretText_(e.message));break;}
    const live=cellFillRow_(leadData_(sh),lead.id);if(!live||cellFillHash_(live)!==before)continue;
    let found=hunterCandidates_(result,lead);
    if(!found.length)found=[{lead_id:lead.id,contact_id:Utilities.getUuid(),company:lead.company,domain:professionalDomain_(lead.website),
      identity_status:'unconfirmed',email_status:result.suppressed?'suppressed':result.pending?'pending':'no_matching_candidates',checked_on:new Date(),do_not_contact:result.suppressed?'yes':'',note:'No matching current-role candidate confirmed; use company team pages or public profile search.'}];
    // Do not duplicate an existing named person even after the cache expires.
    existing=contactRows_(tab);
    found.forEach(c=>{
      const prior=existing.find(p=>p.lead_id===c.lead_id&&contactName_(p.name)===contactName_(c.name));
      if(!prior){tab.appendRow(CONTACT_COLS.map(k=>sheetValue_(c[k]??'')));existing.push(c);done++;}
      else if(prior.identity_status!=='rejected'){const update=c.name?{...prior,...c,contact_id:prior.contact_id,identity_status:prior.identity_status,published_email:prior.published_email}:{...prior,email_status:c.email_status,checked_on:c.checked_on,note:c.note,do_not_contact:c.do_not_contact};commitContact_(tab,prior,update);}
    });
    if(!result.pending)store.setProperty(cacheKey,new Date().toISOString());
  }
  reconcilePublishedContacts_();
  ss.setActiveSheet(tab);ss.toast(done+' candidate records. Review identity_status, then select contacts to verify.');
}
function verifyWorkContactsSelected() {
  const ss=SpreadsheetApp.getActive(),ui=SpreadsheetApp.getUi(),sh=ss.getActiveSheet(),cfg=prospectConfig_().contacts;
  if(sh.getName()!=='Contacts')return ui.alert('Select rows in Contacts.');
  const ranges=sh.getActiveRangeList()?.getRanges()||[sh.getActiveRange()],all=contactRows_(sh);
  const leads=leadData_(ss.getSheetByName(TABS.leads));
  const chosen=all.filter(c=>{const lead=cellFillRow_(leads,c.lead_id);return lead&&(lead.status||'new')==='new'&&websiteIdentityConfirmed_(lead)&&professionalDomain_(lead.website)===c.domain&&contactIdentityConfirmed_(c,lead)&&!contactSuppressed_(c,all)&&ranges.some(r=>c._r>=r.getRow()&&c._r<=r.getLastRow())&&!sh.isRowHiddenByFilter(c._r);});
  if(!chosen.length||chosen.length>cfg.max_rows_per_run)return ui.alert('Select 1–'+cfg.max_rows_per_run+' contacts.');
  if(ui.alert('Find / verify work email','Up to '+chosen.length*1.5+' Hunter credits. Existing fresh valid results are reused. Unknown and catch-all results stay unconfirmed. No email is sent.',ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
  const deadline=Date.now()+210000;
  for(const before of chosen) {
    if(Date.now()>deadline)break;
    const currentContacts=contactRows_(sh),current=currentContacts.find(c=>c.contact_id===before.contact_id),lead=cellFillRow_(leadData_(ss.getSheetByName(TABS.leads)),before.lead_id);
    if(!current||!contactIdentityConfirmed_(current,lead)||contactSnapshot_(current)!==contactSnapshot_(before)||contactSuppressed_(current,currentContacts)||!lead||(lead.status||'new')!=='new'||!websiteIdentityConfirmed_(lead)||professionalDomain_(lead.website)!==before.domain)continue;
    const leadSignature=websiteIdentitySignature_(lead),stillEligible=()=>{const all=contactRows_(sh),contact=all.find(c=>c.contact_id===before.contact_id),freshLead=cellFillRow_(leadData_(ss.getSheetByName(TABS.leads)),before.lead_id);return !!(contact&&contactSnapshot_(contact)===contactSnapshot_(before)&&!contactSuppressed_(contact,all)&&freshLead&&contactIdentityConfirmed_(contact,freshLead)&&(freshLead.status||'new')==='new'&&professionalDomain_(freshLead.website)===before.domain&&websiteIdentityConfirmed_(freshLead)&&websiteIdentitySignature_(freshLead)===leadSignature);};
    let result;try{result=enrichContact_(before,stillEligible);}catch(e){result={...before,note:redactSecretText_(e.message)};}
    commitContact_(sh,before,result);
  }
  reconcilePublishedContacts_();
  ss.toast('Contact checks finished. Review results; use Copy verified contacts to Leads when ready.');
}
function addKnownWorkContact() {
  const ss=SpreadsheetApp.getActive(),ui=SpreadsheetApp.getUi(),sh=ss.getActiveSheet();
  if(sh.getName()!==TABS.leads)return ui.alert('Select one company row in Leads.');
  const selection=selectedCellFields_(leadData_(sh),[sh.getActiveRange()]);
  if(selection.length!==1)return ui.alert('Select one company row.');
  const lead=cellFillRow_(leadData_(sh),selection[0].id),domain=professionalDomain_(lead.website);
  if(!domain||!websiteIdentityConfirmed_(lead))return ui.alert('Confirm the company website identity first.');
  const reply=ui.prompt('Add known person at '+lead.company,'Paste one CSV line: full name, role, LinkedIn profile URL (or blank), public evidence URL. Use current company/team evidence. No API call is made.',ui.ButtonSet.OK_CANCEL);
  if(reply.getSelectedButton()!==ui.Button.OK)return;
  const rows=Utilities.parseCsv(reply.getResponseText()),r=rows[0]||[];
  if(rows.length!==1||r.length!==4||!contactFullName_(r[0])||!contactRoleMatches_(r[1])||(r[2]&&!canonicalLinkedIn_(r[2]))||!safePublicUrl_(r[3]))throw new Error('Provide a full name, relevant role, real /in/ profile if available, and public source.');
  const tab=contactSheets_().contacts,c={lead_id:lead.id,contact_id:Utilities.getUuid(),company:lead.company,domain,name:r[0].trim(),role:r[1].trim(),linkedin:canonicalLinkedIn_(r[2]),identity_status:'unconfirmed',email_status:'unverified',source_urls:safePublicUrl_(r[3]),note:'Owner supplied current-role evidence; review identity_status before use.'};
  if(contactRows_(tab).some(x=>x.lead_id===c.lead_id&&contactName_(x.name)===contactName_(c.name)))return ui.alert('This person already exists in Contacts.');
  tab.appendRow(CONTACT_COLS.map(k=>sheetValue_(c[k]??'')));ss.setActiveSheet(tab);
}
function confirmSelectedContactIdentity(){
  const ss=SpreadsheetApp.getActive(),ui=SpreadsheetApp.getUi(),sh=ss.getActiveSheet();if(sh.getName()!=='Contacts')return ui.alert('Select one person row in Contacts first.');
  const range=sh.getActiveRange();if(range.getRow()<2||range.getLastRow()!==range.getRow()||sh.isRowHiddenByFilter(range.getRow()))return ui.alert('Select one visible person row.');
  const before=contactRows_(sh).find(c=>c._r===range.getRow()),lead=before&&contactIdentityLead_(before);
  if(!before||!lead||(lead.status||'new')!=='new'||before.identity_status==='rejected'||!websiteIdentityConfirmed_(lead)||contactSuppressed_(before,contactRows_(sh))||!contactFullName_(before.name)||!contactRoleMatches_(before.role))return ui.alert('Review current company website, full name, configured role and suppression first.');
  const reply=ui.prompt('Confirm current identity — '+before.name,'Read the current source yourself. Paste JSON with url, quote (full name + company + actual role + responsibility), observedOn (YYYY-MM-DD), basis (request_owner/function_owner/founder_fallback/application_route), current:true, relevant:true. This reviews this exact person and source for 30 days; it makes no provider call.',ui.ButtonSet.OK_CANCEL);
  if(reply.getSelectedButton()!==ui.Button.OK)return;let evidence;try{evidence=JSON.parse(reply.getResponseText());}catch(e){throw Error('Enter the evidence JSON shown in the prompt.');}
  if(!contactEvidenceValid_(before,lead,evidence))throw Error('Evidence is incomplete, stale, unrelated or does not name the current person/company/role.');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const current=contactRows_(sh).find(c=>c.contact_id===before.contact_id),fresh=contactIdentityLead_(before);
    if(!current||!fresh||contactSnapshot_(current)!==contactSnapshot_(before)||!websiteIdentityConfirmed_(fresh)||websiteIdentitySignature_(fresh)!==websiteIdentitySignature_(lead)||contactSuppressed_(current,contactRows_(sh)))throw Error('Person or company changed during review; no confirmation.');
    const proof=saveContactIdentityReview_(current,fresh,evidence),latest=contactRows_(sh).find(c=>c.contact_id===before.contact_id),latestLead=contactIdentityLead_(before);
    if(!latest||!latestLead||contactSnapshot_(latest)!==contactSnapshot_(before)||!websiteIdentityConfirmed_(latestLead)||contactIdentitySignature_(latest,latestLead)!==proof.signature)throw Error('Person or company changed while saving evidence; confirmation unchanged.');
    if(!commitContact_(sh,latest,{...latest,identity_status:'confirmed',note:['Owner identity evidence | '+proof.checked+' | '+evidence.url+' | '+evidence.quote,latest.note||''].filter(Boolean).join('\n')}))throw Error('Owner edit preserved; review again.');
  }finally{lock.releaseLock();}
  if(typeof refreshContactGuidance_==='function')refreshContactGuidance_();ss.toast('Current person evidence saved. Generic company inboxes, mailbox delivery and buying intent remain separate.');
}
function publishVerifiedContacts() {
  reconcilePublishedContacts_();
  const ss=SpreadsheetApp.getActive(),tab=ss.getSheetByName('Contacts'),sh=ss.getSheetByName(TABS.leads);
  if(!tab)throw new Error('Contacts is not set up.');
  if(ss.getActiveSheet().getName()!=='Contacts')return SpreadsheetApp.getUi().alert('Select the reviewed people in Contacts first.');
  const ranges=tab.getActiveRangeList()?.getRanges()||[tab.getActiveRange()];
  const data=leadData_(sh),all=contactRows_(tab);let done=0;
  const selected=all.filter(c=>ranges.some(r=>c._r>=r.getRow()&&c._r<=r.getLastRow())&&!tab.isRowHiddenByFilter(c._r));
  if(!selected.length||selected.length>5)return SpreadsheetApp.getUi().alert('Select 1–5 contacts.');
  for(const c of selected.filter(v=>contactCanPublish_(v))) {
    const lead=cellFillRow_(data,c.lead_id);if(!lead||(lead.status||'new')!=='new'||!websiteIdentityConfirmed_(lead)||!contactIdentityConfirmed_(c,lead)||professionalDomain_(lead.website)!==c.domain||lead.email)continue;
    if(!confirmRow_(sh,lead))continue;
    const fresh=cellFillRow_(leadData_(sh),c.lead_id);if(!fresh||!websiteIdentityConfirmed_(fresh)||!contactIdentityConfirmed_(c,fresh)||cellFillHash_(fresh)!==cellFillHash_(lead))continue;
    const current=contactRows_(tab),currentContact=current.find(v=>v.contact_id===c.contact_id);
    if(!currentContact||contactSnapshot_(currentContact)!==contactSnapshot_(c)||!contactCanPublish_(currentContact)||contactSuppressed_(c,current))continue;
    sh.getRange(leadSheetRow_(fresh._r),leadCol_(sh,'email')).setValue(sheetValue_(c.email));
    sh.getRange(leadSheetRow_(fresh._r),leadCol_(sh,'channel')).setValue('Email');done++;
    tab.getRange(currentContact._r,17).setValue(sheetValue_(c.email));
  }
  ss.toast('Copied '+done+' verified work emails to empty Leads email fields. Buying readiness is unchanged.');
}
function testColdProspectingNative() {
  // Isolated fixture tabs; never touches real contacts, provider accounts or triggers.
  const ss=SpreadsheetApp.getActive(),suffix=Utilities.getUuid().replace(/-/g,'').slice(0,10),created=[];
  const names={contacts:'__LH_contacts_'+suffix,evidence:'__LH_evidence_'+suffix};
  try {
    const contacts=ss.insertSheet(names.contacts);created.push(contacts);
    const evidence=ss.insertSheet(names.evidence);created.push(evidence);
    contacts.getRange(1,1,1,CONTACT_COLS.length).setValues([CONTACT_COLS]);
    const c={...Object.fromEntries(CONTACT_COLS.map(k=>[k,''])),lead_id:'fixture',contact_id:'fixture-person',domain:'example.com',name:'Example Person',identity_status:'confirmed',email:'person@example.com',email_status:'valid',verified_on:new Date(),verified_email:'person@example.com'};
    contacts.getRange(2,1,1,CONTACT_COLS.length).setValues([CONTACT_COLS.map(k=>c[k])]);
    evidence.getRange(1,1,1,PROSPECT_EVIDENCE_COLS.length).setValues([PROSPECT_EVIDENCE_COLS]);
    const formula='='+coldPriorityFormula_(k=>({id:'"fixture"',match_pct:'80',website:'"https://example.com"'})[k],names);
    const out=evidence.getRange('J1');out.setFormula(formula);SpreadsheetApp.flush();
    const w=prospectConfig_().cold_priority;
    const expect=value=>{SpreadsheetApp.flush();const actual=out.getValue();if(typeof actual!=='number'||Math.abs(actual-value)>.051)throw new Error('Cold native priority expected '+value+', got '+actual);};
    expect(Math.round((80*w.fit_weight+100*w.contact_weight)*10)/10);
    contacts.getRange(2,9).setValue('different@example.com');expect(Math.round(80*w.fit_weight*10)/10);
    contacts.getRange(2,9).setValue('person@example.com');contacts.getRange(2,15).setValue('yes');expect(Math.round(80*w.fit_weight*10)/10);
    console.log('PASS: native cold formulas, edited mailbox and suppression fixtures; no provider calls.');
  } finally {created.forEach(sh=>ss.deleteSheet(sh));}
}

function migrateContactSchema_(sh) {
 const n=sh.getLastColumn(),headers=n?sh.getRange(1,1,1,n).getValues()[0]:[];
 if(headers.length===CONTACT_COLS.length&&CONTACT_COLS.every((c,i)=>headers[i]===c))return false;
 if(headers.length===LEGACY_CONTACT_COLS.length&&LEGACY_CONTACT_COLS.every((c,i)=>headers[i]===c)){
   sh.getRange(1,LEGACY_CONTACT_COLS.length+1,1,CONTACT_COLS.length-LEGACY_CONTACT_COLS.length).setValues([CONTACT_COLS.slice(LEGACY_CONTACT_COLS.length)]);return true;
 }
 throw new Error('Contacts schema differs; stop before writing.');
}


/** Disposable native archive mechanics only; no provider or production writes. */
function testContactCreditArchiveNative(){
  const ss=SpreadsheetApp.getActive(),name='__LH_credit_archive_'+Date.now();if(ss.getSheetByName(name))throw Error('Existing fixture left intact.');
  const sh=ss.insertSheet(name),headers=['owner_custom',...LOG_COLS.slice().reverse()];
  try{
    if(sh.getMaxColumns()<headers.length)sh.insertColumnsAfter(sh.getMaxColumns(),headers.length-sh.getMaxColumns());
    sh.getRange(1,1,1,headers.length).setValues([headers]);sh.getRange(2,1,1,headers.length).setValues([headers.map(h=>h==='owner_custom'?'Owner sentinel':h==='run_id'?'owner-row':'')]);sh.getRange(2,1).setNote('Owner note sentinel');sh.getRange(2,headers.indexOf('month')+1).setNumberFormat('yyyy-m');sh.getRange(3,headers.indexOf('month')+1).setNumberFormat('yyyy-m');
    const receipt={id:'a'.repeat(32),scope:'b'.repeat(32),month:Utilities.formatDate(new Date(),'UTC','yyyy-MM'),endpoint:'domain-search',ceiling:1,state:'zero',at:Date.now()-10,ended:Date.now(),charge:0};
    const first=archiveContactCreditReceipt_(receipt,sh);SpreadsheetApp.flush();
    sh.getRange(2,1,sh.getLastRow()-1,headers.length).sort({column:headers.indexOf('run_id')+1,ascending:false});
    const second=archiveContactCreditReceipt_(receipt,sh);if(sh.getLastRow()!==3||first.hash!==second.hash)throw Error('Archive replay duplicated or changed receipt.');
    const values=sh.getDataRange().getValues(),row=values.find(r=>r[headers.indexOf('run_id')]===first.id),owner=values.find(r=>r[headers.indexOf('run_id')]==='owner-row');
    if(!row||typeof row[headers.indexOf('month')]!=='string'||row[headers.indexOf('month')]!==receipt.month||row[headers.indexOf('cost_usd')]!==0||!String(row[headers.indexOf('note')]).includes('Hunter API credits')||owner[0]!=='Owner sentinel')throw Error('Archive lost credits unit, mapped fields or owner value.');
    sh.getRange(second.row,headers.indexOf('source')+1).setValue('Owner change');let blocked=false;try{archiveContactCreditReceipt_(receipt,sh);}catch(e){blocked=true;}
    if(!blocked)throw Error('Archive conflict was not blocked.');
    const formulaCell=sh.getRange(second.row,headers.indexOf('source')+1);formulaCell.setFormula('=""');SpreadsheetApp.flush();blocked=false;try{archiveContactCreditReceipt_(receipt,sh);}catch(e){blocked=true;}
    if(!blocked||formulaCell.getFormula()!=='=""')throw Error('Empty owner formula was not preserved.');
    const ownerRow=sh.getDataRange().getValues().findIndex(r=>r[headers.indexOf('run_id')]==='owner-row')+1;if(sh.getRange(ownerRow,1).getNote()!=='Owner note sentinel'||sh.getRange(ownerRow,headers.indexOf('month')+1).getNumberFormat()!=='yyyy-m'||sh.getRange(second.row,headers.indexOf('month')+1).getNumberFormat()!=='@')throw Error('Owner note/format or canonical month text format was not preserved.');
    console.log('PASS mapped credit archive, exact receipt/hash readback, sorted ID replay, owner conflict/formula/note preservation; zero provider requests and production writes.');
    return {passed:true,providerRequests:0,productionWrites:0};
  }finally{ss.deleteSheet(sh);}
}
