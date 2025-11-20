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

            // Обновляем детали выбранного дня если он был выбран
            if (selectedDate) {
                const dateStr = formatDate(selectedDate);
                showDayDetails(dateStr);
            }
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
        'booked': 'Забронировано',
        'blocked': 'Забронировано'
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
                    console.error('❌ Ошибка создания слота:');
                    console.error('  Время:', startTime, '-', endTime);
                    console.error('  Дата:', date);
                    console.error('  Ответ сервера:', data.error);
                    console.error('  Status code:', response.status);
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

    // Парсим временные диапазоны
    const ranges = timeRanges.split('\n').filter(r => r.trim());
    if (ranges.length === 0) {
        tg.showAlert('Укажите хотя бы один временной диапазон');
        return;
    }

    showLoader(true);
    try {
        let created = 0;
        let errors = 0;

        // Генерируем даты в диапазоне
        const start = new Date(startDate);
        const end = new Date(endDate);

        const currentDate = new Date(start);

        while (currentDate <= end) {
            // Получаем день недели (0-6, где 0 = воскресенье)
            const dayOfWeek = currentDate.getDay();

            // Проверяем, выбран ли этот день недели
            if (selectedWeekdays.includes(dayOfWeek)) {
                const dateStr = formatDate(currentDate);

                // Создаем слоты для этой даты
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
                                date: dateStr,
                                start_time: startTime,
                                end_time: endTime,
                                status: 'available'
                            })
                        });

                        const data = await response.json();

                        if (data.success) {
                            created++;
                        } else {
                            if (data.error !== 'Slot already exists') {
                                console.error('Failed to create slot:', data.error);
                                errors++;
                            }
                        }
                    } catch (err) {
                        console.error('Error creating slot:', err);
                        errors++;
                    }
                }
            }

            // Переходим к следующему дню
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (errors > 0) {
            tg.showAlert(`Создано ${created} слотов, ошибок: ${errors}`);
        } else {
            tg.showAlert(`✅ Создано ${created} слотов на выбранный период`);
        }

        document.getElementById('bulkTimeRanges').value = '';
        loadData();
    } catch (error) {
        console.error('Ошибка массового создания:', error);
        tg.showAlert('❌ Ошибка создания слотов');
    } finally {
        showLoader(false);
    }
}

// Загрузка записей
async function loadBookings() {
    showLoader(true);
    try {
        const status = document.getElementById('statusFilter').value;
        const date = document.getElementById('dateFilter').value;

        let url = `${API_URL}/admin/bookings?init_data=${encodeURIComponent(tg.initData)}`;

        if (status && status !== 'all') {
            url += `&status=${status}`;
        }

        if (date) {
            url += `&start_date=${date}&end_date=${date}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            // Преобразуем формат для совместимости
            bookingsData = data.bookings.map(b => ({
                id: b.id,
                client_name: b.client_name,
                client_phone: b.client_phone,
                date: b.date,
                start_time: b.start_time,
                end_time: b.end_time,
                status: b.status,
                source: b.source,
                is_manual: b.is_manual
            }));

            renderBookings(bookingsData);
        } else {
            console.error('Ошибка загрузки записей:', data.error);
            tg.showAlert('❌ Ошибка загрузки записей');
        }
    } catch (error) {
        console.error('Ошибка загрузки записей:', error);
        tg.showAlert('❌ Ошибка загрузки записей');
    } finally {
        showLoader(false);
    }
}

// Фильтрация записей (перезагружаем с фильтрами)
function filterBookings() {
    loadBookings();
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

        const time = `${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)}`;
        const sourceTag = booking.is_manual ? '📝 Забронировано' : '✅ Подтверждено';
        const statusText = getStatusText(booking.status);

        let contentHTML = `
            <div class="booking-header">
                <span class="booking-source-tag">${sourceTag}</span>
                <span class="booking-status ${booking.status}">${statusText}</span>
            </div>
            <div class="booking-info">📅 ${formatDateForDisplay(new Date(booking.date))} в ${time}</div>
        `;

        // Для ручных бронирований показываем редактируемые поля
        if (booking.is_manual) {
            const clientName = booking.client_name || '';
            const clientPhone = booking.client_phone || '';

            contentHTML += `
                <div class="booking-editable-field">
                    <label>👤 ФИО:</label>
                    <input
                        type="text"
                        class="editable-input"
                        value="${clientName}"
                        placeholder="Введите ФИО"
                        data-booking-id="${booking.id}"
                        data-field="name"
                        onblur="updateManualBooking(${booking.id}, this.value, null)"
                    />
                </div>
                <div class="booking-editable-field">
                    <label>📞 Телефон:</label>
                    <input
                        type="text"
                        class="editable-input"
                        value="${clientPhone}"
                        placeholder="Введите телефон"
                        data-booking-id="${booking.id}"
                        data-field="phone"
                        onblur="updateManualBooking(${booking.id}, null, this.value)"
                    />
                </div>
            `;
        } else {
            // Для обычных записей просто показываем информацию
            contentHTML += `
                <div class="booking-info">👤 ${booking.client_name}</div>
                <div class="booking-info">📞 ${booking.client_phone}</div>
            `;
        }

        bookingElement.innerHTML = contentHTML;
        container.appendChild(bookingElement);
    });
}

// Обновление информации ручного бронирования
window.updateManualBooking = async function(bookingId, name, phone) {
    try {
        // Получаем текущие значения обоих полей для этого бронирования
        const nameInput = document.querySelector(`input[data-booking-id="${bookingId}"][data-field="name"]`);
        const phoneInput = document.querySelector(`input[data-booking-id="${bookingId}"][data-field="phone"]`);

        const clientName = name !== null ? name : (nameInput ? nameInput.value : '');
        const clientPhone = phone !== null ? phone : (phoneInput ? phoneInput.value : '');

        const response = await fetch(`${API_URL}/admin/bookings/${bookingId}/manual-info`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                init_data: tg.initData,
                client_name: clientName.trim(),
                client_phone: clientPhone.trim()
            })
        });

        const data = await response.json();

        if (data.success) {
            // Обновляем данные в локальном массиве
            const booking = bookingsData.find(b => b.id === bookingId);
            if (booking) {
                booking.client_name = clientName.trim();
                booking.client_phone = clientPhone.trim();
            }
            console.log('✅ Данные обновлены');
        } else {
            console.error('Ошибка обновления:', data.error);
            tg.showAlert('❌ Ошибка сохранения: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Error updating manual booking:', error);
        tg.showAlert('❌ Ошибка сохранения данных');
    }
};

// Блокировка/разблокировка слота (создание ручного бронирования)
window.toggleBlockSlot = async function(slotId) {
    showLoader(true);
    try {
        // Находим слот чтобы узнать текущий статус
        let currentSlot = null;
        for (const date in slotsData) {
            const slot = slotsData[date].find(s => s.id === slotId);
            if (slot) {
                currentSlot = slot;
                break;
            }
        }

        if (!currentSlot) {
            tg.showAlert('❌ Слот не найден');
            return;
        }

        // Если слот доступен - создаем ручное бронирование
        if (currentSlot.status === 'available') {
            // Создаем ручное бронирование (ФИО и телефон можно заполнить позже)
            const response = await fetch(`${API_URL}/admin/bookings/manual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    init_data: tg.initData,
                    slot_id: slotId,
                    client_name: '',
                    client_phone: ''
                })
            });

            const data = await response.json();

            if (data.success) {
                tg.showAlert('✅ Слот забронирован. Заполните данные во вкладке "Записи"');
                loadData();
                // Переключаемся на вкладку записей
                switchTab('bookings');
            } else {
                tg.showAlert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
            }
        }
        // Если слот забронирован - разблокируем (возвращаем в доступные)
        else if (currentSlot.status === 'booked' || currentSlot.status === 'blocked') {
            const response = await fetch(`${API_URL}/admin/slots/${slotId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    init_data: tg.initData,
                    status: 'available'
                })
            });

            const data = await response.json();

            if (data.success) {
                tg.showAlert('✅ Слот разблокирован');
                loadData();
            } else {
                tg.showAlert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
            }
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

// Кнопка возврата в главное меню
tg.MainButton.setText('↩️ Вернуться в главное меню');
tg.MainButton.onClick(() => tg.close());
tg.MainButton.show();
