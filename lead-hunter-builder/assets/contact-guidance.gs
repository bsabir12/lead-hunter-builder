/** Remaining actions plus bounded automatic zero-credit contact research. */
function contactGuidanceCapabilities_(){
  const assisted=BUSINESS_CONFIG.mode==='assisted',props=PropertiesService.getScriptProperties(),config=prospectConfig_().contacts;
  return {automaticPublic:assisted,hunter:assisted&&config.provider==='hunter'&&config.monthly_credits>0&&!!props.getProperty('HUNTER_KEY'),
    apollo:assisted&&!!props.getProperty('APOLLO_KEY')&&apolloMonthlyLimit_()>0};
}
function contactGuidance_(row,field,contacts){
  const next=s=>'[Next] '+s,working=s=>'[Working] '+s,domain=typeof professionalDomain_==='function'?professionalDomain_(row.website||row.domain):hostOf_(row.website||row.domain);
  if(row.do_not_contact==='yes'||row.identity_status==='rejected'||row.phone_status==='do_not_call')return next('Do not contact · review suppression');
  if(row._linkedLeadMissing)return next('Linked lead unavailable · owner review');
  if(row._contactDomainMismatch)return next('Review contact company and domain against current lead · owner review');
  const candidates=(contacts||[]).filter(c=>String(c.lead_id)===String(row.id)&&c.domain===domain&&c.do_not_contact!=='yes'&&c.identity_status!=='rejected');
  if(field==='company')return next('Confirm business from source · owner review');
  if(!domain)return next('Confirm official website · owner review');
  if(field==='website')return next('Confirm official website · owner review');
  const capabilities=contactGuidanceCapabilities_(),owner=()=>next('Review official company page or contact record · owner review');
  if(String(row.status||'new').trim().toLowerCase()!=='new')return next(field==='email'?'Review work email in existing conversation · owner review':field==='phone'?'Review phone in existing conversation · owner review':'Review current company and contact in existing conversation · owner review');
  if(row._leadWebsiteUnconfirmed||row.id&&!row._websiteConfirmed)return capabilities.automaticPublic?next('Confirm website identity via Fill selected cells · owner review'):next('Confirm official company website and contacts · owner review');
  if((row.contact_id||row.name)&&!row._identityConfirmed)return next('Confirm selected identity evidence in Contacts · owner review');
  if(row._publicFailed)return next('Public pages incomplete · review website or retry selected free check · owner review');
  if(row._publicRetry)return capabilities.automaticPublic?working('Public pages incomplete · retry queued'):owner();
  if(field==='phone'){
    if(row.pending_request_id&&!row._identityConfirmed)return next('Confirm current person company and role in Contacts · owner review');
    if(row.pending_request_id&&capabilities.automaticPublic)return working('Apollo phone result · automatic');
    if(row.id&&!row._publicChecked&&capabilities.automaticPublic)return working('Public pages · automatic');
    if(capabilities.apollo&&(row.provider_person_id||candidates.some(c=>c.provider_person_id)))return next('Apollo Person Phone · up to 9 credits/person');
    return owner();
  }
  if(field==='email'){
    if(row.id&&!row._publicChecked&&capabilities.automaticPublic)return working('Public pages · automatic');
    if(capabilities.apollo&&(row.provider_person_id||candidates.some(c=>c.provider_person_id)))return next('Apollo Work Email · up to 1 credit/person');
    if(capabilities.hunter&&row._identityConfirmed&&row.name)return next('Hunter Email Finder + Verifier · up to 1.5 credits/person');
    if(capabilities.hunter&&candidates.some(c=>contactIdentityConfirmed_(c)))return next('Hunter Email Finder + Verifier · up to 1.5 credits/person');
    if(capabilities.automaticPublic&&row._publicChecked&&['unknown','available'].includes(row._apolloSearchState))return working('Apollo People Search · automatic');
    return capabilities.hunter?next('Hunter Domain Search · up to 1 credit/company'):owner();
  }
  if(field==='people'){
    if(candidates.length)return next('Review people in Contacts · owner review');
    if(row.id&&!row._publicChecked&&capabilities.automaticPublic)return working('Public pages · automatic');
    if(capabilities.automaticPublic&&row._publicChecked&&['unknown','available'].includes(row._apolloSearchState))return working('Apollo People Search · automatic');
    return capabilities.hunter?next('Hunter Domain Search · up to 1 credit/company'):owner();
  }
  if(field==='linkedin')return next('Confirm LinkedIn profile · owner review');
  return next('Confirm public company channel · owner review');
}
function publicPhoneNote_(check,found){
  return 'Lead Hunter public phone check | '+check.checked+' | '+(found?'Published on company site; person ownership unconfirmed. Source: '+check.source:check.readable?'No explicit phone in '+check.readable+' readable pages. Apollo person phone is up to 9 credits, requested separately.':'Pages unreadable; no conclusion about phone availability. Check the website manually or request Apollo (up to 9 credits/person).');
}
function publicContactReceipt_(row,note){
 const site=String(siteUrl_(row.website)||'').replace(/\/$/,''),identity=websiteIdentitySignature_(row),key=row.id?'LH_PUBLIC_CONTACT_V3_'+discoveryHash_(String(row.id)+'|'+site).slice(0,32):'';let receipt=null;
 try{receipt=key?JSON.parse(PropertiesService.getScriptProperties().getProperty(key)||'null'):null;}catch(e){}
 if(!receipt||receipt.version!==3||receipt.identity!==identity||receipt.site!==site||!['complete','pending','error'].includes(receipt.state)||!Number.isFinite(receipt.checked)||receipt.checked>Date.now()||Date.now()-receipt.checked>30*864e5)return {key,site,identity,state:'new',attempts:0};
 receipt.key=key;
 return receipt;
}
function publicContactNote_(prior,text){
 const owned=/\[LH public contact v2\][\s\S]*?\[\/LH public contact v2\]/g;
 const owner=String(prior||'').replace(owned,'').split('\n').filter(line=>!/^Lead Hunter public (?:contact|phone) check \|/.test(line)).join('\n').trim();
 return (owner?owner+'\n\n':'')+'[LH public contact v2]\n'+text+'\n[/LH public contact v2]';
}
function guidanceWrites_(sh,column,updates){
  if(!updates.length)return;
  // Re-read once per column: sorting and human replacements since planning win.
  const data=sh.getDataRange().getValues(),isLead=sh.getName()===TABS.leads,header=isLead?leadLayout_(sh,data).headers:CONTACT_COLS;
  const idAt=header.indexOf(isLead?'id':'contact_id'),offset=isLead?LEAD_HEADER_ROW:1;
  const byId=new Map(data.slice(offset).map((r,n)=>[String(r[idAt]||''),{row:n+offset+1,value:r[column-1]??'',values:r}]));
  const safe=updates.map(u=>{if(!u.field||header[column-1]!==u.field)return null;const live=byId.get(String(u.id));return live&&String(live.value)===String(u.expected)&&(!u.hash||cellFillHash_(Object.fromEntries(LEAD_COLS.map((c,k)=>[c,live.values[header.indexOf(c)]])))===u.hash)?{...u,row:live.row}:null;}).filter(Boolean).sort((a,b)=>a.row-b.row);
  for(let i=0;i<safe.length;){let j=i+1;while(j<safe.length&&safe[j].row===safe[j-1].row+1)j++;
    sh.getRange(safe[i].row,column,j-i,1).setValues(safe.slice(i,j).map(u=>[sheetValue_(u.value)]));i=j;}
}
function refreshContactGuidance_(){
  const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(TABS.leads);if(!sh)return 0;
  const data=leadData_(sh),raw=sh.getDataRange().getValues(),tab=ss.getSheetByName('Contacts'),contacts=tab?contactRows_(tab):[];
  const fields=['company','website','contact','people','email','phone'],plans=Object.fromEntries(fields.map(c=>[c,[]]));let changed=0;
  const notes=sh.getRange(LEAD_FIRST_ROW,leadCol_(sh,'phone'),Math.max(1,data.length-1),1).getNotes();
  for(let r=1;r<data.length;r++){
    if(!data[r][idCol_()-1])continue;
    const row=Object.fromEntries(LEAD_COLS.map((c,k)=>[c,data[r][k]]));
    row._websiteConfirmed=websiteIdentityConfirmed_(row);
    const publicState=publicContactReceipt_(row,notes[r-1]?.[0]);
    row._publicChecked=publicState.state==='complete';row._publicFailed=publicState.state==='error';row._publicRetry=publicState.state==='pending';
    row._phoneChecked=row._publicChecked;
    row._apolloSearchState=typeof apolloSearchStateForLead_==='function'?apolloSearchStateForLead_(row):'unavailable';
    // Preserve original source contacts; copy public emails into their dedicated field.
    const emails=String(row.contact||'').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)||[];
    if(!row.email&&emails.length)row.email=[...new Set(emails)].join(' · ');
    fields.forEach(c=>{const col=leadCol_(sh,c)-1,old=raw[leadSheetRow_(r)-1]?.[col]??'';
      if(old&&!/^\[(?:Next|Working)\] /.test(String(old)))return;
      const value=row[c]||contactGuidance_(row,c,contacts);if(String(old)!==value){plans[c].push({row:leadSheetRow_(r),id:row.id,expected:old,value,field:c,hash:c==='email'&&!/^\[(?:Next|Working)\] /.test(value)?cellFillHash_(Object.fromEntries(LEAD_COLS.map((c,k)=>[c,data[r][k]]))):''});changed++;}
    });
  }
  fields.forEach(c=>guidanceWrites_(sh,leadCol_(sh,c),plans[c]));
  if(tab){const cc=Object.fromEntries(['email','linkedin','phone'].map(c=>[c,[]])),rawContacts=tab.getDataRange().getValues(),linkedLeads=new Map(data.slice(1).map(values=>{const lead=Object.fromEntries(LEAD_COLS.map((c,k)=>[c,values[k]]));return [String(lead.id),{...lead,confirmed:websiteIdentityConfirmed_(lead)}];}));
    contacts.forEach(c=>['email','linkedin','phone'].forEach(k=>{const old=rawContacts[c._r-1]?.[CONTACT_COLS.indexOf(k)]??'';if(old&&!/^\[(?:Next|Working)\] /.test(String(old)))return;
      const blocked=typeof contactSuppressed_==='function'&&contactSuppressed_(c,contacts);
      const linked=linkedLeads.get(String(c.lead_id)),value=c[k]||contactGuidance_({...c,status:linked?.status||'new',_linkedLeadMissing:!linked,_contactDomainMismatch:!!linked&&professionalDomain_(linked.website)!==c.domain,_leadWebsiteUnconfirmed:!linked?.confirmed,_identityConfirmed:!!linked&&contactIdentityConfirmed_(c,linked),...(blocked?{do_not_contact:'yes'}:{})},k,[]);if(String(old)!==value){cc[k].push({row:c._r,id:c.contact_id,expected:old,value,field:k});changed++;}}));
    Object.keys(cc).forEach(c=>guidanceWrites_(tab,CONTACT_COLS.indexOf(c)+1,cc[c]));
  }
  return changed;
}
function refreshContactOptions(){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(TABS.leads),filter=sh.getFilter(),criteria=[];
    if(filter){const top=sh.getRange(sh.getRange(1,1).getValue()==='company'?1:2,1,1,sh.getLastColumn()).getValues()[0];top.forEach((c,k)=>{const v=filter.getColumnFilterCriteria(k+1);if(v)criteria.push({field:c,value:v});});}
    installLeadsLayout_(sh);styleLeads_(sh);criteria.forEach(c=>{const at=leadLayout_(sh).headers.indexOf(c.field);if(at>=0)sh.getFilter().setColumnFilterCriteria(at+1,c.value);});
    contactSheets_();const n=refreshContactGuidance_();if(automaticFreeContactWorkLeft_())ensureWorker_();refreshProgress_();SpreadsheetApp.flush();ss.toast('Email / phone columns ready; '+n+' contact options updated. Free checks continue automatically; paid tools still require selection and approval.');}
  finally{lock.releaseLock();}
}
function findPublicPhonesForIds_(ids,deadline){
  return findPublicContactsForIds_(ids,deadline);
}
function findPublicContactsForIds_(ids,deadline){
  const sh=SpreadsheetApp.getActive().getSheetByName(TABS.leads);let found=0,checked=0;
  for(const id of [...new Set(ids)]){
    if(Date.now()>deadline-15000)break;
    const row=cellFillRow_(leadData_(sh),id);if(!row||!websiteIdentityConfirmed_(row))continue;
    const before=cellFillHash_(row),result=findContactsFree_(row.website,deadline),live=cellFillRow_(leadData_(sh),id);
    if(!live||cellFillHash_(live)!==before||!websiteIdentityConfirmed_(live))continue;
    const priorNote=sh.getRange(leadSheetRow_(live._r),leadCol_(sh,'phone')).getNote(),prior=publicContactReceipt_(live,priorNote),stamp=new Date().toISOString();
    const complete=result.readable>0&&!result.incomplete,attempts=(Number(prior.attempts)||0)+1;
    const receipt={version:3,site:prior.site,identity:websiteIdentitySignature_(live),state:complete?'complete':attempts>=3?'error':'pending',attempts,checked:Date.now(),retry_after:complete?0:Date.now()+5*60e3,emailEvidenceVersion:1,emailCandidates:result.emailCandidates||[]};
    const note='Lead Hunter public contact check | '+stamp+' | '+(result.readable?result.readable+' official-site pages read; person ownership unconfirmed.':'Pages unreadable; no conclusion about contact availability.')+(!complete?' Partial check; missing contacts remain unknown.':'');checked++;
    if(!live.email&&result.emails?.length){applyPublicEmailResult_(live,result);const cell=sh.getRange(leadSheetRow_(live._r),leadCol_(sh,'email'));cell.setValue(sheetValue_(live.email));writePublicEmailNote_(cell,live._publicEmailCheck);found++;}
    if(!live.contact&&result.socials?.length)sh.getRange(leadSheetRow_(live._r),leadCol_(sh,'contact')).setValue(sheetValue_(result.socials.join(' · ')));
    if(!live.phone){applyPublicPhoneResult_(live,result);if(live.phone){sh.getRange(leadSheetRow_(live._r),leadCol_(sh,'phone')).setValue(sheetValue_(live.phone));found++;}}
    if(prior.key)PropertiesService.getScriptProperties().setProperty(prior.key,JSON.stringify(receipt));
    ['email','phone'].forEach(field=>{const cell=sh.getRange(leadSheetRow_(live._r),leadCol_(sh,field));cell.setNote(publicContactNote_(cell.getNote(),note+(live._publicPhoneCheck?.source?' Source: '+live._publicPhoneCheck.source:'')));});
  }
  return {found,checked};
}
function automaticFreeContactIds_(limit,includePending){
  if(BUSINESS_CONFIG.mode!=='assisted')return [];
  const sh=SpreadsheetApp.getActive().getSheetByName(TABS.leads),data=leadData_(sh),notes=sh.getRange(LEAD_FIRST_ROW,leadCol_(sh,'phone'),Math.max(1,data.length-1),1).getNotes(),ids=[];
  const cap=limit===undefined?3:limit;
  for(let r=1;r<data.length&&ids.length<cap;r++){
    const row=Object.fromEntries(LEAD_COLS.map((c,k)=>[c,data[r][k]]));
    const receipt=publicContactReceipt_(row,notes[r-1]?.[0]);
    if(row.id&&(row.status||'new')==='new'&&websiteIdentityConfirmed_(row)&&(!row.email||!row.phone)&&!['complete','error'].includes(receipt.state)&&(includePending||!receipt.retry_after||Date.now()>=receipt.retry_after))ids.push(row.id);
  }
  return ids;
}
function automaticFreeContactCount_(){return automaticFreeContactIds_(Number.MAX_SAFE_INTEGER,true).length;}
function publicContactCheckedIds_(){
  const sh=SpreadsheetApp.getActive().getSheetByName(TABS.leads),data=leadData_(sh),notes=sh.getRange(LEAD_FIRST_ROW,leadCol_(sh,'phone'),Math.max(1,data.length-1),1).getNotes(),ids=new Set();
  for(let r=1;r<data.length;r++){const row=Object.fromEntries(LEAD_COLS.map((c,k)=>[c,data[r][k]]));if(websiteIdentityConfirmed_(row)&&publicContactReceipt_(row,notes[r-1]?.[0]).state==='complete')ids.add(String(row.id||''));}
  return ids;
}
function automaticFreeContactWork_(deadline){
  if(BUSINESS_CONFIG.mode!=='assisted')return {publicResult:{found:0,checked:0},apolloResult:{checked:0,added:0},polls:0};
  const ids=automaticFreeContactIds_(3),publicResult=ids.length?findPublicContactsForIds_(ids,deadline):{found:0,checked:0};
  const apolloResult=Date.now()<deadline-20000&&typeof automaticApolloPeopleSearch_==='function'?automaticApolloPeopleSearch_(deadline,3):{checked:0,added:0};
  const polls=Date.now()<deadline-15000&&typeof pollApolloPhonesAutomatic_==='function'?pollApolloPhonesAutomatic_(deadline,10):0;
  return {publicResult,apolloResult,polls};
}
function automaticFreeContactWorkLeft_(){
  if(BUSINESS_CONFIG.mode!=='assisted')return false;
  if(automaticFreeContactIds_(1,true).length)return true;
  return (typeof automaticApolloPeopleWorkLeft_==='function'&&automaticApolloPeopleWorkLeft_())||(typeof pendingApolloPhoneCount_==='function'&&pendingApolloPhoneCount_()>0);
}
function findPublicPhonesSelected(){
  const ss=SpreadsheetApp.getActive(),sh=ss.getActiveSheet(),ui=SpreadsheetApp.getUi();if(sh.getName()!==TABS.leads)return ui.alert('Select rows in Leads first.');
  const ranges=sh.getActiveRangeList()?.getRanges()||[sh.getActiveRange()],chosen=selectedCellFields_(leadData_(sh),ranges,r=>sh.isRowHiddenByFilter(r));
  if(!chosen.length||chosen.length>5)return ui.alert('Select 1–5 leads. Skipped leads are allowed; a confirmed website is required.');
  const result=findPublicPhonesForIds_(chosen.map(c=>c.id),Date.now()+210000);refreshContactGuidance_();
  ss.toast('Public phone check: '+result.found+' found / '+result.checked+' checked. No provider credits used. Hover over phone for source or result.');
}
function publishVerifiedPhones(){
  const ss=SpreadsheetApp.getActive(),tab=ss.getActiveSheet(),sh=ss.getSheetByName(TABS.leads),ui=SpreadsheetApp.getUi();if(tab.getName()!=='Contacts')return ui.alert('Select confirmed people in Contacts first.');
  const selected=selectedApolloContacts_(tab,true).filter(c=>c.phone_status==='valid'&&safePhone_(c.phone)&&recentContactDate_(c.phone_checked_on,30));if(!selected.length||selected.length>5)return ui.alert('Select 1–5 confirmed contacts with a valid phone result checked within 30 days.');
  let done=0;for(const c of selected){const lead=cellFillRow_(leadData_(sh),c.lead_id);if(!lead||lead.phone)continue;
    const cell=sh.getRange(leadSheetRow_(lead._r),leadCol_(sh,'phone'));cell.setValue(sheetValue_('Person: '+c.phone));cell.setNote('Apollo · '+c.name+' · '+c.phone_type+' · Checked '+String(c.phone_checked_on));done++;}
  refreshContactGuidance_();ss.toast('Copied '+done+' valid person phones into empty Leads phone fields. Public company numbers were preserved.');
}
/** Native fixtures only: zero requests, temporary tab deleted in finally. */
function testContactOptions(){
  const check=(v,label)=>{if(!v)throw new Error(label);};check(leadFieldValue_('phone','[Next] tool')==='','guidance is not data');
  check(cellFillHash_({id:'a',email:''})===cellFillHash_({id:'a',email:'[Next] tool'}),'guidance hash');
  check(publicPhonesFromHtml_('<a href="tel:+1-415-555-0123">Call</a>')[0]==='+14155550123','public phone');check(!publicPhonesFromHtml_('price 99999999').length,'no invented number');
  const ss=SpreadsheetApp.getActive(),name='__contact_options_'+Utilities.getUuid().slice(0,8);let sh;
  try{sh=ss.insertSheet(name);const old=LEAD_COLS.filter(c=>!['email','phone'].includes(c));sh.getRange(2,1,1,old.length).setValues([old]);
    const fixture={id:'fixture',company:'Example',contact:'@owner',website:'https://example.com',added:new Date()};sh.getRange(3,1,1,old.length).setValues([old.map(c=>fixture[c]??'')]);
    installLeadsLayout_(sh);const r=cellFillRow_(leadData_(sh),'fixture');check(r.contact==='@owner'&&!r.email&&!r.phone,'migration keeps original contact');
    installLeadsLayout_(sh);check(cellFillRow_(leadData_(sh),'fixture').contact==='@owner','repeat migration');
    console.log('PASS: email/phone migration, repeat migration, source contact preservation, guidance semantics and explicit public phone extraction. No provider calls.');
  }finally{if(sh)ss.deleteSheet(sh);}
}
