(function () {
    const config = window.THLoadscreenConfig || {};
    const fallbackImage = document.getElementById('fallback-image');
    const localVideo = document.getElementById('local-video');
    const youtubeWrap = document.getElementById('youtube-wrap');
    const title = document.getElementById('title');
    const subtitle = document.getElementById('subtitle');
    const statusText = document.getElementById('status');
    const mediaStatus = document.getElementById('media-status');
    const progressFill = document.getElementById('progress-fill');
    const controls = document.getElementById('controls');
    const prevButton = document.getElementById('prev-video');
    const nextButton = document.getElementById('next-video');
    const soundButton = document.getElementById('sound-toggle');
    const soundIcon = document.getElementById('sound-icon');
    const volumeInput = document.getElementById('volume');
    const music = document.getElementById('music');

    let youtubePlayer = null;
    let youtubeReady = false;
    let youtubePlaying = false;
    let usingLocal = false;
    let selectedIndex = 0;
    let startTimer = null;
    let apiLoading = false;
    const failedVideos = new Set();
    let softProgress = 8;
    let muted = config.startMuted !== false;
    let volume = clamp(Number(config.startVolume ?? 45), 0, 100);

    const youtubeVideos = normalizeYouTubeVideos(config.youtubeVideos);
    const localVideos = Array.isArray(config.localVideos) ? config.localVideos.filter(Boolean) : [];
    const musicTracks = Array.isArray(config.musicTracks) ? config.musicTracks.filter(Boolean) : [];

    init();

    function init() {
        title.textContent = config.welcomeText || `Welcome to ${config.serverName || 'the server'}!`;
        subtitle.textContent = config.subtitleText || 'Loading server assets';
        if (config.fallbackImage) fallbackImage.src = config.fallbackImage;
        else fallbackImage.hidden = true;
        controls.hidden = config.showControls === false;
        volumeInput.value = String(volume);
        updateSoundIcon();
        bindControls();
        bindFiveMEvents();
        startSoftProgress();
        startMusic();

        if (config.selection === 'random' && youtubeVideos.length > 1) {
            selectedIndex = Math.floor(Math.random() * youtubeVideos.length);
        }

        if (config.mode === 'local' || youtubeVideos.length === 0) {
            startLocalVideo('Local video selected');
            return;
        }

        setStatus('Starting YouTube video');
        armYouTubeTimeout();
        loadYouTubeApi();
    }

    function armYouTubeTimeout() {
        window.clearTimeout(startTimer);
        startTimer = window.setTimeout(function () {
            if (!youtubePlaying && !usingLocal) {
                onYouTubeError({ data: 'timeout' });
            }
        }, Number(config.youtubeStartTimeoutMs || 10000));
    }

    function normalizeYouTubeVideos(videos) {
        if (!Array.isArray(videos)) {
            return [];
        }

        return videos
            .map(function (entry) {
                if (typeof entry === 'string') {
                    return { label: 'YouTube', id: getYouTubeId(entry), startSeconds: 0 };
                }

                if (!entry) {
                    return null;
                }

                return {
                    label: entry.label || 'YouTube',
                    id: getYouTubeId(entry.id || entry.url || entry.link || ''),
                    startSeconds: Number(entry.startSeconds || 0),
                };
            })
            .filter(function (entry) {
                return entry && entry.id;
            });
    }

    function getYouTubeId(value) {
        const raw = String(value || '').trim();
        const directId = /^[a-zA-Z0-9_-]{11}$/;

        if (directId.test(raw)) {
            return raw;
        }

        const patterns = [
            /[?&]v=([a-zA-Z0-9_-]{11})/,
            /youtu\.be\/([a-zA-Z0-9_-]{11})/,
            /embed\/([a-zA-Z0-9_-]{11})/,
            /shorts\/([a-zA-Z0-9_-]{11})/,
            /live\/([a-zA-Z0-9_-]{11})/,
        ];

        for (const pattern of patterns) {
            const match = raw.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return '';
    }

    function loadYouTubeApi() {
        if (window.YT && window.YT.Player) {
            createYouTubePlayer();
            return;
        }

        if (apiLoading) return;
        apiLoading = true;
        window.onYouTubeIframeAPIReady = function () {
            apiLoading = false;
            createYouTubePlayer();
        };

        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = function () {
            apiLoading = false;
            window.clearTimeout(startTimer);
            const reason = 'YouTube API failed to load. Click Sound to retry.';
            showMediaError(reason);
            console.warn('[th_loadscreen] API_LOAD_FAILED', script.src, window.location.origin);
            if (config.fallbackToLocalVideo !== false && localVideos.length) startLocalVideo(reason);
        };
        document.head.appendChild(script);
    }

    function createYouTubePlayer() {
        if (!youtubeVideos.length || usingLocal || youtubePlayer || !window.YT || !window.YT.Player) {
            return;
        }

        const video = youtubeVideos[selectedIndex];
        youtubeReady = false;
        youtubePlaying = false;
        setStatus(`Loading ${video.label}`);
        // Keep YouTube's own player and error messages visible before playback.
        youtubeWrap.classList.add('is-visible');

        // Set referrer and media permissions BEFORE navigating the iframe.
        // Keep the real NUI origin; do not impersonate a hosted website.
        const frame = document.createElement('iframe');
        frame.id = 'youtube-player';
        frame.title = 'YouTube music player';
        frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        frame.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
        const origin = /^https?:$/.test(window.location.protocol) ? window.location.origin : '';
        frame.src = 'https://www.youtube-nocookie.com/embed/' + video.id
            + '?enablejsapi=1&autoplay=1&controls=1&playsinline=1&rel=0&start=' + video.startSeconds
            + (origin ? '&origin=' + encodeURIComponent(origin) : '');
        document.getElementById('youtube-player').replaceWith(frame);

        youtubePlayer = new window.YT.Player('youtube-player', {
            width: '1920',
            height: '1080',
            videoId: video.id,
            playerVars: {
                autoplay: 1,
                controls: 1,
                disablekb: 1,
                fs: 0,
                iv_load_policy: 3,
                loop: 0,
                modestbranding: 1,
                playsinline: 1,
                rel: 0,
                start: video.startSeconds,
                origin: /^https?:$/.test(window.location.protocol) ? window.location.origin : undefined,
            },
            events: {
                onReady: onYouTubeReady,
                onStateChange: onYouTubeStateChange,
                onError: onYouTubeError,
                onAutoplayBlocked: onYouTubeAutoplayBlocked,
            },
        });
    }

    function onYouTubeReady(event) {
        youtubeReady = true;
        if (usingLocal) { event.target.stopVideo(); return; }
        // Selection may have changed while the API was still loading.
        const video = youtubeVideos[selectedIndex];
        event.target.loadVideoById({ videoId: video.id, startSeconds: video.startSeconds });
        applyYouTubeAudio();
        event.target.playVideo();
    }

    function onYouTubeAutoplayBlocked() {
        if (usingLocal) return;
        window.clearTimeout(startTimer);
        if (!muted) {
            muted = true;
            applyYouTubeAudio();
            updateSoundIcon();
            youtubePlayer.playVideo();
        }
        setStatus('Click sound to start music');
    }

    function onYouTubeStateChange(event) {
        if (usingLocal) return;
        if (event.data === window.YT.PlayerState.PLAYING) {
            youtubePlaying = true;
            usingLocal = false;
            window.clearTimeout(startTimer);
            youtubeWrap.classList.add('is-visible');
            localVideo.classList.remove('is-visible');
            localVideo.pause();
            music.pause();
            showMediaError('');
            setStatus(`Playing ${youtubeVideos[selectedIndex].label}`);
            return;
        }

        if (event.data === window.YT.PlayerState.ENDED) {
            playNextVideo();
        }
    }

    function onYouTubeError(event) {
        if (usingLocal) return;
        const code = event && event.data;
        const video = youtubeVideos[selectedIndex];
        if (code === 153) {
            window.clearTimeout(startTimer);
            youtubePlaying = false;
            const reason = 'YouTube rejected this player identity (153). Changing tracks will not fix identification.';
            showMediaError(reason);
            console.warn('[th_loadscreen]', reason, window.location.origin);
            return;
        }
        failedVideos.add(video.id);
        const reasons = {
            100: 'Video is unavailable',
            101: 'Video owner disabled embedded playback',
            150: 'Video owner disabled embedded playback',
            153: 'YouTube could not identify the embedded player',
            timeout: 'YouTube did not start in time',
        };
        const reason = `${reasons[code] || 'YouTube playback failed'} (${code || 'unknown'})`;
        showMediaError(reason);
        console.warn('[th_loadscreen]', reason, video.id);
        if (config.skipBrokenYouTubeVideos !== false && youtubeVideos.length > 1) {
            for (let step = 1; step < youtubeVideos.length; step++) {
                const candidate = wrap(selectedIndex + step, youtubeVideos.length);
                if (!failedVideos.has(youtubeVideos[candidate].id)) {
                    selectedIndex = candidate;
                    restartSelectedVideo();
                    return;
                }
            }
        }
        window.clearTimeout(startTimer);
        if (config.fallbackToLocalVideo !== false) startLocalVideo(reason);
        else setStatus(reason);
    }

    function startLocalVideo(reason) {
        usingLocal = true;
        youtubePlaying = false;
        window.clearTimeout(startTimer);
        youtubeWrap.classList.remove('is-visible');

        if (youtubePlayer && youtubeReady) {
            try {
                youtubePlayer.stopVideo();
            } catch (error) {
                console.warn('Could not stop YouTube player', error);
            }
        }

        if (!localVideos.length) {
            setStatus(reason || 'Waiting for server');
            return;
        }

        const localIndex = selectedIndex % localVideos.length;
        localVideo.src = localVideos[localIndex];
        localVideo.volume = volume / 100;
        localVideo.muted = muted;
        localVideo.play()
            .then(function () {
                localVideo.classList.add('is-visible');
                setStatus(reason || 'Playing local video');
            })
            .catch(function () {
                localVideo.muted = true;
                muted = true;
                updateSoundIcon();
                localVideo.play().catch(function () {
                    setStatus('Video is ready; click sound to start media');
                });
            });
    }

    function startMusic() {
        if (!musicTracks.length) {
            return;
        }

        music.src = musicTracks[0];
        music.volume = volume / 100;
        music.muted = muted;
        music.play().catch(function () {
            setStatus('Click sound to enable audio');
        });
    }

    function bindControls() {
        prevButton.addEventListener('click', function () {
            failedVideos.clear();
            selectedIndex = wrap(selectedIndex - 1, videoCount());
            restartSelectedVideo();
        });

        nextButton.addEventListener('click', playNextVideo);

        soundButton.addEventListener('click', function () {
            muted = !muted;
            applyAudioState(true);
        });

        volumeInput.addEventListener('input', function () {
            volume = clamp(Number(volumeInput.value), 0, 100);
            muted = volume === 0;
            applyAudioState(false);
        });
    }

    function playNextVideo() {
        failedVideos.clear();
        selectedIndex = wrap(selectedIndex + 1, videoCount());
        restartSelectedVideo();
    }

    function videoCount() {
        return (config.mode === 'local' || !youtubeVideos.length) ? Math.max(localVideos.length, 1) : youtubeVideos.length;
    }

    function restartSelectedVideo() {
        if (config.mode === 'local' || !youtubeVideos.length) {
            startLocalVideo('Changed local video');
            return;
        }

        usingLocal = false;
        youtubePlaying = false;
        localVideo.pause();
        music.pause();
        localVideo.classList.remove('is-visible');
        youtubeWrap.classList.add('is-visible');
        armYouTubeTimeout();

        if (youtubePlayer && youtubeReady) {
            const video = youtubeVideos[selectedIndex];
            setStatus(`Loading ${video.label}`);
            youtubePlaying = false;
            youtubePlayer.loadVideoById({
                videoId: video.id,
                startSeconds: video.startSeconds,
            });
            applyYouTubeAudio();
            return;
        }

        createYouTubePlayer();
    }

    function applyAudioState(userGesture) {
        localVideo.volume = volume / 100;
        localVideo.muted = muted;
        music.volume = volume / 100;
        music.muted = muted;

        if (userGesture) {
            if (usingLocal) {
                localVideo.play().catch(function () {});
                if (musicTracks.length) music.play().catch(function () {});
            } else if (youtubeReady) {
                applyYouTubeAudio();
                youtubePlayer.playVideo();
                armYouTubeTimeout();
            } else {
                showMediaError('Retrying YouTube connection...');
                armYouTubeTimeout();
                loadYouTubeApi();
            }
        }

        applyYouTubeAudio();
        updateSoundIcon();
    }

    function applyYouTubeAudio() {
        if (!youtubePlayer || !youtubeReady) {
            return;
        }

        try {
            youtubePlayer.setVolume(volume);
            if (muted || volume === 0) {
                youtubePlayer.mute();
            } else {
                youtubePlayer.unMute();
            }
        } catch (error) {
            console.warn('Could not update YouTube audio', error);
        }
    }

    function updateSoundIcon() {
        soundIcon.textContent = muted || volume === 0 ? 'MUTE' : 'VOL';
        volumeInput.value = String(volume);
    }

    function bindFiveMEvents() {
        window.addEventListener('message', function (event) {
            const data = event.data || {};
            const name = data.eventName || data.type || '';

            if (name === 'loadProgress' && typeof data.loadFraction === 'number') {
                setProgress(data.loadFraction * 100);
                setStatus('Loading server files');
                return;
            }

            if (name === 'onLogLine' && data.message) {
                setStatus(cleanLogLine(data.message));
                return;
            }

            if (name === 'loadscreen:status' && data.message) {
                setStatus(data.message);
            }
        });
    }

    function startSoftProgress() {
        window.setInterval(function () {
            if (softProgress < 92) {
                softProgress += softProgress < 45 ? 0.55 : 0.18;
                setProgress(softProgress);
            }
        }, 260);
    }

    function setProgress(value) {
        const next = clamp(value, 0, 100);
        softProgress = Math.max(softProgress, next);
        progressFill.style.width = `${softProgress}%`;
    }

    function setStatus(message) {
        statusText.textContent = message || '';
    }

    function showMediaError(message) {
        if (mediaStatus) mediaStatus.textContent = message || '';
    }

    function cleanLogLine(message) {
        return String(message)
            .replace(/\^.\s?/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 88);
    }

    function clamp(value, min, max) {
        if (Number.isNaN(value)) {
            return min;
        }

        return Math.min(max, Math.max(min, value));
    }

    function wrap(value, length) {
        return ((value % length) + length) % length;
    }
})();
