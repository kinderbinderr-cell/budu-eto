// Send only the chosen kitchen tasks. The chat receives no nutritional targets or shopping data.
function reminderPacket(flags) {
  const ids=[], indexes=new Map(), rows=[];
  const index=r=>{
    if (!indexes.has(r.id)) { indexes.set(r.id,ids.length); ids.push(r.id); }
    return indexes.get(r.id);
  };
  const first=openingWeek(settings());
  let current=plan(null,first),version=1;
  for(let w=first;w<first+3;w++) {
    const next=kitchenNextWeek(w);
    if (current) {
      const profile=weekProfile(w),week=kitchenWeek(profile,current,next,w);
      for (const tasks of week) {
        const cooking=(flags&1)?[...tasks.cook.values()].flatMap(t=>{
          const pending=t.uses.filter(u=>!u.completed);
          if(!pending.length)return [];
          const frozen=pending.filter(u=>u.storage==="freeze");
          const people=uses=>uses.reduce((n,u)=>n+u.people,0);
          const halves=uses=>uses.reduce((n,u)=>n+u.halfPeople,0);
          const row=[index(t.r),people(pending),people(frozen)];
          if(halves(pending)){version=2;row.push(halves(pending),halves(frozen));}
          return [row];
        }):[];
        const thaw=(flags&2)?tasks.thaw.filter(u=>!u.thawed).map(u=>{
          const row=[index(u.r),u.people,u.slot];
          if(u.halfPeople){version=2;row.push(u.halfPeople);}
          return row;
        }):[];
        rows.push([cooking,thaw]);
      }
    } else {for(let i=0;i<7;i++) rows.push([[],[]]);}
    current=next;
  }
  let d=dateAt(0,first);
  // The bot accepts an anchor from the last six days through tomorrow.
  // Pad the beginning when a new menu starts further in the future.
  if(d>plusDays(today,1)){
    const gap=Math.round((d-plusDays(today,0))/86400000);
    rows.unshift(...Array.from({length:gap},()=>[[],[]])); rows.length=21; d=plusDays(today,0);
  }
  return [version,[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"),flags,ids,rows];
}
function reminderEntry() {
  return '<button type="button" class="prep-overview reminder-entry" data-action="reminders"><span><b>Напоминания в Telegram</b><small>Готовка и разморозка · по желанию</small></span>'+icon("right",16)+'</button>';
}
function remindersPanel(info) {
  const flags=info.flags;
  const choices=[[1,"В день готовки","09:00 · блюда и число порций"],[2,"Достать из морозилки","20:00 · накануне завтрака, обеда или ужина"]];
  return '<div class="sheet-body simple reminders-sheet"><h2 id="sheet-title">Напоминания в Telegram</h2><p class="quiet">Выберите, о чём напомнить. Время московское.</p>'+
    choices.map(([flag,title,hint])=>'<label class="reminder-choice"><input type="checkbox" data-reminder-flag="'+flag+'" '+(flags&flag?'checked':'')+'><span><b>'+title+'</b><small>'+hint+'</small></span></label>').join("")+
    '<p class="fine">План до '+dateText(plusDays(dateAt(0,openingWeek(settings()))>plusDays(today,1)?today:dateAt(0,openingWeek(settings())),20),{day:"numeric",month:"long"})+' включительно. После отметки о готовке, замены блюда или выбора новой недели передайте боту обновлённый план. В дни без задач сообщений не будет.</p>'+
    (info.command ? '<p class="quiet">Отправьте подготовленное сообщение боту. Он подтвердит даты. Если черновик не открылся, скопируйте команду.</p><textarea aria-label="Команда для бота" readonly class="reminder-command">'+$(info.command)+'</textarea><button type="button" class="link" data-action="reminder-copy">Скопировать команду</button>' : '')+
    '<button type="button" class="btn primary" data-action="reminder-send" '+(!flags?'disabled':'')+'>Передать план боту</button><a class="link" rel="noreferrer" target="_blank" href="https://t.me/budueto_bot?text=%2Fstopreminders">Отключить в чате</a><p class="fine">Команда для отключения — /stopreminders.</p></div>';
}
function sendReminderPlan() {
  const flags=openInfo?.flags;
  if(!flags || !data.quizDone) return;
  const payload=JSON.stringify(reminderPacket(flags));
  const tg=window.Telegram?.WebApp;
  if(new URLSearchParams(location.search).get("keyboard")==="1" && tg?.platform && tg.platform!=="unknown" && !tg.initDataUnsafe?.query_id && new TextEncoder().encode(payload).length<=4096) {
    try { tg.sendData(payload); return; } catch {}
  }
  const command="/plan "+btoa(payload).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  openInfo.command=command;
  renderSheet();
  const url="https://t.me/budueto_bot?text="+encodeURIComponent(command);
  if(tg?.isVersionAtLeast?.("6.1") && tg.platform!=="unknown") tg.openTelegramLink(url);
  else window.open(url,"_blank","noopener,noreferrer");
}
