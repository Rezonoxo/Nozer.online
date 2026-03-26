// Discord Profile Fetching
const DISCORD_USER_ID = window.APP_API_CONFIG?.lanyard?.userId || '690653953238499369';
const DISCORD_USERNAME = window.APP_API_CONFIG?.lanyard?.username || 'rezonoxo'; // Twoj username Discord jako fallback
const LANYARD_REST_URL = window.APP_API_CONFIG?.lanyard?.restUrl || 'https://api.lanyard.rest/v1/users/';
const LANYARD_SOCKET_URL = window.APP_API_CONFIG?.lanyard?.socketUrl || 'wss://api.lanyard.rest/socket';

const DISCORD_STATUS_TEXT = {
    online: 'Online',
    idle: 'Away',
    dnd: 'Do Not Disturb',
    offline: 'Offline'
};

function getDiscordDeviceInfo(user) {
    const devices = [];

    if (user.active_on_discord_mobile) {
        devices.push('Mobile');
    }
    if (user.active_on_discord_desktop) {
        devices.push('Desktop');
    }
    if (user.active_on_discord_web) {
        devices.push('Web');
    }

    if (devices.length === 0) {
        return {
            chipIconsHtml: '<i class="fas fa-desktop"></i>',
            tileIconsHtml: '<span class="presence-icon"><i class="fas fa-desktop"></i></span>',
            tooltip: 'No active device'
        };
    }

    const deviceIconMap = {
        Mobile: 'fas fa-mobile-alt',
        Desktop: 'fas fa-desktop',
        Web: 'fas fa-globe'
    };

    const chipIconsHtml = devices
        .map(device => `<i class="${deviceIconMap[device] || 'fas fa-desktop'}"></i>`)
        .join(' ');

    const tileIconsHtml = devices
        .map(device => `<span class="presence-icon"><i class="${deviceIconMap[device] || 'fas fa-desktop'}"></i></span>`)
        .join('');

    return {
        chipIconsHtml,
        tileIconsHtml,
        tooltip: `Active on ${devices.join(' + ')}`
    };
}

// Zmienne do przechowywania aktualnych danych Spotify i presence
let currentSpotifyData = null;
let spotifyUpdateInterval = null;
let discordElapsedInterval = null;
let discordPollInterval = null;
let discordCurrentStatus = 'offline';
let lanyardSocket = null;
let lanyardHeartbeatInterval = null;
let lanyardReconnectTimer = null;
let lanyardReconnectAttempts = 0;
let lanyardConnected = false;

function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, char => (
        {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]
    ));
}

function formatElapsedClock(start) {
    if (!start) return '0:00';
    const totalSeconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getActivityButtons(activity) {
    const labels = Array.isArray(activity?.buttons) ? activity.buttons : [];
    const urls = Array.isArray(activity?.buttons_urls)
        ? activity.buttons_urls
        : (Array.isArray(activity?.metadata?.button_urls) ? activity.metadata.button_urls : []);
    const maxCount = Math.min(labels.length, urls.length, 2);
    if (maxCount === 0) return '';

    let html = '<div class="activity-buttons">';
    for (let i = 0; i < maxCount; i++) {
        const label = escapeHtml(labels[i]);
        const url = escapeHtml(urls[i]);
        html += `<a class="activity-button" href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
    html += '</div>';
    return html;
}

function getDiscordCurrentLabel(status) {
    const statusLabel = DISCORD_STATUS_TEXT[status] || DISCORD_STATUS_TEXT.offline;
    return `Currently: ${statusLabel}`;
}

function syncDiscordStatusText() {
    const statusTextEl = document.getElementById('discord-status-text');
    if (!statusTextEl) return;
    statusTextEl.textContent = getDiscordCurrentLabel(discordCurrentStatus);
}

function updateDynamicDiscordTime() {
    document.querySelectorAll('.discord-elapsed[data-start]').forEach((el) => {
        const start = Number(el.dataset.start);
        if (!Number.isFinite(start) || start <= 0) return;
        el.textContent = `Elapsed ${formatElapsedClock(start)}`;
    });

    syncDiscordStatusText();
}

function startDiscordDynamicTime() {
    if (discordElapsedInterval) {
        clearInterval(discordElapsedInterval);
        discordElapsedInterval = null;
    }
    updateDynamicDiscordTime();
    syncDiscordStatusText();
    discordElapsedInterval = setInterval(() => {
        updateDynamicDiscordTime();
        syncDiscordStatusText();
    }, 1000);
}

function renderDiscordProfile(user) {
    const avatar = document.getElementById('discord-avatar');
    if (avatar) {
        const avatarUrl = user.discord_user?.avatar
            ? `https://cdn.discordapp.com/avatars/${DISCORD_USER_ID}/${user.discord_user.avatar}.png?size=256`
            : `https://cdn.discordapp.com/embed/avatars/${(user.discord_user?.discriminator || '0') % 5}.png`;
        avatar.src = avatarUrl;
        avatar.alt = user.discord_user?.display_name || user.discord_user?.username || 'Discord User';
    }

    const usernameEl = document.getElementById('discord-username');
    if (usernameEl) {
        const displayName = user.discord_user?.display_name;
        const username = user.discord_user?.username || 'Unknown';
        const globalName = user.discord_user?.global_name;
        const discriminator = user.discord_user?.discriminator;

        if (displayName && displayName.trim() !== '') {
            usernameEl.textContent = displayName;
        } else if (globalName && globalName.trim() !== '') {
            usernameEl.textContent = globalName;
        } else {
            usernameEl.textContent = discriminator && discriminator !== '0'
                ? `${username}#${discriminator}`
                : `@${username}`;
        }
    }

    const status = user.discord_status || 'offline';
    discordCurrentStatus = status;
    const statusEl = document.getElementById('discord-status');
    const statusTextEl = document.getElementById('discord-status-text');
    const statusChipEl = document.getElementById('discord-status-chip');
    const deviceChipEl = document.getElementById('discord-device-chip');
    const statusLabel = DISCORD_STATUS_TEXT[status] || DISCORD_STATUS_TEXT.offline;
    const deviceInfo = getDiscordDeviceInfo(user);

    if (statusEl) {
        statusEl.className = `status-indicator ${status}`;
    }

    if (statusChipEl) {
        statusChipEl.textContent = statusLabel;
    }

    if (statusTextEl) {
        statusTextEl.textContent = getDiscordCurrentLabel(status);
    }

    if (deviceChipEl) {
        deviceChipEl.innerHTML = deviceInfo.chipIconsHtml;
        deviceChipEl.title = deviceInfo.tooltip;
    }

    const customTileEl = document.getElementById('discord-custom-tile');
    const customTextEl = document.getElementById('discord-custom-text');
    let customStatus = null;

    const activitiesContainer = document.getElementById('discord-activities');
    if (activitiesContainer) {
        activitiesContainer.innerHTML = '';

        if (spotifyUpdateInterval) {
            clearInterval(spotifyUpdateInterval);
            spotifyUpdateInterval = null;
        }
        currentSpotifyData = null;

        const activities = Array.isArray(user.activities) ? user.activities : [];
        const visibleActivities = activities.filter(activity => activity.type !== 4);

        activities.forEach(activity => {
            if (activity.type === 4 && activity.state) {
                customStatus = activity.state;
            }
        });

        if (visibleActivities.length > 0) {
            visibleActivities.forEach(activity => {
                const activityCard = document.createElement('div');
                activityCard.className = 'activity-card';
                const buttonsHtml = getActivityButtons(activity);

                if (activity.type === 2 && activity.name === 'Spotify') {
                    currentSpotifyData = activity;
                    activityCard.classList.add('spotify');
                    activityCard.id = 'spotify-activity-card';
                    const albumArt = activity.assets?.large_image
                        ? `https://i.scdn.co/image/${activity.assets.large_image.replace('spotify:', '')}`
                        : (user.spotify?.album_art_url || '');
                    const trackName = escapeHtml(activity.details || user.spotify?.song || 'Unknown Track');
                    const artistName = escapeHtml(activity.state || user.spotify?.artist || 'Unknown Artist');

                    activityCard.innerHTML = `
                        <div class="activity-header">
                            <div class="activity-icon">
                                <i class="fab fa-spotify"></i>
                            </div>
                            <div class="activity-type">LISTENING TO SPOTIFY</div>
                        </div>
                        <div class="spotify-content">
                            <div class="spotify-album-container">
                                <img class="spotify-album-art" src="${albumArt}" alt="Album Art" onerror="this.src='https://i.scdn.co/image/ab67616d0000b27398016188d6fa7307f840603f'">
                            </div>
                            <div class="spotify-track-info">
                                <div class="activity-title">${trackName}</div>
                                <div class="activity-artist">${artistName}</div>
                            </div>
                        </div>
                        ${activity.timestamps ? `
                            <div class="progress-container">
                                <div class="progress-bar" id="spotify-progress-bar" style="width: ${calculateProgress(activity.timestamps)}%"></div>
                            </div>
                            <div class="progress-time">
                                <span id="spotify-current-time">${formatElapsed(activity.timestamps.start)}</span>
                                <span id="spotify-duration">${formatDuration(activity.timestamps.start, activity.timestamps.end)}</span>
                            </div>
                        ` : ''}
                        ${buttonsHtml}
                    `;

                    if (activity.timestamps) {
                        startSpotifyRealTimeUpdate(activity.timestamps);
                    }
                } else if (activity.type === 0) {
                    const isVscode = activity.name === 'Visual Studio Code' || activity.application_id === '383226320970055681';
                    const details = escapeHtml(activity.details || activity.name || 'Active now');
                    const state = escapeHtml(activity.state || '');
                    const elapsedHtml = activity.timestamps?.start
                        ? `<div class="activity-elapsed discord-elapsed" data-start="${activity.timestamps.start}">Elapsed ${formatElapsedClock(activity.timestamps.start)}</div>`
                        : '';

                    if (isVscode) {
                        activityCard.classList.add('vscode', 'rich');
                        activityCard.innerHTML = `
                            <div class="activity-header">
                                <div class="activity-icon">
                                    <i class="fas fa-code"></i>
                                </div>
                                <div class="activity-type">PLAYING VISUAL STUDIO CODE</div>
                            </div>
                            <div class="activity-content">
                                <div class="activity-app-icon">
                                    <i class="fab fa-html5"></i>
                                </div>
                                <div class="activity-copy">
                                    <div class="activity-title">${details}</div>
                                    ${state ? `<div class="activity-artist">${state}</div>` : ''}
                                    ${elapsedHtml}
                                </div>
                            </div>
                            ${buttonsHtml}
                        `;
                    } else {
                        const gameName = escapeHtml(activity.name || 'Game');
                        activityCard.innerHTML = `
                            <div class="activity-header">
                                <div class="activity-icon">
                                    <i class="fas fa-gamepad"></i>
                                </div>
                                <div class="activity-type">PLAYING A GAME</div>
                            </div>
                            <div class="activity-title">${gameName}</div>
                            ${activity.details ? `<div class="activity-artist">${escapeHtml(activity.details)}</div>` : ''}
                            ${activity.state ? `<div class="activity-artist">${escapeHtml(activity.state)}</div>` : ''}
                            ${elapsedHtml}
                            ${buttonsHtml}
                        `;
                    }
                } else {
                    const activityName = escapeHtml(activity.name || 'ACTIVE NOW');
                    const elapsedHtml = activity.timestamps?.start
                        ? `<div class="activity-elapsed discord-elapsed" data-start="${activity.timestamps.start}">Elapsed ${formatElapsedClock(activity.timestamps.start)}</div>`
                        : '';
                    activityCard.innerHTML = `
                        <div class="activity-header">
                            <div class="activity-icon">
                                <i class="fas fa-circle"></i>
                            </div>
                            <div class="activity-type">${activityName}</div>
                        </div>
                        ${activity.details ? `<div class="activity-title">${escapeHtml(activity.details)}</div>` : ''}
                        ${activity.state ? `<div class="activity-artist">${escapeHtml(activity.state)}</div>` : ''}
                        ${elapsedHtml}
                        ${buttonsHtml}
                    `;
                }

                activitiesContainer.appendChild(activityCard);
            });
        } else {
            activitiesContainer.innerHTML = '<div class="activity-placeholder">No activities right now</div>';
        }
    }

    if (customTileEl) {
        customTileEl.hidden = !customStatus;
    }

    if (customTextEl) {
        customTextEl.textContent = customStatus || '';
    }

    startDiscordDynamicTime();
}

async function fetchDiscordProfile() {
    try {
        const response = await fetch(`${LANYARD_REST_URL}${DISCORD_USER_ID}`);
        if (!response.ok || response.status === 404) {
            loadFallbackProfile();
            return;
        }

        const data = await response.json();
        if (!data.success || !data.data) {
            loadFallbackProfile();
            return;
        }

        renderDiscordProfile(data.data);
    } catch (error) {
        console.error('Error fetching Discord profile:', error);
        loadFallbackProfile();
    }
}

function clearLanyardSocketState() {
    if (lanyardHeartbeatInterval) {
        clearInterval(lanyardHeartbeatInterval);
        lanyardHeartbeatInterval = null;
    }
    if (lanyardSocket) {
        try {
            lanyardSocket.close();
        } catch (_) {
            // ignore close errors
        }
    }
    lanyardSocket = null;
    lanyardConnected = false;
}

function connectLanyardSocket() {
    if (typeof WebSocket === 'undefined' || lanyardSocket) {
        return;
    }

    try {
        lanyardSocket = new WebSocket(LANYARD_SOCKET_URL);
    } catch (_) {
        lanyardSocket = null;
        return;
    }

    lanyardSocket.addEventListener('open', () => {
        lanyardConnected = true;
        lanyardReconnectAttempts = 0;
    });

    lanyardSocket.addEventListener('message', (event) => {
        let payload;
        try {
            payload = JSON.parse(event.data);
        } catch (_) {
            return;
        }

        if (payload.op === 1) {
            const heartbeatInterval = Number(payload.d?.heartbeat_interval || 30000);
            if (lanyardHeartbeatInterval) {
                clearInterval(lanyardHeartbeatInterval);
            }
            lanyardHeartbeatInterval = setInterval(() => {
                if (lanyardSocket && lanyardSocket.readyState === WebSocket.OPEN) {
                    lanyardSocket.send(JSON.stringify({ op: 3 }));
                }
            }, heartbeatInterval);

            if (lanyardSocket.readyState === WebSocket.OPEN) {
                lanyardSocket.send(JSON.stringify({
                    op: 2,
                    d: { subscribe_to_id: DISCORD_USER_ID }
                }));
            }
            return;
        }

        if (payload.op !== 0 || !payload.d) {
            return;
        }

        const eventType = payload.t;
        if (eventType === 'INIT_STATE' && payload.d[DISCORD_USER_ID]) {
            renderDiscordProfile(payload.d[DISCORD_USER_ID]);
            return;
        }

        if (eventType === 'PRESENCE_UPDATE' || eventType === 'PRESENCE_UPDATE_V1') {
            const userPayload = payload.d?.discord_user || payload.d?.activities ? payload.d : null;
            if (userPayload) {
                renderDiscordProfile(userPayload);
            }
        }
    });

    lanyardSocket.addEventListener('close', () => {
        clearLanyardSocketState();
        const reconnectDelay = Math.min(30000, 2000 * Math.max(1, lanyardReconnectAttempts + 1));
        lanyardReconnectAttempts += 1;
        if (lanyardReconnectTimer) {
            clearTimeout(lanyardReconnectTimer);
        }
        lanyardReconnectTimer = setTimeout(connectLanyardSocket, reconnectDelay);
    });

    lanyardSocket.addEventListener('error', () => {
        clearLanyardSocketState();
        if (lanyardReconnectTimer) {
            clearTimeout(lanyardReconnectTimer);
        }
        lanyardReconnectTimer = setTimeout(connectLanyardSocket, 5000);
    });
}

// Fallback - podstawowe informacje bez Lanyard
function loadFallbackProfile() {
    discordCurrentStatus = 'offline';
    if (spotifyUpdateInterval) {
        clearInterval(spotifyUpdateInterval);
        spotifyUpdateInterval = null;
    }
    if (discordElapsedInterval) {
        clearInterval(discordElapsedInterval);
        discordElapsedInterval = null;
    }
    const avatar = document.getElementById('discord-avatar');
    const usernameEl = document.getElementById('discord-username');
    const statusTextEl = document.getElementById('discord-status-text');
    const statusEl = document.getElementById('discord-status');
    const statusChipEl = document.getElementById('discord-status-chip');
    const deviceChipEl = document.getElementById('discord-device-chip');
    const activitiesContainer = document.getElementById('discord-activities');
    const customTileEl = document.getElementById('discord-custom-tile');
    const customTextEl = document.getElementById('discord-custom-text');
    const activityLabelEl = document.getElementById('discord-activity-label');
    const activityTextEl = document.getElementById('discord-activity-text');
    
    // Avatar - uĹĽyj domyĹ›lnego lub sprĂłbuj pobraÄ‡ z Discord CDN
    if (avatar) {
        // SprĂłbuj pobraÄ‡ avatar z Discord CDN (moĹĽe nie dziaĹ‚aÄ‡ bez peĹ‚nego ID)
        avatar.src = `https://cdn.discordapp.com/embed/avatars/${parseInt(DISCORD_USER_ID) % 5}.png`;
        avatar.alt = DISCORD_USERNAME;
    }
    
    // Username
    if (usernameEl) {
        usernameEl.textContent = `@${DISCORD_USERNAME}`;
    }
    
    // Status - zawsze offline w fallback
    if (statusEl) {
        statusEl.className = 'status-indicator offline';
    }
    
    if (statusTextEl) {
        statusTextEl.textContent = getDiscordCurrentLabel('offline');
    }

    if (statusChipEl) {
        statusChipEl.textContent = DISCORD_STATUS_TEXT.offline;
    }

    if (deviceChipEl) {
        deviceChipEl.innerHTML = '<i class="fas fa-desktop"></i>';
        deviceChipEl.title = 'No active device';
    }

    if (customTileEl) {
        customTileEl.hidden = true;
    }

    if (customTextEl) {
        customTextEl.textContent = '';
    }

    if (activityLabelEl) {
        activityLabelEl.textContent = 'CURRENTLY OFFLINE';
    }

    if (activityTextEl) {
        activityTextEl.textContent = 'No active apps detected - probably chilling';
    }
    
    // AktywnoĹ›ci - komunikat
    if (activitiesContainer) {
        activitiesContainer.innerHTML = `
            <div class="activity-placeholder">
                <p style="margin-bottom: 8px; color: #aaa; font-size: 13px;">Enable Discord presence via Lanyard</p>
                <p style="font-size: 11px; color: #666; margin-bottom: 12px;">Join the Lanyard Discord server to display live status</p>
                <a class="activity-button" href="https://discord.gg/lanyard" target="_blank" rel="noopener noreferrer">discord.gg/lanyard</a>
            </div>
        `;
    }
}

function calculateProgress(timestamps) {
    if (!timestamps.start || !timestamps.end) return 0;
    const now = Date.now();
    const start = timestamps.start;
    const end = timestamps.end;
    const total = end - start;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

function formatTime(timestamp) {
    if (!timestamp) return '0:00';
    const date = new Date(timestamp);
    const totalSeconds = Math.floor(date.getTime() / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function formatDuration(start, end) {
    if (!start || !end) return '0:00';
    const totalSeconds = Math.floor((end - start) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function formatElapsed(start) {
    if (!start) return '0:00';
    const totalSeconds = Math.floor((Date.now() - start) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Funkcja do aktualizacji Spotify w czasie rzeczywistym
function startSpotifyRealTimeUpdate(timestamps) {
    if (!timestamps.start || !timestamps.end) return;
    
    // Zatrzymaj poprzedni interval jeĹ›li istnieje
    if (spotifyUpdateInterval) {
        clearInterval(spotifyUpdateInterval);
        spotifyUpdateInterval = null;
    }
    
    // Aktualizuj co sekundÄ™
    spotifyUpdateInterval = setInterval(() => {
        const progressBar = document.getElementById('spotify-progress-bar');
        const currentTimeEl = document.getElementById('spotify-current-time');
        const durationEl = document.getElementById('spotify-duration');
        
        if (!progressBar || !currentTimeEl || !durationEl) {
            if (spotifyUpdateInterval) {
                clearInterval(spotifyUpdateInterval);
                spotifyUpdateInterval = null;
            }
            return;
        }
        
        const now = Date.now();
        const start = timestamps.start;
        const end = timestamps.end;
        const total = end - start;
        const elapsed = now - start;
        const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
        
        progressBar.style.width = progress + '%';
        currentTimeEl.textContent = formatElapsed(start);
        durationEl.textContent = formatDuration(start, end);
        
        // JeĹ›li utwĂłr siÄ™ skoĹ„czyĹ‚, zatrzymaj aktualizacjÄ™
        if (now >= end) {
            if (spotifyUpdateInterval) {
                clearInterval(spotifyUpdateInterval);
                spotifyUpdateInterval = null;
            }
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', async function() {
    await loadContentConfig();
    optimizeStaticMediaLoading();

    const redirectOverlay = document.getElementById('external-redirect-overlay');
    if (redirectOverlay) {
        redirectOverlay.addEventListener('click', (e) => {
            if (e.target === redirectOverlay) {
                cancelExternalRedirect();
            }
        });
    }

    const settingsOverlay = document.getElementById('settings-overlay');
    if (settingsOverlay) {
        settingsOverlay.addEventListener('click', (e) => {
            if (e.target === settingsOverlay) {
                closeSettings();
            }
        });
    }

    const welcomeGuideOverlay = document.getElementById('welcome-guide-overlay');
    if (welcomeGuideOverlay) {
        welcomeGuideOverlay.addEventListener('click', (e) => {
            if (e.target === welcomeGuideOverlay) {
                closeWelcomeGuide(true);
            }
        });
    }

    const welcomeTourOverlay = document.getElementById('welcome-tour-overlay');
    if (welcomeTourOverlay) {
        welcomeTourOverlay.addEventListener('click', (e) => {
            if (e.target === welcomeTourOverlay) {
                closeWelcomeTour();
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            cancelExternalRedirect();
            closeWelcomeTour();
            closeWelcomeGuide(true);
            closeSettings();
            closePlaylistOverlay();
            closeProjectDetails();
            return;
        }

        handleGlobalShortcut(e);
    });

    cursorsys.init();
    if (settings.theme !== 'light') {
        seedAmbientStars();
    }
    initNameChanger();
    renderProjectsSection();
    initMusicPlayer();
    initFavoritesWidget();
    initProjectsSearch();
    initAboutSearch();
    initSkillsSearch();
    initWorkAvailabilityStatus();
    initAboutFacts();
    initProjectDetailsOverlay();
    initDeferredHomeObservers();
    checkIfReadyToWakeup();
    initSiteNotice();
    initCoreUIBindings();
    initSettingsCategories();
    initShortcutSettings();
    applySettings();
    initScrollReveal(true);
    document.addEventListener('visibilitychange', () => {
        syncStarfieldState();
    });

    // Decode obfuscated email.
    const emailElement = document.getElementById('email');
    if (emailElement) {
        emailElement.textContent = atob(emailElement.textContent);
    }

    // Configure email link target.
    const emailLink = document.getElementById('contact-email-link');
    if (emailLink && emailElement) {
        const decodedEmail = emailElement.textContent;
        emailLink.href = `https://mail.google.com/mail/?view=cm&fs=1&to=${decodedEmail}`;
    }

    const initialPageFromHash = window.location.hash ? window.location.hash.replace('#', '').toLowerCase() : '';
    const initialPageElement = initialPageFromHash ? document.getElementById(initialPageFromHash) : null;
    showpage(initialPageElement && initialPageElement.classList.contains('container') ? initialPageFromHash : 'home');

    window.addEventListener('hashchange', () => {
        const requestedPage = window.location.hash ? window.location.hash.replace('#', '').toLowerCase() : 'home';
        if (!requestedPage || requestedPage === currentpage) {
            return;
        }

        const targetPage = document.getElementById(requestedPage);
        if (targetPage && targetPage.classList.contains('container')) {
            showpage(requestedPage);
        }
    });

    // Onboarding now starts only after the user explicitly clears the initial loading overlay.
    const muteToggle = document.getElementById('setting-mute');
    const volumeRange = document.getElementById('setting-volume');
    const themeToggle = document.getElementById('setting-theme');
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

    if (muteToggle) {
        muteToggle.addEventListener('change', (e) => {
            settings.mute = e.target.checked;
            saveSettings();
            applySettings();
        });
    }

    if (volumeRange) {
        volumeRange.addEventListener('input', (e) => {
            const value = Number(e.target.value);
            settings.volume = Math.max(0, Math.min(1, value / 100));
            saveSettings();
            applyAudioSettings();
        });
    }

    if (cursorToggle) {
        cursorToggle.addEventListener('change', (e) => {
            settings.cursorEnabled = e.target.checked;
            saveSettings();
            applySettings();
        });
    }

    if (themeToggle) {
        Array.from(themeToggle.querySelectorAll('[data-theme-value]')).forEach((button) => {
            button.addEventListener('click', () => {
                const nextTheme = button.getAttribute('data-theme-value') === 'light' ? 'light' : 'dark';
                if (settings.theme === nextTheme) return;
                settings.theme = nextTheme;
                saveSettings();
                applySettings();
            });
        });
    }

    if (confirmToggle) {
        confirmToggle.addEventListener('change', (e) => {
            settings.confirmExternal = e.target.checked;
            saveSettings();
            syncSettingsUI();
        });
    }

    if (floatingPlayerToggle) {
        floatingPlayerToggle.addEventListener('change', (e) => {
            settings.floatingPlayerEnabled = e.target.checked;
            if (e.target.checked) {
                miniPlayerDismissed = false;
            }
            saveSettings();
            applySettings();
        });
    }

    if (snapAssistToggle) {
        snapAssistToggle.addEventListener('change', (e) => {
            settings.miniPlayerSnapAssist = e.target.checked;
            saveSettings();
            applySettings();
        });
    }

    if (reduceMotionToggle) {
        reduceMotionToggle.addEventListener('change', (e) => {
            settings.reduceMotion = e.target.checked;
            saveSettings();
            applySettings();
        });
    }

    if (highContrastToggle) {
        highContrastToggle.addEventListener('change', (e) => {
            settings.highContrast = e.target.checked;
            saveSettings();
            applySettings();
        });
    }

    if (largeTextToggle) {
        largeTextToggle.addEventListener('change', (e) => {
            settings.largeText = e.target.checked;
            saveSettings();
            applySettings();
        });
    }

    if (focusToggle) {
        focusToggle.addEventListener('change', (e) => {
            settings.focusOutlines = e.target.checked;
            saveSettings();
            applySettings();
        });
    }

    if (dyslexiaFontToggle) {
        dyslexiaFontToggle.addEventListener('change', (e) => {
            settings.dyslexiaFont = e.target.checked;
            saveSettings();
            applySettings();
        });
    }

    if (performanceToggle) {
        performanceToggle.addEventListener('change', (e) => {
            settings.performanceMode = e.target.checked;
            saveSettings();
            applySettings();
        });
    }

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href || href === '#' || href.startsWith('javascript:')) return;
        if (link.dataset.noConfirm === 'true') return;

        if (href.startsWith('#')) return;

        let url;
        try {
            url = new URL(href, window.location.href);
        } catch {
            return;
        }

        const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
        const isExternal = url.origin !== window.location.origin;

        if (!isHttp || !isExternal) return;
        if (!settings.confirmExternal) return;

        e.preventDefault();
        openExternalRedirect(url.href, link.getAttribute('target'));
    });

    setTimeout(revealWakeupOverlay, 450);
});
