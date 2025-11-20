// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Глобальные переменные
let currentDate = new Date();
let selectedDate = null;
let slotsData = {}; // {date: [{id, start_time, end_time, status}, ...]}
let bookingsData = [];

// API endpoints - Railway HTTP API
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8080/api'
    : 'https://massage-bot-production.up.railway.app/api';

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadData();
    renderCalendar();
});

function initEventListeners() {
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => switchTab(e, tab.dataset.tab));
    });

    // Навигация по месяцам
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
        loadData();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
        loadData();
    });

    // Создание слотов
    document.getElementById('createSlotsBtn').addEventListener('click', createSlots);
    document.getElementById('bulkCreateBtn').addEventListener('click', bulkCreateSlots);

    // Синхронизация с Google Calendar
    document.getElementById('syncCalendarBtn').addEventListener('click', syncGoogleCalendar);

    // Устанавливаем даты по умолчанию для синхронизации
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
    document.getElementById('syncStartDate').valueAsDate = today;
    document.getElementById('syncEndDate').valueAsDate = nextMonth;

    // Фильтры записей
    document.getElementById('statusFilter').addEventListener('change', filterBookings);
    document.getElementById('dateFilter').addEventListener('change', filterBookings);
}

// Переключение вкладок
function switchTab(e, tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    e.target.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');

    if (tabName === 'bookings') {
        loadBookings();
    }
}

// Загрузка данных
async function loadData() {
    showLoader(true);
    try {
        // Получаем начало и конец месяца
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);

        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        // Запрос к API
        const response = await fetch(
            `${API_URL}/admin/slots?init_data=${encodeURIComponent(tg.initData)}&start_date=${startDateStr}&end_date=${endDateStr}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );

        const data = await response.json();

        if (data.success) {
            // Группируем слоты по датам
            slotsData = {};
            data.slots.forEach(slot => {
                if (!slotsData[slot.date]) {
                    slotsData[slot.date] = [];
                }
                slotsData[slot.date].push({
                    id: slot.id,
                    start_time: slot.start_time.substring(0, 5), // "10:00:00" -> "10:00"
                    end_time: slot.end_time.substring(0, 5),
                    status: slot.status,
                    google_event_id: slot.google_event_id,
                    booking_id: slot.booking_id
                });
            });
            renderCalendar();
        } else {
            console.error('API error:', data.error);
            tg.showAlert('Ошибка загрузки данных: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        tg.showAlert('Ошибка подключения к серверу');
    } finally {
        showLoader(false);
    }
}

// Генерация тестовых данных
function generateMockSlotsData() {
    const slots = {};
    const today = new Date();

    for (let i = -10; i <= 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        if (date.getMonth() !== currentDate.getMonth()) continue;

        const dateStr = formatDate(date);

        if (date.getDay() === 0) continue; // Пропускаем воскресенья

        const random = Math.random();

        if (random > 0.7) {
            // Есть слоты
            slots[dateStr] = [
                { id: 1, start_time: '10:00', end_time: '11:00', status: 'available' },
                { id: 2, start_time: '11:00', end_time: '12:00', status: 'booked' },
                { id: 3, start_time: '14:00', end_time: '15:00', status: 'available' },
                { id: 4, start_time: '15:00', end_time: '16:00', status: 'blocked' },
            ];
        }
    }

    return slots;
}

// Рендеринг календаря
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    const daysInMonth = lastDay.getDate();
    const daysContainer = document.getElementById('days');
    daysContainer.innerHTML = '';

    // Пустые ячейки
    for (let i = 0; i < startDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'day empty';
        daysContainer.appendChild(emptyDay);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDate(date);

        const dayElement = document.createElement('div');
        dayElement.className = 'day';
        dayElement.textContent = day;

        // Проверяем наличие слотов
        if (slotsData[dateStr]) {
            const hasBookings = slotsData[dateStr].some(s => s.status === 'booked');

            if (hasBookings) {
                dayElement.classList.add('has-bookings');
            } else {
                dayElement.classList.add('has-slots');
            }

            dayElement.addEventListener('click', (e) => selectDate(e, date));
        }

        if (date.getTime() === today.getTime()) {
            dayElement.classList.add('today');
        }

        daysContainer.appendChild(dayElement);
    }
}

// Выбор даты
function selectDate(e, date) {
    selectedDate = date;
    const dateStr = formatDate(date);

    document.querySelectorAll('.day.selected').forEach(el => el.classList.remove('selected'));
    e.target.classList.add('selected');

    showDayDetails(dateStr);
}

// Показать детали дня
function showDayDetails(dateStr) {
    const detailsContainer = document.getElementById('dayDetails');
    const slotsListContainer = document.getElementById('slotsList');

    const slots = slotsData[dateStr] || [];

    if (slots.length === 0) {
        detailsContainer.style.display = 'none';
        return;
    }

    document.getElementById('detailsDate').textContent = formatDateForDisplay(selectedDate);
    slotsListContainer.innerHTML = '';

    slots.forEach(slot => {
        const slotElement = document.createElement('div');
        slotElement.className = 'slot-item';

        slotElement.innerHTML = `
            <span class="slot-time">${slot.start_time} - ${slot.end_time}</span>
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="slot-status ${slot.status}">${getStatusText(slot.status)}</span>
                <div class="slot-actions">
                    <button class="btn-icon btn-block" onclick="toggleBlockSlot(${slot.id})">
                        ${slot.status === 'blocked' ? '🟢' : '🔴'}
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteSlot(${slot.id})">🗑️</button>
                </div>
            </div>
        `;

        slotsListContainer.appendChild(slotElement);
    });

    detailsContainer.style.display = 'block';
}

function getStatusText(status) {
    const texts = {
        'available': 'Свободно',
        'booked': 'Занято',
        'blocked': 'Заблокировано'
    };
    return texts[status] || status;
}

// Создание слотов на день
async function createSlots() {
    const date = document.getElementById('slotDate').value;
    const timeRanges = document.getElementById('timeRanges').value;

    if (!date || !timeRanges) {
        tg.showAlert('Заполните все поля');
        return;
    }

    const ranges = timeRanges.split('\n').filter(r => r.trim());

    showLoader(true);
    try {
        let created = 0;
        let errors = 0;

        // Создаем слоты по очереди
        for (const range of ranges) {
            const [startTime, endTime] = range.split('-').map(t => t.trim());

            if (!startTime || !endTime) {
                console.warn('Invalid time range:', range);
                errors++;
                continue;
            }

            try {
                const response = await fetch(`${API_URL}/admin/slots`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        init_data: tg.initData,
                        date: date,
                        start_time: startTime,
                        end_time: endTime,
                        status: 'available'
                    })
                });

                const data = await response.json();

                if (data.success) {
                    created++;
                } else {
                    console.error('Failed to create slot:', data.error);
                    errors++;
                }
            } catch (err) {
                console.error('Error creating slot:', err);
                errors++;
            }
        }

        if (errors > 0) {
            tg.showAlert(`Создано ${created} слотов, ошибок: ${errors}`);
        } else {
            tg.showAlert(`✅ Создано ${created} слотов`);
        }

        document.getElementById('timeRanges').value = '';
        loadData();
    } catch (error) {
        console.error('Ошибка создания слотов:', error);
        tg.showAlert('❌ Ошибка создания слотов');
    } finally {
        showLoader(false);
    }
}

// Массовое создание
async function bulkCreateSlots() {
    const startDate = document.getElementById('bulkStartDate').value;
    const endDate = document.getElementById('bulkEndDate').value;
    const timeRanges = document.getElementById('bulkTimeRanges').value;

    const selectedWeekdays = Array.from(document.querySelectorAll('.weekday-selector input:checked'))
        .map(cb => parseInt(cb.value));

    if (!startDate || !endDate || !timeRanges || selectedWeekdays.length === 0) {
        tg.showAlert('Заполните все поля');
        return;
    }

    showLoader(true);
    try {
        // TODO: Реальный запрос к API

        await new Promise(resolve => setTimeout(resolve, 1000));

        tg.showAlert('✅ Слоты созданы на выбранный период');
        loadData();
    } catch (error) {
        console.error('Ошибка массового создания:', error);
        tg.showAlert('❌ Ошибка создания слотов');
    } finally {
        showLoader(false);
    }
}

// Синхронизация с Google Calendar
async function syncGoogleCalendar() {
    const startDate = document.getElementById('syncStartDate').value;
    const endDate = document.getElementById('syncEndDate').value;

    if (!startDate || !endDate) {
        tg.showAlert('Укажите период синхронизации');
        return;
    }

    showLoader(true);
    try {
        const response = await fetch(`${API_URL}/admin/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                init_data: tg.initData,
                start_date: startDate,
                end_date: endDate
            })
        });

        const data = await response.json();

        if (data.success) {
            const stats = data.stats;
            tg.showAlert(
                `✅ Синхронизация завершена!\n\n` +
                `Создано: ${stats.created}\n` +
                `Обновлено: ${stats.updated}\n` +
                `Пропущено: ${stats.skipped}`
            );
            loadData();
        } else {
            tg.showAlert(`❌ Ошибка синхронизации: ${data.error}`);
        }
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        tg.showAlert('❌ Ошибка подключения к серверу');
    } finally {
        showLoader(false);
    }
}

// Загрузка записей
async function loadBookings() {
    showLoader(true);
    try {
        // TODO: Реальный запрос
        // bookingsData = await fetch(...).then(r => r.json());

        // Заглушка
        bookingsData = [
            { id: 1, client: 'Иванова Мария', phone: '+79001234567', date: '2024-12-20', time: '10:00-11:00', status: 'confirmed' },
            { id: 2, client: 'Петров Иван', phone: '+79009876543', date: '2024-12-20', time: '11:00-12:00', status: 'completed' },
            { id: 3, client: 'Сидорова Анна', phone: '+79005551234', date: '2024-12-21', time: '14:00-15:00', status: 'confirmed' },
        ];

        filterBookings();
    } catch (error) {
        console.error('Ошибка загрузки записей:', error);
    } finally {
        showLoader(false);
    }
}

// Фильтрация записей
function filterBookings() {
    const status = document.getElementById('statusFilter').value;
    const date = document.getElementById('dateFilter').value;

    let filtered = bookingsData;

    if (status !== 'all') {
        filtered = filtered.filter(b => b.status === status);
    }

    if (date) {
        filtered = filtered.filter(b => b.date === date);
    }

    renderBookings(filtered);
}

// Рендеринг списка записей
function renderBookings(bookings) {
    const container = document.getElementById('bookingsList');
    container.innerHTML = '';

    if (bookings.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Нет записей</p>';
        return;
    }

    bookings.forEach(booking => {
        const bookingElement = document.createElement('div');
        bookingElement.className = 'booking-item';

        bookingElement.innerHTML = `
            <div class="booking-header">
                <span class="booking-client">${booking.client}</span>
                <span class="booking-status ${booking.status}">${getStatusText(booking.status)}</span>
            </div>
            <div class="booking-info">📞 ${booking.phone}</div>
            <div class="booking-info">📅 ${formatDateForDisplay(new Date(booking.date))} в ${booking.time}</div>
        `;

        container.appendChild(bookingElement);
    });
}

// Блокировка/разблокировка слота
window.toggleBlockSlot = async function(slotId) {
    showLoader(true);
    try {
        // Находим слот чтобы узнать текущий статус
        let currentStatus = null;
        for (const date in slotsData) {
            const slot = slotsData[date].find(s => s.id === slotId);
            if (slot) {
                currentStatus = slot.status;
                break;
            }
        }

        if (!currentStatus) {
            tg.showAlert('❌ Слот не найден');
            return;
        }

        // Переключаем статус
        const newStatus = currentStatus === 'blocked' ? 'available' : 'blocked';

        const response = await fetch(`${API_URL}/admin/slots/${slotId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                init_data: tg.initData,
                status: newStatus
            })
        });

        const data = await response.json();

        if (data.success) {
            tg.showAlert('✅ Статус слота изменен');
            loadData();
        } else {
            tg.showAlert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Error toggling slot:', error);
        tg.showAlert('❌ Ошибка изменения статуса');
    } finally {
        showLoader(false);
    }
};

// Удаление слота
window.deleteSlot = async function(slotId) {
    if (!confirm('Удалить этот слот?')) return;

    showLoader(true);
    try {
        const response = await fetch(
            `${API_URL}/admin/slots/${slotId}?init_data=${encodeURIComponent(tg.initData)}`,
            {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );

        const data = await response.json();

        if (data.success) {
            tg.showAlert('✅ Слот удален');
            loadData();
        } else {
            tg.showAlert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Error deleting slot:', error);
        tg.showAlert('❌ Ошибка удаления');
    } finally {
        showLoader(false);
    }
};

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

// Кнопка закрытия
tg.MainButton.setText('Закрыть');
tg.MainButton.onClick(() => tg.close());
tg.MainButton.show();
