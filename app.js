import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Ваш Firebase Config (вставлен автоматически)
const firebaseConfig = {
  apiKey: "AIzaSyD2kxZckV9DGreeBiASqf7__k6nUL8lItQ",
  authDomain: "kapli-tracker.firebaseapp.com",
  projectId: "kapli-tracker",
  storageBucket: "kapli-tracker.firebasestorage.app",
  messagingSenderId: "834568338089",
  appId: "1:834568338089:web:ec41fc0892fe7ad4abc7b8",
  measurementId: "G-70V23PLKK1"
};

// Инициализация Firebase
let app, db;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.error("Ошибка инициализации Firebase", e);
}

// Элементы DOM
const addDropBtn = document.getElementById('addDropBtn');
const commentInput = document.getElementById('comment');
const historyList = document.getElementById('historyList');

// Состояние UI (какие месяцы свернуты)
const collapsedGroups = new Set();

// Регистрация PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Добавление записи
async function addDropRecord() {
  if (!db) return;
  const doseSelector = document.querySelector('input[name="dose"]:checked');
  const doseOptions = document.querySelectorAll('input[name="dose"]');
  const doseValue = doseSelector ? parseInt(doseSelector.value, 10) : 1;
  const commentValue = commentInput.value.trim();

  addDropBtn.classList.add('loading');
  try {
    await addDoc(collection(db, "drops_history"), {
      dose: doseValue,
      comment: commentValue,
      timestamp: serverTimestamp()
    });
    commentInput.value = '';
    doseOptions.forEach(opt => opt.checked = (opt.value === "1"));
  } catch (e) {
    alert("Ошибка: " + e.message);
  } finally {
    addDropBtn.classList.remove('loading');
  }
}

addDropBtn.addEventListener('click', addDropRecord);

// Форматирование даты
function formatDate(date) {
  if (!date) return '';
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const optionsTime = { hour: '2-digit', minute: '2-digit' };
  const timeStr = date.toLocaleTimeString('ru-RU', optionsTime);

  if (isToday) {
    return { dateLabel: 'Сегодня', timeStr };
  } else {
    const optionsDate = { day: '2-digit', month: 'short' };
    return { dateLabel: date.toLocaleDateString('ru-RU', optionsDate), timeStr };
  }
}

function getMonthYearStr(date) {
  const str = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Реалтайм синхронизация
function setupRealtimeListener() {
  if (!db) return;
  // Увеличили лимит до 200, чтобы было полезнее группировать по месяцам
  const q = query(collection(db, "drops_history"), orderBy("timestamp", "desc"), limit(200));

  onSnapshot(q, (snapshot) => {
    historyList.innerHTML = ''; 
    if (snapshot.empty) {
      historyList.innerHTML = `<div class="empty-state">Нет записей.</div>`;
      return;
    }

    const groupMap = new Map();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const dateObj = data.timestamp ? data.timestamp.toDate() : new Date(); 
      const groupName = getMonthYearStr(dateObj);
      
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName).push({ id: doc.id, data, dateObj });
    });

    groupMap.forEach((items, groupName) => {
      const isCollapsed = collapsedGroups.has(groupName);
      
      const groupEl = document.createElement('div');
      groupEl.className = 'history-group';
      
      const headerHtml = `
        <div class="group-header" data-group="${groupName}">
          <h3>${groupName}</h3>
          <svg class="chevron ${isCollapsed ? 'collapsed' : ''}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      `;
      
      const contentEl = document.createElement('div');
      contentEl.className = `group-content ${isCollapsed ? 'hidden' : ''}`;
      
      items.forEach(item => {
        const { dateLabel, timeStr } = formatDate(item.dateObj);
        const { data, id } = item;
        
        const doseSelectHtml = `
          <select class="history-dose-select" data-id="${id}">
            <option value="1" ${data.dose === 1 ? 'selected' : ''}>1 доза</option>
            <option value="2" ${data.dose === 2 ? 'selected' : ''}>2 дозы</option>
          </select>
        `;

        const itemEl = document.createElement('div');
        itemEl.className = 'history-item';
        
        let commentHtml = '';
        if (data.comment) {
          commentHtml = `<div class="history-comment">${data.comment}</div>`;
        }

        itemEl.innerHTML = `
          <div class="history-item-header">
            <div class="history-time-container">
              <span class="history-time">${timeStr}</span>
              <span class="history-date">${dateLabel}</span>
            </div>
            <div class="history-actions">
              ${doseSelectHtml}
              <button class="delete-btn" data-id="${id}" aria-label="Удалить">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
          ${commentHtml}
        `;
        contentEl.appendChild(itemEl);
      });

      groupEl.innerHTML = headerHtml;
      groupEl.appendChild(contentEl);
      historyList.appendChild(groupEl);
    });

  });
}

setupRealtimeListener();

// Делегирование событий (Удаление, Изменение, Сворачивание)
historyList.addEventListener('click', async (e) => {
  // Аккордеон
  const header = e.target.closest('.group-header');
  if (header) {
    const groupName = header.getAttribute('data-group');
    if (collapsedGroups.has(groupName)) {
        collapsedGroups.delete(groupName);
    } else {
        collapsedGroups.add(groupName);
    }
    const chevron = header.querySelector('.chevron');
    const content = header.nextElementSibling;
    chevron.classList.toggle('collapsed');
    content.classList.toggle('hidden');
    return;
  }

  // Удаление
  const deleteBtn = e.target.closest('.delete-btn');
  if (deleteBtn) {
    const docId = deleteBtn.getAttribute('data-id');
    if (confirm('Вы уверены, что хотите удалить эту запись?')) {
      try {
        await deleteDoc(doc(db, "drops_history", docId));
      } catch (err) {
        alert("Не удалось удалить: " + err.message);
      }
    }
  }
});

historyList.addEventListener('change', async (e) => {
  if (e.target.classList.contains('history-dose-select')) {
    const docId = e.target.getAttribute('data-id');
    const newDose = parseInt(e.target.value, 10);
    try {
      await updateDoc(doc(db, "drops_history", docId), { dose: newDose });
    } catch (err) {
      alert("Не удалось обновить: " + err.message);
    }
  }
});
