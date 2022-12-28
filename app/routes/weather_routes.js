const express = require("express")
const passport = require("passport")

const Weather = require("../models/weather")

const customErrors = require("../../lib/custom_errors")
const handle404 = customErrors.handle404
const requireOwnership = customErrors.requireOwnership
const removeBlanks = require("../../lib/remove_blank_fields")
const requireToken = passport.authenticate("bearer", { session: false })
const router = express.Router()

router.post("/weather", (req, res, next) => {
	Weather.create(req.body.weather)
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
		.then((weather) => {
			// weather.logTime = new Date(weather[0].createdAt).toLocaleString('en-us')
			// console.log("logtime",weather)
			res.status(200).json({ weather: weather })
			// console.log("created at",weather[0].createdAt)
			// const date = new Date(`${weather[0].createdAt}`).toLocaleString('en-us')
			// console.log(date)
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
    .then((weather) => {
        res.status(200).json({weather:weather})
    })
})

module.exports = router
