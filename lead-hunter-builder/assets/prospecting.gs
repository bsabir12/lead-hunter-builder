/** Cold prospecting and professional-contact enrichment. No sending functions. */
const PROSPECT_EVIDENCE_COLS=['lead_id','facts','facts_url','hypothesis','timing_signal','timing_date','timing_url','researched_on'];
const CONTACT_COLS=['lead_id','contact_id','company','domain','name','role','linkedin','identity_status','email','email_status','verified_on','source_urls','checked_on','note','do_not_contact','verified_email','published_email'];
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
      what_they_want:'Need unconfirmed — cold prospect',readiness_pct:'Unknown',posted:'',contact:'',people:'',
      notes:'Observed listing facts: '+facts+'\nHypothesis (unconfirmed): potential customer profile fit only',_text:'Cold company listing, not a buying request. '+facts,
      _evidence:[id,facts,safePublicUrl_(i.url),'Potential customer profile fit; need unconfirmed','','','',new Date()]};
  });
}
function contactSheets_() {
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
function contactRoleMatches_(role) {
  const s=contactName_(role);
  return BUSINESS_CONFIG.decision_roles.some(r=>{
    const words=contactName_(r).split(' ').filter(w=>!['of','the','and'].includes(w));
    return words.every(w=>(' '+s+' ').includes(' '+w+' '))&&(!/\b(assistant|former|previous|ex)\b/.test(s)||/\bassistant\b/.test(contactName_(r)));
  });
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
      sh.appendRow(LEAD_COLS.map(c=>sheetValue_(lead[c]??(c==='added'?new Date():''))));seen.add(lead.id);count++;
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
  return values.slice(1).map((r,i)=>Object.assign(Object.fromEntries(CONTACT_COLS.map((c,k)=>[c,r[k]??''])),{_r:i+2})).filter(c=>{
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
  return all.some(c=>c.lead_id===lead.id&&c.domain===domain&&lead.contact===c.email&&contactCanPublish_(c)&&!contactSuppressed_(c,all))?'Email':'Find contact first';
}
function coldEvidenceText_(row) {
  return [row.company,row.industry,row.country,String(row.notes||'').split('\nHypothesis')[0]].filter(Boolean).join(' ');
}
function commitContact_(sh,before,result) {
  const live=contactRows_(sh).find(c=>c.contact_id===before.contact_id);
  if(!live||contactSnapshot_(live)!==contactSnapshot_(before))return false;
  ['email','email_status','verified_on','verified_email','source_urls','checked_on','note','do_not_contact'].forEach(k=>{
    if(String(result[k]??'')!==String(before[k]??''))sh.getRange(live._r,CONTACT_COLS.indexOf(k)+1).setValue(sheetValue_(result[k]??''));
  });
  return true;
}
function onEdit(e) {
  if(!e?.range||e.range.getSheet().getName()!=='Contacts'||e.range.getLastRow()<2)return;
  const sh=e.range.getSheet(),first=Math.max(2,e.range.getRow()),n=e.range.getLastRow()-first+1,left=e.range.getColumn(),right=e.range.getLastColumn();
  if(left<=7&&right>=3)sh.getRange(first,8,n,1).setValues(Array.from({length:n},()=>['unconfirmed']));
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
    if(lead&&(lead.status||'new')==='new'&&lead.contact===c.published_email&&confirmRow_(sh,lead)) {
      const fresh=cellFillRow_(leadData_(sh),lead.id);
      if(fresh&&(fresh.status||'new')==='new'&&fresh.contact===c.published_email) {
        sh.getRange(leadSheetRow_(fresh._r),LEAD_COLS.indexOf('contact')+1).setValue('');
        sh.getRange(leadSheetRow_(fresh._r),LEAD_COLS.indexOf('channel')+1).setValue('Find contact first');
      }
    }
    tab.getRange(c._r,17).setValue('');
  }
}
function contactCreditState_(store,month) {
  const raw=store.getProperty(CONTACT_BUDGET_KEY);if(!raw)return {month,reserved:0};
  let s;try{s=JSON.parse(raw);}catch(e){throw new Error('Contact credit ledger is unreadable; reconcile before retrying.');}
  if(typeof s.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month)||typeof s.reserved!=='number'||!Number.isFinite(s.reserved)||s.reserved<0)throw new Error('Contact credit ledger is invalid.');
  return s.month===month?s:{month,reserved:0};
}
function reserveContactCredits_(amount,store,month) {
  const cap=prospectConfig_().contacts.monthly_credits,s=contactCreditState_(store,month);
  if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(cap)||cap<=0||s.reserved+amount>cap+1e-9)throw new Error('Contact credit limit reached; no request made.');
  s.reserved+=amount;store.setProperty(CONTACT_BUDGET_KEY,JSON.stringify(s));return s;
}
function hunterRequest_(endpoint,params,credits) {
  const cfg=prospectConfig_().contacts,store=PropertiesService.getScriptProperties();
  if(BUSINESS_CONFIG.mode!=='assisted'||cfg.provider!=='hunter')throw new Error('Hunter is disabled; choose assisted mode and Hunter in your profile.');
  const key=store.getProperty('HUNTER_KEY');if(!key)throw new Error('Connect your own Hunter account first.');
  const costs={'domain-search':1,'email-finder':1,'email-verifier':.5};
  if(costs[endpoint]!==credits)throw new Error('Unsupported contact operation or credit ceiling.');
  const lease='LH_CONTACT_REQUEST_'+Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify([endpoint,params]),Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  const lock=LockService.getScriptLock();lock.waitLock(5000);
  try{
    const prior=store.getProperty(lease);
    if(prior&&(!Number.isFinite(Number(prior))||Date.now()-Number(prior)<30*60e3))throw new Error('This contact request is already running or was interrupted; wait 30 minutes before manually retrying.');
    store.setProperty(lease,String(Date.now()));
    try{reserveContactCredits_(credits,store,Utilities.formatDate(new Date(),'UTC','yyyy-MM'));}catch(e){store.deleteProperty(lease);throw e;}
  }finally{lock.releaseLock();}
  // A reservation survives transport failures/crashes; never assume an unobserved request was free.
  const query=Object.entries(params).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');
  const response=providerFetch_('https://api.hunter.io/v2/'+endpoint+'?'+query,{headers:{'X-API-KEY':key},muteHttpExceptions:true,followRedirects:false});
  const status=response.getResponseCode();
  if(status===202)return {pending:true};
  if(status===451) {
    const scope=endpoint==='domain-search'?'domain:'+params.domain:endpoint==='email-finder'?'person:'+params.domain+':'+contactName_(params.full_name):'email:'+String(params.email).toLowerCase();
    store.setProperty(contactSuppressionKey_(scope),'yes');return {suppressed:true};
  }
  if(status!==200)throw new Error('Hunter returned HTTP '+status+'; no automatic retry. Check account limits or connection.');
  let body;try{body=JSON.parse(response.getContentText());}catch(e){throw new Error('Hunter returned unreadable data.');}
  if(!body||typeof body.data!=='object'||!body.data||body.errors)throw new Error('Hunter response schema mismatch.');
  store.deleteProperty(lease);return body.data;
}
function hunterCandidates_(data,lead,now) {
  const domain=professionalDomain_(lead.website);
  if(!domain||data.domain!==domain||data.webmail===true||data.disposable===true||!Array.isArray(data.emails))return [];
  return data.emails.filter(p=>p.type==='personal'&&p.first_name&&p.last_name&&contactRoleMatches_(p.position||p.position_raw)).slice(0,5).map(p=>({
    lead_id:lead.id,contact_id:Utilities.getUuid(),company:lead.company,domain,name:p.first_name+' '+p.last_name,role:p.position||p.position_raw,
    linkedin:canonicalLinkedIn_(p.linkedin),identity_status:'unconfirmed',email:workEmail_(p.value,domain),
    email_status:data.accept_all?'accept_all':p.verification?.status||'unverified',verified_on:p.verification?.date?contactDate_(p.verification.date)||'':'',verified_email:!data.accept_all&&p.verification?.status==='valid'?workEmail_(p.value,domain):'',
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
  const name=[data.first_name,data.last_name].filter(Boolean).join(' '),email=workEmail_(data.email,contact.domain);
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
function contactCanPublish_(c,now) {
  return c.identity_status==='confirmed'&&!contactSuppressed_(c)&&c.email_status==='valid'&&c.verified_email===c.email&&!!workEmail_(c.email,c.domain)&&recentContactDate_(c.verified_on,prospectConfig_().contacts.verification_days,now);
}
function enrichContact_(contact) {
  const cfg=prospectConfig_().contacts,now=new Date();let c={...contact};
  if(contactSuppressed_(c,savedContacts_())||c.identity_status==='rejected')return {...c,note:'Suppressed or rejected; no lookup.'};
  if(contactCanPublish_(c,now))return c;
  if(!professionalDomain_(c.domain)||!c.name)throw new Error('A reviewed name and business domain are needed.');
  if(c.email&&!workEmail_(c.email,c.domain))throw new Error('Existing email is not at the confirmed business domain; review before verification.');
  if(!c.email)c=finderResult_(hunterRequest_('email-finder',{domain:c.domain,full_name:c.name},1),c);
  if(contactSuppressed_(c,savedContacts_()))return {...c,do_not_contact:'yes',note:'Suppressed during lookup; no further enrichment.'};
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
  const ready=selected.filter(r=>(r.status||'new')==='new'&&professionalDomain_(r.website)&&typeof r.match_pct==='number'&&r.match_pct>=prospectConfig_().cold_min_fit);
  if(!ready.length)return ui.alert('Selected leads need a company website, sufficient fit and new outreach status.');
  if(ui.alert('Find work contacts',ready.length+' companies; up to '+ready.length+' Hunter API credits for one limited domain search each. Results stay unconfirmed until reviewed. No email is sent.',ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
  const tab=contactSheets_().contacts;let existing=contactRows_(tab),done=0;
  const deadline=Date.now()+210000;
  for(const lead of ready) {
    if(Date.now()>deadline)break;
    const prior=existing.filter(c=>c.lead_id===lead.id),store=PropertiesService.getScriptProperties();
    const cacheKey='LH_CONTACT_DISCOVERY_'+contactSuppressionKey_(professionalDomain_(lead.website)+':'+BUSINESS_CONFIG.decision_roles.join('|')).slice(-64);
    if(contactSuppressed_({domain:professionalDomain_(lead.website),name:''},existing)||prior.some(c=>c.do_not_contact==='yes'))continue;
    if(recentContactDate_(store.getProperty(cacheKey),cfg.cache_days)) {
      if(!prior.length)existing.filter(c=>c.domain===professionalDomain_(lead.website)&&c.name&&!contactSuppressed_(c,existing)).slice(0,5).forEach(c=>{
        const copy={...c,lead_id:lead.id,company:lead.company,contact_id:Utilities.getUuid(),identity_status:'unconfirmed',published_email:'',note:'Cached company candidate; confirm relevance to this branch/account.'};
        tab.appendRow(CONTACT_COLS.map(k=>sheetValue_(copy[k]??'')));done++;
      });
      existing=contactRows_(tab);continue;
    }
    if(prior.some(c=>!['pending','error'].includes(c.email_status)&&recentContactDate_(c.checked_on,cfg.cache_days)))continue;
    const before=cellFillHash_(lead);let result;
    try{result=hunterRequest_('domain-search',{domain:professionalDomain_(lead.website),type:'personal',job_titles:BUSINESS_CONFIG.decision_roles.join(','),limit:5},1);}
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
      else if(!c.name)commitContact_(tab,prior,{...prior,email_status:c.email_status,checked_on:c.checked_on,note:c.note,do_not_contact:c.do_not_contact});
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
  const chosen=all.filter(c=>ranges.some(r=>c._r>=r.getRow()&&c._r<=r.getLastRow())&&!sh.isRowHiddenByFilter(c._r));
  if(!chosen.length||chosen.length>cfg.max_rows_per_run)return ui.alert('Select 1–'+cfg.max_rows_per_run+' contacts.');
  if(ui.alert('Find / verify work email','Up to '+chosen.length*1.5+' Hunter credits. Existing fresh valid results are reused. Unknown and catch-all results stay unconfirmed. No email is sent.',ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
  const deadline=Date.now()+210000;
  for(const before of chosen) {
    if(Date.now()>deadline)break;
    let result;try{result=enrichContact_(before);}catch(e){result={...before,note:redactSecretText_(e.message)};}
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
  if(!domain)return ui.alert('Confirm the company website first.');
  const reply=ui.prompt('Add known person at '+lead.company,'Paste one CSV line: full name, role, LinkedIn profile URL (or blank), public evidence URL. Use current company/team evidence. No API call is made.',ui.ButtonSet.OK_CANCEL);
  if(reply.getSelectedButton()!==ui.Button.OK)return;
  const rows=Utilities.parseCsv(reply.getResponseText()),r=rows[0]||[];
  if(rows.length!==1||r.length!==4||contactName_(r[0]).split(' ').length<2||!contactRoleMatches_(r[1])||(r[2]&&!canonicalLinkedIn_(r[2]))||!safePublicUrl_(r[3]))throw new Error('Provide a full name, relevant role, real /in/ profile if available, and public source.');
  const tab=contactSheets_().contacts,c={lead_id:lead.id,contact_id:Utilities.getUuid(),company:lead.company,domain,name:r[0].trim(),role:r[1].trim(),linkedin:canonicalLinkedIn_(r[2]),identity_status:'unconfirmed',email_status:'unverified',source_urls:safePublicUrl_(r[3]),note:'Owner supplied current-role evidence; review identity_status before use.'};
  if(contactRows_(tab).some(x=>x.lead_id===c.lead_id&&contactName_(x.name)===contactName_(c.name)))return ui.alert('This person already exists in Contacts.');
  tab.appendRow(CONTACT_COLS.map(k=>sheetValue_(c[k]??'')));ss.setActiveSheet(tab);
}
function publishVerifiedContacts() {
  reconcilePublishedContacts_();
  const ss=SpreadsheetApp.getActive(),tab=ss.getSheetByName('Contacts'),sh=ss.getSheetByName(TABS.leads);
  if(!tab)throw new Error('Contacts is not set up.');
  const data=leadData_(sh),all=contactRows_(tab);let done=0;
  for(const c of all.filter(v=>contactCanPublish_(v))) {
    const lead=cellFillRow_(data,c.lead_id);if(!lead||(lead.status||'new')!=='new'||professionalDomain_(lead.website)!==c.domain||lead.contact)continue;
    if(!confirmRow_(sh,lead))continue;
    const fresh=cellFillRow_(leadData_(sh),c.lead_id);if(!fresh||cellFillHash_(fresh)!==cellFillHash_(lead))continue;
    const current=contactRows_(tab),currentContact=current.find(v=>v.contact_id===c.contact_id);
    if(!currentContact||contactSnapshot_(currentContact)!==contactSnapshot_(c)||!contactCanPublish_(currentContact)||contactSuppressed_(c,current))continue;
    sh.getRange(leadSheetRow_(fresh._r),LEAD_COLS.indexOf('contact')+1).setValue(sheetValue_(c.email));
    sh.getRange(leadSheetRow_(fresh._r),LEAD_COLS.indexOf('channel')+1).setValue('Email');done++;
    tab.getRange(currentContact._r,17).setValue(sheetValue_(c.email));
  }
  ss.toast('Copied '+done+' verified work emails to empty Lead contacts. Buying readiness is unchanged.');
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
