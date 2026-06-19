function updateDocumentTitle(page = currentpage) {
    const base = pageTitles.base || 'Nozer';
    const sectionTitle = pageTitles[page] || 'Home';
    document.title = page === 'home' ? base : `${sectionTitle} | ${base}`;
}

function initNameChanger() {
    const nameElement = document.getElementById('changing-name');
    if (!nameElement || !names.length) return;

    nameElement.classList.add('typewriter');
    if (nameTypewriterTimeout) {
        clearTimeout(nameTypewriterTimeout);
        nameTypewriterTimeout = null;
    }

    let deleting = false;
    let charIndex = 0;
    currentNameIndex = 0;

    const tick = () => {
        if (!names.length) return;
        const fullText = names[currentNameIndex] || '';

        if (settings.reduceMotion) {
            nameElement.textContent = fullText;
            currentNameIndex = (currentNameIndex + 1) % names.length;
            nameTypewriterTimeout = setTimeout(tick, 1900);
            return;
        }

        if (!deleting) {
            charIndex = Math.min(fullText.length, charIndex + 1);
            nameElement.textContent = fullText.slice(0, charIndex);
            if (charIndex >= fullText.length) {
                deleting = true;
                nameTypewriterTimeout = setTimeout(tick, 1100);
                return;
            }
            nameTypewriterTimeout = setTimeout(tick, 85);
            return;
        }

        charIndex = Math.max(0, charIndex - 1);
        nameElement.textContent = fullText.slice(0, charIndex);
        if (charIndex <= 0) {
            deleting = false;
            currentNameIndex = (currentNameIndex + 1) % names.length;
            nameTypewriterTimeout = setTimeout(tick, 220);
            return;
        }
        nameTypewriterTimeout = setTimeout(tick, 45);
    };

    nameElement.textContent = '';
    tick();
}

function getTargetMusicVolume() {
    if (settings.mute) return 0;
    return Math.max(0, Math.min(1, settings.volume));
}

function clampUnit(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(1, numeric));
}

function cancelMusicFade() {
    if (musicFadeFrame !== null) {
        cancelAnimationFrame(musicFadeFrame);
        musicFadeFrame = null;
    }
}

function fadeMusicVolume(targetVolume, duration = 220) {
    return new Promise((resolve) => {
        if (!musicAudio) {
            resolve();
            return;
        }

        cancelMusicFade();
        const startVolume = clampUnit(musicAudio.volume);
        const target = clampUnit(targetVolume);
        if (duration <= 0 || Math.abs(startVolume - target) < 0.005) {
            musicAudio.volume = target;
            resolve();
            return;
        }

        const start = performance.now();
        const step = (now) => {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const nextVolume = startVolume + (target - startVolume) * eased;
            musicAudio.volume = clampUnit(nextVolume);

            if (progress < 1) {
                musicFadeFrame = requestAnimationFrame(step);
                return;
            }

            musicAudio.volume = target;
            musicFadeFrame = null;
            resolve();
        };

        musicFadeFrame = requestAnimationFrame(step);
    });
}

async function playCurrentTrackWithFade() {
    if (!musicAudio || !musicAudio.src) return;

    const finalVolume = getTargetMusicVolume();
    const shouldFade = !settings.reduceMotion && !settings.performanceMode && finalVolume > 0;

    cancelMusicFade();
    if (shouldFade) {
        musicAudio.volume = 0;
    } else {
        musicAudio.volume = finalVolume;
    }

    try {
        await musicAudio.play();
        isMusicPlaying = true;
        updatePlayPauseButton();
        if (shouldFade) {
            await fadeMusicVolume(finalVolume, 230);
        }
    } catch (error) {
        console.log('Autoplay blocked:', error);
        isMusicPlaying = false;
        updatePlayPauseButton();
    }
}

async function pauseCurrentTrackWithFade() {
    if (!musicAudio || !isMusicPlaying) return;
    const shouldFade = !settings.reduceMotion && !settings.performanceMode;

    if (shouldFade) {
        await fadeMusicVolume(0, 170);
    }

    musicAudio.pause();
    musicAudio.volume = getTargetMusicVolume();
    isMusicPlaying = false;
    updatePlayPauseButton();
}

async function switchTrack(trackIndex) {
    if (!musicAudio) return;
    const shouldResume = isMusicPlaying;

    if (shouldResume && !settings.reduceMotion && !settings.performanceMode) {
        await fadeMusicVolume(0, 130);
    }

    loadTrack(trackIndex, { preservePlayingState: shouldResume });

    if (shouldResume) {
        await playCurrentTrackWithFade();
    } else {
        musicAudio.volume = getTargetMusicVolume();
        updatePlayPauseButton();
    }
}

function getRandomInitialTrackIndex() {
    if (!Array.isArray(musicTracks) || musicTracks.length === 0) return 0;
    return Math.floor(Math.random() * musicTracks.length);
}

const MUSIC_COVER_FALLBACK = 'icons/icon.png';

function getTrackCover(track) {
    return track?.image || MUSIC_COVER_FALLBACK;
}

function setMusicCoverImage(element, track) {
    if (!element) return;
    const cover = getTrackCover(track);
    element.onerror = () => {
        if (element.src.endsWith(MUSIC_COVER_FALLBACK)) return;
        element.onerror = null;
        element.src = MUSIC_COVER_FALLBACK;
    };
    element.src = cover;
}

function initMusicPlayer() {
    musicAudio = document.getElementById('music-audio');
    if (!musicAudio) return;
    
    loadTrack(getRandomInitialTrackIndex());
    initMiniMusicPlayer();
    initPlaylistOverlay();
    initMusicPlayerVisibilityObserver();
    
    const volumeRange = document.getElementById('music-volume-range');
    if (volumeRange) {
        volumeRange.value = Math.round(settings.volume * 100);
        volumeRange.addEventListener('input', (e) => {
            const value = Number(e.target.value);
            settings.volume = Math.max(0, Math.min(1, value / 100));
            saveSettings();
            applyAudioSettings();
        });
    }

    musicAudio.addEventListener('timeupdate', updateMusicProgress);
    musicAudio.addEventListener('loadedmetadata', updateMusicProgress);
    musicAudio.addEventListener('ended', () => {
        nextTrack();
    });

    const musicProgressContainer = document.querySelector('.music-progress-container');
    if (musicProgressContainer) {
        initSeekInteractions(musicProgressContainer);
    }

    const miniProgressContainer = document.querySelector('.mini-player-progress');
    if (miniProgressContainer) {
        initSeekInteractions(miniProgressContainer);
    }
}

let activeSeekSession = null;

function getSeekRatioFromEvent(event, target) {
    if (!target) return 0;
    const rect = target.getBoundingClientRect();
    if (!rect.width) return 0;
    const pointerX = typeof event.clientX === 'number' ? event.clientX : rect.left;
    return Math.min(Math.max((pointerX - rect.left) / rect.width, 0), 1);
}

function applySeekFromEvent(event, target) {
    if (!musicAudio || !musicAudio.duration || !target) return;
    const ratio = getSeekRatioFromEvent(event, target);
    musicAudio.currentTime = ratio * musicAudio.duration;
    updateMusicProgress();
}

function initSeekInteractions(container) {
    if (!container) return;
    container.addEventListener('pointerdown', startSeekDrag);
}

function startSeekDrag(event) {
    if (!musicAudio || !musicAudio.duration) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const target = event.currentTarget;
    event.preventDefault();

    stopSeekDrag();
    activeSeekSession = {
        pointerId: event.pointerId,
        target
    };

    if (target.setPointerCapture) {
        target.setPointerCapture(event.pointerId);
    }

    document.addEventListener('pointermove', dragSeek);
    document.addEventListener('pointerup', stopSeekDrag);
    document.addEventListener('pointercancel', stopSeekDrag);
    applySeekFromEvent(event, target);
}

function dragSeek(event) {
    if (!activeSeekSession || event.pointerId !== activeSeekSession.pointerId) return;
    applySeekFromEvent(event, activeSeekSession.target);
}

function stopSeekDrag(event) {
    if (event && activeSeekSession && event.pointerId !== activeSeekSession.pointerId) return;

    if (event && activeSeekSession) {
        applySeekFromEvent(event, activeSeekSession.target);
    }

    if (activeSeekSession && activeSeekSession.target && event && activeSeekSession.target.releasePointerCapture) {
        if (activeSeekSession.target.hasPointerCapture && activeSeekSession.target.hasPointerCapture(event.pointerId)) {
            activeSeekSession.target.releasePointerCapture(event.pointerId);
        }
    }

    activeSeekSession = null;
    document.removeEventListener('pointermove', dragSeek);
    document.removeEventListener('pointerup', stopSeekDrag);
    document.removeEventListener('pointercancel', stopSeekDrag);
}

function loadTrack(trackIndex, options = {}) {
    const { preservePlayingState = false } = options;
    if (trackIndex < 0) trackIndex = musicTracks.length - 1;
    if (trackIndex >= musicTracks.length) trackIndex = 0;
    
    currentMusicTrack = trackIndex;
    const track = musicTracks[trackIndex];
    if (!track || !musicAudio) return;
    miniPlayerDismissed = false;
    
    musicAudio.src = track.file;
    document.getElementById('music-title').textContent = track.name;
    setMusicCoverImage(document.getElementById('music-album-art'), track);
    document.getElementById('music-artist').textContent = track.artist;
    syncMiniMusicPlayerMeta();
    
    if (!preservePlayingState) {
        isMusicPlaying = false;
    }
    updatePlayPauseButton();
    updateMusicProgress();
    updateMusicTrackIndicators();
    renderPlaylistItems();
}

async function togglePlayPause() {
    if (!musicAudio.src) return;
    
    if (isMusicPlaying) {
        await pauseCurrentTrackWithFade();
    } else {
        await playCurrentTrackWithFade();
    }
}

function updatePlayPauseButton() {
    const btn = document.getElementById('play-pause-btn');
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = isMusicPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
    }

    const miniBtn = document.getElementById('mini-player-play-btn');
    if (miniBtn) {
        const miniIcon = miniBtn.querySelector('i');
        if (miniIcon) {
            miniIcon.className = isMusicPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
    }

    renderPlaylistItems();
}

async function nextTrack() {
    await switchTrack(currentMusicTrack + 1);
}

async function previousTrack() {
    await switchTrack(currentMusicTrack - 1);
}

function updateMusicProgress() {
    if (!musicAudio) return;
    
    const fill = document.getElementById('music-progress-fill');
    const currentTimeEl = document.getElementById('music-current-time');
    const durationEl = document.getElementById('music-duration');
    const miniFill = document.getElementById('mini-player-progress-fill');
    
    const currentTime = musicAudio.currentTime || 0;
    const duration = musicAudio.duration || 0;
    
    if (duration > 0) {
        const percent = (currentTime / duration) * 100;
        if (fill) fill.style.width = percent + '%';
        if (miniFill) miniFill.style.width = percent + '%';
    } else {
        if (fill) fill.style.width = '0%';
        if (miniFill) miniFill.style.width = '0%';
    }
    
    if (currentTimeEl) currentTimeEl.textContent = formatMusicTime(currentTime);
    if (durationEl) durationEl.textContent = formatMusicTime(duration);
}

function updateMusicTrackIndicators() {
    const totalTracks = musicTracks.length || 0;
    const currentTrackNumber = totalTracks ? currentMusicTrack + 1 : 0;
    const slotEl = document.getElementById('music-slot-indicator');
    const playlistCountEl = document.getElementById('playlist-summary-count');

    if (slotEl) slotEl.textContent = `${currentTrackNumber}/${totalTracks}`;
    if (playlistCountEl) playlistCountEl.textContent = `${currentTrackNumber} of ${totalTracks}`;
}

function syncMiniMusicPlayerMeta() {
    const track = musicTracks[currentMusicTrack];
    if (!track) return;

    const titleEl = document.getElementById('mini-player-title');
    const artistEl = document.getElementById('mini-player-artist');
    const artEl = document.getElementById('mini-player-art');
    const playlistTitleEl = document.getElementById('playlist-summary-title');
    const playlistArtistEl = document.getElementById('playlist-summary-artist');
    const playlistArtEl = document.getElementById('playlist-summary-art');

    if (titleEl) titleEl.textContent = track.name;
    if (artistEl) artistEl.textContent = track.artist;
    setMusicCoverImage(artEl, track);
    if (playlistTitleEl) playlistTitleEl.textContent = track.name;
    if (playlistArtistEl) playlistArtistEl.textContent = track.artist;
    setMusicCoverImage(playlistArtEl, track);
    updateMusicTrackIndicators();
    renderPlaylistItems();
}

function renderPlaylistItems() {
    const list = document.getElementById('playlist-list');
    if (!list) return;

    list.innerHTML = '';
    musicTracks.forEach((track, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `playlist-item ${index === currentMusicTrack ? 'active' : ''}`;
        button.innerHTML = `
            <span class="playlist-item-order">${index + 1}</span>
            <img src="${escapeHtml(getTrackCover(track))}" alt="${escapeHtml(track.name)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${MUSIC_COVER_FALLBACK}';">
            <span class="playlist-item-meta">
                <strong>${escapeHtml(track.name)}</strong>
                <small>${escapeHtml(track.artist)}</small>
            </span>
            <span class="playlist-item-state">${index === currentMusicTrack ? (isMusicPlaying ? 'Playing' : 'Selected') : 'Queue'}</span>
        `;
        button.addEventListener('click', async () => {
            if (index === currentMusicTrack && isMusicPlaying) {
                await togglePlayPause();
                return;
            }
            await switchTrack(index);
            if (!isMusicPlaying) {
                await playCurrentTrackWithFade();
            }
        });
        list.appendChild(button);
    });
    updateMusicTrackIndicators();
}

function openPlaylistOverlay() {
    const overlay = document.getElementById('playlist-overlay');
    const modal = overlay ? overlay.querySelector('.playlist-modal') : null;
    if (!overlay || !modal) return;
    renderPlaylistItems();
    activateModal(overlay, modal, '.playlist-close');
}

function closePlaylistOverlay() {
    const overlay = document.getElementById('playlist-overlay');
    if (overlay) deactivateModal(overlay);
}

function initPlaylistOverlay() {
    const playlistOpenMainBtn = document.getElementById('music-playlist-btn');
    const playlistOpenMiniBtn = document.getElementById('mini-player-playlist');
    const overlay = document.getElementById('playlist-overlay');

    if (playlistOpenMainBtn) {
        playlistOpenMainBtn.addEventListener('click', openPlaylistOverlay);
    }
    if (playlistOpenMiniBtn) {
        playlistOpenMiniBtn.addEventListener('click', openPlaylistOverlay);
    }
    if (overlay) {
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closePlaylistOverlay();
            }
        });
    }
}

function updateMiniMusicPlayerVisibility() {
    const miniPlayer = document.getElementById('mini-music-player');
    if (!miniPlayer) return;

    const hasPlayableTrack = !!(musicAudio && musicTracks.length && musicAudio.src);
    const shouldShow = settings.floatingPlayerEnabled && !miniPlayerDismissed && hasPlayableTrack && (currentpage !== 'home' || !isMainPlayerVisible);
    miniPlayer.classList.toggle('visible', shouldShow);
    document.body.classList.toggle('mini-player-visible', shouldShow);
}

function initMiniMusicPlayer() {
    const miniPlayer = document.getElementById('mini-music-player');
    if (!miniPlayer) return;

    const closeBtn = document.getElementById('mini-player-close');
    miniPlayer.classList.toggle('collapsed', !!settings.miniPlayerCollapsed);

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            miniPlayerDismissed = true;
            updateMiniMusicPlayerVisibility();
        });
    }

    const miniMain = miniPlayer.querySelector('.mini-player-main');
    if (miniMain) {
        miniMain.addEventListener('click', togglePlayPause);
    }

    miniPlayer.querySelectorAll('button, input, a').forEach((element) => {
        element.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    });

    const miniVolumeRange = document.getElementById('mini-player-volume-range');
    const miniVolumeRangeCompact = document.getElementById('mini-player-volume-range-compact');
    const handleVolumeInput = (event) => {
        const value = Number(event.target.value);
        settings.volume = Math.max(0, Math.min(1, value / 100));
        saveSettings();
        applyAudioSettings();
    };

    if (miniVolumeRange) {
        miniVolumeRange.value = Math.round(settings.volume * 100);
        miniVolumeRange.addEventListener('input', handleVolumeInput);
    }

    if (miniVolumeRangeCompact) {
        miniVolumeRangeCompact.value = Math.round(settings.volume * 100);
        miniVolumeRangeCompact.addEventListener('input', handleVolumeInput);
    }

    syncMiniMusicPlayerMeta();
    updatePlayPauseButton();
    updateMusicProgress();
    keepMiniPlayerInViewport({ resetOnMobile: true });
    if (window.matchMedia('(min-width: 769px) and (pointer: fine)').matches) {
        initMiniMusicPlayerDrag();
    }
    updateMiniMusicPlayerVisibility();
}

function keepMiniPlayerInViewport(options = {}) {
    const { resetOnMobile = false } = options;
    const miniPlayer = document.getElementById('mini-music-player');
    if (!miniPlayer) return;

    const isDesktopDragMode = window.matchMedia('(min-width: 769px) and (pointer: fine)').matches;
    if (resetOnMobile && !isDesktopDragMode) {
        miniPlayer.style.left = '';
        miniPlayer.style.top = '';
        miniPlayer.style.right = '';
        miniPlayer.style.bottom = '';
        return;
    }

    const rect = miniPlayer.getBoundingClientRect();
    const hasCustomPosition = miniPlayer.style.left !== '' || miniPlayer.style.top !== '';
    if (!hasCustomPosition) return;

    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxY = Math.max(margin, window.innerHeight - rect.height - margin);

    const nextX = Math.min(maxX, Math.max(margin, rect.left));
    const nextY = Math.min(maxY, Math.max(margin, rect.top));

    miniPlayer.style.left = `${Math.round(nextX)}px`;
    miniPlayer.style.top = `${Math.round(nextY)}px`;
    miniPlayer.style.right = 'auto';
    miniPlayer.style.bottom = 'auto';
}

function initMiniMusicPlayerDrag() {
    const miniPlayer = document.getElementById('mini-music-player');
    const dragHandle = miniPlayer ? miniPlayer.querySelector('.mini-player-header') : null;
    if (!miniPlayer || !dragHandle) return;
    // keep dragging limited to fine-pointer desktop devices to avoid interfering with touch
    if (!window.matchMedia('(min-width: 769px) and (pointer: fine)').matches) return;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let pointerLastX = 0;
    let pointerLastY = 0;
    let pointerLastTs = 0;
    let inertiaFrame = null;
    let snapGhostEl = null;
    let nearestDock = null;
    let snapClassTimeout = null;

    const clearSnapAnimation = () => {
        if (snapClassTimeout) {
            clearTimeout(snapClassTimeout);
            snapClassTimeout = null;
        }
        miniPlayer.classList.remove('snapping');
    };

    const animateSnap = () => {
        clearSnapAnimation();
        if (settings.reduceMotion || settings.performanceMode) return;
        miniPlayer.classList.add('snapping');
        snapClassTimeout = setTimeout(() => {
            miniPlayer.classList.remove('snapping');
            snapClassTimeout = null;
        }, 260);
    };

    const getDockPoints = (width, height) => {
        const margin = 10;
        const maxX = Math.max(margin, window.innerWidth - width - margin);
        const maxY = Math.max(margin, window.innerHeight - height - margin);
        const midX = Math.round((window.innerWidth - width) / 2);
        const midY = Math.round((window.innerHeight - height) / 2);

        return [
            { key: 'top-left', x: margin, y: margin },
            { key: 'top-center', x: midX, y: margin },
            { key: 'top-right', x: maxX, y: margin },
            { key: 'middle-left', x: margin, y: midY },
            { key: 'middle-right', x: maxX, y: midY },
            { key: 'bottom-left', x: margin, y: maxY },
            { key: 'bottom-center', x: midX, y: maxY },
            { key: 'bottom-right', x: maxX, y: maxY }
        ];
    };

    const ensureSnapGhost = () => {
        if (snapGhostEl && snapGhostEl.isConnected) return snapGhostEl;
        snapGhostEl = document.createElement('div');
        snapGhostEl.className = 'mini-player-snap-ghost';
        document.body.appendChild(snapGhostEl);
        return snapGhostEl;
    };

    const hideSnapGhost = () => {
        const ghost = ensureSnapGhost();
        ghost.classList.remove('visible', 'strong');
        ghost.style.opacity = '0';
    };

    const updateSnapGhost = () => {
        if (!settings.miniPlayerSnapAssist) {
            hideSnapGhost();
            nearestDock = null;
            return;
        }

        const rect = miniPlayer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const docks = getDockPoints(rect.width, rect.height);
        const ghost = ensureSnapGhost();

        nearestDock = docks[0];
        let nearestDist = Number.POSITIVE_INFINITY;
        docks.forEach((dock) => {
            const dockCenterX = dock.x + rect.width / 2;
            const dockCenterY = dock.y + rect.height / 2;
            const dist = Math.hypot(centerX - dockCenterX, centerY - dockCenterY);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestDock = dock;
            }
        });

        ghost.style.width = `${Math.round(rect.width)}px`;
        ghost.style.height = `${Math.round(rect.height)}px`;
        ghost.style.left = `${Math.round(nearestDock.x)}px`;
        ghost.style.top = `${Math.round(nearestDock.y)}px`;
        ghost.classList.add('visible');
        // make the snap ghost more forgiving on close approach
        ghost.classList.toggle('strong', nearestDist <= 120);
        ghost.style.opacity = nearestDist <= 200 ? '1' : '0.45';
    };

    const snapIfCloseEnough = () => {
        if (!settings.miniPlayerSnapAssist || !nearestDock) return false;
        const rect = miniPlayer.getBoundingClientRect();
        const currentCenterX = rect.left + rect.width / 2;
        const currentCenterY = rect.top + rect.height / 2;
        const dockCenterX = nearestDock.x + rect.width / 2;
        const dockCenterY = nearestDock.y + rect.height / 2;
        const distance = Math.hypot(currentCenterX - dockCenterX, currentCenterY - dockCenterY);
        // slightly larger threshold so the player snaps more eagerly
        if (distance > 120) return false;
        animateSnap();
        miniPlayer.style.left = `${Math.round(nearestDock.x)}px`;
        miniPlayer.style.top = `${Math.round(nearestDock.y)}px`;
        miniPlayer.style.right = 'auto';
        miniPlayer.style.bottom = 'auto';
        return true;
    };

    const snapToNearestDock = () => {
        const rect = miniPlayer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const docks = getDockPoints(rect.width, rect.height);

        let closest = docks[0];
        let closestDist = Number.POSITIVE_INFINITY;

        docks.forEach((dock) => {
            const dockCenterX = dock.x + rect.width / 2;
            const dockCenterY = dock.y + rect.height / 2;
            const dx = centerX - dockCenterX;
            const dy = centerY - dockCenterY;
            const dist = Math.hypot(dx, dy);
            if (dist < closestDist) {
                closestDist = dist;
                closest = dock;
            }
        });

        animateSnap();
        miniPlayer.style.left = `${Math.round(closest.x)}px`;
        miniPlayer.style.top = `${Math.round(closest.y)}px`;
        miniPlayer.style.right = 'auto';
        miniPlayer.style.bottom = 'auto';
    };

    const stopInertia = () => {
        if (inertiaFrame !== null) {
            cancelAnimationFrame(inertiaFrame);
            inertiaFrame = null;
        }
    };

    const runInertia = () => {
        if (settings.reduceMotion || settings.performanceMode) {
            snapIfCloseEnough();
            return;
        }

        const friction = 0.94;
        const minSpeed = 0.05;
        const bounce = 0.75;

        const step = () => {
            const rect = miniPlayer.getBoundingClientRect();
            const maxX = Math.max(0, window.innerWidth - rect.width);
            const maxY = Math.max(0, window.innerHeight - rect.height);

            let nextX = rect.left + velocityX;
            let nextY = rect.top + velocityY;

            if (nextX <= 0) {
                nextX = 0;
                velocityX = Math.abs(velocityX) * bounce;
            } else if (nextX >= maxX) {
                nextX = maxX;
                velocityX = -Math.abs(velocityX) * bounce;
            }

            if (nextY <= 0) {
                nextY = 0;
                velocityY = Math.abs(velocityY) * bounce;
            } else if (nextY >= maxY) {
                nextY = maxY;
                velocityY = -Math.abs(velocityY) * bounce;
            }

            miniPlayer.style.left = `${nextX}px`;
            miniPlayer.style.top = `${nextY}px`;
            miniPlayer.style.right = 'auto';
            miniPlayer.style.bottom = 'auto';

            velocityX *= friction;
            velocityY *= friction;

            if (Math.abs(velocityX) < minSpeed && Math.abs(velocityY) < minSpeed) {
                stopInertia();
                snapIfCloseEnough();
                return;
            }

            inertiaFrame = requestAnimationFrame(step);
        };

        stopInertia();
        inertiaFrame = requestAnimationFrame(step);
    };

    const onPointerMove = (event) => {
        if (!isDragging) return;

        const maxX = Math.max(0, window.innerWidth - miniPlayer.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - miniPlayer.offsetHeight);
        const nextX = Math.min(maxX, Math.max(0, event.clientX - offsetX));
        const nextY = Math.min(maxY, Math.max(0, event.clientY - offsetY));

        miniPlayer.style.left = `${nextX}px`;
        miniPlayer.style.top = `${nextY}px`;
        miniPlayer.style.right = 'auto';
        miniPlayer.style.bottom = 'auto';

        const now = performance.now();
        const dt = Math.max(1, now - pointerLastTs);
        const dx = event.clientX - pointerLastX;
        const dy = event.clientY - pointerLastY;
        const smooth = 0.3;
        velocityX = velocityX * (1 - smooth) + (dx / dt) * smooth * 16;
        velocityY = velocityY * (1 - smooth) + (dy / dt) * smooth * 16;
        pointerLastX = event.clientX;
        pointerLastY = event.clientY;
        pointerLastTs = now;
        updateSnapGhost();
    };

    const onPointerUp = (event) => {
        if (!isDragging) return;
        isDragging = false;
        miniPlayer.classList.remove('dragging');
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        if (event && dragHandle.hasPointerCapture && dragHandle.hasPointerCapture(event.pointerId)) {
            dragHandle.releasePointerCapture(event.pointerId);
        }
        hideSnapGhost();
        runInertia();
    };

    dragHandle.addEventListener('pointerdown', (event) => {
        const isInteractive = event.target.closest('button, input, a, .mini-player-header-actions');
        if (isInteractive) return;

        event.preventDefault();
        stopInertia();
        clearSnapAnimation();
        isDragging = true;
        const rect = miniPlayer.getBoundingClientRect();
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        pointerLastX = event.clientX;
        pointerLastY = event.clientY;
        pointerLastTs = performance.now();
        velocityX = 0;
        velocityY = 0;
        miniPlayer.classList.add('dragging');
        updateSnapGhost();
        if (dragHandle.setPointerCapture) {
            dragHandle.setPointerCapture(event.pointerId);
        }
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    });

    window.addEventListener('resize', () => {
        keepMiniPlayerInViewport({ resetOnMobile: true });
        if (window.matchMedia('(min-width: 769px) and (pointer: fine)').matches && settings.miniPlayerSnapAssist) {
            snapToNearestDock();
        }
    });
}

function initMusicPlayerVisibilityObserver() {
    const playerCard = document.querySelector('.music-player-card.now-playing-card');
    if (!playerCard) return;

    if (miniMusicObserver) {
        miniMusicObserver.disconnect();
        miniMusicObserver = null;
    }

    if ('IntersectionObserver' in window) {
        miniMusicObserver = new IntersectionObserver((entries) => {
            const entry = entries[0];
            isMainPlayerVisible = entry.isIntersecting && entry.intersectionRatio > 0.35;
            updateMiniMusicPlayerVisibility();
        }, { threshold: [0, 0.35, 1] });

        miniMusicObserver.observe(playerCard);
    } else {
        const fallbackUpdate = () => {
            const rect = playerCard.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            isMainPlayerVisible = rect.top < viewportHeight * 0.65 && rect.bottom > viewportHeight * 0.25;
            updateMiniMusicPlayerVisibility();
        };

        window.addEventListener('scroll', fallbackUpdate, { passive: true });
        window.addEventListener('resize', fallbackUpdate);
        fallbackUpdate();
    }
}

