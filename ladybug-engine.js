/* Deterministic, offline Ladybug reasoning. No network or storage access. */
(function(root){
'use strict';
const normalize = value => String(value || '').toLowerCase().replace(/[’‘]/g,"'").replace(/\b(yelow|yello|yeloww)\b/g,'yellow').replace(/\b(leavs|leafs|leves)\b/g,'leaves').replace(/\b(soill|siol)\b/g,'soil').replace(/\b(mushy|mushie)\b/g,'mushy').replace(/\b(webing)\b/g,'webbing').replace(/\b(humidty|humidy)\b/g,'humidity').replace(/\b(pothus|pothosss)\b/g,'pothos').replace(/\b(droopy|drooping)\b/g,'wilting').replace(/\b(dirt)\b/g,'soil');
const word = phrase => new RegExp('\\b'+phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
const patterns = {
 yellow:/\b(?:yellow(?:ing)? (?:old |older |bottom |new )?(?:leaves|leaf|foliage)|(?:leaves|leaf|foliage)\s+(?:(?:are|is|turning|going|looks?|getting|have turned)\s+)*yellow(?:ing)?|yellowing)\b/g,
 brown:/\b(?:brown (?:leaves|leaf|tips|edges|spots)|(?:leaves|leaf|tips|edges) (?:are |is |turning )?brown)\b/g,
 crispy:/\b(crispy|crunchy|scorched)\b/g, wilt:/\b(wilt(?:ing|ed)?|droop|limp)\b/g,
 curl:/\bcurl(?:ing|ed)?\b/g, spots:/\b(?:leaf spots|spots on (?:the )?leaves)\b/g,
 bugs:/\b(bugs?|pests?|mites?|thrips|aphids?|gnats?|mealybugs?|moving specks)\b/g,
 webbing:/\b(webbing|webs)\b/g, sticky:/\bsticky(?: residue)?\b/g,
 mushy:/\b(mushy|squishy|slimy|soft and black)\b/g,
 healthyRoots:/\b(?:(?:firm|healthy|white) (?:and (?:firm|healthy|white) )?roots|roots (?:are |look |feel )?(?:firm|healthy|white))\b/g,
 rot:/\b(?:root )?rot(?:ting)?\b/g,
 slow:/\b(?:slow growth|growth (?:is )?(?:so |really )?slow|(?:isn't|is not) (?:my |the |this )?plant growing|(?:plant )?(?:stopped|stop) growing|growing (?:really )?slow(?:ly)?|barely grows?|not growing|isn't growing|no new growth|stopped growing)\b/g,
 leggy:/\b(leggy|stretching|long gaps)\b/g, drop:/\b(?:dropping|losing|falling) leaves\b/g
};
function polarity(text,match){
 const pre=text.slice(0,match.index).split(/[.!?;]|\bbut\b|\bhowever\b|,\s*(?:still|also)\b|\band\s+(?=(?:the |my )?(?:leaves|soil|roots)\b)/).pop();
 const post=text.slice(match.index+match[0].length,match.index+match[0].length+28);
 if(/\b(?:no|not|never|without|isn't|aren't|don't see|can't see|don't have|doesn't have|free of|neither)\b(?:\W+\w+){0,5}\W*$/.test(pre) || /^\s+(?:are |is )?(?:absent|not present|not there)\b/.test(post))return false;
 if(/\b(?:worried about|could it be|might be|maybe|suspect|thought|mentioned|prevent|avoid)\s+(?:\w+\s+){0,3}$/.test(pre))return null;
 return true;
}
function extract(input, previous={}, names=[]){
 const text=normalize(input), clues={}, uncertain=[];
 for(const [key,re] of Object.entries(patterns)){
  const vals=[...text.matchAll(re)].map(m=>key==='slow'?true:polarity(text,m));
  if(vals.length){clues[key]=vals.includes(true)&&vals.includes(false)&&! /\b(actually|correction|i meant|now)\b/.test(text)?'conflict':vals.at(-1);if(vals.includes(null))uncertain.push(key);}
 }
 // Negation attached to the adjective in a leaf phrase.
 if(/\b(?:leaves|leaf) (?:are |is )?not yellow\b/.test(text))clues.yellow=false;
 const moisture=[],absentMoisture=[];
 for(const m of text.matchAll(/\b(wet|soggy|waterlogged|saturated|dry|bone dry|damp|moist)\b/g)){
  const clause=text.slice(0,m.index).split(/[.!?;]|\bbut\b/).pop();
  const nearby=text.slice(Math.max(0,m.index-35),m.index+35);
  const shortMoistureReply=(previous.pending==='moisture'||previous.facts?.moisture!==undefined)&&text.split(/\s+/).length<10&&!/\b(leaves|leaf|tips|air|humidity)\b/.test(text);
  if(!/\b(soil|mix|potting|root ball|root zone)\b/.test(nearby) && !shortMoistureReply)continue;
  if(/humidity|air/.test(clause)&&! /soil/.test(clause))continue;
  const value=/dry/.test(m[0])?'dry':/damp|moist/.test(m[0])?'moist':'wet';
  if(polarity(text,m)===false){absentMoisture.push(value);continue;}
  if(polarity(text,m)!==true)continue;
  moisture.push(value);
 }
 if(absentMoisture.length)clues.absentMoisture=[...new Set(absentMoisture)];
 if(moisture.length)clues.moisture=[...new Set(moisture)].length>1?'conflict':moisture[0];
 // Depth and corrections explain apparent wet/dry contradictions.
 if(/\bdry (?:only )?(?:on (?:the )?top|at the surface)\b/.test(text)&&/\b(?:wet|damp|moist)\b.{0,15}\b(deeper|below|underneath)\b/.test(text))clues.moisture=/\bwet\b/.test(text)?'wet':'moist';
 if(/\b(actually|correction|i meant)\b/.test(text)&&moisture.length)clues.moisture=moisture.at(-1);
 const deep=/\b(deeper|deep down|root zone|around (?:the )?roots|underneath)\b/;
 if(deep.test(text)&&moisture.length){
  const wetAtDepth=/\b(?:wet|soggy|waterlogged|saturated)\b.{0,40}\b(?:deeper|deep down|around (?:the )?roots|underneath)\b|\b(?:deeper|root zone|around (?:the )?roots)\b.{0,30}\b(?:wet|soggy|waterlogged|saturated)\b/.test(text);
  clues.deepMoisture=wetAtDepth&&moisture.includes('wet')?'wet':moisture.at(-1);
  clues.moisture=clues.deepMoisture;
 }
 if(/\b(?:one|a single|just one|only one)\b.{0,25}\b(?:old|older|bottom)\b.{0,20}\bleaf\b/.test(text))clues.extent='one-old';
 if(/\b(many|most|all|widespread|several|every)\b.{0,25}\b(leaves|yellowing|plant)\b/.test(text))clues.extent='widespread';
 if(/\b(bugs?|pests?|specks|gnats?|mites?|aphids?|thrips|mealybugs?)\b/.test(text)||previous.pending==='pestDetail'){
  const appearance=text.match(/\b(white|black|green|brown|flying|crawling|cottony|winged)\b/g);
  const location=text.match(/\b(?:on|under|underneath|around|above|in) (?:the )?(?:leaf undersides|undersides|leaves|soil(?: surface)?|stems?)\b/);
  if(appearance)clues.pestAppearance=appearance.join(', ');
  if(location)clues.pestLocation=location[0];
 }
 if(previous.pending==='changes' && /\b(no|nothing|none)\b/.test(text))clues.changes=[];
 if(previous.pending==='light' && /\b(window|bright|dark|sun)\b/.test(text))clues.light=text;
 const area=text.match(/\b(roots|stems?|tips|edges|bottom leaves|new leaves|leaf undersides|soil surface)\b/);if(area)clues.area=area[0];
 const light=text.match(/\b(bright indirect|direct sun(?:light)?|low light|dark corner|windowless|no window|(?:north|south|east|west)[ -]facing window)\b/);if(light&&!/\bwhat (?:is|does|counts)\b/.test(text))clues.light=light[0];
 const timing=text.match(/\b(?:since |for |started |last |this )?(?:\d+ (?:days|weeks|months)|yesterday|today|winter|summer|week|month)\b/);if(timing)clues.timing=timing[0];
 const changes=text.match(/\b(repot(?:ted|ting)?|moved|fertilized|brought home|new pot|knocked over|uprooted)\b/g);if(changes)clues.changes=changes;
 if(/\b(?:no recent changes|nothing (?:has )?changed|haven't changed anything)\b/.test(text))clues.changes=[];
 if(/\b(?:no|without) drainage holes?\b|\bdoesn't drain\b/.test(text))clues.drainage=false;
 else if(/\b(?:has|with|there are) (?:a )?drainage holes?\b|\bdrains (?:well|freely)\b/.test(text))clues.drainage=true;
 if(/\b(?:single leaf|leaf cutting|stem cutting|started (?:as|from) a cutting|came from a cutting)\b/.test(text))clues.cutting=true;
 if(/\b(?:not a cutting|not from a cutting|mature plant|established plant)\b/.test(text))clues.cutting=false;
 if(/\bno (?:stem )?node\b|\bwithout a node\b/.test(text))clues.node=false;
 else if(/\b(?:has|with|includes?) (?:a |one )?(?:stem )?node\b/.test(text))clues.node=true;
 if(previous.pending==='roots'||previous.pending==='rootCondition'){
  if(/\bfirm\b/.test(text)&&! /\bnot firm\b/.test(text))clues.healthyRoots=true;
  if(/\b(?:all|only)\b.*\bfirm\b/.test(text))clues.mushy=false;
  if(/\bsome\b.*\b(?:soft|mushy)\b.*\b(?:others|rest)\b.*\bfirm\b/.test(text)){clues.mixedRoots=true;clues.mushy=true;clues.healthyRoots=true;}
 }
 if(previous.pending==='drainage'&&/^(?:yes|yeah|yep)\b/.test(text))clues.drainage=true;
 if(previous.pending==='drainage'&&/^(?:no|nope|nah)\b/.test(text))clues.drainage=false;
 if(previous.pending==='node'&&/^(?:yes|yeah|yep)\b/.test(text))clues.node=true;
 if(previous.pending==='node'&&/^(?:no|nope|nah)\b/.test(text))clues.node=false;
 const known=[...names,'rubber plant','snake plant','zz plant','peace lily','spider plant','hoya','pothos','monstera','philodendron','calathea','alocasia','orchid','fern','cactus','succulent','begonia','peperomia','ficus','jade','pilea','ivy'].filter(Boolean).sort((a,b)=>b.length-a.length);
 const plant=known.find(n=>word(normalize(n)).test(text));
 const focused=launchTopics(text);
 const named=[];
 for(const pest of pestNames){if(pest==='scale'&&/\b(?:weigh|scale up|scale of|on a scale|kitchen scale)\b/.test(text))continue;const m=new RegExp('\\b'+pest.replace(/s$/,'s?')+'\\b').exec(text);if(m){const sign=polarity(text,m);if(sign===true)named.push(pest);else if(previous.facts?.namedPest===pest)clues.namedPest=null;}}
 if(named.length){clues.namedPest=named.sort((a,b)=>b.length-a.length)[0];clues.bugs=true;}
 if(/\b(?:stems?|crown) (?:are |is |feel |feels )?(?:firm|green|alive)\b|\b(?:firm|green|living) (?:stems?|crown|tissue)\b/.test(text))clues.livingTissue=true;
 if(/\b(?:stems?|crown) (?:are |is )?(?:mushy|dead|brittle)\b/.test(text))clues.livingTissue=false;
 if(/\b(?:regrown|new leaves now|has leaves now|no longer leafless)\b/.test(text))clues.leafless=false;
 else if(focused.includes('leafless'))clues.leafless=true;
 const sunHours=text.match(/\b(\d+(?:\.\d+)?) hours? (?:of )?(?:direct )?sun/);if(sunHours)clues.sunHours=Number(sunHours[1]);if(/\b(?:no|not in|doesn't get|does not get) direct sun\b/.test(text)){clues.sunHours=0;if(clues.light==='direct sun'||clues.light==='direct sunlight')delete clues.light;}
 const temperature=text.match(/\b(\d{1,3})\s*(?:°\s*)?(f|c|fahrenheit|celsius)\b/i);if(temperature)clues.temperature=temperature[1]+' '+temperature[2].toUpperCase();
 if(previous.pending==='livingTissue'&&/\b(firm|green|alive)\b/.test(text))clues.livingTissue=true;
 const careIntent=/\b(how|when|should|what|can|does|do|need|best|safe)\b/.test(text);
 const currentSymptoms=Object.entries(clues).some(([k,v])=>k in patterns && !['rot','healthyRoots'].includes(k)&&v===true);
 // A proposed care action or a question about light is not an observation.
 if(careIntent&&!currentSymptoms){
  if(!/\b(gets?|receives?|sits? in|is in|keep it in|have it in|it has)\b/.test(text))delete clues.light;
  if(!/\b(repotted|moved|fertilized|brought home|knocked over|uprooted)\b/.test(text))delete clues.changes;
  if(!/\b(?:it is|it's|it was|started as|started from|came from|i have|has)\b/.test(text))delete clues.cutting;
 }
 return {text,clues,plant,uncertain,focused,intent:currentSymptoms?'troubleshooting':careIntent?'care':Object.keys(clues).length?'followup':'unknown', correction:/\b(actually|correction|i meant|sorry|instead|now|not .+ anymore)\b/.test(text)};
}
function createSession(plant=''){return {plant,facts:{},asked:[],pending:null,turns:[],topic:null};}
const questions={livingTissue:'Are the stems or crown still firm, with any green living tissue?',sunHours:'How many hours of direct sunlight reach the leaves?',temperature:'What are the lowest overnight temperatures where you would put it?',moisture:'Does the soil feel wet, lightly moist, or dry below the surface?',extent:'Is it one older leaf or several leaves across the plant?',pestDetail:'What do the bugs look like, and where are you seeing them?',light:'What light does it get during the day?',timing:'When did this start?',changes:'Has anything changed recently, such as watering, location, or repotting?',roots:'If the roots are already visible, do they feel firm or mushy?',symptoms:'What change are you seeing in the plant?',drainage:'Does the pot have drainage holes?',node:'Does the cutting include a stem node—the small bump where a leaf joins the stem?',plant:'What is the plant’s name?'};

// A broad plant name only inherits guide fields shared by all matching varieties.
function resolveProfile(plant,library=[]){
 const name=normalize(plant);if(!name)return {};
 const exact=library.find(p=>normalize(p.name)===name);if(exact)return exact;
 const matches=library.filter(p=>word(name).test(normalize(p.name)));
 const profile={};
 for(const key of ['light','humidity','soilCheck','soil','fertilizer','petNote']){
  if(matches.length&&matches.every(p=>p[key]&&p[key]===matches[0][key]))profile[key]=matches[0][key];
 }
 return profile;
}
function samePlantName(a,b,aliases={}){
 const left=normalize(aliases[a]||a),right=normalize(aliases[b]||b);
 return !!left&&!!right&&(word(left).test(right)||word(right).test(left));
}
const careTopics={
 light:/\b(light|sun|sunlight|window|bright indirect)\b/,
 humidity:/\b(humidity|humid|dry air|mist|misting)\b/,
 watering:/\b(water|watering)\b/,
 fertilizer:/\b(fertiliz\w*|feed|feeding)\b/,
 repot:/\b(repot\w*|pot size|bigger pot|new pot)\b/,
 soil:/\b(soil|mix)\b/,
 propagation:/\b(propagat\w*|cutting|nodes?|rooting)\b|\bhow long\b.*\broots?\b/,
 rotation:/\b(rotate|rotation)\b/,
 cleaning:/\b(dust|dusty|clean|wipe)\b/,
 pets:/\b(toxic|pet|cat|dog|poisonous|pet-safe)\b/,
 winter:/\b(winter|dormancy)\b/
};
function topicsFor(text){
 const clauses=text.split(/(?<=[.!?])\s+/);
 const requests=clauses.filter(clause=>/^(?:and |what |how |when |can |should |do |does |also,? )/.test(clause)||clause.endsWith('?'));
 const request=requests.length?requests.join(' '):text;
 let topics=Object.keys(careTopics).filter(k=>careTopics[k].test(request));
 if(topics.includes('watering')&&/\b(?:wet|dry|moist|soggy) soil\b|\bsoil is\b/.test(request)&&! /\b(?:what|which)\b.*\bsoil\b/.test(request))topics=topics.filter(k=>k!=='soil');
 // Water/soil describe the propagation method unless separately requested.
 if(topics.includes('propagation')&&!/\b(?:also|and how|how often|when should).*(?:water|soil)\b/.test(text))return topics.filter(k=>!['watering','soil'].includes(k));
 return topics;
}
const pestNames=['root mealybugs','spider mites','fungus gnats','mealybugs','whiteflies','aphids','thrips','scale'];
function launchTopics(text){
 const topics=[];
 if(/\b(?:no leaves|leafless|lost (?:all (?:of )?(?:its |the |my )?leaves|every leaf)|losing every leaf)\b/.test(text))topics.push('leafless');
 if(/\b(?:outside|outdoors)\b/.test(text))topics.push('outdoors');
 if(/\b(?:new leaves (?:are )?smaller|(?:new growth|new leaves) (?:is |are )?(?:smaller|tiny)|(?:putting out|growing) tiny leaves)\b/.test(text))topics.push('smallLeaves');
 if(/\boverwater\w*\b/.test(text)&&/\bunderwater\w*\b/.test(text)||/\btoo much water\b.*\btoo little\b|\btoo wet or (?:too )?dry\b/.test(text))topics.push('comparison');
 if(/\b(?:too much (?:light|sun)|too bright|sunburn(?:ed|t)?|scorched by (?:light|sun)|direct sun(?:light)?)\b/.test(text))topics.push('excessLight');
 return topics;
}
function launchResponse(topic,profile,session,ask,options,text){
 const f=session.facts,name=session.plant,species=normalize(profile.name||options.aliases?.[name]||name);
 if(topic==='namedPest'){
  const guide=(options.pests||[]).find(p=>normalize(p.pest)===f.namedPest);
  if(!guide)return 'You named '+f.namedPest+'. Use its entry in the app’s Pest & Problem Guide for the matching treatment and follow-up instructions.';
  return 'For '+guide.pest.toLowerCase()+', the local guide says: '+guide.response+' '+guide.followup;
 }
 if(topic==='comparison')return 'Overwatering and underwatering can both cause yellowing or wilting, so leaves alone cannot settle it. Soil that stays wet, wilting despite wet soil, or soft roots points toward excess moisture. Very dry soil, a noticeably lighter pot, and limp, curled or crispy foliage points toward thirst. Check below the surface before watering.'+(f.moisture==='wet'?' You already described wet soil, so hold off on watering.':f.moisture==='dry'?' You already described dry soil, which makes thirst more plausible.':/\b(?:my plant|am i|i'm|i am)\b/.test(text)?ask('moisture'):'' );
 if(topic==='leafless'){
  if(f.leafless===false)return 'New leaves are an encouraging sign of recovery. Keep conditions steady and check soil moisture before watering; avoid extra fertilizer to rush growth.';
  let answer='Losing every leaf does not by itself mean a plant is dead. Recovery depends on the plant and whether its roots and growing points are still alive. ';
  if(f.healthyRoots===true||f.mushy===false)answer+='The firm roots you described are encouraging. ';
  if(f.livingTissue===true)answer+='Firm, green tissue is another encouraging sign. ';
  if(f.livingTissue===false||f.mushy===true)answer+='Soft or dead tissue is more concerning; avoid assuming that extra water or fertilizer will revive it. ';
  answer+='Keep any firm living parts intact, check soil moisture, and avoid extra watering to force new leaves.';
  return answer+ask('plant','livingTissue','roots');
 }
 if(topic==='outdoors'){
  let answer=(name?name+' may be able to spend time outdoors in suitable weather. ':'Outdoor suitability depends on the plant. ');
  answer+='Outdoor sun is much stronger than indoor light. Start in a sheltered, shaded spot and increase exposure gradually; avoid a sudden move into direct sun. ';
  if(profile.light)answer+='Its guide recommends '+profile.light.replace(/[.]$/,'').toLowerCase()+'. ';
  if(f.light)answer+='Since it currently gets '+f.light+', make the transition gradually. ';
  answer+='Check that overnight temperatures suit the species before moving it.';
  if(f.temperature)answer+=' Your reported '+f.temperature+' should be compared with that plant’s temperature needs.';
  return answer+ask('plant','temperature');
 }
 if(topic==='smallLeaves'){
  let answer='Smaller new leaves can reflect low light, root stress, limited nutrients, or a recent change in growing conditions. ';
  if(f.changes?.length)answer+='The recent '+f.changes.join(' or ')+' may be relevant. ';
  if(f.light)answer+='You described '+f.light+'; compare that with the plant’s usual light needs. ';
  if(/pothos|monstera|climbing philodendron/.test(species))answer+='For this climbing plant, suitable support can also help leaves mature. ';
  answer+='Check growing conditions before adding extra fertilizer.';
  return answer+ask('plant','light','moisture');
 }
 if(topic==='excessLight'){
  let answer='Bright indirect light is different from direct sun falling on the leaves. Sudden or prolonged direct exposure can scorch an unacclimated plant, but brightness alone does not prove light damage. ';
  if(profile.light)answer+='The guide for '+name+' recommends '+profile.light.replace(/[.]$/,'').toLowerCase()+'. ';
  if(f.light)answer+='You described '+f.light+'. ';
  if(f.sunHours!==undefined)answer+='With '+f.sunHours+' hours of direct sun, acclimation and the species’ needs matter. ';
  answer+='Look for damage concentrated on the sun-facing side; protect it from harsh rays if damage appeared after an increase in exposure.';
  return answer+ask('plant','sunHours');
 }
 return '';
}
function answer(input,session=createSession(),options={}){
 const previousPending=session.pending;
 const c=extract(input,session,options.names||[]);
 if(/^(?:thanks|thank you|thank you so much|thanks ladybug|ok thanks|okay thanks)[.! ]*$/.test(c.text)){
  const response='You’re welcome!';session.turns.push({user:input,answer:response});
  return {response,intent:session.topic?.kind||'care',facts:{...session.facts},plant:session.plant,possibilities:[],followup:null,health:false};
 }
 const samePlant=c.plant&&session.plant&&samePlantName(c.plant,session.plant,options.aliases);
 if(c.plant && session.plant && !samePlant)Object.assign(session,createSession(c.plant));
 if(samePlant&&(options.aliases?.[session.plant]||normalize(session.plant).length>normalize(c.plant).length))c.plant=session.plant;
 if(c.plant)session.plant=c.plant;
 let topics=topicsFor(c.text);
 let focused=c.focused;
 if(c.clues.namedPest)focused=[...focused,'namedPest'];


 const explicitCare=/\b(?:how|when|should|can|do|does)\b[^.!?]{0,50}\b(?:water(?:ing)?|fertiliz\w*|feed|repot\w*|propagat\w*|rotate|mist|clean|wipe)\b|\b(?:what|which)\s+(?:kind of |type of )?(?:light|humidity|soil|fertilizer|mix)\b/.test(c.text);
 const directCare=(explicitCare||c.intent==='care'||(c.intent!=='troubleshooting'&&(/^(?:and |what about |how about |also,? )/.test(c.text)||c.text.endsWith('?'))))&&topics.length>0;
 if(!focused.length&&session.topic?.kind==='focused'&&!directCare&&(Object.keys(c.clues).length||c.plant))focused=session.topic.topics.filter(t=>t!=='namedPest'||c.clues.namedPest!==null);
 const careFollow=session.topic?.kind==='care'&&!directCare&&c.intent!=='troubleshooting'&&((session.pending==='plant'&&c.plant)||(session.pending==='node'&&c.clues.node!==undefined));
 const isNewCare=directCare||careFollow;
 if(careFollow)topics=session.topic.topics;
 // Keep known conditions when the user changes care topics. Care replies simply
 // do not diagnose old symptoms, and old conflicts do not interrupt a care answer.
 if(focused.length)session.topic={kind:'focused',topics:focused};
 else if(directCare)session.topic={kind:'care',topics};
 else if(!isNewCare)session.topic={kind:'troubleshooting'};
 if(c.correction){
  if(c.clues.healthyRoots===true&&c.clues.mushy===undefined){session.facts.mushy=false;delete session.facts.mixedRoots;}
  if(c.clues.mushy===true&&c.clues.healthyRoots===undefined){session.facts.healthyRoots=false;delete session.facts.mixedRoots;}
 }
 if(c.clues.absentMoisture?.includes(session.facts.moisture)&&c.clues.moisture===undefined)delete session.facts.moisture;
 if(c.clues.absentMoisture?.includes(session.facts.deepMoisture)&&c.clues.deepMoisture===undefined&&(c.correction||/\b(deeper|root zone)\b/.test(c.text)))delete session.facts.deepMoisture;
 if(c.correction&&c.clues.moisture&&c.clues.deepMoisture===undefined&&!/\b(top|surface)\b/.test(c.text))delete session.facts.deepMoisture;
 Object.assign(session.facts,c.clues);
 if(session.facts.deepMoisture==='wet')session.facts.moisture='wet';
 const f=session.facts, yes=k=>f[k]===true;
 const profile={...resolveProfile(options.aliases?.[session.plant]||session.plant,options.library),...(options.profile||{})};
 const known=k=>k==='plant'?!!session.plant:k==='roots'?(f.healthyRoots!==undefined||f.mushy!==undefined):k==='pestDetail'?!!(f.pestAppearance&&f.pestLocation):k==='symptoms'?Object.keys(patterns).some(p=>yes(p)):f[k]!==undefined;
 let follow=null,followText='';
 const ask=(...keys)=>{const k=keys.find(k=>!known(k)&&!session.asked.includes(k));if(k&&!follow){session.asked.push(k);follow=k;followText=questions[k];if(k==='pestDetail'){if(f.pestLocation)followText='What do the bugs look like?';else if(f.pestAppearance)followText='Are they on the leaves or around the soil?';}if(k==='moisture'&&f.absentMoisture?.includes('wet'))followText='Does the soil feel lightly moist or dry below the surface?';}return '';};
 let response='',possibilities=[];
 if(yes('healthyRoots')&&yes('mushy')&&!yes('mixedRoots'))f.rootCondition='conflict';else delete f.rootCondition;
 const conflicts=Object.keys(f).filter(k=>f[k]==='conflict');
 if(focused.length&&(!conflicts.length||focused.includes('comparison'))){
  response=focused.map(topic=>launchResponse(topic,profile,session,ask,options,c.text)).filter(Boolean).join(' ');
  const additional=topics.filter(t=>!(t==='light'&&focused.some(x=>['excessLight','outdoors'].includes(x)))&&!(t==='watering'&&focused.includes('comparison')));
  if(additional.length)response+=' '+care(c.text,profile,session,ask,additional);
 }
 else if(isNewCare){response=care(c.text,profile,session,ask,topics);}
 else if(conflicts.length){const key=conflicts[0],id='conflict:'+key;response='Those details point in different directions, so I would hold off on treatment.';if(!session.asked.includes(id)){session.asked.push(id);follow=key;followText=key==='moisture'?'Is the soil dry only on top, or also deeper around the roots?':key==='rootCondition'?'Are some roots soft while others are firm, or do all the roots feel firm now?':'Are you still seeing '+({bugs:'bugs',webbing:'webbing',yellow:'yellow leaves',mushy:'soft, mushy tissue'}[key]||'that change')+' now?';}}
 else {
 const leaf=yes('yellow')||yes('wilt')||yes('drop');
 const candidates=[
 ['pests',(yes('bugs')?5:0)+(yes('webbing')?2:0)+(yes('sticky')?2:0)],
 ['root damage',yes('mushy')&&(!yes('healthyRoots')||yes('mixedRoots'))&&(f.moisture==='wet'||f.area==='roots')?7:0],
 ['watering stress',leaf&&f.moisture==='wet'?4:0],
 ['dryness', (leaf||yes('crispy')||yes('curl'))&&f.moisture==='dry'?4:0],
 ['normal leaf aging',yes('yellow')&&f.extent==='one-old'&&!yes('bugs')&&f.moisture!=='wet'?5:0],
 ['light stress',(yes('crispy')||yes('brown'))&&f.light==='direct sun'?4:0],
 ['adjustment stress',leaf&&f.changes?.some(x=>/repot|moved|brought/.test(x))?3:0]
 ].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);possibilities=candidates.map(x=>x[0]);
 const top=possibilities[0];
 if(top==='pests'){
  response=(yes('bugs')?'The bugs are worth a closer look'+(yes('yellow')?' and could be related to the yellowing':'')+'. ':'The '+(yes('webbing')?'webbing':'sticky residue')+' is worth checking for pests. ')+(f.pestLocation&&/soil/.test(f.pestLocation)?'Check the soil surface and nearby leaves to see where they gather. ':'Inspect the undersides of leaves. ')+'Keep the plant apart while you identify them, and wait to choose a spray until you know what they are.'+ask('pestDetail');
  if(previousPending==='pestDetail'&&f.pestAppearance&&f.pestLocation)response='That helps: you are seeing '+f.pestAppearance.replace(/, /g,' and ')+' bugs '+f.pestLocation+'. Check them with a magnifier before choosing a treatment, and keep the plant apart for now.';
 }
 else if(top==='root damage')response='Soft, decaying roots suggest root damage. If the roots are already exposed, remove only clearly soft, decaying parts with clean tools and keep the firm roots. Make sure the pot drains before watering again.';
 else if(top==='normal leaf aging')response='One older yellow leaf can be normal leaf aging if the rest of the plant looks healthy. Watch for spreading yellowing before changing care.';
 else if(top==='watering stress'){
  response='The wet soil could be stressing the roots and contributing to the '+(yes('yellow')?'yellowing':'wilting')+'. '+wateringWait(profile,f)+(f.drainage===false?' Use a pot with drainage holes so excess water can escape.':' Empty any water left in the saucer.')+ask('drainage');
  if(previousPending==='drainage'&&c.clues.drainage!==undefined)response=(f.drainage?'Good, excess water has a way out. Empty the saucer after watering. ':'Without drainage holes, water can collect around the roots. Use a pot with drainage holes so excess water can escape. ')+wateringWait(profile,f);
 }
 else if(top==='dryness')response='The dry soil makes thirst a likely cause of the '+(yes('wilt')?'drooping':yes('yellow')?'yellowing':'leaf changes')+'. Water thoroughly and let excess drain. '+(yes('wilt')?'Watch for the leaves to perk up; ':'')+'Damaged leaves may not recover.';
 else if(top==='light stress')response='The direct sun could be scorching the leaves. Move it out of harsh rays and watch whether new leaves stay healthy.';
 else if(top==='adjustment stress')response='The recent move or repotting could explain some leaf stress. Keep conditions steady while checking moisture; avoid adding fertilizer during recovery.'+ask('moisture');
 else if(yes('slow')||yes('leggy')){
  response=/hoya/i.test(session.plant)?'Hoyas can take their time between bursts of growth. ':'Growth often comes in bursts. ';
  if(f.cutting===true&&/hoya|pothos|monstera|ficus|rubber|philodendron/i.test(session.plant))response+=f.node===false?'Without a stem node or growth point, that rooted leaf may stay alive without making new shoots.':'Since it started as a cutting, a stem node or growth point is needed for new shoots.'+ask('node');
  else response+=f.light&&/low light|dark|windowless|no window/.test(f.light)?'The low light could be slowing it down. Try a brighter spot with indirect light.':f.light?'Keep its light steady and avoid extra water or fertilizer to force growth.':'Light is a useful thing to check before changing watering or feeding.';
  if(f.timing&&/winter/.test(f.timing))response+=' Slower growth in winter is common.';
  if(!follow&&f.cutting!==true)ask('light');
 }
 else if(yes('yellow'))response='Yellow leaves can come from watering changes or older leaves naturally fading.'+(f.moisture==='moist'?' Lightly moist soil does not point clearly to overwatering or thirst.':'')+ask('moisture','extent');
 else if(yes('crispy')||yes('brown')||yes('curl')||yes('wilt')||yes('drop')||yes('spots'))response='Moisture and light are useful checks for these leaf changes. '+(f.moisture==='moist'?'Since the soil is lightly moist, avoid adding more water just to fix the leaves.':'')+ask('moisture','light');
 else if(yes('healthyRoots'))response='Firm, healthy roots make active root rot less likely. Keep those roots intact and continue normal care while watching for changes.';
 else if(yes('rot')||c.uncertain.includes('rot'))response=f.mushy===false?'The roots not being mushy is reassuring. Keep them intact and check the soil before watering again.':'Soft, decaying roots would be more concerning for rot than leaf color alone. Leave firm roots intact.'+ask('roots');
 else if(Object.keys(patterns).some(k=>f[k]===false))response='Those signs are absent, which is useful to know. Keep care steady and watch for any new changes.';
 else response='Tell me a little more about what you would like help with.'+ask('symptoms');
 if(yes('healthyRoots')&&top&&top!=='root damage')response='Firm, healthy roots make active root rot less likely. Keep those roots intact. '+response;
 if(possibilities.length>1 && top!=='normal leaf aging'){
  const extra={'watering stress':'The wet soil could also be contributing, so let it dry before watering again.','dryness':'The dry soil may also be contributing; check it before watering.','adjustment stress':'The recent move or repotting may also be part of the adjustment.','light stress':'Harsh direct sun may also be affecting the leaves.'};
  if(extra[possibilities[1]])response+=' '+extra[possibilities[1]];
 }
 }
 if(followText)response+=' '+followText;
 session.pending=follow;session.turns.push({user:input,answer:response});
 return {response,intent:focused.length?(focused.some(t=>['leafless','smallLeaves','namedPest'].includes(t))?'troubleshooting':'care'):isNewCare?'care':'troubleshooting',facts:{...f},plant:session.plant,possibilities,followup:follow,health:(focused.includes('leafless')&&f.leafless!==false)||focused.includes('smallLeaves')||!isNewCare&&Object.entries(patterns).some(([k])=>!['healthyRoots','rot','slow','leggy'].includes(k)&&yes(k))};
}
function wateringWait(profile,facts={}){
 if(facts.deepMoisture==='wet')return 'Since it is still wet deeper around the roots, do not water yet. Check moisture deeper in the root zone again before watering; a dry surface alone is not enough.';
 if(facts.moisture==='wet')return 'Do not water while the soil is still wet. Check deeper around the roots before watering again, even if the surface has dried.';
 const check=profile.soilCheck||'';
 if(/top /i.test(check))return 'Check the soil and wait until the '+check.replace(/^check when (?:the )?/i,'').replace(/;.*$/,'').replace(/\bin\b/,'inches')+' before watering again.';
 if(/completely/i.test(check))return 'Check the soil for moisture and let it dry completely before watering again.';
 if(/most/i.test(check))return 'Check the soil and let most of it dry before watering again.';
 if(/lightly moist/i.test(check))return 'Keep the soil lightly moist, but wait to water while it is soggy.';
 if(/surface begins/i.test(check))return 'Water when the soil surface begins to dry, after checking below it for excess moisture.';
 if(/root\/media/i.test(check))return 'Check the roots and potting medium before watering; use their condition rather than a calendar.';
 return 'Check below the soil surface and give it time to dry before watering again.';
}
function care(t,p,s,ask,topics){
 const name=s.plant, label=name?name[0].toUpperCase()+name.slice(1):'Your plant';
 const species=normalize(p.name||name);
 const pothos=/\bpothos\b/.test(species);
 const sentence=value=>String(value).replace(/[.;]$/,'')+'.';
 const sections=[];
 // Reply functions run only for the requested topics; unused templates cannot ask questions.
 const replies={
 light:()=>{
  if(pothos)return 'Give your pothos bright indirect light. It tolerates lower light, though variegation may fade. Avoid harsh direct sun.';
  if(p.light){
   const parts=p.light.split(';').map(x=>x.trim());const primary=parts[0].replace(/indirect$/i,'indirect light');
   let detail=parts[1]||'';
   if(/^tolerates|^grows/.test(detail))detail='It '+detail;
   detail=detail.replace(/^no harsh direct sun$/,'Avoid harsh direct sun').replace(/^no direct sun/,'Avoid direct sun').replace(/^some gentle direct sun$/,'A little gentle direct sun is fine').replace(/^gentle direct sun helpful$/,'A little gentle direct sun can help').replace(/^several hours direct sun$/,'Give it several hours of direct sun').replace(/bright indirect$/,'bright indirect light');
   return label+' does well in '+sentence(primary[0].toLowerCase()+primary.slice(1))+(detail?' '+sentence(detail[0].toUpperCase()+detail.slice(1)):'');
  }
  return 'Bright indirect light means a bright spot without strong direct rays on the leaves.'+(name?'':' A windowless room needs a suitable grow light.');
 },
 humidity:()=>{
  if(pothos)return 'Pothos usually handles ordinary household humidity well; around 40–60% is a comfortable range.'+(/\bmist/.test(t)?' Misting is usually unnecessary and raises humidity only briefly.':'');
  if(p.humidity){const range=p.humidity.match(/\d+[–-]\d+%/);return (range?'Aim for roughly '+range[0]+' humidity for '+(name||'this plant')+'.':'Ordinary household humidity is suitable. Keep it away from drafts.')+(/\bmist/.test(t)?' Misting changes humidity only briefly.':'');}
  return name?'I do not have a humidity range for '+name+' in the guide. A room humidity reading will help you compare it with a species-specific care label.':'Humidity needs vary between plants.'+ask('plant');
 },
 watering:()=>{
  if(s.facts.moisture==='wet')return wateringWait(p,s.facts);
  return (p.soilCheck?wateringWait(p):pothos?'Let the top 1–2 inches of soil dry before watering.':'Check moisture below the surface before watering, rather than using a fixed calendar.')+' Then water thoroughly and let excess drain.';
 },
 fertilizer:()=>{
  const routine=p.fertilizer?'Feed '+(name||'it')+' '+sentence(p.fertilizer[0].toLowerCase()+p.fertilizer.slice(1)).replace('spring/summer','spring and summer')+' Follow the fertilizer label for dilution and apply to moist soil.':'Feed during active growth, following the fertilizer label for dilution. Apply to moist soil.';
  return s.facts.moisture==='wet'&&(s.facts.yellow===true||s.facts.wilt===true)?'Once it is growing normally again, you can '+routine[0].toLowerCase()+routine.slice(1):routine;
 },
 repot:()=> 'Repot when roots crowd the container or the mix no longer drains well. Choose a pot only slightly larger, with drainage holes.',
 soil:()=>p.soil?'Use '+(/^[aeiou]/i.test(p.soil)?'an ':'a ')+sentence(p.soil[0].toLowerCase()+p.soil.slice(1)):pothos?'Use an airy, well-draining potting mix for your pothos.':name?'Choose a potting mix labeled for '+name+' and a pot with drainage holes.':'The right mix depends on how much moisture the plant needs to hold.'+ask('plant'),
 propagation:()=>{
  if(/\bhow long\b|\bwhen\b.*\broots?\b/.test(t))return 'Rooting time varies with light, warmth, and the cutting. Look for several healthy roots before potting '+(name?'your '+name+' cutting':'the cutting')+', rather than using a fixed deadline.';
  if(pothos)return 'For pothos, cut a healthy vine just below a node—the bump where a leaf joins the stem. Remove the lowest leaf and place that node in water, keeping the remaining leaves above it. Give it bright indirect light, refresh the water regularly, and pot it into a draining mix once several roots have developed.';
  if(name&&/hoya|monstera|philodendron/.test(species))return 'For '+name+', take a healthy stem cutting with a node and a leaf. Keep the node in water or a lightly moist rooting mix, with the leaf above it, in bright indirect light. Move it to a draining potting mix once roots are established.';
  if(!name)return 'The best propagation method depends on the plant.'+ask('plant');
  return 'I do not have a reliable propagation method for '+name+' in the local guide. Check a guide for that species before cutting it.';
 },
 rotation:()=> 'Turn the pot a little periodically for even growth, keeping its light exposure consistent.',
 cleaning:()=> 'Wipe dusty leaves gently with a soft damp cloth. Avoid leaf-shine products.',
 pets:()=>p.petNote?label+' is listed as '+sentence(p.petNote.toLowerCase()):name?'The local guide does not list pet safety for '+name+'. Keep it out of reach until you can confirm.':'Pet safety depends on the plant.'+ask('plant'),
 winter:()=> 'Growth often slows in winter. Check soil moisture before watering instead of keeping a summer schedule.'
 };
 for(const topic of topics)if(replies[topic])sections.push(replies[topic]());
 return sections.length?sections.join(' '):'I can help with watering, light, humidity, soil, feeding, repotting, or propagation.';
}
const api={normalize,extract,createSession,answer,resolveProfile,samePlantName};if(typeof module!=='undefined')module.exports=api;else root.Ladybug=api;
})(typeof window==='undefined'?globalThis:window);
