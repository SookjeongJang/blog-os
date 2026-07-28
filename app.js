
const initialIdeas = [
  {id:1, category:'정부지원', mode:'Premium', score:98, title:'2026 근로장려금 지급일과 확인 방법', reason:'지급 일정 검색이 늘어나는 시기예요.', status:'new'},
  {id:2, category:'경제', mode:'Premium', score:96, title:'기준금리 발표가 예금·대출에 미치는 영향', reason:'경제 이슈와 생활 금융을 함께 설명하기 좋아요.', status:'new'},
  {id:3, category:'생활정보', mode:'Standard', score:94, title:'주민등록 사실조사 참여 방법과 주의사항', reason:'정부 안내형 검색 의도가 분명해요.', status:'new'},
  {id:4, category:'축제', mode:'Template', score:89, title:'이번 주말 가볼 만한 지역축제 일정 모음', reason:'짧은 템플릿 글로 빠르게 작성할 수 있어요.', status:'new'},
  {id:5, category:'생활정보', mode:'Standard', score:87, title:'화담숲 예약 전 꼭 확인할 운영시간과 주차', reason:'예약 전 확인 수요가 꾸준한 주제예요.', status:'new'},
];

let ideas = JSON.parse(localStorage.getItem('blogos_ideas') || 'null') || initialIdeas;
let drafts = JSON.parse(localStorage.getItem('blogos_drafts') || 'null') || [
  {title:'청년 지원금 신청 조건 정리', mode:'Premium'},
  {title:'재산세 납부기간 확인법', mode:'Standard'},
  {title:'여름 야간축제 일정', mode:'Template'}
];
let queue = JSON.parse(localStorage.getItem('blogos_queue') || 'null') || [
  {title:'파킹통장 금리 비교', mode:'Premium'},
  {title:'주민등록등본 온라인 발급', mode:'Standard'}
];

const panels = {
  home: document.getElementById('homePanel'),
  ideas: document.getElementById('ideasPanel'),
  content: document.getElementById('contentPanel'),
  settings: document.getElementById('settingsPanel')
};

function save(){
  localStorage.setItem('blogos_ideas', JSON.stringify(ideas));
  localStorage.setItem('blogos_drafts', JSON.stringify(drafts));
  localStorage.setItem('blogos_queue', JSON.stringify(queue));
}

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

function ideaCard(item){
  const buttonLabel = item.status === 'writing' ? '작성 중' : '이 글 작성';
  const buttonClass = item.status === 'writing' ? 'small-btn done' : 'small-btn primary';
  return `
    <article class="idea-card">
      <div class="idea-top">
        <div>
          <div class="tag-row">
            <span class="tag">${item.category}</span>
            <span class="tag">${item.mode}</span>
          </div>
          <h4>${item.title}</h4>
        </div>
        <div class="score">${item.score}</div>
      </div>
      <p>${item.reason}</p>
      <div class="card-actions">
        <button class="${buttonClass}" onclick="startWriting(${item.id})">${buttonLabel}</button>
        <button class="small-btn" onclick="holdIdea(${item.id})">보류</button>
      </div>
    </article>`;
}

function render(){
  const filter = document.getElementById('categoryFilter')?.value || 'all';
  const sorted = [...ideas].sort((a,b)=>b.score-a.score);
  document.getElementById('topIdeas').innerHTML = sorted.slice(0,3).map(ideaCard).join('');
  const filtered = filter === 'all' ? sorted : sorted.filter(i=>i.category===filter);
  document.getElementById('allIdeas').innerHTML = filtered.map(ideaCard).join('') || '<p>해당 카테고리의 글감이 없어요.</p>';

  document.getElementById('ideaCount').textContent = ideas.length;
  document.getElementById('waitingCount').textContent = queue.length;
  document.getElementById('draftCount').textContent = drafts.length;
  document.getElementById('queueCount').textContent = queue.length;

  document.getElementById('draftList').innerHTML = drafts.map((d,i)=>`
    <div class="kanban-item">${d.title}<small>${d.mode}</small>
      <button class="small-btn" style="margin-top:9px" onclick="moveToQueue(${i})">발행 대기로</button>
    </div>`).join('') || '<small>작성 전 콘텐츠가 없어요.</small>';

  document.getElementById('queueList').innerHTML = queue.map((d)=>`
    <div class="kanban-item">${d.title}<small>${d.mode}</small></div>`).join('') || '<small>발행 대기 콘텐츠가 없어요.</small>';
}

window.startWriting = function(id){
  const idea = ideas.find(i=>i.id===id);
  if(!idea) return;
  idea.status = 'writing';
  if(!drafts.some(d=>d.title===idea.title)){
    drafts.unshift({title:idea.title, mode:idea.mode});
  }
  save(); render(); showToast('콘텐츠 작성 목록에 담았어요');
};

window.holdIdea = function(id){
  ideas = ideas.filter(i=>i.id!==id);
  save(); render(); showToast('글감을 보류했어요');
};

window.moveToQueue = function(index){
  const [item] = drafts.splice(index,1);
  if(item) queue.unshift(item);
  save(); render(); showToast('발행 대기로 옮겼어요');
};

document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
document.querySelectorAll('[data-tab-target]').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tabTarget)));

document.getElementById('categoryFilter').addEventListener('change',render);

document.getElementById('collectBtn').addEventListener('click',()=>{
  const extra = [
    {category:'정부지원',mode:'Premium',score:95,title:'소상공인 지원사업 신청 전 확인할 조건',reason:'지원 대상과 신청 방법 검색 의도가 뚜렷해요.'},
    {category:'경제',mode:'Standard',score:90,title:'이번 주 생활물가 변화, 가계에 미치는 영향',reason:'경제 이슈를 생활 관점으로 풀기 좋아요.'},
    {category:'생활정보',mode:'Template',score:88,title:'이번 달 놓치기 쉬운 공공요금 납부 일정',reason:'짧은 체크리스트형 글로 만들기 좋아요.'}
  ].map((x,i)=>({...x,id:Date.now()+i,status:'new'}));
  ideas = [...extra, ...ideas];
  save(); render(); showToast('새 글감 3개를 가져왔어요');
});

document.getElementById('themeBtn').addEventListener('click',()=>{
  document.body.classList.toggle('light');
  localStorage.setItem('blogos_theme', document.body.classList.contains('light') ? 'light' : 'dark');
});

document.getElementById('saveSettingsBtn').addEventListener('click',()=>{
  localStorage.setItem('blogos_settings', JSON.stringify({
    dailyGoal: document.getElementById('dailyGoal').value,
    defaultMode: document.getElementById('defaultMode').value,
    saveMode: document.getElementById('saveMode').checked
  }));
  showToast('설정을 저장했어요');
});

const savedTheme = localStorage.getItem('blogos_theme');
if(savedTheme === 'light') document.body.classList.add('light');

const settings = JSON.parse(localStorage.getItem('blogos_settings') || 'null');
if(settings){
  document.getElementById('dailyGoal').value = settings.dailyGoal || 10;
  document.getElementById('defaultMode').value = settings.defaultMode || 'Standard';
  document.getElementById('saveMode').checked = settings.saveMode ?? true;
}

render();
