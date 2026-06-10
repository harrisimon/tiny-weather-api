const Weather = require('../app/models/weather')

let latestCachedReadingDoc = null
let lastDatabaseWriteTimestamp = null
let isInitialized = false // Explicitly track initialization state

const ensureCachePopulated = async () => {
    // If we've already run a successful initialization, skip
    if (isInitialized) {
        return
    }

    try {
        // Sort by measuredAt primarily, falling back to createdAt
        const latest = await Weather.find({})
            .sort({ measuredAt: -1, createdAt: -1 })
            .limit(1)
            .populate({
                path: 'reviews',
                populate: {
                    path: 'author',
                    model: 'User',
                    populate: {
                        path: 'email',
                    },
                },
            })

        if (latest && latest.length > 0) {
            // SAFE FALLBACK: Check measuredAt first, then createdAt
            const rawDate = latest[0].measuredAt || latest[0].createdAt
            const parsedTime = rawDate ? new Date(rawDate).getTime() : Number.NaN

            // If the date parsing fails or is missing, fall back to 0 (the Unix epoch)
            lastDatabaseWriteTimestamp = Number.isNaN(parsedTime) ? 0 : parsedTime
            
            if (latestCachedReadingDoc === null) {
                latestCachedReadingDoc = latest[0]
            }
            console.log('📶 Weather cache seeded from database. Last write:', new Date(lastDatabaseWriteTimestamp))
        } else {
            latestCachedReadingDoc = null
            lastDatabaseWriteTimestamp = 0
            console.log('📶 Weather cache seeded: database is empty.')
        }

        // Mark initialization as complete so we stop querying the DB on every request
        isInitialized = true
    } catch (error) {
        console.error('❌ Failed to populate weather cache from database:', error)
        lastDatabaseWriteTimestamp = 0
        isInitialized = false // Allow retry on the next check
    }
}

const getLatest = async () => {
    await ensureCachePopulated()
    return latestCachedReadingDoc
}

const setLatest = (doc) => {
    latestCachedReadingDoc = doc
}

const getLastWriteTime = async () => {
    await ensureCachePopulated()
    return lastDatabaseWriteTimestamp
}

const setLastWriteTime = (time) => {
    lastDatabaseWriteTimestamp = time
    isInitialized = true // Ensure flag stays true when manually setting
}

const saveLatestIfNew = async (weatherId) => {
    await ensureCachePopulated()
    if (
        latestCachedReadingDoc &&
        latestCachedReadingDoc._id.toString() === weatherId &&
        latestCachedReadingDoc.isNew
    ) {
        await latestCachedReadingDoc.save()
        lastDatabaseWriteTimestamp = Date.now()
        console.log('💾 Latest reading saved to DB because a review was added to it.')
    }
}

module.exports = {
    getLatest,
    setLatest,
    getLastWriteTime,
    setLastWriteTime,
    saveLatestIfNew,
    ensureCachePopulated,
}