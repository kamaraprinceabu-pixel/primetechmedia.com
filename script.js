document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const API_URL = 'https://primetechmedia-com.onrender.com';

    let adminToken = sessionStorage.getItem('adminToken') || '';

    function get(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDate(value) {
        if (!value) {
            return '—';
        }

        const date = new Date(value);

        if (isNaN(date.getTime())) {
            return escapeHtml(value);
        }

        return date.toLocaleString();
    }

    function normalizeType(item) {
        return String(item?.type || '')
            .trim()
            .toLowerCase();
    }

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + adminToken
        };
    }

    async function apiRequest(url, options = {}) {
        const controller = new AbortController();

        const timeout = setTimeout(function () {
            controller.abort();
        }, 30000);

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
                throw new Error(
                    'The server took too long to respond. Please try again.'
                );
            }

            throw error;
        }
    }

    function showLogin() {
        const login = get('adminLoginCard');
        const dashboard = get('adminDashboard');

        if (login) {
            login.classList.remove('d-none');
        }

        if (dashboard) {
            dashboard.classList.add('d-none');
        }
    }

    function showDashboard() {
        const login = get('adminLoginCard');
        const dashboard = get('adminDashboard');

        if (login) {
            login.classList.add('d-none');
        }

        if (dashboard) {
            dashboard.classList.remove('d-none');
        }
    }

    function logout() {
        adminToken = '';

        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminAuthenticated');

        showLogin();
    }

    async function getSubmissions() {
        if (!adminToken) {
            throw new Error('You are not logged in.');
        }

        const response = await apiRequest(
            API_URL + '/api/submissions',
            {
                method: 'GET',
                headers: getHeaders()
            }
        );

        if (response.status === 401) {
            logout();

            throw new Error(
                'Your admin session has expired. Please log in again.'
            );
        }

        if (!response.ok) {
            throw new Error(
                'Server error: HTTP ' + response.status
            );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error(
                'The server returned invalid submission data.'
            );
        }

        return data;
    }

    function setMetric(id, value) {
        const element = get(id);

        if (element) {
            element.textContent = value;
        }
    }

    async function updateDashboard() {
        setMetric('totalLeadsMetric', '...');
        setMetric('totalBookingsMetric', '...');
        setMetric('totalContactsMetric', '...');
        setMetric('totalProjectsMetric', '0');

        try {
            const submissions = await getSubmissions();

            const bookings = submissions.filter(function (item) {
                return normalizeType(item) === 'booking';
            });

            const contacts = submissions.filter(function (item) {
                return normalizeType(item) === 'contact';
            });

            setMetric(
                'totalLeadsMetric',
                submissions.length
            );

            setMetric(
                'totalBookingsMetric',
                bookings.length
            );

            setMetric(
                'totalContactsMetric',
                contacts.length
            );

        } catch (error) {
            console.error(
                'Dashboard loading error:',
                error
            );

            setMetric('totalLeadsMetric', '0');
            setMetric('totalBookingsMetric', '0');
            setMetric('totalContactsMetric', '0');
        }
    }

    function renderBookings(bookings) {
        const tbody = get('bookingsTableBody');

        if (!tbody) {
            console.error(
                'Missing element: bookingsTableBody'
            );
            return;
        }

        if (bookings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        No bookings yet.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = bookings.map(function (booking) {

            const service =
                booking.service ||
                booking.serviceCategory ||
                '—';

            const date =
                booking.date ||
                booking.preferredDate ||
                '—';

            const time =
                booking.time ||
                booking.preferredTime ||
                '—';

            const message =
                booking.message ||
                booking.projectDescription ||
                booking.project ||
                '—';

            return `
                <tr>

                    <td>
                        <strong>
                            ${escapeHtml(
                                booking.name || '—'
                            )}
                        </strong>

                        <br>

                        <small class="text-muted">
                            ${escapeHtml(
                                booking.company || '—'
                            )}
                        </small>
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
                        ${escapeHtml(
                            booking.budget || '—'
                        )}
                    </td>

                    <td>
                        <strong>
                            ${escapeHtml(
                                booking.email || '—'
                            )}
                        </strong>

                        <br>

                        <small>
                            ${escapeHtml(
                                booking.phone || '—'
                            )}
                        </small>
                    </td>

                    <td>
                        ${escapeHtml(message)}
                    </td>

                    <td>

                        <button
                            type="button"
                            class="admin-action-btn"
                            data-action="reply"
                            data-id="${escapeHtml(
                                booking.id || ''
                            )}"
                        >
                            Reply
                        </button>

                        <button
                            type="button"
                            class="admin-action-btn"
                            data-action="note"
                            data-id="${escapeHtml(
                                booking.id || ''
                            )}"
                        >
                            Note
                        </button>

                    </td>

                </tr>
            `;
        }).join('');
    }

    function renderContacts(contacts) {
        const tbody =
            get('contactSubmissionsTableBody');

        if (!tbody) {
            console.error(
                'Missing element: contactSubmissionsTableBody'
            );
            return;
        }

        if (contacts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        No messages yet.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = contacts.map(function (contact) {

            return `
                <tr>

                    <td>
                        <strong>
                            ${escapeHtml(
                                contact.name || '—'
                            )}
                        </strong>
                    </td>

                    <td>
                        ${escapeHtml(
                            contact.email || '—'
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            contact.phone || '—'
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            contact.subject ||
                            'Website Enquiry'
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            contact.message || '—'
                        )}
                    </td>

                    <td>
                        ${formatDate(
                            contact.createdAt ||
                            contact.created_at
                        )}
                    </td>

                    <td>

                        <button
                            type="button"
                            class="admin-action-btn"
                            data-action="reply"
                            data-id="${escapeHtml(
                                contact.id || ''
                            )}"
                        >
                            Reply
                        </button>

                        <button
                            type="button"
                            class="admin-action-btn"
                            data-action="note"
                            data-id="${escapeHtml(
                                contact.id || ''
                            )}"
                        >
                            Note
                        </button>

                    </td>

                </tr>
            `;
        }).join('');
    }

    function renderClients(submissions) {
        const tbody = get('clientsTableBody');

        if (!tbody) {
            console.error(
                'Missing element: clientsTableBody'
            );
            return;
        }

        const clients = {};

        submissions.forEach(function (submission) {

            const type = normalizeType(submission);

            if (
                type !== 'booking' &&
                type !== 'contact'
            ) {
                return;
            }

            const email = String(
                submission.email || ''
            )
            .trim()
            .toLowerCase();

            if (!email) {
                return;
            }

            const activity =
                submission.createdAt ||
                submission.created_at ||
                null;

            if (!clients[email]) {

                clients[email] = {
                    name:
                        submission.name || '—',

                    company:
                        submission.company || '—',

                    email:
                        email,

                    phone:
                        submission.phone || '—',

                    service:
                        submission.service ||
                        submission.serviceCategory ||
                        '—',

                    lastActivity:
                        activity
                };

            } else {

                if (
                    activity &&
                    (
                        !clients[email].lastActivity ||
                        new Date(activity) >
                        new Date(
                            clients[email].lastActivity
                        )
                    )
                ) {
                    clients[email].lastActivity =
                        activity;
                }

                if (
                    clients[email].name === '—' &&
                    submission.name
                ) {
                    clients[email].name =
                        submission.name;
                }

                if (
                    clients[email].company === '—' &&
                    submission.company
                ) {
                    clients[email].company =
                        submission.company;
                }

                if (
                    clients[email].phone === '—' &&
                    submission.phone
                ) {
                    clients[email].phone =
                        submission.phone;
                }

                if (
                    clients[email].service === '—' &&
                    (
                        submission.service ||
                        submission.serviceCategory
                    )
                ) {
                    clients[email].service =
                        submission.service ||
                        submission.serviceCategory;
                }
            }
        });

        const list =
            Object.values(clients);

        if (list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        No clients yet.
                    </td>
                </tr>
            `;
            return;
        }

        list.sort(function (a, b) {

            return (
                new Date(
                    b.lastActivity || 0
                ) -
                new Date(
                    a.lastActivity || 0
                )
            );

        });

        tbody.innerHTML = list.map(function (client) {

            return `
                <tr>

                    <td>
                        ${escapeHtml(
                            client.name
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            client.company
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            client.email
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            client.phone
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            client.service
                        )}
                    </td>

                    <td>
                        ${formatDate(
                            client.lastActivity
                        )}
                    </td>

                </tr>
            `;

        }).join('');
    }

    function renderProjects() {
        const container =
            get('projectsContainer');

        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="col-12">

                <div class="text-center p-4">

                    <p class="text-muted mb-0">
                        No projects added yet.
                    </p>

                </div>

            </div>
        `;
    }

    async function loadBookings() {
        const tbody =
            get('bookingsTableBody');

        if (!tbody) {
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

            const submissions =
                await getSubmissions();

            const bookings =
                submissions.filter(function (item) {
                    return normalizeType(item) === 'booking';
                });

            renderBookings(bookings);

        } catch (error) {

            console.error(
                'Bookings loading error:',
                error
            );

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="text-center text-danger"
                    >
                        ${escapeHtml(
                            error.message ||
                            'Unable to load bookings.'
                        )}
                    </td>
                </tr>
            `;
        }
    }

    async function loadClients() {
        const tbody =
            get('clientsTableBody');

        if (!tbody) {
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

            const submissions =
                await getSubmissions();

            renderClients(submissions);

        } catch (error) {

            console.error(
                'Clients loading error:',
                error
            );

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="6"
                        class="text-center text-danger"
                    >
                        ${escapeHtml(
                            error.message ||
                            'Unable to load clients.'
                        )}
                    </td>
                </tr>
            `;
        }
    }

    async function loadContacts() {
        const tbody =
            get('contactSubmissionsTableBody');

        if (!tbody) {
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

            const submissions =
                await getSubmissions();

            const contacts =
                submissions.filter(function (item) {
                    return normalizeType(item) === 'contact';
                });

            renderContacts(contacts);

        } catch (error) {

            console.error(
                'Contacts loading error:',
                error
            );

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="text-center text-danger"
                    >
                        ${escapeHtml(
                            error.message ||
                            'Unable to load contact messages.'
                        )}
                    </td>
                </tr>
            `;
        }
    }

    function showSection(sectionName) {
    const sections = document.querySelectorAll('.admin-section');
    const navItems = document.querySelectorAll('.admin-nav-item');

    sections.forEach(function (section) {
        const currentSection = section.getAttribute('data-section');

        if (currentSection === sectionName) {
            section.classList.remove('d-none');
            section.classList.add('admin-section--active');
        } else {
            section.classList.add('d-none');
            section.classList.remove('admin-section--active');
        }
    });

    navItems.forEach(function (item) {
        const currentSection = item.getAttribute('data-section');

        item.classList.toggle(
            'active',
            currentSection === sectionName
        );
    });

    if (sectionName === 'bookings') {
        if (typeof loadBookings === 'function') {
            loadBookings();
        }
    }

    if (sectionName === 'clients') {
        if (typeof loadClients === 'function') {
            loadClients();
        }
    }

    if (sectionName === 'projects') {
        if (typeof loadProjects === 'function') {
            loadProjects();
        }
    }

    if (sectionName === 'contact-forms') {
        if (typeof loadContacts === 'function') {
            loadContacts();
        }
    }
}


const adminNavItems = document.querySelectorAll('.admin-nav-item');

adminNavItems.forEach(function (item) {
    item.addEventListener('click', function (event) {
        event.preventDefault();

        const sectionName = this.getAttribute('data-section');

        if (!sectionName) {
            return;
        }

        showSection(sectionName);
    });
});

    async function login(password) {

        const response =
            await apiRequest(
                API_URL + '/api/admin/login',
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

            data =
                await response.json();

        } catch (error) {

            throw new Error(
                'The server returned an invalid login response.'
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
        get('adminLoginForm');

    if (loginForm) {

        loginForm.addEventListener(
            'submit',
            async function (event) {

                event.preventDefault();

                const passwordInput =
                    get('adminPassword');

                const password =
                    passwordInput?.value.trim() || '';

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

                } catch (error) {

                    console.error(
                        'Login error:',
                        error
                    );

                    alert(
                        error.message ||
                        'Unable to connect to the admin server.'
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
        get('logoutAdminBtn');

    if (logoutButton) {

        logoutButton.addEventListener(
            'click',
            function () {
                logout();
            }
        );
    }

    document
        .querySelectorAll(
            '.admin-nav-item'
        )
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
        get('refreshBookingsBtn');

    if (refreshBookings) {

        refreshBookings.addEventListener(
            'click',
            loadBookings
        );
    }

    const refreshClients =
        get('refreshClientsBtn');

    if (refreshClients) {

        refreshClients.addEventListener(
            'click',
            loadClients
        );
    }

    const refreshContacts =
        get('refreshContactsBtn');

    if (refreshContacts) {

        refreshContacts.addEventListener(
            'click',
            loadContacts
        );
    }

    const addProject =
        get('addProjectBtn');

    if (addProject) {

        addProject.addEventListener(
            'click',
            function () {

                alert(
                    'Project management will be added here.'
                );
            }
        );
    }

    document.addEventListener(
        'click',
        function (event) {

            const target =
                event.target;

            if (
                !target ||
                !target.closest
            ) {
                return;
            }

            const button =
                target.closest(
                    '.admin-action-btn'
                );

            if (!button) {
                return;
            }

            const action =
                button.dataset.action;

            if (action === 'reply') {

                alert(
                    'Reply functionality will be connected to email.'
                );
            }

            if (action === 'note') {

                alert(
                    'Notes functionality will be added later.'
                );
            }
        }
    );

    const clearButton =
        get('clearSubmissionsBtn');

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
                        await apiRequest(
                            API_URL +
                            '/api/submissions',
                            {
                                method: 'DELETE',
                                headers:
                                    getHeaders()
                            }
                        );

                    if (
                        response.status ===
                        401
                    ) {

                        logout();

                        throw new Error(
                            'Admin session expired.'
                        );
                    }

                    if (!response.ok) {

                        throw new Error(
                            'Server returned HTTP ' +
                            response.status
                        );
                    }

                    alert(
                        'All submissions have been cleared.'
                    );

                    await updateDashboard();

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

    const preloader =
        get('preloader');

    function removePreloader() {

        if (!preloader) {
            return;
        }

        preloader.style.opacity =
            '0';

        preloader.style.pointerEvents =
            'none';

        document.body.style.overflow =
            'auto';

        setTimeout(function () {

            if (preloader.parentNode) {
                preloader.remove();
            }

        }, 300);
    }

    if (preloader) {

        removePreloader();

        window.addEventListener(
            'load',
            removePreloader,
            {
                once: true
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
                'AOS error:',
                error
            );
        }
    }

    const themeToggle =
        get('themeToggle');

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
        get('chatToggle');

    const chatWidget =
        get('chatWidget');

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
        get('scrollTop');

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
        get('cookieBanner');

    const acceptCookies =
        get('acceptCookies');

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

                if (cookieBanner) {

                    cookieBanner.classList.remove(
                        'show'
                    );
                }
            }
        );
    }

    const searchInput =
        get('searchInput');

    if (searchInput) {

        searchInput.addEventListener(
            'input',
            function (event) {

                const query =
                    event.target.value
                        .toLowerCase()
                        .trim();

                document
                    .querySelectorAll(
                        'main a, main button, main h1, main h2, main h3, main p'
                    )
                    .forEach(
                        function (element) {

                            const text =
                                element.textContent
                                    .toLowerCase();

                            element.style.background =
                                query &&
                                text.includes(
                                    query
                                )
                                    ? 'rgba(216, 163, 31, 0.18)'
                                    : '';
                        }
                    );
            }
        );
    }

    if (adminToken) {

        showDashboard();

        showSection(
            'dashboard'
        );

    } else {

        showLogin();
    }

    console.log(
        'Prime Tech Admin System initialized.'
    );
});