import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';import path from 'node:path';
const dir=process.argv[2]||new URL('../',import.meta.url);const read=n=>fs.readFileSync(new URL(n,typeof dir==='string'?pathToFileURL(path.resolve(dir)+'/'):dir),'utf8');
const s={console,Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},computeDigest:(_,v)=>Array.from(crypto.createHash('sha256').update(v).digest())}};vm.createContext(s);
const generated=read('Code.gs'),businessConfig=JSON.parse(generated.match(/^const BUSINESS_CONFIG = (.*);$/m)[1]);
vm.runInContext([generated,...['Hunter.gs','Apollo.gs','ContactGuidance.gs'].filter(n=>fs.existsSync(new URL(n,typeof dir==='string'?pathToFileURL(path.resolve(dir)+'/'):dir))).map(read)].join('\n')+'\nthis.T={LEAD_COLS,CONTACT_COLS,leadFieldValue_,publicPhonesFromHtml_,contactGuidance_,cellFillHash_,cellFillPlan_,cellEstimate_};',s);
const props={};s.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=String(v);}})};
const actualCapabilities=s.contactGuidanceCapabilities_;s.contactGuidanceCapabilities_=()=>({automaticPublic:true,hunter:true,apollo:true});
const fixtureCapabilities=s.contactGuidanceCapabilities_;
const T=s.T;let n=0;const test=(name,f)=>{f();n++;console.log('PASS '+name);};
function confirmedFixture(row){s.markWebsiteIdentity_(row,.99);props[s.websiteIdentityKey_(row)]=JSON.stringify({version:1,...row._websiteVerified});assert.equal(s.websiteIdentityConfirmed_(row),true);return row;}
function guide(row,field,contacts){const fixture={company:'Example',...row};if(fixture.id){confirmedFixture(fixture);fixture._websiteConfirmed=s.websiteIdentityConfirmed_(fixture);}return T.contactGuidance_(fixture,field,contacts);}
test('Contact, email and phone are separate visible fields',()=>assert.deepEqual(Array.from(T.LEAD_COLS).slice(12,16),['contact','email','phone','people']));
test('Display guidance is missing data and never contact evidence',()=>{assert.equal(T.leadFieldValue_('email','[Next] Hunter email · up to 1.5 credits/person'),'');assert.equal(T.leadFieldValue_('contact','@owner'),'@owner');assert.equal(T.leadFieldValue_('notes','[Next] user note'),'[Next] user note');});
test('Guidance changes do not invalidate queues; real edits do',()=>{const a={id:'a',email:''},b={...a,email:'[Next] Public website · 0 credits'};assert.equal(T.cellFillHash_(a),T.cellFillHash_(b));assert.notEqual(T.cellFillHash_(a),T.cellFillHash_({...a,email:'owner@example.com'}));});
test('Phone extraction accepts explicit public contact markup, not prices/dates',()=>{const p=T.publicPhonesFromHtml_('<a href="tel:+1-415-555-0123">Call</a><script type="application/ld+json">{"telephone":"+1 (415) 555-0123"}</script> Price 99999999 Date 2026-09-28');assert.equal(p.length,1);assert.equal(p[0],'+14155550123');assert.equal(T.publicPhonesFromHtml_('order 1234567890, price $12345678').length,0);});
test('Invalid and premium/unsafe href values are rejected',()=>{assert.equal(T.publicPhonesFromHtml_('<a href="tel:123">x</a><a href="tel:javascript:1234567890">x</a>').length,0);});
test('Phone-only selection is free for confirmed identity; unconfirmed URL is a dependency',()=>{const p=T.cellFillPlan_(confirmedFixture({id:'pure',company:'Example',website:'https://example.com'}),['phone']);assert.equal(T.cellEstimate_(p.fields),0);assert.deepEqual(Array.from(p.fields),['phone']);assert.ok(T.cellFillPlan_({company:'Example',website:'https://example.com'},['phone']).fields.includes('website'));});
test('Free work is shown as internal progress, never as a user next step',()=>{
  assert.match(guide({id:'a',company:'Example',website:'https://example.com'},'phone',[]),/^\[Working\] Public pages · automatic$/);
  assert.doesNotMatch(guide({id:'a',company:'Example',website:'https://example.com'},'phone',[]),/^\[Next\]/);
});
test('No public number recommends capped person-phone lookup',()=>assert.match(T.contactGuidance_({company:'Example',website:'https://example.com',_publicChecked:true,provider_person_id:'p'},'phone',[]),/Apollo.*9 credits/));
test('Suppressed contacts never recommend another provider',()=>assert.match(T.contactGuidance_({domain:'example.com',provider_person_id:'p',do_not_contact:'yes'},'email',[]),/Do not contact/));
test('Email guidance names only the remaining tool and maximum paid cost',()=>{
  assert.equal(guide({id:'a',company:'Example',website:'https://example.com'},'email',[]),'[Working] Public pages · automatic');
  assert.equal(T.contactGuidance_({company:'Example',website:'https://example.com',_publicChecked:true,_apolloSearchState:'denied'},'email',[]),'[Next] Hunter Domain Search · up to 1 credit/company');
  assert.match(T.contactGuidance_({domain:'example.com',name:'Alice Example',identity_status:'confirmed',_identityConfirmed:true,_publicChecked:true},'email',[]),/Hunter Email Finder \+ Verifier.*1.5 credits\/person/);
  assert.match(T.contactGuidance_({company:'Example'},'email',[]),/Confirm official website · owner review/);
});
test('Apollo free search is automatic and plan denial is not recommended again',()=>{
  assert.equal(guide({id:'a',company:'Example',website:'https://example.com',_publicChecked:true,_apolloSearchState:'unknown'},'people',[]),'[Working] Apollo People Search · automatic');
  assert.equal(T.contactGuidance_({company:'Example',website:'https://example.com',_publicChecked:true,_apolloSearchState:'denied'},'people',[]),'[Next] Hunter Domain Search · up to 1 credit/company');
});
test('Terminal lead guidance cannot report public or Apollo work as running',()=>{
  for(const status of ['sent','SENT','drafted','replied','lost'])for(const field of ['email','phone','people']){
    const value=guide({id:'a',website:'https://example.com',status,_apolloSearchState:'available',pending_request_id:'123'},field,[]);
    assert.match(value,/^\[Next\].*existing conversation/);assert.doesNotMatch(value,/Working|automatic|credits/);
  }
});
test('Parked public work asks for review and pending work reports the actual retry',()=>{
  const row={id:'a',website:'https://example.com',status:'new',_apolloSearchState:'available',_publicChecked:false};
  for(const field of ['email','phone','people']){
    assert.match(guide({...row,_publicFailed:true},field,[]),/^\[Next\] Public pages incomplete.*owner review/);
    assert.equal(guide({...row,_publicRetry:true},field,[]),'[Working] Public pages incomplete · retry queued');
  }
});
test('Apollo automatic guidance requires a completed public check and assisted mode',()=>{
  const row={website:'https://example.com',_apolloSearchState:'available'};
  assert.doesNotMatch(T.contactGuidance_(row,'people',[]),/Working|automatic/);
  assert.match(T.contactGuidance_({...row,_publicChecked:true},'people',[]),/^\[Working\] Apollo/);
  s.contactGuidanceCapabilities_=()=>({automaticPublic:false,hunter:false,apollo:false});
  for(const field of ['email','phone','people'])assert.doesNotMatch(guide({...row,id:'a',_publicRetry:true,pending_request_id:'123'},field,[]),/Working|automatic|credits/);
  s.contactGuidanceCapabilities_=fixtureCapabilities;
});
test('Legacy system note replacement keeps owner lines appended below it',()=>{
  const prior='Lead Hunter public contact check | old timestamp | old result\nOwner: call after noon\nSecond owner line';
  const note=s.publicContactNote_(prior,'Fresh public result');assert.ok(note.includes('Owner: call after noon\nSecond owner line'));assert.ok(!note.includes('old timestamp'));
  assert.equal((s.publicContactNote_(note,'New public result').match(/Owner: call after noon/g)||[]).length,1);
});
test('Owner text around managed blocks survives public note refresh',()=>{
  const prior='Owner before\n[LH public contact v2]\nOld public result\n[/LH public contact v2]\nOwner after';
  const note=s.publicContactNote_(prior,'New public result');assert.ok(note.includes('Owner before'));assert.ok(note.includes('Owner after'));assert.ok(!note.includes('Old public result'));
});
console.log(`${n} contact guidance checks passed`);
// Integration fixtures exercise actual reads/writes and never use a real account.
const H=Array.from(T.LEAD_COLS),C=Array.from(T.CONTACT_COLS);let requests=0;
function sheet(name,records,header,offset){
  const grid=[...Array.from({length:offset},()=>[]),header,...records.map(r=>header.map(k=>r[k]??'')),...Array.from({length:6},()=>[])],notes=new Map();
  return {grid,notes,getName:()=>name,getDataRange:()=>({getValues:()=>grid.map(r=>header.map((_,k)=>r[k]??''))}),getLastRow:()=>grid.length,getRange(r,c,rows=1,cols=1){return {
    getValues:()=>Array.from({length:rows},(_,n)=>Array.from({length:cols},(_,k)=>grid[r-1+n]?.[c-1+k]??'')),getValue:()=>grid[r-1]?.[c-1]??'',
    setValues(v){v.forEach((row,n)=>row.forEach((value,k)=>{grid[r-1+n][c-1+k]=value;}));},setValue(v){grid[r-1][c-1]=v;},
    getNote:()=>notes.get(r+','+c)||(header[c-1]==='phone'?notes.get(r):'')||'',getNotes:()=>Array.from({length:rows},(_,n)=>[notes.get((r+n)+','+c)||(header[c-1]==='phone'?notes.get(r+n):'')||'']),setNote:v=>{notes.set(r+','+c,v);if(header[c-1]==='phone')notes.set(r,v);}};
  }};
}
let leadSheet,contactSheet;const reset=(leads,contacts=[],headers=H,confirm=true,review=true)=>{Object.keys(props).filter(k=>/^LH_(?:PUBLIC_CONTACT_V[23]|WEBSITE_IDENTITY|CONTACT_IDENTITY)_/.test(k)).forEach(k=>delete props[k]);leadSheet=sheet('Leads',leads,headers,1);contactSheet=sheet('Contacts',contacts,C,0);s.SpreadsheetApp={getActive:()=>({getSheetByName:n=>n==='Leads'?leadSheet:n==='Contacts'?contactSheet:null})};if(confirm)for(const original of leads){const row=s.cellFillRow_(s.leadData_(leadSheet),original.id);s.markWebsiteIdentity_(row,.99);assert.equal(s.commitWebsiteIdentity_(leadSheet,row),true);}if(review)for(const c of s.contactRows_(contactSheet).filter(c=>c.identity_status==='confirmed')){const row=s.cellFillRow_(s.leadData_(leadSheet),c.lead_id);if(!row)continue;c.company||=row.company;if(!s.contactRoleMatches_(c.role))c.role=businessConfig.decision_roles[0];const index=c._r-1;contactSheet.grid[index][C.indexOf('company')]=c.company;contactSheet.grid[index][C.indexOf('role')]=c.role;s.saveContactIdentityReview_(c,row,{url:'https://'+c.domain+'/team',quote:c.name+' is '+c.role+' at '+row.company+', responsible for the documented request.',observedOn:new Date().toISOString().slice(0,10),basis:s.contactRoleKind_(c.role),current:true,relevant:true});}};
const get=(id,k)=>{const header=leadSheet.grid[1];return leadSheet.grid.find((r,i)=>i>1&&r[header.indexOf('id')]===id)?.[header.indexOf(k)];};
const lead={id:'a',company:'Example',website:'https://example.com',contact:'@owner',status:'new',next_step:'Skip',match_pct:5};
test('Backfill preserves handles and real data and leaves unused rows empty',()=>{reset([{...lead,contact:'@owner · hello@example.com'},{...lead,id:'b',email:'human@example.com',phone:'Public: +441234567890'}]);s.refreshContactGuidance_();assert.equal(get('a','contact'),'@owner · hello@example.com');assert.equal(get('a','email'),'hello@example.com');assert.equal(get('b','email'),'human@example.com');assert.equal(get('b','phone'),'Public: +441234567890');assert.ok(leadSheet.grid.slice(4).every(r=>r.every(v=>v==='')));assert.equal(s.refreshContactGuidance_(),0);});
test('Contact labels stay empty to verification and do not create fake records',()=>{reset([lead],[{lead_id:'a',contact_id:'p',domain:'example.com',name:'Alice Example',identity_status:'confirmed',provider_person_id:'p'}]);s.refreshContactGuidance_();const c=s.contactRows_(contactSheet)[0];assert.equal(c.email,'');assert.equal(c.phone,'');assert.equal(c.linkedin,'');assert.equal(s.contactCanPublish_(c),false);});
test('Backfill does not recommend bypassing persistent suppression',()=>{reset([lead],[{lead_id:'a',contact_id:'p',domain:'example.com',name:'Alice Example',identity_status:'confirmed'}]);props[s.contactSuppressionKey_('domain:example.com')]='yes';s.refreshContactGuidance_();assert.match(contactSheet.grid[1][C.indexOf('email')],/Do not contact/);delete props[s.contactSuppressionKey_('domain:example.com')];});
test('Guidance follows stable IDs after sorting and preserves a human replacement',()=>{reset([lead,{...lead,id:'b'}]);const at=H.indexOf('email');leadSheet.grid[2][at]='Human replacement';[leadSheet.grid[2],leadSheet.grid[3]]=[leadSheet.grid[3],leadSheet.grid[2]];s.guidanceWrites_(leadSheet,at+1,[{id:'a',row:3,expected:'',value:'[Next] first',field:'email'},{id:'b',row:4,expected:'',value:'[Next] second',field:'email'}]);assert.equal(get('a','email'),'Human replacement');assert.equal(get('b','email'),'[Next] second');});
test('A moved email column cannot commit stale guidance into an owner column',()=>{
  reset([lead],[],[...H,'owner_custom']);const at=H.indexOf('email'),owner=H.length,planned={id:'a',expected:'',value:'[Next] stale email',field:'email'};
  for(const row of leadSheet.grid)[row[at],row[owner]]=[row[owner],row[at]];
  const before=JSON.stringify(leadSheet.grid);s.guidanceWrites_(leadSheet,at+1,[planned]);assert.equal(JSON.stringify(leadSheet.grid),before);
  s.guidanceWrites_(leadSheet,owner+1,[planned]);assert.equal(get('a','email'),planned.value);assert.equal(get('a','owner_custom'),'');
});
test('Refresh plans carry field identities for both Leads and Contacts commits',()=>{
  reset([lead],[{lead_id:'a',contact_id:'person',domain:'example.com',name:'Alice'}]);const writer=s.guidanceWrites_;let count=0;
  s.guidanceWrites_=(sh,column,updates)=>{for(const u of updates){assert.ok(u.field);assert.equal(u.field,sh.getName()==='Leads'?leadSheet.grid[1][column-1]:C[column-1]);count++;}return writer(sh,column,updates);};
  s.refreshContactGuidance_();s.guidanceWrites_=writer;assert.ok(count>3);
});
test('Refresh cannot show queued work for a terminal lead or parked public receipt',()=>{
  reset([{...lead,status:'SENT'},{...lead,id:'parked'}]);vm.runInContext("BUSINESS_CONFIG.mode='assisted'",s);const parked={...lead,id:'parked'},receipt=s.publicContactReceipt_(parked);
  props[receipt.key]=JSON.stringify({version:3,identity:s.websiteIdentitySignature_(parked),site:receipt.site,state:'error',attempts:3,checked:Date.now()});
  const access=s.apolloSearchStateForLead_;s.apolloSearchStateForLead_=()=> 'available';s.refreshContactGuidance_();
  for(const field of ['email','phone','people']){assert.match(get('a',field),/^\[Next\].*existing conversation/);assert.match(get('parked',field),/^\[Next\] Public pages incomplete/);}
  assert.equal(s.publicContactCheckedIds_().has('parked'),false);assert.equal(s.automaticFreeContactIds_(1,true).length,0);
  s.apolloSearchStateForLead_=access;vm.runInContext("BUSINESS_CONFIG.mode='manual'",s);
});
test('Explicit free phone lookup processes skipped leads and follows a sort',()=>{reset([lead,{...lead,id:'b',phone:'Human number'}]);s.findContactsFree_=()=>{requests++;[leadSheet.grid[2],leadSheet.grid[3]]=[leadSheet.grid[3],leadSheet.grid[2]];return {phones:[{number:'+14155550123',source_url:'https://example.com/contact'}],readable:1};};const result=s.findPublicPhonesForIds_(['a'],Date.now()+60000);assert.equal(result.found,1);assert.equal(get('a','phone'),'Public: +14155550123');assert.equal(get('b','phone'),'Human number');assert.equal(get('a','next_step'),'Skip');assert.match(leadSheet.notes.get(4),/person ownership unconfirmed.*example.com\/contact/);});
test('One public-page pass fills explicit email and phone and records completion',()=>{reset([lead]);s.findContactsFree_=()=>({emails:['hello@example.com'],socials:['https://instagram.com/example'],phones:[{number:'+14155550123',source_url:'https://example.com/contact'}],readable:2});const result=s.findPublicContactsForIds_(['a'],Date.now()+60000);assert.equal(result.checked,1);assert.equal(get('a','email'),'hello@example.com');assert.equal(get('a','phone'),'Public: +14155550123');assert.equal(get('a','contact'),'@owner');assert.match(leadSheet.notes.get(3),/Lead Hunter public contact check/);});
test('Human edit during free phone research prevents stale writes',()=>{reset([lead]);s.findContactsFree_=()=>{leadSheet.grid[2][H.indexOf('phone')]='Human number';return {phones:[{number:'+14155550123',source_url:'https://example.com/contact'}],readable:1};};assert.equal(s.findPublicPhonesForIds_(['a'],Date.now()+60000).checked,0);assert.equal(get('a','phone'),'Human number');});
test('Unreadable pages park after three checks and phone guidance calls for owner review',()=>{reset([lead]);s.findContactsFree_=()=>({phones:[],emails:[],socials:[],readable:0,incomplete:false});for(let i=0;i<3;i++)s.findPublicPhonesForIds_(['a'],Date.now()+60000);s.refreshContactGuidance_();assert.match(leadSheet.notes.get(3),/Pages unreadable; no conclusion/);assert.match(get('a','phone'),/owner review/);assert.equal(s.leadData_(leadSheet)[1][H.indexOf('phone')],'');});
test('Partial contact check cannot become a completed receipt or suppress bounded retries',()=>{reset([lead]);vm.runInContext("BUSINESS_CONFIG.mode='assisted'",s);s.findContactsFree_=()=>({phones:[],emails:[],socials:[],readable:1,incomplete:true});s.findPublicContactsForIds_(['a'],Date.now()+60000);assert.equal(s.publicContactCheckedIds_().has('a'),false);assert.equal(s.automaticFreeContactIds_(1).length,0);assert.equal(s.automaticFreeContactIds_(1,true)[0],'a');s.findPublicContactsForIds_(['a'],Date.now()+60000);s.findPublicContactsForIds_(['a'],Date.now()+60000);assert.equal(s.automaticFreeContactIds_(1,true).length,0);assert.match(leadSheet.notes.get(3),/Partial check/);vm.runInContext("BUSINESS_CONFIG.mode='manual'",s);});
test('Changing a website invalidates identity and public contact completion until reconfirmed',()=>{reset([lead]);vm.runInContext("BUSINESS_CONFIG.mode='assisted'",s);s.findContactsFree_=()=>({phones:[],emails:[],socials:[],readable:2,incomplete:false});s.findPublicContactsForIds_(['a'],Date.now()+60000);assert.equal(s.publicContactCheckedIds_().has('a'),true);leadSheet.grid[2][H.indexOf('website')]='https://changed.example';assert.equal(s.publicContactCheckedIds_().has('a'),false);assert.equal(s.automaticFreeContactIds_(1).length,0);const changed=s.cellFillRow_(s.leadData_(),lead.id);s.markWebsiteIdentity_(changed,.99);assert.equal(s.commitWebsiteIdentity_(leadSheet,changed),true);assert.equal(s.automaticFreeContactIds_(1)[0],'a');vm.runInContext("BUSINESS_CONFIG.mode='manual'",s);});
test('Public receipts expire after thirty days and preserve owner cell notes',()=>{reset([lead]);leadSheet.notes.set(3,'Owner: verify switchboard hours');s.findContactsFree_=()=>({phones:[],emails:[],socials:[],readable:2,incomplete:false});s.findPublicContactsForIds_(['a'],Date.now()+60000);assert.match(leadSheet.notes.get(3),/^Owner: verify switchboard hours/);const receipt=s.publicContactReceipt_(lead),saved=JSON.parse(props[receipt.key]);saved.checked=Date.now()-31*864e5;props[receipt.key]=JSON.stringify(saved);assert.equal(s.publicContactCheckedIds_().has('a'),false);});
test('Unverified Upwork website hint cannot queue or scrape contacts and guidance requests identity',()=>{
  reset([{...lead,source:'upwork',website:'https://reference.example',lookup:'retry 1 · website check unavailable'}],[],H,false);vm.runInContext("BUSINESS_CONFIG.mode='assisted'",s);
  s.findContactsFree_=()=>{throw Error('Unverified hint was scraped');};assert.equal(s.automaticFreeContactIds_(3,true).length,0);assert.equal(s.findPublicContactsForIds_(['a'],Date.now()+60000).checked,0);
  s.refreshContactGuidance_();for(const field of ['email','phone','people'])assert.match(get('a',field),/^\[Next\] Confirm website identity via Fill selected cells/);
  assert.equal(s.apolloFreePeopleRequest_(s.cellFillRow_(s.leadData_(),lead.id)).state,'unconfirmed');vm.runInContext("BUSINESS_CONFIG.mode='manual'",s);
});
test('Same-domain company edit invalidates old contact receipt even after identity is reconfirmed',()=>{
  reset([lead]);s.findContactsFree_=()=>({phones:[],emails:[],socials:[],readable:2,incomplete:false});s.findPublicContactsForIds_(['a'],Date.now()+60000);assert.equal(s.publicContactCheckedIds_().has('a'),true);
  leadSheet.grid[2][H.indexOf('company')]='Different Example';const row=s.cellFillRow_(s.leadData_(),lead.id);assert.equal(s.websiteIdentityConfirmed_(row),false);s.markWebsiteIdentity_(row,.99);assert.equal(s.commitWebsiteIdentity_(leadSheet,row),true);assert.equal(s.publicContactReceipt_(row).state,'new');assert.equal(s.publicContactCheckedIds_().has('a'),false);
});
test('Expired identity blocks free contact work despite a fresh successful public receipt',()=>{
  reset([lead]);vm.runInContext("BUSINESS_CONFIG.mode='assisted'",s);s.findContactsFree_=()=>({phones:[],emails:[],socials:[],readable:2,incomplete:false});s.findPublicContactsForIds_(['a'],Date.now()+60000);
  const key=s.websiteIdentityKey_(lead),proof=JSON.parse(props[key]);proof.checked=Date.now()-31*864e5;props[key]=JSON.stringify(proof);
  assert.equal(s.publicContactCheckedIds_().has('a'),false);assert.equal(s.automaticFreeContactIds_(3,true).length,0);assert.equal(s.findPublicContactsForIds_(['a'],Date.now()+60000).checked,0);vm.runInContext("BUSINESS_CONFIG.mode='manual'",s);
});
test('Contacts guidance follows linked lead status, identity, domain and current person confirmation',()=>{
  for(const invalid of ['none','sent','unverified','domain','missing','person']){
    const person={lead_id:'a',contact_id:'candidate',domain:'example.com',name:'Alice Example',identity_status:'confirmed',provider_person_id:'p',pending_request_id:'123'};
    reset([{...lead,status:invalid==='sent'?'sent':'new'}],[person],H,invalid!=='unverified');
    if(invalid==='domain')contactSheet.grid[1][C.indexOf('domain')]='other.example';if(invalid==='missing')contactSheet.grid[1][C.indexOf('lead_id')]='missing';if(invalid==='person')contactSheet.grid[1][C.indexOf('identity_status')]='unconfirmed';
    s.refreshContactGuidance_();const phone=contactSheet.grid[1][C.indexOf('phone')],email=contactSheet.grid[1][C.indexOf('email')];
    if(invalid==='none')assert.match(phone,/^\[Working\] Apollo phone result/);else{assert.doesNotMatch(phone,/Working|automatic|credits/);if(invalid!=='person')assert.doesNotMatch(email,/Working|automatic|credits/);}
  }
});
test('Structured organization phone is accepted; testimonial person is not assigned',()=>{assert.equal(T.publicPhonesFromHtml_('<script type="application/ld+json">{"@type":"Organization","telephone":"020 7946 0123"}</script>')[0],'02079460123');assert.equal(T.publicPhonesFromHtml_('<script type="application/ld+json">{"@type":"Person","telephone":"020 7946 0123"}</script>').length,0);});
test('Visible labeled phone is supported without mistaking dates or script text for contacts',()=>{assert.equal(T.publicPhonesFromHtml_('<p>Call us at (415) 555-0123</p>')[0],'4155550123');assert.equal(T.publicPhonesFromHtml_('Call 2026-09-28').length,0);assert.equal(T.publicPhonesFromHtml_('<script>Phone: +1-415-555-0123</script> order 123456789').length,0);});

test('Public contact receipt and dedicated email note retain per-page evidence and separate owner notes',()=>{
  const buyer={...lead,website:'https://buyer.test'};reset([buyer]);const emailCell=leadSheet.getRange(3,H.indexOf('email')+1),phoneCell=leadSheet.getRange(3,H.indexOf('phone')+1);emailCell.setNote('Owner email note');phoneCell.setNote('Owner phone note');
  const result=s.contactsFromHtml_('<script>let placeholder="marysample@mail.com"</script><p>Contact us: office@buyer.test</p>','buyer.test','https://buyer.test/contact');s.findContactsFree_=()=>({...result,phones:[],readable:1,incomplete:false});s.findPublicContactsForIds_(['a'],Date.now()+60000);
  assert.equal(get('a','email'),'office@buyer.test');const receipt=s.publicContactReceipt_(buyer);assert.equal(receipt.emailEvidenceVersion,1);assert.equal(receipt.emailCandidates.length,1);assert.equal(receipt.emailCandidates[0].source_url,'https://buyer.test/contact');assert.equal(receipt.emailCandidates[0].person_ownership,'unconfirmed');assert.match(emailCell.getNote(),/Owner email note/);assert.match(emailCell.getNote(),/https:\/\/buyer\.test\/contact/);assert.match(phoneCell.getNote(),/Owner phone note/);assert.doesNotMatch(phoneCell.getNote(),/Owner email note/);
});
test('Contact evidence notes preserve an existing owner email without claiming a generated replacement',()=>{
  const buyer={...lead,website:'https://buyer.test',email:'owner@buyer.test'};reset([buyer]);const cell=leadSheet.getRange(3,H.indexOf('email')+1);cell.setNote('Owner: intentionally selected contact');s.findContactsFree_=()=>({emails:['other@buyer.test'],emailCandidates:[{email:'other@buyer.test',source_url:'https://buyer.test/contact',basis:'visible_text'}],socials:[],phones:[],readable:1,incomplete:false});s.findPublicContactsForIds_(['a'],Date.now()+60000);assert.equal(get('a','email'),'owner@buyer.test');assert.match(cell.getNote(),/Owner: intentionally selected contact/);assert.doesNotMatch(cell.getNote(),/other@buyer\.test/);
});
console.log(`${n} total contact checks passed; no external requests.`);
