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
  doc
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
  console.error("Ошибка инициализации Firebase. Вы уверены, что добавили конфигурацию?", e);
}

// Элементы DOM
const addDropBtn = document.getElementById('addDropBtn');
const commentInput = document.getElementById('comment');
const historyList = document.getElementById('historyList');

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker зарегистрирован', reg))
      .catch((err) => console.log('Ошибка регистрации Service Worker', err));
  });
}

// Функция добавления записи
async function addDropRecord() {
  if (!db) {
    alert("Firebase не настроен! Проверьте файл app.js и INSTRUCTION.md");
    return;
  }

  // Получаем выбранную дозу
  const doseSelector = document.querySelector('input[name="dose"]:checked');
  const doseOptions = document.querySelectorAll('input[name="dose"]');
  const doseValue = doseSelector ? parseInt(doseSelector.value, 10) : 1;
  const commentValue = commentInput.value.trim();

  // Отключаем кнопку для предотвращения двойных кликов
  addDropBtn.classList.add('loading');
  
  try {
    const docRef = await addDoc(collection(db, "drops_history"), {
      dose: doseValue,
      comment: commentValue,
      timestamp: serverTimestamp() // Используем время сервера Firebase для точности
    });
    console.log("Запись добавлена с ID: ", docRef.id);
    
    // Сброс формы
    commentInput.value = '';
    // Сбрасываем на 1 дозу
    doseOptions.forEach(opt => {
      opt.checked = (opt.value === "1");
    });

  } catch (e) {
    console.error("Ошибка добавления документа: ", e);
    alert("Не удалось добавить запись: " + e.message);
  } finally {
    addDropBtn.classList.remove('loading');
  }
}

// Привязка события к кнопке
addDropBtn.addEventListener('click', addDropRecord);

// Форматирование даты
function formatDate(date) {
  if (!date) return '';
  const now = new Date();
  
  const isToday = date.getDate() === now.getDate() && 
                  date.getMonth() === now.getMonth() && 
                  date.getFullYear() === now.getFullYear();

  const optionsTime = { hour: '2-digit', minute: '2-digit' };
  const timeStr = date.toLocaleTimeString('ru-RU', optionsTime);

  if (isToday) {
    return { dateLabel: 'Сегодня', timeStr: timeStr };
  } else {
    const optionsDate = { day: '2-digit', month: 'short' };
    return { dateLabel: date.toLocaleDateString('ru-RU', optionsDate), timeStr: timeStr };
  }
}

// Слушатель реального времени (Реалтайм синхронизация)
function setupRealtimeListener() {
  if (!db) {
    historyList.innerHTML = `<div class="empty-state">Ожидание настройки Firebase...</div>`;
    return;
  }

  // Запрашиваем последние 50 записей, отсортированных по времени по убыванию
  const q = query(collection(db, "drops_history"), orderBy("timestamp", "desc"), limit(50));

  onSnapshot(q, (snapshot) => {
    historyList.innerHTML = ''; // Очистка списка
    
    if (snapshot.empty) {
      historyList.innerHTML = `<div class="empty-state">Нет записей. Нажмите капнул, чтобы добавить.</div>`;
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      // timestamp может быть null в момент локального создания до синхронизации с сервером
      const dateObj = data.timestamp ? data.timestamp.toDate() : new Date(); 
      const { dateLabel, timeStr } = formatDate(dateObj);
      
      const doseText = data.dose === 1 ? '1 доза' : `${data.dose} дозы`;
      
      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';
      
      let commentHtml = '';
      if (data.comment) {
        commentHtml = `<div class="history-comment">${data.comment}</div>`;
      }

      itemEl.innerHTML = `
        <div class="history-item-header">
          <div class="history-time">${timeStr} <span class="history-date">· ${dateLabel}</span></div>
          <div class="history-actions">
            <div class="history-dose">${doseText}</div>
            <button class="delete-btn" data-id="${doc.id}" aria-label="Удалить">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
        ${commentHtml}
      `;
      
      historyList.appendChild(itemEl);
    });
  }, (error) => {
    console.error("Ошибка получения данных: ", error);
    if(error.code === 'permission-denied') {
        historyList.innerHTML = `<div class="empty-state" style="color:var(--danger-color)">Ошибка прав доступа к Firebase (Правила Firestore)</div>`;
    } else {
        historyList.innerHTML = `<div class="empty-state" style="color:var(--danger-color)">Ошибка загрузки. Проверьте консоль.</div>`;
    }
  });
}

// Запуск слушателя
setupRealtimeListener();

// Обработка удаления (делегирование событий)
historyList.addEventListener('click', async (e) => {
  const deleteBtn = e.target.closest('.delete-btn');
  if (deleteBtn) {
    const docId = deleteBtn.getAttribute('data-id');
    if (confirm('Вы уверены, что хотите удалить эту запись?')) {
      try {
        await deleteDoc(doc(db, "drops_history", docId));
      } catch (err) {
        console.error("Ошибка при удалении: ", err);
        alert("Не удалось удалить запись: " + err.message);
      }
    }
  }
});
