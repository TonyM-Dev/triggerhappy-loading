window.THLoadscreenConfig = {
    serverName: 'Trigger Happy',
    welcomeText: 'Welcome to Trigger Happy!',
    subtitleText: 'Loading server assets',

    // youtube = try YouTube first, local = only play the local mp4.
    mode: 'youtube',

    // random picks a fresh video each connect. ordered starts with the first one.
    selection: 'ordered',

    // Paste normal YouTube links, short links, embed links, or just the video ID.
    youtubeVideos: [
        {
            label: 'Opening track',
            url: 'https://www.youtube.com/watch?v=T487LvBDVM4',
            startSeconds: 0,
        },
        {
            label: 'Should of Saw It - Bloodhound Lil Jeff',
            url: 'https://www.youtube.com/watch?v=Us9BEYzqbXU',
            startSeconds: 0,
        },
        {
            label: 'Track 3',
            url: 'https://www.youtube.com/watch?v=1a8pFj4arQY',
            startSeconds: 0,
        },
        {
            label: 'Track 4',
            url: 'https://www.youtube.com/watch?v=wjDtTv0n0Fw',
            startSeconds: 0,
        },
        {
            label: 'Triple 3 - Bloodhound Q50, Bloodhound Lil Jeff & Lil Scoom89',
            url: 'https://www.youtube.com/watch?v=1hd-eoyniSY',
            startSeconds: 0,
        },
    ],

    localVideos: [],

    // Keep this empty when using YouTube audio, or it will overlap the video.
    musicTracks: [],

    fallbackImage: '',

    // Set false to try starting YouTube audio automatically.
    startMuted: false,
    startVolume: 45,
    showControls: true,

    // If YouTube does not report that it is playing fast enough, use local video.
    youtubeStartTimeoutMs: 20000,
    fallbackToLocalVideo: false,

    // true keeps trying the next YouTube video if one fails.
    skipBrokenYouTubeVideos: true,
};
