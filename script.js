document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const API_URL = 'https://primetechmedia-com.onrender.com';

    let adminToken = sessionStorage.getItem('adminToken') || '';

    const $ = (id) => document.getElementById(id);

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function normalizeType(item) {
    const value = String(
        item?.type ||
        item?.submissionType ||
        item?.submission_type ||
        item?.category ||
        item?.formType ||
        item?.form_type ||
        ''
    )
        .trim()
        .toLowerCase()
        .replace(/[-\s]+/g, '_');

    if (
        value === 'booking' ||
        value === 'bookings' ||
        value === 'booking_request' ||
        value === 'booking_form' ||
        value.includes('booking')
    ) {
        return 'booking';
    }

    if (
        value === 'contact' ||
        value === 'contacts' ||
        value === 'contact_form' ||
        value === 'contact_forms' ||
        value === 'contact_submission' ||
        value.includes('contact')
    ) {
        return 'contact';
    }

    if (
        value === 'newsletter' ||
        value === 'subscription' ||
        value === 'subscribe'
    ) {
        return 'newsletter';
    }

    return value;
}

    function formatDate(value) {
        if (!value) {
            return '—';
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString();
    }

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        };
    }

    function showLogin() {
        const loginCard = $('adminLoginCard');
        const dashboard = $('adminDashboard');

        if (loginCard) {
            loginCard.classList.remove('d-none');
        }

        if (dashboard) {
            dashboard.classList.add('d-none');
        }
    }

    function showDashboard() {
        const loginCard = $('adminLoginCard');
        const dashboard = $('adminDashboard');

        if (loginCard) {
            loginCard.classList.add('d-none');
        }

        if (dashboard) {
            dashboard.classList.remove('d-none');
        }
    }

    function clearLogin() {
        adminToken = '';

        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminAuthenticated');

        showLogin();
    }

    async function apiFetch(url, options = {}) {
        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, 20000);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeout);

            return response;
        } catch (error) {
            clearTimeout(timeout);

            if (error.name === 'AbortError') {
                throw new Error('Server request timed out.');
            }

            throw error;
        }
    }

    async function getSubmissions() {
        if (!adminToken) {
            throw new Error('Admin authentication required.');
        }

        const response = await apiFetch(
            `${API_URL}/api/submissions`,
            {
                method: 'GET',
                headers: getHeaders()
            }
        );
        if (response.status === 401) {
            clearLogin();
            throw new Error(
                'Admin session expired. Please log in again.'
            );
        }

        if (!response.ok) {
            throw new Error(
                `Unable to load submissions. HTTP ${response.status}`
            );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error('Invalid API response:', data);
            throw new Error(
                'Server returned an invalid submissions response.'
            );
        }

        return data;
    }
    async function saveSubmission(type, payload) {
        const submission = {
            type: type,
            ...payload,
            createdAt: new Date().toISOString()
        };

        console.log('Sending submission:', submission);

        const response = await apiFetch(
            `${API_URL}/api/submissions`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(submission)
            }
        );

        let data = {};

        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }

        console.log('Submission response:', {
            status: response.status,
            data: data
        });

        if (!response.ok) {
            throw new Error(
                data.error ||
                `Unable to save submission. HTTP ${response.status}`
            );
        }

        return data;
    }


    async function handleFormSubmit(
        form,
        type,
        successMessage
    ) {
        if (!form) {
            return;
        }

        const submitButton =
            form.querySelector(
                'button[type="submit"], input[type="submit"]'
            );

        const originalButtonText =
            submitButton
                ? submitButton.textContent
                : '';

        const payload =
            Object.fromEntries(
                new FormData(form).entries()
            );

        console.log(
            `Submitting ${type}:`,
            payload
        );

        try {

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent =
                    'Sending...';
            }

            await saveSubmission(
                type,
                payload
            );

            alert(successMessage);

            form.reset();

        } catch (error) {

            console.error(
                `${type} submission failed:`,
                error
            );

            alert(
                error.message ||
                'Unable to save your submission right now. Please try again.'
            );

        } finally {

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent =
                    originalButtonText;
            }
        }
    }


    const bookingForm =
        document.getElementById(
            'bookingForm'
        );

    if (bookingForm) {

        bookingForm.addEventListener(
            'submit',
            function (event) {

                event.preventDefault();

                handleFormSubmit(
                    bookingForm,
                    'booking',
                    'Booking request received. Our team will contact you shortly.'
                );
            }
        );
    }


    const contactForm =
        document.getElementById(
            'contactForm'
        );

    if (contactForm) {

        contactForm.addEventListener(
            'submit',
            function (event) {

                event.preventDefault();

                handleFormSubmit(
                    contactForm,
                    'contact',
                    'Message sent successfully. We will reply soon.'
                );
            }
        );
    }


    const newsletterForm =
        document.getElementById(
            'newsletterForm'
        );

    if (newsletterForm) {

        newsletterForm.addEventListener(
            'submit',
            function (event) {

                event.preventDefault();

                handleFormSubmit(
                    newsletterForm,
                    'newsletter',
                    'Thank you for subscribing!'
                );
            }
        );
    }
    async function updateMetrics() {
        const leadsElement = $('totalLeadsMetric');
        const bookingsElement = $('totalBookingsMetric');
        const contactsElement = $('totalContactsMetric');

        if (leadsElement) {
            leadsElement.textContent = '...';
        }

        if (bookingsElement) {
            bookingsElement.textContent = '...';
        }

        if (contactsElement) {
            contactsElement.textContent = '...';
        }

        try {
            const submissions = await getSubmissions();

            const bookings = submissions.filter(
                item => normalizeType(item) === 'booking'
            );

            const contacts = submissions.filter(
                item => normalizeType(item) === 'contact'
            );

            if (leadsElement) {
                leadsElement.textContent = submissions.length;
            }

            if (bookingsElement) {
                bookingsElement.textContent = bookings.length;
            }

            if (contactsElement) {
                contactsElement.textContent = contacts.length;
            }

            console.log('Dashboard metrics updated:', {
                leads: submissions.length,
                bookings: bookings.length,
                contacts: contacts.length
            });

        } catch (error) {
            console.error(
                'Metrics error:',
                error
            );

            if (leadsElement) {
                leadsElement.textContent = '0';
            }

            if (bookingsElement) {
                bookingsElement.textContent = '0';
            }

            if (contactsElement) {
                contactsElement.textContent = '0';
            }
        }
    }

    function renderBookings(bookings) {
    const tbody = document.getElementById('bookingsTableBody');

    if (!tbody) {
        console.error('bookingsTableBody not found');
        return;
    }

    console.log('Rendering bookings:', bookings);

    if (!Array.isArray(bookings) || bookings.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    No bookings yet.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = bookings.map((booking) => {

        const name =
            booking.name ||
            booking.customerName ||
            '—';

        const service =
            booking.service ||
            booking.serviceCategory ||
            booking.category ||
            '—';

        const date =
            booking.date ||
            booking.preferredDate ||
            booking.bookingDate ||
            '—';

        const time =
            booking.time ||
            booking.preferredTime ||
            booking.bookingTime ||
            '—';

        const budget =
            booking.budget ||
            booking.projectBudget ||
            '—';

        const email =
            booking.email ||
            '—';

        const phone =
            booking.phone ||
            booking.phoneNumber ||
            '—';

        const message =
            booking.message ||
            booking.projectDescription ||
            booking.description ||
            booking.project ||
            '—';

        return `
            <tr>

                <td>
                    <strong>${escapeHtml(name)}</strong>
                    ${
                        booking.company
                            ? `<br><small class="text-muted">${escapeHtml(booking.company)}</small>`
                            : ''
                    }
                </td>

                <td>
                    ${escapeHtml(service)}
                </td>

                <td>
                    ${escapeHtml(date)}
                </td>

                <td>
                    ${escapeHtml(time)}
                </td>

                <td>
                    ${escapeHtml(budget)}
                </td>

                <td>
                    <strong>${escapeHtml(email)}</strong>
                    <br>
                    <small>${escapeHtml(phone)}</small>
                </td>

                <td>
                    ${escapeHtml(message)}
                </td>

                <td>
                    <button
                        type="button"
                        class="admin-action-btn"
                        data-action="reply"
                        data-id="${escapeHtml(booking.id || '')}"
                        title="Reply"
                    >
                        <i class="fa-solid fa-reply"></i>
                    </button>

                    <button
                        type="button"
                        class="admin-action-btn"
                        data-action="note"
                        data-id="${escapeHtml(booking.id || '')}"
                        title="Note"
                    >
                        <i class="fa-solid fa-note-sticky"></i>
                    </button>
                </td>

            </tr>
        `;
    }).join('');

    console.log(
        'Bookings rendered:',
        tbody.children.length
    );
}

    function renderContacts(contacts) {
    const tbody = document.getElementById(
        'contactSubmissionsTableBody'
    );

    if (!tbody) {
        console.error(
            'contactSubmissionsTableBody not found'
        );
        return;
    }

    console.log(
        'Rendering contacts:',
        contacts
    );

    if (!Array.isArray(contacts) || contacts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    No messages yet.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = contacts.map((contact) => {

        const name =
            contact.name ||
            contact.customerName ||
            '—';

        const email =
            contact.email ||
            '—';

        const phone =
            contact.phone ||
            contact.phoneNumber ||
            '—';

        const subject =
            contact.subject ||
            contact.title ||
            'Website Enquiry';

        const message =
            contact.message ||
            contact.description ||
            '—';

        const date =
            contact.createdAt ||
            contact.created_at ||
            contact.date;

        return `
            <tr>

                <td>
                    <strong>
                        ${escapeHtml(name)}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(email)}
                </td>

                <td>
                    ${escapeHtml(phone)}
                </td>

                <td>
                    ${escapeHtml(subject)}
                </td>

                <td>
                    ${escapeHtml(message)}
                </td>

                <td>
                    ${escapeHtml(formatDate(date))}
                </td>

                <td>
                    <button
                        type="button"
                        class="admin-action-btn"
                        data-action="reply"
                        data-id="${escapeHtml(contact.id || '')}"
                        title="Reply"
                    >
                        <i class="fa-solid fa-reply"></i>
                    </button>

                    <button
                        type="button"
                        class="admin-action-btn"
                        data-action="note"
                        data-id="${escapeHtml(contact.id || '')}"
                        title="Note"
                    >
                        <i class="fa-solid fa-note-sticky"></i>
                    </button>
                </td>

            </tr>
        `;
    }).join('');

    console.log(
        'Contacts rendered:',
        tbody.children.length
    );
}

    function renderClients(submissions) {
    const tbody = document.getElementById('clientsTableBody');

    if (!tbody) {
        console.error('clientsTableBody does not exist.');
        return;
    }

    console.log('CLIENT SOURCE DATA:', submissions);

    if (!Array.isArray(submissions)) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger">
                    Invalid client data.
                </td>
            </tr>
        `;
        return;
    }

    const clients = new Map();

    submissions.forEach(function (submission) {
        if (!submission) {
            return;
        }

        const email = String(
            submission.email || ''
        ).trim().toLowerCase();

        if (!email) {
            return;
        }

        const name =
            submission.name ||
            submission.customerName ||
            '—';

        const company =
            submission.company ||
            '—';

        const phone =
            submission.phone ||
            '—';

        const service =
            submission.service ||
            submission.serviceCategory ||
            '—';

        const activity =
            submission.createdAt ||
            submission.created_at ||
            null;

        if (!clients.has(email)) {
            clients.set(email, {
                name: name,
                company: company,
                email: email,
                phone: phone,
                service: service,
                submissions: 1,
                lastActivity: activity
            });

            return;
        }

        const client = clients.get(email);

        client.submissions += 1;

        if (
            activity &&
            (
                !client.lastActivity ||
                new Date(activity) >
                new Date(client.lastActivity)
            )
        ) {
            client.lastActivity = activity;
        }

        if (
            client.name === '—' &&
            name !== '—'
        ) {
            client.name = name;
        }

        if (
            client.company === '—' &&
            company !== '—'
        ) {
            client.company = company;
        }

        if (
            client.phone === '—' &&
            phone !== '—'
        ) {
            client.phone = phone;
        }

        if (
            client.service === '—' &&
            service !== '—'
        ) {
            client.service = service;
        }
    });

    const clientList = Array.from(
        clients.values()
    );

    console.log(
        'CLIENTS FOUND:',
        clientList
    );

    if (!clientList.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    No clients yet.
                </td>
            </tr>
        `;
        return;
    }

    clientList.sort(function (a, b) {
        const dateA = a.lastActivity
            ? new Date(a.lastActivity).getTime()
            : 0;

        const dateB = b.lastActivity
            ? new Date(b.lastActivity).getTime()
            : 0;

        return dateB - dateA;
    });

    tbody.innerHTML = clientList.map(
        function (client) {
            return `
                <tr>
                    <td>
                        <strong>
                            ${escapeHtml(client.name)}
                        </strong>
                    </td>

                    <td>
                        ${escapeHtml(client.company)}
                    </td>

                    <td>
                        ${escapeHtml(client.email)}
                    </td>

                    <td>
                        ${escapeHtml(client.phone)}
                    </td>

                    <td>
                        ${escapeHtml(client.service)}
                    </td>

                    <td>
                        ${escapeHtml(
                            formatDate(
                                client.lastActivity
                            )
                        )}
                    </td>
                </tr>
            `;
        }
    ).join('');
}

async function loadBookings() {
    const tbody = $('bookingsTableBody');

    if (!tbody) {
        console.error('bookingsTableBody does not exist.');
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center">
                Loading bookings...
            </td>
        </tr>
    `;

    try {
        const submissions = await getSubmissions();

        console.log('ALL SUBMISSIONS:', submissions);

        const bookings = submissions.filter(function (item) {
            return normalizeType(item) === 'booking';
        });

        console.log('BOOKINGS FOUND:', bookings);

        renderBookings(bookings);

    } catch (error) {
        console.error('Bookings error:', error);

        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}

async function loadContacts() {
    const tbody = $('contactSubmissionsTableBody');

    if (!tbody) {
        console.error(
            'contactSubmissionsTableBody does not exist.'
        );
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center">
                Loading messages...
            </td>
        </tr>
    `;

    try {
        const submissions = await getSubmissions();

        console.log('ALL SUBMISSIONS:', submissions);

        const contacts = submissions.filter(function (item) {
            return normalizeType(item) === 'contact';
        });

        console.log('CONTACTS FOUND:', contacts);

        renderContacts(contacts);

    } catch (error) {
        console.error('Contacts error:', error);

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}
    async function loadClients() {
    const tbody = $('clientsTableBody');

    if (!tbody) {
        console.error(
            'clientsTableBody does not exist.'
        );
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center">
                Loading clients...
            </td>
        </tr>
    `;

    try {
        const submissions = await getSubmissions();

        console.log('CLIENT SOURCE DATA:', submissions);

        renderClients(submissions);

    } catch (error) {

        console.error('Clients error:', error);

        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}
    function showSection(sectionName) {

    console.log(
        'Opening admin section:',
        sectionName
    );

    const sections =
        document.querySelectorAll(
            '.admin-section'
        );

    const navItems =
        document.querySelectorAll(
            '.admin-nav-item'
        );

    sections.forEach(function (section) {

        const active =
            section.dataset.section ===
            sectionName;

        if (active) {
            section.classList.remove('d-none');
            section.classList.add('admin-section--active');
            section.style.display = 'block';
        } else {
            section.classList.add('d-none');
            section.classList.remove('admin-section--active');
            section.style.display = 'none';
        }
    });

    navItems.forEach(function (item) {

        item.classList.toggle(
            'active',
            item.dataset.section ===
            sectionName
        );
    });

    if (sectionName === 'dashboard') {
        updateMetrics();
    }

    if (sectionName === 'bookings') {
        loadBookings();
    }

    if (sectionName === 'clients') {
        loadClients();
    }

    if (sectionName === 'contact-forms') {
        loadContacts();
    }
}
    async function login(password) {

        const response =
            await apiFetch(
                `${API_URL}/api/admin/login`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({
                        password: password
                    })
                }
            );

        let data = {};

        try {
            data = await response.json();
        } catch (error) {
            throw new Error(
                'Invalid response from login server.'
            );
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                'Incorrect admin password.'
            );
        }

        if (!data.token) {
            throw new Error(
                'Login succeeded but no token was returned.'
            );
        }

        adminToken =
            data.token;

        sessionStorage.setItem(
            'adminToken',
            adminToken
        );

        sessionStorage.setItem(
            'adminAuthenticated',
            'true'
        );
    }

    const loginForm =
        $('adminLoginForm');

    if (loginForm) {

        loginForm.addEventListener(
            'submit',
            async function (event) {

                event.preventDefault();

                const passwordInput =
                    $('adminPassword');

                const password =
                    passwordInput?.value.trim() ||
                    '';

                if (!password) {
                    alert(
                        'Please enter your admin password.'
                    );
                    return;
                }

                const button =
                    loginForm.querySelector(
                        'button[type="submit"]'
                    );

                if (button) {
                    button.disabled = true;
                    button.textContent =
                        'Checking...';
                }

                try {

                    await login(password);

                    showDashboard();

                    loginForm.reset();

                    showSection(
                        'dashboard'
                    );

                    await updateMetrics();

                } catch (error) {

                    console.error(
                        'Admin login error:',
                        error
                    );

                    alert(
                        error.message ||
                        'Unable to connect to admin server.'
                    );

                } finally {

                    if (button) {
                        button.disabled = false;
                        button.textContent =
                            'Unlock';
                    }
                }
            }
        );
    }

    const logoutButton =
        $('logoutAdminBtn');

    if (logoutButton) {

        logoutButton.addEventListener(
            'click',
            function () {
                clearLogin();
            }
        );
    }

    document
        .querySelectorAll('.admin-nav-item')
        .forEach(function (item) {

            item.addEventListener(
                'click',
                function () {

                    const sectionName =
                        this.dataset.section;

                    if (!sectionName) {
                        return;
                    }

                    showSection(
                        sectionName
                    );
                }
            );
        });

    const refreshBookings =
        $('refreshBookingsBtn');

    if (refreshBookings) {
        refreshBookings.addEventListener(
            'click',
            loadBookings
        );
    }

    const refreshClients =
        $('refreshClientsBtn');

    if (refreshClients) {
        refreshClients.addEventListener(
            'click',
            loadClients
        );
    }

    const refreshContacts =
        $('refreshContactsBtn');

    if (refreshContacts) {
        refreshContacts.addEventListener(
            'click',
            loadContacts
        );
    }

    document.addEventListener(
    'click',
    async function (event) {

            const button =
                event.target.closest(
                    '.admin-action-btn'
                );

            if (!button) {
                return;
            }

            const action =
                button.dataset.action;

            if (action === 'reply') {
    const row = button.closest('tr');

    if (!row) {
        return;
    }

    const emailElement = row.querySelector(
        'td:nth-child(6) strong'
    );

    const recipient = emailElement
        ? emailElement.textContent.trim()
        : '';

    if (!recipient || !recipient.includes('@')) {
        alert('Unable to find the client email address.');
        return;
    }

    const subject = prompt(
        'Enter email subject:'
    );

    if (!subject || !subject.trim()) {
        return;
    }

    const message = prompt(
        'Enter your reply message:'
    );

    if (!message || !message.trim()) {
        return;
    }

    if (!adminToken) {
        alert('Please log in again.');
        return;
    }

    button.disabled = true;

    try {

        const response = await apiFetch(
            `${API_URL}/api/admin/reply`,
            {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    recipient: recipient,
                    subject: subject.trim(),
                    message: message.trim()
                })
            }
        );

        const data = await response.json();

        if (response.status === 401) {
            clearLogin();
            throw new Error(
                'Admin session expired. Please log in again.'
            );
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                'Unable to send reply.'
            );
        }

        alert(
            'Reply sent successfully.'
        );

    } catch (error) {

        console.error(
            'Reply error:',
            error
        );

        alert(
            error.message ||
            'Unable to send reply.'
        );

    } finally {

        button.disabled = false;
    }
}

            if (action === 'note') {
                alert(
                    'Notes functionality will be connected later.'
                );
            }
        }
    );

    const clearButton =
        $('clearSubmissionsBtn');

    if (clearButton) {

        clearButton.addEventListener(
            'click',
            async function () {

                if (!adminToken) {
                    alert(
                        'Please log in again.'
                    );
                    return;
                }

                const confirmed =
                    confirm(
                        'Are you sure you want to delete ALL submissions? This cannot be undone.'
                    );

                if (!confirmed) {
                    return;
                }

                try {

                    const response =
                        await apiFetch(
                            `${API_URL}/api/submissions`,
                            {
                                method: 'DELETE',
                                headers:
                                    getHeaders()
                            }
                        );

                    if (response.status === 401) {
                        clearLogin();

                        throw new Error(
                            'Admin session expired.'
                        );
                    }

                    if (!response.ok) {
                        throw new Error(
                            `HTTP ${response.status}`
                        );
                    }

                    alert(
                        'All submissions have been cleared.'
                    );

                    await updateMetrics();

                    showSection(
                        'dashboard'
                    );

                } catch (error) {

                    console.error(
                        'Clear submissions error:',
                        error
                    );

                    alert(
                        error.message ||
                        'Unable to clear submissions.'
                    );
                }
            }
        );
    }

    if (window.AOS) {

        try {
            window.AOS.init({
                duration: 800,
                once: true,
                easing: 'ease-out-cubic'
            });
        } catch (error) {
            console.warn(
                'AOS initialization failed:',
                error
            );
        }
    }

    const preloader =
        $('preloader');

    if (preloader) {

        const removePreloader =
            function () {

                preloader.style.opacity =
                    '0';

                preloader.style.pointerEvents =
                    'none';

                setTimeout(function () {

                    if (preloader.parentNode) {
                        preloader.remove();
                    }

                    document.body.style.overflow =
                        'auto';

                }, 300);
            };

        if (
            document.readyState ===
            'complete'
        ) {
            removePreloader();
        } else {

            window.addEventListener(
                'load',
                removePreloader,
                { once: true }
            );

            setTimeout(
                removePreloader,
                3000
            );
        }
    }

    const themeToggle =
        $('themeToggle');

    if (themeToggle) {

        const savedTheme =
            localStorage.getItem(
                'theme'
            );

        if (savedTheme === 'dark') {
            document.body.classList.add(
                'dark'
            );
        }

        themeToggle.addEventListener(
            'click',
            function () {

                document.body.classList.toggle(
                    'dark'
                );

                localStorage.setItem(
                    'theme',
                    document.body.classList.contains(
                        'dark'
                    )
                        ? 'dark'
                        : 'light'
                );
            }
        );
    }

    const chatToggle =
        $('chatToggle');

    const chatWidget =
        $('chatWidget');

    if (
        chatToggle &&
        chatWidget
    ) {

        chatToggle.addEventListener(
            'click',
            function () {

                chatWidget.classList.toggle(
                    'show'
                );
            }
        );
    }

    const scrollTop =
        $('scrollTop');

    if (scrollTop) {

        window.addEventListener(
            'scroll',
            function () {

                scrollTop.classList.toggle(
                    'show',
                    window.scrollY > 500
                );
            }
        );

        scrollTop.addEventListener(
            'click',
            function () {

                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }
        );
    }

    const cookieBanner =
        $('cookieBanner');

    const acceptCookies =
        $('acceptCookies');

    if (
        cookieBanner &&
        !localStorage.getItem(
            'cookiesAccepted'
        )
    ) {
        cookieBanner.classList.add(
            'show'
        );
    }

    if (acceptCookies) {

        acceptCookies.addEventListener(
            'click',
            function () {

                localStorage.setItem(
                    'cookiesAccepted',
                    'true'
                );

                cookieBanner?.classList.remove(
                    'show'
                );
            }
        );
    }

    if (adminToken) {

    console.log(
        'Existing admin token found.'
    );

    showDashboard();

    showSection('dashboard');

} else {

    console.log(
        'No admin token found.'
    );

    showLogin();
}

    console.log(
        'Prime Tech Admin System initialized.'
    );
});