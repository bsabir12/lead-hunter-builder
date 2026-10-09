// Public portability regressions. Every network path is a fictional fixture.
export function reliabilityContracts({test,env,assert,plain,fixture,assisted}) {
 const configured={...assisted,providers:{jev_input_usd_per_million:.042,actor_minimum_caps:{},groq_models:['fixture-model'],gemini_model:'',tavily_monthly_credits:0,apify_monthly_credit:0}};
 function reorder(e){
  const old=e.H.slice(),headers=['service_region',...old.slice().reverse()];
  const oldRows=e.grid.slice(1).map(r=>Object.fromEntries(old.map((h,i)=>[h,r[i]])));
  e.grid.splice(0,e.grid.length,headers,...oldRows.map(r=>headers.map(h=>h==='service_region'?'Owner region':r[h]??'')));
  return headers;
 }
 function value(e,id,field){const h=e.grid[0],r=e.grid.find((r,i)=>i&&r[h.indexOf('id')]===id);return r?.[h.indexOf(field)];}
 test('header mapping reads reordered leads and preserves unknown service columns',()=>{
  const e=env([fixture]);reorder(e);const row=e.s.cellFillRow_(e.s.leadData_(),fixture.id);
  assert.equal(row.company,fixture.company);assert.equal(row.website,fixture.website);
  row.email='owner@alpha.example';e.s.writeLeadFields_(e.sheets.Leads,row,['email']);
  assert.equal(value(e,fixture.id,'email'),'owner@alpha.example');assert.equal(value(e,fixture.id,'service_region'),'Owner region');
 });
 test('selected-cell requests follow the physical header after optional insertion',()=>{
  const e=env([fixture]);const h=reorder(e),data=e.s.leadData_(),at=h.indexOf('website')+1;
  const ranges=[{getRow:()=>3,getLastRow:()=>3,getColumn:()=>at,getLastColumn:()=>at}];
  assert.deepEqual(plain(e.s.selectedCellFields_(data,ranges))[0].requested,['website']);
  const custom=h.indexOf('service_region')+1;const chosen=e.s.selectedCellFields_(data,[{...ranges[0],getColumn:()=>custom,getLastColumn:()=>custom}])[0];
  assert.deepEqual(plain(e.s.cellFillPlan_(fixture,chosen.requested).unsupported),['service_region']);
 });
 test('duplicate or missing required headers fail before any mutation',()=>{
  const e=env([fixture]);e.grid[0][e.H.indexOf('website')]='company';const before=JSON.stringify(e.grid);
  assert.throws(()=>e.s.writeLeadFields_(e.sheets.Leads,{...fixture,_r:1,email:'wrong@alpha.example'},['email']),/missing or duplicate/);
  assert.equal(JSON.stringify(e.grid),before);
 });
 test('new imported rows map into reordered columns and leave owner fields empty',()=>{
  const e=env([fixture]);reorder(e);e.s.appendLeadValues_(e.sheets.Leads,4,[e.H.map(c=>c==='company'?'New buyer':c==='id'?'new-id':'')]);
  assert.equal(value(e,'new-id','company'),'New buyer');assert.equal(value(e,'new-id','service_region'),'');assert.equal(value(e,fixture.id,'service_region'),'Owner region');
 });
 test('priority formula offsets use actual physical headers',()=>{
  const e=env([fixture]);reorder(e);let formula,at;const original=e.sheets.Leads.getRange;
  e.sheets.Leads.getRange=(r,c,nr,nc)=>{const range=original(r,c,nr,nc);range.setFormulasR1C1=v=>{formula=v[0][0];at=c;return range;};return range;};
  e.s.writePriorityFormulas_(e.sheets.Leads,3,1);const h=e.grid[0];assert.equal(at,h.indexOf('priority_pct')+1);
  assert.ok(formula.includes(`RC[${h.indexOf('match_pct')-h.indexOf('priority_pct')}]`));
 });
 test('essential visibility hides operations and exposes only chosen service fields',()=>{
  const e=env([fixture],{sheet:{optional_fields:[{key:'service_region',label:'Jurisdiction',purpose:'Bookkeeping fit'}],show_optional_core:['country']}});reorder(e);
  const hidden=[],notes=[];Object.assign(e.sheets.Leads,{getMaxColumns:()=>40,showColumns:()=>{},hideColumns:c=>hidden.push(e.grid[0][c-1])});
  const original=e.sheets.Leads.getRange;e.sheets.Leads.getRange=(...a)=>{const r=original(...a);r.setNote=v=>{notes.push(v);return r;};return r;};
  e.s.applyLeadVisibility_(e.sheets.Leads);assert.ok(hidden.includes('id'));assert.ok(hidden.includes('notes'));assert.ok(hidden.includes('lookup'));assert.ok(!hidden.includes('source'));assert.ok(!hidden.includes('website'));assert.ok(!hidden.includes('country'));assert.ok(!hidden.includes('service_region'));assert.ok(notes.some(n=>n.includes('Jurisdiction')));
 });
 test('long source preserves a late business clue without adding inferred facts',()=>{
  const e=env([],configured),body='ordinary source sentence. '.repeat(200)+'Actual buyer: Copper Orchard Ltd';
  const row=e.s.normaliseRaw_('upwork',[{jobId:'late',title:'Workflow project',description:body,url:'https://jobs.example/late'}])[0];
  assert.equal(e.s.sourcePost_(row),body);assert.equal(e.s.sourceIncomplete_(row),false);assert.ok(e.s.jevState_(row).post.text.includes('Copper Orchard Ltd'));
  assert.ok(e.s.brandWindows_(body).some(w=>w.includes('Copper Orchard Ltd')));
 });
 test('generic public-source intake retains full original evidence before scoring',()=>{
  const e=env(),body='source evidence '.repeat(500)+'Late Buyer Name';
  const row=e.s.normalise_('x',[{postId:'long',postText:body,postUrl:'https://posts.example/long',timestamp:1700000000,author:{name:'Source author'}}])[0];
  assert.ok(e.s.sourcePost_(row).includes('Late Buyer Name'));assert.equal(e.s.sourceIncomplete_(row),false);
 });
 test('exhaustive scan resumes after three windows and retains a late verified name',()=>{
  const e=env([],configured);e.props.GROQ_KEY='fixture';const body='a'.repeat(4200)+' Copper Orchard Ltd ',row={id:'late',notes:e.s.sourceNotes_(body),_clue:true,company:''};let calls=0;
  e.s.llmAsk_=(_system,text)=>{calls++;return{text:text.includes('Copper Orchard Ltd')?'Copper Orchard Ltd':'NONE'};};
  e.s.findBrands_([row],Date.now()+90000);assert.equal(row.company,'');assert.equal(e.s.brandScanState_(row).state.cursor,3);assert.equal(e.s.brandScanState_(row).state.status,'pending');
  e.s.findBrands_([row],Date.now()+90000);assert.equal(row.company,'Copper Orchard Ltd');assert.ok(calls<=6);assert.equal(e.s.brandScanState_(row).state.status,'found');
  const before=calls;row.company='';e.s.findBrands_([row],Date.now()+90000);assert.equal(calls,before);assert.equal(row.company,'Copper Orchard Ltd');
 });
 test('NONE completion is durable, while provider errors never advance the cursor',()=>{
  const e=env([],configured);e.props.GROQ_KEY='fixture';const row={id:'failure',notes:e.s.sourceNotes_('unnamed buyer source'),_clue:true,company:''};
  e.s.llmAsk_=()=>({error:'failed'});e.s.findBrands_([row],Date.now()+90000);assert.equal(e.s.brandScanState_(row).state.cursor,0);assert.notEqual(e.s.brandScanState_(row).state.status,'exhausted');
  e.s.llmAsk_=()=>({text:'NONE'});e.s.findBrands_([row],Date.now()+90000);assert.equal(e.s.brandScanState_(row).state.status,'exhausted');
 });
 test('completed source checkpoint allows one interrupted replay then normal timeout stop',()=>{
  const e=env(),row={id:'checkpoint',notes:e.s.sourceNotes_('Unnamed original buyer'),company:''},scan=e.s.brandScanState_(row);
  scan.state.status='exhausted';scan.state.cursor=e.s.brandWindows_(scan.text).length;e.s.saveBrandScan_(scan);
  assert.equal(e.s.brandScanContinuing_(row,true),true);assert.equal(e.s.brandScanContinuing_(row,true),false);
  assert.equal(e.s.brandScanContinuing_({...row,company:'Confirmed owner business'}),false);
 });
 test('invented names found elsewhere in the source do not pass this window',()=>{
  const e=env([],configured);e.props.GROQ_KEY='fixture';const row={id:'invented',notes:e.s.sourceNotes_('x'.repeat(4000)+'Copper Orchard Ltd'),_clue:true,company:''};
  e.s.llmAsk_=()=>({text:'Copper Orchard Ltd'});e.s.findBrands_([row],Date.now()+90000);assert.equal(row.company,'');assert.equal(e.s.brandScanState_(row).state.cursor,0);
 });
 test('source edits invalidate scan cache, owner notes and inferred company are not evidence',()=>{
  const e=env([],configured),row={id:'edited',notes:e.s.sourceNotes_('Original buying request'),company:'Inferred business'};const scan=e.s.brandScanState_(row);scan.state.cursor=1;scan.state.status='exhausted';e.s.saveBrandScan_(scan);
  row.notes=e.s.sourceNotes_('Changed original request');assert.equal(e.s.brandScanState_(row).state.cursor,0);assert.ok(!e.s.brandScanText_(row).includes('Inferred business'));
 });
 test('oversized or historical truncated source remains explicitly incomplete',()=>{
  const e=env();assert.equal(e.s.sourceIncomplete_({notes:e.s.sourceNotes_('x'.repeat(45001))}),true);assert.equal(e.s.sourceIncomplete_({notes:'post: '+'x'.repeat(3000)}),true);assert.equal(e.s.sourceIncomplete_({notes:e.s.sourceNotes_('x'.repeat(3000))}),false);
 });
 test('legacy no-name negative reopens only for uncontacted qualified demand',()=>{
  const e=env(),row={...fixture,company:'',lookup:'done 2026-09-01 · no business name',notes:e.s.sourceNotes_('Late buyer clue')};
  assert.equal(e.s.staleBrandDependency_(row),true);assert.equal(e.s.staleBrandDependency_({...row,status:'sent'}),false);assert.equal(e.s.staleBrandDependency_({...row,next_step:'Skip'}),false);
 });
 test('compound domain parsing preserves country suffixes',()=>{
  const e=env();assert.equal(e.s.bareDomain_('Find us at example.co.uk'),'https://example.co.uk');assert.equal(e.s.bareDomain_('Visit example.com.au'),'https://example.com.au');
 });
 test('different-domain candidate requires matching brand evidence and identity review',()=>{
  const e=env();assert.equal(e.s.websiteCandidateFits_('Copper Orchard','copper.example',''),false);assert.equal(e.s.websiteCandidateFits_('Copper Orchard','buyer.example','Copper Orchard official company'),true);assert.equal(e.s.websiteCandidateFits_('Copper Orchard','buyer.example','Orchard directory'),false);assert.equal(e.s.websiteCandidateFits_('Copper Orchard','linkedin.com','Copper Orchard'),false);
 });
 test('official contact redirects preserve same-site provenance and reject other sites',()=>{
  const e=env([],configured),requests=[];e.s.fetchAllSafe_=rs=>{requests.push(...rs.map(r=>r.url));return rs.map(r=>r.url==='https://buyer.example/contact'?{getResponseCode:()=>302,getAllHeaders:()=>({Location:'/team/contact'}),getContentText:()=>''}:{getResponseCode:()=>200,getContentText:()=>'<a href="mailto:office@buyer.example">Contact</a>'});};
  const pages=e.s.publicContactPages_(['https://buyer.example/contact'],'buyer.example',Date.now()+90000);assert.equal(pages[0].url,'https://buyer.example/team/contact');assert.equal(pages.incomplete,false);
  assert.equal(e.s.publicContactRedirectUrl_('https://buyer.example/contact','https://other.example/steal','buyer.example'),'');assert.equal(e.s.publicContactRedirectUrl_('https://buyer.example/contact','https://buyer.example@other.example/steal','buyer.example'),'');
 });
 test('403, transport and unfinished public-page checks remain incomplete',()=>{
  const e=env([],configured);e.s.fetchAllSafe_=rs=>rs.map(()=>({getResponseCode:()=>403,getContentText:()=>''}));let result=e.s.findContactsFree_('https://buyer.example',Date.now()+90000);assert.equal(result.readable,0);assert.equal(result.incomplete,true);
  e.s.fetchAllSafe_=rs=>rs.map(()=>({getResponseCode:()=>404,getContentText:()=>''}));result=e.s.findContactsFree_('https://buyer.example',Date.now()+90000);assert.equal(result.readable,0);assert.equal(result.incomplete,false);
  result=e.s.findContactsFree_('https://buyer.example',Date.now()-1);assert.equal(result.incomplete,true);
 });
 test('failed hinted-site verification preserves hint and prevents contact scraping',()=>{
  const e=env([],configured);e.s.fetchAllSafe_=rs=>rs.map(()=>null);e.s.findContactsFree_=()=>{throw Error('Unverified site must not be scraped');};const row={...fixture,source:'upwork',lookup:'todo',_prior:'',people:'',website:'https://buyer.example'};
  e.s.lookupRow_(row,Date.now()+90000,{});assert.equal(row.website,'https://buyer.example');assert.match(row.lookup,/retry/);assert.ok(!row.lookup.startsWith('done'));
 });
 test('exhausted error retries cannot become a successful negative',()=>{
  const e=env();const row={lookup:'todo'};e.s.finishLookup_(row,{}, {contactFailed:true},[],3,'2026-10-09','');assert.match(row.lookup,/^error:/);assert.match(row.lookup,/no negative conclusion/);
 });
 test('name continuation is pending and has no permanent empty result',()=>{
  const e=env([],configured);e.props.GROQ_KEY='fixture';e.s.llmAsk_=()=>({text:'NONE'});const row={id:'pending',source:'upwork',company:'',notes:e.s.sourceNotes_('x'.repeat(4000)),next_step:'Message today',lookup:'todo · business identity needs lookup'};
  e.s.lookupRow_(row,Date.now()+90000,{});assert.match(row.lookup,/^todo · brand scan 3\//);assert.ok(!row.lookup.startsWith('done'));
 });
 test('manual novice guidance has no fictitious automatic work or paid tool',()=>{
  const e=env();const row={id:'manual',website:'https://buyer.example'};
  assert.match(e.s.contactGuidance_(row,'email',[]),/^\[Next\].*owner review/);assert.doesNotMatch(e.s.contactGuidance_(row,'phone',[]),/Working|Hunter|Apollo/);
 });
 test('missing contact integrations do not recommend paid enrichment',()=>{
  const e=env([],configured),row={id:'none',website:'https://buyer.example',_publicChecked:true,_apolloSearchState:'disconnected',provider_person_id:'existing'};
  assert.doesNotMatch(e.s.contactGuidance_(row,'email',[]),/credits/);assert.match(e.s.contactGuidance_(row,'phone',[]),/owner review/);
 });

 test('manual source scope neither starts nor reserves unrelated enabled sources',()=>{
  const e=env([],assisted);e.sources.push(['x',true,'example/x',.1,'{}',''],['upwork',true,'example/upwork',.2,'{}','']);
  assert.deepEqual(plain(e.s.manualSourceSelection_(e.sources.slice(1),'2')),['upwork']);
  const estimate=e.s.estimates_(['upwork']);assert.equal(estimate.lines.length,1);assert.equal(estimate.lines[0].source,'upwork');
  e.s.startRuns_('Approved fixture scope',['upwork']);assert.equal(e.starts.length,1);assert.equal(e.starts[0].actor,'example/upwork');
  assert.throws(()=>e.s.enabledSourceRows_(['disabled']),/Invalid source/);assert.throws(()=>e.s.manualSourceSelection_(e.sources.slice(1),'1,1'),/Choose/);
 });

 test('each collected receipt is durable before the next provider request',()=>{
  const e=env([],assisted);e.props.PENDING=JSON.stringify([{runId:'a',datasetId:'da',source:'x',kind:'source'},{runId:'b',datasetId:'db',source:'x',kind:'source'}]);
  e.s.apiGet_=path=>{if(path==='/actor-runs/a')return{data:{status:'SUCCEEDED',usageTotalUsd:.1}};if(path.startsWith('/datasets/da/'))return[];
   if(path==='/actor-runs/b'){assert.deepEqual(plain(e.s.pending_()).map(p=>p.runId),['b']);throw Error('Injected later transport failure');}throw Error('Unexpected fixture request');};
  e.s.appendLeads_=()=>({added:0,skipped:0});e.s.collectPending_(Date.now()+270000);
  assert.deepEqual(plain(e.s.pending_()).map(p=>p.runId),['b']);assert.equal(e.s.pending_()[0].tries,1);
 });
 test('collection cap rotates slow retained runs behind unchecked runs',()=>{
  const e=env([],assisted);e.props.PENDING=JSON.stringify([{runId:'slow',kind:'source'},{runId:'next',kind:'source'}]);let calls=0;
  e.s.apiGet_=()=>{calls++;return{data:{status:'RUNNING'}};};e.s.collectPending_(Date.now()+270000,1);
  assert.equal(calls,1);assert.deepEqual(plain(e.s.pending_()).map(p=>p.runId),['next','slow']);
 });
 test('worker scores at most eight approved rows and releases lock after finalization failure',()=>{
  const e=env();let count=0,released=0;
  e.s.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>released++})};e.s.approvedLeft_=()=>100;e.s.approvedScoringRows_=()=>Array.from({length:100},(_,i)=>i+1);
  e.s.scoreRows_=rows=>{count=rows.length;return{};};e.s.settleApproved_=()=>{};e.s.lookupBatch_=()=>{};e.s.startPeopleSearch_=()=>{};e.s.automaticFreeContactWork_=()=>{};e.s.workLeft_=()=>false;
  e.s.refreshContactGuidance_=()=>{throw Error('Injected finalization failure');};assert.throws(()=>e.s.worker(),/finalization/);assert.equal(count,8);assert.equal(released,1);
 });
 test('manual mode blocks Apollo and has no automatic provider work',()=>{
  const e=env([fixture]);e.props.APOLLO_KEY='fixture';e.props.LH_APOLLO_MONTHLY_LIMIT='10';
  assert.throws(()=>e.s.apolloFetch_('auth/health','get'),/disabled in manual/);assert.equal(e.s.apolloSearchAccess_(),'disconnected');assert.deepEqual(plain(e.s.automaticFreeContactIds_()),[]);assert.equal(e.s.automaticFreeContactWorkLeft_(),false);
 });
 test('Apollo rechecks changed lead status, domain and cross-row suppression after approval',()=>{
  const e=env([fixture]),contact={contact_id:'person',lead_id:fixture.id,domain:'alpha.example',provider_person_id:'provider-person',identity_status:'confirmed'};
  e.confirmWebsite(fixture.id);
  let all=[contact];e.s.contactRows_=()=>all;
  assert.ok(e.s.currentApolloContact_({},contact,true));e.set(fixture.id,'status','sent');assert.equal(e.s.currentApolloContact_({},contact,true),null);
  e.set(fixture.id,'status','new');e.set(fixture.id,'website','https://other.example');assert.equal(e.s.currentApolloContact_({},contact,true),null);
  e.set(fixture.id,'website',fixture.website);e.props[e.s.contactSuppressionKey_('domain:alpha.example')]='yes';assert.equal(e.s.currentApolloContact_({},contact,true),null);
 });

 test('legacy lookup notes and supplied website strings cannot confirm identity',()=>{
  const e=env([fixture],configured),row=e.s.cellFillRow_(e.s.leadData_(),fixture.id);
  row.lookup='done · site verified from post: alpha.example (jev 0.99)';assert.equal(e.s.websiteIdentityConfirmed_(row),false);
  assert.deepEqual(plain(e.s.apolloFreePeopleRequest_(row)),{state:'unconfirmed',people:[]});
  const confirmed=e.confirmWebsite(fixture.id);assert.equal(e.s.websiteIdentityConfirmed_(confirmed),true);
 });
 test('identity receipt accepts only fresh exact provenance, method and bounded score',()=>{
  const e=env([fixture]),row=e.confirmWebsite(fixture.id),key=e.s.websiteIdentityKey_(row),good=JSON.parse(e.props[key]);
  for(const patch of [{version:0},{signature:'wrong'},{method:'owner_note'},{p:null},{p:-1},{p:1.1},{checked:Date.now()+60000},{checked:Date.now()-31*864e5}]){
   e.props[key]=JSON.stringify({...good,...patch});assert.equal(e.s.websiteIdentityConfirmed_(row),false);
  }
  e.props[key]=JSON.stringify(good);assert.equal(e.s.websiteIdentityConfirmed_(row),true);
  assert.throws(()=>e.s.markWebsiteIdentity_(row,.1),/did not pass/);
 });
 test('identity signatures collapse www only and bind source, company and factual evidence',()=>{
  const base={...fixture,notes:'post: Original buyer source'},e=env([base]),row=e.confirmWebsite(base.id),sig=e.s.websiteIdentitySignature_(row);
  assert.equal(e.s.websiteIdentitySignature_({...row,company:'  EXAMPLE ALPHA ',website:'https://www.alpha.example/about'}),sig);
  for(const patch of [{website:'https://branch.alpha.example'},{company:'Different company'},{source:'upwork'},{link:'https://changed.example/post'},{what_they_want:'Changed request'},{notes:e.s.sourceNotes_('Changed original buyer source')}])assert.notEqual(e.s.websiteIdentitySignature_({...row,...patch}),sig);
  assert.equal(e.s.websiteIdentityConfirmed_({...row,company:'Different company'}),false);
 });
 test('safe selected-cell commit makes proof durable and concurrent identity edit blocks it',()=>{
  const e=env([fixture]),row=e.s.cellFillRow_(e.s.leadData_(),fixture.id),task={id:row.id,requested:['website'],fields:['website'],hash:e.s.cellFillHash_(row)};
  e.s.markWebsiteIdentity_(row,.99);assert.equal(e.s.websiteIdentityConfirmed_(row),false);assert.equal(e.s.websiteIdentityReady_(row),true);
  e.s.writeCellFillResult_(e.sheets.Leads,task,row);assert.equal(e.s.websiteIdentityConfirmed_(row),true);
  const f=env([fixture]),stale=f.s.cellFillRow_(f.s.leadData_(),fixture.id);f.s.markWebsiteIdentity_(stale,.99);f.set(fixture.id,'company','Owner changed company');
  assert.equal(f.s.commitWebsiteIdentity_(f.sheets.Leads,stale),false);assert.equal(f.props[f.s.websiteIdentityKey_(stale)],undefined);
 });
 test('safe lookup commit persists exact proof while changed snapshot cannot create one',()=>{
  const e=env([fixture]),before=e.s.cellFillRow_(e.s.leadData_(),fixture.id),working='working fixture',row={...before,lookup:'done fixture'};
  e.set(row.id,'lookup',working);e.s.markWebsiteIdentity_(row,.99);assert.equal(e.s.commitLookup_(e.sheets.Leads,row,before,working,['lookup']),true);assert.equal(e.s.websiteIdentityConfirmed_(row),true);
  const f=env([fixture]),old=f.s.cellFillRow_(f.s.leadData_(),fixture.id),changed={...old,lookup:'done fixture'};f.set(old.id,'lookup',working);f.set(old.id,'what_they_want','Owner changed original request');f.s.markWebsiteIdentity_(changed,.99);
  assert.equal(f.s.commitLookup_(f.sheets.Leads,changed,old,working,['lookup']),false);assert.equal(f.props[f.s.websiteIdentityKey_(changed)],undefined);
 });
 test('all sources verify supplied websites before any public contact read',()=>{
  for(const source of ['upwork','linkedin_jobs','manual','cold_prospect']){
   const e=env([],configured),row={...fixture,source,lookup:'todo',_prior:'',people:''};let identity=0,contacts=0;
   e.s.publicContactPages_=()=>{identity++;const pages=[];pages.incomplete=true;return pages;};e.s.findContactsFree_=()=>{contacts++;throw Error('Unexpected contacts');};
   e.s.lookupRow_(row,Date.now()+90000,{},source==='cold_prospect'?{cellFill:true,fields:['website','email']}:undefined);
   assert.equal(identity,1);assert.equal(contacts,0);assert.equal(row.website,fixture.website);assert.match(row.lookup,/retry/);
  }
 });
 test('mismatched supplied website is retained for review without proof or contact scrape',()=>{
  const e=env([],configured),row={...fixture,lookup:'todo'};e.s.publicContactPages_=()=>[{html:'<title>Other business</title>'+('Different business information. '.repeat(5)),url:row.website}];e.s.jevSiteScores_=()=>[.05];e.s.findContactsFree_=()=>{throw Error('Wrong site scrape');};
  e.s.lookupRow_(row,Date.now()+90000,{});assert.equal(row.website,fixture.website);assert.match(row.lookup,/^error:.*identity mismatch/);assert.equal(row._websiteVerified,undefined);
 });
 test('verified homepage is reused for contacts and receipt waits for sheet commit',()=>{
  const e=env([fixture],configured),row=e.s.cellFillRow_(e.s.leadData_(),fixture.id),home={html:'<title>Example Alpha</title><a href="mailto:office@alpha.example">Contact</a>'+('Example Alpha official business information. '.repeat(4)),url:fixture.website,requestedHost:'alpha.example'};let requests=[];
  e.s.fetchAllSafe_=rs=>{requests.push(...rs.map(r=>r.url));return rs.map(r=>({getResponseCode:()=>200,getContentText:()=>r.url===fixture.website?home.html:'Contact page'}));};e.s.jevSiteScores_=()=>[.99];
  e.s.lookupRow_(row,Date.now()+90000,{}, {cellFill:true,fields:['website','email']});
  assert.equal(requests.filter(url=>url===fixture.website).length,1);assert.equal(row.email,'office@alpha.example');assert.equal(e.s.websiteIdentityConfirmed_(row),false);
  assert.equal(e.s.commitWebsiteIdentity_(e.sheets.Leads,row),true);assert.equal(e.s.websiteIdentityConfirmed_(row),true);
 });
 test('supported LLM site pick records its reviewed Jev floor and remains durable',()=>{
  const e=env([fixture],configured),row=e.s.cellFillRow_(e.s.leadData_(),fixture.id),p=e.s.T.SITE_JEV_FLOOR;
  e.s.markWebsiteIdentity_(row,p,'jev_llm');assert.equal(e.s.commitWebsiteIdentity_(e.sheets.Leads,row),true);assert.equal(e.s.websiteIdentityConfirmed_(row),true);
  const receipt=JSON.parse(e.props[e.s.websiteIdentityKey_(row)]);assert.equal(receipt.method,'jev_llm');e.props[e.s.websiteIdentityKey_(row)]=JSON.stringify({...receipt,method:'jev'});assert.equal(e.s.websiteIdentityConfirmed_(row),false);
 });
 test('website-only lookup preserves the supported LLM pick provenance',()=>{
  const e=env([{...fixture,website:''}],configured),row=e.s.cellFillRow_(e.s.leadData_(),fixture.id),ev={title:'Example Alpha',description:'',text:'Example Alpha official site'},p=e.s.T.SITE_JEV_FLOOR;
  e.s.siteCandidates_=()=>[{host:'alpha.example',ev,snippet:'Example Alpha'}];e.s.jevSiteScores_=()=>[p];e.s.llmAsk_=()=>({text:'1'});
  e.s.lookupRow_(row,Date.now()+90000,{}, {cellFill:true,fields:['website']});assert.equal(row._websiteVerified.method,'jev_llm');assert.equal(row.website,fixture.website);
  const task={id:row.id,requested:['website'],fields:['website'],hash:e.s.cellFillHash_(e.s.cellFillRow_(e.s.leadData_(),row.id))};e.s.writeCellFillResult_(e.sheets.Leads,task,row);assert.equal(e.s.websiteIdentityConfirmed_(row),true);
 });
 test('cross-domain redirects cannot certify original homepage in any website reader',()=>{
  const e=env([],configured),urls=[];e.s.fetchAllSafe_=rs=>{urls.push(...rs.map(r=>r.url));assert.ok(rs.every(r=>r.followRedirects===false));return rs.map(()=>({getResponseCode:()=>302,getAllHeaders:()=>({Location:'https://other.example/about'})}));};
  e.s.tavilySearch_=()=>[{url:'https://alpha.example',title:'Example Alpha official website',content:'Example Alpha'}];
  const rows=[{...fixture}];e.s.fetchSites_(rows,1,Date.now()+90000);assert.equal(rows[0]._site,undefined);
  const candidates=e.s.siteCandidates_(fixture,Date.now()+90000,{});assert.equal(candidates[0].ev,null);assert.equal(e.s.guessedSite_({...fixture,company:'Alpha'},[],Date.now()+90000,{}).length,0);
  assert.ok(urls.length>=3);assert.ok(!urls.some(url=>url.includes('other.example')));
 });
 test('batched homepage redirects retain each requested host and permit apex to www only',()=>{
  const e=env([],configured);e.s.fetchAllSafe_=rs=>rs.map(r=>r.url==='https://alpha.example'?{getResponseCode:()=>302,getAllHeaders:()=>({location:'https://www.alpha.example/about'})}:{getResponseCode:()=>200,getContentText:()=>'<title>Readable company</title>'});
  const pages=e.s.publicContactPages_(['https://alpha.example','https://second.example'],null,Date.now()+90000);
  assert.equal(pages.incomplete,false);assert.equal(pages.find(p=>p.requestedHost==='alpha.example').url,'https://www.alpha.example/about');assert.ok(pages.find(p=>p.requestedHost==='second.example'));
  assert.equal(e.s.publicContactRedirectUrl_('https://alpha.example','http://alpha.example','alpha.example'),'');assert.equal(e.s.publicContactRedirectUrl_('https://alpha.example','https://sub.alpha.example','alpha.example'),'');
 });
 test('same-domain provenance edits invalidate Apollo negative attempts',()=>{
  const e=env(),row={...fixture,notes:e.s.sourceNotes_('Original request')},key=e.s.apolloSearchAttemptKey_(row);
  assert.notEqual(e.s.apolloSearchAttemptKey_({...row,company:'Other Alpha'}),key);assert.notEqual(e.s.apolloSearchAttemptKey_({...row,notes:e.s.sourceNotes_('Changed request')}),key);
 });
 test('only strong uncontacted completed rows revalidate stale identity; errors stay bounded',()=>{
  const e=env([],{...configured}),row={...fixture,lookup:'done · old site result'};
  const data=r=>[e.H,e.H.map(c=>r[c]??'')];assert.deepEqual(plain(e.s.lookupRowsWaiting_(data(row))),[1]);
  for(const patch of [{status:'sent'},{lookup:'error: identity mismatch'},{next_step:'Skip'}])assert.deepEqual(plain(e.s.lookupRowsWaiting_(data({...row,...patch}))),[]);
 });
 test('historical queued Google people lookup cannot spend before durable identity',()=>{
  const e=env([{...fixture,lookup:'done · people: google queued'}],configured);e.props.APIFY_TOKEN='fictional';assert.deepEqual(plain(e.s.peopleQueue_(e.s.leadData_())),[]);
  e.s.startPeopleSearch_([fixture.id],{});assert.equal(e.starts.length,0);e.confirmWebsite(fixture.id);assert.deepEqual(plain(e.s.peopleQueue_(e.s.leadData_())),[1]);
 });
 test('people collection rejects a same-domain source identity edit during verification',()=>{
  const e=env([fixture],configured);e.confirmWebsite(fixture.id);e.s.peopleFromGoogle_=()=>{e.set(fixture.id,'what_they_want','Owner changed identity evidence');return [{name:'Alice Example',headline:'Operations director',url:'https://www.linkedin.com/in/alice-example',p:.99}];};
  e.s.collectPeople_({leads:[fixture.id]},[],Date.now()+90000);assert.equal(e.get(fixture.id,'people'),'');
 });
 test('exhausted unnamed source with a website cannot reopen an impossible identity proof forever',()=>{
  const e=env([],{...configured}),row={...fixture,company:'',notes:e.s.sourceNotes_('No company name in this original source'),lookup:'done · no business name in fully scanned saved source'},scan=e.s.brandScanState_(row);
  scan.state.status='exhausted';scan.state.cursor=e.s.brandWindows_(scan.text).length;e.s.saveBrandScan_(scan);
  const data=r=>[e.H,e.H.map(c=>r[c]??'')];assert.deepEqual(plain(e.s.lookupRowsWaiting_(data(row))),[]);assert.deepEqual(plain(e.s.lookupRowsWaiting_(data({...row,company:'Unnamed DTC buyer'}))),[]);
 });
 test('guessed fallback cannot override an unreadable searched official-site candidate',()=>{
  const e=env([],configured),row={...fixture,website:'',lookup:'todo'},ev={title:'Example Alpha',description:'',text:'Readable guessed-domain fixture'};
  e.s.siteCandidates_=()=>[{host:'original.example',ev:null,snippet:'Example Alpha official site'}];e.s.guessedSite_=()=>[{host:'guessed.example',ev,snippet:''}];e.s.jevSiteScores_=(_row,cands)=>cands.map(c=>c.ev?.title?.includes('Example') ? .99 : null);e.s.pickSite_=()=>null;e.s.findContactsFree_=()=>{throw Error('Guess cannot authorize scrape');};
  e.s.lookupRow_(row,Date.now()+90000,{}, {cellFill:true,fields:['website']});assert.equal(row.website,'');assert.equal(row._websiteVerified,undefined);
 });
 test('pending Apollo phone work requires linked fresh identity, confirmation and suppression checks',()=>{
  for(const invalid of ['none','sent','domain','unconfirmed','suppressed','missing','stale']){
   const e=env([fixture],configured),contact={contact_id:'pending-person',lead_id:fixture.id,domain:'alpha.example',identity_status:'confirmed',provider_person_id:'person',pending_request_id:'123'};e.confirmWebsite(fixture.id);
   const all=[contact];e.s.contactRows_=()=>all;e.s.contactSheets_=()=>({contacts:{}});
   if(invalid==='sent')e.set(fixture.id,'status','sent');if(invalid==='domain')contact.domain='other.example';if(invalid==='unconfirmed')contact.identity_status='unconfirmed';if(invalid==='suppressed')contact.do_not_contact='yes';if(invalid==='missing')contact.lead_id='missing';if(invalid==='stale')e.set(fixture.id,'what_they_want','Changed source');
   let calls=0;e.s.apolloFetch_=()=>{calls++;return{getResponseCode:()=>404,getContentText:()=>JSON.stringify({error_code:'result_pending'})};};e.s.commitContact_=()=>true;
   assert.equal(e.s.pendingApolloPhoneCount_(),invalid==='none'?1:0);e.s.pollApolloPhonesAutomatic_(Date.now()+90000,10);assert.equal(calls,invalid==='none'?1:0);
  }
 });
 test('pending Apollo poll rechecks eligibility immediately before each request',()=>{
  const e=env([fixture],configured),contact={contact_id:'pending',lead_id:fixture.id,domain:'alpha.example',identity_status:'confirmed',provider_person_id:'person',pending_request_id:'123'};e.confirmWebsite(fixture.id);e.s.contactRows_=()=>[contact];e.s.contactSheets_=()=>({contacts:{}});
  const actual=e.s.apolloPendingContacts_;e.s.apolloPendingContacts_=tab=>{const selected=actual(tab);e.set(fixture.id,'status','sent');return selected;};e.s.apolloFetch_=()=>{throw Error('Stale approval polled');};assert.equal(e.s.pollApolloPhonesAutomatic_(Date.now()+90000),0);
 });
 test('selected contact failure retains only safely committed verified website prerequisites',()=>{
  for(const changed of [false,true]){
   const e=env([fixture],configured),row=e.s.cellFillRow_(e.s.leadData_(),fixture.id),task={id:row.id,fields:['website','email'],requested:['email'],hash:e.s.cellFillHash_(row),tries:0};e.s.saveCellFillQueue_([task]);
   e.s.lookupRow_=r=>{e.s.markWebsiteIdentity_(r,.99);r.lookup='retry 1 · public contact pages unavailable';r.email='partial@alpha.example';if(changed)e.set(row.id,'company','Owner change during request');};
   e.s.runCellFill_(Date.now()+120000);const live=e.s.cellFillRow_(e.s.leadData_(),row.id);assert.equal(e.s.websiteIdentityConfirmed_(live),!changed);assert.equal(e.get(row.id,'email'),'');assert.equal(e.s.cellFillQueue_().length,0);
   if(!changed)assert.deepEqual(plain(e.s.cellFillPlan_(live,['phone']).fields),['phone']);
  }
 });
 test('malformed Apollo search remains an error without a durable successful-empty attempt',()=>{
  for(const body of [{},{people:null},{people:{}},{people:[]}]){
   const e=env([fixture],configured),row=e.confirmWebsite(fixture.id);e.s.contactSheets_=()=>({contacts:{appendRow:()=>{}}});e.s.contactRows_=()=>[];e.s.publicContactCheckedIds_=()=>new Set([row.id]);e.s.apolloSearchAccess_=()=> 'unknown';e.s.apolloFetch_=()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(body)});e.s.rememberApolloSearchAccess_=()=>{};
   if(Array.isArray(body.people)){assert.equal(e.s.automaticApolloPeopleSearch_(Date.now()+90000).checked,1);assert.ok(e.props[e.s.apolloSearchAttemptKey_(row)]);assert.deepEqual(plain(e.s.apolloCandidates_(body,row)),[]);}
   else{assert.throws(()=>e.s.automaticApolloPeopleSearch_(Date.now()+90000),/schema mismatch/);assert.equal(e.props[e.s.apolloSearchAttemptKey_(row)],undefined);assert.throws(()=>e.s.apolloCandidates_(body,row),/schema mismatch/);}
  }
 });
 test('async Google people receipt rejects changed identity even after new identity confirmation',()=>{
  const e=env([fixture],configured),original=e.confirmWebsite(fixture.id);e.set(fixture.id,'what_they_want','Changed source evidence');e.confirmWebsite(fixture.id);e.s.peopleFromGoogle_=()=>{throw Error('Old async source must not be reviewed');};
  const result=e.s.collectPeople_({leads:[fixture.id],identitiesById:{[fixture.id]:e.s.websiteIdentitySignature_(original)}},[],Date.now()+90000);assert.equal(result.found,0);assert.equal(e.get(fixture.id,'people'),'');
 });
 test('supplied and searched www origins are read as HTTPS without forcing apex',()=>{
  const e=env([],configured),requests=[],html='<title>Example Alpha</title>'+('Example Alpha official company. '.repeat(6));e.s.fetchAllSafe_=rs=>{requests.push(...rs.map(r=>r.url));return rs.map(r=>({getResponseCode:()=>r.url==='https://www.alpha.example'?200:404,getContentText:()=>html}));};e.s.jevSiteScores_=()=>[.99];
  const row={...fixture,website:'http://www.alpha.example/about',next_step:'You decide'};e.s.fetchSites_([row],1,Date.now()+90000);assert.ok(row._site?.text);e.s.lookupRow_(row,Date.now()+90000,{}, {cellFill:true,fields:['website']});assert.ok(row._websiteVerified);
  e.s.tavilySearch_=()=>[{url:'http://www.alpha.example/path',title:'Example Alpha official website',content:'Example Alpha'}];const cands=e.s.siteCandidates_(row,Date.now()+90000,{});assert.equal(cands[0].ev.source_url,'https://www.alpha.example');assert.ok(requests.every(url=>url==='https://www.alpha.example'));
 });
 test('accepted discovered website retains verified same-host final origin',()=>{
  const e=env([],configured),row={...fixture,website:''},ev={title:'Example Alpha',description:'',text:'Official company information',source_url:'https://www.alpha.example/about'};
  e.s.siteCandidates_=()=>[{host:'alpha.example',ev,snippet:'Example Alpha'}];e.s.jevSiteScores_=()=>[.99];e.s.lookupRow_(row,Date.now()+90000,{}, {cellFill:true,fields:['website']});assert.equal(row.website,ev.source_url);assert.ok(row._websiteVerified);
 });
 test('selected Google redo gates proof and rechecks markers after async start',()=>{
  for(const mode of ['unconfirmed','confirmed','changed']){
   const e=env([fixture],configured);e.props.APIFY_TOKEN='fictional';e.props.JEV_KEY='fictional';e.sheets.Leads.getActiveRange=()=>({getRow:()=>3,getLastRow:()=>3});const active=e.s.SpreadsheetApp.getActive;e.s.SpreadsheetApp.getActive=()=>({...active(),getActiveSheet:()=>e.sheets.Leads});e.s.SpreadsheetApp.getUi=()=>({alert:()=>{},ButtonSet:{OK:1}});e.s.confirm_=()=>true;e.s.peopleSpent_=()=>0;e.s.rules_=()=>({peopleBudget:10});e.s.budgetAllows_=()=>true;
   if(mode!=='unconfirmed')e.confirmWebsite(fixture.id);let jobs=[];e.s.startTrackedActor_=(_actor,_input,_estimate,job)=>{jobs.push(job);if(mode==='changed')e.set(fixture.id,'what_they_want','Owner changed after start');};e.s.redoPeopleSelected();assert.equal(jobs.length,mode==='unconfirmed'?0:1);
   if(jobs.length)assert.ok(jobs[0].identitiesById[fixture.id]);if(mode==='confirmed')assert.match(e.get(fixture.id,'lookup'),/google searching/);if(mode==='changed')assert.equal(e.get(fixture.id,'lookup'),fixture.lookup);
  }
 });

}
