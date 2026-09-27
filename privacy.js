function initializePrivacyPage(){
  document.querySelectorAll('[data-toast="Read data handling"]').forEach((button)=>button.addEventListener('click',(event)=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    const judge=new URLSearchParams(location.search).get('judge')==='1'?'?judge=1':'';
    location.href=`data-handling.html${judge}`;
  },true));
  document.querySelectorAll('[data-toast="Repository scope panel opened"]').forEach((button)=>button.addEventListener('click',(event)=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    const judge=new URLSearchParams(location.search).get('judge')==='1'?'?judge=1':'';
    location.href=`repository.html${judge}`;
  },true));
  document.querySelectorAll('.formFooter small').forEach((item)=>{
    if(item.textContent.includes('Content stays'))item.innerHTML='<span class="shieldIcon">✓</span> Content stays on this device in local mode';
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializePrivacyPage);else initializePrivacyPage();
