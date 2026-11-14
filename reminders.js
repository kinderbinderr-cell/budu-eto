// Send only the chosen kitchen tasks. The chat receives no nutritional targets or shopping data.
function reminderPacket(flags) {
  const ids=[], indexes=new Map(), rows=[];
  const index=r=>{
    if (!indexes.has(r.id)) { indexes.set(r.id,ids.length); ids.push(r.id); }
    return indexes.get(r.id);
  };
  let current=plan(null,0);
  for(let w=0;w<3;w++) {
    const next=plan(null,w+1);
    if (current) {
      const week=kitchenWeek(settings(),current,next);
      for (const [i,tasks] of week.entries()) {
        const marked=data.weeks[data.mode+"/"+weekKey(w)]?.prepDone?.[i]===prepSignature(tasks);
        const cooking=!marked && (flags&1) && (!settings().cook.length || settings().cook.includes(i))
          ? [...tasks.cook.values()].map(t=>[index(t.r),t.portions,t.uses.reduce((n,u)=>n+(u.storage==="freeze"?u.people:0),0)]) : [];
        const thaw=!marked && (flags&2) ? tasks.thaw.map(u=>[index(u.r),u.people,u.slot]) : [];
        rows.push([cooking,thaw]);
      }
    } else {for(let i=0;i<7;i++) rows.push([[],[]]);}
    current=next;
  }
  const d=dateAt(0,0);
  return [1,[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"),flags,ids,rows];
}
function reminderEntry() {
  return '<button type="button" class="prep-overview reminder-entry" data-action="reminders"><span><b>Напоминания в Telegram</b><small>Готовка и разморозка · по желанию</small></span>'+icon("right",16)+'</button>';
}
function remindersPanel(info) {
  const flags=info.flags;
  const choices=[[1,"В день готовки","09:00 · блюда и число порций"],[2,"Достать из морозилки","20:00 · накануне завтрака, обеда или ужина"]];
  return '<div class="sheet-body simple reminders-sheet"><h2 id="sheet-title">Напоминания в Telegram</h2><p class="quiet">Выберите, о чём напомнить. Время московское.</p>'+
    choices.map(([flag,title,hint])=>'<label class="reminder-choice"><input type="checkbox" data-reminder-flag="'+flag+'" '+(flags&flag?'checked':'')+'><span><b>'+title+'</b><small>'+hint+'</small></span></label>').join("")+
    '<p class="fine">План до '+dateText(dateAt(6,2),{day:"numeric",month:"long"})+' включительно. После замены блюда или выбора новой недели передайте обновлённый план. В дни без задач сообщений не будет.</p>'+
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
