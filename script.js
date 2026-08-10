document.addEventListener('DOMContentLoaded', () => {
  if (window.AOS) {
    window.AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic'
    });
  }

  const emailPublicKey = 'YOUR_PUBLIC_KEY';
  const emailServiceId = 'YOUR_SERVICE_ID';
  const emailTemplateId = 'YOUR_TEMPLATE_ID';
  const bookingTemplateId = 'YOUR_BOOKING_TEMPLATE_ID';

  const apiBaseUrl = 'https://primetechmedia-com.onrender.com';

  if (
    emailPublicKey !== 'YOUR_PUBLIC_KEY' &&
    window.emailjs
  ) {
    window.emailjs.init(emailPublicKey);
  }

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
    return Boolean(adminToken);
  }

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

    if (!Array.isArray(data)) {
      throw new Error(
        'Invalid submissions response'
      );
    }

    return data;
  }

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

      const submissionsTableBody =
        document.getElementById(
          'submissionsTableBody'
        );

      if (submissionsTableBody) {
        const filter =
          document.getElementById(
            'submissionFilter'
          )?.value || 'all';

        await loadAdminSubmissions(
          filter
        );
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderAdminTable(
    submissions
  ) {
    const tbody =
  document.getElementById(
    'bookingsTableBody'
  );

    if (!tbody) {
      return;
    }

    if (!submissions.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">
            No submissions yet.
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML = submissions
      .map((submission) => {
        const sender =
          submission.name ||
          submission.customerName ||
          submission.company ||
          submission.email ||
          '—';

        const service =
          submission.service ||
          submission.serviceCategory ||
          submission.subject ||
          '—';

        const preview =
          submission.message ||
          submission.projectDescription ||
          submission.project ||
          submission.subject ||
          submission.service ||
          submission.serviceCategory ||
          '—';

        const contact =
          [
            submission.email,
            submission.phone,
            submission.company
          ]
            .filter(Boolean)
            .join(' • ') || '—';

        const type =
          submission.type || 'contact';

        const date =
          submission.createdAt ||
          submission.created_at;

        const createdOn = date
          ? new Date(
              date
            ).toLocaleString()
          : '—';

        return `
          <tr>
            <td>
              <span class="admin-pill">
                ${escapeHtml(type)}
              </span>
            </td>

            <td>
              <strong>
                ${escapeHtml(sender)}
              </strong>
              <br>
              <small class="text-muted">
                ${escapeHtml(service)}
              </small>
            </td>

            <td>
              ${escapeHtml(preview)}
            </td>

            <td>
              ${escapeHtml(createdOn)}
            </td>

            <td>
              ${escapeHtml(contact)}
            </td>

            <td>
              <button
                class="admin-action-btn"
                data-action="reply"
                data-id="${escapeHtml(
                  submission.id || ''
                )}"
                title="Reply"
              >
                <i class="fa-solid fa-reply"></i>
              </button>

              <button
                class="admin-action-btn"
                data-action="note"
                data-id="${escapeHtml(
                  submission.id || ''
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

  async function loadAdminSubmissions(
    type = 'all'
  ) {
    const tableId =
  type === 'booking'
    ? 'bookingsTableBody'
    : 'submissionsTableBody';

const tbody =
  document.getElementById(
    tableId
  );

    try {
      const submissions =
        await getSubmissions();

      const filtered =
        type === 'all'
          ? submissions
          : submissions.filter(
              (submission) =>
                String(
                  submission.type || ''
                ).toLowerCase() ===
                String(type).toLowerCase()
            );

      renderAdminTable(
        filtered
      );
    } catch (error) {
      console.error(
        'Unable to load admin submissions:',
        error
      );

      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">
            Unable to load submissions.
          </td>
        </tr>
      `;
    }
  }

  async function updateDashboardMetrics() {
    try {
      const submissions =
        await getSubmissions();

      const now = new Date();

      const weekAgo =
        new Date(now);

      weekAgo.setDate(
        now.getDate() - 7
      );

      const leadsThisWeek =
        submissions.filter(
          (submission) => {
            const date =
              submission.createdAt ||
              submission.created_at;

            if (!date) {
              return false;
            }

            return (
              new Date(date) >=
              weekAgo
            );
          }
        ).length;

      const bookingCount =
        submissions.filter(
          (submission) =>
            String(
              submission.type || ''
            ).toLowerCase() ===
            'booking'
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
    submissions.filter(
      (submission) =>
        String(
          submission.type || ''
        ).toLowerCase() ===
        'contact'
    ).length;
}

if (projectsElement) {
  projectsElement.textContent =
    '0';
}

    } catch (error) {
      console.error(
        'Unable to update dashboard metrics:',
        error
      );
    }
  }

  const adminLoginCard =
    document.getElementById(
      'adminLoginCard'
    );

  const adminDashboard =
    document.getElementById(
      'adminDashboard'
    );

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

  adminLoginForm?.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      const password =
        adminPasswordInput?.value || '';

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

  logoutAdminBtn?.addEventListener(
    'click',
    async () => {
      try {
        if (adminToken) {
          await fetch(
            `${getApiBaseUrl()}/api/admin/logout`,
            {
              method: 'POST',
              headers: getAdminHeaders()
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

  function showSection(name) {
    adminNavItems.forEach(
      (button) => {
        button.classList.toggle(
          'active',
          button.dataset.section ===
            name
        );
      }
    );

    adminSections.forEach(
      (section) => {
        section.classList.toggle(
          'd-none',
          section.dataset.section !==
            name
        );
      }
    );

    if (name === 'bookings') {
      loadAdminSubmissions(
        'booking'
      );
    }

    if (name === 'contact-forms') {
      loadAdminSubmissions(
        'contact'
      );
    }

    if (name === 'submissions') {
      loadAdminSubmissions(
        'all'
      );
    }
  }

  adminNavItems.forEach(
    (navItem) => {
      navItem.addEventListener(
        'click',
        () => {
          const section =
            navItem.dataset.section;

          if (!section) {
            return;
          }

          showSection(section);
        }
      );
    }
  );

  async function clearSubmissions() {
    const response =
      await fetch(
        `${getApiBaseUrl()}/api/submissions`,
        {
          method: 'DELETE',
          headers: getAdminHeaders()
        }
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

        await loadAdminSubmissions(
          'all'
        );
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

  if (isAdminAuthenticated()) {
    setAdminView(true);
    updateDashboardMetrics();
  } else {
    setAdminView(false);
  }

  const preloader =
    document.getElementById(
      'preloader'
    );

  if (preloader) {
    window.addEventListener(
      'load',
      () => {
        preloader.style.opacity = '0';
        preloader.style.pointerEvents =
          'none';

        setTimeout(() => {
          preloader.remove();
        }, 500);
      }
    );
  }

  const themeToggle =
    document.getElementById(
      'themeToggle'
    );

  const savedTheme =
    localStorage.getItem(
      'theme'
    );

  if (savedTheme === 'dark') {
    document.body.classList.add(
      'dark'
    );
  }

  if (themeToggle) {
    themeToggle.addEventListener(
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
          isDark ? 'dark' : 'light'
        );
      }
    );
  }

  const chatToggle =
    document.getElementById(
      'chatToggle'
    );

  const chatWidget =
    document.getElementById(
      'chatWidget'
    );

  if (chatToggle && chatWidget) {
    chatToggle.addEventListener(
      'click',
      () => {
        chatWidget.classList.toggle(
          'show'
        );
      }
    );
  }

  const scrollTop =
    document.getElementById(
      'scrollTop'
    );

  window.addEventListener(
    'scroll',
    () => {
      if (window.scrollY > 500) {
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
            (btn) =>
              btn.classList.remove(
                'active'
              )
          );

          button.classList.add(
            'active'
          );

          const filter =
            button.dataset.filter;

          filterItems.forEach(
            (item) => {
              const categories =
                item.dataset.category;

              if (
                filter === 'all' ||
                filter === categories
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

  const testimonials =
    document.querySelectorAll(
      '.testimonial'
    );

  if (testimonials.length) {
    let index = 0;

    setInterval(() => {
      testimonials.forEach(
        (item) =>
          item.classList.remove(
            'active'
          )
      );

      index =
        (index + 1) %
        testimonials.length;

      testimonials[index].classList.add(
        'active'
      );
    }, 5000);
  }

  const searchInput =
    document.getElementById(
      'searchInput'
    );

  searchInput?.addEventListener(
    'input',
    (event) => {
      const query =
        event.target.value.toLowerCase();

      document
        .querySelectorAll(
          'main a, main button, main h1, main h2, main h3, main p'
        )
        .forEach((element) => {
          const text =
            element.textContent.toLowerCase();

          if (text.includes(query)) {
            element.style.background =
              query
                ? 'rgba(216, 163, 31, 0.18)'
                : '';
          } else {
            element.style.background =
              '';
          }
        });
    }
  );
});