const express = require('express')
const passport = require('passport')

const Weather = require('../models/weather')
const weatherCache = require('../../lib/weather_cache')

const customErrors = require('../../lib/custom_errors')
const handle404 = customErrors.handle404
const requireOwnership = customErrors.requireOwnership
const removeBlanks = require('../../lib/remove_blank_fields')
const requireToken = passport.authenticate('bearer', { session: false })
const router = express.Router()

router.post('/review/:weatherId', requireToken, removeBlanks, (req, res, next) => {
	req.body.author = req.user.id
	console.log("user?", req.user.id)
	console.log("the req.body", req.body)
	const review = req.body

	const weatherId = req.params.weatherId
	
	// Lazy-save the latest cached reading if the review targets it and it's not saved yet
	weatherCache.saveLatestIfNew(weatherId)
		.then(() => Weather.findById(weatherId))
		.then(handle404)
		.then(weather => {
			weather.reviews.push(review)
			return weather.save()
		})
		.then(weather => {
			return weather.populate({
				path: "reviews",
				populate: {
					path: "author",
					model: "User",
				},
			})
		})
		.then(weather => {
			// Update the cache with the populated document
			weatherCache.setLatest(weather)
			res.status(201).json({ weather: weather })
		})
		.catch(next)
})

router.delete('/review/:weatherId/:reviewId', requireToken, (req, res, next) => {
	const { weatherId, reviewId } = req.params
	
	// The weather document must exist in DB to be deleted from it
	Weather.findById(weatherId)
		.then(handle404)
		.then(weather => {
			const theReview = weather.reviews.id(reviewId)
			theReview.remove()
			return weather.save()
		})
		.then(weather => {
			return weather.populate({
				path: "reviews",
				populate: {
					path: "author",
					model: "User",
				},
			})
		})
		.then(weather => {
			// Update the cache with the populated document
			weatherCache.setLatest(weather)
			res.sendStatus(204)
		})
		.catch(next)
})

module.exports = router