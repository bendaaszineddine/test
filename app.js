const $ = (s) => document.querySelector(s);
const app = $('#app'), roster = $('#roster');
let characters = [], selected = null, maxSlots = 5, pendingDelete = null, busy = false;

function nui(name, data = {}) {
  return fetch(`https://${GetParentResourceName()}/${name}`, {
    method: 'POST', headers: {'Content-Type':'application/json; charset=UTF-8'},
    body: JSON.stringify(data)
  }).then(r => r.json()).catch(() => ({}));
}
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.style.display = 'block';
  clearTimeout(el._timer); el._timer = setTimeout(() => el.style.display = 'none', 2800);
}
function fmtMoney(v) { return Number(v || 0).toLocaleString('en-US'); }
function charInfo(c) { return c && c.charinfo ? (typeof c.charinfo === 'string' ? JSON.parse(c.charinfo) : c.charinfo) : {}; }
function fullName(c) { const i = charInfo(c); return `${i.firstname || 'Unknown'} ${i.lastname || ''}`.trim(); }
function render() {
  roster.innerHTML = '';
  $('#slot-count').textContent = `${String(characters.length).padStart(2,'0')} / ${String(maxSlots).padStart(2,'0')}`;
  characters.forEach((c, idx) => {
    const info = charInfo(c), active = selected && selected.citizenid === c.citizenid;
    const el = document.createElement('button'); el.className = `roster-item${active?' active':''}`;
    el.innerHTML = `<span class="file-number">${String(idx+1).padStart(2,'0')}</span><span class="avatar">${(info.firstname||'?').slice(0,1).toUpperCase()}${(info.lastname||'').slice(0,1).toUpperCase()}</span><span class="roster-info"><b></b><small>PERSONNEL ID // ${c.citizenid || 'PENDING'}</small></span><span class="status">● ACTIVE</span>`;
    el.querySelector('.roster-info b').textContent = fullName(c);
    el.addEventListener('click', () => choose(c)); roster.appendChild(el);
  });
  $('#new-character').classList.toggle('hidden', characters.length >= maxSlots);
  updateDetails();
}
function updateDetails() {
  const c = selected, i = charInfo(c);
  $('#char-name').textContent = c ? fullName(c).toUpperCase() : 'NO FILE SELECTED';
  $('#char-dob').textContent = i.birthdate || '—';
  $('#char-nationality').textContent = i.nationality || '—';
  const job = c && c.job ? (typeof c.job === 'string' ? JSON.parse(c.job) : c.job) : {};
  $('#char-job').textContent = job.label || job.name || 'UNASSIGNED';
  const money = c && c.money ? (typeof c.money === 'string' ? JSON.parse(c.money) : c.money) : {};
  $('#char-cash').textContent = c ? '$' + fmtMoney(money.cash) : '$—';
  $('#play').disabled = !c || busy;
  $('#delete').disabled = !c || busy;
  $('#preview-index').textContent = c ? `FILE ${String(characters.indexOf(c)+1).padStart(2,'0')}` : 'FILE 00';
}
function choose(c) {
  selected = c; render();
  nui('cDataPed', {cData:c});
}
function showCharacters(data) {
  characters = Array.isArray(data) ? data : [];
  if (selected) selected = characters.find(c => c.citizenid === selected.citizenid) || null;
  render();
  if (characters.length) choose(characters[0]);
  else { selected = null; updateDetails(); nui('cDataPed', {cData:null}); }
}
function openCreate() {
  if (characters.length >= maxSlots) return toast('No free personnel slots.');
  $('#create-modal').classList.remove('hidden');
}
function closeCreate() { $('#create-modal').classList.add('hidden'); }
$('#new-character').addEventListener('click', openCreate);
$('#close-modal').addEventListener('click', closeCreate);
$('#play').addEventListener('click', async () => {
  if (!selected || busy) return;
  busy = true; updateDetails();
  await nui('selectCharacter', {cData:selected});
  busy = false; updateDetails();
});
$('#delete').addEventListener('click', () => {
  if (!selected) return;
  pendingDelete = selected; $('#confirm-modal').classList.remove('hidden');
});
$('#cancel-delete').addEventListener('click', () => { pendingDelete = null; $('#confirm-modal').classList.add('hidden'); });
$('#confirm-delete').addEventListener('click', async () => {
  if (!pendingDelete) return;
  await nui('deleteCharacter', {citizenid:pendingDelete.citizenid});
  $('#confirm-modal').classList.add('hidden'); pendingDelete = null;
  toast('Delete request sent.'); await nui('setupCharacters');
});
$('#create-form').addEventListener('submit', async (e) => {
  e.preventDefault(); if (busy) return;
  const f = new FormData(e.currentTarget);
  const data = Object.fromEntries(f.entries());
  data.cid = characters.length + 1;
  data.gender = data.gender;
  busy = true;
  await nui('createNewCharacter', data);
  busy = false; closeCreate();
});
window.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.action === 'setupCharacters') {
    app.classList.remove('hidden');
    showCharacters(d.characters || []);
  } else if (d.action === 'closeNUI') {
    app.classList.add('hidden');
  } else if (d.action === 'enableDeleteButton') {
    $('#delete').classList.toggle('hidden', !d.enableDeleteButton);
  } else if (d.action === 'setupCharInfo' && d.charinfo) {
    // Retained for compatibility with common QBCore forks.
  } else if (d.action === 'updateCharacters' && d.characters) {
    showCharacters(d.characters);
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('#create-modal').classList.contains('hidden')) closeCreate();
    else if (!$('#confirm-modal').classList.contains('hidden')) $('#confirm-modal').classList.add('hidden');
  }
});
setInterval(() => { $('#clock').textContent = new Date().toLocaleTimeString('en-GB',{hour12:false}); }, 1000);
