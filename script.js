document.addEventListener('DOMContentLoaded', () => {
  if (window.AOS) {
    window.AOS.init({ duration: 800, once: true, easing: 'ease-out-cubic' });
  }

  const emailPublicKey = 'YOUR_PUBLIC_KEY';
  const emailServiceId = 'YOUR_SERVICE_ID';
  const emailTemplateId = 'YOUR_TEMPLATE_ID';
  const bookingTemplateId = 'YOUR_BOOKING_TEMPLATE_ID';
  const adminPassword = 'PrimeTech2026!';
  if (emailPublicKey !== 'YOUR_PUBLIC_KEY' && window.emailjs) {
    window.emailjs.init(emailPublicKey);
  }

  const apiBaseUrl = 'https://primetechmedia-com.onrender.com';

  function getApiBaseUrl() {
    return apiBaseUrl;
  }

  async function saveSubmission(type, payload) {
    const submission = { type, ...payload, createdAt: new Date().toISOString() };
    const response = await fetch(`${getApiBaseUrl()}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission)
    });

    if (!response.ok) {
      throw new Error('Unable to save submission');
    }

    return response.json();
  }

  async function getSubmissions(type = 'all') {
    const response = await fetch(`${getApiBaseUrl()}/api/submissions`);
    if (!response.ok) {
      throw new Error('Unable to fetch submissions');
    }
    const submissions = await response.json();
    if (type === 'all') {
      return submissions;
    }
    return submissions.filter((submission) => submission.type === type);
  }

  async function clearSubmissions() {
    const response = await fetch(`${getApiBaseUrl()}/api/submissions`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Unable to clear submissions');
    }
    return true;
  }

  async function handleFormSubmit(form, type, successMessage, templateId = null) {
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      await saveSubmission(type, payload);

      if (window.emailjs && templateId && emailPublicKey !== 'YOUR_PUBLIC_KEY' && emailServiceId !== 'YOUR_SERVICE_ID') {
        try {
          await window.emailjs.send(emailServiceId, templateId, payload);
        } catch (emailError) {
          console.error('Unable to send email:', emailError);
        }
      }

      if (document.getElementById('submissionsTableBody')) {
        await loadAdminSubmissions(document.getElementById('submissionFilter')?.value || 'all');
      }

      alert(successMessage);
      form.reset();
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Unable to save your submission right now. Please make sure the backend server is running at https://primetechmedia-com.onrender.com and try again.');
    }
  }

  function renderAdminTable(submissions) {
    const tbody = document.getElementById('submissionsTableBody');
    if (!tbody) return;

    if (!submissions.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No submissions yet.</td></tr>';
      return;
    }

    tbody.innerHTML = submissions.map((submission) => {
      const preview = submission.message || submission.project || submission.subject || submission.service || submission.email || submission.name || '—';
      const sender = submission.name || submission.company || submission.email || '—';
      const contactDetails = [submission.email, submission.phone, submission.company].filter(Boolean).join(' • ') || '—';
      const service = submission.service || submission.subject || '—';
      const typeLabel = submission.type || 'contact';
      const createdOn = submission.createdAt ? new Date(submission.createdAt).toLocaleString() : '—';
      return `
        <tr>
          <td><span class="admin-pill">${typeLabel}</span></td>
          <td>
            <strong>${sender}</strong><br />
            <small class="text-muted">${service}</small>
          </td>
          <td>${preview}</td>
          <td>${createdOn}</td>
          <td>${contactDetails}</td>
          <td>
            <button class="admin-action-btn" data-action="reply" data-id="${submission.id}" title="Reply"><i class="fa-solid fa-reply"></i></button>
            <button class="admin-action-btn" data-action="note" data-id="${submission.id}" title="Note"><i class="fa-solid fa-note-sticky"></i></button>
          </td>
        </tr>`;
    }).join('');
  }

  async function loadAdminSubmissions(type = 'all') {
    const submissions = await getSubmissions(type);
    renderAdminTable(submissions);
  }

  const preloader = document.getElementById('preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      preloader.style.opacity = '0';
      preloader.style.pointerEvents = 'none';
      setTimeout(() => preloader.remove(), 500);
    });
  }

  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const isDark = document.body.classList.contains('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }

  const chatToggle = document.getElementById('chatToggle');
  const chatWidget = document.getElementById('chatWidget');
  if (chatToggle && chatWidget) {
    chatToggle.addEventListener('click', () => chatWidget.classList.toggle('show'));
  }

  const scrollTop = document.getElementById('scrollTop');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 500) {
      scrollTop?.classList.add('show');
    } else {
      scrollTop?.classList.remove('show');
    }
  });

  scrollTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const cookieBanner = document.getElementById('cookieBanner');
  const acceptCookies = document.getElementById('acceptCookies');
  const cookieAccepted = localStorage.getItem('cookiesAccepted');
  if (!cookieAccepted) {
    cookieBanner?.classList.add('show');
  }
  acceptCookies?.addEventListener('click', () => {
    localStorage.setItem('cookiesAccepted', 'true');
    cookieBanner?.classList.remove('show');
  });

  const newsletterForm = document.getElementById('newsletterForm');
  newsletterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    handleFormSubmit(newsletterForm, 'newsletter', 'Thank you for subscribing!');
  });

  const bookingForm = document.getElementById('bookingForm');
  bookingForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    handleFormSubmit(bookingForm, 'booking', 'Booking request received. Our team will contact you shortly.', bookingTemplateId);
  });

  const contactForm = document.getElementById('contactForm');
  contactForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    handleFormSubmit(contactForm, 'contact', 'Message sent successfully. We will reply soon.', emailTemplateId);
  });

  const filterButtons = document.querySelectorAll('.filter-btn');
  const filterItems = document.querySelectorAll('.filter-item');
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      filterButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      const filter = button.dataset.filter;
      filterItems.forEach((item) => {
        const categories = item.dataset.category;
        if (filter === 'all' || filter === categories) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  const testimonials = document.querySelectorAll('.testimonial');
  if (testimonials.length) {
    let index = 0;
    setInterval(() => {
      testimonials.forEach((item) => item.classList.remove('active'));
      index = (index + 1) % testimonials.length;
      testimonials[index].classList.add('active');
    }, 5000);
  }

  const searchInput = document.getElementById('searchInput');
  searchInput?.addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase();
    document.querySelectorAll('main a, main button, main h1, main h2, main h3, main p').forEach((element) => {
      const text = element.textContent.toLowerCase();
      if (text.includes(query)) {
        element.style.background = query ? 'rgba(216, 163, 31, 0.18)' : '';
      } else {
        element.style.background = '';
      }
    });
  });

  const submissionFilter = document.getElementById('submissionFilter');
  const clearSubmissionsBtn = document.getElementById('clearSubmissionsBtn');
  const logoutAdminBtn = document.getElementById('logoutAdminBtn');
  const adminLoginCard = document.getElementById('adminLoginCard');
  const adminDashboard = document.getElementById('adminDashboard');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminPasswordInput = document.getElementById('adminPassword');

  function isAdminAuthenticated() {
    return localStorage.getItem('adminAuthenticated') === 'true';
  }

  function setAdminView(authenticated) {
    if (adminLoginCard) {
      adminLoginCard.classList.toggle('d-none', authenticated);
    }
    if (adminDashboard) {
      adminDashboard.classList.toggle('d-none', !authenticated);
    }
  }

  if (isAdminAuthenticated()) {
    setAdminView(true);
  } else {
    setAdminView(false);
  }

  adminLoginForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (adminPasswordInput?.value === adminPassword) {
      localStorage.setItem('adminAuthenticated', 'true');
      setAdminView(true);
      adminLoginForm.reset();
      loadAdminSubmissions(submissionFilter?.value || 'all');
    } else {
      alert('Incorrect password.');
    }
  });

  logoutAdminBtn?.addEventListener('click', () => {
    localStorage.removeItem('adminAuthenticated');
    setAdminView(false);
  });

  const adminNavItems = document.querySelectorAll('.admin-nav-item');
  const adminSections = document.querySelectorAll('.admin-section');
  const adminToolbarHeader = document.querySelector('.admin-toolbar h3');
  const adminToolbarText = document.querySelector('.admin-toolbar p');

  const sectionLabels = {
    dashboard: 'Dashboard',
    analytics: 'Analytics',
    clients: 'Clients',
    bookings: 'Bookings',
    projects: 'Projects',
    services: 'Services',
    finance: 'Finance',
    quotations: 'Quotations',
    invoices: 'Invoices',
    'contact-forms': 'Contact Forms',
    portfolio: 'Portfolio',
    'website-cms': 'Website CMS',
    testimonials: 'Testimonials',
    marketing: 'Marketing',
    'file-manager': 'File Manager',
    staff: 'Staff',
    notifications: 'Notifications',
    'ai-assistant': 'AI Assistant',
    settings: 'Settings',
    security: 'Security',
    reports: 'Reports'
  };

  function showSection(name) {
    adminNavItems.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.section === name);
    });
    adminSections.forEach((section) => {
      section.classList.toggle('d-none', section.dataset.section !== name);
    });
    if (adminToolbarHeader) {
      adminToolbarHeader.textContent = sectionLabels[name];
    }
    if (name === 'contact-forms') {
    loadAdminSubmissions(submissionFilter?.value || 'all');
}
  adminNavItems.forEach((navItem) => {
    navItem.addEventListener('click', () => {
      const sectionKey = navItem.dataset.section;
      if (sectionKey === 'logout') {
        localStorage.removeItem('adminAuthenticated');
        setAdminView(false);
        return;
      }
      if (sectionKey) {
        adminNavItems.forEach((btn) => btn.classList.toggle('active', btn === navItem));
        showSection(sectionKey);
      }
    });
  });

  if (submissionFilter) {
    submissionFilter.addEventListener('change', () => loadAdminSubmissions(submissionFilter.value));
  }

  clearSubmissionsBtn?.addEventListener('click', async () => {
    try {
      await clearSubmissions();
      await loadAdminSubmissions(submissionFilter?.value || 'all');
      alert('All submissions cleared.');
    } catch (error) {
      console.error(error);
      alert('Unable to clear submissions right now.');
    }
  });

  document.addEventListener('click', (event) => {
    const actionButton = event.target.closest('.admin-action-btn');
    if (!actionButton) return;

    const action = actionButton.dataset.action;
    if (action === 'reply') {
      alert('Reply workflow will be wired to your email provider once credentials are added.');
    }
    if (action === 'note') {
      alert('Notes can be expanded into a CRM or follow-up workflow in the next step.');
    }
  });

  if (document.getElementById('submissionsTableBody') && isAdminAuthenticated()) {
    loadAdminSubmissions(submissionFilter?.value || 'all');
  }
});
