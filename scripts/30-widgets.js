function initAboutEditorial() {
    const galleryTrack = document.getElementById('about-gallery-track');
    const prevBtn = document.getElementById('about-gallery-prev');
    const nextBtn = document.getElementById('about-gallery-next');
    const progressBar = document.getElementById('about-gallery-progress-bar');
    const statCards = Array.from(document.querySelectorAll('[data-about-stat]'));
    const portraitFrame = document.getElementById('about-portrait-frame');
    const visualLayer = document.querySelector('.about-scroll-visuals');

    if (visualLayer) {
        let scrollRaf = null;

        const syncAboutVisuals = () => {
            scrollRaf = null;
            if (settings.reduceMotion || settings.performanceMode) return;

            const aboutPage = document.getElementById('about');
            if (!aboutPage || aboutPage.classList.contains('hidden')) return;

            const rect = visualLayer.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
            const progress = 1 - ((rect.top + rect.height) / (viewportHeight + rect.height));
            const clamped = Math.max(0, Math.min(1, progress));
            visualLayer.style.setProperty('--about-scroll', clamped.toFixed(3));
        };

        const queueAboutVisuals = () => {
            if (scrollRaf !== null) return;
            scrollRaf = requestAnimationFrame(syncAboutVisuals);
        };

        window.addEventListener('scroll', queueAboutVisuals, { passive: true });
        window.addEventListener('resize', queueAboutVisuals);
        queueAboutVisuals();
    }

    if (portraitFrame) {
        const slides = Array.from(portraitFrame.querySelectorAll('.about-portrait-slide'));
        const dots = Array.from(portraitFrame.querySelectorAll('.about-portrait-dot'));
        const portraitPrev = document.getElementById('about-portrait-prev');
        const portraitNext = document.getElementById('about-portrait-next');
        const controls = portraitFrame.querySelector('.about-portrait-controls');
        let portraitIndex = 0;

        const showPortrait = (index) => {
            if (!slides.length) return;
            portraitIndex = (index + slides.length) % slides.length;
            portraitFrame.dataset.slideIndex = String(portraitIndex);
            slides.forEach((slide, slideIndex) => {
                slide.classList.toggle('active', slideIndex === portraitIndex);
            });
            dots.forEach((dot, dotIndex) => {
                dot.classList.toggle('active', dotIndex === portraitIndex);
            });
        };

        if (slides.length <= 1 && controls) {
            controls.hidden = true;
        } else if (slides.length > 1) {
            portraitPrev?.addEventListener('click', () => showPortrait(portraitIndex - 1));
            portraitNext?.addEventListener('click', () => showPortrait(portraitIndex + 1));
            dots.forEach((dot, index) => {
                dot.addEventListener('click', () => showPortrait(index));
            });
            portraitFrame.addEventListener('keydown', (event) => {
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    showPortrait(portraitIndex - 1);
                } else if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    showPortrait(portraitIndex + 1);
                }
            });
            portraitFrame.tabIndex = 0;
            showPortrait(0);
        }
    }

    if (galleryTrack && prevBtn && nextBtn) {
        const galleryCards = Array.from(galleryTrack.querySelectorAll('.about-gallery-card'));
        let currentIndex = 0;

        const scrollToIndex = (index, behavior = 'smooth') => {
            if (!galleryCards.length) return;
            currentIndex = Math.max(0, Math.min(index, galleryCards.length - 1));
            const targetCard = galleryCards[currentIndex];
            galleryTrack.scrollTo({
                left: targetCard.offsetLeft,
                behavior
            });
        };

        const syncGalleryUi = () => {
            if (!galleryCards.length) return;
            let nearestIndex = 0;
            let nearestDistance = Number.POSITIVE_INFINITY;

            galleryCards.forEach((card, index) => {
                const distance = Math.abs(card.offsetLeft - galleryTrack.scrollLeft);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = index;
                }
            });

            currentIndex = nearestIndex;
            const progress = galleryCards.length > 1 ? currentIndex / (galleryCards.length - 1) : 1;

            if (progressBar) {
                progressBar.style.transform = `scaleX(${Math.max(0.12, progress)})`;
            }

            prevBtn.disabled = currentIndex <= 0;
            nextBtn.disabled = currentIndex >= galleryCards.length - 1;
        };

        prevBtn.addEventListener('click', () => scrollToIndex(currentIndex - 1));
        nextBtn.addEventListener('click', () => scrollToIndex(currentIndex + 1));
        galleryTrack.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                scrollToIndex(currentIndex - 1);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                scrollToIndex(currentIndex + 1);
            }
        });
        galleryTrack.addEventListener('scroll', syncGalleryUi, { passive: true });
        window.addEventListener('resize', syncGalleryUi);

        const galleryImages = Array.from(galleryTrack.querySelectorAll('img'));
        galleryImages.forEach((image) => {
            image.addEventListener('load', syncGalleryUi, { once: true });
        });

        requestAnimationFrame(() => {
            syncGalleryUi();
            scrollToIndex(0, 'auto');
        });
    }

    if (!statCards.length) return;

    const animateStat = (card) => {
        if (!card || card.dataset.animated === 'true') return;
        card.dataset.animated = 'true';

        const valueEl = card.querySelector('.about-stat-value');
        const target = Number(card.dataset.target || 0);
        const suffix = card.dataset.suffix || '';
        if (!valueEl || !Number.isFinite(target)) return;

        const shouldAnimate = !settings.reduceMotion && !settings.performanceMode;
        if (!shouldAnimate) {
            valueEl.textContent = `${target}${suffix}`;
            return;
        }

        const duration = 900;
        const startTime = performance.now();

        const tick = (now) => {
            const progress = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(target * eased);
            valueEl.textContent = `${current}${suffix}`;

            if (progress < 1) {
                requestAnimationFrame(tick);
            }
        };

        requestAnimationFrame(tick);
    };

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                animateStat(entry.target);
                observer.unobserve(entry.target);
            });
        }, {
            threshold: 0.35
        });

        statCards.forEach((card) => observer.observe(card));
        return;
    }

    statCards.forEach(animateStat);
}

function weatherCodeToInfo(code) {
    if (code === 0) return { label: 'Clear', icon: 'fa-sun' };
    if ([1, 2].includes(code)) return { label: 'Partly Cloudy', icon: 'fa-cloud-sun' };
    if (code === 3) return { label: 'Overcast', icon: 'fa-cloud' };
    if ([45, 48].includes(code)) return { label: 'Fog', icon: 'fa-smog' };
    if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Drizzle', icon: 'fa-cloud-rain' };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Rain', icon: 'fa-cloud-showers-heavy' };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snow', icon: 'fa-snowflake' };
    if ([95, 96, 99].includes(code)) return { label: 'Thunder', icon: 'fa-bolt' };
    return { label: 'Cloudy', icon: 'fa-cloud' };
}

function updateWeatherIcon(elementId, code) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const info = weatherCodeToInfo(code);
    el.innerHTML = `<i class="fas ${info.icon}"></i>`;
    return info.label;
}

function initWeatherWidget() {
    const card = document.getElementById('weather-card');
    if (!card) return;

    const weatherConfig = window.APP_API_CONFIG?.weather || {};
    const lat = weatherConfig.latitude ?? 50.0413;
    const lon = weatherConfig.longitude ?? 21.999;
    const baseUrl = weatherConfig.baseUrl || 'https://api.open-meteo.com/v1/forecast';
    const url = `${baseUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&temperature_unit=celsius&timezone=auto&forecast_days=3`;

    async function fetchWeather() {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Weather API error');
            const data = await response.json();

            const currentTemp = Math.round(data.current.temperature_2m);
            const apparentTemp = Math.round(data.current.apparent_temperature);
            const currentCode = data.current.weather_code;
            const currentLabel = updateWeatherIcon('weather-icon-current', currentCode);
            const currentTempEl = document.getElementById('weather-temp-current');
            const currentDescEl = document.getElementById('weather-desc-current');
            const currentRangeEl = document.getElementById('weather-current-range');
            const currentFeelsEl = document.getElementById('weather-feels-like');
            const todayHigh = Math.round(data.daily.temperature_2m_max[0]);
            const todayLow = Math.round(data.daily.temperature_2m_min[0]);

            if (currentTempEl) currentTempEl.textContent = `${currentTemp}°C`;
            if (currentDescEl) currentDescEl.textContent = currentLabel || '--';
            if (currentRangeEl) currentRangeEl.textContent = `H: ${todayHigh}°C / L: ${todayLow}°C`;
            if (currentFeelsEl) currentFeelsEl.textContent = `Feels like ${apparentTemp}°C`;

            for (let i = 1; i <= 2; i++) {
                const dayCode = data.daily.weather_code[i];
                updateWeatherIcon(`weather-day-${i}-icon`, dayCode);
                const maxTemp = Math.round(data.daily.temperature_2m_max[i]);
                const minTemp = Math.round(data.daily.temperature_2m_min[i]);
                const rainChance = Math.round(data.daily.precipitation_probability_max?.[i] ?? 0);
                const tempEl = document.getElementById(`weather-day-${i}-temp`);
                const rangeEl = document.getElementById(`weather-day-${i}-range`);
                const noteEl = document.getElementById(`weather-day-${i}-note`);
                const labelEl = document.getElementById(`weather-day-${i}-label`);
                if (tempEl) tempEl.textContent = `${maxTemp}°C`;
                if (rangeEl) rangeEl.textContent = `${minTemp}°C / ${maxTemp}°C`;
                if (noteEl) noteEl.textContent = `Rain chance ${rainChance}%`;
                if (labelEl && Array.isArray(data.daily.time)) {
                    const dayDate = new Date(data.daily.time[i]);
                    labelEl.textContent = dayDate.toLocaleDateString('en-GB', { weekday: 'short' });
                }
            }

            const updatedEl = document.getElementById('weather-updated');
            if (updatedEl && data.current && data.current.time) {
                const time = new Date(data.current.time);
                const label = time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                updatedEl.textContent = `Updated ${label}`;
            }
        } catch (error) {
            const updatedEl = document.getElementById('weather-updated');
            if (updatedEl) updatedEl.textContent = 'Weather unavailable';
        }
    }

    fetchWeather();
    setInterval(fetchWeather, weatherConfig.refreshMs || (30 * 60 * 1000));
}

function initFavoritesWidget() {
    const card = document.getElementById('favorites-card');
    if (!card) return;

    const toggle = card.querySelector('.favorites-toggle');
    const tabs = Array.from(card.querySelectorAll('.fav-tab'));
    const items = Array.from(card.querySelectorAll('.favorite-item'));
    const grid = card.querySelector('.favorites-grid');
    let isTransitioning = false;

    if (toggle) {
        toggle.setAttribute('aria-expanded', 'true');
        const toggleLabel = toggle.querySelector('span');
        if (toggleLabel) toggleLabel.textContent = 'Close';
    }

    if (toggle) {
        toggle.addEventListener('click', () => {
            card.classList.toggle('collapsed');
            const expanded = !card.classList.contains('collapsed');
            toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            const toggleLabel = toggle.querySelector('span');
            if (toggleLabel) toggleLabel.textContent = expanded ? 'Close' : 'Open';
        });
    }

    function setActive(category) {
        tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.fav === category));

        let visibleIndex = 0;
        items.forEach(item => {
            const isActive = item.dataset.fav === category;
            item.classList.toggle('active', isActive);
            item.classList.toggle('is-hidden', !isActive);
            if (isActive) {
                item.style.setProperty('--fav-delay', `${visibleIndex * 35}ms`);
                visibleIndex += 1;
            }
        });
    }

    function switchCategory(category) {
        if (!grid || isTransitioning) {
            setActive(category);
            return;
        }

        isTransitioning = true;
        grid.classList.add('switching');
        window.setTimeout(() => {
            setActive(category);
            requestAnimationFrame(() => {
                grid.classList.remove('switching');
                window.setTimeout(() => {
                    isTransitioning = false;
                }, 220);
            });
        }, 140);
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchCategory(tab.dataset.fav));
    });

    const initialCategory = tabs[0]?.dataset.fav || 'games';
    setActive(initialCategory);
}

function initWorkAvailabilityStatus() {
    const workStatus = document.getElementById('work-status');
    const textEl = document.getElementById('work-status-text');
    if (!workStatus || !textEl) return;

    const openLabel = workStatus.dataset.openLabel || 'ACTIVE';
    const closedLabel = workStatus.dataset.closedLabel || 'INACTIVE';

    function isOpenNowInWarsaw() {
        const now = new Date();
        const weekdayString = new Intl.DateTimeFormat('en-GB', {
            weekday: 'short',
            timeZone: 'Europe/Warsaw'
        }).format(now);

        const hourString = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            hour12: false,
            timeZone: 'Europe/Warsaw'
        }).format(now);

        const minuteString = new Intl.DateTimeFormat('en-GB', {
            minute: '2-digit',
            timeZone: 'Europe/Warsaw'
        }).format(now);

        const dayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
        const day = dayMap[weekdayString] ?? 0;
        const totalMinutes = Number(hourString) * 60 + Number(minuteString);

        const weekdayOpen = day >= 1 && day <= 5 && totalMinutes >= (15 * 60) && totalMinutes < (19 * 60);
        const saturdayOpen = day === 6 && totalMinutes >= (9 * 60) && totalMinutes < (19 * 60);

        return weekdayOpen || saturdayOpen;
    }

    function applyStatus() {
        const openNow = isOpenNowInWarsaw();
        workStatus.classList.toggle('is-open', openNow);
        workStatus.classList.toggle('is-closed', !openNow);
        textEl.textContent = openNow ? openLabel : closedLabel;
    }

    applyStatus();
    setInterval(applyStatus, 60000);
}

function formatCounterValue(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '--';
    return numeric.toLocaleString('en-US');
}

const VIEW_COUNTER_CONFIG = window.APP_API_CONFIG?.counter || {};
const VIEW_COUNTER_PROVIDERS = VIEW_COUNTER_CONFIG.providers || [
    {
        type: 'visitorapi',
        baseUrl: 'https://visitor.6developer.com'
    }
];
const VIEW_COUNTER_FALLBACK_KEY = VIEW_COUNTER_CONFIG.fallbackStorageKey || 'nozersite_home_views_local_fallback_v1';

function getCounterDomain() {
    const configuredDomain = String(VIEW_COUNTER_CONFIG.domainOverride || '').trim().toLowerCase();
    const hostname = (configuredDomain || window.location.hostname || 'localhost').toLowerCase();
    return hostname
        .replace(/^www\./, '')
        .replace(/[^a-z0-9.-]/g, '-');
}

function isLocalCounterDomain(domain) {
    return domain === 'localhost' || domain === '127.0.0.1' || domain === '::1' || domain.endsWith('.local');
}

function getSearchQueryFromReferrer() {
    if (!document.referrer) return '';

    try {
        const url = new URL(document.referrer);
        if (url.hostname.includes('google.')) return url.searchParams.get('q') || '';
        if (url.hostname.includes('bing.com')) return url.searchParams.get('q') || '';
        if (url.hostname.includes('duckduckgo.com')) return url.searchParams.get('q') || '';
        if (url.hostname.includes('yahoo.com')) return url.searchParams.get('p') || '';
    } catch (error) {
        return '';
    }

    return '';
}

function getLocalFallbackViewCount() {
    const current = Number(localStorage.getItem(VIEW_COUNTER_FALLBACK_KEY)) || 0;
    const nextValue = current + 1;
    localStorage.setItem(VIEW_COUNTER_FALLBACK_KEY, String(nextValue));
    return nextValue;
}

async function hitVisitorApi(domain) {
    const provider = VIEW_COUNTER_PROVIDERS.find(entry => entry.type === 'visitorapi' && entry.baseUrl);
    if (!provider) throw new Error('Visitor API provider unavailable');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
        const url = `${provider.baseUrl}/visit`;
        const response = await fetch(url, {
            method: 'POST',
            cache: 'no-store',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                domain,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                page_path: window.location.pathname,
                page_title: document.title,
                referrer: document.referrer,
                search_query: getSearchQueryFromReferrer()
            })
        });
        if (!response.ok) throw new Error('Visitor API failed');
        const payload = await response.json();
        const value = Number(payload?.totalCount);
        if (!Number.isFinite(value)) throw new Error('Visitor API invalid payload');
        return { value };
    } finally {
        clearTimeout(timeoutId);
    }
}

async function countApiHit() {
    const domain = getCounterDomain();

    if (isLocalCounterDomain(domain)) {
        throw new Error('Localhost is excluded from the global counter');
    }

    for (const provider of VIEW_COUNTER_PROVIDERS) {
        try {
            if (provider.type === 'visitorapi') {
                return await hitVisitorApi(domain);
            }
        } catch (error) {
            // Try next endpoint.
        }
    }

    throw new Error('All counter endpoints failed');
}

async function initHomeViewCounter() {
    const viewEl = document.getElementById('home-view-count');
    if (!viewEl) return;
    const domain = getCounterDomain();

    try {
        const data = await countApiHit();
        viewEl.textContent = formatCounterValue(data.value);
        viewEl.dataset.counterSource = 'remote';
        viewEl.title = `Global visits for ${domain}`;
    } catch (error) {
        const fallbackValue = getLocalFallbackViewCount();
        viewEl.textContent = formatCounterValue(fallbackValue);
        viewEl.dataset.counterSource = 'local-fallback';
        viewEl.title = isLocalCounterDomain(domain)
            ? 'Local preview count only. Set counter.domainOverride to your real domain for global history in localhost.'
            : 'Fallback local counter';
    }
}

function formatMusicTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const cursorsys = {
    init: function() {
        this.isMobile = this.isTouchLikeDevice();
        this.setupevents();
    },

    isTouchLikeDevice: function() {
        return window.matchMedia('(pointer: coarse)').matches;
    },

    setupevents: function() {
        const cursor = document.getElementById('customCursor');
        if (!cursor) return;

        let rafId = null;
        let targetX = window.innerWidth / 2;
        let targetY = window.innerHeight / 2;
        let currentX = targetX;
        let currentY = targetY;
        const textInputSelector = 'input, textarea, [contenteditable="true"]';
        const interactiveSelector = [
            'a',
            'button',
            '[role="button"]',
            '.nav-link',
            '.social-link',
            '.contact-social-link',
            '.project-action',
            '.settings-toggle',
            '.settings-category-btn',
            '.settings-switch',
            '.settings-slider',
            '.settings-reset-all',
            '.shortcut-bind-btn',
            '.shortcut-reset-btn',
            '.join-btn-modern',
            '.mini-player-control',
            '.mini-player-header-btn',
            '.section-search',
            '.settings-search-wrap',
            '.section-search input',
            '.settings-search-wrap input'
        ].join(', ');

        const applyCursorClassesForTarget = (target) => {
            if (!(target instanceof Element)) {
                cursor.classList.remove('hover', 'text');
                return;
            }

            const isTextField = !!target.closest(textInputSelector);
            if (isTextField) {
                cursor.classList.add('text');
                cursor.classList.remove('hover');
                return;
            }

            cursor.classList.remove('text');
            if (target.closest(interactiveSelector)) {
                cursor.classList.add('hover');
            } else {
                cursor.classList.remove('hover');
            }
        };

        const animateCursor = () => {
            const smoothing = activeModalState?.overlay ? 0.34 : 0.42;
            currentX += (targetX - currentX) * smoothing;
            currentY += (targetY - currentY) * smoothing;
            cursor.style.left = `${currentX}px`;
            cursor.style.top = `${currentY}px`;
            rafId = window.requestAnimationFrame(animateCursor);
        };

        rafId = window.requestAnimationFrame(animateCursor);

        const updateCursorPosition = (e) => {
            targetX = e.clientX;
            targetY = e.clientY;
            const dx = Math.abs(targetX - currentX);
            const dy = Math.abs(targetY - currentY);
            // Prevent "heavy" trailing when moving quickly across the page.
            if (dx + dy > 90) {
                currentX = targetX;
                currentY = targetY;
                cursor.style.left = `${currentX}px`;
                cursor.style.top = `${currentY}px`;
            }
        };

        if ('PointerEvent' in window) {
            document.addEventListener('pointermove', updateCursorPosition);
        } else {
            document.addEventListener('mousemove', updateCursorPosition);
        }

        document.addEventListener('mousedown', () => {
            cursor.classList.add('click');
        });

        document.addEventListener('mouseup', () => {
            cursor.classList.remove('click');
        });

        document.addEventListener('mouseenter', () => {
            cursor.classList.remove('hidden');
        });

        document.addEventListener('mouseleave', () => {
            cursor.classList.add('hidden');
        });

        document.addEventListener('pointerover', (e) => {
            const target = e.target;
            applyCursorClassesForTarget(target);
        });

        document.addEventListener('pointerout', (e) => {
            const toEl = e.relatedTarget;
            applyCursorClassesForTarget(toEl);
        });

        document.addEventListener('focusin', (e) => {
            applyCursorClassesForTarget(e.target);
        });

        document.addEventListener('focusout', () => {
            const active = document.activeElement;
            if (active instanceof Element) {
                applyCursorClassesForTarget(active);
                return;
            }
            cursor.classList.remove('text');
        });

        document.addEventListener('touchstart', () => {
            cursor.classList.add('hidden');
        }, { passive: true });

        window.addEventListener('beforeunload', () => {
            if (rafId) window.cancelAnimationFrame(rafId);
        });
    }
};

function hideWakeupOverlay(playMusic = true) {
    const overlay = document.getElementById('wakeup-overlay');
    if (overlay && !wakeupOverlayReady) return;
    if (wakeupOverlayKeyHandler) {
        document.removeEventListener('keydown', wakeupOverlayKeyHandler);
        wakeupOverlayKeyHandler = null;
    }
    if (playMusic && !isMusicPlaying) {
        // Try to start music inside the same user gesture to avoid autoplay blocking.
        startMusicOnWakeup();
    }
    if (overlay) {
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.remove();

            // First-time onboarding should open after user explicitly clears initial loading overlay.
            if (!hasSeenWelcomeGuide()) {
                setTimeout(() => {
                    if (!activeModalState) {
                        openWelcomeTour();
                    }
                }, 180);
            }

            // Fallback attempt if first start was blocked.
            if (playMusic && !isMusicPlaying) {
                startMusicOnWakeup();
            }
        }, 500);
    }
}

function enterWithoutMusic(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    hideWakeupOverlay(false);
}

function startMusicOnWakeup() {
    if (!musicAudio) return;
    if (!musicAudio.src) {
        loadTrack(currentMusicTrack);
    }

    // "Normal enter" should always start with audible sound.
    let shouldPersist = false;
    if (settings.mute) {
        settings.mute = false;
        shouldPersist = true;
    }
    if (!Number.isFinite(settings.volume) || settings.volume <= 0.01) {
        settings.volume = Math.max(defaultSettings.volume || 0.6, 0.35);
        shouldPersist = true;
    }
    if (shouldPersist) {
        saveSettings();
        syncSettingsUI();
    }

    applyAudioSettings();
    playCurrentTrackWithFade();
}

function checkIfReadyToWakeup() {
    const overlay = document.getElementById('wakeup-overlay');
    if (overlay && !overlay.classList.contains('hidden')) {
        overlay.addEventListener('click', () => hideWakeupOverlay(true));
        const noMusicBtn = document.getElementById('wakeup-no-music-btn');
        if (noMusicBtn) {
            noMusicBtn.addEventListener('click', enterWithoutMusic);
        }
        wakeupOverlayKeyHandler = (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                hideWakeupOverlay();
            }
        };
        document.addEventListener('keydown', wakeupOverlayKeyHandler);
    }
}

function revealWakeupOverlay() {
    const overlay = document.getElementById('wakeup-overlay');
    const status = document.getElementById('wakeup-status');
    if (!overlay) return;

    wakeupOverlayReady = true;
    if (status) {
        status.textContent = 'Ready when you are';
    }

    requestAnimationFrame(() => {
        overlay.classList.add('is-ready');
    });
}

function makestar() {
    const starfield = document.getElementById('starfield');
    if (!starfield) return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    const star = document.createElement('div');
    star.className = 'star';

    const size = Math.random();
    if (size < 0.5) {
        star.classList.add('small');
    } else if (size < 0.8) {
        star.classList.add('medium');
    } else {
        star.classList.add('large');
    }

    const behavior = Math.random();
    const lifetime = behavior < 0.48 ? 5200 : behavior < 0.88 ? 7600 : 9200;

    if (behavior < 0.48) {
        star.classList.add('twinkle');
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.animationDelay = `${Math.random() * 2.5}s`;
    } else if (behavior < 0.88) {
        star.classList.add('float');
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.setProperty('--drift-x', `${(Math.random() - 0.5) * (isMobile ? 18 : 28)}px`);
        star.style.setProperty('--drift-y', `${(Math.random() - 0.5) * (isMobile ? 18 : 28)}px`);
        star.style.animationDelay = `${Math.random() * 2.5}s`;
    } else {
        star.classList.add('near', 'glide');
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.setProperty('--glide-x', `${(Math.random() - 0.5) * (isMobile ? 34 : 46)}px`);
        star.style.setProperty('--glide-y', `${(Math.random() - 0.5) * (isMobile ? 14 : 22)}px`);
        star.style.animationDelay = `${Math.random() * 2.5}s`;
    }

    starfield.appendChild(star);

    setTimeout(() => {
        star.remove();
    }, lifetime);
}

// TOC (Table of Contents) Observer for TOS page
let tocObserver = null;

function initTOCObserver() {
    const tocLinks = document.querySelectorAll('.toc-link');
    if (!tocLinks.length) return;

    // Disconnect previous observer if exists
    if (tocObserver) {
        tocObserver.disconnect();
    }

    // Create Intersection Observer to track which section is in view
    tocObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                const id = entry.target.id;
                const link = document.querySelector(`.toc-link[href="#${id}"]`);
                
                if (entry.isIntersecting) {
                    // Remove active class from all links
                    tocLinks.forEach(l => l.classList.remove('toc-active'));
                    // Add active class to current section's link
                    if (link) {
                        link.classList.add('toc-active');
                        // Scroll the TOC sidebar to show active link
                        link.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
            });
        },
        {
            rootMargin: '-120px 0px -80% 0px',
            threshold: 0
        }
    );

    // Observe all section elements
    document.querySelectorAll('#tos [id^="tos-"]').forEach((section) => {
        tocObserver.observe(section);
    });

    // Handle smooth scrolling for TOC links
    tocLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                // Remove active class from all and add to clicked
                tocLinks.forEach(l => l.classList.remove('toc-active'));
                link.classList.add('toc-active');
                
                // Smooth scroll to section
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

function showpage(page) {
    const pages = document.querySelectorAll('.container');
    pages.forEach(p => {
        if (p.id === page) {
            p.classList.remove('hidden');
        } else {
            p.classList.add('hidden');
        }
    });

    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
    navLinks.forEach(link => {
        const targetPage = link.dataset.page || '';
        const isActive = targetPage === page || link.onclick.toString().includes(page);
        if (isActive) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        } else {
            link.classList.remove('active');
            link.removeAttribute('aria-current');
        }
    });

    currentpage = page;
    const currentPath = window.location.pathname.toLowerCase();
    if (currentPath.endsWith('/') || currentPath.endsWith('/index.html') || currentPath === '' || currentPath === '/nozersitenew/') {
        const nextHash = `#${page}`;
        if (window.location.hash !== nextHash) {
            history.replaceState(null, '', nextHash);
        }
    }
    if (page !== 'home') {
        isMainPlayerVisible = false;
    } else {
        miniPlayerDismissed = false;
    }
    updateDocumentTitle(page);
    updateMiniMusicPlayerVisibility();

    initScrollReveal(true);
    
    // Initialize TOC observer for TOS page
    if (page === 'tos') {
        setTimeout(() => {
            initTOCObserver();
        }, 100);
    }
    
    if (page === 'home') {
        runWhenIdle(() => {
            ensureHomeWidgetsReady();
            ensurePresenceReady();
        }, 600);
    }
}

function syncMiniPlayerVolumeRanges() {
    const value = Math.round(settings.volume * 100);
    const miniVolumeRange = document.getElementById('mini-player-volume-range');
    const miniVolumeRangeCompact = document.getElementById('mini-player-volume-range-compact');
    if (miniVolumeRange) miniVolumeRange.value = value;
    if (miniVolumeRangeCompact) miniVolumeRangeCompact.value = value;
}

