// Review scenarios are also exercised by the automated suite. Replies are generated, not hand-written.
module.exports=[
 {title:'Pothos humidity, then light and watering',turns:[
  'Can my pothos handle low humidity?','What about light?','How should I water it?']},
 {title:'Several care topics in one message',turns:[
  'What light and humidity does my pothos need?','And what soil and fertilizer should I use?']},
 {title:'Pothos propagation and rooting follow-up',turns:[
  'How do I propagate pothos?','How long until roots grow?']},
 {title:'Firm roots after a root-rot worry',turns:[
  'I thought root rot, but roots are firm and healthy, not mushy.','How should I water my pothos?']},
 {title:'Yellow leaves, then a dry-soil answer',turns:[
  'My pothos has yellow leaves.','Dry','What light does it need?']},
 {title:'Wet soil and a short drainage answer',turns:[
  'My pothos has yellow leaves and wet soil.','Nope','How often should I water it?']},
 {title:'A moisture correction changes the advice',turns:[
  'My pothos has yellow leaves and dry soil.','Actually the soil is wet. It has drainage holes.','What humidity does it need?']},
 {title:'Negated pests and one aging leaf',turns:[
  'My pothos has yellow leaves. No bugs, no webbing, not sticky.','The soil is lightly moist. Just one old yellow leaf.','Should I rotate it?']},
 {title:'Yellow leaves and visible bugs',turns:[
  'My pothos has yellow leaves and tiny bugs on the leaves.','They are black and crawling.','Actually no bugs now, still yellow leaves.']},
 {title:'Multiple symptoms with wet soil',turns:[
  'My pothos has yellow leaves, is droopy, and the soil is wet.','Yes, it has drainage holes.','The roots are firm and healthy, not mushy.']},
 {title:'Wet and dry clues clarified by depth',turns:[
  'My pothos has yellow leaves and the soil is wet and dry.','Dry on top but wet deeper down.','Yep, it drains freely.']},
 {title:'Conflicting root clues corrected',turns:[
  'The roots are firm but some roots are mushy.','Actually all roots are firm and healthy.','Could it still be root rot?']},
 {title:'Slow Hoya growth without an invented cutting',turns:[
  'My hoya is growing really slow.','It gets bright indirect light. It is winter.','What humidity does it need?']},
 {title:'A cutting history makes node advice relevant',turns:[
  'My hoya is growing really slow. It started as a leaf cutting.','No node.','What light does it need?']},
 {title:'Casual wording and simple typos',turns:[
  'My pothus has yelow leavs and wet siol.','Yeah, it has drainage holes.','And humidty?']},
 {title:'Changing from troubleshooting to routine care',turns:[
  'My pothos has yellow leaves and wet soil. It drains freely.','How often should I fertilize it?','How should I water it?']},
 {title:'Changing to another plant',turns:[
  'My pothos has yellow leaves and wet soil.','What humidity does my calathea need?','And light?']},
 {title:'Selecting a saved plant and using its profile',turns:[
  {select:'Sunny'},'How should I water it?','What light and humidity does it need?']},
 {title:'Switching saved plants clears the earlier problem',turns:[
  {select:'Sunny'},'Yellow leaves and wet soil.',{select:'Spike'},'How should I water it?','What light does it need?']},
 {title:'A saved nickname, a species reference, and Health Concern handoff',turns:[
  {select:'Sunny'},'Yellow leaves and wet soil.','How should I water my pothos?','Still yellow leaves. The pot has drainage holes.']}
];
