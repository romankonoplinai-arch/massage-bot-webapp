// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Глобальные переменные
let currentDate = new Date();
let selectedDate = null;
let selectedSlot = null;
let availableSlots = {}; // {date: [{id, start_time, end_time}, ...]}

// API endpoints (замените на ваш backend URL)
const API_URL = tg.initDataUnsafe?.start_param || 'https://your-bot-url.railway.app';

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
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    document.getElementById('confirmBtn').addEventListener('click', confirmBooking);
    document.getElementById('cancelBtn').addEventListener('click', cancelBooking);
}

// Загрузка баланса пользователя
async function loadUserBalance() {
    try {
        // TODO: Реальный запрос к API
        // const response = await fetch(`${API_URL}/api/balance`, {
        //     headers: { 'Authorization': `tma ${tg.initData}` }
        // });
        // const data = await response.json();

        // Заглушка для демонстрации
        const balance = 5; // data.balance
        document.getElementById('balance').textContent = balance;
    } catch (error) {
        console.error('Ошибка загрузки баланса:', error);
        document.getElementById('balance').textContent = '?';
    }
}

// Загрузка доступных слотов
async function loadAvailableSlots() {
    showLoader(true);
    try {
        // TODO: Реальный запрос к API
        // const response = await fetch(`${API_URL}/api/slots?month=${currentDate.getMonth() + 1}&year=${currentDate.getFullYear()}`, {
        //     headers: { 'Authorization': `tma ${tg.initData}` }
        // });
        // const data = await response.json();

        // Заглушка для демонстрации
        availableSlots = generateMockSlots();
        renderCalendar();
    } catch (error) {
        console.error('Ошибка загрузки слотов:', error);
        tg.showAlert('Ошибка загрузки данных');
    } finally {
        showLoader(false);
    }
}

// Генерация тестовых данных
function generateMockSlots() {
    const slots = {};
    const today = new Date();

    // Создаем слоты на ближайшие 30 дней
    for (let i = 1; i <= 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        const dateStr = formatDate(date);

        // Пропускаем воскресенья
        if (date.getDay() === 0) continue;

        // Случайно делаем некоторые дни занятыми/заблокированными
        const random = Math.random();

        if (random > 0.7) {
            // День заблокирован
            slots[dateStr] = { status: 'blocked', slots: [] };
        } else if (random > 0.4) {
            // Есть свободные слоты
            slots[dateStr] = {
                status: 'available',
                slots: [
                    { id: `${dateStr}-1`, start_time: '10:00', end_time: '11:00' },
                    { id: `${dateStr}-2`, start_time: '11:00', end_time: '12:00' },
                    { id: `${dateStr}-3`, start_time: '14:00', end_time: '15:00' },
                    { id: `${dateStr}-4`, start_time: '15:00', end_time: '16:00' },
                ]
            };
        } else {
            // Все слоты заняты
            slots[dateStr] = { status: 'booked', slots: [] };
        }
    }

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

    // Определяем с какого дня недели начинается месяц (0 = воскресенье, 1 = понедельник)
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1; // Конвертируем в формат Пн-Вс

    const daysInMonth = lastDay.getDate();

    // Очищаем контейнер дней
    const daysContainer = document.getElementById('days');
    daysContainer.innerHTML = '';

    // Добавляем пустые ячейки для выравнивания
    for (let i = 0; i < startDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'day empty';
        daysContainer.appendChild(emptyDay);
    }

    // Добавляем дни месяца
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDate(date);

        const dayElement = document.createElement('div');
        dayElement.className = 'day';
        dayElement.textContent = day;

        // Проверяем статус дня
        if (availableSlots[dateStr]) {
            const dayStatus = availableSlots[dateStr].status;
            dayElement.classList.add(dayStatus);

            if (dayStatus === 'available') {
                dayElement.addEventListener('click', () => selectDate(date));
            }
        }

        // Выделяем сегодня
        if (date.getTime() === today.getTime()) {
            dayElement.classList.add('today');
        }

        // Прошедшие дни делаем неактивными
        if (date < today) {
            dayElement.classList.add('blocked');
        }

        daysContainer.appendChild(dayElement);
    }
}

// Выбор даты
function selectDate(date) {
    selectedDate = date;
    const dateStr = formatDate(date);

    // Убираем выделение с предыдущей даты
    document.querySelectorAll('.day.selected').forEach(el => el.classList.remove('selected'));

    // Выделяем выбранную дату
    event.target.classList.add('selected');

    // Показываем доступные слоты
    showTimeSlots(dateStr);
}

// Показать доступные слоты на выбранную дату
function showTimeSlots(dateStr) {
    const timeSlotsContainer = document.getElementById('timeSlots');
    const slotsListContainer = document.getElementById('slotsList');

    const dateInfo = availableSlots[dateStr];

    if (!dateInfo || dateInfo.slots.length === 0) {
        timeSlotsContainer.style.display = 'none';
        return;
    }

    // Обновляем заголовок
    document.getElementById('selectedDate').textContent = formatDateForDisplay(selectedDate);

    // Очищаем список слотов
    slotsListContainer.innerHTML = '';

    // Добавляем слоты
    dateInfo.slots.forEach(slot => {
        const slotElement = document.createElement('div');
        slotElement.className = 'slot';
        slotElement.textContent = `${slot.start_time} - ${slot.end_time}`;
        slotElement.addEventListener('click', () => selectSlot(slot));
        slotsListContainer.appendChild(slotElement);
    });

    timeSlotsContainer.style.display = 'block';
}

// Выбор временного слота
function selectSlot(slot) {
    selectedSlot = slot;

    // Показываем подтверждение
    document.getElementById('confirmDate').textContent = formatDateForDisplay(selectedDate);
    document.getElementById('confirmTime').textContent = `${slot.start_time} - ${slot.end_time}`;
    document.getElementById('confirmation').style.display = 'flex';
}

// Подтверждение бронирования
async function confirmBooking() {
    showLoader(true);

    try {
        // TODO: Реальный запрос к API
        // const response = await fetch(`${API_URL}/api/book`, {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Authorization': `tma ${tg.initData}`
        //     },
        //     body: JSON.stringify({
        //         slot_id: selectedSlot.id,
        //         date: formatDate(selectedDate),
        //         start_time: selectedSlot.start_time,
        //         end_time: selectedSlot.end_time
        //     })
        // });

        // if (!response.ok) throw new Error('Ошибка бронирования');

        // Заглушка для демонстрации
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Закрываем WebApp с результатом
        tg.showAlert('✅ Запись успешно создана!', () => {
            tg.close();
        });

    } catch (error) {
        console.error('Ошибка бронирования:', error);
        tg.showAlert('❌ Ошибка при создании записи. Попробуйте снова.');
    } finally {
        showLoader(false);
        cancelBooking();
    }
}

// Отмена бронирования
function cancelBooking() {
    document.getElementById('confirmation').style.display = 'none';
    selectedSlot = null;
}

// Утилиты
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateForDisplay(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

function showLoader(show) {
    document.getElementById('loader').style.display = show ? 'flex' : 'none';
}

// Обработка кнопок Telegram
tg.MainButton.setText('Закрыть');
tg.MainButton.onClick(() => tg.close());
tg.MainButton.show();
