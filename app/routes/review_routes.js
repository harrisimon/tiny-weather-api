
const express = require('express')
const passport = require('passport')

const Weather = require('../models/weather')

const customErrors = require('../../lib/custom_errors')
const handle404 = customErrors.handle404
const requireOwnership = customErrors.requireOwnership
const removeBlanks = require('../../lib/remove_blank_fields')
const weather = require('../models/weather')
const requireToken = passport.authenticate('bearer', { session: false })
const router = express.Router()

router.post('/review/:weatherId', requireToken,removeBlanks, (req, res, next) => {
    req.body.author = req.user.id
    console.log("user?",req.user.id)
    console.log("the req.body",req.body)
    const review = req.body

    const weatherId = req.params.weatherId
    // console.log("the review being saved",review)
    
    Weather.findById(weatherId)
        .then(handle404)
        .then(weather => {
            // console.log("review before push", typeof review.author)
            weather.reviews.push(review)
            return weather.save()
        })
        .then(weather => res.status(201).json({weather: weather}))
        .catch(next)
})

router.delete('/review/:weatherId/:reviewId', requireToken, (req, res, next) => {
    const {weatherId, reviewId} = req.params
    Weather.findById(weatherId)
        .then(handle404)
        .then(weather => {
            const theReview = weather.reviews.id(reviewId)
            // requireOwnership(req, weather)
            theReview.remove()
            return weather.save()
        })
        .then(weather => res.sendStatus(204))
        .catch(next)
})

module.exports = router