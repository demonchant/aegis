function initializeOwnerControl(){
  const card=document.querySelector('.ownerCard');
  if(!card||new URLSearchParams(location.search).get('judge')==='1')return;
  const name=card.querySelector('b'),button=card.querySelector('button'),avatar=card.querySelector('.avatar');
  const request=async(path,options={})=>{const response=await fetch(path,{headers:{'Content-Type':'application/json'},...options});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to update owner');return data};
  const render=(owner)=>{const label=owner?.owner_name||'Unassigned';name.textContent=label;avatar.textContent=label==='Unassigned'?'?':label.split(' ').map((part)=>part[0]).join('').slice(0,2).toUpperCase()};
  request('/api/runbook').then((data)=>render(data.runbook)).catch(()=>{});
  button.addEventListener('click',(event)=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    document.querySelector('.ownerMenu')?.remove();
    const menu=document.createElement('div');
    menu.className='ownerMenu';
    menu.style.cssText='position:absolute;z-index:40;margin-top:185px;right:6%;width:190px;padding:7px;background:#10233b;border:1px solid rgba(175,204,237,.2);border-radius:10px;box-shadow:0 16px 35px rgba(0,0,0,.32)';
    [['Assign to me',false],['Unassign',true]].forEach(([label,unassign])=>{
      const option=document.createElement('button');
      option.textContent=label;
      option.style.cssText='width:100%;text-align:left;padding:10px;border:0;border-radius:6px;background:transparent;color:#eef5ff;font-size:11px;cursor:pointer';
      option.addEventListener('click',async()=>{try{const session=await request('/api/session');const data=await request('/api/runbook/owner',{method:'POST',body:JSON.stringify({ownerId:unassign?null:session.user.id})});render(data.runbook);menu.remove();button.textContent='Saved'}catch(error){button.textContent=error.message}});
      menu.append(option);
    });
    document.body.append(menu);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializeOwnerControl);else initializeOwnerControl();
