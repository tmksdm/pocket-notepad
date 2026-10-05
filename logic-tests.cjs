const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/index.html','utf8');const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
async function run(stored,deny=false){
 const elements=new Map();let exported,clicked,answer=false;const store=new Map(stored?[['current',stored]]:[]);
 const element=()=>({value:'',textContent:'',disabled:true,hidden:true,events:{},addEventListener(k,f){this.events[k]=f},focus(){},remove(){},click(){clicked=this;}});
 for(const id of ['editor','filename','draft','count','message','save','clear','install','fix'])elements.set(id,element());elements.get('filename').value='Моя заметка';
 const db={close(){},transaction(_,mode){const tx={objectStore(){return {get(key){const req={};queueMicrotask(()=>{req.result=store.get(key);req.onsuccess()});return req},put(v,k){store.set(k,v);queueMicrotask(()=>tx.oncomplete())}}}};return tx}};
 const indexedDB={open(){if(deny)throw Error('blocked');const req={};queueMicrotask(()=>{req.result=db;req.onsuccess()});return req}};
 const c={document:{getElementById:id=>elements.get(id),addEventListener(){},createElement:element,body:{append(){}}},indexedDB,Blob,URL:{createObjectURL(b){exported=b;return 'blob:test'},revokeObjectURL(){}},navigator:{},location:{protocol:'file:'},window:{addEventListener(){}},confirm:()=>answer,setTimeout:()=>1,clearTimeout(){},console};
 vm.runInNewContext(script,c);await new Promise(r=>setImmediate(r));
 return {elements,store,click(id){elements.get(id).events.click()},input(id,value){elements.get(id).value=value;elements.get(id).events.input()},export:()=>exported,download:()=>clicked,confirm(v){answer=v}};
}
(async()=>{
 let app=await run();assert.equal(app.elements.get('editor').disabled,false);
 const text='Книга\nЁж 😀\n\n  отступ\tтабуляция\n<script>test</script>';
 app.input('editor',text);app.input('filename','Книга.txt');app.click('save');assert.equal(await app.export().text(),text);assert.equal(app.download().download,'Книга.txt');await new Promise(r=>setImmediate(r));assert.equal(app.store.get('current').text,text);
 app=await run(app.store.get('current'));assert.equal(app.elements.get('editor').value,text);
 const big='Текст книги 😀\n'.repeat(600000);app.input('editor',big);app.click('save');assert.equal(await app.export().text(),big);console.log('PASS exact export:',Buffer.byteLength(big),'UTF-8 bytes');
 app.confirm(false);app.click('clear');assert.equal(app.elements.get('editor').value,big);app.confirm(true);app.click('clear');assert.equal(app.elements.get('editor').value,'');
 app=await run(undefined,true);assert.match(app.elements.get('draft').textContent,/недоступен/);app.input('editor','Без хранилища');app.click('save');assert.equal(await app.export().text(),'Без хранилища');app.input('filename','../bad:name.txt');app.click('save');assert.equal(app.download().download,'.._bad_name.txt');
 app=await run();const copied='Первый абзац\u2029— Реплика.\u2029Третий.\u2028Строка.\u0085Ещё.';
 app.input('editor',copied);const expected='Первый абзац\n\n— Реплика.\n\nТретий.\nСтрока.\nЕщё.';assert.equal(app.elements.get('editor').value,expected);app.click('save');assert.equal(await app.export().text(),expected);
 app=await run({text:copied,name:'Старый'});assert.equal(app.elements.get('editor').value,expected);
 app.elements.get('editor').value=copied;app.click('save');assert.equal(await app.export().text(),expected);
 app.input('editor','Обычный\nтекст\n\nс абзацем и □ символом.');assert.equal(app.elements.get('editor').value,'Обычный\nтекст\n\nс абзацем и □ символом.');
 console.log('PASS Unicode paragraph/line separators: input, old draft, TXT export; ordinary text unchanged');
 console.log('PASS draft restore, clear confirmation, storage failure fallback, safe filename, no text execution');
})().catch(e=>{console.error(e);process.exit(1)});
