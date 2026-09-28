// Offline behavioral contracts for the generated starter; unstubbed networking fails.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const path=process.argv[2];
if(!path)throw Error('Usage: node scripts/test_engine.mjs generated/Code.gs');
const code=fs.readFileSync(path,'utf8');
new vm.Script(code);
const config=JSON.parse(code.match(/^const BUSINESS_CONFIG = (.*);$/m)[1]);
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}
const plain=x=>JSON.parse(JSON.stringify(x));
function env(leads=[],patch={}){
 // Each contract arranges its own business/budget state, independently of the owner's plan.
 const cfg={...config,mode:'manual',budget:{monthly_usd:0,people_monthly_usd:0},sources:[],
  rules:{countries:[],restricted_words:[],spam_words:[],max_employees:0,min_hourly_usd:0,min_fixed_usd:0,max_post_age_days:0},
  providers:{...config.providers,jev_input_usd_per_million:.042,actor_minimum_caps:{'apify/google-search-scraper':.5},groq_models:[],gemini_model:''},...patch},props={},events=[],starts=[],timers=[];
 const store={getProperty:k=>props[k]??null,setProperty:(k,v)=>{if(Buffer.byteLength(v)>9000)throw Error('Property exceeds native limit');props[k]=String(v);},deleteProperty:k=>{delete props[k];},getProperties:()=>({...props})};
 const s={console,PropertiesService:{getScriptProperties:()=>store},Session:{getScriptTimeZone:()=>cfg.schedule.timezone},
 Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_a,x)=>Array.from(createHash('sha256').update(x).digest()),formatDate:(_d,_z,f)=>f==='yyyy-MM'?'2026-09':'2026-09-28',getUuid:()=>Math.random().toString(36),sleep:()=>{}},
 LockService:{getScriptLock:()=>({tryLock:()=>true,waitLock:()=>{},releaseLock:()=>{}})},
 UrlFetchApp:{fetch:()=>{throw Error('Unstubbed network');},fetchAll:()=>{throw Error('Unstubbed network');}},
 ScriptApp:{getProjectTriggers:()=>timers,deleteTrigger:t=>timers.splice(timers.indexOf(t),1),newTrigger:handler=>({timeBased:()=>({everyMinutes:()=>({create:()=>{timers.push({getHandlerFunction:()=>handler});}})})})},SpreadsheetApp:{}};
 vm.createContext(s);vm.runInContext(code.replace(/^const BUSINESS_CONFIG = .*;$/m,'const BUSINESS_CONFIG = '+JSON.stringify(cfg)+';')+'\nthis.T={LEAD_COLS,DEFAULT_SOURCES,DEFAULT_RULES,BUSINESS_CONFIG,PERSON_JEV_ACCEPT};',s);
 const H=Array.from(s.T.LEAD_COLS),mk=o=>H.map(c=>o[c]??''),grid=[H,...leads.map(mk)];
 const sources=[['source','enabled','actor','max_usd','input_json','note']];
 const rules=[['rule','value','meaning'],...plain(s.T.DEFAULT_RULES)];
 function table(values,offset=0){return {getDataRange:()=>({getValues:()=>[...Array.from({length:offset},()=>[]),...values.map(r=>r.slice())]}),getLastRow:()=>values.length+offset,getMaxRows:()=>1000,getLastColumn:()=>values[0].length,
 getRange:(r,c,nr=1,nc=1)=>{r-=offset;const range={getValues:()=>Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>values[r-1+i]?.[c-1+j]??'')),getValue:()=>values[r-1]?.[c-1]??'',
 setValues(v){v.forEach((row,i)=>{values[r-1+i]??=[];row.forEach((x,j)=>{values[r-1+i][c-1+j]=x;});});return this;},setValue(v){return this.setValues([[v]]);},setNote(){return this;},setNumberFormat(){return this;},setFormulasR1C1(){return this;},setFontWeight(){return this;}};return range;},getName:()=>offset?'Leads':'Table',appendRow:r=>values.push(r)};}
 const sheets={Leads:table(grid,1),Sources:table(sources),Rules:table(rules),Log:table([['date']])};
 s.SpreadsheetApp={getActive:()=>({getSheetByName:n=>sheets[n]||null,toast:()=>{},getSpreadsheetTimeZone:()=>cfg.schedule.timezone}),flush:()=>{}};
 const rawLog=s.logEvent_;s.logEvent_=e=>events.push(e);s.updateForecast_=()=>{};s.refreshProgress_=()=>{};s.spentThisMonth_=()=>0;s.formatLeadRows_=()=>{};
 s.startActor_=(actor,input,cap)=>{starts.push({actor,input,cap});return{id:'run-'+starts.length,defaultDatasetId:'dataset-'+starts.length};};
 return{s,props,store,events,starts,rawLog,timers,grid,sources,rules,sheets,H,cfg,get:(id,c)=>grid.find(r=>r[H.indexOf('id')]===id)?.[H.indexOf(c)],set:(id,c,v)=>{grid.find(r=>r[H.indexOf('id')]===id)[H.indexOf(c)]=v;}};
}
const fixture={id:'fixture-a',company:'Example Alpha',source:'linkedin_jobs',website:'https://alpha.example',status:'new',next_step:'Message today',channel:'Find contact first',lookup:'done 2026-09-28 · people: google searching'};
const person={name:'Alice Example',headline:'Operations director',url:'https://www.linkedin.com/in/alice-example',p:.95};
const assisted={mode:'assisted',budget:{monthly_usd:5,people_monthly_usd:1}};
function answers(e,value=.8){return Object.fromEntries([['poster',{choice:'buyer',confidence:.9}],['pitch',{choice:'direct_fit'}],...[...e.cfg.fit,...e.cfg.readiness].map(c=>[c.key,{noul:value}])]);}

test('manual mode disables keys and network even when credentials exist',()=>{const e=env();e.props.JEV_KEY='fixture';assert.equal(e.s.jevKey_(),null);assert.throws(()=>e.s.providerFetch_('https://example.com'),/disabled/);assert.throws(()=>e.s.startRuns_('fixture'),/manual mode/);assert.equal(e.starts.length,0);});
test('optional fallback models can remain unconfigured',()=>{const e=env([],assisted);e.props.GROQ_KEY='fixture';e.props.GEMINI_KEY='fixture';assert.equal(e.s.llmAsk_('system','text').error,'no key');});
test('new installations have all sources disabled',()=>{const e=env([],{sources:[{name:'x',actor:'example/actor',max_usd:.1,input:{},note:'Fixture'}]});assert.equal(e.s.T.DEFAULT_SOURCES[0][1],false);assert.equal(e.timers.length,0);});
test('blank Google tab grows before writing 29-column headers',()=>{const e=env();let width=26,wrote=false;const sh={getLastRow:()=>0,getMaxColumns:()=>width,insertColumnsAfter:(_at,n)=>{width+=n;},getRange:(_r,_c,_nr,nc)=>{assert.ok(nc<=width,'range exceeds sheet grid');return{setValues:()=>{wrote=true;return{setFontWeight:()=>{}};}};}};e.s.SpreadsheetApp.getActive=()=>({getSheetByName:()=>null,insertSheet:()=>sh});e.s.sheet_('Leads',e.H);assert.ok(wrote);});
for(const [goal,offer,role] of [['clients','Bookkeeping for clinics','finance manager'],['clients','Industrial pumps for factories','maintenance manager'],['jobs','Freelance websites for nonprofits','executive director']]){
 test('generic criteria work for '+offer,()=>{const e=env([],{...assisted,goal,business:{...config.business,offer},decision_roles:[role]});const a=answers(e);const r=e.s.jevDerive_(a,{company:'Example Buyer',source:'manual'});assert.equal(r.match_pct,80);assert.equal(r.readiness_pct,80);assert.equal(r.next_step,'Message today');assert.equal(e.s.jevState_({}).our_service,offer);assert.ok(e.s.peopleQueries_({company:'Example Buyer',website:'https://buyer.example'}).join(' ').includes(role));});
}
test('no guessed industry exclusion from an unfamiliar agency label',()=>{const e=env();const r=e.s.rules_();assert.equal(e.s.flag_({_text:'Example Agency needs help',industry:'Marketing services',employees:10000,country:'Anywhere'},r),'review · open to outside help');});
test('zero rule floors remain zero and no max is Infinity',()=>{const r=env().s.rules_();assert.equal(r.minHourly,0);assert.equal(r.minFixed,0);assert.equal(r.maxEmployees,Infinity);assert.equal(r.monthlyBudget,0);});
test('owner exclusion remains whole-word and explicit',()=>{const e=env();e.rules.push(['restricted_words','fixture','']);assert.match(e.s.flag_({_text:'a fixture need'},e.s.rules_()),/restricted/);assert.doesNotMatch(e.s.flag_({_text:'a fixtures need'},e.s.rules_()),/skip/);});
test('incomplete typed criterion answer fails instead of inventing a score',()=>{const e=env();const a=answers(e);delete a[e.cfg.fit[0].key];assert.throws(()=>e.s.jevDerive_(a,{}),/criterion/);});
test('out-of-range criterion answer is rejected',()=>{const e=env();const a=answers(e);a[e.cfg.fit[0].key].noul=1.2;assert.throws(()=>e.s.jevDerive_(a,{}),/criterion/);});
test('unclear source author routes to review',()=>{const e=env();const a=answers(e);a.poster={choice:'unclear',confidence:.9};assert.equal(e.s.jevDerive_(a,{}).next_step,'You decide');});
test('seller or unsupported pitch cannot be promoted to contact-now',()=>{const e=env();const a=answers(e,.99);a.poster.choice='seller';a.pitch.choice='none';assert.notEqual(e.s.jevDerive_(a,{}).next_step,'Message today');});
test('unverified website identity cannot promote a lead to contact-now',()=>{const e=env();const a=answers(e,.99);a.site_matches_post={noul:.1};assert.equal(e.s.jevDerive_(a,{_site:{text:'A different company'}}).next_step,'You decide');});
test('priority formula uses profile weights and half-life',()=>{const e=env([],{priority:{match_weight:.5,readiness_weight:.4,freshness_weight:.1,half_life_days:30}});const r=e.s.priorityParts_(c=>c);assert.match(r.score,/0\.5\*match_pct/);assert.match(r.score,/0\.4\*readiness_pct/);assert.match(r.score,/\/30/);assert.ok(!r.score.includes('added'));assert.ok(r.known.includes('<=TODAY()'));});
test('zero budget blocks paid work but permits local calculations',()=>{const e=env();assert.equal(e.s.budgetAllows_(.001,{admission:true}),false);assert.equal(e.s.budgetAllows_(0,{admission:true}),true);});
test('pending and queued reservations constrain admission',()=>{const e=env([],assisted);e.rules.push(['monthly_budget_usd',.01,'']);e.props.PENDING=JSON.stringify([{kind:'source',reservedUsd:.009}]);assert.equal(e.s.budgetAllows_(.002,{admission:true}),false);});
test('raised budget resumes a retained approval',()=>{const e=env();e.s.saveApprovedScoringIds_(['fixture-a']);assert.equal(e.s.budgetAllows_(.001),false);e.rules.push(['monthly_budget_usd',1,'']);assert.equal(e.s.budgetAllows_(.001),true);assert.deepEqual(plain(e.s.approvedScoringIds_()),['fixture-a']);});
test('source estimate honors a provider minimum cap',()=>{const e=env([],assisted);e.sources.push(['google_jobs',true,'apify/google-search-scraper',.02,'{}','']);const r=e.s.estimates_();assert.equal(r.lines[0].cap,.5);assert.equal(r.capRun,.5);});
test('scoring queue chunks round-trip Unicode above native property size',()=>{const e=env();const ids=Array.from({length:350},(_,i)=>'id-'+i+'-会社'.repeat(8));e.s.saveApprovedScoringIds_(ids);assert.deepEqual(plain(e.s.approvedScoringIds_()),ids);for(const value of Object.values(e.props))assert.ok(Buffer.byteLength(value)<=8000);});
test('failed manifest commit retains the old complete queue',()=>{const e=env();const old=['old'];e.s.saveApprovedScoringIds_(old);const failStore={...e.store,setProperty:(k,v)=>{if(k==='JEV_APPROVED_IDS')throw Error('Injected storage failure');e.store.setProperty(k,v);}};assert.throws(()=>e.s.saveApprovedScoringIds_(Array.from({length:400},(_,i)=>'new-'+i+'x'.repeat(40)),failStore));assert.deepEqual(plain(e.s.approvedScoringIds_()),old);});
test('missing committed chunk fails closed',()=>{const e=env();e.props.JEV_APPROVED_IDS=JSON.stringify({chunks:['missing']});assert.throws(()=>e.s.approvedScoringIds_(),/missing/);});
test('failed actor queue save leaves a recoverable paid run',()=>{const e=env([],assisted);const orig=e.store.setProperty;e.store.setProperty=(k,v)=>{if(k==='PENDING')throw Error('Injected storage failure');orig(k,v);};assert.throws(()=>e.s.startTrackedActor_('example/actor',{},.1,{kind:'source',source:'x',reservedUsd:.1}));assert.equal(e.starts.length,1);assert.equal(e.s.pending_()[0].runId,'run-1');});
test('no durable start intent means no paid request',()=>{const e=env([],assisted);e.store.setProperty=()=>{throw Error('Unavailable storage');};assert.throws(()=>e.s.startTrackedActor_('example/actor',{},.1,{kind:'source'}));assert.equal(e.starts.length,0);});
test('uncertain paid start prevents blind retries',()=>{const e=env([],assisted);let calls=0;e.s.startActor_=()=>{calls++;throw Error('Transport after submission');};assert.throws(()=>e.s.startTrackedActor_('example/actor',{},.1,{kind:'source'}));assert.throws(()=>e.s.startTrackedActor_('example/actor',{},.1,{kind:'source'}),/uncertain/);assert.equal(calls,1);});
test('people collection follows lead identity after sorting',()=>{const e=env([fixture,{...fixture,id:'fixture-b',company:'Example Beta'}],assisted);e.s.peopleFromGoogle_=()=>{[e.grid[1],e.grid[2]]=[e.grid[2],e.grid[1]];return[person];};e.s.collectPeople_({leads:['fixture-a']},[],Date.now()+90000);assert.match(e.get('fixture-a','people'),/Alice Example/);assert.equal(e.get('fixture-b','people'),'');});
test('people collection preserves a concurrent human edit',()=>{const e=env([fixture],assisted);e.s.peopleFromGoogle_=()=>{e.set('fixture-a','people','Owner verified person');return[person];};e.s.collectPeople_({leads:['fixture-a']},[],Date.now()+90000);assert.equal(e.get('fixture-a','people'),'Owner verified person');});
test('expired deadline retains remaining people instead of none-confirmed',()=>{const e=env([fixture],assisted);e.s.peopleFromGoogle_=()=>{throw Error('Should not start');};const r=e.s.collectPeople_({leads:['fixture-a']},[],Date.now()-1);assert.deepEqual(plain(r.remaining),['fixture-a']);assert.match(e.get('fixture-a','lookup'),/searching/);});
test('article mentions cannot select LinkedIn DM',()=>{const e=env();const txt=e.s.peopleText_([{...person,web:true,url:'https://www.linkedin.com/posts/example_123?srsltid=tracking'}]);assert.match(txt,/mentioned on:/);assert.equal(e.s.peopleChannel_({people:txt,channel:'LinkedIn DM'}),'Find contact first');});
test('real profile link can select LinkedIn DM',()=>{const e=env();const txt=e.s.peopleText_([person]);assert.equal(e.s.peopleChannel_({people:txt}),'LinkedIn DM');});
test('tracking removal preserves functional URL queries',()=>{const e=env();assert.equal(e.s.peopleUrl_('https://example.com/page?item=2&utm_source=test&srsltid=other#section'),'https://example.com/page?item=2#section');});
test('formula-like source data stays text',()=>{const e=env();for(const v of ['=1+1','+SUM(A1)','-1+2','@SUM(A1)'])assert.ok(e.s.sheetValue_(v).startsWith("'"));});
test('malformed actor records are counted and logged',()=>{const e=env();const r=e.s.normalise_('linkedin_jobs',[{title:'No identity or URL'}]);assert.equal(r.length,0);assert.ok(e.events.some(x=>x.type==='error'&&x.items===1));});
test('unsupported source never quietly imports generic JSON',()=>{const e=env();assert.throws(()=>e.s.normaliseRaw_('unknown',[{url:'https://example.com'}]),/Unsupported/);});
test('manual CSV produces stable IDs and retains original evidence',()=>{const e=env();const rows=[['company','what_they_want','link','posted','notes'],['Example Buyer','A workflow need','https://example.com/need?utm_source=x','2026-09-27','Original source sentence']];const a=e.s.csvLeads_(rows)[0],b=e.s.csvLeads_(rows)[0];assert.equal(a.id,b.id);assert.equal(a.link,'https://example.com/need');assert.equal(a.notes,'post: Original source sentence');});
test('manual import refuses guessed or invalid dates',()=>{const e=env();assert.throws(()=>e.s.csvLeads_([['company','what_they_want','link','posted'],['Example','Need','https://example.com','2026-02-30']]),/date/);});
test('CSV checks every row before any write',()=>{const e=env();assert.throws(()=>e.s.csvLeads_([['company','what_they_want','link'],['Example','Need','https://example.com'],['Broken','','']]),/row 3/);assert.equal(e.grid.length,1);});
test('selected match on skipped lead has no unrelated dependencies',()=>{const e=env();const p=e.s.cellFillPlan_({...fixture,next_step:'Skip'},['match_pct']);assert.deepEqual(plain(p.fields),['match_pct']);assert.equal(p.score,true);});
test('priority only adds missing numeric inputs, preserving zero',()=>{const e=env();const p=e.s.cellFillPlan_({...fixture,match_pct:0,readiness_pct:''},['priority_pct']);assert.deepEqual(plain(p.fields),['priority_pct','readiness_pct']);});
test('contact dependency chain is explicit',()=>{const e=env();const p=e.s.cellFillPlan_({company:'',website:''},['contact']);assert.deepEqual(plain(p.fields),['contact','website','company']);});
test('unsupported selected metadata is reported',()=>{const e=env();const p=e.s.cellFillPlan_(fixture,['posted','status']);assert.deepEqual(plain(p.fields),[]);assert.deepEqual(plain(p.unsupported),['posted','status']);});
test('selected write follows ID and preserves skipped/sent fields',()=>{const e=env([{...fixture,next_step:'Skip',status:'sent',why:'Owner reason'},{...fixture,id:'fixture-b'}]);const row=e.s.cellFillRow_(e.s.leadData_(),'fixture-a');const task={id:row.id,requested:['match_pct'],fields:['match_pct'],hash:e.s.cellFillHash_(row)};[e.grid[1],e.grid[2]]=[e.grid[2],e.grid[1]];row.match_pct=72;row.readiness_pct=99;row.next_step='Message today';e.s.writeCellFillResult_(e.sheets.Leads,task,row);assert.equal(e.get(row.id,'match_pct'),72);assert.equal(e.get(row.id,'readiness_pct'),'');assert.equal(e.get(row.id,'next_step'),'Skip');assert.equal(e.get(row.id,'status'),'sent');assert.equal(e.get(row.id,'why'),'Owner reason');});
test('selected write blocks a changed human snapshot',()=>{const e=env([fixture]);const row=e.s.cellFillRow_(e.s.leadData_(),fixture.id),task={id:row.id,requested:['match_pct'],fields:['match_pct'],hash:e.s.cellFillHash_(row)};e.set(row.id,'why','New human reason');row.match_pct=90;assert.throws(()=>e.s.writeCellFillResult_(e.sheets.Leads,task,row),/changed/);assert.equal(e.get(row.id,'match_pct'),'');});
test('people verifier uses configured role list and original evidence',()=>{const e=env([],assisted);let request;e.props.JEV_KEY='fixture';e.s.fetchAllSafe_=reqs=>{request=JSON.parse(reqs[0].payload);return reqs.map(()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({answers:{person_at_business:{noul:.95}},usage:{input_tokens:20}})}));};e.s.personOk_=()=>true;e.s.anchored_=()=>true;e.s.webPeople_=()=>[];e.s.findPeople_({company:'Example Alpha',website:'https://alpha.example'},'configured',null,Date.now()+90000,{}, {li:[{url:person.url,title:'Alice Example — Operations director at Example Alpha',content:'Current operations director'}],web:[]});assert.deepEqual(request.state.business.target_roles,e.cfg.decision_roles);assert.match(request.questions.person_at_business.instructions,/target_roles/);});
test('configured role order drives accepted contact priority',()=>{const e=env([],{decision_roles:['maintenance manager','owner']});const r=e.s.pickPeople_([{name:'A',headline:'Owner',p:.99},{name:'B',headline:'Maintenance manager',p:.9}]);assert.equal(r[0].name,'B');});
test('transport errors do not expose a request URL or key',()=>{const e=env([],assisted);e.s.UrlFetchApp.fetch=()=>{throw Error('https://example.com/?token='+'private-fixture');};assert.throws(()=>e.s.providerFetch_('https://example.com'),e=>!e.message.includes('private-fixture')&&/transport/.test(e.message));});

test('null judgment confidence is not a valid typed answer',()=>{const e=env(),a=answers(e);a.poster.confidence=null;assert.throws(()=>e.s.jevDerive_(a,{}),/judgment/);});
test('out-of-range site probability is never a verified candidate',()=>{const e=env();e.s.llmAsk_=()=>({error:'unavailable'});assert.equal(e.s.pickSite_({},[{host:'example.com',ev:{title:'Example',text:'Evidence'}}],[2],Date.now()+90000,{}),null);});
test('functional Google URL parameters preserve distinct leads',()=>{const e=env();const r=e.s.normaliseRaw_('google_jobs',[{organicResults:[{url:'https://example.com/job?id=1&utm_source=x',title:'Role at Example'},{url:'https://example.com/job?id=2',title:'Role at Example'}]}]);assert.notEqual(r[0].id,r[1].id);assert.equal(r[0].id,'g:https://example.com/job?id=1');});
test('evidence-free source rows fail visibly',()=>{const e=env();assert.equal(e.s.normalise_('linkedin_jobs',[{id:'1',link:'https://example.com'}]).length,0);assert.ok(e.events.some(v=>v.type==='error'));});
test('source reservation matches its effective actor cap',()=>{const e=env([],assisted);e.sources.push(['google_jobs',true,'apify/google-search-scraper',.02,'{}','']);e.s.startRuns_('fixture');assert.equal(e.s.pending_()[0].reservedUsd,.5);});
test('explicit HR buyers retain their job-poster contact',()=>{const e=env([],{decision_roles:['HR director']});assert.match(e.s.jobPoster_({source:'linkedin_jobs',contact:'Alice Example — HR director https://www.linkedin.com/in/alice-example'}),/Alice Example/);const r=e.s.contactsFromHtml_('Contact hr@buyer.test','buyer.test');assert.deepEqual(plain(r.emails),['hr@buyer.test']);});
test('manual scores complete the scoring requirement without a provider',()=>{const e=env([{...fixture,next_step:'',lookup:'',match_pct:75,readiness_pct:40}]);const state=e.s.progressState_(e.s.progressSnapshot_());assert.ok(!state.detail.includes('Score new leads'));assert.equal(e.s.progressSnapshot_().unapproved,0);});

test('fresh setup and repeated refresh preserve owner data and checkbox choices',()=>{
 const e=env([],{sources:[{name:'x',actor:'example/actor',max_usd:.1,input:{},note:'Fixture'}]});
 const sheets={}, chain=new Proxy({}, {get:(_t,k)=>k==='build'?()=>({}):()=>chain});
 function sheet(name){let width=26,maxRows=1000,grid=[],hidden=false;
  const lastRow=()=>{let n=grid.length;while(n&&!grid[n-1]?.some(v=>v!==''&&v!==undefined))n--;return n;};
  const lastCol=()=>Math.max(1,...grid.map(r=>r?.length||0));
  function range(r,c,nr=1,nc=1){if(typeof r==='string'){const m=r.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);const col=v=>v.split('').reduce((a,c)=>26*a+c.charCodeAt(0)-64,0);r=Number(m[2]);c=col(m[1]);nr=m[4]?Number(m[4])-r+1:1;nc=m[3]?col(m[3])-c+1:1;}
   assert.ok(r>=1&&c>=1&&nr>=1&&nc>=1&&c+nc-1<=width&&r+nr-1<=maxRows,'native range bounds');
   const methods={getValues:()=>Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>grid[r-1+i]?.[c-1+j]??'')),getValue:()=>grid[r-1]?.[c-1]??'',setValues(v){assert.equal(v.length,nr);v.forEach((row,i)=>{assert.equal(row.length,nc);grid[r-1+i]??=[];row.forEach((x,j)=>grid[r-1+i][c-1+j]=x);});return prox;},setValue(v){return this.setValues([[v]]);},setFormula(v){return this.setValue(v);},insertCheckboxes(){return this.setValues(Array.from({length:nr},()=>Array(nc).fill(false)));}};
   const prox=new Proxy(methods,{get:(t,k)=>k in t?t[k]:()=>prox});return prox;
  }
  const sh={getName:()=>name,getLastRow:lastRow,getLastColumn:lastCol,getMaxColumns:()=>width,getMaxRows:()=>maxRows,getColumnGroupDepth:()=>0,getColumnGroup:()=>({collapse:()=>{}}),getFilter:()=>null,getRange:range,
   getDataRange:()=>range(1,1,Math.max(1,lastRow()),lastCol()),insertColumnsAfter:(_at,n)=>{width+=n;},insertRowsBefore:(at,n)=>{grid.splice(at-1,0,...Array.from({length:n},()=>[]));maxRows+=n;},appendRow:r=>{grid.push(r);},hideSheet:()=>{hidden=true;},isSheetHidden:()=>hidden};
  return new Proxy(sh,{get:(t,k)=>k in t?t[k]:()=>sh});
 }
 sheets.Dashboard=sheet('Dashboard');
 const ss={getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=sheet(n)),setActiveSheet:()=>{},moveActiveSheet:()=>{},getSpreadsheetTimeZone:()=>e.cfg.schedule.timezone,toast:()=>{}};
 Object.assign(e.s.SpreadsheetApp,{getActive:()=>ss,newDataValidation:()=>chain,newConditionalFormatRule:()=>chain,InterpolationType:{NUMBER:1},WrapStrategy:{CLIP:1}});
 e.s.setup();assert.ok(sheets['Services & offer']);assert.equal(sheets.Leads.getMaxColumns(),29);assert.deepEqual(plain(sheets.Leads.getRange(2,1,1,29).getValues()[0]),e.H);
 sheets.Sources.getRange(2,2).setValue(true);
 const row=e.H.map(c=>c==='id'?'owner-lead':c==='company'?'Owner company':c==='status'?'sent':c==='notes'?'Original note · next: Owner: confirm route':'');
 sheets.Leads.getRange(3,1,1,29).setValues([row]);
 e.s.setup();assert.equal(sheets.Sources.getRange(2,2).getValue(),true);assert.equal(sheets.Leads.getRange(3,e.H.indexOf('notes')+1).getValue(),'Original note · next: Owner: confirm route');assert.equal(sheets.Leads.getRange(3,e.H.indexOf('status')+1).getValue(),'sent');assert.ok(sheets.Dashboard);assert.equal(e.timers.length,0);
});

test('edited invalid source cap cannot bypass a zero budget',()=>{for(const v of [0,'','invalid',-1]){const e=env([],{mode:'assisted'});e.sources.push(['x',true,'example/actor',v,'{}','']);try{e.s.startRuns_('fixture');}catch(_){ }assert.equal(e.starts.length,0);}});
test('seller and rejected-site reviews never automatically enter lookup',()=>{const e=env([],assisted);for(const kind of ['seller','site']){const a=answers(e,.99),row={id:kind,company:'Example Buyer',source:'manual',status:'new'};if(kind==='seller'){a.poster.choice='seller';a.pitch.choice='none';}else{row._site={text:'Wrong company'};a.site_matches_post={noul:.01};}Object.assign(row,e.s.jevDerive_(a,row));const data=[e.H,e.H.map(c=>row[c]??'')];assert.deepEqual(plain(e.s.lookupRowsWaiting_(data)),[]);}});
test('manual owner action does not queue automatic contact research',()=>{const e=env([{...fixture,lookup:'',match_pct:75,readiness_pct:70}]);assert.deepEqual(plain(e.s.lookupRowsWaiting_(e.s.leadData_())),[]);});
test('supported anonymous identity clue reaches name extraction',()=>{const e=env([],assisted);const a=answers(e,.9);a.identity_clue={noul:.99};const row={id:'up:fixture',source:'upwork',company:'',what_they_want:'Example Buyer LLC needs help',_text:'We are Example Buyer LLC and need help.'};Object.assign(row,e.s.jevDerive_(a,row));let reads=0;e.s.findBrands_=rows=>{reads++;rows[0].company='Example Buyer LLC';return{calls:0,tokens:0};};e.s.guessSites_=()=>[];e.s.tavilySearch_=()=>[];e.s.lookupRow_(row,Date.now()+90000,{});assert.equal(reads,1);});
test('assistant to a target decision-maker is not that decision-maker',()=>{const e=env([],{decision_roles:['owner']});assert.equal(e.s.jobPoster_({source:'linkedin_jobs',contact:'Alice Example — Assistant to the owner https://www.linkedin.com/in/alice-example'}),'');});

test('provider keys are redacted and untrusted log text stays literal',()=>{const e=env([],assisted);e.props.APIFY_TOKEN='synthetic-sensitive-value';e.rawLog({type:'error',source:'fixture',note:'=synthetic-sensitive-value'});const cells=e.sheets.Log.getDataRange().getValues().flat().map(String);assert.ok(!cells.some(v=>v.includes('synthetic-sensitive-value')));assert.ok(cells.some(v=>v.startsWith("'=\u005bredacted\u005d")));});
console.log(`\n${passed} passed; ${failed} failed. Offline only; no provider accounts used.`);
if(failed)process.exitCode=1;
