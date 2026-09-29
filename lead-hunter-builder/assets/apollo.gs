/**
 * On-demand Apollo integration. Every network request is caused by an explicit
 * menu action on selected rows. The key is stored in Script Properties and is
 * sent only in the x-api-key header. Waterfalls and personal-email reveal are
 * intentionally unavailable.
 * Health confirms authentication; individual endpoint access depends on the account.
 */
const APOLLO_DEFAULT_MONTHLY_LIMIT=0;
const APOLLO_LIMIT_KEY='LH_APOLLO_MONTHLY_LIMIT';
const APOLLO_BUDGET_KEY='LH_APOLLO_CREDIT_BUDGET';
const APOLLO_SEARCH_ACCESS_KEY='LH_APOLLO_SEARCH_ACCESS';
let APOLLO_APPROVAL=null;

function setApolloKey(){askSecret_('APOLLO_KEY','Apollo API key','Paste your Apollo key. It stays in this project’s Script Properties and is sent only in the x-api-key header. Saving it makes no API call.');}
function apolloMonthlyLimit_(){
 const raw=PropertiesService.getScriptProperties().getProperty(APOLLO_LIMIT_KEY);
 if(raw===null||raw==='')return APOLLO_DEFAULT_MONTHLY_LIMIT;
 const n=Number(raw);if(!Number.isInteger(n)||n<0||n>10000)throw new Error('Apollo monthly limit is invalid; enter 0–10000 whole credits.');return n;
}
function setApolloMonthlyLimit(){
 const ui=SpreadsheetApp.getUi(),prior=apolloMonthlyLimit_(),r=ui.prompt('Apollo monthly credit limit','Current: '+prior+'. Enter a whole number. Use 0 to disable paid Apollo enrichment. Zero-credit people search runs automatically only when your Apollo plan supports its API endpoint.',ui.ButtonSet.OK_CANCEL);
 if(r.getSelectedButton()!==ui.Button.OK)return;
 const n=Number(String(r.getResponseText()).trim());if(!Number.isInteger(n)||n<0||n>10000)return ui.alert('Enter a whole number from 0 to 10000.');
 PropertiesService.getScriptProperties().setProperty(APOLLO_LIMIT_KEY,String(n));showApolloStatus();
}
function apolloBudgetState_(store,month){
 const raw=store.getProperty(APOLLO_BUDGET_KEY);if(!raw)return {month,reserved:0};
 let s;try{s=JSON.parse(raw);}catch(e){throw new Error('Apollo credit ledger is unreadable; reconcile before retrying.');}
 if(typeof s.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month)||typeof s.reserved!=='number'||!Number.isFinite(s.reserved)||s.reserved<0)throw new Error('Apollo credit ledger is invalid.');
 return s.month===month?s:{month,reserved:0};
}
function apolloBudgetView_(){
 const p=PropertiesService.getScriptProperties(),month=Utilities.formatDate(new Date(),'UTC','yyyy-MM'),s=apolloBudgetState_(p,month),limit=apolloMonthlyLimit_();
 return {month,limit,reserved:s.reserved,remaining:Math.max(0,limit-s.reserved),connected:!!p.getProperty('APOLLO_KEY')};
}
function reserveApolloCredits_(amount,store,month){
 const s=apolloReserveState_(apolloBudgetState_(store,month),amount,apolloMonthlyLimit_());store.setProperty(APOLLO_BUDGET_KEY,JSON.stringify(s));return s;
}
function apolloReserveState_(state,amount,limit){
 if(!Number.isInteger(amount)||amount<=0||limit<=0||state.reserved+amount>limit)throw new Error('Apollo monthly credit limit reached; no request made.');
 return {...state,reserved:state.reserved+amount};
}
function apolloQuery_(params){
 const parts=[];Object.entries(params||{}).forEach(([k,v])=>(Array.isArray(v)?v:[v]).forEach(x=>{if(x!==''&&x!==null&&x!==undefined)parts.push(encodeURIComponent(k)+'='+encodeURIComponent(String(x)));}));
 return parts.length?'?'+parts.join('&'):'';
}
function apolloKeyFingerprint_(){
 const key=String(PropertiesService.getScriptProperties().getProperty('APOLLO_KEY')||'');if(!key)return '';
 return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,key,Utilities.Charset.UTF_8).slice(0,8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function apolloSearchAccess_(){
 const fingerprint=apolloKeyFingerprint_();if(!fingerprint)return 'disconnected';
 let saved={};try{saved=JSON.parse(PropertiesService.getScriptProperties().getProperty(APOLLO_SEARCH_ACCESS_KEY)||'{}');}catch(e){}
 return saved.fingerprint===fingerprint&&['available','denied'].includes(saved.state)?saved.state:'unknown';
}
function rememberApolloSearchAccess_(state){
 if(!['available','denied'].includes(state))throw new Error('Invalid Apollo search-access state.');
 PropertiesService.getScriptProperties().setProperty(APOLLO_SEARCH_ACCESS_KEY,JSON.stringify({fingerprint:apolloKeyFingerprint_(),state,checked:new Date().toISOString()}));
}
function apolloSearchAttemptKey_(lead){
 const value=String(lead.id)+'|'+professionalDomain_(lead.website||lead.domain);
 return 'LH_APOLLO_SEARCHED_'+Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).slice(0,12).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function apolloSearchStateForLead_(lead){
 if(PropertiesService.getScriptProperties().getProperty(apolloSearchAttemptKey_(lead)))return 'done';
 return apolloSearchAccess_();
}
function apolloFetch_(path,method,params){
 if(!/^(?:auth\/health|usage_stats\/credit_usage_stats|mixed_people\/api_search|people\/match|webhook_result\/-?\d+)$/.test(path))throw new Error('Unsupported Apollo endpoint.');
 const key=PropertiesService.getScriptProperties().getProperty('APOLLO_KEY');if(!key)throw new Error('Connect Apollo using Settings → Connections → Apollo API key.');
 const url='https://api.apollo.io/api/v1/'+path+apolloQuery_(params);
 if(url.includes(key)||/[?&](?:api[_-]?key|token)=/i.test(url))throw new Error('Apollo credential must never appear in a URL.');
 try{return UrlFetchApp.fetch(url,{method:method||'get',headers:{'x-api-key':key,accept:'application/json','Cache-Control':'no-cache'},contentType:'application/json',muteHttpExceptions:true,followRedirects:false});}
 catch(e){throw new Error('Apollo connection failed; no automatic retry.');}
}
function apolloJson_(res,label,allowed){
 const status=res.getResponseCode();let body={};try{body=JSON.parse(res.getContentText()||'{}');}catch(e){throw new Error('Apollo '+label+' response was unreadable.');}
 if(!(allowed||[200]).includes(status))throw new Error('Apollo '+label+' failed (HTTP '+status+'). '+redactSecretText_(String(body.error_message||body.message||body.error||'No automatic retry.')));
 return {status,body};
}
function apolloHealth_(){
 const x=apolloJson_(apolloFetch_('auth/health','get'),'connection',[200]).body;
 if(x.healthy!==true||x.is_logged_in!==true)throw new Error('Apollo key is not healthy or logged in.');return true;
}
/** Safe diagnostic: no key value, raw response, person data or paid endpoint is logged. */
function checkApolloConnection(){
 const key=String(PropertiesService.getScriptProperties().getProperty('APOLLO_KEY')||'');
 const format={saved:!!key,containsWhitespace:/\s/.test(key),looksLikeUrl:/^https?:/i.test(key),wrappedInQuotes:/^["']|["']$/.test(key)};
 const res=apolloFetch_('auth/health','get'),body=apolloJson_(res,'connection',[200]).body;
 console.log(JSON.stringify({http_status:res.getResponseCode(),healthy:body.healthy===true,is_logged_in:body.is_logged_in===true,key_format:format}));
}
function apolloCreditStats_(){
 const x=apolloJson_(apolloFetch_('usage_stats/credit_usage_stats','post'),'credit balance',[200]).body;
 const stats=x.credit_usage_stats;
 if(!stats||typeof stats!=='object')throw new Error('Apollo credit balance schema was unavailable.');
 const read=k=>{const v=stats[k];return v&&Number.isFinite(Number(v.limit))&&Number.isFinite(Number(v.left_over))?{limit:Number(v.limit),remaining:Number(v.left_over)}:null;};
 const lead=read('lead_credit'),phone=read('direct_dial_credit');if(!lead)throw new Error('Apollo lead-credit balance was unavailable.');
 return {lead,phone,cycle:x.current_credit_cycle||{}};
}
function showApolloStatus(){
 const ui=SpreadsheetApp.getUi(),s=apolloBudgetView_();let account='Not connected. Add your key in Settings → Connections.';
 if(s.connected){try{apolloHealth_();const a=apolloCreditStats_();account='Apollo lead credits: '+a.lead.remaining+' / '+a.lead.limit+' remaining'+(a.phone?' · direct-dial credits: '+a.phone.remaining+' / '+a.phone.limit:'')+'\nBilling cycle ends: '+String(a.cycle.end_date||'see Apollo');}catch(e){account=redactSecretText_(e.message)+' Paid enrichment stays blocked until balances are readable.';}}
 const access=apolloSearchAccess_(),search=access==='denied'?'People Search API: unavailable on this saved key/plan':access==='disconnected'?'People Search API: not connected':'People Search API: '+access+'; automatic when eligible (0 credits)';
 ui.alert('Apollo — selected rows only','Monthly sheet limit: '+s.limit+' credits (UTC calendar month)\nReserved / used here: '+s.reserved+'\nRemaining here: '+s.remaining+'\n'+account+'\n'+search+'\n\nWork email is up to 1 credit/person. Phone is up to 9 credits/person. No waterfalls, personal-email reveal, schedules or outreach.',ui.ButtonSet.OK);
}
function apolloProviderAllows_(operation,max,stats){
 if(operation==='email')return stats.lead.remaining>=max;
 if(operation==='phone'){
   const rows=max/9;if(!Number.isInteger(rows))return false;
   return stats.phone&&stats.phone.limit>0?stats.lead.remaining>=rows&&stats.phone.remaining>=rows*8:stats.lead.remaining>=max;
 }
 return true;
}
function approveApollo_(title,labels,operation,max,scope){
 const ui=SpreadsheetApp.getUi(),s=apolloBudgetView_();if(!s.connected){showApolloStatus();return false;}
 try{apolloHealth_();}catch(e){ui.alert(redactSecretText_(e.message));return false;}
 let balance='People search: 0 credits';
 if(max>0){
   let stats;try{stats=apolloCreditStats_();}catch(e){ui.alert(redactSecretText_(e.message)+' No paid request started.');return false;}
   if(max>s.remaining||!apolloProviderAllows_(operation,max,stats)){ui.alert('Apollo limit','This selection may need '+max+' credits, but the sheet or Apollo balance is lower. Select fewer rows or review Credits & connection. No request started.',ui.ButtonSet.OK);return false;}
   balance='Sheet remaining: '+s.remaining+' · Apollo lead credits: '+stats.lead.remaining+(stats.phone?' · direct-dial: '+stats.phone.remaining:'');
 }
 const msg=labels.join('\n')+'\n\n'+balance+'\nThis request: up to '+max+' credits. Credits are reserved before each paid call and may exceed the final charge after failures.\n\nContinue for these selected rows only? No message will be sent.';
 if(ui.alert(title,msg,ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return false;
 APOLLO_APPROVAL={operation,domains:scope.domains||[],contacts:scope.contacts||[],remaining:max,until:Date.now()+240000};return true;
}
function assertApolloApproval_(operation,subject,cost){
 const a=APOLLO_APPROVAL;if(!a||a.operation!==operation||Date.now()>a.until||cost>a.remaining)throw new Error('Apollo requires a fresh selected-row confirmation; background calls are disabled.');
 const allowed=operation==='search'?a.domains.includes(subject):a.contacts.includes(subject);if(!allowed)throw new Error('This row was not included in the Apollo confirmation.');
}
function apolloRequest_(operation,subject,path,method,params,cost){
 assertApolloApproval_(operation,subject,cost);
 const store=PropertiesService.getScriptProperties(),lease='LH_APOLLO_REQUEST_'+Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify([operation,subject,path,params]),Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
 if(cost>0){
   const stats=apolloCreditStats_();if(!apolloProviderAllows_(operation,cost,stats))throw new Error('Apollo account credits are insufficient; no enrichment started.');
   const lock=LockService.getScriptLock();lock.waitLock(5000);
   try{
     const prior=store.getProperty(lease);if(prior&&(!Number.isFinite(Number(prior))||Date.now()-Number(prior)<30*60e3))throw new Error('This Apollo request is already running or was interrupted; wait 30 minutes before manually retrying.');
     store.setProperty(lease,String(Date.now()));
     try{reserveApolloCredits_(cost,store,Utilities.formatDate(new Date(),'UTC','yyyy-MM'));APOLLO_APPROVAL.remaining-=cost;}catch(e){store.deleteProperty(lease);throw e;}
   }finally{lock.releaseLock();}
 }
 const out=apolloJson_(apolloFetch_(path,method,params),operation,[200,202]);if(cost>0)store.deleteProperty(lease);return out.body;
}
function apolloFreePeopleRequest_(lead){
 const access=apolloSearchAccess_();if(['disconnected','denied'].includes(access))return {state:access,people:[]};
 const domain=professionalDomain_(lead.website),payload={'q_organization_domains_list[]':[domain],'person_seniorities[]':['owner','founder','c_suite','vp','head','director'],'person_titles[]':HUNTER_ROLES,include_similar_titles:false,page:1,per_page:5};
 const res=apolloFetch_('mixed_people/api_search','post',payload),status=res.getResponseCode();
 if(status===401||status===403){rememberApolloSearchAccess_('denied');return {state:'denied',people:[]};}
 const parsed=apolloJson_(res,'people search',[200]);rememberApolloSearchAccess_('available');return {state:'available',people:Array.isArray(parsed.body.people)?parsed.body.people:[]};
}
function automaticApolloPeopleWorkLeft_(){
 if(!['unknown','available'].includes(apolloSearchAccess_()))return false;
 const sh=SpreadsheetApp.getActive().getSheetByName(TABS.leads),contacts=contactRows_(contactSheets_().contacts),publicDone=publicContactCheckedIds_();
 return leadData_(sh).slice(1).some(values=>{const row=Object.fromEntries(LEAD_COLS.map((c,k)=>[c,values[k]]));return row.id&&publicDone.has(String(row.id))&&(row.status||'new')==='new'&&professionalDomain_(row.website)&&!contacts.some(c=>c.lead_id===row.id&&c.name)&&!PropertiesService.getScriptProperties().getProperty(apolloSearchAttemptKey_(row));});
}
function automaticApolloPeopleSearch_(deadline,limit){
 if(!['unknown','available'].includes(apolloSearchAccess_()))return {checked:0,added:0};
 const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(TABS.leads),tab=contactSheets_().contacts,publicDone=publicContactCheckedIds_();let all=contactRows_(tab),checked=0,added=0;
 for(const values of leadData_(sh).slice(1)){
   if(checked>=(limit||3)||Date.now()>deadline-15000||apolloSearchAccess_()==='denied')break;
   const lead=Object.fromEntries(LEAD_COLS.map((c,k)=>[c,values[k]]));
   if(!lead.id||!publicDone.has(String(lead.id))||(lead.status||'new')!=='new'||!professionalDomain_(lead.website)||all.some(c=>c.lead_id===lead.id&&c.name)||PropertiesService.getScriptProperties().getProperty(apolloSearchAttemptKey_(lead)))continue;
   const before=cellFillHash_(lead),result=apolloFreePeopleRequest_(lead);checked++;
   if(result.state==='denied')break;
   const live=cellFillRow_(leadData_(sh),lead.id);if(!live||cellFillHash_(live)!==before)continue;
   apolloCandidates_({people:result.people},lead).forEach(c=>{if(!all.some(x=>x.lead_id===c.lead_id&&x.provider_person_id===c.provider_person_id)){tab.appendRow(CONTACT_COLS.map(k=>sheetValue_(c[k]??'')));all.push(c);added++;}});
   PropertiesService.getScriptProperties().setProperty(apolloSearchAttemptKey_(lead),new Date().toISOString());
 }
 return {checked,added};
}
function pendingApolloPhoneCount_(){return contactRows_(contactSheets_().contacts).filter(c=>/^-?\d+$/.test(String(c.pending_request_id))).length;}
function pollApolloPhonesAutomatic_(deadline,limit){
 const tab=contactSheets_().contacts,chosen=contactRows_(tab).filter(c=>/^-?\d+$/.test(String(c.pending_request_id))).slice(0,limit||10);let done=0;
 for(const before of chosen){if(Date.now()>deadline-10000)break;const current=contactRows_(tab).find(c=>c.contact_id===before.contact_id);if(!current||contactSnapshot_(current)!==contactSnapshot_(before))continue;let result;
   try{const res=apolloFetch_('webhook_result/'+before.pending_request_id,'get'),parsed=apolloJson_(res,'phone result',[200,404,410]);
     if(parsed.status===404&&parsed.body.error_code==='result_pending')result={...before,phone_status:'pending',phone_checked_on:new Date(),note:'Apollo phone lookup is still processing; automatic check will continue.'};
     else if(parsed.status===410)result={...before,phone_status:'expired',phone_checked_on:new Date(),pending_request_id:'',note:'Apollo phone result expired after 30 days.'};
     else if(parsed.status!==200)result={...before,phone_status:'failed',phone_checked_on:new Date(),pending_request_id:'',note:'Apollo did not recognize this phone request.'};
     else result=apolloPhoneResult_(parsed.body,before,new Date());
   }catch(e){result={...before,phone_status:'failed',pending_request_id:'',phone_checked_on:new Date(),note:redactSecretText_(e.message)};}
   if(commitContact_(tab,before,result))done++;
 }
 return done;
}
function apolloOrganizationDomain_(person){
 const org=person?.organization||{},candidates=[org.primary_domain,org.website_url,person.organization_website_url];
 for(const value of candidates){const d=professionalDomain_(value);if(d)return d;}return '';
}
function apolloPersonId_(p){return String(p?.id||p?.person_id||'').trim();}
function apolloCandidates_(data,lead,now){
 const domain=professionalDomain_(lead.website),people=Array.isArray(data?.people)?data.people:[];
 return people.filter(p=>apolloPersonId_(p)&&apolloOrganizationDomain_(p)===domain).slice(0,5).map(p=>{
   const name=String(p.name||[p.first_name,p.last_name||p.last_name_obfuscated].filter(Boolean).join(' ')).trim();
   return {lead_id:lead.id,contact_id:Utilities.getUuid(),company:lead.company,domain,name,role:String(p.title||''),linkedin:canonicalLinkedIn_(p.linkedin_url),identity_status:'unconfirmed',email_status:p.has_email?'available_unrevealed':'unavailable',source_urls:canonicalLinkedIn_(p.linkedin_url),checked_on:now||new Date(),note:'Apollo candidate; confirm current person, employer and role before outreach.',provider:'apollo',provider_person_id:apolloPersonId_(p),phone_status:p.has_direct_phone?'available_unrevealed':''};
 });
}
function apolloEmailResult_(data,before,now){
 const p=data?.person;if(!p||apolloPersonId_(p)!==before.provider_person_id||apolloOrganizationDomain_(p)!==before.domain)return {...before,email_status:'identity_mismatch',checked_on:now||new Date(),note:'Apollo returned a different person or current company; result rejected.'};
 const email=workEmail_(p.email,before.domain),status=String(p.email_status||'').toLowerCase(),name=String(p.name||before.name).trim(),linkedin=canonicalLinkedIn_(p.linkedin_url)||before.linkedin;
 return {...before,name,role:String(p.title||before.role),linkedin,email,email_status:email?(status==='verified'?'valid':status||'unverified'):'not_found',verified_on:email&&status==='verified'?(now||new Date()):'',verified_email:email&&status==='verified'?email:'',checked_on:now||new Date(),provider:'apollo',note:email?'Apollo work email; confirm identity before copying to Leads.':'Apollo found no work email for this person.'};
}
function apolloRequestId_(data){return String(data?.request_id||data?.phone_enrichment?.request_id||data?.person?.phone_enrichment?.request_id||'').trim();}
function safePhone_(value){const s=String(value||'').trim().replace(/[()\s.-]/g,'');return /^\+?[1-9]\d{6,14}$/.test(s)?s:'';}
function apolloPhoneResult_(data,before,now){
 const root=data?.webhook_result||data,people=Array.isArray(root?.people)?root.people:[],p=people.find(x=>apolloPersonId_(x)===before.provider_person_id);
 if(data?.webhook_status==='in_progress')return {...before,phone_status:'pending',phone_checked_on:now||new Date()};
 if(data?.webhook_status==='failed'||root?.status==='failed')return {...before,phone_status:'failed',phone_checked_on:now||new Date(),pending_request_id:'',note:'Apollo phone lookup failed; no automatic retry.'};
 if(!p)return {...before,phone_status:'identity_mismatch',phone_checked_on:now||new Date(),pending_request_id:'',note:'Apollo returned a phone result for a different person; withheld.'};
 const phones=(p.phone_numbers||[]).filter(x=>x.status_cd==='valid_number'&&safePhone_(x.sanitized_number||x.raw_number));
 const allowed=phones.filter(x=>['','not_found','not_applicable','unknown'].includes(String(x.dnc_status_cd||'').toLowerCase())).sort((a,b)=>/mobile/i.test(b.type_cd)-/mobile/i.test(a.type_cd));
 if(!allowed.length)return {...before,phone:'',phone_type:'',phone_status:phones.length?'do_not_call':'not_found',phone_checked_on:now||new Date(),pending_request_id:'',note:phones.length?'Apollo returned only do-not-call phone data; withheld.':'Apollo found no valid phone number.'};
 return {...before,phone:safePhone_(allowed[0].sanitized_number||allowed[0].raw_number),phone_type:String(allowed[0].type_cd||'unknown'),phone_status:'valid',phone_checked_on:now||new Date(),pending_request_id:'',note:'Apollo phone result. Check applicable calling and do-not-call rules before use.'};
}
function selectedApolloContacts_(sh,requireConfirmed){
 const ss=SpreadsheetApp.getActive(),ranges=sh.getActiveRangeList()?.getRanges()||[sh.getActiveRange()],all=contactRows_(sh),leads=leadData_(ss.getSheetByName(TABS.leads));
 return all.filter(c=>{const lead=cellFillRow_(leads,c.lead_id);return lead&&(lead.status||'new')==='new'&&professionalDomain_(lead.website)===c.domain&&c.provider_person_id&&(!requireConfirmed||c.identity_status==='confirmed')&&!contactSuppressed_(c,all)&&ranges.some(r=>c._r>=r.getRow()&&c._r<=r.getLastRow())&&!sh.isRowHiddenByFilter(c._r);});
}
function findApolloPeopleSelected(){
 const ss=SpreadsheetApp.getActive(),ui=SpreadsheetApp.getUi(),sh=ss.getActiveSheet();if(sh.getName()!==TABS.leads)return ui.alert('Select lead rows in Leads first.');
 const ranges=sh.getActiveRangeList()?.getRanges()||[sh.getActiveRange()],data=leadData_(sh),selected=selectedCellFields_(data,ranges,r=>sh.isRowHiddenByFilter(r)).map(x=>cellFillRow_(data,x.id)),ready=selected.filter(r=>(r.status||'new')==='new'&&professionalDomain_(r.website));
 if(!ready.length||ready.length>5)return ui.alert('Select 1–5 new leads with confirmed company websites.');
 if(!approveApollo_('Apollo — find people (free)',ready.map(r=>r.company+' · '+professionalDomain_(r.website)),'search',0,{domains:ready.map(r=>professionalDomain_(r.website))}))return;
 const tab=contactSheets_().contacts;let all=contactRows_(tab),done=0;
 for(const lead of ready){
   const domain=professionalDomain_(lead.website),before=cellFillHash_(lead),payload={'q_organization_domains_list[]':[domain],'person_seniorities[]':['owner','founder','c_suite','vp','head','director'],'person_titles[]':HUNTER_ROLES,include_similar_titles:false,page:1,per_page:5};
   let result;try{result=apolloRequest_('search',domain,'mixed_people/api_search','post',payload,0);rememberApolloSearchAccess_('available');}catch(e){
     if(/HTTP (?:401|403)/.test(String(e)))rememberApolloSearchAccess_('denied');
     APOLLO_APPROVAL=null;
     ui.alert('Apollo search unavailable',redactSecretText_(e.message)+'\n\nCandidates added before this error: '+done+'. No further requests were made. Review Apollo endpoint access before retrying.',ui.ButtonSet.OK);
     ss.setActiveSheet(tab);return;
   }
   const live=cellFillRow_(leadData_(sh),lead.id);if(!live||cellFillHash_(live)!==before)continue;
   const candidates=apolloCandidates_(result,lead);for(const c of candidates){if(!all.some(x=>x.lead_id===c.lead_id&&x.provider_person_id===c.provider_person_id)){tab.appendRow(CONTACT_COLS.map(k=>sheetValue_(c[k]??'')));all.push(c);done++;}}
 }
 APOLLO_APPROVAL=null;if(typeof refreshContactGuidance_==='function')refreshContactGuidance_();ss.setActiveSheet(tab);ss.toast(done+' Apollo candidates added. Review identity before paid enrichment or outreach.');
}
function enrichApolloEmailsSelected(){
 const ss=SpreadsheetApp.getActive(),ui=SpreadsheetApp.getUi(),sh=ss.getActiveSheet();if(sh.getName()!=='Contacts')return ui.alert('Select rows in Contacts.');
 const chosen=selectedApolloContacts_(sh,false).filter(c=>!contactCanPublish_(c));if(!chosen.length||chosen.length>5)return ui.alert('Select 1–5 Apollo contacts tied to new leads.');
 if(!approveApollo_('Apollo — get work email',chosen.map(c=>(c.name||'Apollo candidate')+' · '+c.company),'email',chosen.length,{contacts:chosen.map(c=>c.contact_id)}))return;
 for(const before of chosen){
   const current=contactRows_(sh).find(c=>c.contact_id===before.contact_id);if(!current||contactSnapshot_(current)!==contactSnapshot_(before))continue;
   const params={id:before.provider_person_id,reveal_personal_emails:false,reveal_phone_number:false,run_waterfall_email:false,run_waterfall_phone:false};
   let result;try{result=apolloEmailResult_(apolloRequest_('email',before.contact_id,'people/match','post',params,1),before,new Date());}catch(e){result={...before,note:redactSecretText_(e.message)};}commitContact_(sh,before,result);
 }
 APOLLO_APPROVAL=null;if(typeof refreshContactGuidance_==='function')refreshContactGuidance_();reconcilePublishedContacts_();ss.toast('Apollo email checks finished. Confirm identity, then copy only verified work emails.');
}
function revealApolloPhonesSelected(){
 const ss=SpreadsheetApp.getActive(),ui=SpreadsheetApp.getUi(),sh=ss.getActiveSheet();if(sh.getName()!=='Contacts')return ui.alert('Select rows in Contacts.');
 const chosen=selectedApolloContacts_(sh,true).filter(c=>c.phone_status!=='valid'&&!c.pending_request_id);if(!chosen.length||chosen.length>5)return ui.alert('Select 1–5 confirmed Apollo contacts without a completed or pending phone result.');
 if(typeof findPublicPhonesForIds_==='function'){findPublicPhonesForIds_(chosen.map(c=>c.lead_id),Date.now()+90000);refreshContactGuidance_();}
 const leads=leadData_(ss.getSheetByName(TABS.leads));
 const max=chosen.length*9;if(!approveApollo_('Apollo — reveal phone',chosen.map(c=>{const lead=cellFillRow_(leads,c.lead_id);return c.name+' · '+c.company+(lead?.phone?' · public number already in Leads; this requests a person phone':' · free pages checked first');}),'phone',max,{contacts:chosen.map(c=>c.contact_id)}))return;
 for(const before of chosen){
   const current=contactRows_(sh).find(c=>c.contact_id===before.contact_id);if(!current||contactSnapshot_(current)!==contactSnapshot_(before))continue;
   const params={id:before.provider_person_id,reveal_personal_emails:false,reveal_phone_number:true,poll_only:true,run_waterfall_email:false,run_waterfall_phone:false};let result;
   try{const data=apolloRequest_('phone',before.contact_id,'people/match','post',params,9),requestId=apolloRequestId_(data);result=requestId?{...before,phone_status:'pending',phone_checked_on:new Date(),pending_request_id:requestId,note:'Apollo phone lookup pending; use Check pending phone results.'}:apolloPhoneResult_(data,before,new Date());}
   catch(e){result={...before,note:redactSecretText_(e.message)};}commitContact_(sh,before,result);
 }
 APOLLO_APPROVAL=null;if(typeof refreshContactGuidance_==='function')refreshContactGuidance_();ss.toast('Apollo phone requests submitted. Wait a few minutes, then check pending results.');
}
function pollApolloPhonesSelected(){
 const ss=SpreadsheetApp.getActive(),ui=SpreadsheetApp.getUi(),sh=ss.getActiveSheet();if(sh.getName()!=='Contacts')return ui.alert('Select rows in Contacts.');
 const chosen=selectedApolloContacts_(sh,true).filter(c=>/^-?\d+$/.test(String(c.pending_request_id)));if(!chosen.length||chosen.length>10)return ui.alert('Select 1–10 confirmed contacts with pending Apollo phone requests.');
 if(!approveApollo_('Apollo — check phone results (free)',chosen.map(c=>c.name+' · '+c.company),'poll',0,{contacts:chosen.map(c=>c.contact_id)}))return;
 for(const before of chosen){
   const current=contactRows_(sh).find(c=>c.contact_id===before.contact_id);if(!current||contactSnapshot_(current)!==contactSnapshot_(before))continue;let result;
   try{assertApolloApproval_('poll',before.contact_id,0);const res=apolloFetch_('webhook_result/'+before.pending_request_id,'get'),parsed=apolloJson_(res,'phone result',[200,404,410]);
     if(parsed.status===404&&parsed.body.error_code==='result_pending')result={...before,phone_status:'pending',phone_checked_on:new Date(),note:'Apollo phone lookup is still processing; check later.'};
     else if(parsed.status===410)result={...before,phone_status:'expired',phone_checked_on:new Date(),pending_request_id:'',note:'Apollo phone result expired after 30 days.'};
     else if(parsed.status!==200)result={...before,phone_status:'failed',phone_checked_on:new Date(),pending_request_id:'',note:'Apollo did not recognize this phone request.'};
     else result=apolloPhoneResult_(parsed.body,before,new Date());
   }catch(e){result={...before,note:redactSecretText_(e.message)};}commitContact_(sh,before,result);
 }
 APOLLO_APPROVAL=null;if(typeof refreshContactGuidance_==='function')refreshContactGuidance_();ss.toast('Pending Apollo phone results checked.');
}

/** No provider calls. Uses in-memory ledgers and pure response fixtures. */
function testApolloIntegration(){
 const check=(condition,label)=>{if(!condition)throw new Error('Apollo native test failed: '+label);},properties={},store={getProperty:k=>properties[k]??null,setProperty:(k,v)=>{properties[k]=String(v);}};
 const boundary=apolloReserveState_({month:'2026-09',reserved:0},40,40);let blocked=false;try{apolloReserveState_(boundary,1,40);}catch(e){blocked=true;}check(blocked,'40-credit cap');
 APOLLO_APPROVAL=null;blocked=false;try{assertApolloApproval_('phone','c1',9);}catch(e){blocked=true;}check(blocked,'manual-only request guard');
 check(apolloQuery_({'q_organization_domains_list[]':['example.com']})==='?q_organization_domains_list%5B%5D=example.com','array query encoding');
 const lead={id:'l1',company:'Example',website:'https://example.com'},candidate=apolloCandidates_({people:[{id:'p1',name:'Alice Example',title:'Founder',organization:{primary_domain:'example.com'}}]},lead)[0];
 check(candidate.provider_person_id==='p1'&&candidate.identity_status==='unconfirmed','candidate identity boundary');
 const email=apolloEmailResult_({person:{id:'p1',name:'Alice Example',title:'Founder',email:'alice@example.com',email_status:'verified',organization:{primary_domain:'example.com'}}},candidate,new Date());check(email.verified_email==='alice@example.com','verified work email binding');
 const phone=apolloPhoneResult_({webhook_status:'success',webhook_result:{people:[{id:'p1',phone_numbers:[{sanitized_number:'+14155550117',status_cd:'valid_number',type_cd:'mobile',dnc_status_cd:'not_found'}]}]}},{...candidate,provider_person_id:'p1'},new Date());check(phone.phone==='+14155550117'&&phone.phone_status==='valid','valid phone fixture');
 console.log('PASS: Apollo native cap, manual-only guard, query encoding, identity, email and phone fixtures. No provider calls.');
}
