const Weather = require('../app/models/weather')

let latestCachedReadingDoc = null
let lastDatabaseWriteTimestamp = null

const ensureCachePopulated = async () => {
	if (latestCachedReadingDoc !== null && lastDatabaseWriteTimestamp !== null) {
		return
	}

	try {
		const latest = await Weather.find({})
			.sort({ createdAt: -1 })
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
			latestCachedReadingDoc = latest[0]
			lastDatabaseWriteTimestamp = new Date(latest[0].createdAt).getTime()
			console.log('📶 Weather cache seeded from database. Last write:', new Date(lastDatabaseWriteTimestamp))
		} else {
			latestCachedReadingDoc = null
			lastDatabaseWriteTimestamp = 0
			console.log('📶 Weather cache seeded: database is empty.')
		}
	} catch (error) {
		console.error('❌ Failed to populate weather cache from database:', error)
		// Set to 0 so we attempt to populate or write on the next post/get
		lastDatabaseWriteTimestamp = 0
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
