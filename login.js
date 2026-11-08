"use strict";
const modal = document.getElementById('admin-modal');
const input = document.getElementById('admin-code');
const notice = document.getElementById('notice');
const adminMessage = document.getElementById('admin-message');
const btnUser = document.getElementById('btn-user');
const adminForm = document.getElementById('admin-form');
function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('es-CR', {hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'America/Costa_Rica'});
}
updateClock(); setInterval(updateClock, 30000);
btnUser.addEventListener('click', async () => {
  btnUser.disabled = true; notice.textContent = 'Abriendo Registro Usuario...';
  try { await ECUS.enterUser(); } catch(e) { notice.textContent = 'Error: ' + ECUS.getMessage(e); btnUser.disabled = false; }
});
document.getElementById('btn-admin').addEventListener('click', () => {
  modal.classList.remove('hidden'); input.value = ''; adminMessage.textContent=''; input.focus();
});
function closeModal(){ modal.classList.add('hidden'); input.value=''; }
document.getElementById('close-modal').addEventListener('click', closeModal);
modal.addEventListener('click', e => {if(e.target===modal)closeModal();});
document.addEventListener('keydown', e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden'))closeModal();});
input.addEventListener('input', () => { input.value = input.value.replace(/\D/g,'').slice(0,6); });
adminForm.addEventListener('submit', async e => {
  e.preventDefault();
  adminMessage.textContent='Validando código...';
  const submit=adminForm.querySelector('[type="submit"]'); submit.disabled=true;
  try { await ECUS.enterAdmin(input.value); }
  catch(err) { adminMessage.textContent=ECUS.getMessage(err); input.value=''; input.focus(); }
  finally { submit.disabled=false; }
});
