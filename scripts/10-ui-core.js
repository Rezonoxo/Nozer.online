function initSettingsCategories() {
    const modal = document.querySelector('.settings-modal');
    if (!modal) return;

    const tabs = Array.from(modal.querySelectorAll('.settings-category-btn'));
    const sections = Array.from(modal.querySelectorAll('.settings-section[data-settings-category]'));
    const searchInput = document.getElementById('settings-search');
    const resetAllBtn = document.getElementById('setting-reset-all');
    const emptyState = document.getElementById('settings-search-empty');
    if (!tabs.length || !sections.length) return;

    const updateSectionsVisibility = () => {
        const query = (searchInput?.value || '').trim().toLowerCase();
        const hasQuery = query.length > 0;
        let matchCount = 0;

        tabs.forEach((tab) => {
            const active = tab.dataset.settingsCategory === activeSettingsCategory;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        sections.forEach((section) => {
            const isActivePage = section.dataset.settingsCategory === activeSettingsCategory;
            const sectionItems = Array.from(section.querySelectorAll('.settings-item, .shortcut-item'));
            section.hidden = !isActivePage;
            if (!isActivePage) return;

            if (hasQuery && sectionItems.length) {
                sectionItems.forEach((item) => {
                    const text = (item.textContent || '').toLowerCase();
                    const match = text.includes(query);
                    item.hidden = !match;
                    if (match) matchCount += 1;
                });
                return;
            }

            sectionItems.forEach((item) => { item.hidden = false; });
            matchCount += sectionItems.length;
        });

        if (emptyState) {
            emptyState.hidden = !hasQuery || matchCount > 0;
        }
    };

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            activeSettingsCategory = tab.dataset.settingsCategory || 'sound';
            updateSectionsVisibility();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', updateSectionsVisibility);
    }

    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', () => {
            const accepted = window.confirm('Reset all settings to defaults?');
            if (!accepted) return;

            settings = {
                ...defaultSettings,
                shortcuts: { ...DEFAULT_SHORTCUTS }
            };
            saveSettings();
            applySettings();
            syncSettingsUI();
            activeSettingsCategory = 'sound';
            if (searchInput) searchInput.value = '';
            const miniPlayer = document.getElementById('mini-music-player');
            if (miniPlayer) {
                miniPlayer.style.left = '';
                miniPlayer.style.top = '';
                miniPlayer.style.right = '';
                miniPlayer.style.bottom = '';
            }
            updateSectionsVisibility();

            const shortcutButtons = Array.from(document.querySelectorAll('.shortcut-bind-btn'));
            shortcutButtons.forEach((button) => {
                const actionId = button.getAttribute('data-shortcut-action');
                if (!actionId) return;
                button.textContent = getShortcutLabel(settings.shortcuts?.[actionId] || '');
            });
        });
    }

    const defaultTab = tabs.find((tab) => tab.classList.contains('active')) || tabs[0];
    if (defaultTab) {
        activeSettingsCategory = defaultTab.dataset.settingsCategory || 'sound';
    }
    updateSectionsVisibility();
}

function renderProjectsSection() {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    grid.innerHTML = PROJECTS.map((project) => {
        const tagsHtml = (project.tech || []).slice(0, 4).map((tag) => `<span class="project-tag">${escapeHtml(tag)}</span>`).join('');
        const bannerStyle = getProjectBannerCss(project);
        const searchBlob = [
            project.title,
            project.subtitle,
            project.summary,
            ...(project.tech || []),
            ...(project.highlights || [])
        ].join(' ').toLowerCase();

        return `
            <article class="project-card project-showcase-card simple-project-card" data-project-id="${escapeHtml(project.id)}" data-project-search="${escapeHtml(searchBlob)}">
                <div class="project-banner" style="${escapeHtml(bannerStyle)}">
                    <span class="project-banner-pill">${escapeHtml((project.tech || [])[0] || 'project')}</span>
                </div>
                <div class="project-card-body">
                    <h3 class="project-title">${escapeHtml(project.title)}</h3>
                    <p class="project-subtitle">${escapeHtml(project.subtitle)}</p>
                    <p class="project-desc">${escapeHtml(project.summary)}</p>
                    <div class="project-tags">${tagsHtml}</div>
                    <div class="project-actions">
                        <button class="project-action project-action-primary" type="button" onclick="openProjectDetails('${escapeHtml(project.id)}')">
                            View Project Details <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    initScrollReveal(true);
}

function initProjectsSearch() {
    const input = document.getElementById('projects-search');
    const emptyState = document.getElementById('projects-search-empty');
    const cards = Array.from(document.querySelectorAll('#projects .project-card'));
    if (!input || !cards.length) return;

    const applyFilter = () => {
        const query = input.value.trim().toLowerCase();
        let visibleCount = 0;

        cards.forEach((card) => {
            const haystack = card.getAttribute('data-project-search') || '';
            const match = !query || haystack.includes(query);
            card.hidden = !match;
            if (match) visibleCount += 1;
        });

        if (emptyState) {
            emptyState.hidden = !query || visibleCount > 0;
        }
    };

    input.addEventListener('input', applyFilter);
    applyFilter();
}

function initAboutSearch() {
    const input = document.getElementById('about-search');
    const emptyState = document.getElementById('about-search-empty');
    const cards = Array.from(document.querySelectorAll('#about [data-about-card]'));
    if (!input || !cards.length) return;

    const applyFilter = () => {
        const query = input.value.trim().toLowerCase();
        let visibleCount = 0;

        cards.forEach((card) => {
            const title = card.querySelector('h3')?.textContent || '';
            const text = card.querySelector('.about-panel-text')?.textContent || '';
            const focus = card.querySelector('.about-panel-focus')?.textContent || '';
            const searchBlob = `${card.getAttribute('data-about-search') || ''} ${title} ${text} ${focus}`.toLowerCase();
            const match = !query || searchBlob.includes(query);
            card.hidden = !match;
            if (match) visibleCount += 1;
        });

        if (emptyState) {
            emptyState.hidden = !query || visibleCount > 0;
        }
    };

    input.addEventListener('input', applyFilter);
    applyFilter();
}

function getProjectById(projectId) {
    return PROJECTS.find((project) => project.id === projectId) || null;
}

function getProjectBannerCss(project) {
    const fallbackBanner = project?.banner || 'linear-gradient(135deg, rgba(70, 90, 255, 0.75), rgba(8, 12, 24, 0.94))';
    const bannerImage = project?.bannerImage;
    const lightOverlay = 'linear-gradient(180deg, rgba(8, 12, 20, 0.06), rgba(8, 12, 20, 0.22))';

    if (!bannerImage) {
        return `background:${fallbackBanner};`;
    }

    return [
        `background-color:rgb(12, 16, 24)`,
        `background-image:${lightOverlay}, url("${bannerImage}")`,
        'background-size:cover',
        'background-position:center',
        'background-repeat:no-repeat'
    ].join(';') + ';';
}

function renderProjectDetails(project) {
    const bannerEl = document.getElementById('project-modal-banner');
    const titleEl = document.getElementById('project-modal-title');
    const subtitleEl = document.getElementById('project-modal-subtitle');
    const metricsEl = document.getElementById('project-modal-metrics');
    const descriptionEl = document.getElementById('project-modal-description');
    const tagsEl = document.getElementById('project-modal-tags');
    const highlightsEl = document.getElementById('project-modal-highlights');
    const linksEl = document.getElementById('project-modal-links');
    if (!project || !bannerEl || !titleEl || !subtitleEl || !metricsEl || !descriptionEl || !tagsEl || !highlightsEl || !linksEl) return;

    bannerEl.style.cssText = getProjectBannerCss(project);
    titleEl.textContent = project.title || 'Project';
    subtitleEl.textContent = project.subtitle || '';
    descriptionEl.textContent = project.summary || '';

    metricsEl.innerHTML = (project.metrics || []).map((metric) => `
        <span class="project-modal-metric">
            <small>${escapeHtml(metric.label)}</small>
            <strong>${escapeHtml(metric.value)}</strong>
        </span>
    `).join('');

    tagsEl.innerHTML = (project.tech || []).map((tag) => `<span class="project-modal-tag">${escapeHtml(tag)}</span>`).join('');
    highlightsEl.innerHTML = (project.highlights || []).map((highlight) => `
        <div class="project-modal-highlight">
            <i class="fas fa-check"></i>
            <span>${escapeHtml(highlight)}</span>
        </div>
    `).join('');

    linksEl.innerHTML = (project.links || []).map((link) => {
        if (!link.url) {
            return `
                <span class="project-modal-link disabled">
                    <span>${escapeHtml(link.label)}</span>
                    <small>Private</small>
                </span>
            `;
        }

        return `
            <a class="project-modal-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
                <span>${escapeHtml(link.label)}</span>
                <i class="fas fa-arrow-up-right-from-square"></i>
            </a>
        `;
    }).join('');
}

function openProjectDetails(projectId) {
    const project = getProjectById(projectId);
    const overlay = document.getElementById('project-overlay');
    const modal = overlay ? overlay.querySelector('.project-modal') : null;
    if (!project || !overlay || !modal) return;
    renderProjectDetails(project);
    activateModal(overlay, modal, '.project-modal-close');
}

function closeProjectDetails() {
    const overlay = document.getElementById('project-overlay');
    if (overlay) deactivateModal(overlay);
}

function initProjectDetailsOverlay() {
    const overlay = document.getElementById('project-overlay');
    if (!overlay) return;
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeProjectDetails();
        }
    });
}

function initSkillsSearch() {
    const input = document.getElementById('skills-search');
    const countEl = document.getElementById('skills-search-count');
    const emptyState = document.getElementById('skills-search-empty');
    const cards = Array.from(document.querySelectorAll('#skills .language-card'));
    const groups = Array.from(document.querySelectorAll('#skills .skills-group'));
    if (!input || !cards.length || !groups.length) return;
    const totalSkills = cards.length;

    const applyFilter = () => {
        const query = input.value.trim().toLowerCase();
        let visibleCount = 0;

        cards.forEach((card) => {
            const name = card.querySelector('.language-name')?.textContent || '';
            const alt = card.querySelector('img')?.getAttribute('alt') || '';
            const groupTitle = card.closest('.skills-group')?.querySelector('.skills-section-title span')?.textContent || '';
            const haystack = `${name} ${alt} ${groupTitle}`.toLowerCase();
            const match = !query || haystack.includes(query);
            card.hidden = !match;
            if (match) visibleCount += 1;
        });

        groups.forEach((group) => {
            const groupCards = Array.from(group.querySelectorAll('.language-card'));
            const hasVisible = groupCards.some((card) => !card.hidden);
            group.hidden = !hasVisible;
            const badge = group.querySelector('.skills-group-count');
            if (badge) {
                const visibleInGroup = groupCards.filter((card) => !card.hidden).length;
                badge.textContent = String(visibleInGroup);
            }
        });

        if (emptyState) {
            emptyState.hidden = !query || visibleCount > 0;
        }

        if (countEl) {
            if (!query) {
                countEl.textContent = `showing all ${totalSkills} skills`;
            } else {
                countEl.textContent = `showing ${visibleCount} of ${totalSkills} skills`;
            }
        }
    };

    input.addEventListener('input', applyFilter);
    applyFilter();
}

function initShortcutSettings() {
    const list = document.getElementById('shortcut-list');
    const resetBtn = document.getElementById('shortcut-reset-btn');
    if (!list || !resetBtn) return;
    let captureHandler = null;

    const render = () => {
        list.innerHTML = '';
        SHORTCUT_ACTIONS.forEach((action) => {
            const row = document.createElement('div');
            row.className = 'shortcut-item';
            row.innerHTML = `
                <div class="shortcut-info">
                    <div class="shortcut-title">${action.title}</div>
                    <div class="shortcut-desc">${action.desc}</div>
                </div>
                <button type="button" class="shortcut-bind-btn" data-shortcut-action="${action.id}">
                    ${getShortcutLabel(settings.shortcuts?.[action.id] || '')}
                </button>
            `;
            list.appendChild(row);
        });

        Array.from(list.querySelectorAll('.shortcut-bind-btn')).forEach((btn) => {
            btn.addEventListener('click', () => {
                if (captureHandler) return;
                const actionId = btn.dataset.shortcutAction;
                if (!actionId) return;

                document.body.classList.add('capturing-shortcut');
                btn.classList.add('capturing');
                btn.textContent = 'Press key...';

                captureHandler = (event) => {
                    event.preventDefault();
                    const code = normalizeShortcutCode(event.code);
                    if (!code) return;

                    if (code === 'Escape') {
                        document.removeEventListener('keydown', captureHandler, true);
                        captureHandler = null;
                        document.body.classList.remove('capturing-shortcut');
                        render();
                        return;
                    }

                    if (code === 'Backspace') {
                        settings.shortcuts[actionId] = '';
                    } else {
                        const duplicatedAction = Object.keys(settings.shortcuts || {}).find((id) => settings.shortcuts[id] === code && id !== actionId);
                        if (duplicatedAction) {
                            settings.shortcuts[duplicatedAction] = '';
                        }
                        settings.shortcuts[actionId] = code;
                    }

                    saveSettings();
                    document.removeEventListener('keydown', captureHandler, true);
                    captureHandler = null;
                    document.body.classList.remove('capturing-shortcut');
                    render();
                };

                document.addEventListener('keydown', captureHandler, true);
            });
        });

        const searchInput = document.getElementById('settings-search');
        if (searchInput) {
            searchInput.dispatchEvent(new Event('input'));
        }
    };

    resetBtn.addEventListener('click', () => {
        settings.shortcuts = { ...DEFAULT_SHORTCUTS };
        saveSettings();
        render();
    });

    render();
}

function applyAudioSettings() {
    if (!musicAudio) return;
    musicAudio.muted = false;
    musicAudio.volume = getTargetMusicVolume();

    const volumeRange = document.getElementById('music-volume-range');
    if (volumeRange) {
        volumeRange.value = Math.round(settings.volume * 100);
    }
    syncMiniPlayerVolumeRanges();
}

function syncSettingsUI() {
    const muteToggle = document.getElementById('setting-mute');
    const volumeRange = document.getElementById('setting-volume');
    const cursorToggle = document.getElementById('setting-cursor');
    const confirmToggle = document.getElementById('setting-confirm-redirects');
    const floatingPlayerToggle = document.getElementById('setting-floating-player');
    const snapAssistToggle = document.getElementById('setting-mini-player-snap-assist');
    const reduceMotionToggle = document.getElementById('setting-reduce-motion');
    const highContrastToggle = document.getElementById('setting-high-contrast');
    const largeTextToggle = document.getElementById('setting-large-text');
    const focusToggle = document.getElementById('setting-focus-outlines');
    const dyslexiaFontToggle = document.getElementById('setting-dyslexia-font');
    const performanceToggle = document.getElementById('setting-performance-mode');

    if (muteToggle) muteToggle.checked = settings.mute;
    if (volumeRange) volumeRange.value = Math.round(settings.volume * 100);
    if (cursorToggle) cursorToggle.checked = settings.cursorEnabled;
    if (confirmToggle) confirmToggle.checked = settings.confirmExternal;
    if (floatingPlayerToggle) floatingPlayerToggle.checked = settings.floatingPlayerEnabled;
    if (snapAssistToggle) snapAssistToggle.checked = settings.miniPlayerSnapAssist;
    if (reduceMotionToggle) reduceMotionToggle.checked = settings.reduceMotion;
    if (highContrastToggle) highContrastToggle.checked = settings.highContrast;
    if (largeTextToggle) largeTextToggle.checked = settings.largeText;
    if (focusToggle) focusToggle.checked = settings.focusOutlines;
    if (dyslexiaFontToggle) dyslexiaFontToggle.checked = settings.dyslexiaFont;
    if (performanceToggle) performanceToggle.checked = settings.performanceMode;
}

function applySettings() {
    const body = document.body;
    if (!body) return;

    const useCustomCursor = settings.cursorEnabled && !settings.performanceMode && !window.matchMedia('(pointer: coarse)').matches;
    body.classList.toggle('custom-cursor-enabled', useCustomCursor);
    body.classList.toggle('cursor-disabled', !useCustomCursor);
    body.classList.toggle('reduce-motion', settings.reduceMotion);
    body.classList.toggle('high-contrast', settings.highContrast);
    body.classList.toggle('large-text', settings.largeText);
    body.classList.toggle('focus-outlines', settings.focusOutlines);
    body.classList.toggle('dyslexia-font', settings.dyslexiaFont);
    body.classList.toggle('performance-mode', settings.performanceMode);

    if (settings.reduceMotion || settings.performanceMode) {
        stopStarfield();
    } else if (!starIntervalId) {
        startStarfield();
    }

    applyAudioSettings();
    syncSettingsUI();
    updateMiniMusicPlayerVisibility();
    initScrollReveal(true);
}

function initSiteNotice() {
    const notice = document.getElementById('site-notice');
    const noticeText = document.getElementById('site-notice-text');
    const dismissBtn = document.getElementById('site-notice-dismiss');
    if (!notice || !noticeText) return;

    const enabled = !!SITE_NOTICE_CONFIG.enabled;
    noticeText.textContent = SITE_NOTICE_CONFIG.message || '';
    notice.hidden = !enabled;
    document.body.classList.toggle('site-notice-active', enabled);

    if (!dismissBtn) return;
    dismissBtn.hidden = !SITE_NOTICE_CONFIG.dismissible;
    dismissBtn.onclick = () => {
        notice.hidden = true;
        document.body.classList.remove('site-notice-active');
    };
}

function startStarfield() {
    if (starIntervalId) return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    starIntervalId = setInterval(makestar, isMobile ? 240 : 180);
}

function stopStarfield() {
    if (!starIntervalId) return;
    clearInterval(starIntervalId);
    starIntervalId = null;
}

function seedAmbientStars() {
    const starfield = document.getElementById('starfield');
    if (!starfield || starfield.dataset.seeded === 'true') return;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const ambientCount = isMobile ? 36 : 55;

    for (let i = 0; i < ambientCount; i += 1) {
        const star = document.createElement('div');
        star.className = 'star ambient';
        const variant = Math.random();
        if (variant < 0.34) star.classList.add('small');
        else if (variant < 0.78) star.classList.add('medium');
        else star.classList.add('large');
        const nearChance = isMobile ? 0.12 : 0.18;
        if (Math.random() < nearChance) {
            star.classList.add('near', 'glide');
        } else if (Math.random() < 0.55) {
            star.classList.add('twinkle');
        } else {
            star.classList.add('float');
        }
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.setProperty('--drift-x', `${(Math.random() - 0.5) * (isMobile ? 14 : 18)}px`);
        star.style.setProperty('--drift-y', `${(Math.random() - 0.5) * (isMobile ? 14 : 18)}px`);
        star.style.setProperty('--glide-x', `${(Math.random() - 0.5) * (isMobile ? 26 : 38)}px`);
        star.style.setProperty('--glide-y', `${(Math.random() - 0.5) * (isMobile ? 12 : 22)}px`);
        star.style.animationDelay = `${Math.random() * 4}s`;
        starfield.appendChild(star);
    }

    starfield.dataset.seeded = 'true';
}

function getFocusableElements(container) {
    if (!container) return [];
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(container.querySelectorAll(selector)).filter((element) => {
        const styles = window.getComputedStyle(element);
        return styles.display !== 'none' && styles.visibility !== 'hidden';
    });
}

function trapModalFocus(event) {
    if (event.key !== 'Tab' || !activeModalState?.modal) return;

    const focusable = getFocusableElements(activeModalState.modal);
    if (!focusable.length) {
        event.preventDefault();
        activeModalState.modal.focus();
        return;
    }

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
    }
}

function activateModal(overlay, modal, initialFocusSelector) {
    if (!overlay || !modal) return;

    if (activeModalState && activeModalState.overlay !== overlay) {
        deactivateModal(activeModalState.overlay, false);
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    activeModalState = { overlay, modal, previouslyFocused };
    document.addEventListener('keydown', trapModalFocus, true);

    requestAnimationFrame(() => {
        const initialFocus = initialFocusSelector ? modal.querySelector(initialFocusSelector) : null;
        const focusable = getFocusableElements(modal);
        const target = initialFocus || focusable[0] || modal;
        if (target instanceof HTMLElement) {
            target.focus();
        }
    });
}

function deactivateModal(overlay, restoreFocus = true) {
    if (!overlay) return;

    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    if (!activeModalState || activeModalState.overlay !== overlay) return;

    const previousFocus = activeModalState.previouslyFocused;
    activeModalState = null;
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', trapModalFocus, true);

    if (restoreFocus && previousFocus && previousFocus.isConnected) {
        previousFocus.focus();
    }
}

function openSettings() {
    const overlay = document.getElementById('settings-overlay');
    const modal = overlay ? overlay.querySelector('.settings-modal') : null;
    if (!overlay || !modal) return;
    activateModal(overlay, modal, '.settings-close');
    const searchInput = document.getElementById('settings-search');
    if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
    }
    syncSettingsUI();
}

function closeSettings() {
    const overlay = document.getElementById('settings-overlay');
    if (overlay) deactivateModal(overlay);
}

const WELCOME_GUIDE_CONTENT = {
    en: {
        buttons: {
            back: 'Back',
            next: 'Next',
            finish: 'Start exploring',
            skip: 'Skip'
        },
        steps: [
            {
                kicker: 'Introduction',
                title: 'Welcome to the site!',
                lead: 'Go through the introduction to not get lost.',
                stepTitle: 'Step 1 of 4',
                icon: 'fas fa-star',
                heading: 'What is this site?',
                text: 'You are currently on my personal website ~nozer. Nice to have you here :D Don\'t know each other? Here you can get to know me!',
                points: [
                    { title: 'Portfolio', text: 'Browse my completed and started projects and check what I\'m capable of.' },
                    { title: 'Contact', text: 'Here you will find several options to contact me, as well as links to my social media.' }
                ]
            },
            {
                kicker: 'Navigation',
                title: 'How to navigate the site',
                lead: 'Learn how to use and navigate the site so you don\'t get lost ^^',
                stepTitle: 'Navigation bar',
                icon: 'fas fa-compass',
                heading: 'Using a computer? Using a mobile device?',
                text: 'At the top of the page you will find a navigation bar with buttons to different tabs of the site. On mobile, you will find the navigation bar at the bottom of the page!',
                points: [
                    { title: 'Keyboard shortcuts', text: 'Move around the site more easily using shortcuts! On the computer, by default these are the number keys from 1 to 5.' },
                    { title: 'Safe links', text: '"Oh buttons! *click* Oops." Don\'t worry about accidentally leaving the site, by default you will see a confirmation to leave the site via a link.' }
                ]
            },
            {
                kicker: 'Personalization',
                title: 'Customize the site to your needs',
                lead: 'I have taken care of the convenience of use for every person. Check accessibility features!',
                stepTitle: 'Configure settings',
                icon: 'fas fa-sliders',
                heading: 'Click the settings button to open the menu',
                text: 'Customize it according to your own preferences or needs.',
                points: [
                    { title: 'Change keyboard shortcuts', text: 'Do the current shortcuts bother you? Change them or remove them by going to the shortcuts tab in settings!' },
                    { title: 'Music controller', text: 'There\'s even a DJ on the site! Well, almost, because there\'s a music box here that will be attached to your screen unless you hide it. The main controller is also in the Home section.' }
                ]
            },
            {
                kicker: 'Dismissal',
                title: 'Almost ready!',
                lead: 'Congratulations, you know the theory! Now we can move to the real site.',
                stepTitle: 'We can explore',
                icon: 'fas fa-rocket',
                heading: 'Take time to explore all sections',
                text: 'Familiarize yourself with their content to get to know me!',
                points: [
                    { title: 'There\'s still a show ahead of you', text: 'The assistant will now show you the Spotlight tutorial which will visually show you the elements of the site.' },
                    { title: 'Come back when you want', text: 'If necessary, you can run this guide again in settings.' }
                ]
            }
        ]
    },
    pl: {
        buttons: {
            back: 'Wstecz',
            next: 'Dalej',
            finish: 'Zacznij zwiedzać',
            skip: 'Pomiń'
        },
        steps: [
            {
                kicker: 'Wprowadzenie',
                title: 'Witaj na stronie!',
                lead: 'Przejdź przez wprowadzenie aby się nie pogubić.',
                stepTitle: 'krok 1 z 4',
                icon: 'fas fa-star',
                heading: 'Co to za strona?',
                text: 'Znajdujesz się obecnie na mojej stronie osobistej ~nozer. Miło mi cię tu gościć :D Nie znamy się? Tu możesz mnie poznać!',
                points: [
                    { title: 'Portfolio', text: 'Przejrzyj moje skończone i rozpoczęte projekty i sprawdź do czego jestem zdolny.' },
                    { title: 'Skontaktuj się', text: 'Znajdziesz tutaj kilka opcji do kontaktu ze mną, a także odnośniki do moich social mediów.' }
                ]
            },
            {
                kicker: 'Nawigacja',
                title: 'Jak poruszać się na stronie',
                lead: 'Naucz się obsługi i nawigacji po stronie żeby się nie zgubić ^^',
                stepTitle: 'Pasek nawigacji',
                icon: 'fas fa-compass',
                heading: 'korzystasz z komputera? Korzystasz z urządzenia mobilnego?',
                text: 'Na górze strony znajdziesz pasek nawigacyjny z przyciskami do różnych zakładek strony. Pasek nawigacji znajdziesz na dole strony!',
                points: [
                    { title: 'Skróty klawiszowe', text: 'poruszaj się łatwiej po stronie korzystając ze skrótów! Na komputerze domyślnie są to numery klawiszy od 1 do 5.' },
                    { title: 'Bezpieczne odnośniki', text: '"Oo przyciski! *klik* Ojć." nie martw się o przypadkowe opuszczenie strony, domyślnie wyświetli Ci się potwierdzenie opuszczenia strony przez odnośnik.' }
                ]
            },
            {
                kicker: 'Personalizacja',
                title: 'Dostosuj stronę do swoich potrzeb',
                lead: 'Zadbałem o wygodę korzystania dla każdej osoby. Sprawdź ułatwienia dostępu!',
                stepTitle: 'Skonfiguruj ustawienia',
                icon: 'fas fa-sliders',
                heading: 'Kliknij przycisk ustawień aby otworzyć menu',
                text: 'i dostosuj go według własnych upodobań lub potrzeb.',
                points: [
                    { title: 'Zmień skróty klawiszowe', text: 'Obecne skróty Ci przeszkadzają? Zmień je lub usuń przechodząc do zakładki shortcuts w ustawieniach!' },
                    { title: 'Kontroler muzyczny', text: 'Na stronie jest nawet DJ! no prawie, bo jest tu music box który będzie doczepiony do twojego ekranu no chyba że go ukryjesz. Główny kontroler znajduje się tez w sekcji Home.' }
                ]
            },
            {
                kicker: 'Odprawa',
                title: 'Już prawie gotowe!',
                lead: 'Gratuluje znasz już teorię! Teraz możemy przejść do realnej strony.',
                stepTitle: 'Możemy zwiedzać',
                icon: 'fas fa-rocket',
                heading: 'Poświęć czas na eksploracje wszystkich sekcji',
                text: 'i zapoznaj się z ich zawartością aby mnie poznać!',
                points: [
                    { title: 'Przed tobą jeszcze pokaz', text: 'Asystent pokaże Ci teraz Spotlight tutorial który wizualnie pokaże Ci elementy strony.' },
                    { title: 'Wróć kiedy chcesz', text: 'W razie potrzeby uruchomisz ten przewodnik ponownie w ustawieniach.' }
                ]
            }
        ]
    }
};

let welcomeGuideStepIndex = 0;
let welcomeGuideLanguage = 'en';
let welcomeTourStepIndex = 0;
let welcomeTourActiveTarget = null;
let welcomeTourScrollY = 0;
let welcomeTourPositionFrame = 0;

function hasSeenWelcomeGuide() {
    return localStorage.getItem(WELCOME_GUIDE_STORAGE_KEY) === 'true';
}

function markWelcomeGuideSeen() {
    localStorage.setItem(WELCOME_GUIDE_STORAGE_KEY, 'true');
}

function renderWelcomeGuide() {
    const copy = WELCOME_GUIDE_CONTENT[welcomeGuideLanguage] || WELCOME_GUIDE_CONTENT.en;
    const steps = copy.steps || [];
    const step = steps[welcomeGuideStepIndex];
    if (!step) return;

    const kickerEl = document.getElementById('welcome-guide-kicker');
    const titleEl = document.getElementById('welcome-guide-title');
    const leadEl = document.getElementById('welcome-guide-lead');
    const stepLabelEl = document.getElementById('welcome-guide-step-label');
    const stepTitleEl = document.getElementById('welcome-guide-step-title');
    const progressFillEl = document.getElementById('welcome-guide-progress-fill');
    const iconEl = document.getElementById('welcome-guide-stage-icon');
    const headingEl = document.getElementById('welcome-guide-stage-heading');
    const textEl = document.getElementById('welcome-guide-stage-text');
    const pointsEl = document.getElementById('welcome-guide-points');
    const prevBtn = document.querySelector('[data-welcome-guide-prev]');
    const nextBtn = document.querySelector('[data-welcome-guide-next]');
    const skipBtn = document.querySelector('[data-welcome-guide-skip]');

    if (kickerEl) kickerEl.textContent = step.kicker;
    if (titleEl) titleEl.textContent = step.title;
    if (leadEl) leadEl.textContent = step.lead;
    if (stepLabelEl) {
        stepLabelEl.textContent = welcomeGuideLanguage === 'pl'
            ? `Krok ${welcomeGuideStepIndex + 1} z ${steps.length}`
            : `Step ${welcomeGuideStepIndex + 1} of ${steps.length}`;
    }
    if (stepTitleEl) stepTitleEl.textContent = step.stepTitle;
    if (progressFillEl) {
        progressFillEl.style.width = `${((welcomeGuideStepIndex + 1) / steps.length) * 100}%`;
    }
    if (iconEl) {
        iconEl.innerHTML = `<i class="${escapeHtml(step.icon || 'fas fa-star')}"></i>`;
    }
    if (headingEl) headingEl.textContent = step.heading;
    if (textEl) textEl.textContent = step.text;
    if (pointsEl) {
        pointsEl.innerHTML = (step.points || []).map((point) => `
            <div class="welcome-guide-point">
                <strong>${escapeHtml(point.title)}</strong>
                <span>${escapeHtml(point.text)}</span>
            </div>
        `).join('');
    }
    if (prevBtn) {
        prevBtn.textContent = copy.buttons.back;
        prevBtn.disabled = welcomeGuideStepIndex === 0;
    }
    if (skipBtn) {
        skipBtn.textContent = copy.buttons.skip;
    }
    if (nextBtn) {
        nextBtn.textContent = welcomeGuideStepIndex === steps.length - 1 ? copy.buttons.finish : copy.buttons.next;
    }

    document.querySelectorAll('[data-guide-lang]').forEach((button) => {
        const active = button.getAttribute('data-guide-lang') === welcomeGuideLanguage;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
}

function openWelcomeGuide(options = {}) {
    const overlay = document.getElementById('welcome-guide-overlay');
    const modal = overlay ? overlay.querySelector('.welcome-guide-modal') : null;
    if (!overlay || !modal) return;

    welcomeGuideStepIndex = 0;
    if (options.language === 'pl' || options.language === 'en') {
        welcomeGuideLanguage = options.language;
    } else {
        const browserLang = String(navigator.language || '').toLowerCase();
        welcomeGuideLanguage = browserLang.startsWith('pl') ? 'pl' : 'en';
    }

    renderWelcomeGuide();
    document.body.classList.add('onboarding-open');
    activateModal(overlay, modal, `[data-guide-lang="${welcomeGuideLanguage}"]`);
}

function closeWelcomeGuide(markSeen = true) {
    const overlay = document.getElementById('welcome-guide-overlay');
    if (markSeen) markWelcomeGuideSeen();
    if (overlay) deactivateModal(overlay);
    if (!document.getElementById('welcome-tour-overlay')?.classList.contains('active')) {
        document.body.classList.remove('onboarding-open');
    }
}

function getWelcomeTourSteps() {
    return [
        {
            target: ['.fixed-nav .nav-links', '.mobile-bottom-nav'],
            kicker: welcomeGuideLanguage === 'pl' ? 'Nawigacja' : 'Navigation',
            title: welcomeGuideLanguage === 'pl' ? 'Jak poruszać się na stronie' : 'How to navigate the site',
            text: welcomeGuideLanguage === 'pl'
                ? 'Naucz się obsługi i nawigacji po stronie żeby się nie zgubić ^^ Pasek nawigacji. korzystasz z komputera? Na górze strony znajdziesz pasek nawigacyjny z przyciskami do różnych zakładek strony. Korzystasz z urządzenia mobilnego? Pasek nawigacji znajdziesz na dole strony!'
                : 'Learn how to use and navigate the site so you don\'t get lost ^^ Navigation bar. Using a computer? At the top of the page you will find a navigation bar with buttons to different tabs of the site. Using a mobile device? You will find the navigation bar at the bottom of the page!'
        },
        {
            target: ['#favorites-card'],
            kicker: welcomeGuideLanguage === 'pl' ? 'Personalizacja' : 'Personalization',
            title: welcomeGuideLanguage === 'pl' ? 'Dostosuj stronę do swoich potrzeb' : 'Customize the site to your needs',
            text: welcomeGuideLanguage === 'pl'
                ? 'Zadbałem o wygodę korzystania dla każdej osoby. Sprawdź ułatwienia dostępu! Skonfiguruj ustawienia. Kliknij przycisk ustawień aby otworzyć menu i dostosuj go według własnych upodobań lub potrzeb. Zmień skróty klawiszowe. Obecne skróty Ci przeszkadzają? Zmień je lub usuń przechodząc do zakładki shortcuts w ustawieniach!'
                : 'I have taken care of the convenience of use for every person. Check accessibility features! Configure settings. Click the settings button to open the menu and customize it according to your own preferences or needs. Change keyboard shortcuts. Do the current shortcuts bother you? Change them or remove them by going to the shortcuts tab in settings!'
        },
        {
            target: ['#settings-toggle'],
            kicker: welcomeGuideLanguage === 'pl' ? 'Odprawa' : 'Dismissal',
            title: welcomeGuideLanguage === 'pl' ? 'Już prawie gotowe!' : 'Almost ready!',
            text: welcomeGuideLanguage === 'pl'
                ? 'Gratuluje znasz już teorię! Teraz możemy przejść do realnej strony. Możemy zwiedzać. Poświęć czas na eksploracje wszystkich sekcji i zapoznaj się z ich zawartością aby mnie poznać! Przed tobą jeszcze pokaz. Asystent pokaże Ci teraz Spotlight tutorial który wizualnie pokaże Ci elementy strony. Wróć kiedy chcesz. W razie potrzeby uruchomisz ten przewodnik ponownie w ustawieniach.'
                : 'Congratulations, you know the theory! Now we can move to the real site. We can explore. Take time to explore all sections and familiarize yourself with their content to get to know me! There\'s still a show ahead of you. The assistant will now show you the Spotlight tutorial which will visually show you the elements of the site. Come back when you want. If necessary, you can run this guide again in settings.'
        }
    ];
}

function isElementVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
        return false;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
        return false;
    }
    if (element.offsetParent === null && style.position !== 'fixed' && style.position !== 'sticky') {
        return false;
    }
    return true;
}

function getWelcomeTourTarget(step) {
    const selectors = Array.isArray(step?.target) ? step.target : [];
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (isElementVisible(element)) {
            return element;
        }
    }
    return null;
}

function positionWelcomeTour() {
    const overlay = document.getElementById('welcome-tour-overlay');
    const spotlight = document.getElementById('welcome-tour-spotlight');
    const targetLabel = document.getElementById('welcome-tour-target-label');
    const modal = overlay ? overlay.querySelector('.welcome-tour-modal') : null;
    const titleEl = document.getElementById('welcome-tour-title');
    const textEl = document.getElementById('welcome-tour-text');
    const kickerEl = document.getElementById('welcome-tour-kicker');
    const stepEl = document.getElementById('welcome-tour-step');
    const nextBtn = document.querySelector('[data-welcome-tour-next]');
    const prevBtn = document.querySelector('[data-welcome-tour-prev]');
    if (!overlay || !spotlight || !targetLabel || !modal || !titleEl || !textEl || !kickerEl || !stepEl) return;

    const steps = getWelcomeTourSteps();
    const step = steps[welcomeTourStepIndex];
    const target = getWelcomeTourTarget(step);
    if (!step || !target) return;

    kickerEl.textContent = step.kicker;
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    stepEl.textContent = `${welcomeTourStepIndex + 1} / ${steps.length}`;
    if (prevBtn) prevBtn.disabled = welcomeTourStepIndex === 0;
    if (nextBtn) nextBtn.textContent = welcomeTourStepIndex === steps.length - 1
        ? (welcomeGuideLanguage === 'pl' ? 'Gotowe' : 'Done')
        : (welcomeGuideLanguage === 'pl' ? 'Dalej' : 'Next');

    const rect = target.getBoundingClientRect();
    const padding = 10;
    spotlight.style.top = `${Math.max(10, rect.top - padding)}px`;
    spotlight.style.left = `${Math.max(10, rect.left - padding)}px`;
    spotlight.style.width = `${Math.min(window.innerWidth - 20, rect.width + (padding * 2))}px`;
    spotlight.style.height = `${Math.min(window.innerHeight - 20, rect.height + (padding * 2))}px`;
    targetLabel.textContent = step.kicker;
    targetLabel.style.top = `${Math.max(12, rect.top - 18)}px`;
    targetLabel.style.left = `${Math.max(12, rect.left)}px`;

    const modalWidth = Math.min(360, window.innerWidth - 24);
    const preferredTop = rect.bottom + 18;
    const fallbackTop = rect.top - 18 - modal.offsetHeight;
    const top = preferredTop + modal.offsetHeight < window.innerHeight - 12
        ? preferredTop
        : Math.max(12, fallbackTop);
    const left = Math.min(
        window.innerWidth - modalWidth - 12,
        Math.max(12, rect.left)
    );

    modal.style.top = `${top}px`;
    modal.style.left = `${left}px`;
}

function syncWelcomeTourStep(scrollToTarget = true) {
    const steps = getWelcomeTourSteps();
    const step = steps[welcomeTourStepIndex];
    const target = getWelcomeTourTarget(step);
    if (!target) {
        positionWelcomeTour();
        return;
    }

    if (scrollToTarget) {
        target.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: settings.reduceMotion ? 'auto' : 'smooth'
        });
        window.setTimeout(positionWelcomeTour, settings.reduceMotion ? 0 : 180);
        return;
    }

    positionWelcomeTour();
}

function openWelcomeTour() {
    const overlay = document.getElementById('welcome-tour-overlay');
    const modal = overlay ? overlay.querySelector('.welcome-tour-modal') : null;
    if (!overlay || !modal) return;

    welcomeTourStepIndex = 0;
    document.body.classList.add('onboarding-open');
    activateModal(overlay, modal, '[data-welcome-tour-next]');
    syncWelcomeTourStep(true);
}

function closeWelcomeTour() {
    const overlay = document.getElementById('welcome-tour-overlay');
    if (overlay) deactivateModal(overlay);
    document.body.classList.remove('onboarding-open');
    document.body.classList.remove('tour-music-step');
}

function nextWelcomeTourStep() {
    const steps = getWelcomeTourSteps();
    if (welcomeTourStepIndex >= steps.length - 1) {
        closeWelcomeTour();
        return;
    }
    welcomeTourStepIndex += 1;
    syncWelcomeTourStep(true);
}

function prevWelcomeTourStep() {
    if (welcomeTourStepIndex <= 0) return;
    welcomeTourStepIndex -= 1;
    syncWelcomeTourStep(true);
}

function nextWelcomeGuideStep() {
    const steps = WELCOME_GUIDE_CONTENT[welcomeGuideLanguage]?.steps || [];
    if (welcomeGuideStepIndex >= steps.length - 1) {
        closeWelcomeGuide(true);
        setTimeout(() => {
            openWelcomeTour();
        }, 120);
        return;
    }
    welcomeGuideStepIndex += 1;
    renderWelcomeGuide();
}

function prevWelcomeGuideStep() {
    if (welcomeGuideStepIndex <= 0) return;
    welcomeGuideStepIndex -= 1;
    renderWelcomeGuide();
}

function setWelcomeTourScrollLock(locked) {
    if (locked) {
        welcomeTourScrollY = window.scrollY || window.pageYOffset || 0;
        document.body.style.setProperty('--welcome-tour-scroll-y', `${welcomeTourScrollY}px`);
        document.body.classList.add('welcome-tour-open');
        return;
    }

    document.body.classList.remove('welcome-tour-open');
    document.body.style.removeProperty('--welcome-tour-scroll-y');
    window.scrollTo(0, welcomeTourScrollY);
}

function queueWelcomeTourPosition() {
    if (welcomeTourPositionFrame) {
        cancelAnimationFrame(welcomeTourPositionFrame);
    }

    welcomeTourPositionFrame = requestAnimationFrame(() => {
        welcomeTourPositionFrame = requestAnimationFrame(() => {
            welcomeTourPositionFrame = 0;
            positionWelcomeTour();
        });
    });
}

function clearWelcomeTourForcedTargets() {
    const miniPlayer = document.getElementById('mini-music-player');
    if (miniPlayer) {
        miniPlayer.classList.remove('tour-force-visible');
    }
}

function prepareWelcomeTourStep(step) {
    clearWelcomeTourForcedTargets();
    document.body.classList.remove('tour-music-step');

    if (step?.page && currentpage !== step.page) {
        showpage(step.page);
    }

    if (step?.id === 'music-box') {
        document.body.classList.add('tour-music-step');
        miniPlayerDismissed = false;
        const miniPlayer = document.getElementById('mini-music-player');
        if (miniPlayer) {
            miniPlayer.classList.add('tour-force-visible');
        }
        updateMiniMusicPlayerVisibility();
    } else {
        updateMiniMusicPlayerVisibility();
    }
}

function getWelcomeTourSteps() {
    return [
        {
            id: 'navigation',
            page: 'home',
            target: ['.fixed-nav .nav-container', '.mobile-bottom-nav'],
            kicker: welcomeGuideLanguage === 'pl' ? 'Nawigacja' : 'Navigation',
            title: welcomeGuideLanguage === 'pl' ? 'Pięć głównych sekcji' : 'Five main sections',
            text: welcomeGuideLanguage === 'pl'
                ? 'Home, About, Projects, Skills, Contact. Desktop: góra. Mobil: dół.'
                : 'Home, About, Projects, Skills, Contact. Desktop: top. Mobile: bottom.'
        },
        {
            id: 'home',
            page: 'home',
            target: ['#discord-profile-card'],
            kicker: welcomeGuideLanguage === 'pl' ? 'Home' : 'Home',
            title: welcomeGuideLanguage === 'pl' ? 'Sprawdź co u mnie słychać' : 'Check what I\'m currently doing',
            text: welcomeGuideLanguage === 'pl'
                ? 'Podgląd mojego profilu Discord na żywo. Tu widzisz mój status, aktywność i co aktualnie robię.'
                : 'Live preview of my Discord profile. See my status, activity, and what I\'m currently up to.'
        },
        {
            id: 'music-box',
            page: 'projects',
            target: ['#mini-music-player.tour-force-visible', '#mini-music-player.visible', '#mini-music-player'],
            kicker: welcomeGuideLanguage === 'pl' ? 'Kontroler muzyczny' : 'Music controller',
            title: welcomeGuideLanguage === 'pl' ? 'Steruj muzyką w każdym momencie' : 'Control the music anytime',
            text: welcomeGuideLanguage === 'pl'
                ? 'Music Controller będzie doczepiony do twojego ekranu no chyba że go ukryjesz. Główny kontroler znajduje się tez w sekcji Home.'
                : 'The Music Controller will be attached to your screen unless you hide it. The main controller is also in the Home section.'
        },
        {
            id: 'about',
            page: 'about',
            target: ['#about .about-shell'],
            kicker: welcomeGuideLanguage === 'pl' ? 'About' : 'About',
            title: welcomeGuideLanguage === 'pl' ? 'Dowiedz się kim jestem' : 'Learn who I am',
            text: welcomeGuideLanguage === 'pl'
                ? 'Moja historia, co robię, moje podejście do pracy. Wszystko co musisz wiedzieć o mnie.'
                : 'My story, what I do, my work approach. Everything you need to know about me.'
        },
        {
            id: 'projects',
            page: 'projects',
            target: ['#projects-grid .project-card', '#projects-grid'],
            kicker: welcomeGuideLanguage === 'pl' ? 'Projects' : 'Projects',
            title: welcomeGuideLanguage === 'pl' ? 'Przeglądaj moje prace' : 'Browse my work',
            text: welcomeGuideLanguage === 'pl'
                ? 'Każda karta to projekt. Kliknij by zobaczyć szczegóły, opis i strukturę projektów.'
                : 'Each card is a project with details, description, and project structure.'
        },
        {
            id: 'skills',
            page: 'skills',
            target: ['#skills .skills-shell'],
            kicker: welcomeGuideLanguage === 'pl' ? 'Skills' : 'Skills',
            title: welcomeGuideLanguage === 'pl' ? 'Moje umiejętności i narzędzia których używam' : 'My languages and tools I use',
            text: welcomeGuideLanguage === 'pl'
                ? 'Języki programowania, narzędzia, programy.'
                : 'Programming languages, tools, software.'
        },
        {
            id: 'contact',
            page: 'contact',
            target: ['#contact .contact-primary-grid', '#contact .contact-social-grid'],
            kicker: welcomeGuideLanguage === 'pl' ? 'Contact' : 'Contact',
            title: welcomeGuideLanguage === 'pl' ? 'Jak się skontaktować' : 'Get in touch',
            text: welcomeGuideLanguage === 'pl'
                ? 'Znajdziesz tutaj kilka opcji do kontaktu ze mną, a także odnośniki do moich social mediów.'
                : 'Here you will find several options to contact me, as well as links to my social media.'
        },
        {
            id: 'settings',
            page: 'contact',
            target: ['#settings-toggle'],
            kicker: welcomeGuideLanguage === 'pl' ? 'Personalizacja' : 'Personalization',
            title: welcomeGuideLanguage === 'pl' ? 'Dostosuj stronę do swoich potrzeb' : 'Customize the site to your needs',
            text: welcomeGuideLanguage === 'pl'
                ? 'Otwórz ustawienia i dostosuj stronę do swoich potrzeb.'
                : 'Open settings and customize the site to your needs.'
        }
    ];
}

function getWelcomeTourTarget(step) {
    const selectors = Array.isArray(step?.target) ? step.target : [];
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (isElementVisible(element)) {
            return element;
        }
    }
    return null;
}

function positionWelcomeTour() {
    const overlay = document.getElementById('welcome-tour-overlay');
    const spotlight = document.getElementById('welcome-tour-spotlight');
    const targetLabel = document.getElementById('welcome-tour-target-label');
    const modal = overlay ? overlay.querySelector('.welcome-tour-modal') : null;
    const titleEl = document.getElementById('welcome-tour-title');
    const textEl = document.getElementById('welcome-tour-text');
    const kickerEl = document.getElementById('welcome-tour-kicker');
    const stepEl = document.getElementById('welcome-tour-step');
    const nextBtn = document.querySelector('[data-welcome-tour-next]');
    const prevBtn = document.querySelector('[data-welcome-tour-prev]');
    if (!overlay || !spotlight || !targetLabel || !modal || !titleEl || !textEl || !kickerEl || !stepEl) return;

    const steps = getWelcomeTourSteps();
    const step = steps[welcomeTourStepIndex];
    const target = getWelcomeTourTarget(step);
    if (!step || !target) return;

    if (welcomeTourActiveTarget && welcomeTourActiveTarget !== target) {
        welcomeTourActiveTarget.classList.remove('welcome-tour-target-active');
    }
    welcomeTourActiveTarget = target;
    welcomeTourActiveTarget.classList.add('welcome-tour-target-active');

    kickerEl.textContent = step.kicker;
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    stepEl.textContent = `${welcomeTourStepIndex + 1} / ${steps.length}`;
    if (prevBtn) prevBtn.disabled = welcomeTourStepIndex === 0;
    if (nextBtn) {
        nextBtn.textContent = welcomeTourStepIndex === steps.length - 1
            ? (welcomeGuideLanguage === 'pl' ? 'Gotowe' : 'Done')
            : (welcomeGuideLanguage === 'pl' ? 'Dalej' : 'Next');
    }

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const rect = target.getBoundingClientRect();
    const padding = isMobile ? 8 : 12;
    const topRect = Math.max(10, rect.top - padding);
    const leftRect = Math.max(10, rect.left - padding);
    const widthRect = Math.min(window.innerWidth - 20, rect.width + (padding * 2));
    const heightRect = Math.min(window.innerHeight - 20, rect.height + (padding * 2));

    spotlight.style.top = `${topRect}px`;
    spotlight.style.left = `${leftRect}px`;
    spotlight.style.width = `${widthRect}px`;
    spotlight.style.height = `${heightRect}px`;

    targetLabel.textContent = step.kicker;
    targetLabel.style.top = `${Math.max(12, topRect - (isMobile ? 12 : 14))}px`;
    targetLabel.style.left = `${Math.max(12, Math.min(leftRect, window.innerWidth - 140))}px`;

    const modalWidth = isMobile ? window.innerWidth - 20 : Math.min(360, window.innerWidth - 24);
    const gap = isMobile ? 14 : 18;
    const fitsRight = rect.right + gap + modalWidth < window.innerWidth - 12;
    const fitsLeft = rect.left - gap - modalWidth > 12;
    let left;
    let top;

    if (isMobile) {
        const shouldPlaceAbove = rect.top > window.innerHeight * 0.48;
        left = 10;
        top = shouldPlaceAbove
            ? Math.max(12, rect.top - modal.offsetHeight - gap)
            : Math.min(window.innerHeight - modal.offsetHeight - 12, rect.bottom + gap);
    } else if (fitsRight) {
        left = rect.right + gap;
        top = Math.min(window.innerHeight - modal.offsetHeight - 12, Math.max(12, rect.top));
    } else if (fitsLeft) {
        left = rect.left - modalWidth - gap;
        top = Math.min(window.innerHeight - modal.offsetHeight - 12, Math.max(12, rect.top));
    } else if (rect.bottom + gap + modal.offsetHeight < window.innerHeight - 12) {
        left = Math.min(window.innerWidth - modalWidth - 12, Math.max(12, rect.left));
        top = rect.bottom + gap;
    } else {
        left = Math.min(window.innerWidth - modalWidth - 12, Math.max(12, rect.left));
        top = Math.max(12, rect.top - modal.offsetHeight - gap);
    }

    modal.style.top = `${top}px`;
    modal.style.left = `${left}px`;
}

function syncWelcomeTourStep(scrollToTarget = true) {
    const steps = getWelcomeTourSteps();
    const step = steps[welcomeTourStepIndex];
    prepareWelcomeTourStep(step);

    const target = getWelcomeTourTarget(step);
    if (!target) {
        window.setTimeout(queueWelcomeTourPosition, 120);
        return;
    }

    if (scrollToTarget) {
        setWelcomeTourScrollLock(false);
        target.scrollIntoView({
            block: window.matchMedia('(max-width: 768px)').matches ? 'nearest' : 'center',
            inline: 'nearest',
            behavior: 'auto'
        });
        window.setTimeout(() => {
            setWelcomeTourScrollLock(true);
            queueWelcomeTourPosition();
        }, 80);
        return;
    }

    queueWelcomeTourPosition();
}

function openWelcomeTour() {
    const overlay = document.getElementById('welcome-tour-overlay');
    const modal = overlay ? overlay.querySelector('.welcome-tour-modal') : null;
    if (!overlay || !modal) return;

    welcomeTourStepIndex = 0;
    document.body.classList.add('onboarding-open');
    activateModal(overlay, modal, '[data-welcome-tour-next]');
    setWelcomeTourScrollLock(true);
    syncWelcomeTourStep(true);
}

function closeWelcomeTour() {
    const overlay = document.getElementById('welcome-tour-overlay');
    if (overlay) deactivateModal(overlay);
    clearWelcomeTourForcedTargets();
    if (welcomeTourActiveTarget) {
        welcomeTourActiveTarget.classList.remove('welcome-tour-target-active');
        welcomeTourActiveTarget = null;
    }
    if (welcomeTourPositionFrame) {
        cancelAnimationFrame(welcomeTourPositionFrame);
        welcomeTourPositionFrame = 0;
    }
    setWelcomeTourScrollLock(false);
    document.body.classList.remove('onboarding-open');
}

function nextWelcomeTourStep() {
    const steps = getWelcomeTourSteps();
    if (welcomeTourStepIndex >= steps.length - 1) {
        closeWelcomeTour();
        return;
    }
    welcomeTourStepIndex += 1;
    syncWelcomeTourStep(true);
}

function prevWelcomeTourStep() {
    if (welcomeTourStepIndex <= 0) return;
    welcomeTourStepIndex -= 1;
    syncWelcomeTourStep(true);
}

function initCoreUIBindings() {
    document.querySelectorAll('[data-external-redirect-close], [data-external-redirect-cancel]').forEach((element) => {
        element.addEventListener('click', cancelExternalRedirect);
    });

    document.querySelectorAll('[data-external-redirect-confirm]').forEach((element) => {
        element.addEventListener('click', confirmExternalRedirect);
    });

    document.querySelectorAll('[data-guide-lang]').forEach((element) => {
        element.addEventListener('click', () => {
            welcomeGuideLanguage = element.getAttribute('data-guide-lang') === 'pl' ? 'pl' : 'en';
            renderWelcomeGuide();
            if (document.getElementById('welcome-tour-overlay')?.classList.contains('active')) {
                syncWelcomeTourStep(false);
            }
        });
    });

    document.querySelectorAll('[data-welcome-guide-close], [data-welcome-guide-skip]').forEach((element) => {
        element.addEventListener('click', () => closeWelcomeGuide(true));
    });

    document.querySelectorAll('[data-welcome-guide-next]').forEach((element) => {
        element.addEventListener('click', nextWelcomeGuideStep);
    });

    document.querySelectorAll('[data-welcome-guide-prev]').forEach((element) => {
        element.addEventListener('click', prevWelcomeGuideStep);
    });

    document.querySelectorAll('[data-welcome-tour-next]').forEach((element) => {
        element.addEventListener('click', nextWelcomeTourStep);
    });

    document.querySelectorAll('[data-welcome-tour-prev]').forEach((element) => {
        element.addEventListener('click', prevWelcomeTourStep);
    });

    document.querySelectorAll('[data-welcome-tour-skip]').forEach((element) => {
        element.addEventListener('click', closeWelcomeTour);
    });

    const showGuideBtn = document.getElementById('setting-show-welcome-guide');
    if (showGuideBtn) {
        showGuideBtn.addEventListener('click', () => {
            closeWelcomeTour();
            closeSettings();
            openWelcomeGuide({ language: welcomeGuideLanguage });
        });
    }

    window.addEventListener('resize', () => {
        if (document.getElementById('welcome-tour-overlay')?.classList.contains('active')) {
            queueWelcomeTourPosition();
        }
    });

    window.addEventListener('scroll', () => {
        if (document.getElementById('welcome-tour-overlay')?.classList.contains('active')) {
            window.scrollTo(0, welcomeTourScrollY);
            queueWelcomeTourPosition();
        }
    }, { passive: true });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            if (document.getElementById('welcome-tour-overlay')?.classList.contains('active')) {
                queueWelcomeTourPosition();
            }
        });

        window.visualViewport.addEventListener('scroll', () => {
            if (document.getElementById('welcome-tour-overlay')?.classList.contains('active')) {
                queueWelcomeTourPosition();
            }
        });
    }
}

function openExternalRedirect(url, target) {
    const overlay = document.getElementById('external-redirect-overlay');
    const modal = overlay ? overlay.querySelector('.external-redirect-modal') : null;
    const urlEl = document.getElementById('external-redirect-url');
    const domainEl = document.getElementById('external-redirect-domain');
    const dontAsk = document.getElementById('external-redirect-dont-ask');
    if (!overlay || !modal || !urlEl) return;

    pendingRedirectUrl = url;
    pendingRedirectTarget = target;
    urlEl.textContent = url;
    if (domainEl) domainEl.textContent = getDomainOnly(url);
    if (dontAsk) dontAsk.checked = false;
    activateModal(overlay, modal, '.external-redirect-btn.primary');
}

function getDomainOnly(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch (error) {
        return url;
    }
}

function closeExternalRedirect() {
    const overlay = document.getElementById('external-redirect-overlay');
    if (overlay) deactivateModal(overlay);
    pendingRedirectUrl = null;
    pendingRedirectTarget = null;
}

function applyRedirectPreference() {
    const dontAsk = document.getElementById('external-redirect-dont-ask');
    if (dontAsk && dontAsk.checked) {
        settings.confirmExternal = false;
        saveSettings();
        syncSettingsUI();
    }
}

function cancelExternalRedirect() {
    applyRedirectPreference();
    closeExternalRedirect();
}

function safeOpenExternal(url, target = '_blank') {
    if (!url) return;

    if (settings.confirmExternal) {
        openExternalRedirect(url, target);
        return;
    }

    if (target === '_blank') {
        window.open(url, '_blank', 'noopener,noreferrer');
    } else {
        window.location.href = url;
    }
}

function confirmExternalRedirect() {
    if (!pendingRedirectUrl) return;

    const url = pendingRedirectUrl;
    const target = pendingRedirectTarget;
    applyRedirectPreference();
    closeExternalRedirect();

    if (target === '_blank') {
        window.open(url, '_blank', 'noopener,noreferrer');
    } else {
        window.location.href = url;
    }
}
