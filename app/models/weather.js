const mongoose = require('mongoose')
const reviewSchema = require('./review')

const weatherSchema = new mongoose.Schema(
    {
        temperature: {
            type: Number,
            required: true,
            min: -60,
            max: 140,
        },
        pressure: {
            type: Number,
            required: true,
            min: 800,
            max: 1200,
        },
        humidity: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        measuredAt: {
            type: Date,
            default: Date.now,
        },
        deviceId: {
            type: String,
            trim: true,
            maxlength: 80,
        },
        reviews: [reviewSchema]

    }, {
        timestamps: true,
    }
)

weatherSchema.index({ createdAt: -1 })
weatherSchema.index({ measuredAt: -1 })
weatherSchema.index({ deviceId: 1, measuredAt: -1 })



module.exports = mongoose.model('Weather', weatherSchema)
