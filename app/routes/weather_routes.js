const express = require("express")
const passport = require("passport")

const Weather = require("../models/weather")

const customErrors = require("../../lib/custom_errors")
const handle404 = customErrors.handle404
const BadParamsError = customErrors.BadParamsError
const requireWeatherToken = require("../../lib/require_weather_token")
const { ObjectId } = require("mongodb")
const requireToken = passport.authenticate("bearer", { session: false })
const router = express.Router()

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_HISTORY_DAYS = 7
const MAX_HISTORY_LIMIT = 5000

const bucketFormats = {
	hour: "%Y-%m-%dT%H:00:00.000Z",
	day: "%Y-%m-%dT00:00:00.000Z",
}

const addReadingAtStage = {
	$addFields: {
		readingAt: {
			$ifNull: ["$measuredAt", "$createdAt"],
		},
	},
}

const parseOptionalDate = (value, fallback) => {
	if (!value) {
		return fallback
	}

	const date = new Date(value)

	if (Number.isNaN(date.getTime())) {
		throw new BadParamsError()
	}

	return date
}

const getHistoryOptions = (query) => {
	const now = new Date()
	const defaultFrom = new Date(now.getTime() - DEFAULT_HISTORY_DAYS * MS_PER_DAY)
	const from = parseOptionalDate(query.from, defaultFrom)
	const to = parseOptionalDate(query.to, now)

	if (from > to) {
		throw new BadParamsError()
	}

	const match = {
		readingAt: {
			$gte: from,
			$lte: to,
		},
	}

	if (query.deviceId) {
		match.deviceId = query.deviceId
	}

	return {
		from,
		to,
		match,
	}
}

const getHistoryLimit = (query) => {
	const limit = Number.parseInt(query.limit, 10)

	if (Number.isNaN(limit)) {
		return 1000
	}

	return Math.min(Math.max(limit, 1), MAX_HISTORY_LIMIT)
}

const emptySummary = (from, to) => ({
	count: 0,
	from,
	to,
	temperature: {
		min: null,
		max: null,
		avg: null,
	},
	humidity: {
		min: null,
		max: null,
		avg: null,
	},
	pressure: {
		min: null,
		max: null,
		avg: null,
	},
})

router.post("/weather", requireWeatherToken, (req, res, next) => {
	Weather.create(req.body.weather)
		.then(handle404)
		.then((weather) => {
			res.status(201).json({
				weather: weather.toObject(),
			})
		})
		.catch(next)
})

router.get("/weather", (req, res, next) => {
	const limit = Math.min(Number.parseInt(req.query.limit, 10) || 100, 500)

	Weather.find()
		.sort({ createdAt: -1 })
		.limit(limit)
		.then((weather) => {
			return weather.map((weather) => weather.toObject())
		})

		.then((weather) => {
			res.status(200).json({ weather: weather })
		})
		.catch(next)
})

router.get("/latest", (req, res, next) => {
	Weather.find({})

		.sort({ createdAt: -1 })
		.limit(1)
		.populate({
			path: "reviews",
			populate: {
				path: "author",
				model: "User",
				populate: {
					path: "email",
				},
			},
		})
		.then((weather) => {
			res.status(200).json({ weather: weather })
		})
		.catch(next)
})

router.get("/today", (req, res, next) => {
	const today = new Date()
	today.setHours(0, 0, 0, 0)

	Weather.find({
		createdAt: {
			$gte: today,
		},
	})
		.sort({ createdAt: 1 })
		.then(handle404)
		.then((weather) => {
			res.status(200).json({ weather: weather })
		})
		.catch(next)
})

router.get("/weather/history", (req, res, next) => {
	const { match } = getHistoryOptions(req.query)
	const limit = getHistoryLimit(req.query)

	Weather.aggregate([
		addReadingAtStage,
		{ $match: match },
		{ $sort: { readingAt: 1 } },
		{ $limit: limit },
	])
		.then((weather) => {
			res.status(200).json({ weather: weather })
		})
		.catch(next)
})

router.get("/weather/summary", (req, res, next) => {
	const { from, to, match } = getHistoryOptions(req.query)

	Weather.aggregate([
		addReadingAtStage,
		{ $match: match },
		{
			$group: {
				_id: null,
				count: { $sum: 1 },
				temperatureMin: { $min: "$temperature" },
				temperatureMax: { $max: "$temperature" },
				temperatureAvg: { $avg: "$temperature" },
				humidityMin: { $min: "$humidity" },
				humidityMax: { $max: "$humidity" },
				humidityAvg: { $avg: "$humidity" },
				pressureMin: { $min: "$pressure" },
				pressureMax: { $max: "$pressure" },
				pressureAvg: { $avg: "$pressure" },
			},
		},
	])
		.then((results) => {
			const summary = results[0]

			if (!summary) {
				return emptySummary(from, to)
			}

			return {
				count: summary.count,
				from,
				to,
				temperature: {
					min: summary.temperatureMin,
					max: summary.temperatureMax,
					avg: summary.temperatureAvg,
				},
				humidity: {
					min: summary.humidityMin,
					max: summary.humidityMax,
					avg: summary.humidityAvg,
				},
				pressure: {
					min: summary.pressureMin,
					max: summary.pressureMax,
					avg: summary.pressureAvg,
				},
			}
		})
		.then((summary) => {
			res.status(200).json({ summary })
		})
		.catch(next)
})

router.get("/weather/timeseries", (req, res, next) => {
	const { match } = getHistoryOptions(req.query)
	const bucket = req.query.bucket || "hour"
	const format = bucketFormats[bucket]

	if (!format) {
		throw new BadParamsError()
	}

	Weather.aggregate([
		addReadingAtStage,
		{ $match: match },
		{
			$group: {
				_id: {
					$dateToString: {
						format,
						date: "$readingAt",
						timezone: "UTC",
					},
				},
				count: { $sum: 1 },
				temperatureMin: { $min: "$temperature" },
				temperatureMax: { $max: "$temperature" },
				temperatureAvg: { $avg: "$temperature" },
				humidityMin: { $min: "$humidity" },
				humidityMax: { $max: "$humidity" },
				humidityAvg: { $avg: "$humidity" },
				pressureMin: { $min: "$pressure" },
				pressureMax: { $max: "$pressure" },
				pressureAvg: { $avg: "$pressure" },
			},
		},
		{ $sort: { _id: 1 } },
	])
		.then((results) => {
			const points = results.map((point) => ({
				bucketStart: point._id,
				bucket,
				count: point.count,
				temperature: {
					min: point.temperatureMin,
					max: point.temperatureMax,
					avg: point.temperatureAvg,
				},
				humidity: {
					min: point.humidityMin,
					max: point.humidityMax,
					avg: point.humidityAvg,
				},
				pressure: {
					min: point.pressureMin,
					max: point.pressureMax,
					avg: point.pressureAvg,
				},
			}))

			res.status(200).json({ timeseries: points })
		})
		.catch(next)
})

router.get("/my-posts", requireToken, (req, res, next) => {
	const author = req.user.id
	console.log(author)
	Weather.aggregate([
		{
			$match: {
				reviews: { $elemMatch: { author: ObjectId(`${author}`) } },
			},
		},
		{ $unwind: "$reviews" },
		{ $match: { "reviews.author": { $eq: ObjectId(`${author}`) } } },
	])

		.then(handle404)
		.then((reviews) => {
			res.status(200).json({ reviews: reviews })
		})
		.catch(next)
})

router.delete("/delete/:id", requireToken, (req, res, next) => {
	Weather.findById(req.params.id)
		.then(handle404)
		.then((weather) => {
			return weather.deleteOne()
		})
		.then(() => res.sendStatus(204))
		.catch(next)
})

router.get("/history/24h", (req, res, next) => {
	const now = new Date()
	const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)

	Weather.aggregate([
		addReadingAtStage,
		{
			$match: {
				readingAt: { $gte: cutoff },
			},
		},
		{ $sort: { readingAt: 1 } }, // chronological order
	])
		.then((weather) => {
			res.status(200).json({ weather })
		})
		.catch(next)
})

router.get("/weather/:id", (req, res, next) => {
	Weather.findById(req.params.id)
		// .populate('author')
		.then(handle404)
		.then((weather) => {
			res.status(200).json({ weather: weather })
		})
		.catch(next)
})


module.exports = router
