// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Глобальные переменные
let currentDate = new Date();
let selectedDate = null;
let selectedSlot = null;
let availableSlots = {}; // {date: {status: 'available', slots: [{id, start_time, end_time}]}}

// API URL - Railway HTTP API endpoint
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8080/api'
    : 'https://massage-bot-production.up.railway.app/api';

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadUserBalance();
    renderCalendar();
    loadAvailableSlots();
});

function initEventListeners() {
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
        loadAvailableSlots();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
        loadAvailableSlots();
    });

    document.getElementById('confirmBtn').addEventListener('click', confirmBooking);
    document.getElementById('cancelBtn').addEventListener('click', cancelBooking);
}

// Загрузка баланса пользователя через HTTP API
async function loadUserBalance() {
    try {
        const response = await fetch(`${API_URL}/balance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                init_data: tg.initData
            }),
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('balance').textContent = data.coins_balance || 0;
        } else {
            console.error('Balance error:', data.error);
            document.getElementById('balance').textContent = '?';
        }
    } catch (error) {
        console.error('Ошибка загрузки баланса:', error);
        document.getElementById('balance').textContent = '?';
    }
}

// Загрузка доступных слотов через HTTP API
async function loadAvailableSlots() {
    showLoader(true);
    try {
        // Получаем начало и конец месяца
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);

        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        // Отправляем HTTP запрос к API
        const response = await fetch(`${API_URL}/slots`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                init_data: tg.initData,
                start_date: startDateStr,
                end_date: endDateStr
            }),
        });

        const data = await response.json();

        if (data.success) {
            availableSlots = processServerSlots(data.slots);
        } else {
            console.error('API error:', data.error);
            tg.showAlert('Ошибка загрузки слотов: ' + (data.error || 'Неизвестная ошибка'));
            availableSlots = {};
        }

        renderCalendar();
    } catch (error) {
        console.error('Ошибка загрузки слотов:', error);
        tg.showAlert('Ошибка подключения к серверу');
        availableSlots = {};
    } finally {
        showLoader(false);
    }
}

// Обработка слотов от сервера
function processServerSlots(serverSlots) {
    const slots = {};

    // Группируем слоты по датам
    serverSlots.forEach(slot => {
        const dateStr = slot.date;

        if (!slots[dateStr]) {
            slots[dateStr] = {
                status: 'available',
                slots: []
            };
        }

        slots[dateStr].slots.push({
            id: slot.id,
            start_time: slot.start_time.substring(0, 5), // "10:00:00" -> "10:00"
            end_time: slot.end_time.substring(0, 5)
        });
    });

    // Определяем статус для каждой даты
    Object.keys(slots).forEach(dateStr => {
        const daySlots = slots[dateStr].slots;
        if (daySlots.length === 0) {
            slots[dateStr].status = 'blocked';
        } else {
            slots[dateStr].status = 'available';
        }
    });

    return slots;
}

// Рендеринг календаря
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Обновляем заголовок
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

    // Получаем первый день месяца
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Понедельник = 0

    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';

    // Добавляем заголовки дней недели
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayNames.forEach(dayName => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = dayName;
        calendarGrid.appendChild(dayHeader);
    });

    // Добавляем пустые ячейки до первого дня
    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'day empty';
        calendarGrid.appendChild(emptyDay);
    }

    // Добавляем дни месяца
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDayDate = new Date(year, month, day);
        const dateStr = formatDate(currentDayDate);

        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.textContent = day;

        // Проверяем статус дня
        if (currentDayDate < today) {
            // Прошедший день
            dayDiv.classList.add('past');
        } else if (availableSlots[dateStr]) {
            // День с доступными слотами
            dayDiv.classList.add('available');
            dayDiv.addEventListener('click', () => selectDate(currentDayDate));
        } else {
            // Заблокированный или нет слотов
            dayDiv.classList.add('blocked');
        }

        // Выделяем сегодняшний день
        if (currentDayDate.toDateString() === today.toDateString()) {
            dayDiv.classList.add('today');
        }

        // Выделяем выбранную дату
        if (selectedDate && currentDayDate.toDateString() === selectedDate.toDateString()) {
            dayDiv.classList.add('selected');
        }

        calendarGrid.appendChild(dayDiv);
    }
}

// Выбор даты
function selectDate(date) {
    selectedDate = date;
    renderCalendar();
    showTimeSlots(date);
}

// Отображение слотов для выбранной даты
function showTimeSlots(date) {
    const dateStr = formatDate(date);
    const dayData = availableSlots[dateStr];

    const timeSlotsDiv = document.getElementById('timeSlots');
    timeSlotsDiv.innerHTML = '';

    if (!dayData || !dayData.slots || dayData.slots.length === 0) {
        timeSlotsDiv.innerHTML = '<p class="no-slots">На эту дату нет доступных слотов</p>';
        return;
    }

    const title = document.createElement('h3');
    title.textContent = `Выберите время на ${date.toLocaleDateString('ru-RU')}:`;
    timeSlotsDiv.appendChild(title);

    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'slots-container';

    dayData.slots.forEach(slot => {
        const slotBtn = document.createElement('button');
        slotBtn.className = 'slot-btn';
        slotBtn.textContent = `${slot.start_time} - ${slot.end_time}`;
        slotBtn.addEventListener('click', () => selectSlot(slot, date));
        slotsContainer.appendChild(slotBtn);
    });

    timeSlotsDiv.appendChild(slotsContainer);
}

// Выбор временного слота
function selectSlot(slot, date) {
    selectedSlot = {
        ...slot,
        date: formatDate(date),
        dateObj: date
    };

    // Показываем подтверждение
    const confirmText = document.getElementById('confirmText');
    confirmText.innerHTML = `
        <strong>Дата:</strong> ${date.toLocaleDateString('ru-RU')}<br>
        <strong>Время:</strong> ${slot.start_time} - ${slot.end_time}<br><br>
        <strong>Стоимость:</strong> 1 коин
    `;

    document.getElementById('confirmation').style.display = 'flex';
}

// Подтверждение бронирования через HTTP API
async function confirmBooking() {
    showLoader(true);

    try {
        // Отправляем запрос на бронирование через HTTP API
        const response = await fetch(`${API_URL}/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                init_data: tg.initData,
                slot_id: selectedSlot.id
            }),
        });

        const data = await response.json();

        if (data.success) {
            // Обновляем баланс
            document.getElementById('balance').textContent = data.booking.new_balance;

            // Показываем успешное сообщение
            tg.showAlert(
                `✅ Запись успешно создана!\n\n` +
                `Дата: ${data.booking.date}\n` +
                `Время: ${data.booking.start_time} - ${data.booking.end_time}\n\n` +
                `Списано коинов: ${data.booking.coins_spent}\n` +
                `Остаток: ${data.booking.new_balance}`,
                () => {
                    // Перезагружаем слоты после закрытия alert
                    loadAvailableSlots();
                    cancelBooking();
                }
            );

        } else {
            const errorMsg = data.error || 'Не удалось создать запись';
            tg.showAlert(`❌ ${errorMsg}`);
        }

    } catch (error) {
        console.error('Ошибка бронирования:', error);
        tg.showAlert('❌ Ошибка при создании записи. Попробуйте снова.');
    } finally {
        showLoader(false);
    }
}

// Отмена бронирования
function cancelBooking() {
    selectedSlot = null;
    document.getElementById('confirmation').style.display = 'none';
}

// Форматирование даты в YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Показать/скрыть загрузчик
function showLoader(show) {
    document.getElementById('loader').style.display = show ? 'flex' : 'none';
}

// Обработка кнопок Telegram
tg.MainButton.setText('Закрыть');
tg.MainButton.onClick(() => tg.close());
tg.MainButton.show();
