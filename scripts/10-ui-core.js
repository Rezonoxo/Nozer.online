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
        const searchBlob = [
            project.title,
            project.subtitle,
            project.summary,
            ...(project.tech || []),
            ...(project.highlights || [])
        ].join(' ').toLowerCase();

        return `
            <article class="project-card project-showcase-card simple-project-card" data-project-id="${escapeHtml(project.id)}" data-project-search="${escapeHtml(searchBlob)}">
                <div class="project-banner" style="background:${escapeHtml(project.banner)}">
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
            const tags = Array.from(card.querySelectorAll('.about-panel-tags span')).map((tag) => tag.textContent || '').join(' ');
            const searchBlob = `${card.getAttribute('data-about-search') || ''} ${title} ${text} ${tags}`.toLowerCase();
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

    bannerEl.style.background = project.banner || 'linear-gradient(135deg, rgba(70, 90, 255, 0.75), rgba(8, 12, 24, 0.94))';
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

function getDisplayUrl(url) {
    try {
        const parsed = new URL(url);
        const path = parsed.pathname.length > 1 ? parsed.pathname : '';
        return `${parsed.hostname}${path}`;
    } catch (error) {
        return url;
    }
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


