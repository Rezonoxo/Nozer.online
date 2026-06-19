let currentpage = 'home';
let pendingRedirectUrl = null;
let pendingRedirectTarget = null;
let starIntervalId = null;
let activeModalState = null;
let contentData = null;
let musicFadeFrame = null;
let activeSettingsCategory = 'sound';
let nameTypewriterTimeout = null;
let wakeupOverlayReady = false;
let wakeupOverlayKeyHandler = null;
let revealObserver = null;
let deferredHomeWidgetsReady = false;
let deferredPresenceReady = false;
let deferredHomeObserver = null;

// Manual notice toggle for visitors.
const SITE_NOTICE_CONFIG = {
    enabled: true,
    dismissible: true,
    message: 'The website is currently being rebuilt, so some features may not work as expected.'
};

const SETTINGS_KEY = 'nozer_settings_v1';
const WELCOME_GUIDE_STORAGE_KEY = 'nozer_welcome_guide_seen_v1';
const DEFAULT_SHORTCUTS = {
    togglePlayPause: 'Space',
    previousTrack: 'ArrowLeft',
    nextTrack: 'ArrowRight',
    openPlaylist: 'KeyP',
    openSettings: 'KeyO',
    gotoHome: 'Digit1',
    gotoAbout: 'Digit2',
    gotoProjects: 'Digit3',
    gotoSkills: 'Digit4',
    gotoContact: 'Digit5'
};

const SHORTCUT_ACTIONS = [
    { id: 'togglePlayPause', title: 'Play / Pause', desc: 'Pauses or resumes the current track.' },
    { id: 'previousTrack', title: 'Previous track', desc: 'Skips to the previous song.' },
    { id: 'nextTrack', title: 'Next track', desc: 'Skips to the next song.' },
    { id: 'openPlaylist', title: 'Open playlist', desc: 'Opens the playlist panel.' },
    { id: 'openSettings', title: 'Open settings', desc: 'Opens the settings window.' },
    { id: 'gotoHome', title: 'Go to Home', desc: 'Switches to the Home page.' },
    { id: 'gotoAbout', title: 'Go to About', desc: 'Switches to the About page.' },
    { id: 'gotoProjects', title: 'Go to Projects', desc: 'Switches to the Projects page.' },
    { id: 'gotoSkills', title: 'Go to Skills', desc: 'Switches to the Skills page.' },
    { id: 'gotoContact', title: 'Go to Contact', desc: 'Switches to the Contact page.' }
];

const defaultSettings = {
    theme: 'dark',
    mute: false,
    volume: 0.6,
    cursorEnabled: true,
    confirmExternal: true,
    reduceMotion: false,
    highContrast: false,
    largeText: false,
    focusOutlines: false,
    dyslexiaFont: false,
    floatingPlayerEnabled: true,
    miniPlayerSnapAssist: true,
    shortcuts: { ...DEFAULT_SHORTCUTS },
    miniPlayerCollapsed: false,
    performanceMode: false
};

let settings = loadSettings();
settings.shortcuts = { ...DEFAULT_SHORTCUTS, ...(settings.shortcuts || {}) };

let names = ['Nozer'];
let pageTitles = {
    base: 'Nozer',
    home: 'Home',
    about: 'About',
    projects: 'Projects',
    skills: 'Skills',
    contact: 'Contact'
};
let currentNameIndex = 0;

let musicTracks = [];
let currentMusicTrack = 0;
let musicAudio = null;
let isMusicPlaying = false;
let aboutPortraitAutoRotateId = null;
let miniMusicObserver = null;
let isMainPlayerVisible = true;
let miniPlayerDismissed = false;
let PROJECTS = [];

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) {
            // Detect system theme preference if no saved settings
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const systemTheme = prefersDark ? 'dark' : 'light';
            return { ...defaultSettings, theme: systemTheme };
        }
        const parsed = JSON.parse(raw);
        const merged = { ...defaultSettings, ...parsed };
        if (merged.theme !== 'light' && merged.theme !== 'dark') {
            merged.theme = defaultSettings.theme;
        }
        return merged;
    } catch (error) {
        return { ...defaultSettings };
    }
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderFavoritesFromContent(favorites) {
    if (!favorites) return;
    const card = document.getElementById('favorites-card');
    if (!card) return;

    const subtitleEl = card.querySelector('.favorites-subtitle');
    const introEl = card.querySelector('.favorites-intro');
    const tabsContainer = card.querySelector('.favorites-tabs');
    const grid = card.querySelector('.favorites-grid');
    if (!tabsContainer || !grid) return;

    if (subtitleEl && favorites.subtitle) subtitleEl.textContent = favorites.subtitle;
    if (introEl && favorites.intro) introEl.textContent = favorites.intro;

    const categories = Array.isArray(favorites.categories) ? favorites.categories : [];
    const items = Array.isArray(favorites.items) ? favorites.items : [];

    tabsContainer.innerHTML = categories.map((category, index) => `
        <button class="fav-tab ${index === 0 ? 'active' : ''}" data-fav="${escapeHtml(category.id)}" type="button">${escapeHtml(category.label)}</button>
    `).join('');

    grid.innerHTML = items.map((item) => `
        <div class="favorite-item" data-fav="${escapeHtml(item.category)}">
            <a class="favorite-tile" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" style="--fav-accent: ${escapeHtml(item.accent)}; --fav-pos: ${escapeHtml(item.position || '50% 50%')}; --fav-scale: ${escapeHtml(item.scale || '1.02')};">
                <div class="favorite-media">
                    <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.name)}" loading="lazy" decoding="async">
                    <span class="favorite-badge">${escapeHtml(item.badge || '')}</span>
                </div>
                <div class="favorite-meta">
                    <div class="favorite-topline">
                        <h4 class="favorite-name">${escapeHtml(item.name)}</h4>
                        <span class="favorite-link"><i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i></span>
                    </div>
                    <p class="favorite-desc">${escapeHtml(item.description || '')}</p>
                </div>
            </a>
        </div>
    `).join('');
}

function applyContentConfig(data) {
    if (!data || typeof data !== 'object') return;
    contentData = data;

    if (Array.isArray(data.names) && data.names.length) {
        names = data.names.slice();
    }

    if (data.pageTitles && typeof data.pageTitles === 'object') {
        pageTitles = { ...pageTitles, ...data.pageTitles };
    }

    if (Array.isArray(data.musicTracks) && data.musicTracks.length) {
        musicTracks = data.musicTracks.slice();
    }

    if (Array.isArray(data.projects) && data.projects.length) {
        PROJECTS = data.projects.slice();
    }

    if (data.siteNotice) {
        SITE_NOTICE_CONFIG.enabled = data.siteNotice.enabled !== false;
        SITE_NOTICE_CONFIG.dismissible = data.siteNotice.dismissible !== false;
        SITE_NOTICE_CONFIG.message = data.siteNotice.message || SITE_NOTICE_CONFIG.message;
    }

    const changingName = document.getElementById('changing-name');
    if (changingName && names.length) {
        changingName.textContent = names[0];
    }

    if (data.home?.taglinePrefix && changingName?.parentNode?.firstChild) {
        changingName.parentNode.firstChild.textContent = `${data.home.taglinePrefix} `;
    }

    if (Array.isArray(data.home?.invites)) {
        data.home.invites.slice(0, 2).forEach((invite, index) => {
            const offset = index + 1;
            const nameEl = document.getElementById(`invite-${offset}-name`);
            const descEl = document.getElementById(`invite-${offset}-description`);
            const btnEl = document.getElementById(`invite-${offset}-button`);
            if (nameEl && invite.name) nameEl.textContent = invite.name;
            if (descEl && invite.description) descEl.textContent = invite.description;
            if (btnEl) {
                if (invite.buttonLabel) btnEl.textContent = invite.buttonLabel.toUpperCase();
                if (invite.url) btnEl.onclick = () => safeOpenExternal(invite.url);
            }
        });
    }

    const locationEl = document.getElementById('home-location-value');
    const timezoneEl = document.getElementById('home-timezone-value');
    if (locationEl && data.home?.info?.location) locationEl.textContent = data.home.info.location;
    if (timezoneEl && data.home?.info?.timezone) timezoneEl.textContent = data.home.info.timezone;

    const weatherLocationEl = document.getElementById('weather-location');
    const weatherSubtitleEl = document.getElementById('weather-subtitle');
    if (weatherLocationEl && data.weather?.locationLabel) weatherLocationEl.textContent = data.weather.locationLabel;
    if (weatherSubtitleEl && data.weather?.subtitle) weatherSubtitleEl.textContent = data.weather.subtitle;

    applyAboutContent(data.about || {});

    if (data.workStatus) {
        const workStatus = document.getElementById('work-status');
        const workText = document.getElementById('work-status-text');
        if (workStatus) {
            if (data.workStatus.openLabel) workStatus.dataset.openLabel = data.workStatus.openLabel;
            if (data.workStatus.closedLabel) workStatus.dataset.closedLabel = data.workStatus.closedLabel;
        }
        if (workText && data.workStatus.openLabel) {
            workText.textContent = data.workStatus.openLabel;
        }
    }

    if (data.contact) {
        const contactTagline = document.getElementById('contact-tagline');

        if (contactTagline && data.contact.tagline) contactTagline.textContent = data.contact.tagline;
    }

    if (data.favorites) {
        renderFavoritesFromContent(data.favorites);
    }

    updateDocumentTitle(currentpage);
}

async function loadContentConfig() {
    try {
        const response = await fetch('content.json');
        if (!response.ok) throw new Error('Unable to load content.json');
        const data = await response.json();
        applyContentConfig(data);
    } catch (error) {
        console.warn('Using embedded fallback content.', error);
    }
}

function runWhenIdle(callback, timeout = 1200) {
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => callback(), { timeout });
        return;
    }
    setTimeout(callback, 220);
}

function getRevealGroups() {
    return [
        '.discord-profile-card',
        '.spotify-history-card',
        '.music-player-card',
        '.weather-card',
        '.info-grid .info-item',
        '.about-editorial-hero',
        '.about-story-grid > *',
        '.about-gallery-shell',
        '.about-metrics-layout > *',
        '.about-closing-card',
        '.favorites-card',
        '.projects-grid > *',
        '.skills-shell .skills-group',
        '.skills-shell .language-card',
        '.contact-primary-grid > *',
        '.contact-social-grid > *'
    ];
}

function setTextContentIfPresent(id, value) {
    const element = document.getElementById(id);
    if (element && value) element.textContent = value;
}

function renderAboutMicroFacts(items) {
    const container = document.getElementById('about-microfacts');
    if (!container) return;
    if (!Array.isArray(items) || !items.length) {
        container.remove();
        return;
    }

    container.innerHTML = items
        .map((item) => `<span class="about-microfact">${escapeHtml(item)}</span>`)
        .join('');
}

function renderAboutStats(items) {
    const container = document.getElementById('about-stats-grid');
    if (!container || !Array.isArray(items) || !items.length) return;

    container.innerHTML = items.map((item) => {
        const value = Number(item.value);
        const numericValue = Number.isFinite(value) ? value : 0;
        const suffix = item.suffix || '';
        const label = item.label || '';
        const detail = item.detail || '';
        const progress = Math.max(0, Math.min(1, Number(item.progress) || 0));

        return `
            <article class="about-stat-card" data-about-stat data-target="${escapeHtml(numericValue)}" data-suffix="${escapeHtml(suffix)}">
                <div class="about-stat-top">
                    <strong class="about-stat-value">${escapeHtml(numericValue)}${escapeHtml(suffix)}</strong>
                    <span class="about-stat-label">${escapeHtml(label)}</span>
                </div>
                <p class="about-stat-detail">${escapeHtml(detail)}</p>
                <div class="about-stat-meter" aria-hidden="true">
                    <span style="--about-stat-progress:${progress};"></span>
                </div>
            </article>
        `;
    }).join('');
}

function renderAboutGallery(items) {
    const track = document.getElementById('about-gallery-track');
    if (!track || !Array.isArray(items) || !items.length) return;

    track.innerHTML = items.map((item, index) => {
        const image = item.image || '';
        const title = item.title || `Frame ${index + 1}`;
        const caption = item.caption || '';
        const eyebrow = item.eyebrow || 'Frame';
        const theme = item.theme || 'default';
        const imageHtml = image
            ? `<img class="about-gallery-image" src="${escapeHtml(image)}" alt="${escapeHtml(item.alt || title)}" loading="lazy" decoding="async">`
            : `
                <div class="about-gallery-placeholder about-gallery-theme-${escapeHtml(theme)}" aria-hidden="true">
                    <span>${escapeHtml(eyebrow)}</span>
                    <strong>${escapeHtml(title)}</strong>
                </div>
            `;

        return `
            <article class="about-gallery-card">
                <div class="about-gallery-media">
                    ${imageHtml}
                </div>
                <div class="about-gallery-copy">
                    <span class="about-gallery-eyebrow">${escapeHtml(eyebrow)}</span>
                    <h4>${escapeHtml(title)}</h4>
                    <p>${escapeHtml(caption)}</p>
                </div>
            </article>
        `;
    }).join('');
}

function renderAboutPortraitSlider(about = {}) {
    const frame = document.getElementById('about-portrait-frame');
    const slides = document.getElementById('about-portrait-slides');
    const dots = document.getElementById('about-portrait-dots');
    const prevButton = document.getElementById('about-portrait-prev');
    const nextButton = document.getElementById('about-portrait-next');
    const legacyImage = document.getElementById('about-portrait-image');
    const placeholder = document.getElementById('about-portrait-placeholder');
    if (!frame || !slides) return false;

    const images = Array.isArray(about.heroImages) && about.heroImages.length
        ? about.heroImages
        : (about.heroImage ? [{ src: about.heroImage, alt: about.heroAlt || 'Wiktor portrait' }] : []);

    if (!images.length) return false;

    frame.classList.add('has-image');
    const imageItems = images.map((item) => {
        const src = typeof item === 'string' ? item : item.src;
        const alt = typeof item === 'string' ? about.heroAlt || 'Wiktor portrait' : item.alt || about.heroAlt || 'Wiktor portrait';
        return { src, alt };
    });

    slides.innerHTML = imageItems.map((item, index) => `
        <img class="about-portrait-slide${index === 0 ? ' active' : ''}" src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async">
    `).join('');

    const slideEls = Array.from(slides.querySelectorAll('.about-portrait-slide'));
    slideEls.forEach((image) => {
        const markLoaded = () => image.classList.add('is-loaded');
        image.addEventListener('load', markLoaded, { once: true });
        image.addEventListener('error', () => image.classList.add('is-missing'), { once: true });
        if (image.complete && image.naturalWidth > 0) markLoaded();
    });

    if (dots) {
        dots.innerHTML = imageItems.map((_, index) => (
            `<button class="about-portrait-dot${index === 0 ? ' active' : ''}" type="button" aria-label="Show photo ${index + 1}"></button>`
        )).join('');
    }

    const dotEls = Array.from(dots?.querySelectorAll('.about-portrait-dot') || []);
    let currentIndex = 0;

    const clearAutoRotate = () => {
        if (aboutPortraitAutoRotateId !== null) {
            clearInterval(aboutPortraitAutoRotateId);
            aboutPortraitAutoRotateId = null;
        }
    };

    const getHeroVisual = () => frame.closest('.about-editorial-hero') || document.querySelector('.about-editorial-hero');

    const updateHeroBackground = (index) => {
        const visual = getHeroVisual();
        if (!visual || !visual.classList.contains('hero-bg-mode')) return;
        const imageSrc = imageItems[index]?.src || '';
        if (!imageSrc) return;
        visual.style.backgroundImage = `linear-gradient(180deg, rgba(8,10,14,0.14), rgba(8,10,14,0.28)), url("${imageSrc}")`;
        visual.style.backgroundSize = 'cover';
        visual.style.backgroundPosition = 'center';
    };

    const setActiveSlide = (index) => {
        const count = imageItems.length;
        currentIndex = ((index % count) + count) % count;

        slideEls.forEach((slide, slideIndex) => {
            slide.classList.toggle('active', slideIndex === currentIndex);
        });

        dotEls.forEach((dot, dotIndex) => {
            dot.classList.toggle('active', dotIndex === currentIndex);
        });

        if (getHeroVisual()?.classList.contains('hero-bg-mode')) {
            updateHeroBackground(currentIndex);
        }

        frame.dataset.slideIndex = String(currentIndex);
    };

    const startAutoRotate = () => {
        clearAutoRotate();
        if (imageItems.length > 1) {
            aboutPortraitAutoRotateId = setInterval(() => {
                setActiveSlide(currentIndex + 1);
            }, 7000);
        }
    };

    const bindControlEvents = () => {
        if (prevButton) {
            prevButton.addEventListener('click', () => {
                setActiveSlide(currentIndex - 1);
                startAutoRotate();
            });
        }
        if (nextButton) {
            nextButton.addEventListener('click', () => {
                setActiveSlide(currentIndex + 1);
                startAutoRotate();
            });
        }
        dotEls.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                setActiveSlide(index);
                startAutoRotate();
            });
        });
    };

    if (legacyImage) legacyImage.hidden = true;
    if (placeholder) placeholder.hidden = true;
    frame.dataset.slideIndex = '0';

    const applyBgMode = () => {
        const mq = window.matchMedia('(min-width: 900px)');
        const visual = getHeroVisual();
        if (!visual) return;

        if (mq.matches) {
            visual.classList.add('hero-bg-mode');
            updateHeroBackground(currentIndex);
        } else {
            visual.classList.remove('hero-bg-mode');
            visual.style.backgroundImage = '';
        }
    };

    bindControlEvents();
    setActiveSlide(0);
    applyBgMode();
    window.addEventListener('resize', applyBgMode);
    startAutoRotate();

    return true;
}

function applyAboutContent(about = {}) {
    const taglineEl = document.querySelector('#about .tagline');
    if (taglineEl && about.tagline) taglineEl.textContent = about.tagline;

    setTextContentIfPresent('about-badge', about.badge);
    setTextContentIfPresent('about-kicker', about.kicker);
    setTextContentIfPresent('about-statement', about.statement);
    setTextContentIfPresent('about-intro', about.intro);
    setTextContentIfPresent('about-side-note', about.sideNote);

    if (!renderAboutPortraitSlider(about) && about.heroImage) {
        const frame = document.getElementById('about-portrait-frame');
        const image = document.getElementById('about-portrait-image');
        const placeholder = document.getElementById('about-portrait-placeholder');
        if (frame) frame.classList.add('has-image');
        if (image) {
            image.src = about.heroImage;
            image.alt = about.heroAlt || 'Wiktor portrait';
            image.hidden = false;
        }
        if (placeholder) placeholder.hidden = true;
    }

    renderAboutMicroFacts(about.microFacts);

    setTextContentIfPresent('about-origin-eyebrow', about.origin?.eyebrow);
    setTextContentIfPresent('about-origin-title', about.origin?.title);
    setTextContentIfPresent('about-origin-text', about.origin?.text);

    setTextContentIfPresent('about-current-eyebrow', about.currentWork?.eyebrow);
    setTextContentIfPresent('about-current-title', about.currentWork?.title);
    setTextContentIfPresent('about-current-text', about.currentWork?.text);

    setTextContentIfPresent('about-drives-eyebrow', about.drives?.eyebrow);
    setTextContentIfPresent('about-drives-title', about.drives?.title);
    setTextContentIfPresent('about-drives-text', about.drives?.text);

    setTextContentIfPresent('about-lifestyle-eyebrow', about.lifestyle?.eyebrow);
    setTextContentIfPresent('about-lifestyle-title', about.lifestyle?.title);
    setTextContentIfPresent('about-lifestyle-text', about.lifestyle?.text);

    setTextContentIfPresent('about-closing-eyebrow', about.closing?.eyebrow);
    setTextContentIfPresent('about-closing-title', about.closing?.title);
    setTextContentIfPresent('about-closing-text', about.closing?.text);

    renderAboutStats(about.stats);
    renderAboutGallery(about.gallery);
}

function primeRevealTargets() {
    getRevealGroups().forEach((selector) => {
        const elements = Array.from(document.querySelectorAll(selector));
        elements.forEach((element, index) => {
            if (!(element instanceof HTMLElement)) return;
            if (element.dataset.revealReady === 'true') return;
            element.dataset.reveal = 'true';
            element.dataset.revealReady = 'true';
            element.style.setProperty('--reveal-delay', `${Math.min(index, 7) * 70}ms`);
        });
    });
}

function initScrollReveal(forceRefresh = false) {
    primeRevealTargets();

    const targets = Array.from(document.querySelectorAll('[data-reveal="true"]'));
    if (!targets.length) return;

    const disableReveal = settings.reduceMotion || settings.performanceMode || !('IntersectionObserver' in window);
    if (disableReveal) {
        targets.forEach((element) => {
            if (element instanceof HTMLElement) {
                element.classList.add('is-visible');
            }
        });
        if (revealObserver) {
            revealObserver.disconnect();
            revealObserver = null;
        }
        return;
    }

    if (forceRefresh && revealObserver) {
        revealObserver.disconnect();
        revealObserver = null;
    }

    if (!revealObserver) {
        revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const element = entry.target;
                if (element instanceof HTMLElement) {
                    element.classList.add('is-visible');
                }
                revealObserver?.unobserve(element);
            });
        }, {
            rootMargin: '0px 0px -12% 0px',
            threshold: 0.12
        });
    }

    targets.forEach((element) => {
        if (!(element instanceof HTMLElement)) return;
        if (element.classList.contains('is-visible')) return;
        revealObserver.observe(element);
    });
}

function ensureHomeWidgetsReady() {
    if (deferredHomeWidgetsReady) return;
    deferredHomeWidgetsReady = true;
    initWeatherWidget();
    initHomeViewCounter();
}

function ensurePresenceReady() {
    if (deferredPresenceReady) return;
    deferredPresenceReady = true;

    fetchDiscordProfile();
    connectLanyardSocket();
    if (discordPollInterval) {
        clearInterval(discordPollInterval);
    }
    discordPollInterval = setInterval(() => {
        if (!lanyardConnected) {
            fetchDiscordProfile();
        }
    }, 60000);
}

function initDeferredHomeObservers() {
    const homeSection = document.getElementById('home');
    if (!homeSection) return;

    const shouldEagerLoad = currentpage === 'home' && !settings.performanceMode;
    if (shouldEagerLoad) {
        runWhenIdle(() => {
            ensureHomeWidgetsReady();
            ensurePresenceReady();
        }, 900);
        return;
    }

    if (!('IntersectionObserver' in window)) {
        ensureHomeWidgetsReady();
        ensurePresenceReady();
        return;
    }

    if (deferredHomeObserver) {
        deferredHomeObserver.disconnect();
        deferredHomeObserver = null;
    }

    deferredHomeObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        ensureHomeWidgetsReady();
        ensurePresenceReady();
        deferredHomeObserver?.disconnect();
        deferredHomeObserver = null;
    }, {
        rootMargin: '0px 0px -18% 0px',
        threshold: 0.08
    });

    deferredHomeObserver.observe(homeSection);
}

function optimizeStaticMediaLoading() {
    const images = Array.from(document.querySelectorAll('img'));
    images.forEach((img, index) => {
        if (!img.getAttribute('loading')) {
            img.setAttribute('loading', index < 6 ? 'eager' : 'lazy');
        }
        if (!img.getAttribute('decoding')) {
            img.setAttribute('decoding', 'async');
        }
        if (!img.getAttribute('fetchpriority')) {
            img.setAttribute('fetchpriority', index < 2 ? 'high' : 'auto');
        }
    });
}

function normalizeShortcutCode(value) {
    if (typeof value !== 'string') return '';
    return value.trim();
}

function getShortcutLabel(code) {
    if (!code) return 'Unassigned';
    const map = {
        Space: 'Space',
        ArrowLeft: 'Arrow Left',
        ArrowRight: 'Arrow Right',
        ArrowUp: 'Arrow Up',
        ArrowDown: 'Arrow Down',
        Escape: 'Escape',
        Enter: 'Enter',
        Backspace: 'Backspace',
        Tab: 'Tab'
    };
    if (map[code]) return map[code];
    if (code.startsWith('Key')) return code.slice(3).toUpperCase();
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
    return code;
}

function executeShortcutAction(actionId) {
    switch (actionId) {
        case 'togglePlayPause':
            togglePlayPause();
            return true;
        case 'previousTrack':
            previousTrack();
            return true;
        case 'nextTrack':
            nextTrack();
            return true;
        case 'openPlaylist':
            openPlaylistOverlay();
            return true;
        case 'openSettings':
            openSettings();
            return true;
        case 'gotoHome':
            showpage('home');
            return true;
        case 'gotoAbout':
            showpage('about');
            return true;
        case 'gotoProjects':
            showpage('projects');
            return true;
        case 'gotoSkills':
            showpage('skills');
            return true;
        case 'gotoContact':
            showpage('contact');
            return true;
        default:
            return false;
    }
}

function handleGlobalShortcut(event) {
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.isContentEditable;
    if (isTyping || document.body.classList.contains('capturing-shortcut')) return false;
    if (activeModalState?.overlay) return false;
    if (event.altKey || event.ctrlKey || event.metaKey) return false;

    const code = normalizeShortcutCode(event.code);
    if (!code) return false;

    const shortcuts = settings.shortcuts || {};
    const action = Object.keys(shortcuts).find((id) => normalizeShortcutCode(shortcuts[id]) === code);
    if (!action) return false;

    event.preventDefault();
    return executeShortcutAction(action);
}


