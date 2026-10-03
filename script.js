/* ==========================================
   SRC Board Evaluation Portal — JavaScript
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {

    // ---- Particles Background ----
    const particlesContainer = document.getElementById('particles');
    const colors = ['#6C3CE1', '#8B5CF6', '#06D6A0', '#FFD166', '#EF476F'];

    for (let i = 0; i < 40; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 6 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particle.style.animationDuration = `${Math.random() * 20 + 15}s`;
        particle.style.animationDelay = `${Math.random() * 10}s`;
        particlesContainer.appendChild(particle);
    }

    // ---- SVG Gradient for Rating Circle ----
    const svg = document.querySelector('.rating-circle svg');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'ratingGradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '0%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#6C3CE1');

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#A78BFA');

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    svg.insertBefore(defs, svg.firstChild);

    // ---- Custom Slider ----
    const track = document.getElementById('sliderTrack');
    const fill = document.getElementById('sliderFill');
    const thumb = document.getElementById('sliderThumb');
    const ratingInput = document.getElementById('ratingInput');
    const ratingNumber = document.getElementById('ratingNumber');
    const ratingLabel = document.getElementById('ratingLabel');
    const ratingArc = document.getElementById('ratingArc');
    const summaryRating = document.getElementById('summaryRating');

    let isDragging = false;
    const circumference = 2 * Math.PI * 85; // ~534

    function updateRating(value) {
        value = Math.max(0, Math.min(100, Math.round(value)));
        const pct = value / 100;

        fill.style.width = `${pct * 100}%`;
        thumb.style.left = `${pct * 100}%`;
        ratingInput.value = value;
        ratingNumber.textContent = value;

        // Circle arc
        ratingArc.style.strokeDasharray = circumference;
        ratingArc.style.strokeDashoffset = circumference - (circumference * pct);

        // Dynamic color
        let color, label;
        if (value <= 20) { color = '#EF476F'; label = 'Very Poor'; }
        else if (value <= 40) { color = '#F87171'; label = 'Below Average'; }
        else if (value <= 55) { color = '#FFD166'; label = 'Average'; }
        else if (value <= 70) { color = '#FBBF24'; label = 'Good'; }
        else if (value <= 85) { color = '#34D399'; label = 'Very Good'; }
        else { color = '#06D6A0'; label = 'Excellent'; }

        ratingLabel.textContent = label;
        ratingLabel.style.color = color;

        // Update gradient stops
        stop1.setAttribute('stop-color', color);

        // Summary
        summaryRating.textContent = `${value}%`;

        // Progress update
        updateProgress();
    }

    function getValueFromPosition(clientX) {
        const rect = track.getBoundingClientRect();
        let pct = (clientX - rect.left) / rect.width;
        return pct * 100;
    }

    track.addEventListener('mousedown', (e) => {
        isDragging = true;
        updateRating(getValueFromPosition(e.clientX));
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) updateRating(getValueFromPosition(e.clientX));
    });

    document.addEventListener('mouseup', () => { isDragging = false; });

    // Touch support
    track.addEventListener('touchstart', (e) => {
        isDragging = true;
        updateRating(getValueFromPosition(e.touches[0].clientX));
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (isDragging) updateRating(getValueFromPosition(e.touches[0].clientX));
    }, { passive: true });

    document.addEventListener('touchend', () => { isDragging = false; });

    // Initialize slider
    updateRating(50);

    // ---- Star Ratings ----
    document.querySelectorAll('.mini-stars').forEach(starGroup => {
        const stars = starGroup.querySelectorAll('i');
        let currentRating = 0;

        stars.forEach(star => {
            star.addEventListener('mouseenter', () => {
                const val = parseInt(star.dataset.value);
                stars.forEach(s => {
                    s.classList.toggle('active', parseInt(s.dataset.value) <= val);
                });
            });

            star.addEventListener('mouseleave', () => {
                stars.forEach(s => {
                    s.classList.toggle('active', parseInt(s.dataset.value) <= currentRating);
                });
            });

            star.addEventListener('click', () => {
                currentRating = parseInt(star.dataset.value);
                stars.forEach(s => {
                    s.classList.toggle('active', parseInt(s.dataset.value) <= currentRating);
                });
                // Pulse animation
                star.style.transform = 'scale(1.4)';
                setTimeout(() => star.style.transform = '', 200);
            });
        });
    });

    // ---- Tags ----
    document.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('click', () => {
            tag.classList.toggle('selected');
            // Find sibling textarea and append/remove tag text
            const card = tag.closest('.card-body');
            if (card) {
                const textarea = card.querySelector('textarea');
                if (tag.classList.contains('selected')) {
                    const current = textarea.value.trim();
                    textarea.value = current ? `${current}\n• ${tag.textContent}` : `• ${tag.textContent}`;
                } else {
                    textarea.value = textarea.value.replace(`\n• ${tag.textContent}`, '').replace(`• ${tag.textContent}`, '').trim();
                }
                updateCharCount(textarea);
                updateProgress();
            }
        });
    });

    // ---- Character Counts ----
    const charMappings = [
        { textarea: 'concerns', counter: 'concernCount', max: 1000 },
        { textarea: 'commendations', counter: 'commendCount', max: 1000 },
        { textarea: 'recommendations', counter: 'recommendCount', max: 1000 },
        { textarea: 'issueDescription', counter: 'issueDescCount', max: 2000 }
    ];

    function updateCharCount(textarea) {
        const mapping = charMappings.find(m => m.textarea === textarea.id);
        if (mapping) {
            const counter = document.getElementById(mapping.counter);
            counter.textContent = textarea.value.length;
            if (textarea.value.length > mapping.max) {
                textarea.value = textarea.value.substring(0, mapping.max);
                counter.textContent = mapping.max;
            }
        }
    }

    charMappings.forEach(mapping => {
        const textarea = document.getElementById(mapping.textarea);
        textarea.addEventListener('input', () => {
            updateCharCount(textarea);
            updateProgress();
        });
    });

    // ---- Issue Categories ----
    const issueCats = document.querySelectorAll('.issue-cat');
    const issueCategoryInput = document.getElementById('issueCategory');

    issueCats.forEach(cat => {
        cat.addEventListener('click', () => {
            issueCats.forEach(c => c.classList.remove('active'));
            cat.classList.add('active');
            issueCategoryInput.value = cat.dataset.cat;
        });
    });

    // ---- Navigation ----
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Scroll effect
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
        updateActiveNav();
    });

    // Hamburger
    hamburger.addEventListener('click', () => {
        mobileMenu.classList.toggle('open');
    });

    // Close mobile menu on link click
    document.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('open');
        });
    });

    // Active nav tracking
    function updateActiveNav() {
        const sections = ['hero', 'rating', 'feedback', 'issues'];
        let current = 'hero';

        sections.forEach(id => {
            const section = document.getElementById(id);
            if (section && window.scrollY >= section.offsetTop - 200) {
                current = id;
            }
        });

        navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
        });
    }

    // ---- Scroll Animations ----
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => entry.target.classList.add('visible'), index * 100);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));

    // ---- Progress Bar ----
    function updateProgress() {
        let filled = 0;
        const total = 7; // rating(auto), 3 feedbacks, title, location, description

        // Rating is always filled
        filled++;

        if (document.getElementById('concerns').value.trim()) filled++;
        if (document.getElementById('commendations').value.trim()) filled++;
        if (document.getElementById('recommendations').value.trim()) filled++;
        if (document.getElementById('issueTitle').value.trim()) filled++;
        if (document.getElementById('issueLocation').value.trim()) filled++;
        if (document.getElementById('issueDescription').value.trim()) filled++;

        const pct = (filled / total) * 100;
        document.getElementById('progressFill').style.width = `${pct}%`;

        // Update summary
        const feedbackCount = [
            document.getElementById('concerns').value.trim(),
            document.getElementById('commendations').value.trim(),
            document.getElementById('recommendations').value.trim()
        ].filter(Boolean).length;

        document.getElementById('summaryFeedback').textContent = `${feedbackCount} / 3 completed`;
        document.getElementById('summaryIssue').textContent =
            document.getElementById('issueTitle').value.trim() ? 'Reported' : 'Not reported';
    }

    // Listen to all inputs for progress
    document.querySelectorAll('input[type="text"], textarea, select').forEach(el => {
        el.addEventListener('input', updateProgress);
        el.addEventListener('change', updateProgress);
    });

    // ---- Form Submission ----
    const form = document.getElementById('evaluationForm');
    const submitBtn = document.getElementById('submitBtn');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // Collect all data
        const data = {
            rating: ratingInput.value,
            starRatings: {},
            concerns: document.getElementById('concerns').value,
            commendations: document.getElementById('commendations').value,
            recommendations: document.getElementById('recommendations').value,
            selectedTags: Array.from(document.querySelectorAll('.tag.selected')).map(t => ({
                category: t.dataset.category,
                text: t.textContent
            })),
            issue: {
                category: issueCategoryInput.value,
                title: document.getElementById('issueTitle').value,
                location: document.getElementById('issueLocation').value,
                priority: document.getElementById('issuePriority').value,
                description: document.getElementById('issueDescription').value
            },
            submittedAt: new Date().toISOString()
        };

        // Collect star ratings
        document.querySelectorAll('.mini-stars').forEach(group => {
            const name = group.dataset.name;
            const activeStars = group.querySelectorAll('i.active').length;
            data.starRatings[name] = activeStars;
        });

        // Animate submission
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        // Simulate submission (replace with real API call)
        setTimeout(() => {
            submitBtn.classList.remove('loading');
            submitBtn.classList.add('success');

            // Update fake stats
            const responseCount = document.getElementById('responseCount');
            const currentCount = parseInt(responseCount.textContent) || 0;
            animateNumber(responseCount, currentCount, currentCount + 1);

            const avgRating = document.getElementById('avgRating');
            avgRating.textContent = `${data.rating}%`;

            if (data.issue.title) {
                const issueCount = document.getElementById('issueCount');
                const currentIssues = parseInt(issueCount.textContent) || 0;
                animateNumber(issueCount, currentIssues, currentIssues + 1);
            }

            // Show modal
            setTimeout(() => {
                document.getElementById('successModal').classList.add('open');
                createConfetti();
            }, 500);

            // Save to localStorage
            const submissions = JSON.parse(localStorage.getItem('srcEvaluations') || '[]');
            submissions.push(data);
            localStorage.setItem('srcEvaluations', JSON.stringify(submissions));

            console.log('Evaluation submitted:', data);
        }, 1500);
    });

    // ---- Number Animation ----
    function animateNumber(element, from, to) {
        const duration = 800;
        const startTime = Date.now();

        function update() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            element.textContent = Math.round(from + (to - from) * eased);
            if (progress < 1) requestAnimationFrame(update);
        }

        update();
    }

    // ---- Confetti ----
    function createConfetti() {
        const container = document.getElementById('confetti');
        const confettiColors = ['#6C3CE1', '#06D6A0', '#FFD166', '#EF476F', '#8B5CF6', '#34D399'];

        for (let i = 0; i < 60; i++) {
            const piece = document.createElement('div');
            piece.style.cssText = `
                position: absolute;
                width: ${Math.random() * 10 + 5}px;
                height: ${Math.random() * 10 + 5}px;
                background: ${confettiColors[Math.floor(Math.random() * confettiColors.length)]};
                border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
                left: ${Math.random() * 100}%;
                top: -20px;
                opacity: 0;
                animation: confettiFall ${Math.random() * 2 + 1}s ease ${Math.random() * 0.5}s forwards;
            `;
            container.appendChild(piece);
        }

        // Add confetti animation
        if (!document.getElementById('confettiStyle')) {
            const style = document.createElement('style');
            style.id = 'confettiStyle';
            style.textContent = `
                @keyframes confettiFall {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(300px) rotate(${Math.random() * 720}deg); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ---- Load Previous Stats from localStorage ----
    function loadStats() {
        const submissions = JSON.parse(localStorage.getItem('srcEvaluations') || '[]');
        document.getElementById('responseCount').textContent = submissions.length;

        if (submissions.length > 0) {
            const avgRatingVal = Math.round(
                submissions.reduce((sum, s) => sum + parseInt(s.rating), 0) / submissions.length
            );
            document.getElementById('avgRating').textContent = `${avgRatingVal}%`;

            const issueTotal = submissions.filter(s => s.issue && s.issue.title).length;
            document.getElementById('issueCount').textContent = issueTotal;
        }
    }

    loadStats();
    updateProgress();
});

// ---- Close Modal ----
function closeModal() {
    document.getElementById('successModal').classList.remove('open');

    // Reset form
    document.getElementById('evaluationForm').reset();
    document.querySelectorAll('.tag.selected').forEach(t => t.classList.remove('selected'));
    document.querySelectorAll('.mini-stars i').forEach(s => s.classList.remove('active'));

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.classList.remove('success');
    submitBtn.disabled = false;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
