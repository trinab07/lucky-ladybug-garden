// A small DOM harness: executes the real assistant entry points without a browser.
const fs=require('node:fs'),vm=require('node:vm'),E=require('../ladybug-engine');
const html=fs.readFileSync('index.html','utf8');
const library=JSON.parse(html.match(/<script id="plant-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
function createUI(){
 const make=()=>({children:[],appendChild(child){this.children.push(child)},scrollIntoView(){}});
 const elements={askQuestion:{value:'',focus(){}},askAssistantResult:{...make(),insertAdjacentHTML(){}},askSavedPlant:{value:''}};
 let lastResult;
 const context={
  Ladybug:{...E,answer(...args){lastResult=E.answer(...args);return lastResult;}},
  db:{plants:[{id:7,name:'Sunny',profile:'Golden Pothos'},{id:8,name:'Spike',profile:'Snake Plant Laurentii'},{id:9,name:'Heart',profile:'Sweetheart Hoya'}]},
  LIB:library,carePlantName:p=>p.name,alphaStrip:x=>x,esc:x=>x,meta:{},
  document:{getElementById:id=>elements[id],createElement:make,createTextNode:text=>({textContent:text}),addEventListener(){}},
  show(markup){context.markup=markup;},openHealthFromAsk(...args){context.handoff=args;}
 };
 context.window=context;vm.createContext(context);
 vm.runInContext(html.match(/<script id="ll-mod-16">([\s\S]*?)<\/script>/)[1],context);
 vm.runInContext(fs.readFileSync('ladybug-ui.js','utf8'),context);
 context.openAskAssistant();
 return {context,elements,select(name){elements.askSavedPlant.value=name;context.selectLadybugPlant(name);},ask(question){elements.askQuestion.value=question;context.runAskAssistant();return lastResult;},lastBot(){return elements.askAssistantResult.children.at(-1);}};
}
module.exports={createUI,library};
