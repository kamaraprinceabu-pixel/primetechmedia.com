document.addEventListener('DOMContentLoaded', () => {
  // =========================================================
  // AOS
  // =========================================================

  if (window.AOS) {
    window.AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic'
    });
  }

  // =========================================================
  // EMAIL / API CONFIG
  // =========================================================

  const emailPublicKey = 'YOUR_PUBLIC_KEY';
  const emailServiceId = 'YOUR_SERVICE_ID';
  const emailTemplateId = 'YOUR_TEMPLATE_ID';
  const bookingTemplateId = 'YOUR_BOOKING_TEMPLATE_ID';

  const apiBaseUrl =
    'https://primetechmedia-com.onrender.com';

  if (
    emailPublicKey !== 'YOUR_PUBLIC_KEY' &&
    window.emailjs
  ) {
    window.emailjs.init(emailPublicKey);
  }

  // =========================================================
  // ADMIN AUTH
  // =========================================================

  let adminToken =
    sessionStorage.getItem('adminToken') || '';

  function getApiBaseUrl() {
    return apiBaseUrl;
  }

  function getAdminHeaders() {
    const token =
      sessionStorage.getItem('adminToken') ||
      adminToken ||
      '';

    if (token) {
      adminToken = token;
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  function setAdminView(authenticated) {
    const adminLoginCard =
      document.getElementById('adminLoginCard');

    const adminDashboard =
      document.getElementById('adminDashboard');

    if (adminLoginCard) {
      adminLoginCard.classList.toggle(
        'd-none',
        authenticated
      );
    }

    if (adminDashboard) {
      adminDashboard.classList.toggle(
        'd-none',
        !authenticated
      );
    }
  }

  function isAdminAuthenticated() {
    return Boolean(
      sessionStorage.getItem('adminToken') ||
      adminToken
    );
  }

  // =========================================================
  // SUBMISSIONS API
  // =========================================================

  async function saveSubmission(type, payload) {
    const submission = {
      type,
      ...payload,
      createdAt: new Date().toISOString()
    };

    const response = await fetch(
      `${getApiBaseUrl()}/api/submissions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submission)
      }
    );

    if (!response.ok) {
      throw new Error(
        `Unable to save submission: HTTP ${response.status}`
      );
    }

    return response.json();
  }

  async function getSubmissions() {
    const response = await fetch(
      `${getApiBaseUrl()}/api/submissions`,
      {
        method: 'GET',
        headers: getAdminHeaders()
      }
    );

    console.log(
      'GET submissions status:',
      response.status
    );

    if (!response.ok) {
      if (response.status === 401) {
        adminToken = '';

        sessionStorage.removeItem(
          'adminToken'
        );

        sessionStorage.removeItem(
          'adminAuthenticated'
        );

        setAdminView(false);
      }

      throw new Error(
        `Unable to fetch submissions: HTTP ${response.status}`
      );
    }

    const data = await response.json();

    console.log(
      'Submissions received:',
      data
    );

    if (!Array.isArray(data)) {
      throw new Error(
        'Invalid submissions response'
      );
    }

    return data;
  }

  // =========================================================
  // FORM SUBMISSION
  // =========================================================

  async function handleFormSubmit(
    form,
    type,
    successMessage,
    templateId = null
  ) {
    const payload = Object.fromEntries(
      new FormData(form).entries()
    );

    try {
      await saveSubmission(
        type,
        payload
      );

      if (
        window.emailjs &&
        templateId &&
        emailPublicKey !== 'YOUR_PUBLIC_KEY' &&
        emailServiceId !== 'YOUR_SERVICE_ID'
      ) {
        try {
          await window.emailjs.send(
            emailServiceId,
            templateId,
            payload
          );
        } catch (emailError) {
          console.error(
            'Unable to send email:',
            emailError
          );
        }
      }

      if (isAdminAuthenticated()) {
        await updateDashboardMetrics();
      }

      alert(successMessage);

      form.reset();

    } catch (error) {
      console.error(
        'Submission failed:',
        error
      );

      alert(
        'Unable to save your submission right now. Please make sure the backend server is running and try again.'
      );
    }
  }

  // =========================================================
  // HTML ESCAPING
  // =========================================================

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================
  // DATE FORMAT
  // =========================================================

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

  // =========================================================
  // TYPE NORMALIZATION
  // =========================================================

  function normalizeType(submission) {
    return String(
      submission?.type || ''
    )
      .trim()
      .toLowerCase();
  }

  // =========================================================
  // BOOKING FIELD HELPERS
  // =========================================================

  function getBookingName(booking) {
    return (
      booking.name ||
      booking.customerName ||
      booking.fullName ||
      '—'
    );
  }

  function getBookingService(booking) {
    return (
      booking.service ||
      booking.serviceCategory ||
      booking.category ||
      '—'
    );
  }

  function getBookingDate(booking) {
    return (
      booking.date ||
      booking.preferredDate ||
      booking.bookingDate ||
      '—'
    );
  }

  function getBookingTime(booking) {
    return (
      booking.time ||
      booking.preferredTime ||
      booking.bookingTime ||
      '—'
    );
  }

  function getBookingBudget(booking) {
    return (
      booking.budget ||
      booking.estimatedBudget ||
      '—'
    );
  }

  function getBookingMessage(booking) {
    return (
      booking.message ||
      booking.projectDescription ||
      booking.project ||
      booking.description ||
      '—'
    );
  }

  // =========================================================
  // RENDER BOOKINGS
  // =========================================================

  function renderBookings(bookings) {
    const tbody =
      document.getElementById(
        'bookingsTableBody'
      );

    if (!tbody) {
      console.error(
        'bookingsTableBody not found'
      );

      return;
    }

    if (!Array.isArray(bookings)) {
      bookings = [];
    }

    if (!bookings.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center">
            No bookings yet.
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML = bookings
      .map((booking) => {
        return `
          <tr>

            <td>
              <strong>
                ${escapeHtml(
                  getBookingName(booking)
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
              ${escapeHtml(
                getBookingService(booking)
              )}
            </td>

            <td>
              ${escapeHtml(
                getBookingDate(booking)
              )}
            </td>

            <td>
              ${escapeHtml(
                getBookingTime(booking)
              )}
            </td>

            <td>
              ${escapeHtml(
                getBookingBudget(booking)
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
              ${escapeHtml(
                getBookingMessage(booking)
              )}
            </td>

            <td>

              <button
                class="admin-action-btn"
                data-action="reply"
                data-id="${escapeHtml(
                  booking.id || ''
                )}"
                title="Reply"
              >
                <i class="fa-solid fa-reply"></i>
              </button>

              <button
                class="admin-action-btn"
                data-action="note"
                data-id="${escapeHtml(
                  booking.id || ''
                )}"
                title="Note"
              >
                <i class="fa-solid fa-note-sticky"></i>
              </button>

            </td>

          </tr>
        `;
      })
      .join('');
  }

  // =========================================================
  // RENDER CONTACTS
  // =========================================================

  function renderContacts(contacts) {
    const tbody =
      document.getElementById(
        'contactSubmissionsTableBody'
      );

    if (!tbody) {
      console.error(
        'contactSubmissionsTableBody not found'
      );

      return;
    }

    if (!Array.isArray(contacts)) {
      contacts = [];
    }

    if (!contacts.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center">
            No messages yet.
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML = contacts
      .map((contact) => {
        return `
          <tr>

            <td>
              <strong>
                ${escapeHtml(
                  contact.name ||
                  contact.customerName ||
                  '—'
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
                contact.message ||
                contact.projectDescription ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                formatDate(
                  contact.createdAt ||
                  contact.created_at
                )
              )}
            </td>

            <td>

              <button
                class="admin-action-btn"
                data-action="reply"
                data-id="${escapeHtml(
                  contact.id || ''
                )}"
                title="Reply"
              >
                <i class="fa-solid fa-reply"></i>
              </button>

              <button
                class="admin-action-btn"
                data-action="note"
                data-id="${escapeHtml(
                  contact.id || ''
                )}"
                title="Note"
              >
                <i class="fa-solid fa-note-sticky"></i>
              </button>

            </td>

          </tr>
        `;
      })
      .join('');
  }

  // =========================================================
  // RENDER ALL SUBMISSIONS
  // =========================================================

  function renderAllSubmissions(
    submissions
  ) {
    const tbody =
      document.getElementById(
        'submissionsTableBody'
      );

    if (!tbody) {
      return;
    }

    if (!Array.isArray(submissions)) {
      submissions = [];
    }

    if (!submissions.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center">
            No submissions yet.
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML = submissions
      .map((submission) => {
        const type =
          normalizeType(
            submission
          );

        return `
          <tr>

            <td>
              <span class="admin-pill">
                ${escapeHtml(
                  type || 'unknown'
                )}
              </span>
            </td>

            <td>
              ${escapeHtml(
                submission.name ||
                submission.customerName ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                submission.email ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                submission.phone ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                submission.service ||
                submission.serviceCategory ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                submission.message ||
                submission.projectDescription ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                formatDate(
                  submission.createdAt ||
                  submission.created_at
                )
              )}
            </td>

          </tr>
        `;
      })
      .join('');
  }

  // =========================================================
  // CLIENTS
  // =========================================================

  function loadAdminClients(
    submissions
  ) {
    const tbody =
      document.getElementById(
        'clientsTableBody'
      );

    if (!tbody) {
      return;
    }

    const clients = {};

    submissions.forEach(
      (submission) => {
        const email =
          String(
            submission.email || ''
          )
            .trim()
            .toLowerCase();

        if (!email) {
          return;
        }

        const type =
          normalizeType(
            submission
          );

        if (
          type !== 'booking' &&
          type !== 'contact'
        ) {
          return;
        }

        if (!clients[email]) {
          clients[email] = {
            name:
              submission.name ||
              submission.customerName ||
              '—',

            company:
              submission.company ||
              '—',

            email,

            phone:
              submission.phone ||
              '—',

            service:
              submission.service ||
              submission.serviceCategory ||
              '—',

            lastActivity:
              submission.createdAt ||
              submission.created_at ||
              null
          };
        }

        const currentDate =
          submission.createdAt ||
          submission.created_at;

        if (
          currentDate &&
          (
            !clients[email]
              .lastActivity ||
            new Date(
              currentDate
            ) >
            new Date(
              clients[email]
                .lastActivity
            )
          )
        ) {
          clients[email]
            .lastActivity =
            currentDate;
        }

        if (
          clients[email].name === '—' &&
          (
            submission.name ||
            submission.customerName
          )
        ) {
          clients[email].name =
            submission.name ||
            submission.customerName;
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
    );

    const list =
      Object.values(clients);

    if (!list.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">
            No clients yet.
          </td>
        </tr>
      `;

      return;
    }

    list.sort(
      (a, b) =>
        new Date(
          b.lastActivity || 0
        ) -
        new Date(
          a.lastActivity || 0
        )
    );

    tbody.innerHTML = list
      .map((client) => {
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
              ${escapeHtml(
                formatDate(
                  client.lastActivity
                )
              )}
            </td>

          </tr>
        `;
      })
      .join('');
  }

  // =========================================================
  // DASHBOARD METRICS
  // =========================================================

  async function updateDashboardMetrics() {
    try {
      const submissions =
        await getSubmissions();

      const bookingCount =
        submissions.filter(
          (submission) =>
            normalizeType(
              submission
            ) === 'booking'
        ).length;

      const contactCount =
        submissions.filter(
          (submission) =>
            normalizeType(
              submission
            ) === 'contact'
        ).length;

      const projectCount =
        submissions.filter(
          (submission) =>
            normalizeType(
              submission
            ) === 'project'
        ).length;

      const leadsElement =
        document.getElementById(
          'totalLeadsMetric'
        );

      const bookingsElement =
        document.getElementById(
          'totalBookingsMetric'
        );

      const contactsElement =
        document.getElementById(
          'totalContactsMetric'
        );

      const projectsElement =
        document.getElementById(
          'totalProjectsMetric'
        );

      if (leadsElement) {
        leadsElement.textContent =
          submissions.length;
      }

      if (bookingsElement) {
        bookingsElement.textContent =
          bookingCount;
      }

      if (contactsElement) {
        contactsElement.textContent =
          contactCount;
      }

      if (projectsElement) {
        projectsElement.textContent =
          projectCount;
      }

      console.log(
        'Dashboard metrics:',
        {
          leads:
            submissions.length,
          bookings:
            bookingCount,
          contacts:
            contactCount,
          projects:
            projectCount
        }
      );

    } catch (error) {
      console.error(
        'Unable to update dashboard metrics:',
        error
      );
    }
  }

  // =========================================================
  // LOAD BOOKINGS
  // =========================================================

  async function loadBookings() {
    const tbody =
      document.getElementById(
        'bookingsTableBody'
      );

    if (!tbody) {
      console.error(
        'Bookings table not found'
      );

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
        submissions.filter(
          (item) =>
            normalizeType(item) ===
            'booking'
        );

      console.log(
        'Bookings:',
        bookings
      );

      renderBookings(
        bookings
      );

    } catch (error) {
      console.error(
        'Unable to load bookings:',
        error
      );

      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center">
            Unable to load bookings.
          </td>
        </tr>
      `;
    }
  }

  // =========================================================
  // LOAD CLIENTS
  // =========================================================

  async function loadClients() {
    const tbody =
      document.getElementById(
        'clientsTableBody'
      );

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

      loadAdminClients(
        submissions
      );

    } catch (error) {
      console.error(
        'Unable to load clients:',
        error
      );

      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">
            Unable to load clients.
          </td>
        </tr>
      `;
    }
  }

  // =========================================================
  // LOAD CONTACTS
  // =========================================================

  async function loadContacts() {
    const tbody =
      document.getElementById(
        'contactSubmissionsTableBody'
      );

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
        submissions.filter(
          (item) =>
            normalizeType(item) ===
            'contact'
        );

      console.log(
        'Contacts:',
        contacts
      );

      renderContacts(
        contacts
      );

    } catch (error) {
      console.error(
        'Unable to load contacts:',
        error
      );

      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center">
            Unable to load contact messages.
          </td>
        </tr>
      `;
    }
  }

  // =========================================================
  // LOAD PROJECTS
  // =========================================================

  async function loadProjects() {
    const container =
      document.getElementById(
        'projectsContainer'
      );

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

  // =========================================================
  // ADMIN ELEMENTS
  // =========================================================

  const adminLoginForm =
    document.getElementById(
      'adminLoginForm'
    );

  const adminPasswordInput =
    document.getElementById(
      'adminPassword'
    );

  const logoutAdminBtn =
    document.getElementById(
      'logoutAdminBtn'
    );

  const adminNavItems =
    document.querySelectorAll(
      '.admin-nav-item'
    );

  const adminSections =
    document.querySelectorAll(
      '.admin-section'
    );

  const clearSubmissionsBtn =
    document.getElementById(
      'clearSubmissionsBtn'
    );

  // =========================================================
  // ADMIN LOGIN
  // =========================================================

  adminLoginForm?.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      const password =
        adminPasswordInput?.value ||
        '';

      if (!password) {
        alert(
          'Please enter your admin password.'
        );

        return;
      }

      try {
        const response =
          await fetch(
            `${getApiBaseUrl()}/api/admin/login`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body: JSON.stringify({
                password
              })
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          alert(
            data.error ||
            'Incorrect password.'
          );

          return;
        }

        adminToken =
          data.token || '';

        if (!adminToken) {
          alert(
            'Login succeeded, but no authentication token was returned.'
          );

          return;
        }

        sessionStorage.setItem(
          'adminToken',
          adminToken
        );

        sessionStorage.setItem(
          'adminAuthenticated',
          'true'
        );

        setAdminView(true);

        adminLoginForm.reset();

        await updateDashboardMetrics();

        showSection(
          'dashboard'
        );

      } catch (error) {
        console.error(
          'Admin login failed:',
          error
        );

        alert(
          'Unable to connect to the admin server.'
        );
      }
    }
  );

  // =========================================================
  // ADMIN LOGOUT
  // =========================================================

  logoutAdminBtn?.addEventListener(
    'click',
    async () => {
      try {
        if (adminToken) {
          await fetch(
            `${getApiBaseUrl()}/api/admin/logout`,
            {
              method: 'POST',
              headers:
                getAdminHeaders()
            }
          );
        }
      } catch (error) {
        console.error(
          'Logout request failed:',
          error
        );
      }

      adminToken = '';

      sessionStorage.removeItem(
        'adminToken'
      );

      sessionStorage.removeItem(
        'adminAuthenticated'
      );

      setAdminView(false);
    }
  );

  // =========================================================
  // ADMIN SECTION NAVIGATION
  // =========================================================

  function showSection(name) {
    console.log(
      'Opening admin section:',
      name
    );

    adminNavItems.forEach(
      (item) => {
        item.classList.toggle(
          'active',
          item.dataset.section ===
            name
        );
      }
    );

    adminSections.forEach(
      (section) => {
        const isActive =
          section.dataset.section ===
          name;

        section.classList.toggle(
          'd-none',
          !isActive
        );

        section.classList.toggle(
          'admin-section--active',
          isActive
        );
      }
    );

    if (name === 'dashboard') {
      updateDashboardMetrics();
    }

    if (name === 'bookings') {
      loadBookings();
    }

    if (name === 'clients') {
      loadClients();
    }

    if (name === 'projects') {
      loadProjects();
    }

    if (name === 'contact-forms') {
      loadContacts();
    }
  }

  adminNavItems.forEach(
    (item) => {
      item.addEventListener(
        'click',
        () => {
          const sectionName =
            item.dataset.section;

          console.log(
            'Navigation clicked:',
            sectionName
          );

          if (!sectionName) {
            return;
          }

          showSection(
            sectionName
          );
        }
      );
    }
  );

  // =========================================================
  // CLEAR SUBMISSIONS
  // =========================================================

  async function clearSubmissions() {
    const response =
      await fetch(
        `${getApiBaseUrl()}/api/submissions`,
        {
          method: 'DELETE',
          headers:
            getAdminHeaders()
        }
      );

    if (!response.ok) {
      if (
        response.status ===
        401
      ) {
        adminToken = '';

        sessionStorage.removeItem(
          'adminToken'
        );

        sessionStorage.removeItem(
          'adminAuthenticated'
        );

        setAdminView(false);
      }

      throw new Error(
        `Unable to clear submissions: HTTP ${response.status}`
      );
    }
  }

  clearSubmissionsBtn?.addEventListener(
    'click',
    async () => {
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
        await clearSubmissions();

        alert(
          'All submissions have been cleared.'
        );

        await updateDashboardMetrics();

        await loadBookings();

        await loadContacts();

        await loadClients();

      } catch (error) {
        console.error(
          'Clear submissions failed:',
          error
        );

        alert(
          'Unable to clear submissions.'
        );
      }
    }
  );

  // =========================================================
  // ADMIN ACTION BUTTONS
  // =========================================================

  document.addEventListener(
    'click',
    (event) => {
      const button =
        event.target.closest(
          '.admin-action-btn'
        );

      if (!button) {
        return;
      }

      const action =
        button.dataset.action;

      const id =
        button.dataset.id;

      console.log(
        'Admin action:',
        action,
        id
      );

      if (action === 'reply') {
        alert(
          'Reply functionality will be connected to email next.'
        );
      }

      if (action === 'note') {
        alert(
          'Notes functionality will be added to the client management system.'
        );
      }
    }
  );

  // =========================================================
  // REFRESH BUTTONS
  // =========================================================

  document
    .getElementById(
      'refreshBookingsBtn'
    )
    ?.addEventListener(
      'click',
      () => {
        loadBookings();
      }
    );

  document
    .getElementById(
      'refreshContactsBtn'
    )
    ?.addEventListener(
      'click',
      () => {
        loadContacts();
      }
    );

  document
    .getElementById(
      'refreshClientsBtn'
    )
    ?.addEventListener(
      'click',
      () => {
        loadClients();
      }
    );

  document
    .getElementById(
      'addProjectBtn'
    )
    ?.addEventListener(
      'click',
      () => {
        alert(
          'Project management will be added next.'
        );
      }
    );

  // =========================================================
  // INITIAL ADMIN STATE
  // =========================================================

  if (isAdminAuthenticated()) {
    setAdminView(true);

    console.log(
      'Admin authenticated. Loading dashboard...'
    );

    updateDashboardMetrics()
      .then(() => {
        console.log(
          'Dashboard metrics loaded successfully.'
        );
      })
      .catch((error) => {
        console.error(
          'Dashboard loading failed:',
          error
        );
      });

  } else {
    setAdminView(false);
  }

  // =========================================================
  // PRELOADER
  // =========================================================

  const preloader =
    document.getElementById(
      'preloader'
    );

  if (preloader) {
    window.addEventListener(
      'load',
      () => {
        preloader.style.opacity =
          '0';

        preloader.style.pointerEvents =
          'none';

        setTimeout(
          () => {
            preloader.remove();
          },
          500
        );
      }
    );
  }

  // =========================================================
  // THEME
  // =========================================================

  const themeToggle =
    document.getElementById(
      'themeToggle'
    );

  const savedTheme =
    localStorage.getItem(
      'theme'
    );

  if (
    savedTheme === 'dark'
  ) {
    document.body.classList.add(
      'dark'
    );
  }

  themeToggle?.addEventListener(
    'click',
    () => {
      document.body.classList.toggle(
        'dark'
      );

      const isDark =
        document.body.classList.contains(
          'dark'
        );

      localStorage.setItem(
        'theme',
        isDark
          ? 'dark'
          : 'light'
      );
    }
  );

  // =========================================================
  // CHAT
  // =========================================================

  const chatToggle =
    document.getElementById(
      'chatToggle'
    );

  const chatWidget =
    document.getElementById(
      'chatWidget'
    );

  if (
    chatToggle &&
    chatWidget
  ) {
    chatToggle.addEventListener(
      'click',
      () => {
        chatWidget.classList.toggle(
          'show'
        );
      }
    );
  }

  // =========================================================
  // SCROLL TO TOP
  // =========================================================

  const scrollTop =
    document.getElementById(
      'scrollTop'
    );

  window.addEventListener(
    'scroll',
    () => {
      if (
        window.scrollY >
        500
      ) {
        scrollTop?.classList.add(
          'show'
        );
      } else {
        scrollTop?.classList.remove(
          'show'
        );
      }
    }
  );

  scrollTop?.addEventListener(
    'click',
    () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  );

  // =========================================================
  // COOKIES
  // =========================================================

  const cookieBanner =
    document.getElementById(
      'cookieBanner'
    );

  const acceptCookies =
    document.getElementById(
      'acceptCookies'
    );

  const cookieAccepted =
    localStorage.getItem(
      'cookiesAccepted'
    );

  if (!cookieAccepted) {
    cookieBanner?.classList.add(
      'show'
    );
  }

  acceptCookies?.addEventListener(
    'click',
    () => {
      localStorage.setItem(
        'cookiesAccepted',
        'true'
      );

      cookieBanner?.classList.remove(
        'show'
      );
    }
  );

  // =========================================================
  // NEWSLETTER
  // =========================================================

  const newsletterForm =
    document.getElementById(
      'newsletterForm'
    );

  newsletterForm?.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();

      handleFormSubmit(
        newsletterForm,
        'newsletter',
        'Thank you for subscribing!'
      );
    }
  );

  // =========================================================
  // BOOKING FORM
  // =========================================================

  const bookingForm =
    document.getElementById(
      'bookingForm'
    );

  bookingForm?.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();

      handleFormSubmit(
        bookingForm,
        'booking',
        'Booking request received. Our team will contact you shortly.',
        bookingTemplateId
      );
    }
  );

  // =========================================================
  // CONTACT FORM
  // =========================================================

  const contactForm =
    document.getElementById(
      'contactForm'
    );

  contactForm?.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();

      handleFormSubmit(
        contactForm,
        'contact',
        'Message sent successfully. We will reply soon.',
        emailTemplateId
      );
    }
  );

  // =========================================================
  // PORTFOLIO FILTERS
  // =========================================================

  const filterButtons =
    document.querySelectorAll(
      '.filter-btn'
    );

  const filterItems =
    document.querySelectorAll(
      '.filter-item'
    );

  filterButtons.forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          filterButtons.forEach(
            (btn) => {
              btn.classList.remove(
                'active'
              );
            }
          );

          button.classList.add(
            'active'
          );

          const filter =
            button.dataset.filter;

          filterItems.forEach(
            (item) => {
              const categories =
                item.dataset.category ||
                '';

              if (
                filter === 'all' ||
                categories
                  .split(' ')
                  .includes(filter)
              ) {
                item.style.display =
                  'block';
              } else {
                item.style.display =
                  'none';
              }
            }
          );
        }
      );
    }
  );

  // =========================================================
  // TESTIMONIALS
  // =========================================================

  const testimonials =
    document.querySelectorAll(
      '.testimonial'
    );

  if (testimonials.length) {
    let index = 0;

    testimonials.forEach(
      (item, itemIndex) => {
        item.classList.toggle(
          'active',
          itemIndex === 0
        );
      }
    );

    setInterval(
      () => {
        testimonials.forEach(
          (item) => {
            item.classList.remove(
              'active'
            );
          }
        );

        index =
          (index + 1) %
          testimonials.length;

        testimonials[
          index
        ].classList.add(
          'active'
        );
      },
      5000
    );
  }

  // =========================================================
  // SEARCH
  // =========================================================

  const searchInput =
    document.getElementById(
      'searchInput'
    );

  searchInput?.addEventListener(
    'input',
    (event) => {
      const query =
        String(
          event.target.value || ''
        ).toLowerCase();

      document
        .querySelectorAll(
          'main a, main button, main h1, main h2, main h3, main p'
        )
        .forEach(
          (element) => {
            const text =
              element.textContent
                .toLowerCase();

            if (
              query &&
              text.includes(query)
            ) {
              element.style.background =
                'rgba(216, 163, 31, 0.18)';
            } else {
              element.style.background =
                '';
            }
          }
        );
    }
  );

  // =========================================================
  // INITIAL SECTION
  // =========================================================

  if (
    isAdminAuthenticated()
  ) {
    showSection(
      'dashboard'
    );
  }
});