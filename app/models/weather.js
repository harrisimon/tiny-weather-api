const mongoose = require('mongoose')
const reviewSchema = require('./review')

const weatherSchema = new mongoose.Schema(
    {
        temperature: {
            type: Number,
            required: true,
        },
        pressure: {
            type: Number,
            required: true,
        },
        humidity: {
            type: Number,
            required: true,
        },
        reviews: [reviewSchema]

    }, {
        timestamps: true,
    }
)



module.exports = mongoose.model('Weather', weatherSchema)