const API_URL = 'https://script.google.com/macros/s/AKfycbwCOyxrS93IRXDM-bKdmVeo2okUo_CudJx5GD0USHVZfy2JXOeLPEfOXdEMjvQpq89TPg/exec';

let ideas = [];
let picked = JSON.parse(localStorage.getItem('blogos_picked') || '[]');

const panels = {
  home: document.getElementById('homePanel'),
  ideas: document.getElementById('ideasPanel'),
  content: document.getElementById('contentPanel'),
  settings: document.getElementById('settingsPanel')
};

function showToast(message){
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>toast.classList.remove('show'),1800);
}

function switchTab(name){
  Object.entries(panels).forEach(([key,panel])=>panel.classList.toggle('active',key===name));
  document.querySelectorAll('.nav-item').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===name));
  window.scrollTo({top:0,behavior:'smooth'});
  render();
}

function esc(value){
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function normalize(row,index){
  const rawPriority = row['우선순위'];
  const priority = rawPriority === '' || rawPriority == null ? 99 : Number(rawPriority);
  return {
    id: `${index}-${row['제목'] || ''}`,
    category: String(row['카테고리'] || '기타').trim(),
    title: String(row['제목'] || '').trim(),
    subtitle: String(row['서브제목'] || '').trim(),
    point: String(row['포인트'] || '').trim(),
    status: String(row['상태'] || '대기').trim(),
    priority: Number.isFinite(priority) ? priority : 99
  };
}

function ideaCard(item){
  const isPicked = picked.some(p=>p.title===item.title);
  return `
    <article class="idea-card">
      <div class="idea-top">
        <div>
          <div class="tag-row">
            <span class="tag">${esc(item.category)}</span>
            <span class="tag">${esc(item.status)}</span>
          </div>
          <h4>${esc(item.title)}</h4>
        </div>
        <div class="score">${item.priority === 99 ? '-' : item.priority}</div>
      </div>
      ${item.subtitle ? `<p style="margin-bottom:6px;color:var(--text)">${esc(item.subtitle)}</p>` : ''}
      <p>${item.point ? esc(item.point) : '포인트가 아직 입력되지 않았어요.'}</p>
      <div class="card-actions">
        <button class="${isPicked ? 'small-btn done' : 'small-btn primary'}" onclick="pickIdea('${encodeURIComponent(item.title)}')">
          ${isPicked ? '고른 글 ✓' : '작성하기'}
        </button>
      </div>
    </article>`;
}

function updateCategoryFilter(){
  const select = document.getElementById('categoryFilter');
  if(!select) return;
  const current = select.value || 'all';
  const categories = [...new Set(ideas.map(x=>x.category).filter(Boolean))].sort();
  select.innerHTML = '<option value="all">전체</option>' + categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  select.value = categories.includes(current) ? current : 'all';
}

function render(){
  const sorted = [...ideas].sort((a,b)=>a.priority-b.priority || a.title.localeCompare(b.title,'ko'));
  const waiting = ideas.filter(i=>i.status==='대기').length;
  const priorityOne = ideas.filter(i=>i.priority===1).length;

  document.getElementById('ideaCount').textContent = ideas.length;
  document.getElementById('waitingCount').textContent = waiting;
  const statCards = document.querySelectorAll('.stat-card strong');
  if(statCards[2]) statCards[2].textContent = priorityOne;

  document.getElementById('topIdeas').innerHTML = sorted.slice(0,3).map(ideaCard).join('') || '<p style="color:var(--muted)">아직 글감이 없어요.</p>';

  const filter = document.getElementById('categoryFilter')?.value || 'all';
  const filtered = filter === 'all' ? sorted : sorted.filter(i=>i.category===filter);
  document.getElementById('allIdeas').innerHTML = filtered.map(ideaCard).join('') || '<p style="color:var(--muted)">해당 카테고리의 글감이 없어요.</p>';

  const pickedList = document.getElementById('draftList');
  if(pickedList){
    pickedList.innerHTML = picked.map((p,i)=>`
      <div class="kanban-item">${esc(p.title)}<small>${esc(p.category || '기타')}</small>
        <button class="small-btn" style="margin-top:9px" onclick="removePicked(${i})">목록에서 빼기</button>
      </div>`).join('') || '<small>아직 고른 글이 없어요.</small>';
  }
  const queueList = document.getElementById('queueList');
  if(queueList) queueList.innerHTML = '<small>다음 단계에서 구글 시트의 초안/발행대기와 연결할 거예요.</small>';

  const draftCount = document.getElementById('draftCount');
  if(draftCount) draftCount.textContent = picked.length;
  const queueCount = document.getElementById('queueCount');
  if(queueCount) queueCount.textContent = 0;
}

async function loadIdeas(){
  const refreshBtn = document.getElementById('collectBtn');
  const oldLabel = refreshBtn?.textContent;
  if(refreshBtn){ refreshBtn.disabled = true; refreshBtn.textContent = '불러오는 중...'; }

  try{
    const response = await fetch(API_URL, {method:'GET', cache:'no-store', redirect:'follow'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if(!Array.isArray(data)) throw new Error('응답 형식 오류');

    ideas = data
      .filter(row => Object.values(row).some(v=>String(v ?? '').trim() !== ''))
      .map(normalize)
      .filter(item => item.title);

    updateCategoryFilter();
    render();
    showToast(`시트에서 글감 ${ideas.length}개를 불러왔어요`);
  }catch(err){
    console.error('Blog OS API error:', err);
    ideas = [];
    updateCategoryFilter();
    render();
    showToast('시트 연결을 확인해 주세요');
  }finally{
    if(refreshBtn){ refreshBtn.disabled = false; refreshBtn.textContent = oldLabel || '오늘 글감 새로고침'; }
  }
}

window.pickIdea = function(encodedTitle){
  const title = decodeURIComponent(encodedTitle);
  const item = ideas.find(i=>i.title===title);
  if(!item) return;
  if(!picked.some(p=>p.title===item.title)){
    picked.unshift(item);
    localStorage.setItem('blogos_picked',JSON.stringify(picked));
    showToast('고른 글에 담았어요');
  }else{
    showToast('이미 담아둔 글이에요');
  }
  render();
};

window.removePicked = function(index){
  picked.splice(index,1);
  localStorage.setItem('blogos_picked',JSON.stringify(picked));
  render();
  showToast('목록에서 뺐어요');
};

document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
document.querySelectorAll('[data-tab-target]').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tabTarget)));
document.getElementById('categoryFilter')?.addEventListener('change',render);
document.getElementById('collectBtn')?.addEventListener('click',loadIdeas);

document.getElementById('themeBtn')?.addEventListener('click',()=>{
  document.body.classList.toggle('light');
  localStorage.setItem('blogos_theme',document.body.classList.contains('light')?'light':'dark');
});

document.getElementById('saveSettingsBtn')?.addEventListener('click',()=>{
  localStorage.setItem('blogos_settings',JSON.stringify({
    dailyGoal:document.getElementById('dailyGoal').value,
    defaultMode:document.getElementById('defaultMode').value,
    saveMode:document.getElementById('saveMode').checked
  }));
  showToast('설정을 저장했어요');
});

if(localStorage.getItem('blogos_theme')==='light') document.body.classList.add('light');
const settings = JSON.parse(localStorage.getItem('blogos_settings') || 'null');
if(settings){
  document.getElementById('dailyGoal').value = settings.dailyGoal || 10;
  document.getElementById('defaultMode').value = settings.defaultMode || 'Standard';
  document.getElementById('saveMode').checked = settings.saveMode ?? true;
}

render();
loadIdeas();
