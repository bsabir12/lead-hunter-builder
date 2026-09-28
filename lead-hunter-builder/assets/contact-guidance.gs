/** Display-only next steps and public contact research. No paid-provider calls. */
function contactGuidance_(row,field,contacts){
  const next=s=>'[Next] '+s,domain=typeof professionalDomain_==='function'?professionalDomain_(row.website||row.domain):hostOf_(row.website||row.domain);
  if(row.do_not_contact==='yes'||row.identity_status==='rejected'||row.phone_status==='do_not_call')return next('Do not contact · review suppression');
  const candidates=(contacts||[]).filter(c=>String(c.lead_id)===String(row.id)&&c.domain===domain&&c.do_not_contact!=='yes'&&c.identity_status!=='rejected');
  if(field==='company')return next('Confirm business from source · manual/free');
  if(!domain)return next('Confirm website first · manual/free');
  if(field==='website')return next('Confirm official website · manual/free');
  if(field==='phone'){
    if(row.pending_request_id)return next('Apollo pending result · check at 0 credits');
    if(row.provider_person_id)return next('Public company pages first · 0 credits; Apollo person phone ≤9 credits');
    return next(row._phoneChecked?'Apollo person phone · up to 9 credits/person; confirm person first':'Public contact pages · 0 credits');
  }
  if(field==='email'){
    if(row.provider_person_id||candidates.some(c=>c.provider_person_id))return next('Apollo work email · up to 1 credit/person; review Contacts');
    if(row.identity_status==='confirmed'&&row.name)return next('Hunter find + verify · up to 1.5 credits/person');
    if(candidates.some(c=>c.identity_status==='confirmed'))return next('Hunter find + verify · up to 1.5 credits/person; review Contacts');
    return next('Public pages first · 0 credits; Apollo search · 0 credits + email up to 1/person');
  }
  if(field==='people')return next(candidates.length?'Review Contacts · 0 credits':'Apollo people search · 0 credits');
  if(field==='linkedin')return next('Confirm public person profile · manual/free');
  return next('Public company socials · manual/free');
}
function publicPhoneNote_(check,found){
  return 'Lead Hunter public phone check | '+check.checked+' | '+(found?'Published on company site; person ownership unconfirmed. Source: '+check.source:check.readable?'No explicit phone in '+check.readable+' readable pages. Apollo person phone is up to 9 credits, requested separately.':'Pages unreadable; no conclusion about phone availability. Check the website manually or request Apollo (up to 9 credits/person).');
}
function guidanceWrites_(sh,column,updates){
  if(!updates.length)return;
  // Re-read once per column: sorting and human replacements since planning win.
  const data=sh.getDataRange().getValues(),isLead=sh.getName()===TABS.leads,header=isLead?LEAD_COLS:CONTACT_COLS;
  const idAt=header.indexOf(isLead?'id':'contact_id'),offset=isLead?LEAD_HEADER_ROW:1;
  const byId=new Map(data.slice(offset).map((r,n)=>[String(r[idAt]||''),{row:n+offset+1,value:r[column-1]??'',values:r}]));
  const safe=updates.map(u=>{const live=byId.get(String(u.id));return live&&String(live.value)===String(u.expected)&&(!u.hash||cellFillHash_(Object.fromEntries(LEAD_COLS.map((c,k)=>[c,live.values[k]])))===u.hash)?{...u,row:live.row}:null;}).filter(Boolean).sort((a,b)=>a.row-b.row);
  for(let i=0;i<safe.length;){let j=i+1;while(j<safe.length&&safe[j].row===safe[j-1].row+1)j++;
    sh.getRange(safe[i].row,column,j-i,1).setValues(safe.slice(i,j).map(u=>[sheetValue_(u.value)]));i=j;}
}
function refreshContactGuidance_(){
  const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(TABS.leads);if(!sh)return 0;
  const data=leadData_(sh),raw=sh.getDataRange().getValues(),tab=ss.getSheetByName('Contacts'),contacts=tab?contactRows_(tab):[];
  const fields=['company','website','contact','people','email','phone'],plans=Object.fromEntries(fields.map(c=>[c,[]]));let changed=0;
  const notes=sh.getRange(LEAD_FIRST_ROW,LEAD_COLS.indexOf('phone')+1,Math.max(1,data.length-1),1).getNotes();
  for(let r=1;r<data.length;r++){
    if(!data[r][idCol_()-1])continue;
    const row=Object.fromEntries(LEAD_COLS.map((c,k)=>[c,data[r][k]]));
    row._phoneChecked=/^Lead Hunter public phone check \|/.test(notes[r-1]?.[0]||'');
    // Preserve original source contacts; copy public emails into their dedicated field.
    const emails=String(row.contact||'').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)||[];
    if(!row.email&&emails.length)row.email=[...new Set(emails)].join(' · ');
    fields.forEach(c=>{const col=LEAD_COLS.indexOf(c),old=raw[leadSheetRow_(r)-1]?.[col]??'';
      if(old&&!/^\[Next\] /.test(String(old)))return;
      const value=row[c]||contactGuidance_(row,c,contacts);if(String(old)!==value){plans[c].push({row:leadSheetRow_(r),id:row.id,expected:old,value,hash:c==='email'&&!/^\[Next\] /.test(value)?cellFillHash_(Object.fromEntries(LEAD_COLS.map((c,k)=>[c,data[r][k]]))):''});changed++;}
    });
  }
  fields.forEach(c=>guidanceWrites_(sh,LEAD_COLS.indexOf(c)+1,plans[c]));
  if(tab){const cc=Object.fromEntries(['email','linkedin','phone'].map(c=>[c,[]])),rawContacts=tab.getDataRange().getValues();
    contacts.forEach(c=>['email','linkedin','phone'].forEach(k=>{const old=rawContacts[c._r-1]?.[CONTACT_COLS.indexOf(k)]??'';if(old&&!/^\[Next\] /.test(String(old)))return;
      const blocked=typeof contactSuppressed_==='function'&&contactSuppressed_(c,contacts);
      const value=c[k]||contactGuidance_(blocked?{...c,do_not_contact:'yes'}:c,k,[]);if(String(old)!==value){cc[k].push({row:c._r,id:c.contact_id,expected:old,value});changed++;}}));
    Object.keys(cc).forEach(c=>guidanceWrites_(tab,CONTACT_COLS.indexOf(c)+1,cc[c]));
  }
  return changed;
}
function refreshContactOptions(){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(TABS.leads),filter=sh.getFilter(),criteria=[];
    if(filter){const top=sh.getRange(sh.getRange(1,1).getValue()==='company'?1:2,1,1,sh.getLastColumn()).getValues()[0];top.forEach((c,k)=>{const v=filter.getColumnFilterCriteria(k+1);if(v)criteria.push({field:c,value:v});});}
    installLeadsLayout_(sh);styleLeads_(sh);criteria.forEach(c=>{const at=LEAD_COLS.indexOf(c.field);if(at>=0)sh.getFilter().setColumnFilterCriteria(at+1,c.value);});
    contactSheets_();const n=refreshContactGuidance_();refreshProgress_();SpreadsheetApp.flush();ss.toast('Email / phone columns ready; '+n+' contact options updated. No provider credits used.');}
  finally{lock.releaseLock();}
}
function findPublicPhonesForIds_(ids,deadline){
  const sh=SpreadsheetApp.getActive().getSheetByName(TABS.leads);let found=0,checked=0;
  for(const id of [...new Set(ids)]){
    if(Date.now()>deadline-15000)break;
    const row=cellFillRow_(leadData_(sh),id);if(!row||row.phone||!siteUrl_(row.website))continue;
    const before=cellFillHash_(row),result=findContactsFree_(row.website,deadline),live=cellFillRow_(leadData_(sh),id);
    if(!live||cellFillHash_(live)!==before)continue;
    applyPublicPhoneResult_(live,result);checked++;
    const cell=sh.getRange(leadSheetRow_(live._r),LEAD_COLS.indexOf('phone')+1);
    if(live.phone){cell.setValue(sheetValue_(live.phone));found++;}
    cell.setNote(publicPhoneNote_(live._publicPhoneCheck,!!live.phone));
  }
  return {found,checked};
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
    const cell=sh.getRange(leadSheetRow_(lead._r),LEAD_COLS.indexOf('phone')+1);cell.setValue(sheetValue_('Person: '+c.phone));cell.setNote('Apollo · '+c.name+' · '+c.phone_type+' · Checked '+String(c.phone_checked_on));done++;}
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
