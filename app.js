import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  getDocs,
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

// Настройки
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const themeSelect = document.getElementById('themeSelect');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const bgCanvas = document.getElementById('bg-canvas');

// Модалка подтверждения
const confirmModal = document.getElementById('confirmModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
let recordToDelete = null;

// Установка начальной темы
const currentTheme = localStorage.getItem('kapli-theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
themeSelect.value = currentTheme;
if (currentTheme === 'animated' && bgCanvas) {
  bgCanvas.classList.remove('hidden');
}

// Слушатели настроек
settingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

themeSelect.addEventListener('change', (e) => {
  const theme = e.target.value;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('kapli-theme', theme);
  
  if (theme === 'animated' && bgCanvas) {
    bgCanvas.classList.remove('hidden');
  } else if (bgCanvas) {
    bgCanvas.classList.add('hidden');
  }
});

exportCsvBtn.addEventListener('click', async () => {
  if (!db) return;
  const originalHtml = exportCsvBtn.innerHTML;
  exportCsvBtn.innerHTML = 'Подготовка...';
  try {
    const qAll = query(collection(db, "drops_history"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(qAll);
    // Доп символ BOM для правильного открытия в Excel
    let csvContent = "\uFEFFДата,Время,Доза,Комментарий\n";
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const dateObj = data.timestamp ? data.timestamp.toDate() : new Date();
      const dStr = dateObj.toLocaleDateString('ru-RU');
      const tStr = dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const dose = data.dose;
      const comment = data.comment ? `"${data.comment.replace(/"/g, '""')}"` : "";
      csvContent += `${dStr},${tStr},${dose},${comment}\n`;
    });
    
    const blob = new Blob([csvContent], {type: "text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'kapli_history.csv');
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Ошибка выгрузки: " + err.message);
  } finally {
    exportCsvBtn.innerHTML = originalHtml;
  }
});

// Состояние UI (какие группы свернуты)
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

  // Разворачиваем группы для текущей даты, чтобы было видно новую запись
  const now = new Date();
  const yearStr = now.getFullYear().toString();
  const monthRaw = now.toLocaleDateString('ru-RU', { month: 'long' });
  const monthStr = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
  const dayStr = "Сегодня";

  collapsedGroups.delete(yearStr);
  collapsedGroups.delete(`${yearStr}-${monthStr}`);
  collapsedGroups.delete(`${yearStr}-${monthStr}-${dayStr}`);

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

function getDateGroupStr(date) {
  const now = new Date();
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  if (y === now.getFullYear() && m === now.getMonth() && d === now.getDate()) {
    return 'Сегодня';
  }

  const options = { day: 'numeric', month: 'long' };
  return date.toLocaleDateString('ru-RU', options).replace(' г.', '');
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

    const tree = new Map();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const dateObj = data.timestamp ? data.timestamp.toDate() : new Date(); 
      const year = dateObj.getFullYear().toString();
      const monthRaw = dateObj.toLocaleDateString('ru-RU', { month: 'long' });
      const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
      const day = getDateGroupStr(dateObj);
      
      if (!tree.has(year)) tree.set(year, new Map());
      if (!tree.get(year).has(month)) tree.get(year).set(month, new Map());
      if (!tree.get(year).get(month).has(day)) tree.get(year).get(month).set(day, []);
      
      tree.get(year).get(month).get(day).push({ id: doc.id, data, dateObj });
    });

    let html = '';

    tree.forEach((monthsMap, year) => {
      const yearPath = year;
      const yearCollapsed = collapsedGroups.has(yearPath);
      html += `
        <div class="tree-level level-1">
          <div class="group-header" data-path="${yearPath}">
            <h3>${year}</h3>
            <svg class="chevron ${yearCollapsed ? 'collapsed' : ''}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="group-content ${yearCollapsed ? 'hidden' : ''}">
      `;

      monthsMap.forEach((daysMap, month) => {
        const monthPath = `${year}-${month}`;
        const monthCollapsed = collapsedGroups.has(monthPath);
        html += `
          <div class="tree-level level-2">
            <div class="group-header" data-path="${monthPath}">
              <h3>${month}</h3>
              <svg class="chevron ${monthCollapsed ? 'collapsed' : ''}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div class="group-content ${monthCollapsed ? 'hidden' : ''}">
        `;

        daysMap.forEach((items, day) => {
          const dayPath = `${year}-${month}-${day}`;
          const dayCollapsed = collapsedGroups.has(dayPath);
          html += `
            <div class="tree-level level-3">
              <div class="group-header" data-path="${dayPath}">
                <h3>${day}</h3>
                <svg class="chevron ${dayCollapsed ? 'collapsed' : ''}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              <div class="group-content ${dayCollapsed ? 'hidden' : ''}">
          `;

          items.forEach(item => {
            const timeStr = item.dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const { data, id } = item;
            const doseSelectHtml = `
              <select class="history-dose-select" data-id="${id}">
                <option value="1" ${data.dose === 1 ? 'selected' : ''}>1 доза</option>
                <option value="2" ${data.dose === 2 ? 'selected' : ''}>2 дозы</option>
              </select>
            `;
            const commentHtml = data.comment ? `<div class="history-comment">${data.comment}</div>` : '';

            html += `
              <div class="history-item">
                <div class="history-item-header">
                  <div class="history-time-container">
                    <span class="history-time">${timeStr}</span>
                  </div>
                  <div class="history-actions">
                    ${doseSelectHtml}
                    <button class="delete-btn" data-id="${id}" aria-label="Удалить">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
                ${commentHtml}
              </div>
            `;
          });
          html += `</div></div>`; // Close level-3 (day)
        });
        html += `</div></div>`; // Close level-2 (month)
      });
      html += `</div></div>`; // Close level-1 (year)
    });

    historyList.innerHTML = html;

  });
}

setupRealtimeListener();

// Делегирование событий (Удаление, Изменение, Сворачивание)
historyList.addEventListener('click', async (e) => {
  // Аккордеон
  const header = e.target.closest('.group-header');
  if (header) {
    const path = header.getAttribute('data-path');
    const chevron = header.querySelector('.chevron');
    const content = header.nextElementSibling;

    if (collapsedGroups.has(path)) {
        // Разворачиваем группу
        collapsedGroups.delete(path);
        chevron.classList.remove('collapsed');
        content.classList.remove('hidden');
    } else {
        // Сворачиваем саму группу
        collapsedGroups.add(path);
        chevron.classList.add('collapsed');
        content.classList.add('hidden');

        // Автоматически сворачиваем все вложенные группы
        const childHeaders = content.querySelectorAll('.group-header');
        childHeaders.forEach(childHeader => {
            const childPath = childHeader.getAttribute('data-path');
            collapsedGroups.add(childPath);
            childHeader.querySelector('.chevron').classList.add('collapsed');
            childHeader.nextElementSibling.classList.add('hidden');
        });
    }
    return;
  }

  // Удаление
  const deleteBtn = e.target.closest('.delete-btn');
  if (deleteBtn) {
    recordToDelete = deleteBtn.getAttribute('data-id');
    confirmModal.classList.remove('hidden');
  }
});

// Логика модалки удаления
cancelDeleteBtn.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  recordToDelete = null;
});

confirmDeleteBtn.addEventListener('click', async () => {
  if (recordToDelete) {
    try {
      await deleteDoc(doc(db, "drops_history", recordToDelete));
    } catch (err) {
      alert("Не удалось удалить: " + err.message);
    } finally {
      confirmModal.classList.add('hidden');
      recordToDelete = null;
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
