// Hey, if you're reading this, please don't mess up my website. I can't afford a backend, so I keep the API here :<

window.APP_API_CONFIG = {
    lastfm: {
        username: 'Nozercode',
        apiKey: 'a3c1383c7bfe82bf015f78d6ae03c837',
        baseUrl: 'https://ws.audioscrobbler.com/2.0/',
        recentTracksLimit: 4,
        refreshMs: 30000
    },
    lanyard: {
        userId: '690653953238499369',
        username: 'rezonoxo',
        restUrl: 'https://api.lanyard.rest/v1/users/',
        socketUrl: 'wss://api.lanyard.rest/socket'
    },
    weather: {
        baseUrl: 'https://api.open-meteo.com/v1/forecast',
        latitude: 50.0413,
        longitude: 21.999,
        refreshMs: 30 * 60 * 1000
    },
    counter: {
        providers: [
            {
                type: 'visitorapi',
                baseUrl: 'https://visitor.6developer.com'
            }
        ],
        domainOverride: '',
        fallbackStorageKey: 'nozersite_home_views_local_fallback_v1',
        sharedAcrossDeployments: true
    }
};
