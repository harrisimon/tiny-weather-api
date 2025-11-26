const express = require("express")
const passport = require("passport")

const Weather = require("../models/weather")
const User = require("../models/user")
const Review = require("../models/review")

const customErrors = require("../../lib/custom_errors")
const handle404 = customErrors.handle404
const requireOwnership = customErrors.requireOwnership
const removeBlanks = require("../../lib/remove_blank_fields")
const { ObjectId } = require("mongodb")
const requireToken = passport.authenticate("bearer", { session: false })
const router = express.Router()

router.post("/weather", (req, res, next) => {
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
	Weather.find()
		.then((weather) => {
			return weather.map((weather) => weather.toObject())
		})

		.then((weather) => {
			res.status(200).json({ weather: weather })
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

router.get("/latest", (req, res, next) => {
	Weather.find({})

		.sort({ _id: -1 })
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
	const yesterday = new Date(today)
	yesterday.setDate(yesterday.getDate() - 1)

	Weather.find({
		createdAt: {
			$gte: yesterday,
		},
	})
		.then(handle404)
		.then((weather) => {
			res.status(200).json({ weather: weather })
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
})

router.delete("/delete/:id", (req, res, next) => {
	Weather.findById(req.params.id)
		.then(handle404)
		.then((weather) => {
			weather.deleteOne()
		})
		.then(() => res.sendStatus(204))
		.catch(next)
})

router.get("/history/24h", (req, res, next) => {
    const now = new Date()
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    Weather.find({
        createdAt: { $gte: cutoff }
    })
        .sort({ createdAt: 1 }) // chronological order
        .then((weather) => {
            res.status(200).json({ weather })
        })
        .catch(next)
})


module.exports = router
